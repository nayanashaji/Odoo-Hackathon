import React from 'react';

/**
 * QuoteValidityBadge
 * Displays validity period duration with dynamic color coding based on duration & expiration.
 *
 * @param {number} duration - Validity period in days
 * @param {string} unit - 'days' | 'weeks' | 'months'
 * @param {string|Date} createdAt - Optional creation date to compute real-time expiration
 * @param {boolean} showRemaining - Whether to show days remaining
 */
export default function QuoteValidityBadge({
  duration = 30,
  unit = 'days',
  createdAt = null,
  showRemaining = false
}) {
  const dur = parseInt(duration, 10) || 30;

  // Determine duration category badge style
  let badgeClass = 'validity-badge-standard'; // 15-30 days
  let icon = '⏱️';

  if (dur <= 7) {
    badgeClass = 'validity-badge-urgent'; // Red/Amber
    icon = '⚡';
  } else if (dur <= 15) {
    badgeClass = 'validity-badge-medium'; // Orange
    icon = '⏳';
  } else if (dur <= 30) {
    badgeClass = 'validity-badge-standard'; // Blue/Cyan
    icon = '📅';
  } else {
    badgeClass = 'validity-badge-long'; // Purple
    icon = '🛡️';
  }

  // Calculate real-time expiration if creation date is available
  let remainingText = null;
  let isExpired = false;

  if (createdAt && showRemaining) {
    const created = new Date(createdAt);
    const exp = new Date(created.getTime());
    exp.setDate(exp.getDate() + dur);
    const now = new Date();
    const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));

    if (diff <= 0) {
      isExpired = true;
      remainingText = 'Expired';
      badgeClass = 'validity-badge-expired';
      icon = '⚠️';
    } else if (diff === 1) {
      remainingText = 'Expires today';
      badgeClass = 'validity-badge-urgent';
    } else {
      remainingText = `${diff} days left`;
    }
  }

  return (
    <span className={`validity-badge ${badgeClass}`} title={`Valid for ${dur} ${unit}`}>
      <span className="validity-icon">{icon}</span>
      <span className="validity-text">
        {dur} {unit}
        {remainingText && <span className="validity-subtext"> • {remainingText}</span>}
      </span>
    </span>
  );
}

