import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import '../styles/Sales.css';

/* ─── Constants ─── */
const CURRENCY_SYM = { SAR: 'SAR ', USD: '$', EUR: '€', GBP: '£', AED: 'AED ' };
const UNITS = ['EA', 'LOT', 'PCS', 'DAYS', 'MONTH'];

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtRevenue(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `SAR ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `SAR ${(n / 1_000).toFixed(1)}K`;
  return `SAR ${n.toFixed(2)}`;
}
function genQuoteNo() {
  return `QUO-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
}
function makeRow(seed = 0) {
  return {
    id: Date.now() + seed + Math.random(),
    catalogNo: '', name: '', description: '',
    qty: 1, unit: 'EA', unitPrice: '', discount: '',
  };
}

/* ─── Toast ─── */
function Toast({ msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 2800); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="pur-toast">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      {msg}
    </div>
  );
}

/* ─── Modal ─── */
function Modal({ title, onClose, width = 480, children }) {
  return (
    <div className="pur-modal-overlay" onClick={onClose}>
      <div className="pur-modal" style={{ width }} onClick={e => e.stopPropagation()}>
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

/* ─── Field wrapper ─── */
function SField({ label, children, span2 }) {
  return (
    <div className="sqb-field" style={span2 ? { gridColumn: 'span 2' } : undefined}>
      <label className="sqb-flabel">{label}</label>
      {children}
    </div>
  );
}

/* ════════════════════════════════════════
   QUOTATION BUILDER  (inline / collapsible)
════════════════════════════════════════ */
function QuotationBuilder({ onClose, onCreate, showToast, onAuthError }) {
  const today = new Date().toISOString().slice(0, 10);

  const [header, setHeader] = useState({
    quoteNo: genQuoteNo(),
    date: today,
    currency: 'SAR',
    deliveryTime: '',
    deliveryLocation: '',
    paymentTerms: 'Net 30',
    validity: '30',
  });
  const [customer, setCustomer] = useState({
    company: '', department: '', contact: '', phone: '', email: '', subject: '',
  });
  const [items, setItems] = useState([makeRow(0), makeRow(1), makeRow(2)]);
  const [focusRowId, setFocusRowId] = useState(null);
  const [remarks, setRemarks] = useState(
    'Thank you for the opportunity to submit this quotation. We look forward to your favourable response and remain available for any clarifications or additional information required.'
  );
  const [terms, setTerms] = useState(
    '1. All prices are exclusive of VAT unless stated otherwise.\n2. Payment is due within the agreed payment terms from invoice date.\n3. Delivery times are estimates and not guaranteed.\n4. This quotation is valid for the period stated above.\n5. Prices are subject to change without notice after the validity period.'
  );

  const sym = CURRENCY_SYM[header.currency] ?? '';

  const rows = items.map(item => {
    const qty      = parseFloat(item.qty) || 0;
    const up       = parseFloat(item.unitPrice) || 0;
    const disc     = Math.min(100, Math.max(0, parseFloat(item.discount) || 0));
    const netPrice = up * (1 - disc / 100);
    const total    = netPrice * qty;
    return { ...item, _qty: qty, _up: up, _disc: disc, _netPrice: netPrice, _total: total };
  });

  const subtotal   = rows.reduce((s, r) => s + r._total, 0);
  const vat        = subtotal * 0.15;
  const grandTotal = subtotal + vat;

  const setH    = (k, v) => setHeader(p => ({ ...p, [k]: v }));
  const setC    = (k, v) => setCustomer(p => ({ ...p, [k]: v }));
  const setItem = (id, k, v) => setItems(p => p.map(i => i.id === id ? { ...i, [k]: v } : i));

  const addRow = () => {
    const newRow = makeRow(items.length * 999);
    setItems(p => [...p, newRow]);
    setFocusRowId(newRow.id);
  };
  const delRow = id => setItems(p => p.length > 1 ? p.filter(i => i.id !== id) : p);

  const handleEnterKey = e => {
    if (e.key === 'Enter') { e.preventDefault(); addRow(); }
  };

  async function commit(statusLabel) {
    if (!customer.company.trim()) { showToast('Company name is required'); return; }

    const validRows = rows.filter(r => r.name?.trim() && r._qty > 0 && r._up > 0);
    if (validRows.length === 0) { showToast('At least one item with a name, qty > 0, and unit price > 0 is required'); return; }

    const token = localStorage.getItem('token');
    if (!token) { showToast('Not logged in'); return; }

    const apiStatus = statusLabel === 'Draft' ? 'draft' : 'sent';

    const payload = {
      date: header.date,
      currency: header.currency,
      validity: header.validity,
      delivery_time: header.deliveryTime.trim() || null,
      delivery_location: header.deliveryLocation.trim() || null,
      payment_terms: header.paymentTerms || null,
      customer_name: customer.company.trim() || null,
      department: customer.department.trim() || null,
      contact_person: customer.contact.trim() || null,
      phone: customer.phone.trim() || null,
      email: customer.email.trim() || null,
      subject: customer.subject.trim() || 'Sales Quotation',
      remarks: remarks.trim() || null,
      terms: terms.trim() || null,
      status: apiStatus,
      items: validRows.map((r, idx) => ({
        line_no: idx + 1,
        catalog_no: r.catalogNo?.trim() || null,
        item_name: r.name.trim(),
        description: r.description?.trim() || null,
        qty: r._qty,
        unit: r.unit,
        unit_price: r._up,
        discount: r._disc,
        net_price: r._netPrice,
        total: r._total,
      })),
    };

    try {
      const res = await fetch('/api/v1/sales/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        showToast('Session expired — please log in again and retry');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = typeof err.detail === 'string' ? err.detail : 'Failed to save quotation';
        showToast(msg);
        return;
      }
      const serverQuote = await res.json();
      onCreate(normalizeApiQuote(serverQuote));
      showToast(apiStatus === 'sent' ? 'Quotation sent to client' : 'Quotation saved as draft');
      onClose();
    } catch {
      showToast('Network error — quotation not saved');
    }
  }

  return (
    <div className="sqb-body" style={{ paddingTop: 0 }}>

      {/* ── A: Quotation Header ── */}
      <div className="sqb-card">
        <div className="sqb-card-head">
          <div className="sqb-badge">A</div>
          <span className="sqb-card-title">Quotation Header</span>
        </div>
        <div className="sqb-grid sqb-g4">
          <SField label="Quote Number">
            <input className="sqb-inp sqb-inp-mono" readOnly value={header.quoteNo} />
          </SField>
          <SField label="Date">
            <input className="sqb-inp" type="date" value={header.date} onChange={e => setH('date', e.target.value)} />
          </SField>
          <SField label="Currency">
            <select className="sqb-inp sqb-sel" value={header.currency} onChange={e => setH('currency', e.target.value)}>
              <option value="SAR">SAR — Saudi Riyal</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="AED">AED — UAE Dirham</option>
            </select>
          </SField>
          <SField label="Quote Validity">
            <select className="sqb-inp sqb-sel" value={header.validity} onChange={e => setH('validity', e.target.value)}>
              {['15', '30', '45', '60', '90'].map(d => <option key={d} value={d}>{d} days</option>)}
            </select>
          </SField>
          <SField label="Delivery Time">
            <input className="sqb-inp" placeholder="e.g. 2–4 weeks" value={header.deliveryTime} onChange={e => setH('deliveryTime', e.target.value)} />
          </SField>
          <SField label="Delivery Location">
            <input className="sqb-inp" placeholder="e.g. Riyadh, Saudi Arabia" value={header.deliveryLocation} onChange={e => setH('deliveryLocation', e.target.value)} />
          </SField>
          <SField label="Payment Terms" span2>
            <select className="sqb-inp sqb-sel" value={header.paymentTerms} onChange={e => setH('paymentTerms', e.target.value)}>
              <option>Net 15</option>
              <option>Net 30</option>
              <option>Net 45</option>
              <option>Net 60</option>
              <option>50% Advance, 50% on Delivery</option>
              <option>100% Advance Payment</option>
              <option>Letter of Credit (LC)</option>
            </select>
          </SField>
        </div>
      </div>

      {/* ── B: Customer Details ── */}
      <div className="sqb-card">
        <div className="sqb-card-head">
          <div className="sqb-badge">B</div>
          <span className="sqb-card-title">Customer Details</span>
        </div>
        <div className="sqb-grid sqb-g3">
          <SField label="Company Name *">
            <input className="sqb-inp" placeholder="e.g. Saudi Aramco Trading" value={customer.company} onChange={e => setC('company', e.target.value)} />
          </SField>
          <SField label="Department">
            <input className="sqb-inp" placeholder="e.g. Procurement" value={customer.department} onChange={e => setC('department', e.target.value)} />
          </SField>
          <SField label="Contact Person">
            <input className="sqb-inp" placeholder="Full name" value={customer.contact} onChange={e => setC('contact', e.target.value)} />
          </SField>
          <SField label="Phone">
            <input className="sqb-inp" type="tel" placeholder="+966 50 000 0000" value={customer.phone} onChange={e => setC('phone', e.target.value)} />
          </SField>
          <SField label="Email">
            <input className="sqb-inp" type="email" placeholder="contact@company.com" value={customer.email} onChange={e => setC('email', e.target.value)} />
          </SField>
          <SField label="Subject / Reference">
            <input className="sqb-inp" placeholder="e.g. Supply of Industrial Equipment" value={customer.subject} onChange={e => setC('subject', e.target.value)} />
          </SField>
        </div>
      </div>

      {/* ── C: Line Items ── */}
      <div className="sqb-card">
        <div className="sqb-card-head">
          <div className="sqb-badge">C</div>
          <span className="sqb-card-title">Line Items</span>
          <span className="sqb-card-meta">{rows.length} item{rows.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="sqb-tbl-wrap">
          <table className="sqb-tbl">
            <thead>
              <tr>
                <th className="sqb-th sqb-th-no">#</th>
                <th className="sqb-th sqb-th-cat">Catalog No</th>
                <th className="sqb-th sqb-th-name">Item Name</th>
                <th className="sqb-th sqb-th-desc">Description</th>
                <th className="sqb-th sqb-th-r">Qty</th>
                <th className="sqb-th sqb-th-c">Unit</th>
                <th className="sqb-th sqb-th-r">Unit Price</th>
                <th className="sqb-th sqb-th-r">Disc %</th>
                <th className="sqb-th sqb-th-r">Net Price</th>
                <th className="sqb-th sqb-th-r">Total</th>
                <th className="sqb-th sqb-th-del"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id} className="sqb-row">
                  <td className="sqb-td sqb-td-no">{idx + 1}</td>

                  {/* Catalog No */}
                  <td className="sqb-td">
                    <input
                      className="sqb-ci"
                      placeholder="Cat. No"
                      value={row.catalogNo}
                      ref={row.id === focusRowId
                        ? el => { if (el) { el.focus(); setFocusRowId(null); } }
                        : undefined}
                      onChange={e => setItem(row.id, 'catalogNo', e.target.value)}
                      onKeyDown={handleEnterKey}
                    />
                  </td>

                  {/* Item Name */}
                  <td className="sqb-td">
                    <input className="sqb-ci" placeholder="Item name" value={row.name}
                      onChange={e => setItem(row.id, 'name', e.target.value)}
                      onKeyDown={handleEnterKey} />
                  </td>

                  {/* Description — multi-line textarea */}
                  <td className="sqb-td">
                    <textarea className="sqb-ci sqb-ci-ta" rows={2} placeholder="Description…"
                      value={row.description}
                      onChange={e => setItem(row.id, 'description', e.target.value)} />
                  </td>

                  {/* Qty */}
                  <td className="sqb-td sqb-td-r">
                    <input className="sqb-ci sqb-ci-r" type="number" min="0" step="1"
                      value={row.qty}
                      onChange={e => setItem(row.id, 'qty', e.target.value)}
                      onKeyDown={handleEnterKey} />
                  </td>

                  {/* Unit */}
                  <td className="sqb-td sqb-td-c">
                    <select className="sqb-cs" value={row.unit} onChange={e => setItem(row.id, 'unit', e.target.value)}>
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </td>

                  {/* Unit Price */}
                  <td className="sqb-td sqb-td-r">
                    <input className="sqb-ci sqb-ci-r" type="number" min="0" step="0.01" placeholder="0.00"
                      value={row.unitPrice}
                      onChange={e => setItem(row.id, 'unitPrice', e.target.value)}
                      onKeyDown={handleEnterKey} />
                  </td>

                  {/* Discount % */}
                  <td className="sqb-td sqb-td-r">
                    <input className="sqb-ci sqb-ci-r" type="number" min="0" max="100" step="0.1" placeholder="0"
                      value={row.discount}
                      onChange={e => setItem(row.id, 'discount', e.target.value)}
                      onKeyDown={handleEnterKey} />
                  </td>

                  {/* Net Price (computed) */}
                  <td className="sqb-td sqb-td-r sqb-computed">{fmt(row._netPrice)}</td>

                  {/* Total (computed) */}
                  <td className="sqb-td sqb-td-r sqb-computed sqb-computed-bold">{sym}{fmt(row._total)}</td>

                  {/* Delete */}
                  <td className="sqb-td sqb-td-c">
                    <button className="sqb-del" onClick={() => delRow(row.id)} title="Remove row">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button className="sqb-add-row" onClick={addRow}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Line Item
        </button>

        {/* Summary */}
        <div className="sqb-summary">
          <div className="sqb-sum-box">
            <div className="sqb-sum-row"><span>Subtotal</span><span>{sym}{fmt(subtotal)}</span></div>
            <div className="sqb-sum-row"><span>VAT (15%)</span><span>{sym}{fmt(vat)}</span></div>
            <div className="sqb-sum-grand"><span>Grand Total</span><span>{sym}{fmt(grandTotal)}</span></div>
          </div>
        </div>
      </div>

      {/* ── D: Remarks & Terms ── */}
      <div className="sqb-card">
        <div className="sqb-card-head">
          <div className="sqb-badge">D</div>
          <span className="sqb-card-title">Remarks &amp; Terms</span>
        </div>
        <div className="sqb-grid sqb-g2">
          <SField label="Remarks">
            <textarea className="sqb-ta" rows={6} value={remarks} onChange={e => setRemarks(e.target.value)} />
          </SField>
          <SField label="Terms &amp; Conditions">
            <textarea className="sqb-ta" rows={6} value={terms} onChange={e => setTerms(e.target.value)} />
          </SField>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="sqb-footer">
        <button className="pur-btn-cancel" onClick={onClose}>Cancel</button>
        <div className="sqb-footer-right">
          <button className="pur-btn-secondary sqb-icon-btn" onClick={() => commit('Draft')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Save Draft
          </button>
          <button className="pur-btn-secondary sqb-icon-btn" onClick={() => showToast('PDF generation — coming soon')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Generate PDF
          </button>
          <button className="pur-btn-primary sqb-icon-btn" onClick={() => commit('Pending')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Send to Client
          </button>
        </div>
      </div>

    </div>
  );
}

/* ════════════════════════════════════════
   APPLY DISCOUNT MODAL
════════════════════════════════════════ */

function ApplyDiscountModal({ quote, onClose, onSave }) {
  const [type, setType] = useState('percent');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [saved, setSaved] = useState(false);
  const amount = quote?.amount ? parseFloat(quote.amount.replace(/[$,A-Z\s]/g,'')) : 0;
  const discounted = value && amount ? (type==='percent' ? amount*(1-parseFloat(value)/100) : amount-parseFloat(value)) : null;
  function save() {
    if (!value) return;
    setSaved(true);
    setTimeout(() => { onSave(`Discount applied to ${quote?.num || 'quote'}`); onClose(); }, 900);
  }
  return (
    <Modal title="Apply Discount" onClose={onClose}>
      {saved ? (
        <div className="pur-success"><svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><div>Discount applied!</div></div>
      ) : (
        <>
          {quote && <div className="pur-detail-row" style={{marginBottom:'16px'}}><span>Applying to</span><strong>{quote.num} — {quote.amount}</strong></div>}
          <div className="pur-form-group">
            <label>Discount Type</label>
            <div style={{display:'flex',gap:'10px',marginTop:'6px'}}>
              <label className={`pur-radio${type==='percent'?' selected':''}`} onClick={()=>setType('percent')}><input type="radio" checked={type==='percent'} readOnly style={{accentColor:'#7c3aed'}}/> Percentage (%)</label>
              <label className={`pur-radio${type==='fixed'?' selected':''}`} onClick={()=>setType('fixed')}><input type="radio" checked={type==='fixed'} readOnly style={{accentColor:'#7c3aed'}}/> Fixed Amount</label>
            </div>
          </div>
          <div className="pur-form-group">
            <label>{type==='percent' ? 'Discount %' : 'Discount Amount'}</label>
            <input type="number" placeholder={type==='percent' ? 'e.g. 10' : 'e.g. 500'} value={value} onChange={e=>setValue(e.target.value)}/>
          </div>
          {discounted !== null && discounted > 0 && (
            <div className="pur-total-row">New Total: <strong>${discounted.toLocaleString('en-US',{minimumFractionDigits:2})}</strong></div>
          )}
          <div className="pur-form-group"><label>Reason</label><input type="text" placeholder="e.g. Volume deal, loyalty discount" value={reason} onChange={e=>setReason(e.target.value)}/></div>
          <div className="pur-modal-actions">
            <button className="pur-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="pur-btn-primary" onClick={save}>Apply Discount</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function QuoteDetailModal({ quote, onClose, onSend, onConvert, onDiscount, onAccept, onReject, onPdf }) {
  const st = quote._apiStatus || quote.status?.toLowerCase();
  return (
    <Modal title={`${quote.num} — Details`} onClose={onClose}>
      <div className="pur-detail-row"><span>Client</span><strong>{quote.client}</strong></div>
      <div className="pur-detail-row"><span>Subject</span><strong>{quote.desc}</strong></div>
      <div className="pur-detail-row"><span>Amount</span><strong style={{color:'#16a34a',fontSize:'16px'}}>{quote.amount}</strong></div>
      <div className="pur-detail-row"><span>Status</span><span style={{background:quote.statusBg,color:quote.statusColor,fontSize:'12px',fontWeight:600,padding:'2px 10px',borderRadius:'12px'}}>{quote.status}</span></div>
      <div className="pur-detail-row"><span>Dates</span><strong style={{color:'#6b7280',fontSize:'12.5px'}}>{quote.dates}</strong></div>
      <div className="pur-detail-row"><span>Notes</span><strong style={{color:'#6b7280',fontSize:'12.5px'}}>{quote.notes}</strong></div>
      <div className="pur-modal-actions" style={{marginTop:'20px',flexWrap:'wrap',gap:'8px'}}>
        <button className="pur-btn-cancel" onClick={onClose}>Close</button>
        {quote.id && (
          <button className="pur-btn-secondary" onClick={()=>{onClose();onPdf(quote);}}>
            Download PDF
          </button>
        )}
        {/* DRAFT: send to client + apply discount */}
        {quote.id && st==='draft' && (
          <>
            <button className="pur-btn-secondary" onClick={()=>{onClose();onDiscount(quote);}}>Apply Discount</button>
            <button className="pur-btn-primary" onClick={()=>{onClose();onSend(quote);}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'4px'}}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Send to Client
            </button>
          </>
        )}
        {/* SENT: accept or reject */}
        {quote.id && st==='sent' && (
          <>
            <button className="pur-btn-secondary" style={{color:'#16a34a',borderColor:'#16a34a'}} onClick={()=>{onClose();onAccept(quote);}}>Mark Accepted</button>
            <button className="pur-btn-secondary" style={{color:'#b91c1c',borderColor:'#b91c1c'}} onClick={()=>{onClose();onReject(quote);}}>Mark Rejected</button>
          </>
        )}
        {/* ACCEPTED: convert to order */}
        {quote.id && st==='accepted' && (
          <button className="pur-btn-primary" onClick={()=>{onClose();onConvert(quote);}}>Convert to Order</button>
        )}
        {/* CONVERTED: read-only badge */}
        {st==='converted' && (
          <span style={{fontSize:'12px',fontWeight:600,color:'#7c3aed',background:'#f5f3ff',padding:'4px 12px',borderRadius:'12px',border:'1px solid #ddd8fe'}}>Converted</span>
        )}
      </div>
    </Modal>
  );
}

/* ─── KPI Drawer ─── */
const KPI_DETAILS = {
  revenue:    { title:'Revenue Breakdown',     rows:[{label:'Software',value:'$1.8M',color:'#3b82f6'},{label:'Services',value:'$1.2M',color:'#10b981'},{label:'Custom Dev',value:'$1.2M',color:'#7c3aed'}], note:'18% growth vs last month.' },
  orders:     { title:'Orders by Product',      rows:[{label:'Software',value:'72',color:'#2563eb'},{label:'Services',value:'48',color:'#16a34a'},{label:'Development',value:'36',color:'#7c3aed'}], note:'24% increase vs last month.' },
};
function KpiDrawer({ type, onClose }) {
  const d = KPI_DETAILS[type]; if (!d) return null;
  return (
    <div className="kpi-drawer" onClick={e=>e.stopPropagation()}>
      <div className="kpi-drawer-header"><span className="kpi-drawer-title">{d.title}</span><button className="kpi-drawer-close" onClick={onClose}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
      {d.rows.map(r=><div key={r.label} className="kpi-drawer-row"><div className="kpi-drawer-dot" style={{background:r.color}}></div><span className="kpi-drawer-label">{r.label}</span><span className="kpi-drawer-val">{r.value}</span></div>)}
      <div className="kpi-drawer-note">{d.note}</div>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
const STATUS_META = {
  draft:     { label:'Draft',     bg:'#f3f4f6', color:'#374151' },
  sent:      { label:'Sent',      bg:'#dbeafe', color:'#1d4ed8' },
  accepted:  { label:'Accepted',  bg:'#dcfce7', color:'#15803d' },
  rejected:  { label:'Rejected',  bg:'#fee2e2', color:'#b91c1c' },
  converted: { label:'Converted', bg:'#f5f3ff', color:'#7c3aed' },
};

function normalizeApiQuote(q) {
  const sym = { SAR:'SAR ', USD:'$', EUR:'€', GBP:'£', AED:'AED ' }[q.currency] ?? '';
  const meta = STATUS_META[q.status] ?? STATUS_META.draft;
  const created = new Date(q.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  return {
    id: q.id,
    num: q.quote_number,
    _apiStatus: q.status,
    client: q.customer_name || 'Unknown Company',
    desc: q.subject || 'Sales Quotation',
    amount: `${sym}${Number(q.total).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}`,
    status: meta.label,
    statusBg: meta.bg,
    statusColor: meta.color,
    dates: `Created: ${created}${q.validity ? ` · Valid ${q.validity} days` : ''}`,
    notes: [q.payment_terms, q.delivery_location].filter(Boolean).join(' · '),
  };
}

const FUNNEL     = [
  { label:'Prospects',   count:'248 leads',    pct:'80%', color:'#3b82f6' },
  { label:'Qualified',   count:'186 qualified', pct:'60%', color:'#f59e0b' },
  { label:'Proposals',   count:'92 proposals',  pct:'38%', color:'#f97316' },
  { label:'Negotiation', count:'61 in talks',   pct:'25%', color:'#10b981' },
  { label:'Closed Won',  count:'42 closed',     pct:'15%', color:'#16a34a' },
];

export default function Sales({ goPage, onLogout }) {
  const [builderOpen, setBuilderOpen]       = useState(false);
  const builderRef                          = useRef(null);
  const [quotes, setQuotes]                 = useState([]);
  const [statusFilter, setStatusFilter]     = useState('all');
  const [search, setSearch]                 = useState('');
  const [quoteDetail, setQuoteDetail]       = useState(null);
  const [discountQuote, setDiscountQuote]   = useState(null);
  const [openKpi, setOpenKpi]               = useState(null);
  const [toast, setToast]                   = useState(null);
  const [totalRevenue, setTotalRevenue]     = useState(null);
  const [activeQuotes, setActiveQuotes]     = useState(null);
  const [conversionRate, setConversionRate] = useState(null);
  const [tasks, setTasks]                   = useState([
    { id:1, text:'Follow up with Enterprise Corp', due:'Today 3:00 PM',     done:false, color:'#fffbeb', border:'#fde68a' },
    { id:2, text:'Prepare demo for RetailChain',   due:'Tomorrow 10:00 AM', done:false, color:'#eff6ff', border:'#bfdbfe' },
    { id:3, text:'Send proposal to TechStart',     due:'Completed',         done:true },
  ]);
  const [newTask, setNewTask]               = useState('');
  const [showTaskInput, setShowTaskInput]   = useState(false);

  function getToken() { return localStorage.getItem('token'); }

  function handleAuthError() {
    showToast('Session expired — please log in again');
    if (onLogout) onLogout();
  }

  function showToast(msg) { setToast(msg); }
  function toggleKpi(k)   { setOpenKpi(p => p === k ? null : k); }

  function openBuilder() {
    setBuilderOpen(true);
    setTimeout(() => builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetch('/api/v1/sales/quotations', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (r.status === 401) { handleAuthError(); return null; }
        return r.ok ? r.json() : null;
      })
      .then(data => {
        if (data?.items) setQuotes(data.items.map(normalizeApiQuote));
      })
      .catch(() => {});

    fetch('/api/v1/dashboard/sales', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data != null) {
          setTotalRevenue(data.total_revenue);
          setActiveQuotes(data.active_quotes);
          setConversionRate(data.conversion_rate);
        }
      })
      .catch(() => {});
  }, []);

  function addQuote(q) {
    setQuotes(p => [q, ...p]);
  }

  function replaceQuote(updated) {
    setQuotes(p => p.map(q => q.id === updated.id ? updated : q));
  }

  async function callStatusEndpoint(quote, endpoint, toastMsg) {
    const token = getToken();
    if (!quote.id || !token) { showToast('Not logged in'); return; }
    try {
      const res = await fetch(`/api/v1/sales/quotations/${quote.id}/${endpoint}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401) { handleAuthError(); return; }
      if (res.ok) {
        const data = await res.json();
        replaceQuote(normalizeApiQuote(data));
        showToast(toastMsg);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Action failed');
      }
    } catch { showToast('Network error'); }
  }

  function sendToClient(quote)  { callStatusEndpoint(quote, 'send',   'Quotation sent to client'); }
  function acceptQuote(quote)   { callStatusEndpoint(quote, 'accept', 'Quotation marked as Accepted'); }
  function rejectQuote(quote)   { callStatusEndpoint(quote, 'reject', 'Quotation marked as Rejected'); }

  async function convertToOrder(quote) {
    const token = getToken();
    if (!quote.id || !token) { showToast('Cannot convert — not logged in'); return; }
    try {
      const res = await fetch(`/api/v1/sales/quotations/${quote.id}/convert`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401) { handleAuthError(); return; }
      if (res.ok) {
        const order = await res.json();
        replaceQuote({ ...quote, _apiStatus:'converted', status:'Converted', statusBg:'#f5f3ff', statusColor:'#7c3aed' });
        showToast(`Sales Order ${order.order_number} created`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Conversion failed');
      }
    } catch { showToast('Network error — conversion failed'); }
  }

  async function downloadPdf(quote) {
    const token = getToken();
    if (!quote.id || !token) { showToast('Cannot generate PDF — not logged in'); return; }
    showToast('Generating PDF…');
    try {
      const res = await fetch(`/api/v1/sales/quotations/${quote.id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401) { handleAuthError(); return; }
      if (res.ok) {
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${quote.num}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        showToast('PDF generation failed');
      }
    } catch { showToast('Network error — PDF not downloaded'); }
  }

  function toggleTask(id) { setTasks(p => p.map(t => t.id === id ? { ...t, done: !t.done } : t)); }
  function addTask() {
    if (!newTask.trim()) return;
    setTasks(p => [...p, { id: Date.now(), text: newTask, due: 'No due date', done: false, color: '#f9fafb', border: '#e5e7eb' }]);
    setNewTask(''); setShowTaskInput(false);
  }

  const STATUS_FILTERS = ['all', 'draft', 'sent', 'accepted', 'rejected', 'converted'];

  const filtered = quotes.filter(q => {
    const matchStatus = statusFilter === 'all' || q._apiStatus === statusFilter;
    const matchSearch = search === '' ||
      q.client.toLowerCase().includes(search.toLowerCase()) ||
      q.num.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div id="sales-page">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      {discountQuote && <ApplyDiscountModal quote={discountQuote} onClose={() => setDiscountQuote(null)} onSave={showToast} />}
      {quoteDetail   && <QuoteDetailModal
        quote={quoteDetail}
        onClose={() => setQuoteDetail(null)}
        onSend={q    => sendToClient(q)}
        onConvert={q => convertToOrder(q)}
        onDiscount={setDiscountQuote}
        onAccept={q  => acceptQuote(q)}
        onReject={q  => rejectQuote(q)}
        onPdf={q     => downloadPdf(q)}
      />}

      <Sidebar activePage="sales" goPage={goPage} />
      <div className="db-main">
        {/* Top bar */}
        <div className="tb">
          <span className="tb-title"></span>
          <div className="tb-right">
            <div className="tb-bell"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <div className="tb-user"><div className="tb-avatar" style={{background:'linear-gradient(135deg,#16a34a,#10b981)'}}>SJ</div><div><div className="tb-uname">Sarah Johns</div><div className="tb-urole">Administrator</div></div></div>
          </div>
        </div>

        <div className="pg">
          {/* Page header */}
          <div className="pg-header">
            <div className="pg-header-left"><h1>Sales</h1><p>Manage quotations, sales orders, and track revenue pipeline</p></div>
            <div className="pg-header-actions">
              <button className="btn-action btn-blue" onClick={openBuilder}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New Quote
              </button>
              <button className="btn-action btn-green" onClick={() => { const a = quotes.find(q => q._apiStatus==='accepted'); a ? convertToOrder(a) : showToast('No accepted quotes to convert'); }}>
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Convert to Order
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="kpi-row" style={{marginBottom:'20px'}}>
            {[
              {key:'revenue',    label:'Total Revenue',     value:fmtRevenue(totalRevenue), icon:<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, cls:'ic-g', note:'From confirmed sales orders'},
              {key:'quotes',     label:'Active Quotes',     value:activeQuotes ?? '—', icon:<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, cls:'ic-b', note:'Draft, sent & accepted'},
              {key:'orders',     label:'Orders This Month', value:'156',   icon:<svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>, cls:'ic-o', chg:'24% vs last month', up:true},
              {key:'conversion', label:'Conversion Rate',   value:conversionRate != null ? `${conversionRate.toFixed(1)}%` : '—', icon:<svg viewBox="0 0 24 24"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>, cls:'ic-p', note:'Quotations converted to orders'},
            ].map(k => (
              <div key={k.key} className={`kpi kpi-clickable${openKpi===k.key?' kpi-active':''}`} onClick={() => toggleKpi(k.key)}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-body"><div className="kpi-value">{k.value}</div><div className={`kpi-icon ${k.cls}`}>{k.icon}</div></div>
                {k.chg ? <div className={`kpi-chg ${k.up?'up':'dn'}`}><svg viewBox="0 0 24 24">{k.up?<polyline points="18 15 12 9 6 15"/>:<polyline points="6 9 12 15 18 9"/>}</svg>{k.chg}</div>
                       : <div style={{fontSize:'13px',fontWeight:500,color:'#2563eb',marginTop:'6px'}}>{k.note}</div>}
                {openKpi===k.key && <KpiDrawer type={k.key} onClose={e=>{e.stopPropagation();setOpenKpi(null);}} />}
              </div>
            ))}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:'18px',alignItems:'start'}}>
            {/* Left column */}
            <div>
              {/* Sales Funnel */}
              <div className="pur-tab-card" style={{marginBottom:'16px'}}>
                <div style={{fontSize:'15px',fontWeight:700,color:'#111827',marginBottom:'20px'}}>Sales Funnel</div>
                {FUNNEL.map(f => (
                  <div key={f.label} style={{display:'flex',alignItems:'center',gap:'14px',marginBottom:'14px'}}>
                    <div style={{width:'12px',height:'12px',borderRadius:'50%',background:f.color,flexShrink:0}}></div>
                    <div style={{width:'130px',fontSize:'13.5px',color:'#374151'}}>{f.label}</div>
                    <div style={{flex:1,height:'8px',background:'#f3f4f6',borderRadius:'4px',overflow:'hidden'}}><div style={{width:f.pct,height:'100%',background:f.color,borderRadius:'4px'}}></div></div>
                    <div style={{fontSize:'13px',color:'#6b7280',width:'100px',textAlign:'right'}}>{f.count}</div>
                  </div>
                ))}
              </div>

              {/* ── Collapsible Quotation Builder ── */}
              <div ref={builderRef} className="sqb-collapse-card">
                <div
                  className={`sqb-collapse-head${builderOpen ? ' open' : ''}`}
                  onClick={() => setBuilderOpen(p => !p)}
                >
                  <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                    <div className="sqb-badge">Q</div>
                    <span style={{fontSize:'14px',fontWeight:700,color:'#111827'}}>Quotation Builder</span>
                    {!builderOpen && (
                      <span style={{fontSize:'12px',color:'#9ca3af',fontWeight:400,marginLeft:'4px'}}>
                        Click to expand and create a new quotation
                      </span>
                    )}
                  </div>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{transform: builderOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform .2s', flexShrink:0}}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
                {builderOpen && (
                  <div className="sqb-collapse-body">
                    <QuotationBuilder
                      onClose={() => setBuilderOpen(false)}
                      onCreate={addQuote}
                      showToast={showToast}
                      onAuthError={handleAuthError}
                    />
                  </div>
                )}
              </div>

              {/* Quotation list */}
              <div className="pur-tab-card" style={{overflow:'hidden',padding:0}}>
                <div style={{padding:'20px 22px 12px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>Recent Quotations</span>
                  <span style={{fontSize:'12px',color:'#9ca3af'}}>{filtered.length} of {quotes.length}</span>
                </div>

                {/* Status filter pills */}
                <div style={{display:'flex',gap:'6px',padding:'0 22px 12px',flexWrap:'wrap'}}>
                  {STATUS_FILTERS.map(f => {
                    const meta = f === 'all' ? null : STATUS_META[f];
                    const active = statusFilter === f;
                    return (
                      <button key={f} onClick={() => setStatusFilter(f)} style={{
                        padding:'3px 10px', borderRadius:'12px', border:'1px solid',
                        fontSize:'12px', fontWeight:active?700:500, cursor:'pointer',
                        background: active ? (meta?.bg ?? '#111827') : '#fff',
                        color:      active ? (meta?.color ?? '#fff') : '#6b7280',
                        borderColor: active ? (meta?.color ?? '#111827') : '#e5e7eb',
                      }}>
                        {f === 'all' ? 'All' : (meta?.label ?? f)}
                      </button>
                    );
                  })}
                </div>

                {/* Search */}
                <div style={{padding:'0 22px 12px',borderBottom:'1px solid #f3f4f6'}}>
                  <div style={{position:'relative'}}>
                    <svg style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',width:'14px',height:'14px',stroke:'#9ca3af',fill:'none'}} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input style={{width:'100%',height:'36px',border:'1px solid #e5e7eb',borderRadius:'8px',padding:'0 14px 0 34px',fontSize:'13.5px',color:'#374151',outline:'none',boxSizing:'border-box'}} placeholder="Search by company or quote number…" value={search} onChange={e => setSearch(e.target.value)}/>
                  </div>
                </div>

                {filtered.length === 0 && (
                  <div style={{padding:'32px',textAlign:'center',color:'#9ca3af',fontSize:'13.5px'}}>
                    {quotes.length === 0 ? 'No quotations yet. Click "+ New Quote" to create one.' : `No quotes match the current filter.`}
                  </div>
                )}

                {filtered.map(q => (
                  <div key={q.num} style={{padding:'16px 22px',borderBottom:'1px solid #f3f4f6',cursor:'pointer',transition:'background .1s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#fafafa'}
                    onMouseLeave={e=>e.currentTarget.style.background=''}
                    onClick={() => setQuoteDetail(q)}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'4px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        <span style={{fontSize:'13.5px',fontWeight:700,color:'#111827'}}>{q.num}</span>
                        <span style={{background:q.statusBg,color:q.statusColor,fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'12px'}}>{q.status}</span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                        <span style={{fontSize:'14px',fontWeight:700,color:'#111827'}}>{q.amount}</span>
                        {q._apiStatus==='draft' && q.id && (
                          <button style={{fontSize:'12.5px',fontWeight:600,color:'#2563eb',background:'none',border:'none',cursor:'pointer',padding:0}}
                            onClick={e=>{e.stopPropagation();sendToClient(q);}}>Send →</button>
                        )}
                        {q._apiStatus==='sent' && (
                          <>
                            <button style={{fontSize:'12.5px',fontWeight:600,color:'#16a34a',background:'none',border:'none',cursor:'pointer',padding:0}}
                              onClick={e=>{e.stopPropagation();acceptQuote(q);}}>Accept</button>
                            <button style={{fontSize:'12.5px',fontWeight:600,color:'#b91c1c',background:'none',border:'none',cursor:'pointer',padding:0}}
                              onClick={e=>{e.stopPropagation();rejectQuote(q);}}>Reject</button>
                          </>
                        )}
                        {q._apiStatus==='accepted' && (
                          <button style={{fontSize:'12.5px',fontWeight:600,color:'#7c3aed',background:'none',border:'none',cursor:'pointer',padding:0}}
                            onClick={e=>{e.stopPropagation();convertToOrder(q);}}>Convert →</button>
                        )}
                        {q.id && (
                          <button style={{fontSize:'12.5px',fontWeight:600,color:'#6b7280',background:'none',border:'none',cursor:'pointer',padding:0}}
                            onClick={e=>{e.stopPropagation();downloadPdf(q);}}>PDF</button>
                        )}
                      </div>
                    </div>
                    <div style={{fontSize:'13px',color:'#374151',marginBottom:'2px',fontWeight:500}}>{q.client}</div>
                    <div style={{fontSize:'12px',color:'#6b7280',marginBottom:'2px'}}>{q.desc}</div>
                    <div style={{fontSize:'11.5px',color:'#9ca3af'}}>{q.dates}{q.notes ? ` · ${q.notes}` : ''}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right sidebar */}
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              <div className="pur-tab-card">
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'14px'}}>Quick Actions</div>
                <button className="pur-sidebar-btn pur-sidebar-btn-blue" onClick={openBuilder}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New Quotation
                </button>
                <button className="pur-sidebar-btn pur-sidebar-btn-green" onClick={() => { const a = quotes.find(q => q._apiStatus==='accepted'); a ? convertToOrder(a) : showToast('No accepted quotes to convert'); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Convert to Order
                </button>
                <button className="pur-sidebar-btn pur-sidebar-btn-outline" onClick={() => { const f = quotes.find(q=>q._apiStatus==='draft'); f ? setDiscountQuote(f) : showToast('No draft quotes available'); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>Apply Discount
                </button>
              </div>

              <div className="pur-tab-card">
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'14px'}}>Top Products</div>
                {[
                  {label:'Software Licenses', sub:'Enterprise Solutions', val:'$245K', grow:'↗ 22%', color:'#dbeafe', ic:'#2563eb'},
                  {label:'Marketing Services', sub:'Digital & Traditional', val:'$189K', grow:'↗ 18%', color:'#dcfce7', ic:'#16a34a'},
                  {label:'Custom Development', sub:'Web & Mobile Apps',    val:'$156K', grow:'↗ 35%', color:'#f5f3ff', ic:'#7c3aed'},
                ].map(p => (
                  <div key={p.label} style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'12px'}}>
                    <div style={{width:'34px',height:'34px',background:p.color,borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={p.ic} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                    </div>
                    <div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:600,color:'#111827'}}>{p.label}</div><div style={{fontSize:'12px',color:'#9ca3af'}}>{p.sub}</div></div>
                    <div style={{textAlign:'right'}}><div style={{fontSize:'13px',fontWeight:700,color:'#111827'}}>{p.val}</div><div style={{fontSize:'12px',color:'#16a34a'}}>{p.grow}</div></div>
                  </div>
                ))}
              </div>

              {/* Discount Rules */}
              <div className="pur-tab-card">
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'14px'}}>Discount Rules</div>
                {[
                  { label:'Volume Discount',  sub:'Orders above $50K',       val:'10-25%', color:'#16a34a' },
                  { label:'Early Bird',       sub:'Payment within 7 days',   val:'15%',    color:'#16a34a' },
                  { label:'Loyalty Program',  sub:'Based on customer tier',  val:'5-20%',  color:'#7c3aed' },
                ].map(r => (
                  <div key={r.label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid #f3f4f6'}}>
                    <div>
                      <div style={{fontSize:'13px',fontWeight:600,color:'#111827'}}>{r.label}</div>
                      <div style={{fontSize:'12px',color:'#9ca3af',marginTop:'1px'}}>{r.sub}</div>
                    </div>
                    <span style={{fontSize:'13px',fontWeight:700,color:r.color}}>{r.val}</span>
                  </div>
                ))}
                <button style={{width:'100%',height:'34px',background:'#fff',color:'#374151',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'13px',fontWeight:500,cursor:'pointer',marginTop:'12px'}}
                  onClick={() => showToast('Discount Rules management — coming soon')}>
                  Manage Rules
                </button>
              </div>

              {/* Fulfillment Status */}
              <div className="pur-tab-card">
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'14px'}}>Fulfillment Status</div>
                {[
                  { id:'SO-2024-089', sub:'Delivered',  icon:'✓', bg:'#dcfce7', ic:'#16a34a' },
                  { id:'SO-2024-088', sub:'In Transit', icon:'✓', bg:'#dbeafe', ic:'#2563eb' },
                  { id:'SO-2024-087', sub:'Processing', icon:'◔', bg:'#fef9c3', ic:'#a16207' },
                ].map(s => (
                  <div key={s.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid #f3f4f6'}}>
                    <div>
                      <div style={{fontSize:'13px',fontWeight:600,color:'#111827'}}>{s.id}</div>
                      <div style={{fontSize:'12px',color:'#9ca3af',marginTop:'1px'}}>{s.sub}</div>
                    </div>
                    <div style={{width:'26px',height:'26px',borderRadius:'50%',background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',color:s.ic,fontWeight:700}}>
                      {s.icon}
                    </div>
                  </div>
                ))}
                <button style={{width:'100%',height:'34px',background:'#fff',color:'#374151',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'13px',fontWeight:500,cursor:'pointer',marginTop:'12px'}}
                  onClick={() => showToast('Orders view — coming soon')}>
                  View All Orders
                </button>
              </div>

              <div className="pur-tab-card">
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'14px'}}>Follow-up Tasks</div>
                {tasks.map(t => (
                  <div key={t.id} style={{padding:'11px 12px',borderRadius:'9px',background:t.done?'#f9fafb':t.color,border:`1px solid ${t.done?'#e5e7eb':t.border}`,marginBottom:'8px',display:'flex',alignItems:'flex-start',gap:'10px',opacity:t.done?0.6:1}}>
                    <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} style={{marginTop:'2px',accentColor:'#7c3aed'}}/>
                    <div><div style={{fontSize:'13px',fontWeight:600,color:'#111827',textDecoration:t.done?'line-through':'none'}}>{t.text}</div><div style={{fontSize:'12px',color:'#9ca3af',marginTop:'1px'}}>{t.due}</div></div>
                  </div>
                ))}
                {showTaskInput ? (
                  <div style={{display:'flex',gap:'6px',marginBottom:'8px'}}>
                    <input style={{flex:1,height:'34px',border:'1px solid #e5e7eb',borderRadius:'8px',padding:'0 10px',fontSize:'13px',outline:'none'}} placeholder="Task description…" value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTask()} autoFocus/>
                    <button className="pur-btn-primary" style={{height:'34px',padding:'0 12px',fontSize:'12.5px'}} onClick={addTask}>Add</button>
                  </div>
                ) : (
                  <button style={{width:'100%',height:'34px',background:'#fff',color:'#374151',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'13px',fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}} onClick={() => setShowTaskInput(true)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Task
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
