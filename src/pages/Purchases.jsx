import { API_BASE } from '../config.js';
/**
 * src/pages/Purchases.jsx
 *
 * Purchases module. Covers the full procurement workflow:
 *   - Request for Quotation (RFQ) creation and management.
 *   - Purchase Order (PO) creation from awarded RFQs.
 *   - Goods Received Notes (GRN) against purchase orders.
 *   - Supplier management and performance tracking.
 *
 * API base: /api/v1/rfqs/, /api/v1/purchase-orders/, /api/v1/grns/
 * Auth:     Bearer token stored in localStorage under key "token".
 */

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Toast   from '../components/ui/Toast';
import Modal   from '../components/ui/Modal';
import ActivityTimeline from '../components/ui/ActivityTimeline';
import { NewProductPage, ProductDetailPage } from '../components/products/ProductPages';
import { VendorPricelistFormPage } from '../components/products/VendorPricelistPages';
import { AnalysisBarLineChart, AnalysisPieChart } from '../components/reports/AnalysisCharts';
import '../styles/Purchases.css';

/* ─── API response → display shape ─── */
const STATUS_BADGE = { DRAFT:'rb-pending', SENT:'rb-review', RECEIVED:'rb-review', EVALUATED:'rb-review', AWARDED:'rb-completed', CLOSED:'rb-completed', CANCELLED:'rb-cancelled' };
const STATUS_ACTION = {
  DRAFT:     { label:'Send RFQ',      cls:'blue' },
  SENT:      { label:'View Details',  cls:'blue' },
  RECEIVED:  { label:'Review Quotes', cls:'blue' },
  EVALUATED: { label:'Review Quotes', cls:'blue' },
  AWARDED:   { label:'Create PO',     cls:'green' },
  CLOSED:    { label:'View Details',  cls:'blue' },
  CANCELLED: { label:'View Details',  cls:'blue' },
};
function mapApiRFQ(r) {
  const rawStatus = r.status || 'DRAFT';
  const act = STATUS_ACTION[rawStatus] || { label:'View Details', cls:'blue' };
  return {
    id:        r.id,
    num:       r.rfq_number || r.reference || `RFQ-${String(r.id ?? '').slice(0, 8)}`,
    status:    rawStatus.charAt(0) + rawStatus.slice(1).toLowerCase(),
    badgeCls:  STATUS_BADGE[rawStatus] || 'rb-pending',
    est:       r.currency || 'USD',
    desc:      (r.title || 'Untitled RFQ') + (r.description ? ` — ${r.description}` : ''),
    dates:     r.deadline ? `Deadline: ${r.deadline}` : (r.created_at ? `Created: ${new Date(r.created_at).toLocaleDateString()}` : ''),
    suppliers: `${r.item_count ?? 0} item${r.item_count !== 1 ? 's' : ''}`,
    responses: '0 responses',
    action:    act.label,
    actionCls: act.cls,
    deadline:  r.deadline ?? null,
    createdAt: r.created_at ?? null,
  };
}

/* ─── Deadline → relative-day display used by the RFQ table ─── */
function formatDeadline(deadline) {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return null;
  const diffDays = Math.round((Date.now() - d.getTime()) / 86400000);
  if (diffDays > 0) return { text: `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`, late: true };
  if (diffDays === 0) return { text: 'Today', late: false };
  return { text: d.toLocaleDateString(), late: false };
}


