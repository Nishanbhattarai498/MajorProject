"""FastAPI inference service using the repository's trained PyTorch checkpoints."""

from __future__ import annotations

import base64
import io
import os
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from modelcomp.config import ExperimentConfig
from modelcomp.explain import GradCAM, overlay_heatmap, predict_image, preprocess_image
from modelcomp.models import create_model, get_explain_target_layer, get_explain_target_layout
from modelcomp.utils import load_checkpoint


MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
DEFAULT_MODEL = "efficientnetv2_s"

app = FastAPI(
    title="Brain MRI Inference API",
    version="1.0.0",
    description="Classifies brain MRI images and returns a Grad-CAM visualization.",
)


@lru_cache(maxsize=1)
def load_runtime() -> dict:
    model_name = os.getenv("MODEL_NAME", DEFAULT_MODEL)
    checkpoint_path = Path(
        os.getenv("CHECKPOINT_PATH", f"outputs/checkpoints/best_{model_name}.pth")
    )
    if not checkpoint_path.is_file():
        raise RuntimeError(f"Model checkpoint not found: {checkpoint_path}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    checkpoint = load_checkpoint(checkpoint_path, device="cpu")
    class_names = checkpoint.get("class_names")
    if not class_names or checkpoint.get("model_name") != model_name:
        raise RuntimeError("Checkpoint model name or class names are missing or inconsistent.")

    image_size = int(checkpoint.get("config", {}).get("img_size", 224))
    model = create_model(model_name, len(class_names), pretrained=False)
    model.load_state_dict(checkpoint["model_state"])
    model.to(device).eval()

    return {
        "model": model,
        "model_name": model_name,
        "class_names": class_names,
        "image_size": image_size,
        "device": device,
        "target_layer": get_explain_target_layer(model_name, model),
        "feature_layout": get_explain_target_layout(model_name),
    }


def decode_image(data: bytes) -> np.ndarray:
    if not data:
        raise ValueError("The uploaded image is empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise ValueError("Image must be 12 MB or smaller.")

    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.width * image.height > MAX_IMAGE_PIXELS:
                raise ValueError("Image dimensions are too large.")
            return np.asarray(image.convert("RGB"))
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("Upload a valid JPEG, PNG, or WebP image.") from exc


def analyze_image(image: np.ndarray, runtime: dict) -> dict:
    """Create the prediction and matching Grad-CAM overlay for one RGB image."""
    model = runtime["model"]
    device = runtime["device"]
    inputs = preprocess_image(image, runtime["image_size"]).to(device)
    prediction = predict_image(model, inputs)
    with GradCAM(model, runtime["target_layer"], runtime["feature_layout"]) as generator:
        cam = generator(inputs, prediction.class_idx)

    overlay = overlay_heatmap(image, cam)
    success, encoded = cv2.imencode(
        ".jpg", cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 88]
    )
    if not success:
        raise RuntimeError("Could not encode the Grad-CAM image.")

    scores = [
        {"class_name": name, "probability": float(probability)}
        for name, probability in zip(runtime["class_names"], prediction.probabilities)
    ]
    return {
        "class_name": runtime["class_names"][prediction.class_idx],
        "confidence": prediction.confidence,
        "class_scores": scores,
        "model_name": runtime["model_name"],
        "gradcam_base64": base64.b64encode(encoded.tobytes()).decode("ascii"),
    }


@app.on_event("startup")
def warm_model() -> None:
    load_runtime()


@app.get("/health")
def health() -> dict:
    try:
        runtime = load_runtime()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="The model is not ready.") from exc
    return {"status": "ok", "model_name": runtime["model_name"]}


@app.post("/predict")
def predict(file: UploadFile = File(...)) -> dict:
    try:
        image = decode_image(file.file.read(MAX_IMAGE_BYTES + 1))
        return analyze_image(image, load_runtime())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Model inference failed.") from exc
    finally:
        file.file.close()