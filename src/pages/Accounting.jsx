/**
 * @file Accounting.jsx
 * @description Full-featured Accounting Dashboard page for the Kytos ERP system.
 *
 * Page structure:
 *   - KPI Cards          : Chart of accounts count, journal entry counts,
 *                          total debits/credits from posted entries.
 *   - Chart of Accounts  : Master list of all financial accounts with balances.
 *   - Journal Entries    : Recent entries with draft/post workflow.
 *   - Bank Reconciliation: Per-account reconciliation status and bulk reconcile.
 *   - Financial Reports  : Inline P&L, Balance Sheet, Trial Balance, Cash Flow.
 *
 * API endpoints consumed:
 *   GET  /api/v1/accounting/kpis
 *   GET  /api/v1/accounting/accounts
 *   POST /api/v1/accounting/accounts
 *   GET  /api/v1/accounting/journal-entries
 *   POST /api/v1/accounting/journal-entries
 *   POST /api/v1/accounting/journal-entries/{id}/post
 *   GET  /api/v1/accounting/bank-accounts
 *   GET  /api/v1/accounting/bank-accounts/{id}/transactions
 *   POST /api/v1/accounting/bank-accounts/{id}/import
 *   POST /api/v1/accounting/bank-accounts/{id}/reconcile
 *   GET  /api/v1/accounting/close-period/preview
 *   POST /api/v1/accounting/close-period
 *   GET  /api/v1/accounting/reports/{profit-loss|balance-sheet|trial-balance|cash-flow}
 *   GET  /api/v1/auth/me
 *
 * @module Accounting
 */

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { API_BASE } from '../config.js';
import '../styles/Accounting.css';

const token = () => localStorage.getItem('token');
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });
const fmtFull = n => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0);

/* =============================================================================
   SHARED MODAL SHELL
   Renders a centred overlay with a header and close button.
   All accounting modals (journal entry, account, bank import, close period)
   use this as their outer wrapper.
============================================================================= */

/**
 * @param {{ title: string, onClose: () => void, children: React.ReactNode }} props
 */
function Modal({ title, onClose, children }) {
  return (
    <div className="acc-modal-overlay" onClick={onClose}>
      <div className="acc-modal" onClick={e => e.stopPropagation()}>
        <div className="acc-modal-header">
          <span className="acc-modal-title">{title}</span>
          <button className="acc-modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="acc-modal-body">{children}</div>
      </div>
    </div>
  );
}

/* =============================================================================
   NEW ACCOUNT MODAL
   Allows the user to add a new account to the chart of accounts.
   POSTs to POST /api/v1/accounting/accounts.
   Validates that Code and Name are provided before submitting.
============================================================================= */

/**
 * @param {{ onClose: () => void, onSaved: () => void }} props
 */
