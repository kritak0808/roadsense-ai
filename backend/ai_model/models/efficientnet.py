"""EfficientNet-B4 road damage classifier."""
from __future__ import annotations

import torch
import torch.nn as nn
import timm


class EfficientNetB4RoadDamage(nn.Module):
    """Fine-tuned EfficientNet-B4 for 4-class road damage classification."""

    def __init__(self, num_classes: int = 4, pretrained: bool = True) -> None:
        super().__init__()
        self.backbone = timm.create_model(
            "efficientnet_b4",
            pretrained=pretrained,
            num_classes=0,  # remove head
        )
        in_features = self.backbone.num_features
        self.classifier = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Dropout(0.4),
            nn.Linear(in_features, 512),
            nn.SiLU(),
            nn.Dropout(0.3),
            nn.Linear(512, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        features = self.backbone.forward_features(x)
        return self.classifier(features)

    def get_gradcam_layer(self) -> nn.Module:
        return self.backbone.conv_head


def build_efficientnet_b4(
    num_classes: int = 4, weights_path: str | None = None
) -> EfficientNetB4RoadDamage:
    model = EfficientNetB4RoadDamage(num_classes=num_classes, pretrained=weights_path is None)
    if weights_path:
        state = torch.load(weights_path, map_location="cpu")
        model.load_state_dict(state, strict=False)
    model.eval()
    return model
