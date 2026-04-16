"""ViT Attention Rollout visualisation."""
from __future__ import annotations

import cv2
import numpy as np
import torch

from ai_model.utils.preprocessing import preprocess_image


def attention_rollout(
    attention_maps: list[torch.Tensor],
    discard_ratio: float = 0.9,
) -> np.ndarray:
    """
    Compute attention rollout across all transformer layers.

    Args:
        attention_maps: List of tensors [B, num_heads, seq_len, seq_len]
        discard_ratio: Fraction of lowest attention weights to zero out.

    Returns:
        Rollout mask as numpy array [seq_len-1] (excluding CLS token).
    """
    result = torch.eye(attention_maps[0].shape[-1])

    for attn in attention_maps:
        # Average over heads
        attn_avg = attn.mean(dim=1).squeeze(0)  # [seq_len, seq_len]
        # Add residual connection
        attn_avg = attn_avg + torch.eye(attn_avg.shape[0])
        attn_avg = attn_avg / attn_avg.sum(dim=-1, keepdim=True)

        # Discard low-attention tokens
        flat = attn_avg.view(-1)
        threshold = flat.kthvalue(int(flat.numel() * discard_ratio)).values
        attn_avg[attn_avg < threshold] = 0

        result = torch.matmul(attn_avg, result)

    # CLS token row → patch attention
    mask = result[0, 1:]  # exclude CLS
    return mask.cpu().numpy()


def generate_attention_overlay(
    model: torch.nn.Module,
    image_bytes: bytes,
    discard_ratio: float = 0.9,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Run ViT forward pass with attention hooks, compute rollout, return overlay.

    Returns:
        (attention_heatmap [H,W,3], overlay [H,W,3])
    """
    tensor, original_np = preprocess_image(image_bytes, model_name="vit_b16")
    device = next(model.parameters()).device
    tensor = tensor.to(device)

    model.eval()
    with torch.no_grad():
        _, attention_maps = model.forward_with_attention(tensor)

    mask = attention_rollout(attention_maps, discard_ratio=discard_ratio)

    # Reshape to grid (ViT-B/16 → 14×14 patches for 224px input)
    grid_size = int(np.sqrt(len(mask)))
    mask_grid = mask.reshape(grid_size, grid_size)
    mask_grid = (mask_grid - mask_grid.min()) / (mask_grid.max() + 1e-8)

    h, w = original_np.shape[:2]
    heatmap = cv2.resize(mask_grid, (w, h))
    heatmap_colored = cv2.applyColorMap(
        (heatmap * 255).astype(np.uint8), cv2.COLORMAP_INFERNO
    )
    heatmap_rgb = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGB)

    original_bgr = cv2.cvtColor(original_np, cv2.COLOR_RGB2BGR)
    overlay = cv2.addWeighted(original_bgr, 0.55, heatmap_colored, 0.45, 0)
    overlay_rgb = cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB)

    return heatmap_rgb, overlay_rgb
