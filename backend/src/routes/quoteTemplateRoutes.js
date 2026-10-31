const express = require('express');
const router = express.Router();
const quoteTemplateController = require('../controllers/quoteTemplateController');

/**
 * Quotation Templates Routes (Quotes & Subscriptions Domain)
 * Base Route: /api/quote-templates
 */

// Mock external dependencies provider (Auth & Product Catalog)
router.get('/mock-dependencies', quoteTemplateController.getMockDependencies);

// Real-time validity period and expiration calculation helper
router.post('/calculate-validity', quoteTemplateController.calculateValidity);

// Template CRUD operations
router.get('/', quoteTemplateController.getQuoteTemplates);
router.get('/:id', quoteTemplateController.getQuoteTemplateById);
router.post('/', quoteTemplateController.createQuoteTemplate);
router.put('/:id', quoteTemplateController.updateQuoteTemplate);
router.delete('/:id', quoteTemplateController.deleteQuoteTemplate);

// Business actions
router.post('/:id/duplicate', quoteTemplateController.duplicateQuoteTemplate);
router.post('/:id/preview-quote', quoteTemplateController.previewQuoteFromTemplate);
router.post('/:id/generate-quote', quoteTemplateController.generateQuoteFromTemplate);
router.post('/:id/quotes', quoteTemplateController.generateQuoteFromTemplate);

module.exports = router;

