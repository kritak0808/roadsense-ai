"""SSE live video stream inference endpoint."""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone

from flask import Response, request, stream_with_context
from flask_restx import Namespace, Resource

video_ns = Namespace("video", description="Live video stream inference")


@video_ns.route("/stream")
class VideoStream(Resource):
    def get(self):
        """
        Server-Sent Events endpoint.
        Client POSTs frames to /api/predict/video_frame;
        this SSE channel pushes rolling stats.
        """
        def _event_stream():
            while True:
                from database.models import Prediction
                from extensions import db
                recent = (
                    Prediction.query.order_by(Prediction.created_at.desc()).limit(5).all()
                )
                data = {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "recent": [
                        {
                            "class": p.predicted_class,
                            "confidence": p.confidence,
                            "severity": p.severity_score,
                        }
                        for p in recent
                    ],
                }
                yield f"data: {json.dumps(data)}\n\n"
                time.sleep(1)

        return Response(
            stream_with_context(_event_stream()),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )
