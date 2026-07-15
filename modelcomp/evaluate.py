from pathlib import Path
from contextlib import nullcontext
import numpy as np
import torch
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    roc_curve,
)
from sklearn.preprocessing import label_binarize
import matplotlib.pyplot as plt
import seaborn as sns
from torch.amp import autocast


def compute_metrics(y_true, y_pred, y_prob, class_names):
    metrics = {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, average="macro", zero_division=0),
        "recall": recall_score(y_true, y_pred, average="macro", zero_division=0),
        "f1_score": f1_score(y_true, y_pred, average="macro", zero_division=0),
    }
    if y_prob is not None:
        try:
            y_true_onehot = np.eye(len(class_names))[y_true]
            metrics["roc_auc"] = roc_auc_score(
                y_true_onehot, y_prob, multi_class="ovo", average="macro"
            )
        except Exception:
            metrics["roc_auc"] = float("nan")
    else:
        metrics["roc_auc"] = float("nan")

    return metrics


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


def evaluate_model(model, dataloader, criterion, device, use_amp=False):
    model.eval()
    targets = []
    preds = []
    probas = []
    running_loss = 0.0

    with torch.no_grad():
        for images, labels in dataloader:
            images = images.to(device, non_blocking=True)
            labels = labels.to(device, non_blocking=True)
            with get_amp_context(device, use_amp):
                outputs = model(images)
                loss = criterion(outputs, labels)
            running_loss += loss.item() * images.size(0)
            probabilities = torch.softmax(outputs, dim=1)
            preds.extend(outputs.argmax(dim=1).cpu().numpy().tolist())
            probas.extend(probabilities.cpu().numpy().tolist())
            targets.extend(labels.cpu().numpy().tolist())

    metrics = compute_metrics(np.array(targets), np.array(preds), np.array(probas), dataloader.dataset.dataset.classes)
    avg_loss = running_loss / len(dataloader.dataset)
    return avg_loss, metrics["accuracy"], metrics


def test_model(model, dataloader, device, class_names, checkpoint_path=None, use_amp=False):
    if checkpoint_path is not None:
        checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
        model.load_state_dict(checkpoint["model_state"])
    model = model.to(device)
    criterion = torch.nn.CrossEntropyLoss()
    _, _, metrics = evaluate_model(model, dataloader, criterion, device, use_amp=use_amp)
    return metrics


def plot_confusion_matrix(y_true, y_pred, class_names, output_path: Path):
    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", xticklabels=class_names, yticklabels=class_names)
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    plt.title("Confusion Matrix")
    plt.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_path)
    plt.close()


def plot_class_metrics(y_true, y_pred, class_names, output_path: Path):
    precision = precision_score(y_true, y_pred, average=None, labels=np.arange(len(class_names)), zero_division=0)
    recall = recall_score(y_true, y_pred, average=None, labels=np.arange(len(class_names)), zero_division=0)
    f1 = f1_score(y_true, y_pred, average=None, labels=np.arange(len(class_names)), zero_division=0)

    x = np.arange(len(class_names))
    width = 0.25
    plt.figure(figsize=(10, 5))
    plt.bar(x - width, precision, width=width, label="Precision")
    plt.bar(x, recall, width=width, label="Recall")
    plt.bar(x + width, f1, width=width, label="F1")
    plt.xticks(x, class_names, rotation=30)
    plt.ylabel("Score")
    plt.title("Per-class Precision / Recall / F1")
    plt.ylim(0, 1.05)
    plt.legend()
    plt.grid(axis="y", alpha=0.3)
    plt.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_path)
    plt.close()


def plot_roc_curve(y_true, y_prob, class_names, output_path: Path):
    y_true_bin = label_binarize(y_true, classes=np.arange(len(class_names)))
    y_prob = np.asarray(y_prob)
    if y_prob.ndim == 1:
        y_prob = np.vstack([1 - y_prob, y_prob]).T

    plt.figure(figsize=(8, 6))
    for class_idx in range(len(class_names)):
        fpr, tpr, _ = roc_curve(y_true_bin[:, class_idx], y_prob[:, class_idx])
        auc_score = roc_auc_score(y_true_bin[:, class_idx], y_prob[:, class_idx])
        plt.plot(fpr, tpr, label=f"{class_names[class_idx]} (AUC={auc_score:.2f})")
    plt.plot([0, 1], [0, 1], linestyle="--", color="gray")
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.title("ROC Curve")
    plt.legend(loc="lower right")
    plt.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_path)
    plt.close()


def save_model_analysis_artifacts(history, y_true, y_pred, y_prob, class_names, output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    from modelcomp.utils import plot_history

    plot_history(history, output_dir / "training_history.png")
    plot_confusion_matrix(y_true, y_pred, class_names, output_dir / "confusion_matrix.png")
    plot_class_metrics(y_true, y_pred, class_names, output_dir / "class_metrics.png")
    plot_roc_curve(y_true, y_prob, class_names, output_dir / "roc_curve.png")
