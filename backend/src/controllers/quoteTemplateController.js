const QuoteTemplate = require('../models/QuoteTemplate');

// ============================================================================
// MOCKED EXTERNAL DATA DEPENDENCIES
// (Required because Core Auth and Product Catalog domains are in development)
// Directly conforms to docs/schema.json
// ============================================================================

/**
 * Mock Auth Users
 * Conforms to schema.json: { "User": { "id": "usr_123", "email": "c@x.com", "role": "customer" } }
 */
const MOCK_USERS = [
  {
    id: 'usr_123',
    name: 'Claire Dupont',
    email: 'c@x.com',
    role: 'customer',
    company: 'Nexus Innovations Ltd',
    phone: '+1 (555) 234-5678'
  },
  {
    id: 'usr_sales_101',
    name: 'Marcus Vance',
    email: 'marcus.v@brightloop.io',
    role: 'sales_rep',
    team: 'Enterprise Subscriptions'
  },
  {
    id: 'usr_sales_102',
    name: 'Aria Sterling',
    email: 'aria.s@brightloop.io',
    role: 'sales_manager',
    team: 'Direct Sales EMEA'
  }
];

/**
 * Mock Product Catalog with Variants
 * Conforms to schema.json:
 * {
 *   "Product": {
 *     "id": "prod_1",
 *     "sales_price": 1200,
 *     "cost_price": 200,
 *     "variants": [{ "id": "var_1", "price_modifier": 560 }]
 *   }
 * }
 */
const MOCK_PRODUCTS = [
  {
    id: 'prod_1',
    name: 'Brightloop Enterprise Cloud Server',
    description: 'High-availability cloud compute node with dedicated memory allocation.',
    category: 'Infrastructure',
    sales_price: 1200,
    cost_price: 200,
    variants: [
      {
        id: 'var_1',
        name: 'Dell PowerEdge / Enterprise Tier',
        attribute: 'hardware_tier',
        value: 'Dell PowerEdge',
        price_modifier: 560 // as defined in schema.json
      },
      {
        id: 'var_2',
        name: 'HPE ProLiant Standard Edition',
        attribute: 'hardware_tier',
        value: 'HPE ProLiant',
        price_modifier: 320
      },
      {
        id: 'var_base',
        name: 'Standard Virtual Instance',
        attribute: 'hardware_tier',
        value: 'Standard',
        price_modifier: 0
      }
    ]
  },
  {
    id: 'prod_2',
    name: 'Brightloop SaaS Platform License',
    description: 'Annual per-seat SaaS application license including updates.',
    category: 'Software',
    sales_price: 450,
    cost_price: 50,
    variants: [
      {
        id: 'var_license_pro',
        name: 'Professional Seat (Unlimited API)',
        attribute: 'license_tier',
        value: 'Pro',
        price_modifier: 150
      },
      {
        id: 'var_license_std',
        name: 'Standard Seat',
        attribute: 'license_tier',
        value: 'Standard',
        price_modifier: 0
      }
    ]
  },
  {
    id: 'prod_3',
    name: '24/7 Mission Critical SLA & Support',
    description: 'Priority incident response time under 15 minutes with dedicated engineer.',
    category: 'Services',
    sales_price: 800,
    cost_price: 120,
    variants: [
      {
        id: 'var_sla_gold',
        name: 'Gold Response (15 min response)',
        attribute: 'sla_level',
        value: 'Gold',
        price_modifier: 400
      },
      {
        id: 'var_sla_silver',
        name: 'Silver Response (1 hour response)',
        attribute: 'sla_level',
        value: 'Silver',
        price_modifier: 0
      }
    ]
  }
];

/**
 * Mock Subscription Plans
 * Conforms to schema.json: { "Plan": { "id": "plan_1", "billing_frequency": "yearly", "closing_behavior": "renew" } }
 */
const MOCK_PLANS = [
  {
    id: 'plan_1',
    name: 'Enterprise Yearly Auto-Renew Plan',
    billing_frequency: 'yearly',
    closing_behavior: 'renew',
    description: 'Billed annually with automatic contract renewal.'
  },
  {
    id: 'plan_2',
    name: 'Standard Monthly Flexible Plan',
    billing_frequency: 'monthly',
    closing_behavior: 'manual',
    description: 'Billed monthly with flexible cancellation.'
  },
  {
    id: 'plan_3',
    name: 'Fixed-Term Annual Project Plan',
    billing_frequency: 'yearly',
    closing_behavior: 'close',
    description: 'Billed yearly, automatically closes at end of term without renewing.'
  }
];

