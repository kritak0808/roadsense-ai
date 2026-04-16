"""Prediction endpoints: single, batch, ensemble, video frame."""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone

from flask import current_app, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from flask_restx import Namespace, Resource
from werkzeug.datastructures import FileStorage

from extensions import db, limiter
from database.models import Job, Prediction
from services.cost_estimator import estimate_repair_cost
from services.email_service import maybe_send_alert

logger = logging.getLogger(__name__)

predict_ns = Namespace("predict", description="Inference endpoints")

upload_parser = predict_ns.parser()
upload_parser.add_argument("file", location="files", type=FileStorage, required=True)
upload_parser.add_argument("model", location="form", type=str, default="ensemble")
upload_parser.add_argument("road_segment_id", location="form", type=str, default="")
upload_parser.add_argument("lat", location="form", type=float)
upload_parser.add_argument("lng", location="form", type=float)
upload_parser.add_argument("area_sqm", location="form", type=float, default=5.0)
upload_parser.add_argument("region", location="form", type=str, default="urban")


def _save_upload(file_storage) -> tuple[str, bytes]:
    """Save uploaded file, return (path, bytes)."""
    ext = file_storage.filename.rsplit(".", 1)[-1].lower()
    fname = f"{uuid.uuid4().hex}.{ext}"
    path = os.path.join(current_app.config["UPLOAD_FOLDER"], fname)
    file_storage.save(path)
    with open(path, "rb") as f:
        return path, f.read()


