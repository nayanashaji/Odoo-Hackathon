import React, { useState, useEffect, useMemo } from 'react';
import './ProductCatalog.css';
import DataTable from '../../components/DataTable';

// Initial seed conforming to docs/schema.json contract
const INITIAL_PRODUCTS = [
  {
    id: 'prod_1',
    name: 'Enterprise Dedicated Cloud Server',
    description: 'High-availability dedicated compute server with ECC memory, NVMe arrays, and hardware RAID.',
    category: 'Infrastructure',
    sales_price: 1200,
    cost_price: 200,
    status: 'active',
    variants: [
      {
        id: 'var_1',
        name: 'Brand: Dell PowerEdge R750',
        attribute: 'brand',
        value: 'Dell',
        price_modifier: 560, // docs/schema.json: { id: "var_1", price_modifier: 560 }
        cost_modifier: 90,
        sku: 'SRV-DELL-R750'
      },
      {
        id: 'var_2',
        name: 'Brand: HPE ProLiant DL380 Gen10',
        attribute: 'brand',
        value: 'HPE',
        price_modifier: 620,
        cost_modifier: 110,
        sku: 'SRV-HPE-DL380'
      },
      {
        id: 'var_3',
        name: 'Brand: Supermicro Hyper Ultra',
        attribute: 'brand',
        value: 'Supermicro',
        price_modifier: 380,
        cost_modifier: 60,
        sku: 'SRV-SMC-1029'
      }
    ]
  },
  {
    id: 'prod_2',
    name: 'Carrier-Grade 10G Security Gateway',
    description: 'Hardware firewall and SD-WAN gateway capable of 10 Gbps multi-threat inspection throughput.',
    category: 'Networking',
    sales_price: 450,
    cost_price: 120,
    status: 'active',
    variants: [
      {
        id: 'var_4',
        name: 'Brand: Cisco Catalyst Edge',
        attribute: 'brand',
        value: 'Cisco',
        price_modifier: 280,
        cost_modifier: 50,
        sku: 'NET-CSCO-8300'
      },
      {
        id: 'var_5',
        name: 'Brand: Juniper Networks SRX345',
        attribute: 'brand',
        value: 'Juniper',
        price_modifier: 240,
        cost_modifier: 45,
        sku: 'NET-JNPR-345'
      },
      {
        id: 'var_6',
        name: 'Brand: Ubiquiti UniFi Pro',
        attribute: 'brand',
        value: 'Ubiquiti',
        price_modifier: 120,
        cost_modifier: 25,
        sku: 'NET-UBNT-UDM'
      }
    ]
  },
  {
    id: 'prod_3',
    name: 'Smart Retail Touch POS Terminal',
    description: 'Compact high-speed Point of Sale terminal with integrated scanner and thermal printer.',
    category: 'Hardware',
    sales_price: 850,
    cost_price: 300,
    status: 'active',
    variants: [
      {
        id: 'var_7',
        name: 'Brand: Elo Touch Solutions I-Series',
        attribute: 'brand',
        value: 'Elo',
        price_modifier: 220,
        cost_modifier: 40,
        sku: 'POS-ELO-I15'
      },
      {
        id: 'var_8',
        name: 'Brand: HP Engage One Pro',
        attribute: 'brand',
        value: 'HP',
        price_modifier: 310,
        cost_modifier: 55,
        sku: 'POS-HP-E1'
      }
    ]
  },
  {
    id: 'prod_4',
    name: 'Odoo Enterprise Suite SaaS License',
    description: 'ERP cloud software package: CRM, Subscriptions, Sales, Invoicing, and Auto-Accounting.',
    category: 'Software & SaaS',
    sales_price: 650,
    cost_price: 60,
    status: 'active',
    variants: [
      {
        id: 'var_10',
        name: 'Tier: Enterprise Platinum SLA',
        attribute: 'tier',
        value: 'Platinum',
        price_modifier: 450,
        cost_modifier: 30,
        sku: 'SAS-PLAT-247'
      },
      {
        id: 'var_11',
        name: 'Tier: Gold Priority Support',
        attribute: 'tier',
        value: 'Gold',
        price_modifier: 250,
        cost_modifier: 15,
        sku: 'SAS-GOLD-PRI'
      }
    ]
  },
  {
    id: 'prod_5',
    name: 'Industrial Edge AI Accelerator Box',
    description: 'Rugged fanless embedded AI box for real-time video telemetry and defect detection.',
    category: 'AI Hardware',
    sales_price: 2100,
    cost_price: 750,
    status: 'active',
    variants: [
      {
        id: 'var_12',
        name: 'Brand: NVIDIA Jetson AGX Orin 64GB',
        attribute: 'brand',
        value: 'NVIDIA',
        price_modifier: 890,
        cost_modifier: 140,
        sku: 'AI-NVDA-AGX64'
      },
      {
        id: 'var_13',
        name: 'Brand: Intel Xeon Edge VPU',
        attribute: 'brand',
        value: 'Intel',
        price_modifier: 480,
        cost_modifier: 80,
        sku: 'AI-INTL-VPU'
      }
    ]
  }
];

