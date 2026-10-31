import React, { useState, useEffect } from 'react';
import PlanManager from './PlanManager';
import { INITIAL_PLANS, INITIAL_PRODUCTS } from '../../data/initialData';

const PLANS_API_URL = 'http://localhost:5000/api/plans';
const PRODUCTS_API_URL = 'http://localhost:5000/api/products';

export default function PlanManagerPage() {
  const [plans, setPlans] = useState(INITIAL_PLANS);
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [loading, setLoading] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [planRes, prodRes] = await Promise.allSettled([
          fetch(PLANS_API_URL),
          fetch(PRODUCTS_API_URL)
        ]);

        let connected = false;

        if (planRes.status === 'fulfilled' && planRes.value.ok) {
          const planData = await planRes.value.json();
          if (Array.isArray(planData) && planData.length > 0) {
            setPlans(planData);
            connected = true;
          }
        }

        if (prodRes.status === 'fulfilled' && prodRes.value.ok) {
          const prodData = await prodRes.value.json();
          if (Array.isArray(prodData) && prodData.length > 0) {
            setProducts(prodData);
            connected = true;
          }
        }

        setApiConnected(connected);
      } catch (err) {
        console.warn('API error in PlanManagerPage, fallback to initialData:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleLaunchPlan = async (newPlan) => {
    setPlans((prev) => [newPlan, ...prev]);
    showNotification(`Successfully launched plan: ${newPlan.name}`);
  };

  const handleQuickLinkPlan = async (productId, planId) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const existingPlans = p.plans || [];
          if (!existingPlans.includes(planId)) {
            return { ...p, plans: [...existingPlans, planId] };
          }
        }
        return p;
      })
    );
    showNotification(`Linked plan ${planId} to product ${productId}!`);
  };

  const handleDeletePlan = async (planId) => {
    setPlans((prev) => prev.filter((p) => p.id !== planId));
    showNotification(`Plan ${planId} removed from catalog.`, 'info');
  };

  const handleTogglePlanStatus = async (planId) => {
    setPlans((prev) =>
      prev.map((p) => {
        if (p.id === planId) {
          const nextStatus = p.status === 'active' ? 'archived' : 'active';
          return { ...p, status: nextStatus };
        }
        return p;
      })
    );
    showNotification(`Toggled plan status for ${planId}`);
  };

  const handleResetDemoSeed = () => {
    setPlans(INITIAL_PLANS);
    setProducts(INITIAL_PRODUCTS);
    showNotification('Reset plan and product catalog to seed defaults.');
  };

  return (
    <PlanManager
      plans={plans}
      products={products}
      apiConnected={apiConnected}
      loading={loading}
      onLaunchPlan={handleLaunchPlan}
      onQuickLinkPlan={handleQuickLinkPlan}
      onDeletePlan={handleDeletePlan}
      onTogglePlanStatus={handleTogglePlanStatus}
      onResetDemoSeed={handleResetDemoSeed}
      notification={notification}
      showNotification={showNotification}
    />
  );
}
