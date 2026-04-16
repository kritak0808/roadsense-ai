"""Repair cost estimation endpoint."""
from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from services.cost_estimator import estimate_repair_cost

cost_bp = Blueprint("cost", __name__)


@cost_bp.route("/cost/estimate", methods=["POST"])
def cost_estimate():
    data = request.get_json() or {}
    result = estimate_repair_cost(
        predicted_class=data.get("predicted_class", "Good"),
        confidence=float(data.get("confidence", 0.5)),
        area_sqm=float(data.get("area_sqm", 5.0)),
        region=data.get("region", "urban"),
    )
    return jsonify({
        "success": True,
        "data": result,
        "error": None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
