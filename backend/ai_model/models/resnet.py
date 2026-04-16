"""ResNet-50 road damage classifier."""
from __future__ import annotations

import torch
import torch.nn as nn
from torchvision import models


class ResNet50RoadDamage(nn.Module):
    """Fine-tuned ResNet-50 for 4-class road damage classification."""

    def __init__(self, num_classes: int = 4, pretrained: bool = True) -> None:
        super().__init__()
        weights = models.ResNet50_Weights.IMAGENET1K_V2 if pretrained else None
        self.backbone = models.resnet50(weights=weights)
        in_features = self.backbone.fc.in_features
        self.backbone.fc = nn.Sequential(
            nn.Dropout(0.4),
            nn.Linear(in_features, 512),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(512, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.backbone(x)

    def get_gradcam_layer(self) -> nn.Module:
        """Return the last conv layer for Grad-CAM."""
        return self.backbone.layer4[-1].conv3


def build_resnet50(num_classes: int = 4, weights_path: str | None = None) -> ResNet50RoadDamage:
    model = ResNet50RoadDamage(num_classes=num_classes, pretrained=weights_path is None)
    if weights_path:
        state = torch.load(weights_path, map_location="cpu")
        model.load_state_dict(state, strict=False)
    model.eval()
    return model
