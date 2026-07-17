import timm


def create_model(model_name: str, num_classes: int, pretrained: bool = True):
    try:
        model = timm.create_model(model_name, pretrained=pretrained, num_classes=num_classes)
        return model
    except Exception as e:
        if pretrained:
            try:
                model = timm.create_model(model_name, pretrained='imagenet', num_classes=num_classes)
                return model
            except Exception:
                print(
                    f"Warning: pretrained weights unavailable for {model_name}. Training from random init. Error: {e}"
                )
        return timm.create_model(model_name, pretrained=False, num_classes=num_classes)


def get_explain_target_layer(model_name: str, model):
    """Return the last spatial feature layer suitable for Grad-CAM.

    Swin stages use BHWC tensors. Targeting the final block normalization keeps
    the 7x7 token grid intact, unlike the whole stage output in older timm
    versions where the result can be flattened or post-processed.
    """
    target_layers = {
        "efficientnetv2_s": "conv_head",
        "convnext_tiny": "stages.3",
        "swin_tiny_patch4_window7_224": "layers.3.blocks.1.norm1",
    }
    if model_name not in target_layers:
        raise ValueError(f"No explainability target layer configured for {model_name}")
    named_modules = dict(model.named_modules())
    target_name = target_layers[model_name]
    if target_name not in named_modules:
        raise ValueError(f"Target layer {target_name!r} was not found in {model_name}.")
    return named_modules[target_name]


def get_explain_target_layout(model_name: str) -> str:
    """Return the exact target-layer tensor layout used by each supported model."""
    layouts = {
        "efficientnetv2_s": "bchw",
        "convnext_tiny": "bchw",
        "swin_tiny_patch4_window7_224": "bhwc",
    }
    if model_name not in layouts:
        raise ValueError(f"No Grad-CAM feature layout configured for {model_name}")
    return layouts[model_name]
