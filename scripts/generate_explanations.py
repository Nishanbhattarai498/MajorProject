"""Generate Grad-CAM and LIME explanations from trained checkpoints.

Run with: python -m scripts.generate_explanations --image data/test/class/example.jpg
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Sequence

import cv2
import torch

from modelcomp.config import ExperimentConfig
from modelcomp.data import opencv_loader
from modelcomp.explain import GradCAM, generate_lime_explanation, overlay_heatmap, predict_image, preprocess_image
from modelcomp.models import create_model, get_explain_target_layer, get_explain_target_layout
from modelcomp.utils import load_checkpoint


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate Grad-CAM and LIME explanations for trained models.")
    parser.add_argument("--image", type=Path, required=True, help="RGB image to explain.")
    parser.add_argument("--model", action="append", dest="models", help="Model name; repeat to explain multiple models.")
    parser.add_argument("--checkpoint-dir", type=Path, default=Path("outputs/checkpoints"))
    parser.add_argument("--output-dir", type=Path, default=Path("outputs/explanations/manual"))
    parser.add_argument("--lime-samples", type=int, default=800)
    parser.add_argument("--skip-lime", action="store_true")
    return parser.parse_args(argv)


def available_models(checkpoint_dir: Path) -> list[str]:
    prefix = "best_"
    return sorted(path.stem[len(prefix) :] for path in checkpoint_dir.glob("best_*.pth") if path.stem.startswith(prefix))


def explain_image(args: argparse.Namespace) -> None:
    if not args.image.is_file() or args.image.suffix.lower() not in IMAGE_EXTENSIONS:
        raise FileNotFoundError(f"Image not found or unsupported: {args.image}")
    models = args.models or available_models(args.checkpoint_dir)
    if not models:
        raise FileNotFoundError(f"No best_*.pth checkpoints found in {args.checkpoint_dir}")

    original = opencv_loader(str(args.image))
    device = "cuda" if torch.cuda.is_available() else "cpu"
    for model_name in models:
        checkpoint_path = args.checkpoint_dir / f"best_{model_name}.pth"
        if not checkpoint_path.is_file():
            print(f"Skipping {model_name}: checkpoint not found at {checkpoint_path}")
            continue
        checkpoint = load_checkpoint(checkpoint_path, device="cpu")
        class_names = checkpoint.get("class_names", [])
        if not class_names:
            raise ValueError(f"Checkpoint {checkpoint_path} does not contain class_names.")
        config = ExperimentConfig(model_name=model_name, img_size=checkpoint.get("config", {}).get("img_size", 224), device=device)
        model = create_model(model_name, len(class_names), pretrained=False)
        model.load_state_dict(checkpoint["model_state"])
        model.to(device).eval()

        inputs = preprocess_image(original, config.img_size).to(device)
        prediction = predict_image(model, inputs)
        output_dir = args.output_dir / model_name
        output_dir.mkdir(parents=True, exist_ok=True)
        with GradCAM(model, get_explain_target_layer(model_name, model), get_explain_target_layout(model_name)) as generator:
            overlay = overlay_heatmap(original, generator(inputs, prediction.class_idx))
        gradcam_path = output_dir / f"{args.image.stem}_gradcam.png"
        cv2.imwrite(str(gradcam_path), cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))

        lime_path = output_dir / f"{args.image.stem}_lime.png"
        if not args.skip_lime:
            try:
                generate_lime_explanation(
                    model,
                    original,
                    config,
                    target_class=prediction.class_idx,
                    output_path=lime_path,
                    num_samples=args.lime_samples,
                )
            except (ImportError, RuntimeError, ValueError) as exc:
                print(f"{model_name}: LIME skipped: {exc}")
        print(f"{model_name}: {class_names[prediction.class_idx]} ({prediction.confidence:.1%}) | Grad-CAM: {gradcam_path} | LIME: {lime_path if lime_path.exists() else 'skipped'}")


def main(argv: Sequence[str] | None = None) -> None:
    explain_image(parse_args(argv))


if __name__ == "__main__":
    main()
