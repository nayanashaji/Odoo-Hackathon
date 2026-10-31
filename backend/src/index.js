require('dotenv').config();
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
