import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import '../styles/Purchases.css';

/* ─── Shared helpers ─── */
function Toast({ msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 2800); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="pur-toast">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      {msg}
    </div>
  );
}

function Modal({ title, onClose, width, children }) {
  return (
    <div className="pur-modal-overlay" onClick={onClose}>
      <div className="pur-modal" style={{ width: width || 480 }} onClick={e => e.stopPropagation()}>
        <div className="pur-modal-header">
          <span className="pur-modal-title">{title}</span>
          <button className="pur-modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="pur-modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ─── API response → display shape ─── */
const STATUS_BADGE = { DRAFT:'rb-pending', SENT:'rb-review', RECEIVED:'rb-review', EVALUATED:'rb-review', CLOSED:'rb-completed', CANCELLED:'rb-cancelled' };
const STATUS_ACTION = {
  DRAFT:     { label:'Send RFQ',      cls:'blue' },
  SENT:      { label:'View Details',  cls:'blue' },
  RECEIVED:  { label:'Review Quotes', cls:'blue' },
  EVALUATED: { label:'Create PO',     cls:'green' },
  CLOSED:    { label:'View Details',  cls:'blue' },
  CANCELLED: { label:'View Details',  cls:'blue' },
};
function mapApiRFQ(r) {
  const act = STATUS_ACTION[r.status] || { label:'View Details', cls:'blue' };
  return {
    id:        r.id,
    num:       r.rfq_number,
    status:    r.status.charAt(0) + r.status.slice(1).toLowerCase(),
    badgeCls:  STATUS_BADGE[r.status] || 'rb-pending',
    est:       r.currency || 'USD',
    desc:      r.title + (r.description ? ` — ${r.description}` : ''),
    dates:     r.deadline ? `Deadline: ${r.deadline}` : `Created: ${new Date(r.created_at).toLocaleDateString()}`,
    suppliers: `${r.item_count} item${r.item_count !== 1 ? 's' : ''}`,
    responses: '0 responses',
    action:    act.label,
    actionCls: act.cls,
  };
}

/* ─── Create PO Modal ─── */
function CreatePOModal({ onClose, onSave, prefill }) {
  const [form, setForm] = useState({
    supplier: prefill?.supplier || '', item: prefill?.item || '', qty: '', price: '', delivery: '', notes: ''
  });
  const [saved, setSaved] = useState(false);
  function save() {
    if (!form.supplier || !form.item) return;
    setSaved(true);
    setTimeout(() => { onSave(`PO created for ${form.supplier}`); onClose(); }, 900);
  }
  const total = form.qty && form.price ? `$${(parseFloat(form.qty) * parseFloat(form.price)).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';
  return (
    <Modal title="Create Purchase Order" onClose={onClose}>
      {saved ? (
        <div className="pur-success">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div>Purchase Order created!</div>
        </div>
      ) : (
        <>
          <div className="pur-form-group">
            <label>Supplier *</label>
            <select value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}>
              <option value="">Select supplier…</option>
              <option>TechSupply Co.</option><option>GlobalPrint Inc.</option><option>OfficePlus Ltd.</option><option>DataTech Systems</option>
            </select>
          </div>
          <div className="pur-form-group">
            <label>Item / Description *</label>
            <input type="text" placeholder="e.g. Laptops x 10 units" value={form.item} onChange={e => setForm({ ...form, item: e.target.value })}/>
          </div>
          <div className="pur-form-grid">
            <div className="pur-form-group">
              <label>Quantity</label>
              <input type="number" placeholder="0" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })}/>
            </div>
            <div className="pur-form-group">
              <label>Unit Price (USD)</label>
              <input type="number" placeholder="0.00" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}/>
            </div>
          </div>
          {form.qty && form.price && (
            <div className="pur-total-row">Total: <strong>{total}</strong></div>
          )}
          <div className="pur-form-group">
            <label>Expected Delivery</label>
            <input type="date" value={form.delivery} onChange={e => setForm({ ...form, delivery: e.target.value })}/>
          </div>
          <div className="pur-form-group">
            <label>Notes</label>
            <input type="text" placeholder="Special instructions…" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/>
          </div>
          <div className="pur-modal-actions">
            <button className="pur-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="pur-btn-primary" onClick={save}>Create PO</button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ─── Create RFQ Modal ─── */
function CreateRFQModal({ onClose, onSuccess }) {
  const [form, setForm]                   = useState({ title: '', description: '', deadline: '' });
  const [items, setItems]                 = useState([{ product_name: '', quantity: 1, unit_of_measure: 'unit' }]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading]   = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setSuppliersLoading(false); return; }
    fetch('/api/v1/suppliers/', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : Promise.reject(res.status))
      .then(data => {
        console.log('Suppliers API:', data);
        const raw = data.items ?? data.results ?? (Array.isArray(data) ? data : []);
        setSuppliersList(raw);
      })
      .catch(() => setSuppliersList([]))
      .finally(() => setSuppliersLoading(false));
  }, []);

  function toggleSupplier(id) {
    setSelectedSuppliers(prev => {
      const next = prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id];
      console.log('Selected Suppliers:', next);
      return next;
    });
  }

  function updateItem(index, field, value) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  function addItem() {
    setItems(prev => [...prev, { product_name: '', quantity: 1, unit_of_measure: 'unit' }]);
  }

  function removeItem(index) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    if (selectedSuppliers.length === 0) { setError('Please select at least one supplier.'); return; }
    const invalidItem = items.find(it => !it.product_name.trim());
    if (invalidItem) { setError('All items must have a product name.'); return; }
    const badQty = items.find(it => Number(it.quantity) <= 0);
    if (badQty) { setError('All item quantities must be greater than 0.'); return; }

    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) { setError('Not authenticated. Please log in.'); return; }

      const payload = {
        title: form.title.trim(),
        ...(form.description.trim() && { description: form.description.trim() }),
        ...(form.deadline && { deadline: form.deadline }),
        currency: 'USD',
        supplier_ids: selectedSuppliers,
        items: items.map(it => ({
          product_name:    it.product_name.trim(),
          quantity:        Number(it.quantity),
          unit_of_measure: it.unit_of_measure.trim() || 'unit',
        })),
      };
      console.log('RFQ Payload:', payload);

      const res = await fetch('/api/v1/rfqs/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      console.log('Create RFQ response status:', res.status);
      const data = await res.json();
      console.log('Create RFQ response:', data);

      if (res.status !== 201) {
        setError(data.detail || `Failed to create RFQ (${res.status})`);
        return;
      }

      setSaved(true);
      setTimeout(() => { onSuccess(); onClose(); }, 900);
    } catch (e) {
      setError(e.message || 'Failed to create RFQ.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Request for Quotation (RFQ)" onClose={onClose}>
      {saved ? (
        <div className="pur-success">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div>RFQ created successfully!</div>
        </div>
      ) : (
        <>
          {error && <div className="pur-form-error" style={{ color:'#ef4444', fontSize:'13px', marginBottom:'12px', padding:'8px 12px', background:'#fef2f2', borderRadius:'6px', border:'1px solid #fecaca' }}>{error}</div>}

          <div className="pur-form-group">
            <label>Title *</label>
            <input type="text" placeholder="e.g. Office Chairs — Q2 2025" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/>
          </div>
          <div className="pur-form-group">
            <label>Description</label>
            <textarea rows={3} placeholder="Describe what you need…" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ width:'100%', resize:'vertical', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:'6px', fontSize:'13.5px', fontFamily:'inherit' }}/>
          </div>
          <div className="pur-form-group">
            <label>Suppliers *</label>
            <div style={{ border:'1px solid #e5e7eb', borderRadius:'8px', maxHeight:'160px', overflowY:'auto', background:'#fff' }}>
              {suppliersLoading ? (
                <div style={{ padding:'12px 14px', fontSize:'13px', color:'#9ca3af' }}>Loading suppliers…</div>
              ) : suppliersList.length === 0 ? (
                <div style={{ padding:'12px 14px', fontSize:'13px', color:'#9ca3af' }}>No suppliers available.</div>
              ) : suppliersList.map((s, i) => {
                const checked = selectedSuppliers.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => toggleSupplier(s.id)}
                    style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 14px', borderBottom: i < suppliersList.length - 1 ? '1px solid #f3f4f6' : 'none', cursor:'pointer', background: checked ? '#eff6ff' : 'transparent', transition:'background 0.1s', userSelect:'none' }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      onClick={e => e.stopPropagation()}
                      style={{ accentColor:'#2563eb', width:'15px', height:'15px', flexShrink:0, pointerEvents:'none' }}
                    />
                    <div>
                      <div style={{ fontSize:'13.5px', fontWeight: checked ? 600 : 400, color:'#111827' }}>{s.company_name}</div>
                      {s.category && <div style={{ fontSize:'11.5px', color:'#9ca3af' }}>{s.category}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            {selectedSuppliers.length > 0 && (
              <div style={{ fontSize:'12px', color:'#6b7280', marginTop:'5px' }}>{selectedSuppliers.length} supplier{selectedSuppliers.length !== 1 ? 's' : ''} selected</div>
            )}
          </div>
          <div className="pur-form-group">
            <label>Deadline</label>
            <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })}/>
          </div>

          {/* Items */}
          <div className="pur-form-group">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
              <label style={{ margin:0 }}>Items *</label>
              <button onClick={addItem} style={{ display:'flex', alignItems:'center', gap:'4px', background:'none', border:'1px solid #d1d5db', borderRadius:'6px', padding:'4px 10px', fontSize:'12.5px', color:'#374151', cursor:'pointer' }}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Item
              </button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {items.map((item, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 72px 90px auto', gap:'6px', alignItems:'center', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'10px 12px' }}>
                  <input
                    type="text"
                    placeholder="Product name"
                    value={item.product_name}
                    onChange={e => updateItem(i, 'product_name', e.target.value)}
                    style={{ padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:'6px', fontSize:'13px', fontFamily:'inherit', outline:'none' }}
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={e => updateItem(i, 'quantity', e.target.value)}
                    style={{ padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:'6px', fontSize:'13px', fontFamily:'inherit', outline:'none', width:'100%' }}
                  />
                  <input
                    type="text"
                    placeholder="Unit"
                    value={item.unit_of_measure}
                    onChange={e => updateItem(i, 'unit_of_measure', e.target.value)}
                    style={{ padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:'6px', fontSize:'13px', fontFamily:'inherit', outline:'none', width:'100%' }}
                  />
                  <button
                    onClick={() => removeItem(i)}
                    disabled={items.length === 1}
                    style={{ background:'none', border:'none', color: items.length === 1 ? '#d1d5db' : '#ef4444', cursor: items.length === 1 ? 'not-allowed' : 'pointer', padding:'4px', display:'flex', alignItems:'center' }}
                    title="Remove item"
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pur-modal-actions">
            <button className="pur-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="pur-btn-primary" onClick={submit} disabled={loading || !form.title.trim()}>
              {loading ? 'Creating…' : 'Create RFQ'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ─── RFQ Detail Modal ─── */
function RFQDetailModal({ rfq, onClose, onSend }) {
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
  const [creatingPO,   setCreatingPO]   = useState(false);
  const [poCreated,    setPoCreated]    = useState(!!rfq.has_po);
  const [poError,      setPoError]      = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    console.log('Token:', token);
    console.log('Fetching RFQ ID:', rfq.id);
    if (!token) { setError('Not authenticated.'); setLoading(false); return; }
    fetch(`/api/v1/rfqs/${rfq.id}/`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load RFQ (${res.status})`);
        return res.json();
      })
      .then(data => {
        console.log('RFQ DETAILS:', data);
        setDetail(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));

    // Fetch quotations
    fetch(`/api/v1/rfqs/${rfq.id}/quotations`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const raw = Array.isArray(data) ? data : data.items ?? data.results ?? [];
        setQuotations(raw);
      })
      .catch(() => setQuotations([]))
      .finally(() => setQuotationsLoading(false));
  }, [rfq.id]);

  async function handleSendRFQ() {
    const token = localStorage.getItem('token');
    if (!token) { setError('Not authenticated.'); return; }
    setSending(true);
    try {
      const res = await fetch(`/api/v1/rfqs/${rfq.id}/send/`, {
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

  async function handleSelectWinner(supplierId, supplierName) {
    const token = localStorage.getItem('token');
    const rfqId = rfq.id;
    console.log('RFQ ID:', rfqId);
    console.log('Supplier ID:', supplierId);
    if (!token) { setSelectError('Not authenticated.'); return; }
    setSelectingId(supplierId);
    setSelectError('');
    try {
      const res = await fetch(`/api/v1/rfqs/${rfqId}/select-supplier`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ supplier_id: supplierId }),
      });
      if (!res.ok) throw new Error(`Failed to select supplier (${res.status})`);
      setSelectedSupplierId(supplierId);
      setSelectedSupplierName(supplierName);
    } catch (err) {
      setSelectError(err.message);
    } finally {
      setSelectingId(null);
    }
  }

  async function handleCreatePO() {
    if (poCreated || creatingPO) return;
    const token = localStorage.getItem('token');
    if (!token) { setPoError('Not authenticated.'); return; }
    setCreatingPO(true);
    setPoError('');
    try {
      const res = await fetch('/api/v1/purchase-orders/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ rfq_id: rfq.id, supplier_id: selectedSupplierId }),
      });
      if (res.status === 409) { setPoCreated(true); return; }
      if (!res.ok) throw new Error(`Failed to create PO (${res.status})`);
      setPoCreated(true);
    } catch (err) {
      setPoError(err.message);
    } finally {
      setCreatingPO(false);
    }
  }

  const currentStatus = localStatus ?? detail?.status;
  console.log('RFQ status:', currentStatus);
  const statusCls = localStatus ? 'rb-review' : rfq.badgeCls;

  return (
    <Modal title={`${rfq.num} — Details`} onClose={onClose}>
      {loading && <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13.5px' }}>Loading…</div>}
      {error   && <div style={{ padding: '12px', color: '#b91c1c', fontSize: '13px', background: '#fef2f2', borderRadius: '8px' }}>{error}</div>}
      {detail && <>
        <div className="pur-detail-row"><span>RFQ Number</span><strong>{detail.rfq_number}</strong></div>
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
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Quotations</div>
          {selectedSupplierName && (
            <div style={{ marginBottom: '8px', padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#15803d', fontSize: '13px' }}>
              Selected Supplier: <strong>{selectedSupplierName}</strong>
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
              const supplierId   = q.supplier.id;
              const supplierName = q.supplier.company_name ?? 'Unknown Supplier';
              const isSelected   = selectedSupplierId === supplierId;
              const isInFlight   = selectingId === supplierId;
              const isDisabled   = !!selectedSupplierId || isInFlight;
              return (
                <div key={q.id ?? i} style={{ padding: '12px 14px', borderBottom: i < quotations.length - 1 ? '1px solid #f3f4f6' : 'none', fontSize: '13.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{supplierName}</span>
                    <span style={{ fontWeight: 700, color: '#2563eb' }}>${Number(q.price ?? q.total_price ?? 0).toLocaleString()}</span>
                  </div>
                  {q.notes && <div style={{ fontSize: '12.5px', color: '#6b7280', marginBottom: '6px' }}>{q.notes}</div>}
                  {isSelected ? (
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#15803d' }}>✓ Winner</span>
                  ) : (
                    <button
                      onClick={() => handleSelectWinner(supplierId, supplierName)}
                      disabled={isDisabled}
                      style={{ fontSize: '12px', padding: '3px 10px', cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.45 : 1 }}
                    >
                      {isInFlight ? 'Selecting…' : 'Select Winner'}
                    </button>
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
        {currentStatus?.toLowerCase() === 'awarded' && (
          <button className="pur-btn-primary" onClick={handleCreatePO} disabled={creatingPO || poCreated}>
            {creatingPO ? 'Creating…' : poCreated ? 'PO Created' : 'Create PO'}
          </button>
        )}
        {rfq.status === 'In Review' && <button className="pur-btn-primary" onClick={onClose}>Approve Quotes</button>}
        {rfq.status === 'Pending'   && <button className="pur-btn-primary" onClick={onClose}>Send Reminders</button>}
      </div>
    </Modal>
  );
}

/* ─── KPI drawer ─── */
const KPI_DETAILS = {
  orders:    { title: 'Orders by Status',         rows: [{ label:'Delivered', value:'258', color:'#16a34a' }, { label:'In Transit', value:'41', color:'#3b82f6' }, { label:'Processing', value:'25', color:'#f59e0b' }], note: '12% increase vs last month.' },
  approval:  { title: 'Pending Approval Breakdown', rows: [{ label:'POs > $10K', value:'8', color:'#ef4444' }, { label:'POs $1K–$10K', value:'7', color:'#f59e0b' }, { label:'POs < $1K', value:'3', color:'#16a34a' }], note: 'Oldest pending: 3 days. Action required.' },
  spend:     { title: 'Spend by Category',          rows: [{ label:'IT Equipment', value:'$940K', color:'#2563eb' }, { label:'Office Supplies', value:'$620K', color:'#7c3aed' }, { label:'Services', value:'$840K', color:'#10b981' }], note: 'YTD spend tracking 8% above forecast.' },
  suppliers: { title: 'Suppliers by Tier',          rows: [{ label:'Preferred', value:'28', color:'#16a34a' }, { label:'Approved', value:'94', color:'#3b82f6' }, { label:'New', value:'34', color:'#f59e0b' }], note: '3 new suppliers onboarded this month.' },
};

function KpiDrawer({ type, onClose }) {
  const d = KPI_DETAILS[type]; if (!d) return null;
  return (
    <div className="kpi-drawer" onClick={e => e.stopPropagation()}>
      <div className="kpi-drawer-header">
        <span className="kpi-drawer-title">{d.title}</span>
        <button className="kpi-drawer-close" onClick={onClose}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      {d.rows.map(r => (
        <div key={r.label} className="kpi-drawer-row">
          <div className="kpi-drawer-dot" style={{ background: r.color }}></div>
          <span className="kpi-drawer-label">{r.label}</span>
          <span className="kpi-drawer-val">{r.value}</span>
        </div>
      ))}
      <div className="kpi-drawer-note">{d.note}</div>
    </div>
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


/* ═══════════════════════════ MAIN ═══════════════════════════ */
export default function Purchases({ goPage }) {
  const [activeNav, setActiveNav]   = useState('RFQs');
  const [modal, setModal]           = useState(null); // 'po'|'rfq'
  const [rfqDetail, setRfqDetail]   = useState(null);
  const [openKpi, setOpenKpi]       = useState(null);
  const [toast, setToast]           = useState(null);
  const [search, setSearch]         = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [rfqs, setRfqs]             = useState([]);
  const [rfqsLoading, setRfqsLoading] = useState(true);
  const [createPOPrefill, setCreatePOPrefill] = useState(null);

  const fetchRFQs = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No token, skipping fetch');
      setRfqsLoading(false);
      return;
    }

    setRfqsLoading(true);
    try {
      const res = await fetch('/api/v1/rfqs/', {
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

      setRfqs(raw.map(mapApiRFQ));
    } catch (err) {
      console.error('Failed to fetch RFQs:', err);
      setRfqs([]);
    } finally {
      setRfqsLoading(false);
    }
  }, []);

  useEffect(() => { fetchRFQs(); }, [fetchRFQs]);

  function showToast(msg) { setToast(msg); }
  function toggleKpi(key) { setOpenKpi(p => p === key ? null : key); }

  function handleRFQAction(rfq) {
    if (rfq.action === 'Create PO') {
      setCreatePOPrefill({ supplier: 'TechSupply Co.', item: rfq.desc });
      setModal('po');
    } else {
      setRfqDetail(rfq);
    }
  }

  const safeRfqs = Array.isArray(rfqs) ? rfqs : [];
  const filteredRFQs = safeRfqs.filter(r =>
    search === '' || r.desc.toLowerCase().includes(search.toLowerCase()) || r.num.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div id="purchases-page">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      {modal === 'po'  && <CreatePOModal  onClose={() => { setModal(null); setCreatePOPrefill(null); }} onSave={showToast} prefill={createPOPrefill} />}
      {modal === 'rfq' && <CreateRFQModal onClose={() => setModal(null)} onSuccess={() => { fetchRFQs(); showToast('RFQ created successfully'); }} />}
      {rfqDetail && <RFQDetailModal rfq={rfqDetail} onClose={() => setRfqDetail(null)} onSend={fetchRFQs} />}

      <Sidebar activePage="purchases" goPage={goPage} />
      <div className="db-main">
        <div className="tb">
          <span className="tb-title"></span>
          <div className="tb-right">
            <div className="tb-bell"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <div className="tb-user">
              <div className="tb-avatar" style={{ background: 'linear-gradient(135deg,#16a34a,#10b981)' }}>SJ</div>
              <div><div className="tb-uname">Sarah Johns</div><div className="tb-urole">Administrator</div></div>
            </div>
          </div>
        </div>
        <div className="pg">
          <div className="pg-header">
            <div className="pg-header-left"><h1>Purchases</h1><p>Manage suppliers, track orders, and streamline procurement</p></div>
            <div className="pg-header-actions">
              <button className="btn-action btn-blue" onClick={() => setModal('po')}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Create PO
              </button>
              <button className="btn-action btn-purple" onClick={() => setModal('rfq')}>
                <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Request Quote
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="kpi-row" style={{ marginBottom: '20px' }}>
            {[
              { key:'orders',    label:'Total Orders',       value:'324',  icon:<svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>, cls:'ic-b', chg:'12% this month', up:true },
              { key:'approval',  label:'Pending Approval',   value:'18',   icon:<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, cls:'ic-o', note:'Requires attention' },
              { key:'spend',     label:'Total Spend',        value:'$2.4M',icon:<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, cls:'ic-g', chg:'8% vs last month', up:true },
              { key:'suppliers', label:'Active Suppliers',   value:'156',  icon:<svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>, cls:'ic-p', note:'3 new this month' },
            ].map(k => (
              <div key={k.key} className={`kpi kpi-clickable${openKpi===k.key?' kpi-active':''}`} onClick={() => toggleKpi(k.key)}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-body">
                  <div className="kpi-value">{k.value}</div>
                  <div className={`kpi-icon ${k.cls}`}>{k.icon}</div>
                </div>
                {k.chg ? (
                  <div className={`kpi-chg ${k.up?'up':'dn'}`}><svg viewBox="0 0 24 24">{k.up?<polyline points="18 15 12 9 6 15"/>:<polyline points="6 9 12 15 18 9"/>}</svg>{k.chg}</div>
                ) : (
                  <div style={{ fontSize:'13px', fontWeight:500, color: k.key==='approval'?'#ea580c':'#7c3aed', marginTop:'6px' }}>{k.note}</div>
                )}
                {openKpi===k.key && <KpiDrawer type={k.key} onClose={e=>{e.stopPropagation();setOpenKpi(null);}} />}
              </div>
            ))}
          </div>

          <div className="pur-layout">
            {/* Left nav */}
            <div className="pur-nav-card">
              {[['RFQs',8],['Purchase Orders',24],['Receipts/GRN',42],['Suppliers Directory',156]].map(([name,count]) => (
                <div key={name} className={`pur-nav-item${activeNav===name?' active':''}`} onClick={() => setActiveNav(name)}>
                  <span className="pur-nav-name">{name}</span>
                  <span className="pur-nav-count">{count}</span>
                </div>
              ))}
            </div>

            {/* Right content */}
            <div className="pur-right">
              {/* ── RFQs tab ── */}
              {activeNav === 'RFQs' && (
                <>
                  <div className="pur-search-bar">
                    <input className="pur-search" type="text" placeholder="Search RFQs…" value={search} onChange={e => setSearch(e.target.value)}/>
                    <div className="pur-btns">
                      <button className="pur-filter-btn" onClick={() => showToast('Filter panel opened')}><svg viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>Filter</button>
                      <button className="pur-sort-btn" onClick={() => showToast('Sorted by date')}><svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>Sort</button>
                    </div>
                  </div>
                  <div className="rfq-list">
                    {rfqsLoading ? (
                      <div style={{ padding:'24px',textAlign:'center',color:'#9ca3af',fontSize:'13.5px' }}>Loading RFQs…</div>
                    ) : filteredRFQs.length === 0 ? (
                      <div style={{ padding:'24px',textAlign:'center',color:'#9ca3af',fontSize:'13.5px' }}>No RFQs match your search.</div>
                    ) : filteredRFQs.map(rfq => (
                      <div key={rfq.num} className="rfq-item" onClick={() => setRfqDetail(rfq)}>
                        <div className="rfq-row1">
                          <div><span className="rfq-num">{rfq.num}</span><span className={`rfq-badge ${rfq.badgeCls}`}>{rfq.status}</span></div>
                          <div className="rfq-est">{rfq.est}</div>
                        </div>
                        <div className="rfq-row2">
                          <div>
                            <div className="rfq-desc">{rfq.desc}</div>
                            <div className="rfq-dates">{rfq.dates}</div>
                          </div>
                          <button className={`rfq-action ${rfq.actionCls}`} onClick={e => { e.stopPropagation(); handleRFQAction(rfq); }}>{rfq.action}</button>
                        </div>
                        <div className="rfq-row3">
                          <span className="rfq-meta">{rfq.suppliers}</span>
                          <span className="rfq-meta">{rfq.responses}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* AI Procurement Intelligence */}
                  <div className="ai-proc-card">
                    <div className="ai-proc-head">
                      <div className="ai-proc-icon"><svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
                      <span className="ai-proc-title">AI Procurement Intelligence</span>
                    </div>
                    <div className="ai-proc-insight"><div className="ai-proc-dot apd-green"></div><div className="ai-proc-text"><strong>Cost Optimization:</strong> Switch to TechSupply Co. for IT equipment could save 15% ($2,775) on next quarter's orders.</div></div>
                    <div className="ai-proc-insight"><div className="ai-proc-dot apd-orange"></div><div className="ai-proc-text"><strong>Supplier Risk:</strong> GlobalPrint Inc. showing delivery delays. Consider backup supplier for critical orders.</div></div>
                    <div className="ai-proc-insight"><div className="ai-proc-dot apd-yellow"></div><div className="ai-proc-text"><strong>Market Trend:</strong> Office supply prices trending down 8%. Optimal time to negotiate bulk contracts.</div></div>
                    {showAnalysis && (
                      <div className="pur-analysis-expand">
                        <div className="pur-analysis-row"><span>Avg supplier response time</span><strong>18 hrs</strong></div>
                        <div className="pur-analysis-row"><span>Best performing supplier</span><strong style={{ color:'#16a34a' }}>TechSupply Co.</strong></div>
                        <div className="pur-analysis-row"><span>At-risk supplier</span><strong style={{ color:'#ef4444' }}>GlobalPrint Inc.</strong></div>
                        <div className="pur-analysis-row"><span>Projected Q1 savings</span><strong style={{ color:'#7c3aed' }}>$24,400</strong></div>
                        <div className="pur-analysis-row"><span>Bulk contract opportunity</span><strong style={{ color:'#2563eb' }}>Office Supplies</strong></div>
                      </div>
                    )}
                    <button className="ai-proc-link" onClick={() => setShowAnalysis(p => !p)}>
                      {showAnalysis ? 'Hide Analysis' : 'View Full Analysis'}
                      <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </button>
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
                    <thead><tr><th>PO Number</th><th>Supplier</th><th>Item</th><th className="right">Amount</th><th className="center">Status</th><th className="center">Action</th></tr></thead>
                    <tbody>
                      {NAV_CONTENT['Purchase Orders'].map(po => (
                        <tr key={po.num} className="pur-table-row">
                          <td className="pur-ref">{po.num}</td>
                          <td>{po.supplier}</td>
                          <td style={{ color:'#6b7280', fontSize:'13px' }}>{po.item}</td>
                          <td className="right" style={{ fontWeight:700 }}>{po.amount}</td>
                          <td className="center"><span className={`pur-status-badge ${po.statusCls}`}>{po.status}</span></td>
                          <td className="center">
                            <button className="pur-link-btn" onClick={() => showToast(`Viewing ${po.num}`)}>View</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Receipts/GRN tab ── */}
              {activeNav === 'Receipts/GRN' && (
                <div className="pur-tab-card">
                  <div className="pur-tab-header">
                    <span className="pur-tab-title">Goods Receipt Notes</span>
                    <button className="pur-btn-secondary" style={{ height:'34px',padding:'0 14px',fontSize:'12.5px' }} onClick={() => showToast('New GRN form opened')}>+ New GRN</button>
                  </div>
                  <table className="pur-table">
                    <thead><tr><th>GRN Number</th><th>PO Reference</th><th>Supplier</th><th>Date</th><th className="center">Items</th><th className="center">Status</th></tr></thead>
                    <tbody>
                      {NAV_CONTENT['Receipts/GRN'].map(grn => (
                        <tr key={grn.num} className="pur-table-row" onClick={() => showToast(`Viewing ${grn.num}`)}>
                          <td className="pur-ref">{grn.num}</td>
                          <td style={{ color:'#2563eb', fontWeight:600, cursor:'pointer' }}>{grn.po}</td>
                          <td>{grn.supplier}</td>
                          <td style={{ color:'#6b7280', fontSize:'13px' }}>{grn.date}</td>
                          <td className="center" style={{ fontWeight:600 }}>{grn.items}</td>
                          <td className="center"><span className={`pur-status-badge ${grn.status==='Complete'?'po-delivered':'po-pending'}`}>{grn.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Suppliers Directory tab ── */}
              {activeNav === 'Suppliers Directory' && (
                <div className="pur-tab-card">
                  <div className="pur-tab-header">
                    <span className="pur-tab-title">Suppliers Directory</span>
                    <button className="pur-btn-primary" style={{ height:'34px',padding:'0 14px',fontSize:'12.5px' }} onClick={() => showToast('Add supplier form opened')}>+ Add Supplier</button>
                  </div>
                  <table className="pur-table">
                    <thead><tr><th>Supplier Name</th><th>Category</th><th className="center">Rating</th><th className="center">Tier</th><th className="center">Actions</th></tr></thead>
                    <tbody>
                      {NAV_CONTENT['Suppliers Directory'].map(s => (
                        <tr key={s.name} className="pur-table-row">
                          <td style={{ fontWeight:600, color:'#111827' }}>{s.name}</td>
                          <td style={{ color:'#6b7280', fontSize:'13px' }}>{s.category}</td>
                          <td className="center">
                            <span style={{ fontWeight:700, color: parseFloat(s.rating) >= 4.5 ? '#16a34a' : parseFloat(s.rating) >= 4.0 ? '#f59e0b' : '#ef4444' }}>{'★ ' + s.rating}</span>
                          </td>
                          <td className="center">
                            <span className={`pur-status-badge ${s.status==='Preferred'?'po-delivered':'po-pending'}`}>{s.status}</span>
                          </td>
                          <td className="center" style={{ display:'flex', gap:'8px', justifyContent:'center' }}>
                            <button className="pur-link-btn" onClick={() => showToast(`Viewing ${s.name} profile`)}>View</button>
                            <button className="pur-link-btn" style={{ color:'#7c3aed' }} onClick={() => setModal('rfq')}>Send RFQ</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
