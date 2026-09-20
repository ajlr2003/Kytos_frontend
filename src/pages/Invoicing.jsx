/**
 * @file src/pages/Invoicing.jsx
 *
 * Invoicing module — Kytos' own customer invoicing (replaces the old Odoo
 * proxy). Invoices are created as drafts on a form laid out like the printed
 * bilingual invoice, confirmed ("posted") to lock them — and get an
 * INV-YYYY-NNNN number unless one was typed — then settled by manually
 * recording payments against them.
 *
 * API (all under /api/v1/sales/invoices, see backend routers/sales_invoices.py):
 *   GET    /                    list  (?status=Draft|Open|Overdue|Paid|Cancelled&limit=)
 *   GET    /kpis                headline totals (SAR)
 *   GET    /company             seller block + bank accounts (read-only on the form)
 *   POST   /                    create draft            PUT /{id}   edit draft
 *   DELETE /{id}                delete draft
 *   POST   /{id}/post           confirm — assigns invoice number
 *   POST   /{id}/cancel         cancel (only when unpaid)
 *   POST   /{id}/payments       record payment          DELETE /{id}/payments/{pid}
 *   GET    /{id}/pdf            download PDF
 * Also: GET /api/v1/sales/orders (pre-fill an invoice from an order),
 *       GET /api/v1/auth/me     (current user / role gating).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Toast   from '../components/ui/Toast';
import Modal   from '../components/ui/Modal';
import ActivityTimeline from '../components/ui/ActivityTimeline';
import { API_BASE } from '../config';
import { CURRENCY_SYMBOLS } from '../constants';
import '../styles/Invoicing.css';

const INV_API = `${API_BASE}/api/v1/sales/invoices`;
const WRITE_ROLES = ['admin', 'manager', 'finance'];
const PAYMENT_METHODS = [
  ['bank_transfer', 'Bank transfer'], ['cash', 'Cash'], ['cheque', 'Cheque'], ['card', 'Card'], ['other', 'Other'],
];

/* === Helpers === */

function authHeaders() {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

/** Turn a FastAPI error body (string or validation-error list) into one message. */
function errMessage(data, fallback) {
  const d = data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map(e => `${(e.loc || []).slice(1).join(' › ')}: ${e.msg}`).join('; ');
  return fallback;
}

/** fetch → parsed JSON, throwing an Error whose message is the API's `detail`. */
async function api(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errMessage(data, `Request failed (${res.status})`));
  return data;
}

function fmtMoney(n, currency = 'SAR') {
  const sym = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const v = parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym}${v}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const todayISO = () => new Date().toISOString().slice(0, 10);

