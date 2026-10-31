/**
 * Valid Billing Frequencies (Strict business rule)
 */
const VALID_BILLING_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

/**
 * Valid Closing Behaviors (Strict business rule)
 * - 'renew': Automatically renews at the end of billing cycle (matches docs/schema.json)
 * - 'close_on_own': Closes on its own upon expiry/term completion
 * - 'close_early': Closes early upon trigger or subscriber request
 * - 'pause': Pauses subscription for review at the end of cycle
 */
const VALID_CLOSING_BEHAVIORS = ['renew', 'close_on_own', 'close_early', 'pause'];

let Plan = null;

try {
  const mongoose = require('mongoose');

  /**
   * Plan Schema conforming to docs/schema.json contract:
   * {
   *   "Plan": {
   *     "id": "plan_1",
   *     "billing_frequency": "yearly",
   *     "closing_behavior": "renew"
   *   }
   * }
   */
  const PlanSchema = new mongoose.Schema(
    {
      id: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
        default: () => `plan_${Date.now()}`
      },
      name: {
        type: String,
        required: [true, 'Plan name is required'],
        trim: true
      },
      code: {
        type: String,
        uppercase: true,
        trim: true,
        default: function () {
          return (this.name || 'PLAN')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '-')
            .slice(0, 15);
        }
      },
      description: {
        type: String,
        default: '',
        trim: true
      },
      // Associated Product Reference
      product_id: {
        type: String,
        ref: 'Product',
        default: null,
        trim: true
      },
      // Strictly enforced dropdown: daily, weekly, monthly, yearly
      billing_frequency: {
        type: String,
        required: [true, 'Billing frequency is required'],
        enum: {
          values: VALID_BILLING_FREQUENCIES,
          message: '{VALUE} is not a valid billing frequency. Must be daily, weekly, monthly, or yearly.'
        },
        lowercase: true,
        trim: true
      },
      // Strictly enforced minimum quantity >= 1
      minimum_quantity: {
        type: Number,
        required: [true, 'Minimum quantity is required'],
        min: [1, 'Minimum quantity must be at least 1'],
        default: 1
      },
      // Available dates range
      available_from: {
        type: Date,
        required: [true, 'Available from date is required'],
        default: Date.now
      },
      available_until: {
        type: Date,
        required: [true, 'Available until date is required']
      },
      // Closing behavior setting: renew, close_on_own, close_early, pause
      closing_behavior: {
        type: String,
        required: [true, 'Closing behavior is required'],
        enum: {
          values: VALID_CLOSING_BEHAVIORS,
          message: '{VALUE} is not a valid closing behavior. Must be renew, close_on_own, close_early, or pause.'
        },
        default: 'renew',
        lowercase: true,
        trim: true
      },
      status: {
        type: String,
        enum: ['active', 'paused', 'archived'],
        default: 'active'
      },
      base_price: {
        type: Number,
        min: [0, 'Base price cannot be negative'],
        default: 0
      }
    },
    {
      timestamps: true,
      toJSON: { virtuals: true },
      toObject: { virtuals: true }
    }
  );

  // Date consistency validation: available_until must be on or after available_from
  PlanSchema.pre('validate', function (next) {
    if (this.available_from && this.available_until) {
      const fromTime = new Date(this.available_from).getTime();
      const untilTime = new Date(this.available_until).getTime();

      if (untilTime < fromTime) {
        this.invalidate(
          'available_until',
          'Available until date must be on or after available from date.'
        );
      }
    }

    if (this.minimum_quantity < 1) {
      this.invalidate('minimum_quantity', 'Minimum quantity must be at least 1.');
    }

    next();
  });

  // Virtual: Check if plan is currently active and within available dates
  PlanSchema.virtual('is_currently_available').get(function () {
    if (this.status !== 'active') return false;
    const now = new Date();
    const start = new Date(this.available_from);
    const end = new Date(this.available_until);
    return now >= start && now <= end;
  });

  // Virtual: Formatted closing behavior description
  PlanSchema.virtual('closing_behavior_label').get(function () {
    switch (this.closing_behavior) {
      case 'renew':
        return 'Auto-Renews at Period End';
      case 'close_on_own':
        return 'Closes On Its Own Upon Expiry';
      case 'close_early':
        return 'Closes Early (Early Exit Allowed)';
      case 'pause':
        return 'Pauses Upon Expiry for Review';
      default:
        return this.closing_behavior;
    }
  });

  Plan = mongoose.models.Plan || mongoose.model('Plan', PlanSchema);
} catch (e) {
  // If mongoose is not yet installed in node_modules, export stub class
  Plan = class PlanFallback {
    constructor(data) {
      Object.assign(this, data);
    }
    static async find() { return []; }
    static async findOne() { return null; }
    static async findOneAndUpdate() { return null; }
    static async findOneAndDelete() { return null; }
    async save() { return this; }
  };
}

module.exports = {
  Plan,
  VALID_BILLING_FREQUENCIES,
  VALID_CLOSING_BEHAVIORS
};
