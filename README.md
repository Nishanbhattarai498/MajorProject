# Brain MRI Classifier

Train image classifiers and generate Grad-CAM/LIME explanations for their predictions.

## Project layout

```text
modelcomp/    Core training, evaluation, model, data, and explanation code
scripts/      Runnable command-line tools
tests/        Unit tests
data/         Local train, validation, and test images (ignored by Git)
outputs/      Local checkpoints, reports, and explanations (ignored by Git)
```

## Generate explanations

Install dependencies, then explain one MRI image with every available checkpoint:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m scripts.generate_explanations --image data\test\meningioma\example.jpg
```

To run only Swin Transformer Tiny:

```powershell
.\.venv\Scripts\python.exe -m scripts.generate_explanations --model swin_tiny_patch4_window7_224 --image data\test\meningioma\example.jpg
```

Images are written to `outputs/explanations/manual/<model>/` as `<image>_gradcam.png` and `<image>_lime.png`. Both maps explain the model's predicted class (shown with confidence in the command output). Grad-CAM uses each model's final spatial feature layout, while LIME highlights only superpixels with positive evidence for that same prediction.

Use `--skip-lime` when you only need Grad-CAM. LIME defaults to 800 perturbations for a more stable map; `--lime-samples 300` is faster but less reliable.
