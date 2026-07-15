import importlib.util
import zipfile
from pathlib import Path


def download_kaggle_dataset(dataset_slug: str, destination: Path) -> Path:
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)

    kagglehub_spec = importlib.util.find_spec("kagglehub")
    kaggle_spec = importlib.util.find_spec("kaggle")

    if kagglehub_spec is not None:
        import kagglehub

        zip_path = Path(kagglehub.dataset_download(dataset_slug))
        if not zip_path.exists():
            raise RuntimeError(f"KaggleHub failed to download dataset: {dataset_slug}")
        if zip_path.is_dir():
            return zip_path
        if zipfile.is_zipfile(zip_path):
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(destination)
            return destination
        raise RuntimeError(f"Downloaded dataset path is not a zip archive: {zip_path}")

    if kaggle_spec is not None:
        from kaggle.api.kaggle_api_extended import KaggleApi

        api = KaggleApi()
        api.authenticate()
        api.dataset_download_files(dataset_slug, path=str(destination), unzip=True)
        return destination

    raise ImportError(
        "Neither kagglehub nor kaggle is installed. Install one of them to download datasets programmatically."
    )
