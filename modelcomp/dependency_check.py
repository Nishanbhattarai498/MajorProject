import importlib
import sys

REQUIRED_PACKAGES = [
    "torch",
    "torchvision",
    "timm",
    "albumentations",
    "cv2",
    "sklearn",
    "matplotlib",
    "pandas",
    "seaborn",
    "tqdm",
    "kagglehub",
    "kaggle",
]


def check_dependencies():
    missing = []
    for pkg in REQUIRED_PACKAGES:
        if importlib.util.find_spec(pkg) is None:
            missing.append(pkg)
    if missing:
        raise ImportError(
            "Missing required packages: {}. Install them with `pip install -r requirements.txt`.".format(
                ", ".join(missing)
            )
        )


if __name__ == "__main__":
    try:
        check_dependencies()
        print("All required dependencies are installed.")
    except ImportError as e:
        print(str(e))
        sys.exit(1)