/* ─── Create GRN Modal ─── */
function CreateGRNModal({ onClose, onSuccess }) {
  const [poList,           setPoList]           = useState([]);
  const [poLoading,        setPoLoading]        = useState(true);
  const [poError,          setPoError]          = useState('');
  const [poId,             setPoId]             = useState('');
  const [poDetails,        setPoDetails]        = useState(null);
  const [poDetailsLoading, setPoDetailsLoading] = useState(false);
  const [qty,              setQty]              = useState('');
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setPoError('Not authenticated.'); setPoLoading(false); return; }
    fetch(`${API_BASE}/api/v1/purchase-orders`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : Promise.reject(`Failed to load POs (${res.status})`))
      .then(data => {
        const raw = data.items ?? (Array.isArray(data) ? data : data.results ?? []);
        setPoList(raw.filter(po => po.status?.toLowerCase() !== 'completed'));
      })
      .catch(err => setPoError(String(err)))
      .finally(() => setPoLoading(false));
  }, []);

  // Fetch PO details when a PO is selected to get quantity info
  useEffect(() => {
    if (!poId) { setPoDetails(null); return; }
    const token = localStorage.getItem('token');
    if (!token) return;
    setPoDetailsLoading(true);
    fetch(`${API_BASE}/api/v1/purchase-orders/${poId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setPoDetails(data))
      .catch(() => {
        const found = poList.find(p => p.id === poId);
        setPoDetails(found ?? null);
      })
      .finally(() => setPoDetailsLoading(false));
  }, [poId, poList]);

  const orderedQty   = Number(poDetails?.ordered_quantity ?? poDetails?.total_quantity ?? poDetails?.quantity ?? 0);
  const receivedQty  = Number(poDetails?.received_quantity ?? 0);
  const remainingQty = Math.max(0, orderedQty - receivedQty);
  const progressPct  = orderedQty > 0 ? Math.min(100, Math.round((receivedQty / orderedQty) * 100)) : 0;

  const qtyNum      = Number(qty);
  const qtyTooHigh  = qty !== '' && orderedQty > 0 && qtyNum > remainingQty;
  const qtyTooLow   = qty !== '' && qtyNum <= 0;
  const qtyInvalid  = qtyTooHigh || qtyTooLow;
  const qtyErrMsg   = qtyTooHigh
    ? `Cannot exceed remaining quantity (${remainingQty})`
    : qtyTooLow ? 'Quantity must be greater than 0' : '';

  async function handleSubmit() {
    if (!poId || !qty) { setError('PO and received quantity are required.'); return; }
    if (qtyNum <= 0) { setError('Quantity must be greater than 0.'); return; }
    if (orderedQty > 0 && qtyNum > remainingQty) { setError(`Cannot exceed remaining quantity (${remainingQty}).`); return; }
    const token = localStorage.getItem('token');
    if (!token) { setError('Not authenticated.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/grn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ po_id: poId, received_quantity: qtyNum }),
      });
      if (!res.ok) throw new Error(`Failed to create GRN (${res.status})`);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Goods Receipt Note" onClose={onClose}>
      <div className="pur-form-group">
        <label>Purchase Order *</label>
        {poError ? (
          <div style={{ fontSize: '13px', color: '#b91c1c' }}>{poError}</div>
        ) : (
          <select value={poId} onChange={e => { setPoId(e.target.value); setQty(''); }} disabled={poLoading}>
            <option value="">{poLoading ? 'Loading POs…' : 'Select PO…'}</option>
            {poList.map(po => (
              <option key={po.id} value={po.id}>
                {po.id}{po.supplier_name ? ` — ${po.supplier_name}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Quantity summary for selected PO */}
      {poId && (
        <div style={{ margin: '0 0 14px', padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          {poDetailsLoading ? (
            <div style={{ fontSize: '13px', color: '#9ca3af' }}>Loading PO details…</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: orderedQty > 0 ? '10px' : 0 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Ordered</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>{orderedQty || '—'}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Received</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb' }}>{receivedQty}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: remainingQty > 0 ? '#d97706' : '#16a34a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Remaining</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: remainingQty > 0 ? '#d97706' : '#16a34a' }}>{remainingQty}</div>
                </div>
              </div>
              {orderedQty > 0 && (
                <div>
                  <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progressPct}%`, background: remainingQty === 0 ? '#16a34a' : '#3b82f6', borderRadius: '99px', transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px', textAlign: 'right' }}>{progressPct}% received</div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="pur-form-group">
        <label>Received Quantity *</label>
        <input
          type="number"
          min="1"
          max={remainingQty > 0 ? remainingQty : undefined}
          placeholder="0"
          value={qty}
          onChange={e => setQty(e.target.value)}
          style={{ borderColor: qtyInvalid ? '#ef4444' : undefined }}
        />
        {qtyErrMsg && (
          <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{qtyErrMsg}</div>
        )}
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '13px', marginBottom: '8px' }}>{error}</div>
      )}
      <div className="pur-modal-actions">
        <button className="pur-btn-cancel" onClick={onClose}>Cancel</button>
        <button
          className="pur-btn-primary"
          onClick={handleSubmit}
          disabled={saving || poLoading || !poId || !qty || qtyInvalid}
        >
          {saving ? 'Creating…' : 'Create GRN'}
        </button>
      </div>
    </Modal>
  );
}

/* ─── Create PO Modal ─── */
function CreatePOModal({ onClose }) {
  return (
    <Modal title="Create Purchase Order" onClose={onClose}>
      <div style={{ padding: '8px 0 16px', fontSize: '13.5px', color: '#374151', lineHeight: '1.6' }}>
        Purchase Orders can only be created from an awarded RFQ.
        <ol style={{ marginTop: '12px', paddingLeft: '18px', color: '#6b7280', fontSize: '13px' }}>
          <li>Go to the <strong>RFQs</strong> tab</li>
          <li>Open an RFQ with status <strong>Awarded</strong></li>
          <li>Click <strong>Create PO</strong> inside the RFQ detail</li>
        </ol>
      </div>
      <div className="pur-modal-actions">
        <button className="pur-btn-cancel" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

/* ─── Add / Edit Supplier Modal ─── */
function SupplierFormModal({ supplier, onClose, onSaved, showToast }) {
  const isEdit = !!supplier;
  const [form, setForm] = useState({
    company_name:   supplier?.company_name   ?? '',
    contact_name:   supplier?.contact_name   ?? '',
    email:          supplier?.email          ?? '',
    phone:          supplier?.phone          ?? '',
    address_line1:  supplier?.address_line1  ?? '',
    address_line2:  supplier?.address_line2  ?? '',
    city:           supplier?.city           ?? '',
    state:          supplier?.state          ?? '',
    postal_code:    supplier?.postal_code    ?? '',
    country:        supplier?.country        ?? '',
    tax_id:         supplier?.tax_id         ?? '',
    payment_terms_days: supplier?.payment_terms_days ?? 30,
    currency:       supplier?.currency       ?? 'USD',
    bank_details:   supplier?.bank_details   ?? '',
    rating:         supplier?.rating         ?? '',
    is_preferred:   supplier?.is_preferred   ?? false,
    notes:          supplier?.notes          ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [saved, setSaved]     = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit() {
    if (!form.company_name.trim()) { setError('Company name is required.'); return; }
    if (!form.email.trim()) { setError('Email is required.'); return; }

    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) { setError('Not authenticated. Please log in.'); return; }

      const payload = {
        ...form,
        company_name: form.company_name.trim(),
        email: form.email.trim(),
        contact_name: form.contact_name.trim() || null,
        phone: form.phone.trim() || null,
        address_line1: form.address_line1.trim() || null,
        address_line2: form.address_line2.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        postal_code: form.postal_code.trim() || null,
        country: form.country.trim() || null,
        tax_id: form.tax_id.trim() || null,
        payment_terms_days: Number(form.payment_terms_days) || 0,
        bank_details: form.bank_details.trim() || null,
        rating: form.rating === '' ? null : Number(form.rating),
        notes: form.notes.trim() || null,
      };

      const url = isEdit ? `${API_BASE}/api/v1/suppliers/${supplier.id}` : `${API_BASE}/api/v1/suppliers`;
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.detail || `Failed to save supplier (${res.status})`); return; }

      setSaved(true);
      setTimeout(() => { onSaved(data); onClose(); }, 700);
    } catch (e) {
      setError(e.message || 'Failed to save supplier.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={isEdit ? `Edit Supplier — ${supplier.company_name}` : 'Add Supplier'} onClose={onClose}>
      {saved ? (
        <div className="pur-success">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div>{isEdit ? 'Supplier updated!' : 'Supplier added!'}</div>
        </div>
      ) : (
        <>
          {error && <div className="pur-form-error" style={{ color:'#ef4444', fontSize:'13px', marginBottom:'12px', padding:'8px 12px', background:'#fef2f2', borderRadius:'6px', border:'1px solid #fecaca' }}>{error}</div>}

          <div className="pur-form-grid">
            <div className="pur-form-group">
              <label>Company Name *</label>
              <input type="text" placeholder="e.g. Al-Jaber Medical" value={form.company_name} onChange={e => set('company_name', e.target.value)}/>
            </div>
            <div className="pur-form-group">
              <label>Contact Name</label>
              <input type="text" placeholder="Full name" value={form.contact_name} onChange={e => set('contact_name', e.target.value)}/>
            </div>
          </div>
          <div className="pur-form-grid">
            <div className="pur-form-group">
              <label>Email *</label>
              <input type="email" placeholder="vendor@company.com" value={form.email} onChange={e => set('email', e.target.value)}/>
            </div>
            <div className="pur-form-group">
              <label>Phone</label>
              <input type="text" placeholder="+966 50 000 0000" value={form.phone} onChange={e => set('phone', e.target.value)}/>
            </div>
          </div>
          <div className="pur-form-grid">
            <div className="pur-form-group">
              <label>Address</label>
              <input type="text" placeholder="Street address" value={form.address_line1} onChange={e => set('address_line1', e.target.value)}/>
            </div>
            <div className="pur-form-group">
              <label>Address Line 2</label>
              <input type="text" placeholder="Suite / floor / building" value={form.address_line2} onChange={e => set('address_line2', e.target.value)}/>
            </div>
          </div>
          <div className="pur-form-grid">
            <div className="pur-form-group">
              <label>City</label>
              <input type="text" value={form.city} onChange={e => set('city', e.target.value)}/>
            </div>
            <div className="pur-form-group">
              <label>State / Province</label>
              <input type="text" value={form.state} onChange={e => set('state', e.target.value)}/>
            </div>
          </div>
          <div className="pur-form-grid">
            <div className="pur-form-group">
              <label>Postal Code</label>
              <input type="text" value={form.postal_code} onChange={e => set('postal_code', e.target.value)}/>
            </div>
            <div className="pur-form-group">
              <label>Country</label>
              <input type="text" value={form.country} onChange={e => set('country', e.target.value)}/>
            </div>
          </div>
          <div className="pur-form-grid">
            <div className="pur-form-group">
              <label>Tax ID / VAT Number</label>
              <input type="text" value={form.tax_id} onChange={e => set('tax_id', e.target.value)}/>
            </div>
            <div className="pur-form-group">
              <label>Payment Terms (days)</label>
              <input type="number" min="0" max="365" value={form.payment_terms_days} onChange={e => set('payment_terms_days', e.target.value)}/>
            </div>
          </div>
          <div className="pur-form-grid">
            <div className="pur-form-group">
              <label>Currency</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)}>
                <option value="USD">USD — US Dollar</option>
                <option value="SAR">SAR — Saudi Riyal</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="AED">AED — UAE Dirham</option>
              </select>
            </div>
            <div className="pur-form-group">
              <label>Rating (0–5)</label>
              <input type="number" min="0" max="5" step="0.1" placeholder="e.g. 4.5" value={form.rating} onChange={e => set('rating', e.target.value)}/>
            </div>
          </div>
          <div className="pur-form-group">
            <label>Bank Details</label>
            <textarea rows={2} placeholder="Bank name, IBAN, SWIFT…" value={form.bank_details} onChange={e => set('bank_details', e.target.value)} style={{ width:'100%', resize:'vertical', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:'6px', fontSize:'13.5px', fontFamily:'inherit' }}/>
          </div>
          <div className="pur-form-group">
            <label>Notes</label>
            <textarea rows={2} placeholder="Internal notes about this supplier…" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ width:'100%', resize:'vertical', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:'6px', fontSize:'13.5px', fontFamily:'inherit' }}/>
          </div>
          <div className="pur-form-group" style={{ flexDirection:'row', alignItems:'center', gap:'8px' }}>
            <input type="checkbox" id="sup-preferred" checked={form.is_preferred} onChange={e => set('is_preferred', e.target.checked)} style={{ width:'auto' }}/>
            <label htmlFor="sup-preferred" style={{ margin:0 }}>Mark as Preferred Supplier</label>
          </div>

          <div className="pur-modal-actions">
            <button className="pur-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="pur-btn-primary" onClick={submit} disabled={loading}>
              {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Supplier'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ─── Supplier Detail Modal ─── */
function SupplierDetailModal({ supplier, onClose, onEdit, onDeactivated, showToast }) {
  const [linkedRfqs, setLinkedRfqs] = useState([]);
  const [linkedPOs, setLinkedPOs]   = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoadingLinks(false); return; }
    Promise.all([
      fetch(`${API_BASE}/api/v1/suppliers/${supplier.id}/rfqs`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
      fetch(`${API_BASE}/api/v1/purchase-orders?supplier_id=${supplier.id}`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
    ]).then(([rfqData, poData]) => {
      setLinkedRfqs(rfqData.items ?? []);
      setLinkedPOs(poData.items ?? []);
    }).finally(() => setLoadingLinks(false));
  }, [supplier.id]);

  async function deactivate() {
    setDeactivating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/v1/suppliers/${supplier.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(data.detail || 'Failed to deactivate supplier'); return; }
      showToast(data.message || 'Supplier deactivated');
      onDeactivated(supplier.id);
      onClose();
    } catch {
      showToast('Network error — supplier not deactivated');
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <Modal title={supplier.company_name} onClose={onClose}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px',paddingBottom:'14px',borderBottom:'1px solid #f3f4f6'}}>
        <div>
          {supplier.is_preferred && <span style={{fontSize:'11px',fontWeight:600,color:'#15803d',background:'#dcfce7',padding:'2px 10px',borderRadius:'12px',marginRight:'6px'}}>Preferred</span>}
          {!supplier.is_active && <span style={{fontSize:'11px',fontWeight:600,color:'#b91c1c',background:'#fee2e2',padding:'2px 10px',borderRadius:'12px'}}>Inactive</span>}
        </div>
        {supplier.rating != null && (
          <span style={{ fontWeight:700, color: supplier.rating >= 4.5 ? '#16a34a' : supplier.rating >= 4.0 ? '#f59e0b' : '#ef4444' }}>{'★ ' + Number(supplier.rating).toFixed(1)}</span>
        )}
      </div>

      {supplier.contact_name && <div className="pur-detail-row"><span>Contact</span><strong>{supplier.contact_name}</strong></div>}
      <div className="pur-detail-row"><span>Email</span><strong>{supplier.email}</strong></div>
      {supplier.phone && <div className="pur-detail-row"><span>Phone</span><strong>{supplier.phone}</strong></div>}
      {(supplier.address_line1 || supplier.city || supplier.country) && (
        <div className="pur-detail-row"><span>Address</span><strong style={{textAlign:'right'}}>
          {[supplier.address_line1, supplier.address_line2, supplier.city, supplier.state, supplier.postal_code, supplier.country].filter(Boolean).join(', ')}
        </strong></div>
      )}
      {supplier.tax_id && <div className="pur-detail-row"><span>Tax ID</span><strong>{supplier.tax_id}</strong></div>}
      <div className="pur-detail-row"><span>Payment Terms</span><strong>{supplier.payment_terms_days} days · {supplier.currency}</strong></div>
      {supplier.bank_details && <div className="pur-detail-row"><span>Bank Details</span><strong style={{whiteSpace:'pre-wrap',textAlign:'right'}}>{supplier.bank_details}</strong></div>}
      {supplier.notes && <div className="pur-detail-row"><span>Notes</span><strong style={{color:'#6b7280',fontSize:'12.5px'}}>{supplier.notes}</strong></div>}

      <div style={{margin:'16px 0 8px',fontSize:'12.5px',fontWeight:600,color:'#374151'}}>
        RFQs Invited To {!loadingLinks && `(${linkedRfqs.length})`}
      </div>
      {loadingLinks ? (
        <div style={{fontSize:'12.5px',color:'#9ca3af'}}>Loading…</div>
      ) : linkedRfqs.length === 0 ? (
        <div style={{fontSize:'12.5px',color:'#9ca3af'}}>No RFQs yet.</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'6px',marginBottom:'8px'}}>
          {linkedRfqs.map(r => (
            <div key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#f9fafb',border:'1px solid #f3f4f6',borderRadius:'8px',padding:'8px 10px'}}>
              <span style={{fontSize:'12.5px',fontWeight:600,color:'#2563eb'}}>{r.rfq_number}</span>
              <span style={{fontSize:'11.5px',color:'#6b7280',textTransform:'capitalize'}}>{r.status?.toLowerCase()}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{margin:'16px 0 8px',fontSize:'12.5px',fontWeight:600,color:'#374151'}}>
        Purchase Orders {!loadingLinks && `(${linkedPOs.length})`}
      </div>
      {loadingLinks ? (
        <div style={{fontSize:'12.5px',color:'#9ca3af'}}>Loading…</div>
      ) : linkedPOs.length === 0 ? (
        <div style={{fontSize:'12.5px',color:'#9ca3af'}}>No purchase orders yet.</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
          {linkedPOs.map(po => (
            <div key={po.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#f9fafb',border:'1px solid #f3f4f6',borderRadius:'8px',padding:'8px 10px'}}>
              <span style={{fontSize:'12.5px',fontWeight:600,color:'#2563eb'}}>{po.po_number ?? po.id}</span>
              <span style={{fontSize:'11.5px',color:'#6b7280',textTransform:'capitalize'}}>{po.status?.toLowerCase?.() ?? po.status}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{margin:'16px 0 8px',fontSize:'12.5px',fontWeight:600,color:'#374151'}}>Activity</div>
      <ActivityTimeline entityType="supplier" entityId={supplier.id} />

      <div className="pur-modal-actions" style={{marginTop:'20px',flexWrap:'wrap',gap:'8px'}}>
        <button className="pur-btn-cancel" onClick={onClose}>Close</button>
        <button className="pur-btn-secondary" onClick={() => onEdit(supplier)}>Edit</button>
        {supplier.is_active && (
          <button className="pur-btn-secondary" style={{color:'#b91c1c',borderColor:'#b91c1c'}} onClick={deactivate} disabled={deactivating}>
            {deactivating ? 'Deactivating…' : 'Deactivate'}
          </button>
        )}
      </div>
    </Modal>
  );
}

/* ─── Submit Supplier Quotation Modal ─── */
function SubmitQuoteModal({ rfq, suppliers, onClose, onSubmitted }) {
  const [supplierId,      setSupplierId]      = useState('');
  const [notes,           setNotes]           = useState('');
  const [items,           setItems]           = useState([
    { id: 1, product_name: '', description: '', quantity: 1, unit_price: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const addItem = () => setItems(p => [
    ...p,
    { id: Date.now(), product_name: '', description: '', quantity: 1, unit_price: '' },
  ]);
  const delItem = id => setItems(p => p.length > 1 ? p.filter(i => i.id !== id) : p);
  const setItemField = (id, field, value) =>
    setItems(p => p.map(i => i.id === id ? { ...i, [field]: value } : i));

  const total = items.reduce(
    (s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0
  );

  async function handleSubmit() {
    setError('');
    if (!supplierId) { setError('Select a supplier.'); return; }
    const validItems = items.filter(i => i.product_name.trim() && parseFloat(i.unit_price) > 0);
    if (validItems.length === 0) { setError('Add at least one item with a name and price.'); return; }

    const token = localStorage.getItem('token');
    if (!token) { setError('Not authenticated.'); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/quotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          rfq_id:       rfq.id,
          supplier_id:  supplierId,
          notes:        notes.trim() || null,
          items:        validItems.map(i => ({
            product_name: i.product_name.trim(),
            description:  i.description.trim() || null,
            quantity:     parseFloat(i.quantity) || 1,
            unit_price:   parseFloat(i.unit_price),
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.detail === 'string' ? err.detail : `Error ${res.status}`);
      }
      onSubmitted();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const rowStyle = { display: 'grid', gridTemplateColumns: '2fr 2fr 80px 100px 28px', gap: '6px', marginBottom: '6px', alignItems: 'center' };
  const inp = { padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', width: '100%', boxSizing: 'border-box' };

  return (
    <Modal title="Submit Supplier Quotation" onClose={onClose}>
      {error && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}

      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Supplier *</label>
        <select style={inp} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
          <option value="">Select supplier…</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.company_name ?? s.name ?? s.id}</option>)}
        </select>
        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
          Linked to RFQ {rfq.rfq_number ?? rfq.id}
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 80px 100px 28px', gap: '6px', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Product</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Description</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', textAlign: 'center' }}>Qty</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', textAlign: 'right' }}>Unit Price</span>
          <span />
        </div>
        {items.map(item => (
          <div key={item.id} style={rowStyle}>
            <input style={inp} placeholder="Product name" value={item.product_name} onChange={e => setItemField(item.id, 'product_name', e.target.value)} />
            <input style={inp} placeholder="Description" value={item.description} onChange={e => setItemField(item.id, 'description', e.target.value)} />
            <input style={{ ...inp, textAlign: 'center' }} type="number" min="0.001" step="any" value={item.quantity} onChange={e => setItemField(item.id, 'quantity', e.target.value)} />
            <input style={{ ...inp, textAlign: 'right' }} type="number" min="0" step="any" placeholder="0.00" value={item.unit_price} onChange={e => setItemField(item.id, 'unit_price', e.target.value)} />
            <button onClick={() => delItem(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '16px', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
          </div>
        ))}
        <button onClick={addItem} style={{ fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontWeight: 600 }}>+ Add Item</button>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Notes</label>
        <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} placeholder="Any notes or conditions…" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
          Total: <span style={{ color: '#2563eb' }}>${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="pur-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="pur-btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Quotation'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── RFQ Detail Modal ─── */
function RFQDetailModal({ rfq, onClose, onSend, purchaseOrders = [], onPOCreated }) {
  const [detail,      setDetail]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [sending,     setSending]     = useState(false);
  const [localStatus, setLocalStatus] = useState(null); // overrides detail.status after send
  const [sendSuccess, setSendSuccess] = useState(false);
  const [quotations,  setQuotations]  = useState([]);
  const [quotationsLoading, setQuotationsLoading] = useState(true);
  const [selectedSupplierId,   setSelectedSupplierId]   = useState(null);
  const [selectedSupplierName, setSelectedSupplierName] = useState('');
  const [selectingId,          setSelectingId]          = useState(null); // tracks in-flight request
  const [selectError,          setSelectError]          = useState('');
  const [autoSelecting,        setAutoSelecting]        = useState(false);
  const [creatingPO,     setCreatingPO]     = useState(false);
  const [poCreated,      setPoCreated]      = useState(false);
  const [poError,        setPoError]        = useState('');
  const [showSubmitQuote, setShowSubmitQuote] = useState(false);

  // Reset all session state whenever a different RFQ is opened
  useEffect(() => {
    setDetail(null);
    setLoading(true);
    setError('');
    setSending(false);
    setLocalStatus(null);
    setSendSuccess(false);
    setQuotations([]);
    setQuotationsLoading(true);
    setSelectedSupplierId(null);
    setSelectedSupplierName('');
    setSelectingId(null);
    setSelectError('');
    setAutoSelecting(false);
    setCreatingPO(false);
    setPoCreated(false);
    setPoError('');
    setShowSubmitQuote(false);
  }, [rfq.id]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setError('Not authenticated.'); setLoading(false); return; }
    fetch(`${API_BASE}/api/v1/rfqs/${rfq.id}/`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load RFQ (${res.status})`);
        return res.json();
      })
      .then(data => {
        setDetail(data);
        if (data.has_po) setPoCreated(true);
        if (data.selected_supplier_id) {
          setSelectedSupplierId(data.selected_supplier_id);
          if (data.status?.toUpperCase() === 'AWARDED') setLocalStatus('AWARDED');
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));

    // Check if PO already exists for this RFQ
    fetch(`${API_BASE}/api/v1/purchase-orders?rfq_id=${rfq.id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        const results = Array.isArray(data) ? data : data.items ?? data.results ?? [];
        // Verify at least one PO actually belongs to this RFQ (guards against backend ignoring query param)
        const hasMatchingPO = results.some(po => po.rfq_id === rfq.id);
        if (hasMatchingPO) setPoCreated(true);
      })
      .catch(() => {});

    // Fetch quotations
    fetch(`${API_BASE}/api/v1/rfqs/${rfq.id}/quotations`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const raw = Array.isArray(data) ? data : data.items ?? data.results ?? [];
        setQuotations(raw);
        // Resolve selected supplier name once quotations are available
        setSelectedSupplierId(prev => {
          if (prev) {
            const match = raw.find(q => q.supplier?.id === prev);
            if (match) setSelectedSupplierName(match.supplier?.company_name ?? 'Selected Supplier');
          }
          return prev;
        });
      })
      .catch(() => setQuotations([]))
      .finally(() => setQuotationsLoading(false));
  }, [rfq.id]);

  async function handleSendRFQ() {
    const token = localStorage.getItem('token');
    if (!token) { setError('Not authenticated.'); return; }
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/rfqs/${rfq.id}/send/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to send RFQ (${res.status})`);
      setLocalStatus('SENT');
      setSendSuccess(true);
      onSend();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleAutoSelect() {
    const token = localStorage.getItem('token');
    if (!token) { setSelectError('Not authenticated.'); return; }
    setAutoSelecting(true);
    setSelectError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/rfqs/${rfq.id}/auto-select`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Auto-select failed (${res.status})`);
      const data = await res.json();
      const winnerId = data.selected_supplier_id;
      const winnerQuote = quotations.find(q => q.supplier?.id === winnerId);
      const winnerName = winnerQuote?.supplier?.company_name ?? 'Selected Supplier';
      setSelectedSupplierId(winnerId);
      setSelectedSupplierName(winnerName);
      setLocalStatus('AWARDED');
    } catch (err) {
      setSelectError(err.message);
    } finally {
      setAutoSelecting(false);
    }
  }

  async function handleCreatePO() {
    if (poCreated || creatingPO) return;
    const token = localStorage.getItem('token');
    if (!token) { setPoError('Not authenticated.'); return; }
    setCreatingPO(true);
    setPoError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/purchase-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ rfq_id: rfq.id, supplier_id: selectedSupplierId ?? detail?.selected_supplier_id }),
      });
      if (res.status === 409) { setPoCreated(true); onPOCreated?.(); return; }
      if (!res.ok) throw new Error(`Failed to create PO (${res.status})`);
      setPoCreated(true);
      onPOCreated?.();
    } catch (err) {
      setPoError(err.message);
    } finally {
      setCreatingPO(false);
    }
  }

  const currentStatus = localStatus ?? detail?.status;
  const statusCls = localStatus ? 'rb-review' : rfq.badgeCls;

  if (showSubmitQuote) {
    return (
      <SubmitQuoteModal
        rfq={rfq}
        suppliers={detail?.suppliers ?? []}
        onClose={() => setShowSubmitQuote(false)}
        onSubmitted={() => {
          setQuotationsLoading(true);
          const token = localStorage.getItem('token');
          fetch(`${API_BASE}/api/v1/rfqs/${rfq.id}/quotations`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then(r => r.ok ? r.json() : { items: [] })
            .then(d => setQuotations(Array.isArray(d) ? d : d.items ?? []))
            .catch(() => {})
            .finally(() => setQuotationsLoading(false));
        }}
      />
    );
  }

  return (
    <Modal title={`${rfq.num} — Details`} onClose={onClose}>
      <div style={{ display:'flex', gap:'24px' }}>
        <div style={{ flex:1, minWidth:0 }}>
      {loading && <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13.5px' }}>Loading…</div>}
      {error   && <div style={{ padding: '12px', color: '#b91c1c', fontSize: '13px', background: '#fef2f2', borderRadius: '8px' }}>{error}</div>}
      {detail && <>
        <div className="pur-detail-row"><span>RFQ Number</span><strong>{detail.rfq_number}</strong></div>
        {detail.customer_reference && (
          <div className="pur-detail-row"><span>Customer Ref</span><strong>{detail.customer_reference}</strong></div>
        )}
        <div className="pur-detail-row"><span>Title</span><strong>{detail.title}</strong></div>
        {detail.description && (
          <div className="pur-detail-row"><span>Description</span><strong>{detail.description}</strong></div>
        )}
        <div className="pur-detail-row">
          <span>Status</span>
          <span className={`rfq-badge ${statusCls}`}>{currentStatus ? currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1).toLowerCase() : ''}</span>
        </div>
        <div className="pur-detail-row"><span>Currency</span><strong>{detail.currency}</strong></div>
        <div className="pur-detail-row">
          <span>Created At</span>
          <strong>{new Date(detail.created_at).toLocaleString()}</strong>
        </div>
        {detail.deadline && (
          <div className="pur-detail-row"><span>Deadline</span><strong>{detail.deadline}</strong></div>
        )}

        <div style={{ marginTop: '16px', marginBottom: '4px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Suppliers Invited</div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            {Array.isArray(detail.suppliers) && detail.suppliers.length > 0 ? detail.suppliers.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', borderBottom: i < detail.suppliers.length - 1 ? '1px solid #f3f4f6' : 'none', fontSize: '13.5px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                <span style={{ color: '#111827', fontWeight: 500 }}>{s.company_name ?? s.name ?? s}</span>
              </div>
            )) : (
              <div style={{ padding: '10px 14px', fontSize: '13.5px', color: '#9ca3af' }}>No suppliers invited</div>
            )}
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quotations</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {currentStatus?.toLowerCase() === 'sent' && (
                <button
                  onClick={() => setShowSubmitQuote(true)}
                  style={{ fontSize: '12px', padding: '4px 12px', background: '#074E3B', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  + Submit Quote
                </button>
              )}
              {quotations.length > 0 && !selectedSupplierId && (
                <button
                  onClick={handleAutoSelect}
                  disabled={autoSelecting}
                  style={{ fontSize: '12px', padding: '4px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: autoSelecting ? 'not-allowed' : 'pointer', opacity: autoSelecting ? 0.6 : 1, fontWeight: 600 }}
                >
                  {autoSelecting ? 'Selecting…' : 'Auto Select Supplier'}
                </button>
              )}
            </div>
          </div>
          {selectedSupplierName && (
            <div style={{ marginBottom: '8px', padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#15803d', fontSize: '13px' }}>
              Auto Selected: <strong>{selectedSupplierName}</strong> — Lowest Price
            </div>
          )}
          {selectError && (
            <div style={{ marginBottom: '8px', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>{selectError}</div>
          )}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            {quotationsLoading ? (
              <div style={{ padding: '10px 14px', fontSize: '13.5px', color: '#9ca3af' }}>Loading…</div>
            ) : quotations.length === 0 ? (
              <div style={{ padding: '10px 14px', fontSize: '13.5px', color: '#9ca3af' }}>No quotations yet</div>
            ) : quotations.map((q, i) => {
              const supplierId   = q.supplier?.id;
              const supplierName = q.supplier?.company_name ?? 'Unknown Supplier';
              const isSelected   = selectedSupplierId === supplierId;
              const qItems       = Array.isArray(q.items) ? q.items : [];
              return (
                <div key={q.id ?? i} style={{ padding: '12px 14px', borderBottom: i < quotations.length - 1 ? '1px solid #f3f4f6' : 'none', fontSize: '13.5px', background: isSelected ? '#f0fdf4' : 'transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{supplierName}</span>
                    <span style={{ fontWeight: 700, color: '#2563eb' }}>${Number(q.unit_price ?? q.price ?? q.total_price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {qItems.length > 0 && (
                    <div style={{ marginTop: '6px', marginBottom: '4px', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
                      {qItems.map((item, ii) => (
                        <div key={ii} style={{ padding: '6px 10px', borderBottom: ii < qItems.length - 1 ? '1px solid #f3f4f6' : 'none', fontSize: '12.5px', background: '#f9fafb' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#374151', fontWeight: 500 }}>{item.product_name}</span>
                            <span style={{ fontWeight: 600, color: '#111827' }}>${Number(item.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                            <span style={{ color: '#6b7280', fontSize: '11.5px' }}>{item.quantity} × ${Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}{item.description ? ` · ${item.description}` : ''}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {q.notes && <div style={{ fontSize: '12.5px', color: '#6b7280', marginBottom: '4px' }}>{q.notes}</div>}
                  {isSelected && (
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#15803d' }}>✓ Auto Selected (Lowest Price)</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Items</div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            {Array.isArray(detail.items) && detail.items.length > 0 ? detail.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < detail.items.length - 1 ? '1px solid #f3f4f6' : 'none', fontSize: '13.5px' }}>
                <span style={{ color: '#111827', fontWeight: 500 }}>{item.product_name}</span>
                <span style={{ color: '#6b7280' }}>{item.quantity} {item.quantity === 1 ? item.unit_of_measure : `${item.unit_of_measure}s`}</span>
              </div>
            )) : (
              <div style={{ padding: '12px 14px', fontSize: '13.5px', color: '#9ca3af' }}>No items</div>
            )}
          </div>
        </div>
      </>}

      {sendSuccess && (
        <div style={{ margin: '12px 0 0', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#15803d', fontSize: '13px' }}>
          RFQ sent successfully! Suppliers will be notified.
        </div>
      )}

      {poCreated && (
        <div style={{ margin: '12px 0 0', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#15803d', fontSize: '13px' }}>
          PO Created
        </div>
      )}
      {poError && (
        <div style={{ margin: '12px 0 0', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>{poError}</div>
      )}

      <div className="pur-modal-actions" style={{ marginTop: '20px' }}>
        <button className="pur-btn-cancel" onClick={onClose}>Close</button>
        {currentStatus?.toLowerCase() === 'draft' && (
          <button className="pur-btn-primary" onClick={handleSendRFQ} disabled={sending}>
            {sending ? 'Sending…' : 'Send RFQ'}
          </button>
        )}
        {currentStatus?.toLowerCase() === 'sent' && (
          <button className="pur-btn-primary" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>Sent</button>
        )}
        {currentStatus?.toLowerCase() === 'awarded' && (() => {
          const backendHasPO = purchaseOrders.some(po => po.rfq_id === rfq.id);
          const poExists = backendHasPO || poCreated;
          return poExists ? (
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#15803d', padding: '0 4px' }}>✓ PO Created</span>
          ) : (
            <button className="pur-btn-primary" onClick={handleCreatePO} disabled={creatingPO}>
              {creatingPO ? 'Creating…' : 'Create PO'}
            </button>
          );
        })()}
        {rfq.status === 'In Review' && <button className="pur-btn-primary" onClick={onClose}>Approve Quotes</button>}
        {rfq.status === 'Pending'   && <button className="pur-btn-primary" onClick={onClose}>Send Reminders</button>}
      </div>
        </div>

        <div style={{ width:'280px', flexShrink:0, borderLeft:'1px solid #f3f4f6', paddingLeft:'20px' }}>
          <div style={{ fontSize:'12.5px', fontWeight:600, color:'#374151', marginBottom:'8px' }}>Activity</div>
          <ActivityTimeline entityType="rfq" entityId={rfq.id} />
        </div>
      </div>
    </Modal>
  );
}

/* ─── PO Detail Modal ─── */
function PODetailModal({ po, onClose }) {
  const [detail,  setDetail]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setError('Not authenticated.'); setLoading(false); return; }
    fetch(`${API_BASE}/api/v1/purchase-orders/${po.id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : Promise.reject(`Failed to load PO (${res.status})`))
      .then(data => setDetail(data))
      .catch(err => { setError(String(err)); setDetail(po); })
      .finally(() => setLoading(false));
  }, [po.id]);

  const src          = detail ?? po;
  const orderedQty   = Number(src?.ordered_quantity ?? src?.total_quantity ?? src?.quantity ?? 0);
  const receivedQty  = Number(src?.received_quantity ?? 0);
  const remainingQty = Math.max(0, orderedQty - receivedQty);
  const progressPct  = orderedQty > 0 ? Math.min(100, Math.round((receivedQty / orderedQty) * 100)) : 0;

  const supplierName = src?.supplier_name ?? src?.supplier?.company_name ?? src?.supplier?.name ?? src?.supplier_id ?? '—';
  const status       = src?.status ?? '—';

  return (
    <Modal title={`Purchase Order — ${po.id}`} onClose={onClose}>
      {loading && <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '13.5px' }}>Loading…</div>}
      {error && !detail && <div style={{ padding: '10px 12px', background: '#fef2f2', borderRadius: '8px', color: '#b91c1c', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}

      <div className="pur-detail-row"><span>PO ID</span><strong>{src?.id}</strong></div>
      <div className="pur-detail-row"><span>Supplier</span><strong>{supplierName}</strong></div>
      <div className="pur-detail-row"><span>RFQ ID</span><strong>{src?.rfq_id ?? '—'}</strong></div>
      <div className="pur-detail-row">
        <span>Status</span>
        <span className={`pur-status-badge ${status.toLowerCase() === 'completed' ? 'po-delivered' : status.toLowerCase() === 'partial' ? 'po-pending' : 'po-approved'}`}>{status}</span>
      </div>
      <div className="pur-detail-row"><span>Created</span><strong>{src?.created_at ? new Date(src.created_at).toLocaleString() : '—'}</strong></div>

      {/* Quantity tracking */}
      <div style={{ marginTop: '16px', padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Quantity Tracking</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: orderedQty > 0 ? '12px' : 0 }}>
          <div style={{ textAlign: 'center', padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Ordered</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>{orderedQty || '—'}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Received</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#2563eb' }}>{receivedQty}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px', background: remainingQty === 0 ? '#f0fdf4' : '#fffbeb', borderRadius: '8px', border: `1px solid ${remainingQty === 0 ? '#bbf7d0' : '#fde68a'}` }}>
            <div style={{ fontSize: '11px', color: remainingQty === 0 ? '#16a34a' : '#d97706', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Remaining</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: remainingQty === 0 ? '#16a34a' : '#d97706' }}>{remainingQty}</div>
          </div>
        </div>
        {orderedQty > 0 && (
          <div>
            <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, background: remainingQty === 0 ? '#16a34a' : '#3b82f6', borderRadius: '99px', transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af', marginTop: '5px' }}>
              <span>{progressPct}% received</span>
              <span>{receivedQty} / {orderedQty} units</span>
            </div>
          </div>
        )}
      </div>

      <div className="pur-modal-actions" style={{ marginTop: '20px' }}>
        <button className="pur-btn-cancel" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

/* ─── Invoice Detail Modal ─── */
function InvoiceDetailModal({ invoice: initInvoice, onClose, onUpdated }) {
  const [invoice,  setInvoice]  = useState(initInvoice);
  const [actioning, setActioning] = useState('');
  const [error,    setError]    = useState('');

  async function callAction(action) {
    const token = localStorage.getItem('token');
    if (!token) { setError('Not authenticated.'); return; }
    setActioning(action);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/purchase-invoices/${invoice.id}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Action failed (${res.status})`);
      const updated = await res.json();
      setInvoice(updated);
      onUpdated?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setActioning('');
    }
  }

  const status      = invoice.status?.toLowerCase() ?? 'draft';
  const statusLabel = status === 'paid' ? 'Paid' : status === 'approved' ? 'Approved' : 'Draft';
  const statusCls   = status === 'paid' ? 'rb-completed' : status === 'approved' ? 'rb-review' : 'rb-pending';
  const supplierName = invoice.supplier_name ?? invoice.supplier?.company_name ?? '—';
  const totalAmt    = Number(invoice.total_amount ?? invoice.amount ?? 0);
  const unitPrice   = Number(invoice.unit_price ?? 0);
  const receivedQty = invoice.received_quantity ?? invoice.quantity ?? '—';

  return (
    <Modal title={`Invoice — ${String(invoice.id).slice(0, 8)}…`} onClose={onClose}>
      <div className="pur-detail-row">
        <span>Status</span>
        <span className={`pur-status-badge ${statusCls}`}>{statusLabel}</span>
      </div>
      <div className="pur-detail-row"><span>Supplier</span><strong>{supplierName}</strong></div>
      <div className="pur-detail-row"><span>PO ID</span><strong style={{ fontSize:'12px', wordBreak:'break-all' }}>{invoice.po_id ?? '—'}</strong></div>
      <div className="pur-detail-row"><span>GRN ID</span><strong style={{ fontSize:'12px', wordBreak:'break-all' }}>{invoice.grn_id ?? '—'}</strong></div>
      <div className="pur-detail-row"><span>Date</span><strong>{invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : '—'}</strong></div>

      <div style={{ marginTop: '16px', padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Billing Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div style={{ textAlign: 'center', padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Qty Received</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>{receivedQty}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Unit Price</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#2563eb' }}>${unitPrice.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Total Amount</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#15803d' }}>${totalAmt.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: '12px', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>{error}</div>
      )}

      <div className="pur-modal-actions" style={{ marginTop: '20px' }}>
        <button className="pur-btn-cancel" onClick={onClose}>Close</button>
        {status === 'draft' && (
          <button
            className="pur-btn-primary"
            onClick={() => callAction('approve')}
            disabled={!!actioning}
            style={{ background: '#2563eb' }}
          >
            {actioning === 'approve' ? 'Approving…' : 'Approve Invoice'}
          </button>
        )}
        {status === 'approved' && (
          <button
            className="pur-btn-primary"
            onClick={() => callAction('pay')}
            disabled={!!actioning}
            style={{ background: '#16a34a' }}
          >
            {actioning === 'pay' ? 'Processing…' : 'Mark as Paid'}
          </button>
        )}
      </div>
    </Modal>
  );
}

/* ─── Nav tab content ─── */
const NAV_CONTENT = {
  'RFQs': null, // rendered separately
  'Purchase Orders': [
    { num:'PO-2024-042', supplier:'TechSupply Co.', item:'Laptops x 10', amount:'$18,500', status:'Approved',   statusCls:'po-approved' },
    { num:'PO-2024-041', supplier:'OfficePlus Ltd.',item:'Office Chairs x 20', amount:'$4,200', status:'Delivered', statusCls:'po-delivered' },
    { num:'PO-2024-040', supplier:'DataTech Systems',item:'Server Rack Components', amount:'$32,000', status:'Pending', statusCls:'po-pending' },
  ],
  'Receipts/GRN': [
    { num:'GRN-2024-018', po:'PO-2024-041', supplier:'OfficePlus Ltd.', date:'Dec 14, 2024', items:'20 / 20', status:'Complete' },
    { num:'GRN-2024-017', po:'PO-2024-039', supplier:'TechSupply Co.',  date:'Dec 12, 2024', items:'8 / 10',  status:'Partial' },
  ],
  'Suppliers Directory': [
    { name:'TechSupply Co.',    category:'IT Equipment',   rating:'4.8', status:'Preferred' },
    { name:'GlobalPrint Inc.',  category:'Marketing',      rating:'3.9', status:'Approved' },
    { name:'OfficePlus Ltd.',   category:'Office Supplies',rating:'4.5', status:'Preferred' },
    { name:'DataTech Systems',  category:'IT Services',    rating:'4.2', status:'Approved' },
  ],
};


/* ─── New RFQ — full page (replaces the create-RFQ modal) ─── */
function nowAsDatetimeLocal() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function NewRFQPage({ onCancel, onCreated, showToast }) {
  const [suppliersList,    setSuppliersList]    = useState([]);
  const [suppliersLoading, setSuppliersLoading]  = useState(true);
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
  const [crmLeads,         setCrmLeads]          = useState([]);
  const [crmLeadId,        setCrmLeadId]         = useState('');
  const [title,            setTitle]             = useState('');
  const [description,      setDescription]       = useState('');
  const [vendorRef,        setVendorRef]        = useState('');
  const [deadline,         setDeadline]         = useState(nowAsDatetimeLocal);
  const [expectedArrival,  setExpectedArrival]  = useState('');
  const [arrivalConfirmation, setArrivalConfirmation] = useState(false);
  const [items,            setItems]            = useState([{ product_name: '', quantity: 1, unit_of_measure: 'unit', unit_price: '' }]);
  const [terms,            setTerms]            = useState('');
  const [step,             setStep]             = useState(0);
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState('');

  const STEPS = ['Vendor', 'Details', 'Items', 'Review'];

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setSuppliersLoading(false); return; }
    fetch(`${API_BASE}/api/v1/suppliers`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : Promise.reject(res.status))
      .then(data => setSuppliersList(data.items ?? data.results ?? (Array.isArray(data) ? data : [])))
      .catch(() => setSuppliersList([]))
      .finally(() => setSuppliersLoading(false));
    fetch(`${API_BASE}/api/v1/crm/leads`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setCrmLeads(Array.isArray(d) ? d : d.items ?? []))
      .catch(() => {});
  }, []);

  const selectedLead = crmLeads.find(l => l.id === crmLeadId);
  const soleVendor = selectedSuppliers.length === 1 ? suppliersList.find(s => s.id === selectedSuppliers[0]) : null;

  function onLeadChange(id) {
    setCrmLeadId(id);
    const lead = crmLeads.find(l => l.id === id);
    if (lead?.customer_reference && !vendorRef.trim()) setVendorRef(lead.customer_reference);
  }

  function toggleSupplier(id) {
    setSelectedSuppliers(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }

  function updateItem(i, field, value) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it));
  }
  function addItem()    { setItems(prev => [...prev, { product_name: '', quantity: 1, unit_of_measure: 'unit', unit_price: '' }]); }
  function removeItem(i) { setItems(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev); }

  const untaxedAmount = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);

  function validateStep(i) {
    if (i === 0 && !title.trim()) return 'Title is required.';
    if (i === 0 && selectedSuppliers.length === 0) return 'Please select at least one supplier.';
    if (i === 2) {
      const invalidItem = items.find(it => !it.product_name.trim());
      if (invalidItem) return 'All lines must have a product.';
      const badQty = items.find(it => Number(it.quantity) <= 0);
      if (badQty) return 'All quantities must be greater than 0.';
    }
    return '';
  }
  function goNext() {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError('');
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  }
  function goBack() { setError(''); setStep(s => Math.max(s - 1, 0)); }

  async function submit() {
    if (!title.trim()) { setError('Title is required.'); setStep(0); return; }
    if (selectedSuppliers.length === 0) { setError('Please select at least one supplier.'); setStep(0); return; }
    const invalidItem = items.find(it => !it.product_name.trim());
    if (invalidItem) { setError('All lines must have a product.'); setStep(2); return; }
    const badQty = items.find(it => Number(it.quantity) <= 0);
    if (badQty) { setError('All quantities must be greater than 0.'); setStep(2); return; }

    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) { setError('Not authenticated. Please log in.'); return; }

      const payload = {
        title: title.trim(),
        ...(description.trim() && { description: description.trim() }),
        ...(vendorRef.trim() && { customer_reference: vendorRef.trim() }),
        ...(crmLeadId && { crm_lead_id: crmLeadId }),
        ...(deadline && { deadline: deadline.split('T')[0] }),
        currency: 'SAR',
        supplier_ids: selectedSuppliers,
        items: items.map(it => ({
          product_name:    it.product_name.trim(),
          quantity:        Number(it.quantity),
          unit_of_measure: it.unit_of_measure.trim() || 'unit',
          ...(it.unit_price !== '' && it.unit_price != null && { target_unit_price: Number(it.unit_price) }),
        })),
      };

      const res = await fetch(`${API_BASE}/api/v1/rfqs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.detail || `Failed to create RFQ (${res.status})`); return; }

      showToast('RFQ created successfully');
      onCreated();
    } catch (e) {
      setError(e.message || 'Failed to create RFQ.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="nrfq-page">
      <div className="nrfq-actionbar">
        <button className="nrfq-btn-ghost" onClick={onCancel}>← Back to RFQs</button>
      </div>

      <div className="nrfq-breadcrumb"><span className="nrfq-crumb-link" onClick={onCancel}>Requests for Quotation</span> <span>/</span> New</div>

      {error && <div className="pur-form-error" style={{ color:'#ef4444', fontSize:'13px', margin:'0 0 12px', padding:'8px 12px', background:'#fef2f2', borderRadius:'6px', border:'1px solid #fecaca' }}>{error}</div>}

      <div className="wiz-progress">
        {STEPS.map((s, i) => (
          <div key={s} className={`wiz-step${i === step ? ' active' : ''}${i < step ? ' done' : ''}`} onClick={() => i < step && setStep(i)}>
            <span className="wiz-step-dot">{i < step ? '✓' : i + 1}</span>
            <span className="wiz-step-label">{s}</span>
            {i < STEPS.length - 1 && <span className="wiz-step-line" />}
          </div>
        ))}
      </div>

      <div className="nrfq-body">
        <div className="nrfq-form">
          {step === 0 && (
            <>
              <div className="nrfq-title">
                <span className="nrfq-star">☆</span>
                <input className="nrfq-title-input" type="text" placeholder="e.g. Office Chairs — Q2 2025" value={title} onChange={e => setTitle(e.target.value)} />
              </div>

              <div className="nrfq-field">
                <label>Suppliers *</label>
                <div className="nrfq-supplier-list">
                  {suppliersLoading ? (
                    <div className="nrfq-supplier-empty">Loading suppliers…</div>
                  ) : suppliersList.length === 0 ? (
                    <div className="nrfq-supplier-empty">No suppliers available.</div>
                  ) : suppliersList.map(s => {
                    const checked = selectedSuppliers.includes(s.id);
                    return (
                      <div key={s.id} className={`nrfq-supplier-row${checked ? ' checked' : ''}`} onClick={() => toggleSupplier(s.id)}>
                        <input type="checkbox" checked={checked} onChange={() => {}} onClick={e => e.stopPropagation()} />
                        <div>
                          <div className="nrfq-supplier-name">{s.company_name}</div>
                          {s.category && <div className="nrfq-supplier-cat">{s.category}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {selectedSuppliers.length > 0 && (
                  <div className="nrfq-supplier-count">{selectedSuppliers.length} supplier{selectedSuppliers.length !== 1 ? 's' : ''} selected</div>
                )}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="nrfq-field-grid">
                <div className="nrfq-field-col">
                  <div className="nrfq-field">
                    <label>Vendor Reference</label>
                    <input type="text" placeholder="e.g. the number the vendor sent us" value={vendorRef} onChange={e => setVendorRef(e.target.value)} />
                  </div>
                  <div className="nrfq-field">
                    <label>Payment Terms</label>
                    <div className="nrfq-static">{soleVendor?.payment_terms_days ? `Net ${soleVendor.payment_terms_days}` : '—'}</div>
                  </div>
                  <div className="nrfq-field">
                    <label>Link to CRM Lead</label>
                    <select value={crmLeadId} onChange={e => onLeadChange(e.target.value)}>
                      <option value="">— None —</option>
                      {crmLeads.map(l => (
                        <option key={l.id} value={l.id}>{l.company}{l.contact_person ? ` · ${l.contact_person}` : ''}</option>
                      ))}
                    </select>
                    {selectedLead?.customer_reference && (
                      <div className="nrfq-hint">Inherited into Vendor Reference — edit that field to override.</div>
                    )}
                  </div>
                </div>
                <div className="nrfq-field-col">
                  <div className="nrfq-field">
                    <label>Order Deadline</label>
                    <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
                  </div>
                  <div className="nrfq-field">
                    <label>Expected Arrival</label>
                    <input type="datetime-local" value={expectedArrival} onChange={e => setExpectedArrival(e.target.value)} />
                  </div>
                  <div className="nrfq-field nrfq-field-checkbox">
                    <label>Arrival Confirmation</label>
                    <input type="checkbox" checked={arrivalConfirmation} onChange={e => setArrivalConfirmation(e.target.checked)} />
                  </div>
                  <div className="nrfq-field">
                    <label>Deliver To</label>
                    <div className="nrfq-static">Infronex: Receipts</div>
                  </div>
                </div>
              </div>
              <div className="nrfq-field">
                <label>Description</label>
                <textarea rows={3} placeholder="Describe what you need…" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <table className="nrfq-lines">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="center">Quantity</th>
                    <th>Unit</th>
                    <th className="right">Unit Price</th>
                    <th className="right">Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i}>
                      <td><input type="text" placeholder="Product name" value={it.product_name} onChange={e => updateItem(i, 'product_name', e.target.value)} /></td>
                      <td className="center"><input type="number" min="1" value={it.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} style={{ textAlign:'center' }} /></td>
                      <td><input type="text" value={it.unit_of_measure} onChange={e => updateItem(i, 'unit_of_measure', e.target.value)} /></td>
                      <td className="right"><input type="number" min="0" step="any" placeholder="0.00" value={it.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} style={{ textAlign:'right' }} /></td>
                      <td className="right nrfq-amount">{((Number(it.quantity)||0) * (Number(it.unit_price)||0)).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      <td>
                        <button className="nrfq-line-del" onClick={() => removeItem(i)} disabled={items.length === 1} title="Remove line">
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="nrfq-add-links">
                <span onClick={addItem}>Add a product</span>
                <span onClick={() => showToast('Sections coming soon')}>Add a section</span>
                <span onClick={() => showToast('Notes coming soon')}>Add a note</span>
                <span onClick={() => showToast('Catalog coming soon')}>Catalog</span>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="prd-section-title">Review</div>
              <div className="wiz-review-grid">
                <div><span>Title</span><strong>{title || '—'}</strong></div>
                <div><span>Suppliers</span><strong>{selectedSuppliers.length}</strong></div>
                <div><span>Order Deadline</span><strong>{deadline ? new Date(deadline).toLocaleString() : '—'}</strong></div>
                <div><span>Vendor Reference</span><strong>{vendorRef || '—'}</strong></div>
                <div><span>Items</span><strong>{items.length}</strong></div>
                <div><span>Untaxed Total</span><strong>{untaxedAmount.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} SAR</strong></div>
              </div>
              <div className="nrfq-field" style={{ marginTop: '16px' }}>
                <label>Terms &amp; Conditions</label>
                <textarea rows={3} placeholder="Define your terms and conditions …" value={terms} onChange={e => setTerms(e.target.value)} />
              </div>
              <div className="nrfq-totals">
                <div><span>Untaxed Amount:</span><strong>{untaxedAmount.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} SAR</strong></div>
                <div className="grand"><span>Total:</span><strong>{untaxedAmount.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} SAR</strong></div>
              </div>
            </>
          )}

          <div className="wiz-nav">
            {step > 0 && <button className="nrfq-btn-ghost" onClick={goBack}>Back</button>}
            <div style={{ flex: 1 }} />
            {step < STEPS.length - 1 ? (
              <button className="nrfq-btn-primary" onClick={goNext}>Next</button>
            ) : (
              <button className="nrfq-btn-primary" onClick={submit} disabled={saving}>{saving ? 'Sending…' : 'Send RFQ'}</button>
            )}
          </div>
        </div>

        <div className="wiz-side">
          <div className="wiz-summary">
            <div className="prd-section-title">Live Summary</div>
            <div className="wiz-summary-name">{title || 'Untitled RFQ'}</div>
            <div className="wiz-summary-ref">{selectedSuppliers.length} supplier{selectedSuppliers.length !== 1 ? 's' : ''} selected</div>
            <div className="wiz-summary-price">{untaxedAmount.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} <span>SAR</span></div>
            <div className="wiz-summary-row"><span>Items</span><strong>{items.length}</strong></div>
            <div className="wiz-summary-row"><span>Deadline</span><strong>{deadline ? new Date(deadline).toLocaleDateString() : '—'}</strong></div>
          </div>

          <div className="nrfq-chatter">
            <div className="nrfq-chatter-btns">
              <button onClick={() => showToast('Save the RFQ first')}>Send message</button>
              <button onClick={() => showToast('Save the RFQ first')}>Log note</button>
              <button onClick={() => showToast('Save the RFQ first')}>Activity</button>
            </div>
            <div className="nrfq-chatter-day">Today</div>
            <div className="nrfq-chatter-msg">
              <span className="nrfq-chatter-avatar">A</span>
              <div>
                <div className="nrfq-chatter-name">Abdulrahman <span>now</span></div>
                <div className="nrfq-chatter-text">Creating a new record…</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function NewVendorPage({ onCancel, onCreated, showToast }) {
  const [form, setForm] = useState({
    company_name: '', contact_name: '', email: '', phone: '',
    address_line1: '', address_line2: '', city: '', state: '', postal_code: '', country: '',
    tax_id: '', payment_terms_days: 30, currency: 'USD', bank_details: '', rating: '',
    is_preferred: false, notes: '',
  });
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const STEPS = ['Basics', 'Address', 'Terms', 'Review'];

  function validateStep(i) {
    if (i === 0 && !form.company_name.trim()) return 'Name is required.';
    if (i === 0 && !form.email.trim()) return 'Email is required.';
    return '';
  }
  function goNext() {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError('');
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  }
  function goBack() { setError(''); setStep(s => Math.max(s - 1, 0)); }

  async function submit() {
    if (!form.company_name.trim()) { setError('Name is required.'); setStep(0); return; }
    if (!form.email.trim()) { setError('Email is required.'); setStep(0); return; }

    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) { setError('Not authenticated. Please log in.'); return; }

      const payload = {
        ...form,
        company_name: form.company_name.trim(),
        email: form.email.trim(),
        contact_name: form.contact_name.trim() || null,
        phone: form.phone.trim() || null,
        address_line1: form.address_line1.trim() || null,
        address_line2: form.address_line2.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        postal_code: form.postal_code.trim() || null,
        country: form.country.trim() || null,
        tax_id: form.tax_id.trim() || null,
        payment_terms_days: Number(form.payment_terms_days) || 0,
        bank_details: form.bank_details.trim() || null,
        rating: form.rating === '' ? null : Number(form.rating),
        notes: form.notes.trim() || null,
      };

      const res = await fetch(`${API_BASE}/api/v1/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.detail || `Failed to create vendor (${res.status})`); return; }

      showToast('Vendor created successfully');
      onCreated();
    } catch (e) {
      setError(e.message || 'Failed to create vendor.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="nrfq-page">
      <div className="nrfq-actionbar">
        <button className="nrfq-btn-ghost" onClick={onCancel}>← Back to Vendors</button>
      </div>

      <div className="nrfq-breadcrumb"><span className="nrfq-crumb-link" onClick={onCancel}>Vendors</span> <span>/</span> New</div>

      {error && <div className="pur-form-error" style={{ color:'#ef4444', fontSize:'13px', margin:'0 0 12px', padding:'8px 12px', background:'#fef2f2', borderRadius:'6px', border:'1px solid #fecaca' }}>{error}</div>}

      <div className="wiz-progress">
        {STEPS.map((s, i) => (
          <div key={s} className={`wiz-step${i === step ? ' active' : ''}${i < step ? ' done' : ''}`} onClick={() => i < step && setStep(i)}>
            <span className="wiz-step-dot">{i < step ? '✓' : i + 1}</span>
            <span className="wiz-step-label">{s}</span>
            {i < STEPS.length - 1 && <span className="wiz-step-line" />}
          </div>
        ))}
      </div>

      <div className="nrfq-body">
        <div className="nrfq-form">
          {step === 0 && (
            <div className="vnd-form-top">
              <div className="vnd-logo-box">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#074E3B" strokeWidth="1.6"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input className="nrfq-title-input" type="text" placeholder="Name (company or person)" value={form.company_name} onChange={e => set('company_name', e.target.value)} />
                <div className="vnd-icon-lines">
                  <div className="vnd-icon-line">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="7" width="18" height="14" rx="1"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    <input type="text" placeholder="Contact Person" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
                  </div>
                  <div className="vnd-icon-line">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M22 6 12 13 2 6"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
                    <input type="email" placeholder="Email *" value={form.email} onChange={e => set('email', e.target.value)} />
                  </div>
                  <div className="vnd-icon-line">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    <input type="text" placeholder="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="nrfq-field-grid">
              <div className="nrfq-field-col">
                <div className="nrfq-field">
                  <input type="text" placeholder="Street…" value={form.address_line1} onChange={e => set('address_line1', e.target.value)} />
                </div>
                <div className="nrfq-field">
                  <input type="text" placeholder="Street 2…" value={form.address_line2} onChange={e => set('address_line2', e.target.value)} />
                </div>
                <div className="vnd-addr-row">
                  <input type="text" placeholder="City" value={form.city} onChange={e => set('city', e.target.value)} />
                  <input type="text" placeholder="State" value={form.state} onChange={e => set('state', e.target.value)} />
                  <input type="text" placeholder="ZIP" value={form.postal_code} onChange={e => set('postal_code', e.target.value)} />
                </div>
                <div className="nrfq-field">
                  <input type="text" placeholder="Country" value={form.country} onChange={e => set('country', e.target.value)} />
                </div>
              </div>
              <div className="nrfq-field-col">
                <div className="nrfq-field">
                  <label>Tax ID / VAT</label>
                  <input type="text" placeholder="not applicable" value={form.tax_id} onChange={e => set('tax_id', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="nrfq-field-grid">
              <div className="nrfq-field-col">
                <div className="nrfq-field">
                  <label>Payment Terms (days)</label>
                  <input type="number" min="0" max="365" value={form.payment_terms_days} onChange={e => set('payment_terms_days', e.target.value)} />
                </div>
                <div className="nrfq-field">
                  <label>Currency</label>
                  <select value={form.currency} onChange={e => set('currency', e.target.value)}>
                    <option value="USD">USD — US Dollar</option>
                    <option value="SAR">SAR — Saudi Riyal</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — British Pound</option>
                    <option value="AED">AED — UAE Dirham</option>
                  </select>
                </div>
                <div className="nrfq-field">
                  <label>Rating (0–5)</label>
                  <input type="number" min="0" max="5" step="0.1" placeholder="e.g. 4.5" value={form.rating} onChange={e => set('rating', e.target.value)} />
                </div>
              </div>
              <div className="nrfq-field-col">
                <div className="nrfq-field">
                  <label>Bank Details</label>
                  <textarea rows={3} placeholder="Bank name, IBAN, SWIFT…" value={form.bank_details} onChange={e => set('bank_details', e.target.value)} />
                </div>
                <div className="nrfq-field nrfq-field-checkbox">
                  <label>Preferred Vendor</label>
                  <input type="checkbox" checked={form.is_preferred} onChange={e => set('is_preferred', e.target.checked)} />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <>
              <div className="prd-section-title">Review</div>
              <div className="wiz-review-grid">
                <div><span>Name</span><strong>{form.company_name || '—'}</strong></div>
                <div><span>Contact Person</span><strong>{form.contact_name || '—'}</strong></div>
                <div><span>Email</span><strong>{form.email || '—'}</strong></div>
                <div><span>Phone</span><strong>{form.phone || '—'}</strong></div>
                <div><span>Address</span><strong>{[form.city, form.country].filter(Boolean).join(', ') || '—'}</strong></div>
                <div><span>Payment Terms</span><strong>Net {form.payment_terms_days || 0}</strong></div>
                <div><span>Currency</span><strong>{form.currency}</strong></div>
                <div><span>Preferred</span><strong>{form.is_preferred ? 'Yes' : 'No'}</strong></div>
              </div>
              <div className="nrfq-field" style={{ marginTop: '16px' }}>
                <label>Notes</label>
                <textarea rows={3} placeholder="Internal notes about this vendor…" value={form.notes} onChange={e => set('notes', e.target.value)} />
              </div>
            </>
          )}

          <div className="wiz-nav">
            {step > 0 && <button className="nrfq-btn-ghost" onClick={goBack}>Back</button>}
            <div style={{ flex: 1 }} />
            {step < STEPS.length - 1 ? (
              <button className="nrfq-btn-primary" onClick={goNext}>Next</button>
            ) : (
              <button className="nrfq-btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save Vendor'}</button>
            )}
          </div>
        </div>

        <div className="wiz-side">
          <div className="wiz-summary">
            <div className="prd-section-title">Live Summary</div>
            <div className="wiz-summary-name">{form.company_name || 'Untitled vendor'}</div>
            <div className="wiz-summary-ref">{form.email || 'No email yet'}</div>
            <div className="wiz-summary-row"><span>Phone</span><strong>{form.phone || '—'}</strong></div>
            <div className="wiz-summary-row"><span>Payment Terms</span><strong>Net {form.payment_terms_days || 0}</strong></div>
            <div className="wiz-summary-row"><span>Currency</span><strong>{form.currency}</strong></div>
            <div className="wiz-summary-row"><span>Preferred</span><strong>{form.is_preferred ? 'Yes' : 'No'}</strong></div>
          </div>

          <div className="nrfq-chatter">
            <div className="nrfq-chatter-btns">
              <button onClick={() => showToast('Save the vendor first')}>Send message</button>
              <button onClick={() => showToast('Save the vendor first')}>Log note</button>
              <button onClick={() => showToast('Save the vendor first')}>Activity</button>
            </div>
            <div className="nrfq-chatter-day">Today</div>
            <div className="nrfq-chatter-msg">
              <span className="nrfq-chatter-avatar">A</span>
              <div>
                <div className="nrfq-chatter-name">Abdulrahman <span>now</span></div>
                <div className="nrfq-chatter-text">Creating a new record…</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════ MAIN ═══════════════════════════ */
export default function Purchases({ goPage }) {
  const [activeNav, setActiveNav]   = useState('RFQs');
  const [modal, setModal]           = useState(null); // 'po'|'rfq'
  const [rfqPageOpen, setRfqPageOpen] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showNewVendor, setShowNewVendor] = useState(false);
  const [viewProduct, setViewProduct] = useState(null);
  const [rfqDetail, setRfqDetail]   = useState(null);
  const [toast, setToast]           = useState(null);
  const [search, setSearch]         = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [activeOnlyFilter, setActiveOnlyFilter] = useState(true);
  const [reportChartType, setReportChartType] = useState('bar');
  const [reportMeasure, setReportMeasure] = useState('Untaxed Total');
  const [reportMeasureOpen, setReportMeasureOpen] = useState(false);
  const [reportPOFilter, setReportPOFilter] = useState(true);
  const [report365Filter, setReport365Filter] = useState(true);
  const [reportHover, setReportHover] = useState(null);
  const [rfqs, setRfqs]             = useState([]);
  const [rfqsLoading, setRfqsLoading] = useState(true);
  const [purchaseOrders, setPurchaseOrders]           = useState([]);
  const [purchaseOrdersLoading, setPurchaseOrdersLoading] = useState(true);
  const [grns, setGrns]             = useState([]);
  const [grnsLoading, setGrnsLoading] = useState(true);
  const [invoices, setInvoices]     = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [creatingInvoiceFor, setCreatingInvoiceFor] = useState(new Set());
  const [createPOPrefill, setCreatePOPrefill] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);
  const [showGRNModal, setShowGRNModal] = useState(false);
  const [suppliers, setSuppliers]           = useState([]);
  const [products, setProducts]             = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productSearch, setProductSearch]   = useState('');
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [supplierFormFor, setSupplierFormFor] = useState(undefined); // undefined = closed, null = add, obj = edit
  const [supplierDetail, setSupplierDetail]   = useState(null);
  const [rfqKpis, setRfqKpis]               = useState(null);
  const [pricelists, setPricelists]         = useState([]);
  const [pricelistsLoading, setPricelistsLoading] = useState(true);
  const [showNewPricelist, setShowNewPricelist] = useState(false);
  const [editPricelist, setEditPricelist]   = useState(null);

  const fetchRFQs = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No token, skipping fetch');
      setRfqsLoading(false);
      return;
    }

    setRfqsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/rfqs`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }

      if (!res.ok) throw new Error(`RFQ fetch failed (${res.status})`);

      const data = await res.json();
      const raw = Array.isArray(data)          ? data
        : Array.isArray(data.data)             ? data.data
        : Array.isArray(data.items)            ? data.items
        : Array.isArray(data.results)          ? data.results
        : [];

      setRfqs(raw.map(r => {
        try { return mapApiRFQ(r); }
        catch (err) { console.error('Skipping malformed RFQ row:', r, err); return null; }
      }).filter(Boolean));
    } catch (err) {
      console.error('Failed to fetch RFQs:', err);
      setRfqs([]);
    } finally {
      setRfqsLoading(false);
    }
  }, []);

  const fetchPurchaseOrders = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { setPurchaseOrdersLoading(false); return; }
    setPurchaseOrdersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/purchase-orders`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; return; }
      if (!res.ok) throw new Error(`PO fetch failed (${res.status})`);
      const data = await res.json();
      const raw = data.items ?? (Array.isArray(data) ? data : data.results ?? []);
      setPurchaseOrders(raw);
    } catch (err) {
      console.error('Failed to fetch purchase orders:', err);
      setPurchaseOrders([]);
    } finally {
      setPurchaseOrdersLoading(false);
    }
  }, []);

  const fetchGRNs = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { setGrnsLoading(false); return; }
    setGrnsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/grn`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; return; }
      if (!res.ok) throw new Error(`GRN fetch failed (${res.status})`);
      const data = await res.json();
      const raw = data.items ?? (Array.isArray(data) ? data : data.results ?? []);
      setGrns(raw);
    } catch (err) {
      console.error('Failed to fetch GRNs:', err);
      setGrns([]);
    } finally {
      setGrnsLoading(false);
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { setInvoicesLoading(false); return; }
    setInvoicesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/purchase-invoices`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; return; }
      if (!res.ok) throw new Error(`Invoice fetch failed (${res.status})`);
      const data = await res.json();
      const raw = data.items ?? (Array.isArray(data) ? data : data.results ?? []);
      setInvoices(raw);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }, []);

  const fetchSuppliers = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { setSuppliersLoading(false); return; }
    setSuppliersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/suppliers?page_size=100`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; return; }
      if (!res.ok) throw new Error(`Supplier fetch failed (${res.status})`);
      const data = await res.json();
      setSuppliers(data.items ?? []);
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
      setSuppliers([]);
    } finally {
      setSuppliersLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { setProductsLoading(false); return; }
    setProductsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/inventory/items?limit=200`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; return; }
      if (!res.ok) throw new Error(`Products fetch failed (${res.status})`);
      const data = await res.json();
      setProducts(data.items ?? []);
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const fetchPricelists = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { setPricelistsLoading(false); return; }
    setPricelistsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/vendor-pricelists`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; return; }
      if (!res.ok) throw new Error(`Vendor pricelists fetch failed (${res.status})`);
      const data = await res.json();
      setPricelists(data.items ?? []);
    } catch (err) {
      console.error('Failed to fetch vendor pricelists:', err);
      setPricelists([]);
    } finally {
      setPricelistsLoading(false);
    }
  }, []);

  const fetchRfqKpis = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/rfqs/stats/kpis`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return;
      setRfqKpis(await res.json());
    } catch (err) {
      console.error('Failed to fetch RFQ KPIs:', err);
    }
  }, []);

  useEffect(() => { fetchRFQs(); fetchPurchaseOrders(); fetchGRNs(); fetchInvoices(); fetchSuppliers(); fetchProducts(); fetchRfqKpis(); fetchPricelists(); }, [fetchRFQs, fetchPurchaseOrders, fetchGRNs, fetchInvoices, fetchSuppliers, fetchProducts, fetchRfqKpis, fetchPricelists]);

  function showToast(msg) { setToast(msg); }

  function handleRFQAction(rfq) {
    if (rfq.action === 'Create PO') {
      setCreatePOPrefill({ supplier: 'TechSupply Co.', item: rfq.desc });
      setModal('po');
    } else {
      setRfqDetail(rfq);
    }
  }

  async function handleCreateInvoice(grn) {
    const token = localStorage.getItem('token');
    if (!token) { showToast('Not authenticated.'); return; }
    setCreatingInvoiceFor(prev => new Set(prev).add(grn.id));
    try {
      const res = await fetch(`${API_BASE}/api/v1/invoices/from-grn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ grn_id: grn.id }),
      });
      if (res.status === 409 || res.status === 400) {
        showToast('Invoice already exists for this GRN');
        await fetchInvoices();
        return;
      }
      if (!res.ok) throw new Error(`Failed to create invoice (${res.status})`);
      const created = await res.json();
      setInvoices(prev => [...prev, created]);
      showToast('Invoice created successfully');
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      setCreatingInvoiceFor(prev => { const s = new Set(prev); s.delete(grn.id); return s; });
    }
  }

  // Map grn_id → invoice for quick lookup in GRN table
  const grnInvoiceMap = new Map(invoices.map(inv => [inv.grn_id, inv]));

  const safeRfqs = Array.isArray(rfqs) ? rfqs : [];
  const filteredRFQs = safeRfqs.filter(r =>
    search === '' || r.desc.toLowerCase().includes(search.toLowerCase()) || r.num.toLowerCase().includes(search.toLowerCase())
  );

  const safePOs = Array.isArray(purchaseOrders) ? purchaseOrders : [];
  const rfqStats = {
    new:       safeRfqs.filter(r => r.status === 'Draft').length,
    sent:      safeRfqs.filter(r => r.status === 'Sent').length,
    late:      rfqKpis?.late ?? 0,
    notAck:    rfqKpis?.awaiting_evaluation ?? 0,
    lateReceipt: safePOs.filter(po => po.status?.toLowerCase() === 'partial').length,
  };
  const completedPOs = safePOs.filter(po => po.status?.toLowerCase() === 'completed').length;
  const otdPct       = safePOs.length ? Math.round((completedPOs / safePOs.length) * 100) : 0;
  const daysToOrder  = rfqKpis?.avg_days_to_po ?? 0;

  const PO_LIKE_STATUS = new Set(['Awarded', 'Closed']);
  const rfqTableRows = safeRfqs.map(r => ({
    key:        `rfq-${r.id}`,
    reference:  r.num,
    vendor:     '—',
    total:      null,
    currency:   r.est,
    deadline:   r.deadline,
    statusLabel: r.status,
    pillLabel:  PO_LIKE_STATUS.has(r.status) ? 'Purchase Order' : 'RFQ',
    pillCls:    PO_LIKE_STATUS.has(r.status) ? 'poq-po' : 'poq-rfq',
    sortDate:   r.deadline || r.createdAt || '',
    onOpen:     () => setRfqDetail(r),
  }));
  const poTableRows = safePOs.map(po => ({
    key:        `po-${po.id}`,
    reference:  po.id,
    vendor:     po.supplier_name ?? po.supplier?.company_name ?? po.supplier?.name ?? po.supplier_id ?? '—',
    total:      po.total_price ?? null,
    currency:   po.currency || 'USD',
    deadline:   null,
    statusLabel: po.status,
    pillLabel:  'Purchase Order',
    pillCls:    'poq-po',
    sortDate:   po.created_at || '',
    onOpen:     () => setSelectedPO(po),
  }));
  const combinedRows = [...rfqTableRows, ...poTableRows]
    .filter(row => search === '' ||
      (row.reference || '').toLowerCase().includes(search.toLowerCase()) ||
      (row.vendor || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.sortDate || 0) - new Date(a.sortDate || 0));
  const grandTotal = combinedRows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);

  const AVATAR_PALETTE = ['#074E3B', '#1d4ed8', '#15803d', '#b45309', '#be185d', '#0f766e'];
  function avatarColor(name) {
    const sum = [...(name || '?')].reduce((s, c) => s + c.charCodeAt(0), 0);
    return AVATAR_PALETTE[sum % AVATAR_PALETTE.length];
  }
  const visibleVendors = suppliers
    .filter(s => !activeOnlyFilter || s.is_active)
    .filter(s => vendorSearch === '' || s.company_name.toLowerCase().includes(vendorSearch.toLowerCase()));

  const visibleProducts = products.filter(p => {
    const name = p.description || p.part_number || '';
    return productSearch === '' || name.toLowerCase().includes(productSearch.toLowerCase());
  });

  const reportRows = combinedRows
    .filter(row => !reportPOFilter || row.pillCls === 'poq-po')
    .filter(row => {
      if (!report365Filter) return true;
      const d = new Date(row.sortDate || 0);
      if (isNaN(d.getTime())) return false;
      return (Date.now() - d.getTime()) <= 365 * 86400000;
    });
  const reportBuckets = (() => {
    const map = new Map();
    reportRows.forEach(row => {
      const d = new Date(row.sortDate || 0);
      const key = isNaN(d.getTime()) ? 'Undated' : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
      const prev = map.get(key) || { label: key, total: 0, count: 0 };
      prev.total += Number(row.total) || 0;
      prev.count += 1;
      map.set(key, prev);
    });
    return [...map.values()].sort((a, b) => new Date(a.label) - new Date(b.label));
  })();
  const reportPOCount  = reportRows.filter(r => r.pillCls === 'poq-po').length;
  const reportRFQCount = reportRows.filter(r => r.pillCls === 'poq-rfq').length;

  return (
    <div id="purchases-page">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      {modal === 'po'  && <CreatePOModal  onClose={() => { setModal(null); setCreatePOPrefill(null); }} onSave={showToast} prefill={createPOPrefill} />}
      {showGRNModal && <CreateGRNModal onClose={() => setShowGRNModal(false)} onSuccess={() => { fetchGRNs(); showToast('GRN created successfully'); }} />}
      {selectedPO && <PODetailModal po={selectedPO} onClose={() => setSelectedPO(null)} />}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onUpdated={updated => {
            setInvoices(prev => prev.map(inv => inv.id === updated.id ? updated : inv));
            setSelectedInvoice(updated);
          }}
        />
      )}
      {rfqDetail && <RFQDetailModal rfq={rfqDetail} onClose={() => setRfqDetail(null)} onSend={fetchRFQs} purchaseOrders={purchaseOrders} onPOCreated={fetchPurchaseOrders} />}

      <Sidebar
        activePage="purchases"
        goPage={goPage}
        subNavGroups={[
          {
            key: 'orders', label: 'Orders', children: [
              { label: 'Requests for Quotation', active: activeNav === 'RFQs',               onClick: () => { setRfqPageOpen(false); setActiveNav('RFQs'); } },
              { label: 'Purchase Orders',        active: activeNav === 'Purchase Orders',     onClick: () => { setRfqPageOpen(false); setActiveNav('Purchase Orders'); } },
              { label: 'Receipts / GRN',         active: activeNav === 'Receipts/GRN',        onClick: () => { setRfqPageOpen(false); setActiveNav('Receipts/GRN'); } },
              { label: 'Invoices',               active: activeNav === 'Invoices',            onClick: () => { setRfqPageOpen(false); setActiveNav('Invoices'); } },
              { label: 'Vendors',                active: activeNav === 'Suppliers Directory', onClick: () => { setRfqPageOpen(false); setActiveNav('Suppliers Directory'); } },
            ],
          },
          {
            key: 'products', label: 'Products', children: [
              { label: 'Products',         active: activeNav === 'Products', onClick: () => { setRfqPageOpen(false); setActiveNav('Products'); } },
              { label: 'Product Variants', onClick: () => showToast('Product variants coming soon') },
            ],
          },
          {
            key: 'reporting', label: 'Reporting', children: [
              { label: 'Purchase', active: activeNav === 'Reporting', onClick: () => { setRfqPageOpen(false); setActiveNav('Reporting'); } },
            ],
          },
          {
            key: 'config', label: 'Configuration', children: [
              { label: 'Settings',           onClick: () => showToast('Settings coming soon') },
              { label: 'Vendor Pricelists',  active: activeNav === 'Vendor Pricelists', onClick: () => { setRfqPageOpen(false); setActiveNav('Vendor Pricelists'); } },
              { label: 'Product Categories', onClick: () => showToast('Product categories coming soon') },
              { label: 'Units of Measure',   onClick: () => showToast('Units of measure coming soon') },
              { label: 'Packagings',         onClick: () => showToast('Packagings coming soon') },
            ],
          },
        ]}
      />
      <div className="db-main">
        <div className="tb">
          <div className="tb-title tb-title-block">
            <div>Purchases</div>
            <div className="tb-subtitle">Manage suppliers, track orders, and streamline procurement</div>
          </div>
          <div className="tb-right">
            <div className="tb-bell"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <div className="tb-user">
              <div className="tb-avatar" style={{ background: 'linear-gradient(135deg,#16a34a,#10b981)' }}>SJ</div>
              <div><div className="tb-uname">Sarah Johns</div><div className="tb-urole">Administrator</div></div>
            </div>
          </div>
        </div>
        <div className="pg">
          {rfqPageOpen ? (
            <NewRFQPage
              onCancel={() => setRfqPageOpen(false)}
              onCreated={() => { setRfqPageOpen(false); fetchRFQs(); }}
              showToast={showToast}
            />
          ) : showNewProduct ? (
            <NewProductPage
              suppliers={suppliers}
              onCancel={() => setShowNewProduct(false)}
              onCreated={() => { setShowNewProduct(false); fetchProducts(); }}
              showToast={showToast}
            />
          ) : viewProduct ? (
            <ProductDetailPage
              product={viewProduct}
              suppliers={suppliers}
              onCancel={() => setViewProduct(null)}
              onUpdated={() => { setViewProduct(null); fetchProducts(); }}
              showToast={showToast}
            />
          ) : showNewVendor ? (
            <NewVendorPage
              onCancel={() => setShowNewVendor(false)}
              onCreated={() => { setShowNewVendor(false); fetchSuppliers(); }}
              showToast={showToast}
            />
          ) : (showNewPricelist || editPricelist) ? (
            <VendorPricelistFormPage
              pricelist={editPricelist}
              suppliers={suppliers}
              products={products}
              onCancel={() => { setShowNewPricelist(false); setEditPricelist(null); }}
              onSaved={() => { setShowNewPricelist(false); setEditPricelist(null); fetchPricelists(); }}
              showToast={showToast}
            />
          ) : (
          <>
          {/* KPI Cards — only on the Requests for Quotation landing tab */}
          {activeNav === 'RFQs' && (
          <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {[
              { key:'new',    label:'New',               value:String(rfqStats.new),         icon:<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>, cls:'ic-g' },
              { key:'sent',   label:'RFQ Sent',           value:String(rfqStats.sent),        icon:<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>, cls:'ic-b' },
              { key:'late',   label:'Late RFQ',           value:String(rfqStats.late),        icon:<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, cls:'ic-o' },
              { key:'notack', label:'Not Acknowledged',   value:String(rfqStats.notAck),      icon:<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, cls:'ic-p' },
              { key:'lateRcv',label:'Late Receipt',       value:String(rfqStats.lateReceipt), icon:<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>, cls:'ic-o' },
              { key:'otd',    label:'OTD',                value:`${otdPct} %`,                icon:<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>, cls:'ic-g' },
              { key:'days',   label:'Days to Order',      value:Number(daysToOrder).toFixed(2), icon:<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, cls:'ic-b' },
            ].map(k => (
              <div key={k.key} className="kpi">
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-body">
                  <div className="kpi-value">{k.value}</div>
                  <div className={`kpi-icon ${k.cls}`}>{k.icon}</div>
                </div>
              </div>
            ))}
          </div>
          )}

          <div className="pur-right">
              {/* ── RFQs tab ── */}
              {activeNav === 'RFQs' && (
                <>
                  <div className="rfq-odoo-card">
                    {/* ── Toolbar: Create PO / Request Quote / breadcrumb / search / pagination / views ── */}
                    <div className="rfq-toolbar">
                      <div className="rfq-toolbar-btns">
                        <button className="btn-action btn-blue" onClick={() => setModal('po')}>
                          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Create PO
                        </button>
                        <button className="btn-action btn-purple" onClick={() => setRfqPageOpen(true)}>
                          <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Request Quote
                        </button>
                      </div>
                      <div className="rfq-breadcrumb">
                        Requests for Quotation
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                      </div>
                      <div className="rfq-toolbar-search">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
                      </div>
                      <div className="rfq-pagination">
                        <span>{combinedRows.length === 0 ? '0-0' : `1-${combinedRows.length}`} / {combinedRows.length}</span>
                        <button onClick={() => showToast('First page')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg></button>
                        <button onClick={() => showToast('Next page')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></button>
                      </div>
                      <div className="rfq-view-icons">
                        <button className="active" title="List"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></button>
                        <button title="Kanban" onClick={() => showToast('Kanban view coming soon')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="6" height="18" rx="1"/><rect x="15" y="3" width="6" height="10" rx="1"/></svg></button>
                        <button title="Pivot" onClick={() => showToast('Pivot view coming soon')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="9" x2="9" y2="21"/></svg></button>
                        <button title="Graph" onClick={() => showToast('Graph view coming soon')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></button>
                        <button title="Calendar" onClick={() => showToast('Calendar view coming soon')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></button>
                        <button title="Activity" onClick={() => showToast('Activity view coming soon')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></button>
                      </div>
                    </div>

                    {/* ── Table ── */}
                    <table className="rfq-odoo-table">
                      <thead>
                        <tr>
                          <th className="check"><input type="checkbox" onClick={e => e.stopPropagation()} /></th>
                          <th className="star"></th>
                          <th>Reference</th>
                          <th>Vendor</th>
                          <th>Buyer</th>
                          <th>Order Deadline</th>
                          <th className="center">Activities</th>
                          <th className="right">Total</th>
                          <th className="center">Status</th>
                          <th className="settings">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rfqsLoading || purchaseOrdersLoading ? (
                          <tr><td colSpan={10} style={{ padding:'16px', textAlign:'center', color:'#9ca3af', fontSize:'13.5px' }}>Loading…</td></tr>
                        ) : combinedRows.length === 0 ? (
                          <tr><td colSpan={10} style={{ padding:'16px', textAlign:'center', color:'#9ca3af', fontSize:'13.5px' }}>No requests for quotation match your search.</td></tr>
                        ) : combinedRows.map(row => {
                          const dl     = formatDeadline(row.deadline);
                          const isRfq  = row.pillCls === 'poq-rfq';
                          const linkClr = isRfq ? '#2563eb' : '#111827';
                          return (
                            <tr key={row.key} className="rfq-odoo-row" onClick={row.onOpen}>
                              <td className="check" onClick={e => e.stopPropagation()}><input type="checkbox" /></td>
                              <td className="star" onClick={e => e.stopPropagation()}>
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#c4c4c4" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                              </td>
                              <td style={{ color:linkClr, fontWeight:600 }}>{row.reference}</td>
                              <td>{row.vendor}</td>
                              <td>
                                <span className="rfq-buyer-avatar">A</span>
                                <span style={{ color:linkClr }}>Abdulrahman</span>
                              </td>
                              <td style={{ color: dl?.late ? '#b91c1c' : '#6b7280', fontSize:'13px' }}>{dl?.text ?? ''}</td>
                              <td className="center">
                                <button className="rfq-activity-btn" onClick={e => { e.stopPropagation(); showToast('Activity scheduling coming soon'); }} title="Schedule activity">
                                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                </button>
                              </td>
                              <td className="right">{row.total != null ? `${Number(row.total).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} ${row.currency}` : ''}</td>
                              <td className="center"><span className={`rfq-pill ${row.pillCls}`}>{row.pillLabel}</span></td>
                              <td className="settings"></td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {combinedRows.length > 0 && (
                        <tfoot>
                          <tr>
                            <td colSpan={7}></td>
                            <td className="right" style={{ fontWeight:600, color:'#111827' }}>
                              {grandTotal.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} {combinedRows[0]?.currency ?? 'SR'}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                </>
              )}

              {/* ── Purchase Orders tab ── */}
              {activeNav === 'Purchase Orders' && (
                <div className="pur-tab-card">
                  <div className="pur-tab-header">
                    <span className="pur-tab-title">Purchase Orders</span>
                    <button className="pur-btn-primary" style={{ height:'34px',padding:'0 14px',fontSize:'12.5px' }} onClick={() => setModal('po')}>+ New PO</button>
                  </div>
                  <table className="pur-table">
                    <thead><tr><th>PO Number</th><th>Supplier</th><th>RFQ</th><th className="center">Status</th><th>Created</th><th className="center">Action</th></tr></thead>
                    <tbody>
                      {purchaseOrdersLoading ? (
                        <tr><td colSpan={6} style={{ padding:'16px', textAlign:'center', color:'#9ca3af', fontSize:'13.5px' }}>Loading…</td></tr>
                      ) : purchaseOrders.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding:'16px', textAlign:'center', color:'#9ca3af', fontSize:'13.5px' }}>No Purchase Orders found</td></tr>
                      ) : purchaseOrders.map((po, i) => {
                        const supplierName = po.supplier_name ?? po.supplier?.company_name ?? po.supplier?.name ?? po.supplier_id ?? '—';
                        const status       = po.status ?? '—';
                        const statusCls    = status.toLowerCase() === 'completed' ? 'po-delivered'
                                           : status.toLowerCase() === 'partial'   ? 'po-pending'
                                           : status.toLowerCase() === 'approved'  ? 'po-approved'
                                           : status.toLowerCase() === 'delivered' ? 'po-delivered'
                                           : 'po-approved';
                        const createdAt    = po.created_at ? new Date(po.created_at).toLocaleDateString() : '—';
                        return (
                          <tr key={po.id ?? i} className="pur-table-row">
                            <td className="pur-ref">{po.id}</td>
                            <td>{supplierName}</td>
                            <td style={{ color:'#6b7280', fontSize:'13px' }}>{po.rfq_id ?? '—'}</td>
                            <td className="center"><span className={`pur-status-badge ${statusCls}`}>{status}</span></td>
                            <td style={{ color:'#6b7280', fontSize:'13px' }}>{createdAt}</td>
                            <td className="center">
                              <button className="pur-link-btn" onClick={() => setSelectedPO(po)}>View</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Receipts/GRN tab ── */}
              {activeNav === 'Receipts/GRN' && (
                <div className="pur-tab-card">
                  <div className="pur-tab-header">
                    <span className="pur-tab-title">Goods Receipt Notes</span>
                    <button className="pur-btn-secondary" style={{ height:'34px',padding:'0 14px',fontSize:'12.5px' }} onClick={() => setShowGRNModal(true)}>+ New GRN</button>
                  </div>
                  <table className="pur-table">
                    <thead><tr><th>GRN Number</th><th>PO Reference</th><th>Supplier</th><th>Date</th><th className="center">Received Qty</th><th className="center">Status</th><th className="center">Invoice</th></tr></thead>
                    <tbody>
                      {grnsLoading ? (
                        <tr><td colSpan={7} style={{ padding:'16px', textAlign:'center', color:'#9ca3af', fontSize:'13.5px' }}>Loading…</td></tr>
                      ) : grns.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding:'16px', textAlign:'center', color:'#9ca3af', fontSize:'13.5px' }}>No GRNs yet</td></tr>
                      ) : grns.map((grn, i) => {
                        const rawStatus = grn.status?.toLowerCase();
                        const status    = rawStatus === 'completed' ? 'Completed'
                                        : rawStatus === 'partial'   ? 'Partial'
                                        : rawStatus === 'created'   ? 'Created'
                                        : grn.received_quantity > 0 && grn.received_quantity >= (grn.total_quantity ?? grn.ordered_quantity ?? grn.received_quantity) ? 'Completed'
                                        : grn.received_quantity > 0 ? 'Partial'
                                        : 'Created';
                        const statusCls = status === 'Completed' ? 'po-delivered' : status === 'Partial' ? 'po-pending' : 'po-approved';
                        const date      = grn.created_at ? new Date(grn.created_at).toLocaleDateString() : '—';
                        const supplier  = grn.supplier_name ?? grn.supplier?.company_name ?? '—';
                        const existingInv  = grnInvoiceMap.get(grn.id);
                        const isCreating   = creatingInvoiceFor.has(grn.id);
                        const invStatus    = existingInv?.status?.toLowerCase() ?? '';
                        const invBadgeCls  = invStatus === 'paid' ? 'po-delivered' : invStatus === 'approved' ? 'rb-review' : 'rb-pending';
                        const invBadgeLbl  = invStatus === 'paid' ? 'Paid' : invStatus === 'approved' ? 'Approved' : 'Draft';
                        return (
                          <tr key={grn.id ?? i} className="pur-table-row">
                            <td className="pur-ref">{grn.id}</td>
                            <td style={{ color:'#2563eb', fontWeight:600 }}>{grn.po_id ?? '—'}</td>
                            <td>{supplier}</td>
                            <td style={{ color:'#6b7280', fontSize:'13px' }}>{date}</td>
                            <td className="center" style={{ fontWeight:600 }}>{grn.received_quantity ?? '—'}</td>
                            <td className="center"><span className={`pur-status-badge ${statusCls}`}>{status}</span></td>
                            <td className="center">
                              {existingInv ? (
                                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                                  <span className={`pur-status-badge ${invBadgeCls}`}>{invBadgeLbl}</span>
                                  {invStatus === 'paid' ? (
                                    <button className="pur-link-btn" disabled style={{ color:'#9ca3af', cursor:'not-allowed' }}>Paid</button>
                                  ) : (
                                    <button className="pur-link-btn" style={{ color:'#2563eb' }} onClick={() => setSelectedInvoice(existingInv)}>View Invoice</button>
                                  )}
                                </div>
                              ) : (
                                <button
                                  className="pur-link-btn"
                                  style={{ color:'#074E3B', fontWeight:600 }}
                                  onClick={() => handleCreateInvoice(grn)}
                                  disabled={isCreating}
                                >
                                  {isCreating ? 'Creating…' : '+ Invoice'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Invoices tab ── */}
              {activeNav === 'Invoices' && (
                <div className="pur-tab-card">
                  <div className="pur-tab-header">
                    <span className="pur-tab-title">Invoices</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {[
                        { label: 'All',      filter: null },
                        { label: 'Draft',    filter: 'draft' },
                        { label: 'Approved', filter: 'approved' },
                        { label: 'Paid',     filter: 'paid' },
                      ].map(({ label, filter }) => {
                        const count = filter ? invoices.filter(inv => inv.status?.toLowerCase() === filter).length : invoices.length;
                        return (
                          <span
                            key={label}
                            className={`pur-status-badge ${filter === 'paid' ? 'po-approved' : filter === 'approved' ? 'po-delivered' : filter === 'draft' ? 'po-pending' : ''}`}
                            style={{ cursor: 'default', fontSize: '12px' }}
                          >
                            {label} ({count})
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <table className="pur-table">
                    <thead>
                      <tr>
                        <th>Invoice ID</th>
                        <th>Supplier</th>
                        <th>PO ID</th>
                        <th>GRN ID</th>
                        <th className="center">Amount</th>
                        <th className="center">Status</th>
                        <th>Date</th>
                        <th className="center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoicesLoading ? (
                        <tr><td colSpan={8} style={{ padding:'16px', textAlign:'center', color:'#9ca3af', fontSize:'13.5px' }}>Loading…</td></tr>
                      ) : invoices.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ padding:'32px 16px', textAlign:'center' }}>
                            <div style={{ color:'#9ca3af', fontSize:'13.5px', marginBottom:'6px' }}>No invoices yet</div>
                            <div style={{ color:'#d1d5db', fontSize:'12.5px' }}>Create invoices from the Receipts/GRN tab</div>
                          </td>
                        </tr>
                      ) : invoices.map((inv, i) => {
                        const invStatus    = inv.status?.toLowerCase() ?? 'draft';
                        const statusLabel  = invStatus === 'paid' ? 'Paid' : invStatus === 'approved' ? 'Approved' : 'Draft';
                        const statusCls    = invStatus === 'paid' ? 'rb-completed' : invStatus === 'approved' ? 'rb-review' : 'rb-pending';
                        const amount       = Number(inv.total_amount ?? inv.amount ?? 0);
                        const supplier     = inv.supplier_name ?? inv.supplier?.company_name ?? '—';
                        const date         = inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—';
                        return (
                          <tr key={inv.id ?? i} className="pur-table-row">
                            <td className="pur-ref" style={{ fontSize:'12px' }}>{String(inv.id).slice(0,8)}…</td>
                            <td style={{ fontWeight: 500 }}>{supplier}</td>
                            <td style={{ color:'#6b7280', fontSize:'12px', maxWidth:'120px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inv.po_id ?? '—'}</td>
                            <td style={{ color:'#6b7280', fontSize:'12px', maxWidth:'120px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inv.grn_id ?? '—'}</td>
                            <td className="center" style={{ fontWeight: 700, color:'#111827' }}>
                              {amount > 0 ? `$${amount.toLocaleString()}` : '—'}
                            </td>
                            <td className="center">
                              <span className={`pur-status-badge ${statusCls}`}>{statusLabel}</span>
                            </td>
                            <td style={{ color:'#6b7280', fontSize:'13px' }}>{date}</td>
                            <td className="center">
                              <button className="pur-link-btn" onClick={() => setSelectedInvoice(inv)}>View</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Suppliers Directory tab ── */}
              {activeNav === 'Suppliers Directory' && (
                <div className="rfq-odoo-card">
                  <div className="rfq-toolbar">
                    <div className="rfq-toolbar-btns">
                      <button className="btn-action btn-purple" onClick={() => setShowNewVendor(true)}>
                        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New
                      </button>
                    </div>
                    <div className="rfq-breadcrumb">
                      Vendors
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    </div>
                    <div className="rfq-toolbar-search">
                      {activeOnlyFilter && (
                        <span className="vnd-filter-chip">
                          Active Vendors
                          <button onClick={() => setActiveOnlyFilter(false)}>
                            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </span>
                      )}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      <input type="text" placeholder="Search…" value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} />
                    </div>
                    <div className="rfq-pagination">
                      <span>{visibleVendors.length === 0 ? '0-0' : `1-${visibleVendors.length}`} / {suppliers.length}</span>
                      <button onClick={() => showToast('First page')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg></button>
                      <button onClick={() => showToast('Next page')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></button>
                    </div>
                    <div className="rfq-view-icons">
                      <button className="active" title="List"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></button>
                      <button title="Kanban" onClick={() => showToast('Kanban view coming soon')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="6" height="18" rx="1"/><rect x="15" y="3" width="6" height="10" rx="1"/></svg></button>
                    </div>
                  </div>

                  <table className="rfq-odoo-table">
                    <thead>
                      <tr>
                        <th className="check"><input type="checkbox" onClick={e => e.stopPropagation()} /></th>
                        <th></th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th className="center">Activities</th>
                        <th>Country</th>
                        <th>Payment Terms</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppliersLoading ? (
                        <tr><td colSpan={8} style={{ padding:'16px', textAlign:'center', color:'#9ca3af', fontSize:'13.5px' }}>Loading…</td></tr>
                      ) : visibleVendors.length === 0 ? (
                        <tr><td colSpan={8} style={{ padding:'16px', textAlign:'center', color:'#9ca3af', fontSize:'13.5px' }}>No vendors match your search.</td></tr>
                      ) : visibleVendors.map(s => (
                        <tr key={s.id} className="rfq-odoo-row" onClick={() => setSupplierDetail(s)} style={{ opacity: s.is_active ? 1 : 0.55 }}>
                          <td className="check" onClick={e => e.stopPropagation()}><input type="checkbox" /></td>
                          <td><span className="vnd-avatar" style={{ background: avatarColor(s.company_name) }}>{s.company_name?.[0]?.toUpperCase() ?? '?'}</span></td>
                          <td style={{ fontWeight: 600, color: '#111827' }}>{s.company_name}</td>
                          <td style={{ color: '#374151' }}>{s.email || ''}</td>
                          <td style={{ color: '#374151' }}>{s.phone || ''}</td>
                          <td className="center">
                            <button className="rfq-activity-btn" onClick={e => { e.stopPropagation(); showToast('Activity scheduling coming soon'); }} title="Schedule activity">
                              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            </button>
                          </td>
                          <td style={{ color: '#6b7280', fontSize: '13px' }}>{s.country || ''}</td>
                          <td style={{ color: '#6b7280', fontSize: '13px' }}>{s.payment_terms_days ? `Net ${s.payment_terms_days}` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Products (kanban) ── */}
              {activeNav === 'Products' && (
                <div className="rfq-odoo-card">
                  <div className="rfq-toolbar">
                    <div className="rfq-toolbar-btns">
                      <button className="btn-action btn-purple" onClick={() => setShowNewProduct(true)}>
                        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New
                      </button>
                    </div>
                    <div className="rfq-breadcrumb">
                      Products
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    </div>
                    <div className="rfq-toolbar-search">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      <input type="text" placeholder="Search…" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                    </div>
                    <div className="rfq-pagination">
                      <span>{visibleProducts.length === 0 ? '0-0' : `1-${visibleProducts.length}`} / {products.length}</span>
                      <button onClick={() => showToast('First page')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg></button>
                      <button onClick={() => showToast('Next page')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></button>
                    </div>
                    <div className="rfq-view-icons">
                      <button className="active" title="Kanban"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="6" height="18" rx="1"/><rect x="15" y="3" width="6" height="10" rx="1"/></svg></button>
                      <button title="List" onClick={() => showToast('List view coming soon')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></button>
                    </div>
                  </div>

                  <div className="prd-kanban">
                    {productsLoading ? (
                      <div className="prd-empty">Loading…</div>
                    ) : visibleProducts.length === 0 ? (
                      <div className="prd-empty">No products match your search.</div>
                    ) : visibleProducts.map((p, i) => {
                      const stockQty = Number(p.stock_qty ?? 0);
                      const inStock  = stockQty > 0;
                      const accents  = ['#074E3B', '#1d4ed8', '#15803d', '#b45309'];
                      return (
                        <div key={p.id} className="prd-card" style={{ borderLeftColor: accents[i % accents.length] }} onClick={() => setViewProduct(p)}>
                          <div className="prd-card-icon" style={{ background: `${accents[i % accents.length]}15`, color: accents[i % accents.length] }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                          </div>
                          <div className="prd-card-title">{p.description || p.part_number || 'Unnamed product'}</div>
                          <div className="prd-card-price">{p.unit_price != null ? Number(p.unit_price).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : '0.00'} <span>SAR</span></div>
                          <div className="prd-card-footer">
                            <span className={`prd-stock-pill${inStock ? '' : ' out'}`}>{inStock ? 'In Stock' : 'Out of Stock'}</span>
                            <span className="prd-stock-qty">{stockQty.toFixed(2)} units</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Vendor Pricelists ── */}
              {activeNav === 'Vendor Pricelists' && (
                <div className="pur-tab-card">
                  <div className="pur-tab-header">
                    <span className="pur-tab-title">Vendor Pricelists</span>
                    <button className="pur-btn-primary" style={{ height:'34px',padding:'0 14px',fontSize:'12.5px' }} onClick={() => setShowNewPricelist(true)}>+ New</button>
                  </div>
                  <table className="pur-table">
                    <thead><tr><th>Vendor</th><th>Product</th><th className="center">Quantity</th><th className="center">Unit Price</th><th className="center">Discount</th><th className="center">Lead Time</th><th>Validity</th><th className="center">Action</th></tr></thead>
                    <tbody>
                      {pricelistsLoading ? (
                        <tr><td colSpan={8} style={{ padding:'16px', textAlign:'center', color:'#9ca3af', fontSize:'13.5px' }}>Loading…</td></tr>
                      ) : pricelists.length === 0 ? (
                        <tr><td colSpan={8} style={{ padding:'16px', textAlign:'center', color:'#9ca3af', fontSize:'13.5px' }}>No vendor pricelists yet</td></tr>
                      ) : pricelists.map(pl => {
                        const validity = pl.valid_from || pl.valid_to
                          ? `${pl.valid_from ?? '…'} → ${pl.valid_to ?? '…'}`
                          : '—';
                        return (
                          <tr key={pl.id} className="pur-table-row">
                            <td>{pl.supplier_name ?? '—'}</td>
                            <td style={{ color:'#6b7280', fontSize:'13px' }}>{pl.product_name ?? pl.vendor_product_name ?? '—'}</td>
                            <td className="center">{Number(pl.quantity).toFixed(2)}</td>
                            <td className="center">{Number(pl.unit_price).toFixed(2)}</td>
                            <td className="center">{Number(pl.discount_pct).toFixed(2)}%</td>
                            <td className="center">{pl.lead_time_days} day{pl.lead_time_days === 1 ? '' : 's'}</td>
                            <td style={{ color:'#6b7280', fontSize:'13px' }}>{validity}</td>
                            <td className="center">
                              <button className="pur-link-btn" onClick={() => setEditPricelist(pl)}>Edit</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Reporting (Purchase Analysis) ── */}
              {activeNav === 'Reporting' && (
                <div className="rfq-odoo-card">
                  <div className="rfq-toolbar">
                    <div className="rfq-breadcrumb">
                      Purchase Analysis
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    </div>
                    <div className="rfq-toolbar-search">
                      {reportPOFilter && (
                        <span className="vnd-filter-chip">
                          Purchase Orders
                          <button onClick={() => setReportPOFilter(false)}>
                            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </span>
                      )}
                      {report365Filter && (
                        <span className="vnd-filter-chip">
                          Order Deadline: Last 365 Days
                          <button onClick={() => setReport365Filter(false)}>
                            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </span>
                      )}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      <input type="text" placeholder="Search…" />
                    </div>
                    <div className="rfq-view-icons">
                      <button className="active" title="Graph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></button>
                      <button title="Pivot" onClick={() => showToast('Pivot view coming soon')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="9" x2="9" y2="21"/></svg></button>
                    </div>
                  </div>

                  <div className="rpt-toolbar2">
                    <div className="rpt-measure-wrap">
                      <button className="rpt-measure-btn" onClick={() => setReportMeasureOpen(p => !p)}>
                        {reportMeasure}
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                      {reportMeasureOpen && (
                        <div className="pur-segment-menu" onMouseLeave={() => setReportMeasureOpen(false)}>
                          {['Untaxed Total', 'Count'].map(m => (
                            <div key={m} className="pur-segment-menu-item" onClick={() => { setReportMeasure(m); setReportMeasureOpen(false); }}>{m}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button className="rpt-spreadsheet-btn" onClick={() => showToast('Insert in Spreadsheet coming soon')}>Insert in Spreadsheet</button>
                    <div className="rpt-icon-group">
                      <button className={reportChartType === 'bar' ? 'active' : ''} title="Bar chart" onClick={() => setReportChartType('bar')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg></button>
                      <button className={reportChartType === 'line' ? 'active' : ''} title="Line chart" onClick={() => setReportChartType('line')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 17 9 11 13 15 21 6"/></svg></button>
                      <button className={reportChartType === 'pie' ? 'active' : ''} title="Pie chart" onClick={() => setReportChartType('pie')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg></button>
                    </div>
                  </div>

                  <div className="rpt-chart-area">
                    {reportBuckets.length === 0 ? (
                      <div className="prd-empty">No data in the selected range.</div>
                    ) : reportChartType === 'pie' ? (
                      <AnalysisPieChart slices={[
                        { label: 'Purchase Orders', value: reportPOCount, color: '#074E3B' },
                        { label: 'RFQs',             value: reportRFQCount, color: '#1d4ed8' },
                      ]} />
                    ) : (
                      <AnalysisBarLineChart
                        buckets={reportBuckets}
                        measure={reportMeasure === 'Count' ? 'count' : 'total'}
                        type={reportChartType}
                        hover={reportHover}
                        setHover={setReportHover}
                      />
                    )}
                  </div>
                </div>
              )}
          </div>
          </>
          )}
        </div>
      </div>

      {supplierFormFor !== undefined && (
        <SupplierFormModal
          supplier={supplierFormFor}
          onClose={() => setSupplierFormFor(undefined)}
          onSaved={() => { fetchSuppliers(); showToast(supplierFormFor ? 'Supplier updated' : 'Supplier added'); }}
          showToast={showToast}
        />
      )}
      {supplierDetail && (
        <SupplierDetailModal
          supplier={supplierDetail}
          onClose={() => setSupplierDetail(null)}
          onEdit={(s) => { setSupplierDetail(null); setSupplierFormFor(s); }}
          onDeactivated={() => fetchSuppliers()}
          showToast={showToast}
        />
      )}
    </div>
  );
}
