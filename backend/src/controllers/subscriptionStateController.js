/**
 * Subscription State Machine Controller
 * Enforces sequential transitions: Draft → Quotation → Confirmed → Active → Closed
 * Strictly validates and rejects invalid state jumps (e.g. Draft -> Active).
 * Mocks user (usr_123) and product (prod_1) data per docs/schema.json.
 */

const {
  SubscriptionModel,
  SUBSCRIPTION_STATES,
  ALLOWED_STATE_TRANSITIONS,
  SEQUENTIAL_FLOW
} = require('../models/Subscription');

// ============================================================================
// MOCKED DATA DEPENDENCIES (Conforms to docs/schema.json)
// ============================================================================

const MOCK_USER = {
  id: 'usr_123',
  name: 'Claire Dupont',
  email: 'c@x.com',
  role: 'customer',
  company: 'Nexus Innovations Ltd',
  phone: '+1 (555) 234-5678'
};

const MOCK_SALES_REP = {
  id: 'usr_sales_101',
  name: 'Alex Mercer',
  email: 'alex.sales@brightloop.io',
  role: 'sales_rep'
};

const MOCK_PRODUCT = {
  id: 'prod_1',
  name: 'Brightloop Enterprise Cloud Server',
  sales_price: 1200,
  cost_price: 200,
  variants: [
    {
      id: 'var_1',
      name: 'Dell PowerEdge Edition',
      price_modifier: 560
    }
  ]
};

// ============================================================================
// IN-MEMORY DATA STORE (Resilient default seeded with schema.json data)
// ============================================================================

