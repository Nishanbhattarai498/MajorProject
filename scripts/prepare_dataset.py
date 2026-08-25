import argparse
import shutil
from pathlib import Path
from typing import List, Optional

from sklearn.model_selection import train_test_split
from modelcomp.kaggle_utils import download_kaggle_dataset

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}


def is_image_file(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS


def find_class_root(directory: Path) -> Path:
    children = [c for c in directory.iterdir() if c.is_dir()]
    if any(c.name.lower() in {"train", "val", "test"} for c in children):
        return directory
    if len(children) == 1 and any(grandchild.is_dir() for grandchild in children[0].iterdir()):
        return children[0]
    return directory


def gather_class_dirs(root: Path) -> List[Path]:
    return [d for d in root.iterdir() if d.is_dir() and any(is_image_file(p) for p in d.rglob("*"))]


def create_split(dest_root: Path, split_name: str, class_name: str, files: List[Path]):
    target_dir = dest_root / split_name / class_name
    target_dir.mkdir(parents=True, exist_ok=True)
    for file_path in files:
        shutil.copy2(file_path, target_dir / file_path.name)


def split_dataset(source_root: Path, dest_root: Path, val_ratio: float, test_ratio: float, seed: int):
    source_root = find_class_root(source_root)
    class_dirs = gather_class_dirs(source_root)
    if not class_dirs:
        raise ValueError(f"No class subfolders with images found inside {source_root}")

    for class_dir in class_dirs:
        image_files = [p for p in class_dir.iterdir() if is_image_file(p)]
        if len(image_files) < 3:
            raise ValueError(f"Class directory {class_dir} has too few images to split reliably.")

        train_files, temp_files = train_test_split(
            image_files,
            test_size=val_ratio + test_ratio,
            random_state=seed,
        )
        val_files, test_files = train_test_split(
            temp_files,
            test_size=test_ratio / (val_ratio + test_ratio),
            random_state=seed,
        )
        create_split(dest_root, "train", class_dir.name, train_files)
        create_split(dest_root, "val", class_dir.name, val_files)
        create_split(dest_root, "test", class_dir.name, test_files)


def copy_dataset_structure(source_root: Path, dest_root: Path):
    source_root = find_class_root(source_root)
    class_dirs = gather_class_dirs(source_root)
    if not class_dirs:
        raise ValueError(f"No class subfolders with images found inside {source_root}")

    copied = False
    for split in ["train", "val", "test"]:
        source_split_dir = source_root / split
        if source_split_dir.exists():
            for class_dir in gather_class_dirs(source_split_dir):
                dest_split_dir = dest_root / split / class_dir.name
                shutil.copytree(class_dir, dest_split_dir, dirs_exist_ok=True)
            copied = True
    if not copied:
        raise ValueError(f"Dataset does not contain train/val/test subfolders under {source_root}")


def has_kagglehub_structure(source_root: Path) -> bool:
    source_root = find_class_root(source_root)
    return any((source_root / subdir).exists() for subdir in ["Training", "training", "Testing", "testing", "Validation", "validation"])


def copy_split_directory(source_root: Path, split_name: str, dest_root: Path, dest_split_name: str):
    source_split_dir = source_root / split_name
    if not source_split_dir.exists():
        return
    for class_dir in [d for d in source_split_dir.iterdir() if d.is_dir()]:
        dest_split_dir = dest_root / dest_split_name / class_dir.name
        shutil.copytree(class_dir, dest_split_dir, dirs_exist_ok=True)


def split_existing_train_for_validation(train_root: Path, val_root: Path, val_ratio: float, seed: int):
    val_root.mkdir(parents=True, exist_ok=True)
    for class_dir in [d for d in train_root.iterdir() if d.is_dir()]:
        image_files = [p for p in class_dir.iterdir() if is_image_file(p)]
        if not image_files:
            continue
        _, val_files = train_test_split(image_files, test_size=val_ratio, random_state=seed)
        val_class_dir = val_root / class_dir.name
        val_class_dir.mkdir(parents=True, exist_ok=True)
        for file_path in val_files:
            shutil.move(str(file_path), str(val_class_dir / file_path.name))


def prepare_kagglehub_dataset(source_root: Path, dest_root: Path, val_ratio: float, seed: int):
    source_root = find_class_root(source_root)
    dest_root.mkdir(parents=True, exist_ok=True)

    copy_split_directory(source_root, "Training", dest_root, "train")
    copy_split_directory(source_root, "training", dest_root, "train")
    copy_split_directory(source_root, "Testing", dest_root, "test")
    copy_split_directory(source_root, "testing", dest_root, "test")
    copy_split_directory(source_root, "Validation", dest_root, "val")
    copy_split_directory(source_root, "validation", dest_root, "val")

    train_root = dest_root / "train"
    val_root = dest_root / "val"
    if not val_root.exists() and train_root.exists():
        split_existing_train_for_validation(train_root, val_root, val_ratio, seed)

    return dest_root


def prepare_data(
    source_root: Path,
    dest_root: Path,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42,
    kaggle_slug: Optional[str] = None,
):
    if kaggle_slug:
        source_root = download_kaggle_dataset(kaggle_slug, dest_root / "raw")

    if (source_root / "train").exists() and (source_root / "val").exists() and (source_root / "test").exists():
        copy_dataset_structure(source_root, dest_root)
    elif has_kagglehub_structure(source_root):
        prepare_kagglehub_dataset(source_root, dest_root, val_ratio, seed)
    else:
        split_dataset(source_root, dest_root, val_ratio, test_ratio, seed)

    return dest_root


def parse_args():
    parser = argparse.ArgumentParser(description="Prepare the MRI dataset for training.")
    parser.add_argument("--output-dir", type=Path, default=Path("data"), help="Destination root for prepared dataset.")
    parser.add_argument("--source-dir", type=Path, default=None, help="Existing source dataset root to prepare.")
    parser.add_argument("--kaggle-slug", type=str, default=None, help="Kaggle dataset slug to download and prepare.")
    parser.add_argument("--val-ratio", type=float, default=0.15)
    parser.add_argument("--test-ratio", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def main():
    args = parse_args()
    if args.kaggle_slug is None and args.source_dir is None:
        raise ValueError("Either --kaggle-slug or --source-dir must be provided.")

    source_root = args.source_dir if args.source_dir is not None else args.output_dir / "raw"
    prepared_root = prepare_data(
        source_root=source_root,
        dest_root=args.output_dir,
        val_ratio=args.val_ratio,
        test_ratio=args.test_ratio,
        seed=args.seed,
        kaggle_slug=args.kaggle_slug,
    )
    print(f"Prepared dataset at {prepared_root}")


if __name__ == "__main__":
    main()
