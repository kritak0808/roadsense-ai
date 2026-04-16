"""History, analytics, export, and timeline endpoints."""
from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone

from flask import Response, request
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request
from flask_restx import Namespace, Resource

from extensions import db
from database.models import Prediction

history_ns = Namespace("history", description="Prediction history and analytics")


@history_ns.route("")
class History(Resource):
    def get(self):
        """Paginated prediction history with optional filters."""
        page = int(request.args.get("page", 1))
        per_page = min(int(request.args.get("per_page", 20)), 100)
        cls_filter = request.args.get("class")
        min_conf = request.args.get("min_confidence", type=float)
        road_id = request.args.get("road_segment_id")

        q = Prediction.query.order_by(Prediction.created_at.desc())
        if cls_filter:
            q = q.filter_by(predicted_class=cls_filter)
        if min_conf is not None:
            q = q.filter(Prediction.confidence >= min_conf)
        if road_id:
            q = q.filter_by(road_segment_id=road_id)

        paginated = q.paginate(page=page, per_page=per_page, error_out=False)
        return {
            "success": True,
            "data": {
                "items": [p.to_dict() for p in paginated.items],
                "total": paginated.total,
                "page": page,
                "per_page": per_page,
                "pages": paginated.pages,
            },
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@history_ns.route("/stats")
class Stats(Resource):
    def get(self):
        """Aggregate analytics."""
        total = Prediction.query.count()
        class_dist = (
            db.session.query(Prediction.predicted_class, db.func.count())
            .group_by(Prediction.predicted_class)
            .all()
        )
        avg_conf = db.session.query(db.func.avg(Prediction.confidence)).scalar() or 0
        avg_severity = db.session.query(db.func.avg(Prediction.severity_score)).scalar() or 0

        # Daily counts (last 30 days)
        from sqlalchemy import func, text
        daily = (
            db.session.query(
                func.date(Prediction.created_at).label("date"),
                func.count().label("count"),
            )
            .group_by(func.date(Prediction.created_at))
            .order_by(text("date DESC"))
            .limit(30)
            .all()
        )

        return {
            "success": True,
            "data": {
                "total_predictions": total,
                "class_distribution": {cls: cnt for cls, cnt in class_dist},
                "average_confidence": round(float(avg_conf), 4),
                "average_severity": round(float(avg_severity), 4),
                "daily_counts": [{"date": str(d), "count": c} for d, c in daily],
            },
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@history_ns.route("/export")
class ExportCSV(Resource):
    def get(self):
        """Download prediction history as CSV."""
        preds = Prediction.query.order_by(Prediction.created_at.desc()).limit(5000).all()
        output = io.StringIO()
        writer = csv.DictWriter(
            output,
            fieldnames=[
                "id", "session_id", "original_filename", "predicted_class",
                "confidence", "severity_score", "model_used", "road_segment_id",
                "latitude", "longitude", "repair_urgency", "created_at",
            ],
        )
        writer.writeheader()
        for p in preds:
            writer.writerow({
                "id": p.id,
                "session_id": p.session_id,
                "original_filename": p.original_filename,
                "predicted_class": p.predicted_class,
                "confidence": p.confidence,
                "severity_score": p.severity_score,
                "model_used": p.model_used,
                "road_segment_id": p.road_segment_id or "",
                "latitude": p.latitude or "",
                "longitude": p.longitude or "",
                "repair_urgency": p.repair_urgency or "",
                "created_at": p.created_at.isoformat(),
            })
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment; filename=predictions.csv"},
        )


@history_ns.route("/export/coco")
class ExportCOCO(Resource):
    def get(self):
        """Export predictions as COCO-format JSON annotations."""
        preds = Prediction.query.limit(5000).all()
        categories = [
            {"id": i, "name": cls}
            for i, cls in enumerate(["Good", "Crack", "Pothole", "Vandalism"])
        ]
        images = []
        annotations = []
        for p in preds:
            images.append({"id": p.id, "file_name": p.original_filename})
            annotations.append({
                "id": p.id,
                "image_id": p.id,
                "category_id": ["Good", "Crack", "Pothole", "Vandalism"].index(
                    p.predicted_class
                ),
                "score": p.confidence,
            })
        coco = {"images": images, "annotations": annotations, "categories": categories}
        return Response(
            json.dumps(coco, indent=2),
            mimetype="application/json",
            headers={"Content-Disposition": "attachment; filename=annotations_coco.json"},
        )


@history_ns.route("/timeline/<string:road_id>")
class Timeline(Resource):
    def get(self, road_id: str):
        """Degradation history for a road segment."""
        preds = (
            Prediction.query.filter_by(road_segment_id=road_id)
            .order_by(Prediction.created_at.asc())
            .all()
        )
        from ai_model.utils.metrics import compute_road_health_score
        points = [
            {
                "date": p.created_at.isoformat(),
                "predicted_class": p.predicted_class,
                "confidence": p.confidence,
                "severity_score": p.severity_score,
                "rhs": compute_road_health_score(p.severity_score),
                "weather_rainfall": p.weather_rainfall,
                "weather_temp": p.weather_temp,
            }
            for p in preds
        ]
        return {
            "success": True,
            "data": {"road_segment_id": road_id, "points": points},
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
