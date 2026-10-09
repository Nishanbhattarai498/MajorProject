import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import multer from "multer";
import { GridFSBucket, ObjectId } from "mongodb";

const PORT = Number(process.env.PORT || 4000);
const INFERENCE_URL = (process.env.INFERENCE_URL || "http://localhost:8000").replace(/\/$/, "");
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const allowedOrigins = process.env.CORS_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean);

const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: allowedOrigins?.length ? allowedOrigins : true }));
app.use(express.json({ limit: "1mb" }));

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

const analysisSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    className: { type: String, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    classScores: [{ className: String, probability: Number }],
    modelName: { type: String, required: true },
    originalImageId: { type: mongoose.Schema.Types.ObjectId, required: true },
    originalMimeType: { type: String, required: true },
    gradcamImageId: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);
const Analysis = mongoose.model("Analysis", analysisSchema);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_request, file, callback) => {
    const accepted = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    callback(accepted ? null : new Error("Upload a JPEG, PNG, or WebP image."), accepted);
  },
});

function tokenFor(user) {
  return jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function publicUser(user) {
  return { id: String(user._id), name: user.name, email: user.email };
}

function publicAnalysis(analysis) {
  return {
    id: String(analysis._id),
    className: analysis.className,
    confidence: analysis.confidence,
    classScores: analysis.classScores,
    modelName: analysis.modelName,
    createdAt: analysis.createdAt,
  };
}

async function authenticate(request, response, next) {
  const authorization = request.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return response.status(401).json({ error: "Sign in to continue." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return response.status(401).json({ error: "Your session has expired. Sign in again." });
    request.user = user;
    return next();
  } catch {
    return response.status(401).json({ error: "Your session has expired. Sign in again." });
  }
}

function getBucket() {
  return new GridFSBucket(mongoose.connection.db, { bucketName: "analysisAssets" });
}

function saveAsset(buffer, filename, contentType) {
  return new Promise((resolve, reject) => {
    const stream = getBucket().openUploadStream(filename, { contentType });
    stream.once("finish", () => resolve(stream.id));
    stream.once("error", reject);
    stream.end(buffer);
  });
}

function readAsset(id) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const stream = getBucket().openDownloadStream(new ObjectId(id));
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.once("error", reject);
    stream.once("end", () => resolve(Buffer.concat(chunks)));
  });
}

async function deleteAsset(id) {
  if (id) await getBucket().delete(new ObjectId(id)).catch(() => {});
}

app.get("/health", (_request, response) => {
  response.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
    status: mongoose.connection.readyState === 1 ? "ok" : "starting",
  });
});

app.post("/api/auth/register", async (request, response, next) => {
  try {
    const name = String(request.body?.name || "").trim();
    const email = String(request.body?.email || "").trim().toLowerCase();
    const password = String(request.body?.password || "");
    if (!name || name.length > 80 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return response.status(400).json({ error: "Enter your name, a valid email, and a password of at least 8 characters." });
    }

    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
    return response.status(201).json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) {
    if (error?.code === 11000) return response.status(409).json({ error: "An account with that email already exists." });
    return next(error);
  }
});

app.post("/api/auth/login", async (request, response, next) => {
  try {
    const email = String(request.body?.email || "").trim().toLowerCase();
    const password = String(request.body?.password || "");
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return response.status(401).json({ error: "Email or password is incorrect." });
    }
    return response.json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/auth/me", authenticate, (request, response) => {
  response.json({ user: publicUser(request.user) });
});

app.post("/api/analyses", authenticate, upload.single("file"), async (request, response, next) => {
  if (!request.file) return response.status(400).json({ error: "Choose a brain MRI image to analyze." });

  let originalImageId;
  let gradcamImageId;
  try {
    const form = new FormData();
    form.append("file", new Blob([request.file.buffer], { type: request.file.mimetype }), request.file.originalname);
    const inferenceResponse = await fetch(`${INFERENCE_URL}/predict`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
    const prediction = await inferenceResponse.json().catch(() => ({}));
    if (!inferenceResponse.ok) {
      return response.status(inferenceResponse.status === 400 ? 400 : 502).json({
        error: prediction.detail || "The classifier could not analyze this image.",
      });
    }

    const gradcamBuffer = Buffer.from(prediction.gradcam_base64 || "", "base64");
    if (!prediction.class_name || !Array.isArray(prediction.class_scores) || gradcamBuffer.length === 0) {
      return response.status(502).json({ error: "The classifier returned an incomplete result." });
    }

    originalImageId = await saveAsset(request.file.buffer, "original", request.file.mimetype);
    gradcamImageId = await saveAsset(gradcamBuffer, "gradcam.jpg", "image/jpeg");
    const analysis = await Analysis.create({
      userId: request.user._id,
      className: prediction.class_name,
      confidence: prediction.confidence,
      classScores: prediction.class_scores.map((score) => ({
        className: score.class_name,
        probability: score.probability,
      })),
      modelName: prediction.model_name,
      originalImageId,
      originalMimeType: request.file.mimetype,
      gradcamImageId,
    });
    return response.status(201).json({ analysis: publicAnalysis(analysis) });
  } catch (error) {
    await Promise.all([deleteAsset(originalImageId), deleteAsset(gradcamImageId)]);
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return response.status(504).json({ error: "Image analysis timed out. Please try again." });
    }
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return response.status(503).json({ error: "The model service is unavailable. Please try again shortly." });
    }
    return next(error);
  }
});

app.get("/api/analyses", authenticate, async (request, response, next) => {
  try {
    const requestedLimit = Number.parseInt(request.query.limit, 10) || 20;
    const limit = Math.max(1, Math.min(requestedLimit, 50));
    const analyses = await Analysis.find({ userId: request.user._id }).sort({ createdAt: -1 }).limit(limit);
    return response.json({ analyses: analyses.map(publicAnalysis) });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/analyses/:id", authenticate, async (request, response, next) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ error: "Scan not found." });
  try {
    const analysis = await Analysis.findOne({ _id: request.params.id, userId: request.user._id });
    if (!analysis) return response.status(404).json({ error: "Scan not found." });
    const [original, gradcam] = await Promise.all([
      readAsset(analysis.originalImageId),
      readAsset(analysis.gradcamImageId),
    ]);
    return response.json({
      analysis: publicAnalysis(analysis),
      originalImage: `data:${analysis.originalMimeType};base64,${original.toString("base64")}`,
      gradcamImage: `data:image/jpeg;base64,${gradcam.toString("base64")}`,
    });
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/analyses/:id", authenticate, async (request, response, next) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ error: "Scan not found." });
  try {
    const analysis = await Analysis.findOneAndDelete({ _id: request.params.id, userId: request.user._id });
    if (!analysis) return response.status(404).json({ error: "Scan not found." });
    await Promise.all([deleteAsset(analysis.originalImageId), deleteAsset(analysis.gradcamImageId)]);
    return response.status(204).end();
  } catch (error) {
    return next(error);
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return response.status(413).json({ error: "Image must be 8 MB or smaller." });
  }
  if (error.message === "Upload a JPEG, PNG, or WebP image.") {
    return response.status(400).json({ error: error.message });
  }
  console.error("API request failed:", error.message);
  return response.status(500).json({ error: "Something went wrong. Please try again." });
});

async function start() {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
    throw new Error("MONGODB_URI and JWT_SECRET must be configured.");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  app.listen(PORT, "0.0.0.0", () => console.log(`Brain MRI API listening on port ${PORT}`));
}

start().catch((error) => {
  console.error("Unable to start API:", error.message);
  process.exit(1);
});