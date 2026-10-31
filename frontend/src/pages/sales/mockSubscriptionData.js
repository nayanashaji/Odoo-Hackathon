/**
 * Client-Side Mock Subscription Data & State Machine Configuration
 * Conforms to docs/schema.json:
 * {
 *   "User": { "id": "usr_123", "email": "c@x.com", "role": "customer" },
 *   "Product": { "id": "prod_1", "sales_price": 1200, "cost_price": 200, "variants": [{ "id": "var_1", "price_modifier": 560 }] },
 *   "Subscription": { "id": "sub_1", "status": "Active", "lines": [{ "product_id": "prod_1", "quantity": 5, "total_amount": 8888 }] }
 * }
 */

export const SUBSCRIPTION_STATES = {
  DRAFT: 'Draft',
  QUOTATION: 'Quotation',
  CONFIRMED: 'Confirmed',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled'
};

export const SEQUENTIAL_STAGES = [
  SUBSCRIPTION_STATES.DRAFT,
  SUBSCRIPTION_STATES.QUOTATION,
  SUBSCRIPTION_STATES.CONFIRMED,
  SUBSCRIPTION_STATES.ACTIVE,
  SUBSCRIPTION_STATES.CLOSED
];

export const ALLOWED_STATE_TRANSITIONS = {
  [SUBSCRIPTION_STATES.DRAFT]: [SUBSCRIPTION_STATES.QUOTATION, SUBSCRIPTION_STATES.CANCELLED],
  [SUBSCRIPTION_STATES.QUOTATION]: [SUBSCRIPTION_STATES.CONFIRMED, SUBSCRIPTION_STATES.DRAFT, SUBSCRIPTION_STATES.CANCELLED],
  [SUBSCRIPTION_STATES.CONFIRMED]: [SUBSCRIPTION_STATES.ACTIVE, SUBSCRIPTION_STATES.QUOTATION, SUBSCRIPTION_STATES.CANCELLED],
  [SUBSCRIPTION_STATES.ACTIVE]: [SUBSCRIPTION_STATES.CLOSED, SUBSCRIPTION_STATES.CANCELLED],
  [SUBSCRIPTION_STATES.CLOSED]: [], // Terminal state
  [SUBSCRIPTION_STATES.CANCELLED]: [SUBSCRIPTION_STATES.DRAFT] // Allow reopening
};

export const STATE_CONFIG = {
  [SUBSCRIPTION_STATES.DRAFT]: {
    label: 'Draft',
    theme: 'slate',
    icon: '📝',
    badgeClass: 'badge-draft',
    stepNumber: 1,
    description: 'Initial draft being formulated by sales representative.'
  },
  [SUBSCRIPTION_STATES.QUOTATION]: {
    label: 'Quotation',
    theme: 'amber',
    icon: '📄',
    badgeClass: 'badge-quotation',
    stepNumber: 2,
    description: 'Formally presented quotation awaiting customer approval.'
  },
  [SUBSCRIPTION_STATES.CONFIRMED]: {
    label: 'Confirmed',
    theme: 'blue',
    icon: '🤝',
    badgeClass: 'badge-confirmed',
    stepNumber: 3,
    description: 'Customer approved & signed; awaiting hardware/service provisioning.'
  },
  [SUBSCRIPTION_STATES.ACTIVE]: {
    label: 'Active',
    theme: 'emerald',
    icon: '⚡',
    badgeClass: 'badge-active',
    stepNumber: 4,
    description: 'Fully active subscription with live recurring billing.'
  },
  [SUBSCRIPTION_STATES.CLOSED]: {
    label: 'Closed',
    theme: 'purple',
    icon: '🏁',
    badgeClass: 'badge-closed',
    stepNumber: 5,
    description: 'Subscription contract finished or successfully concluded.'
  },
  [SUBSCRIPTION_STATES.CANCELLED]: {
    label: 'Cancelled',
    theme: 'rose',
    icon: '🚫',
    badgeClass: 'badge-cancelled',
    stepNumber: null,
    description: 'Terminated early by sales override or customer cancellation.'
  }
};

export const MOCK_USER = {
  id: 'usr_123',
  name: 'Claire Dupont',
  email: 'c@x.com',
  role: 'customer',
  company: 'Nexus Innovations Ltd'
};

export const MOCK_PRODUCT = {
  id: 'prod_1',
  name: 'Brightloop Enterprise Cloud Server',
  sales_price: 1200,
  cost_price: 200,
  variants: [
    { id: 'var_1', name: 'Dell PowerEdge Edition', price_modifier: 560 }
  ]
};

