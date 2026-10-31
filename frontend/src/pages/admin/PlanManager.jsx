import React, { useState, useEffect, useMemo, useRef } from 'react';
import './PlanManager.css';
import { INITIAL_PLANS, INITIAL_PRODUCTS } from '../../data/initialData';

const PLANS_API_URL = 'http://localhost:5000/api/plans';
const PRODUCTS_API_URL = 'http://localhost:5000/api/products';

// Strictly enforced options
const BILLING_FREQUENCIES = [
  { value: 'daily', label: 'Daily (Billed every 24 hours)' },
  { value: 'weekly', label: 'Weekly (Billed every 7 days)' },
  { value: 'monthly', label: 'Monthly (Billed once a month)' },
  { value: 'yearly', label: 'Yearly (Billed annually — schema.json)' }
];

const CLOSING_BEHAVIORS = [
  {
    value: 'renew',
    label: 'Auto-Renew (Renews subscription at end of cycle)',
    badgeClass: 'behavior-renew',
    desc: 'Subscription automatically renews for the next billing cycle until canceled.'
  },
  {
    value: 'close_on_own',
    label: 'Closes On Its Own (Closes upon expiry/term completion)',
    badgeClass: 'behavior-close-own',
    desc: 'Terminates automatically on the available_until date without renewing.'
  },
  {
    value: 'close_early',
    label: 'Closes Early (Early termination permitted)',
    badgeClass: 'behavior-close-early',
    desc: 'Subscriber or admin can exit the subscription before the period expires.'
  },
  {
    value: 'pause',
    label: 'Pauses (Pauses at cycle end for confirmation)',
    badgeClass: 'behavior-pause',
    desc: 'Subscription automatically pauses at cycle end until manually reactivated.'
  }
];

