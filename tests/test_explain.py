import numpy as np
import torch

from modelcomp.explain import preprocess_image


def test_preprocess_image_returns_float32_tensor():
    image = np.zeros((16, 16, 3), dtype=np.uint8)

    tensor = preprocess_image(image, 16)

    assert tensor.dtype == torch.float32
    assert tensor.shape == (1, 3, 16, 16)
