import cv2
import numpy as np
import albumentations as A
from albumentations.pytorch import ToTensorV2
from pathlib import Path
from torch.utils.data import Dataset, DataLoader
from torchvision.datasets import ImageFolder


def opencv_loader(path: str):
    image = cv2.imread(str(path))
    if image is None:
        raise RuntimeError(f"Unable to read image: {path}")
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    return image


class AlbumentationsImageFolder(Dataset):
    def __init__(self, root: Path, transform=None):
        self.dataset = ImageFolder(root, loader=opencv_loader)
        self.transform = transform

    def __len__(self):
        return len(self.dataset)

    def __getitem__(self, index):
        image, label = self.dataset[index]
        if self.transform:
            augmented = self.transform(image=image)
            image = augmented["image"]
        return image, label


def build_transforms(image_size: int, augment_prob: float = 0.5, model_name: str = ""):
    augment_prob = max(0.0, min(1.0, augment_prob))
    flip_p = 0.5 if augment_prob >= 0.5 else 0.3
    affine_p = 0.6 if augment_prob >= 0.5 else 0.4
    brightness_p = 0.6 if augment_prob >= 0.5 else 0.4
    dropout_p = 0.35 if augment_prob >= 0.5 else 0.2

    train_transform = A.Compose(
        [
            A.Resize(height=image_size, width=image_size),
            A.OneOf(
                [
                    A.HorizontalFlip(p=0.5),
                    A.VerticalFlip(p=0.5),
                ],
                p=flip_p,
            ),
            A.Affine(translate_percent=0.08, scale=(0.92, 1.08), rotate=(-20, 20), p=affine_p),
            A.RandomBrightnessContrast(brightness_limit=0.18, contrast_limit=0.18, p=brightness_p),
            A.CoarseDropout(max_holes=1, max_height=int(image_size * 0.1), max_width=int(image_size * 0.1), p=dropout_p),
            A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
            ToTensorV2(),
        ]
    )

    eval_transform = A.Compose(
        [
            A.Resize(height=image_size, width=image_size),
            A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
            ToTensorV2(),
        ]
    )

    return train_transform, eval_transform


def get_dataloaders(config):
    train_dir = Path(config.data_dir) / "train"
    val_dir = Path(config.data_dir) / "val"
    test_dir = Path(config.data_dir) / "test"

    if not train_dir.exists() or not val_dir.exists() or not test_dir.exists():
        raise FileNotFoundError(
            f"Expected train/val/test directories inside {config.data_dir}, but one or more are missing."
        )

    train_transform, eval_transform = build_transforms(
        config.img_size,
        augment_prob=config.augment_prob,
        model_name=config.model_name,
    )
    train_dataset = AlbumentationsImageFolder(train_dir, transform=train_transform)
    val_dataset = AlbumentationsImageFolder(val_dir, transform=eval_transform)
    test_dataset = AlbumentationsImageFolder(test_dir, transform=eval_transform)

    train_loader = DataLoader(
        train_dataset,
        batch_size=config.batch_size,
        shuffle=True,
        num_workers=config.num_workers,
        pin_memory=True,
        drop_last=False,
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=config.batch_size,
        shuffle=False,
        num_workers=config.num_workers,
        pin_memory=True,
    )
    test_loader = DataLoader(
        test_dataset,
        batch_size=config.batch_size,
        shuffle=False,
        num_workers=config.num_workers,
        pin_memory=True,
    )

    class_names = train_dataset.dataset.classes
    return train_loader, val_loader, test_loader, class_names
