"""
Single-model inference engine.
Loads weights lazily and caches models in memory.
"""
from __future__ import annotations

import io
import logging
import os
import time
from typing import Any

import numpy as np
import torch
import torch.nn.functional as F

from ai_model.models.resnet import build_resnet50
from ai_model.models.efficientnet import build_efficientnet_b4
from ai_model.models.vit import build_vit_b16
from ai_model.utils.preprocessing import preprocess_image, validate_image
from ai_model.utils.metrics import compute_severity_score, DAMAGE_CLASSES

logger = logging.getLogger(__name__)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Module-level model cache
_model_cache: dict[str, Any] = {}


def _load_model(arch: str, weights_path: str | None) -> Any:
    """Load and cache a model by architecture name."""
    key = f"{arch}:{weights_path}"
    if key not in _model_cache:
        logger.info("Loading model arch=%s weights=%s device=%s", arch, weights_path, DEVICE)
        if arch == "resnet50":
            model = build_resnet50(weights_path=weights_path)
        elif arch == "efficientnet_b4":
            model = build_efficientnet_b4(weights_path=weights_path)
        elif arch == "vit_b16":
            model = build_vit_b16(weights_path=weights_path)
        else:
            raise ValueError(f"Unknown architecture: {arch}")
        model = model.to(DEVICE)
        model.eval()
        _model_cache[key] = model
    return _model_cache[key]


def predict_single(
    image_bytes: bytes,
    arch: str = "resnet50",
    weights_path: str | None = None,
) -> dict:
    """
    Run inference on a single image.

    Returns:
        dict with predicted_class, confidence, probabilities, severity_score, latency_ms
    """
    validate_image(image_bytes)
    tensor, original_np = preprocess_image(image_bytes, model_name=arch)
    tensor = tensor.to(DEVICE)

    model = _load_model(arch, weights_path)

    t0 = time.perf_counter()
    with torch.no_grad():
        logits = model(tensor)
        probs = F.softmax(logits, dim=1).squeeze(0).cpu().numpy()
    latency_ms = round((time.perf_counter() - t0) * 1000, 1)

    pred_idx = int(np.argmax(probs))
    predicted_class = DAMAGE_CLASSES[pred_idx]
    confidence = float(probs[pred_idx])
    severity = compute_severity_score(predicted_class, confidence)

    return {
        "predicted_class": predicted_class,
        "confidence": round(confidence, 4),
        "probabilities": {cls: round(float(p), 4) for cls, p in zip(DAMAGE_CLASSES, probs)},
        "severity_score": severity,
        "latency_ms": latency_ms,
        "device": str(DEVICE),
        "arch": arch,
    }


def predict_batch_local(
    images: list[bytes],
    arch: str = "resnet50",
    weights_path: str | None = None,
) -> list[dict]:
    """Run predict_single on a list of images, return list of results."""
    results = []
    for img_bytes in images:
        try:
            result = predict_single(img_bytes, arch=arch, weights_path=weights_path)
        except Exception as exc:
            result = {"error": str(exc)}
        results.append(result)
    return results


def get_model_for_gradcam(arch: str, weights_path: str | None) -> Any:
    """Return cached model instance (used by gradcam module)."""
    return _load_model(arch, weights_path)
