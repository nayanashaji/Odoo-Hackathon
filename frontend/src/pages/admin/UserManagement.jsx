import React, { useCallback, useEffect, useState } from 'react';
import DataTable from '../../components/DataTable';
import './userManagement.css';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';
const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/;

async function apiRequest(path, token, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Request failed.');
  return result;
}

export default function UserManagement() {
  const token = localStorage.getItem('brightloop_token');
  const [staff, setStaff] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest('/auth/staff', token);
      setStaff(result.staff);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  async function createStaff(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!strongPassword.test(password) || new TextEncoder().encode(password).length > 72) {
      setError('Use 9–72 bytes with uppercase, lowercase, and a special character.');
      return;
    }
    setSaving(true);
    try {
      const result = await apiRequest('/auth/staff', token, { method: 'POST', body: JSON.stringify({ email, password }) });
      setStaff(current => [...current, result.user].sort((a, b) => a.email.localeCompare(b.email)));
      setEmail('');
      setPassword('');
      setNotice(`Staff account created for ${result.user.email}.`);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving(false);
    }
  }

  const staffColumns = [
    {
      key: 'email',
      header: 'Account',
      sortable: true,
      render: member => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="users-avatar">{member.email[0].toUpperCase()}</span>
          <div>
            <strong style={{ fontSize: '13px', color: '#1e293b' }}>{member.email}</strong>
            <small style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>{member.id}</small>
          </div>
        </div>
      )
    },
    {
      key: 'role',
      header: 'Role',
      align: 'right',
      render: () => <span className="users-role-pill staff">Staff</span>
    }
  ];

  return (
    <div className="users-page-wrapper">
      <div className="users-title">
        <div>
          <p className="users-eyebrow">ADMINISTRATION</p>
          <h1>User Management</h1>
          <p>Add and review internal staff accounts.</p>
        </div>
        <span className="users-role-pill">Admin only</span>
      </div>

      <div className="users-grid">
        <section className="users-card">
          <div className="users-card-heading">
            <span className="users-card-icon">＋</span>
            <div>
              <h2>Add a staff member</h2>
              <p>Staff accounts receive limited internal access.</p>
            </div>
          </div>
          <form className="users-form" onSubmit={createStaff}>
            <label>Email address<input type="email" autoComplete="email" placeholder="teammate@company.com" value={email} onChange={event => setEmail(event.target.value)} required /></label>
            <label>Temporary password<input type="password" autoComplete="new-password" placeholder="Create a strong password" value={password} onChange={event => setPassword(event.target.value)} minLength="9" required /><small>9–72 bytes; include uppercase, lowercase, and a special character.</small></label>
            {error && <div className="users-message error" role="alert">{error}</div>}
            {notice && <div className="users-message success" role="status">{notice}</div>}
            <button className="users-submit" disabled={saving}>{saving ? 'Creating account…' : 'Create staff account'}<span>→</span></button>
          </form>
        </section>

        <section className="users-card users-list-card">
          <div className="users-card-heading">
            <span className="users-card-icon people">♙</span>
            <div>
              <h2>Staff accounts</h2>
              <p>{staff.length} internal {staff.length === 1 ? 'member' : 'members'}</p>
            </div>
            <button className="users-refresh" onClick={loadStaff} aria-label="Refresh staff list">↻</button>
          </div>

          <DataTable
            columns={staffColumns}
            data={staff}
            loading={loading}
            emptyMessage="No staff accounts yet. Create the first internal account with the form."
            emptyIcon="♙"
            searchable={staff.length > 5}
            pagination={staff.length > 10}
            pageSize={10}
          />
        </section>
      </div>
    </div>
  );
}
