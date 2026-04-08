import { useState } from 'react';
import '../styles/Login.css';

const ROLES = [
  'Executive Management',
  'Finance',
  'Procurement',
  'Sales',
  'Operations',
  'HR',
  'IT',
];

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || data.message || 'Invalid credentials.');
        return;
      }
      const data = await res.json();
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

  return (
    <div className="login-bg">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Starburst / snowflake */}
            {[0,30,60,90,120,150].map((deg) => (
              <g key={deg} transform={`rotate(${deg} 32 32)`}>
                <line x1="32" y1="6"  x2="32" y2="58" stroke="#4f6ef7" strokeWidth="3.5" strokeLinecap="round"/>
                <line x1="22" y1="14" x2="32" y2="6"  stroke="#4f6ef7" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="42" y1="14" x2="32" y2="6"  stroke="#4f6ef7" strokeWidth="2.5" strokeLinecap="round"/>
              </g>
            ))}
          </svg>
        </div>

        <h1 className="login-title">KYTOS</h1>
        <p className="login-subtitle">Smart Management</p>
        <p className="login-tagline">Secure Business Intelligence Access</p>

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
          Access permissions are aligned with organizational roles and business controls.
        </p>
      </div>

      <p className="login-footer">© 2026 Kytos. All rights reserved.</p>
    </div>
  );
}
