import React, { useState, useEffect } from 'react';
import QuoteTemplateList from './QuoteTemplateList';
import QuoteTemplateForm from './QuoteTemplateForm';
import QuoteTemplatePreviewModal from './QuoteTemplatePreviewModal';
import {
  INITIAL_QUOTE_TEMPLATES,
  MOCK_AUTH_USERS,
  MOCK_PRODUCT_CATALOG,
  MOCK_SUBSCRIPTION_PLANS
} from './mockSalesData';

const API_BASE_URL = 'http://localhost:5000/api/quote-templates';

/**
 * QuoteTemplateManager
 * Core Sales module page for creating and managing quotation templates with validity periods.
 * Strictly self-contained in pages/sales/ without cross-domain conflicts.
 */
export default function QuoteTemplateManager() {
  const [templates, setTemplates] = useState([]);
  const [products, setProducts] = useState(MOCK_PRODUCT_CATALOG);
  const [plans, setPlans] = useState(MOCK_SUBSCRIPTION_PLANS);
  const [users, setUsers] = useState(MOCK_AUTH_USERS);

  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('list'); // 'list' | 'create' | 'edit'
  const [currentEditTemplate, setCurrentEditTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  // Show Toast
  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch templates and mocked dependencies
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Attempt backend connection
        const [depRes, tmplRes] = await Promise.allSettled([
          fetch(`${API_BASE_URL}/mock-dependencies`),
          fetch(`${API_BASE_URL}`)
        ]);

        let backendOk = false;

        if (depRes.status === 'fulfilled' && depRes.value.ok) {
          const depJson = await depRes.value.json();
          if (depJson.data) {
            if (depJson.data.products) setProducts(depJson.data.products);
            if (depJson.data.plans) setPlans(depJson.data.plans);
            if (depJson.data.users) setUsers(depJson.data.users);
            backendOk = true;
          }
        }

        if (tmplRes.status === 'fulfilled' && tmplRes.value.ok) {
          const tmplJson = await tmplRes.value.json();
          if (tmplJson.data && Array.isArray(tmplJson.data)) {
            setTemplates(tmplJson.data);
            backendOk = true;
          }
        }

        if (!backendOk) {
          // Resilient fallback to local initial mock dataset
          setTemplates(INITIAL_QUOTE_TEMPLATES);
          setIsBackendConnected(false);
        } else {
          setIsBackendConnected(true);
        }
      } catch (err) {
        console.warn('Backend server not detected; utilizing offline mock data store:', err);
        setTemplates(INITIAL_QUOTE_TEMPLATES);
        setIsBackendConnected(false);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Handler: Save (Create or Update)
  const handleSaveTemplate = async (templateData) => {
    const isEdit = Boolean(templateData.id && templates.some((t) => t.id === templateData.id));

    if (isBackendConnected) {
      try {
        const url = isEdit ? `${API_BASE_URL}/${templateData.id}` : `${API_BASE_URL}`;
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateData)
        });

        const resData = await res.json();
        if (res.ok && resData.success) {
          if (isEdit) {
            setTemplates((prev) =>
              prev.map((t) => (t.id === templateData.id ? resData.data : t))
            );
            showToast(`Template '${templateData.name}' updated successfully!`);
          } else {
            setTemplates((prev) => [resData.data, ...prev]);
            showToast(`Template '${templateData.name}' created with ${templateData.validity_duration}-day validity!`);
          }
          setActiveView('list');
          setCurrentEditTemplate(null);
          return;
        }
      } catch (err) {
        console.warn('Backend call failed, applying changes locally:', err);
      }
    }

    // Local state fallback
    if (isEdit) {
      setTemplates((prev) =>
        prev.map((t) => (t.id === templateData.id ? { ...t, ...templateData, updatedAt: new Date().toISOString() } : t))
      );
      showToast(`Template '${templateData.name}' updated successfully!`);
    } else {
      const newEntry = {
        ...templateData,
        id: `tmpl_${Date.now()}_local`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setTemplates((prev) => [newEntry, ...prev]);
      showToast(`Template '${templateData.name}' created with ${templateData.validity_duration}-day validity!`);
    }

    setActiveView('list');
    setCurrentEditTemplate(null);
  };

  // Handler: Delete
  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this quotation template?')) return;

    if (isBackendConnected) {
      try {
        await fetch(`${API_BASE_URL}/${templateId}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Backend delete request failed:', err);
      }
    }

    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    showToast('Quotation template deleted.', 'info');
  };

  // Handler: Duplicate
  const handleDuplicateTemplate = async (templateId) => {
    if (isBackendConnected) {
      try {
        const res = await fetch(`${API_BASE_URL}/${templateId}/duplicate`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) {
          setTemplates((prev) => [data.data, ...prev]);
          showToast(`Cloned template: ${data.data.name}`);
          return;
        }
      } catch (err) {
        console.warn('Backend duplicate failed:', err);
      }
    }

    // Local clone
    const source = templates.find((t) => t.id === templateId);
    if (source) {
      const cloned = {
        ...source,
        id: `tmpl_${Date.now()}_copy`,
        name: `${source.name} (Copy)`,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setTemplates((prev) => [cloned, ...prev]);
      showToast(`Cloned template: ${cloned.name}`);
    }
  };

  // KPIs
  const totalCount = templates.length;
  const activeCount = templates.filter((t) => t.status === 'active').length;
  const avgValidityDays =
    totalCount > 0
      ? Math.round(templates.reduce((acc, t) => acc + (t.validity_duration || 30), 0) / totalCount)
      : 30;
  const pipelineValue = templates.reduce((acc, t) => acc + (t.grand_total || 0), 0);

  return (
    <div className="quote-template-workspace">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`notification-toast toast-${toastMessage.type}`}>
          <span className="toast-icon">✓</span>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Domain Header */}
      <div className="sales-domain-header">
        <div className="header-breadcrumbs">
          <span>Brightloop ERP</span> / <span>Quotes & Subscriptions</span> /{' '}
          <strong className="text-primary">Quotation Templates</strong>
        </div>

        <div className="header-main-row">
          <div>
            <h1 className="header-title">Quotation Templates</h1>
            <p className="header-tagline">
              Design reusable subscription quotation blueprints with custom validity periods, product variants, and auto-expiration terms.
            </p>
          </div>

          <div className="header-actions">
            {activeView === 'list' ? (
              <button
                className="btn btn-primary btn-lg"
                onClick={() => {
                  setCurrentEditTemplate(null);
                  setActiveView('create');
                }}
              >
                + New Template
              </button>
            ) : (
              <button
                className="btn btn-outline"
                onClick={() => {
                  setActiveView('list');
                  setCurrentEditTemplate(null);
                }}
              >
                ← Back to Templates
              </button>
            )}
          </div>
        </div>

      </div>

      {/* KPI Stats Bar */}
      <div className="stats-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Templates</div>
          <div className="kpi-value">{totalCount}</div>
          <div className="kpi-sub">Pre-configured blueprints</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Active & Ready</div>
          <div className="kpi-value text-success">{activeCount}</div>
          <div className="kpi-sub">Available for sales quotes</div>
        </div>

        <div className="kpi-card highlight-kpi">
          <div className="kpi-label">Avg Validity Window</div>
          <div className="kpi-value text-highlight">{avgValidityDays} <small>days</small></div>
          <div className="kpi-sub">Default customer quote lifetime</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Template Value Index</div>
          <div className="kpi-value">${pipelineValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <div className="kpi-sub">Sum of template packages</div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="loading-spinner-state">
          <div className="spinner"></div>
          <p>Loading quotation templates...</p>
        </div>
      ) : activeView === 'create' ? (
        <QuoteTemplateForm
          initialData={null}
          onSave={handleSaveTemplate}
          onCancel={() => setActiveView('list')}
          availableProducts={products}
          availablePlans={plans}
        />
      ) : activeView === 'edit' ? (
        <QuoteTemplateForm
          initialData={currentEditTemplate}
          onSave={handleSaveTemplate}
          onCancel={() => {
            setActiveView('list');
            setCurrentEditTemplate(null);
          }}
          availableProducts={products}
          availablePlans={plans}
        />
      ) : (
        <QuoteTemplateList
          templates={templates}
          onEdit={(tmpl) => {
            setCurrentEditTemplate(tmpl);
            setActiveView('edit');
          }}
          onDelete={handleDeleteTemplate}
          onDuplicate={handleDuplicateTemplate}
          onPreview={(tmpl) => setPreviewTemplate(tmpl)}
          onCreateNew={() => {
            setCurrentEditTemplate(null);
            setActiveView('create');
          }}
        />
      )}

      {/* Simulation / Preview Modal */}
      {previewTemplate && (
        <QuoteTemplatePreviewModal
          template={previewTemplate}
          mockUsers={users}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </div>
  );
}

