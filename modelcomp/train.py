import time
from contextlib import nullcontext
from pathlib import Path
import torch
from torch import nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.amp import GradScaler, autocast
from sklearn.metrics import accuracy_score

from modelcomp.data import get_dataloaders
from modelcomp.models import create_model
from modelcomp.utils import set_seed, save_checkpoint, format_time, append_epoch_log
from modelcomp.evaluate import evaluate_model


def build_optimizer(model, config):
    optimizer_kwargs = {"lr": config.lr, "weight_decay": config.weight_decay}
    if config.model_family == "transformer":
        optimizer = AdamW(model.parameters(), betas=(0.9, 0.999), **optimizer_kwargs)
    elif config.model_name == "convnext_tiny":
        optimizer = AdamW(model.parameters(), betas=(0.9, 0.95), **optimizer_kwargs)
    else:
        optimizer = AdamW(model.parameters(), **optimizer_kwargs)
    return optimizer


def build_scheduler(optimizer, config):
    t_max = max(1, config.epochs)
    return CosineAnnealingLR(optimizer, T_max=t_max, eta_min=1e-6)


def get_amp_context(device, use_amp):
    if not use_amp:
        return nullcontext()
    if isinstance(device, torch.device):
        device_name = device.type
    else:
        device_name = str(device)
    if device_name.startswith("cuda"):
        return autocast(device_type="cuda")
    if device_name.startswith("mps"):
        return autocast(device_type="mps")
    return nullcontext()


def train_one_epoch(model, dataloader, criterion, optimizer, device, scaler, use_amp, max_grad_norm):
    model.train()
    running_loss = 0.0
    targets = []
    preds = []

    for images, labels in dataloader:
        images = images.to(device, non_blocking=True)
        labels = labels.to(device, non_blocking=True)

        optimizer.zero_grad()
        with get_amp_context(device, use_amp):
            outputs = model(images)
            loss = criterion(outputs, labels)

        if scaler is None:
            loss.backward()
            if max_grad_norm > 0:
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_grad_norm)
            optimizer.step()
        else:
            scaler.scale(loss).backward()
            if max_grad_norm > 0:
                scaler.unscale_(optimizer)
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_grad_norm)
            scaler.step(optimizer)
            scaler.update()

        running_loss += loss.item() * images.size(0)
        predicted = outputs.argmax(dim=1)
        preds.extend(predicted.detach().cpu().numpy().tolist())
        targets.extend(labels.detach().cpu().numpy().tolist())

    epoch_loss = running_loss / len(dataloader.dataset)
    epoch_acc = accuracy_score(targets, preds)
    return epoch_loss, epoch_acc


def run_training(config):
    set_seed(config.seed)
    config.ensure_paths()

    train_loader, val_loader, _, class_names = get_dataloaders(config)

    model = create_model(config.model_name, config.num_classes, pretrained=True)
    model = model.to(config.device)

    criterion = nn.CrossEntropyLoss()
    optimizer = build_optimizer(model, config)
    scheduler = build_scheduler(optimizer, config)
    scaler = (
        GradScaler(device="cuda", enabled=config.use_amp and config.device.startswith("cuda"))
        if config.device.startswith("cuda")
        else None
    )

    history = {
        "train_loss": [],
        "train_acc": [],
        "val_loss": [],
        "val_acc": [],
    }

    best_score = 0.0
    best_checkpoint = config.checkpoint_dir / f"best_{config.model_name}.pth"
    epochs_without_improvement = 0

    for epoch in range(1, config.epochs + 1):
        epoch_start = time.time()
        train_loss, train_acc = train_one_epoch(
            model,
            train_loader,
            criterion,
            optimizer,
            config.device,
            scaler,
            config.use_amp,
            config.max_grad_norm,
        )
        val_loss, val_acc, val_metrics = evaluate_model(model, val_loader, criterion, config.device, use_amp=config.use_amp)

        scheduler.step()

        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)

        score = val_metrics["f1_score"]
        epoch_log = {
            "epoch": epoch,
            "train_loss": train_loss,
            "train_acc": train_acc,
            "val_loss": val_loss,
            "val_acc": val_acc,
            "val_precision": val_metrics["precision"],
            "val_recall": val_metrics["recall"],
            "val_f1": val_metrics["f1_score"],
            "val_roc_auc": val_metrics.get("roc_auc", float("nan")),
            "lr": optimizer.param_groups[0]["lr"],
        }
        print(f"Learning rate: {optimizer.param_groups[0]['lr']:.6f}")
        append_epoch_log(config.reports_dir / f"{config.model_name}_epoch_log.csv", epoch_log)

        if score > best_score:
            best_score = score
            save_checkpoint(
                {
                    "epoch": epoch,
                    "model_name": config.model_name,
                    "model_state": model.state_dict(),
                    "optimizer_state": optimizer.state_dict(),
                    "scheduler_state": scheduler.state_dict(),
                    "scaler_state": scaler.state_dict() if scaler is not None else None,
                    "best_score": best_score,
                    "class_names": class_names,
                    "config": config.__dict__,
                },
                best_checkpoint,
            )
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1

        epoch_duration = format_time(time.time() - epoch_start)
        print(
            f"Epoch {epoch}/{config.epochs} | {epoch_duration} | "
            f"train_loss={train_loss:.4f} train_acc={train_acc:.4f} | "
            f"val_loss={val_loss:.4f} val_acc={val_acc:.4f} f1={val_metrics['f1_score']:.4f}"
        )

        if epochs_without_improvement >= config.patience:
            print(f"Early stopping after {epoch} epochs (no improvement for {config.patience} epochs).")
            break

    return model, history, best_checkpoint, class_names
