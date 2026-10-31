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
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const Product = require('./models/Product');
const { Plan } = require('./models/Plan');
const productRoutes = require('./routes/productRoutes');
const planRoutes = require('./routes/planRoutes');
const internalRoutes = require('./routes/internalRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/brightloop_odoo';

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/internal', internalRoutes); // GET /api/internal/catalog for Sales Quotations

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Brightloop Product Catalog & Plan Logic Engine'
  });
});

/**
 * Database Initialization Function
 * Checks Product collection count on startup; if it returns 0 product documents,
 * automatically parses products.json and inserts its contents into MongoDB.
 * This guarantees that Product.findOneAndUpdate will successfully locate products when linking new plans.
 */
const initializeDatabase = async () => {
  try {
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      console.log('📦 Product collection in MongoDB is empty (0 products). Initializing from products.json...');
      const productsFilePath = path.join(__dirname, 'data', 'products.json');

      if (fs.existsSync(productsFilePath)) {
        const fileContent = fs.readFileSync(productsFilePath, 'utf-8');
        const productsData = JSON.parse(fileContent);

        if (Array.isArray(productsData) && productsData.length > 0) {
          for (const prod of productsData) {
            const item = { ...prod };
            delete item._id;
            await Product.updateOne({ id: prod.id }, { $setOnInsert: item }, { upsert: true });
          }
          const finalCount = await Product.countDocuments();
          console.log(`✅ Successfully seeded ${finalCount} products into MongoDB from products.json.`);
        }
      } else {
        console.warn(`⚠️ products.json file not found at: ${productsFilePath}`);
      }
    } else {
      console.log(`ℹ️ MongoDB Product collection already contains ${productCount} documents.`);
    }

    // Ensure default plans from plans.json also exist in MongoDB for plan association lookup
    const plansFilePath = path.join(__dirname, 'data', 'plans.json');
    if (fs.existsSync(plansFilePath)) {
      const fileContent = fs.readFileSync(plansFilePath, 'utf-8');
      const plansData = JSON.parse(fileContent);

      if (Array.isArray(plansData) && plansData.length > 0) {
        for (const pl of plansData) {
          const item = { ...pl };
          delete item._id;
          await Plan.updateOne({ id: pl.id }, { $setOnInsert: item }, { upsert: true });
        }
      }
    }
  } catch (error) {
    console.error('⚠️ Database initialization error:', error.message);
  }
};

// Database Connection & Server initialization
if (require.main === module) {
  mongoose
    .connect(MONGODB_URI)
    .then(async () => {
      console.log(`✅ MongoDB Connected: ${MONGODB_URI}`);
      await initializeDatabase();
      app.listen(PORT, () => {
        console.log(`🚀 Brightloop Backend running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.warn(`⚠️ MongoDB connection warning: ${err.message}`);
      console.warn(`Starting Express HTTP server on port ${PORT} with local store fallback...`);
      app.listen(PORT, () => {
        console.log(`🚀 Brightloop Backend running on port ${PORT} (Fallback Store Active)`);
      });
    });
}

module.exports = { app, initializeDatabase };
