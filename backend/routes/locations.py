"""Locations endpoint — returns all predictions that have GPS coordinates."""
from __future__ import annotations

from datetime import datetime, timezone

from flask_restx import Namespace, Resource

from database.models import Prediction

locations_ns = Namespace("locations", description="Geo-tagged damage locations")


@locations_ns.route("")
class Locations(Resource):
    def get(self):
        """Return all predictions with lat/lng for map display."""
        preds = (
            Prediction.query
            .filter(
                Prediction.latitude.isnot(None),
                Prediction.longitude.isnot(None),
            )
            .order_by(Prediction.created_at.desc())
            .limit(500)
            .all()
        )

        return {
            "success": True,
            "data": [
                {
                    "id": p.id,
                    "lat": p.latitude,
                    "lng": p.longitude,
                    "predicted_class": p.predicted_class,
                    "confidence": round(p.confidence, 4),
                    "severity_score": p.severity_score,
                    "repair_urgency": p.repair_urgency,
                    "original_filename": p.original_filename,
                    "created_at": p.created_at.isoformat(),
                }
                for p in preds
            ],
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
