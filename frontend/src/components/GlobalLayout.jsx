import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import './GlobalLayout.css';

/**
 * Navigation item definition with role permissions:
 * - roles: Array<'admin' | 'staff' | 'customer'>
 */
const ALL_NAV_ITEMS = [
  // Staff & Admin back-office tools
  {
    to: '/finance',
    label: 'Finance Overview',
    icon: '▥',
    section: 'WORKSPACE',
    roles: ['admin', 'staff'],
    badge: null
  },
  {
    to: '/subscriptions',
    label: 'Subscriptions',
    icon: '▤',
    section: 'WORKSPACE',
    roles: ['admin', 'staff'],
    badge: null
  },
  {
    to: '/products',
    label: 'Product Catalog',
    icon: '📦',
    section: 'WORKSPACE',
    roles: ['admin', 'staff'],
    badge: null
  },
  {
    to: '/plans',
    label: 'Subscription Plans',
    icon: '⚙️',
    section: 'WORKSPACE',
    roles: ['admin', 'staff'],
    badge: null
  },
  {
    to: '/quotes',
    label: 'Quotation Templates',
    icon: '📑',
    section: 'WORKSPACE',
    roles: ['admin', 'staff'],
    badge: null
  },
  // Admin-only management
  {
    to: '/admin/users',
    label: 'User Management',
    icon: '♙',
    section: 'ADMINISTRATION',
    roles: ['admin'],
    badge: 'Admin'
  },
  // Customer-only portal
  {
    to: '/portal',
    label: 'Customer Portal',
    icon: '🌐',
    section: 'CUSTOMER PORTAL',
    roles: ['customer', 'admin'], // Customer sees this exclusively; Admin also has access to audit customer experience
    badge: 'Portal'
  }
];

