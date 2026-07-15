import cv2
import numpy as np
import torch
from pathlib import Path
from modelcomp.data import opencv_loader
from modelcomp.models import get_explain_target_layer
from modelcomp.utils import ensure_dir

try:
    from lime import lime_image
except Exception:  # pragma: no cover - optional dependency
    lime_image = None


class GradCAM:
    def __init__(self, model: torch.nn.Module, target_layer: torch.nn.Module):
        self.model = model
        self.target_layer = target_layer
        self.activations = None
        self.gradients = None
        self.hook_handles = []
        self._register_hooks()

    def _register_hooks(self):
        def forward_hook(module, input, output):
            self.activations = output.detach()

        def backward_hook(module, grad_in, grad_out):
            self.gradients = grad_out[0].detach()

        self.hook_handles.append(self.target_layer.register_forward_hook(forward_hook))
        self.hook_handles.append(self.target_layer.register_full_backward_hook(backward_hook))

    def remove_hooks(self):
        for handle in self.hook_handles:
            handle.remove()
        self.hook_handles = []

    def __call__(self, input_tensor: torch.Tensor, class_idx: int = None):
        self.model.zero_grad()
        input_tensor.requires_grad_()
        output = self.model(input_tensor)
        if class_idx is None:
            class_idx = output.argmax(dim=1).item()
        loss = output[0, class_idx]
        loss.backward(retain_graph=True)

        weights = self.gradients.mean(dim=(2, 3), keepdim=True)
        cam = (weights * self.activations).sum(dim=1, keepdim=True)
        cam = torch.relu(cam)
        cam = cam.squeeze(0).squeeze(0).cpu().numpy()
        cam = self._normalize(cam)
        return cam

    @staticmethod
    def _normalize(array):
        array -= array.min()
        if array.max() != 0:
            array /= array.max()
        return array


def preprocess_image(image: np.ndarray, image_size: int):
    image = cv2.resize(image, (image_size, image_size), interpolation=cv2.INTER_LINEAR)
    image = image.astype(np.float32) / 255.0
    image = (image - np.array([0.485, 0.456, 0.406])) / np.array([0.229, 0.224, 0.225])
    image = image[:, :, ::-1].copy() if image.shape[2] == 3 else np.stack([image] * 3, axis=-1)
    tensor = torch.from_numpy(image.transpose(2, 0, 1)).unsqueeze(0)
    return tensor


def overlay_heatmap(original: np.ndarray, cam: np.ndarray, alpha: float = 0.5):
    heatmap = cv2.applyColorMap(np.uint8(255 * cam), cv2.COLORMAP_JET)
    heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
    overlay = heatmap.astype(np.float32) * alpha + original.astype(np.float32) * (1 - alpha)
    overlay = np.clip(overlay, 0, 255).astype(np.uint8)
    return overlay


def generate_lime_explanation(model, image, config, class_names, target_class=None, output_path=None):
    if lime_image is None:
        return None

    model.eval()
    image = image.astype(np.uint8)
    explainer = lime_image.LimeImageExplainer(random_state=42)
    explanation = explainer.explain_instance(
        image,
        lambda x: _predict_with_model(model, x, config, class_names),
        labels=[target_class] if target_class is not None else None,
        num_samples=30,
        hide_color=0,
    )
    temp, mask = explanation.get_image_and_mask(
        explanation.top_labels[0],
        positive_only=False,
        num_features=10,
        hide_rest=False,
    )

    if output_path is not None:
        ensure_dir(output_path.parent)
        cv2.imwrite(str(output_path), cv2.cvtColor(np.uint8(255 * temp), cv2.COLOR_RGB2BGR))
    return temp, mask


def _predict_with_model(model, batch, config, class_names):
    model.eval()
    preds = []
    with torch.no_grad():
        for image in batch:
            tensor = torch.from_numpy(np.transpose(image, (2, 0, 1))).float().unsqueeze(0).to(config.device)
            tensor = tensor / 255.0
            tensor = (tensor - torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1).to(config.device)) / torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1).to(config.device)
            logits = model(tensor)
            probs = torch.softmax(logits, dim=1).cpu().numpy()
            preds.append(probs)
    return np.concatenate(preds, axis=0)


def explain_samples(model, config, class_names, num_samples: int = 8):
    model.eval()
    model = model.to(config.device)
    data_root = Path(config.data_dir) / "test"
    dataset = []
    for class_idx, class_name in enumerate(class_names):
        class_dir = data_root / class_name
        if not class_dir.exists():
            continue
        files = list(class_dir.glob("*.*"))[: num_samples // len(class_names) + 1]
        for f in files:
            dataset.append((f, class_idx))

    target_layer = get_explain_target_layer(config.model_name, model)
    cam_generator = GradCAM(model, target_layer)
    output_dir = Path(config.explain_dir) / config.model_name
    ensure_dir(output_dir)

    results = []
    for image_path, true_label in dataset[:num_samples]:
        original = opencv_loader(str(image_path))
        input_tensor = preprocess_image(original, config.img_size).to(config.device)
        logits = model(input_tensor)
        pred_label = logits.argmax(dim=1).item()
        cam = cam_generator(input_tensor, class_idx=pred_label)
        cam_resized = cv2.resize(cam, (original.shape[1], original.shape[0]))
        overlay = overlay_heatmap(original, cam_resized)

        gradcam_filename = f"{image_path.stem}_true_{class_names[true_label]}_pred_{class_names[pred_label]}_gradcam.png"
        cv2.imwrite(str(output_dir / gradcam_filename), cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))

        lime_path = output_dir / f"{image_path.stem}_true_{class_names[true_label]}_pred_{class_names[pred_label]}_lime.png"
        try:
            generate_lime_explanation(model, original, config, class_names, target_class=pred_label, output_path=lime_path)
        except Exception:
            pass

        results.append({
            "path": str(image_path),
            "true": class_names[true_label],
            "pred": class_names[pred_label],
            "gradcam": str(output_dir / gradcam_filename),
            "lime": str(lime_path) if lime_path.exists() else None,
        })

    cam_generator.remove_hooks()
    return results
