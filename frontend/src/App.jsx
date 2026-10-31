import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

// Layout & Global Components
import GlobalLayout from './components/GlobalLayout.jsx';

// Application Pages
import Auth from './pages/admin/Auth.jsx';
import Dashboard from './pages/finance/Dashboard.jsx';
import ProductCatalog from './pages/admin/ProductCatalog.jsx';
import SubscriptionLifecycleManager from './pages/sales/SubscriptionLifecycleManager.jsx';
import PlanManagerPage from './pages/admin/PlanManagerPage.jsx';
import QuoteTemplateManager from './pages/sales/QuoteTemplateManager.jsx';
import UserManagement from './pages/admin/UserManagement.jsx';
import CustomerPortal from './pages/customer/CustomerPortal.jsx';

// Styles
import './pages/admin/auth.css';
import './pages/finance/dashboard.css';
import './pages/admin/ProductCatalog.css';
import './pages/sales/SubscriptionState.css';
import './pages/admin/PlanManager.css';
import './pages/sales/QuoteTemplate.css';
import './pages/admin/userManagement.css';

/**
 * Helper to safely extract current logged-in user profile from localStorage.
 * Defaults to demo admin account if not yet signed in.
 */
function getActiveUser() {
  try {
    return JSON.parse(localStorage.getItem('brightloop_user') ?? 'null');
  } catch {
    return null;
  }
}

/**
 * Root landing resolver:
 * - Customer role lands directly on the Customer Portal (/portal)
 * - Admin and Staff roles land on Finance Overview (/finance)
 * - Unauthenticated visitors are routed to /login
 */
function RootResolver() {
  const token = localStorage.getItem('brightloop_token');
  const user = getActiveUser();

  if (!token && !user) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === 'customer') {
    return <Navigate to="/portal" replace />;
  }

  return <Navigate to="/finance" replace />;
}

/**
 * Protected Route Wrapper that enforces role-based access:
 * - Admin sees everything
 * - Staff handles day-to-day operations
 * - Customers see only their self-service portal
 */
function ProtectedRoute({ children, allowedRoles = ['admin', 'staff', 'customer'] }) {
  const location = useLocation();
  const token = localStorage.getItem('brightloop_token');
  const user = getActiveUser();

  // If no session exists, redirect to login unless in standalone preview mode
  if (!token && !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const role = user?.role || 'staff';

  // Role Access Enforcement
  if (!allowedRoles.includes(role)) {
    if (role === 'customer') {
      return <Navigate to="/portal" replace />;
    }
    return <Navigate to="/finance" replace />;
  }

  return <GlobalLayout>{children}</GlobalLayout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Authentication Routes */}
        <Route path="/login" element={<Auth />} />
        <Route path="/register" element={<Auth />} />
        <Route path="/forgot-password" element={<Auth />} />
        <Route path="/reset-password" element={<Auth />} />

        {/* Dynamic Root Redirect based on Role */}
        <Route path="/" element={<RootResolver />} />

        {/* Customer Self-Service Portal (Customer exclusive, Admin previewable) */}
        <Route
          path="/portal"
          element={
            <ProtectedRoute allowedRoles={['customer', 'admin', 'staff']}>
              <CustomerPortal />
            </ProtectedRoute>
          }
        />

        {/* Day-to-Day Operations & Finance (Staff & Admin) */}
        <Route
          path="/finance"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Subscriptions Lifecycle State Machine (Staff & Admin) */}
        <Route
          path="/subscriptions"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <SubscriptionLifecycleManager />
            </ProtectedRoute>
          }
        />

        {/* Products & Dynamic Variants Catalog (Staff & Admin) */}
        <Route
          path="/products"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <ProductCatalog />
            </ProtectedRoute>
          }
        />

        {/* Subscription Plans Management (Staff & Admin) */}
        <Route
          path="/plans"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <PlanManagerPage />
            </ProtectedRoute>
          }
        />

        {/* Quotation Templates (Staff & Admin) */}
        <Route
          path="/quotes"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <QuoteTemplateManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quotations"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <QuoteTemplateManager />
            </ProtectedRoute>
          }
        />

        {/* Administration: User & Staff Management (Admin Only) */}
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />

        {/* Wildcard Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
