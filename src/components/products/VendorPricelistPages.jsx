/**
 * src/components/products/VendorPricelistPages.jsx
 *
 * Vendor Pricelist create/edit page — per-supplier product pricing, mirrors
 * Odoo's Vendor Pricelist screen. Backed by
 * GET/POST/PUT/DELETE /api/v1/vendor-pricelists.
 */

import { useState } from 'react';
import { API_BASE } from '../../config.js';

const fieldStyle = { display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '16px' };
const labelStyle = { fontSize: '12.5px', fontWeight: 600, color: '#6b7280' };
const inputStyle = { height: '38px', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '0 10px', fontSize: '13.5px', color: '#111827', outline: 'none', width: '100%', boxSizing: 'border-box' };

function Field({ label, children }) {
  return (
    <div style={fieldStyle}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export function VendorPricelistFormPage({ pricelist, suppliers = [], products = [], onCancel, onSaved, showToast }) {
  const isEdit = !!pricelist;
  const [form, setForm] = useState({
    supplier_id: pricelist?.supplier_id ?? '',
    vendor_product_name: pricelist?.vendor_product_name ?? '',
    vendor_product_code: pricelist?.vendor_product_code ?? '',
    lead_time_days: pricelist?.lead_time_days ?? 1,
    stock_item_id: pricelist?.stock_item_id ?? '',
    quantity: pricelist?.quantity ?? 1,
    unit_price: pricelist?.unit_price ?? 0,
    valid_from: pricelist?.valid_from ?? '',
    valid_to: pricelist?.valid_to ?? '',
    discount_pct: pricelist?.discount_pct ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function submit() {
    if (!form.supplier_id) { setError('Vendor is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) { setError('Not authenticated.'); return; }

      const body = {
        supplier_id: form.supplier_id,
        vendor_product_name: form.vendor_product_name.trim() || null,
        vendor_product_code: form.vendor_product_code.trim() || null,
        lead_time_days: Number(form.lead_time_days) || 0,
        stock_item_id: form.stock_item_id || null,
        quantity: Number(form.quantity) || 1,
        unit_price: Number(form.unit_price) || 0,
        valid_from: form.valid_from || null,
        valid_to: form.valid_to || null,
        discount_pct: Number(form.discount_pct) || 0,
      };

      const url = isEdit ? `${API_BASE}/api/v1/vendor-pricelists/${pricelist.id}` : `${API_BASE}/api/v1/vendor-pricelists`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.detail || `Failed to save (${res.status})`); return; }

      showToast(isEdit ? 'Vendor pricelist updated' : 'Vendor pricelist created');
      onSaved();
    } catch (e) {
      setError(e.message || 'Failed to save vendor pricelist.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="nrfq-page">
      <div className="nrfq-actionbar">
        <button className="nrfq-btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button className="nrfq-btn-ghost" onClick={onCancel}>Discard</button>
      </div>

      <div className="nrfq-breadcrumb">
        <span className="nrfq-crumb-link" onClick={onCancel}>Vendor Pricelists</span> <span>/</span> {isEdit ? 'Edit' : 'New'}
      </div>

      {error && <div className="pur-form-error" style={{ color: '#ef4444', fontSize: '13px', margin: '0 0 12px', padding: '8px 12px', background: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>{error}</div>}

      <div className="nrfq-body">
        <div className="nrfq-form" style={{ maxWidth: 'none' }}>
          <div className="nrfq-field-grid">
            <div className="nrfq-field-col">
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: '12px' }}>Vendor</div>

              <Field label="Vendor *">
                <select style={inputStyle} value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)}>
                  <option value="">{suppliers.length === 0 ? 'No vendors yet' : 'Select a vendor…'}</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                </select>
              </Field>

              <Field label="Vendor Product Name">
                <input style={inputStyle} type="text" value={form.vendor_product_name} onChange={e => set('vendor_product_name', e.target.value)} />
              </Field>

              <Field label="Vendor Product Code">
                <input style={inputStyle} type="text" value={form.vendor_product_code} onChange={e => set('vendor_product_code', e.target.value)} />
              </Field>

              <Field label="Lead Time (days)">
                <input style={inputStyle} type="number" min="0" value={form.lead_time_days} onChange={e => set('lead_time_days', e.target.value)} />
              </Field>
            </div>

            <div className="nrfq-field-col">
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: '12px' }}>Pricelist</div>

              <Field label="Product">
                <select style={inputStyle} value={form.stock_item_id} onChange={e => set('stock_item_id', e.target.value)}>
                  <option value="">{products.length === 0 ? 'No products yet' : 'Select a product…'}</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.description || p.part_number}</option>)}
                </select>
              </Field>

              <Field label="Quantity">
                <input style={inputStyle} type="number" min="0.01" step="0.01" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
              </Field>

              <Field label="Unit Price (SAR)">
                <input style={inputStyle} type="number" min="0" step="0.01" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} />
              </Field>

              <Field label="Validity">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input style={inputStyle} type="date" value={form.valid_from} onChange={e => set('valid_from', e.target.value)} />
                  <span style={{ fontSize: '12.5px', color: '#9ca3af' }}>to</span>
                  <input style={inputStyle} type="date" value={form.valid_to} onChange={e => set('valid_to', e.target.value)} />
                </div>
              </Field>

              <Field label="Discount (%)">
                <input style={inputStyle} type="number" min="0" max="100" step="0.01" value={form.discount_pct} onChange={e => set('discount_pct', e.target.value)} />
              </Field>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
