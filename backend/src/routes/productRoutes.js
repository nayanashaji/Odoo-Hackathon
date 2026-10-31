const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Standard CRUD endpoints
router.get('/', productController.getAllProducts);
router.post('/', productController.createProduct);
router.get('/:id', productController.getProductById);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

// Dynamic Variant & Calculation endpoints
router.post('/:id/variants', productController.addVariant);
router.delete('/:id/variants/:variantId', productController.deleteVariant);
router.get('/:id/calculate-price', productController.calculatePrice);

module.exports = router;
