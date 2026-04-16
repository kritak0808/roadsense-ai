"""Dataset management: upload, list, delete, annotate."""
from __future__ import annotations

import json
import os
import uuid
import zipfile
from datetime import datetime, timezone

from flask import current_app, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Namespace, Resource

from extensions import db
from database.models import Dataset

datasets_ns = Namespace("datasets", description="Dataset management")


def _detect_format(zip_path: str) -> str:
    """Detect YOLO or COCO format from ZIP contents."""
    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
    if any(n.endswith("_annotations.json") or "annotations.json" in n for n in names):
        return "coco"
    if any(n.endswith(".txt") for n in names):
        return "yolo"
    return "unknown"


def _count_images(extract_dir: str) -> int:
    count = 0
    for root, _, files in os.walk(extract_dir):
        count += sum(1 for f in files if f.lower().endswith((".jpg", ".jpeg", ".png")))
    return count


def _class_distribution(extract_dir: str, fmt: str) -> dict:
    dist: dict[str, int] = {}
    if fmt == "yolo":
        for root, _, files in os.walk(extract_dir):
            for f in files:
                if f.endswith(".txt"):
                    with open(os.path.join(root, f)) as fh:
                        for line in fh:
                            cls_id = line.strip().split()[0] if line.strip() else None
                            if cls_id:
                                dist[cls_id] = dist.get(cls_id, 0) + 1
    return dist


@datasets_ns.route("")
class DatasetList(Resource):
    @jwt_required()
    def get(self):
        datasets = Dataset.query.order_by(Dataset.created_at.desc()).all()
        return {
            "success": True,
            "data": [d.to_dict() for d in datasets],
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    @jwt_required()
    def post(self):
        """Upload a ZIP dataset (YOLO or COCO format)."""
        if "file" not in request.files:
            return {"success": False, "error": "No file provided", "data": None}, 400

        file = request.files["file"]
        if not file.filename.endswith(".zip"):
            return {"success": False, "error": "Only ZIP files accepted", "data": None}, 400

        dataset_id = str(uuid.uuid4())
        upload_dir = os.path.join(current_app.config["UPLOAD_FOLDER"], "datasets", dataset_id)
        os.makedirs(upload_dir, exist_ok=True)

        zip_path = os.path.join(upload_dir, "dataset.zip")
        file.save(zip_path)

        # Extract
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(upload_dir)

        fmt = _detect_format(zip_path)
        num_images = _count_images(upload_dir)
        class_dist = _class_distribution(upload_dir, fmt)

        ds = Dataset(
            dataset_id=dataset_id,
            name=request.form.get("name", file.filename),
            format=fmt,
            zip_path=zip_path,
            num_images=num_images,
            class_distribution=class_dist,
            uploaded_by=get_jwt_identity(),
            is_validated=True,
        )
        db.session.add(ds)
        db.session.commit()

        return {
            "success": True,
            "data": ds.to_dict(),
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }, 201


@datasets_ns.route("/<string:dataset_id>")
class DatasetDetail(Resource):
    @jwt_required()
    def delete(self, dataset_id: str):
        ds = Dataset.query.filter_by(dataset_id=dataset_id).first_or_404()
        db.session.delete(ds)
        db.session.commit()
        return {
            "success": True,
            "data": {"deleted": dataset_id},
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@datasets_ns.route("/annotate")
class Annotate(Resource):
    @jwt_required()
    def post(self):
        """Save manual annotation corrections."""
        data = request.get_json() or {}
        prediction_id = data.get("prediction_id")
        annotations = data.get("annotations", [])

        from database.models import Prediction
        pred = Prediction.query.get_or_404(prediction_id)

        # Store annotations as JSON alongside image
        ann_path = pred.image_path.replace(
            os.path.splitext(pred.image_path)[1], "_annotations.json"
        )
        with open(ann_path, "w") as f:
            json.dump(annotations, f)

        return {
            "success": True,
            "data": {"prediction_id": prediction_id, "annotation_path": ann_path},
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
