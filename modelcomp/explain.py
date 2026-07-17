"""Prediction-aligned Grad-CAM and LIME utilities for image classifiers."""

from __future__ import annotations

from contextlib import AbstractContextManager
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Literal, Optional, Sequence

import cv2
import numpy as np
import torch
import torch.nn.functional as functional

from modelcomp.data import opencv_loader
from modelcomp.models import get_explain_target_layer, get_explain_target_layout
from modelcomp.utils import ensure_dir

try:
    from lime import lime_image
    from skimage.segmentation import slic
except ImportError:  # pragma: no cover - optional dependency
    lime_image = None
    slic = None


IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)
FeatureLayout = Literal["bchw", "bhwc", "bnc", "auto"]


@dataclass(frozen=True)
class Prediction:
    """The classifier output used as the target for an explanation."""

    class_idx: int
    confidence: float
    probabilities: np.ndarray


class GradCAM(AbstractContextManager):
    """Generate a Grad-CAM map for the exact class score selected from logits."""

    def __init__(
        self,
        model: torch.nn.Module,
        target_layer: torch.nn.Module,
        feature_layout: FeatureLayout = "auto",
    ):
        self.model = model
        self.target_layer = target_layer
        self.feature_layout = feature_layout
        self.activations: Optional[torch.Tensor] = None
        self.gradients: Optional[torch.Tensor] = None
        self._hook_handle = target_layer.register_forward_hook(self._capture_activations)

    def _capture_activations(
        self, _module: torch.nn.Module, _inputs: tuple[torch.Tensor, ...], output: torch.Tensor
    ) -> None:
        if isinstance(output, (tuple, list)):
            output = output[0]
        if not isinstance(output, torch.Tensor):
            raise TypeError("Grad-CAM target layer must return a tensor.")
        self.activations = output.detach()
        output.register_hook(self._capture_gradients)

    def _capture_gradients(self, gradients: torch.Tensor) -> None:
        self.gradients = gradients.detach()

    def remove_hooks(self) -> None:
        if self._hook_handle is not None:
            self._hook_handle.remove()
            self._hook_handle = None

    def __exit__(self, *_: object) -> None:
        self.remove_hooks()

    def __call__(self, input_tensor: torch.Tensor, class_idx: Optional[int] = None) -> np.ndarray:
        if input_tensor.ndim != 4 or input_tensor.shape[0] != 1:
            raise ValueError("Grad-CAM expects one image with shape [1, C, H, W].")

        self.activations = None
        self.gradients = None
        self.model.zero_grad(set_to_none=True)
        logits = self.model(input_tensor)
        if logits.ndim != 2 or logits.shape[0] != 1:
            raise ValueError("Grad-CAM model output must have shape [1, num_classes].")
        if class_idx is None:
            class_idx = int(logits.argmax(dim=1).item())
        if not 0 <= class_idx < logits.shape[1]:
            raise ValueError(f"class_idx must be in [0, {logits.shape[1] - 1}], got {class_idx}.")

        # Use the raw logit, rather than a softmax probability, to avoid gradients
        # being suppressed by competing classes.
        logits[0, class_idx].backward()
        if self.activations is None or self.gradients is None:
            raise RuntimeError("Grad-CAM hooks did not receive activations and gradients.")

        activations = _as_feature_map(self.activations, self.feature_layout)
        gradients = _as_feature_map(self.gradients, self.feature_layout)
        if activations.shape != gradients.shape:
            raise RuntimeError("Grad-CAM activation and gradient shapes do not match.")

        weights = gradients.mean(dim=(2, 3), keepdim=True)
        cam = torch.relu((weights * activations).sum(dim=1, keepdim=True))
        cam = functional.interpolate(cam, size=input_tensor.shape[-2:], mode="bilinear", align_corners=False)
        return _normalize(cam[0, 0].detach().cpu().numpy())


def _as_feature_map(features: torch.Tensor, layout: FeatureLayout = "auto") -> torch.Tensor:
    """Convert a known target-layer layout into BCHW without guessing Swin tensors."""
    if layout == "auto":
        if features.ndim == 3:
            layout = "bnc"
        elif features.ndim == 4:
            layout = "bchw"
        else:
            raise ValueError(f"Unsupported Grad-CAM activation shape: {tuple(features.shape)}")

    if layout == "bchw" and features.ndim == 4:
        return features
    if layout == "bhwc" and features.ndim == 4:
        return features.permute(0, 3, 1, 2)
    if layout == "bnc" and features.ndim == 3:
        batch, tokens, channels = features.shape
        side = int(np.sqrt(tokens))
        if side * side != tokens:
            side = int(np.sqrt(tokens - 1))
            if side * side != tokens - 1:
                raise ValueError(f"Cannot reshape {tokens} transformer tokens into a spatial grid.")
            features = features[:, 1:, :]
        return features.transpose(1, 2).reshape(batch, channels, side, side)
    raise ValueError(f"Expected {layout} activations, got shape {tuple(features.shape)}.")


