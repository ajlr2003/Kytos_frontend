/**
 * src/components/products/ProductPages.jsx
 *
 * Shared product creation/detail pages used by both the Purchases and Sales
 * modules, so "New Product" and the product detail view are identical no
 * matter which module you're in — they operate on the same underlying
 * inventory catalog (GET/POST/PUT/DELETE /api/v1/inventory/items).
 */

import { useState, useRef } from 'react';
import { API_BASE } from '../../config.js';
import ActivityTimeline from '../ui/ActivityTimeline';
import AuthedImage from '../ui/AuthedImage';

export const PRODUCT_CATEGORY_OPTIONS = ['Goods', 'Services', 'Deliveries', 'Consumables', 'Equipment', 'Miscellaneous'];

/* ─── Product photo box — click to pick a file, uploads via /api/v1/documents/upload ─── */
export function ProductPhotoBox({ imageUrl, onUploaded, showToast }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please select an image file.'); return; }
    const token = localStorage.getItem('token');
    if (!token) { showToast('Not authenticated.'); return; }

    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${API_BASE}/api/v1/documents/upload?description=Product%20photo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(data.detail || `Failed to upload image (${res.status})`); return; }
      onUploaded(`/api/v1/documents/${data.id}/download`);
    } catch {
      showToast('Network error — image not uploaded.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="prd-photo-box" onClick={() => !uploading && fileInputRef.current?.click()} style={{ cursor: uploading ? 'wait' : 'pointer', overflow: 'hidden', padding: 0 }}>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      {imageUrl ? (
        <AuthedImage
          src={imageUrl}
          alt="Product"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          fallback={<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#9ca3af" strokeWidth="1.6"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}
        />
      ) : (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#9ca3af" strokeWidth="1.6"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
      )}
    </div>
  );
}

