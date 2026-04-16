"""Vision Transformer (ViT-B/16) road damage classifier."""
from __future__ import annotations

import torch
import torch.nn as nn
import timm


class ViTB16RoadDamage(nn.Module):
    """Fine-tuned ViT-B/16 for 4-class road damage classification."""

    def __init__(self, num_classes: int = 4, pretrained: bool = True) -> None:
        super().__init__()
        self.backbone = timm.create_model(
            "vit_base_patch16_224",
            pretrained=pretrained,
            num_classes=num_classes,
        )
        # Replace head with dropout-regularised version
        in_features = self.backbone.head.in_features
        self.backbone.head = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(in_features, num_classes),
        )
        self.num_heads = self.backbone.blocks[0].attn.num_heads
        self.num_layers = len(self.backbone.blocks)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.backbone(x)

    def forward_with_attention(
        self, x: torch.Tensor
    ) -> tuple[torch.Tensor, list[torch.Tensor]]:
        """Return logits + list of attention maps per transformer block."""
        attentions: list[torch.Tensor] = []
        hooks = []

        def _make_hook(attn_module):
            def _hook(module, inp, out):
                # Recompute attention weights from Q, K
                B, N, C = inp[0].shape
                qkv = attn_module.qkv(inp[0]).reshape(
                    B, N, 3, attn_module.num_heads, C // attn_module.num_heads
                ).permute(2, 0, 3, 1, 4)
                q, k = qkv[0], qkv[1]
                scale = (C // attn_module.num_heads) ** -0.5
                attn = (q @ k.transpose(-2, -1)) * scale
                attn = attn.softmax(dim=-1)
                attentions.append(attn.detach())
            return _hook

        for block in self.backbone.blocks:
            hooks.append(block.attn.register_forward_hook(_make_hook(block.attn)))

        logits = self.backbone(x)
        for h in hooks:
            h.remove()
        return logits, attentions


def build_vit_b16(
    num_classes: int = 4, weights_path: str | None = None
) -> ViTB16RoadDamage:
    model = ViTB16RoadDamage(num_classes=num_classes, pretrained=weights_path is None)
    if weights_path:
        state = torch.load(weights_path, map_location="cpu")
        model.load_state_dict(state, strict=False)
    model.eval()
    return model
