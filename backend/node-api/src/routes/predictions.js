import axios from 'axios';
import FormData from 'form-data';
import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { Prediction } from '../models/Prediction.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();
router.use(authenticate);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    const supported = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    callback(supported ? null : new Error('Upload a JPEG, PNG, or WebP image.'), supported);
  },
});

router.post('/', upload.single('image'), async (request, response, next) => {
  if (!request.file) {
    return response.status(400).json({ error: 'Choose an image to classify.' });
  }

  try {
    const form = new FormData();
    form.append('file', request.file.buffer, {
      filename: request.file.originalname || 'mri-image',
      contentType: request.file.mimetype,
    });
    const modelResponse = await axios.post(`${process.env.MODEL_API_URL}/predict`, form, {
      headers: form.getHeaders(),
      maxBodyLength: 10 * 1024 * 1024,
      timeout: 120_000,
    });
    const savedPrediction = await Prediction.create({ ...modelResponse.data, user: request.auth.userId });
    return response.status(201).json(savedPrediction);
  } catch (error) {
    if (error.response) {
      return response.status(error.response.status).json({
        error: error.response.data?.detail || 'The model service could not classify this image.',
      });
    }
    return next(error);
  }
});

router.get('/', async (request, response, next) => {
  try {
    const requestedLimit = Number.parseInt(request.query.limit, 10) || 20;
    const limit = Math.min(Math.max(requestedLimit, 1), 50);
    const filter = {};
    filter.user = request.auth.userId;
    if (request.query.className) filter.predictedClass = String(request.query.className);
    const predictions = await Prediction.find(filter)
      .select('-originalImage -gradcamImage')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return response.json({ predictions });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (request, response, next) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid prediction ID.' });
  }
  try {
    const prediction = await Prediction.findOne({ _id: request.params.id, user: request.auth.userId }).lean();
    if (!prediction) return response.status(404).json({ error: 'Prediction not found.' });
    return response.json(prediction);
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (request, response, next) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid prediction ID.' });
  }
  try {
    const deleted = await Prediction.findOneAndDelete({ _id: request.params.id, user: request.auth.userId });
    if (!deleted) return response.status(404).json({ error: 'Prediction not found.' });
    return response.status(204).end();
  } catch (error) {
    return next(error);
  }
});

export default router;