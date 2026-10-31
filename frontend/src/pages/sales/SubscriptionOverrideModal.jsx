import React, { useState } from 'react';
import SubscriptionStateBadge from './SubscriptionStateBadge';
import SubscriptionStateStepper from './SubscriptionStateStepper';
import {
  SUBSCRIPTION_STATES,
  ALLOWED_STATE_TRANSITIONS,
  STATE_CONFIG
} from './mockSubscriptionData';

/**
 * SubscriptionOverrideModal
 * Dialog for internal sales reps to manually push subscription states forward,
 * cancel, or attempt overrides (and observe rejection on invalid jumps).
 */
export default function SubscriptionOverrideModal({
  subscription,
  onClose,
  onApplyTransition
}) {
  const [selectedTargetState, setSelectedTargetState] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [salesRepNote, setSalesRepNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  if (!subscription) return null;

  const currentState = subscription.status;
  const allowedTransitions = ALLOWED_STATE_TRANSITIONS[currentState] || [];
  const allStates = Object.values(SUBSCRIPTION_STATES);

  // Check if selected target state is valid according to state machine rules
  const isValidTransition = allowedTransitions.includes(selectedTargetState);
  const isIdenticalState = selectedTargetState === currentState;

  const handleSubmit = async (target) => {
    const finalState = target || selectedTargetState;
    if (!finalState) {
      setErrorMessage('Please select a target state.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await onApplyTransition(subscription.id, finalState, {
        reason: overrideReason || `Sales override to ${finalState}`,
        notes: salesRepNote,
        is_manual_override: true
      });

      if (!result.success) {
        setErrorMessage(result.message || 'State transition rejected by backend engine.');
      } else {
        onClose();
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error occurred while updating state.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="override-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="modal-category-tag">Internal Sales Control</span>
            <h3>Manual State Override: {subscription.id}</h3>
            <p className="modal-subtext">
              Customer: <strong>{subscription.customer?.name} ({subscription.customer?.id})</strong> • Total: <strong>${subscription.grand_total?.toLocaleString()}</strong>
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Current State & Progress */}
          <div className="override-current-panel">
            <div className="current-state-heading">
              <span>Current Status:</span>
              <SubscriptionStateBadge status={currentState} />
            </div>
            <SubscriptionStateStepper currentState={currentState} compact={false} />
          </div>

          {/* Quick Sequential Actions (Recommended) */}
          <div className="action-section">
            <h4 className="section-title">⚡ Recommended Lifecycle Transitions</h4>
            <p className="section-subtitle">
              Valid immediate sequential transitions permitted for <strong>{currentState}</strong>:
            </p>

            <div className="quick-action-buttons">
              {allowedTransitions.length === 0 ? (
                <div className="terminal-state-notice">
                  🏁 This subscription is in a terminal state (<strong>{currentState}</strong>). No further transitions are available.
                </div>
              ) : (
                allowedTransitions.map((state) => {
                  const isCancel = state === SUBSCRIPTION_STATES.CANCELLED;
                  const cfg = STATE_CONFIG[state];

                  return (
                    <button
                      key={state}
                      type="button"
                      disabled={submitting}
                      className={`btn ${isCancel ? 'btn-danger' : 'btn-primary'} btn-quick-step`}
                      onClick={() => handleSubmit(state)}
                    >
                      <span className="btn-icon">{cfg.icon}</span>
                      <span>
                        {isCancel ? 'Cancel Subscription' : `Advance to ${state}`}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Manual Jump Test Section (Strict Engine Validation) */}
          <div className="manual-jump-section">
            <h4 className="section-title">⚠️ Test State Machine Validation (Jump Override)</h4>
            <p className="section-subtitle">
              Select any target state. Notice how invalid sequential jumps (e.g., <em>Draft → Active</em>) are strictly rejected by the backend.
            </p>

            <div className="jump-control-grid">
              <div className="form-group">
                <label className="form-label">Target State</label>
                <select
                  className="form-select"
                  value={selectedTargetState}
                  onChange={(e) => {
                    setSelectedTargetState(e.target.value);
                    setErrorMessage(null);
                  }}
                >
                  <option value="">-- Choose Target State --</option>
                  {allStates.map((st) => (
                    <option key={st} value={st}>
                      {st} {allowedTransitions.includes(st) ? '(Valid Progression)' : '(Invalid Jump ❌)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Sales Representative Reason</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Approved exception, customer request..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </div>
            </div>

            {/* Validation Feedback Warning Banner */}
            {selectedTargetState && !isIdenticalState && (
              <div className={`validation-alert ${isValidTransition ? 'alert-valid' : 'alert-invalid'}`}>
                {isValidTransition ? (
                  <>
                    <span className="alert-icon">✓</span>
                    <span>
                      <strong>Valid Transition:</strong> State progression from <em>{currentState}</em> to <em>{selectedTargetState}</em> conforms to the lifecycle pipeline.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="alert-icon">⛔</span>
                    <span>
                      <strong>Invalid Jump Detected:</strong> Skipping from <em>{currentState}</em> to <em>{selectedTargetState}</em> violates the sequential rule (<em>Draft → Quotation → Confirmed → Active → Closed</em>). The backend state machine will reject this request.
                    </span>
                  </>
                )}
              </div>
            )}

            {errorMessage && (
              <div className="backend-error-banner">
                <div className="error-title">❌ Transition Rejected by Engine</div>
                <div className="error-body">{errorMessage}</div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
            Close
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!selectedTargetState || isIdenticalState || submitting}
            onClick={() => handleSubmit(selectedTargetState)}
          >
            {submitting ? 'Verifying with Engine...' : `Execute Override to ${selectedTargetState || 'State'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

