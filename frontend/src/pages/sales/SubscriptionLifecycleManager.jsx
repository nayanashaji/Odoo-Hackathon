import React, { useState, useEffect } from 'react';
import SubscriptionStateBadge from './SubscriptionStateBadge';
import SubscriptionStateStepper from './SubscriptionStateStepper';
import SubscriptionOverrideModal from './SubscriptionOverrideModal';
import SubscriptionTransitionTimeline from './SubscriptionTransitionTimeline';
import {
  INITIAL_SUBSCRIPTIONS,
  SUBSCRIPTION_STATES,
  SEQUENTIAL_STAGES,
  ALLOWED_STATE_TRANSITIONS,
  STATE_CONFIG,
  getNextSequentialState,
  MOCK_USER,
  MOCK_PRODUCT
} from './mockSubscriptionData';
import './SubscriptionState.css';

const API_BASE_URL = 'http://localhost:5000/api/subscriptions';

/**
 * SubscriptionLifecycleManager
 * Internal sales representative UI for monitoring and controlling the subscription lifecycle.
 * Vite + React compatible, confined strictly to pages/sales/.
 */
export default function SubscriptionLifecycleManager() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubForOverride, setSelectedSubForOverride] = useState(null);
  const [selectedSubForTimeline, setSelectedSubForTimeline] = useState(null);
  const [toast, setToast] = useState(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Fetch subscriptions from backend or use mock data
  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_BASE_URL);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setSubscriptions(json.data);
          setIsBackendConnected(true);
          setLoading(false);
          return;
        }
      }
      throw new Error('Backend response not OK');
    } catch (err) {
      console.warn('Backend server not detected; using offline state machine mock:', err);
      setSubscriptions(INITIAL_SUBSCRIPTIONS);
      setIsBackendConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  // Core State Machine Transition Execution (Calls PUT /api/subscriptions/:id/state)
  const handleTransitionState = async (id, targetState, metadata = {}) => {
    if (isBackendConnected) {
      try {
        const res = await fetch(`${API_BASE_URL}/${id}/state`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state: targetState,
            reason: metadata.reason,
            is_manual_override: metadata.is_manual_override
          })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          // Engine rejected transition
          const errMsg = data.message || `Failed to transition to ${targetState}`;
          showToast(`❌ ${errMsg}`, 'error');
          return { success: false, message: errMsg };
        }

        // Successfully transitioned
        setSubscriptions((prev) =>
          prev.map((sub) => (sub.id === id ? data.data : sub))
        );
        showToast(`✓ Subscription ${id} transitioned to '${targetState}'`);
        return { success: true, data: data.data };
      } catch (err) {
        console.warn('Network call failed, applying state machine locally:', err);
      }
    }

    // Local in-memory state machine execution (identical rules)
    const targetSub = subscriptions.find((s) => s.id === id);
    if (!targetSub) {
      return { success: false, message: 'Subscription not found' };
    }

    const currentState = targetSub.status;
    const allowed = ALLOWED_STATE_TRANSITIONS[currentState] || [];

    // Strictly enforce rejection of invalid jumps
    if (!allowed.includes(targetState)) {
      const errMsg = `Cannot transition from '${currentState}' directly to '${targetState}'. Invalid state jump rejected. Allowed: [${allowed.join(', ') || 'None'}].`;
      showToast(`❌ ${errMsg}`, 'error');
      return { success: false, message: errMsg };
    }

    const updatedSub = {
      ...targetSub,
      status: targetState,
      updatedAt: new Date().toISOString(),
      transition_history: [
        ...(targetSub.transition_history || []),
        {
          from_state: currentState,
          to_state: targetState,
          timestamp: new Date().toISOString(),
          actor_id: 'usr_sales_101',
          actor_role: 'sales_rep',
          reason: metadata.reason || `Advanced to ${targetState}`,
          is_manual_override: metadata.is_manual_override !== false
        }
      ]
    };

    setSubscriptions((prev) =>
      prev.map((sub) => (sub.id === id ? updatedSub : sub))
    );
    showToast(`✓ Subscription ${id} transitioned to '${targetState}'`);
    return { success: true, data: updatedSub };
  };

  // Quick sequential advance: pushes to the next sequential stage (Draft -> Quotation -> Confirmed -> Active -> Closed)
  const handleQuickAdvance = (sub) => {
    const nextState = getNextSequentialState(sub.status);
    if (!nextState) {
      showToast(`Subscription ${sub.id} is in terminal state '${sub.status}'.`, 'info');
      return;
    }
    handleTransitionState(sub.id, nextState, {
      reason: `Quick sequential advancement to ${nextState}`,
      is_manual_override: false
    });
  };

  // Cancel subscription action
  const handleQuickCancel = (sub) => {
    if (!window.confirm(`Are you sure you want to cancel subscription ${sub.id}?`)) return;
    handleTransitionState(sub.id, SUBSCRIPTION_STATES.CANCELLED, {
      reason: 'Sales representative manual cancellation',
      is_manual_override: true
    });
  };

  // Create new subscription starting in Draft
  const handleCreateNewSubscription = async () => {
    const newId = `sub_${Date.now()}`;
    const newSub = {
      id: newId,
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
          product_id: MOCK_PRODUCT.id,
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      transition_history: [
        {
          from_state: 'Initial',
          to_state: SUBSCRIPTION_STATES.DRAFT,
          timestamp: new Date().toISOString(),
          actor_id: 'usr_sales_101',
          actor_role: 'sales_rep',
          reason: 'Created new subscription in Draft state',
          is_manual_override: false
        }
      ]
    };

    if (isBackendConnected) {
      try {
        const res = await fetch(API_BASE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSub)
        });
        if (res.ok) {
          const json = await res.json();
          setSubscriptions((prev) => [json.data, ...prev]);
          showToast(`Created new subscription ${newId} in Draft state`);
          return;
        }
      } catch (err) {
        console.warn('Backend call failed, creating locally:', err);
      }
    }

    setSubscriptions((prev) => [newSub, ...prev]);
    showToast(`Created new subscription ${newId} in Draft state`);
  };

  // Filter subscriptions
  const filteredSubscriptions = subscriptions.filter((sub) => {
    const matchesFilter = activeFilter === 'ALL' || sub.status === activeFilter;
    const matchesSearch =
      sub.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sub.customer?.name && sub.customer.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (sub.customer?.email && sub.customer.email.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  // Calculate KPI stats
  const countByState = (state) => subscriptions.filter((s) => s.status === state).length;

  return (
    <div className="subscription-lifecycle-dashboard">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification toast-${toast.type}`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="lifecycle-header">
        <div className="header-meta">
          <span className="domain-crumb">Sales & Operations • Subscription Domain</span>
          <h2>Subscription Lifecycle State Machine</h2>
          <p className="domain-desc">
            Enforces strict sequential progression (<strong>Draft → Quotation → Confirmed → Active → Closed</strong>) with manual override verification for sales representatives.
          </p>
        </div>

        <div className="header-right-actions">
          <span className={`engine-status-pill ${isBackendConnected ? 'online' : 'offline'}`}>
            {isBackendConnected ? '● Backend API Connected' : '○ Standalone Mock Mode'}
          </span>
          <button
            type="button"
            className="btn btn-primary btn-create"
            onClick={handleCreateNewSubscription}
          >
            + New Draft Subscription
          </button>
        </div>
      </div>

      {/* State Machine Overview Pipeline Card */}
      <div className="lifecycle-pipeline-card">
        <div className="pipeline-card-header">
          <span className="pipeline-title">Standard Sequential State Flow:</span>
          <span className="pipeline-rule-tag">Sequential Jumps Only • Invalid Jumps Rejected</span>
        </div>
        <div className="pipeline-stages-row">
          {SEQUENTIAL_STAGES.map((st, idx) => {
            const count = countByState(st);
            const cfg = STATE_CONFIG[st];

            return (
              <React.Fragment key={st}>
                <div
                  className={`pipeline-stage-box ${activeFilter === st ? 'active-filter' : ''}`}
                  onClick={() => setActiveFilter(activeFilter === st ? 'ALL' : st)}
                  title={`Click to filter by ${st}`}
                >
                  <div className="stage-top">
                    <span className="stage-num">{idx + 1}</span>
                    <span className="stage-icon">{cfg.icon}</span>
                  </div>
                  <div className="stage-name">{st}</div>
                  <div className="stage-count">{count} subs</div>
                </div>
                {idx < SEQUENTIAL_STAGES.length - 1 && (
                  <div className="pipeline-arrow">➔</div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="kpi-summary-row">
        <div
          className={`kpi-chip ${activeFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setActiveFilter('ALL')}
        >
          <span className="kpi-label">All Subscriptions</span>
          <span className="kpi-value">{subscriptions.length}</span>
        </div>
        <div
          className={`kpi-chip ${activeFilter === SUBSCRIPTION_STATES.DRAFT ? 'active' : ''}`}
          onClick={() => setActiveFilter(SUBSCRIPTION_STATES.DRAFT)}
        >
          <span className="kpi-label">Draft</span>
          <span className="kpi-value">{countByState(SUBSCRIPTION_STATES.DRAFT)}</span>
        </div>
        <div
          className={`kpi-chip ${activeFilter === SUBSCRIPTION_STATES.QUOTATION ? 'active' : ''}`}
          onClick={() => setActiveFilter(SUBSCRIPTION_STATES.QUOTATION)}
        >
          <span className="kpi-label">Quotation</span>
          <span className="kpi-value">{countByState(SUBSCRIPTION_STATES.QUOTATION)}</span>
        </div>
        <div
          className={`kpi-chip ${activeFilter === SUBSCRIPTION_STATES.CONFIRMED ? 'active' : ''}`}
          onClick={() => setActiveFilter(SUBSCRIPTION_STATES.CONFIRMED)}
        >
          <span className="kpi-label">Confirmed</span>
          <span className="kpi-value">{countByState(SUBSCRIPTION_STATES.CONFIRMED)}</span>
        </div>
        <div
          className={`kpi-chip ${activeFilter === SUBSCRIPTION_STATES.ACTIVE ? 'active' : ''}`}
          onClick={() => setActiveFilter(SUBSCRIPTION_STATES.ACTIVE)}
        >
          <span className="kpi-label">Active</span>
          <span className="kpi-value text-success">{countByState(SUBSCRIPTION_STATES.ACTIVE)}</span>
        </div>
        <div
          className={`kpi-chip ${activeFilter === SUBSCRIPTION_STATES.CLOSED ? 'active' : ''}`}
          onClick={() => setActiveFilter(SUBSCRIPTION_STATES.CLOSED)}
        >
          <span className="kpi-label">Closed</span>
          <span className="kpi-value">{countByState(SUBSCRIPTION_STATES.CLOSED)}</span>
        </div>
        <div
          className={`kpi-chip ${activeFilter === SUBSCRIPTION_STATES.CANCELLED ? 'active' : ''}`}
          onClick={() => setActiveFilter(SUBSCRIPTION_STATES.CANCELLED)}
        >
          <span className="kpi-label">Cancelled</span>
          <span className="kpi-value text-danger">{countByState(SUBSCRIPTION_STATES.CANCELLED)}</span>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="table-card">
        <div className="table-toolbar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-field"
              placeholder="Search by ID, Customer Name, or Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="clear-btn" onClick={() => setSearchTerm('')}>✕</button>
            )}
          </div>

          <div className="filter-select-wrapper">
            <span className="filter-label">Filter:</span>
            <select
              className="state-select"
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
            >
              <option value="ALL">All States ({subscriptions.length})</option>
              {Object.values(SUBSCRIPTION_STATES).map((st) => (
                <option key={st} value={st}>
                  {st} ({countByState(st)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Subscriptions Table */}
        {loading ? (
          <div className="table-loading">
            <div className="spinner" />
            <span>Loading subscriptions state machine data...</span>
          </div>
        ) : filteredSubscriptions.length === 0 ? (
          <div className="table-empty">
            <p>No subscriptions found matching filter "{activeFilter}".</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="subscriptions-table">
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>Subscription</th>
                  <th style={{ width: '20%' }}>Customer (Mock usr_123)</th>
                  <th style={{ width: '18%' }}>Product & Plan</th>
                  <th style={{ width: '12%' }}>Amount</th>
                  <th style={{ width: '14%' }}>Current State</th>
                  <th style={{ width: '24%' }} className="text-right">Sales Actions / Manual Override</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscriptions.map((sub) => {
                  const nextState = getNextSequentialState(sub.status);
                  const allowed = ALLOWED_STATE_TRANSITIONS[sub.status] || [];
                  const canCancel = allowed.includes(SUBSCRIPTION_STATES.CANCELLED);

                  return (
                    <tr key={sub.id}>
                      {/* ID & date */}
                      <td>
                        <div className="sub-id-cell">
                          <strong>{sub.id}</strong>
                          <span className="sub-date">
                            {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td>
                        <div className="customer-cell">
                          <strong>{sub.customer?.name || 'Customer'}</strong>
                          <span className="customer-meta">
                            ID: <code>{sub.customer?.id || 'usr_123'}</code>
                          </span>
                          <span className="customer-email">{sub.customer?.email}</span>
                        </div>
                      </td>

                      {/* Product & Plan */}
                      <td>
                        <div className="product-cell">
                          <span className="product-title">
                            {sub.lines?.[0]?.product_name || 'Enterprise Cloud Server'}
                          </span>
                          <span className="product-lines-meta">
                            <code>{sub.lines?.[0]?.product_id || 'prod_1'}</code> • {sub.lines?.[0]?.quantity || 1} units
                          </span>
                          <span className="plan-name">{sub.plan?.name || 'Yearly Enterprise'}</span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td>
                        <div className="amount-cell">
                          <strong>${Number(sub.grand_total || 0).toLocaleString()}</strong>
                          <span className="billing-meta">{sub.plan?.billing_frequency || 'yearly'}</span>
                        </div>
                      </td>

                      {/* Current State & Stepper Preview */}
                      <td>
                        <div className="state-cell">
                          <SubscriptionStateBadge status={sub.status} />
                          <div className="mini-stepper-wrap">
                            <SubscriptionStateStepper currentState={sub.status} compact={true} />
                          </div>
                        </div>
                      </td>

                      {/* Sales Override & Progression Actions */}
                      <td className="text-right">
                        <div className="table-actions-group">
                          {/* Push Forward Action */}
                          {nextState && (
                            <button
                              type="button"
                              className="btn btn-sm btn-advance"
                              onClick={() => handleQuickAdvance(sub)}
                              title={`Advance to next stage: ${nextState}`}
                            >
                              ➔ Advance to {nextState}
                            </button>
                          )}

                          {/* Quick Cancel Button */}
                          {canCancel && (
                            <button
                              type="button"
                              className="btn btn-sm btn-cancel-action"
                              onClick={() => handleQuickCancel(sub)}
                              title="Cancel subscription"
                            >
                              Cancel
                            </button>
                          )}

                          {/* Manual Override Dialog Trigger */}
                          <button
                            type="button"
                            className="btn btn-sm btn-override"
                            onClick={() => setSelectedSubForOverride(sub)}
                            title="Open Manual State Override & Jump Test"
                          >
                            Override...
                          </button>

                          {/* View Audit Trail */}
                          <button
                            type="button"
                            className="btn btn-sm btn-icon"
                            onClick={() => setSelectedSubForTimeline(sub)}
                            title="View state transition audit log"
                          >
                            📜
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Override Modal */}
      {selectedSubForOverride && (
        <SubscriptionOverrideModal
          subscription={selectedSubForOverride}
          onClose={() => setSelectedSubForOverride(null)}
          onApplyTransition={handleTransitionState}
        />
      )}

      {/* Audit Log Timeline Drawer/Modal */}
      {selectedSubForTimeline && (
        <div className="modal-backdrop" onClick={() => setSelectedSubForTimeline(null)}>
          <div className="timeline-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Audit Trail: {selectedSubForTimeline.id}</h3>
                <p className="modal-subtext">
                  Complete chronological history of lifecycle state transitions
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedSubForTimeline(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <SubscriptionTransitionTimeline
                subscriptionId={selectedSubForTimeline.id}
                history={selectedSubForTimeline.transition_history}
              />
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setSelectedSubForTimeline(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