/**
 * Mock Discounts
 * Conforms to schema.json: { "Discount": { "id": "disc_1", "type": "percentage", "value": 15, "usage_limit": 50, "applies_to": "subscription" } }
 */
const MOCK_DISCOUNTS = [
  {
    id: 'disc_1',
    code: 'ANNUAL15',
    type: 'percentage',
    value: 15,
    usage_limit: 50,
    applies_to: 'subscription',
    description: '15% upfront discount on annual subscription quotation templates.'
  },
  {
    id: 'disc_2',
    code: 'WELCOME10',
    type: 'percentage',
    value: 10,
    usage_limit: 100,
    applies_to: 'subscription',
    description: '10% onboarding discount for new quotations.'
  }
];

// ============================================================================
// IN-MEMORY DATA STORE (Resilient Fallback for testing / standalone execution)
// Pre-seeded with quotation templates featuring diverse validity periods
// ============================================================================

let memoryTemplates = [
  {
    id: 'tmpl_annual_enterprise',
    name: 'Enterprise Cloud & Server Package',
    description: 'Default quote template for enterprise clients requiring dedicated infrastructure and annual renewals.',
    validity_duration: 30, // 30 days validity
    validity_unit: 'days',
    validity_terms: 'This quotation is strictly valid for 30 calendar days from the date of presentation. Hardware allocations and discounted rate structures remain guaranteed within this period.',
    plan_id: 'plan_1',
    plan_name: 'Enterprise Yearly Auto-Renew Plan',
    billing_frequency: 'yearly',
    closing_behavior: 'renew',
    require_signature: true,
    require_payment: true,
    status: 'active',
    created_by: 'usr_123',
    author_name: 'Marcus Vance',
    lines: [
      {
        line_id: 'line_init_1',
        product_id: 'prod_1',
        product_name: 'Brightloop Enterprise Cloud Server',
        variant_id: 'var_1',
        variant_name: 'Dell PowerEdge / Enterprise Tier',
        description: 'Primary cloud node with Dell PowerEdge hardware configuration',
        quantity: 5,
        unit_price: 1200,
        price_modifier: 560, // 1200 + 560 = 1760 unit
        discount_percent: 0,
        total_amount: 8800.00
      },
      {
        line_id: 'line_init_2',
        product_id: 'prod_3',
        product_name: '24/7 Mission Critical SLA & Support',
        variant_id: 'var_sla_gold',
        variant_name: 'Gold Response (15 min response)',
        description: 'Priority Gold Support SLA tier',
        quantity: 1,
        unit_price: 800,
        price_modifier: 400,
        discount_percent: 15, // matching disc_1
        total_amount: 1020.00
      }
    ],
    subtotal: 10000.00,
    total_discount: 180.00,
    grand_total: 9820.00,
    createdAt: new Date('2026-10-15T09:00:00Z'),
    updatedAt: new Date('2026-10-15T09:00:00Z')
  },
  {
    id: 'tmpl_quick_consult',
    name: 'Fast-Track SaaS Starter (15-Day Flash Validity)',
    description: 'Short-validity template for promotional time-limited software licenses.',
    validity_duration: 15, // 15 days validity
    validity_unit: 'days',
    validity_terms: 'Promotional pricing is locked for 15 days. Unaccepted quotations expire at 23:59 on the 15th day.',
    plan_id: 'plan_2',
    plan_name: 'Standard Monthly Flexible Plan',
    billing_frequency: 'monthly',
    closing_behavior: 'manual',
    require_signature: true,
    require_payment: false,
    status: 'active',
    created_by: 'usr_123',
    author_name: 'Aria Sterling',
    lines: [
      {
        line_id: 'line_init_3',
        product_id: 'prod_2',
        product_name: 'Brightloop SaaS Platform License',
        variant_id: 'var_license_pro',
        variant_name: 'Professional Seat (Unlimited API)',
        description: '10 Professional user seats',
        quantity: 10,
        unit_price: 450,
        price_modifier: 150, // 600 per seat
        discount_percent: 10,
        total_amount: 5400.00
      }
    ],
    subtotal: 6000.00,
    total_discount: 600.00,
    grand_total: 5400.00,
    createdAt: new Date('2026-10-20T11:30:00Z'),
    updatedAt: new Date('2026-10-20T11:30:00Z')
  },
  {
    id: 'tmpl_quarterly_standard',
    name: 'Long-Lead Infrastructure Tender (60-Day Validity)',
    description: 'Formal procurement template designed for government and large enterprise tenders requiring extended approval cycles.',
    validity_duration: 60, // 60 days validity
    validity_unit: 'days',
    validity_terms: 'Tender validity holds firm for 60 calendar days to accommodate committee review cycles. Price escalator clauses waived.',
    plan_id: 'plan_1',
    plan_name: 'Enterprise Yearly Auto-Renew Plan',
    billing_frequency: 'yearly',
    closing_behavior: 'renew',
    require_signature: true,
    require_payment: true,
    status: 'active',
    created_by: 'usr_123',
    author_name: 'Marcus Vance',
    lines: [
      {
        line_id: 'line_init_4',
        product_id: 'prod_1',
        product_name: 'Brightloop Enterprise Cloud Server',
        variant_id: 'var_2',
        variant_name: 'HPE ProLiant Standard Edition',
        description: 'HPE ProLiant baseline node',
        quantity: 2,
        unit_price: 1200,
        price_modifier: 320,
        discount_percent: 5,
        total_amount: 2888.00
      }
    ],
    subtotal: 3040.00,
    total_discount: 152.00,
    grand_total: 2888.00,
    createdAt: new Date('2026-10-01T08:00:00Z'),
    updatedAt: new Date('2026-10-01T08:00:00Z')
  }
];