export default function PlanManager({
  plans = [],
  products = [],
  apiConnected = false,
  loading = false,
  onLaunchPlan,
  onQuickLinkPlan,
  onDeletePlan,
  onTogglePlanStatus,
  onResetDemoSeed,
  notification: externalNotification,
  showNotification: externalShowNotification
}) {
  const [activeTab, setActiveTab] = useState('plans'); // 'plans' | 'products'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFreqFilter, setSelectedFreqFilter] = useState('all');
  const [selectedBehaviorFilter, setSelectedBehaviorFilter] = useState('all');

  // Modal States
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [isQuickLinkModalOpen, setIsQuickLinkModalOpen] = useState(false);
  const [targetProductForLinking, setTargetProductForLinking] = useState(null);
  const [selectedPlanToLink, setSelectedPlanToLink] = useState('');

  const [localNotification, setLocalNotification] = useState(null);

  const showNotification = (msg, type = 'success') => {
    if (externalShowNotification) {
      externalShowNotification(msg, type);
    } else {
      setLocalNotification({ msg, type });
      setTimeout(() => setLocalNotification(null), 4000);
    }
  };

  const notification = externalNotification || localNotification;

  // Searchable Product Dropdown State inside Modal
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Form State
  const defaultDates = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    return {
      today,
      nextYear: oneYearLater.toISOString().split('T')[0]
    };
  }, []);

  const [formData, setFormData] = useState({
    id: '',
    product_id: '', // Strictly starts empty - prevents defaulting to prod_1 or accidental linking
    name: '',
    code: '',
    description: '',
    billing_frequency: 'monthly',
    minimum_quantity: 1,
    available_from: defaultDates.today,
    available_until: defaultDates.nextYear,
    closing_behavior: 'renew',
    base_price: 150,
    status: 'active'
  });

  const [formErrors, setFormErrors] = useState({});

  // Strict Frontend Validation Function
  const validateForm = (data) => {
    const errors = {};

    if (!data.name.trim()) {
      errors.name = 'Plan name is required.';
    }

    if (!data.product_id || !data.product_id.trim()) {
      errors.product_id = 'Target product selection is required. Please search and select an existing product.';
    }

    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(data.billing_frequency)) {
      errors.billing_frequency = 'Billing frequency must be daily, weekly, monthly, or yearly.';
    }

    const minQty = Number(data.minimum_quantity);
    if (isNaN(minQty) || minQty < 1 || !Number.isInteger(minQty)) {
      errors.minimum_quantity = 'Minimum quantity must be a whole number of at least 1.';
    }

    if (!data.available_from) {
      errors.available_from = 'Start date is required.';
    }

    if (!data.available_until) {
      errors.available_until = 'End date is required.';
    }

    if (data.available_from && data.available_until) {
      const fromTime = new Date(data.available_from).getTime();
      const untilTime = new Date(data.available_until).getTime();

      if (untilTime < fromTime) {
        errors.available_until = 'End date must be on or after Start date.';
      }
    }

    if (!['renew', 'close_on_own', 'close_early', 'pause'].includes(data.closing_behavior)) {
      errors.closing_behavior = 'Closing behavior must be renew, close_on_own, close_early, or pause.';
    }

    return errors;
  };

  const handleInputChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    const errs = validateForm(updated);
    setFormErrors(errs);
  };

  // Typing handler for product search: auto-selects first match or clears if empty/invalid
  const handleProductSearchChange = (typedValue) => {
    setProductSearchTerm(typedValue);
    setIsProductDropdownOpen(true);

    const term = typedValue.toLowerCase().trim();
    if (!term) {
      // Cleared input - unselect product
      handleInputChange('product_id', '');
      return;
    }

    const matches = products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term) ||
        (p.category && p.category.toLowerCase().includes(term))
    );

    if (matches.length > 0) {
      // Automatically select the first matching product as the user types
      handleInputChange('product_id', matches[0].id);
    } else {
      // Clear product_id to prevent linking to a mismatched product
      handleInputChange('product_id', '');
    }
  };

  // Explicit click confirmation from dropdown
  const handleSelectProduct = (product) => {
    handleInputChange('product_id', product.id);
    setProductSearchTerm(product.name);
    setIsProductDropdownOpen(false);
  };

  // Clear product selection
  const handleClearProductSelection = () => {
    handleInputChange('product_id', '');
    setProductSearchTerm('');
    setIsProductDropdownOpen(false);
  };

  // Open modal with fresh unselected product state
  const handleOpenLaunchModal = () => {
    setProductSearchTerm('');
    setFormData({
      id: '',
      product_id: '',
      name: '',
      code: '',
      description: '',
      billing_frequency: 'monthly',
      minimum_quantity: 1,
      available_from: defaultDates.today,
      available_until: defaultDates.nextYear,
      closing_behavior: 'renew',
      base_price: 150,
      status: 'active'
    });
    setFormErrors({});
    setIsProductDropdownOpen(false);
    setIsLaunchModalOpen(true);
  };

  // Filtered Products for the Searchable Dropdown
  const searchableProducts = useMemo(() => {
    if (!productSearchTerm.trim()) return products;
    const term = productSearchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term) ||
        (p.category && p.category.toLowerCase().includes(term))
    );
  }, [products, productSearchTerm]);

  // Selected product object
  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === formData.product_id) || null;
  }, [products, formData.product_id]);

  // Launch New Plan Submission
  const handleLaunchPlan = async (e) => {
    e.preventDefault();
    const errs = validateForm(formData);

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      showNotification('Please correct the validation errors in the form.', 'error');
      return;
    }

    const planId = formData.id.trim() || `plan_${Date.now()}`;
    const planCode =
      formData.code.trim().toUpperCase() ||
      `${formData.name.toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 10)}-${formData.billing_frequency.toUpperCase()}`;

    const newPlanPayload = {
      ...formData,
      id: planId,
      code: planCode,
      product_id: formData.product_id || null,
      minimum_quantity: Number(formData.minimum_quantity),
      base_price: Number(formData.base_price) || 0,
      createdAt: new Date().toISOString()
    };

    if (onLaunchPlan) {
      await onLaunchPlan(newPlanPayload);
    } else {
      // Direct HTTP POST request without any if (apiConnected) condition
      try {
        await fetch(PLANS_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPlanPayload)
        });
      } catch (err) {
        console.warn('Network error launching plan (fallback active):', err);
      }
    }

    setIsLaunchModalOpen(false);

    // Reset Form
    setFormData({
      id: '',
      product_id: '',
      name: '',
      code: '',
      description: '',
      billing_frequency: 'monthly',
      minimum_quantity: 1,
      available_from: defaultDates.today,
      available_until: defaultDates.nextYear,
      closing_behavior: 'renew',
      base_price: 150,
      status: 'active'
    });
    setProductSearchTerm('');
    setFormErrors({});
  };

  // Quick Link Modal Handler
  const handleOpenQuickLink = (product) => {
    setTargetProductForLinking(product);
    setSelectedPlanToLink(plans[0]?.id || '');
    setIsQuickLinkModalOpen(true);
  };

  const handleConfirmQuickLink = async (e) => {
    e.preventDefault();
    if (!selectedPlanToLink || !targetProductForLinking) return;

    if (onQuickLinkPlan) {
      await onQuickLinkPlan(targetProductForLinking.id, selectedPlanToLink);
    } else {
      // Direct HTTP POST request without any if (apiConnected) condition
      try {
        await fetch(`${PRODUCTS_API_URL}/${targetProductForLinking.id}/plans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: selectedPlanToLink })
        });
      } catch (err) {
        console.warn('Network error linking plan (fallback active):', err);
      }
    }

    setIsQuickLinkModalOpen(false);
  };

  // Delete Plan
  const handleDeletePlan = async (planId) => {
    if (!window.confirm(`Are you sure you want to delete plan '${planId}'?`)) return;

    if (onDeletePlan) {
      await onDeletePlan(planId);
    } else {
      // Direct HTTP DELETE request without any if (apiConnected) condition
      try {
        await fetch(`${PLANS_API_URL}/${planId}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Network error deleting plan (fallback active):', err);
      }
    }
  };

  // Toggle Plan Status
  const handleToggleStatus = async (plan) => {
    if (onTogglePlanStatus) {
      await onTogglePlanStatus(plan);
    } else {
      const nextStatus = plan.status === 'active' ? 'paused' : 'active';
      try {
        await fetch(`${PLANS_API_URL}/${plan.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus })
        });
      } catch (err) {
        console.warn('Network error updating plan status:', err);
      }
    }
  };

  // Filtered Plans List
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesFreq =
        selectedFreqFilter === 'all' || p.billing_frequency === selectedFreqFilter;

      const matchesBehavior =
        selectedBehaviorFilter === 'all' || p.closing_behavior === selectedBehaviorFilter;

      return matchesSearch && matchesFreq && matchesBehavior;
    });
  }, [plans, searchQuery, selectedFreqFilter, selectedBehaviorFilter]);

  // Filtered Products for Products View
  const filteredProductsCatalog = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [products, searchQuery]);

  // Availability Badge
  const getAvailabilityInfo = (fromDateStr, untilDateStr, status) => {
    if (status !== 'active') return { label: 'Paused', className: 'status-paused' };
    const now = new Date();
    const from = new Date(fromDateStr);
    const until = new Date(untilDateStr);

    if (now < from) {
      return { label: 'Upcoming', className: 'status-upcoming' };
    } else if (now > until) {
      return { label: 'Expired', className: 'status-expired' };
    }
    return { label: 'Available Now', className: 'status-available' };
  };

  const getClosingBehaviorMeta = (behaviorKey) => {
    return (
      CLOSING_BEHAVIORS.find((b) => b.value === behaviorKey) || {
        label: behaviorKey,
        badgeClass: 'behavior-renew',
        desc: ''
      }
    );
  };

  return (
    <div className="plan-manager-container">
      {/* Toast Notification */}
      {notification && (
        <div className={`plan-toast ${notification.type}`}>
          <span className="toast-icon">✨</span>
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Header */}
      <header className="plan-header">
        <div className="plan-header-left">
          <div className="system-pill">
            <span className={`status-dot ${apiConnected ? 'online' : 'sandbox'}`} />
            {apiConnected ? 'API Connected (Port 5000)' : 'Plan & Product Sandbox (Local Store)'}
            <span className="schema-tag">docs/schema.json</span>
          </div>
          <h1 className="plan-title">Subscription Plan & Product Association Manager</h1>
          <p className="plan-subtitle">
            Configure subscription plans, link them to specific catalog products, enforce strict billing frequencies
            (daily, weekly, monthly, yearly), minimum quantities, availability dates, and automated closing behaviors.
          </p>
        </div>

        <div className="plan-header-actions">
          <button
            className="btn-outline"
            onClick={() => onResetDemoSeed ? onResetDemoSeed() : null}
            title="Reload initial seed plans & products"
          >
            🔄 Reset Demo Seed
          </button>
          <button id="btn-open-launch-modal" className="btn-launch-plan" onClick={handleOpenLaunchModal}>
            <span className="btn-icon">🚀</span> Launch & Link New Plan
          </button>
        </div>
      </header>

      {/* View Switcher Tabs */}
      <div className="tabs-header-bar">
        <div className="tab-buttons">
          <button
            id="tab-btn-plans"
            className={`tab-btn ${activeTab === 'plans' ? 'active' : ''}`}
            onClick={() => setActiveTab('plans')}
          >
            📋 Subscription Plans ({plans.length})
          </button>
          <button
            id="tab-btn-products"
            className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            📦 Products & Nested Plans Catalog ({products.length})
          </button>
        </div>

        <div className="kpi-micro-summary">
          <span>Linked Products: <strong>{products.filter((p) => (p.plans || []).length > 0).length} / {products.length}</strong></span>
          <span>•</span>
          <span>Total Plan Associations: <strong>{products.reduce((acc, p) => acc + (p.plans?.length || 0), 0)}</strong></span>
        </div>
      </div>

      {/* TAB 1: ALL PLANS VIEW */}
      {activeTab === 'plans' && (
        <>
          {/* KPI Grid */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="kpi-title">Active Plans</span>
              <span className="kpi-num">{plans.filter((p) => p.status === 'active').length}</span>
              <span className="kpi-sub">Total {plans.length} configured plans</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-title">Yearly / Recurring</span>
              <span className="kpi-num">
                {plans.filter((p) => p.billing_frequency === 'yearly').length}
              </span>
              <span className="kpi-sub">Auto-renewing recurring plans</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-title">Products Attached</span>
              <span className="kpi-num">
                {new Set(plans.map((p) => p.product_id).filter(Boolean)).size}
              </span>
              <span className="kpi-sub">Unique products with active plans</span>
            </div>
          </div>

          {/* Filter Row */}
          <div className="plan-filter-row">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search plans by name, code, or ID (e.g. plan_1)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Frequency:</label>
              <select
                className="filter-select"
                value={selectedFreqFilter}
                onChange={(e) => setSelectedFreqFilter(e.target.value)}
              >
                <option value="all">All Frequencies</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Closing Behavior:</label>
              <select
                className="filter-select"
                value={selectedBehaviorFilter}
                onChange={(e) => setSelectedBehaviorFilter(e.target.value)}
              >
                <option value="all">All Behaviors</option>
                <option value="renew">Auto-Renew</option>
                <option value="close_on_own">Closes On Own</option>
                <option value="close_early">Closes Early</option>
                <option value="pause">Pauses</option>
              </select>
            </div>
          </div>

          {/* Plans Grid */}
          <div className="plans-grid">
            {filteredPlans.map((plan) => {
              const avail = getAvailabilityInfo(plan.available_from, plan.available_until, plan.status);
              const behaviorMeta = getClosingBehaviorMeta(plan.closing_behavior);
              const linkedProduct = products.find((p) => p.id === plan.product_id);

              return (
                <div key={plan.id} className={`plan-card ${plan.status === 'paused' ? 'paused' : ''}`}>
                  <div className="plan-card-header">
                    <div className="id-and-code">
                      <span className="plan-id-badge">{plan.id}</span>
                      <span className="plan-code-badge">{plan.code}</span>
                    </div>
                    <div className="header-badges">
                      <span className={`avail-badge ${avail.className}`}>{avail.label}</span>
                    </div>
                  </div>

                  <h3 className="card-plan-name">{plan.name}</h3>
                  <p className="card-plan-desc">{plan.description || 'No description provided.'}</p>

                  {/* Attached Product Tag */}
                  <div className="attached-product-callout">
                    <span className="callout-icon">📦</span>
                    <div className="callout-text">
                      <span className="callout-label">Attached Product:</span>
                      {linkedProduct ? (
                        <strong className="linked-product-title">
                          {linkedProduct.name} <span className="prod-id-tag">({linkedProduct.id})</span>
                        </strong>
                      ) : (
                        <span className="unattached-tag">Global / Unassigned Plan</span>
                      )}
                    </div>
                  </div>

                  {/* Rules Summary Box */}
                  <div className="rules-summary-box">
                    <div className="rule-item">
                      <span className="rule-label">Billing Frequency</span>
                      <span className="rule-value highlight-freq">
                        {plan.billing_frequency.toUpperCase()}
                      </span>
                    </div>

                    <div className="rule-item">
                      <span className="rule-label">Minimum Quantity</span>
                      <span className="rule-value">
                        {plan.minimum_quantity} {plan.minimum_quantity === 1 ? 'unit' : 'units'} min
                      </span>
                    </div>

                    <div className="rule-item">
                      <span className="rule-label">Base Rate</span>
                      <span className="rule-value price">
                        ${plan.base_price?.toLocaleString() || 0} / {plan.billing_frequency}
                      </span>
                    </div>
                  </div>

                  {/* Available Dates Box */}
                  <div className="dates-box">
                    <div className="date-field">
                      <span className="date-label">Available From:</span>
                      <span className="date-value">
                        {new Date(plan.available_from).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <span className="date-separator">→</span>
                    <div className="date-field">
                      <span className="date-label">Available Until:</span>
                      <span className="date-value">
                        {new Date(plan.available_until).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Closing Behavior Banner */}
                  <div className={`behavior-banner ${behaviorMeta.badgeClass}`}>
                    <div className="behavior-title-row">
                      <span className="behavior-tag-label">Closing Behavior:</span>
                      <span className="behavior-badge-pill">{behaviorMeta.label}</span>
                    </div>
                    <p className="behavior-detail">{behaviorMeta.desc}</p>
                  </div>

                  {/* Actions Footer */}
                  <div className="card-actions-footer">
                    <button
                      className="btn-action-text"
                      onClick={() => handleToggleStatus(plan)}
                    >
                      {plan.status === 'active' ? '⏸️ Pause Plan' : '▶️ Activate Plan'}
                    </button>
                    <button
                      className="btn-action-delete"
                      onClick={() => handleDeletePlan(plan.id)}
                      title="Delete Plan"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* TAB 2: PRODUCTS & NESTED PLANS CATALOG VIEW */}
      {activeTab === 'products' && (
        <div className="products-plans-section">
          <div className="section-intro-bar">
            <div>
              <h2>Products with Nested Associated Plans</h2>
              <p>
                Each product below returns populated nested plan data via <code>GET /api/products</code>.
                When a new plan is linked, this view updates immediately.
              </p>
            </div>
          </div>

          <div className="products-plans-grid">
            {filteredProductsCatalog.map((product) => {
              // Resolve nested plan objects
              const rawPlans = product.plans || [];
              const resolvedPlans = rawPlans
                .map((pl) => (typeof pl === 'string' ? plans.find((p) => p.id === pl) : pl))
                .filter(Boolean);

              return (
                <div key={product.id} className="product-with-plans-card">
                  <div className="product-card-top">
                    <div>
                      <span className="badge-category">{product.category}</span>
                      <h3 className="product-heading">{product.name}</h3>
                      <span className="product-id-pill">{product.id}</span>
                    </div>
                    <div className="product-price-badge">
                      <span className="price-small-label">Base Sales Price</span>
                      <span className="price-val">${product.sales_price?.toLocaleString()}</span>
                    </div>
                  </div>

                  <p className="product-desc-text">{product.description || 'No description provided.'}</p>

                  {/* Nested Plans Container */}
                  <div className="nested-plans-block">
                    <div className="nested-plans-header">
                      <span className="block-title">
                        Associated Subscription Plans ({resolvedPlans.length})
                      </span>
                      <button
                        className="btn-link-plan-inline"
                        onClick={() => handleOpenQuickLink(product)}
                      >
                        ＋ Link Existing Plan
                      </button>
                    </div>

                    {resolvedPlans.length > 0 ? (
                      <div className="nested-plans-list">
                        {resolvedPlans.map((pl) => (
                          <div key={pl.id} className="nested-plan-item">
                            <div className="nested-plan-main">
                              <span className="nested-plan-name">{pl.name}</span>
                              <div className="nested-plan-badges">
                                <span className="freq-badge">{pl.billing_frequency?.toUpperCase()}</span>
                                <span className={`behavior-badge ${pl.closing_behavior}`}>
                                  {pl.closing_behavior === 'renew' ? 'Auto-Renew' : pl.closing_behavior}
                                </span>
                                <span className="min-qty-badge">{pl.minimum_quantity} min</span>
                              </div>
                            </div>
                            <span className="nested-plan-price">
                              ${pl.base_price?.toLocaleString()} / {pl.billing_frequency}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="no-nested-plans">
                        <span>No subscription plans attached to this product yet.</span>
                        <button
                          className="btn-text-link"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, product_id: product.id }));
                            setProductSearchTerm(product.name);
                            setFormErrors({});
                            setIsProductDropdownOpen(false);
                            setIsLaunchModalOpen(true);
                          }}
                        >
                          Launch New Plan for this Product
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: LAUNCH & LINK PLAN */}
      {isLaunchModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsLaunchModalOpen(false)}>
          <div className="modal-wrapper large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <div>
                <h2 className="modal-heading">Launch Plan & Link to Product</h2>
                <p className="modal-subheading">
                  Enforces strict business rules: billing frequency dropdown, minimum quantity,
                  available dates, and closing behavior settings.
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setIsLaunchModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleLaunchPlan} className="plan-form">
              {/* TARGET PRODUCT SELECTION (SEARCHABLE DROPDOWN) */}
              <div className={`product-selector-card ${formErrors.product_id ? 'has-error' : ''}`}>
                <div className="selector-title-row">
                  <label className="required-label">
                    Target Product Association *
                    <span className="rule-badge">Searchable Dropdown</span>
                  </label>
                  {selectedProduct ? (
                    <span className="selected-tag-pill">
                      ✓ Linked: <strong>{selectedProduct.name}</strong> ({selectedProduct.id})
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '0.78rem',
                        background: 'rgba(234, 179, 8, 0.15)',
                        color: '#facc15',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        fontWeight: 600
                      }}
                    >
                      ⚠️ Required: None Selected
                    </span>
                  )}
                </div>

                {/* Searchable Dropdown Field */}
                <div className="searchable-dropdown-wrapper" ref={dropdownRef}>
                  <div className="search-input-box">
                    <span className="dropdown-search-icon">🔍</span>
                    <input
                      id="product-search-input"
                      type="text"
                      className="product-search-input"
                      placeholder="Type product name to auto-match (e.g., Cloud, Gateway, POS)..."
                      value={productSearchTerm}
                      onFocus={() => setIsProductDropdownOpen(true)}
                      onChange={(e) => handleProductSearchChange(e.target.value)}
                    />
                    {(productSearchTerm || formData.product_id) && (
                      <button
                        id="btn-clear-product-selection"
                        type="button"
                        className="clear-selection-btn"
                        onClick={handleClearProductSelection}
                        title="Clear product selection"
                      >
                        ✕ Clear
                      </button>
                    )}
                  </div>

                  {/* Dropdown Options Menu */}
                  {isProductDropdownOpen && (
                    <div className="dropdown-options-menu">
                      {searchableProducts.length > 0 ? (
                        searchableProducts.map((p, index) => {
                          const isAutoMatched = formData.product_id === p.id;
                          return (
                            <div
                              key={p.id}
                              className={`dropdown-option ${isAutoMatched ? 'active' : ''}`}
                              onClick={() => handleSelectProduct(p)}
                            >
                              <div className="option-info">
                                <span className="option-name">{p.name}</span>
                                <div className="option-tags">
                                  <span className="option-id">{p.id}</span>
                                  <span className="option-cat">{p.category}</span>
                                  <span className="option-price">Base: ${p.sales_price}</span>
                                </div>
                              </div>
                              {isAutoMatched && (
                                <span className="check-mark">
                                  ✓ Selected {productSearchTerm && index === 0 ? '(Auto-match)' : ''}
                                </span>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div
                          style={{
                            padding: '1rem',
                            color: '#ef4444',
                            fontSize: '0.85rem',
                            textAlign: 'center',
                            background: 'rgba(239, 68, 68, 0.05)'
                          }}
                        >
                          ❌ No catalog product matches "{productSearchTerm}". Click Clear or try another term.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {formErrors.product_id && (
                  <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 600 }}>
                    ⚠️ {formErrors.product_id}
                  </div>
                )}

                {selectedProduct ? (
                  <div className="selected-product-summary">
                    <span className="summary-icon">✅</span>
                    <span>
                      This plan will be attached to <strong>{selectedProduct.name}</strong> (${selectedProduct.sales_price} base price).
                      The product's <code>GET /api/products</code> response will immediately include this plan.
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.6rem 0.85rem',
                      background: 'rgba(234, 179, 8, 0.08)',
                      border: '1px solid rgba(234, 179, 8, 0.25)',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      color: '#fde047',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <span>💡</span>
                    <span>
                      Type a keyword above to <strong>auto-select</strong> the first match, or click a product from the list to link explicitly.
                    </span>
                  </div>
                )}
              </div>

              {/* Row 1: ID, Code, Base Price */}
              <div className="form-grid-3">
                <div className="input-group">
                  <label>Plan ID (Optional)</label>
                  <input
                    type="text"
                    placeholder={`e.g. plan_${plans.length + 1}`}
                    value={formData.id}
                    onChange={(e) => handleInputChange('id', e.target.value)}
                  />
                  <small>Matches docs/schema.json contract</small>
                </div>

                <div className="input-group">
                  <label>Plan Code</label>
                  <input
                    type="text"
                    placeholder="e.g. ERP-ANNUAL-VIP"
                    value={formData.code}
                    onChange={(e) => handleInputChange('code', e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label>Plan Rate ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="1200"
                    value={formData.base_price}
                    onChange={(e) => handleInputChange('base_price', e.target.value)}
                  />
                </div>
              </div>

              {/* Plan Name */}
              <div className="input-group">
                <label>Plan Name *</label>
                <input
                  id="plan-name-input"
                  type="text"
                  required
                  className={formErrors.name ? 'input-error' : ''}
                  placeholder="e.g. Enterprise Annual ERP Suite"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
                {formErrors.name && <span className="error-message">{formErrors.name}</span>}
              </div>

              {/* Strict Business Rules 1 & 2: Billing Frequency & Min Quantity */}
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="required-label">
                    Billing Frequency *
                    <span className="rule-badge">daily / weekly / monthly / yearly</span>
                  </label>
                  <select
                    className={`custom-select ${formErrors.billing_frequency ? 'input-error' : ''}`}
                    value={formData.billing_frequency}
                    onChange={(e) => handleInputChange('billing_frequency', e.target.value)}
                  >
                    {BILLING_FREQUENCIES.map((freq) => (
                      <option key={freq.value} value={freq.value}>
                        {freq.label}
                      </option>
                    ))}
                  </select>
                  {formErrors.billing_frequency && (
                    <span className="error-message">{formErrors.billing_frequency}</span>
                  )}
                  <small>Dropdown strictly limited to 4 frequency options</small>
                </div>

                <div className="input-group">
                  <label className="required-label">
                    Minimum Quantity *
                    <span className="rule-badge">Min 1 Required</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    className={formErrors.minimum_quantity ? 'input-error' : ''}
                    value={formData.minimum_quantity}
                    onChange={(e) => handleInputChange('minimum_quantity', e.target.value)}
                  />
                  {formErrors.minimum_quantity && (
                    <span className="error-message">{formErrors.minimum_quantity}</span>
                  )}
                  <small>Minimum subscriber units or items to qualify</small>
                </div>
              </div>

              {/* Strict Business Rule 3: Available Dates */}
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="required-label">Available From (Start Date) *</label>
                  <input
                    type="date"
                    required
                    className={formErrors.available_from ? 'input-error' : ''}
                    value={formData.available_from}
                    onChange={(e) => handleInputChange('available_from', e.target.value)}
                  />
                  {formErrors.available_from && (
                    <span className="error-message">{formErrors.available_from}</span>
                  )}
                </div>

                <div className="input-group">
                  <label className="required-label">Available Until (End Date) *</label>
                  <input
                    type="date"
                    required
                    className={formErrors.available_until ? 'input-error' : ''}
                    value={formData.available_until}
                    onChange={(e) => handleInputChange('available_until', e.target.value)}
                  />
                  {formErrors.available_until && (
                    <span className="error-message">{formErrors.available_until}</span>
                  )}
                </div>
              </div>

              {/* Strict Business Rule 4: Closing Behavior Setting */}
              <div className="input-group">
                <label className="required-label">
                  Closing Behavior Setting *
                  <span className="rule-badge">renews / closes on own / closes early / pauses</span>
                </label>
                <select
                  className={`custom-select ${formErrors.closing_behavior ? 'input-error' : ''}`}
                  value={formData.closing_behavior}
                  onChange={(e) => handleInputChange('closing_behavior', e.target.value)}
                >
                  {CLOSING_BEHAVIORS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
                {formErrors.closing_behavior && (
                  <span className="error-message">{formErrors.closing_behavior}</span>
                )}
                <div className="behavior-hint-box">
                  <strong>Selected Policy:</strong>{' '}
                  {CLOSING_BEHAVIORS.find((b) => b.value === formData.closing_behavior)?.desc}
                </div>
              </div>

              {/* Description */}
              <div className="input-group">
                <label>Description</label>
                <textarea
                  rows="2"
                  placeholder="Terms, SLA guarantees, module inclusion, or target segment..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                />
              </div>

              {/* Live Plan Contract Preview */}
              <div className="live-contract-preview">
                <span className="preview-heading">JSON Data Contract Preview (docs/schema.json)</span>
                <pre className="code-preview">
{JSON.stringify(
  {
    Plan: {
      id: formData.id.trim() || `plan_${plans.length + 1}`,
      product_id: formData.product_id || null,
      billing_frequency: formData.billing_frequency,
      closing_behavior: formData.closing_behavior,
      minimum_quantity: Number(formData.minimum_quantity) || 1,
      available_from: formData.available_from,
      available_until: formData.available_until
    }
  },
  null,
  2
)}
                </pre>
              </div>

              {/* Modal Footer */}
              <div className="modal-bottom-actions">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setIsLaunchModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-launch-plan"
                  type="submit"
                  className="btn-launch-plan"
                  disabled={Object.keys(formErrors).length > 0}
                >
                  🚀 Launch & Link Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: QUICK LINK EXISTING PLAN TO PRODUCT */}
      {isQuickLinkModalOpen && targetProductForLinking && (
        <div className="modal-backdrop" onClick={() => setIsQuickLinkModalOpen(false)}>
          <div className="modal-wrapper" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <div>
                <h2 className="modal-heading">Link Plan to Product</h2>
                <p className="modal-subheading">
                  Product: <strong>{targetProductForLinking.name}</strong> ({targetProductForLinking.id})
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setIsQuickLinkModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmQuickLink} className="plan-form">
              <div className="input-group">
                <label>Select Plan to Attach</label>
                <select
                  className="custom-select"
                  value={selectedPlanToLink}
                  onChange={(e) => setSelectedPlanToLink(e.target.value)}
                >
                  {plans.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name} ({pl.id}) — {pl.billing_frequency.toUpperCase()} • {pl.closing_behavior}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-bottom-actions">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setIsQuickLinkModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-launch-plan">
                  Link Plan Immediately
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
