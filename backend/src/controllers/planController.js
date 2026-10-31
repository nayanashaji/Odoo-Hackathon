const { Plan, VALID_BILLING_FREQUENCIES, VALID_CLOSING_BEHAVIORS } = require('../models/Plan');
const Product = require('../models/Product');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Path to fallback files
const DATA_DIR = path.join(__dirname, '..', 'data');
const PLANS_FILE = path.join(DATA_DIR, 'plans.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');

// Check if MongoDB is connected and ready
const isDbConnected = () => {
  return mongoose && mongoose.connection && mongoose.connection.readyState === 1;
};

// Initial seed conforming to docs/schema.json
const DEFAULT_PLANS = [
  {
    id: 'plan_1',
    product_id: 'prod_1',
    name: 'Enterprise Annual ERP Suite',
    code: 'ERP-ANNUAL-VIP',
    description: 'Yearly subscription for enterprise operations with auto-renewing SLA and 24/7 dedicated support.',
    billing_frequency: 'yearly',
    minimum_quantity: 5,
    available_from: '2026-01-01T00:00:00.000Z',
    available_until: '2027-12-31T23:59:59.000Z',
    closing_behavior: 'renew',
    status: 'active',
    base_price: 1200
  },
  {
    id: 'plan_2',
    product_id: 'prod_1',
    name: 'Professional Monthly Cloud Seat',
    code: 'CLOUD-MTH-PRO',
    description: 'Monthly seat license for engineering teams with flexible per-month terms.',
    billing_frequency: 'monthly',
    minimum_quantity: 1,
    available_from: '2026-01-01T00:00:00.000Z',
    available_until: '2027-06-30T23:59:59.000Z',
    closing_behavior: 'pause',
    status: 'active',
    base_price: 150
  },
  {
    id: 'plan_3',
    product_id: 'prod_2',
    name: 'Short-Term Weekly Compute Cluster',
    code: 'AI-WEEKLY-BURST',
    description: 'High-performance AI model training burst node billed on a weekly schedule.',
    billing_frequency: 'weekly',
    minimum_quantity: 2,
    available_from: '2026-02-01T00:00:00.000Z',
    available_until: '2026-12-31T23:59:59.000Z',
    closing_behavior: 'close_on_own',
    status: 'active',
    base_price: 320
  },
  {
    id: 'plan_4',
    product_id: 'prod_2',
    name: 'Dynamic Daily High-Traffic Ingress',
    code: 'INGRESS-DAILY',
    description: 'Daily billed gateway ingress plan with immediate early termination support.',
    billing_frequency: 'daily',
    minimum_quantity: 1,
    available_from: '2026-03-01T00:00:00.000Z',
    available_until: '2026-11-30T23:59:59.000Z',
    closing_behavior: 'close_early',
    status: 'active',
    base_price: 45
  }
];

// Helper to normalize closing_behavior values and synonyms
const normalizeClosingBehavior = (val) => {
  if (!val) return 'renew';
  const clean = String(val).toLowerCase().trim().replace(/\s+/g, '_');
  if (['renew', 'renews', 'auto_renew', 'autorenew'].includes(clean)) return 'renew';
  if (['close_on_own', 'closes_on_its_own', 'close_on_its_own', 'auto_close'].includes(clean)) return 'close_on_own';
  if (['close_early', 'closes_early', 'early_close'].includes(clean)) return 'close_early';
  if (['pause', 'pauses'].includes(clean)) return 'pause';
  return clean;
};

// Local file helpers
const readLocalPlans = () => {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(PLANS_FILE)) {
      fs.writeFileSync(PLANS_FILE, JSON.stringify(DEFAULT_PLANS, null, 2), 'utf-8');
      return DEFAULT_PLANS;
    }
    const raw = fs.readFileSync(PLANS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return DEFAULT_PLANS;
  }
};

const writeLocalPlans = (plans) => {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PLANS_FILE, JSON.stringify(plans, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to write local plans file:', err.message);
  }
};

const readLocalProducts = () => {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf-8'));
    }
  } catch (e) {}
  return [];
};

const writeLocalProducts = (products) => {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
  } catch (e) {}
};

/**
 * Link a plan to a product in both database and local files
 */
