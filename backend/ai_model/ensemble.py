"""
Multi-model ensemble predictor.
Supports soft voting (average softmax) and hard voting.
"""
from __future__ import annotations

import logging
import os
import time
from typing import Literal

import numpy as np
import torch
import torch.nn.functional as F

from ai_model.predict import _load_model, DEVICE
from ai_model.utils.preprocessing import preprocess_image, validate_image
from ai_model.utils.metrics import compute_severity_score, DAMAGE_CLASSES

logger = logging.getLogger(__name__)


class EnsemblePredictor:
    """
    Combines ResNet-50, EfficientNet-B4, and ViT-B/16 predictions.

    Args:
        weights_dir: Directory containing model weight files.
        voting: 'soft' (average softmax) or 'hard' (majority vote).
    """

    MODELS = [
        ("resnet50", "resnet50_road.pth"),
        ("efficientnet_b4", "efficientnet_b4_road.pth"),
        ("vit_b16", "vit_b16_road.pth"),
    ]

    def __init__(
        self,
        weights_dir: str = "weights",
        voting: Literal["soft", "hard"] = "soft",
    ) -> None:
        self.weights_dir = weights_dir
        self.voting = voting
        self._models: list[tuple[str, object]] = []
        self._load_all()

    def _load_all(self) -> None:
        for arch, fname in self.MODELS:
            path = os.path.join(self.weights_dir, fname)
            wp = path if os.path.exists(path) else None
            model = _load_model(arch, wp)
            self._models.append((arch, model))
        logger.info("Ensemble loaded %d models (voting=%s)", len(self._models), self.voting)

    def predict(self, image_bytes: bytes) -> dict:
        """
        Run ensemble inference.

        Returns:
            dict with ensemble result + per-model breakdown.
        """
        validate_image(image_bytes)
        per_model: list[dict] = []
        all_probs: list[np.ndarray] = []

        t0 = time.perf_counter()
        for arch, model in self._models:
            tensor, _ = preprocess_image(image_bytes, model_name=arch)
            tensor = tensor.to(DEVICE)
            with torch.no_grad():
                logits = model(tensor)
                probs = F.softmax(logits, dim=1).squeeze(0).cpu().numpy()
            pred_idx = int(np.argmax(probs))
            per_model.append(
                {
                    "arch": arch,
                    "predicted_class": DAMAGE_CLASSES[pred_idx],
                    "confidence": round(float(probs[pred_idx]), 4),
                    "probabilities": {
                        cls: round(float(p), 4)
                        for cls, p in zip(DAMAGE_CLASSES, probs)
                    },
                }
            )
            all_probs.append(probs)

        latency_ms = round((time.perf_counter() - t0) * 1000, 1)

        if self.voting == "soft":
            avg_probs = np.mean(all_probs, axis=0)
            pred_idx = int(np.argmax(avg_probs))
            final_probs = avg_probs
        else:
            # Hard voting — majority class
            votes = [np.argmax(p) for p in all_probs]
            pred_idx = int(np.bincount(votes).argmax())
            final_probs = np.mean(all_probs, axis=0)

        predicted_class = DAMAGE_CLASSES[pred_idx]
        confidence = float(final_probs[pred_idx])
        severity = compute_severity_score(predicted_class, confidence)

        return {
            "predicted_class": predicted_class,
            "confidence": round(confidence, 4),
            "probabilities": {
                cls: round(float(p), 4) for cls, p in zip(DAMAGE_CLASSES, final_probs)
            },
            "severity_score": severity,
            "voting_mode": self.voting,
            "per_model": per_model,
            "latency_ms": latency_ms,
            "device": str(DEVICE),
        }


# Module-level singleton — lazy init
_ensemble_instance: EnsemblePredictor | None = None


def get_ensemble(weights_dir: str = "weights") -> EnsemblePredictor:
    global _ensemble_instance
    if _ensemble_instance is None:
        _ensemble_instance = EnsemblePredictor(weights_dir=weights_dir)
    return _ensemble_instance