def _normalize(array: np.ndarray) -> np.ndarray:
    array = array.astype(np.float32, copy=False)
    minimum, maximum = float(array.min()), float(array.max())
    if maximum <= minimum:
        return np.zeros_like(array, dtype=np.float32)
    return (array - minimum) / (maximum - minimum)


def preprocess_image(image: np.ndarray, image_size: int) -> torch.Tensor:
    """Resize one RGB image and apply the evaluation normalization used in training."""
    return preprocess_batch(np.asarray(image)[None, ...], image_size)


def preprocess_batch(images: np.ndarray, image_size: int) -> torch.Tensor:
    """Convert RGB images in NHWC layout to normalized float32 NCHW tensors."""
    images = np.asarray(images)
    if images.ndim != 4 or images.shape[-1] not in (1, 3):
        raise ValueError("Expected images with shape [N, H, W, 1|3].")
    if image_size < 1:
        raise ValueError("image_size must be positive.")

    processed = []
    for image in images:
        if image.shape[-1] == 1:
            image = np.repeat(image, 3, axis=-1)
        processed.append(cv2.resize(image, (image_size, image_size), interpolation=cv2.INTER_LINEAR))
    batch = np.stack(processed).astype(np.float32)
    if batch.max(initial=0.0) > 1.0:
        batch /= 255.0
    mean = np.asarray(IMAGENET_MEAN, dtype=np.float32)[None, None, None, :]
    std = np.asarray(IMAGENET_STD, dtype=np.float32)[None, None, None, :]
    return torch.from_numpy(((batch - mean) / std).transpose(0, 3, 1, 2).copy())


def predict_image(model: torch.nn.Module, inputs: torch.Tensor) -> Prediction:
    """Return the class and confidence from the same evaluation path explanations use."""
    model.eval()
    with torch.inference_mode():
        logits = model(inputs)
        if logits.ndim != 2 or logits.shape[0] != 1:
            raise ValueError("Model output must have shape [1, num_classes].")
        probabilities = torch.softmax(logits, dim=1)[0]
    class_idx = int(probabilities.argmax().item())
    return Prediction(class_idx, float(probabilities[class_idx].item()), probabilities.cpu().numpy())


def overlay_heatmap(original: np.ndarray, cam: np.ndarray, alpha: float = 0.45) -> np.ndarray:
    """Overlay a normalized CAM map on an RGB image."""
    if not 0.0 <= alpha <= 1.0:
        raise ValueError("alpha must be between 0 and 1.")
    original = np.asarray(original, dtype=np.uint8)
    cam = cv2.resize(_normalize(cam), (original.shape[1], original.shape[0]), interpolation=cv2.INTER_LINEAR)
    heatmap = cv2.cvtColor(cv2.applyColorMap(np.uint8(255 * cam), cv2.COLORMAP_JET), cv2.COLOR_BGR2RGB)
    return cv2.addWeighted(heatmap, alpha, original, 1 - alpha, 0)


def predict_probabilities(model: torch.nn.Module, images: np.ndarray, config: object, batch_size: int = 32) -> np.ndarray:
    """Return class probabilities after exactly the same evaluation preprocessing."""
    if batch_size < 1:
        raise ValueError("batch_size must be at least 1.")
    images = np.asarray(images)
    if len(images) == 0:
        return np.empty((0, 0), dtype=np.float32)
    device = torch.device(getattr(config, "device", "cpu"))
    image_size = int(getattr(config, "img_size", 224))
    probabilities = []
    model.eval()
    with torch.inference_mode():
        for start in range(0, len(images), batch_size):
            inputs = preprocess_batch(images[start : start + batch_size], image_size).to(device)
            probabilities.append(torch.softmax(model(inputs), dim=1).cpu().numpy())
    return np.concatenate(probabilities, axis=0)


def _predict_with_model(model, batch, config, class_names=None):
    """Backward-compatible LIME classifier callback."""
    return predict_probabilities(model, np.asarray(batch), config)


def _lime_visualization(image: np.ndarray, segments: np.ndarray, local_exp: Sequence[tuple[int, float]]) -> tuple[np.ndarray, np.ndarray]:
    """Render only superpixels that positively support the predicted class."""
    weights = dict(local_exp)
    positive_weights = np.zeros(segments.shape, dtype=np.float32)
    for segment_id, weight in weights.items():
        if weight > 0:
            positive_weights[segments == segment_id] = weight
    mask = (positive_weights > 0).astype(np.int8)
    if not mask.any():
        return image.copy(), mask

    strength = _normalize(positive_weights)
    heatmap = cv2.cvtColor(cv2.applyColorMap(np.uint8(255 * strength), cv2.COLORMAP_JET), cv2.COLOR_BGR2RGB)
    visualization = image.copy()
    selected = mask.astype(bool)
    visualization[selected] = cv2.addWeighted(image, 0.45, heatmap, 0.55, 0)[selected]
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(visualization, contours, -1, (255, 255, 255), 1)
    return visualization, mask


