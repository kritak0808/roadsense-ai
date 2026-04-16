"""Flask-SocketIO event handlers."""
from __future__ import annotations

import logging

from flask_socketio import SocketIO, emit, join_room

logger = logging.getLogger(__name__)


def register_socket_events(socketio: SocketIO) -> None:
    @socketio.on("connect")
    def on_connect():
        logger.info("Client connected: %s", id)
        emit("connected", {"status": "ok"})

    @socketio.on("disconnect")
    def on_disconnect():
        logger.info("Client disconnected")

    @socketio.on("join_job")
    def on_join_job(data: dict):
        """Client subscribes to a specific job's progress events."""
        job_id = data.get("job_id", "")
        if job_id:
            join_room(job_id)
            emit("joined", {"job_id": job_id})

    @socketio.on("ping")
    def on_ping():
        emit("pong", {"status": "alive"})
