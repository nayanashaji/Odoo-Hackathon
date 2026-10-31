const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');

// Plan CRUD routes
router.get('/', planController.getAllPlans);
router.post('/', planController.createPlan);
router.get('/:id', planController.getPlanById);
router.put('/:id', planController.updatePlan);
router.delete('/:id', planController.deletePlan);

module.exports = router;