/* ─── New Product — full page ─── */
export function NewProductPage({ suppliers = [], onCancel, onCreated, showToast }) {
  const [form, setForm] = useState({
    description: '', part_number: '', serial_number: '', supplier_manufacturer: '',
    unit_price: '', po_number: '', received_file_no: '', receiving_delivery_status: '',
    stock_qty: 0, warehouse_location: '', box_number: '', expiry_date: '', customer_name: '',
    image_url: '',
  });
  // UI-only fields — not sent to the backend yet, wired up once the product
  // endpoint supports sales/tax data.
  const [uiFields, setUiFields] = useState({
    category: 'Goods', barcode: '', salesPrice: '1.00', internalNotes: '',
  });
  const [salesEnabled, setSalesEnabled] = useState(true);
  const [purchaseEnabled, setPurchaseEnabled] = useState(true);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }
  function setUi(field, value) { setUiFields(f => ({ ...f, [field]: value })); }

  const STEPS = ['Basics', 'Pricing', 'Inventory', 'Review'];

  function validateStep(i) {
    if (i === 0 && !form.part_number.trim()) return 'Reference is required.';
    if (i === 0 && !salesEnabled && !purchaseEnabled) return 'Select at least one — Sales, Purchase, or both.';
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
    if (!form.part_number.trim()) { setError('Reference is required.'); setStep(0); return; }

    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) { setError('Not authenticated. Please log in.'); return; }

      const payload = {
        ...form,
        unit_price: form.unit_price === '' ? null : Number(form.unit_price),
        stock_qty: Number(form.stock_qty) || 0,
      };

      const res = await fetch(`${API_BASE}/api/v1/inventory/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.detail || `Failed to create product (${res.status})`); return; }

      showToast('Product created successfully');
      onCreated();
    } catch (e) {
      setError(e.message || 'Failed to create product.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="nrfq-page">
      <div className="nrfq-actionbar">
        <button className="nrfq-btn-ghost" onClick={onCancel}>← Back to Products</button>
      </div>

      <div className="nrfq-breadcrumb"><span className="nrfq-crumb-link" onClick={onCancel}>Products</span> <span>/</span> New</div>

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
              <div className="prd-form-top">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="nrfq-title">
                    <span className="nrfq-star">☆</span>
                    <input className="nrfq-title-input" type="text" placeholder="e.g. Disposable Syringe 5ml" value={form.description} onChange={e => set('description', e.target.value)} />
                  </div>
                  <div className="prd-type-checks">
                    <label><input type="checkbox" checked={salesEnabled} onChange={e => setSalesEnabled(e.target.checked)} /> Can be Sold</label>
                    <label><input type="checkbox" checked={purchaseEnabled} onChange={e => setPurchaseEnabled(e.target.checked)} /> Can be Purchased</label>
                  </div>
                  {!salesEnabled && !purchaseEnabled && (
                    <div className="nrfq-hint" style={{ color: '#b91c1c' }}>Select at least one — Sales, Purchase, or both.</div>
                  )}
                </div>
                <ProductPhotoBox imageUrl={form.image_url} onUploaded={url => set('image_url', url)} showToast={showToast} />
              </div>
              <div className="nrfq-field-grid">
                <div className="nrfq-field-col">
                  <div className="nrfq-field">
                    <label>Reference *</label>
                    <input type="text" placeholder="e.g. SYR-5ML-001" value={form.part_number} onChange={e => set('part_number', e.target.value)} />
                  </div>
                  <div className="nrfq-field">
                    <label>Category</label>
                    <select value={uiFields.category} onChange={e => setUi('category', e.target.value)}>
                      {PRODUCT_CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="nrfq-field-col">
                  <div className="nrfq-field">
                    <label>Supplier / Manufacturer</label>
                    <select value={form.supplier_manufacturer} onChange={e => set('supplier_manufacturer', e.target.value)}>
                      <option value="">{suppliers.length === 0 ? 'No vendors yet' : 'Select a vendor…'}</option>
                      {suppliers.map(s => <option key={s.id} value={s.company_name}>{s.company_name}</option>)}
                    </select>
                    {suppliers.length === 0 && (
                      <div className="nrfq-hint">Add a vendor under the Vendors tab first.</div>
                    )}
                  </div>
                  <div className="nrfq-field">
                    <label>Barcode</label>
                    <input type="text" value={uiFields.barcode} onChange={e => setUi('barcode', e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <div className="nrfq-field-grid">
              {salesEnabled && (
                <div className="nrfq-field-col">
                  <div className="nrfq-field">
                    <label>Sales Price</label>
                    <div className="prd-inline-input">
                      <input type="number" min="0" step="0.01" value={uiFields.salesPrice} onChange={e => setUi('salesPrice', e.target.value)} />
                      <span>per Units</span>
                    </div>
                  </div>
                </div>
              )}
              {purchaseEnabled && (
                <div className="nrfq-field-col">
                  <div className="nrfq-field">
                    <label>Cost</label>
                    <div className="prd-inline-input">
                      <input type="number" min="0" step="0.01" placeholder="0.00" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} />
                      <span>per Units</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="nrfq-field-grid">
              <div className="nrfq-field-col">
                <div className="nrfq-field">
                  <label>Stock Qty</label>
                  <input type="number" min="0" value={form.stock_qty} onChange={e => set('stock_qty', e.target.value)} />
                </div>
                <div className="nrfq-field">
                  <label>Warehouse Location</label>
                  <input type="text" placeholder="e.g. BAY05-C03-R04" value={form.warehouse_location} onChange={e => set('warehouse_location', e.target.value)} />
                </div>
                <div className="nrfq-field">
                  <label>Box #</label>
                  <input type="text" value={form.box_number} onChange={e => set('box_number', e.target.value)} />
                </div>
              </div>
              <div className="nrfq-field-col">
                <div className="nrfq-field">
                  <label>Serial Number</label>
                  <input type="text" value={form.serial_number} onChange={e => set('serial_number', e.target.value)} />
                </div>
                <div className="nrfq-field">
                  <label>Expiry Date</label>
                  <input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
                </div>
                <div className="nrfq-field">
                  <label>Reserved For (Customer)</label>
                  <input type="text" value={form.customer_name} onChange={e => set('customer_name', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <>
              <div className="prd-section-title">Review</div>
              <div className="wiz-review-grid">
                <div><span>Name</span><strong>{form.description || '—'}</strong></div>
                <div><span>Reference</span><strong>{form.part_number || '—'}</strong></div>
                <div><span>Type</span><strong>{salesEnabled && purchaseEnabled ? 'Sales & Purchase' : salesEnabled ? 'Sales Only' : purchaseEnabled ? 'Purchase Only' : '—'}</strong></div>
                <div><span>Category</span><strong>{uiFields.category || '—'}</strong></div>
                {salesEnabled && <div><span>Sales Price</span><strong>{uiFields.salesPrice || '0.00'} SAR</strong></div>}
                {purchaseEnabled && <div><span>Cost</span><strong>{form.unit_price || '0.00'} SAR</strong></div>}
                <div><span>Stock Qty</span><strong>{form.stock_qty || 0}</strong></div>
                <div><span>Warehouse</span><strong>{form.warehouse_location || '—'}</strong></div>
                <div><span>Supplier</span><strong>{form.supplier_manufacturer || '—'}</strong></div>
              </div>
              <div className="nrfq-field" style={{ marginTop: '16px' }}>
                <label>Internal Notes</label>
                <textarea rows={3} placeholder="This note is only for internal purposes." value={uiFields.internalNotes} onChange={e => setUi('internalNotes', e.target.value)} />
              </div>
            </>
          )}

          <div className="wiz-nav">
            {step > 0 && <button className="nrfq-btn-ghost" onClick={goBack}>Back</button>}
            <div style={{ flex: 1 }} />
            {step < STEPS.length - 1 ? (
              <button className="nrfq-btn-primary" onClick={goNext}>Next</button>
            ) : (
              <button className="nrfq-btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save Product'}</button>
            )}
          </div>
        </div>

        <div className="wiz-side">
          <div className="wiz-summary">
            <div className="prd-section-title">Live Summary</div>
            <div className="wiz-summary-name">{form.description || 'Untitled product'}</div>
            <div className="wiz-summary-ref">{form.part_number || 'No reference yet'}</div>
            {salesEnabled && <div className="wiz-summary-price">{uiFields.salesPrice || '0.00'} <span>SAR</span></div>}
            <div className="wiz-summary-row"><span>Type</span><strong>{salesEnabled && purchaseEnabled ? 'Sales & Purchase' : salesEnabled ? 'Sales Only' : purchaseEnabled ? 'Purchase Only' : '—'}</strong></div>
            {purchaseEnabled && <div className="wiz-summary-row"><span>Cost</span><strong>{form.unit_price || '0.00'} SAR</strong></div>}
            <div className="wiz-summary-row"><span>Stock</span><strong>{form.stock_qty || 0} units</strong></div>
            <div className="wiz-summary-row"><span>Category</span><strong>{uiFields.category || '—'}</strong></div>
            <div className="wiz-summary-row"><span>Vendor</span><strong>{form.supplier_manufacturer || '—'}</strong></div>
          </div>

          <div className="nrfq-chatter">
            <div className="nrfq-chatter-btns">
              <button onClick={() => showToast('Save the product first')}>Send message</button>
              <button onClick={() => showToast('Save the product first')}>Log note</button>
              <button onClick={() => showToast('Save the product first')}>Activity</button>
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

/* ─── Product Detail — full page (opened by clicking a product card) ─── */
export function ProductDetailPage({ product, suppliers = [], onCancel, onUpdated, showToast }) {
  const [form, setForm] = useState({
    description: product.description ?? '', part_number: product.part_number ?? '',
    serial_number: product.serial_number ?? '', supplier_manufacturer: product.supplier_manufacturer ?? '',
    unit_price: product.unit_price ?? '', po_number: product.po_number ?? '',
    received_file_no: product.received_file_no ?? '', receiving_delivery_status: product.receiving_delivery_status ?? '',
    stock_qty: product.stock_qty ?? 0, warehouse_location: product.warehouse_location ?? '',
    box_number: product.box_number ?? '', expiry_date: product.expiry_date ?? '', customer_name: product.customer_name ?? '',
    image_url: product.image_url ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]   = useState('');

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function submit() {
    if (!form.part_number.trim()) { setError('Reference is required.'); return; }

    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) { setError('Not authenticated. Please log in.'); return; }

      const payload = {
        ...form,
        unit_price: form.unit_price === '' ? null : Number(form.unit_price),
        stock_qty: Number(form.stock_qty) || 0,
      };

      const res = await fetch(`${API_BASE}/api/v1/inventory/items/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.detail || `Failed to update product (${res.status})`); return; }

      showToast('Product updated successfully');
      onUpdated();
    } catch (e) {
      setError(e.message || 'Failed to update product.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${form.part_number}?`)) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/v1/inventory/items/${product.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) { showToast('Failed to delete product'); return; }
      showToast('Product deleted');
      onUpdated();
    } catch {
      showToast('Network error — product not deleted');
    } finally {
      setDeleting(false);
    }
  }

  const stockQty = Number(form.stock_qty) || 0;

  return (
    <div className="nrfq-page">
      <div className="nrfq-actionbar">
        <button className="nrfq-btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button className="nrfq-btn-ghost" onClick={onCancel}>← Back to Products</button>
        <button className="nrfq-btn-ghost" style={{ color: '#b91c1c', marginLeft: 'auto' }} onClick={remove} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button>
      </div>

      <div className="nrfq-breadcrumb"><span className="nrfq-crumb-link" onClick={onCancel}>Products</span> <span>/</span> {form.description || form.part_number || 'Product'}</div>

      {error && <div className="pur-form-error" style={{ color:'#ef4444', fontSize:'13px', margin:'0 0 12px', padding:'8px 12px', background:'#fef2f2', borderRadius:'6px', border:'1px solid #fecaca' }}>{error}</div>}

      <div className="nrfq-body">
        <div className="nrfq-form">
          <div className="prd-form-top">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="nrfq-title">
                <span className="nrfq-star">☆</span>
                <input className="nrfq-title-input" type="text" placeholder="e.g. Disposable Syringe 5ml" value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
            </div>
            <ProductPhotoBox imageUrl={form.image_url} onUploaded={url => set('image_url', url)} showToast={showToast} />
          </div>

          <div className="prd-section-title">General</div>
          <div className="nrfq-field-grid">
            <div className="nrfq-field-col">
              <div className="nrfq-field">
                <label>Reference *</label>
                <input type="text" value={form.part_number} onChange={e => set('part_number', e.target.value)} />
              </div>
              <div className="nrfq-field">
                <label>Serial Number</label>
                <input type="text" value={form.serial_number} onChange={e => set('serial_number', e.target.value)} />
              </div>
              <div className="nrfq-field">
                <label>Supplier / Manufacturer</label>
                <select value={form.supplier_manufacturer} onChange={e => set('supplier_manufacturer', e.target.value)}>
                  <option value="">{suppliers.length === 0 ? 'No vendors yet' : 'Select a vendor…'}</option>
                  {suppliers.map(s => <option key={s.id} value={s.company_name}>{s.company_name}</option>)}
                </select>
              </div>
            </div>
            <div className="nrfq-field-col">
              <div className="nrfq-field">
                <label>Cost (SAR)</label>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} />
              </div>
              <div className="nrfq-field">
                <label>PO No.</label>
                <input type="text" value={form.po_number} onChange={e => set('po_number', e.target.value)} />
              </div>
              <div className="nrfq-field">
                <label>Status / Delivery Note</label>
                <input type="text" value={form.receiving_delivery_status} onChange={e => set('receiving_delivery_status', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="prd-section-title">Inventory</div>
          <div className="nrfq-field-grid">
            <div className="nrfq-field-col">
              <div className="nrfq-field">
                <label>Stock Qty</label>
                <input type="number" min="0" value={form.stock_qty} onChange={e => set('stock_qty', e.target.value)} />
              </div>
              <div className="nrfq-field">
                <label>Warehouse Location</label>
                <input type="text" value={form.warehouse_location} onChange={e => set('warehouse_location', e.target.value)} />
              </div>
              <div className="nrfq-field">
                <label>Box #</label>
                <input type="text" value={form.box_number} onChange={e => set('box_number', e.target.value)} />
              </div>
            </div>
            <div className="nrfq-field-col">
              <div className="nrfq-field">
                <label>Expiry Date</label>
                <input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
              </div>
              <div className="nrfq-field">
                <label>Reserved For (Customer)</label>
                <input type="text" value={form.customer_name} onChange={e => set('customer_name', e.target.value)} />
              </div>
              <div className="nrfq-field">
                <label>Received File No.</label>
                <input type="text" value={form.received_file_no} onChange={e => set('received_file_no', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="wiz-side">
          <div className="wiz-summary">
            <div className="prd-section-title">Overview</div>
            <div className="wiz-summary-name">{form.description || form.part_number || 'Untitled product'}</div>
            <div className="wiz-summary-ref">{form.part_number || 'No reference'}</div>
            <div className="wiz-summary-price">{form.unit_price ? Number(form.unit_price).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : '0.00'} <span>SAR</span></div>
            <div className="wiz-summary-row"><span>Stock</span><strong style={{ color: stockQty > 0 ? '#15803d' : '#b91c1c' }}>{stockQty > 0 ? `${stockQty} units` : 'Out of stock'}</strong></div>
            <div className="wiz-summary-row"><span>Vendor</span><strong>{form.supplier_manufacturer || '—'}</strong></div>
            <div className="wiz-summary-row"><span>Warehouse</span><strong>{form.warehouse_location || '—'}</strong></div>
          </div>

          <div className="nrfq-chatter">
            <div className="nrfq-chatter-btns">
              <button onClick={() => showToast('Messaging coming soon')}>Send message</button>
              <button onClick={() => showToast('Notes coming soon')}>Log note</button>
              <button onClick={() => showToast('Activity scheduling coming soon')}>Activity</button>
            </div>
            <ActivityTimeline entityType="product" entityId={product.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
