import React, { useState, useEffect, useMemo } from 'react';
import './ProductCatalog.css';
import { INITIAL_PRODUCTS } from '../../data/initialData';

const API_BASE_URL = 'http://localhost:5000/api/products';

export default function ProductCatalog({
  products = [],
  apiConnected = false,
  loading = false,
  onCreateProduct,
  onAddVariant,
  onDeleteVariant,
  onDeleteProduct,
  onResetSeed,
  notification: externalNotification,
  showNotification: externalShowNotification
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeVariants, setActiveVariants] = useState({}); // { [productId]: variantId }

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddVariantModalOpen, setIsAddVariantModalOpen] = useState(false);
  const [selectedProductForVariant, setSelectedProductForVariant] = useState(null);

  // New Product Form State
  const [newProduct, setNewProduct] = useState({
    id: '',
    name: '',
    description: '',
    category: 'Infrastructure',
    sales_price: 1200,
    cost_price: 200,
    variants: []
  });

  // Staging state for dynamic variant inside Create Product Modal
  const [stagedVariant, setStagedVariant] = useState({
    attribute: 'brand',
    value: '',
    price_modifier: 560
  });

  // Quick Variant Modal Form State
  const [quickVariant, setQuickVariant] = useState({
    attribute: 'brand',
    value: '',
    price_modifier: 560,
    sku: ''
  });

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


  // Initialize active variant selections
  useEffect(() => {
    const initialMap = {};
    products.forEach((p) => {
      if (p.variants && p.variants.length > 0 && !activeVariants[p.id]) {
        initialMap[p.id] = p.variants[0].id;
      }
    });
    if (Object.keys(initialMap).length > 0) {
      setActiveVariants((prev) => ({ ...initialMap, ...prev }));
    }
  }, [products]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(['All']);
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Calculation metrics
  const metrics = useMemo(() => {
    const totalCount = products.length;
    const totalVariants = products.reduce((acc, p) => acc + (p.variants?.length || 0), 0);
    const avgMargin =
      products.length > 0
        ? products.reduce((acc, p) => {
            const margin = p.sales_price - p.cost_price;
            return acc + (p.sales_price ? (margin / p.sales_price) * 100 : 0);
          }, 0) / products.length
        : 0;

    return { totalCount, totalVariants, avgMargin: avgMargin.toFixed(1) };
  }, [products]);

  // Handle stage variant inside new product form
  const handleAddStagedVariant = () => {
    if (!stagedVariant.value.trim()) {
      alert('Please enter a variant value (e.g., "Dell" or "Apple").');
      return;
    }

    const varId = `var_${Date.now()}`;
    const name = `${stagedVariant.attribute.charAt(0).toUpperCase() + stagedVariant.attribute.slice(1)}: ${stagedVariant.value.trim()}`;
    const newVar = {
      id: varId,
      name,
      attribute: stagedVariant.attribute,
      value: stagedVariant.value.trim(),
      price_modifier: Number(stagedVariant.price_modifier) || 0
    };

    setNewProduct((prev) => ({
      ...prev,
      variants: [...prev.variants, newVar]
    }));

    setStagedVariant({
      attribute: stagedVariant.attribute,
      value: '',
      price_modifier: 560
    });
  };

  const handleRemoveStagedVariant = (varId) => {
    setNewProduct((prev) => ({
      ...prev,
      variants: prev.variants.filter((v) => v.id !== varId)
    }));
  };

  // Submit New Product
  const handleCreateProductSubmit = async (e) => {
    e.preventDefault();
    if (!newProduct.name.trim()) {
      alert('Product name is required.');
      return;
    }

    const nextId = newProduct.id.trim() || `prod_${products.length + 1}`;
    const productPayload = {
      ...newProduct,
      id: nextId,
      sales_price: Number(newProduct.sales_price),
      cost_price: Number(newProduct.cost_price),
      status: 'active'
    };

    if (onCreateProduct) {
      await onCreateProduct(productPayload);
    } else {
      // Direct HTTP POST request without any if (apiConnected) condition
      try {
        await fetch(API_BASE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productPayload)
        });
      } catch (err) {
        console.warn('Network error creating product (fallback active):', err);
      }
    }

    if (productPayload.variants.length > 0) {
      setActiveVariants((prev) => ({
        ...prev,
        [productPayload.id]: productPayload.variants[0].id
      }));
    }

    setIsCreateModalOpen(false);
    setNewProduct({
      id: '',
      name: '',
      description: '',
      category: 'Infrastructure',
      sales_price: 1200,
      cost_price: 200,
      variants: []
    });
  };

  // Open Quick Variant Modal for a product
  const handleOpenAddVariantModal = (product) => {
    setSelectedProductForVariant(product);
    setQuickVariant({
      attribute: 'brand',
      value: '',
      price_modifier: 560,
      sku: `${product.id}-NEW`
    });
    setIsAddVariantModalOpen(true);
  };

  // Submit Quick Variant to existing product
  const handleAddQuickVariantSubmit = async (e) => {
    e.preventDefault();
    if (!quickVariant.value.trim()) {
      alert('Variant value is required.');
      return;
    }

    const targetProduct = selectedProductForVariant;
    const modifier = Number(quickVariant.price_modifier) || 0;
    const variantId = `var_${targetProduct.id}_${(targetProduct.variants?.length || 0) + 1}`;
    const variantName = `${quickVariant.attribute.charAt(0).toUpperCase() + quickVariant.attribute.slice(1)}: ${quickVariant.value.trim()}`;

    const newVar = {
      id: variantId,
      name: variantName,
      attribute: quickVariant.attribute,
      value: quickVariant.value.trim(),
      price_modifier: modifier,
      sku: quickVariant.sku || `${targetProduct.id}-${quickVariant.value.toUpperCase()}`
    };

    if (onAddVariant) {
      await onAddVariant(targetProduct.id, newVar);
    } else {
      // Direct HTTP POST request without any if (apiConnected) condition
      try {
        await fetch(`${API_BASE_URL}/${targetProduct.id}/variants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newVar)
        });
      } catch (err) {
        console.warn('Network error adding variant (fallback active):', err);
      }
    }

    // Auto-select the newly added variant to showcase live calculation
    setActiveVariants((prev) => ({
      ...prev,
      [targetProduct.id]: variantId
    }));

    setIsAddVariantModalOpen(false);
  };

  // Delete Variant
  const handleDeleteVariant = async (productId, variantId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this variant?')) return;

    if (onDeleteVariant) {
      await onDeleteVariant(productId, variantId);
    } else {
      // Direct HTTP DELETE request without any if (apiConnected) condition
      try {
        await fetch(`${API_BASE_URL}/${productId}/variants/${variantId}`, {
          method: 'DELETE'
        });
      } catch (err) {
        console.warn('Network error deleting variant (fallback active):', err);
      }
    }

    // Adjust active variant selection if current was deleted
    if (activeVariants[productId] === variantId) {
      const prod = products.find((p) => p.id === productId);
      const remaining = (prod?.variants || []).filter((v) => v.id !== variantId);
      setActiveVariants((prev) => ({
        ...prev,
        [productId]: remaining.length > 0 ? remaining[0].id : null
      }));
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm(`Are you sure you want to delete product ${productId}?`)) return;

    if (onDeleteProduct) {
      await onDeleteProduct(productId);
    } else {
      // Direct HTTP DELETE request without any if (apiConnected) condition
      try {
        await fetch(`${API_BASE_URL}/${productId}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Network error deleting product (fallback active):', err);
      }
    }
  };

  return (
    <div className="product-catalog-container">
      {/* Toast Notification */}
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <span className="toast-icon">✨</span>
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="catalog-header">
        <div className="header-left">
          <div className="badge-pill">
            <span className={`status-indicator ${apiConnected ? 'online' : 'offline'}`} />
            {apiConnected ? 'API Connected (Port 5000)' : 'Catalog Sandbox (Local State)'}
          </div>
          <h1 className="catalog-title">Product & Variant Catalog</h1>
          <p className="catalog-subtitle">
            Manage base products, configure dynamic attribute price modifiers (e.g. Brand +$560),
            and inspect customer pricing calculations in real-time.
          </p>
        </div>

        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={() => onResetSeed ? onResetSeed() : null}
            title="Reload initial dummy products"
          >
            🔄 Reset Demo Seed
          </button>
          <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)}>
            <span className="btn-icon">＋</span> Add New Product
          </button>
        </div>
      </header>

      {/* KPI Stats Bar */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Catalog Products</span>
          <span className="stat-value">{metrics.totalCount}</span>
          <span className="stat-sub">Tracked in docs/schema.json</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Configured Variants</span>
          <span className="stat-value">{metrics.totalVariants}</span>
          <span className="stat-sub">Dynamic attribute modifiers</span>
        </div>
        <div className="stat-card highlight">
          <span className="stat-label">Average Profit Margin</span>
          <span className="stat-value">{metrics.avgMargin}%</span>
          <span className="stat-sub">Across base prices</span>
        </div>
      </div>

      {/* Control Bar: Search & Category Filter */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search by product name, ID (e.g. prod_1), or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="category-chips">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`chip ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="products-grid">
        {filteredProducts.map((product) => {
          const selectedVariantId = activeVariants[product.id];
          const currentVariant =
            product.variants?.find((v) => v.id === selectedVariantId) || null;
          const modifier = currentVariant ? Number(currentVariant.price_modifier) || 0 : 0;
          const dynamicFinalPrice = product.sales_price + modifier;
          const profit = dynamicFinalPrice - product.cost_price;
          const profitPercentage = ((profit / dynamicFinalPrice) * 100).toFixed(1);

          return (
            <div key={product.id} className="product-card">
              <div className="product-card-header">
                <div className="product-meta">
                  <span className="product-id-tag">{product.id}</span>
                  <span className="product-category-tag">{product.category}</span>
                </div>
                <div className="card-top-actions">
                  <button
                    className="icon-btn delete-btn"
                    title="Delete Product"
                    onClick={() => handleDeleteProduct(product.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <h3 className="product-name">{product.name}</h3>
              <p className="product-desc">{product.description || 'No description provided.'}</p>

              {/* Base Price Breakdown */}
              <div className="price-overview-box">
                <div className="price-item">
                  <span className="price-label">Base Sales Price</span>
                  <span className="price-amount base">${product.sales_price.toLocaleString()}</span>
                </div>
                <div className="price-item">
                  <span className="price-label">Base Cost Price</span>
                  <span className="price-amount cost">${product.cost_price.toLocaleString()}</span>
                </div>
              </div>

              {/* Dynamic Variant Selector Section */}
              <div className="variants-section">
                <div className="variants-header">
                  <span className="section-title">
                    Product Variants ({product.variants?.length || 0})
                  </span>
                  <button
                    className="add-variant-link"
                    onClick={() => handleOpenAddVariantModal(product)}
                  >
                    ＋ Add Variant
                  </button>
                </div>

                {product.variants && product.variants.length > 0 ? (
                  <div className="variant-pills-list">
                    {product.variants.map((v) => {
                      const isSelected = selectedVariantId === v.id;
                      return (
                        <div
                          key={v.id}
                          className={`variant-pill ${isSelected ? 'selected' : ''}`}
                          onClick={() =>
                            setActiveVariants((prev) => ({
                              ...prev,
                              [product.id]: v.id
                            }))
                          }
                          title="Click to dynamically preview price modifier"
                        >
                          <div className="pill-content">
                            <span className="pill-name">{v.name}</span>
                            <span className="pill-modifier">
                              +{v.price_modifier >= 0 ? `$${v.price_modifier}` : `-$${Math.abs(v.price_modifier)}`}
                            </span>
                          </div>
                          <button
                            className="pill-remove-btn"
                            title="Remove variant"
                            onClick={(e) => handleDeleteVariant(product.id, v.id, e)}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="no-variants-box">
                    <span>No variants configured. Base price applies.</span>
                    <button
                      className="btn-text-action"
                      onClick={() => handleOpenAddVariantModal(product)}
                    >
                      Add a Brand or Tier (+560)
                    </button>
                  </div>
                )}
              </div>

              {/* Dynamic Live Price Calculation Preview */}
              <div className="dynamic-price-banner">
                <div className="calc-header">
                  <span className="calc-title">Dynamic Price Preview</span>
                  {currentVariant && (
                    <span className="active-variant-chip">{currentVariant.value}</span>
                  )}
                </div>

                <div className="calc-formula">
                  <span>Base (${product.sales_price})</span>
                  <span className="math-operator">＋</span>
                  <span className="modifier-highlight">
                    Variant Modifier (+${modifier})
                  </span>
                  <span className="math-operator">＝</span>
                  <span className="final-price">${dynamicFinalPrice.toLocaleString()}</span>
                </div>

                <div className="margin-indicator">
                  <span>Customer Pays: <strong>${dynamicFinalPrice}</strong></span>
                  <span className="margin-pill">Margin: ${profit} ({profitPercentage}%)</span>
                </div>
              </div>

              {/* Associated Plans (Populated from GET /api/products) */}
              {product.plans && product.plans.length > 0 && (
                <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                    Linked Subscription Plans ({product.plans.length}):
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {product.plans.map((pl) => {
                      const planName = typeof pl === 'object' ? pl.name : pl;
                      const planFreq = typeof pl === 'object' ? pl.billing_frequency : '';
                      return (
                        <span key={typeof pl === 'object' ? pl.id : pl} style={{ fontSize: '0.75rem', background: 'rgba(6,182,212,0.15)', color: '#22d3ee', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 500 }}>
                          {planName} {planFreq && <span style={{ opacity: 0.8 }}>({planFreq})</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL 1: Create Product */}
      {isCreateModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Product</h2>
              <button className="close-btn" onClick={() => setIsCreateModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProductSubmit} className="modal-form">
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Product ID (Optional)</label>
                  <input
                    type="text"
                    placeholder={`e.g. prod_${products.length + 1}`}
                    value={newProduct.id}
                    onChange={(e) => setNewProduct({ ...newProduct, id: e.target.value })}
                  />
                  <small>Leave blank to auto-generate</small>
                </div>

                <div className="form-group flex-2">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Enterprise Cloud Server"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Category</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                  >
                    <option value="Infrastructure">Infrastructure</option>
                    <option value="Networking">Networking</option>
                    <option value="Hardware">Hardware</option>
                    <option value="Software & SaaS">Software & SaaS</option>
                    <option value="AI Hardware">AI Hardware</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div className="form-group flex-1">
                  <label>Base Sales Price ($) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newProduct.sales_price}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, sales_price: Number(e.target.value) })
                    }
                  />
                </div>

                <div className="form-group flex-1">
                  <label>Cost Price ($) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newProduct.cost_price}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, cost_price: Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows="2"
                  placeholder="Enter detailed description of specifications, SLA, or warranty..."
                  value={newProduct.description}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, description: e.target.value })
                  }
                />
              </div>

              {/* Dynamic Variant Staging Box */}
              <div className="variant-staging-box">
                <div className="staging-header">
                  <h4>Add Product Variants (e.g. Brand +$560)</h4>
                  <span className="staging-hint">
                    Each variant dynamically increases the base price
                  </span>
                </div>

                <div className="staging-inputs-row">
                  <div className="form-group">
                    <label>Attribute</label>
                    <select
                      value={stagedVariant.attribute}
                      onChange={(e) =>
                        setStagedVariant({ ...stagedVariant, attribute: e.target.value })
                      }
                    >
                      <option value="brand">Brand</option>
                      <option value="tier">Tier / Edition</option>
                      <option value="storage">Storage</option>
                      <option value="color">Color</option>
                    </select>
                  </div>

                  <div className="form-group flex-2">
                    <label>Variant Value *</label>
                    <input
                      type="text"
                      placeholder="e.g. Dell, HPE, Titanium"
                      value={stagedVariant.value}
                      onChange={(e) =>
                        setStagedVariant({ ...stagedVariant, value: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group flex-1">
                    <label>Price Modifier (+$) *</label>
                    <input
                      type="number"
                      placeholder="560"
                      value={stagedVariant.price_modifier}
                      onChange={(e) =>
                        setStagedVariant({
                          ...stagedVariant,
                          price_modifier: Number(e.target.value)
                        })
                      }
                    />
                  </div>

                  <button
                    type="button"
                    className="btn-secondary add-staged-btn"
                    onClick={handleAddStagedVariant}
                  >
                    ＋ Add Variant
                  </button>
                </div>

                {/* Staged Variants List */}
                {newProduct.variants.length > 0 && (
                  <div className="staged-list">
                    <span className="staged-count">
                      Configured Variants ({newProduct.variants.length}):
                    </span>
                    <div className="staged-chips">
                      {newProduct.variants.map((v) => (
                        <div key={v.id} className="staged-chip">
                          <span className="chip-text">
                            <strong>{v.name}</strong> (+${v.price_modifier})
                          </span>
                          <span className="preview-sum">
                            Total: ${Number(newProduct.sales_price) + Number(v.price_modifier)}
                          </span>
                          <button
                            type="button"
                            className="chip-remove"
                            onClick={() => handleRemoveStagedVariant(v.id)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Product & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Quick Add Variant */}
      {isAddVariantModalOpen && selectedProductForVariant && (
        <div className="modal-backdrop" onClick={() => setIsAddVariantModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Add Variant to Product</h2>
                <p className="modal-sub">
                  Target Product: <strong>{selectedProductForVariant.name}</strong> (Base: $
                  {selectedProductForVariant.sales_price})
                </p>
              </div>
              <button className="close-btn" onClick={() => setIsAddVariantModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleAddQuickVariantSubmit} className="modal-form">
              <div className="form-group">
                <label>Variant Attribute</label>
                <select
                  value={quickVariant.attribute}
                  onChange={(e) =>
                    setQuickVariant({ ...quickVariant, attribute: e.target.value })
                  }
                >
                  <option value="brand">Brand (e.g. Dell, Cisco)</option>
                  <option value="tier">Tier (e.g. Enterprise, Pro)</option>
                  <option value="storage">Storage (e.g. 2TB NVMe)</option>
                  <option value="edition">Edition (e.g. Platinum)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Variant Value / Brand Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dell PowerEdge or Apple Enterprise"
                  value={quickVariant.value}
                  onChange={(e) =>
                    setQuickVariant({ ...quickVariant, value: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Dynamic Price Modifier (+$) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 560"
                  value={quickVariant.price_modifier}
                  onChange={(e) =>
                    setQuickVariant({
                      ...quickVariant,
                      price_modifier: Number(e.target.value)
                    })
                  }
                />
                <small>Amount added directly to base price (${selectedProductForVariant.sales_price})</small>
              </div>

              {/* Dynamic Live Price Calculation Preview */}
              <div className="quick-preview-callout">
                <span className="callout-label">Live Price Preview:</span>
                <div className="callout-math">
                  Base <strong>${selectedProductForVariant.sales_price}</strong> + Modifier{' '}
                  <strong className="text-accent">+${quickVariant.price_modifier || 0}</strong> ={' '}
                  <span className="total-highlight">
                    $
                    {Number(selectedProductForVariant.sales_price) +
                      (Number(quickVariant.price_modifier) || 0)}
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsAddVariantModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Attach Variant & Update Price
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