const getInitialSubscriptionsStore = () => [
  {
    id: 'sub_1', // Direct match to docs/schema.json
    status: SUBSCRIPTION_STATES.ACTIVE, // "status": "Active" in schema.json
    customer: { ...MOCK_USER },
    plan: {
      id: 'plan_1',
      name: 'Enterprise Yearly Auto-Renew Plan',
      billing_frequency: 'yearly',
      closing_behavior: 'renew'
    },
    lines: [
      {
        product_id: 'prod_1',
        product_name: MOCK_PRODUCT.name,
        variant_id: 'var_1',
        variant_name: 'Dell PowerEdge Edition',
        quantity: 5,
        unit_price: 1200,
        price_modifier: 560,
        total_amount: 8888 // Direct match to docs/schema.json
      }
    ],
    grand_total: 8888,
    createdAt: new Date('2026-10-01T10:00:00Z'),
    updatedAt: new Date('2026-10-15T14:30:00Z'),
    transition_history: [
      {
        from_state: 'Initial',
        to_state: SUBSCRIPTION_STATES.DRAFT,
        timestamp: new Date('2026-10-01T10:00:00Z'),
        actor_id: MOCK_SALES_REP.id,
        actor_role: 'sales_rep',
        reason: 'Subscription agreement drafted',
        is_manual_override: false
      },
      {
        from_state: SUBSCRIPTION_STATES.DRAFT,
        to_state: SUBSCRIPTION_STATES.QUOTATION,
        timestamp: new Date('2026-10-05T11:00:00Z'),
        actor_id: MOCK_SALES_REP.id,
        actor_role: 'sales_rep',
        reason: 'Formal quote presented to Claire Dupont (usr_123)',
        is_manual_override: false
      },
      {
        from_state: SUBSCRIPTION_STATES.QUOTATION,
        to_state: SUBSCRIPTION_STATES.CONFIRMED,
        timestamp: new Date('2026-10-10T09:15:00Z'),
        actor_id: MOCK_USER.id,
        actor_role: 'customer',
        reason: 'Customer online signature approved quote terms',
        is_manual_override: false
      },
      {
        from_state: SUBSCRIPTION_STATES.CONFIRMED,
        to_state: SUBSCRIPTION_STATES.ACTIVE,
        timestamp: new Date('2026-10-15T14:30:00Z'),
        actor_id: MOCK_SALES_REP.id,
        actor_role: 'sales_rep',
        reason: 'Hardware provisioned and subscription activated',
        is_manual_override: false
      }
    ]
  },
  {
    id: 'sub_2',
    status: SUBSCRIPTION_STATES.DRAFT,
    customer: { ...MOCK_USER },
    plan: {
      id: 'plan_1',
      name: 'Enterprise Yearly Auto-Renew Plan',
      billing_frequency: 'yearly',
      closing_behavior: 'renew'
    },
    lines: [
      {
        product_id: 'prod_1',
        product_name: MOCK_PRODUCT.name,
        variant_id: 'var_1',
        variant_name: 'Dell PowerEdge Edition',
        quantity: 2,
        unit_price: 1200,
        price_modifier: 560,
        total_amount: 3520
      }
    ],
    grand_total: 3520,
    createdAt: new Date('2026-10-31T08:00:00Z'),
    updatedAt: new Date('2026-10-31T08:00:00Z'),
    transition_history: [
      {
        from_state: 'Initial',
        to_state: SUBSCRIPTION_STATES.DRAFT,
        timestamp: new Date('2026-10-31T08:00:00Z'),
        actor_id: MOCK_SALES_REP.id,
        actor_role: 'sales_rep',
        reason: 'New subscription initiated',
        is_manual_override: false
      }
    ]
  },
  {
    id: 'sub_3',
    status: SUBSCRIPTION_STATES.QUOTATION,
    customer: { ...MOCK_USER },
    plan: {
      id: 'plan_1',
      name: 'Enterprise Yearly Auto-Renew Plan',
      billing_frequency: 'yearly',
      closing_behavior: 'renew'
    },
    lines: [
      {
        product_id: 'prod_1',
        product_name: MOCK_PRODUCT.name,
        variant_id: 'var_1',
        variant_name: 'Dell PowerEdge Edition',
        quantity: 1,
        unit_price: 1200,
        price_modifier: 560,
        total_amount: 1760
      }
    ],
    grand_total: 1760,
    createdAt: new Date('2026-10-25T09:30:00Z'),
    updatedAt: new Date('2026-10-26T14:00:00Z'),
    transition_history: [
      {
        from_state: 'Initial',
        to_state: SUBSCRIPTION_STATES.DRAFT,
        timestamp: new Date('2026-10-25T09:30:00Z'),
        actor_id: MOCK_SALES_REP.id,
        actor_role: 'sales_rep',
        reason: 'Draft initiated',
        is_manual_override: false
      },
      {
        from_state: SUBSCRIPTION_STATES.DRAFT,
        to_state: SUBSCRIPTION_STATES.QUOTATION,
        timestamp: new Date('2026-10-26T14:00:00Z'),
        actor_id: MOCK_SALES_REP.id,
        actor_role: 'sales_rep',
        reason: 'Quotation delivered for review',
        is_manual_override: false
      }
    ]
  },
  {
    id: 'sub_4',
    status: SUBSCRIPTION_STATES.CONFIRMED,
    customer: { ...MOCK_USER },
    plan: {
      id: 'plan_1',
      name: 'Enterprise Yearly Auto-Renew Plan',
      billing_frequency: 'yearly',
      closing_behavior: 'renew'
    },
    lines: [
      {
        product_id: 'prod_1',
        product_name: MOCK_PRODUCT.name,
        variant_id: 'var_1',
        variant_name: 'Dell PowerEdge Edition',
        quantity: 3,
        unit_price: 1200,
        price_modifier: 560,
        total_amount: 5280
      }
    ],
    grand_total: 5280,
    createdAt: new Date('2026-10-20T11:00:00Z'),
    updatedAt: new Date('2026-10-28T16:20:00Z'),
    transition_history: [
      {
        from_state: 'Initial',
        to_state: SUBSCRIPTION_STATES.DRAFT,
        timestamp: new Date('2026-10-20T11:00:00Z'),
        actor_id: MOCK_SALES_REP.id,
        actor_role: 'sales_rep',
        reason: 'Initial setup',
        is_manual_override: false
      },
      {
        from_state: SUBSCRIPTION_STATES.DRAFT,
        to_state: SUBSCRIPTION_STATES.QUOTATION,
        timestamp: new Date('2026-10-22T10:00:00Z'),
        actor_id: MOCK_SALES_REP.id,
        actor_role: 'sales_rep',
        reason: 'Quote sent',
        is_manual_override: false
      },
      {
        from_state: SUBSCRIPTION_STATES.QUOTATION,
        to_state: SUBSCRIPTION_STATES.CONFIRMED,
        timestamp: new Date('2026-10-28T16:20:00Z'),
        actor_id: MOCK_SALES_REP.id,
        actor_role: 'sales_rep',
        reason: 'Contract signed; awaiting provisioning',
        is_manual_override: false
      }
    ]
  }
];

