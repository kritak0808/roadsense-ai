"""Admin-only endpoints: user management, system metrics, model management."""
from __future__ import annotations

import functools
from datetime import datetime, timezone

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Namespace, Resource

from extensions import db
from database.models import Job, ModelRegistry, Prediction, User

admin_ns = Namespace("admin", description="Admin operations")


def admin_required(fn):
    @functools.wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user = User.query.get(get_jwt_identity())
        if not user or user.role != "admin":
            return {"success": False, "error": "Admin access required", "data": None}, 403
        return fn(*args, **kwargs)
    return wrapper


@admin_ns.route("/users")
class UserList(Resource):
    @admin_required
    def get(self):
        users = User.query.all()
        return {
            "success": True,
            "data": [u.to_dict() for u in users],
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@admin_ns.route("/users/<int:user_id>")
class UserDetail(Resource):
    @admin_required
    def put(self, user_id: int):
        user = User.query.get_or_404(user_id)
        data = request.get_json() or {}
        if "role" in data and data["role"] in ("admin", "analyst", "viewer"):
            user.role = data["role"]
        if "is_active" in data:
            user.is_active = bool(data["is_active"])
        if "email" in data:
            user.email = data["email"].strip().lower()
        db.session.commit()
        return {
            "success": True,
            "data": user.to_dict(),
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    @admin_required
    def delete(self, user_id: int):
        user = User.query.get_or_404(user_id)
        db.session.delete(user)
        db.session.commit()
        return {
            "success": True,
            "data": {"deleted": user_id},
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@admin_ns.route("/metrics")
class SystemMetrics(Resource):
    @admin_required
    def get(self):
        total_preds = Prediction.query.count()
        total_users = User.query.count()
        total_jobs = Job.query.count()
        running_jobs = Job.query.filter_by(status="running").count()
        class_dist = (
            db.session.query(Prediction.predicted_class, db.func.count())
            .group_by(Prediction.predicted_class)
            .all()
        )
        return {
            "success": True,
            "data": {
                "total_predictions": total_preds,
                "total_users": total_users,
                "total_jobs": total_jobs,
                "running_jobs": running_jobs,
                "class_distribution": {cls: cnt for cls, cnt in class_dist},
            },
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@admin_ns.route("/models")
class ModelList(Resource):
    @admin_required
    def get(self):
        models = ModelRegistry.query.all()
        return {
            "success": True,
            "data": [m.to_dict() for m in models],
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    @admin_required
    def post(self):
        """Register a new model weight entry."""
        data = request.get_json() or {}
        model = ModelRegistry(
            name=data.get("name", "unnamed"),
            architecture=data.get("architecture", "resnet50"),
            weights_path=data.get("weights_path", ""),
            accuracy=data.get("accuracy"),
            f1_score=data.get("f1_score"),
            is_active=data.get("is_active", False),
            is_production=data.get("is_production", False),
        )
        db.session.add(model)
        db.session.commit()
        return {
            "success": True,
            "data": model.to_dict(),
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }, 201


@admin_ns.route("/alert_config")
class AlertConfig(Resource):
    @admin_required
    def get(self):
        from flask import current_app
        return {
            "success": True,
            "data": {
                "confidence_threshold": current_app.config["ALERT_CONFIDENCE_THRESHOLD"],
                "dedup_window_seconds": current_app.config["ALERT_DEDUP_WINDOW_SECONDS"],
                "rhs_alert_threshold": current_app.config["RHS_ALERT_THRESHOLD"],
                "recipients": current_app.config["ALERT_RECIPIENTS"],
                "telegram_configured": bool(current_app.config["TELEGRAM_BOT_TOKEN"]),
            },
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
