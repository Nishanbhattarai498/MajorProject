import math
import os
import random
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import torch


def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


def save_checkpoint(state: dict, checkpoint_path: Path):
    ensure_dir(checkpoint_path.parent)
    torch.save(state, checkpoint_path)


def load_checkpoint(checkpoint_path: Path, device: str):
    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    return checkpoint


def plot_history(history: dict, output_path: Path):
    ensure_dir(output_path.parent)
    plt.figure(figsize=(12, 5))
    plt.subplot(1, 2, 1)
    plt.plot(history["train_loss"], label="train_loss")
    plt.plot(history["val_loss"], label="val_loss")
    plt.xlabel("epoch")
    plt.ylabel("loss")
    plt.legend()
    plt.grid(True)

    plt.subplot(1, 2, 2)
    plt.plot(history["train_acc"], label="train_acc")
    plt.plot(history["val_acc"], label="val_acc")
    plt.xlabel("epoch")
    plt.ylabel("accuracy")
    plt.legend()
    plt.grid(True)

    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def save_report(report: dict, csv_path: Path):
    ensure_dir(csv_path.parent)
    report_df = pd.DataFrame([report])
    if csv_path.exists():
        existing = pd.read_csv(csv_path)
        report_df = pd.concat([existing, report_df], ignore_index=True)
    report_df.to_csv(csv_path, index=False)


def append_epoch_log(log_path: Path, row: dict):
    ensure_dir(log_path.parent)
    df = pd.DataFrame([row])
    if log_path.exists():
        existing = pd.read_csv(log_path)
        df = pd.concat([existing, df], ignore_index=True)
    df.to_csv(log_path, index=False)


def format_time(seconds: float):
    minutes = int(seconds // 60)
    sec = int(seconds % 60)
    return f"{minutes}m {sec}s"