let subscriptionsStore = getInitialSubscriptionsStore();

// Reset store helper for test isolation
exports._resetStore = () => {
  subscriptionsStore = getInitialSubscriptionsStore();
};

// Helper: Match input state string to canonical capitalized state enum
function normalizeState(stateInput) {
  if (!stateInput || typeof stateInput !== 'string') return null;
  const clean = stateInput.trim().toLowerCase();
  for (const [key, val] of Object.entries(SUBSCRIPTION_STATES)) {
    if (val.toLowerCase() === clean || key.toLowerCase() === clean) {
      return val;
    }
  }
  return null;
}

// Helper: Check if MongoDB connection is active
function isDbConnected() {
  try {
    const mongoose = require('mongoose');
    return mongoose && mongoose.connection && mongoose.connection.readyState === 1;
  } catch (e) {
    return false;
  }
}

// Helper: Enrich subscription object with state machine helpers for client
function enrichSubscription(sub) {
  const allowed = ALLOWED_STATE_TRANSITIONS[sub.status] || [];
  const currentIndex = SEQUENTIAL_FLOW.indexOf(sub.status);
  const nextSequentialState =
    currentIndex >= 0 && currentIndex < SEQUENTIAL_FLOW.length - 1
      ? SEQUENTIAL_FLOW[currentIndex + 1]
      : null;

  return {
    ...sub,
    allowed_transitions: allowed,
    next_sequential_state: nextSequentialState,
    is_terminal: allowed.length === 0,
    can_cancel: allowed.includes(SUBSCRIPTION_STATES.CANCELLED),
    sequential_progress: {
      current_step: currentIndex >= 0 ? currentIndex + 1 : null,
      total_steps: SEQUENTIAL_FLOW.length,
      stages: SEQUENTIAL_FLOW
    }
  };
}

// ============================================================================
// CONTROLLER HANDLERS
// ============================================================================

/**
 * PUT /api/subscriptions/:id/state
 * Core State Machine Transition Handler
 * Strictly enforces sequential state flow: Draft → Quotation → Confirmed → Active → Closed
 * Explicitly rejects invalid jumps (e.g. Draft -> Active)
 */
