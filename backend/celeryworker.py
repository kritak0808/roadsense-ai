"""Celery application factory — imported by both the worker and Flask app."""
from __future__ import annotations

import os

from celery import Celery


def make_celery(broker: str | None = None, backend: str | None = None) -> Celery:
    broker = broker or os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    backend = backend or os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
    app = Celery(
        "road_damage",
        broker=broker,
        backend=backend,
        include=["services.celery_tasks"],
    )
    app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        task_acks_late=True,
        worker_prefetch_multiplier=1,
        result_expires=86400,  # 24 h
    )
    return app


celery = make_celery()
