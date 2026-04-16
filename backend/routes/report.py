"""PDF report generation endpoint."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

from flask import current_app, send_file
from flask_restx import Namespace, Resource

from extensions import db
from database.models import Job

report_ns = Namespace("report", description="PDF report generation")


@report_ns.route("/pdf/<string:session_id>")
class ReportPDF(Resource):
    def get(self, session_id: str):
        """Trigger async PDF generation and return job_id, or serve if ready."""
        # Check if already generated
        upload_folder = current_app.config["UPLOAD_FOLDER"]
        pdf_path = os.path.join(upload_folder, f"report_{session_id}.pdf")
        if os.path.exists(pdf_path):
            return send_file(pdf_path, mimetype="application/pdf", as_attachment=True,
                             download_name=f"report_{session_id}.pdf")

        # Queue generation
        job_id = str(uuid.uuid4())
        job = Job(job_id=job_id, job_type="pdf")
        db.session.add(job)
        db.session.commit()

        from services.celery_tasks import generate_pdf
        task = generate_pdf.delay(job_id, session_id)
        job.celery_task_id = task.id
        db.session.commit()

        return {
            "success": True,
            "data": {"job_id": job_id, "status": "queued"},
            "error": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }, 202