def generate_lime_explanation(
    model: torch.nn.Module,
    image: np.ndarray,
    config: object,
    class_names: Sequence[str] | None = None,
    target_class: Optional[int] = None,
    output_path: Optional[Path] = None,
    num_samples: int = 800,
    num_features: int = 12,
    batch_size: int = 32,
    random_state: int = 42,
) -> tuple[np.ndarray, np.ndarray]:
    """Create a deterministic, positive-evidence LIME map for one target class."""
    if lime_image is None or slic is None:
        raise ImportError("LIME explanations require `lime` and `scikit-image`. Install them with pip.")
    if num_samples < 50:
        raise ValueError("num_samples must be at least 50 for a stable LIME explanation.")
    if num_features < 1:
        raise ValueError("num_features must be at least 1.")

    image = np.asarray(image, dtype=np.uint8)
    if image.ndim != 3 or image.shape[-1] != 3:
        raise ValueError("LIME expects one RGB image with shape [H, W, 3].")
    probabilities = predict_probabilities(model, image[None, ...], config, batch_size=1)
    predicted_class = int(probabilities[0].argmax())
    label = predicted_class if target_class is None else int(target_class)
    if not 0 <= label < probabilities.shape[1]:
        raise ValueError(f"target_class must be in [0, {probabilities.shape[1] - 1}], got {label}.")

    segments = slic(image, n_segments=60, compactness=8.0, sigma=1.0, start_label=0)
    explainer = lime_image.LimeImageExplainer(random_state=random_state)
    explanation = explainer.explain_instance(
        image,
        classifier_fn=lambda batch: predict_probabilities(model, batch, config, batch_size),
        labels=(label,),
        num_samples=num_samples,
        num_features=num_features,
        hide_color=None,
        segmentation_fn=lambda _: segments,
    )
    visualization, mask = _lime_visualization(image, segments, explanation.local_exp[label])
    if output_path is not None:
        output_path = Path(output_path)
        ensure_dir(output_path.parent)
        cv2.imwrite(str(output_path), cv2.cvtColor(visualization, cv2.COLOR_RGB2BGR))
    return visualization, mask


def explain_samples(model: torch.nn.Module, config: object, class_names: Sequence[str], num_samples: int = 8) -> list[dict]:
    """Create prediction-aligned Grad-CAM and LIME outputs for test images."""
    model.eval()
    model.to(getattr(config, "device", "cpu"))
    image_paths = list(_select_test_images(Path(config.data_dir) / "test", class_names, num_samples))
    output_dir = Path(config.explain_dir) / config.model_name
    ensure_dir(output_dir)
    target_layer = get_explain_target_layer(config.model_name, model)
    target_layout = get_explain_target_layout(config.model_name)
    results = []

    with GradCAM(model, target_layer, target_layout) as cam_generator:
        for image_path, true_label in image_paths:
            original = opencv_loader(str(image_path))
            inputs = preprocess_image(original, config.img_size).to(config.device)
            prediction = predict_image(model, inputs)
            stem = f"{image_path.stem}_true_{class_names[true_label]}_pred_{class_names[prediction.class_idx]}"
            gradcam_path = output_dir / f"{stem}_gradcam.png"
            cv2.imwrite(str(gradcam_path), cv2.cvtColor(overlay_heatmap(original, cam_generator(inputs, prediction.class_idx)), cv2.COLOR_RGB2BGR))

            lime_path = output_dir / f"{stem}_lime.png"
            lime_error = None
            try:
                generate_lime_explanation(model, original, config, target_class=prediction.class_idx, output_path=lime_path)
            except (ImportError, RuntimeError, ValueError) as exc:
                lime_error = str(exc)
            results.append({
                "path": str(image_path), "true": class_names[true_label], "pred": class_names[prediction.class_idx],
                "confidence": prediction.confidence, "gradcam": str(gradcam_path),
                "lime": str(lime_path) if lime_path.exists() else None, "lime_error": lime_error,
            })
    return results


def _select_test_images(data_root: Path, class_names: Sequence[str], num_samples: int) -> Iterable[tuple[Path, int]]:
    if num_samples < 1:
        return []
    selected = []
    per_class = max(1, int(np.ceil(num_samples / max(1, len(class_names)))))
    extensions = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}
    for class_idx, class_name in enumerate(class_names):
        files = sorted(path for path in (data_root / class_name).glob("*") if path.suffix.lower() in extensions)
        selected.extend((path, class_idx) for path in files[:per_class])
    return selected[:num_samples]
