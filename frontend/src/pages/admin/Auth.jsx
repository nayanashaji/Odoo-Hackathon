import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';
const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/;
const modeForPath = path => ({ '/register': 'register', '/forgot-password': 'reset-request', '/reset-password': 'reset' }[path] ?? 'login');
const pathForMode = mode => ({ login: '/login', register: '/register', 'reset-request': '/forgot-password', reset: '/reset-password' }[mode]);

async function request(path, payload) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Request failed.');
  return result;
}

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState(() => modeForPath(location.pathname));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setMode(modeForPath(location.pathname)), [location.pathname]);

  function changeMode(nextMode) {
    setMode(nextMode); setError(''); setMessage('');
    navigate(pathForMode(nextMode));
  }

  async function submit(event) {
    event.preventDefault(); setMessage(''); setError(''); setBusy(true);
    try {
      if (mode === 'reset-request') {
        const result = await request('/auth/password-reset/request', { email }); setMessage(result.message);
      } else if (mode === 'reset') {
        if (!passwordRule.test(password)) throw new Error('Use more than 8 characters, including uppercase, lowercase, and a special character.');
        const result = await request('/auth/password-reset/confirm', { token: new URLSearchParams(location.search).get('token'), password }); setMessage(result.message);
      } else {
        if (mode === 'register' && !passwordRule.test(password)) throw new Error('Use more than 8 characters, including uppercase, lowercase, and a special character.');
        const result = await request(`/auth/${mode}`, { email, password });
        localStorage.setItem('brightloop_token', result.token);
        localStorage.setItem('brightloop_user', JSON.stringify(result.user));
        if (['admin', 'staff'].includes(result.user.role)) navigate('/finance', { replace: true });
        else setMessage('Your account is ready. Finance workspace access is for staff accounts.');
      }
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  const heading = { login: 'Welcome back', register: 'Create your account', 'reset-request': 'Reset your password', reset: 'Choose a new password' }[mode];
  return <main className="page-shell">
    <aside className="brand-panel"><div className="brand"><span className="brand-mark">b</span> brightloop</div><div className="brand-copy"><p className="eyebrow">SUBSCRIPTION MANAGEMENT</p><h1>More clarity.<br /><em>Less busywork.</em></h1><p>One place for the plans, billing, and relationships that keep your business moving.</p></div><div className="panel-foot">A clearer way to run recurring business <span>↗</span></div></aside>
    <section className="form-panel"><div className="form-wrap"><div className="mobile-brand"><span className="brand-mark">b</span> brightloop</div><div className="form-heading"><p className="eyebrow">YOUR BRIGHTLOOP ACCOUNT</p><h2>{heading}</h2><p>{mode === 'login' ? 'Sign in to continue to your workspace.' : mode === 'register' ? 'Start managing your subscriptions in one place.' : 'We’ll help you get back into your account.'}</p></div>
      <form onSubmit={submit}>
        {mode !== 'reset' && <label>Email address<input type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required /></label>}
        {(mode === 'login' || mode === 'register' || mode === 'reset') && <label>{mode === 'reset' ? 'New password' : 'Password'}<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 9 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength="9" />{mode !== 'login' && <small>Include uppercase, lowercase, and a special character.</small>}</label>}
        {mode === 'login' && <button className="text-button forgot" type="button" onClick={() => changeMode('reset-request')}>Forgot password?</button>}
        {error && <div className="notice error" role="alert">{error}</div>}{message && <div className="notice success" role="status">{message}</div>}
        <button className="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : mode === 'reset-request' ? 'Send reset link' : 'Update password'}<span>→</span></button>
      </form>
      <div className="switch-mode">{mode === 'login' ? <>New to Brightloop? <button className="text-button" type="button" onClick={() => changeMode('register')}>Create an account</button></> : mode === 'register' ? <>Already have an account? <button className="text-button" type="button" onClick={() => changeMode('login')}>Sign in</button></> : <button className="text-button" type="button" onClick={() => changeMode('login')}>← Back to sign in</button>}</div>
      <footer>© 2026 Brightloop Software <span>Secure account access</span></footer>
    </div></section>
  </main>;
}
