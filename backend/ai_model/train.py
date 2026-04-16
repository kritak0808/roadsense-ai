"""Fine-tuning pipeline — triggered via /api/retrain/start."""
from __future__ import annotations

import logging
import os
import time
from typing import Callable

import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import DataLoader, random_split
from torchvision.datasets import ImageFolder

from ai_model.models.resnet import build_resnet50
from ai_model.models.efficientnet import build_efficientnet_b4
from ai_model.models.vit import build_vit_b16
from ai_model.utils.augment import get_train_transform, get_val_transform

logger = logging.getLogger(__name__)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def _build_model(arch: str, num_classes: int, weights_path: str | None):
    if arch == "resnet50":
        return build_resnet50(num_classes=num_classes, weights_path=weights_path)
    if arch == "efficientnet_b4":
        return build_efficientnet_b4(num_classes=num_classes, weights_path=weights_path)
    if arch == "vit_b16":
        return build_vit_b16(num_classes=num_classes, weights_path=weights_path)
    raise ValueError(f"Unknown arch: {arch}")


def train_model(
    dataset_dir: str,
    arch: str = "resnet50",
    base_weights: str | None = None,
    epochs: int = 10,
    batch_size: int = 32,
    lr: float = 1e-4,
    output_path: str = "weights/retrained.pth",
    progress_callback: Callable[[dict], None] | None = None,
) -> dict:
    """
    Fine-tune a model on a local dataset directory.

    Args:
        dataset_dir: Path to ImageFolder-structured dataset.
        arch: Model architecture name.
        base_weights: Optional path to starting weights.
        epochs: Number of training epochs.
        batch_size: Mini-batch size.
        lr: Initial learning rate.
        output_path: Where to save the best weights.
        progress_callback: Called each epoch with metrics dict.

    Returns:
        dict with best_accuracy, final_loss, epochs_run, output_path.
    """
    input_sizes = {"resnet50": 224, "efficientnet_b4": 380, "vit_b16": 224}
    size = input_sizes.get(arch, 224)

    full_dataset = ImageFolder(dataset_dir, transform=get_train_transform(size))
    n_val = max(1, int(len(full_dataset) * 0.15))
    n_train = len(full_dataset) - n_val
    train_ds, val_ds = random_split(full_dataset, [n_train, n_val])
    val_ds.dataset.transform = get_val_transform(size)

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=0)

    num_classes = len(full_dataset.classes)
    model = _build_model(arch, num_classes, base_weights).to(DEVICE)
    model.train()

    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = CosineAnnealingLR(optimizer, T_max=epochs)

    best_acc = 0.0
    history: list[dict] = []

    for epoch in range(1, epochs + 1):
        model.train()
        running_loss = 0.0
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            optimizer.zero_grad()
            loss = criterion(model(imgs), labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * imgs.size(0)

        scheduler.step()
        train_loss = running_loss / n_train

        # Validation
        model.eval()
        correct = total = 0
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
                preds = model(imgs).argmax(dim=1)
                correct += (preds == labels).sum().item()
                total += labels.size(0)
        val_acc = correct / total if total > 0 else 0.0

        metrics = {
            "epoch": epoch,
            "train_loss": round(train_loss, 4),
            "val_accuracy": round(val_acc, 4),
        }
        history.append(metrics)
        logger.info("Epoch %d/%d — loss=%.4f acc=%.4f", epoch, epochs, train_loss, val_acc)

        if progress_callback:
            progress_callback(metrics)

        if val_acc > best_acc:
            best_acc = val_acc
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            torch.save(model.state_dict(), output_path)

    return {
        "best_accuracy": round(best_acc, 4),
        "epochs_run": epochs,
        "output_path": output_path,
        "history": history,
    }
