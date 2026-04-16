"""Repair cost estimation using a scikit-learn RandomForest."""
from __future__ import annotations

import logging
import os
import pickle

import numpy as np

logger = logging.getLogger(__name__)

_model = None
MODEL_PATH = os.path.join("weights", "cost_estimator.pkl")

# Class → numeric encoding
CLASS_MAP = {"Good": 0, "Crack": 1, "Pothole": 2, "Vandalism": 3}
REGION_MAP = {"urban": 0, "suburban": 1, "rural": 2}
URGENCY_MAP = {0: "Monitor", 1: "Within 30 days", 2: "Immediate"}


def _load_or_train_model():
    global _model
    if _model is not None:
        return _model

    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            _model = pickle.load(f)
        return _model

    # Train a simple synthetic model if no weights exist
    from sklearn.ensemble import RandomForestRegressor

    rng = np.random.default_rng(42)
    n = 2000
    classes = rng.integers(0, 4, n)
    confidences = rng.uniform(0.5, 1.0, n)
    areas = rng.uniform(1, 50, n)
    regions = rng.integers(0, 3, n)

    # Synthetic cost formula
    base = np.array([0, 500, 2000, 300])[classes]
    cost = base * confidences + areas * 80 + regions * 200 + rng.normal(0, 100, n)
    cost = np.clip(cost, 50, 50000)

    X = np.column_stack([classes, confidences, areas, regions])
    _model = RandomForestRegressor(n_estimators=100, random_state=42)
    _model.fit(X, cost)

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(_model, f)

    logger.info("Cost estimator trained and saved to %s", MODEL_PATH)
    return _model


def estimate_repair_cost(
    predicted_class: str,
    confidence: float,
    area_sqm: float = 5.0,
    region: str = "urban",
) -> dict:
    """
    Estimate repair cost range.

    Returns:
        dict with low, mid, high cost estimates, urgency, and breakdown.
    """
    model = _load_or_train_model()

    class_enc = CLASS_MAP.get(predicted_class, 0)
    region_enc = REGION_MAP.get(region, 0)
    X = np.array([[class_enc, confidence, area_sqm, region_enc]])

    mid = float(model.predict(X)[0])
    low = round(mid * 0.75, 2)
    high = round(mid * 1.35, 2)
    mid = round(mid, 2)

    # Urgency
    if predicted_class == "Pothole" and confidence > 0.8:
        urgency_key = 2
    elif predicted_class in ("Crack", "Vandalism") and confidence > 0.7:
        urgency_key = 1
    else:
        urgency_key = 0

    # Cost breakdown (approximate percentages)
    breakdown = {
        "labor": round(mid * 0.45, 2),
        "materials": round(mid * 0.40, 2),
        "equipment": round(mid * 0.15, 2),
    }

    return {
        "low": low,
        "mid": mid,
        "high": high,
        "urgency": URGENCY_MAP[urgency_key],
        "breakdown": breakdown,
        "currency": "USD",
    }
