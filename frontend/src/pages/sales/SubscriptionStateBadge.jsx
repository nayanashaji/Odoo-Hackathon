import React from 'react';
import { STATE_CONFIG, SUBSCRIPTION_STATES } from './mockSubscriptionData';

/**
 * SubscriptionStateBadge
 * Visual status badge representing the subscription lifecycle state
 */
export default function SubscriptionStateBadge({ status }) {
  const config = STATE_CONFIG[status] || {
    label: status || 'Unknown',
    theme: 'slate',
    icon: '•',
    badgeClass: 'badge-draft'
  };

  return (
    <span className={`sub-state-badge ${config.badgeClass}`} title={`State: ${config.label}`}>
      <span className="badge-icon">{config.icon}</span>
      <span className="badge-label">{config.label}</span>
    </span>
  );
}

