"""Grad-CAM implementation for CNN models (ResNet-50, EfficientNet-B4)."""
from __future__ import annotations

import cv2
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

from ai_model.utils.preprocessing import preprocess_image, denormalize


class GradCAM:
    """
    Gradient-weighted Class Activation Mapping.

    Usage:
        cam = GradCAM(model, target_layer)
        heatmap, overlay = cam.generate(image_bytes, class_idx)
    """

    def __init__(self, model: torch.nn.Module, target_layer: torch.nn.Module) -> None:
        self.model = model
        self.target_layer = target_layer
        self._gradients: torch.Tensor | None = None
        self._activations: torch.Tensor | None = None
        self._register_hooks()

    def _register_hooks(self) -> None:
        def forward_hook(module, inp, out):
            self._activations = out.detach()

        def backward_hook(module, grad_in, grad_out):
            self._gradients = grad_out[0].detach()

        self.target_layer.register_forward_hook(forward_hook)
        self.target_layer.register_full_backward_hook(backward_hook)

    def generate(
        self,
        image_bytes: bytes,
        class_idx: int | None = None,
        arch: str = "resnet50",
    ) -> tuple[np.ndarray, np.ndarray]:
        """
        Generate Grad-CAM heatmap and overlay.

        Returns:
            (heatmap_uint8 [H,W,3], overlay_uint8 [H,W,3])
        """
        tensor, original_np = preprocess_image(image_bytes, model_name=arch)
        device = next(self.model.parameters()).device
        tensor = tensor.to(device).requires_grad_(True)

        self.model.eval()
        logits = self.model(tensor)

        if class_idx is None:
            class_idx = int(logits.argmax(dim=1).item())

        self.model.zero_grad()
        score = logits[0, class_idx]
        score.backward()

        # Pool gradients over spatial dims
        gradients = self._gradients  # [1, C, H, W]
        activations = self._activations  # [1, C, H, W]

        weights = gradients.mean(dim=(2, 3), keepdim=True)  # [1, C, 1, 1]
        cam = (weights * activations).sum(dim=1, keepdim=True)  # [1, 1, H, W]
        cam = F.relu(cam)
        cam = cam.squeeze().cpu().numpy()

        # Normalise to [0, 1]
        cam = cam - cam.min()
        if cam.max() > 0:
            cam = cam / cam.max()

        # Resize to original image size
        h, w = original_np.shape[:2]
        heatmap = cv2.resize(cam, (w, h))
        heatmap_colored = cv2.applyColorMap(
            (heatmap * 255).astype(np.uint8), cv2.COLORMAP_JET
        )
        heatmap_rgb = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGB)

        # Overlay on original
        original_bgr = cv2.cvtColor(original_np, cv2.COLOR_RGB2BGR)
        overlay = cv2.addWeighted(original_bgr, 0.6, heatmap_colored, 0.4, 0)
        overlay_rgb = cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB)

        return heatmap_rgb, overlay_rgb


def generate_gradcam(
    model: torch.nn.Module,
    image_bytes: bytes,
    arch: str = "resnet50",
    class_idx: int | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """Convenience wrapper — picks target layer automatically."""
    target_layer = model.get_gradcam_layer()
    cam = GradCAM(model, target_layer)
    return cam.generate(image_bytes, class_idx=class_idx, arch=arch)
