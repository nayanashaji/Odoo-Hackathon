import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import './dashboard.css';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';
const money = amount => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount ?? 0);

function RevenueChart({ rows }) {
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      const found = rows.find(row => row.year === date.getFullYear() && row.month === date.getMonth() + 1);
      return { label: date.toLocaleString('en', { month: 'short' }), amount: found?.amount ?? 0 };
    });
  }, [rows]);
  const max = Math.max(...months.map(item => item.amount), 1);
  return <div className="finance-chart" role="img" aria-label="Revenue collected over the last six months">
    {months.map((item, index) => <div className="finance-chart-column" key={`${item.label}-${index}`} title={`${item.label}: ${money(item.amount)}`}><div className={`finance-bar ${index === months.length - 1 ? 'current' : ''}`} style={{ height: `${Math.max(item.amount / max * 100, 3)}%` }} /><span>{item.label}</span></div>)}
  </div>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('brightloop_user') ?? 'null'); } catch { return null; } });

  useEffect(() => {
    const token = localStorage.getItem('brightloop_token');
    if (!token) { setState('signed-out'); return; }
    let active = true;
    setState('loading'); setError('');
    fetch(`${API}/finance/summary?period=${period}`, { headers: { authorization: `Bearer ${token}` } })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error ?? 'Unable to load dashboard.'); return body; })
      .then(body => { if (active) { setData(body); setState('ready'); } })
      .catch(reason => { if (active) { setError(reason.message); setState('error'); } });
    return () => { active = false; };
  }, [period, refresh]);

  function signOut() { localStorage.removeItem('brightloop_token'); localStorage.removeItem('brightloop_user'); setUser(null); navigate('/login'); }
  if (state === 'signed-out') return <Navigate to="/login" replace />;

  const metrics = data?.metrics;

  // Standardized DataTable column definitions for Overdue Invoices
  const overdueInvoiceColumns = [
    {
      key: 'id',
      header: 'Invoice #',
      sortable: true,
      render: invoice => <strong>{invoice.id}</strong>
    },
    {
      key: 'due_date',
      header: 'Due Date',
      sortable: true,
      render: invoice => new Date(invoice.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    },
    {
      key: 'status',
      header: 'Status',
      render: () => <span className="finance-status-pill">Overdue</span>
    },
    {
      key: 'grand_total',
      header: 'Amount Due',
      align: 'right',
      sortable: true,
      render: invoice => <span className="finance-amount-cell">{money(invoice.grand_total)}</span>
    }
  ];

  return (
    <div className="finance-dashboard-wrapper">
      <div className="finance-page-title">
        <div>
          <p className="finance-eyebrow">FINANCE</p>
          <h1>Overview</h1>
          <p>A clear view of your subscription business.</p>
        </div>
        <div className="finance-title-actions">
          <button className="finance-outline-button" onClick={() => window.print()}>⇩ <span>Export</span></button>
          <select aria-label="Report period" value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="month">This month</option>
            <option value="year">This year</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {state === 'loading' && <div className="finance-loading"><span className="finance-spinner" /> Loading finance data…</div>}
      {state === 'error' && <div className="finance-error-box" role="alert"><strong>We couldn’t load the dashboard</strong><p>{error}</p><button className="finance-outline-button" onClick={() => setRefresh(value => value + 1)}>Try again</button></div>}

      {state === 'ready' && metrics && (
        <>
          <section className="finance-metrics-grid" aria-label="Finance summary">
            <article className="finance-metric-card">
              <div className="finance-metric-top"><span>Active subscriptions</span><span className="finance-metric-icon mint">▤</span></div>
              <strong>{metrics.activeSubscriptions.toLocaleString()}</strong>
              <small>Currently active</small>
            </article>
            <article className="finance-metric-card">
              <div className="finance-metric-top"><span>Revenue received</span><span className="finance-metric-icon blue">↗</span></div>
              <strong>{money(metrics.revenue)}</strong>
              <small>{metrics.paymentCount} payments in selected period</small>
            </article>
            <article className="finance-metric-card">
              <div className="finance-metric-top"><span>Outstanding invoices</span><span className="finance-metric-icon amber">◷</span></div>
              <strong>{money(metrics.outstandingAmount)}</strong>
              <small>{metrics.outstandingInvoiceCount} invoices awaiting payment</small>
            </article>
            <article className="finance-metric-card">
              <div className="finance-metric-top"><span>Overdue invoices</span><span className="finance-metric-icon rose">!</span></div>
              <strong>{metrics.overdueInvoiceCount}</strong>
              <small>Past their due date</small>
            </article>
          </section>

          <section className="finance-lower-grid">
            <article className="finance-panel finance-revenue-panel">
              <div className="finance-panel-head">
                <div><h2>Revenue collected</h2><p>Payment totals over the last six months</p></div>
                <span className="finance-legend"><i /> Received</span>
              </div>
              <RevenueChart rows={data.revenueByMonth} />
              <div className="finance-chart-foot">
                <span>Last 6 months</span>
                <span className="finance-total-received">{money(metrics.revenue)} <small>in selected period</small></span>
              </div>
            </article>

            <article className="finance-panel finance-collection-panel">
              <div className="finance-panel-head">
                <div><h2>Collections</h2><p>Invoice payment status</p></div>
                <span className="finance-dots">···</span>
              </div>
              <div className="finance-donut-wrap">
                <div className="finance-donut">
                  <div><strong>{metrics.outstandingInvoiceCount}</strong><small>open invoices</small></div>
                </div>
              </div>
              <div className="finance-collection-legend">
                <span><i className="paid-dot" />Paid invoice total<strong>{money(metrics.paidInvoiceTotal)}</strong></span>
                <span><i className="open-dot" />Still outstanding<strong>{money(metrics.outstandingAmount)}</strong></span>
              </div>
            </article>
          </section>

          {/* Standardized DataTable component for overdue invoices list */}
          <div style={{ marginTop: '20px' }}>
            <DataTable
              title="Overdue Invoices"
              subtitle="Follow up on payments past their due date."
              columns={overdueInvoiceColumns}
              data={data.overdueInvoices}
              searchable={true}
              searchPlaceholder="Search overdue invoices..."
              emptyMessage="You’re all caught up. No overdue invoices found."
              emptyIcon="✓"
              pagination={false}
            />
          </div>

          <footer className="finance-page-footer">Brightloop Finance <span>Data updates when you change the reporting period.</span></footer>
        </>
      )}
    </div>
  );
}
