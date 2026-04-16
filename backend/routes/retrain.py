"""Model retraining endpoints."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

from flask import current_app, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Namespace, Resource

from extensions import db
from database.models import Job

retrain_ns = Namespace("retrain", description="Model fine-tuning")


@retrain_ns.route("/start")
class RetrainStart(Resource):
    @jwt_required()
    def post(self):
        data = request.get_json() or {}
        dataset_id = data.get("dataset_id", "")
        arch = data.get("arch", "resnet50")
        epochs = int(data.get("epochs", 10))
        batch_size = int(data.get("batch_size", 32))
        lr = float(data.get("lr", 1e-4))

        # Resolve dataset directory
        from database.models import Dataset
        ds = Dataset.query.filter_by(dataset_id=dataset_id).first()
        if not ds:
            return {"success": False, "error": "Dataset not found", "data": None}, 404

        dataset_dir = os.path.join(
            current_app.config["UPLOAD_FOLDER"], "datasets", dataset_id
        )
        output_path = os.path.join(
            current_app.config["WEIGHTS_DIR"], f"retrained_{arch}_{uuid.uuid4().hex[:8]}.pth"
        )

        job_id = str(uuid.uuid4())
        job = Job(
            job_id=job_id,
            user_id=get_jwt_identity(),
            job_type="retrain",
            total=epochs,
        )
        db.session.add(job)
        db.session.commit()

        from services.celery_tasks import run_retrain
        task = run_retrain.delay(
            job_id, dataset_dir, arch, epochs, batch_size, lr, output_path
        )
        job.celery_task_id = task.id
        db.session.commit()

        return {
            "success": True,
            "data": {"job_id": job_id, "arch": arch, "epochs": epochs},
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@retrain_ns.route("/status/<string:job_id>")
class RetrainStatus(Resource):
    @jwt_required()
    def get(self, job_id: str):
        job = Job.query.filter_by(job_id=job_id).first_or_404()
        return {
            "success": True,
            "data": job.to_dict(),
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@retrain_ns.route("/cancel/<string:job_id>")
class RetrainCancel(Resource):
    @jwt_required()
    def post(self, job_id: str):
        job = Job.query.filter_by(job_id=job_id).first_or_404()
        if job.celery_task_id:
            from celeryworker import celery
            celery.control.revoke(job.celery_task_id, terminate=True)
        job.status = "cancelled"
        db.session.commit()
        return {
            "success": True,
            "data": {"job_id": job_id, "status": "cancelled"},
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
