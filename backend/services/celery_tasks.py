"""Celery async tasks: batch inference, retrain, PDF, alerts."""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from celeryworker import celery

logger = logging.getLogger(__name__)


@celery.task(bind=True, name="tasks.process_batch", max_retries=3)
def process_batch(self, job_id: str, image_paths: list[str], user_id: int | None = None):
    """Process a batch of images asynchronously."""
    from app import create_app
    from extensions import db, socketio
    from database.models import Job, Prediction
    from ai_model.ensemble import get_ensemble
    from ai_model.gradcam import generate_gradcam
    from ai_model.predict import get_model_for_gradcam
    from services.email_service import maybe_send_alert

    app = create_app()
    with app.app_context():
        job = Job.query.filter_by(job_id=job_id).first()
        if not job:
            return {"error": "Job not found"}

        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        job.total = len(image_paths)
        db.session.commit()

        ensemble = get_ensemble(app.config["WEIGHTS_DIR"])
        results = []

        for idx, path in enumerate(image_paths):
            try:
                with open(path, "rb") as f:
                    img_bytes = f.read()

                result = ensemble.predict(img_bytes)

                # Grad-CAM
                resnet = get_model_for_gradcam("resnet50", None)
                _, overlay = generate_gradcam(resnet, img_bytes, arch="resnet50")

                import cv2
                import uuid as _uuid
                overlay_path = os.path.join(
                    app.config["UPLOAD_FOLDER"], f"gradcam_{_uuid.uuid4().hex}.jpg"
                )
                cv2.imwrite(overlay_path, cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))

                pred = Prediction(
                    user_id=user_id,
                    image_path=path,
                    original_filename=os.path.basename(path),
                    predicted_class=result["predicted_class"],
                    confidence=result["confidence"],
                    all_probabilities=result["probabilities"],
                    model_used="ensemble",
                    severity_score=result["severity_score"],
                    gradcam_path=overlay_path,
                )
                db.session.add(pred)
                db.session.commit()

                results.append({"file": os.path.basename(path), **result})
                maybe_send_alert(app, pred)

            except Exception as exc:
                logger.error("Batch item %s failed: %s", path, exc)
                results.append({"file": os.path.basename(path), "error": str(exc)})

            job.progress = idx + 1
            db.session.commit()

            socketio.emit(
                "batch_progress",
                {
                    "job_id": job_id,
                    "progress": idx + 1,
                    "total": len(image_paths),
                    "latest": results[-1],
                },
                namespace="/",
            )

        job.status = "done"
        job.completed_at = datetime.now(timezone.utc)
        job.result = {"count": len(results), "results": results}
        db.session.commit()

        socketio.emit("batch_complete", {"job_id": job_id, "results": results})
        return job.result


@celery.task(bind=True, name="tasks.run_retrain", max_retries=1)
def run_retrain(self, job_id: str, dataset_dir: str, arch: str, epochs: int,
                batch_size: int, lr: float, output_path: str):
    """Fine-tune a model and stream progress via WebSocket."""
    from app import create_app
    from extensions import db, socketio
    from database.models import Job
    from ai_model.train import train_model

    app = create_app()
    with app.app_context():
        job = Job.query.filter_by(job_id=job_id).first()
        if not job:
            return

        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        db.session.commit()

        def _progress(metrics: dict):
            job.progress = metrics["epoch"]
            db.session.commit()
            socketio.emit("retrain_progress", {"job_id": job_id, **metrics})

        try:
            result = train_model(
                dataset_dir=dataset_dir, arch=arch, epochs=epochs,
                batch_size=batch_size, lr=lr, output_path=output_path,
                progress_callback=_progress,
            )
            job.status = "done"
            job.result = result
        except Exception as exc:
            job.status = "failed"
            job.error_message = str(exc)
            logger.error("Retrain job %s failed: %s", job_id, exc)

        job.completed_at = datetime.now(timezone.utc)
        db.session.commit()
        socketio.emit("retrain_complete", {"job_id": job_id, "result": job.result})


@celery.task(name="tasks.generate_pdf")
def generate_pdf(job_id: str, session_id: str):
    """Generate PDF report for a session."""
    from app import create_app
    from extensions import db
    from database.models import Job
    from services.report_service import build_pdf_report

    app = create_app()
    with app.app_context():
        job = Job.query.filter_by(job_id=job_id).first()
        if not job:
            return
        try:
            pdf_path = build_pdf_report(session_id, app.config["UPLOAD_FOLDER"])
            job.status = "done"
            job.result = {"pdf_path": pdf_path}
        except Exception as exc:
            job.status = "failed"
            job.error_message = str(exc)
        job.completed_at = datetime.now(timezone.utc)
        db.session.commit()


@celery.task(name="tasks.send_alert")
def send_alert_task(prediction_id: int):
    """Send email + Telegram alert for a high-severity prediction."""
    from app import create_app
    from database.models import Prediction
    from services.email_service import send_damage_alert
    from services.telegram_service import send_telegram_alert

    app = create_app()
    with app.app_context():
        pred = Prediction.query.get(prediction_id)
        if pred:
            send_damage_alert(app, pred)
            send_telegram_alert(app, pred)
