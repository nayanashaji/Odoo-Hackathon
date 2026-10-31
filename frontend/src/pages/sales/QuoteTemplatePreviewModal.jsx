import React, { useState } from 'react';
import { MOCK_AUTH_USERS, computeValidityForecast } from './mockSalesData';
import QuoteValidityBadge from './QuoteValidityBadge';

/**
 * QuoteTemplatePreviewModal
 * Simulates generating an active customer quotation from a template,
 * highlighting the calculated expiration date, validity countdown, and line item breakdowns.
 */
export default function QuoteTemplatePreviewModal({
  template,
  onClose,
  mockUsers = MOCK_AUTH_USERS
}) {
  const [selectedCustomer, setSelectedCustomer] = useState(mockUsers[0]); // usr_123
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().substring(0, 10));

  if (!template) return null;

  // Compute live expiration based on selected quotation date
  const forecast = computeValidityForecast(template.validity_duration, new Date(quotationDate));

  const handleCustomerChange = (customerId) => {
    const cust = mockUsers.find((u) => u.id === customerId) || mockUsers[0];
    setSelectedCustomer(cust);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-tag">Quotation Simulation</span>
            <h2>SO-SIM-{template.id.substring(template.id.length - 4).toUpperCase()}</h2>
            <p className="modal-subtitle">
              Generated from Template: <strong>{template.name}</strong>
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Simulation Control Bar */}
          <div className="sim-control-bar">
            <div className="sim-control-item">
              <label className="sim-label">Customer (Mock Auth usr_123)</label>
              <select
                className="form-select sim-select"
                value={selectedCustomer.id}
                onChange={(e) => handleCustomerChange(e.target.value)}
              >
                {mockUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role}) • {u.company || u.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="sim-control-item">
              <label className="sim-label">Quotation Date</label>
              <input
                type="date"
                className="form-input sim-input"
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
              />
            </div>
          </div>

          {/* Prominent Validity Banner */}
          <div className="quote-validity-banner">
            <div className="banner-left">
              <div className="banner-icon">⏱️</div>
              <div>
                <div className="banner-title">
                  Quotation Validity Window: {template.validity_duration} {template.validity_unit || 'days'}
                </div>
                <div className="banner-subtext">
                  Issued: <strong>{forecast.quotation_date_formatted}</strong> &nbsp;→&nbsp; Expires:{' '}
                  <strong className="text-highlight">{forecast.expiration_date_formatted}</strong>
                </div>
              </div>
            </div>
            <div className="banner-right">
              <QuoteValidityBadge
                duration={template.validity_duration}
                unit={template.validity_unit}
              />
              <span className="validity-countdown">
                {forecast.days_remaining > 0 ? `${forecast.days_remaining} days remaining` : 'Expired'}
              </span>
            </div>
          </div>

          {/* Document Header (Odoo style) */}
          <div className="document-sheet">
            <div className="document-meta-grid">
              <div>
                <span className="meta-label">Customer Details</span>
                <p className="meta-value">
                  <strong>{selectedCustomer.name}</strong>
                  <br />
                  {selectedCustomer.company && (
                    <>
                      {selectedCustomer.company}
                      <br />
                    </>
                  )}
                  {selectedCustomer.email}
                  <br />
                  {selectedCustomer.phone && <small>{selectedCustomer.phone}</small>}
                </p>
              </div>

              <div>
                <span className="meta-label">Subscription Terms</span>
                <p className="meta-value">
                  Plan: <strong>{template.plan_name || 'Yearly Enterprise'}</strong>
                  <br />
                  Billing: <span className="capitalize">{template.billing_frequency || 'yearly'}</span>
                  <br />
                  Closing: <span className="capitalize">{template.closing_behavior || 'renew'}</span>
                </p>
              </div>

              <div>
                <span className="meta-label">Sign & Pay Policy</span>
                <p className="meta-value">
                  Online Signature:{' '}
                  <strong>{template.require_signature ? 'Required' : 'Optional'}</strong>
                  <br />
                  Online Payment:{' '}
                  <strong>{template.require_payment ? 'Required Upfront' : 'Invoice on Approval'}</strong>
                </p>
              </div>
            </div>

            {/* Line items table */}
            <div className="document-table-wrapper">
              <table className="document-table">
                <thead>
                  <tr>
                    <th>Item & Variant Description</th>
                    <th className="text-center">Quantity</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-right">Disc %</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(template.lines || []).map((line, idx) => (
                    <tr key={line.line_id || idx}>
                      <td>
                        <strong>{line.product_name}</strong>
                        {line.variant_name && (
                          <div className="line-variant-subtitle">
                            Variant: {line.variant_name} ({line.price_modifier >= 0 ? `+$${line.price_modifier}` : `-$${Math.abs(line.price_modifier)}`})
                          </div>
                        )}
                        {line.description && <div className="line-desc-muted">{line.description}</div>}
                      </td>
                      <td className="text-center">{line.quantity}</td>
                      <td className="text-right">
                        ${(Number(line.unit_price) + Number(line.price_modifier || 0)).toFixed(2)}
                      </td>
                      <td className="text-right">{line.discount_percent || 0}%</td>
                      <td className="text-right">
                        <strong>${Number(line.total_amount).toFixed(2)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Document totals */}
            <div className="document-financials">
              <div className="financials-card">
                <div className="financial-line">
                  <span>Untaxed Subtotal:</span>
                  <span>${Number(template.subtotal || 0).toFixed(2)}</span>
                </div>
                {template.total_discount > 0 && (
                  <div className="financial-line text-success">
                    <span>Discount:</span>
                    <span>-${Number(template.total_discount).toFixed(2)}</span>
                  </div>
                )}
                <div className="financial-line doc-grand-total">
                  <span>Total Quoted Amount:</span>
                  <span>${Number(template.grand_total || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Legal Validity Terms */}
            <div className="document-terms">
              <h5>Quotation Validity & Terms</h5>
              <p>{template.validity_terms}</p>
              <small className="terms-timestamp">
                Quotation validity strictly bound from {forecast.quotation_date_formatted} until {forecast.expiration_date_formatted}.
              </small>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>
            Close Simulation
          </button>
          <button
            className="btn btn-primary"
            onClick={() => alert(`Simulated quote converted with expiration: ${forecast.expiration_date_formatted}`)}
          >
            Confirm & Send to Customer
          </button>
        </div>
      </div>
    </div>
  );
}

