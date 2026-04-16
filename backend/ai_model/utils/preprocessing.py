"""Image preprocessing utilities shared across all models."""
from __future__ import annotations

import io
from typing import Tuple

import cv2
import numpy as np
import torch
from PIL import Image
from torchvision import transforms

# Standard ImageNet normalisation
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

# Per-model input sizes
MODEL_INPUT_SIZES: dict[str, int] = {
    "resnet50": 224,
    "efficientnet_b4": 380,
    "vit_b16": 224,
    "mobilenet_v2": 224,
}


def get_transform(model_name: str = "resnet50") -> transforms.Compose:
    size = MODEL_INPUT_SIZES.get(model_name, 224)
    return transforms.Compose(
        [
            transforms.Resize((size, size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ]
    )


def preprocess_image(
    image_bytes: bytes, model_name: str = "resnet50"
) -> Tuple[torch.Tensor, np.ndarray]:
    """
    Convert raw image bytes → (tensor [1,C,H,W], original RGB numpy array).
    """
    pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    original_np = np.array(pil_img)
    transform = get_transform(model_name)
    tensor = transform(pil_img).unsqueeze(0)  # [1, C, H, W]
    return tensor, original_np


def denormalize(tensor: torch.Tensor) -> np.ndarray:
    """Reverse ImageNet normalisation → uint8 HWC numpy array."""
    mean = torch.tensor(IMAGENET_MEAN).view(3, 1, 1)
    std = torch.tensor(IMAGENET_STD).view(3, 1, 1)
    img = tensor.squeeze(0).cpu() * std + mean
    img = img.permute(1, 2, 0).numpy()
    return (np.clip(img, 0, 1) * 255).astype(np.uint8)


def validate_image(image_bytes: bytes, max_bytes: int = 20 * 1024 * 1024) -> None:
    """Raise ValueError if image is invalid or too large."""
    if len(image_bytes) > max_bytes:
        raise ValueError(f"Image exceeds {max_bytes // (1024*1024)} MB limit")
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.verify()
    except Exception as exc:
        raise ValueError(f"Invalid image file: {exc}") from exc


def is_aerial_image(image_bytes: bytes, min_dim: int = 2000) -> bool:
    """Heuristic: image is aerial if either dimension exceeds min_dim."""
    img = Image.open(io.BytesIO(image_bytes))
    return max(img.size) >= min_dim


def tile_image(
    image_np: np.ndarray,
    tile_size: int = 512,
    overlap: float = 0.25,
) -> list[Tuple[np.ndarray, Tuple[int, int, int, int]]]:
    """
    Tile a large image into overlapping patches.
    Returns list of (tile_array, (x1, y1, x2, y2)).
    """
    h, w = image_np.shape[:2]
    stride = int(tile_size * (1 - overlap))
    tiles = []
    for y in range(0, h - tile_size + 1, stride):
        for x in range(0, w - tile_size + 1, stride):
            tile = image_np[y : y + tile_size, x : x + tile_size]
            tiles.append((tile, (x, y, x + tile_size, y + tile_size)))
    return tiles
