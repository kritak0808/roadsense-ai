"""Telegram bot alert service."""
from __future__ import annotations

import logging

import requests

logger = logging.getLogger(__name__)


def send_telegram_alert(app, pred) -> bool:
    """Send a Telegram message for a high-severity prediction."""
    token = app.config.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = app.config.get("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        return False

    text = (
        f"🚨 *Road Damage Detected*\n"
        f"Class: *{pred.predicted_class}*\n"
        f"Confidence: *{pred.confidence:.1%}*\n"
        f"Severity: *{pred.severity_score}*\n"
        f"File: `{pred.original_filename}`"
    )

    try:
        resp = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
            timeout=10,
        )
        resp.raise_for_status()
        logger.info("Telegram alert sent for prediction %d", pred.id)
        return True
    except Exception as exc:
        logger.error("Telegram alert failed: %s", exc)
        return False
