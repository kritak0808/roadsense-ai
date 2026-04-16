"""Weather correlation endpoint."""
from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify

from services.weather_service import get_weather

weather_bp = Blueprint("weather", __name__)


@weather_bp.route("/weather/<float:lat>/<float:lng>")
def weather(lat: float, lng: float):
    api_key = current_app.config.get("OPENWEATHER_API_KEY", "")
    data = get_weather(lat, lng, api_key)
    return jsonify({
        "success": True,
        "data": data,
        "error": None if data else "Weather API key not configured or request failed",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