function NewAccountModal({ onClose, onSaved }) {
  const TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];
  const [form, setForm] = useState({ code: '', name: '', account_type: 'Asset', description: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!form.code) { setError('Account code is required'); return; }
    if (!form.name) { setError('Account name is required'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounting/accounts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed');
      setSaved(true);
      onSaved();
      setTimeout(onClose, 1200);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add Account" onClose={onClose}>
      {saved ? (
        <div className="acc-form-success">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div>Account created successfully!</div>
        </div>
      ) : (
        <>
          <div className="acc-form-grid">
            <div className="acc-form-group">
              <label>Code *</label>
              <input type="text" placeholder="e.g. 1100" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="acc-form-group">
              <label>Type *</label>
              <select value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value })}>
                {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="acc-form-group">
            <label>Name *</label>
            <input type="text" placeholder="e.g. Petty Cash" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="acc-form-group">
            <label>Description</label>
            <input type="text" placeholder="Optional description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          {error && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '8px' }}>{error}</div>}
          <div className="acc-modal-actions">
            <button className="acc-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="acc-btn-save" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add Account'}</button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* =============================================================================
   NEW JOURNAL ENTRY MODAL
   Creates a journal entry in DRAFT status.
   The user can optionally link it to an account from the chart of accounts.
   Debit and Credit fields are mutually exclusive — entering one clears the other.
   POSTs to POST /api/v1/accounting/journal-entries.
============================================================================= */

/**
 * @param {{ accounts: Array, onClose: () => void, onSaved: () => void }} props
 */
function JournalEntryModal({ accounts, onClose, onSaved }) {
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    description: '',
    debit_amount: '',
    credit_amount: '',
    account_id: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!form.description) { setError('Description is required'); return; }
    if (!form.debit_amount && !form.credit_amount) { setError('Enter a debit or credit amount'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounting/journal-entries`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          entry_date: form.entry_date,
          description: form.description,
          debit_amount: parseFloat(form.debit_amount || 0),
          credit_amount: parseFloat(form.credit_amount || 0),
          notes: form.notes || null,
          account_id: form.account_id || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed');
      setSaved(true);
      onSaved();
      setTimeout(onClose, 1200);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Journal Entry" onClose={onClose}>
      {saved ? (
        <div className="acc-form-success">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div>Journal entry saved successfully!</div>
        </div>
      ) : (
        <>
          <div className="acc-form-grid">
            <div className="acc-form-group">
              <label>Date</label>
              <input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} />
            </div>
            <div className="acc-form-group">
              <label>Account</label>
              <select value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })}>
                <option value="">Select account…</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="acc-form-group">
            <label>Description *</label>
            <input type="text" placeholder="e.g. Monthly utility payment" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="acc-form-grid">
            <div className="acc-form-group">
              <label>Debit (SAR)</label>
              <input type="number" placeholder="0.00" value={form.debit_amount} onChange={e => setForm({ ...form, debit_amount: e.target.value, credit_amount: '' })} />
            </div>
            <div className="acc-form-group">
              <label>Credit (SAR)</label>
              <input type="number" placeholder="0.00" value={form.credit_amount} onChange={e => setForm({ ...form, credit_amount: e.target.value, debit_amount: '' })} />
            </div>
          </div>
          <div className="acc-form-group">
            <label>Notes</label>
            <input type="text" placeholder="Optional notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          {error && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '8px' }}>{error}</div>}
          <div className="acc-modal-actions">
            <button className="acc-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="acc-btn-save" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Entry'}</button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* =============================================================================
   IMPORT BANK STATEMENT MODAL
   Accepts a CSV file upload and sends it to the backend for parsing.
   Supports two CSV formats:
     - Date, Description, Amount
     - Date, Description, Debit, Credit
   POSTs to POST /api/v1/accounting/bank-accounts/{id}/import (multipart/form-data).
   Displays imported/skipped row counts on success.
============================================================================= */

/**
 * @param {{ bankAccounts: Array, onClose: () => void, onImported: () => void }} props
 */
function ImportBankModal({ bankAccounts, onClose, onImported }) {
  const [file, setFile]           = useState(null);
  const [bankId, setBankId]       = useState(bankAccounts[0]?.id ?? '');
  const [step, setStep]           = useState(0); // 0=select 1=uploading 2=done
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState('');

  async function handleImport() {
    if (!file) { setError('Please select a CSV file'); return; }
    if (!bankId) { setError('Please select a bank account'); return; }
    setStep(1); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/api/v1/accounting/bank-accounts/${bankId}/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: fd,
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Import failed');
      const data = await res.json();
      setResult(data);
      setStep(2);
      onImported();
    } catch (e) {
      setError(e.message);
      setStep(0);
    }
  }

  return (
    <Modal title="Import Bank Statement" onClose={onClose}>
      {step === 0 && (
        <>
          <div className="acc-upload-zone" onClick={() => document.getElementById('csv-upload').click()}>
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <div className="acc-upload-label">{file ? file.name : 'Drop your CSV file here'}</div>
            <div className="acc-upload-sub">{file ? `${(file.size/1024).toFixed(1)} KB` : 'or click to browse'}</div>
            <input id="csv-upload" type="file" accept=".csv" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
          </div>
          <div className="acc-form-group" style={{ marginTop: '16px' }}>
            <label>Bank Account</label>
            <select value={bankId} onChange={e => setBankId(e.target.value)}>
              {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
            Supported columns: Date, Description, Amount — or — Date, Description, Debit, Credit
          </div>
          {error && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '8px' }}>{error}</div>}
          <div className="acc-modal-actions">
            <button className="acc-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="acc-btn-save" onClick={handleImport}>Import Statement</button>
          </div>
        </>
      )}
      {step === 1 && (
        <div className="acc-form-success" style={{ color: '#374151' }}>
          <div className="acc-spinner"></div>
          <div>Processing transactions…</div>
        </div>
      )}
      {step === 2 && result && (
        <div className="acc-form-success">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div><strong>{result.imported}</strong> transactions imported into <strong>{result.bank_account}</strong>.</div>
          {result.skipped > 0 && <div style={{ color: '#d97706', fontSize: '13px' }}>{result.skipped} rows skipped (unparseable)</div>}
          <button className="acc-btn-save" style={{ marginTop: '12px' }} onClick={onClose}>Done</button>
        </div>
      )}
    </Modal>
  );
}

/* =============================================================================
   CLOSE PERIOD MODAL
   Two-step workflow: Preview → Confirm → Close.
   Step 1 (Preview): Fetches a summary of the selected period — entry counts,
     unreconciled transactions, and net balance — without making any changes.
   Step 2 (Confirm): Requires an explicit checkbox confirmation before submitting.
   POSTs to POST /api/v1/accounting/close-period.
   Closing a period is irreversible and locks all journal entries within it.
============================================================================= */

/**
 * @param {{ onClose: () => void, onClosed: () => void }} props
 */
function ClosePeriodModal({ onClose, onClosed }) {
  const now = new Date();
  const [year, setYear]       = useState(now.getFullYear());
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [notes, setNotes]     = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  async function loadPreview() {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounting/close-period/preview?year=${year}&month=${month}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      setPreview(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleClose() {
    setClosing(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounting/close-period`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ year, month, notes: notes || null }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      setDone(true);
      onClosed();
    } catch (e) { setError(e.message); }
    finally { setClosing(false); }
  }

  return (
    <Modal title="Close Accounting Period" onClose={onClose}>
      {done ? (
        <div className="acc-form-success">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div>Period {MONTHS[month-1]} {year} closed successfully.</div>
          <button className="acc-btn-save" style={{ marginTop: '12px' }} onClick={onClose}>Done</button>
        </div>
      ) : (
        <>
          <div className="acc-form-grid">
            <div className="acc-form-group">
              <label>Year</label>
              <select value={year} onChange={e => { setYear(+e.target.value); setPreview(null); }}>
                {[now.getFullYear()-1, now.getFullYear()].map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
            <div className="acc-form-group">
              <label>Month</label>
              <select value={month} onChange={e => { setMonth(+e.target.value); setPreview(null); }}>
                {MONTHS.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="acc-form-group">
            <label>Notes (optional)</label>
            <input type="text" placeholder="Reason for closing…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          {!preview && (
            <div className="acc-modal-actions" style={{ marginBottom: '12px' }}>
              <button className="acc-btn-save" onClick={loadPreview} disabled={loading}>
                {loading ? 'Loading…' : 'Preview Period'}
              </button>
            </div>
          )}
          {preview && (
            <>
              <div className="acc-close-period-info">
                <div className="acc-close-row"><span>Period</span><strong>{MONTHS[preview.month-1]} {preview.year}</strong></div>
                <div className="acc-close-row"><span>Posted Entries</span><strong>{preview.posted_entries}</strong></div>
                <div className="acc-close-row"><span>Draft Entries</span><strong style={{ color: preview.draft_entries > 0 ? '#d97706' : '#16a34a' }}>{preview.draft_entries}</strong></div>
                <div className="acc-close-row"><span>Unreconciled Transactions</span><strong style={{ color: preview.unreconciled_transactions > 0 ? '#dc2626' : '#16a34a' }}>{preview.unreconciled_transactions}</strong></div>
                <div className="acc-close-row"><span>Net Balance</span><strong>SAR {fmtFull(preview.net_balance)}</strong></div>
              </div>
              {preview.already_closed ? (
                <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '8px' }}>This period is already closed.</div>
              ) : (
                <>
                  <div className="acc-warning-box">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    Closing this period will lock all journal entries dated within it. This cannot be undone.
                  </div>
                  <label className="acc-confirm-check">
                    <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
                    I confirm I want to close {MONTHS[preview.month-1]} {preview.year}
                  </label>
                  {error && <div style={{ color: '#dc2626', fontSize: '13px' }}>{error}</div>}
                  <div className="acc-modal-actions">
                    <button className="acc-btn-cancel" onClick={onClose}>Cancel</button>
                    <button className="acc-btn-danger" disabled={!confirmed || closing} onClick={handleClose}>
                      {closing ? 'Closing…' : 'Close Period'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
          {error && !preview && <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '8px' }}>{error}</div>}
        </>
      )}
    </Modal>
  );
}

/* =============================================================================
   JOURNAL ENTRY DETAIL MODAL
   Read-only view of a single journal entry's fields.
   If the entry is still in DRAFT status, a "Post Entry" button is shown
   that transitions it to POSTED and updates the linked account balance.
   POSTs to POST /api/v1/accounting/journal-entries/{id}/post.
============================================================================= */

/**
 * @param {{ entry: Object, onClose: () => void, onPost: () => void }} props
 */
function JeDetailModal({ entry, onClose, onPost }) {
  const [posting, setPosting] = useState(false);

  async function handlePost() {
    setPosting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounting/journal-entries/${entry.id}/post`, {
        method: 'POST', headers: authHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      onPost();
      onClose();
    } catch (e) {
      alert(e.message);
    } finally {
      setPosting(false);
    }
  }

  return (
    <Modal title={`Journal Entry — ${entry.reference}`} onClose={onClose}>
      <div className="acc-close-period-info">
        <div className="acc-close-row"><span>Date</span><strong>{entry.entry_date}</strong></div>
        <div className="acc-close-row"><span>Description</span><strong>{entry.description}</strong></div>
        {entry.account_name && <div className="acc-close-row"><span>Account</span><strong>{entry.account_code} — {entry.account_name}</strong></div>}
        <div className="acc-close-row"><span>Debit</span><strong>{entry.debit_amount > 0 ? `SAR ${fmtFull(entry.debit_amount)}` : '—'}</strong></div>
        <div className="acc-close-row"><span>Credit</span><strong>{entry.credit_amount > 0 ? `SAR ${fmtFull(entry.credit_amount)}` : '—'}</strong></div>
        <div className="acc-close-row"><span>Status</span><strong style={{ color: entry.status === 'posted' ? '#15803d' : '#a16207' }}>{entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}</strong></div>
      </div>
      <div className="acc-modal-actions">
        {entry.status === 'draft' && <button className="acc-btn-save" onClick={handlePost} disabled={posting}>{posting ? 'Posting…' : 'Post Entry'}</button>}
        <button className="acc-btn-cancel" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

/* =============================================================================
   FINANCIAL REPORT PANEL
   Inline expandable panel rendered inside the Financial Reports sidebar card.
   Renders a different layout per report type:
     - Profit & Loss  : Revenue items, expense items, net income
     - Balance Sheet  : Assets, liabilities, equity, net income
     - Trial Balance  : All accounts with debit/credit totals, balance check
     - Cash Flow      : Bank transaction inflows and outflows
   Data is fetched lazily on first click to avoid unnecessary API calls.
============================================================================= */

/**
 * @param {{ name: string, data: Object|null, onClose: () => void }} props
 */
function ReportPanel({ name, data, onClose }) {
  if (!data) return (
    <div className="acc-report-panel">
      <div className="acc-report-panel-header"><span>{name}</span><button onClick={onClose}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
      <div style={{ padding: '16px 0', color: '#9ca3af', fontSize: '13px' }}>Loading…</div>
    </div>
  );

  const Row = ({ label, value, bold, color }) => (
    <div className="acc-close-row" style={{ padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ color: '#6b7280', fontSize: '12px' }}>{label}</span>
      <strong style={{ fontSize: '13px', color: color || '#111827', fontWeight: bold ? 700 : 500 }}>
        {typeof value === 'number' ? `SAR ${fmtFull(value)}` : value}
      </strong>
    </div>
  );

  return (
    <div className="acc-report-panel">
      <div className="acc-report-panel-header">
        <span>{name}</span>
        <button onClick={onClose}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>

      {name === 'Profit & Loss' && <>
        <Row label="Period" value={data.period_label} />
        <Row label="Total Revenue" value={data.total_revenue} color="#16a34a" />
        <Row label="Total Expenses" value={data.total_expenses} color="#dc2626" />
        <Row label="Net Income" value={data.net_income} bold color={data.net_income >= 0 ? '#16a34a' : '#dc2626'} />
        {data.revenue_items?.map(i => <Row key={i.account_code} label={`  ${i.account_code} ${i.account_name}`} value={i.balance} />)}
      </>}

      {name === 'Balance Sheet' && <>
        <Row label="As of" value={data.as_of} />
        <Row label="Total Assets" value={data.total_assets} color="#16a34a" />
        <Row label="Total Liabilities" value={data.total_liabilities} color="#dc2626" />
        <Row label="Total Equity" value={data.total_equity} />
        <Row label="Net Income" value={data.net_income} />
        <Row label="Liabilities + Equity" value={data.liabilities_and_equity} bold />
      </>}

      {name === 'Trial Balance' && <>
        <Row label="As of" value={data.as_of} />
        <Row label="Total Debits" value={data.total_debits} />
        <Row label="Total Credits" value={data.total_credits} />
        <Row label="Balanced" value={data.is_balanced ? '✓ Yes' : '✗ No'} bold color={data.is_balanced ? '#16a34a' : '#dc2626'} />
        {data.items?.map(i => <Row key={i.account_code} label={`${i.account_code} ${i.account_name}`} value={i.balance} />)}
      </>}

      {name === 'Cash Flow' && <>
        <Row label="Period" value={data.period_label} />
        <Row label="Total Inflows" value={data.total_inflows} color="#16a34a" />
        <Row label="Total Outflows" value={data.total_outflows} color="#dc2626" />
        <Row label="Net Cash Flow" value={data.net_cash_flow} bold color={data.net_cash_flow >= 0 ? '#16a34a' : '#dc2626'} />
        {data.inflows?.length === 0 && data.outflows?.length === 0 && (
          <div style={{ color: '#9ca3af', fontSize: '12px', padding: '8px 0' }}>No bank transactions imported yet.</div>
        )}
      </>}
    </div>
  );
}

/* =============================================================================
   ACCOUNTING PAGE — MAIN COMPONENT
   Orchestrates all data fetching and modal state for the Accounting Dashboard.

   Data loaded on mount (parallel):
     - KPIs, Accounts, Journal Entries, Bank Accounts, Current User

   Modal state (one active at a time):
     - 'journal'  → NewJournalEntryModal
     - 'import'   → ImportBankModal
     - 'close'    → ClosePeriodModal
     - 'account'  → NewAccountModal

   @param {{ goPage: (page: string) => void }} props
============================================================================= */
export default function Accounting({ goPage }) {
  const [modal, setModal]       = useState(null);
  const [jeDetail, setJeDetail] = useState(null);
  const [report, setReport]     = useState(null);

  const [kpis, setKpis]               = useState(null);
  const [accounts, setAccounts]       = useState([]);
  const [entries, setEntries]         = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [reportData, setReportData]   = useState({});
  const [loading, setLoading]         = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [reconcilingId, setReconcilingId] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [kRes, aRes, jRes, bRes, uRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/accounting/kpis`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/accounting/accounts`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/accounting/journal-entries?limit=10`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/accounting/bank-accounts`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/auth/me`, { headers: authHeaders() }),
      ]);
      if (kRes.ok) setKpis(await kRes.json());
      if (aRes.ok) { const d = await aRes.json(); setAccounts(d.items ?? []); }
      if (jRes.ok) { const d = await jRes.json(); setEntries(d.items ?? []); }
      if (bRes.ok) setBankAccounts(await bRes.json());
      if (uRes.ok) setCurrentUser(await uRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  async function reconcileAll(bankId) {
    setReconcilingId(bankId);
    try {
      const txRes = await fetch(`${API_BASE}/api/v1/accounting/bank-accounts/${bankId}/transactions`, { headers: authHeaders() });
      const txData = txRes.ok ? await txRes.json() : { items: [] };
      const unreconciled = (txData.items ?? []).filter(t => !t.is_reconciled).map(t => t.id);
      await fetch(`${API_BASE}/api/v1/accounting/bank-accounts/${bankId}/reconcile`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ transaction_ids: unreconciled }),
      });
      await loadAll();
    } finally {
      setReconcilingId(null);
    }
  }

  async function loadReport(name) {
    const key = name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
    const map = { 'profit---loss': 'profit-loss', 'balance-sheet': 'balance-sheet', 'cash-flow': 'cash-flow', 'trial-balance': 'trial-balance' };
    const endpoint = map[key] || key;
    const res = await fetch(`${API_BASE}/api/v1/accounting/reports/${endpoint}`, { headers: authHeaders() });
    if (res.ok) { const data = await res.json(); setReportData(d => ({ ...d, [name]: data })); }
  }

  useEffect(() => { loadAll(); }, [loadAll]);

  const KPI_CARDS = [
    {
      label: 'Chart of Accounts',
      value: loading ? '…' : `${kpis?.active_accounts ?? 0} active`,
      sub: `${kpis?.total_accounts ?? 0} total`,
      icon: <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
      cls: 'ic-g',
    },
    {
      label: 'Journal Entries',
      value: loading ? '…' : `${kpis?.entries_this_month ?? 0} this month`,
      sub: `${kpis?.entries_total ?? 0} total`,
      icon: <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
      cls: 'ic-o',
    },
    {
      label: 'Total Debits Posted',
      value: loading ? '…' : `SAR ${fmtFull(kpis?.total_debits_posted)}`,
      sub: `${kpis?.posted_entries ?? 0} posted entries`,
      icon: <svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
      cls: 'ic-g',
    },
    {
      label: 'Total Credits Posted',
      value: loading ? '…' : `SAR ${fmtFull(kpis?.total_credits_posted)}`,
      sub: `${kpis?.draft_entries ?? 0} draft entries pending`,
      icon: <svg viewBox="0 0 24 24"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
      cls: 'ic-p',
    },
  ];

  return (
    <div id="accounting-page">
      {modal === 'journal'  && <JournalEntryModal accounts={accounts} onClose={() => setModal(null)} onSaved={loadAll} />}
      {modal === 'import'   && <ImportBankModal   bankAccounts={bankAccounts} onClose={() => setModal(null)} onImported={loadAll} />}
      {modal === 'close'    && <ClosePeriodModal  onClose={() => setModal(null)} onClosed={loadAll} />}
      {modal === 'account'  && <NewAccountModal   onClose={() => setModal(null)} onSaved={loadAll} />}
      {jeDetail && <JeDetailModal entry={jeDetail} onClose={() => setJeDetail(null)} onPost={loadAll} />}

      <Sidebar activePage="accounting" goPage={goPage} />
      <div className="db-main">
        <div className="tb">
          <span className="tb-title"></span>
          <div className="tb-right">
            <div className="tb-bell"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <div className="tb-user">
              <div className="tb-avatar" style={{ background: 'linear-gradient(135deg,#16a34a,#10b981)' }}>
                {currentUser ? currentUser.full_name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : '…'}
              </div>
              <div>
                <div className="tb-uname">{currentUser?.full_name ?? '…'}</div>
                <div className="tb-urole">{currentUser ? (currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)) : ''}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="pg">
          {/* Header */}
          <div className="pg-header">
            <div className="pg-header-left"><h1>Accounting Dashboard</h1><p>Monitor your financial health and manage accounting operations</p></div>
            <div className="pg-header-actions">
              <button className="btn-action btn-blue" onClick={() => setModal('journal')}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New Journal Entry
              </button>
              <button className="btn-action btn-green" onClick={() => setModal('import')}>
                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Import Bank Statement
              </button>
              <button className="btn-action btn-purple" onClick={() => setModal('close')}>
                <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Close Period
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="kpi-row" style={{ marginBottom: '20px' }}>
            {KPI_CARDS.map((k, i) => (
              <div key={i} className="kpi">
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-body">
                  <div className="kpi-value">{k.value}</div>
                  <div className={`kpi-icon ${k.cls}`}>{k.icon}</div>
                </div>
                <div className="kpi-chg up">
                  <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
                  {k.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Main layout */}
          <div className="acc-layout">
            <div>
              {/* Chart of Accounts */}
              <div className="acc-table-card">
                <div className="acc-table-head">
                  <span className="acc-table-head-title">Chart of Accounts</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>{accounts.length} accounts</span>
                    <button className="btn-action btn-blue" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setModal('account')}>
                      <svg viewBox="0 0 24 24" width="12" height="12"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Account
                    </button>
                  </div>
                </div>
                {loading ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>Loading…</div>
                ) : (
                  <table className="acc-tbl">
                    <thead><tr><th>Account</th><th>Type</th><th className="right">Balance</th><th className="center">Status</th></tr></thead>
                    <tbody>
                      {accounts.map(row => (
                        <tr key={row.id} className="acc-tbl-row-clickable">
                          <td>
                            <div className="acc-acct-name">{row.code} — {row.name}</div>
                            {row.description && <div className="acc-acct-sub">{row.description}</div>}
                          </td>
                          <td>{row.account_type}</td>
                          <td className="right">SAR {fmtFull(row.balance)}</td>
                          <td className="center">
                            <span className={`status-badge ${row.is_active ? 'sb-active' : 'sb-inactive'}`}>
                              {row.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Recent Journal Entries */}
              <div className="je-card">
                <div className="je-head">
                  <span className="je-head-title">Recent Journal Entries</span>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>{entries.length} entries</span>
                </div>
                {loading ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>Loading…</div>
                ) : entries.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
                    No journal entries yet. Click <strong>New Journal Entry</strong> to create one.
                  </div>
                ) : (
                  <table className="je-tbl">
                    <thead><tr><th>Date</th><th>Reference</th><th>Description</th><th className="right">Debit</th><th className="right">Credit</th><th className="center">Status</th></tr></thead>
                    <tbody>
                      {entries.map(e => (
                        <tr key={e.id} className="acc-tbl-row-clickable" onClick={() => setJeDetail(e)}>
                          <td>{e.entry_date}</td>
                          <td><span className="je-ref">{e.reference}</span></td>
                          <td>{e.description}</td>
                          <td className="right">{e.debit_amount > 0 ? `SAR ${fmtFull(e.debit_amount)}` : '—'}</td>
                          <td className="right je-dash">{e.credit_amount > 0 ? `SAR ${fmtFull(e.credit_amount)}` : '—'}</td>
                          <td className="center"><span className={`je-badge ${e.status === 'posted' ? 'je-posted' : 'je-draft'}`}>{e.status.charAt(0).toUpperCase() + e.status.slice(1)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Right sidebar */}
            <div className="acc-side">
              <div className="acc-side-card">
                <div className="acc-side-title">Bank Reconciliation</div>
                {bankAccounts.length === 0 ? (
                  <div style={{ color: '#9ca3af', fontSize: '13px', padding: '8px 0' }}>No bank accounts found.</div>
                ) : bankAccounts.map(b => {
                  const s = b.reconciliation_status;
                  const iconCls = s === 'reconciled' ? 'bi-green' : s === 'pending' ? 'bi-yellow' : 'bi-red';
                  const badgeCls = s === 'reconciled' ? 'bs-reconciled' : s === 'pending' ? 'bs-pending' : 'bs-overdue';
                  const icon = s === 'reconciled'
                    ? <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
                  const lastDate = b.last_reconciled_at
                    ? new Date(b.last_reconciled_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                    : 'Never reconciled';
                  return (
                    <div key={b.id} className="bank-item">
                      <div className={`bank-icon ${iconCls}`}>{icon}</div>
                      <div className="bank-info">
                        <div className="bank-name">{b.name}</div>
                        <div className="bank-date">{lastDate} · {b.unreconciled_count} unreconciled</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span className={`bank-status ${badgeCls}`} style={{ textTransform: 'capitalize' }}>{s}</span>
                        {b.unreconciled_count > 0 && (
                          <button
                            style={{ fontSize: '11px', padding: '2px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            disabled={reconcilingId === b.id}
                            onClick={() => reconcileAll(b.id)}
                          >
                            {reconcilingId === b.id ? 'Reconciling…' : 'Reconcile All'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Financial Reports */}
              <div className="acc-side-card" style={{ position: 'relative' }}>
                <div className="acc-side-title">Financial Reports</div>
                {['Profit & Loss', 'Balance Sheet', 'Cash Flow', 'Trial Balance'].map((name, i) => {
                  const icons = [
                    <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
                    <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
                    <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
                    <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
                  ];
                  const cls = ['ri-blue', 'ri-green', 'ri-indigo', 'ri-orange'][i];
                  return (
                    <div key={name} className="report-item" onClick={() => {
                      const next = report === name ? null : name;
                      setReport(next);
                      if (next && !reportData[next]) loadReport(next);
                    }}>
                      <div className={`report-icon ${cls}`}>{icons[i]}</div>
                      <span className="report-name">{name}</span>
                      <span className="report-arrow"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></span>
                    </div>
                  );
                })}
                {report && <ReportPanel name={report} data={reportData[report]} onClose={() => setReport(null)} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
