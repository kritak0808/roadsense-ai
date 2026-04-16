"""Before/After repair simulation — high-quality OpenCV road repair rendering."""
from __future__ import annotations

import base64
import io
import logging

import cv2
import numpy as np
from flask import Blueprint, request
from PIL import Image

logger = logging.getLogger(__name__)
simulate_bp = Blueprint("simulate", __name__)


# ── Texture helpers ────────────────────────────────────────────────────────────

def _asphalt_texture(shape: tuple, base_color: np.ndarray, roughness: float = 1.0) -> np.ndarray:
    """
    Generate a realistic asphalt texture patch.
    Combines Perlin-like multi-scale noise with aggregate grain simulation.
    """
    h, w = shape[:2]
    texture = np.zeros((h, w, 3), dtype=np.float32)

    # Multi-scale noise layers (simulates asphalt aggregate at different scales)
    for scale, weight in [(4, 0.5), (8, 0.25), (16, 0.15), (32, 0.07), (64, 0.03)]:
        noise = np.random.randn(max(1, h // scale), max(1, w // scale)).astype(np.float32)
        noise = cv2.resize(noise, (w, h), interpolation=cv2.INTER_CUBIC)
        texture[:, :, 0] += noise * weight
        texture[:, :, 1] += noise * weight * 0.95
        texture[:, :, 2] += noise * weight * 0.90

    # Normalise noise to [-1, 1]
    texture = texture / (texture.std() + 1e-8)

    # Apply base colour with roughness-scaled variation
    sigma = 18 * roughness
    result = np.clip(
        base_color.astype(np.float32) + texture * sigma, 0, 255
    ).astype(np.uint8)

    # Add fine grain (simulates aggregate stones)
    grain = np.random.randint(-6, 7, (h, w, 3), dtype=np.int16)
    result = np.clip(result.astype(np.int16) + grain, 0, 255).astype(np.uint8)

    return result


def _sample_road_color(img: np.ndarray, mask: np.ndarray | None = None) -> np.ndarray:
    """
    Sample the dominant road surface colour from undamaged regions.
    Uses the median of the image excluding the damage mask.
    """
    h, w = img.shape[:2]
    if mask is not None:
        # Sample from pixels NOT in the damage mask
        inv = cv2.bitwise_not(mask)
        pixels = img[inv > 0]
    else:
        # Sample from border regions (likely undamaged)
        border_h, border_w = max(1, h // 6), max(1, w // 6)
        regions = [
            img[:border_h, :],
            img[-border_h:, :],
            img[:, :border_w],
            img[:, -border_w:],
        ]
        pixels = np.concatenate([r.reshape(-1, 3) for r in regions])

    if len(pixels) == 0:
        return np.array([80, 80, 80], dtype=np.uint8)

    return np.median(pixels, axis=0).astype(np.uint8)


def _seamless_blend(base: np.ndarray, patch: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """
    Blend patch into base using Poisson seamless cloning where possible,
    falling back to feathered alpha blend.
    """
    # Feathered blend — distance-transform based soft edges
    dist = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
    if dist.max() > 0:
        dist = dist / dist.max()
    # Smooth the blend weight
    alpha = cv2.GaussianBlur(dist, (21, 21), 0)
    alpha3 = np.stack([alpha] * 3, axis=-1)

    result = (base.astype(np.float32) * (1 - alpha3) +
              patch.astype(np.float32) * alpha3).astype(np.uint8)

    # Try Poisson cloning for even better blending
    try:
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            # Find centre of largest contour
            largest = max(contours, key=cv2.contourArea)
            M = cv2.moments(largest)
            if M["m00"] > 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                # Poisson clone needs mask to not touch border
                h, w = mask.shape
                safe_mask = np.zeros_like(mask)
                safe_mask[2:-2, 2:-2] = mask[2:-2, 2:-2]
                if safe_mask.sum() > 100:
                    result = cv2.seamlessClone(
                        patch, base, safe_mask, (cx, cy), cv2.NORMAL_CLONE
                    )
    except Exception:
        pass  # Fall back to feathered blend

    return result


# ── Per-class repair functions ─────────────────────────────────────────────────

def _repair_pothole(img: np.ndarray) -> np.ndarray:
    """
    Fill pothole with realistic asphalt patch:
    1. Detect dark concave region
    2. Sample surrounding road colour
    3. Generate matching asphalt texture
    4. Seamless blend with Poisson cloning
    5. Add fresh asphalt sheen + edge shadow
    """
    out = img.copy()
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    h, w = img.shape[:2]

    # ── Detect pothole region ──────────────────────────────────────────────────
    # Adaptive threshold to find dark regions
    blurred = cv2.GaussianBlur(gray, (21, 21), 0)
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 51, 8
    )

    # Also use Otsu for global dark regions
    _, otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    combined = cv2.bitwise_and(thresh, otsu)

    # Morphological cleanup — close gaps, remove noise
    k_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31))
    k_open  = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    mask = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, k_close)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k_open)

    # Keep only significant regions (>0.5% of image)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    clean_mask = np.zeros_like(mask)
    min_area = h * w * 0.005
    for cnt in contours:
        if cv2.contourArea(cnt) > min_area:
            cv2.drawContours(clean_mask, [cnt], -1, 255, -1)

    if clean_mask.sum() == 0:
        # Fallback: use centre region
        cy, cx = h // 2, w // 2
        r = min(h, w) // 5
        cv2.ellipse(clean_mask, (cx, cy), (r, int(r * 0.7)), 0, 0, 360, 255, -1)

    # ── Sample road colour from undamaged area ─────────────────────────────────
    road_color = _sample_road_color(img, clean_mask)

    # ── Generate fresh asphalt patch ───────────────────────────────────────────
    # Fresh asphalt is slightly darker and more uniform than weathered road
    fresh_color = np.clip(road_color.astype(np.int16) - [12, 10, 8], 0, 255).astype(np.uint8)
    patch = _asphalt_texture(img.shape, fresh_color, roughness=0.7)

    # ── Blend ──────────────────────────────────────────────────────────────────
    out = _seamless_blend(out, patch, clean_mask)

    # ── Add edge shadow (fresh patch has slight raised edge) ───────────────────
    edge_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    edge = cv2.dilate(clean_mask, edge_kernel) - clean_mask
    shadow = np.zeros_like(out, dtype=np.float32)
    shadow[edge > 0] = -20
    out = np.clip(out.astype(np.float32) + shadow, 0, 255).astype(np.uint8)

    # ── Final smoothing ────────────────────────────────────────────────────────
    out = cv2.bilateralFilter(out, 9, 60, 60)
    return out


