/**
 * src/pages/Contracts.jsx
 *
 * Contract / PO payment-milestone tracker. Mirrors the internal tool the
 * user's team already runs day-to-day: each Purchase Order is tracked as a
 * contract broken into billing milestones (Advance, DEP, FAT, Delivery, …),
 * each with its own %, amount, due date, and invoicing/receipt status.
 *
 * This module has no backend counterpart yet (no Contract/Milestone models
 * or endpoints exist on the API) — all data is local-only, persisted to
 * localStorage under `kytos_contracts`, and every action bar/tooltip that
 * touches it says so explicitly rather than pretending to sync.
 */

import { useState, Fragment } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Toast   from '../components/ui/Toast';
import Modal   from '../components/ui/Modal';

const STORAGE_KEY = 'kytos_contracts';

const RISK_META = {
  on_track: { label: 'On Track', color: '#15803d', bg: '#dcfce7' },
  at_risk:  { label: 'At Risk',  color: '#a16207', bg: '#fef9c3' },
  delayed:  { label: 'Delayed',  color: '#b91c1c', bg: '#fee2e2' },
};

const MS_STATUS_META = {
  pending:  { label: 'Pending',  color: '#374151', bg: '#f3f4f6' },
  invoiced: { label: 'Invoiced', color: '#a16207', bg: '#fef9c3' },
  received: { label: 'Received', color: '#15803d', bg: '#dcfce7' },
  overdue:  { label: 'Overdue',  color: '#b91c1c', bg: '#fee2e2' },
};