// Helper: Check if MongoDB connection is active
function isDbConnected() {
  try {
    const mongoose = require('mongoose');
    return mongoose && mongoose.connection && mongoose.connection.readyState === 1;
  } catch (e) {
    return false;
  }
}

// Helper: Calculate validity and expiration
function computeValidityDetails(duration, unit = 'days', baseDate = new Date()) {
  const from = new Date(baseDate);
  const dur = Math.max(1, parseInt(duration, 10) || 30);
  const exp = new Date(from.getTime());

  if (unit === 'months') {
    exp.setMonth(exp.getMonth() + dur);
  } else if (unit === 'weeks') {
    exp.setDate(exp.getDate() + dur * 7);
  } else {
    exp.setDate(exp.getDate() + dur);
  }

  const now = new Date();
  const timeDiff = exp.getTime() - now.getTime();
  const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
  const isExpired = timeDiff <= 0;

  return {
    validity_duration: dur,
    validity_unit: unit,
    quotation_date: from.toISOString(),
    expiration_date: exp.toISOString(),
    days_remaining: daysRemaining,
    is_expired: isExpired,
    status_label: isExpired ? 'Expired' : daysRemaining <= 3 ? 'Expiring Soon' : 'Valid',
    formatted_validity: `${dur} ${unit}`,
    expiration_clause: `Quotation valid until ${exp.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} (${dur} ${unit} from issuance).`
  };
}

// Helper: Calculate totals from lines
function calculateTemplateFinancials(lines = []) {
  let subtotal = 0;
  let totalDiscount = 0;

  const processedLines = lines.map((line, idx) => {
    // Resolve product & variant pricing if missing
    let unitPrice = Number(line.unit_price);
    let modifier = Number(line.price_modifier || 0);

    if (isNaN(unitPrice) || unitPrice <= 0) {
      const matchedProd = MOCK_PRODUCTS.find((p) => p.id === line.product_id);
      if (matchedProd) {
        unitPrice = matchedProd.sales_price;
        const matchedVar = (matchedProd.variants || []).find((v) => v.id === line.variant_id);
        if (matchedVar) modifier = matchedVar.price_modifier;
      } else {
        unitPrice = 1200; // schema.json default
      }
    }

    const qty = Math.max(1, Number(line.quantity) || 1);
    const disc = Math.min(100, Math.max(0, Number(line.discount_percent) || 0));
    const effectivePrice = unitPrice + modifier;
    const gross = effectivePrice * qty;
    const discAmount = gross * (disc / 100);
    const net = gross - discAmount;

    subtotal += gross;
    totalDiscount += discAmount;

    return {
      line_id: line.line_id || `line_${Date.now()}_${idx}`,
      product_id: line.product_id || 'prod_1',
      product_name: line.product_name || 'Enterprise Product',
      variant_id: line.variant_id || 'var_1',
      variant_name: line.variant_name || 'Standard Variant',
      description: line.description || '',
      quantity: qty,
      unit_price: Number(unitPrice.toFixed(2)),
      price_modifier: Number(modifier.toFixed(2)),
      discount_percent: disc,
      total_amount: Number(net.toFixed(2))
    };
  });

  return {
    lines: processedLines,
    subtotal: Number(subtotal.toFixed(2)),
    total_discount: Number(totalDiscount.toFixed(2)),
    grand_total: Number((subtotal - totalDiscount).toFixed(2))
  };
}

