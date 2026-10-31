require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const productRoutes = require('./routes/productRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/brightloop_odoo';

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/products', productRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Brightloop Subscription & Catalog Engine'
  });
});

// Database Connection & Server initialization
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log(`✅ MongoDB Connected: ${MONGODB_URI}`);
    app.listen(PORT, () => {
      console.log(`🚀 Brightloop Backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.warn(`⚠️ MongoDB connection warning: ${err.message}`);
    console.warn(`Starting Express HTTP server on port ${PORT} in fallback mode...`);
    app.listen(PORT, () => {
      console.log(`🚀 Brightloop Backend running on port ${PORT} (DB not connected)`);
    });
  });

module.exports = app;