const API_BASE_URL = 'http://localhost:5000/api/products';

export default function ProductCatalog() {
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [loading, setLoading] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeVariants, setActiveVariants] = useState({}); // { [productId]: variantId }
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'

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

  const [notification, setNotification] = useState(null);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Try fetching products from backend on mount
  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      try {
        const res = await fetch(API_BASE_URL, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            setProducts(json.data);
            setApiConnected(true);
            showNotification('Connected to Backend API & catalog loaded!', 'success');
          }
        }
      } catch (err) {
        // Backend not running, use local state seamlessly
        setApiConnected(false);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, []);

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

    // Attempt API save if online
    if (apiConnected) {
      try {
        const res = await fetch(API_BASE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productPayload)
        });
        if (res.ok) {
          const result = await res.json();
          setProducts((prev) => [result.data, ...prev]);
        } else {
          setProducts((prev) => [productPayload, ...prev]);
        }
      } catch (err) {
        setProducts((prev) => [productPayload, ...prev]);
      }
    } else {
      setProducts((prev) => [productPayload, ...prev]);
    }

    if (productPayload.variants.length > 0) {
      setActiveVariants((prev) => ({
        ...prev,
        [productPayload.id]: productPayload.variants[0].id
      }));
    }

    showNotification(`Product "${productPayload.name}" successfully created!`);
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

    // Attempt API call if connected
    if (apiConnected) {
      try {
        await fetch(`${API_BASE_URL}/${targetProduct.id}/variants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newVar)
        });
      } catch (err) {
        console.warn('API error, falling back to local state:', err);
      }
    }

    // Update state
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === targetProduct.id) {
          return {
            ...p,
            variants: [...(p.variants || []), newVar]
          };
        }
        return p;
      })
    );

    // Auto-select the newly added variant to showcase live calculation
    setActiveVariants((prev) => ({
      ...prev,
      [targetProduct.id]: variantId
    }));

    showNotification(
      `Added variant "${newVar.name}" with dynamic price modifier +$${modifier}!`
    );
    setIsAddVariantModalOpen(false);
  };

  // Delete Variant
  const handleDeleteVariant = async (productId, variantId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this variant?')) return;

    if (apiConnected) {
      try {
        await fetch(`${API_BASE_URL}/${productId}/variants/${variantId}`, {
          method: 'DELETE'
        });
      } catch (err) {
        console.warn('API delete error, updating state locally:', err);
      }
    }

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const updatedVars = (p.variants || []).filter((v) => v.id !== variantId);
          return { ...p, variants: updatedVars };
        }
        return p;
      })
    );

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

  // Delete Product
  const handleDeleteProduct = async (productId) => {
    if (!window.confirm(`Are you sure you want to delete product ${productId}?`)) return;

    if (apiConnected) {
      try {
        await fetch(`${API_BASE_URL}/${productId}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('API delete error:', err);
      }
    }

    setProducts((prev) => prev.filter((p) => p.id !== productId));
    showNotification(`Product ${productId} deleted successfully.`, 'info');
  };

  // Standardized DataTable column definitions
  const productColumns = useMemo(
    () => [
      {
        key: 'product',
        header: 'Product',
        width: '26%',
        sortable: true,
        sortKey: (p) => p.name,
        render: (product) => (
          <div className="product-table-cell">
            <div className="product-meta" style={{ marginBottom: '4px' }}>
              <span className="product-id-tag">{product.id}</span>
              <span className="product-category-tag">{product.category}</span>
            </div>
            <strong style={{ display: 'block', fontSize: '13px', color: '#0f172a' }}>{product.name}</strong>
            <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
              {product.description || 'No description provided.'}
            </p>
          </div>
        )
      },
      {
        key: 'pricing',
        header: 'Base Pricing',
        width: '14%',
        sortable: true,
        sortKey: (p) => p.sales_price,
        render: (product) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12px' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase' }}>Sales: </span>
              <strong style={{ color: '#16a34a' }}>${product.sales_price.toLocaleString()}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase' }}>Cost: </span>
              <span style={{ color: '#64748b' }}>${product.cost_price.toLocaleString()}</span>
            </div>
          </div>
        )
      },
      {
        key: 'variants',
        header: 'Active Variant (Live Modifier)',
        width: '28%',
        render: (product) => {
          const selectedVariantId = activeVariants[product.id];
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {product.variants && product.variants.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {product.variants.map((v) => {
                    const isSelected = selectedVariantId === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        className={`variant-pill ${isSelected ? 'selected' : ''}`}
                        style={{ padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}
                        onClick={() =>
                          setActiveVariants((prev) => ({
                            ...prev,
                            [product.id]: v.id
                          }))
                        }
                        title="Click to preview dynamic price modifier"
                      >
                        <span>{v.name}</span>
                        <span style={{ fontWeight: 700, marginLeft: '4px', color: isSelected ? '#166534' : '#0284c7' }}>
                          +{v.price_modifier >= 0 ? `$${v.price_modifier}` : `-$${Math.abs(v.price_modifier)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Base product only</span>
              )}
              <button
                type="button"
                className="btn-text-action"
                style={{ fontSize: '11px', padding: 0, textAlign: 'left', color: '#2563eb' }}
                onClick={() => handleOpenAddVariantModal(product)}
              >
                ＋ Add Variant
              </button>
            </div>
          );
        }
      },
      {
        key: 'dynamic_price',
        header: 'Live Dynamic Calculation',
        width: '20%',
        sortable: true,
        sortKey: (product) => {
          const selectedVariantId = activeVariants[product.id];
          const v = product.variants?.find((item) => item.id === selectedVariantId);
          return product.sales_price + (v ? Number(v.price_modifier) || 0 : 0);
        },
        render: (product) => {
          const selectedVariantId = activeVariants[product.id];
          const currentVariant = product.variants?.find((v) => v.id === selectedVariantId) || null;
          const modifier = currentVariant ? Number(currentVariant.price_modifier) || 0 : 0;
          const dynamicFinalPrice = product.sales_price + modifier;
          const profit = dynamicFinalPrice - product.cost_price;
          const profitPercentage = ((profit / dynamicFinalPrice) * 100).toFixed(1);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ fontSize: '12px' }}>
                <span style={{ color: '#64748b' }}>Base (${product.sales_price}) + ({modifier}) = </span>
                <strong style={{ color: '#0f172a', fontSize: '13px' }}>${dynamicFinalPrice.toLocaleString()}</strong>
              </div>
              <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
                Margin: ${profit} ({profitPercentage}%)
              </div>
            </div>
          );
        }
      },
      {
        key: 'actions',
        header: 'Actions',
        width: '12%',
        align: 'right',
        render: (product) => (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
            <button
              type="button"
              className="icon-btn delete-btn"
              title="Delete Product"
              onClick={() => handleDeleteProduct(product.id)}
            >
              🗑️
            </button>
          </div>
        )
      }
    ],
    [activeVariants, products]
  );

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
            onClick={() => setProducts(INITIAL_PRODUCTS)}
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

        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          <button
            type="button"
            className={`chip ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
            title="Standardized Table View"
          >
            ☰ Table View
          </button>
          <button
            type="button"
            className={`chip ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid Cards View"
          >
            ⊞ Card View
          </button>
        </div>
      </div>

      {/* Standardized DataTable or Card View */}
      {viewMode === 'table' ? (
        <DataTable
          columns={productColumns}
          data={filteredProducts}
          loading={loading}
          emptyMessage="No products match your search or category filter."
          emptyIcon="📦"
          pagination={true}
          pageSize={10}
        />
      ) : (
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
            </div>
          );
        })}
      </div>
    )}

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
