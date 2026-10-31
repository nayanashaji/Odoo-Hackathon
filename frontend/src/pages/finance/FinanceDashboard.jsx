import { useEffect, useMemo, useState } from 'react';
import './financeDashboard.css';

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

export default function FinanceDashboard() {
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

  function signOut() { localStorage.removeItem('brightloop_token'); localStorage.removeItem('brightloop_user'); setUser(null); setState('signed-out'); }
  if (state === 'signed-out') return <main className="finance-gate"><div className="finance-gate-card"><span className="finance-logo-icon">b</span><p className="finance-eyebrow">BRIGHTLOOP FINANCE</p><h1>Sign in to view your dashboard</h1><p>Finance summaries are available to admin and staff accounts.</p><a href="/auth.html">Go to sign in <span>→</span></a></div></main>;

  const metrics = data?.metrics;
  return <div className="finance-app-shell">
    <aside className="finance-sidebar"><a className="finance-brand" href="#top"><span className="finance-logo-icon">b</span><span>brightloop</span></a><div className="finance-workspace"><span className="finance-workspace-icon">B</span><span><strong>Brightloop Software</strong><small>Workspace</small></span><b className="finance-chevron">⌄</b></div><p className="finance-nav-label">WORKSPACE</p><a className="finance-nav-item" href="#overview"><span>◫</span> Overview</a><a className="finance-nav-item" href="#subscriptions"><span>▤</span> Subscriptions</a><a className="finance-nav-item" href="#invoices"><span>▧</span> Invoices</a><a className="finance-nav-item active" href="#finance"><span>▥</span> Finance</a><div className="finance-sidebar-bottom"><div className="finance-help-box"><span>✳</span><strong>Need a hand?</strong><small>Visit the help center for guidance.</small><a href="mailto:support@brightloop.example">Get support ↗</a></div><button className="finance-profile" onClick={signOut}><span className="finance-avatar">{user?.email?.[0]?.toUpperCase() ?? 'N'}</span><span><strong>{user?.email ?? 'Finance team'}</strong><small>{user?.role ?? 'Staff'}</small></span><span className="finance-profile-menu">⋯</span></button></div></aside>
    <main className="finance-main" id="top"><header className="finance-topbar"><div className="finance-breadcrumb">Workspace <span>/</span> Finance</div><button className="finance-avatar tiny" aria-label="Sign out" onClick={signOut}>{user?.email?.[0]?.toUpperCase() ?? 'N'}</button></header>
      <div className="finance-content"><div className="finance-page-title"><div><p className="finance-eyebrow">FINANCE</p><h1>Overview</h1><p>A clear view of your subscription business.</p></div><div className="finance-title-actions"><button className="finance-outline-button" onClick={() => window.print()}>⇩ <span>Export</span></button><select aria-label="Report period" value={period} onChange={e => setPeriod(e.target.value)}><option value="month">This month</option><option value="year">This year</option><option value="all">All time</option></select></div></div>
      {state === 'loading' && <div className="finance-loading"><span className="finance-spinner" /> Loading finance data…</div>}
      {state === 'error' && <div className="finance-error-box" role="alert"><strong>We couldn’t load the dashboard</strong><p>{error}</p><button className="finance-outline-button" onClick={() => setRefresh(value => value + 1)}>Try again</button></div>}
      {state === 'ready' && <>
        <section className="finance-metrics-grid" aria-label="Finance summary">
          <article className="finance-metric-card"><div className="finance-metric-top"><span>Active subscriptions</span><span className="finance-metric-icon mint">▤</span></div><strong>{metrics.activeSubscriptions.toLocaleString()}</strong><small>Currently active</small></article>
          <article className="finance-metric-card"><div className="finance-metric-top"><span>Revenue received</span><span className="finance-metric-icon blue">↗</span></div><strong>{money(metrics.revenue)}</strong><small>{metrics.paymentCount} payments in selected period</small></article>
          <article className="finance-metric-card"><div className="finance-metric-top"><span>Outstanding invoices</span><span className="finance-metric-icon amber">◷</span></div><strong>{money(metrics.outstandingAmount)}</strong><small>{metrics.outstandingInvoiceCount} invoices awaiting payment</small></article>
          <article className="finance-metric-card"><div className="finance-metric-top"><span>Overdue invoices</span><span className="finance-metric-icon rose">!</span></div><strong>{metrics.overdueInvoiceCount}</strong><small>Past their due date</small></article>
        </section>
        <section className="finance-lower-grid"><article className="finance-panel finance-revenue-panel"><div className="finance-panel-head"><div><h2>Revenue collected</h2><p>Payment totals over the last six months</p></div><span className="finance-legend"><i /> Received</span></div><RevenueChart rows={data.revenueByMonth} /><div className="finance-chart-foot"><span>Last 6 months</span><span className="finance-total-received">{money(metrics.revenue)} <small>in selected period</small></span></div></article>
          <article className="finance-panel finance-collection-panel"><div className="finance-panel-head"><div><h2>Collections</h2><p>Invoice payment status</p></div><span className="finance-dots">···</span></div><div className="finance-donut-wrap"><div className="finance-donut"><div><strong>{metrics.outstandingInvoiceCount}</strong><small>open invoices</small></div></div></div><div className="finance-collection-legend"><span><i className="paid-dot" />Paid invoice total<strong>{money(metrics.paidInvoiceTotal)}</strong></span><span><i className="open-dot" />Still outstanding<strong>{money(metrics.outstandingAmount)}</strong></span></div></article></section>
        <section className="finance-panel finance-overdue-panel"><div className="finance-panel-head"><div><h2>Overdue invoices</h2><p>Follow up on payments past their due date.</p></div><a href="#invoices" className="finance-view-all">View invoices <span>→</span></a></div>
          {data.overdueInvoices.length ? <div className="finance-table-wrap"><table><thead><tr><th>Invoice</th><th>Due date</th><th>Status</th><th>Amount</th></tr></thead><tbody>{data.overdueInvoices.map(invoice => <tr key={invoice.id}><td><strong>{invoice.id}</strong></td><td>{new Date(invoice.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td><span className="finance-status-pill">Overdue</span></td><td className="finance-amount-cell">{money(invoice.grand_total)}</td></tr>)}</tbody></table></div> : <div className="finance-empty-state"><span>✓</span><strong>You’re all caught up</strong><p>No overdue invoices found.</p></div>}
        </section><footer className="finance-page-footer">Brightloop Finance <span>Data updates when you change the reporting period.</span></footer>
      </>}
      </div></main>
  </div>;
}
