const express = require('express');
const router = express.Router();
const subscriptionStateController = require('../controllers/subscriptionStateController');

/**
 * Subscription State Machine Routes
 * Base Route: /api/subscriptions
 */

// State machine definition and graph metadata
router.get('/state-machine/definition', subscriptionStateController.getStateMachineDefinition);

// List and Create subscriptions
router.get('/', subscriptionStateController.getAllSubscriptions);
router.post('/', subscriptionStateController.createSubscription);

// Get single subscription
router.get('/:id', subscriptionStateController.getSubscriptionById);

// Core State Transition Route (PUT /api/subscriptions/:id/state)
// Enforces sequential state flow: Draft → Quotation → Confirmed → Active → Closed
router.put('/:id/state', subscriptionStateController.updateSubscriptionState);

// General update routes with state validation
router.put('/:id', subscriptionStateController.updateSubscription);
router.patch('/:id', subscriptionStateController.updateSubscription);

module.exports = router;

