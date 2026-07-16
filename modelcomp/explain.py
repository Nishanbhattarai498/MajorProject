"""Grad-CAM and LIME utilities for CNN and transformer image classifiers."""

from __future__ import annotations

from contextlib import AbstractContextManager
from pathlib import Path
from typing import Callable, Iterable, Optional, Sequence

import cv2
import numpy as np
import torch

from modelcomp.data import opencv_loader
from modelcomp.models import get_explain_target_layer
from modelcomp.utils import ensure_dir

try:
    from lime import lime_image
    from skimage.segmentation import mark_boundaries
except ImportError:  # pragma: no cover - optional dependency
    lime_image = None
    mark_boundaries = None


IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


class GradCAM(AbstractContextManager):
    """Generate Grad-CAM maps from CNN feature maps or Swin token features."""

    def __init__(self, model: torch.nn.Module, target_layer: torch.nn.Module):
        self.model = model
        self.target_layer = target_layer
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
            raise ValueError("GradCAM expects one image with shape [1, C, H, W].")

        self.activations = None
        self.gradients = None
        self.model.zero_grad(set_to_none=True)
        logits = self.model(input_tensor)
        if class_idx is None:
            class_idx = int(logits.argmax(dim=1).item())
        if not 0 <= class_idx < logits.shape[1]:
            raise ValueError(f"class_idx must be in [0, {logits.shape[1] - 1}], got {class_idx}.")
        logits[0, class_idx].backward()

        if self.activations is None or self.gradients is None:
            raise RuntimeError("Grad-CAM hooks did not receive activations and gradients.")

        activations = _as_feature_map(self.activations)
        gradients = _as_feature_map(self.gradients)
        if activations.shape != gradients.shape:
            raise RuntimeError("Grad-CAM activation and gradient shapes do not match.")

        weights = gradients.mean(dim=(2, 3), keepdim=True)
        cam = torch.relu((weights * activations).sum(dim=1, keepdim=True))
        cam = torch.nn.functional.interpolate(
            cam,
            size=input_tensor.shape[-2:],
            mode="bilinear",
            align_corners=False,
        )
        return _normalize(cam[0, 0].detach().cpu().numpy())


def _as_feature_map(features: torch.Tensor) -> torch.Tensor:
    """Convert BCHW, BHWC, or BNC features into BCHW for Grad-CAM.

    Timm's Swin stages produce BHWC tensors; some transformer implementations
    expose BNC tokens. Both layouts retain a square spatial grid at this point.
    """
    if features.ndim == 4:
        batch, first, second, last = features.shape
        if first == second and last >= first:
            return features.permute(0, 3, 1, 2)
        return features
    if features.ndim == 3:
        batch, tokens, channels = features.shape
        side = int(np.sqrt(tokens))
        if side * side != tokens:
            side = int(np.sqrt(tokens - 1))
            if side * side != tokens - 1:
                raise ValueError(f"Cannot reshape {tokens} transformer tokens into a spatial grid.")
            features = features[:, 1:, :]
        return features.transpose(1, 2).reshape(batch, channels, side, side)
    raise ValueError(f"Unsupported Grad-CAM activation shape: {tuple(features.shape)}")


def _normalize(array: np.ndarray) -> np.ndarray:
    array = array.astype(np.float32, copy=False)
    minimum, maximum = float(array.min()), float(array.max())
    if maximum <= minimum:
        return np.zeros_like(array, dtype=np.float32)
    return (array - minimum) / (maximum - minimum)


def preprocess_image(image: np.ndarray, image_size: int) -> torch.Tensor:
    """Resize an RGB image and apply the ImageNet normalization used in training."""
    return preprocess_batch(np.asarray(image)[None, ...], image_size)


def preprocess_batch(images: np.ndarray, image_size: int) -> torch.Tensor:
    """Convert RGB uint8/float images in NHWC layout to normalized NCHW tensors."""
    images = np.asarray(images)
    if images.ndim != 4 or images.shape[-1] not in (1, 3):
        raise ValueError("Expected images with shape [N, H, W, 1|3].")

    processed = []
    for image in images:
        if image.shape[-1] == 1:
            image = np.repeat(image, 3, axis=-1)
        resized = cv2.resize(image, (image_size, image_size), interpolation=cv2.INTER_LINEAR)
        processed.append(resized)
    batch = np.stack(processed).astype(np.float32)
    if batch.max() > 1.0:
        batch /= 255.0
    mean = np.asarray(IMAGENET_MEAN, dtype=np.float32)[None, None, None, :]
    std = np.asarray(IMAGENET_STD, dtype=np.float32)[None, None, None, :]
    batch = (batch - mean) / std
    return torch.from_numpy(batch.transpose(0, 3, 1, 2).copy())


