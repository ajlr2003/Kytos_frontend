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
    fetch('/api/v1/purchase-orders/', {
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
    fetch(`/api/v1/purchase-orders/${poId}`, {
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
      const res = await fetch('/api/v1/grn/', {
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
  const [creatingPO,   setCreatingPO]   = useState(false);
  const [poCreated,    setPoCreated]    = useState(false);
  const [poError,      setPoError]      = useState('');

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
  }, [rfq.id]);

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
        if (data.has_po) setPoCreated(true);
        if (data.selected_supplier_id) {
          setSelectedSupplierId(data.selected_supplier_id);
          if (data.status?.toUpperCase() === 'AWARDED') setLocalStatus('AWARDED');
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));

    // Check if PO already exists for this RFQ
    fetch(`/api/v1/purchase-orders/?rfq_id=${rfq.id}`, {
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
    fetch(`/api/v1/rfqs/${rfq.id}/quotations`, {
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

  async function handleAutoSelect() {
    const token = localStorage.getItem('token');
    if (!token) { setSelectError('Not authenticated.'); return; }
    setAutoSelecting(true);
    setSelectError('');
    try {
      const res = await fetch(`/api/v1/rfqs/${rfq.id}/auto-select`, {
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
      const res = await fetch('/api/v1/purchase-orders/', {
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quotations</div>
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
              return (
                <div key={q.id ?? i} style={{ padding: '12px 14px', borderBottom: i < quotations.length - 1 ? '1px solid #f3f4f6' : 'none', fontSize: '13.5px', background: isSelected ? '#f0fdf4' : 'transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{supplierName}</span>
                    <span style={{ fontWeight: 700, color: '#2563eb' }}>${Number(q.price ?? q.total_price ?? 0).toLocaleString()}</span>
                  </div>
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
    fetch(`/api/v1/purchase-orders/${po.id}`, {
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
    <Modal title={`Purchase Order — ${po.id}`} onClose={onClose} width={520}>
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
      const res = await fetch(`/api/v1/purchase-invoices/${invoice.id}/${action}`, {
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
    <Modal title={`Invoice — ${String(invoice.id).slice(0, 8)}…`} onClose={onClose} width={500}>
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

  const fetchPurchaseOrders = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { setPurchaseOrdersLoading(false); return; }
    setPurchaseOrdersLoading(true);
    try {
      const res = await fetch('/api/v1/purchase-orders/', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; return; }
      if (!res.ok) throw new Error(`PO fetch failed (${res.status})`);
      const data = await res.json();
      console.log('PO DATA:', data);
      const raw = data.items ?? (Array.isArray(data) ? data : data.results ?? []);
      console.log('Updated PO list:', raw);
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
      const res = await fetch('/api/v1/grn/', {
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
      const res = await fetch('/api/v1/purchase-invoices/', {
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

  useEffect(() => { fetchRFQs(); fetchPurchaseOrders(); fetchGRNs(); fetchInvoices(); }, [fetchRFQs, fetchPurchaseOrders, fetchGRNs, fetchInvoices]);

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

  async function handleCreateInvoice(grn) {
    const token = localStorage.getItem('token');
    if (!token) { showToast('Not authenticated.'); return; }
    setCreatingInvoiceFor(prev => new Set(prev).add(grn.id));
    console.log('GRN ID:', grn.id);
    try {
      const res = await fetch('/api/v1/invoices/from-grn', {
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

  return (
    <div id="purchases-page">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      {modal === 'po'  && <CreatePOModal  onClose={() => { setModal(null); setCreatePOPrefill(null); }} onSave={showToast} prefill={createPOPrefill} />}
      {modal === 'rfq' && <CreateRFQModal onClose={() => setModal(null)} onSuccess={() => { fetchRFQs(); showToast('RFQ created successfully'); }} />}
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
              {[['RFQs',8],['Purchase Orders',24],['Receipts/GRN',42],['Invoices', invoices.length],['Suppliers Directory',156]].map(([name,count]) => (
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
                                  style={{ color:'#7c3aed', fontWeight:600 }}
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
