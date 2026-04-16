"""MiDaS v3.1 monocular depth estimation for pothole depth classification."""
from __future__ import annotations

import base64
import io
import logging
import os

import cv2
import numpy as np
import torch
from PIL import Image

logger = logging.getLogger(__name__)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
_midas_model = None
_midas_transform = None


def _is_model_cached() -> bool:
    """Return True if MiDaS weights are already downloaded locally."""
    cache_dir = os.path.join(os.path.expanduser("~"), ".cache", "torch", "hub", "checkpoints")
    for fname in ("dpt_large_384.pt", "midas_v21_small_256.pt"):
        if os.path.exists(os.path.join(cache_dir, fname)):
            return True
    return _midas_model is not None


def _load_midas(weights_path: str | None = None) -> tuple:
    global _midas_model, _midas_transform
    if _midas_model is not None:
        return _midas_model, _midas_transform

    logger.info("Loading MiDaS DPT_Large model…")
    try:
        _midas_model = torch.hub.load(
            "intel-isl/MiDaS", "DPT_Large", trust_repo=True
        )
    except Exception:
        logger.warning("DPT_Large unavailable, falling back to MiDaS_small")
        _midas_model = torch.hub.load(
            "intel-isl/MiDaS", "MiDaS_small", trust_repo=True
        )

    _midas_model = _midas_model.to(DEVICE).eval()

    midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms", trust_repo=True)
    _midas_transform = midas_transforms.dpt_transform

    return _midas_model, _midas_transform


def estimate_depth(image_bytes: bytes) -> dict:
    """
    Run MiDaS depth estimation.

    Returns:
        dict with depth_b64 (colorised PNG), depth_map (raw float list),
        pothole_depth_class (Shallow/Medium/Deep), depth_delta.
    """
    model, transform = _load_midas()

    pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img_np = np.array(pil_img)

    input_batch = transform(img_np).to(DEVICE)

    with torch.no_grad():
        prediction = model(input_batch)
        prediction = torch.nn.functional.interpolate(
            prediction.unsqueeze(1),
            size=img_np.shape[:2],
            mode="bicubic",
            align_corners=False,
        ).squeeze()

    depth_np = prediction.cpu().numpy()

    # Normalise for visualisation
    depth_norm = (depth_np - depth_np.min()) / (depth_np.max() - depth_np.min() + 1e-8)
    depth_colored = cv2.applyColorMap(
        (depth_norm * 255).astype(np.uint8), cv2.COLORMAP_MAGMA
    )

    _, buf = cv2.imencode(".png", depth_colored)
    depth_b64 = base64.b64encode(buf).decode()

    # Pothole depth heuristic: compare centre region vs border
    h, w = depth_np.shape
    cy, cx = h // 2, w // 2
    r = min(h, w) // 6
    centre_depth = float(depth_np[cy - r : cy + r, cx - r : cx + r].mean())
    border_depth = float(
        np.concatenate(
            [depth_np[:r, :].ravel(), depth_np[-r:, :].ravel(),
             depth_np[:, :r].ravel(), depth_np[:, -r:].ravel()]
        ).mean()
    )
    delta = abs(centre_depth - border_depth)
    max_val = float(depth_np.max() - depth_np.min()) + 1e-8
    relative_delta = delta / max_val

    if relative_delta < 0.1:
        depth_class = "Shallow"
    elif relative_delta < 0.25:
        depth_class = "Medium"
    else:
        depth_class = "Deep"

    return {
        "depth_b64": depth_b64,
        "depth_map": depth_norm.tolist(),
        "pothole_depth_class": depth_class,
        "depth_delta": round(relative_delta, 4),
        "centre_depth": round(centre_depth, 4),
        "border_depth": round(border_depth, 4),
    }
