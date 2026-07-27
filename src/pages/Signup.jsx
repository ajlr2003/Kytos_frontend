import { API_BASE } from '../config.js';
/**
 * src/pages/Signup.jsx
 *
 * Self-service account creation. New accounts are always created with the
 * lowest-privilege role (Viewer) by the backend — there is no role picker
 * here on purpose, since /register no longer accepts a client-supplied role.
 * An existing Admin must promote the account afterward from the Users screen.
 *
 * Token storage: localStorage key "token".
 * API endpoint:  POST /api/v1/auth/register/
 */

import { useState } from 'react';
import '../styles/Login.css';

/**
 * @param {{ onSignup: () => void, onSwitchToLogin: () => void }} props
 */
export default function Signup({ onSignup, onSwitchToLogin }) {
  const [fullName, setFullName] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/register/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ full_name: fullName, email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const detail = data.detail;
        const message = Array.isArray(detail)
          ? detail.map(d => d.msg).join(' ')
          : detail || 'Could not create your account.';
        setError(message);
        return;
      }

      const data  = await res.json();
      const token = data.token ?? data.access ?? data.access_token;

      if (token) {
        localStorage.setItem('token', token);
        onSignup();
      } else {
        setError('Account created but no session token was returned.');
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
        <p className="login-tagline">Create your account</p>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="login-field">
            <label>Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Jane Doe"
              required
              autoFocus
            />
          </div>

          <div className="login-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="login-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
            />
          </div>

          <div className="login-field">
            <label>Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="login-hint">
          New accounts start with view-only access. An administrator can grant
          additional permissions once your account is created.
        </p>

        <p className="login-hint">
          Already have an account?{' '}
          <button type="button" className="login-link-btn" onClick={onSwitchToLogin}>
            Sign in
          </button>
        </p>
      </div>

      <p className="login-footer">© 2026 Kytos. All rights reserved.</p>
    </div>
  );
}
