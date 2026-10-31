import React, { useState } from 'react';
import QuoteValidityBadge from './QuoteValidityBadge';

/**
 * QuoteTemplateList
 * Displays quotation templates with prominent validity period indicators,
 * filterable by status, validity duration, and search terms.
 */
export default function QuoteTemplateList({
  templates = [],
  onEdit,
  onDelete,
  onDuplicate,
  onPreview,
  onCreateNew
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [validityFilter, setValidityFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'cards'

  // Filtering logic
  const filteredTemplates = templates.filter((template) => {
    // Search
    const matchesSearch =
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (template.description && template.description.toLowerCase().includes(searchTerm.toLowerCase()));

    // Status
    const matchesStatus = statusFilter === 'all' || template.status === statusFilter;

    // Validity Duration Filter
    let matchesValidity = true;
    const days = template.validity_duration || 30;
    if (validityFilter === 'urgent_7') matchesValidity = days <= 7;
    else if (validityFilter === 'promo_15') matchesValidity = days > 7 && days <= 15;
    else if (validityFilter === 'standard_30') matchesValidity = days > 15 && days <= 30;
    else if (validityFilter === 'extended_60') matchesValidity = days > 30;

    return matchesSearch && matchesStatus && matchesValidity;
  });

  return (
    <div className="quote-template-list-container">
      {/* Controls & Filter Bar */}
      <div className="list-toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search templates by title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
              ✕
            </button>
          )}
        </div>

        <div className="filters-group">
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="draft">Drafts Only</option>
            <option value="archived">Archived</option>
          </select>

          {/* Validity Duration Filter */}
          <select
            className="filter-select validity-filter-select"
            value={validityFilter}
            onChange={(e) => setValidityFilter(e.target.value)}
          >
            <option value="all">⏱️ All Validity Periods</option>
            <option value="urgent_7">⚡ Flash / Urgent (≤ 7 Days)</option>
            <option value="promo_15">⏳ Promotional (8 - 15 Days)</option>
            <option value="standard_30">📅 Standard (16 - 30 Days)</option>
            <option value="extended_60">🛡️ Long-Term (60+ Days)</option>
          </select>

          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="Table View"
            >
              ☰
            </button>
            <button
              className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Card Grid View"
            >
              ⊞
            </button>
          </div>
        </div>
      </div>

      {/* Templates Display */}
      {filteredTemplates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h3>No Quotation Templates Found</h3>
          <p>
            {searchTerm || statusFilter !== 'all' || validityFilter !== 'all'
              ? 'No templates match your active filters. Try resetting the search or filter criteria.'
              : 'Create your first quotation template with pre-configured products and validity periods.'}
          </p>
          <button className="btn btn-primary" onClick={onCreateNew}>
            + Create Quotation Template
          </button>
        </div>
      ) : viewMode === 'list' ? (
        /* List / Table View */
        <div className="table-responsive">
          <table className="templates-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Template Name</th>
                <th style={{ width: '16%' }}>Validity Period</th>
                <th style={{ width: '18%' }}>Subscription Plan</th>
                <th style={{ width: '12%' }}>Lines</th>
                <th style={{ width: '12%' }}>Est. Total</th>
                <th style={{ width: '14%' }} className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map((template) => (
                <tr key={template.id}>
                  <td>
                    <div className="template-name-cell">
                      <span className="template-primary-title">{template.name}</span>
                      {template.description && (
                        <span className="template-desc-sub">{template.description}</span>
                      )}
                      <div className="template-badges-row">
                        <span className={`status-pill pill-${template.status}`}>
                          {template.status}
                        </span>
                        {template.require_signature && (
                          <span className="pill-feature" title="Requires customer signature">✍️ Sign</span>
                        )}
                        {template.require_payment && (
                          <span className="pill-feature" title="Requires upfront payment">💳 Pay</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="validity-cell">
                      <QuoteValidityBadge
                        duration={template.validity_duration}
                        unit={template.validity_unit}
                        createdAt={template.createdAt}
                        showRemaining={true}
                      />
                      <small className="validity-hint">
                        {template.validity_duration <= 7
                          ? 'High Urgency'
                          : template.validity_duration <= 30
                          ? 'Standard Policy'
                          : 'Procurement Window'}
                      </small>
                    </div>
                  </td>
                  <td>
                    <div className="plan-cell">
                      <strong>{template.plan_name || 'Enterprise Plan'}</strong>
                      <span className="plan-meta-pill">
                        {template.billing_frequency} • {template.closing_behavior}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="lines-count-badge">
                      {(template.lines || []).length} items
                    </span>
                  </td>
                  <td>
                    <strong className="amount-cell">${Number(template.grand_total || 0).toFixed(2)}</strong>
                  </td>
                  <td className="text-right">
                    <div className="action-buttons-group">
                      <button
                        className="btn-action-icon"
                        title="Simulate / Preview Quote with Expiration"
                        onClick={() => onPreview(template)}
                      >
                        👁️
                      </button>
                      <button
                        className="btn-action-icon"
                        title="Duplicate Template"
                        onClick={() => onDuplicate(template.id)}
                      >
                        📋
                      </button>
                      <button
                        className="btn-action-icon"
                        title="Edit Template"
                        onClick={() => onEdit(template)}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-action-icon text-danger"
                        title="Delete Template"
                        onClick={() => onDelete(template.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Card Grid View */
        <div className="templates-grid">
          {filteredTemplates.map((template) => (
            <div key={template.id} className="template-card">
              <div className="card-top-row">
                <span className={`status-pill pill-${template.status}`}>{template.status}</span>
                <QuoteValidityBadge
                  duration={template.validity_duration}
                  unit={template.validity_unit}
                  createdAt={template.createdAt}
                  showRemaining={true}
                />
              </div>

              <h4 className="card-title">{template.name}</h4>
              <p className="card-description">{template.description || 'No description provided.'}</p>

              <div className="card-meta-box">
                <div className="meta-item">
                  <span className="meta-key">Plan:</span>
                  <span className="meta-val">{template.plan_name || 'Yearly Plan'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Billing:</span>
                  <span className="meta-val capitalize">{template.billing_frequency}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Products:</span>
                  <span className="meta-val">{(template.lines || []).length} lines</span>
                </div>
              </div>

              <div className="card-footer-row">
                <div>
                  <span className="card-amount-label">Est. Total</span>
                  <div className="card-amount">${Number(template.grand_total || 0).toFixed(2)}</div>
                </div>

                <div className="card-actions">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => onPreview(template)}
                    title="Simulate Quote"
                  >
                    Preview
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => onEdit(template)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-icon-only"
                    onClick={() => onDuplicate(template.id)}
                    title="Duplicate"
                  >
                    📋
                  </button>
                  <button
                    className="btn btn-sm btn-icon-only text-danger"
                    onClick={() => onDelete(template.id)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

