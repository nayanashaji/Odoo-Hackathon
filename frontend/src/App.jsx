import React, { useState, useEffect, useCallback } from 'react';
import PlanManager from './pages/admin/PlanManager';
import ProductCatalog from './pages/admin/ProductCatalog';
import { INITIAL_PRODUCTS, INITIAL_PLANS } from './data/initialData';

const API_PRODUCTS_URL = 'http://localhost:5000/api/products';
const API_PLANS_URL = 'http://localhost:5000/api/plans';

export default function App() {
  const [currentView, setCurrentView] = useState('plans'); // 'plans' | 'products'

  // Centralized State for Products and Plans
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [plans, setPlans] = useState(INITIAL_PLANS);
  const [loading, setLoading] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Centralized Fetch Handler
  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodsRes, plansRes] = await Promise.all([
        fetch(API_PRODUCTS_URL, { signal: AbortSignal.timeout(3000) }),
        fetch(API_PLANS_URL, { signal: AbortSignal.timeout(3000) })
      ]);

      let backendConnected = false;

      if (prodsRes.ok) {
        const prodsJson = await prodsRes.json();
        if (prodsJson.data && prodsJson.data.length > 0) {
          setProducts(prodsJson.data);
          backendConnected = true;
        }
      }

      if (plansRes.ok) {
        const plansJson = await plansRes.json();
        if (plansJson.data && plansJson.data.length > 0) {
          setPlans(plansJson.data);
          backendConnected = true;
        }
      }

      setApiConnected(backendConnected);
      if (backendConnected) {
        showNotification('Connected to Backend API. Catalog & Plans synchronized!', 'success');
      }
    } catch (err) {
      setApiConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch once on App mount so state persists across tab switches
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ==========================================
  // PRODUCT MUTATION HANDLERS
  // ==========================================

  const handleCreateProduct = async (productPayload) => {
    // 1. Optimistic update
    setProducts((prev) => [productPayload, ...prev]);
    showNotification(`Product "${productPayload.name}" successfully created!`, 'success');

    // 2. Dispatch to backend
    try {
      const res = await fetch(API_PRODUCTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productPayload)
      });
      if (res.ok) {
        const result = await res.json();
        if (result.data) {
          setProducts((prev) =>
            prev.map((p) => (p.id === productPayload.id ? result.data : p))
          );
        }
        setApiConnected(true);
      }
    } catch (e) {
      console.warn('Backend offline, saved in local state:', e.message);
    }
  };

  const handleDeleteProduct = async (productId) => {
    // 1. Immediate removal from shared products state
    setProducts((prev) => prev.filter((p) => p.id !== productId));

    // 2. Disassociate any plans attached to this product
    setPlans((prev) =>
      prev.map((pl) => (pl.product_id === productId ? { ...pl, product_id: null } : pl))
    );

    showNotification(`Product "${productId}" deleted successfully.`, 'info');

    // 3. Dispatch to backend
    try {
      const res = await fetch(`${API_PRODUCTS_URL}/${productId}`, { method: 'DELETE' });
      if (res.ok) setApiConnected(true);
    } catch (e) {
      console.warn('Backend delete error, local state updated:', e.message);
    }
  };

  const handleAddVariant = async (productId, newVar) => {
    // 1. Immediate update in shared state
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          return { ...p, variants: [...(p.variants || []), newVar] };
        }
        return p;
      })
    );

    showNotification(
      `Added variant "${newVar.name}" with dynamic price modifier +$${newVar.price_modifier}!`,
      'success'
    );

    // 2. Dispatch to backend
    try {
      const res = await fetch(`${API_PRODUCTS_URL}/${productId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVar)
      });
      if (res.ok) setApiConnected(true);
    } catch (e) {
      console.warn('Backend variant error, local state updated:', e.message);
    }
  };

  const handleDeleteVariant = async (productId, variantId) => {
    // 1. Immediate update in shared state
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          return {
            ...p,
            variants: (p.variants || []).filter((v) => v.id !== variantId)
          };
        }
        return p;
      })
    );

    showNotification('Variant deleted successfully.', 'info');

    // 2. Dispatch to backend
    try {
      const res = await fetch(`${API_PRODUCTS_URL}/${productId}/variants/${variantId}`, {
        method: 'DELETE'
      });
      if (res.ok) setApiConnected(true);
    } catch (e) {
      console.warn('Backend delete variant error:', e.message);
    }
  };

  // ==========================================
  // PLAN MUTATION HANDLERS
  // ==========================================

  const handleLaunchPlan = async (newPlanPayload) => {
    // 1. Immediate update to shared plans
    setPlans((prev) => [newPlanPayload, ...prev]);

    // 2. Immediate update to product's nested plans array
    if (newPlanPayload.product_id) {
      setProducts((prevProducts) =>
        prevProducts.map((p) => {
          if (p.id === newPlanPayload.product_id) {
            const currentPlans = Array.isArray(p.plans) ? p.plans : [];
            const exists = currentPlans.some(
              (pl) => (typeof pl === 'string' ? pl : pl.id) === newPlanPayload.id
            );
            return {
              ...p,
              plans: exists ? currentPlans : [newPlanPayload, ...currentPlans]
            };
          }
          return p;
        })
      );
    }

    const targetProd = products.find((p) => p.id === newPlanPayload.product_id);
    const label = targetProd ? `to "${targetProd.name}"` : 'as a standalone plan';
    showNotification(`Plan "${newPlanPayload.name}" launched and linked ${label}!`, 'success');

    // 3. Dispatch to backend
    try {
      const res = await fetch(API_PLANS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlanPayload)
      });
      if (res.ok) {
        setApiConnected(true);
        // Re-fetch populated products to ensure exact database alignment
        const prodsRes = await fetch(API_PRODUCTS_URL);
        if (prodsRes.ok) {
          const prodsJson = await prodsRes.json();
          if (prodsJson.data) setProducts(prodsJson.data);
        }
      }
    } catch (e) {
      console.warn('Backend plan launch error, local state updated:', e.message);
    }
  };

  const handleLinkPlan = async (productId, planId) => {
    const chosenPlan = plans.find((p) => p.id === planId) || { id: planId };

    // 1. Immediate update in products
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const currentPlans = Array.isArray(p.plans) ? p.plans : [];
          const exists = currentPlans.some(
            (pl) => (typeof pl === 'string' ? pl : pl.id) === planId
          );
          if (exists) return p;
          return { ...p, plans: [...currentPlans, chosenPlan] };
        }
        return p;
      })
    );

    // 2. Immediate update in plans
    setPlans((prev) =>
      prev.map((pl) => (pl.id === planId ? { ...pl, product_id: productId } : pl))
    );

    showNotification(`Plan "${chosenPlan.name || planId}" linked to product!`, 'success');

    // 3. Dispatch to backend
    try {
      const res = await fetch(`${API_PRODUCTS_URL}/${productId}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      });
      if (res.ok) setApiConnected(true);
    } catch (e) {
      console.warn('Backend link plan error:', e.message);
    }
  };

  const handleDeletePlan = async (planId) => {
    // 1. Immediate removal from plans
    setPlans((prev) => prev.filter((p) => p.id !== planId));

    // 2. Immediate removal from nested product plans
    setProducts((prev) =>
      prev.map((prod) => ({
        ...prod,
        plans: (prod.plans || []).filter(
          (pl) => (typeof pl === 'string' ? pl : pl.id) !== planId
        )
      }))
    );

    showNotification(`Plan '${planId}' deleted.`, 'info');

    // 3. Dispatch to backend
    try {
      const res = await fetch(`${API_PLANS_URL}/${planId}`, { method: 'DELETE' });
      if (res.ok) setApiConnected(true);
    } catch (e) {
      console.warn('Backend delete plan error:', e.message);
    }
  };

  const handleTogglePlanStatus = async (plan) => {
    const nextStatus = plan.status === 'active' ? 'paused' : 'active';
    setPlans((prev) =>
      prev.map((p) => (p.id === plan.id ? { ...p, status: nextStatus } : p))
    );

    try {
      const res = await fetch(`${API_PLANS_URL}/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) setApiConnected(true);
    } catch (e) {}
  };

  const handleResetDemoSeed = () => {
    setProducts(INITIAL_PRODUCTS);
    setPlans(INITIAL_PLANS);
    showNotification('Reset products & plans to initial demo seed!', 'info');
  };

  return (
    <div className="app-root">
      {/* Global Notification Toast */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            top: '1.25rem',
            right: '1.25rem',
            zIndex: 9999,
            background:
              notification.type === 'error'
                ? 'rgba(239, 68, 68, 0.95)'
                : notification.type === 'info'
                ? 'rgba(59, 130, 246, 0.95)'
                : 'rgba(16, 185, 129, 0.95)',
            color: '#fff',
            padding: '0.75rem 1.25rem',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
            fontWeight: 600,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
            animation: 'fadeIn 0.3s ease'
          }}
        >
          <span>✨</span>
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Top Navbar */}
      <nav
        style={{
          background: '#090d16',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '0.75rem 2.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            style={{
              fontSize: '1.2rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            Brightloop ERP
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#94a3b8',
              padding: '0.15rem 0.5rem',
              borderRadius: '4px',
              fontWeight: 600
            }}
          >
            Admin Portal
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              background: apiConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)',
              color: apiConnected ? '#34d399' : '#facc15',
              border: `1px solid ${apiConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
              padding: '0.15rem 0.5rem',
              borderRadius: '12px',
              fontWeight: 600
            }}
          >
            ● {apiConnected ? 'Backend Live' : 'Local State Mode'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setCurrentView('plans')}
            style={{
              background: currentView === 'plans' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: currentView === 'plans' ? '#38bdf8' : '#94a3b8',
              border: currentView === 'plans' ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
              padding: '0.45rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              transition: 'all 0.2s'
            }}
          >
            📋 Subscription Plans & Linking ({plans.length})
          </button>
          <button
            onClick={() => setCurrentView('products')}
            style={{
              background: currentView === 'products' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: currentView === 'products' ? '#38bdf8' : '#94a3b8',
              border: currentView === 'products' ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
              padding: '0.45rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              transition: 'all 0.2s'
            }}
          >
            📦 Product Catalog & Pricing ({products.length})
          </button>
        </div>
      </nav>

      {/* View Rendering with Shared State & Handlers */}
      {currentView === 'plans' ? (
        <PlanManager
          plans={plans}
          products={products}
          apiConnected={apiConnected}
          loading={loading}
          onLaunchPlan={handleLaunchPlan}
          onQuickLinkPlan={handleLinkPlan}
          onDeletePlan={handleDeletePlan}
          onTogglePlanStatus={handleTogglePlanStatus}
          onResetDemoSeed={handleResetDemoSeed}
          notification={notification}
          showNotification={showNotification}
        />
      ) : (
        <ProductCatalog
          products={products}
          apiConnected={apiConnected}
          loading={loading}
          onCreateProduct={handleCreateProduct}
          onAddVariant={handleAddVariant}
          onDeleteVariant={handleDeleteVariant}
          onDeleteProduct={handleDeleteProduct}
          onResetSeed={handleResetDemoSeed}
          notification={notification}
          showNotification={showNotification}
        />
      )}
    </div>
  );
}