const linkPlanToProduct = async (productId, planId) => {
  if (!productId || !planId) return;

  if (isDbConnected()) {
    try {
      await Product.findOneAndUpdate(
        { id: productId },
        { $addToSet: { plans: planId } }
      );
    } catch (e) {}
  }

  try {
    const products = readLocalProducts();
    const pIdx = products.findIndex((p) => p.id === productId);
    if (pIdx !== -1) {
      products[pIdx].plans = products[pIdx].plans || [];
      if (!products[pIdx].plans.includes(planId)) {
        products[pIdx].plans.push(planId);
        writeLocalProducts(products);
      }
    }
  } catch (e) {}
};

/**
 * 1. GET /api/plans
 * Retrieve all plans with optional filtering & product info
 */
exports.getAllPlans = async (req, res) => {
  try {
    const { billing_frequency, closing_behavior, status, search, product_id } = req.query;

    let plans = [];

    if (isDbConnected()) {
      try {
        const filter = {};
        if (billing_frequency && billing_frequency !== 'all') {
          filter.billing_frequency = billing_frequency.toLowerCase();
        }
        if (closing_behavior && closing_behavior !== 'all') {
          filter.closing_behavior = normalizeClosingBehavior(closing_behavior);
        }
        if (status && status !== 'all') {
          filter.status = status;
        }
        if (product_id) {
          filter.product_id = product_id;
        }
        if (search) {
          filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { id: { $regex: search, $options: 'i' } },
            { code: { $regex: search, $options: 'i' } }
          ];
        }

        const results = await Plan.find(filter).sort({ createdAt: -1 });
        if (results && results.length > 0) {
          plans = results.map((p) => (typeof p.toObject === 'function' ? p.toObject({ virtuals: true }) : p));
        }
      } catch (dbErr) {}
    }

    if (plans.length === 0) {
      plans = readLocalPlans();
      if (billing_frequency && billing_frequency !== 'all') {
        plans = plans.filter((p) => p.billing_frequency === billing_frequency.toLowerCase());
      }
      if (closing_behavior && closing_behavior !== 'all') {
        const norm = normalizeClosingBehavior(closing_behavior);
        plans = plans.filter((p) => p.closing_behavior === norm);
      }
      if (status && status !== 'all') {
        plans = plans.filter((p) => p.status === status);
      }
      if (product_id) {
        plans = plans.filter((p) => p.product_id === product_id);
      }
      if (search) {
        const q = search.toLowerCase();
        plans = plans.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q) ||
            (p.code && p.code.toLowerCase().includes(q))
        );
      }
    }

    // Attach product details for convenience
    const localProducts = readLocalProducts();
    const now = new Date();
    const formatted = plans.map((p) => {
      const start = new Date(p.available_from);
      const end = new Date(p.available_until);
      const isAvailable = p.status === 'active' && now >= start && now <= end;
      const attachedProduct = localProducts.find((prod) => prod.id === p.product_id);

      return {
        ...p,
        attached_product_name: attachedProduct ? attachedProduct.name : null,
        attached_product_sales_price: attachedProduct ? attachedProduct.sales_price : null,
        is_currently_available: isAvailable,
        availability_status: isAvailable
          ? 'Available Now'
          : now < start
          ? 'Upcoming'
          : 'Expired'
      };
    });

    return res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve plans',
      error: error.message
    });
  }
};

/**
 * 2. GET /api/plans/:id
 * Retrieve a specific plan by ID
 */
exports.getPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    if (isDbConnected()) {
      try {
        const plan = await Plan.findOne({ id });
        if (plan) {
          return res.status(200).json({
            success: true,
            data: typeof plan.toObject === 'function' ? plan.toObject({ virtuals: true }) : plan
          });
        }
      } catch (e) {}
    }

    const localList = readLocalPlans();
    const found = localList.find((p) => p.id === id);

    if (!found) {
      return res.status(404).json({
        success: false,
        message: `Plan with ID '${id}' not found.`
      });
    }

    return res.status(200).json({
      success: true,
      data: found
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve plan',
      error: error.message
    });
  }
};

/**
 * 3. POST /api/plans
 * Launch a new plan with strict validation and associate with Product
 */
