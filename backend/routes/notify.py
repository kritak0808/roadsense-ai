"""Test notification endpoint."""
from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required

notify_bp = Blueprint("notify", __name__)


@notify_bp.route("/notify/test", methods=["POST"])
@jwt_required()
def test_notify():
    """Send a test alert to configured channels."""
    from services.email_service import send_damage_alert
    from services.telegram_service import send_telegram_alert

    # Create a mock prediction object
    class MockPred:
        id = 0
        predicted_class = "Pothole"
        confidence = 0.95
        severity_score = 80.5
        original_filename = "test_image.jpg"
        gradcam_path = None
        created_at = datetime.now(timezone.utc)

    mock = MockPred()
    email_sent = send_damage_alert(current_app._get_current_object(), mock)
    telegram_sent = send_telegram_alert(current_app._get_current_object(), mock)

    return jsonify({
        "success": True,
        "data": {"email_sent": email_sent, "telegram_sent": telegram_sent},
        "error": None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
