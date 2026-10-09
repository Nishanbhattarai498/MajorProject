from __future__ import annotations

import base64
import os
import shutil
from contextlib import asynccontextmanager
from io import BytesIO
from pathlib import Path
from threading import Lock
from urllib.request import urlopen

import numpy as np
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from modelcomp.config import MODEL_PRESETS
from modelcomp.explain import GradCAM, overlay_heatmap, predict_image, preprocess_image
from modelcomp.models import create_model, get_explain_target_layer, get_explain_target_layout


ROOT = Path(__file__).resolve().parents[2]
MODEL_NAME = os.getenv("MODEL_NAME", "swin_tiny_patch4_window7_224")
MODEL_SIZE = int(os.getenv("MODEL_IMAGE_SIZE", str(MODEL_PRESETS.get(MODEL_NAME, {}).get("img_size", 224))))
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
DEFAULT_CHECKPOINT = ROOT / "outputs" / "checkpoints" / f"best_{MODEL_NAME}.pth"
checkpoint_path = Path(os.getenv("MODEL_CHECKPOINT_PATH", str(DEFAULT_CHECKPOINT)))
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model: torch.nn.Module | None = None
class_names = ["glioma", "meningioma", "notumor", "pituitary"]
inference_lock = Lock()
startup_error: str | None = None


def _resolve_checkpoint() -> Path:
    checkpoint_url = os.getenv("MODEL_CHECKPOINT_URL")
    if checkpoint_url:
        checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
        with urlopen(checkpoint_url, timeout=120) as response, checkpoint_path.open("wb") as output:
            shutil.copyfileobj(response, output)
    return checkpoint_path


def _load_model() -> None:
    global model, class_names, startup_error
    try:
        path = _resolve_checkpoint()
        if not path.is_file():
            raise FileNotFoundError(f"Checkpoint not found at {path}")
        checkpoint = torch.load(path, map_location=device, weights_only=False)
        checkpoint_model_name = checkpoint.get("model_name", MODEL_NAME)
        if checkpoint_model_name != MODEL_NAME:
            raise ValueError(
                f"Checkpoint model {checkpoint_model_name!r} does not match MODEL_NAME={MODEL_NAME!r}."
            )
        loaded_model = create_model(MODEL_NAME, num_classes=4, pretrained=False)
        loaded_model.load_state_dict(checkpoint["model_state"])
        loaded_model.to(device).eval()
        checkpoint_classes = checkpoint.get("class_names")
        configured_classes = os.getenv("CLASS_NAMES")
        if configured_classes:
            class_names = [name.strip() for name in configured_classes.split(",")]
        elif checkpoint_classes:
            class_names = list(checkpoint_classes)
        if len(class_names) != 4:
            raise ValueError("Exactly four CLASS_NAMES are required for this model.")
        model = loaded_model
        startup_error = None
    except Exception as error:
        model = None
        startup_error = str(error)
        print(f"Model startup failed: {startup_error}")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _load_model()
    yield


app = FastAPI(title="NeuroScope Inference API", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {
        "service": "neuroscope-model-api",
        "ready": model is not None,
        "model": MODEL_NAME,
        "device": str(device),
        "error": startup_error,
    }


def _jpeg_data_url(image: Image.Image, quality: int = 86) -> str:
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=quality, optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


@app.post("/predict")
def predict(file: UploadFile = File(...)) -> dict:
    if model is None:
        raise HTTPException(status_code=503, detail="The model is not ready. Check the model service health endpoint.")
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Upload a JPEG, PNG, or WebP image.")

    raw_image = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw_image) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 8 MB or smaller.")
    try:
        with Image.open(BytesIO(raw_image)) as uploaded:
            image = uploaded.convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="The uploaded file is not a readable image.") from None

    image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    rgb_image = np.asarray(image, dtype=np.uint8)
    input_tensor = preprocess_image(rgb_image, MODEL_SIZE).to(device)

    try:
        with inference_lock:
            prediction = predict_image(model, input_tensor)
            target_layer = get_explain_target_layer(MODEL_NAME, model)
            with GradCAM(model, target_layer, get_explain_target_layout(MODEL_NAME)) as gradcam:
                cam = gradcam(input_tensor, prediction.class_idx)
            overlay = overlay_heatmap(rgb_image, cam)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Inference failed: {error}") from error

    return {
        "model": MODEL_NAME,
        "predictedClass": class_names[prediction.class_idx],
        "confidence": prediction.confidence,
        "probabilities": [
            {"className": name, "confidence": float(score)}
            for name, score in zip(class_names, prediction.probabilities)
        ],
        "originalImage": _jpeg_data_url(image),
        "gradcamImage": _jpeg_data_url(Image.fromarray(overlay)),
    }