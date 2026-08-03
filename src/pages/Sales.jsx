import { API_BASE } from '../config.js';
/**
 * src/pages/Sales.jsx
 *
 * Sales module. Manages the full quotation-to-order lifecycle:
 *
 *   Quotations tab:
 *     - Collapsible inline QuotationBuilder (header, customer, line items,
 *       remarks/terms) with Save Draft / Send to Client actions.
 *     - Quotation list with status filter pills and search.
 *     - Per-quote actions: Send, Accept, Reject, Convert to Order, Download PDF.
 *     - Apply Discount modal.
 *
 *   Orders tab:
 *     - Sales orders table with status transitions:
 *       Confirmed → Shipped → Delivered.
 *     - Order detail modal showing line items and financials.
 *
 *   Right sidebar:
 *     - Quick Actions, Top Products, Discount Rules,
 *       Fulfillment Status, Follow-up Tasks.
 *
 * API base: /api/v1/sales/
 * Auth:     Bearer token stored in localStorage under key "token".
 */

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Toast   from '../components/ui/Toast';
import Modal   from '../components/ui/Modal';
import ActivityTimeline from '../components/ui/ActivityTimeline';
import { CURRENCY_SYMBOLS, LINE_ITEM_UNITS, PRODUCT_ICON_COLORS }
  from '../constants';
import { fmt, fmtRevenue, genQuoteNo } from '../utils/format';
import { NewProductPage, ProductDetailPage } from '../components/products/ProductPages';
import { AnalysisBarLineChart, AnalysisPieChart } from '../components/reports/AnalysisCharts';
import '../styles/Sales.css';

/* ─── Line item factory ─────────────────────────────────────────── */

/** Returns a blank line-item row with a unique id. seed avoids id collisions. */
function makeRow(seed = 0) {
  return {
    id:          Date.now() + seed + Math.random(),
    catalogNo:   '',
    name:        '',
    description: '',
    qty:         1,
    unit:        'EA',
    unitPrice:   '',
    discount:    '',
  };
}

/* ─── Field wrapper ─────────────────────────────────────────────── */
/** Labelled grid cell used inside QuotationBuilder section cards. */
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
   Four-section form: Header → Customer → Line Items → Remarks & Terms.
   On submit it POST-s to /api/v1/sales/quotations and optionally PUT-s
   /…/{id}/send to email the PDF to the client in the same flow.
