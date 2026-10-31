import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '20kb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use((error, _req, res, _next) => {
  if (error?.code === 11000) return res.status(409).json({ error: 'An account with this email already exists.' });
  console.error(error);
  return res.status(500).json({ error: 'Something went wrong.' });
});

const port = Number(process.env.PORT ?? 4000);
if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
  throw new Error('MONGO_URI and JWT_SECRET are required. See .env.example.');
}
await mongoose.connect(process.env.MONGO_URI);
app.listen(port, () => console.info(`Brightloop API listening on port ${port}`));
