require('dotenv').config();
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const financeRoutes = require('./routes/financeRoutes');

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be configured.');
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/brightloop_odoo';
const app = express();
app.use(cors());
app.use(express.json({ limit: '20kb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/finance', financeRoutes);
app.use((error, _req, res, _next) => {
  console.error(error);
  return res.status(500).json({ error: 'Unable to load finance data.' });
});

mongoose.connect(mongoUri).then(() => {
  const port = Number(process.env.PORT || 5000);
  app.listen(port, () => console.info(`Brightloop finance API listening on port ${port}`));
}).catch(error => {
  console.error(`Could not connect to MongoDB: ${error.message}`);
  process.exitCode = 1;
});
