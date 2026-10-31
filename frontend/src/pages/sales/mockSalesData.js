/**
 * Frontend Mock Sales Data
 * Conforms directly to docs/schema.json:
 * {
 *   "User": { "id": "usr_123", "email": "c@x.com", "role": "customer" },
 *   "Product": { "id": "prod_1", "sales_price": 1200, "cost_price": 200, "variants": [{ "id": "var_1", "price_modifier": 560 }] },
 *   "Plan": { "id": "plan_1", "billing_frequency": "yearly", "closing_behavior": "renew" },
 *   "Discount": { "id": "disc_1", "type": "percentage", "value": 15, "usage_limit": 50, "applies_to": "subscription" }
 * }
 */

export const MOCK_AUTH_USERS = [
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

export const MOCK_PRODUCT_CATALOG = [
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
        price_modifier: 560 // schema.json: +560 => $1760 total
      },
      {
        id: 'var_2',
        name: 'HPE ProLiant Standard Edition',
        attribute: 'hardware_tier',
        value: 'HPE ProLiant',
        price_modifier: 320 // => $1520 total
      },
      {
        id: 'var_base',
        name: 'Standard Virtual Instance',
        attribute: 'hardware_tier',
        value: 'Standard',
        price_modifier: 0 // => $1200 base
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

export const MOCK_SUBSCRIPTION_PLANS = [
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

export const MOCK_VALIDITY_PRESETS = [
  { label: '7 Days', value: 7, desc: 'Urgent / Flash Offer' },
  { label: '15 Days', value: 15, desc: 'Promotional Campaign' },
  { label: '30 Days', value: 30, desc: 'Standard Odoo Default' },
  { label: '60 Days', value: 60, desc: 'Enterprise Procurement Tender' },
  { label: '90 Days', value: 90, desc: 'Quarterly Fixed Rate' }
];

export const INITIAL_QUOTE_TEMPLATES = [
  {
    id: 'tmpl_annual_enterprise',
    name: 'Enterprise Cloud & Server Package',
    description: 'Standard quote template for enterprise customers requiring dedicated infrastructure, Dell PowerEdge nodes, and annual renewal.',
    validity_duration: 30,
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
        description: 'Primary cloud compute node with Dell PowerEdge tier',
        quantity: 5,
        unit_price: 1200,
        price_modifier: 560,
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
    createdAt: '2026-10-15T09:00:00Z',
    updatedAt: '2026-10-15T09:00:00Z'
  },
  {
    id: 'tmpl_quick_consult',
    name: 'Fast-Track SaaS Starter (15-Day Flash Validity)',
    description: 'Promotional SaaS quote template with accelerated 15-day expiration window.',
    validity_duration: 15,
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
        price_modifier: 150,
        discount_percent: 10,
        total_amount: 5400.00
      }
    ],
    subtotal: 6000.00,
    total_discount: 600.00,
    grand_total: 5400.00,
    createdAt: '2026-10-20T11:30:00Z',
    updatedAt: '2026-10-20T11:30:00Z'
  },
  {
    id: 'tmpl_quarterly_standard',
    name: 'Long-Lead Infrastructure Tender (60-Day Validity)',
    description: 'Formal procurement template designed for government and enterprise tenders requiring extended approval cycles.',
    validity_duration: 60,
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
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z'
  }
];

export function computeValidityForecast(durationDays = 30, fromDate = new Date()) {
  const base = new Date(fromDate);
  const dur = Math.max(1, parseInt(durationDays, 10) || 30);
  const exp = new Date(base.getTime());
  exp.setDate(exp.getDate() + dur);

  const now = new Date();
  const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));

  return {
    duration_days: dur,
    quotation_date_formatted: base.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    expiration_date_formatted: exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    raw_expiration: exp,
    days_remaining: diffDays,
    is_expired: diffDays <= 0
  };
}

export default function MockSalesDataPage() {
  return null;
}


