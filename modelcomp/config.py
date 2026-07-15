from dataclasses import dataclass
from pathlib import Path
import torch


MODEL_PRESETS = {
    "efficientnetv2_s": {
        "display_name": "EfficientNetV2-S",
        "family": "cnn",
        "batch_size": 32,
        "epochs": 15,
        "lr": 2e-4,
        "weight_decay": 1e-4,
        "img_size": 224,
        "augment_prob": 0.55,
        "use_amp": True,
    },
    "convnext_tiny": {
        "display_name": "ConvNeXt Tiny",
        "family": "cnn",
        "batch_size": 24,
        "epochs": 15,
        "lr": 3e-4,
        "weight_decay": 4e-5,
        "img_size": 224,
        "augment_prob": 0.6,
        "use_amp": True,
    },
    "swin_tiny_patch4_window7_224": {
        "display_name": "Swin Transformer Tiny",
        "family": "transformer",
        "batch_size": 16,
        "epochs": 20,
        "lr": 5e-5,
        "weight_decay": 0.05,
        "img_size": 224,
        "augment_prob": 0.45,
        "use_amp": True,
    },
}


@dataclass
class ExperimentConfig:
    data_dir: Path = Path("./data")
    model_name: str = "efficientnetv2_s"
    num_classes: int = 4
    img_size: int = 224
    batch_size: int = 32
    epochs: int = 15
    lr: float = 2e-4
    weight_decay: float = 1e-4
    patience: int = 5
    seed: int = 42
    num_workers: int = 4
    output_dir: Path = Path("outputs")
    checkpoint_dir: Path = output_dir / "checkpoints"
    reports_dir: Path = output_dir / "reports"
    explain_dir: Path = output_dir / "explanations"
    augment_prob: float = 0.5
    device: str = "cuda" if torch.cuda.is_available() else "cpu"
    use_amp: bool = True
    display_name: str = ""
    model_family: str = ""
    max_grad_norm: float = 1.0

    def apply_model_preset(self):
        preset = MODEL_PRESETS.get(self.model_name, MODEL_PRESETS["efficientnetv2_s"])
        self.display_name = preset.get("display_name", self.model_name)
        self.model_family = preset.get("family", "cnn")
        self.batch_size = preset.get("batch_size", self.batch_size)
        self.epochs = preset.get("epochs", self.epochs)
        self.lr = preset.get("lr", self.lr)
        self.weight_decay = preset.get("weight_decay", self.weight_decay)
        self.img_size = preset.get("img_size", self.img_size)
        self.augment_prob = preset.get("augment_prob", self.augment_prob)
        self.use_amp = preset.get("use_amp", self.use_amp)

    def ensure_paths(self):
        self.apply_model_preset()
        self.output_dir = Path(self.output_dir)
        self.checkpoint_dir = self.output_dir / "checkpoints"
        self.reports_dir = self.output_dir / "reports"
        self.explain_dir = self.output_dir / "explanations"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self.reports_dir.mkdir(parents=True, exist_ok=True)
        self.explain_dir.mkdir(parents=True, exist_ok=True)