// ============================================================================
// CONTROLLER HANDLERS
// ============================================================================

/**
 * GET /api/quote-templates/mock-dependencies
 * Provides frontend components with mock user profiles, product variants, and plan options
 */
exports.getMockDependencies = (req, res) => {
  return res.json({
    success: true,
    message: 'External mock dependencies (Auth Users, Products with Variants, Plans, Discounts)',
    data: {
      users: MOCK_USERS,
      products: MOCK_PRODUCTS,
      plans: MOCK_PLANS,
      discounts: MOCK_DISCOUNTS,
      default_customer: MOCK_USERS[0], // usr_123
      default_product: MOCK_PRODUCTS[0], // prod_1 with var_1
      validity_presets: [
        { label: '7 Days (Urgent / Flash Offer)', value: 7, unit: 'days' },
        { label: '15 Days (Promotional Campaign)', value: 15, unit: 'days' },
        { label: '30 Days (Standard Industry Default)', value: 30, unit: 'days' },
        { label: '60 Days (Tender / Enterprise Procurement)', value: 60, unit: 'days' },
        { label: '90 Days (Quarterly Fixed Price)', value: 90, unit: 'days' }
      ]
    }
  });
};

/**
 * POST /api/quote-templates/calculate-validity
 * Standalone calculation helper for previewing quotation expiration
 */
