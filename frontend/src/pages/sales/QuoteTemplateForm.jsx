import React, { useState, useEffect } from 'react';
import {
  MOCK_PRODUCT_CATALOG,
  MOCK_SUBSCRIPTION_PLANS,
  MOCK_VALIDITY_PRESETS,
  computeValidityForecast
} from './mockSalesData';

/**
 * QuoteTemplateForm
 * Form component to create and configure quotation templates with custom validity periods,
 * product line items with variants, and subscription rules.
 */
export default function QuoteTemplateForm({
  initialData = null,
  onSave,
  onCancel,
  availableProducts = MOCK_PRODUCT_CATALOG,
  availablePlans = MOCK_SUBSCRIPTION_PLANS
}) {
  const isEditing = Boolean(initialData && initialData.id);

  // Form State
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [validityDuration, setValidityDuration] = useState(initialData?.validity_duration || 30);
  const [validityUnit, setValidityUnit] = useState(initialData?.validity_unit || 'days');
  const [validityTerms, setValidityTerms] = useState(
    initialData?.validity_terms ||
      'This quotation is strictly valid for 30 calendar days from the date of presentation. Hardware allocations and discounted rate structures remain guaranteed within this period.'
  );
  const [planId, setPlanId] = useState(initialData?.plan_id || 'plan_1');
  const [requireSignature, setRequireSignature] = useState(
    initialData?.require_signature !== undefined ? initialData.require_signature : true
  );
  const [requirePayment, setRequirePayment] = useState(
    initialData?.require_payment !== undefined ? initialData.require_payment : false
  );
  const [status, setStatus] = useState(initialData?.status || 'active');

  // Line items state
  const [lines, setLines] = useState(
    initialData?.lines && initialData.lines.length > 0
      ? initialData.lines
      : [
          {
            line_id: `line_${Date.now()}_1`,
            product_id: 'prod_1',
            product_name: 'Brightloop Enterprise Cloud Server',
            variant_id: 'var_1',
            variant_name: 'Dell PowerEdge / Enterprise Tier',
            quantity: 1,
            unit_price: 1200,
            price_modifier: 560,
            discount_percent: 0,
            total_amount: 1760.00
          }
        ]
  );

  const [formError, setFormError] = useState('');

  // Live validity calculation forecast
  const validityForecast = computeValidityForecast(validityDuration, new Date());

  // Auto-update default validity terms when duration or unit changes (if user hasn't heavily customized it)
  const handleValidityDurationChange = (days) => {
    const parsed = Math.max(1, parseInt(days, 10) || 1);
    setValidityDuration(parsed);
    setValidityTerms(
      `This quotation is strictly valid for ${parsed} ${validityUnit} from the date of presentation. Hardware allocations, special discounts, and pricing tiers remain guaranteed within this period.`
    );
  };

  // Line item handlers
  const handleAddLine = () => {
    const defaultProduct = availableProducts[0] || MOCK_PRODUCT_CATALOG[0];
    const defaultVariant = (defaultProduct.variants && defaultProduct.variants[0]) || {
      id: 'var_base',
      name: 'Standard',
      price_modifier: 0
    };

    const newLine = {
      line_id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      product_id: defaultProduct.id,
      product_name: defaultProduct.name,
      variant_id: defaultVariant.id,
      variant_name: defaultVariant.name,
      quantity: 1,
      unit_price: defaultProduct.sales_price,
      price_modifier: defaultVariant.price_modifier,
      discount_percent: 0,
      total_amount: defaultProduct.sales_price + defaultVariant.price_modifier
    };

    setLines([...lines, newLine]);
  };

  const handleRemoveLine = (index) => {
    if (lines.length <= 1) {
      setFormError('At least one quotation line item is required.');
      return;
    }
    setFormError('');
    setLines(lines.filter((_, idx) => idx !== index));
  };

  const handleProductChange = (index, newProductId) => {
    const product = availableProducts.find((p) => p.id === newProductId) || availableProducts[0];
    const defaultVariant = (product.variants && product.variants[0]) || {
      id: 'var_base',
      name: 'Standard',
      price_modifier: 0
    };

    const updated = [...lines];
    const current = updated[index];
    const effectivePrice = product.sales_price + (defaultVariant.price_modifier || 0);
    const gross = effectivePrice * current.quantity;
    const discount = gross * (current.discount_percent / 100);

    updated[index] = {
      ...current,
      product_id: product.id,
      product_name: product.name,
      variant_id: defaultVariant.id,
      variant_name: defaultVariant.name,
      unit_price: product.sales_price,
      price_modifier: defaultVariant.price_modifier || 0,
      total_amount: Number((gross - discount).toFixed(2))
    };

    setLines(updated);
  };

  const handleVariantChange = (index, newVariantId) => {
    const updated = [...lines];
    const current = updated[index];
    const product = availableProducts.find((p) => p.id === current.product_id) || availableProducts[0];
    const variant = (product.variants || []).find((v) => v.id === newVariantId) || {
      id: 'var_base',
      name: 'Standard',
      price_modifier: 0
    };

    const effectivePrice = current.unit_price + (variant.price_modifier || 0);
    const gross = effectivePrice * current.quantity;
    const discount = gross * (current.discount_percent / 100);

    updated[index] = {
      ...current,
      variant_id: variant.id,
      variant_name: variant.name,
      price_modifier: variant.price_modifier || 0,
      total_amount: Number((gross - discount).toFixed(2))
    };

    setLines(updated);
  };

  const handleLineFieldChange = (index, field, value) => {
    const updated = [...lines];
    const current = { ...updated[index] };

    if (field === 'quantity') {
      current.quantity = Math.max(1, parseInt(value, 10) || 1);
    } else if (field === 'discount_percent') {
      current.discount_percent = Math.min(100, Math.max(0, parseFloat(value) || 0));
    } else if (field === 'unit_price') {
      current.unit_price = Math.max(0, parseFloat(value) || 0);
    }

    const effectivePrice = (current.unit_price || 0) + (current.price_modifier || 0);
    const gross = effectivePrice * current.quantity;
    const discAmount = gross * (current.discount_percent / 100);
    current.total_amount = Number((gross - discAmount).toFixed(2));

    updated[index] = current;
    setLines(updated);
  };

  // Compute live totals
  const subtotal = lines.reduce(
    (acc, line) => acc + (line.unit_price + (line.price_modifier || 0)) * line.quantity,
    0
  );
  const totalDiscount = lines.reduce(
    (acc, line) =>
      acc + (line.unit_price + (line.price_modifier || 0)) * line.quantity * (line.discount_percent / 100),
    0
  );
  const grandTotal = subtotal - totalDiscount;

  // Form Submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please provide a Template Name.');
      return;
    }
    if (lines.length === 0) {
      setFormError('At least one product line is required.');
      return;
    }

    const matchedPlan = availablePlans.find((p) => p.id === planId) || availablePlans[0];

    const payload = {
      ...(initialData || {}),
      name: name.trim(),
      description: description.trim(),
      validity_duration: validityDuration,
      validity_unit: validityUnit,
      validity_terms: validityTerms.trim(),
      plan_id: matchedPlan.id,
      plan_name: matchedPlan.name,
      billing_frequency: matchedPlan.billing_frequency,
      closing_behavior: matchedPlan.closing_behavior,
      require_signature: requireSignature,
      require_payment: requirePayment,
      status,
      lines,
      subtotal: Number(subtotal.toFixed(2)),
      total_discount: Number(totalDiscount.toFixed(2)),
      grand_total: Number(grandTotal.toFixed(2))
    };

    onSave(payload);
  };

  return (
    <div className="quote-template-form-card">
      <div className="form-header">
        <div>
          <h3>{isEditing ? `Edit Template: ${initialData.name}` : 'New Quotation Template'}</h3>
          <p className="form-subtitle">
            Configure preset quotation parameters, subscription plans, and validity duration for sales reps.
          </p>
        </div>
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
      </div>

      {formError && <div className="alert alert-danger">{formError}</div>}

      <form onSubmit={handleSubmit}>
        {/* Section 1: Template Identity */}
        <div className="form-section">
          <h4 className="section-title">General Information</h4>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">
                Template Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Enterprise Cloud Annual Package"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Subscription Plan (schema.json)</label>
              <select
                className="form-select"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
              >
                {availablePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} ({plan.billing_frequency} • {plan.closing_behavior})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description / Internal Scope</label>
            <input
              type="text"
              className="form-input"
              placeholder="Brief context regarding when to propose this quotation template..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Section 2: Validity Period (Crucial Feature) */}
        <div className="form-section validity-configuration-section">
          <div className="section-header-flex">
            <div>
              <h4 className="section-title">⏱️ Quotation Validity Period</h4>
              <p className="section-caption">
                Specify how long quotations generated from this template will remain active and legally binding before expiration.
              </p>
            </div>
          </div>

          <div className="validity-presets-bar">
            <span className="preset-label">Quick Presets:</span>
            {MOCK_VALIDITY_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.value}
                className={`preset-btn ${validityDuration === preset.value ? 'active' : ''}`}
                onClick={() => handleValidityDurationChange(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">
                Validity Duration <span className="text-danger">*</span>
              </label>
              <div className="input-group">
                <input
                  type="number"
                  min="1"
                  max="365"
                  className="form-input"
                  value={validityDuration}
                  onChange={(e) => handleValidityDurationChange(e.target.value)}
                  required
                />
                <span className="input-addon">Days</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Validity Unit</label>
              <select
                className="form-select"
                value={validityUnit}
                onChange={(e) => setValidityUnit(e.target.value)}
              >
                <option value="days">Days (Standard)</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="active">Active (Available to Sales Reps)</option>
                <option value="draft">Draft (Work in Progress)</option>
                <option value="archived">Archived (Retired)</option>
              </select>
            </div>
          </div>

          {/* Live Expiration Forecast Card */}
          <div className="validity-preview-card">
            <div className="forecast-icon">📅</div>
            <div className="forecast-details">
              <strong>Dynamic Validity Forecast:</strong>
              <span>
                A quote issued today ({validityForecast.quotation_date_formatted}) will expire on{' '}
                <mark className="highlight-date">{validityForecast.expiration_date_formatted}</mark>{' '}
                (valid for <strong>{validityDuration} days</strong>).
              </span>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '14px' }}>
            <label className="form-label">Validity Clause & Legal Expiration Terms</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={validityTerms}
              onChange={(e) => setValidityTerms(e.target.value)}
              placeholder="Terms and conditions governing quotation validity and price guarantees..."
            />
          </div>
        </div>

        {/* Section 3: Signature & Payment Options */}
        <div className="form-section">
          <h4 className="section-title">Odoo Online Confirmation Rules</h4>
          <div className="form-checkbox-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={requireSignature}
                onChange={(e) => setRequireSignature(e.target.checked)}
              />
              <span>
                <strong>Require Customer Online Signature</strong>
                <small className="help-text">Customer must draw/upload e-signature before quote converts to Subscription.</small>
              </span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={requirePayment}
                onChange={(e) => setRequirePayment(e.target.checked)}
              />
              <span>
                <strong>Require Online Advance Payment</strong>
                <small className="help-text">Collect online payment token upon quotation confirmation.</small>
              </span>
            </label>
          </div>
        </div>

        {/* Section 4: Line Items (Products & Variants from schema.json) */}
        <div className="form-section">
          <div className="section-header-flex">
            <div>
              <h4 className="section-title">Pre-configured Line Items</h4>
              <p className="section-caption">
                Configure default products and variants (mocked from Product Catalog module).
              </p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddLine}>
              + Add Product Line
            </button>
          </div>

          <div className="table-responsive">
            <table className="quote-lines-table">
              <thead>
                <tr>
                  <th style={{ width: '32%' }}>Product</th>
                  <th style={{ width: '28%' }}>Variant (schema.json)</th>
                  <th style={{ width: '10%' }}>Qty</th>
                  <th style={{ width: '12%' }}>Unit Price</th>
                  <th style={{ width: '8%' }}>Disc %</th>
                  <th style={{ width: '10%' }}>Subtotal</th>
                  <th style={{ width: '5%' }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const currentProd = availableProducts.find((p) => p.id === line.product_id) || availableProducts[0];
                  const variants = currentProd?.variants || [];

                  return (
                    <tr key={line.line_id || idx}>
                      <td>
                        <select
                          className="table-select"
                          value={line.product_id}
                          onChange={(e) => handleProductChange(idx, e.target.value)}
                        >
                          {availableProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (${p.sales_price})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="table-select"
                          value={line.variant_id}
                          onChange={(e) => handleVariantChange(idx, e.target.value)}
                          disabled={variants.length === 0}
                        >
                          {variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.price_modifier >= 0 ? `+$${v.price_modifier}` : `-$${Math.abs(v.price_modifier)}`})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          className="table-input"
                          value={line.quantity}
                          onChange={(e) => handleLineFieldChange(idx, 'quantity', e.target.value)}
                        />
                      </td>
                      <td>
                        <div className="unit-price-cell">
                          ${(line.unit_price + (line.price_modifier || 0)).toFixed(2)}
                          {line.price_modifier > 0 && (
                            <span className="variant-tag">+${line.price_modifier} var</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="table-input"
                          value={line.discount_percent}
                          onChange={(e) => handleLineFieldChange(idx, 'discount_percent', e.target.value)}
                        />
                      </td>
                      <td>
                        <strong>${line.total_amount?.toFixed(2)}</strong>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-icon-danger"
                          title="Remove line"
                          onClick={() => handleRemoveLine(idx)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="financials-summary-box">
            <div className="financials-row">
              <span>Lines Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="financials-row text-success">
                <span>Discounts Applied:</span>
                <span>-${totalDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="financials-row grand-total-row">
              <span>Estimated Template Total:</span>
              <span className="grand-total-amount">${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="form-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Discard
          </button>
          <button type="submit" className="btn btn-primary">
            {isEditing ? 'Save Changes' : 'Create Quotation Template'}
          </button>
        </div>
      </form>
    </div>
  );
}

