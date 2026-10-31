require('dotenv').config();
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const productRoutes = require('./routes/productRoutes');
const authController = require('./controllers/authController');
const financeController = require('./controllers/financeController');

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be configured.');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20kb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/health', (_req, res) => res.json({ status: 'online', timestamp: new Date().toISOString(), service: 'Brightloop Subscription & Catalog Engine' }));
app.use('/api/products', productRoutes);
app.use('/api/auth', authController);
app.use('/api/finance', financeController);
app.use((error, _req, res, _next) => {
  if (error?.code === 11000) return res.status(409).json({ error: 'An account with this email already exists.' });
  console.error(error);
  return res.status(500).json({ error: 'Something went wrong.' });
});

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/brightloop_odoo';
const port = Number(process.env.PORT || 5000);
mongoose.connect(mongoUri).then(async () => {
  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (Boolean(bootstrapEmail) !== Boolean(bootstrapPassword)) throw new Error('Set both BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD to provision the first admin.');
  if (bootstrapEmail) {
    const User = require('./models/User');
    const Credential = require('./models/Credential');
    const bcrypt = require('bcryptjs');
    const crypto = require('node:crypto');
    if (!/^\S+@\S+\.\S+$/.test(bootstrapEmail)) throw new Error('BOOTSTRAP_ADMIN_EMAIL must be a valid email address.');
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/.test(bootstrapPassword) || Buffer.byteLength(bootstrapPassword, 'utf8') > 72) {
      throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be 9–72 bytes and include uppercase, lowercase, and a special character.');
    }
    const existing = await User.findOne({ email: bootstrapEmail });
    if (!existing) {
      const user = await User.create({ id: `usr_${crypto.randomUUID()}`, email: bootstrapEmail, role: 'admin' });
      await Credential.create({ user_id: user.id, password_hash: await bcrypt.hash(bootstrapPassword, 12) });
      console.info(`Bootstrapped first admin account: ${bootstrapEmail}`);
    }
  }
  app.listen(port, () => console.info(`Brightloop API listening on port ${port}`));
}).catch(error => {
  console.error(`Could not start Brightloop API: ${error.message}`);
  process.exitCode = 1;
});