exports.calculateValidity = (req, res) => {
  try {
    const { validity_duration = 30, validity_unit = 'days', quotation_date = new Date() } = req.body;
    const result = computeValidityDetails(validity_duration, validity_unit, quotation_date);

    return res.json({
      success: true,
      data: result
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/quote-templates
 * List all quotation templates with optional search and validity filters
 */
exports.getQuoteTemplates = async (req, res) => {
  try {
    const { status, search, min_validity, max_validity } = req.query;

    if (isDbConnected()) {
      const query = {};
      if (status && status !== 'all') query.status = status;
      if (search) query.name = { $regex: search, $options: 'i' };
      if (min_validity || max_validity) {
        query.validity_duration = {};
        if (min_validity) query.validity_duration.$gte = Number(min_validity);
        if (max_validity) query.validity_duration.$lte = Number(max_validity);
      }

      const templates = await QuoteTemplate.find(query).sort({ updatedAt: -1 });
      const enriched = templates.map((t) => {
        const obj = t.toObject ? t.toObject() : t;
        const validityInfo = computeValidityDetails(obj.validity_duration, obj.validity_unit, obj.createdAt);
        return { ...obj, validity_details: validityInfo };
      });

      return res.json({ success: true, count: enriched.length, data: enriched });
    }

    // In-Memory Fallback
    let results = [...memoryTemplates];
    if (status && status !== 'all') {
      results = results.filter((t) => t.status.toLowerCase() === status.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (t) => t.name.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q))
      );
    }
    if (min_validity) {
      results = results.filter((t) => t.validity_duration >= Number(min_validity));
    }
    if (max_validity) {
      results = results.filter((t) => t.validity_duration <= Number(max_validity));
    }

    // Enrich with calculated validity preview
    const enriched = results.map((t) => ({
      ...t,
      validity_details: computeValidityDetails(t.validity_duration, t.validity_unit, t.createdAt)
    }));

    return res.json({ success: true, count: enriched.length, data: enriched });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/quote-templates/:id
 * Retrieve a single template by ID with full line items and validity forecast
 */
exports.getQuoteTemplateById = async (req, res) => {
  try {
    const { id } = req.params;

    let template = null;
    if (isDbConnected()) {
      template = await QuoteTemplate.findOne({ id });
      if (!template && mongoose.Types.ObjectId.isValid(id)) {
        template = await QuoteTemplate.findById(id);
      }
      if (template) template = template.toObject();
    } else {
      template = memoryTemplates.find((t) => t.id === id);
    }

    if (!template) {
      return res.status(404).json({ success: false, error: `Quote template with ID '${id}' not found` });
    }

    const validityDetails = computeValidityDetails(
      template.validity_duration,
      template.validity_unit,
      template.createdAt
    );

    return res.json({
      success: true,
      data: {
        ...template,
        validity_details: validityDetails
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/quote-templates
 * Create a new quotation template with validity configuration and line items
 */
exports.createQuoteTemplate = async (req, res) => {
  try {
    const {
      name,
      description = '',
      validity_duration = 30,
      validity_unit = 'days',
      validity_terms,
      plan_id = 'plan_1',
      require_signature = true,
      require_payment = false,
      status = 'active',
      lines = [],
      created_by = 'usr_123'
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Quotation template name is required.' });
    }

    const dur = parseInt(validity_duration, 10);
    if (isNaN(dur) || dur < 1) {
      return res.status(400).json({ success: false, error: 'Validity duration must be at least 1 day.' });
    }

    // Resolve Plan info from mock
    const matchedPlan = MOCK_PLANS.find((p) => p.id === plan_id) || MOCK_PLANS[0];
    const matchedUser = MOCK_USERS.find((u) => u.id === created_by) || MOCK_USERS[0];

    // Compute line items and totals
    const financials = calculateTemplateFinancials(lines);

    const defaultTerms =
      validity_terms ||
      `This quotation is valid for ${dur} ${validity_unit} from the date of issue. Prices, discounts, and inventory allocations expire automatically upon conclusion of this period.`;

    const templateData = {
      id: `tmpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      description: description.trim(),
      validity_duration: dur,
      validity_unit,
      validity_terms: defaultTerms,
      plan_id: matchedPlan.id,
      plan_name: matchedPlan.name,
      billing_frequency: matchedPlan.billing_frequency,
      closing_behavior: matchedPlan.closing_behavior,
      require_signature: Boolean(require_signature),
      require_payment: Boolean(require_payment),
      status,
      created_by: matchedUser.id,
      author_name: matchedUser.name,
      lines: financials.lines,
      subtotal: financials.subtotal,
      total_discount: financials.total_discount,
      grand_total: financials.grand_total,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (isDbConnected()) {
      const created = await QuoteTemplate.create(templateData);
      return res.status(201).json({
        success: true,
        message: 'Quotation template created successfully',
        data: created
      });
    }

    // In-memory create
    memoryTemplates.unshift(templateData);
    return res.status(201).json({
      success: true,
      message: 'Quotation template created successfully (in-memory mode)',
      data: templateData
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

/**
 * PUT /api/quote-templates/:id
 * Update an existing quotation template, its validity duration, or lines
 */
exports.updateQuoteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.validity_duration !== undefined) {
      const dur = parseInt(updates.validity_duration, 10);
      if (isNaN(dur) || dur < 1) {
        return res.status(400).json({ success: false, error: 'Validity duration must be a positive integer.' });
      }
      updates.validity_duration = dur;
    }

    // Recompute totals if lines or discounts were modified
    if (updates.lines) {
      const financials = calculateTemplateFinancials(updates.lines);
      updates.lines = financials.lines;
      updates.subtotal = financials.subtotal;
      updates.total_discount = financials.total_discount;
      updates.grand_total = financials.grand_total;
    }

    if (updates.plan_id) {
      const matchedPlan = MOCK_PLANS.find((p) => p.id === updates.plan_id);
      if (matchedPlan) {
        updates.plan_name = matchedPlan.name;
        updates.billing_frequency = matchedPlan.billing_frequency;
        updates.closing_behavior = matchedPlan.closing_behavior;
      }
    }

    updates.updatedAt = new Date();

    if (isDbConnected()) {
      const updated = await QuoteTemplate.findOneAndUpdate({ id }, updates, { new: true });
      if (!updated) {
        return res.status(404).json({ success: false, error: `Quote template '${id}' not found` });
      }
      return res.json({ success: true, message: 'Template updated successfully', data: updated });
    }

    const idx = memoryTemplates.findIndex((t) => t.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: `Quote template '${id}' not found` });
    }

    memoryTemplates[idx] = { ...memoryTemplates[idx], ...updates };
    return res.json({
      success: true,
      message: 'Template updated successfully',
      data: memoryTemplates[idx]
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

/**
 * DELETE /api/quote-templates/:id
 * Delete a template
 */
exports.deleteQuoteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    if (isDbConnected()) {
      const deleted = await QuoteTemplate.findOneAndDelete({ id });
      if (!deleted) {
        return res.status(404).json({ success: false, error: `Quote template '${id}' not found` });
      }
      return res.json({ success: true, message: `Template '${id}' deleted successfully` });
    }

    const initialLen = memoryTemplates.length;
    memoryTemplates = memoryTemplates.filter((t) => t.id !== id);
    if (memoryTemplates.length === initialLen) {
      return res.status(404).json({ success: false, error: `Quote template '${id}' not found` });
    }

    return res.json({ success: true, message: `Template '${id}' deleted successfully` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/quote-templates/:id/duplicate
 * Clones a quote template with "(Copy)" suffix and preserved validity settings
 */
exports.duplicateQuoteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    let source = null;
    if (isDbConnected()) {
      source = await QuoteTemplate.findOne({ id });
      if (source) source = source.toObject();
    } else {
      source = memoryTemplates.find((t) => t.id === id);
    }

    if (!source) {
      return res.status(404).json({ success: false, error: `Source template '${id}' not found` });
    }

    const cloned = {
      ...source,
      _id: undefined,
      id: `tmpl_${Date.now()}_copy`,
      name: `${source.name} (Copy)`,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (isDbConnected()) {
      const created = await QuoteTemplate.create(cloned);
      return res.status(201).json({
        success: true,
        message: 'Template duplicated successfully',
        data: created
      });
    }

    memoryTemplates.unshift(cloned);
    return res.status(201).json({
      success: true,
      message: 'Template duplicated successfully',
      data: cloned
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/quote-templates/:id/preview-quote
 * Simulates generating an active Sales Quotation from this template with dynamic validity period
 */
exports.previewQuoteFromTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { quotation_date = new Date(), customer_id = 'usr_123' } = req.body;

    let template = null;
    if (isDbConnected()) {
      template = await QuoteTemplate.findOne({ id });
      if (template) template = template.toObject();
    } else {
      template = memoryTemplates.find((t) => t.id === id);
    }

    if (!template) {
      return res.status(404).json({ success: false, error: `Quote template '${id}' not found` });
    }

    // Mock Customer from Auth
    const customer = MOCK_USERS.find((u) => u.id === customer_id) || MOCK_USERS[0];

    // Compute dynamic expiration date
    const validityDetails = computeValidityDetails(
      template.validity_duration,
      template.validity_unit,
      quotation_date
    );

    // Simulated Quote Document (conforms to subscription schema.json)
    const quoteSimulation = {
      quote_number: `SO-SIM-${Math.floor(1000 + Math.random() * 9000)}`,
      template_id: template.id,
      template_name: template.name,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        company: customer.company || 'Customer Corp'
      },
      order_date: validityDetails.quotation_date,
      expiration_date: validityDetails.expiration_date,
      validity_period_days: validityDetails.validity_duration,
      validity_status: validityDetails.status_label,
      days_remaining: validityDetails.days_remaining,
      terms_and_conditions: template.validity_terms,
      subscription_plan: {
        plan_id: template.plan_id,
        plan_name: template.plan_name,
        billing_frequency: template.billing_frequency,
        closing_behavior: template.closing_behavior
      },
      lines: template.lines,
      financials: {
        subtotal: template.subtotal,
        total_discount: template.total_discount,
        grand_total: template.grand_total
      },
      requires_online_signature: template.require_signature,
      requires_online_payment: template.require_payment
    };

    return res.json({
      success: true,
      data: quoteSimulation
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
