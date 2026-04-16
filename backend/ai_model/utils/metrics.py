"""Evaluation metrics utilities."""
from __future__ import annotations

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)


DAMAGE_CLASSES = ["Good", "Crack", "Pothole", "Vandalism"]

# Severity weights per class (0–100 scale)
SEVERITY_WEIGHTS: dict[str, float] = {
    "Good": 0.0,
    "Crack": 45.0,
    "Pothole": 85.0,
    "Vandalism": 30.0,
}


def compute_severity_score(predicted_class: str, confidence: float) -> float:
    """Road Health Score contribution: higher = worse damage."""
    base = SEVERITY_WEIGHTS.get(predicted_class, 0.0)
    return round(base * confidence, 2)


def compute_road_health_score(severity_score: float) -> float:
    """Convert severity to 0–100 health score (100 = perfect)."""
    return round(max(0.0, 100.0 - severity_score), 2)


def compute_full_metrics(
    y_true: list[int], y_pred: list[int]
) -> dict:
    """Return accuracy, precision, recall, F1, confusion matrix."""
    return {
        "accuracy": round(accuracy_score(y_true, y_pred), 4),
        "precision": round(
            precision_score(y_true, y_pred, average="weighted", zero_division=0), 4
        ),
        "recall": round(
            recall_score(y_true, y_pred, average="weighted", zero_division=0), 4
        ),
        "f1": round(f1_score(y_true, y_pred, average="weighted", zero_division=0), 4),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
        "per_class": classification_report(
            y_true,
            y_pred,
            target_names=DAMAGE_CLASSES,
            output_dict=True,
            zero_division=0,
        ),
    }


def softmax(logits: np.ndarray) -> np.ndarray:
    e = np.exp(logits - np.max(logits))
    return e / e.sum()
