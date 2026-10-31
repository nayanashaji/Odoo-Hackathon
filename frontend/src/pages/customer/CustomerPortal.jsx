import React, { useState, useEffect } from 'react';
import DataTable from '../../components/DataTable';
import './CustomerPortal.css';

const money = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    amount ?? 0
  );

// Mock customer data conforming to docs/schema.json contract
// User: { "id": "usr_123", "email": "c@x.com", "role": "customer" }
const CUSTOMER_SUBSCRIPTIONS = [
  {
    id: 'sub_1',
    product_name: 'Enterprise Dedicated Cloud Server',
    product_id: 'prod_1',
    variant: 'Brand: Dell PowerEdge R750 (+$560)',
    plan: 'Yearly Enterprise Cloud SLA',
    billing_frequency: 'yearly',
    amount: 8888,
    status: 'Active',
    next_billing: '2027-10-31',
    started_at: '2026-10-31'
  },
  {
    id: 'sub_4',
    product_name: 'Carrier-Grade 10G Security Gateway',
    product_id: 'prod_2',
    variant: 'Cisco Catalyst Edge',
    plan: 'Monthly Managed Firewall',
    billing_frequency: 'monthly',
    amount: 730,
    status: 'Active',
    next_billing: '2026-11-30',
    started_at: '2026-09-15'
  }
];

const CUSTOMER_INVOICES = [
  {
    id: 'inv_1',
    date: '2026-11-02',
    description: 'Enterprise Dedicated Cloud Server - Annual Renewal',
    amount: 7568,
    status: 'Confirmed',
    due_date: '2026-11-30'
  },
  {
    id: 'inv_99',
    date: '2026-10-01',
    description: 'Carrier-Grade 10G Security Gateway - Monthly Maintenance',
    amount: 730,
    status: 'Paid',
    due_date: '2026-10-15'
  }
];

export default function CustomerPortal() {
  const [user, setUser] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem('brightloop_user') ?? 'null') || {
          id: 'usr_123',
          email: 'c@x.com',
          role: 'customer'
        }
      );
    } catch {
      return { id: 'usr_123', email: 'c@x.com', role: 'customer' };
    }
  });

  const [activeTab, setActiveTab] = useState('subscriptions'); // 'subscriptions' | 'invoices'
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Columns for Customer Subscriptions using reusable DataTable
  const subscriptionColumns = [
    {
      key: 'id',
      header: 'Subscription',
      sortable: true,
      render: (row) => (
        <div className="portal-sub-cell">
          <strong>{row.id}</strong>
          <small>{row.product_name}</small>
        </div>
      )
    },
    {
      key: 'variant',
      header: 'Configuration / Variant',
      render: (row) => <span className="portal-config-tag">{row.variant}</span>
    },
    {
      key: 'billing_frequency',
      header: 'Cycle',
      render: (row) => (
        <span className="portal-cycle-pill">{row.billing_frequency.toUpperCase()}</span>
      )
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (row) => <strong>{money(row.amount)}</strong>
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`portal-status-pill status-${row.status.toLowerCase()}`}>
          ● {row.status}
        </span>
      )
    },
    {
      key: 'next_billing',
      header: 'Next Renewal',
      render: (row) => <span>{new Date(row.next_billing).toLocaleDateString()}</span>
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (row) => (
        <button
          type="button"
          className="portal-btn-sm"
          onClick={() => showToast(`Opening management controls for ${row.id}...`)}
        >
          Manage
        </button>
      )
    }
  ];

  // Columns for Customer Invoices using reusable DataTable
  const invoiceColumns = [
    {
      key: 'id',
      header: 'Invoice #',
      sortable: true,
      render: (row) => <strong>{row.id}</strong>
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (row) => <span>{new Date(row.date).toLocaleDateString()}</span>
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => <span>{row.description}</span>
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (row) => <strong>{money(row.amount)}</strong>
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`portal-status-pill status-${row.status.toLowerCase()}`}>
          {row.status}
        </span>
      )
    },
    {
      key: 'due_date',
      header: 'Due Date',
      render: (row) => <span>{new Date(row.due_date).toLocaleDateString()}</span>
    },
    {
      key: 'receipt',
      header: 'Receipt',
      align: 'right',
      render: (row) => (
        <button
          type="button"
          className="portal-btn-sm"
          onClick={() => showToast(`Receipt for ${row.id} sent to ${user?.email}`)}
        >
          Download PDF ⇩
        </button>
      )
    }
  ];

  return (
    <div className="customer-portal-view">
      {/* Toast */}
      {toast && <div className="portal-toast">✓ {toast}</div>}

      {/* Hero Header */}
      <div className="portal-header">
        <div>
          <span className="portal-eyebrow">CUSTOMER SELF-SERVICE PORTAL</span>
          <h1>Welcome, {user?.email || 'Valued Subscriber'}</h1>
          <p>
            Review and manage your subscriptions, track payments, and inspect active cloud services.
          </p>
        </div>
        <div className="portal-customer-badge">
          <span>Customer ID:</span>
          <strong>{user?.id || 'usr_123'}</strong>
        </div>
      </div>

      {/* Quick KPI Overview */}
      <div className="portal-kpi-grid">
        <div className="portal-kpi-card">
          <span className="kpi-label">Active Subscriptions</span>
          <strong className="kpi-value">{CUSTOMER_SUBSCRIPTIONS.length}</strong>
          <small>Cloud & Security Services</small>
        </div>
        <div className="portal-kpi-card highlight">
          <span className="kpi-label">Annual Recurring Total</span>
          <strong className="kpi-value">{money(9618)}</strong>
          <small>Next charge on Nov 30, 2026</small>
        </div>
        <div className="portal-kpi-card">
          <span className="kpi-label">Open Invoices</span>
          <strong className="kpi-value">1</strong>
          <small className="text-warning">{money(7568)} due</small>
        </div>
        <div className="portal-kpi-card">
          <span className="kpi-label">Service Health</span>
          <strong className="kpi-value text-success">99.98%</strong>
          <small>All systems operational</small>
        </div>
      </div>

      {/* Tabs */}
      <div className="portal-tabs-row">
        <button
          type="button"
          className={`portal-tab ${activeTab === 'subscriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('subscriptions')}
        >
          My Subscriptions ({CUSTOMER_SUBSCRIPTIONS.length})
        </button>
        <button
          type="button"
          className={`portal-tab ${activeTab === 'invoices' ? 'active' : ''}`}
          onClick={() => setActiveTab('invoices')}
        >
          Invoices & Receipts ({CUSTOMER_INVOICES.length})
        </button>
      </div>

      {/* Standardized DataTable Views */}
      {activeTab === 'subscriptions' ? (
        <DataTable
          title="Active Subscription Services"
          subtitle="All subscribed recurring software and dedicated infrastructure products."
          columns={subscriptionColumns}
          data={CUSTOMER_SUBSCRIPTIONS}
          searchable={true}
          searchPlaceholder="Search your subscriptions..."
          pagination={false}
        />
      ) : (
        <DataTable
          title="Invoices & Billing History"
          subtitle="Historical billing statements, confirmation dates, and receipts."
          columns={invoiceColumns}
          data={CUSTOMER_INVOICES}
          searchable={true}
          searchPlaceholder="Search invoices..."
          pagination={false}
        />
      )}
    </div>
  );
}
