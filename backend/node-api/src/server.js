import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';

const port = Number(process.env.PORT || 4000);

try {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters.');
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  app.listen(port, '0.0.0.0', () => {
    console.log(`NeuroScope API listening on ${port}`);
  });
} catch (error) {
  console.error(`API startup failed: ${error.message}`);
  process.exit(1);
}