def _repair_crack(img: np.ndarray) -> np.ndarray:
    """
    Seal cracks with realistic sealant:
    1. Detect crack network using morphological line detection
    2. Fill with slightly darker sealant colour
    3. Add sealant sheen (slight brightness increase along crack)
    4. Smooth edges
    """
    out = img.copy()
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    h, w = img.shape[:2]

    # ── Detect cracks ──────────────────────────────────────────────────────────
    # Cracks = thin dark lines → use morphological black-hat
    kernel_line = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 15))
    blackhat_v = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel_line)
    kernel_line_h = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 1))
    blackhat_h = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel_line_h)
    blackhat = cv2.add(blackhat_v, blackhat_h)

    # Also use Canny for fine cracks
    edges = cv2.Canny(cv2.GaussianBlur(gray, (3, 3), 0), 20, 80)

    # Combine
    _, bh_thresh = cv2.threshold(blackhat, 15, 255, cv2.THRESH_BINARY)
    crack_mask = cv2.add(bh_thresh, edges)

    # Dilate to fill crack width
    k_dilate = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    crack_mask = cv2.dilate(crack_mask, k_dilate, iterations=2)

    # ── Sample road colour ─────────────────────────────────────────────────────
    road_color = _sample_road_color(img, crack_mask)

    # Sealant is slightly darker than road (rubberized crack filler)
    sealant_color = np.clip(road_color.astype(np.int16) - [15, 12, 10], 0, 255).astype(np.uint8)
    patch = _asphalt_texture(img.shape, sealant_color, roughness=0.4)

    # ── Blend ──────────────────────────────────────────────────────────────────
    alpha = crack_mask.astype(np.float32) / 255.0
    alpha_smooth = cv2.GaussianBlur(alpha, (5, 5), 0)
    alpha3 = np.stack([alpha_smooth] * 3, axis=-1)
    out = (out.astype(np.float32) * (1 - alpha3) +
           patch.astype(np.float32) * alpha3).astype(np.uint8)

    # ── Add sealant sheen (slightly brighter along sealed crack) ───────────────
    sheen_mask = cv2.dilate(crack_mask, k_dilate, iterations=1)
    sheen = np.zeros_like(out, dtype=np.float32)
    sheen[sheen_mask > 0] = 8
    out = np.clip(out.astype(np.float32) + sheen, 0, 255).astype(np.uint8)

    out = cv2.bilateralFilter(out, 7, 50, 50)
    return out