export default function GlobalLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Read current user session from localStorage
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('brightloop_user') ?? 'null') || {
        email: 'admin@brightloop.io',
        role: 'admin'
      };
    } catch {
      return { email: 'admin@brightloop.io', role: 'admin' };
    }
  });

  // Keep state in sync if localStorage changes
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('brightloop_user') ?? 'null');
      if (stored && stored.role !== user?.role) {
        setUser(stored);
      }
    } catch {
      /* ignore */
    }
  }, [location.pathname]);

  const currentRole = user?.role || 'staff';

  // Filter navigation links based on user role
  const allowedNavItems = ALL_NAV_ITEMS.filter((item) => {
    if (currentRole === 'customer') {
      // Customer sees ONLY the portal
      return item.to === '/portal';
    }
    if (currentRole === 'staff') {
      // Staff handles day-to-day (no admin-only routes, and not customer-only portal)
      return item.roles.includes('staff') && item.to !== '/portal';
    }
    // Admin sees everything
    return item.roles.includes('admin');
  });

  // Group nav items by section
  const sections = Array.from(new Set(allowedNavItems.map((item) => item.section)));

  // Interactive Demo Role Switcher (for hackathon evaluators & seamless testing)
  const handleRoleSwitch = (newRole) => {
    const updatedUser = {
      ...user,
      role: newRole,
      email:
        newRole === 'customer'
          ? 'customer@example.com'
          : newRole === 'staff'
          ? 'staff@brightloop.io'
          : 'admin@brightloop.io'
    };
    localStorage.setItem('brightloop_user', JSON.stringify(updatedUser));
    setUser(updatedUser);

    // Redirect to appropriate landing page
    if (newRole === 'customer') {
      navigate('/portal');
    } else if (location.pathname === '/portal') {
      navigate('/finance');
    } else if (newRole === 'staff' && location.pathname.startsWith('/admin')) {
      navigate('/finance');
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('brightloop_token');
    localStorage.removeItem('brightloop_user');
    navigate('/login');
  };

  // Compute breadcrumb from current path
  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path.includes('/finance')) return ['Workspace', 'Finance', 'Overview'];
    if (path.includes('/subscriptions')) return ['Workspace', 'Sales & Operations', 'Subscriptions'];
    if (path.includes('/products')) return ['Workspace', 'Catalog', 'Products & Variants'];
    if (path.includes('/plans')) return ['Workspace', 'Configuration', 'Subscription Plans'];
    if (path.includes('/quotes')) return ['Workspace', 'Sales', 'Quotation Templates'];
    if (path.includes('/admin/users')) return ['Administration', 'Security', 'User Management'];
    if (path.includes('/portal')) return ['Customer Portal', 'Account', 'Overview'];
    return ['Workspace', 'Dashboard'];
  };

  const breadcrumbs = getBreadcrumb();

  return (
    <div className="global-app-shell">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="global-sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Persistent Navigation Sidebar */}
      <aside className={`global-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        {/* Brand Header */}
        <Link to="/" className="global-brand" onClick={() => setMobileMenuOpen(false)}>
          <span className="global-logo-icon">b</span>
          <div className="global-brand-text">
            <span className="global-brand-name">brightloop</span>
            <span className="global-brand-tag">Enterprise ERP</span>
          </div>
        </Link>

        {/* Workspace Card */}
        <div className="global-workspace-card">
          <span className="global-workspace-icon">B</span>
          <div className="global-workspace-info">
            <strong>Brightloop HQ</strong>
            <small>Active Workspace</small>
          </div>
          <span className="global-status-dot online" title="Backend Live" />
        </div>

        {/* Interactive Role Switcher Pill */}
        <div className="global-role-badge-box">
          <div className="role-badge-label">
            <span>ACTIVE ROLE VIEW</span>
            <span className={`role-chip role-${currentRole}`}>{currentRole}</span>
          </div>
          <select
            className="global-role-switcher"
            value={currentRole}
            onChange={(e) => handleRoleSwitch(e.target.value)}
            title="Switch user perspective to preview role-based access"
          >
            <option value="admin">Admin (Full Access)</option>
            <option value="staff">Staff (Day-to-day)</option>
            <option value="customer">Customer (Portal Only)</option>
          </select>
        </div>

        {/* Dynamic Navigation Links */}
        <nav className="global-nav">
          {sections.map((section) => (
            <div key={section} className="global-nav-group">
              <p className="global-nav-section-title">{section}</p>
              {allowedNavItems
                .filter((item) => item.section === section)
                .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `global-nav-link ${isActive ? 'active' : ''}`
                    }
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="global-nav-icon">{item.icon}</span>
                    <span className="global-nav-text">{item.label}</span>
                    {item.badge && (
                      <span className={`global-nav-pill badge-${item.badge.toLowerCase()}`}>
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="global-sidebar-bottom">
          <div className="global-support-card">
            <div className="support-icon">✳</div>
            <div className="support-text">
              <strong>Need help?</strong>
              <small>Explore documentation & support guides.</small>
              <a href="mailto:support@brightloop.io">Contact Support ↗</a>
            </div>
          </div>

          {/* User Profile & Sign Out */}
          <div className="global-user-profile">
            <div className="user-avatar">
              {user?.email?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="user-details">
              <strong>{user?.email || 'User Account'}</strong>
              <small className="user-role-label">{currentRole.toUpperCase()}</small>
            </div>
            <button
              type="button"
              className="user-signout-btn"
              onClick={handleSignOut}
              title="Sign Out"
              aria-label="Sign out"
            >
              ⎋
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="global-main-wrap">
        {/* Persistent Top Navigation Bar */}
        <header className="global-topbar">
          <div className="global-topbar-left">
            <button
              type="button"
              className="global-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
            >
              ☰
            </button>

            <div className="global-breadcrumb">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb}>
                  {idx > 0 && <span className="breadcrumb-divider">/</span>}
                  <span
                    className={`breadcrumb-item ${
                      idx === breadcrumbs.length - 1 ? 'current' : ''
                    }`}
                  >
                    {crumb}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="global-topbar-right">
            <div className="global-server-pill">
              <span className="server-dot" />
              <span>Port 5000</span>
            </div>

            <div className="global-topbar-role">
              <span className={`topbar-role-badge role-${currentRole}`}>
                {currentRole.toUpperCase()}
              </span>
            </div>

            <button
              type="button"
              className="global-avatar-btn"
              onClick={handleSignOut}
              title="Click to sign out"
            >
              {user?.email?.[0]?.toUpperCase() ?? 'U'}
            </button>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="global-content">{children}</main>
      </div>
    </div>
  );
}
