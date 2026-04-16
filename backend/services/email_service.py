"""SMTP email alert service with deduplication."""
from __future__ import annotations

import base64
import hashlib
import logging
import os
from datetime import datetime, timezone

from flask import Flask
from flask_mail import Message

logger = logging.getLogger(__name__)


def _dedup_key(pred_id: int, alert_type: str) -> str:
    return hashlib.md5(f"{alert_type}:{pred_id}".encode()).hexdigest()


def _is_duplicate(app: Flask, dedup_key: str) -> bool:
    from database.models import AlertLog
    from extensions import db

    window = app.config.get("ALERT_DEDUP_WINDOW_SECONDS", 3600)
    recent = (
        AlertLog.query.filter_by(dedup_key=dedup_key)
        .order_by(AlertLog.sent_at.desc())
        .first()
    )
    if not recent:
        return False
    elapsed = (datetime.now(timezone.utc) - recent.sent_at.replace(tzinfo=timezone.utc)).total_seconds()
    return elapsed < window


def send_damage_alert(app: Flask, pred) -> bool:
    """Send HTML email alert for a high-confidence damage prediction."""
    from extensions import mail, db
    from database.models import AlertLog

    key = _dedup_key(pred.id, "email")
    if _is_duplicate(app, key):
        logger.info("Alert deduped for prediction %d", pred.id)
        return False

    recipients = [r for r in app.config.get("ALERT_RECIPIENTS", []) if r]
    if not recipients:
        return False

    # Embed Grad-CAM thumbnail if available
    img_tag = ""
    if pred.gradcam_path and os.path.exists(pred.gradcam_path):
        with open(pred.gradcam_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        img_tag = f'<img src="data:image/jpeg;base64,{b64}" style="max-width:400px"/>'

    html_body = f"""
    <html><body>
    <h2 style="color:#c0392b">🚨 Road Damage Alert</h2>
    <table>
      <tr><td><b>Class</b></td><td>{pred.predicted_class}</td></tr>
      <tr><td><b>Confidence</b></td><td>{pred.confidence:.1%}</td></tr>
      <tr><td><b>Severity Score</b></td><td>{pred.severity_score}</td></tr>
      <tr><td><b>File</b></td><td>{pred.original_filename}</td></tr>
      <tr><td><b>Detected At</b></td><td>{pred.created_at.isoformat()}</td></tr>
    </table>
    {img_tag}
    </body></html>
    """

    try:
        with app.app_context():
            msg = Message(
                subject=f"[Road Damage] {pred.predicted_class} detected ({pred.confidence:.0%})",
                recipients=recipients,
                html=html_body,
            )
            mail.send(msg)

        log = AlertLog(
            alert_type="email",
            trigger=f"{pred.predicted_class}:{pred.confidence:.2f}",
            prediction_id=pred.id,
            recipient=",".join(recipients),
            status="sent",
            dedup_key=key,
        )
        db.session.add(log)
        db.session.commit()
        logger.info("Email alert sent for prediction %d", pred.id)
        return True
    except Exception as exc:
        logger.error("Email alert failed: %s", exc)
        return False


def maybe_send_alert(app: Flask, pred) -> None:
    """Conditionally send alert based on confidence threshold."""
    threshold = app.config.get("ALERT_CONFIDENCE_THRESHOLD", 0.85)
    if pred.predicted_class != "Good" and pred.confidence >= threshold:
        send_damage_alert(app, pred)