════════════════════════════════════════ */
const QuotationBuilder = forwardRef(function QuotationBuilder({ onClose, onCreate, showToast, onAuthError }, ref) {
  const today = new Date().toISOString().slice(0, 10);

  const [header, setHeader] = useState({
    quoteNo: genQuoteNo(),
    date: today,
    currency: 'SAR',
    deliveryTime: '',
    deliveryDate: '',
    deliveryLocation: '',
    paymentTerms: 'Net 30',
    validity: '30',
    oem: '',
    dateReceived: '',
    deadline: '',
  });
  const [customer, setCustomer] = useState({
    company: '', department: '', contact: '', phone: '', fax: '', email: '', cc: '', yourRef: '', subject: '',
    invoiceAddress: '', deliveryAddress: '',
  });
  const [items, setItems] = useState([makeRow(0), makeRow(1), makeRow(2)]);
  const [focusRowId, setFocusRowId] = useState(null);
  const [crmLeadId, setCrmLeadId] = useState('');
  const [crmLeads, setCrmLeads] = useState([]);
  const [rfqId, setRfqId] = useState('');
  const [rfqs, setRfqs] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`${API_BASE}/api/v1/crm/leads`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setCrmLeads(Array.isArray(d) ? d : d.items ?? []))
      .catch(() => {});
    fetch(`${API_BASE}/api/v1/rfqs`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setRfqs(Array.isArray(d) ? d : d.items ?? []))
      .catch(() => {});
  }, []);

  const selectedRfq = rfqs.find(r => r.id === rfqId);
  const [remarks, setRemarks] = useState(
    'Thank you for the opportunity to submit this quotation. We look forward to your favourable response and remain available for any clarifications or additional information required.'
  );
  const [terms, setTerms] = useState(
    '1. All prices are exclusive of VAT unless stated otherwise.\n2. Payment is due within the agreed payment terms from invoice date.\n3. Delivery times are estimates and not guaranteed.\n4. This quotation is valid for the period stated above.\n5. Prices are subject to change without notice after the validity period.'
  );

  const sym = CURRENCY_SYMBOLS[header.currency] ?? '';
  const expirationDate = new Date(new Date(header.date).getTime() + Number(header.validity) * 86400000)
    .toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

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

    const shouldSend = statusLabel !== 'Draft';

    if (shouldSend && !customer.email.trim()) {
      showToast('Client email is required to send the quotation');
      return;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim());
    if (shouldSend && !emailOk) {
      showToast('Invalid email address — please check the client email');
      return;
    }

    const payload = {
      date: header.date,
      currency: header.currency,
      validity: header.validity,
      delivery_time: header.deliveryTime.trim() || null,
      delivery_date: header.deliveryDate || null,
      delivery_location: header.deliveryLocation.trim() || null,
      payment_terms: header.paymentTerms || null,
      customer_name: customer.company.trim() || null,
      department: customer.department.trim() || null,
      contact_person: customer.contact.trim() || null,
      phone: customer.phone.trim() || null,
      fax: customer.fax.trim() || null,
      email: customer.email.trim() || null,
      cc: customer.cc.trim() || null,
      your_ref: customer.yourRef.trim() || null,
      subject: customer.subject.trim() || 'Sales Quotation',
      invoice_address: customer.invoiceAddress.trim() || null,
      delivery_address: customer.deliveryAddress.trim() || null,
      remarks: remarks.trim() || null,
      terms: terms.trim() || null,
      oem: header.oem.trim() || null,
      date_received: header.dateReceived || null,
      deadline: header.deadline || null,
      crm_lead_id: crmLeadId || null,
      rfq_id: rfqId || null,
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
      const res = await fetch(`${API_BASE}/api/v1/sales/quotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { showToast('Session expired — please log in again and retry'); return; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(typeof err.detail === 'string' ? err.detail : 'Failed to save quotation');
        return;
      }
      const serverQuote = await res.json();

      if (shouldSend) {
        const sendRes = await fetch(`${API_BASE}/api/v1/sales/quotations/${serverQuote.id}/send`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!sendRes.ok) {
          const err = await sendRes.json().catch(() => ({}));
          const msg = typeof err.detail === 'string' ? err.detail : 'Quotation saved but email failed';
          onCreate(normalizeApiQuote(serverQuote));
          showToast(msg);
          onClose();
          return;
        }
        const sentQuote = await sendRes.json();
        onCreate(normalizeApiQuote(sentQuote));
        showToast('Quotation sent to client');
      } else {
        onCreate(normalizeApiQuote(serverQuote));
        showToast('Quotation saved as draft');
      }
      onClose();
    } catch {
      showToast('Network error — quotation not saved');
    }
  }

  useImperativeHandle(ref, () => ({
    saveDraft:     () => commit('Draft'),
    sendToClient:  () => commit('Pending'),
  }));

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
            <input
              className="sqb-inp sqb-inp-mono"
              readOnly
              value={selectedRfq ? `QT${selectedRfq.rfq_number}` : header.quoteNo}
            />
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
          <SField label="Expiration">
            <input className="sqb-inp sqb-inp-mono" readOnly value={expirationDate} />
          </SField>
          <SField label="Delivery Time">
            <input className="sqb-inp" placeholder="e.g. 2–4 weeks" value={header.deliveryTime} onChange={e => setH('deliveryTime', e.target.value)} />
          </SField>
          <SField label="Delivery Date">
            <input className="sqb-inp" type="date" value={header.deliveryDate} onChange={e => setH('deliveryDate', e.target.value)} />
          </SField>
          <SField label="Delivery Location">
            <input className="sqb-inp" placeholder="e.g. Riyadh, Saudi Arabia" value={header.deliveryLocation} onChange={e => setH('deliveryLocation', e.target.value)} />
          </SField>
          <SField label="OEM">
            <input className="sqb-inp" placeholder="e.g. Thermo, HOKE, Servomex" value={header.oem} onChange={e => setH('oem', e.target.value)} />
          </SField>
          <SField label="Date Received">
            <input className="sqb-inp" type="date" value={header.dateReceived} onChange={e => setH('dateReceived', e.target.value)} />
          </SField>
          <SField label="Deadline">
            <input className="sqb-inp" type="date" value={header.deadline} onChange={e => setH('deadline', e.target.value)} />
          </SField>
          <SField label="Payment Terms">
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
          <SField label="Link to CRM Lead">
            <select className="sqb-inp sqb-sel" value={crmLeadId} onChange={e => setCrmLeadId(e.target.value)}>
              <option value="">— None —</option>
              {crmLeads.map(l => (
                <option key={l.id} value={l.id}>{l.company}{l.contact_person ? ` · ${l.contact_person}` : ''}</option>
              ))}
            </select>
          </SField>
          <SField label="Link to RFQ">
            <select className="sqb-inp sqb-sel" value={rfqId} onChange={e => setRfqId(e.target.value)}>
              <option value="">— None —</option>
              {rfqs.map(r => (
                <option key={r.id} value={r.id}>
                  {r.rfq_number}{r.customer_reference ? ` (Cust. Ref: ${r.customer_reference})` : ''}
                </option>
              ))}
            </select>
          </SField>
          {selectedRfq?.customer_reference && (
            <SField label="Customer RFQ Ref.">
              <input className="sqb-inp sqb-inp-mono" readOnly value={selectedRfq.customer_reference} />
            </SField>
          )}
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
          <SField label="Fax">
            <input className="sqb-inp" type="tel" placeholder="+966 13 000 0000" value={customer.fax} onChange={e => setC('fax', e.target.value)} />
          </SField>
          <SField label="Email *">
            <input className="sqb-inp" type="email" placeholder="contact@company.com" value={customer.email} onChange={e => setC('email', e.target.value)} />
          </SField>
          <SField label="CC">
            <input className="sqb-inp" type="email" placeholder="cc@company.com" value={customer.cc} onChange={e => setC('cc', e.target.value)} />
          </SField>
          <SField label="Your Ref.">
            <input className="sqb-inp" placeholder="e.g. RFQ# 4203218369" value={customer.yourRef} onChange={e => setC('yourRef', e.target.value)} />
          </SField>
          <SField label="Subject / Reference">
            <input className="sqb-inp" placeholder="e.g. Supply of Industrial Equipment" value={customer.subject} onChange={e => setC('subject', e.target.value)} />
          </SField>
          <SField label="Invoice Address" span2>
            <input className="sqb-inp" placeholder="Billing address, if different from below" value={customer.invoiceAddress} onChange={e => setC('invoiceAddress', e.target.value)} />
          </SField>
          <SField label="Delivery Address" span2>
            <input className="sqb-inp" placeholder="Shipping address" value={customer.deliveryAddress} onChange={e => setC('deliveryAddress', e.target.value)} />
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
                      {LINE_ITEM_UNITS.map(u => <option key={u}>{u}</option>)}
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
});

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

/* ─── Payment Modal ─── */
function PaymentModal({ quote, onClose, onPaid }) {
  const [step, setStep]             = useState('choose'); // choose | stripe | paypal | success | error
  const [errMsg, setErrMsg]         = useState('');
  const [ppScriptLoaded, setPpScriptLoaded] = useState(false);
  const [ppClientId, setPpClientId] = useState('');
  const paypalRef = useRef(null);

  function getToken() { return localStorage.getItem('token'); }

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/payments/config`)
      .then(r => r.json())
      .then(d => {
        window.__PAYPAL_CLIENT_ID__ = d.paypal_client_id || '';
        setPpClientId(d.paypal_client_id || '');
      })
      .catch(() => {});
  }, []);

  // ── Stripe ──────────────────────────────────────────────────────────────
  async function startStripe() {
    setStep('stripe');
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/payments/stripe/create-session?quotation_id=${quote.id}`,
        { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } }
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || 'Stripe session creation failed');
      }
      const { checkout_url } = await res.json();
      window.location.href = checkout_url;
    } catch (e) {
      setErrMsg(e.message);
      setStep('error');
    }
  }

  // ── PayPal ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'paypal') return;
    if (document.getElementById('paypal-sdk')) { setPpScriptLoaded(true); return; }
    const script = document.createElement('script');
    script.id = 'paypal-sdk';
    script.src = `https://www.paypal.com/sdk/js?client-id=${window.__PAYPAL_CLIENT_ID__ || 'sb'}&currency=${quote._currency || 'USD'}`;
    script.onload = () => setPpScriptLoaded(true);
    document.body.appendChild(script);
  }, [step]);

  useEffect(() => {
    if (step !== 'paypal' || !ppScriptLoaded || !paypalRef.current) return;
    paypalRef.current.innerHTML = '';
    window.paypal.Buttons({
      createOrder: async () => {
        const res = await fetch(
          `${API_BASE}/api/v1/payments/paypal/create-order?quotation_id=${quote.id}`,
          { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } }
        );
        if (!res.ok) throw new Error('Failed to create PayPal order');
        const { order_id } = await res.json();
        return order_id;
      },
      onApprove: async (data) => {
        const res = await fetch(`${API_BASE}/api/v1/payments/paypal/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ order_id: data.orderID, quotation_id: quote.id }),
        });
        if (!res.ok) throw new Error('PayPal capture failed');
        const result = await res.json();
        if (result.status === 'COMPLETED') { setStep('success'); onPaid(quote.id); }
        else { setErrMsg('PayPal payment not completed'); setStep('error'); }
      },
      onError: (err) => { setErrMsg(String(err)); setStep('error'); },
    }).render(paypalRef.current);
  }, [ppScriptLoaded, step]);

  const sym = CURRENCY_SYMBOLS[quote._currency] ?? '';

  return (
    <Modal title={`Pay — ${quote.num}`} onClose={onClose}>
      {step === 'choose' && (
        <>
          <div className="pur-detail-row"><span>Amount Due</span><strong style={{color:'#16a34a',fontSize:'16px'}}>{sym}{fmt(parseFloat((quote.amount||'0').replace(/[^0-9.]/g,'')))}</strong></div>
          <div className="pur-detail-row"><span>Quotation</span><strong>{quote.num}</strong></div>
          <p style={{color:'#6b7280',fontSize:'13px',margin:'12px 0'}}>Choose your preferred payment method to complete this transaction securely.</p>
          <div style={{display:'flex',flexDirection:'column',gap:'10px',marginTop:'8px'}}>
            <button className="pur-btn-primary" style={{justifyContent:'center',padding:'12px'}} onClick={startStripe}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'8px'}}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              Pay with Card (Stripe)
            </button>
            <button className="pur-btn-secondary" style={{justifyContent:'center',padding:'12px',color:'#003087',borderColor:'#003087'}} onClick={()=>setStep('paypal')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'8px'}}><path d="M7 11.5V14l-4.236 1.528A2 2 0 0 0 1.6 17.4l.9 2.7A2 2 0 0 0 4.4 21.4l10.8-3.9a2 2 0 0 0 1.3-1.9v-.1A3.5 3.5 0 0 0 13 12h-2.5"/><path d="M16 4.5V7l4.236 1.528A2 2 0 0 1 21.4 10.4l-.9 2.7a2 2 0 0 1-1.9 1.3H14a2 2 0 0 1-2-2v-1"/><circle cx="8" cy="8" r="3"/></svg>
              Pay with PayPal
            </button>
          </div>
          <div className="pur-modal-actions" style={{marginTop:'20px'}}>
            <button className="pur-btn-cancel" onClick={onClose}>Cancel</button>
          </div>
        </>
      )}
      {step === 'stripe' && (
        <div style={{textAlign:'center',padding:'32px 0'}}>
          <div className="sq-spinner" style={{margin:'0 auto 16px'}}/>
          <p style={{color:'#6b7280'}}>Redirecting to Stripe secure checkout…</p>
        </div>
      )}
      {step === 'paypal' && (
        <>
          <div className="pur-detail-row" style={{marginBottom:'12px'}}><span>Amount</span><strong style={{color:'#16a34a'}}>{sym}{fmt(parseFloat((quote.amount||'0').replace(/[^0-9.]/g,'')))}</strong></div>
          {!ppScriptLoaded && <p style={{color:'#6b7280',fontSize:'13px',textAlign:'center'}}>Loading PayPal…</p>}
          <div ref={paypalRef} style={{minHeight:'50px'}}/>
          <div className="pur-modal-actions" style={{marginTop:'16px'}}>
            <button className="pur-btn-cancel" onClick={()=>setStep('choose')}>← Back</button>
          </div>
        </>
      )}
      {step === 'success' && (
        <div className="pur-success">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div style={{fontWeight:700,fontSize:'16px'}}>Payment Successful!</div>
          <div style={{color:'#6b7280',fontSize:'13px'}}>Quotation {quote.num} has been marked as paid.</div>
          <button className="pur-btn-primary" style={{marginTop:'16px'}} onClick={onClose}>Close</button>
        </div>
      )}
      {step === 'error' && (
        <div style={{textAlign:'center',padding:'20px 0'}}>
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom:'12px'}}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <div style={{color:'#b91c1c',fontWeight:600,marginBottom:'8px'}}>Payment failed</div>
          <div style={{color:'#6b7280',fontSize:'13px',marginBottom:'16px'}}>{errMsg}</div>
          <div className="pur-modal-actions">
            <button className="pur-btn-cancel" onClick={()=>setStep('choose')}>Try Again</button>
            <button className="pur-btn-cancel" onClick={onClose}>Close</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function QuoteDetailModal({ quote, onClose, onSend, onConvert, onDiscount, onAccept, onReject, onPdf, onPay, onApprove, onSaveTracking }) {
  const st = quote._apiStatus || quote.status?.toLowerCase();
  const [editing, setEditing] = useState(false);
  const [oem, setOem] = useState(quote.oem || '');
  const [deadline, setDeadline] = useState(quote.deadline || '');
  const [followUpDate, setFollowUpDate] = useState(quote.followUpDate || '');
  const [outcome, setOutcome] = useState(quote.outcome || '');

  function save() {
    onSaveTracking({ oem: oem.trim() || null, deadline: deadline || null, follow_up_date: followUpDate || null, outcome: outcome.trim() || null });
    setEditing(false);
  }

  return (
    <Modal title={`${quote.num} — Details`} onClose={onClose}>
      <div className="pur-detail-row"><span>Client</span><strong>{quote.client}</strong></div>
      <div className="pur-detail-row"><span>Subject</span><strong>{quote.desc}</strong></div>
      <div className="pur-detail-row"><span>Amount</span><strong style={{color:'#16a34a',fontSize:'16px'}}>{quote.amount}</strong></div>
      <div className="pur-detail-row"><span>Status</span><span style={{background:quote.statusBg,color:quote.statusColor,fontSize:'12px',fontWeight:600,padding:'2px 10px',borderRadius:'12px'}}>{quote.status}</span></div>
      <div className="pur-detail-row"><span>Business Line</span><strong style={{color:'#6b7280'}}>{quote.businessLine}</strong></div>
      {quote.rfqNumber && (
        <div className="pur-detail-row"><span>RFQ</span><strong style={{color:'#2563eb'}}>{quote.rfqNumber}{quote.customerReference ? ` (Cust. Ref: ${quote.customerReference})` : ''}</strong></div>
      )}
      <div className="pur-detail-row"><span>Dates</span><strong style={{color:'#6b7280',fontSize:'12.5px'}}>{quote.dates}</strong></div>
      <div className="pur-detail-row"><span>Created By</span><strong style={{color:'#6b7280',fontSize:'12.5px'}}>{quote.createdByName || '—'}</strong></div>
      <div className="pur-detail-row">
        <span>Approved By</span>
        <strong style={{color:quote.approvedByName ? '#16a34a' : '#6b7280',fontSize:'12.5px'}}>
          {quote.approvedByName || 'Not yet approved'}
        </strong>
      </div>
      <div className="pur-detail-row"><span>Notes</span><strong style={{color:'#6b7280',fontSize:'12.5px'}}>{quote.notes}</strong></div>

      {/* ── Tracker fields (OEM, Deadline, Follow-up, Outcome) ── */}
      {quote.id && (
        <div style={{ marginTop: '16px', padding: '14px 16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editing ? '12px' : '0' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#374151' }}>Tracking</span>
            {!editing && <button className="nrfq-btn-ghost" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setEditing(true)}>Edit</button>}
          </div>
          {editing ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#6b7280', marginBottom: '3px' }}>OEM</label>
                <input style={{ width: '100%', height: 32, border: '1px solid #d1d5db', borderRadius: 6, padding: '0 8px', fontSize: '12.5px', boxSizing: 'border-box' }} value={oem} onChange={e => setOem(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#6b7280', marginBottom: '3px' }}>Deadline</label>
                <input type="date" style={{ width: '100%', height: 32, border: '1px solid #d1d5db', borderRadius: 6, padding: '0 8px', fontSize: '12.5px', boxSizing: 'border-box' }} value={deadline} onChange={e => setDeadline(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#6b7280', marginBottom: '3px' }}>Follow-up Date</label>
                <input type="date" style={{ width: '100%', height: 32, border: '1px solid #d1d5db', borderRadius: 6, padding: '0 8px', fontSize: '12.5px', boxSizing: 'border-box' }} value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#6b7280', marginBottom: '3px' }}>Outcome</label>
                <input placeholder="e.g. No Decision, Won, Lost" style={{ width: '100%', height: 32, border: '1px solid #d1d5db', borderRadius: 6, padding: '0 8px', fontSize: '12.5px', boxSizing: 'border-box' }} value={outcome} onChange={e => setOutcome(e.target.value)} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button className="nrfq-btn-ghost" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => setEditing(false)}>Cancel</button>
                <button className="nrfq-btn-primary" style={{ padding: '5px 14px', fontSize: '12px' }} onClick={save}>Save</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12.5px' }}>
              <div><span style={{ color: '#9ca3af' }}>OEM: </span><strong>{quote.oem || '—'}</strong></div>
              <div><span style={{ color: '#9ca3af' }}>Deadline: </span><strong>{quote.deadline || '—'}</strong></div>
              <div><span style={{ color: '#9ca3af' }}>Follow-up: </span><strong>{quote.followUpDate || '—'}</strong></div>
              <div><span style={{ color: '#9ca3af' }}>Outcome: </span><strong>{quote.outcome || '—'}</strong></div>
            </div>
          )}
        </div>
      )}

      {quote.id && (
        <>
          <div style={{margin:'16px 0 8px',fontSize:'12.5px',fontWeight:600,color:'#374151'}}>Activity</div>
          <ActivityTimeline entityType="sales_quotation" entityId={quote.id} />
        </>
      )}
      <div className="pur-modal-actions" style={{marginTop:'20px',flexWrap:'wrap',gap:'8px'}}>
        <button className="pur-btn-cancel" onClick={onClose}>Close</button>
        {quote.id && (
          <button className="pur-btn-secondary" onClick={()=>{onClose();onPdf(quote);}}>
            Download PDF
          </button>
        )}
        {quote.id && !quote.approvedByName && onApprove && (
          <button className="pur-btn-secondary" style={{color:'#16a34a',borderColor:'#16a34a'}} onClick={()=>{onClose();onApprove(quote);}}>
            Approve
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
        {/* ACCEPTED: pay now + convert to order */}
        {quote.id && st==='accepted' && (
          <>
            {quote._paymentStatus !== 'paid'
              ? <button className="pur-btn-primary" style={{background:'#16a34a',borderColor:'#16a34a'}} onClick={()=>{onClose();onPay(quote);}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'5px'}}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  Pay Now
                </button>
              : <span style={{fontSize:'12px',fontWeight:600,color:'#16a34a',background:'#dcfce7',padding:'4px 12px',borderRadius:'12px',border:'1px solid #bbf7d0'}}>Paid</span>
            }
            <button className="pur-btn-primary" onClick={()=>{onClose();onConvert(quote);}}>Convert to Order</button>
          </>
        )}
        {/* CONVERTED: read-only badge */}
        {st==='converted' && (
          <span style={{fontSize:'12px',fontWeight:600,color:'#7c3aed',background:'#f5f3ff',padding:'4px 12px',borderRadius:'12px',border:'1px solid #ddd8fe'}}>Converted</span>
        )}
      </div>
    </Modal>
  );
}

/* ─── Order Detail Modal ─── */
function OrderDetailModal({ order, onClose, refQuoteNum, onUpdateStatus }) {
  const meta = ORDER_STATUS_META[order.status] ?? ORDER_STATUS_META.confirmed;
  const sym = CURRENCY_SYMBOLS[order.currency] ?? '';
  const created = new Date(order.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  return (
    <Modal title={`${order.order_number} — Details`} onClose={onClose}>
      <div className="pur-detail-row">
        <span>Status</span>
        <span style={{background:meta.bg,color:meta.color,fontSize:'12px',fontWeight:600,padding:'2px 10px',borderRadius:'12px'}}>{meta.label}</span>
      </div>
      {refQuoteNum && (
        <div className="pur-detail-row"><span>Quotation Ref</span><strong>{refQuoteNum}</strong></div>
      )}
      <div className="pur-detail-row"><span>Date</span><strong>{created}</strong></div>

      <div style={{marginTop:'14px',marginBottom:'8px',fontSize:'12px',fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.05em'}}>Customer</div>
      <div className="pur-detail-row"><span>Company</span><strong>{order.customer_name || '—'}</strong></div>
      {order.department    && <div className="pur-detail-row"><span>Department</span><strong>{order.department}</strong></div>}
      {order.contact_person && <div className="pur-detail-row"><span>Contact</span><strong>{order.contact_person}</strong></div>}
      {order.phone         && <div className="pur-detail-row"><span>Phone</span><strong>{order.phone}</strong></div>}
      {order.email         && <div className="pur-detail-row"><span>Email</span><strong>{order.email}</strong></div>}

      {order.items && order.items.length > 0 && (
        <>
          <div style={{marginTop:'14px',marginBottom:'8px',fontSize:'12px',fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.05em'}}>Line Items</div>
          <div style={{overflowX:'auto',marginBottom:'8px'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12.5px'}}>
              <thead>
                <tr style={{background:'#f9fafb',borderBottom:'1px solid #e5e7eb'}}>
                  {['#','Item','Qty','Unit','Unit Price','Total'].map(h => (
                    <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:600,color:'#6b7280',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.items.map(item => (
                  <tr key={item.id || item.line_no} style={{borderBottom:'1px solid #f3f4f6'}}>
                    <td style={{padding:'7px 10px',color:'#6b7280'}}>{item.line_no}</td>
                    <td style={{padding:'7px 10px',color:'#111827',fontWeight:500}}>{item.item_name}</td>
                    <td style={{padding:'7px 10px',color:'#374151'}}>{item.qty}</td>
                    <td style={{padding:'7px 10px',color:'#374151'}}>{item.unit}</td>
                    <td style={{padding:'7px 10px',color:'#374151'}}>{sym}{fmt(item.unit_price)}</td>
                    <td style={{padding:'7px 10px',color:'#111827',fontWeight:600}}>{sym}{fmt(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div style={{display:'flex',justifyContent:'flex-end',marginTop:'12px'}}>
        <div style={{minWidth:'220px'}}>
          <div className="pur-detail-row" style={{borderBottom:'1px solid #f3f4f6',paddingBottom:'6px'}}><span>Subtotal</span><strong>{sym}{fmt(order.subtotal)}</strong></div>
          <div className="pur-detail-row" style={{borderBottom:'1px solid #f3f4f6',padding:'6px 0'}}><span>VAT (15%)</span><strong>{sym}{fmt(order.vat)}</strong></div>
          <div className="pur-detail-row" style={{paddingTop:'6px'}}><span style={{fontWeight:700,color:'#111827'}}>Total</span><strong style={{fontSize:'15px',color:'#111827'}}>{sym}{fmt(order.total)}</strong></div>
        </div>
      </div>

      <div className="pur-modal-actions" style={{marginTop:'20px'}}>
        <button className="pur-btn-cancel" onClick={onClose}>Close</button>
        {order.status === 'confirmed' && onUpdateStatus && (
          <button className="pur-btn-primary"
            style={{background:'#d97706',border:'1px solid #d97706'}}
            onClick={() => { onUpdateStatus(order, 'shipped'); onClose(); }}>
            Mark as Shipped
          </button>
        )}
        {order.status === 'shipped' && onUpdateStatus && (
          <button className="pur-btn-primary"
            style={{background:'#16a34a',border:'1px solid #16a34a'}}
            onClick={() => { onUpdateStatus(order, 'delivered'); onClose(); }}>
            Mark as Delivered
          </button>
        )}
      </div>
    </Modal>
  );
}

/* ─── KPI Drawer ────────────────────────────────────────────────── */
/** Breakdown palette cycled across whatever products come back from the API. */
const KPI_DOT_COLORS = ['#2563eb', '#16a34a', '#7c3aed', '#d97706', '#dc2626'];

function KpiDrawer({ title, rows, note, onClose }) {
  return (
    <div className="kpi-drawer" onClick={e=>e.stopPropagation()}>
      <div className="kpi-drawer-header"><span className="kpi-drawer-title">{title}</span><button className="kpi-drawer-close" onClick={onClose}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
      {rows.length === 0 ? (
        <div style={{ fontSize:'12.5px', color:'#9ca3af', padding:'6px 0' }}>No confirmed order data yet.</div>
      ) : rows.map(r=><div key={r.label} className="kpi-drawer-row"><div className="kpi-drawer-dot" style={{background:r.color}}></div><span className="kpi-drawer-label">{r.label}</span><span className="kpi-drawer-val">{r.value}</span></div>)}
      {note && <div className="kpi-drawer-note">{note}</div>}
    </div>
  );
}

/* ─── New Customer — full page.
   No backend customer/contact directory exists yet (quotations only store
   customer_name/email/phone as free-text fields on the quote itself), so
   this saves into local component state rather than pretending to persist
   to a server. It mirrors the New Vendor page's layout for consistency. ─── */
function NewCustomerPage({ onCancel, onCreated }) {
  const [form, setForm] = useState({
    name: '', contactPerson: '', email: '', phone: '',
    addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '', country: '',
    taxId: '', notes: '',
  });
  const [error, setError] = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function submit() {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    onCreated({
      name: form.name.trim(),
      contactPerson: form.contactPerson.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    });
  }

  return (
    <div className="nrfq-page">
      <div className="nrfq-actionbar">
        <button className="nrfq-btn-primary" onClick={submit}>Save</button>
        <button className="nrfq-btn-ghost" onClick={onCancel}>← Back to Customers</button>
      </div>

      <div className="nrfq-breadcrumb"><span className="nrfq-crumb-link" onClick={onCancel}>Customers</span> <span>/</span> New</div>

      {error && <div className="pur-form-error" style={{ color:'#ef4444', fontSize:'13px', margin:'0 0 12px', padding:'8px 12px', background:'#fef2f2', borderRadius:'6px', border:'1px solid #fecaca' }}>{error}</div>}

      <div className="nrfq-form" style={{ maxWidth: 'none' }}>
        <div className="vnd-form-top">
          <div className="vnd-logo-box">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#074E3B" strokeWidth="1.6"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1"/></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input className="nrfq-title-input" type="text" placeholder="Name (company or person)" value={form.name} onChange={e => set('name', e.target.value)} />
            <div className="vnd-icon-lines">
              <div className="vnd-icon-line">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="7" width="18" height="14" rx="1"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <input type="text" placeholder="Contact Person" value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} />
              </div>
              <div className="vnd-icon-line">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M22 6 12 13 2 6"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
                <input type="email" placeholder="Email" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div className="vnd-icon-line">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <input type="text" placeholder="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="nrfq-field-grid" style={{ marginTop: '18px' }}>
          <div className="nrfq-field-col">
            <label className="nrfq-field" style={{ marginBottom: 0 }}>Address</label>
            <div className="nrfq-field">
              <input type="text" placeholder="Street…" value={form.addressLine1} onChange={e => set('addressLine1', e.target.value)} />
            </div>
            <div className="nrfq-field">
              <input type="text" placeholder="Street 2…" value={form.addressLine2} onChange={e => set('addressLine2', e.target.value)} />
            </div>
            <div className="vnd-addr-row">
              <input type="text" placeholder="City" value={form.city} onChange={e => set('city', e.target.value)} />
              <input type="text" placeholder="State" value={form.state} onChange={e => set('state', e.target.value)} />
              <input type="text" placeholder="ZIP" value={form.postalCode} onChange={e => set('postalCode', e.target.value)} />
            </div>
            <div className="nrfq-field">
              <input type="text" placeholder="Country" value={form.country} onChange={e => set('country', e.target.value)} />
            </div>
          </div>
          <div className="nrfq-field-col">
            <div className="nrfq-field">
              <label>Tax ID / VAT</label>
              <input type="text" placeholder="not applicable" value={form.taxId} onChange={e => set('taxId', e.target.value)} />
            </div>
            <div className="nrfq-field">
              <label>Notes</label>
              <textarea rows={4} placeholder="Internal notes about this customer…" value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── New Quotation — full page (replaces the collapsible inline builder) ─── */
function NewQuotationPage({ onCancel, onCreated, showToast }) {
  const builderRef = useRef(null);
  return (
    <div className="nrfq-page">
      <div className="nrfq-actionbar">
        <button className="nrfq-btn-primary" onClick={() => builderRef.current?.sendToClient()}>Send</button>
        <button className="nrfq-btn-ghost" onClick={() => builderRef.current?.saveDraft()}>Save Draft</button>
        <button className="nrfq-btn-ghost" onClick={() => showToast('Print not available for unsaved records')}>Print</button>
        <button className="nrfq-btn-ghost" onClick={onCancel}>← Back to Quotations</button>
        <div className="nrfq-stepper">
          <span className="active">Quotation</span>
          <span>Quotation Sent</span>
          <span>Sales Order</span>
        </div>
      </div>
      <div className="nrfq-breadcrumb"><span className="nrfq-crumb-link" onClick={onCancel}>Quotations</span> <span>/</span> New</div>
      <div className="nrfq-body">
        <div className="nrfq-form" style={{ maxWidth: 'none' }}>
          <QuotationBuilder
            ref={builderRef}
            onClose={onCancel}
            onCreate={onCreated}
            showToast={showToast}
            onAuthError={() => {}}
          />
        </div>

        <div className="nrfq-chatter">
          <div className="nrfq-chatter-btns">
            <button onClick={() => showToast('Save the quotation first')}>Send message</button>
            <button onClick={() => showToast('Save the quotation first')}>Log note</button>
            <button onClick={() => showToast('Save the quotation first')}>Activity</button>
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
  );
}

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */

/* Status metadata re-aliased locally for concise use in this file. */
const STATUS_META       = { draft:{label:'Draft',bg:'#f3f4f6',color:'#374151'}, sent:{label:'Sent',bg:'#dbeafe',color:'#1d4ed8'}, accepted:{label:'Accepted',bg:'#dcfce7',color:'#15803d'}, rejected:{label:'Rejected',bg:'#fee2e2',color:'#b91c1c'}, converted:{label:'Converted',bg:'#f5f3ff',color:'#7c3aed'} };
const ORDER_STATUS_META = { confirmed:{label:'Confirmed',bg:'#dbeafe',color:'#1d4ed8'}, shipped:{label:'Shipped',bg:'#ffedd5',color:'#c2410c'}, delivered:{label:'Delivered',bg:'#dcfce7',color:'#15803d'}, cancelled:{label:'Cancelled',bg:'#fee2e2',color:'#b91c1c'} };

function normalizeApiQuote(q) {
  const sym = CURRENCY_SYMBOLS[q.currency] ?? '';
  const meta = STATUS_META[q.status] ?? STATUS_META.draft;
  const created = new Date(q.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  return {
    id: q.id,
    num: q.quote_number,
    _apiStatus: q.status?.toLowerCase(),
    _currency: q.currency || 'SAR',
    _paymentStatus: q.payment_status || 'unpaid',
    client: q.customer_name || 'Unknown Company',
    desc: q.subject || 'Sales Quotation',
    amount: `${sym}${Number(q.total).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}`,
    status: meta.label,
    statusBg: meta.bg,
    statusColor: meta.color,
    dates: `Created: ${created}${q.validity ? ` · Valid ${q.validity} days` : ''}`,
    notes: [q.payment_terms, q.delivery_location].filter(Boolean).join(' · '),
    rfqNumber: q.rfq_number || null,
    customerReference: q.customer_reference || null,
    createdByName: q.created_by_name || null,
    approvedByName: q.approved_by_name || null,
    approvedAt: q.approved_at || null,
    createdAt: q.created_at || null,
    totalRaw: Number(q.total) || 0,
    currencyCode: q.currency || 'SAR',
    email: q.email || null,
    phone: q.phone || null,
    contactPerson: q.contact_person || null,
    oem: q.oem || null,
    dateReceived: q.date_received || null,
    deadline: q.deadline || null,
    dateSubmitted: q.sent_at || null,
    followUpDate: q.follow_up_date || null,
    outcome: q.outcome || null,
    remarks: q.remarks || null,
    validity: q.validity || null,
    businessLine: q.rfq_id ? 'Trading' : 'Project',
  };
}

/* ── Discount Rules management ── */
function DiscountRulesModal({ rules, onClose, onChanged, showToast }) {
  const EMPTY = { name: '', description: '', discount_label: '', min_order_value: '', is_active: true };
  const [form, setForm]     = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  function authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` };
  }

  function startEdit(r) {
    setEditingId(r.id);
    setForm({ name: r.name, description: r.description || '', discount_label: r.discount_label, min_order_value: r.min_order_value ?? '', is_active: r.is_active });
  }
  function cancelEdit() { setEditingId(null); setForm(EMPTY); }

  async function save() {
    if (!form.name.trim() || !form.discount_label.trim()) { showToast('Name and discount are required.'); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        discount_label: form.discount_label.trim(),
        min_order_value: form.min_order_value !== '' ? Number(form.min_order_value) : undefined,
        is_active: form.is_active,
      };
      const url = editingId ? `${API_BASE}/api/v1/discount-rules/${editingId}` : `${API_BASE}/api/v1/discount-rules`;
      const res = await fetch(url, { method: editingId ? 'PATCH' : 'POST', headers: authHeaders(), body: JSON.stringify(body) });
      if (res.ok) { cancelEdit(); onChanged(); showToast(editingId ? 'Rule updated' : 'Rule created'); }
      else showToast((await res.json().catch(() => ({}))).detail || 'Failed to save rule');
    } finally { setSaving(false); }
  }

  async function remove(id) {
    if (!window.confirm('Delete this discount rule?')) return;
    const res = await fetch(`${API_BASE}/api/v1/discount-rules/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (res.ok || res.status === 204) { onChanged(); showToast('Rule deleted'); }
  }

  const inp = { width: '100%', height: 34, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' };
  const lbl = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 };

  return (
    <Modal title="Discount Rules" onClose={onClose}>
      <div style={{ display: 'grid', gap: '8px', marginBottom: '18px' }}>
        {rules.length === 0 && <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>No discount rules yet.</div>}
        {rules.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, opacity: r.is_active ? 1 : 0.5 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{r.name} {!r.is_active && <span style={{ fontSize: 11, color: '#9ca3af' }}>(inactive)</span>}</div>
              {r.description && <div style={{ fontSize: 12, color: '#9ca3af' }}>{r.description}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{r.discount_label}</span>
              <button onClick={() => startEdit(r)} style={{ height: 26, width: 26, background: '#f3f4f6', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>✎</button>
              <button onClick={() => remove(r.id)} style={{ height: 26, width: 26, background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>✕</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: '10px' }}>{editingId ? 'Edit Rule' : 'New Rule'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <div><label style={lbl}>Name *</label><input style={inp} placeholder="e.g. Volume Discount" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label style={lbl}>Discount *</label><input style={inp} placeholder="e.g. 10-25% or 15%" value={form.discount_label} onChange={e => setForm(f => ({ ...f, discount_label: e.target.value }))} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <div><label style={lbl}>Description</label><input style={inp} placeholder="e.g. Orders above SAR 50,000" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div><label style={lbl}>Min. Order Value (SAR)</label><input type="number" min="0" style={inp} placeholder="optional" value={form.min_order_value} onChange={e => setForm(f => ({ ...f, min_order_value: e.target.value }))} /></div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 13, color: '#374151', marginBottom: '14px', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
          Active (shown to sales staff)
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          {editingId && <button onClick={cancelEdit} style={{ height: 34, padding: '0 16px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>}
          <button onClick={save} disabled={saving} style={{ height: 34, padding: '0 18px', border: 'none', borderRadius: 8, background: '#7c3aed', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Rule'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════
   SALES PAGE — ROOT COMPONENT
════════════════════════════════════════ */

export default function Sales({ goPage, onLogout }) {
  const [showNewQuote, setShowNewQuote]     = useState(false);
  const [openOnlyFilter, setOpenOnlyFilter] = useState(true);
  const [products, setProducts]             = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productSearch, setProductSearch]   = useState('');
  const [suppliers, setSuppliers]           = useState([]);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [viewProduct, setViewProduct]       = useState(null);
  const [localCustomers, setLocalCustomers] = useState([]);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [reportChartType, setReportChartType] = useState('bar');
  const [reportMeasure, setReportMeasure]     = useState('Untaxed Total');
  const [reportMeasureOpen, setReportMeasureOpen] = useState(false);
  const [reportSOFilter, setReportSOFilter]   = useState(true);
  const [report365Filter, setReport365Filter] = useState(true);
  const [reportHover, setReportHover]         = useState(null);
  const [reportSubTab, setReportSubTab]       = useState('sales');
  const quotationsRef                       = useRef(null);
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
  const [topProducts, setTopProducts]       = useState(null);
  const [ordersThisMonth, setOrdersThisMonth] = useState(null);
  const [ordersChangePct, setOrdersChangePct] = useState(null);
  const [activeTab, setActiveTab]           = useState('quotations');
  const [orders, setOrders]                 = useState([]);
  const [orderDetail, setOrderDetail]       = useState(null);
  const [pendingActions, setPendingActions] = useState(new Set());
  const [paymentQuote, setPaymentQuote]     = useState(null);
  const [tasks, setTasks]                   = useState([
    { id:1, text:'Follow up with Enterprise Corp', due:'Today 3:00 PM',     done:false, color:'#FFF7ED', border:'#EE7334' },
    { id:2, text:'Prepare demo for RetailChain',   due:'Tomorrow 10:00 AM', done:false, color:'#EFF6FF', border:'#4F82EF' },
    { id:3, text:'Send proposal to TechStart',     due:'Completed',         done:true },
  ]);
  const [newTask, setNewTask]               = useState('');
  const [showTaskInput, setShowTaskInput]   = useState(false);
  const [discountRules, setDiscountRules]   = useState([]);
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  function getToken() { return localStorage.getItem('token'); }

  const fetchDiscountRules = useCallback(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${API_BASE}/api/v1/discount-rules`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.items) setDiscountRules(d.items); })
      .catch(() => {});
  }, []);

  function handleAuthError() {
    showToast('Session expired — please log in again');
    if (onLogout) onLogout();
  }

  function showToast(msg) { setToast(msg); }
  function toggleKpi(k)   { setOpenKpi(p => p === k ? null : k); }

  useEffect(() => {
    fetchDiscountRules();
  }, [fetchDiscountRules]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetch(`${API_BASE}/api/v1/sales/quotations`, {
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

    fetch(`${API_BASE}/api/v1/dashboard/sales`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data != null) {
          setTotalRevenue(data.total_revenue);
          setActiveQuotes(data.active_quotes);
          setConversionRate(data.conversion_rate);
          setTopProducts(data.top_products ?? []);
          setOrdersThisMonth(data.orders_this_month);
          setOrdersChangePct(data.orders_change_pct);
        }
      })
      .catch(() => {});

    fetch(`${API_BASE}/api/v1/sales/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (r.status === 401) { handleAuthError(); return null; }
        return r.ok ? r.json() : null;
      })
      .then(data => { if (data?.items) setOrders(data.items); })
      .catch(() => {});

    setProductsLoading(true);
    fetch(`${API_BASE}/api/v1/inventory/items?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(data => setProducts(data.items ?? []))
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false));

    fetch(`${API_BASE}/api/v1/suppliers?page_size=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(data => setSuppliers(data.items ?? []))
      .catch(() => setSuppliers([]));
  }, []);

  const fetchProducts = () => {
    const token = getToken();
    if (!token) return;
    setProductsLoading(true);
    fetch(`${API_BASE}/api/v1/inventory/items?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(data => setProducts(data.items ?? []))
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false));
  };

  function addQuote(q) {
    setQuotes(p => [q, ...p]);
  }

  function addOrder(o) {
    setOrders(p => [o, ...p]);
  }

  function replaceQuote(updated) {
    setQuotes(p => p.map(q => q.id === updated.id ? updated : q));
  }

  async function saveTracking(quoteId, fields) {
    try {
      const r = await fetch(`${API_BASE}/api/v1/sales/quotations/${quoteId}/tracking`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(fields),
      });
      if (!r.ok) { showToast('Failed to save tracking fields'); return; }
      const data = await r.json();
      const normalized = normalizeApiQuote(data);
      replaceQuote(normalized);
      setQuoteDetail(normalized);
      showToast('Tracking info updated');
    } catch { showToast('Failed to save tracking fields'); }
  }

  async function createRevision(q) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/sales/quotations/${q.id}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) { showToast('Could not load quotation to duplicate'); return; }
      const full = await res.json();
      const payload = {
        date: new Date().toISOString().slice(0, 10),
        currency: full.currency, validity: full.validity, delivery_time: full.delivery_time,
        delivery_date: full.delivery_date, delivery_location: full.delivery_location,
        payment_terms: full.payment_terms, customer_name: full.customer_name, department: full.department,
        contact_person: full.contact_person, phone: full.phone, fax: full.fax, email: full.email, cc: full.cc,
        your_ref: full.your_ref, subject: full.subject, invoice_address: full.invoice_address, delivery_address: full.delivery_address,
        remarks: full.remarks, terms: full.terms, oem: full.oem, date_received: full.date_received, deadline: full.deadline,
        items: (full.items || []).map((it, idx) => ({
          line_no: idx + 1, catalog_no: it.catalog_no, item_name: it.item_name, description: it.description,
          qty: it.qty, unit: it.unit, unit_price: it.unit_price, discount: it.discount,
        })),
      };
      const cres = await fetch(`${API_BASE}/api/v1/sales/quotations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(payload),
      });
      if (cres.ok) {
        const created = await cres.json();
        setQuotes(prev => [normalizeApiQuote(created), ...prev]);
        showToast(`Revision created as ${created.quote_number}`);
      } else {
        const e = await cres.json().catch(() => ({}));
        showToast(e.detail || 'Failed to create revision');
      }
    } catch { showToast('Failed to create revision'); }
  }

  function isActionPending(id) { return pendingActions.has(id); }
  function setActionPending(id, on) {
    setPendingActions(prev => {
      const next = new Set(prev);
      on ? next.add(id) : next.delete(id);
      return next;
    });
  }

  async function callStatusEndpoint(quote, endpoint, toastMsg) {
    const key = `${quote.id}:${endpoint}`;
    const token = getToken();
    if (!quote.id || !token) { showToast('Not logged in'); return; }
    if (isActionPending(key)) return;
    setActionPending(key, true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/sales/quotations/${quote.id}/${endpoint}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401) { handleAuthError(); return; }
      if (res.ok) {
        const data = await res.json();
        replaceQuote(normalizeApiQuote(data));
        if (data.email_warning) {
          showToast(`Marked as Sent — email skipped (SMTP not configured)`);
        } else {
          showToast(toastMsg);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Action failed');
      }
    } catch { showToast('Network error'); }
    finally { setActionPending(key, false); }
  }

  function sendToClient(quote)  { callStatusEndpoint(quote, 'send',   'Quotation sent successfully'); }
  function acceptQuote(quote)   { callStatusEndpoint(quote, 'accept', 'Quotation marked as Accepted'); }
  function rejectQuote(quote)   { callStatusEndpoint(quote, 'reject', 'Quotation marked as Rejected'); }
  function approveQuote(quote)  { callStatusEndpoint(quote, 'approve', 'Quotation approved'); }

  async function convertToOrder(quote) {
    const key = `${quote.id}:convert`;
    const token = getToken();
    if (!quote.id || !token) { showToast('Cannot convert — not logged in'); return; }
    if (isActionPending(key)) return;
    setActionPending(key, true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/sales/quotations/${quote.id}/convert`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401) { handleAuthError(); return; }
      if (res.ok) {
        const order = await res.json();
        replaceQuote({ ...quote, _apiStatus:'converted', status:'Converted', statusBg:'#f5f3ff', statusColor:'#7c3aed' });
        addOrder(order);
        setActiveTab('orders');
        showToast('Order created');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Conversion failed');
      }
    } catch { showToast('Network error — conversion failed'); }
    finally { setActionPending(key, false); }
  }

  async function updateOrderStatus(order, newStatus) {
    const key = `${order.id}:${newStatus}`;
    const token = getToken();
    if (!token) { showToast('Not logged in'); return; }
    if (isActionPending(key)) return;
    setActionPending(key, true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/sales/orders/${order.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.status === 401) { handleAuthError(); return; }
      if (res.ok) {
        const updated = await res.json();
        setOrders(p => p.map(o => o.id === updated.id ? updated : o));
        if (orderDetail?.id === updated.id) setOrderDetail(updated);
        const labels = { shipped: 'Order marked as shipped', delivered: 'Order marked as delivered' };
        showToast(labels[newStatus] ?? 'Status updated');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Status update failed');
      }
    } catch { showToast('Network error'); }
    finally { setActionPending(key, false); }
  }

  async function downloadPdf(quote) {
    const token = getToken();
    if (!quote.id || !token) { showToast('Cannot generate PDF — not logged in'); return; }
    showToast('Generating PDF…');
    try {
      const res = await fetch(`${API_BASE}/api/v1/sales/quotations/${quote.id}/pdf`, {
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
    const matchOpen   = !openOnlyFilter || !['converted', 'rejected'].includes(q._apiStatus);
    const matchSearch = search === '' ||
      q.client.toLowerCase().includes(search.toLowerCase()) ||
      q.num.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchOpen && matchSearch;
  });
  const quotesGrandTotal = filtered.reduce((sum, q) => sum + (q.totalRaw || 0), 0);

  const visibleProducts = products.filter(p => {
    const name = p.description || p.part_number || '';
    return productSearch === '' || name.toLowerCase().includes(productSearch.toLowerCase());
  });

  const reportRows = orders
    .filter(o => {
      if (!report365Filter) return true;
      const d = new Date(o.created_at || 0);
      if (isNaN(d.getTime())) return false;
      return (Date.now() - d.getTime()) <= 365 * 86400000;
    });
  const reportBuckets = (() => {
    const map = new Map();
    reportRows.forEach(o => {
      const d = new Date(o.created_at || 0);
      const key = isNaN(d.getTime()) ? 'Undated' : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
      const prev = map.get(key) || { label: key, total: 0, count: 0 };
      prev.total += Number(o.total) || 0;
      prev.count += 1;
      map.set(key, prev);
    });
    return [...map.values()].sort((a, b) => new Date(a.label) - new Date(b.label));
  })();
  const reportDeliveredCount = reportRows.filter(o => o.status === 'delivered').length;
  const reportOpenCount      = reportRows.length - reportDeliveredCount;

  const derivedCustomers = (() => {
    const map = new Map();
    quotes.forEach(q => {
      const key = q.client.trim().toLowerCase();
      const prev = map.get(key) || { name: q.client, email: q.email, phone: q.phone, contactPerson: q.contactPerson, quoteCount: 0, totalRaw: 0, local: false };
      prev.email = prev.email || q.email;
      prev.phone = prev.phone || q.phone;
      prev.contactPerson = prev.contactPerson || q.contactPerson;
      prev.quoteCount += 1;
      prev.totalRaw += q.totalRaw || 0;
      map.set(key, prev);
    });
    localCustomers.forEach(c => {
      const key = c.name.trim().toLowerCase();
      const prev = map.get(key) || { name: c.name, email: c.email, phone: c.phone, contactPerson: c.contactPerson, quoteCount: 0, totalRaw: 0, local: true };
      map.set(key, prev);
    });
    return [...map.values()].filter(c =>
      customerSearch === '' || c.name.toLowerCase().includes(customerSearch.toLowerCase())
    );
  })();

  const salespersonBuckets = (() => {
    const map = new Map();
    quotes.forEach(q => {
      const key = q.createdByName || 'Unassigned';
      const prev = map.get(key) || { label: key, total: 0, count: 0 };
      prev.total += q.totalRaw || 0;
      prev.count += 1;
      map.set(key, prev);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  })();

  const productBuckets = (topProducts ?? []).map(p => ({ label: p.name, total: Number(p.revenue) || 0, count: 1 }));

  const customerBuckets = derivedCustomers
    .map(c => ({ label: c.name, total: c.totalRaw, count: c.quoteCount }))
    .sort((a, b) => b.total - a.total);

  const REPORT_TABS = {
    sales:        { title: 'Sales Analysis',       buckets: reportBuckets,       measures: ['Untaxed Total', 'Count'] },
    salespersons: { title: 'Salesperson Analysis',  buckets: salespersonBuckets,  measures: ['Untaxed Total', 'Count'] },
    products:     { title: 'Product Analysis',      buckets: productBuckets,      measures: ['Revenue'] },
    customers:    { title: 'Customer Analysis',     buckets: customerBuckets,     measures: ['Untaxed Total', 'Count'] },
  };
  const activeReport = REPORT_TABS[reportSubTab];

  return (
    <div id="sales-page">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      {discountQuote && <ApplyDiscountModal quote={discountQuote} onClose={() => setDiscountQuote(null)} onSave={showToast} />}
      {orderDetail   && (
        <OrderDetailModal
          order={orderDetail}
          onClose={() => setOrderDetail(null)}
          refQuoteNum={quotes.find(q => q.id === orderDetail.quotation_id)?.num}
          onUpdateStatus={updateOrderStatus}
        />
      )}
      {paymentQuote && <PaymentModal
        quote={paymentQuote}
        onClose={() => setPaymentQuote(null)}
        onPaid={(qid) => {
          setQuotes(prev => prev.map(q => q.id === qid ? { ...q, _paymentStatus: 'paid' } : q));
          showToast('Payment successful — quotation marked as paid');
          setPaymentQuote(null);
        }}
      />}
      {quoteDetail   && <QuoteDetailModal
        quote={quoteDetail}
        onClose={() => setQuoteDetail(null)}
        onSend={q    => sendToClient(q)}
        onConvert={q => convertToOrder(q)}
        onDiscount={setDiscountQuote}
        onAccept={q  => acceptQuote(q)}
        onReject={q  => rejectQuote(q)}
        onPdf={q     => downloadPdf(q)}
        onPay={q     => { setQuoteDetail(null); setPaymentQuote(q); }}
        onApprove={q => approveQuote(q)}
        onSaveTracking={(fields) => saveTracking(quoteDetail.id, fields)}
      />}

      <Sidebar
        activePage="sales"
        goPage={goPage}
        subNavGroups={[
          {
            key: 'orders', label: 'Orders', children: [
              { label: 'Quotations',  active: activeTab === 'quotations', onClick: () => { setShowNewQuote(false); setActiveTab('quotations'); } },
              { label: 'Orders',      active: activeTab === 'orders',     onClick: () => { setShowNewQuote(false); setActiveTab('orders'); } },
              { label: 'Customers',   active: activeTab === 'customers',  onClick: () => { setShowNewQuote(false); setActiveTab('customers'); } },
            ],
          },
          {
            key: 'products', label: 'Products', children: [
              { label: 'Products', active: activeTab === 'products', onClick: () => { setShowNewQuote(false); setActiveTab('products'); } },
            ],
          },
          {
            key: 'reporting', label: 'Reporting', children: [
              { label: 'Sales',        active: activeTab === 'reporting' && reportSubTab === 'sales',        onClick: () => { setShowNewQuote(false); setActiveTab('reporting'); setReportSubTab('sales'); } },
              { label: 'Salespersons', active: activeTab === 'reporting' && reportSubTab === 'salespersons', onClick: () => { setShowNewQuote(false); setActiveTab('reporting'); setReportSubTab('salespersons'); } },
              { label: 'Products',     active: activeTab === 'reporting' && reportSubTab === 'products',     onClick: () => { setShowNewQuote(false); setActiveTab('reporting'); setReportSubTab('products'); } },
              { label: 'Customers',    active: activeTab === 'reporting' && reportSubTab === 'customers',    onClick: () => { setShowNewQuote(false); setActiveTab('reporting'); setReportSubTab('customers'); } },
            ],
          },
          {
            key: 'config', label: 'Configuration', children: [
              { label: 'Settings',        onClick: () => showToast('Settings coming soon') },
              { label: 'Payment Terms',   onClick: () => showToast('Payment terms coming soon') },
              { label: 'Discount Rules',  onClick: () => showToast('Discount rules coming soon') },
            ],
          },
        ]}
      />
      <div className="db-main">
        {/* Top bar */}
        <div className="tb">
          <div className="tb-title tb-title-block">
            <div>Sales</div>
            <div className="tb-subtitle">Manage quotations, sales orders, and track revenue pipeline</div>
          </div>
          <div className="tb-right">
            <div className="tb-bell"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <div className="tb-user"><div className="tb-avatar" style={{background:'linear-gradient(135deg,#16a34a,#10b981)'}}>SJ</div><div><div className="tb-uname">Sarah Johns</div><div className="tb-urole">Administrator</div></div></div>
          </div>
        </div>

        <div className="pg">
          {showNewQuote ? (
            <NewQuotationPage
              onCancel={() => setShowNewQuote(false)}
              onCreated={(q) => { addQuote(q); setShowNewQuote(false); }}
              showToast={showToast}
            />
          ) : (
          <>
          {/* KPI Cards — landing (Quotations) tab only */}
          {activeTab === 'quotations' && (
          <div className="kpi-row" style={{marginBottom:'20px'}}>
            {[
              {key:'revenue',    label:'Total Revenue',     value:fmtRevenue(totalRevenue), icon:<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, cls:'ic-g', note:'From confirmed sales orders'},
              {key:'quotes',     label:'Active Quotes',     value:activeQuotes ?? '—', icon:<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, cls:'ic-b', note:'Draft, sent & accepted'},
              {key:'orders',     label:'Orders This Month', value:ordersThisMonth ?? '—', icon:<svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>, cls:'ic-o',
                ...(ordersChangePct != null ? { chg:`${Math.abs(ordersChangePct)}% vs last month`, up:ordersChangePct >= 0 } : { note:'Since the 1st of this month' })},
              {key:'conversion', label:'Conversion Rate',   value:conversionRate != null ? `${conversionRate.toFixed(1)}%` : '—', icon:<svg viewBox="0 0 24 24"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>, cls:'ic-p', note:'Quotations converted to orders'},
            ].map(k => (
              <div key={k.key} className={`kpi kpi-clickable${openKpi===k.key?' kpi-active':''}`} onClick={() => toggleKpi(k.key)}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-body"><div className="kpi-value">{k.value}</div><div className={`kpi-icon ${k.cls}`}>{k.icon}</div></div>
                {k.chg ? <div className={`kpi-chg ${k.up?'up':'dn'}`}><svg viewBox="0 0 24 24">{k.up?<polyline points="18 15 12 9 6 15"/>:<polyline points="6 9 12 15 18 9"/>}</svg>{k.chg}</div>
                       : <div style={{fontSize:'13px',fontWeight:500,color:'#2563eb',marginTop:'6px'}}>{k.note}</div>}
                {openKpi==='revenue' && k.key==='revenue' && (
                  <KpiDrawer
                    title="Revenue Breakdown"
                    rows={(topProducts ?? []).map((p, i) => ({ label:p.name, value:fmtRevenue(p.revenue), color:KPI_DOT_COLORS[i % KPI_DOT_COLORS.length] }))}
                    note={(topProducts ?? []).length > 0 ? 'Top products by revenue, from confirmed sales orders.' : null}
                    onClose={e=>{e.stopPropagation();setOpenKpi(null);}}
                  />
                )}
                {openKpi==='orders' && k.key==='orders' && (
                  <KpiDrawer
                    title="Orders by Product"
                    rows={(topProducts ?? []).map((p, i) => ({ label:p.name, value:String(p.order_count), color:KPI_DOT_COLORS[i % KPI_DOT_COLORS.length] }))}
                    note={ordersChangePct != null ? `${ordersChangePct >= 0 ? '+' : ''}${ordersChangePct}% vs last month.` : null}
                    onClose={e=>{e.stopPropagation();setOpenKpi(null);}}
                  />
                )}
              </div>
            ))}
          </div>
          )}

          {/* Tabs */}
          <div style={{display:'flex',gap:'2px',marginBottom:'16px',background:'#f3f4f6',borderRadius:'10px',padding:'3px',width:'fit-content'}}>
            {[
              { key:'quotations', label:'Quotations' },
              { key:'orders',     label:'Orders' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                padding:'6px 22px', borderRadius:'8px', border:'none', cursor:'pointer',
                fontSize:'13.5px', fontWeight: activeTab===tab.key ? 700 : 500,
                background: activeTab===tab.key ? '#fff' : 'transparent',
                color:      activeTab===tab.key ? '#111827' : '#6b7280',
                boxShadow:  activeTab===tab.key ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                transition: 'all .15s',
              }}>
                {tab.label}
                {tab.key === 'orders' && orders.length > 0 && (
                  <span style={{marginLeft:'6px',background:'#4F82EF',color:'#fff',fontSize:'11px',fontWeight:700,padding:'1px 6px',borderRadius:'10px'}}>{orders.length}</span>
                )}
              </button>
            ))}
          </div>

          {activeTab === 'products' && (
            showNewProduct ? (
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
            ) : (
              <div className="rfq-odoo-card">
                <div className="rfq-toolbar">
                  <div className="rfq-toolbar-btns">
                    <button className="btn-action btn-blue" onClick={() => setShowNewProduct(true)}>
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
            )
          )}

          {activeTab === 'customers' && (
            showNewCustomer ? (
              <NewCustomerPage
                onCancel={() => setShowNewCustomer(false)}
                onCreated={(c) => { setLocalCustomers(p => [...p, c]); setShowNewCustomer(false); showToast('Customer added — stored locally until backend support lands'); }}
              />
            ) : (
              <div className="rfq-odoo-card">
                <div className="rfq-toolbar">
                  <div className="rfq-toolbar-btns">
                    <button className="btn-action btn-blue" onClick={() => setShowNewCustomer(true)}>
                      <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New
                    </button>
                  </div>
                  <div className="rfq-breadcrumb">
                    Customers
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </div>
                  <div className="rfq-toolbar-search">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" placeholder="Search…" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
                  </div>
                  <div className="rfq-pagination">
                    <span>{derivedCustomers.length === 0 ? '0-0' : `1-${derivedCustomers.length}`} / {derivedCustomers.length}</span>
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
                      <th>Contact</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th className="right">Quotations</th>
                      <th className="right">Total Quoted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {derivedCustomers.length === 0 ? (
                      <tr><td colSpan={8} style={{ padding:'16px', textAlign:'center', color:'#9ca3af', fontSize:'13.5px' }}>
                        No customers yet — they appear here once you create a quotation, or click "New" to add one.
                      </td></tr>
                    ) : derivedCustomers.map(c => (
                      <tr key={c.name} className="rfq-odoo-row">
                        <td className="check" onClick={e => e.stopPropagation()}><input type="checkbox" /></td>
                        <td><span className="vnd-avatar" style={{ background: '#074E3B' }}>{c.name?.[0]?.toUpperCase() ?? '?'}</span></td>
                        <td style={{ fontWeight:600, color:'#111827' }}>{c.name}{c.local && <span className="nrfq-hint" style={{ marginLeft:'8px' }}>(local only)</span>}</td>
                        <td style={{ color:'#374151' }}>{c.contactPerson || '—'}</td>
                        <td style={{ color:'#374151' }}>{c.email || '—'}</td>
                        <td style={{ color:'#374151' }}>{c.phone || '—'}</td>
                        <td className="right">{c.quoteCount}</td>
                        <td className="right">{c.totalRaw.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} SAR</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'reporting' && (
            <div className="rfq-odoo-card">
              <div className="rfq-toolbar">
                <div className="rfq-breadcrumb">
                  {activeReport.title}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </div>
                {reportSubTab === 'sales' && (
                  <div className="rfq-toolbar-search">
                    {reportSOFilter && (
                      <span className="vnd-filter-chip">
                        Sales Orders
                        <button onClick={() => setReportSOFilter(false)}>
                          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </span>
                    )}
                    {report365Filter && (
                      <span className="vnd-filter-chip">
                        Order Date: Last 365 Days
                        <button onClick={() => setReport365Filter(false)}>
                          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </span>
                    )}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" placeholder="Search…" />
                  </div>
                )}
                <div className="rfq-view-icons">
                  <button className="active" title="Graph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></button>
                  <button title="Pivot" onClick={() => showToast('Pivot view coming soon')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="9" x2="9" y2="21"/></svg></button>
                </div>
              </div>

              <div className="rpt-toolbar2">
                <div className="rpt-measure-wrap">
                  <button className="rpt-measure-btn" onClick={() => setReportMeasureOpen(p => !p)}>
                    {activeReport.measures.includes(reportMeasure) ? reportMeasure : activeReport.measures[0]}
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {reportMeasureOpen && (
                    <div className="pur-segment-menu" onMouseLeave={() => setReportMeasureOpen(false)}>
                      {activeReport.measures.map(m => (
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
                {activeReport.buckets.length === 0 ? (
                  <div className="prd-empty">No data yet.</div>
                ) : reportChartType === 'pie' ? (
                  reportSubTab === 'sales' ? (
                    <AnalysisPieChart slices={[
                      { label: 'Delivered', value: reportDeliveredCount, color: '#074E3B' },
                      { label: 'In Progress', value: reportOpenCount, color: '#1d4ed8' },
                    ]} />
                  ) : (
                    <AnalysisPieChart slices={
                      activeReport.buckets.slice(0, 6).map((b, i) => ({
                        label: b.label,
                        value: reportMeasure === 'Count' ? b.count : b.total,
                        color: ['#074E3B', '#1d4ed8', '#15803d', '#b45309', '#be185d', '#0f766e'][i % 6],
                      }))
                    } />
                  )
                ) : (
                  <AnalysisBarLineChart
                    buckets={activeReport.buckets}
                    measure={reportMeasure === 'Count' ? 'count' : 'total'}
                    type={reportChartType}
                    hover={reportHover}
                    setHover={setReportHover}
                  />
                )}
              </div>
            </div>
          )}

          {(activeTab === 'quotations' || activeTab === 'orders') && (activeTab === 'quotations' ? (<div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:'18px',alignItems:'start'}}>
            {/* Left column */}
            <div>
              {/* ── Orders Tab ── */}
              {activeTab === 'orders' && (
                <div className="pur-tab-card" style={{overflow:'hidden',padding:0}}>
                  <div style={{padding:'20px 22px 12px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <span style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>Sales Orders</span>
                    <span style={{fontSize:'12px',color:'#9ca3af'}}>{orders.length} order{orders.length!==1?'s':''}</span>
                  </div>
                  {orders.length === 0 ? (
                    <div style={{padding:'32px',textAlign:'center',color:'#9ca3af',fontSize:'13.5px'}}>
                      No orders yet. Convert an accepted quotation to create one.
                    </div>
                  ) : (
                    <div style={{overflowX:'auto'}}>
                      <table style={{width:'100%',borderCollapse:'collapse'}}>
                        <thead>
                          <tr style={{background:'#f9fafb',borderBottom:'1px solid #e5e7eb'}}>
                            {['Order No','Company','Amount','Status','Date','Actions'].map(h => (
                              <th key={h} style={{padding:'10px 16px',textAlign:'left',fontSize:'12px',fontWeight:600,color:'#6b7280',whiteSpace:'nowrap'}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map(o => {
                            const oMeta = ORDER_STATUS_META[o.status] ?? ORDER_STATUS_META.confirmed;
                            const sym   = CURRENCY_SYMBOLS[o.currency] ?? '';
                            const oDate = new Date(o.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
                            return (
                              <tr key={o.id} style={{borderBottom:'1px solid #f3f4f6',transition:'background .1s',cursor:'default'}}
                                onMouseEnter={e=>e.currentTarget.style.background='#fafafa'}
                                onMouseLeave={e=>e.currentTarget.style.background=''}>
                                <td style={{padding:'12px 16px',fontSize:'13px',fontWeight:700,color:'#111827',whiteSpace:'nowrap'}}>{o.order_number}</td>
                                <td style={{padding:'12px 16px',fontSize:'13px',color:'#374151'}}>{o.customer_name || '—'}</td>
                                <td style={{padding:'12px 16px',fontSize:'13px',fontWeight:600,color:'#111827',whiteSpace:'nowrap'}}>{sym}{fmt(o.total)}</td>
                                <td style={{padding:'12px 16px'}}>
                                  <span style={{background:oMeta.bg,color:oMeta.color,fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'12px'}}>
                                    {oMeta.label}
                                  </span>
                                </td>
                                <td style={{padding:'12px 16px',fontSize:'12px',color:'#6b7280',whiteSpace:'nowrap'}}>{oDate}</td>
                                <td style={{padding:'12px 16px'}}>
                                  <button style={{fontSize:'12.5px',fontWeight:600,color:'#2563eb',background:'none',border:'none',cursor:'pointer',padding:0}}
                                    onClick={() => setOrderDetail(o)}>
                                    View Details
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Quotations toolbar + table (Odoo-style) ── */}
              {activeTab === 'quotations' && (
                <div ref={quotationsRef} className="rfq-odoo-card" style={{ marginBottom: '16px' }}>
                  <div className="rfq-toolbar">
                    <div className="rfq-toolbar-btns">
                      <button className="btn-action btn-blue" onClick={() => setShowNewQuote(true)}>
                        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New
                      </button>
                    </div>
                    <div className="rfq-breadcrumb">
                      Quotations
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    </div>
                    <div className="rfq-toolbar-search">
                      {openOnlyFilter && (
                        <span className="vnd-filter-chip">
                          Open Quotations
                          <button onClick={() => setOpenOnlyFilter(false)}>
                            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </span>
                      )}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div className="rfq-pagination">
                      <span>{filtered.length === 0 ? '0-0' : `1-${filtered.length}`} / {quotes.length}</span>
                      <button onClick={() => showToast('First page')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg></button>
                      <button onClick={() => showToast('Next page')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></button>
                    </div>
                    <div className="rfq-view-icons">
                      <button className="active" title="List"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></button>
                      <button title="Kanban" onClick={() => showToast('Kanban view coming soon')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="6" height="18" rx="1"/><rect x="15" y="3" width="6" height="10" rx="1"/></svg></button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', padding: '10px 16px 0', flexWrap: 'wrap' }}>
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

                  <div style={{ overflowX: 'auto' }}>
                  <table className="rfq-odoo-table">
                    <thead>
                      <tr>
                        <th>Quotation No.</th>
                        <th>Project / Customer</th>
                        <th>Date Received</th>
                        <th>Deadline</th>
                        <th>Date Submitted</th>
                        <th className="center">Status</th>
                        <th className="right">Value</th>
                        <th className="center">Validity</th>
                        <th>Contact</th>
                        <th>Remarks</th>
                        <th>Follow-up / Outcome</th>
                        <th style={{ width: '100px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={12} style={{ padding:'16px', textAlign:'center', color:'#9ca3af', fontSize:'13.5px' }}>
                          {quotes.length === 0 ? 'No quotations yet — click "New" to create one.' : 'No quotes match the current filter.'}
                        </td></tr>
                      ) : filtered.map(q => {
                        const usd = q.currencyCode === 'SAR' ? (q.totalRaw / 3.75) : null;
                        return (
                        <tr key={q.num} className="rfq-odoo-row" onClick={() => setQuoteDetail(q)}>
                          <td className="pur-ref">
                            {q.num}
                            {q.rfqNumber && <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 400 }}>RFQ: {q.rfqNumber}</div>}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: '#111827' }}>{q.client}</div>
                            {q.oem && <div style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>OEM: {q.oem}</div>}
                          </td>
                          <td style={{ color:'#6b7280', fontSize:'13px' }}>{q.dateReceived || '—'}</td>
                          <td style={{ color:'#6b7280', fontSize:'13px' }}>{q.deadline || '—'}</td>
                          <td style={{ color:'#6b7280', fontSize:'13px' }}>{q.dateSubmitted ? new Date(q.dateSubmitted).toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'}) : 'Not yet'}</td>
                          <td className="center">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                              <span style={{ background:q.statusBg, color:q.statusColor, fontSize:'11.5px', fontWeight:600, padding:'2px 9px', borderRadius:'20px' }}>{q.status}</span>
                              <span style={{ background: q.businessLine === 'Trading' ? '#dcfce7' : '#dbeafe', color: q.businessLine === 'Trading' ? '#15803d' : '#1d4ed8', fontSize:'11px', fontWeight:600, padding:'1px 8px', borderRadius:'20px' }}>{q.businessLine}</span>
                            </div>
                          </td>
                          <td className="right">
                            <div style={{ fontWeight: 700 }}>{q.totalRaw.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} {q.currencyCode}</div>
                            {usd != null && <div style={{ fontSize: '11px', color: '#9ca3af' }}>${usd.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>}
                          </td>
                          <td className="center" style={{ color:'#6b7280', fontSize:'13px' }}>{q.validity ? `${q.validity}d` : '—'}</td>
                          <td>
                            <div style={{ color:'#111827', fontSize:'13px' }}>{q.contactPerson || '—'}</div>
                            {q.email && <a href={`mailto:${q.email}`} onClick={e => e.stopPropagation()} style={{ fontSize: '11px', color: '#2563eb' }}>{q.email}</a>}
                          </td>
                          <td style={{ color:'#6b7280', fontSize:'12.5px', maxWidth: '160px' }}>{q.remarks ? q.remarks.slice(0, 60) : '—'}</td>
                          <td>
                            {q.followUpDate && <div style={{ fontSize: '12px', color: '#374151' }}>📅 {q.followUpDate}</div>}
                            <div style={{ fontSize: '12px', color: q.outcome ? '#111827' : '#9ca3af', fontWeight: q.outcome ? 600 : 400 }}>{q.outcome || '—'}</div>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                              <button onClick={() => setQuoteDetail(q)} title="Edit" style={{ height: 24, width: 24, background: '#f3f4f6', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>✎</button>
                              <button onClick={() => createRevision(q)} title="Create revision" style={{ height: 24, padding: '0 8px', background: '#ecfef6', color: '#074E3B', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+Rev</button>
                            </div>
                          </td>
                        </tr>
                      );})}
                    </tbody>
                    {filtered.length > 0 && (
                      <tfoot>
                        <tr>
                          <td colSpan={6}></td>
                          <td className="right" style={{ fontWeight:600, color:'#111827' }}>
                            {quotesGrandTotal.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} {filtered[0]?.currencyCode ?? 'SAR'}
                          </td>
                          <td colSpan={5}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                  </div>
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              <div className="pur-tab-card">
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'14px'}}>Quick Actions</div>
                <button className="pur-sidebar-btn pur-sidebar-btn-blue" onClick={() => setShowNewQuote(true)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New Quotation
                </button>
                <button
                  className="pur-sidebar-btn pur-sidebar-btn-green"
                  onClick={() => {
                    setStatusFilter('accepted');
                    setTimeout(() => quotationsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Convert to Order
                </button>
                <button className="pur-sidebar-btn pur-sidebar-btn-outline" disabled style={{opacity:0.45,cursor:'not-allowed'}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>Apply Discount
                  <span style={{fontSize:'10px',fontWeight:500,color:'#9ca3af',marginLeft:'auto'}}>Soon</span>
                </button>
              </div>

              <div className="pur-tab-card">
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'14px'}}>Top Products</div>
                {topProducts === null ? (
                  <div style={{fontSize:'13px',color:'#9ca3af',textAlign:'center',padding:'12px 0'}}>Loading…</div>
                ) : topProducts.length === 0 ? (
                  <div style={{fontSize:'13px',color:'#9ca3af',textAlign:'center',padding:'12px 0'}}>No product data available</div>
                ) : (
                  topProducts.map((p, idx) => {
                    const c = PRODUCT_ICON_COLORS[idx % PRODUCT_ICON_COLORS.length];
                    return (
                      <div key={p.name} style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'12px'}}>
                        <div style={{width:'34px',height:'34px',background:c.bg,borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c.ic} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                        </div>
                        <div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:600,color:'#111827'}}>{p.name}</div></div>
                        <div style={{textAlign:'right'}}><div style={{fontSize:'13px',fontWeight:700,color:'#111827'}}>{fmtRevenue(p.revenue)}</div></div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Discount Rules */}
              <div className="pur-tab-card">
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'14px'}}>Discount Rules</div>
                {discountRules.filter(r => r.is_active).length === 0 && (
                  <div style={{fontSize:'12.5px',color:'#9ca3af',padding:'8px 0'}}>No active discount rules.</div>
                )}
                {discountRules.filter(r => r.is_active).map(r => (
                  <div key={r.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid #f3f4f6'}}>
                    <div>
                      <div style={{fontSize:'13px',fontWeight:600,color:'#111827'}}>{r.name}</div>
                      {r.description && <div style={{fontSize:'12px',color:'#9ca3af',marginTop:'1px'}}>{r.description}</div>}
                    </div>
                    <span style={{fontSize:'13px',fontWeight:700,color:'#16a34a'}}>{r.discount_label}</span>
                  </div>
                ))}
                <button style={{width:'100%',height:'34px',background:'#fff',color:'#374151',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'13px',fontWeight:500,cursor:'pointer',marginTop:'12px'}}
                  onClick={() => setShowDiscountModal(true)}>
                  Manage Rules
                </button>
              </div>
              {showDiscountModal && (
                <DiscountRulesModal
                  rules={discountRules}
                  onClose={() => setShowDiscountModal(false)}
                  onChanged={fetchDiscountRules}
                  showToast={showToast}
                />
              )}

              {/* Fulfillment Status */}
              <div className="pur-tab-card">
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'14px'}}>Fulfillment Status</div>
                {[
                  { id:'SO-2024-089', sub:'Delivered',  icon:'✓', bg:'#ECFEF6', ic:'#3F7868' },
                  { id:'SO-2024-088', sub:'In Transit', icon:'✓', bg:'#EFF6FF', ic:'#4F82EF' },
                  { id:'SO-2024-087', sub:'Processing', icon:'◔', bg:'#FFEED5', ic:'#9F3E1D' },
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
                    <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} style={{marginTop:'2px',accentColor:'#1E6D2F'}}/>
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
          </div>) : (
            <div className="rfq-odoo-card">
              <div className="rfq-toolbar">
                <div className="rfq-breadcrumb">
                  Sales Orders
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </div>
                <div className="rfq-pagination">
                  <span>{orders.length === 0 ? '0-0' : `1-${orders.length}`} / {orders.length}</span>
                  <button onClick={() => showToast('First page')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg></button>
                  <button onClick={() => showToast('Next page')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></button>
                </div>
                <div className="rfq-view-icons">
                  <button className="active" title="List"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></button>
                  <button title="Kanban" onClick={() => showToast('Kanban view coming soon')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="6" height="18" rx="1"/><rect x="15" y="3" width="6" height="10" rx="1"/></svg></button>
                </div>
              </div>

              {orders.length === 0 ? (
                <div style={{padding:'48px',textAlign:'center',color:'#9ca3af',fontSize:'13.5px'}}>
                  No orders yet. Convert an accepted quotation to create your first order.
                </div>
              ) : (
                <table className="rfq-odoo-table">
                  <thead>
                    <tr>
                      <th className="check"><input type="checkbox" onClick={e => e.stopPropagation()} /></th>
                      <th>Order No</th>
                      <th>Company</th>
                      <th>Date</th>
                      <th className="right">Total</th>
                      <th className="center">Status</th>
                      <th className="right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => {
                      const statusMeta = ORDER_STATUS_META[o.status] ?? {label:o.status,bg:'#f3f4f6',color:'#374151'};
                      const sym = CURRENCY_SYMBOLS[o.currency] ?? '';
                      const total = `${sym}${Number(o.total).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
                      const date = new Date(o.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
                      return (
                        <tr key={o.id} className="rfq-odoo-row" onClick={() => setOrderDetail(o)}>
                          <td className="check" onClick={e => e.stopPropagation()}><input type="checkbox" /></td>
                          <td className="pur-ref" style={{ fontFamily:'monospace' }}>{o.order_number}</td>
                          <td style={{ fontWeight:600, color:'#111827' }}>{o.customer_name || '—'}</td>
                          <td style={{ color:'#6b7280', fontSize:'13px' }}>{date}</td>
                          <td className="right" style={{ fontWeight:700 }}>{total}</td>
                          <td className="center"><span style={{background:statusMeta.bg,color:statusMeta.color,fontSize:'12px',fontWeight:600,padding:'3px 10px',borderRadius:'20px'}}>{statusMeta.label}</span></td>
                          <td className="right" onClick={e => e.stopPropagation()}>
                            <div style={{display:'flex',gap:'12px',alignItems:'center',justifyContent:'flex-end'}}>
                              {o.status === 'confirmed' && (
                                <button style={{fontSize:'12.5px',fontWeight:600,color:'#d97706',background:'none',border:'none',cursor:isActionPending(`${o.id}:shipped`)?'not-allowed':'pointer',padding:0,whiteSpace:'nowrap',opacity:isActionPending(`${o.id}:shipped`)?0.5:1}}
                                  disabled={isActionPending(`${o.id}:shipped`)}
                                  onClick={() => updateOrderStatus(o, 'shipped')}>
                                  {isActionPending(`${o.id}:shipped`) ? 'Updating…' : 'Mark as Shipped'}
                                </button>
                              )}
                              {o.status === 'shipped' && (
                                <button style={{fontSize:'12.5px',fontWeight:600,color:'#16a34a',background:'none',border:'none',cursor:isActionPending(`${o.id}:delivered`)?'not-allowed':'pointer',padding:0,whiteSpace:'nowrap',opacity:isActionPending(`${o.id}:delivered`)?0.5:1}}
                                  disabled={isActionPending(`${o.id}:delivered`)}
                                  onClick={() => updateOrderStatus(o, 'delivered')}>
                                  {isActionPending(`${o.id}:delivered`) ? 'Updating…' : 'Mark as Delivered'}
                                </button>
                              )}
                              <button
                                style={{fontSize:'12.5px',fontWeight:600,color:'#2563eb',background:'none',border:'none',cursor:'pointer',padding:0}}
                                onClick={() => setOrderDetail(o)}>
                                View Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ))}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
