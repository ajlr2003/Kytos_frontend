import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { API_BASE } from '../config.js';

const token = () => localStorage.getItem('token');
const authH = () => ({ Authorization: `Bearer ${token()}` });

const ROLES = ['admin', 'manager', 'sales', 'purchaser', 'finance', 'viewer'];

const ROLE_COLORS = {
  admin: '#dc2626', manager: '#7c3aed', sales: '#2563eb',
  purchaser: '#d97706', finance: '#16a34a', viewer: '#6b7280',
};

const roleBadge = (role) => (
  <span style={{
    background: `${ROLE_COLORS[role] ?? '#6b7280'}1a`,
    color: ROLE_COLORS[role] ?? '#6b7280',
    fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
    textTransform: 'capitalize',
  }}>
    {role}
  </span>
);

const fmtDate = (d) => !d ? '—' : new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default function Users({ goPage }) {
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [toast, setToast] = useState('');
  const [savingId, setSavingId] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/v1/users`, { headers: authH() });
      if (r.status === 403) { setForbidden(true); return; }
      if (r.ok) { const d = await r.json(); setUsers(d.items); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/auth/me`, { headers: authH() })
      .then(r => r.ok ? r.json() : null)
      .then(u => setMe(u))
      .catch(() => {});
    fetchUsers();
  }, [fetchUsers]);

  const changeRole = async (userId, role) => {
    setSavingId(userId);
    try {
      const r = await fetch(`${API_BASE}/api/v1/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authH() },
        body: JSON.stringify({ role }),
      });
      if (r.ok) {
        showToast('Role updated');
        setUsers(list => list.map(u => u.id === userId ? { ...u, role } : u));
      } else {
        const e = await r.json().catch(() => ({}));
        showToast(e.detail ?? 'Could not update role');
      }
    } finally { setSavingId(null); }
  };

  const toggleActive = async (u) => {
    setSavingId(u.id);
    try {
      const r = await fetch(`${API_BASE}/api/v1/users/${u.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authH() },
        body: JSON.stringify({ is_active: !u.is_active }),
      });
      if (r.ok) {
        showToast(u.is_active ? 'Account deactivated' : 'Account activated');
        setUsers(list => list.map(x => x.id === u.id ? { ...x, is_active: !u.is_active } : x));
      } else {
        const e = await r.json().catch(() => ({}));
        showToast(e.detail ?? 'Could not update status');
      }
    } finally { setSavingId(null); }
  };

  return (
    <div id="users-page">
      <Sidebar activePage="users" goPage={goPage} />
      <div className="db-main">
        <div className="tb">
          <div className="tb-title tb-title-block">
            <div>User Management</div>
            <div className="tb-subtitle">Control who has access and what they're allowed to do</div>
          </div>
          <div className="tb-right">
            <div className="tb-user">
              <div className="tb-avatar" style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)' }}>
                {(me?.full_name ?? 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div><div className="tb-uname">{me?.full_name ?? 'User'}</div><div className="tb-urole">{me?.role ?? ''}</div></div>
            </div>
          </div>
        </div>

        <div className="pg">
          {forbidden && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 10, padding: '16px 20px', fontSize: 14 }}>
              You don't have permission to view this page. Only Admins can manage users.
            </div>
          )}

          {!forbidden && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,.06)', overflow: 'hidden' }}>
              {loading && <div style={{ textAlign: 'center', color: '#9ca3af', padding: '32px 0', fontSize: 13 }}>Loading…</div>}

              {!loading && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      {['Name', 'Email', 'Role', 'Status', 'Joined', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '14px 20px', fontWeight: 600, color: '#111827' }}>{u.full_name}</td>
                        <td style={{ padding: '14px 20px', color: '#374151' }}>{u.email}</td>
                        <td style={{ padding: '14px 20px' }}>
                          <select
                            value={u.role}
                            disabled={savingId === u.id || u.id === me?.id}
                            onChange={e => changeRole(u.id, e.target.value)}
                            style={{
                              height: 32, padding: '0 10px', borderRadius: 7, fontSize: 12.5,
                              border: '1px solid #e5e7eb', background: '#fff', color: '#111827',
                              cursor: u.id === me?.id ? 'not-allowed' : 'pointer',
                            }}
                            title={u.id === me?.id ? "You can't change your own role" : undefined}
                          >
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{
                            background: u.is_active ? '#dcfce7' : '#fee2e2',
                            color: u.is_active ? '#15803d' : '#dc2626',
                            fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
                          }}>
                            {u.is_active ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', color: '#6b7280' }}>{fmtDate(u.created_at)}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <button
                            disabled={savingId === u.id || u.id === me?.id}
                            onClick={() => toggleActive(u)}
                            title={u.id === me?.id ? "You can't deactivate your own account" : undefined}
                            style={{
                              height: 32, padding: '0 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 600,
                              border: '1px solid #e5e7eb', cursor: u.id === me?.id ? 'not-allowed' : 'pointer',
                              background: '#fff', color: u.is_active ? '#dc2626' : '#16a34a',
                            }}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: '32px 0' }}>No users found.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 28, right: 28, background: '#1f2937', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 2000, boxShadow: '0 4px 16px rgba(0,0,0,.25)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