def _repair_vandalism(img: np.ndarray) -> np.ndarray:
    """
    Remove markings using multi-pass inpainting + texture synthesis:
    1. Detect coloured/white markings
    2. Inpaint with Navier-Stokes (better for large areas)
    3. Match surrounding texture
    """
    out = img.copy()
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)

    # Detect coloured markings (high saturation)
    sat_mask = (hsv[:, :, 1] > 50).astype(np.uint8) * 255

    # Detect white markings (high value, low saturation)
    white_mask = ((hsv[:, :, 2] > 190) & (hsv[:, :, 1] < 45)).astype(np.uint8) * 255

    # Detect yellow markings specifically
    yellow_mask = cv2.inRange(hsv, np.array([15, 80, 80]), np.array([35, 255, 255]))

    marking_mask = cv2.bitwise_or(sat_mask, white_mask)
    marking_mask = cv2.bitwise_or(marking_mask, yellow_mask)

    # Morphological cleanup
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    marking_mask = cv2.dilate(marking_mask, k, iterations=2)
    marking_mask = cv2.morphologyEx(marking_mask, cv2.MORPH_CLOSE, k)

    if marking_mask.sum() == 0:
        return _repair_good(img)

    # Multi-pass inpainting for better quality
    bgr = cv2.cvtColor(out, cv2.COLOR_RGB2BGR)

    # Pass 1: Navier-Stokes (better for large regions)
    inpainted = cv2.inpaint(bgr, marking_mask, 7, cv2.INPAINT_NS)

    # Pass 2: TELEA for refinement
    inpainted = cv2.inpaint(inpainted, marking_mask, 3, cv2.INPAINT_TELEA)

    out = cv2.cvtColor(inpainted, cv2.COLOR_BGR2RGB)

    # Blend inpainted region with texture for realism
    road_color = _sample_road_color(img, marking_mask)
    texture_patch = _asphalt_texture(img.shape, road_color, roughness=0.8)

    # Soft blend — mostly inpainted, slightly textured
    alpha = marking_mask.astype(np.float32) / 255.0 * 0.3
    alpha3 = np.stack([alpha] * 3, axis=-1)
    out = (out.astype(np.float32) * (1 - alpha3) +
           texture_patch.astype(np.float32) * alpha3).astype(np.uint8)

    out = cv2.bilateralFilter(out, 9, 60, 60)
    return out


def _repair_good(img: np.ndarray) -> np.ndarray:
    """
    Road is already good — apply professional resurfacing simulation:
    - CLAHE contrast enhancement
    - Slight colour normalisation (fresh sealcoat look)
    - Sharpening
    """
    # CLAHE on L channel
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    enhanced = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2RGB)

    # Slight darkening (fresh sealcoat is darker)
    enhanced = np.clip(enhanced.astype(np.float32) * 0.95, 0, 255).astype(np.uint8)

    # Unsharp mask for crispness
    blurred = cv2.GaussianBlur(enhanced, (0, 0), 2)
    sharpened = cv2.addWeighted(enhanced, 1.4, blurred, -0.4, 0)

    return sharpened


REPAIR_FN = {
    "Pothole":   _repair_pothole,
    "Crack":     _repair_crack,
    "Vandalism": _repair_vandalism,
    "Good":      _repair_good,
}


@simulate_bp.route("/simulate/repair", methods=["POST"])
def simulate_repair():
    """Accept image + predicted_class, return before/after base64 JPEGs."""
    try:
        file = request.files.get("file")
        predicted_class = request.form.get("predicted_class", "Pothole")

        if not file:
            return {"success": False, "error": "No file provided", "data": None}, 400

        pil_img = Image.open(file.stream).convert("RGB")
        # Keep reasonable resolution — max 640px
        pil_img.thumbnail((640, 640), Image.LANCZOS)
        img_np = np.array(pil_img)

        # Original
        orig_buf = io.BytesIO()
        pil_img.save(orig_buf, format="JPEG", quality=90)
        orig_b64 = base64.b64encode(orig_buf.getvalue()).decode()

        # Repaired
        repair_fn = REPAIR_FN.get(predicted_class, _repair_pothole)
        repaired_np = repair_fn(img_np)

        rep_buf = io.BytesIO()
        Image.fromarray(repaired_np).save(rep_buf, format="JPEG", quality=90)
        rep_b64 = base64.b64encode(rep_buf.getvalue()).decode()

        return {
            "success": True,
            "data": {
                "original_b64": orig_b64,
                "repaired_b64": rep_b64,
                "predicted_class": predicted_class,
            },
            "error": None,
        }
    except Exception as exc:
        logger.exception("Simulate repair error: %s", exc)
        return {"success": False, "error": str(exc), "data": None}, 500