function fmtNum(n) {
  return parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function downloadPdf(inv) {
  const res = await fetch(`${INV_API}/${inv.id}/pdf`, { headers: authHeaders() });
  if (!res.ok) throw new Error(errMessage(await res.json().catch(() => ({})), 'Could not generate PDF'));
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `${(inv.invoice_number || 'invoice-draft').replace(/\//g, '-')}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_BADGE_CLS = { Draft: 'ib-draft', Open: 'ib-sent', Overdue: 'ib-over', Paid: 'ib-paid', Cancelled: 'ib-cancelled' };

function StatusBadge({ status }) {
  return <span className={`inv-badge ${STATUS_BADGE_CLS[status] || 'ib-draft'}`}>{status}</span>;
}

function ErrorBar({ msg }) {
  return msg ? <div className="inv-error">{msg}</div> : null;
}


/* === New / Edit invoice modal — laid out like the printed invoice === */

const UOMS = ['Units', 'EA', 'LOT', 'PCS', 'DAYS', 'MONTH'];
const PAYMENT_TERMS = ['Immediate Payment', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Due on Receipt'];
const PEGGED_RATES = { SAR: 1, USD: 3.75, AED: 1.0211 };     // SAR per 1 unit; others are typed in
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

const blankRow = () => ({ key: Math.random(), catalog_no: '', text: '', qty: 1, unit: 'Units', unit_price: '', discount: '' });

/** First line of the description box is the item name, the rest its description. */
function splitItemText(text) {
  const lines = text.trim().split('\n');
  return [lines[0].trim().slice(0, 255), lines.slice(1).join('\n').trim()];
}

/** Line maths — mirrors the server (which is the source of truth on save). */
function lineCalc(row, vatRate) {
  const qty  = parseFloat(row.qty) || 0;
  const up   = parseFloat(row.unit_price) || 0;
  const disc = Math.min(100, Math.max(0, parseFloat(row.discount) || 0));
  const taxable = r2(r2(up * (1 - disc / 100)) * qty);
  const tax = r2(taxable * vatRate / 100);
  return { gross: r2(qty * up), taxable, tax, incl: r2(taxable + tax) };
}

/** English label with its Arabic twin on the right, as on the printed invoice. */
function BiField({ en, ar, required, hint, span2, children }) {
  return (
    <div className="acc-form-group" style={span2 ? { gridColumn: '1 / -1' } : undefined}>
      <label className="inv-bilabel"><span>{en}{required && ' *'}</span>{ar && <span className="inv-ar" dir="rtl" lang="ar">{ar}</span>}</label>
      {children}
      {hint && <div className="inv-hint">{hint}</div>}
    </div>
  );
}

const ADDRESS_LABELS = [
  ['Building No.', 'رقم المبنى'], ['Street Name', 'اسم الشارع'], ['District', 'الحي'], ['City', 'المدينة'],
  ['Country', 'البلد'], ['Postal Code', 'الرمز البريدي'], ['Vat Number', 'رقم تسجيل ضريبة القيمة المضافة'], ['CR No.', 'السجل التجاري'],
];

/**
 * @param {object}   props
 * @param {object=}  props.invoice       - Existing draft to edit; omit to create.
 * @param {object[]} props.orders        - Sales orders, for "start from an order".
 * @param {string[]} props.customerNames - Known customer names (autocomplete).
 * @param {object=}  props.seller        - Seller block + bank accounts (read-only, from server settings).
 * @param {Function} props.onClose
 * @param {Function} props.onSaved       - Called with the saved invoice.
 */
function InvoiceFormModal({ invoice, orders, customerNames, seller, onClose, onSaved }) {
  const isEdit = !!invoice;
  const [form, setForm] = useState(() => ({
    invoice_number:       invoice?.invoice_number       ?? '',
    invoice_date:         invoice?.invoice_date         ?? todayISO(),
    delivery_note_no:     invoice?.delivery_note_no     ?? '',
    delivery_date:        invoice?.delivery_date        ?? '',
    payment_terms:        invoice?.payment_terms        ?? 'Immediate Payment',
    due_date:             invoice?.due_date             ?? '',
    your_ref:             invoice?.your_ref             ?? '',
    vendor_number:        invoice?.vendor_number        ?? '',
    internal_reference:   invoice?.internal_reference   ?? '',
    currency:             invoice?.currency             ?? 'SAR',
    exchange_rate:        invoice ? String(invoice.exchange_rate) : '1',
    gr_ses:               invoice?.gr_ses               ?? '',
    customer_name:        invoice?.customer_name        ?? '',
    customer_building_no: invoice?.customer_building_no ?? '',
    customer_street:      invoice?.customer_street      ?? '',
    customer_district:    invoice?.customer_district    ?? '',
    customer_city:        invoice?.customer_city        ?? '',
    customer_country:     invoice?.customer_country     ?? 'Saudi Arabia',
    customer_postal_code: invoice?.customer_postal_code ?? '',
    customer_tax_id:      invoice?.customer_tax_id      ?? '',
    customer_cr_no:       invoice?.customer_cr_no       ?? '',
    vat_rate:             String(invoice?.vat_rate ?? 15),
    remarks:              invoice?.remarks              ?? '',
    sales_order_id:       invoice?.sales_order_id       ?? null,
  }));
  const [rows, setRows] = useState(() =>
    invoice?.items?.length
      ? invoice.items.map(i => ({
          key: i.id, catalog_no: i.catalog_no ?? '', text: i.item_name + (i.description ? `\n${i.description}` : ''),
          qty: i.qty, unit: i.unit, unit_price: i.unit_price, discount: i.discount || '',
        }))
      : [blankRow()]
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const setF   = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setRow = (key, k, v) => setRows(rs => rs.map(r => r.key === key ? { ...r, [k]: v } : r));
  const bind   = k => ({ value: form[k], onChange: e => setF(k, e.target.value) });

  function changeCurrency(cur) {
    setForm(f => ({ ...f, currency: cur, exchange_rate: PEGGED_RATES[cur] != null ? String(PEGGED_RATES[cur]) : '' }));
  }

  const cur      = form.currency;
  const foreign  = cur !== 'SAR';
  const vatRate  = parseFloat(form.vat_rate) || 0;
  const fxRate   = foreign ? (parseFloat(form.exchange_rate) || 0) : 1;
  const calcs    = rows.map(r => lineCalc(r, vatRate));
  const gross    = r2(calcs.reduce((s, c) => s + c.gross, 0));
  const taxable  = r2(calcs.reduce((s, c) => s + c.taxable, 0));
  const discount = r2(gross - taxable);
  const vat      = r2(calcs.reduce((s, c) => s + c.tax, 0));
  const total    = r2(taxable + vat);
  const bank     = seller?.bank_accounts?.find(a => a.currency === cur);

  function startFromOrder(orderId) {
    const o = orders.find(x => x.id === orderId);
    if (!o) { setF('sales_order_id', null); return; }
    setForm(f => ({
      ...f,
      sales_order_id: o.id,
      customer_name:  o.customer_name || f.customer_name,
      currency:       o.currency || f.currency,
      exchange_rate:  PEGGED_RATES[o.currency] != null ? String(PEGGED_RATES[o.currency]) : '',
      payment_terms:  o.payment_terms || f.payment_terms,
      vat_rate:       String(Number(o.subtotal) > 0 ? Math.round((Number(o.vat) / Number(o.subtotal)) * 10000) / 100 : 15),
    }));
    setRows((o.items || []).length
      ? o.items.map(i => ({
          key: Math.random(), catalog_no: i.catalog_no ?? '', text: (i.item_name ?? '') + (i.description ? `\n${i.description}` : ''),
          qty: i.qty, unit: i.unit || 'Units', unit_price: i.unit_price, discount: i.discount || '',
        }))
      : [blankRow()]);
  }

  async function save() {
    if (!form.customer_name.trim()) { setError('Buyer name is required.'); return; }
    if (foreign && !(fxRate > 0)) { setError(`Enter the ${cur} to SAR exchange rate — it is used for the amounts printed in SAR.`); return; }
    const valid = rows.filter(r => r.text.trim() && parseFloat(r.qty) > 0 && r.unit_price !== '' && parseFloat(r.unit_price) >= 0);
    if (valid.length === 0) { setError('Add at least one line with an item description, a quantity above 0 and a unit price.'); return; }

    setSaving(true); setError('');
    try {
      const body = {
        ...form,
        invoice_number: form.invoice_number.trim() || null,
        invoice_date:   form.invoice_date || null,
        delivery_date:  form.delivery_date || null,
        due_date:       form.due_date || null,
        exchange_rate:  foreign ? fxRate : null,
        vat_rate:       vatRate,
        items: valid.map(r => {
          const [name, description] = splitItemText(r.text);
          return {
            catalog_no: r.catalog_no.trim() || null, item_name: name, description: description || null,
            qty: parseFloat(r.qty), unit: r.unit, unit_price: parseFloat(r.unit_price), discount: parseFloat(r.discount) || 0,
          };
        }),
      };
      const saved = await api(isEdit ? `${INV_API}/${invoice.id}` : INV_API, {
        method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(body),
      });
      onSaved(saved, isEdit);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const sellerRows = seller ? [
    ['Name', 'الاسم', seller.name], ['Building No.', 'رقم المبنى', seller.building], ['Street Name', 'اسم الشارع', seller.street],
    ['District', 'الحي', seller.district], ['City', 'المدينة', seller.city], ['Country', 'البلد', seller.country],
    ['Postal Code', 'الرمز البريدي', seller.postal_code], ['Vat Number', 'رقم تسجيل ضريبة القيمة المضافة', seller.vat_number],
    ['CR No.', 'السجل التجاري', seller.cr_no],
  ] : [];

  return (
    <Modal title={isEdit ? 'Edit Draft Invoice' : 'New Invoice'} onClose={onClose}>
      <ErrorBar msg={error} />

      <div className="inv-invoice-title"><span dir="rtl" lang="ar">فاتورة</span><span>Invoice</span></div>

      {!isEdit && orders.length > 0 && (
        <div className="acc-form-group">
          <label>Start from a sales order (optional)</label>
          <select value={form.sales_order_id || ''} onChange={e => startFromOrder(e.target.value)}>
            <option value="">— Blank invoice —</option>
            {orders.filter(o => o.status !== 'cancelled').map(o => (
              <option key={o.id} value={o.id}>{o.order_number} — {o.customer_name || 'Unknown'} ({fmtMoney(o.total, o.currency)})</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Header references ── */}
      <div className="acc-form-grid inv-grid-3">
        <BiField en="Invoice Number" ar="رقم الفاتورة" hint="Leave blank to auto-number (INV-YYYY-NNNN) when confirmed">
          <input type="text" placeholder="e.g. 2025/1838/5" {...bind('invoice_number')} />
        </BiField>
        <BiField en="Invoice Date" ar="تاريخ الفاتورة"><input type="date" {...bind('invoice_date')} /></BiField>
        <BiField en="Delivery Note No" ar="رقم إيصال التوصيل"><input type="text" {...bind('delivery_note_no')} /></BiField>
        <BiField en="Delivery Date" ar="تاريخ التوصيل"><input type="date" {...bind('delivery_date')} /></BiField>
        <BiField en="Term of Payment" ar="طريقة الدفع">
          <select {...bind('payment_terms')}>
            {form.payment_terms && !PAYMENT_TERMS.includes(form.payment_terms) && <option>{form.payment_terms}</option>}
            {PAYMENT_TERMS.map(t => <option key={t}>{t}</option>)}
          </select>
        </BiField>
        <BiField en="Due Date" ar="تاريخ الاستحقاق" hint="Blank = worked out from the payment terms"><input type="date" {...bind('due_date')} /></BiField>
        <BiField en="Customer's PO Ref" ar="رقم أمر الشراء"><input type="text" {...bind('your_ref')} /></BiField>
        <BiField en="Vendor Number for Al Sinan" ar="رقم المورد للشركة السنان"><input type="text" {...bind('vendor_number')} /></BiField>
        <BiField en="Internal Reference Number For Al Sinan" ar="الرقم الإشاري للشركة"><input type="text" {...bind('internal_reference')} /></BiField>
        <BiField en="Invoice Currency" ar="عملة الفاتورة">
          <select value={cur} onChange={e => changeCurrency(e.target.value)}>
            {Object.keys(CURRENCY_SYMBOLS).map(c => <option key={c}>{c}</option>)}
          </select>
        </BiField>
        {foreign ? (
          <BiField en={`Exchange rate (1 ${cur} = ? SAR)`} required hint="Used for the VAT and total printed in SAR">
            <input type="number" min="0" step="0.0001" {...bind('exchange_rate')} />
          </BiField>
        ) : <div />}
        <BiField en="GR/SES" ar="إشعار استلام البضائع/ورقة دخول الخدمة"><input type="text" {...bind('gr_ses')} /></BiField>
      </div>

      {/* ── Seller (fixed) / Buyer ── */}
      <div className="inv-parties">
        <div>
          <div className="inv-band"><span>Seller</span><span dir="rtl" lang="ar">البائع</span></div>
          <div className="inv-kv">
            {sellerRows.map(([en, ar, val]) => (
              <div key={en}><span>{en}</span><strong>{val || '—'}</strong><span className="inv-ar" dir="rtl" lang="ar">{ar}</span></div>
            ))}
            {!seller && <div className="inv-hint" style={{ padding: 10 }}>Loading seller details…</div>}
          </div>
        </div>
        <div>
          <div className="inv-band"><span>Buyer\ Bill to</span><span dir="rtl" lang="ar">المشتري / فاتورة إلى</span></div>
          <div className="inv-buyer">
            <BiField en="Name" ar="الاسم" required span2>
              <input type="text" list="inv-customer-names" placeholder="Company name" autoComplete="off" {...bind('customer_name')} />
              <datalist id="inv-customer-names">{customerNames.map(n => <option key={n} value={n} />)}</datalist>
            </BiField>
            {[['customer_building_no', 0], ['customer_street', 1], ['customer_district', 2], ['customer_city', 3],
              ['customer_country', 4], ['customer_postal_code', 5], ['customer_tax_id', 6], ['customer_cr_no', 7]].map(([k, i]) => (
              <BiField key={k} en={ADDRESS_LABELS[i][0]} ar={ADDRESS_LABELS[i][1]}><input type="text" {...bind(k)} /></BiField>
            ))}
          </div>
        </div>
      </div>

      {/* ── Line items ── */}
      <div className="inv-band inv-band-center"><span>Line items</span></div>
      <div className="inv-lines-wrap">
        <table className="inv-lines">
          <thead>
            <tr>
              <th style={{ width: 34 }}>Serial Number<em dir="rtl" lang="ar">الرقم التسلسلي</em></th>
              <th style={{ width: 96 }}>Material Number<em dir="rtl" lang="ar">رقم المواد</em></th>
              <th style={{ minWidth: 250 }}>Item Description<em dir="rtl" lang="ar">وصف الصنف</em></th>
              <th style={{ width: 96 }}>Unit Price<em dir="rtl" lang="ar">سعر الوحدة</em></th>
              <th style={{ width: 70 }}>Quantity<em dir="rtl" lang="ar">الكمية</em></th>
              <th style={{ width: 86 }}>UOM<em dir="rtl" lang="ar">وحدة القياس</em></th>
              <th style={{ width: 66 }}>Disc %<em dir="rtl" lang="ar">خصم</em></th>
              <th style={{ width: 104, textAlign: 'right' }}>Taxable Amount<em dir="rtl" lang="ar">المبلغ الخاضع للضريبة</em></th>
              <th style={{ width: 64, textAlign: 'center' }}>Tax Rate<em dir="rtl" lang="ar">نسبة الضريبة</em></th>
              <th style={{ width: 92, textAlign: 'right' }}>Tax Amount<em dir="rtl" lang="ar">مبلغ الضريبة</em></th>
              <th style={{ width: 112, textAlign: 'right' }}>Item Subtotal (Including Vat)<em dir="rtl" lang="ar">المجموع (شامل ضريبة)</em></th>
              <th style={{ width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key}>
                <td className="inv-lines-no">{i + 1}</td>
                <td><input value={r.catalog_no} onChange={e => setRow(r.key, 'catalog_no', e.target.value)} /></td>
                <td><textarea rows={2} placeholder="Item name — extra lines become its description" value={r.text} onChange={e => setRow(r.key, 'text', e.target.value)} /></td>
                <td><input type="number" min="0" step="0.01" placeholder="0.00" value={r.unit_price} onChange={e => setRow(r.key, 'unit_price', e.target.value)} /></td>
                <td><input type="number" min="0" step="any" value={r.qty} onChange={e => setRow(r.key, 'qty', e.target.value)} /></td>
                <td>
                  <select value={r.unit} onChange={e => setRow(r.key, 'unit', e.target.value)}>
                    {!UOMS.includes(r.unit) && <option>{r.unit}</option>}
                    {UOMS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </td>
                <td><input type="number" min="0" max="100" step="0.1" placeholder="0" value={r.discount} onChange={e => setRow(r.key, 'discount', e.target.value)} /></td>
                <td className="inv-lines-amt">{fmtNum(calcs[i].taxable)}</td>
                <td className="inv-lines-mid">VAT {vatRate}%</td>
                <td className="inv-lines-amt">{fmtNum(calcs[i].tax)}</td>
                <td className="inv-lines-amt">{fmtNum(calcs[i].incl)}</td>
                <td>
                  <button className="inv-lines-del" title="Remove line" disabled={rows.length === 1}
                    onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="inv-add-line" onClick={() => setRows(rs => [...rs, blankRow()])}>+ Add line</button>

      {/* ── Totals ── */}
      <div className="inv-band"><span>Total Amounts</span><span dir="rtl" lang="ar">إجمالي المبلغ</span></div>
      <div className="inv-kv inv-kv-totals">
        {[
          ['Total (Excluding Vat)', 'الإجمالي (غير شامل ضريبة القيمة المضافة)', gross, cur],
          ['Discount', 'مجموع الخصومات', discount, cur],
          ['Total Taxable Amount (Excluding Vat)', 'الإجمالي الخاضع للضريبة', taxable, cur],
        ].map(([en, ar, v, c]) => (
          <div key={en}><span>{en}</span><span className="inv-ar" dir="rtl" lang="ar">{ar}</span><strong>{fmtNum(v)} {c}</strong></div>
        ))}
        <div>
          <span>Total Vat <input className="inv-vat-input" type="number" min="0" max="100" step="0.5" value={form.vat_rate}
            onChange={e => setF('vat_rate', e.target.value)} />%</span>
          <span className="inv-ar" dir="rtl" lang="ar">مجموع ضريبة القيمة المضافة</span><strong>{fmtNum(vat)} {cur}</strong>
        </div>
        {foreign && <div><span>Total Vat {vatRate}% in SAR</span><span className="inv-ar" dir="rtl" lang="ar">مجموع ضريبة القيمة المضافة بالريال السعودي</span><strong>{fmtNum(r2(vat * fxRate))} SAR</strong></div>}
        <div className="inv-kv-grand"><span>Total Amount Due</span><span className="inv-ar" dir="rtl" lang="ar">إجمالي المبلغ المستحق</span><strong>{fmtNum(total)} {cur}</strong></div>
        {foreign && <div className="inv-kv-grand"><span>Total Amount Due in SAR</span><span className="inv-ar" dir="rtl" lang="ar">إجمالي المبلغ المستحق بالريال السعودي</span><strong>{fmtNum(r2(total * fxRate))} SAR</strong></div>}
      </div>
      <div className="inv-hint">The amount in words (English and Arabic) is added automatically on the printed invoice.</div>

      {/* ── Bank details (fixed, by currency) ── */}
      <div className="inv-band inv-band-center"><span>Bank Details</span><span dir="rtl" lang="ar">تفاصيل البنك</span></div>
      {bank ? (
        <div className="inv-kv inv-kv-bank">
          {[['Name', bank.account_name], ['A/C No', bank.account_no], ['SWIFT CODE', bank.swift], ['BANK', bank.bank], ['BRANCH', bank.branch], ['IBAN No', bank.iban]].map(([k, v]) => (
            <div key={k}><span>{k}</span><strong>{v || '—'}</strong></div>
          ))}
        </div>
      ) : (
        <div className="inv-hint" style={{ margin: '6px 0 4px' }}>
          {seller ? `No ${cur} bank account is configured, so the printed invoice will have no bank details.` : 'Loading…'}
        </div>
      )}

      {/* ── Notes ── */}
      <div className="acc-form-group" style={{ marginTop: 16 }}>
        <label className="inv-bilabel"><span>Notes</span><span className="inv-ar" dir="rtl" lang="ar">ملاحظات</span></label>
        <textarea className="inv-notes-input" rows={2} {...bind('remarks')} />
      </div>

      <div className="acc-modal-actions">
        <button className="acc-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="acc-btn-save" onClick={save} disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save as draft'}</button>
      </div>
    </Modal>
  );
}


/* === Invoice detail modal === */

/**
 * @param {object}   props
 * @param {string}   props.invoiceId
 * @param {boolean}  props.canWrite  - Current user may modify invoices.
 * @param {Function} props.onClose
 * @param {Function} props.onChanged - Called after any mutation so the list refreshes.
 * @param {Function} props.onEdit    - Called with the invoice to open the edit form.
 * @param {Function} props.showToast
 */
function InvoiceDetailModal({ invoiceId, canWrite, onClose, onChanged, onEdit, showToast }) {
  const [inv, setInv]           = useState(null);
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);
  const [confirming, setConfirming] = useState(null);   // 'post' | 'cancel' | 'delete'
  const [showPay, setShowPay]   = useState(false);
  const [pay, setPay]           = useState({ amount: '', payment_date: todayISO(), method: 'bank_transfer', reference: '', notes: '' });

  useEffect(() => {
    api(`${INV_API}/${invoiceId}`).then(setInv).catch(e => setError(e.message));
  }, [invoiceId]);

  /** Run a mutation, swap in the returned invoice, refresh the list behind us. */
  async function run(fn, successMsg) {
    setBusy(true); setError('');
    try {
      const updated = await fn();
      if (updated) setInv(updated);
      setConfirming(null);
      onChanged();
      if (successMsg) showToast(typeof successMsg === 'function' ? successMsg(updated) : successMsg);
      return updated;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const post   = () => run(() => api(`${INV_API}/${inv.id}/post`,   { method: 'POST' }), u => `Invoice ${u.invoice_number} confirmed`);
  const cancel = () => run(() => api(`${INV_API}/${inv.id}/cancel`, { method: 'POST' }), 'Invoice cancelled');
  const remove = async () => {
    setBusy(true); setError('');
    try { await api(`${INV_API}/${inv.id}`, { method: 'DELETE' }); onChanged(); showToast('Draft deleted'); onClose(); }
    catch (e) { setError(e.message); setBusy(false); }
  };
  const voidPayment = id => run(() => api(`${INV_API}/${inv.id}/payments/${id}`, { method: 'DELETE' }), 'Payment removed');
  async function recordPayment() {
    const amount = parseFloat(pay.amount);
    if (!(amount > 0)) { setError('Enter a payment amount above 0.'); return; }
    const updated = await run(() => api(`${INV_API}/${inv.id}/payments`, {
      method: 'POST',
      body: JSON.stringify({ ...pay, amount, reference: pay.reference.trim() || null, notes: pay.notes.trim() || null }),
    }), 'Payment recorded');
    if (updated) { setShowPay(false); setPay(p => ({ ...p, amount: '', reference: '', notes: '' })); }
  }

  async function pdf() {
    showToast('Generating PDF…');
    try { await downloadPdf(inv); } catch (e) { setError(e.message); }
  }

  if (!inv) {
    return (
      <Modal title="Invoice" onClose={onClose}>
        {error ? <ErrorBar msg={error} /> : <div className="inv-empty">Loading…</div>}
      </Modal>
    );
  }

  const cur = inv.currency;
  const isDraft = inv.status === 'draft', isPosted = inv.status === 'posted', isPaid = inv.status === 'paid';

  return (
    <Modal title={inv.invoice_number ? `Invoice ${inv.invoice_number}` : 'Draft invoice'} onClose={onClose}>
      <div className="inv-detail-head">
        <div>
          <div className="inv-detail-cust">{inv.customer_name}</div>
          {inv.your_ref && <div className="inv-detail-sub">Customer's PO Ref: {inv.your_ref}</div>}
        </div>
        <div className="inv-detail-amt">
          <StatusBadge status={inv.display_status} />
          <div className="inv-amount">{fmtMoney(inv.total, cur)}</div>
          {(isPosted || isPaid) && inv.amount_paid > 0 && (
            <div className="inv-detail-paid">Paid {fmtMoney(inv.amount_paid, cur)} · Balance {fmtMoney(inv.balance, cur)}</div>
          )}
        </div>
      </div>

      <ErrorBar msg={error} />

      {canWrite && (
        <div className="inv-action-bar">
          {isDraft && <>
            <button className="inv-btn inv-btn-primary" disabled={busy} onClick={() => setConfirming('post')}>Confirm invoice</button>
            <button className="inv-btn" disabled={busy} onClick={() => onEdit(inv)}>Edit</button>
            <button className="inv-btn inv-btn-danger" disabled={busy} onClick={() => setConfirming('delete')}>Delete draft</button>
          </>}
          {isPosted && <>
            <button className="inv-btn inv-btn-primary" disabled={busy} onClick={() => { setShowPay(s => !s); setPay(p => ({ ...p, amount: String(inv.balance) })); }}>Record payment</button>
            {inv.payments.length === 0 && <button className="inv-btn inv-btn-danger" disabled={busy} onClick={() => setConfirming('cancel')}>Cancel invoice</button>}
          </>}
          <button className="inv-btn" onClick={pdf}>Download PDF</button>
        </div>
      )}
      {!canWrite && <div className="inv-action-bar"><button className="inv-btn" onClick={pdf}>Download PDF</button></div>}

      {confirming === 'post' && (
        <div className="inv-confirm">
          <div>Confirming assigns the next invoice number and <strong>locks the invoice against editing</strong>. A confirmed invoice can be cancelled (if unpaid) but never deleted.</div>
          <div className="inv-confirm-btns">
            <button className="inv-btn" onClick={() => setConfirming(null)} disabled={busy}>Back</button>
            <button className="inv-btn inv-btn-primary" onClick={post} disabled={busy}>{busy ? 'Confirming…' : 'Yes, confirm invoice'}</button>
          </div>
        </div>
      )}
      {confirming === 'cancel' && (
        <div className="inv-confirm">
          <div>Cancel invoice <strong>{inv.invoice_number}</strong>? It stays in the list as Cancelled and its number is not reused.</div>
          <div className="inv-confirm-btns">
            <button className="inv-btn" onClick={() => setConfirming(null)} disabled={busy}>Back</button>
            <button className="inv-btn inv-btn-danger" onClick={cancel} disabled={busy}>{busy ? 'Cancelling…' : 'Yes, cancel invoice'}</button>
          </div>
        </div>
      )}
      {confirming === 'delete' && (
        <div className="inv-confirm">
          <div>Permanently delete this draft? This can't be undone.</div>
          <div className="inv-confirm-btns">
            <button className="inv-btn" onClick={() => setConfirming(null)} disabled={busy}>Back</button>
            <button className="inv-btn inv-btn-danger" onClick={remove} disabled={busy}>{busy ? 'Deleting…' : 'Yes, delete draft'}</button>
          </div>
        </div>
      )}

      {showPay && isPosted && (
        <div className="inv-pay-form">
          <div className="inv-section-title" style={{ marginTop: 0 }}>Record a payment</div>
          <div className="acc-form-grid inv-grid-4">
            <div className="acc-form-group"><label>Amount ({cur}) *</label>
              <input type="number" min="0" step="0.01" value={pay.amount} onChange={e => setPay(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="acc-form-group"><label>Date</label>
              <input type="date" value={pay.payment_date} onChange={e => setPay(p => ({ ...p, payment_date: e.target.value }))} /></div>
            <div className="acc-form-group"><label>Method</label>
              <select value={pay.method} onChange={e => setPay(p => ({ ...p, method: e.target.value }))}>
                {PAYMENT_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></div>
            <div className="acc-form-group"><label>Reference</label>
              <input type="text" placeholder="Txn / cheque no." value={pay.reference} onChange={e => setPay(p => ({ ...p, reference: e.target.value }))} /></div>
          </div>
          <div className="inv-confirm-btns">
            <button className="inv-btn" onClick={() => setShowPay(false)} disabled={busy}>Cancel</button>
            <button className="inv-btn inv-btn-primary" onClick={recordPayment} disabled={busy}>{busy ? 'Saving…' : 'Save payment'}</button>
          </div>
        </div>
      )}

      <div className="inv-meta-grid">
        {[
          ['Invoice number', inv.invoice_number || 'Draft'], ['Invoice date', fmtDate(inv.invoice_date)], ['Due date', fmtDate(inv.due_date)],
          ['Term of payment', inv.payment_terms || '—'], ['Delivery note no', inv.delivery_note_no || '—'], ['Delivery date', fmtDate(inv.delivery_date)],
          ["Customer's PO ref", inv.your_ref || '—'], ['Vendor number for Al Sinan', inv.vendor_number || '—'], ['Internal reference no.', inv.internal_reference || '—'],
          ['GR/SES', inv.gr_ses || '—'],
          ['Invoice currency', cur === 'SAR' ? 'SAR' : `${cur} (1 ${cur} = ${inv.exchange_rate} SAR)`], ['Sales order', inv.sales_order_number || '—'],
          ['Buyer VAT number', inv.customer_tax_id || '—'], ['Buyer CR no.', inv.customer_cr_no || '—'],
          ['Buyer address', [inv.customer_building_no, inv.customer_street, inv.customer_district, inv.customer_city, inv.customer_country, inv.customer_postal_code].filter(Boolean).join(', ') || '—'],
          ['Created by', inv.created_by_name ? `${inv.created_by_name}${inv.created_by_email ? ` (${inv.created_by_email})` : ''}` : '—'],
          ['Created', fmtDateTime(inv.created_at)],
        ].map(([k, v]) => <div key={k}><span>{k}</span><strong>{v}</strong></div>)}
      </div>

      <div className="inv-section-title">Line items</div>
      <div className="inv-lines-wrap">
        <table className="inv-lines inv-lines-ro">
          <thead>
            <tr><th>#</th><th>Material no.</th><th>Item description</th><th style={{ textAlign: 'right' }}>Unit price</th>
              <th style={{ textAlign: 'right' }}>Qty</th><th>UOM</th><th style={{ textAlign: 'right' }}>Taxable amount</th>
              <th style={{ textAlign: 'center' }}>Tax rate</th><th style={{ textAlign: 'right' }}>Tax amount</th>
              <th style={{ textAlign: 'right' }}>Item subtotal (incl. VAT)</th></tr>
          </thead>
          <tbody>
            {inv.items.map(i => (
              <tr key={i.id}>
                <td className="inv-lines-no">{i.line_no}</td>
                <td>{i.catalog_no || '—'}</td>
                <td>
                  <strong>{i.item_name}</strong>
                  {i.description && <div className="inv-line-desc">{i.description}</div>}
                </td>
                <td style={{ textAlign: 'right' }}>{fmtNum(i.unit_price)}</td>
                <td style={{ textAlign: 'right' }}>{fmtNum(i.qty)}</td><td>{i.unit}</td>
                <td style={{ textAlign: 'right' }}>{fmtNum(i.total)}</td>
                <td style={{ textAlign: 'center' }}>VAT {inv.vat_rate}%</td>
                <td style={{ textAlign: 'right' }}>{fmtNum(i.tax_amount)}</td>
                <td style={{ textAlign: 'right' }}><strong>{fmtNum(i.subtotal_incl_vat)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="inv-totals-box inv-totals-right">
        <div><span>Total (excluding VAT)</span><strong>{fmtNum(inv.subtotal)} {cur}</strong></div>
        <div><span>Discount</span><strong>{fmtNum(inv.discount)} {cur}</strong></div>
        <div><span>Total taxable amount</span><strong>{fmtNum(inv.taxable_amount)} {cur}</strong></div>
        <div><span>Total VAT {inv.vat_rate}%</span><strong>{fmtNum(inv.vat)} {cur}</strong></div>
        {cur !== 'SAR' && <div><span>Total VAT {inv.vat_rate}% in SAR</span><strong>{fmtNum(inv.vat_sar)} SAR</strong></div>}
        <div className="inv-totals-grand"><span>Total amount due</span><strong>{fmtNum(inv.total)} {cur}</strong></div>
        {cur !== 'SAR' && <div><span>Total amount due in SAR</span><strong>{fmtNum(inv.total_sar)} SAR</strong></div>}
        {inv.amount_paid > 0 && <>
          <div><span>Paid</span><strong>− {fmtNum(inv.amount_paid)} {cur}</strong></div>
          <div className="inv-totals-balance"><span>Balance due</span><strong>{fmtNum(inv.balance)} {cur}</strong></div>
        </>}
      </div>

      {inv.remarks && (
        <div className="inv-notes"><div><span>Notes</span><p>{inv.remarks}</p></div></div>
      )}

      {inv.payments.length > 0 && <>
        <div className="inv-section-title">Payments</div>
        <table className="inv-lines inv-lines-ro">
          <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th style={{ textAlign: 'right' }}>Amount</th>{canWrite && <th style={{ width: 80 }}></th>}</tr></thead>
          <tbody>
            {inv.payments.map(p => (
              <tr key={p.id}>
                <td>{fmtDate(p.payment_date)}</td>
                <td>{(PAYMENT_METHODS.find(([v]) => v === p.method) || [0, p.method])[1]}</td>
                <td>{p.reference || '—'}</td>
                <td style={{ textAlign: 'right' }}><strong>{fmtMoney(p.amount, cur)}</strong></td>
                {canWrite && <td style={{ textAlign: 'right' }}>
                  <button className="inv-link-danger" disabled={busy} onClick={() => voidPayment(p.id)}>Remove</button>
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      </>}

      <div className="inv-section-title">Activity</div>
      <ActivityTimeline key={`${inv.id}-${inv.status}-${inv.payments.length}`} entityType="sales_invoice" entityId={inv.id} />
    </Modal>
  );
}


/* ═══════════════════════════ MAIN COMPONENT ═══════════════════════════ */

const FILTERS = [
  { key: 'All',       color: '#4b5563', badge: 'cnt-gray', icon: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></> },
  { key: 'Draft',     color: '#a16207', badge: 'cnt-gray', icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></> },
  { key: 'Open',      color: '#1d4ed8', badge: 'cnt-blue', icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></> },
  { key: 'Overdue',   color: '#dc2626', badge: 'cnt-red',  icon: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></> },
  { key: 'Paid',      color: '#16a34a', badge: 'cnt-gray', icon: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></> },
  { key: 'Cancelled', color: '#6b7280', badge: 'cnt-gray', icon: <><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></> },
];

/**
 * Invoicing page — Kytos' in-house customer invoicing.
 *
 * @param {object}   props
 * @param {Function} props.goPage - Navigate to another page by key.
 */
export default function Invoicing({ goPage }) {
  const [invoices,    setInvoices]    = useState([]);
  const [kpis,        setKpis]        = useState(null);
  const [counts,      setCounts]      = useState({});
  const [orders,      setOrders]      = useState([]);
  const [seller,      setSeller]      = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [filter,      setFilter]      = useState('All');
  const [searchQ,     setSearchQ]     = useState('');
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState('');
  const [form,        setForm]        = useState(null);     // null | { invoice? }
  const [detailId,    setDetailId]    = useState(null);
  const [toast,       setToast]       = useState(null);

  const showToast = msg => setToast(msg);

  /* --- Data loading --- */

  const loadInvoices = useCallback(async (statusFilter) => {
    setLoading(true); setLoadError('');
    try {
      const qs = new URLSearchParams({ limit: '500' });
      if (statusFilter && statusFilter !== 'All') qs.set('status', statusFilter);
      const data = await api(`${INV_API}?${qs}`);
      setInvoices(data.items || []);
      setCounts(data.counts || {});
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadKpis = useCallback(async () => {
    try { setKpis(await api(`${INV_API}/kpis`)); } catch { /* KPI strip is optional */ }
  }, []);

  useEffect(() => {
    loadKpis();
    api(`${API_BASE}/api/v1/auth/me`).then(setCurrentUser).catch(() => {});
    api(`${API_BASE}/api/v1/sales/orders`).then(d => setOrders(d.items || [])).catch(() => {});
    api(`${INV_API}/company`).then(setSeller).catch(() => {});
  }, [loadKpis]);

  useEffect(() => { loadInvoices(filter); }, [filter, loadInvoices]);

  const refresh = useCallback(() => { loadInvoices(filter); loadKpis(); }, [filter, loadInvoices, loadKpis]);

  /* --- Derived --- */

  const canWrite = WRITE_ROLES.includes(String(currentUser?.role || '').toLowerCase());
  const userInitials = currentUser ? currentUser.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '';
  const totalCount = ['Draft', 'Open', 'Overdue', 'Paid', 'Cancelled'].reduce((s, k) => s + (counts[k] || 0), 0);

  const customerNames = useMemo(
    () => [...new Set([...orders.map(o => o.customer_name), ...invoices.map(i => i.customer_name)].filter(Boolean))].sort(),
    [orders, invoices],
  );

  const displayed = invoices.filter(inv => {
    const q = searchQ.trim().toLowerCase();
    return !q || inv.customer_name.toLowerCase().includes(q) || (inv.invoice_number || '').toLowerCase().includes(q);
  });

  function exportCsv() {
    if (!displayed.length) { showToast('No invoices to export.'); return; }
    const rows = [
      ['Invoice No.', 'Customer', 'Currency', 'Total', 'Paid', 'Balance', 'Invoice Date', 'Due Date', 'Status'],
      ...displayed.map(i => [i.invoice_number || 'Draft', i.customer_name, i.currency, i.total, i.amount_paid, i.balance, i.invoice_date || '', i.due_date || '', i.display_status]),
    ];
    const csv  = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url  = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a    = document.createElement('a');
    a.href = url;
    a.download = `invoices-${filter.toLowerCase()}-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${displayed.length} invoice(s) to CSV`);
  }

  function onFormSaved(saved, wasEdit) {
    showToast(wasEdit ? 'Draft updated' : 'Draft invoice created');
    refresh();
    setDetailId(saved.id);
  }

  /* --- Render --- */

  return (
    <div id="invoicing-page">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      {form && (
        <InvoiceFormModal invoice={form.invoice} orders={orders} customerNames={customerNames} seller={seller}
          onClose={() => setForm(null)} onSaved={onFormSaved} />
      )}
      {detailId && !form && (
        <InvoiceDetailModal key={detailId} invoiceId={detailId} canWrite={canWrite} showToast={showToast}
          onClose={() => setDetailId(null)} onChanged={refresh}
          onEdit={inv => setForm({ invoice: inv })} />
      )}

      <Sidebar activePage="invoicing" goPage={goPage} />

      <div className="db-main">
        {/* Toolbar */}
        <div className="tb">
          <div className="tb-title tb-title-block">
            <div>Invoicing</div>
            <div className="tb-subtitle">Create customer invoices, confirm them to get an invoice number, and record payments as they arrive</div>
          </div>
          <div className="tb-right">
            <div className="tb-bell"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <div className="tb-user">
              <div className="tb-avatar" style={{ background: 'linear-gradient(135deg,#16a34a,#10b981)' }}>{userInitials || '…'}</div>
              <div><div className="tb-uname">{currentUser?.full_name || 'Loading…'}</div><div className="tb-urole">{currentUser?.role || ''}</div></div>
            </div>
          </div>
        </div>

        <div className="pg">
          <div className="pg-header">
            <div className="pg-header-left">
              {currentUser && !canWrite && (
                <div className="inv-viewonly">
                  View-only: the <strong>{currentUser.role}</strong> role can't create or change invoices. Log in as an admin, manager or finance user to do that.
                </div>
              )}
            </div>
            <div className="pg-header-actions">
              {canWrite && (
                <button className="btn-action btn-blue" onClick={() => setForm({})}>
                  <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New Invoice
                </button>
              )}
              <button className="btn-action btn-purple" onClick={exportCsv}>
                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export
              </button>
            </div>
          </div>

          {/* KPI strip */}
          {kpis && (
            <>
              <div className="inv-kpis">
                {[
                  { label: 'Total Invoiced',   value: fmtMoney(kpis.total_invoiced, kpis.currency),    color: '#2563eb' },
                  { label: 'Received',         value: fmtMoney(kpis.total_received, kpis.currency),    color: '#16a34a' },
                  { label: 'Outstanding',      value: fmtMoney(kpis.total_outstanding, kpis.currency), color: '#7c3aed' },
                  { label: 'Overdue Invoices', value: kpis.overdue_count,                              color: '#dc2626' },
                ].map(k => (
                  <div key={k.label} className="kpi" style={{ cursor: 'default' }}>
                    <div className="kpi-label">{k.label}</div>
                    <div className="kpi-body"><div className="kpi-value" style={{ color: k.color, fontSize: '22px' }}>{k.value}</div></div>
                  </div>
                ))}
              </div>
              {kpis.other_currency_invoices > 0 && (
                <div className="inv-kpi-note">Totals above cover {kpis.currency} invoices only — {kpis.other_currency_invoices} invoice(s) in other currencies are not included.</div>
              )}
            </>
          )}

          <div className="inv-layout">
            {/* Left: status filter */}
            <div className="inv-left">
              <div className="inv-panel">
                <div className="inv-panel-title">Invoice Status</div>
                {FILTERS.map(f => (
                  <div key={f.key} className={`inv-status-item${filter === f.key ? ' active' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setFilter(f.key)}>
                    <span className="inv-status-icon" style={{ color: f.color }}><svg viewBox="0 0 24 24">{f.icon}</svg></span>
                    <span className="inv-status-name">{f.key}</span>
                    <span className={`inv-count-badge ${f.badge}`}>{f.key === 'All' ? totalCount : (counts[f.key] ?? 0)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Center: list */}
            <div className="inv-center">
              <div className="inv-search-bar">
                <input className="inv-search" placeholder="Search by customer or invoice number…" type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              </div>

              <div className="inv-list">
                {loading ? (
                  <div className="inv-empty">Loading invoices…</div>
                ) : loadError ? (
                  <div className="inv-empty" style={{ color: '#dc2626' }}>{loadError}</div>
                ) : displayed.length === 0 ? (
                  <div className="inv-empty">
                    {searchQ ? `No invoices match "${searchQ}".` : filter === 'All' ? 'No invoices yet.' : `No ${filter.toLowerCase()} invoices.`}
                    {canWrite && filter === 'All' && !searchQ && <div style={{ marginTop: 10 }}><button className="inv-btn inv-btn-primary" onClick={() => setForm({})}>Create your first invoice</button></div>}
                  </div>
                ) : displayed.map(inv => (
                  <div key={inv.id} className="inv-card" onClick={() => setDetailId(inv.id)}>
                    <div className="inv-card-left">
                      <div className="inv-card-num">
                        <span className="inv-num">{inv.invoice_number || 'Draft'}</span>
                        <StatusBadge status={inv.display_status} />
                      </div>
                      <div className="inv-company">{inv.customer_name}{inv.your_ref ? <span className="inv-subject"> · PO {inv.your_ref}</span> : null}</div>
                      <div className="inv-dates">Invoiced: {fmtDate(inv.invoice_date)} • Due: {fmtDate(inv.due_date)}</div>
                    </div>
                    <div className="inv-card-right">
                      <div className="inv-amount">{fmtMoney(inv.total, inv.currency)}</div>
                      {inv.amount_paid > 0 && inv.display_status !== 'Paid' && (
                        <div className="inv-partial">Paid {fmtMoney(inv.amount_paid, inv.currency)} · Due {fmtMoney(inv.balance, inv.currency)}</div>
                      )}
                      <button className="inv-pdf-btn" onClick={async e => {
                        e.stopPropagation();
                        try { await downloadPdf(inv); showToast(`Downloaded ${inv.invoice_number || 'draft'}`); }
                        catch (err) { showToast(`PDF error: ${err.message}`); }
                      }}>PDF</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: overdue + quick stats */}
            <div className="inv-right">
              <div className="inv-panel">
                <div className="inv-panel-title">Overdue Tracking</div>
                {kpis ? (
                  <>
                    <div className="dun-item">
                      <div className="dun-head"><span className="dun-title">Overdue invoices</span><span className="dun-urgent dun-red">{kpis.overdue_count}</span></div>
                      <div className="dun-sub">{fmtMoney(kpis.overdue_amount, kpis.currency)} past due</div>
                    </div>
                    <button className="btn-configure" onClick={() => setFilter('Overdue')}>View overdue invoices</button>
                  </>
                ) : <div className="inv-hint">Loading…</div>}
              </div>

              <div className="inv-panel">
                <div className="inv-panel-title">Quick Stats</div>
                {kpis && kpis.total_invoiced > 0 ? (
                  <>
                    <div className="qs-row"><span className="qs-label">Collection Rate</span><span className="qs-val">{Math.round(kpis.total_received / kpis.total_invoiced * 100)}%</span></div>
                    <div className="qs-bar-wrap"><div className="qs-bar" style={{ width: `${Math.round(kpis.total_received / kpis.total_invoiced * 100)}%`, background: '#16a34a' }}></div></div>
                  </>
                ) : (
                  <div className="inv-hint" style={{ marginBottom: 12 }}>No confirmed invoices yet</div>
                )}
                <div className="qs-outstanding-label">Outstanding</div>
                <div className="qs-outstanding-val">{kpis ? fmtMoney(kpis.total_outstanding, kpis.currency) : '—'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
