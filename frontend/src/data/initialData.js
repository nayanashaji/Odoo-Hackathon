/**
 * Unified Initial Seed Data conforming to docs/schema.json
 * Product: {"id": "prod_1", "sales_price": 1200, "cost_price": 200, "variants": [{"id": "var_1", "price_modifier": 560}]}
 * Plan: {"id": "plan_1", "billing_frequency": "yearly", "closing_behavior": "renew"}
 */

export const INITIAL_PRODUCTS = [
  {
    id: 'prod_1',
    name: 'Enterprise Dedicated Cloud Server',
    description: 'High-availability dedicated compute server with ECC memory, NVMe arrays, and hardware RAID.',
    category: 'Infrastructure',
    sales_price: 1200,
    cost_price: 200,
    status: 'active',
    variants: [
      {
        id: 'var_1',
        name: 'Brand: Dell PowerEdge R750',
        attribute: 'brand',
        value: 'Dell',
        price_modifier: 560, // docs/schema.json contract
        cost_modifier: 90,
        sku: 'SRV-DELL-R750',
        in_stock: true
      },
      {
        id: 'var_2',
        name: 'Brand: HPE ProLiant DL380 Gen10',
        attribute: 'brand',
        value: 'HPE',
        price_modifier: 620,
        cost_modifier: 110,
        sku: 'SRV-HPE-DL380',
        in_stock: true
      },
      {
        id: 'var_3',
        name: 'Brand: Supermicro Hyper Ultra',
        attribute: 'brand',
        value: 'Supermicro',
        price_modifier: 380,
        cost_modifier: 60,
        sku: 'SRV-SMC-1029',
        in_stock: true
      }
    ],
    plans: ['plan_1', 'plan_2']
  },
  {
    id: 'prod_2',
    name: 'Carrier-Grade 10G Security Gateway',
    description: 'Hardware firewall and SD-WAN gateway capable of 10 Gbps multi-threat inspection throughput.',
    category: 'Networking',
    sales_price: 450,
    cost_price: 120,
    status: 'active',
    variants: [
      {
        id: 'var_4',
        name: 'Brand: Cisco Catalyst Edge',
        attribute: 'brand',
        value: 'Cisco',
        price_modifier: 280,
        cost_modifier: 50,
        sku: 'NET-CSCO-8300',
        in_stock: true
      },
      {
        id: 'var_5',
        name: 'Brand: Juniper Networks SRX345',
        attribute: 'brand',
        value: 'Juniper',
        price_modifier: 240,
        cost_modifier: 45,
        sku: 'NET-JNPR-345',
        in_stock: true
      },
      {
        id: 'var_6',
        name: 'Brand: Ubiquiti UniFi Pro',
        attribute: 'brand',
        value: 'Ubiquiti',
        price_modifier: 120,
        cost_modifier: 25,
        sku: 'NET-UBNT-UDM',
        in_stock: true
      }
    ],
    plans: ['plan_3', 'plan_4']
  },
  {
    id: 'prod_3',
    name: 'Smart Retail Touch POS Terminal',
    description: 'Compact high-speed Point of Sale terminal with integrated scanner and thermal printer.',
    category: 'Hardware',
    sales_price: 850,
    cost_price: 300,
    status: 'active',
    variants: [
      {
        id: 'var_7',
        name: 'Brand: Elo Touch Solutions I-Series',
        attribute: 'brand',
        value: 'Elo',
        price_modifier: 220,
        cost_modifier: 40,
        sku: 'POS-ELO-I15',
        in_stock: true
      },
      {
        id: 'var_8',
        name: 'Brand: HP Engage One Pro',
        attribute: 'brand',
        value: 'HP',
        price_modifier: 310,
        cost_modifier: 55,
        sku: 'POS-HP-E1',
        in_stock: true
      }
    ],
    plans: []
  },
  {
    id: 'prod_4',
    name: 'Odoo Enterprise Suite SaaS License',
    description: 'ERP cloud software package: CRM, Subscriptions, Sales, Invoicing, and Auto-Accounting.',
    category: 'Software & SaaS',
    sales_price: 650,
    cost_price: 60,
    status: 'active',
    variants: [
      {
        id: 'var_10',
        name: 'Tier: Enterprise Platinum SLA',
        attribute: 'tier',
        value: 'Platinum',
        price_modifier: 450,
        cost_modifier: 30,
        sku: 'SAS-PLAT-247',
        in_stock: true
      },
      {
        id: 'var_11',
        name: 'Tier: Gold Priority Support',
        attribute: 'tier',
        value: 'Gold',
        price_modifier: 250,
        cost_modifier: 15,
        sku: 'SAS-GOLD-PRI',
        in_stock: true
      }
    ],
    plans: []
  },
  {
    id: 'prod_5',
    name: 'Industrial Edge AI Accelerator Box',
    description: 'Rugged fanless embedded AI box for real-time video telemetry and defect detection.',
    category: 'AI Hardware',
    sales_price: 2100,
    cost_price: 750,
    status: 'active',
    variants: [
      {
        id: 'var_12',
        name: 'Brand: NVIDIA Jetson AGX Orin 64GB',
        attribute: 'brand',
        value: 'NVIDIA',
        price_modifier: 890,
        cost_modifier: 140,
        sku: 'AI-NVDA-AGX64',
        in_stock: true
      },
      {
        id: 'var_13',
        name: 'Brand: Intel Xeon Edge VPU',
        attribute: 'brand',
        value: 'Intel',
        price_modifier: 480,
        cost_modifier: 80,
        sku: 'AI-INTL-VPU',
        in_stock: true
      }
    ],
    plans: []
  }
];

export const INITIAL_PLANS = [
  {
    id: 'plan_1',
    product_id: 'prod_1',
    name: 'Enterprise Annual ERP Suite',
    code: 'ERP-ANNUAL-VIP',
    description: 'Yearly subscription for enterprise operations with auto-renewing SLA and 24/7 dedicated support.',
    billing_frequency: 'yearly',
    minimum_quantity: 5,
    available_from: '2026-01-01',
    available_until: '2027-12-31',
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
    available_from: '2026-01-01',
    available_until: '2027-06-30',
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
    available_from: '2026-02-01',
    available_until: '2026-12-31',
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
    available_from: '2026-03-01',
    available_until: '2026-11-30',
    closing_behavior: 'close_early',
    status: 'active',
    base_price: 45
  }
];