function fmtSar(n) {
  const v = Number(n) || 0;
  return `SAR ${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}
function uid() { return Math.random().toString(36).slice(2, 10); }

function loadContracts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore malformed local data */ }
  return [];
}

/* ── Contract (PO) create / edit modal ── */
function ContractModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || {
    fileRef: '', customer: '', poNumber: '', poValue: '', poDate: '', poExpiryDate: '',
    title: '', contractValue: '', risk: 'on_track',
  });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function save() {
    if (!form.fileRef.trim() || !form.customer.trim()) return;
    onSave({ ...form, poValue: Number(form.poValue) || 0, contractValue: Number(form.contractValue) || 0 });
  }
  return (
    <Modal title={initial ? 'Edit Contract' : 'New Contract'} onClose={onClose} width={640}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Alsinan File Ref *</label>
          <input style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} value={form.fileRef} onChange={e => set('fileRef', e.target.value)} /></div>
        <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Customer *</label>
          <input style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} value={form.customer} onChange={e => set('customer', e.target.value)} /></div>
        <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>PO Number</label>
          <input style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} value={form.poNumber} onChange={e => set('poNumber', e.target.value)} /></div>
        <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>PO Value (SAR)</label>
          <input type="number" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} value={form.poValue} onChange={e => set('poValue', e.target.value)} /></div>
        <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>PO Date</label>
          <input type="date" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} value={form.poDate} onChange={e => set('poDate', e.target.value)} /></div>
        <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>PO Expiry Date</label>
          <input type="date" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} value={form.poExpiryDate} onChange={e => set('poExpiryDate', e.target.value)} /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Contract Title</label>
          <input placeholder="e.g. Supply & Installation of 2 x Mass Spec - Thermo Fisher" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} value={form.title} onChange={e => set('title', e.target.value)} /></div>
        <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Contract Value (SAR)</label>
          <input type="number" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} value={form.contractValue} onChange={e => set('contractValue', e.target.value)} /></div>
        <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Risk Status</label>
          <select style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} value={form.risk} onChange={e => set('risk', e.target.value)}>
            {Object.entries(RISK_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
        <button onClick={onClose} className="nrfq-btn-ghost">Cancel</button>
        <button onClick={save} className="nrfq-btn-primary">{initial ? 'Save Changes' : 'Create Contract'}</button>
      </div>
    </Modal>
  );
}

/* ── Milestone create / edit modal ── */
function MilestoneModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || {
    name: '', pct: '', amount: '', dueDate: '', status: 'pending',
    plannedDate: '', achievedDate: '', invoiceNumber: '', invoiceDate: '', receivedDate: '',
  });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function save() {
    if (!form.name.trim()) return;
    onSave({ ...form, pct: Number(form.pct) || 0, amount: Number(form.amount) || 0 });
  }
  return (
    <Modal title={initial ? 'Edit Milestone' : 'New Milestone'} onClose={onClose} width={640}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Milestone *</label>
          <input style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} value={form.name} onChange={e => set('name', e.target.value)} /></div>
        <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>%</label>
          <input type="number" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} value={form.pct} onChange={e => set('pct', e.target.value)} /></div>
        <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Amount (SAR)</label>
          <input type="number" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} value={form.amount} onChange={e => set('amount', e.target.value)} /></div>
        <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Due Date</label>
          <input type="date" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} value={form.dueDate} onChange={e => set('dueDate', e.target.value)} /></div>
        <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Status</label>
          <select style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.entries(MS_STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select></div>
        <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Planned Date</label>
          <input type="date" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} value={form.plannedDate} onChange={e => set('plannedDate', e.target.value)} /></div>
        <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Achieved Date</label>
          <input type="date" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} value={form.achievedDate} onChange={e => set('achievedDate', e.target.value)} /></div>
        <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Invoice #</label>
          <input style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} value={form.invoiceNumber} onChange={e => set('invoiceNumber', e.target.value)} /></div>
        <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Invoice Date</label>
          <input type="date" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} value={form.invoiceDate} onChange={e => set('invoiceDate', e.target.value)} /></div>
        <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Received Date</label>
          <input type="date" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} value={form.receivedDate} onChange={e => set('receivedDate', e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
        <button onClick={onClose} className="nrfq-btn-ghost">Cancel</button>
        <button onClick={save} className="nrfq-btn-primary">{initial ? 'Save Changes' : 'Add Milestone'}</button>
      </div>
    </Modal>
  );
}

export default function Contracts({ goPage }) {
  const [contracts, setContracts] = useState(() => loadContracts());
  const [tab, setTab] = useState('payments'); // payments | cashflow | actionitems
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null); // contract id
  const [toast, setToast] = useState(null);
  const [contractModal, setContractModal] = useState(null); // null | 'new' | contract obj (edit)
  const [msModal, setMsModal] = useState(null); // null | { contractId, milestone (edit) | none (new) }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  function persist(next) {
    setContracts(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function saveContract(data) {
    if (data.id) {
      persist(contracts.map(c => c.id === data.id ? { ...c, ...data } : c));
      showToast('Contract updated');
    } else {
      persist([{ ...data, id: uid(), milestones: [] }, ...contracts]);
      showToast('Contract created');
    }
    setContractModal(null);
  }

  function deleteContract(id) {
    persist(contracts.filter(c => c.id !== id));
    showToast('Contract removed');
  }

  function saveMilestone(contractId, data) {
    persist(contracts.map(c => {
      if (c.id !== contractId) return c;
      if (data.id) return { ...c, milestones: c.milestones.map(m => m.id === data.id ? { ...m, ...data } : m) };
      return { ...c, milestones: [...c.milestones, { ...data, id: uid() }] };
    }));
    showToast(data.id ? 'Milestone updated' : 'Milestone added');
    setMsModal(null);
  }

  function deleteMilestone(contractId, msId) {
    persist(contracts.map(c => c.id === contractId ? { ...c, milestones: c.milestones.filter(m => m.id !== msId) } : c));
  }

  const filtered = contracts.filter(c =>
    search === '' ||
    c.fileRef.toLowerCase().includes(search.toLowerCase()) ||
    c.customer.toLowerCase().includes(search.toLowerCase()) ||
    (c.poNumber || '').toLowerCase().includes(search.toLowerCase())
  );

  const allMilestones = contracts.flatMap(c => c.milestones || []);
  const kpis = {
    totalContractValue: contracts.reduce((s, c) => s + (Number(c.contractValue) || Number(c.poValue) || 0), 0),
    received: allMilestones.filter(m => m.status === 'received').reduce((s, m) => s + (Number(m.amount) || 0), 0),
    invoicedPending: allMilestones.filter(m => m.status === 'invoiced').reduce((s, m) => s + (Number(m.amount) || 0), 0),
    notYetInvoiced: allMilestones.filter(m => m.status === 'pending').reduce((s, m) => s + (Number(m.amount) || 0), 0),
    overdue: allMilestones.filter(m => m.status === 'overdue').reduce((s, m) => s + (Number(m.amount) || 0), 0),
  };

  return (
    <div id="contracts-page">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      {contractModal && (
        <ContractModal
          initial={contractModal === 'new' ? null : contractModal}
          onClose={() => setContractModal(null)}
          onSave={saveContract}
        />
      )}
      {msModal && (
        <MilestoneModal
          initial={msModal.milestone}
          onClose={() => setMsModal(null)}
          onSave={data => saveMilestone(msModal.contractId, data)}
        />
      )}

      <Sidebar activePage="contracts" goPage={goPage} />

      <div className="db-main">
        <div className="tb">
          <div className="tb-title tb-title-block">
            <div>Contract Payments</div>
            <div className="tb-subtitle">Track PO milestones, invoicing, and collections — local data, not yet synced to the backend</div>
          </div>
          <div className="tb-right">
            <div className="tb-bell"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <div className="tb-user"><div className="tb-avatar" style={{ background: 'linear-gradient(135deg,#16a34a,#10b981)' }}>SJ</div><div><div className="tb-uname">Sarah Johns</div><div className="tb-urole">Administrator</div></div></div>
          </div>
        </div>

        <div className="pg">
          <div className="pg-header">
            <div className="pg-header-left" style={{ display: 'flex', gap: '4px' }}>
              {[['payments', 'Payments'], ['cashflow', 'Cash Flow'], ['actionitems', 'Action Items']].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  style={{
                    padding: '8px 16px', fontSize: '13px', fontWeight: 600, borderRadius: '8px', cursor: 'pointer',
                    border: tab === k ? 'none' : '1px solid #e5e7eb',
                    background: tab === k ? '#074E3B' : '#fff', color: tab === k ? '#fff' : '#374151',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="pg-header-actions">
              <button className="btn-action btn-blue" onClick={() => setContractModal('new')}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New Contract
              </button>
            </div>
          </div>

          {tab !== 'payments' ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
                {tab === 'cashflow' ? 'Cash Flow' : 'Action Items'} — coming soon
              </div>
              <div style={{ fontSize: '13px' }}>This view isn't built yet. Payments below is fully functional.</div>
            </div>
          ) : (
          <>
            <div className="kpi-row" style={{ marginBottom: '20px' }}>
              <div className="kpi"><div className="kpi-label">Total Contract Value</div><div className="kpi-body"><div className="kpi-value">{fmtSar(kpis.totalContractValue)}</div></div></div>
              <div className="kpi"><div className="kpi-label">Received</div><div className="kpi-body"><div className="kpi-value" style={{ color: '#15803d' }}>{fmtSar(kpis.received)}</div></div></div>
              <div className="kpi"><div className="kpi-label">Invoiced (Pending)</div><div className="kpi-body"><div className="kpi-value" style={{ color: '#a16207' }}>{fmtSar(kpis.invoicedPending)}</div></div></div>
              <div className="kpi"><div className="kpi-label">Not Yet Invoiced</div><div className="kpi-body"><div className="kpi-value">{fmtSar(kpis.notYetInvoiced)}</div></div></div>
              <div className="kpi"><div className="kpi-label">Overdue</div><div className="kpi-body"><div className="kpi-value" style={{ color: '#b91c1c' }}>{fmtSar(kpis.overdue)}</div></div></div>
            </div>

            <div className="rfq-odoo-card">
              <div className="rfq-toolbar">
                <div className="rfq-toolbar-search" style={{ flex: 1 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input type="text" placeholder="Search Alsinan file ref / customer / PO number…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%' }} />
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="prd-empty" style={{ padding: '40px 0' }}>
                  {contracts.length === 0 ? 'No contracts yet — click "New Contract" to add one.' : 'No contracts match your search.'}
                </div>
              ) : (
                <table className="rfq-odoo-table">
                  <thead>
                    <tr>
                      <th style={{ width: '28px' }}></th>
                      <th>Alsinan File Ref</th>
                      <th>Customer</th>
                      <th>PO Number</th>
                      <th>PO Value</th>
                      <th>PO Date</th>
                      <th>PO Expiry Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => {
                      const isOpen = expanded === c.id;
                      const risk = RISK_META[c.risk] || RISK_META.on_track;
                      const received = (c.milestones || []).filter(m => m.status === 'received').reduce((s, m) => s + (Number(m.amount) || 0), 0);
                      const invoiced = (c.milestones || []).filter(m => m.status === 'invoiced').reduce((s, m) => s + (Number(m.amount) || 0), 0);
                      const pending  = (c.milestones || []).filter(m => m.status === 'pending' || m.status === 'overdue').reduce((s, m) => s + (Number(m.amount) || 0), 0);
                      return (
                        <Fragment key={c.id}>
                          <tr className="rfq-odoo-row" onClick={() => setExpanded(isOpen ? null : c.id)}>
                            <td className="center">
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><polyline points="9 18 15 12 9 6"/></svg>
                            </td>
                            <td style={{ fontWeight: 600, color: '#111827' }}>{c.fileRef}</td>
                            <td>{c.customer}</td>
                            <td>{c.poNumber || '—'}</td>
                            <td>{fmtSar(c.poValue)}</td>
                            <td style={{ color: '#6b7280', fontSize: '13px' }}>{c.poDate || '—'}</td>
                            <td style={{ color: '#6b7280', fontSize: '13px' }}>{c.poExpiryDate || '—'}</td>
                          </tr>
                          {isOpen && (
                            <tr>
                              <td colSpan={7} style={{ background: '#f8fafc', padding: '16px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: risk.color, display: 'inline-block' }} />
                                  <strong style={{ fontSize: '14px', color: '#111827' }}>{c.title || 'Untitled contract'}</strong>
                                  <span style={{ background: risk.bg, color: risk.color, fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '10px' }}>{risk.label}</span>
                                  <span style={{ fontSize: '13px', color: '#6b7280' }}>Contract: <strong>{fmtSar(c.contractValue || c.poValue)}</strong></span>
                                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                                    <button className="nrfq-btn-primary" style={{ padding: '6px 14px', fontSize: '12.5px' }} onClick={() => setMsModal({ contractId: c.id, milestone: null })}>+ Milestone</button>
                                    <button className="nrfq-btn-ghost" style={{ padding: '6px 14px', fontSize: '12.5px' }} onClick={() => setContractModal(c)}>✎ Edit</button>
                                    <button className="nrfq-btn-ghost" style={{ padding: '6px 14px', fontSize: '12.5px', color: '#b91c1c' }} onClick={() => deleteContract(c.id)}>Delete</button>
                                  </div>
                                </div>

                                <div style={{ overflowX: 'auto' }}>
                                  <table className="rfq-odoo-table" style={{ background: '#fff' }}>
                                    <thead>
                                      <tr>
                                        <th>Milestone</th>
                                        <th className="right">%</th>
                                        <th className="right">Amount</th>
                                        <th>Due Date</th>
                                        <th className="center">Status</th>
                                        <th>Planned Date</th>
                                        <th>Achieved Date</th>
                                        <th>Invoice #</th>
                                        <th>Invoice Date</th>
                                        <th>Received Date</th>
                                        <th style={{ width: '50px' }}></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(c.milestones || []).length === 0 ? (
                                        <tr><td colSpan={11} style={{ textAlign: 'center', color: '#9ca3af', padding: '14px' }}>No milestones yet.</td></tr>
                                      ) : c.milestones.map(m => {
                                        const meta = MS_STATUS_META[m.status] || MS_STATUS_META.pending;
                                        return (
                                          <tr key={m.id}>
                                            <td style={{ fontWeight: 600 }}>{m.name}</td>
                                            <td className="right">{m.pct}%</td>
                                            <td className="right" style={{ fontWeight: 600 }}>{fmtSar(m.amount)}</td>
                                            <td style={{ color: '#6b7280', fontSize: '13px' }}>{m.dueDate || '—'}</td>
                                            <td className="center"><span style={{ background: meta.bg, color: meta.color, fontSize: '11.5px', fontWeight: 700, padding: '2px 9px', borderRadius: '10px' }}>{meta.label}</span></td>
                                            <td style={{ color: '#6b7280', fontSize: '13px' }}>{m.plannedDate || '—'}</td>
                                            <td style={{ color: m.achievedDate ? '#15803d' : '#6b7280', fontSize: '13px' }}>{m.achievedDate || '—'}</td>
                                            <td style={{ color: '#6b7280', fontSize: '13px' }}>{m.invoiceNumber || '—'}</td>
                                            <td style={{ color: '#6b7280', fontSize: '13px' }}>{m.invoiceDate || '—'}</td>
                                            <td style={{ color: '#6b7280', fontSize: '13px' }}>{m.receivedDate || '—'}</td>
                                            <td>
                                              <div style={{ display: 'flex', gap: '4px' }}>
                                                <button onClick={() => setMsModal({ contractId: c.id, milestone: m })} title="Edit" style={{ width: '22px', height: '22px', border: 'none', background: '#f3f4f6', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>✎</button>
                                                <button onClick={() => deleteMilestone(c.id, m.id)} title="Delete" style={{ width: '22px', height: '22px', border: 'none', background: '#fef2f2', color: '#dc2626', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>

                                {c.milestones?.length > 0 && (
                                  <div style={{ display: 'flex', gap: '20px', marginTop: '10px', fontSize: '12.5px', color: '#374151' }}>
                                    <span>✓ Received: <strong style={{ color: '#15803d' }}>{fmtSar(received)}</strong></span>
                                    <span>⏱ Invoiced: <strong style={{ color: '#a16207' }}>{fmtSar(invoiced)}</strong></span>
                                    <span>○ Pending: <strong>{fmtSar(pending)}</strong></span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
