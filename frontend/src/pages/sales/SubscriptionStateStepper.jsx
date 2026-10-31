import React from 'react';
import { SEQUENTIAL_STAGES, STATE_CONFIG, SUBSCRIPTION_STATES } from './mockSubscriptionData';

/**
 * SubscriptionStateStepper
 * Visual progressive pipeline showing Draft → Quotation → Confirmed → Active → Closed
 */
export default function SubscriptionStateStepper({ currentState, compact = false }) {
  const currentIndex = SEQUENTIAL_STAGES.indexOf(currentState);
  const isCancelled = currentState === SUBSCRIPTION_STATES.CANCELLED;

  if (isCancelled) {
    return (
      <div className={`stepper-container cancelled ${compact ? 'compact' : ''}`}>
        <div className="stepper-cancelled-pill">
          <span>🚫 Subscription Cancelled / Terminated</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`stepper-container ${compact ? 'compact' : ''}`}>
      <div className="stepper-track">
        {SEQUENTIAL_STAGES.map((stage, idx) => {
          const config = STATE_CONFIG[stage];
          const isCompleted = currentIndex > idx;
          const isCurrent = currentIndex === idx;
          const isUpcoming = currentIndex < idx;

          let stepClass = 'step-upcoming';
          if (isCompleted) stepClass = 'step-completed';
          if (isCurrent) stepClass = 'step-current';

          return (
            <React.Fragment key={stage}>
              <div
                className={`stepper-node ${stepClass}`}
                title={`Stage ${idx + 1}: ${config.label} - ${config.description}`}
              >
                <div className="node-circle">
                  {isCompleted ? '✓' : idx + 1}
                </div>
                {!compact && (
                  <div className="node-text">
                    <span className="node-title">{config.label}</span>
                  </div>
                )}
              </div>
              {idx < SEQUENTIAL_STAGES.length - 1 && (
                <div
                  className={`stepper-connector ${isCompleted ? 'connector-filled' : 'connector-empty'}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