export const INITIAL_SUBSCRIPTIONS = [
  {
    id: 'sub_1', // Direct match to docs/schema.json
    status: SUBSCRIPTION_STATES.ACTIVE,
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
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-15T14:30:00Z',
    transition_history: [
      {
        from_state: 'Initial',
        to_state: SUBSCRIPTION_STATES.DRAFT,
        timestamp: '2026-10-01T10:00:00Z',
        actor_id: 'usr_sales_101',
        actor_role: 'sales_rep',
        reason: 'Subscription agreement initiated',
        is_manual_override: false
      },
      {
        from_state: SUBSCRIPTION_STATES.DRAFT,
        to_state: SUBSCRIPTION_STATES.QUOTATION,
        timestamp: '2026-10-05T11:00:00Z',
        actor_id: 'usr_sales_101',
        actor_role: 'sales_rep',
        reason: 'Quotation sent to Claire Dupont (usr_123)',
        is_manual_override: false
      },
      {
        from_state: SUBSCRIPTION_STATES.QUOTATION,
        to_state: SUBSCRIPTION_STATES.CONFIRMED,
        timestamp: '2026-10-10T09:15:00Z',
        actor_id: 'usr_123',
        actor_role: 'customer',
        reason: 'Customer online signature approved quote terms',
        is_manual_override: false
      },
      {
        from_state: SUBSCRIPTION_STATES.CONFIRMED,
        to_state: SUBSCRIPTION_STATES.ACTIVE,
        timestamp: '2026-10-15T14:30:00Z',
        actor_id: 'usr_sales_101',
        actor_role: 'sales_rep',
        reason: 'Provisioned cloud node and activated live billing',
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
    createdAt: '2026-10-31T08:00:00Z',
    updatedAt: '2026-10-31T08:00:00Z',
    transition_history: [
      {
        from_state: 'Initial',
        to_state: SUBSCRIPTION_STATES.DRAFT,
        timestamp: '2026-10-31T08:00:00Z',
        actor_id: 'usr_sales_101',
        actor_role: 'sales_rep',
        reason: 'Draft subscription created',
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
    createdAt: '2026-10-25T09:30:00Z',
    updatedAt: '2026-10-26T14:00:00Z',
    transition_history: [
      {
        from_state: 'Initial',
        to_state: SUBSCRIPTION_STATES.DRAFT,
        timestamp: '2026-10-25T09:30:00Z',
        actor_id: 'usr_sales_101',
        actor_role: 'sales_rep',
        reason: 'Draft initiated',
        is_manual_override: false
      },
      {
        from_state: SUBSCRIPTION_STATES.DRAFT,
        to_state: SUBSCRIPTION_STATES.QUOTATION,
        timestamp: '2026-10-26T14:00:00Z',
        actor_id: 'usr_sales_101',
        actor_role: 'sales_rep',
        reason: 'Quotation sent to client for review',
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
    createdAt: '2026-10-20T11:00:00Z',
    updatedAt: '2026-10-28T16:20:00Z',
    transition_history: [
      {
        from_state: 'Initial',
        to_state: SUBSCRIPTION_STATES.DRAFT,
        timestamp: '2026-10-20T11:00:00Z',
        actor_id: 'usr_sales_101',
        actor_role: 'sales_rep',
        reason: 'Initial setup',
        is_manual_override: false
      },
      {
        from_state: SUBSCRIPTION_STATES.DRAFT,
        to_state: SUBSCRIPTION_STATES.QUOTATION,
        timestamp: '2026-10-22T10:00:00Z',
        actor_id: 'usr_sales_101',
        actor_role: 'sales_rep',
        reason: 'Quote transmitted',
        is_manual_override: false
      },
      {
        from_state: SUBSCRIPTION_STATES.QUOTATION,
        to_state: SUBSCRIPTION_STATES.CONFIRMED,
        timestamp: '2026-10-28T16:20:00Z',
        actor_id: 'usr_sales_101',
        actor_role: 'sales_rep',
        reason: 'Customer accepted contract; pending activation',
        is_manual_override: false
      }
    ]
  },
  {
    id: 'sub_5',
    status: SUBSCRIPTION_STATES.CLOSED,
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
    createdAt: '2025-10-01T09:00:00Z',
    updatedAt: '2026-10-01T09:00:00Z',
    transition_history: [
      {
        from_state: SUBSCRIPTION_STATES.ACTIVE,
        to_state: SUBSCRIPTION_STATES.CLOSED,
        timestamp: '2026-10-01T09:00:00Z',
        actor_id: 'usr_sales_101',
        actor_role: 'sales_rep',
        reason: 'Annual contract reached completion; closed without renewal',
        is_manual_override: false
      }
    ]
  }
];

// Helper to determine the next sequential step
export function getNextSequentialState(currentState) {
  const idx = SEQUENTIAL_STAGES.indexOf(currentState);
  if (idx >= 0 && idx < SEQUENTIAL_STAGES.length - 1) {
    return SEQUENTIAL_STAGES[idx + 1];
  }
  return null;
}

