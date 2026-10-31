let mongoose;
try {
  mongoose = require('mongoose');
} catch (e) {
  mongoose = null;
}

/**
 * Quote Template Line Sub-schema
 * Conforms to product & variant definitions in docs/schema.json:
 * { "product_id": "prod_1", "variant_id": "var_1", "quantity": 5, "total_amount": 8888 }
 */
let QuoteTemplateModel;

if (mongoose) {
  const QuoteTemplateLineSchema = new mongoose.Schema(
    {
      line_id: {
        type: String,
        required: true,
        default: () => `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      },
      product_id: {
        type: String,
        required: [true, 'Product ID is required'],
        default: 'prod_1' // schema.json Product id
      },
      product_name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true,
        default: 'Enterprise Cloud Server'
      },
      variant_id: {
        type: String,
        default: 'var_1' // schema.json Variant id
      },
      variant_name: {
        type: String,
        default: 'High Memory Edition'
      },
      description: {
        type: String,
        default: '',
        trim: true
      },
      quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [1, 'Quantity must be at least 1'],
        default: 1
      },
      unit_price: {
        type: Number,
        required: [true, 'Unit price is required'],
        min: [0, 'Unit price cannot be negative'],
        default: 1200 // schema.json Product sales_price
      },
      price_modifier: {
        type: Number,
        default: 0 // schema.json Variant price_modifier (e.g. 560)
      },
      discount_percent: {
        type: Number,
        min: [0, 'Discount cannot be negative'],
        max: [100, 'Discount cannot exceed 100%'],
        default: 0
      },
      total_amount: {
        type: Number,
        required: true,
        default: 0
      }
    },
    { _id: false }
  );

  QuoteTemplateLineSchema.methods = {
    calculateLineTotal: function () {
      const effectiveUnitPrice = Number(this.unit_price) + Number(this.price_modifier || 0);
      const grossAmount = effectiveUnitPrice * Number(this.quantity);
      const discountAmount = grossAmount * (Number(this.discount_percent || 0) / 100);
      this.total_amount = Number((grossAmount - discountAmount).toFixed(2));
      return this.total_amount;
    }
  };

  /**
   * Quote Template Schema
   * Represents pre-configured quotation blueprints with configurable validity periods.
   * Associated with Plan (schema.json: { "id": "plan_1", "billing_frequency": "yearly", "closing_behavior": "renew" })
   * and User (schema.json: { "id": "usr_123", "email": "c@x.com", "role": "customer" })
   */
  const QuoteTemplateSchema = new mongoose.Schema(
    {
      id: {
        type: String,
        required: true,
        unique: true,
        index: true,
        default: () => `tmpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      },
      name: {
        type: String,
        required: [true, 'Quotation template name is required'],
        trim: true,
        index: true
      },
      description: {
        type: String,
        default: '',
        trim: true
      },

      // --- Validity Period Configuration ---
      validity_duration: {
        type: Number,
        required: [true, 'Validity duration in days is required'],
        min: [1, 'Validity period must be at least 1 day'],
        default: 30 // Standard default validity: 30 days
      },
      validity_unit: {
        type: String,
        enum: ['days', 'weeks', 'months'],
        default: 'days'
      },
      validity_terms: {
        type: String,
        default:
          'This quotation is valid for the specified period from the date of issue. Prices, discounts, and inventory allocations expire automatically upon conclusion of this period.'
      },

      // --- Subscription & Plan Association (schema.json) ---
      plan_id: {
        type: String,
        default: 'plan_1' // schema.json Plan
      },
      plan_name: {
        type: String,
        default: 'Yearly Auto-Renew Plan'
      },
      billing_frequency: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly'],
        default: 'yearly' // schema.json plan_1 billing_frequency
      },
      closing_behavior: {
        type: String,
        enum: ['renew', 'close', 'manual'],
        default: 'renew' // schema.json plan_1 closing_behavior
      },

      // --- Template Configuration & Rules ---
      require_signature: {
        type: Boolean,
        default: true // Odoo standard: online customer signature
      },
      require_payment: {
        type: Boolean,
        default: false // Odoo standard: optional upfront online payment
      },
      status: {
        type: String,
        enum: ['active', 'draft', 'archived'],
        default: 'active',
        index: true
      },

      // --- Line Items ---
      lines: [QuoteTemplateLineSchema],

      // --- Financial Summaries ---
      subtotal: {
        type: Number,
        default: 0
      },
      total_discount: {
        type: Number,
        default: 0
      },
      grand_total: {
        type: Number,
        default: 0
      },

      // --- Metadata / Audit (schema.json: usr_123) ---
      created_by: {
        type: String,
        default: 'usr_123'
      },
      author_name: {
        type: String,
        default: 'Sales Ops Admin'
      }
    },
    {
      timestamps: true,
      toJSON: { virtuals: true },
      toObject: { virtuals: true }
    }
  );

  QuoteTemplateSchema.virtual('validity_label').get(function () {
    return `${this.validity_duration} ${this.validity_unit || 'days'}`;
  });

  QuoteTemplateSchema.virtual('item_count').get(function () {
    return (this.lines || []).reduce((acc, line) => acc + (line.quantity || 0), 0);
  });

  QuoteTemplateSchema.methods.calculateExpirationDate = function (fromDate = new Date()) {
    const base = new Date(fromDate);
    const duration = Number(this.validity_duration) || 30;
    const unit = this.validity_unit || 'days';

    const expDate = new Date(base.getTime());
    if (unit === 'months') {
      expDate.setMonth(expDate.getMonth() + duration);
    } else if (unit === 'weeks') {
      expDate.setDate(expDate.getDate() + duration * 7);
    } else {
      expDate.setDate(expDate.getDate() + duration);
    }
    return expDate;
  };

  QuoteTemplateSchema.methods.recalculateTotals = function () {
    let subtotal = 0;
    let totalDiscount = 0;

    if (Array.isArray(this.lines)) {
      this.lines.forEach((line) => {
        const effectivePrice = Number(line.unit_price || 0) + Number(line.price_modifier || 0);
        const gross = effectivePrice * Number(line.quantity || 1);
        const discount = gross * (Number(line.discount_percent || 0) / 100);
        const net = gross - discount;

        line.total_amount = Number(net.toFixed(2));
        subtotal += gross;
        totalDiscount += discount;
      });
    }

    this.subtotal = Number(subtotal.toFixed(2));
    this.total_discount = Number(totalDiscount.toFixed(2));
    this.grand_total = Number((subtotal - totalDiscount).toFixed(2));

    return {
      subtotal: this.subtotal,
      total_discount: this.total_discount,
      grand_total: this.grand_total
    };
  };

  QuoteTemplateSchema.pre('save', function (next) {
    this.recalculateTotals();
    next();
  });

  QuoteTemplateModel = mongoose.models.QuoteTemplate || mongoose.model('QuoteTemplate', QuoteTemplateSchema);
} else {
  // Graceful fallback descriptor if mongoose is not installed in the current environment
  QuoteTemplateModel = {
    modelName: 'QuoteTemplate',
    calculateExpirationDate: function (duration = 30, unit = 'days', fromDate = new Date()) {
      const exp = new Date(fromDate);
      if (unit === 'months') exp.setMonth(exp.getMonth() + duration);
      else if (unit === 'weeks') exp.setDate(exp.getDate() + duration * 7);
      else exp.setDate(exp.getDate() + duration);
      return exp;
    }
  };
}

module.exports = QuoteTemplateModel;
