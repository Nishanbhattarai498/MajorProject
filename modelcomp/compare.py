import pandas as pd
from pathlib import Path
from modelcomp.config import ExperimentConfig
from modelcomp.run_experiment import run_experiment

MODEL_NAMES = [
    "efficientnetv2_s",
    "convnext_tiny",
    "swin_tiny_patch4_window7_224",
]


def compare_models(data_dir: Path, output_dir: Path, epochs: int = 15, batch_size: int = 32, lr: float = 2e-4, num_workers: int = 4, seed: int = 42):
    summary_rows = []
    for model_name in MODEL_NAMES:
        print(f"\n=== Running {model_name} ===")
        config = ExperimentConfig(
            data_dir=data_dir,
            model_name=model_name,
            epochs=epochs,
            batch_size=batch_size,
            lr=lr,
            seed=seed,
            output_dir=output_dir,
            num_workers=num_workers,
        )
        config.ensure_paths()
        metrics, checkpoint_path = run_experiment(config)
        summary_rows.append({"model_name": model_name, **metrics, "checkpoint_path": str(checkpoint_path)})

    summary_df = pd.DataFrame(summary_rows)
    output_path = output_dir / "model_comparison_summary.csv"
    summary_df.to_csv(output_path, index=False)

    if not summary_df.empty:
        best_row = summary_df.sort_values(["f1_score", "accuracy"], ascending=False).iloc[0]
        best_model_path = output_dir / "best_model.txt"
        best_model_path.write_text(f"{best_row['model_name']}\n", encoding="utf-8")
        print(f"\nBest model selected automatically: {best_row['model_name']} (f1={best_row['f1_score']:.4f})")

    print(f"\nSaved model comparison summary to {output_path}")
    return output_path


def parse_args():
    import argparse

    parser = argparse.ArgumentParser(description="Compare multiple models on the brain tumor dataset.")
    parser.add_argument("--data-dir", type=Path, required=True, help="Root dataset directory with train/val/test subfolders.")
    parser.add_argument("--output-dir", type=Path, default=Path("outputs"), help="Experiment output directory.")
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--num-workers", type=int, default=4)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def main():
    args = parse_args()
    compare_models(
        data_dir=args.data_dir,
        output_dir=args.output_dir,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        num_workers=args.num_workers,
        seed=args.seed,
    )


if __name__ == "__main__":
    main()