exports.updateSubscriptionState = async (req, res) => {
  try {
    const { id } = req.params;
    const { state, target_state, reason, actor_id, actor_role, is_manual_override } = req.body;

    const requestedState = state || target_state;
    if (!requestedState) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field',
        message: 'A target state must be provided in the request body (e.g. { "state": "Quotation" }).'
      });
    }

    const canonicalTarget = normalizeState(requestedState);
    if (!canonicalTarget) {
      return res.status(400).json({
        success: false,
        error: 'Invalid state name',
        message: `State '${requestedState}' is not recognized. Valid states are: ${Object.values(SUBSCRIPTION_STATES).join(', ')}.`
      });
    }

    // Locate subscription
    let subscription = null;
    let isFromDb = false;

    if (isDbConnected() && SubscriptionModel && typeof SubscriptionModel.findOne === 'function') {
      subscription = await SubscriptionModel.findOne({ id });
      if (subscription) isFromDb = true;
    }

    if (!subscription) {
      subscription = subscriptionsStore.find((s) => s.id === id);
    }

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found',
        message: `Subscription with ID '${id}' was not found.`
      });
    }

    const currentState = subscription.status;

    // Check if target state is already current state
    if (currentState === canonicalTarget) {
      return res.status(400).json({
        success: false,
        error: 'Identical state',
        message: `Subscription '${id}' is already in state '${currentState}'. No transition required.`
      });
    }

    // STATE MACHINE VALIDATION:
    // Check if transition from currentState to canonicalTarget is permitted
    const allowedTransitions = ALLOWED_STATE_TRANSITIONS[currentState] || [];
    const isTransitionAllowed = allowedTransitions.includes(canonicalTarget);

    if (!isTransitionAllowed) {
      // REJECT INVALID JUMP
      return res.status(400).json({
        success: false,
        error: 'Invalid state transition',
        message: `Cannot transition from '${currentState}' directly to '${canonicalTarget}'. Invalid state jump rejected.`,
        details: {
          subscription_id: id,
          current_state: currentState,
          attempted_state: canonicalTarget,
          allowed_transitions: allowedTransitions,
          sequential_flow: 'Draft → Quotation → Confirmed → Active → Closed'
        }
      });
    }

    // Build Transition Audit Log
    const transitionLog = {
      from_state: currentState,
      to_state: canonicalTarget,
      timestamp: new Date(),
      actor_id: actor_id || MOCK_SALES_REP.id,
      actor_role: actor_role || 'sales_rep',
      reason: reason || (is_manual_override ? 'Manual sales representative override' : 'State lifecycle advancement'),
      is_manual_override: is_manual_override !== false
    };

    if (isFromDb) {
      subscription.status = canonicalTarget;
      subscription.transition_history.push(transitionLog);
      await subscription.save();
      const enriched = enrichSubscription(subscription.toObject());
      return res.status(200).json({
        success: true,
        message: `Subscription '${id}' successfully transitioned from '${currentState}' to '${canonicalTarget}'.`,
        data: enriched
      });
    }

    // Update in-memory record
    subscription.status = canonicalTarget;
    subscription.updatedAt = new Date();
    subscription.transition_history.push(transitionLog);

    const enriched = enrichSubscription(subscription);

    return res.status(200).json({
      success: true,
      message: `Subscription '${id}' successfully transitioned from '${currentState}' to '${canonicalTarget}'.`,
      transition: transitionLog,
      data: enriched
    });
  } catch (err) {
    console.error('Error updating subscription state:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * GET /api/subscriptions
 * Fetch all subscriptions with transition metadata & allowed next actions
 */
exports.getAllSubscriptions = async (req, res) => {
  try {
    const { status, search } = req.query;

    if (isDbConnected() && SubscriptionModel && typeof SubscriptionModel.find === 'function') {
      const query = {};
      if (status && status !== 'all') {
        const canonical = normalizeState(status);
        if (canonical) query.status = canonical;
      }
      if (search) {
        query.$or = [
          { id: { $regex: search, $options: 'i' } },
          { 'customer.name': { $regex: search, $options: 'i' } },
          { 'customer.email': { $regex: search, $options: 'i' } }
        ];
      }

      const docs = await SubscriptionModel.find(query).sort({ updatedAt: -1 });
      const enriched = docs.map((doc) => enrichSubscription(doc.toObject()));
      return res.status(200).json({
        success: true,
        count: enriched.length,
        data: enriched
      });
    }

    let results = [...subscriptionsStore];

    if (status && status !== 'all') {
      const canonical = normalizeState(status);
      if (canonical) {
        results = results.filter((s) => s.status === canonical);
      }
    }

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (s) =>
          s.id.toLowerCase().includes(q) ||
          (s.customer && s.customer.name && s.customer.name.toLowerCase().includes(q)) ||
          (s.customer && s.customer.email && s.customer.email.toLowerCase().includes(q))
      );
    }

    const enriched = results.map(enrichSubscription);

    return res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/**
 * GET /api/subscriptions/:id
 * Retrieve a single subscription with its complete transition history
 */
exports.getSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    let sub = null;
    if (isDbConnected() && SubscriptionModel && typeof SubscriptionModel.findOne === 'function') {
      sub = await SubscriptionModel.findOne({ id });
      if (sub) sub = sub.toObject();
    }

    if (!sub) {
      sub = subscriptionsStore.find((s) => s.id === id);
    }

    if (!sub) {
      return res.status(404).json({
        success: false,
        error: `Subscription with ID '${id}' not found`
      });
    }

    return res.status(200).json({
      success: true,
      data: enrichSubscription(sub)
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/**
 * POST /api/subscriptions
 * Create a new subscription starting strictly in the 'Draft' state
 */
exports.createSubscription = async (req, res) => {
  try {
    const { customer_id, plan_id, lines, grand_total, initial_notes } = req.body;

    const newId = `sub_${Date.now()}`;
    const newSubscription = {
      id: newId,
      status: SUBSCRIPTION_STATES.DRAFT, // Always starts in Draft
      customer: { ...MOCK_USER, id: customer_id || MOCK_USER.id },
      plan: {
        id: plan_id || 'plan_1',
        name: 'Enterprise Yearly Auto-Renew Plan',
        billing_frequency: 'yearly',
        closing_behavior: 'renew'
      },
      lines:
        lines && lines.length > 0
          ? lines
          : [
              {
                product_id: MOCK_PRODUCT.id,
                product_name: MOCK_PRODUCT.name,
                variant_id: 'var_1',
                variant_name: 'Dell PowerEdge Edition',
                quantity: 1,
                unit_price: MOCK_PRODUCT.sales_price,
                price_modifier: 560,
                total_amount: 1760
              }
            ],
      grand_total: Number(grand_total) || 1760,
      createdAt: new Date(),
      updatedAt: new Date(),
      transition_history: [
        {
          from_state: 'Initial',
          to_state: SUBSCRIPTION_STATES.DRAFT,
          timestamp: new Date(),
          actor_id: MOCK_SALES_REP.id,
          actor_role: 'sales_rep',
          reason: initial_notes || 'New subscription created in Draft state',
          is_manual_override: false
        }
      ]
    };

    if (isDbConnected() && SubscriptionModel && typeof SubscriptionModel.create === 'function') {
      const created = await SubscriptionModel.create(newSubscription);
      return res.status(201).json({
        success: true,
        message: 'Subscription created in Draft state',
        data: enrichSubscription(created.toObject())
      });
    }

    subscriptionsStore.unshift(newSubscription);

    return res.status(201).json({
      success: true,
      message: 'Subscription created in Draft state',
      data: enrichSubscription(newSubscription)
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

/**
 * GET /api/subscriptions/state-machine/definition
 * Returns the state machine graph, rules, and sequential stages for UI rendering
 */
exports.getStateMachineDefinition = (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      states: SUBSCRIPTION_STATES,
      sequential_flow: SEQUENTIAL_FLOW,
      allowed_transitions: ALLOWED_STATE_TRANSITIONS,
      state_metadata: {
        [SUBSCRIPTION_STATES.DRAFT]: {
          label: 'Draft',
          badge_color: 'slate',
          description: 'Initial creation stage; commercial terms and product lines are being defined.',
          icon: '📝',
          stage_number: 1
        },
        [SUBSCRIPTION_STATES.QUOTATION]: {
          label: 'Quotation',
          badge_color: 'amber',
          description: 'Official quote generated and presented to customer; awaiting acceptance.',
          icon: '📄',
          stage_number: 2
        },
        [SUBSCRIPTION_STATES.CONFIRMED]: {
          label: 'Confirmed',
          badge_color: 'blue',
          description: 'Customer accepted terms and signed; awaiting provisioning & billing activation.',
          icon: '🤝',
          stage_number: 3
        },
        [SUBSCRIPTION_STATES.ACTIVE]: {
          label: 'Active',
          badge_color: 'emerald',
          description: 'Subscription actively provisioned, operational, and running recurring billings.',
          icon: '⚡',
          stage_number: 4
        },
        [SUBSCRIPTION_STATES.CLOSED]: {
          label: 'Closed',
          badge_color: 'purple',
          description: 'Subscription completed its lifecycle, naturally expired, or decommissioned.',
          icon: '🏁',
          stage_number: 5
        },
        [SUBSCRIPTION_STATES.CANCELLED]: {
          label: 'Cancelled',
          badge_color: 'rose',
          description: 'Subscription was terminated early or rejected by either party.',
          icon: '🚫',
          stage_number: null
        }
      },
      mock_dependencies: {
        user: MOCK_USER,
        product: MOCK_PRODUCT,
        sales_rep: MOCK_SALES_REP
      }
    }
  });
};

