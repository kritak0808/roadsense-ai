"""SQLAlchemy ORM models for all 6 database tables."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from flask_bcrypt import check_password_hash, generate_password_hash
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Index,
)
from sqlalchemy.orm import relationship

from extensions import db


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


# ── Users ─────────────────────────────────────────────────────────────────────
class User(db.Model):
    __tablename__ = "users"

    id: int = Column(Integer, primary_key=True)
    uuid: str = Column(String(36), unique=True, default=_uuid, nullable=False)
    username: str = Column(String(80), unique=True, nullable=False)
    email: str = Column(String(120), unique=True, nullable=False)
    password_hash: str = Column(String(256), nullable=False, default="")
    role: str = Column(String(20), nullable=False, default="viewer")  # admin/analyst/viewer
    is_active: bool = Column(Boolean, default=True)
    created_at: datetime = Column(DateTime, default=_utcnow)
    last_login: Optional[datetime] = Column(DateTime, nullable=True)

    predictions = relationship("Prediction", back_populates="user", lazy="dynamic")

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password).decode("utf-8")

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "uuid": self.uuid,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "last_login": self.last_login.isoformat() if self.last_login else None,
        }


# ── Predictions ───────────────────────────────────────────────────────────────
class Prediction(db.Model):
    __tablename__ = "predictions"

    id: int = Column(Integer, primary_key=True)
    session_id: str = Column(String(36), default=_uuid, nullable=False, index=True)
    user_id: Optional[int] = Column(Integer, ForeignKey("users.id"), nullable=True)
    image_path: str = Column(String(512), nullable=False)
    original_filename: str = Column(String(256), nullable=False)

    # AI results
    predicted_class: str = Column(String(50), nullable=False)
    confidence: float = Column(Float, nullable=False)
    all_probabilities: dict = Column(JSON, nullable=False, default=dict)
    model_used: str = Column(String(50), default="ensemble")
    severity_score: float = Column(Float, default=0.0)

    # XAI paths
    gradcam_path: Optional[str] = Column(String(512), nullable=True)
    lime_path: Optional[str] = Column(String(512), nullable=True)
    shap_path: Optional[str] = Column(String(512), nullable=True)
    attention_path: Optional[str] = Column(String(512), nullable=True)
    depth_path: Optional[str] = Column(String(512), nullable=True)

    # Metadata
    road_segment_id: Optional[str] = Column(String(100), nullable=True, index=True)
    latitude: Optional[float] = Column(Float, nullable=True)
    longitude: Optional[float] = Column(Float, nullable=True)
    area_sqm: Optional[float] = Column(Float, nullable=True)
    is_aerial: bool = Column(Boolean, default=False)

    # Weather at time of capture
    weather_temp: Optional[float] = Column(Float, nullable=True)
    weather_rainfall: Optional[float] = Column(Float, nullable=True)
    weather_humidity: Optional[float] = Column(Float, nullable=True)
    weather_condition: Optional[str] = Column(String(100), nullable=True)

    # Repair cost estimate
    repair_cost_low: Optional[float] = Column(Float, nullable=True)
    repair_cost_mid: Optional[float] = Column(Float, nullable=True)
    repair_cost_high: Optional[float] = Column(Float, nullable=True)
    repair_urgency: Optional[str] = Column(String(50), nullable=True)

    created_at: datetime = Column(DateTime, default=_utcnow, index=True)

    user = relationship("User", back_populates="predictions")

    __table_args__ = (
        Index("ix_pred_class_conf", "predicted_class", "confidence"),
        Index("ix_pred_created", "created_at"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "session_id": self.session_id,
            "original_filename": self.original_filename,
            "predicted_class": self.predicted_class,
            "confidence": self.confidence,
            "all_probabilities": self.all_probabilities,
            "model_used": self.model_used,
            "severity_score": self.severity_score,
            "gradcam_path": self.gradcam_path,
            "road_segment_id": self.road_segment_id,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "area_sqm": self.area_sqm,
            "is_aerial": self.is_aerial,
            "weather_temp": self.weather_temp,
            "weather_rainfall": self.weather_rainfall,
            "repair_cost_low": self.repair_cost_low,
            "repair_cost_mid": self.repair_cost_mid,
            "repair_cost_high": self.repair_cost_high,
            "repair_urgency": self.repair_urgency,
            "created_at": self.created_at.isoformat(),
        }


# ── Async Jobs ────────────────────────────────────────────────────────────────
class Job(db.Model):
    __tablename__ = "jobs"

    id: int = Column(Integer, primary_key=True)
    job_id: str = Column(String(36), unique=True, default=_uuid, nullable=False)
    user_id: Optional[int] = Column(Integer, ForeignKey("users.id"), nullable=True)
    job_type: str = Column(String(50), nullable=False)  # batch/retrain/pdf/alert
    status: str = Column(String(20), default="pending")  # pending/running/done/failed
    progress: int = Column(Integer, default=0)
    total: int = Column(Integer, default=0)
    result: Optional[dict] = Column(JSON, nullable=True)
    error_message: Optional[str] = Column(Text, nullable=True)
    retry_count: int = Column(Integer, default=0)
    celery_task_id: Optional[str] = Column(String(36), nullable=True)
    created_at: datetime = Column(DateTime, default=_utcnow)
    started_at: Optional[datetime] = Column(DateTime, nullable=True)
    completed_at: Optional[datetime] = Column(DateTime, nullable=True)

    def to_dict(self) -> dict:
        runtime = None
        if self.started_at and self.completed_at:
            runtime = (self.completed_at - self.started_at).total_seconds()
        return {
            "job_id": self.job_id,
            "job_type": self.job_type,
            "status": self.status,
            "progress": self.progress,
            "total": self.total,
            "result": self.result,
            "error_message": self.error_message,
            "retry_count": self.retry_count,
            "runtime_seconds": runtime,
            "created_at": self.created_at.isoformat(),
        }


# ── Datasets ──────────────────────────────────────────────────────────────────
class Dataset(db.Model):
    __tablename__ = "datasets"

    id: int = Column(Integer, primary_key=True)
    dataset_id: str = Column(String(36), unique=True, default=_uuid, nullable=False)
    name: str = Column(String(200), nullable=False)
    version: str = Column(String(20), default="1.0")
    format: str = Column(String(20), default="yolo")  # yolo/coco
    zip_path: str = Column(String(512), nullable=False)
    num_images: int = Column(Integer, default=0)
    class_distribution: dict = Column(JSON, default=dict)
    train_split: float = Column(Float, default=0.7)
    val_split: float = Column(Float, default=0.15)
    test_split: float = Column(Float, default=0.15)
    is_validated: bool = Column(Boolean, default=False)
    uploaded_by: Optional[int] = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: datetime = Column(DateTime, default=_utcnow)

    def to_dict(self) -> dict:
        return {
            "dataset_id": self.dataset_id,
            "name": self.name,
            "version": self.version,
            "format": self.format,
            "num_images": self.num_images,
            "class_distribution": self.class_distribution,
            "train_split": self.train_split,
            "val_split": self.val_split,
            "test_split": self.test_split,
            "is_validated": self.is_validated,
            "created_at": self.created_at.isoformat(),
        }


# ── Alert Log ─────────────────────────────────────────────────────────────────
class AlertLog(db.Model):
    __tablename__ = "alert_log"

    id: int = Column(Integer, primary_key=True)
    alert_type: str = Column(String(50), nullable=False)  # email/telegram
    trigger: str = Column(String(100), nullable=False)
    prediction_id: Optional[int] = Column(
        Integer, ForeignKey("predictions.id"), nullable=True
    )
    recipient: str = Column(String(200), nullable=False)
    status: str = Column(String(20), default="sent")
    dedup_key: str = Column(String(200), nullable=False, index=True)
    sent_at: datetime = Column(DateTime, default=_utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "alert_type": self.alert_type,
            "trigger": self.trigger,
            "recipient": self.recipient,
            "status": self.status,
            "sent_at": self.sent_at.isoformat(),
        }


# ── Model Registry ────────────────────────────────────────────────────────────
class ModelRegistry(db.Model):
    __tablename__ = "models"

    id: int = Column(Integer, primary_key=True)
    model_id: str = Column(String(36), unique=True, default=_uuid, nullable=False)
    name: str = Column(String(100), nullable=False)
    architecture: str = Column(String(50), nullable=False)
    weights_path: str = Column(String(512), nullable=False)
    accuracy: Optional[float] = Column(Float, nullable=True)
    f1_score: Optional[float] = Column(Float, nullable=True)
    is_active: bool = Column(Boolean, default=False)
    is_production: bool = Column(Boolean, default=False)
    training_job_id: Optional[str] = Column(String(36), nullable=True)
    extra_metadata: dict = Column(JSON, default=dict)
    created_at: datetime = Column(DateTime, default=_utcnow)

    def to_dict(self) -> dict:
        return {
            "model_id": self.model_id,
            "name": self.name,
            "architecture": self.architecture,
            "weights_path": self.weights_path,
            "accuracy": self.accuracy,
            "f1_score": self.f1_score,
            "is_active": self.is_active,
            "is_production": self.is_production,
            "created_at": self.created_at.isoformat(),
        }
