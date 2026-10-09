import mongoose from 'mongoose';

const probabilitySchema = new mongoose.Schema(
  {
    className: { type: String, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false },
);

const predictionSchema = new mongoose.Schema(
  {
    model: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    predictedClass: { type: String, required: true, index: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    probabilities: { type: [probabilitySchema], required: true },
    originalImage: { type: String, required: true },
    gradcamImage: { type: String, required: true },
  },
  { timestamps: true, versionKey: false },
);

predictionSchema.index({ createdAt: -1 });

export const Prediction = mongoose.model('Prediction', predictionSchema);