/**
 * Subscription Model & State Machine Definition
 * Conforms to docs/schema.json:
 * {
 *   "User": { "id": "usr_123", "email": "c@x.com", "role": "customer" },
 *   "Product": { "id": "prod_1", "sales_price": 1200, "cost_price": 200, "variants": [{ "id": "var_1", "price_modifier": 560 }] },
 *   "Subscription": { "id": "sub_1", "status": "Active", "lines": [{ "product_id": "prod_1", "quantity": 5, "total_amount": 8888 }] }
 * }
 */

// Canonical Lifecycle States
const SUBSCRIPTION_STATES = {
  DRAFT: 'Draft',
  QUOTATION: 'Quotation',
  CONFIRMED: 'Confirmed',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled'
};

// Sequential State Transition Engine:
// Draft -> Quotation -> Confirmed -> Active -> Closed
// Cancellation allowed from pre-closed states; Closed is terminal.
const ALLOWED_STATE_TRANSITIONS = {
  [SUBSCRIPTION_STATES.DRAFT]: [SUBSCRIPTION_STATES.QUOTATION, SUBSCRIPTION_STATES.CANCELLED],
  [SUBSCRIPTION_STATES.QUOTATION]: [SUBSCRIPTION_STATES.CONFIRMED, SUBSCRIPTION_STATES.DRAFT, SUBSCRIPTION_STATES.CANCELLED],
  [SUBSCRIPTION_STATES.CONFIRMED]: [SUBSCRIPTION_STATES.ACTIVE, SUBSCRIPTION_STATES.QUOTATION, SUBSCRIPTION_STATES.CANCELLED],
  [SUBSCRIPTION_STATES.ACTIVE]: [SUBSCRIPTION_STATES.CLOSED, SUBSCRIPTION_STATES.CANCELLED],
  [SUBSCRIPTION_STATES.CLOSED]: [], // Terminal state
  [SUBSCRIPTION_STATES.CANCELLED]: [SUBSCRIPTION_STATES.DRAFT] // Allow reopening to Draft if authorized
};

// Sequential primary progression order for pipeline progress
const SEQUENTIAL_FLOW = [
  SUBSCRIPTION_STATES.DRAFT,
  SUBSCRIPTION_STATES.QUOTATION,
  SUBSCRIPTION_STATES.CONFIRMED,
  SUBSCRIPTION_STATES.ACTIVE,
  SUBSCRIPTION_STATES.CLOSED
];

let mongoose;
try {
  mongoose = require('mongoose');
} catch (e) {
  mongoose = null;
}

let SubscriptionModel;

if (mongoose) {
  const SubscriptionLineSchema = new mongoose.Schema(
    {
      product_id: {
        type: String,
        required: true,
        default: 'prod_1'
      },
      product_name: {
        type: String,
        default: 'Enterprise Cloud Server'
      },
      variant_id: {
        type: String,
        default: 'var_1'
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
      },
      unit_price: {
        type: Number,
        required: true,
        default: 1200
      },
      total_amount: {
        type: Number,
        required: true,
        default: 1200
      }
    },
    { _id: false }
  );

  const StateTransitionLogSchema = new mongoose.Schema(
    {
      from_state: {
        type: String,
        required: true
      },
      to_state: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      actor_id: {
        type: String,
        default: 'usr_sales_1'
      },
      actor_role: {
        type: String,
        default: 'sales_rep'
      },
      reason: {
        type: String,
        default: 'State transition'
      },
      is_manual_override: {
        type: Boolean,
        default: false
      }
    },
    { _id: false }
  );

  const SubscriptionSchema = new mongoose.Schema(
    {
      id: {
        type: String,
        required: true,
        unique: true,
        index: true,
        default: () => `sub_${Date.now()}`
      },
      status: {
        type: String,
        enum: Object.values(SUBSCRIPTION_STATES),
        default: SUBSCRIPTION_STATES.DRAFT,
        index: true
      },
      customer: {
        id: { type: String, default: 'usr_123' },
        name: { type: String, default: 'Claire Dupont' },
        email: { type: String, default: 'c@x.com' },
        role: { type: String, default: 'customer' }
      },
      plan: {
        id: { type: String, default: 'plan_1' },
        name: { type: String, default: 'Annual Enterprise Subscription' },
        billing_frequency: { type: String, default: 'yearly' },
        closing_behavior: { type: String, default: 'renew' }
      },
      lines: [SubscriptionLineSchema],
      grand_total: {
        type: Number,
        default: 8888
      },
      transition_history: [StateTransitionLogSchema]
    },
    {
      timestamps: true,
      toJSON: { virtuals: true },
      toObject: { virtuals: true }
    }
  );

  // Helper method on document instance to check if transition is allowed
  SubscriptionSchema.methods.canTransitionTo = function (targetState) {
    const allowed = ALLOWED_STATE_TRANSITIONS[this.status] || [];
    return allowed.includes(targetState);
  };

  // Helper method to get allowed next states
  SubscriptionSchema.methods.getAllowedTransitions = function () {
    return ALLOWED_STATE_TRANSITIONS[this.status] || [];
  };

  // Execute transition
  SubscriptionSchema.methods.applyStateTransition = function (targetState, metadata = {}) {
    if (!this.canTransitionTo(targetState)) {
      const allowed = this.getAllowedTransitions();
      const err = new Error(
        `Invalid state transition: Cannot transition from '${this.status}' to '${targetState}'. ` +
        `Allowed transitions from '${this.status}' are: [${allowed.join(', ') || 'None (Terminal state)'}].`
      );
      err.statusCode = 400;
      throw err;
    }

    const previousState = this.status;
    this.status = targetState;

    this.transition_history.push({
      from_state: previousState,
      to_state: targetState,
      timestamp: new Date(),
      actor_id: metadata.actor_id || 'usr_123',
      actor_role: metadata.actor_role || 'sales_rep',
      reason: metadata.reason || 'Manual sales override',
      is_manual_override: metadata.is_manual_override !== false
    });

    return this;
  };

  SubscriptionModel = mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);
} else {
  // In-memory model descriptor
  SubscriptionModel = {
    modelName: 'Subscription'
  };
}

module.exports = {
  SubscriptionModel,
  SUBSCRIPTION_STATES,
  ALLOWED_STATE_TRANSITIONS,
  SEQUENTIAL_FLOW
};

