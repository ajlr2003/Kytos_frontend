/**
 * src/pages/Login.jsx
 *
 * Authentication page. Presents an email/password/role form, calls the
 * backend login endpoint, stores the JWT in localStorage, and invokes
 * the onLogin callback so App.jsx can unmount this page and show the dashboard.
 *
 * Token storage: localStorage key "token".
 * API endpoint:  POST /api/v1/auth/login/
 */

import { useState } from 'react';
import '../styles/Login.css';

/* ─── Constants ─────────────────────────────────────────────────── */

const ROLES = [
  'Executive Management',
  'Finance',
  'Procurement',
  'Sales',
  'Operations',
  'HR',
  'IT',
];

/* ─── Component ─────────────────────────────────────────────────── */

/**
 * @param {{ onLogin: () => void }} props
 */
export default function Login({ onLogin }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState(ROLES[0]);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login/', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || data.message || 'Invalid credentials.');
        return;
      }

      const data  = await res.json();
      /* Backend may return the token under different key names */
      const token = data.token ?? data.access ?? data.access_token;

      if (token) {
        localStorage.setItem('token', token);
        onLogin();
      } else {
        setError('Login succeeded but no token was returned.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  /* ── Render ── */
  return (
    <div className="login-bg">
      <div className="login-card">

        {/* ── Logo ── */}
        <div className="login-logo">
          <img
            src="/kytos logo.jpg"
            alt="Kytos logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '10px' }}
          />
        </div>

        <h1 className="login-title">KYTOS</h1>
        <p className="login-subtitle">Smart Management</p>
        <p className="login-tagline">Secure Business Intelligence Access</p>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="login-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>

          <div className="login-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <div className="login-forgot">
              <button type="button" onClick={() => {}}>Forgot password?</button>
            </div>
          </div>

          <div className="login-field">
            <label>Role</label>
            <div className="login-select-wrap">
              <select value={role} onChange={e => setRole(e.target.value)}>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
              <span className="login-select-arrow">▾</span>
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="login-hint">
          Access permissions are aligned with organisational roles and business controls.
        </p>
      </div>

      <p className="login-footer">© 2026 Kytos. All rights reserved.</p>
    </div>
  );
}
