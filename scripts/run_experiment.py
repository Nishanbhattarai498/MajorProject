import argparse
from pathlib import Path
import numpy as np
import torch
import pandas as pd

from modelcomp.config import ExperimentConfig
from modelcomp.data import get_dataloaders
from modelcomp.train import run_training
from modelcomp.evaluate import test_model, save_model_analysis_artifacts
from modelcomp.explain import explain_samples
from modelcomp.utils import save_report


def parse_args():
    parser = argparse.ArgumentParser(description="Run a brain tumor MRI classification experiment.")
    parser.add_argument("--model", default="efficientnetv2_s", help="Model name from timm (for example: efficientnetv2_s, convnext_tiny, swin_tiny_patch4_window7_224)")
    parser.add_argument("--data-dir", default="./data")
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output-dir", default="outputs")
    parser.add_argument("--num-workers", type=int, default=4)
    return parser.parse_args()


def main():
    args = parse_args()
    config = ExperimentConfig(
        data_dir=Path(args.data_dir),
        model_name=args.model,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        seed=args.seed,
        output_dir=Path(args.output_dir),
        num_workers=args.num_workers,
    )
    run_experiment(config)


def run_experiment(config):
    config.ensure_paths()

    print(f"Running experiment for {config.model_name}")
    model, history, checkpoint_path, class_names = run_training(config)

    test_loader = get_dataloaders(config)[2]
    metrics = test_model(model, test_loader, config.device, class_names, checkpoint_path=checkpoint_path, use_amp=config.use_amp)
    print(f"Test metrics: {metrics}")

    y_true = []
    y_pred = []
    all_probabilities = []
    for images, labels in test_loader:
        images = images.to(config.device, non_blocking=True)
        with torch.no_grad():
            outputs = model(images)
        probabilities = torch.softmax(outputs, dim=1).cpu().numpy()
        y_pred.extend(outputs.argmax(dim=1).cpu().numpy().tolist())
        y_true.extend(labels.numpy().tolist())
        all_probabilities.extend(probabilities)

    analysis_dir = Path(config.reports_dir) / config.model_name
    save_model_analysis_artifacts(
        history,
        y_true,
        y_pred,
        np.array(all_probabilities),
        class_names,
        analysis_dir,
    )

    report = {
        "model_name": config.model_name,
        "display_name": config.display_name,
        "model_family": config.model_family,
        "epochs": len(history["train_loss"]),
        "batch_size": config.batch_size,
        "lr": config.lr,
        "weight_decay": config.weight_decay,
        "img_size": config.img_size,
        **metrics,
    }
    save_report(report, Path(config.reports_dir) / "experiment_summary.csv")

    try:
        explain_results = explain_samples(model, config, class_names, num_samples=12)
        pd.DataFrame(explain_results).to_csv(Path(config.explain_dir) / f"explain_{config.model_name}.csv", index=False)
        print(f"Explanation images saved to {config.explain_dir}/{config.model_name}")
    except Exception as exc:
        print(f"Explainability step skipped due to error: {exc}")

    print(f"Best checkpoint saved to {checkpoint_path}")
    print(f"Analysis plots saved to {analysis_dir}")
    print(f"Explainability outputs saved to {config.explain_dir}/{config.model_name}")
    return metrics, checkpoint_path


if __name__ == "__main__":
    main()