def overlay_heatmap(original: np.ndarray, cam: np.ndarray, alpha: float = 0.5) -> np.ndarray:
    """Overlay a normalized CAM map on an RGB image."""
    if not 0.0 <= alpha <= 1.0:
        raise ValueError("alpha must be between 0 and 1.")
    cam = cv2.resize(_normalize(cam), (original.shape[1], original.shape[0]))
    heatmap = cv2.applyColorMap(np.uint8(255 * cam), cv2.COLORMAP_JET)
    heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
    return cv2.addWeighted(heatmap, alpha, original.astype(np.uint8), 1 - alpha, 0)


def predict_probabilities(
    model: torch.nn.Module,
    images: np.ndarray,
    config: object,
    batch_size: int = 32,
) -> np.ndarray:
    """Return model probabilities for an RGB NHWC batch with efficient batching."""
    if batch_size < 1:
        raise ValueError("batch_size must be at least 1.")
    device = torch.device(getattr(config, "device", "cpu"))
    image_size = int(getattr(config, "img_size", 224))
    images = np.asarray(images)
    outputs = []
    model.eval()
    with torch.inference_mode():
        for start in range(0, len(images), batch_size):
            inputs = preprocess_batch(images[start : start + batch_size], image_size).to(device)
            outputs.append(torch.softmax(model(inputs), dim=1).cpu().numpy())
    return np.concatenate(outputs, axis=0)


def _predict_with_model(model, batch, config, class_names=None):
    """Backward-compatible LIME prediction callback."""
    return predict_probabilities(model, np.asarray(batch), config)


def generate_lime_explanation(
    model: torch.nn.Module,
    image: np.ndarray,
    config: object,
    class_names: Sequence[str] | None = None,
    target_class: Optional[int] = None,
    output_path: Optional[Path] = None,
    num_samples: int = 300,
    num_features: int = 10,
    batch_size: int = 32,
    random_state: int = 42,
) -> tuple[np.ndarray, np.ndarray]:
    """Generate a LIME boundary visualization for one RGB image."""
    if lime_image is None or mark_boundaries is None:
        raise ImportError("LIME explanations require `lime` and `scikit-image`. Install them with pip.")
    if num_samples < 2:
        raise ValueError("num_samples must be at least 2.")

    image = np.asarray(image, dtype=np.uint8)
    explainer = lime_image.LimeImageExplainer(random_state=random_state)
    explanation = explainer.explain_instance(
        image,
        classifier_fn=lambda batch: predict_probabilities(model, batch, config, batch_size),
        labels=[target_class] if target_class is not None else None,
        num_samples=num_samples,
        hide_color=0,
    )
    label = target_class if target_class is not None else explanation.top_labels[0]
    _, mask = explanation.get_image_and_mask(
        label,
        positive_only=False,
        num_features=num_features,
        hide_rest=False,
    )
    visualization = np.uint8(mark_boundaries(image / 255.0, mask) * 255)
    if output_path is not None:
        output_path = Path(output_path)
        ensure_dir(output_path.parent)
        cv2.imwrite(str(output_path), cv2.cvtColor(visualization, cv2.COLOR_RGB2BGR))
    return visualization, mask


def explain_samples(model: torch.nn.Module, config: object, class_names: Sequence[str], num_samples: int = 8) -> list[dict]:
    """Create Grad-CAM and LIME outputs for a deterministic, class-balanced test subset."""
    model.eval()
    model.to(getattr(config, "device", "cpu"))
    image_paths = list(_select_test_images(Path(config.data_dir) / "test", class_names, num_samples))
    output_dir = Path(config.explain_dir) / config.model_name
    ensure_dir(output_dir)
    target_layer = get_explain_target_layer(config.model_name, model)
    results = []

    with GradCAM(model, target_layer) as cam_generator:
        for image_path, true_label in image_paths:
            original = opencv_loader(str(image_path))
            inputs = preprocess_image(original, config.img_size).to(config.device)
            with torch.inference_mode():
                prediction = int(model(inputs).argmax(dim=1).item())
            stem = f"{image_path.stem}_true_{class_names[true_label]}_pred_{class_names[prediction]}"
            gradcam_path = output_dir / f"{stem}_gradcam.png"
            cam = cam_generator(inputs, class_idx=prediction)
            overlay = overlay_heatmap(original, cam)
            cv2.imwrite(str(gradcam_path), cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))

            lime_path = output_dir / f"{stem}_lime.png"
            lime_error = None
            try:
                generate_lime_explanation(model, original, config, class_names, prediction, lime_path)
            except (ImportError, RuntimeError, ValueError) as exc:
                lime_error = str(exc)

            results.append({
                "path": str(image_path), "true": class_names[true_label], "pred": class_names[prediction],
                "gradcam": str(gradcam_path), "lime": str(lime_path) if lime_path.exists() else None,
                "lime_error": lime_error,
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
