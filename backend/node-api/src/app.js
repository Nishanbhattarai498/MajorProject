import axios from 'axios';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import predictionsRouter from './routes/predictions.js';
import authRouter from './routes/auth.js';

const app = express();
const configuredOrigins = process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim());

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: configuredOrigins?.length ? configuredOrigins : true }));
app.use(express.json({ limit: '32kb' }));
app.use(
  '/api',
  rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false }),
);

app.get('/health', async (_request, response) => {
  let modelReady = false;
  try {
    const { data } = await axios.get(`${process.env.MODEL_API_URL}/health`, { timeout: 4_000 });
    modelReady = data.ready === true;
  } catch {
    modelReady = false;
  }
  const databaseReady = mongoose.connection.readyState === 1;
  response.status(databaseReady ? 200 : 503).json({
    service: 'neuroscope-api',
    ready: databaseReady && modelReady,
    databaseReady,
    modelReady,
  });
});

app.use('/api/v1/predictions', predictionsRouter);
app.use('/api/v1/auth', authRouter);

app.use((error, _request, response, _next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return response.status(413).json({ error: 'Image must be 8 MB or smaller.' });
  }
  if (error?.message === 'Upload a JPEG, PNG, or WebP image.') {
    return response.status(415).json({ error: error.message });
  }
  console.error(error);
  return response.status(500).json({ error: 'Something went wrong. Please try again.' });
});

export default app;