"""PDF report generation using ReportLab."""
from __future__ import annotations

import io
import os
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Image as RLImage,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def build_pdf_report(session_id: str, upload_folder: str) -> str:
    """
    Generate a PDF report for all predictions in a session.

    Returns:
        Absolute path to the generated PDF file.
    """
    from extensions import db
    from database.models import Prediction

    preds = Prediction.query.filter_by(session_id=session_id).all()
    if not preds:
        raise ValueError(f"No predictions found for session {session_id}")

    pdf_path = os.path.join(upload_folder, f"report_{session_id}.pdf")
    doc = SimpleDocTemplate(pdf_path, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []

    # Title
    story.append(Paragraph("Road Damage Detection Report", styles["Title"]))
    story.append(Paragraph(f"Session: {session_id}", styles["Normal"]))
    story.append(Paragraph(f"Generated: {datetime.utcnow().isoformat()} UTC", styles["Normal"]))
    story.append(Spacer(1, 0.5 * cm))

    # Summary table
    data = [["#", "File", "Class", "Confidence", "Severity", "Urgency"]]
    for i, p in enumerate(preds, 1):
        data.append([
            str(i),
            p.original_filename[:30],
            p.predicted_class,
            f"{p.confidence:.1%}",
            str(p.severity_score),
            p.repair_urgency or "—",
        ])

    tbl = Table(data, colWidths=[1 * cm, 5 * cm, 3 * cm, 3 * cm, 2.5 * cm, 3.5 * cm])
    tbl.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c3e50")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#ecf0f1")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
        ])
    )
    story.append(tbl)
    story.append(Spacer(1, 0.5 * cm))

    # Per-prediction detail with Grad-CAM
    for p in preds:
        story.append(Paragraph(f"<b>{p.original_filename}</b>", styles["Heading3"]))
        story.append(Paragraph(
            f"Class: {p.predicted_class} | Confidence: {p.confidence:.1%} | "
            f"Severity: {p.severity_score}",
            styles["Normal"],
        ))
        if p.gradcam_path and os.path.exists(p.gradcam_path):
            story.append(RLImage(p.gradcam_path, width=8 * cm, height=6 * cm))
        story.append(Spacer(1, 0.3 * cm))

    doc.build(story)
    return pdf_path
