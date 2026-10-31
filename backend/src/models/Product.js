const mongoose = require('mongoose');

/**
 * Product Variant Sub-schema
 * Conforms to docs/schema.json:
 * { "id": "var_1", "price_modifier": 560 }
 */
const VariantSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      default: () => `var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    },
    name: {
      type: String,
      required: true,
      trim: true // e.g., "Brand: Dell" or "Dell PowerEdge Edition"
    },
    attribute: {
      type: String,
      default: 'brand', // e.g., "brand", "color", "tier", "storage"
      trim: true
    },
    value: {
      type: String,
      required: true,
      trim: true // e.g., "Dell", "HPE", "Enterprise"
    },
    price_modifier: {
      type: Number,
      required: true,
      default: 0 // Amount added to base sales_price (e.g., +560)
    },
    cost_modifier: {
      type: Number,
      default: 0 // Optional modifier for cost_price
    },
    sku: {
      type: String,
      default: ''
    },
    in_stock: {
      type: Boolean,
      default: true
    }
  },
  { _id: false }
);

/**
 * Product Schema
 * Conforms to docs/schema.json:
 * {
 *   "id": "prod_1",
 *   "sales_price": 1200,
 *   "cost_price": 200,
 *   "variants": [{ "id": "var_1", "price_modifier": 560 }],
 *   "plans": ["plan_1"]
 * }
 */
const ProductSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    category: {
      type: String,
      default: 'General',
      trim: true
    },
    sales_price: {
      type: Number,
      required: [true, 'Sales price is required'],
      min: [0, 'Sales price cannot be negative'],
      default: 0
    },
    cost_price: {
      type: Number,
      required: [true, 'Cost price is required'],
      min: [0, 'Cost price cannot be negative'],
      default: 0
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'draft'],
      default: 'active'
    },
    variants: [VariantSchema],
    // Association: A Product can have multiple Plans associated with it
    plans: [
      {
        type: String,
        ref: 'Plan',
        trim: true
      }
    ]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual: Base Profit Margin
ProductSchema.virtual('profit_margin').get(function () {
  return Number((this.sales_price - this.cost_price).toFixed(2));
});

// Virtual: Margin Percentage
ProductSchema.virtual('profit_margin_percentage').get(function () {
  if (!this.sales_price || this.sales_price === 0) return 0;
  return Number((((this.sales_price - this.cost_price) / this.sales_price) * 100).toFixed(1));
});

/**
 * Helper: Calculate price for a given variant
 * Returns { basePrice, priceModifier, finalPrice }
 */
ProductSchema.methods.calculateVariantPrice = function (variantId) {
  if (!variantId) {
    return {
      base_sales_price: this.sales_price,
      price_modifier: 0,
      final_sales_price: this.sales_price,
      variant: null
    };
  }

  const variant = this.variants.find((v) => v.id === variantId);
  if (!variant) {
    const error = new Error(`Variant ${variantId} not found on product ${this.id}`);
    error.statusCode = 404;
    throw error;
  }

  const modifier = Number(variant.price_modifier) || 0;
  return {
    base_sales_price: this.sales_price,
    variant_id: variant.id,
    variant_name: variant.name,
    attribute: variant.attribute,
    value: variant.value,
    price_modifier: modifier,
    final_sales_price: Number((this.sales_price + modifier).toFixed(2))
  };
};

module.exports = mongoose.models.Product || mongoose.model('Product', ProductSchema);
