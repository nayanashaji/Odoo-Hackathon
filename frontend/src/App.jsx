import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Auth from './pages/admin/Auth.jsx';
import Dashboard from './pages/finance/Dashboard.jsx';
import ProductCatalog from './pages/admin/ProductCatalog.jsx';
import './pages/admin/auth.css';
import './pages/finance/dashboard.css';

function FinanceRoute() {
  const location = useLocation();
  const token = localStorage.getItem('brightloop_token');
  let user = null;
  try { user = JSON.parse(localStorage.getItem('brightloop_user') ?? 'null'); } catch { /* Ignore invalid local session data. */ }
  if (!token || !['admin', 'staff'].includes(user?.role)) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Dashboard />;
}

export default function App() {
  return <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Auth />} />
      <Route path="/register" element={<Auth />} />
      <Route path="/forgot-password" element={<Auth />} />
      <Route path="/reset-password" element={<Auth />} />
      <Route path="/finance" element={<FinanceRoute />} />
      <Route path="/products" element={<ProductCatalog />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </BrowserRouter>;
}
