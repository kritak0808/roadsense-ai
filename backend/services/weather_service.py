"""OpenWeatherMap integration."""
from __future__ import annotations

import logging

import requests

logger = logging.getLogger(__name__)

OWM_BASE = "https://api.openweathermap.org/data/2.5/weather"


def get_weather(lat: float, lng: float, api_key: str) -> dict:
    """Fetch current weather for a coordinate pair."""
    if not api_key:
        return {}
    try:
        resp = requests.get(
            OWM_BASE,
            params={"lat": lat, "lon": lng, "appid": api_key, "units": "metric"},
            timeout=8,
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "temp": data["main"]["temp"],
            "humidity": data["main"]["humidity"],
            "rainfall_mm": data.get("rain", {}).get("1h", 0.0),
            "condition": data["weather"][0]["description"],
            "wind_speed": data["wind"]["speed"],
        }
    except Exception as exc:
        logger.warning("Weather fetch failed: %s", exc)
        return {}