exports.createPlan = async (req, res) => {
  try {
    const {
      id,
      product_id,
      name,
      code,
      description,
      billing_frequency,
      minimum_quantity,
      available_from,
      available_until,
      closing_behavior,
      base_price,
      status
    } = req.body;

    const errors = [];

    // Rule 1: Name is required
    if (!name || !name.trim()) {
      errors.push('Plan name is required.');
    }

    // Rule 2: billing_frequency must be strictly daily, weekly, monthly, or yearly
    const cleanFreq = billing_frequency ? String(billing_frequency).toLowerCase().trim() : '';
    if (!cleanFreq || !VALID_BILLING_FREQUENCIES.includes(cleanFreq)) {
      errors.push(
        `Invalid billing_frequency '${billing_frequency}'. Allowed values are strictly: ${VALID_BILLING_FREQUENCIES.join(', ')}.`
      );
    }

    // Rule 3: minimum_quantity must be at least 1
    const qty = Number(minimum_quantity);
    if (isNaN(qty) || qty < 1) {
      errors.push('minimum_quantity must be a number greater than or equal to 1.');
    }

    // Rule 4: available_from and available_until must be valid dates with until >= from
    if (!available_from) errors.push('available_from date is required.');
    if (!available_until) errors.push('available_until date is required.');

    const fromDate = new Date(available_from);
    const untilDate = new Date(available_until);

    if (isNaN(fromDate.getTime())) {
      errors.push('available_from must be a valid date.');
    }
    if (isNaN(untilDate.getTime())) {
      errors.push('available_until must be a valid date.');
    }
    if (!isNaN(fromDate.getTime()) && !isNaN(untilDate.getTime())) {
      if (untilDate.getTime() < fromDate.getTime()) {
        errors.push('available_until date must be on or after available_from date.');
      }
    }

    // Rule 5: closing_behavior must be one of: renew, close_on_own, close_early, pause
    const cleanBehavior = normalizeClosingBehavior(closing_behavior);
    if (!VALID_CLOSING_BEHAVIORS.includes(cleanBehavior)) {
      errors.push(
        `Invalid closing_behavior '${closing_behavior}'. Must be one of: ${VALID_CLOSING_BEHAVIORS.join(', ')}.`
      );
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed for Plan creation.',
        errors
      });
    }

    const planId = id?.trim() || `plan_${Date.now()}`;
    const planCode = code?.trim().toUpperCase() || `${name.toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 10)}-${cleanFreq.toUpperCase()}`;

    const newPlanData = {
      id: planId,
      product_id: product_id ? product_id.trim() : null,
      name: name.trim(),
      code: planCode,
      description: description?.trim() || '',
      billing_frequency: cleanFreq,
      minimum_quantity: qty,
      available_from: fromDate.toISOString(),
      available_until: untilDate.toISOString(),
      closing_behavior: cleanBehavior,
      base_price: Number(base_price) || 0,
      status: status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Attach to product if product_id is provided
    if (newPlanData.product_id) {
      await linkPlanToProduct(newPlanData.product_id, planId);
    }

    if (isDbConnected()) {
      try {
        const planDoc = new Plan(newPlanData);
        const savedDoc = await planDoc.save();
        return res.status(201).json({
          success: true,
          message: 'Plan launched successfully (MongoDB)',
          data: typeof savedDoc.toObject === 'function' ? savedDoc.toObject({ virtuals: true }) : savedDoc
        });
      } catch (dbErr) {}
    }

    // Local storage fallback
    const localList = readLocalPlans();
    if (localList.some((p) => p.id === planId)) {
      return res.status(409).json({
        success: false,
        message: `Plan with ID '${planId}' already exists.`
      });
    }
    localList.unshift(newPlanData);
    writeLocalPlans(localList);

    return res.status(201).json({
      success: true,
      message: 'Plan launched successfully (Local Store)',
      data: newPlanData
    });
  } catch (error) {
    console.error('Error creating plan:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create plan',
      error: error.message
    });
  }
};

/**
 * 4. PUT /api/plans/:id
 * Update an existing plan with strict validation & product association
 */
exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    const errors = [];

    delete updates.id;
    delete updates._id;

    if (updates.billing_frequency) {
      const cleanFreq = String(updates.billing_frequency).toLowerCase().trim();
      if (!VALID_BILLING_FREQUENCIES.includes(cleanFreq)) {
        errors.push(
          `Invalid billing_frequency. Allowed values: ${VALID_BILLING_FREQUENCIES.join(', ')}.`
        );
      } else {
        updates.billing_frequency = cleanFreq;
      }
    }

    if (updates.closing_behavior) {
      const cleanBehavior = normalizeClosingBehavior(updates.closing_behavior);
      if (!VALID_CLOSING_BEHAVIORS.includes(cleanBehavior)) {
        errors.push(
          `Invalid closing_behavior. Allowed values: ${VALID_CLOSING_BEHAVIORS.join(', ')}.`
        );
      } else {
        updates.closing_behavior = cleanBehavior;
      }
    }

    if (updates.minimum_quantity !== undefined) {
      const qty = Number(updates.minimum_quantity);
      if (isNaN(qty) || qty < 1) {
        errors.push('minimum_quantity must be at least 1.');
      } else {
        updates.minimum_quantity = qty;
      }
    }

    if (updates.available_from && updates.available_until) {
      const from = new Date(updates.available_from);
      const until = new Date(updates.available_until);
      if (until.getTime() < from.getTime()) {
        errors.push('available_until date cannot be earlier than available_from date.');
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Plan update validation failed.',
        errors
      });
    }

    if (updates.product_id) {
      await linkPlanToProduct(updates.product_id, id);
    }

    updates.updatedAt = new Date().toISOString();

    if (isDbConnected()) {
      try {
        const updatedDoc = await Plan.findOneAndUpdate(
          { id },
          { $set: updates },
          { new: true, runValidators: true }
        );
        if (updatedDoc) {
          return res.status(200).json({
            success: true,
            message: 'Plan updated successfully',
            data: typeof updatedDoc.toObject === 'function' ? updatedDoc.toObject({ virtuals: true }) : updatedDoc
          });
        }
      } catch (e) {}
    }

    const localList = readLocalPlans();
    const index = localList.findIndex((p) => p.id === id);
    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: `Plan with ID '${id}' not found.`
      });
    }

    localList[index] = { ...localList[index], ...updates };
    writeLocalPlans(localList);

    return res.status(200).json({
      success: true,
      message: 'Plan updated successfully (Local Store)',
      data: localList[index]
    });
  } catch (error) {
    console.error('Error updating plan:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update plan',
      error: error.message
    });
  }
};

/**
 * 5. DELETE /api/plans/:id
 * Remove a plan and unlink from associated products
 */
exports.deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    if (isDbConnected()) {
      try {
        await Product.updateMany({ plans: id }, { $pull: { plans: id } });
        await Plan.findOneAndDelete({ id });
      } catch (e) {}
    }

    try {
      const products = readLocalProducts();
      products.forEach((p) => {
        if (p.plans && p.plans.includes(id)) {
          p.plans = p.plans.filter((pid) => pid !== id);
        }
      });
      writeLocalProducts(products);
    } catch (e) {}

    const localList = readLocalPlans();
    const filtered = localList.filter((p) => p.id !== id);
    writeLocalPlans(filtered);

    return res.status(200).json({
      success: true,
      message: `Plan '${id}' deleted successfully.`
    });
  } catch (error) {
    console.error('Error deleting plan:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete plan',
      error: error.message
    });
  }
};

// ============================================================================
// SUBSCRIPTION STATE MACHINE DELEGATION
// Supports test suites that reference planController for subscription logic
// ============================================================================
const subscriptionStateCtrl = require('./subscriptionStateController');

exports.updateSubscriptionState = subscriptionStateCtrl.updateSubscriptionState;
exports.createSubscription = subscriptionStateCtrl.createSubscription;
exports.updateSubscription = subscriptionStateCtrl.updateSubscription;
exports.getAllSubscriptions = subscriptionStateCtrl.getAllSubscriptions;
exports.getSubscriptionById = subscriptionStateCtrl.getSubscriptionById;
exports.getStateMachineDefinition = subscriptionStateCtrl.getStateMachineDefinition;
exports.validateStateTransition = subscriptionStateCtrl.validateStateTransition;
exports.SUBSCRIPTION_STATES = subscriptionStateCtrl.SUBSCRIPTION_STATES;
exports.ALLOWED_STATE_TRANSITIONS = subscriptionStateCtrl.ALLOWED_STATE_TRANSITIONS;
exports.SEQUENTIAL_FLOW = subscriptionStateCtrl.SEQUENTIAL_FLOW;

