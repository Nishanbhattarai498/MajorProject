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
    target_layers = {
        "efficientnetv2_s": "conv_head",
        "convnext_tiny": "stages.3",
        "swin_tiny_patch4_window7_224": "layers.3",
    }
    if model_name not in target_layers:
        raise ValueError(f"No explainability target layer configured for {model_name}")
    named_modules = dict(model.named_modules())
    return named_modules[target_layers[model_name]]
