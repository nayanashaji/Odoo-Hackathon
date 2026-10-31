const express = require('express');
const router = express.Router();
const internalCatalogController = require('../controllers/internalCatalogController');

/**
 * GET /api/internal/catalog
 * Consolidated JSON endpoint for Sales Quotation System
 * Returns active products with nested variants and associated plans
 */
router.get('/catalog', internalCatalogController.getConsolidatedCatalog);

module.exports = router;
