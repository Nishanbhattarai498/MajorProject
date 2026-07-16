import numpy as np
import torch
from types import SimpleNamespace

from modelcomp.explain import GradCAM, _as_feature_map, _predict_with_model, preprocess_image


class DummyModel(torch.nn.Module):
    def forward(self, x):
        assert x.shape[-2:] == (16, 16)
        return torch.zeros(x.shape[0], 2, dtype=torch.float32)


def test_preprocess_image_returns_float32_tensor():
    image = np.zeros((16, 16, 3), dtype=np.uint8)

    tensor = preprocess_image(image, 16)

    assert tensor.dtype == torch.float32
    assert tensor.shape == (1, 3, 16, 16)


def test_predict_with_model_resizes_images_to_config_size():
    model = DummyModel()
    config = SimpleNamespace(device='cpu', img_size=16)
    batch = [np.zeros((32, 32, 3), dtype=np.uint8)]

    probs = _predict_with_model(model, batch, config, ['a', 'b'])

    assert probs.shape == (1, 2)


def test_as_feature_map_converts_swin_bhwc_features_to_bchw():
    features = torch.zeros(1, 2, 2, 8)

    converted = _as_feature_map(features)

    assert converted.shape == (1, 8, 2, 2)


class SwinLikeModel(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.features = torch.nn.Conv2d(3, 4, kernel_size=1)
        self.target = torch.nn.Identity()
        self.classifier = torch.nn.Linear(4, 2)

    def forward(self, x):
        features = self.features(x).permute(0, 2, 3, 1)
        features = self.target(features)
        return self.classifier(features.mean(dim=(1, 2)))


def test_gradcam_supports_swin_bhwc_activations():
    model = SwinLikeModel().eval()
    inputs = torch.ones(1, 3, 4, 4)

    with GradCAM(model, model.target) as generator:
        cam = generator(inputs, class_idx=0)

    assert cam.shape == (4, 4)
    assert np.all((cam >= 0) & (cam <= 1))
