# NeuroScope

NeuroScope is an educational brain-MRI classification application built around this repository's trained image classifiers. It returns one of four dataset labels, class probabilities, and a Grad-CAM overlay for the selected model prediction. It is not a medical device and must not be used to diagnose or guide treatment.

## Application layout

- `backend/model_api`: Python/FastAPI inference service. It loads a training checkpoint and reuses `modelcomp.explain` for preprocessing, probabilities, and Grad-CAM.
- `backend/node-api`: Node.js/Express API. It validates uploads, calls the model service, and stores prediction history in MongoDB.
- `mobile`: Expo/React Native application for image selection, results, and scan history.

The class order follows the training `ImageFolder` order: `glioma`, `meningioma`, `notumor`, `pituitary`.

## Run locally

### 1. Start the inference API

Use the project Python environment and make sure the selected checkpoint exists in `outputs/checkpoints`.

```powershell
pip install -r requirements-app-api.txt
$env:MODEL_CHECKPOINT_PATH = "outputs/checkpoints/best_swin_tiny_patch4_window7_224.pth"
uvicorn backend.model_api.main:app --reload --port 8000
```

The model service reports `ready: false` at `/health` if its checkpoint is missing. The model's original experiment metrics are in `outputs/reports/experiment_summary.csv`; those metrics are not a clinical validation.

### 2. Start the Node API

Create `backend/node-api/.env` from `.env.example`, set `MONGODB_URI` to a local MongoDB or Atlas database and replace `JWT_SECRET` with a long random value, then:

```powershell
cd backend/node-api
npm install
npm run dev
```

The API listens on port `4000` by default. `MODEL_API_URL` should point to the inference service.

### 3. Start the Expo app

Create `mobile/.env` from `.env.example`, set `EXPO_PUBLIC_API_URL` to the Node API URL reachable from your phone or emulator, then:

```powershell
cd mobile
npm install
npm start
```

For a physical device, use your development machine's LAN IP rather than `localhost`.

## Render deployment

The root `render.yaml` defines separate Python inference and Node API web services. Connect the repository to Render and set:

- Python service: `MODEL_CHECKPOINT_URL` to a reachable download URL for `best_swin_tiny_patch4_window7_224.pth`. Checkpoints are intentionally git-ignored and must be supplied as a deployment artifact. `MODEL_NAME` defaults to `swin_tiny_patch4_window7_224`.
- Node service: `MONGODB_URI` to MongoDB Atlas (or another reachable MongoDB deployment), `MODEL_API_URL` to the deployed Python service URL, and `JWT_SECRET` to a long random value.
- Expo app: set `EXPO_PUBLIC_API_URL` to the deployed Node service URL before creating an EAS build.

The Python service loads PyTorch and a vision transformer; provision enough memory for model startup and inference. The Node API caps uploads at 8 MB and MongoDB stores the uploaded image and Grad-CAM image with each prediction. Configure MongoDB access controls and retention to suit your privacy requirements. Do not upload identifiable patient data to an unapproved service.

## API

- `GET /health` on each service reports service and model/database readiness.
- `POST /api/v1/auth/register` and `POST /api/v1/auth/login` create an account or return a bearer token.
- `POST /api/v1/predictions` on the Node API accepts multipart form field `image` (JPEG, PNG, or WebP).
- `GET /api/v1/predictions?limit=20` returns recent prediction metadata.
- `GET /api/v1/predictions/:id` returns a saved prediction with its source and Grad-CAM images.
- `DELETE /api/v1/predictions/:id` removes a saved prediction.

Prediction routes require the bearer token returned by sign-in. Each account can access and delete only its own history. The classifier recognizes patterns in its training dataset, not clinical diagnoses. Grad-CAM is a visualization of model attention, not proof that a highlighted area is medically meaningful. Always rely on qualified medical professionals and validated clinical workflows.