def _allowed(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in {
        "jpg", "jpeg", "png", "webp"
    }


def _save_overlay(overlay_np, prefix: str) -> str:
    import cv2
    fname = f"{prefix}_{uuid.uuid4().hex}.jpg"
    path = os.path.join(current_app.config["UPLOAD_FOLDER"], fname)
    cv2.imwrite(path, cv2.cvtColor(overlay_np, cv2.COLOR_RGB2BGR))
    return path


@predict_ns.route("")
class PredictSingle(Resource):
    @limiter.limit("30 per minute")
    def post(self):
        """Single image inference with Grad-CAM, depth, and cost estimate."""
        try:
            args = upload_parser.parse_args()
            file = args["file"]
            if file is None:
                return {"success": False, "error": "No file uploaded", "data": None}, 400
            if not _allowed(file.filename):
                return {"success": False, "error": "Invalid file type — use JPG/PNG/WebP", "data": None}, 400

            path, img_bytes = _save_upload(file)
            arch = args["model"] if args["model"] != "ensemble" else "resnet50"

            # Lazy AI imports
            from ai_model.predict import predict_single, get_model_for_gradcam
            from ai_model.gradcam import generate_gradcam
            from ai_model.depth_estimator import estimate_depth

            # Core prediction — always use single model for speed/demo reliability
            result = predict_single(img_bytes, arch=arch)

            # Grad-CAM (best-effort — skip if it fails)
            gradcam_path = None
            gradcam_url = None
            try:
                model = get_model_for_gradcam(arch, None)
                _, gradcam_overlay = generate_gradcam(model, img_bytes, arch=arch)
                gradcam_path = _save_overlay(gradcam_overlay, "gradcam")
                # Return a URL the browser can fetch
                gradcam_url = f"/uploads/{os.path.basename(gradcam_path)}"
            except Exception as e:
                logger.warning("Grad-CAM failed (non-fatal): %s", e)

            # Depth (only for potholes, best-effort — skip if model not cached)
            depth_result = {}
            if result["predicted_class"] == "Pothole":
                try:
                    from ai_model.depth_estimator import estimate_depth, _is_model_cached
                    if _is_model_cached():
                        depth_result = estimate_depth(img_bytes)
                    else:
                        logger.info("Depth model not cached — skipping depth estimation")
                except Exception as e:
                    logger.warning("Depth estimation failed (non-fatal): %s", e)

            # Cost estimate
            cost = estimate_repair_cost(
                result["predicted_class"],
                result["confidence"],
                area_sqm=args.get("area_sqm") or 5.0,
                region=args.get("region") or "urban",
            )

            # Persist
            try:
                verify_jwt_in_request(optional=True)
                user_id = get_jwt_identity()
            except Exception:
                user_id = None

            session_id = str(uuid.uuid4())
            pred = Prediction(
                session_id=session_id,
                user_id=user_id,
                image_path=path,
                original_filename=file.filename,
                predicted_class=result["predicted_class"],
                confidence=result["confidence"],
                all_probabilities=result["probabilities"],
                model_used=arch,
                severity_score=result["severity_score"],
                gradcam_path=gradcam_path,
                road_segment_id=args.get("road_segment_id") or None,
                latitude=args.get("lat"),
                longitude=args.get("lng"),
                area_sqm=args.get("area_sqm"),
                repair_cost_low=cost["low"],
                repair_cost_mid=cost["mid"],
                repair_cost_high=cost["high"],
                repair_urgency=cost["urgency"],
            )
            db.session.add(pred)
            db.session.commit()

            try:
                maybe_send_alert(current_app._get_current_object(), pred)
            except Exception as e:
                logger.warning("Alert failed (non-fatal): %s", e)

            return {
                "success": True,
                "data": {
                    **result,
                    "session_id": session_id,
                    "prediction_id": pred.id,
                    "gradcam_path": gradcam_url,
                    "depth": depth_result,
                    "cost_estimate": cost,
                },
                "error": None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as exc:
            logger.exception("Prediction error: %s", exc)
            return {"success": False, "error": str(exc), "data": None}, 500


@predict_ns.route("/batch")
class PredictBatch(Resource):
    def post(self):
        """Submit multiple images for async batch processing (in-process thread)."""
        files = request.files.getlist("files")
        if not files:
            return {"success": False, "error": "No files provided", "data": None}, 400

        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
        except Exception:
            user_id = None

        paths = []
        for f in files:
            if _allowed(f.filename):
                path, _ = _save_upload(f)
                paths.append(path)

        if not paths:
            return {"success": False, "error": "No valid image files", "data": None}, 400

        job_id = str(uuid.uuid4())
        job = Job(
            job_id=job_id,
            user_id=user_id,
            job_type="batch",
            total=len(paths),
            status="pending",
        )
        db.session.add(job)
        db.session.commit()

        # Run in background thread — no Celery/Redis needed
        import threading
        from flask import current_app
        app = current_app._get_current_object()

        def _run():
            _process_batch_thread(app, job_id, paths, user_id)

        t = threading.Thread(target=_run, daemon=True)
        t.start()

        return {
            "success": True,
            "data": {"job_id": job_id, "total": len(paths)},
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


def _process_batch_thread(app, job_id: str, image_paths: list, user_id):
    """Run batch inference in a background thread."""
    from datetime import datetime, timezone as tz
    with app.app_context():
        job = Job.query.filter_by(job_id=job_id).first()
        if not job:
            return
        job.status = "running"
        job.started_at = datetime.now(tz.utc)
        db.session.commit()

        from ai_model.predict import predict_single
        from extensions import socketio
        results = []

        for idx, path in enumerate(image_paths):
            try:
                with open(path, "rb") as f:
                    img_bytes = f.read()
                result = predict_single(img_bytes, arch="resnet50")
                results.append({"file": os.path.basename(path), **result})
            except Exception as exc:
                results.append({"file": os.path.basename(path), "error": str(exc)})

            job.progress = idx + 1
            db.session.commit()

            try:
                socketio.emit("batch_progress", {
                    "job_id": job_id,
                    "progress": idx + 1,
                    "total": len(image_paths),
                    "status": "running",
                    "latest": results[-1],
                })
            except Exception:
                pass

        job.status = "done"
        job.completed_at = datetime.now(tz.utc)
        job.result = {"count": len(results), "results": results}
        db.session.commit()

        try:
            socketio.emit("batch_complete", {"job_id": job_id})
        except Exception:
            pass



@predict_ns.route("/batch/<string:job_id>")
class BatchStatus(Resource):
    def get(self, job_id: str):
        """Poll batch job status."""
        job = Job.query.filter_by(job_id=job_id).first_or_404()
        return {
            "success": True,
            "data": job.to_dict(),
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@predict_ns.route("/ensemble")
class PredictEnsemble(Resource):
    @limiter.limit("20 per minute")
    def post(self):
        """3-model ensemble with per-model breakdown."""
        try:
            args = upload_parser.parse_args()
            file = args["file"]
            if file is None:
                return {"success": False, "error": "No file uploaded", "data": None}, 400
            if not _allowed(file.filename):
                return {"success": False, "error": "Invalid file type", "data": None}, 400

            _, img_bytes = _save_upload(file)
            from ai_model.ensemble import get_ensemble
            ensemble = get_ensemble(current_app.config["WEIGHTS_DIR"])
            result = ensemble.predict(img_bytes)

            return {
                "success": True,
                "data": result,
                "error": None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as exc:
            logger.exception("Ensemble prediction error: %s", exc)
            return {"success": False, "error": str(exc), "data": None}, 500


@predict_ns.route("/video_frame")
class PredictVideoFrame(Resource):
    @limiter.limit("60 per minute")
    def post(self):
        """Lightweight single-frame inference for live video."""
        args = upload_parser.parse_args()
        file = args["file"]
        if not _allowed(file.filename):
            return {"success": False, "error": "Invalid file type", "data": None}, 400

        _, img_bytes = _save_upload(file)
        # Use ResNet50 for speed in video mode
        from ai_model.predict import predict_single
        result = predict_single(img_bytes, arch="resnet50")

        return {
            "success": True,
            "data": result,
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@predict_ns.route("/depth")
class DepthEstimate(Resource):
    def post(self):
        """MiDaS monocular depth estimation."""
        args = upload_parser.parse_args()
        _, img_bytes = _save_upload(args["file"])
        from ai_model.depth_estimator import estimate_depth
        result = estimate_depth(img_bytes)
        return {"success": True, "data": result, "error": None,
                "timestamp": datetime.now(timezone.utc).isoformat()}


@predict_ns.route("/explain/lime")
class ExplainLIME(Resource):
    def post(self):
        """LIME superpixel explanation."""
        try:
            args = upload_parser.parse_args()
            file = args["file"]
            if file is None:
                return {"success": False, "error": "No file uploaded", "data": None}, 400
            _, img_bytes = _save_upload(file)
            arch = args.get("model", "resnet50")
            from ai_model.predict import get_model_for_gradcam
            from ai_model.explainability import explain_lime
            model = get_model_for_gradcam(arch, None)
            result = explain_lime(model, img_bytes, arch=arch)
            return {"success": True, "data": result, "error": None,
                    "timestamp": datetime.now(timezone.utc).isoformat()}
        except Exception as exc:
            logger.exception("LIME error: %s", exc)
            return {"success": False, "error": str(exc), "data": None}, 500


@predict_ns.route("/explain/shap")
class ExplainSHAP(Resource):
    def post(self):
        """SHAP GradientExplainer attribution."""
        try:
            args = upload_parser.parse_args()
            file = args["file"]
            if file is None:
                return {"success": False, "error": "No file uploaded", "data": None}, 400
            _, img_bytes = _save_upload(file)
            arch = args.get("model", "resnet50")
            from ai_model.predict import get_model_for_gradcam
            from ai_model.explainability import explain_shap
            model = get_model_for_gradcam(arch, None)
            result = explain_shap(model, img_bytes, arch=arch)
            return {"success": True, "data": result, "error": None,
                    "timestamp": datetime.now(timezone.utc).isoformat()}
        except Exception as exc:
            logger.exception("SHAP error: %s", exc)
            return {"success": False, "error": str(exc), "data": None}, 500


@predict_ns.route("/explain/attention")
class ExplainAttention(Resource):
    def post(self):
        """ViT attention rollout visualisation."""
        try:
            args = upload_parser.parse_args()
            file = args["file"]
            if file is None:
                return {"success": False, "error": "No file uploaded", "data": None}, 400
            _, img_bytes = _save_upload(file)

            import base64
            import cv2
            import numpy as np
            from ai_model.models.vit import build_vit_b16
            from ai_model.attention_viz import generate_attention_overlay

            # Load ViT (no custom weights needed — pretrained ImageNet)
            model = build_vit_b16(weights_path=None)
            model.eval()

            _, overlay = generate_attention_overlay(model, img_bytes)

            _, buf = cv2.imencode(".png", cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))
            b64 = base64.b64encode(buf).decode()

            return {"success": True, "data": {"overlay_b64": b64}, "error": None,
                    "timestamp": datetime.now(timezone.utc).isoformat()}
        except Exception as exc:
            logger.exception("Attention error: %s", exc)
            return {"success": False, "error": str(exc), "data": None}, 500


@predict_ns.route("/calibration")
class Calibration(Resource):
    def get(self):
        """Return calibration curve data from prediction history."""
        from database.models import Prediction
        import numpy as np
        from sklearn.calibration import calibration_curve

        preds = Prediction.query.filter(Prediction.confidence.isnot(None)).limit(1000).all()
        if len(preds) < 10:
            return {"success": True, "data": {"message": "Insufficient data"}, "error": None,
                    "timestamp": datetime.now(timezone.utc).isoformat()}

        y_true = [1 if p.predicted_class != "Good" else 0 for p in preds]
        y_prob = [p.confidence for p in preds]
        fraction_pos, mean_pred = calibration_curve(y_true, y_prob, n_bins=10)

        return {
            "success": True,
            "data": {
                "fraction_positive": fraction_pos.tolist(),
                "mean_predicted": mean_pred.tolist(),
            },
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@predict_ns.route("/models/list")
class ModelsList(Resource):
    def get(self):
        """List available model weight files."""
        from database.models import ModelRegistry
        models = ModelRegistry.query.all()
        return {
            "success": True,
            "data": [m.to_dict() for m in models],
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@predict_ns.route("/models/compare")
class ModelsCompare(Resource):
    def post(self):
        """Side-by-side model comparison on a single image."""
        args = upload_parser.parse_args()
        _, img_bytes = _save_upload(args["file"])

        from ai_model.predict import predict_single
        results = {}
        for arch in ("resnet50", "efficientnet_b4", "vit_b16"):
            results[arch] = predict_single(img_bytes, arch=arch)

        return {
            "success": True,
            "data": results,
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
