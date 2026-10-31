import React from 'react';
import SubscriptionStateBadge from './SubscriptionStateBadge';

/**
 * SubscriptionTransitionTimeline
 * Displays the historical audit trail of state transitions for a subscription
 */
export default function SubscriptionTransitionTimeline({ history = [], subscriptionId }) {
  if (!history || history.length === 0) {
    return (
      <div className="timeline-empty">
        <p>No transition records found for subscription {subscriptionId}.</p>
      </div>
    );
  }

  // Reverse so newest transition is on top
  const sortedHistory = [...history].reverse();

  return (
    <div className="transition-timeline-box">
      <div className="timeline-header">
        <h4>State Transition Audit Log</h4>
        <span className="timeline-count">{history.length} events</span>
      </div>

      <div className="timeline-items">
        {sortedHistory.map((item, idx) => {
          const date = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Just now';

          return (
            <div key={idx} className="timeline-item">
              <div className="timeline-bullet" />
              <div className="timeline-content">
                <div className="timeline-top">
                  <div className="transition-flow">
                    <span className="from-state">{item.from_state}</span>
                    <span className="arrow-sep">→</span>
                    <SubscriptionStateBadge status={item.to_state} />
                  </div>
                  <span className="timeline-date">{date}</span>
                </div>

                <div className="timeline-meta">
                  <span className="actor-info">
                    Actor: <strong>{item.actor_id}</strong> ({item.actor_role || 'sales_rep'})
                  </span>
                  {item.is_manual_override && (
                    <span className="override-badge">Manual Override</span>
                  )}
                </div>

                {item.reason && (
                  <p className="timeline-reason">
                    <em>"{item.reason}"</em>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

