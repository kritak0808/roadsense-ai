"""LIME and SHAP explainability for road damage models."""
from __future__ import annotations

import io
import logging

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

logger = logging.getLogger(__name__)


# ── LIME ──────────────────────────────────────────────────────────────────────

def explain_lime(
    model: torch.nn.Module,
    image_bytes: bytes,
    arch: str = "resnet50",
    num_samples: int = 200,
    num_features: int = 8,
) -> dict:
    """
    LIME superpixel explanation.

    Returns:
        dict with 'overlay_b64' (base64 PNG) and 'segments' list.
    """
    try:
        from lime import lime_image
        from skimage.segmentation import mark_boundaries
        import cv2, base64
        from ai_model.utils.preprocessing import get_transform
    except ImportError as e:
        raise RuntimeError(f"LIME dependencies missing: {e}") from e

    pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img_np = np.array(pil_img)
    transform = get_transform(arch)
    device = next(model.parameters()).device

    def _predict_fn(images: np.ndarray) -> np.ndarray:
        batch = []
        for img in images:
            pil = Image.fromarray(img.astype(np.uint8))
            batch.append(transform(pil))
        tensor = torch.stack(batch).to(device)
        with torch.no_grad():
            probs = F.softmax(model(tensor), dim=1).cpu().numpy()
        return probs

    explainer = lime_image.LimeImageExplainer()
    explanation = explainer.explain_instance(
        img_np,
        _predict_fn,
        top_labels=4,
        hide_color=0,
        num_samples=num_samples,
    )

    pred_label = int(np.argmax(_predict_fn([img_np])[0]))
    temp, mask = explanation.get_image_and_mask(
        pred_label,
        positive_only=False,
        num_features=num_features,
        hide_rest=False,
    )
    overlay = mark_boundaries(temp / 255.0, mask)
    overlay_uint8 = (overlay * 255).astype(np.uint8)

    _, buf = cv2.imencode(".png", cv2.cvtColor(overlay_uint8, cv2.COLOR_RGB2BGR))
    b64 = base64.b64encode(buf).decode()

    return {"overlay_b64": b64, "format": "png"}


# ── SHAP ──────────────────────────────────────────────────────────────────────

def explain_shap(
    model: torch.nn.Module,
    image_bytes: bytes,
    arch: str = "resnet50",
) -> dict:
    """
    Gradient saliency map (SHAP-style pixel attribution).
    Uses vanilla gradients — works with any architecture, no inplace op issues.

    Returns:
        dict with 'overlay_b64' (base64 PNG).
    """
    try:
        import cv2, base64
        from ai_model.utils.preprocessing import preprocess_image
    except ImportError as e:
        raise RuntimeError(f"Dependencies missing: {e}") from e

    device = next(model.parameters()).device
    tensor, original_np = preprocess_image(image_bytes, model_name=arch)
    tensor = tensor.to(device)

    model.eval()

    # Use vanilla gradient saliency — works reliably with any architecture
    tensor.requires_grad_(True)
    output = model(tensor)
    with torch.no_grad():
        pred_class = int(torch.argmax(output).item())

    # Backprop w.r.t. predicted class score
    model.zero_grad()
    output[0, pred_class].backward()

    # Gradient magnitude across channels → saliency map
    saliency = tensor.grad.data.abs().squeeze(0)  # [C, H, W]
    sv_agg = saliency.mean(dim=0).cpu().numpy()  # [H, W]

    # Normalise and colorise
    sv_norm = (sv_agg - sv_agg.min()) / (sv_agg.max() - sv_agg.min() + 1e-8)
    h, w = original_np.shape[:2]
    sv_resized = cv2.resize(sv_norm, (w, h))
    heatmap = cv2.applyColorMap((sv_resized * 255).astype(np.uint8), cv2.COLORMAP_PLASMA)
    overlay = cv2.addWeighted(
        cv2.cvtColor(original_np, cv2.COLOR_RGB2BGR), 0.6, heatmap, 0.4, 0
    )
    _, buf = cv2.imencode(".png", overlay)
    b64 = base64.b64encode(buf).decode()

    return {
        "overlay_b64": b64,
        "format": "png",
        "mean_abs_shap": float(sv_agg.mean()),
    }
