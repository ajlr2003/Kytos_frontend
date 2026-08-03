/**
 * src/components/config/ConfigModals.jsx
 *
 * Shared Configuration modals reused across Purchases, Sales, and Projects:
 *   - ConfigListModal    — manage a named lookup list (Product Categories,
 *                          Units of Measure, Packagings, Payment Terms,
 *                          Project Tags — anywhere staff pick from a short
 *                          list of values).
 *   - GeneralSettingsModal — the small set of app-wide defaults
 *                          (default currency, payment terms, tax rate).
 */

import { useState, useEffect } from 'react';
import { API_BASE } from '../../config.js';
import Modal from '../ui/Modal';

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` };
}

/* ── Named lookup list manager ── */
export function ConfigListModal({ listType, title, onClose, showToast }) {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch(`${API_BASE}/api/v1/config/lists?list_type=${listType}`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }
  useEffect(load, [listType]);

  async function add() {
    if (!newValue.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/config/lists`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ list_type: listType, value: newValue.trim() }),
      });
      if (res.ok) { setNewValue(''); load(); showToast?.('Added'); }
      else showToast?.((await res.json().catch(() => ({}))).detail || 'Failed to add');
    } finally { setSaving(false); }
  }

  async function toggleActive(item) {
    const res = await fetch(`${API_BASE}/api/v1/config/lists/${item.id}`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ is_active: !item.is_active }),
    });
    if (res.ok) load();
  }

  async function remove(id) {
    if (!window.confirm('Delete this item?')) return;
    const res = await fetch(`${API_BASE}/api/v1/config/lists/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (res.ok || res.status === 204) { load(); showToast?.('Deleted'); }
  }

  return (
    <Modal title={title} onClose={onClose}>
      {loading ? (
        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '20px 0' }}>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gap: '6px', marginBottom: '16px' }}>
          {items.length === 0 && <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>Nothing here yet.</div>}
          {items.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, opacity: item.is_active ? 1 : 0.5 }}>
              <span style={{ fontSize: 13, color: '#111827' }}>{item.value}</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => toggleActive(item)} style={{ fontSize: 11, height: 24, padding: '0 8px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
                  {item.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => remove(item.id)} style={{ height: 24, width: 24, background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #e5e7eb', paddingTop: '14px' }}>
        <input
          style={{ flex: 1, height: 34, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }}
          placeholder="Add a value…"
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
        />
        <button onClick={add} disabled={saving || !newValue.trim()} style={{ height: 34, padding: '0 16px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Add
        </button>
      </div>
    </Modal>
  );
}

/* ── General app settings ── */
export function GeneralSettingsModal({ onClose, showToast }) {
  const [form, setForm] = useState({ default_currency: '', default_payment_terms: '', default_tax_rate: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/config/settings`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setForm({ default_currency: d.default_currency ?? '', default_payment_terms: d.default_payment_terms ?? '', default_tax_rate: d.default_tax_rate ?? '' }); })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/config/settings`, {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({
          default_currency: form.default_currency || undefined,
          default_payment_terms: form.default_payment_terms || undefined,
          default_tax_rate: form.default_tax_rate !== '' ? Number(form.default_tax_rate) : undefined,
        }),
      });
      if (res.ok) { showToast?.('Settings saved'); onClose(); }
      else showToast?.((await res.json().catch(() => ({}))).detail || 'Failed to save');
    } finally { setSaving(false); }
  }

  const inp = { width: '100%', height: 36, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' };
  const lbl = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 };

  return (
    <Modal title="Settings" onClose={onClose}>
      {loading ? (
        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '20px 0' }}>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gap: '14px' }}>
          <div>
            <label style={lbl}>Default Currency</label>
            <input style={inp} placeholder="e.g. SAR" value={form.default_currency} onChange={e => setForm(f => ({ ...f, default_currency: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Default Payment Terms</label>
            <input style={inp} placeholder="e.g. Net 30" value={form.default_payment_terms} onChange={e => setForm(f => ({ ...f, default_payment_terms: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Default Tax Rate (%)</label>
            <input type="number" min="0" max="100" style={inp} placeholder="e.g. 15" value={form.default_tax_rate} onChange={e => setForm(f => ({ ...f, default_tax_rate: e.target.value }))} />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
        <button onClick={onClose} style={{ height: 34, padding: '0 16px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        <button onClick={save} disabled={saving || loading} style={{ height: 34, padding: '0 18px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}
