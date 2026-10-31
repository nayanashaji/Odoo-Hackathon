import React, { useState, useEffect } from 'react';
import SubscriptionStateBadge from './SubscriptionStateBadge';
import SubscriptionStateStepper from './SubscriptionStateStepper';
import SubscriptionTransitionTimeline from './SubscriptionTransitionTimeline';
import {
  INITIAL_SUBSCRIPTIONS,
  SUBSCRIPTION_STATES,
  ALLOWED_STATE_TRANSITIONS,
  SEQUENTIAL_STAGES,
  STATE_CONFIG
} from './mockSubscriptionData';
import './SubscriptionState.css';

const API_BASE_URL = 'http://localhost:5000/api/subscriptions';

/**
 * SubscriptionManager
 * Internal sales representative UI for the Subscription Lifecycle State Machine.
 * Strictly uses standard Vite + React (zero Next.js imports).
 *
 * Prominently displays current state and renders manual override buttons
 * (Generate Quotation, Confirm Accept, Activate, Close) conditionally disabled
 * according to the backend's strict sequential logic.
 */
export default function SubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedSubId, setSelectedSubId] = useState('sub_1');
  const [loading, setLoading] = useState(true);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [rejectionError, setRejectionError] = useState(null);

  // Notification Toast Helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Fetch Subscription Data from Backend (with resilient offline mock fallback)
  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_BASE_URL);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          setSubscriptions(json.data);
          setIsBackendConnected(true);
          setLoading(false);
          return;
        }
      }
      throw new Error('Backend returned non-OK status');
    } catch (err) {
      console.warn('Backend API not reachable at http://localhost:5000; utilizing offline state store:', err.message);
      setSubscriptions(INITIAL_SUBSCRIPTIONS);
      setIsBackendConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  // Selected subscription object
  const currentSub =
    subscriptions.find((s) => s.id === selectedSubId) || subscriptions[0] || INITIAL_SUBSCRIPTIONS[0];
  const currentState = currentSub ? currentSub.status : SUBSCRIPTION_STATES.DRAFT;

  // Allowed transitions determined by the state machine
  const allowedTransitions = ALLOWED_STATE_TRANSITIONS[currentState] || [];
  const isTerminal = currentState === SUBSCRIPTION_STATES.CLOSED;

  // 2. Trigger PUT request to /api/subscriptions/:id/state
  const handleTransitionState = async (targetState, reasonText = '') => {
    if (!currentSub) return;
    setSubmitting(true);
    setRejectionError(null);

    const reason = reasonText || `Sales override: Transitioned to ${targetState}`;

    if (isBackendConnected) {
      try {
        const res = await fetch(`${API_BASE_URL}/${currentSub.id}/state`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state: targetState,
            reason,
            is_manual_override: true
          })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          // Backend engine rejected invalid jump or malformed state
          const errorMsg = data.message || `Failed to transition to ${targetState}`;
          setRejectionError(errorMsg);
          showToast(`❌ ${errorMsg}`, 'error');
          setSubmitting(false);
          return;
        }

        // Successfully updated in backend
        setSubscriptions((prev) =>
          prev.map((s) => (s.id === currentSub.id ? data.data : s))
        );
        showToast(`✓ State updated to '${targetState}' for ${currentSub.id}`);
        setSubmitting(false);
        return;
      } catch (err) {
        console.warn('Network call failed, applying transition locally:', err);
      }
    }

    // Local State Machine Validation Fallback (enforces identical rejection rules)
    if (!allowedTransitions.includes(targetState)) {
      const errorMsg = `Cannot transition from '${currentState}' directly to '${targetState}'. Invalid state jump rejected. Allowed: [${allowedTransitions.join(', ') || 'None'}].`;
      setRejectionError(errorMsg);
      showToast(`❌ ${errorMsg}`, 'error');
      setSubmitting(false);
      return;
    }

    const updated = {
      ...currentSub,
      status: targetState,
      updatedAt: new Date().toISOString(),
      transition_history: [
        ...(currentSub.transition_history || []),
        {
          from_state: currentState,
          to_state: targetState,
          timestamp: new Date().toISOString(),
          actor_id: 'usr_sales_101',
          actor_role: 'sales_rep',
          reason,
          is_manual_override: true
        }
      ]
    };

    setSubscriptions((prev) =>
      prev.map((s) => (s.id === currentSub.id ? updated : s))
    );
    showToast(`✓ State updated to '${targetState}' for ${currentSub.id}`);
    setSubmitting(false);
  };

  // Helper to test an invalid jump intentionally for demonstration
  const handleAttemptInvalidJump = (targetState) => {
    handleTransitionState(targetState, `Forced override test to ${targetState}`);
  };

  // Create a brand new subscription starting in Draft
  const handleCreateDraftSubscription = async () => {
    const newId = `sub_${Date.now()}`;
    const newSubscription = {
      id: newId,
      status: SUBSCRIPTION_STATES.DRAFT,
      customer: {
        id: 'usr_123',
        name: 'Claire Dupont',
        email: 'c@x.com',
        role: 'customer'
      },
      plan: {
        id: 'plan_1',
        name: 'Enterprise Yearly Auto-Renew Plan',
        billing_frequency: 'yearly',
        closing_behavior: 'renew'
      },
      lines: [
        {
          product_id: 'prod_1',
          product_name: 'Brightloop Enterprise Cloud Server',
          quantity: 5,
          unit_price: 1200,
          price_modifier: 560,
          total_amount: 8888
        }
      ],
      grand_total: 8888,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      transition_history: [
        {
          from_state: 'Initial',
          to_state: SUBSCRIPTION_STATES.DRAFT,
          timestamp: new Date().toISOString(),
          actor_id: 'usr_sales_101',
          actor_role: 'sales_rep',
          reason: 'New subscription initiated in Draft state',
          is_manual_override: false
        }
      ]
    };

    if (isBackendConnected) {
      try {
        const res = await fetch(API_BASE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSubscription)
        });
        if (res.ok) {
          const json = await res.json();
          setSubscriptions((prev) => [json.data, ...prev]);
          setSelectedSubId(json.data.id);
          showToast(`Created new subscription ${json.data.id} in Draft state`);
          return;
        }
      } catch (err) {
        console.warn('Backend call failed, creating locally:', err);
      }
    }

    setSubscriptions((prev) => [newSubscription, ...prev]);
    setSelectedSubId(newId);
    showToast(`Created new subscription ${newId} in Draft state`);
  };

  // 3. Conditional Button Disabling Logic based on Current State
  const isQuotationEnabled = allowedTransitions.includes(SUBSCRIPTION_STATES.QUOTATION);
  const isConfirmEnabled = allowedTransitions.includes(SUBSCRIPTION_STATES.CONFIRMED);
  const isActivateEnabled = allowedTransitions.includes(SUBSCRIPTION_STATES.ACTIVE);
  const isCloseEnabled = allowedTransitions.includes(SUBSCRIPTION_STATES.CLOSED);
  const isCancelEnabled = allowedTransitions.includes(SUBSCRIPTION_STATES.CANCELLED);
  const isReopenEnabled = allowedTransitions.includes(SUBSCRIPTION_STATES.DRAFT);

  // Tooltip explanations for why a button is disabled
  const getDisabledReason = (targetState) => {
    if (currentState === targetState) return `Already in '${currentState}' state`;
    if (isTerminal) return 'Subscription is Closed (Terminal state). No further transitions permitted.';
    if (targetState === SUBSCRIPTION_STATES.CONFIRMED && currentState === SUBSCRIPTION_STATES.DRAFT) {
      return 'Disabled: Must generate and deliver Quotation before confirmation';
    }
    if (targetState === SUBSCRIPTION_STATES.ACTIVE && (currentState === SUBSCRIPTION_STATES.DRAFT || currentState === SUBSCRIPTION_STATES.QUOTATION)) {
      return `Disabled: Cannot jump directly from '${currentState}' to 'Active'. Must reach Confirmed first.`;
    }
    if (targetState === SUBSCRIPTION_STATES.CLOSED && currentState !== SUBSCRIPTION_STATES.ACTIVE) {
      return `Disabled: Only Active subscriptions can transition to Closed.`;
    }
    return `Disabled: Transition from '${currentState}' to '${targetState}' is not permitted by sequential state rules.`;
  };

  const stateMeta = STATE_CONFIG[currentState] || STATE_CONFIG[SUBSCRIPTION_STATES.DRAFT];

  return (
    <div className="subscription-lifecycle-dashboard">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification toast-${toast.type}`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="lifecycle-header">
        <div>
          <span className="domain-crumb">Brightloop ERP • Sales & Operations</span>
          <h2>Subscription State Machine Manager</h2>
          <p className="domain-desc">
            Internal sales controls enforcing the sequential lifecycle: <strong>Draft → Quotation → Confirmed → Active → Closed</strong>.
          </p>
        </div>

        <div className="header-right-actions">
          <span className={`engine-status-pill ${isBackendConnected ? 'online' : 'offline'}`}>
            {isBackendConnected ? '● Backend API Connected (:5000)' : '○ Standalone Mock Mode'}
          </span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCreateDraftSubscription}
            title="Create a new subscription starting in Draft to test full lifecycle"
          >
            + New Draft Subscription
          </button>
        </div>
      </div>

      {/* Subscription Selector Bar */}
      <div className="table-card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
              Select Subscription:
            </label>
            <select
              className="state-select"
              value={selectedSubId}
              onChange={(e) => {
                setSelectedSubId(e.target.value);
                setRejectionError(null);
              }}
              style={{ fontWeight: 600, minWidth: '220px' }}
            >
              {subscriptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} — {s.customer?.name} ({s.status})
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Customer: <strong>{currentSub?.customer?.name} (usr_123)</strong> • Total:{' '}
            <strong>${Number(currentSub?.grand_total || 0).toLocaleString()}</strong>
          </div>
        </div>
      </div>

      {/* PROMINENT CURRENT STATE DISPLAY HERO */}
      <div className="table-card" style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
              Current State Indicator
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px' }}>
              <span style={{ fontSize: '32px' }}>{stateMeta.icon}</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>
                    {currentState}
                  </h1>
                  <SubscriptionStateBadge status={currentState} />
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  {stateMeta.description}
                </p>
              </div>
            </div>
          </div>

          {/* Subscription Meta Card */}
          <div style={{ background: '#f8fafc', padding: '12px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', minWidth: '240px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
              Subscription Details (schema.json)
            </div>
            <div style={{ fontSize: '13px', color: '#1e293b' }}>
              ID: <strong>{currentSub?.id}</strong>
            </div>
            <div style={{ fontSize: '13px', color: '#1e293b' }}>
              Product: <strong>Brightloop Cloud Server (prod_1)</strong>
            </div>
            <div style={{ fontSize: '13px', color: '#059669', fontWeight: 700, marginTop: '2px' }}>
              Grand Total: ${Number(currentSub?.grand_total || 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Visual Stepper Track */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
          <SubscriptionStateStepper currentState={currentState} compact={false} />
        </div>
      </div>

      {/* MANUALLY CONTROLLED STATE OVERRIDE BUTTONS */}
      <div className="table-card" style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
            ⚡ Manual State Override Controls
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Buttons are conditionally enabled or disabled to enforce the strict sequential progression:{' '}
            <code>Draft → Quotation → Confirmed → Active → Closed</code>.
          </p>
        </div>

        {/* Rejection Alert Banner */}
        {rejectionError && (
          <div className="backend-error-banner" style={{ marginBottom: '18px' }}>
            <div className="error-title">❌ Transition Rejected by Backend Engine (HTTP 400)</div>
            <div className="error-body">{rejectionError}</div>
          </div>
        )}

        {/* Override Buttons Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
          {/* Button 1: Generate Quotation (Draft -> Quotation) */}
          <div className="override-action-card">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!isQuotationEnabled || submitting}
              onClick={() => handleTransitionState(SUBSCRIPTION_STATES.QUOTATION, 'Quotation generated by sales rep')}
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: '14px',
                opacity: isQuotationEnabled ? 1 : 0.45,
                cursor: isQuotationEnabled ? 'pointer' : 'not-allowed'
              }}
              title={isQuotationEnabled ? 'Advance subscription from Draft to Quotation' : getDisabledReason(SUBSCRIPTION_STATES.QUOTATION)}
            >
              <span>📄</span>
              <span>Generate Quotation</span>
            </button>
            <span className="override-btn-helper">
              {isQuotationEnabled ? '✓ Available: Moves Draft → Quotation' : getDisabledReason(SUBSCRIPTION_STATES.QUOTATION)}
            </span>
          </div>

          {/* Button 2: Confirm Accept (Quotation -> Confirmed) */}
          <div className="override-action-card">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!isConfirmEnabled || submitting}
              onClick={() => handleTransitionState(SUBSCRIPTION_STATES.CONFIRMED, 'Customer accepted agreement terms')}
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: '14px',
                opacity: isConfirmEnabled ? 1 : 0.45,
                cursor: isConfirmEnabled ? 'pointer' : 'not-allowed'
              }}
              title={isConfirmEnabled ? 'Advance subscription from Quotation to Confirmed' : getDisabledReason(SUBSCRIPTION_STATES.CONFIRMED)}
            >
              <span>🤝</span>
              <span>Confirm Accept</span>
            </button>
            <span className="override-btn-helper">
              {isConfirmEnabled ? '✓ Available: Moves Quotation → Confirmed' : getDisabledReason(SUBSCRIPTION_STATES.CONFIRMED)}
            </span>
          </div>

          {/* Button 3: Activate (Confirmed -> Active) */}
          <div className="override-action-card">
            <button
              type="button"
              className="btn btn-advance"
              disabled={!isActivateEnabled || submitting}
              onClick={() => handleTransitionState(SUBSCRIPTION_STATES.ACTIVE, 'Hardware provisioned & service activated')}
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: '14px',
                fontWeight: 700,
                opacity: isActivateEnabled ? 1 : 0.45,
                cursor: isActivateEnabled ? 'pointer' : 'not-allowed'
              }}
              title={isActivateEnabled ? 'Activate subscription (live billing starts)' : getDisabledReason(SUBSCRIPTION_STATES.ACTIVE)}
            >
              <span>⚡</span>
              <span>Activate</span>
            </button>
            <span className="override-btn-helper">
              {isActivateEnabled ? '✓ Available: Moves Confirmed → Active' : getDisabledReason(SUBSCRIPTION_STATES.ACTIVE)}
            </span>
          </div>

          {/* Button 4: Close (Active -> Closed) */}
          <div className="override-action-card">
            <button
              type="button"
              className="btn btn-override"
              disabled={!isCloseEnabled || submitting}
              onClick={() => handleTransitionState(SUBSCRIPTION_STATES.CLOSED, 'Contract concluded at end of term')}
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: '14px',
                opacity: isCloseEnabled ? 1 : 0.45,
                cursor: isCloseEnabled ? 'pointer' : 'not-allowed'
              }}
              title={isCloseEnabled ? 'Close subscription (terminal lifecycle stage)' : getDisabledReason(SUBSCRIPTION_STATES.CLOSED)}
            >
              <span>🏁</span>
              <span>Close</span>
            </button>
            <span className="override-btn-helper">
              {isCloseEnabled ? '✓ Available: Moves Active → Closed' : getDisabledReason(SUBSCRIPTION_STATES.CLOSED)}
            </span>
          </div>

          {/* Button 5: Cancel Subscription */}
          <div className="override-action-card">
            <button
              type="button"
              className="btn btn-cancel-action"
              disabled={!isCancelEnabled || submitting}
              onClick={() => {
                if (window.confirm(`Cancel subscription ${currentSub?.id}?`)) {
                  handleTransitionState(SUBSCRIPTION_STATES.CANCELLED, 'Cancelled by sales representative');
                }
              }}
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: '14px',
                opacity: isCancelEnabled ? 1 : 0.45,
                cursor: isCancelEnabled ? 'pointer' : 'not-allowed'
              }}
              title={isCancelEnabled ? 'Terminate subscription contract' : getDisabledReason(SUBSCRIPTION_STATES.CANCELLED)}
            >
              <span>🚫</span>
              <span>Cancel</span>
            </button>
            <span className="override-btn-helper">
              {isCancelEnabled ? 'Terminate subscription' : 'Cannot cancel closed subscription'}
            </span>
          </div>

          {/* Button 6: Reopen to Draft (if Cancelled) */}
          {currentState === SUBSCRIPTION_STATES.CANCELLED && (
            <div className="override-action-card">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!isReopenEnabled || submitting}
                onClick={() => handleTransitionState(SUBSCRIPTION_STATES.DRAFT, 'Reopened cancelled subscription to Draft')}
                style={{ width: '100%', padding: '12px 14px', fontSize: '14px' }}
              >
                <span>↺</span>
                <span>Reopen to Draft</span>
              </button>
              <span className="override-btn-helper">Reopen cancelled deal to Draft</span>
            </div>
          )}
        </div>

        {/* DEMONSTRATION / VERIFICATION PANEL FOR INVALID FORWARD SKIPS */}
        <div style={{ marginTop: '24px', padding: '16px', background: '#fdfafc', border: '1px dashed #d8b4e2', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#714b67' }}>
              🧪 State Machine Rejection Verification (Test Invalid Jumps)
            </span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Click to verify that illegal skips return HTTP 400 Bad Request
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              disabled={submitting || currentState === SUBSCRIPTION_STATES.ACTIVE}
              onClick={() => handleAttemptInvalidJump(SUBSCRIPTION_STATES.ACTIVE)}
              title="Attempt illegal jump directly to Active"
            >
              ⚠️ Force Jump to Active
            </button>

            <button
              type="button"
              className="btn btn-sm btn-outline"
              disabled={submitting || currentState === SUBSCRIPTION_STATES.CLOSED}
              onClick={() => handleAttemptInvalidJump(SUBSCRIPTION_STATES.CLOSED)}
              title="Attempt illegal jump directly to Closed"
            >
              ⚠️ Force Jump to Closed
            </button>

            <button
              type="button"
              className="btn btn-sm btn-outline"
              disabled={submitting}
              onClick={() => handleAttemptInvalidJump('FakeState')}
              title="Send completely invalid state string 'FakeState'"
            >
              ⚠️ Send Unrecognized State "FakeState"
            </button>
          </div>
        </div>
      </div>

      {/* CHRONOLOGICAL AUDIT TRAIL / TRANSITION TIMELINE */}
      <div className="table-card" style={{ padding: '24px' }}>
        <SubscriptionTransitionTimeline
          subscriptionId={currentSub?.id}
          history={currentSub?.transition_history || []}
        />
      </div>
    </div>
  );
}

