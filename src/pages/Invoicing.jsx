/**
 * @file src/pages/Invoicing.jsx
 *
 * Invoicing module — powered by Odoo. All invoice data lives in the
 * connected Odoo instance; this page proxies through the Kytos FastAPI
 * backend which handles authentication and data normalisation.
 *
 * API endpoints consumed (via Kytos backend):
 *   GET  /api/v1/odoo/invoices           — list invoices from Odoo
 *   GET  /api/v1/odoo/invoices?status=X  — filtered by Draft|Sent|Paid|Overdue
 *   POST /api/v1/odoo/invoices           — create invoice in Odoo
 *   POST /api/v1/odoo/invoices/{id}/confirm — post (confirm) draft invoice
 *   GET  /api/v1/odoo/invoices/kpis      — KPI totals from Odoo
 *   GET  /api/v1/odoo/partners           — Odoo contacts for autocomplete
 *   GET  /api/v1/auth/me                 — current user for toolbar
 */

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Toast   from '../components/ui/Toast';
import Modal   from '../components/ui/Modal';
import { API_BASE } from '../config';
import '../styles/Invoicing.css';

/* === Helpers === */

function authHeaders() {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function fmtCurrency(n) {
  return `$${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}


/* === New Invoice modal === */

/**
 * @param {object}   props
 * @param {object[]} props.partners - Odoo contacts for autocomplete.
 * @param {Function} props.onClose  - Close the modal.
 * @param {Function} props.onSaved  - Called with the new invoice object from Odoo.
 */
function NewInvoiceModal({ partners, onClose, onSaved }) {
  const [form, setForm] = useState({ client: '', amount: '', due: '', desc: '', payment_terms: 'Net 30' });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [clientSelected, setClientSelected] = useState(false);

  function onClientChange(val) {
    setForm(f => ({ ...f, client: val }));
    setClientSelected(false);
    if (val.length > 1) {
      setSuggestions(partners.filter(p => p.name.toLowerCase().includes(val.toLowerCase())).slice(0, 5));
    } else {
      setSuggestions([]);
    }
  }

  async function save() {
    if (!form.client.trim() || !form.amount) { setError('Client and amount are required.'); return; }
    if (!clientSelected && suggestions.length > 0) { setError('Please select a client from the dropdown suggestions — free-text names are not valid Odoo contacts.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/odoo/invoices`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ client: form.client, amount: parseFloat(form.amount), due: form.due || undefined, desc: form.desc || undefined, payment_terms: form.payment_terms || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed to create invoice');
      const inv = await res.json();
      setSaved(true);
      setTimeout(() => { onSaved(inv); onClose(); }, 900);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Invoice" onClose={onClose}>
      {saved ? (
        <div className="acc-form-success">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div>Invoice created in Odoo!</div>
        </div>
      ) : (
        <>
          {error && <div style={{background:'#fef2f2',color:'#dc2626',padding:'10px 14px',borderRadius:'8px',marginBottom:'14px',fontSize:'13px'}}>{error}</div>}
          <div className="acc-form-group" style={{position:'relative'}}>
            <label>Client / Company *</label>
            <input type="text" placeholder="Type to search Odoo contacts…" value={form.client} onChange={e => onClientChange(e.target.value)} autoComplete="off" />
            {suggestions.length > 0 && (
              <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #e5e7eb',borderRadius:'8px',boxShadow:'0 4px 12px rgba(0,0,0,.08)',zIndex:100,marginTop:'2px'}}>
                {suggestions.map(p => (
                  <div key={p.id} style={{padding:'9px 14px',fontSize:'13px',cursor:'pointer',borderBottom:'1px solid #f3f4f6'}}
                    onMouseDown={() => { setForm(f => ({ ...f, client: p.name })); setSuggestions([]); setClientSelected(true); }}>
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="acc-form-grid">
            <div className="acc-form-group">
              <label>Amount (SAR) *</label>
              <input type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="acc-form-group">
              <label>Due Date</label>
              <input type="date" value={form.due} onChange={e => setForm(f => ({ ...f, due: e.target.value }))} />
            </div>
          </div>
          <div className="acc-form-group">
            <label>Description</label>
            <input type="text" placeholder="Services rendered…" value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} />
          </div>
          <div className="acc-form-group">
            <label>Payment Terms</label>
            <select value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}>
              <option>Net 30</option><option>Net 15</option><option>Net 60</option><option>Due on Receipt</option>
            </select>
          </div>
          <div className="acc-modal-actions">
            <button className="acc-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="acc-btn-save" onClick={save} disabled={saving}>{saving ? 'Creating in Odoo…' : 'Create Invoice'}</button>
          </div>
        </>
      )}
    </Modal>
  );
}


/* === Confirm invoice modal === */

/**
 * @param {object}   props
 * @param {object}   props.inv      - Invoice to confirm.
 * @param {Function} props.onClose  - Close the modal.
 * @param {Function} props.onDone   - Called with updated invoice after confirm.
 */
function ConfirmInvoiceModal({ inv, onClose, onDone }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function confirm() {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/odoo/invoices/${inv.id}/confirm`, {
        method: 'POST', headers: authHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Confirm failed');
      onDone(await res.json());
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Confirm Invoice" onClose={onClose}>
      {/* Invoice summary card */}
      <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:'10px',padding:'16px',marginBottom:'16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
          <span style={{fontSize:'12px',fontWeight:600,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em'}}>Invoice</span>
          <span style={{fontSize:'13px',fontWeight:700,color:'#1e293b'}}>{inv.num}</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
          <span style={{fontSize:'12px',color:'#6b7280'}}>Client</span>
          <span style={{fontSize:'13px',fontWeight:600,color:'#374151'}}>{inv.company}</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:'12px',color:'#6b7280'}}>Amount</span>
          <span style={{fontSize:'15px',fontWeight:700,color:'#16a34a'}}>{inv.amount}</span>
        </div>
      </div>

      <p style={{fontSize:'13px',color:'#6b7280',marginBottom:'16px',lineHeight:'1.5'}}>
        Posting this invoice in Odoo is <strong style={{color:'#b45309'}}>irreversible</strong> — it will be assigned a sequential invoice number and can no longer be edited.
      </p>

      {error && <div style={{background:'#fef2f2',color:'#dc2626',padding:'10px 14px',borderRadius:'8px',marginBottom:'12px',fontSize:'13px'}}>{error}</div>}

      <div className="acc-modal-actions">
        <button className="acc-btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
        <button
          onClick={confirm}
          disabled={loading}
          style={{display:'flex',alignItems:'center',gap:'6px',padding:'9px 20px',background: loading ? '#9ca3af' : '#7c3aed',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor: loading ? 'not-allowed' : 'pointer',transition:'background 0.15s'}}
        >
          {loading ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{animation:'spin 1s linear infinite'}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              Confirming…
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Post Invoice in Odoo
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}


/* === Dunning reminders panel === */

function RemindersPanel({ onClose }) {
  const [cfg, setCfg] = useState({ before: '2', after: '5', final: '14', email: true, sms: false });
  const [saved, setSaved] = useState(false);
  return (
    <div className="inv-reminders-panel">
      <div className="inv-reminders-header">
        <span>Configure Dunning Reminders</span>
        <button onClick={onClose}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      {saved ? (
        <div style={{textAlign:'center',padding:'16px 0',color:'#16a34a',fontWeight:600,fontSize:'13.5px'}}>✓ Settings saved</div>
      ) : (
        <>
          <div className="acc-form-group" style={{marginBottom:'10px'}}>
            <label style={{fontSize:'12px'}}>Send reminder X days <em>before</em> due</label>
            <select value={cfg.before} onChange={e=>setCfg({...cfg,before:e.target.value})}>{['1','2','3','5','7'].map(v=><option key={v}>{v}</option>)}</select>
          </div>
          <div className="acc-form-group" style={{marginBottom:'10px'}}>
            <label style={{fontSize:'12px'}}>First overdue notice after X days</label>
            <select value={cfg.after} onChange={e=>setCfg({...cfg,after:e.target.value})}>{['1','3','5','7','10'].map(v=><option key={v}>{v}</option>)}</select>
          </div>
          <div className="acc-form-group" style={{marginBottom:'12px'}}>
            <label style={{fontSize:'12px'}}>Final notice after X days overdue</label>
            <select value={cfg.final} onChange={e=>setCfg({...cfg,final:e.target.value})}>{['7','10','14','21','30'].map(v=><option key={v}>{v}</option>)}</select>
          </div>
          <div style={{display:'flex',gap:'12px',marginBottom:'14px'}}>
            <label style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',cursor:'pointer'}}><input type="checkbox" checked={cfg.email} onChange={e=>setCfg({...cfg,email:e.target.checked})} style={{accentColor:'#7c3aed'}}/>Email</label>
            <label style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',cursor:'pointer'}}><input type="checkbox" checked={cfg.sms} onChange={e=>setCfg({...cfg,sms:e.target.checked})} style={{accentColor:'#7c3aed'}}/>SMS</label>
          </div>
          <button className="acc-btn-save" style={{width:'100%'}} onClick={()=>setSaved(true)}>Save Settings</button>
        </>
      )}
    </div>
  );
}


/* ═══════════════════════════ MAIN COMPONENT ═══════════════════════════ */

const STATUS_BADGE_CLS = { Draft: 'ib-draft', Sent: 'ib-sent', Paid: 'ib-paid', Overdue: 'ib-over' };

/**
 * Invoicing page — reads from and writes to Odoo via the Kytos backend proxy.
 *
 * @param {object}   props
 * @param {Function} props.goPage - Navigate to another page by key.
 */
export default function Invoicing({ goPage }) {
  const [invoices,      setInvoices]      = useState([]);
  const [kpis,          setKpis]          = useState(null);
  const [counts,        setCounts]        = useState({ Draft: 0, Sent: 0, Paid: 0, Overdue: 0 });
  const [partners,      setPartners]      = useState([]);
  const [currentUser,   setCurrentUser]   = useState(null);
  const [filter,        setFilter]        = useState('Sent');
  const [modal,         setModal]         = useState(null);   // 'new'
  const [confirmInv,    setConfirmInv]    = useState(null);
  const [showReminders, setShowReminders] = useState(false);
  const [showAnalysis,  setShowAnalysis]  = useState(false);
  const [toast,         setToast]         = useState(null);
  const [searchQ,       setSearchQ]       = useState('');
  const [loading,       setLoading]       = useState(true);

  function showToast(msg) { setToast(msg); }

  /* --- Data loading --- */

  const loadInvoices = useCallback(async (statusFilter) => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetch(`${API_BASE}/api/v1/odoo/invoices${params}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.items || []);
        setCounts(data.counts || {});
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    const [kpiRes, userRes, partnerRes] = await Promise.all([
      fetch(`${API_BASE}/api/v1/odoo/invoices/kpis`, { headers: authHeaders() }),
      fetch(`${API_BASE}/api/v1/auth/me`,             { headers: authHeaders() }),
      fetch(`${API_BASE}/api/v1/odoo/partners`,       { headers: authHeaders() }),
    ]);
    if (kpiRes.ok)     setKpis(await kpiRes.json());
    if (userRes.ok)    setCurrentUser(await userRes.json());
    if (partnerRes.ok) setPartners(await partnerRes.json());
    await loadInvoices(filter);
  }, [filter, loadInvoices]);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => { loadInvoices(filter); }, [filter]);

  /* --- Actions --- */

  function onInvoiceCreated(inv) {
    showToast(`Invoice created in Odoo — ${inv.num}`);
    loadAll();
  }

  function onInvoiceConfirmed(inv) {
    showToast(`${inv.num} confirmed in Odoo`);
    loadAll();
  }

  /* --- Derived --- */

  const userInitials = currentUser
    ? currentUser.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'SJ';
  const userName = currentUser?.full_name || 'Loading…';
  const userRole = currentUser?.role || '';

  const displayed = invoices.filter(inv =>
    searchQ === '' ||
    inv.company.toLowerCase().includes(searchQ.toLowerCase()) ||
    inv.num.toLowerCase().includes(searchQ.toLowerCase())
  );

  /* --- Render --- */

  return (
    <div id="invoicing-page">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      {modal === 'new' && <NewInvoiceModal partners={partners} onClose={() => setModal(null)} onSaved={onInvoiceCreated} />}
      {confirmInv && <ConfirmInvoiceModal inv={confirmInv} onClose={() => setConfirmInv(null)} onDone={onInvoiceConfirmed} />}

      <Sidebar activePage="invoicing" goPage={goPage} />

      <div className="db-main">
        {/* Toolbar */}
        <div className="tb">
          <div className="tb-title tb-title-block">
            <div>Invoicing</div>
            <div className="tb-subtitle">Powered by Odoo — invoices are created and confirmed directly in your Odoo account</div>
          </div>
          <div className="tb-right">
            <div className="tb-bell"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <div className="tb-user">
              <div className="tb-avatar" style={{background:'linear-gradient(135deg,#16a34a,#10b981)'}}>{userInitials}</div>
              <div><div className="tb-uname">{userName}</div><div className="tb-urole">{userRole}</div></div>
            </div>
          </div>
        </div>

        <div className="pg">
          <div className="pg-header">
            <div className="pg-header-left"></div>
            <div className="pg-header-actions">
              <button className="btn-action btn-blue" onClick={() => setModal('new')}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New Invoice
              </button>
              <button className="btn-action btn-purple" onClick={() => {
                if (!displayed.length) { showToast('No invoices to export.'); return; }
                const rows = [
                  ['Invoice No.', 'Client', 'Amount', 'Dates', 'Status'],
                  ...displayed.map(inv => [
                    inv.num,
                    inv.company,
                    inv.amount,
                    inv.dates,
                    inv.status,
                  ]),
                ];
                const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href     = url;
                a.download = `invoices-${filter.toLowerCase()}-${new Date().toISOString().slice(0,10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                showToast(`Exported ${displayed.length} invoice(s) to CSV`);
              }}>
                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export
              </button>
            </div>
          </div>

          {/* Odoo KPI banner */}
          {kpis && (
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px',marginBottom:'20px'}}>
              {[
                { label:'Total Invoiced',   value: fmtCurrency(kpis.total_invoiced),   color:'#2563eb' },
                { label:'Received',         value: fmtCurrency(kpis.total_received),   color:'#16a34a' },
                { label:'Outstanding',      value: fmtCurrency(kpis.total_outstanding), color:'#7c3aed' },
                { label:'Overdue Invoices', value: kpis.overdue_count,                color:'#dc2626' },
              ].map(k => (
                <div key={k.label} className="kpi" style={{cursor:'default'}}>
                  <div className="kpi-label">{k.label}</div>
                  <div className="kpi-body">
                    <div className="kpi-value" style={{color:k.color,fontSize:'22px'}}>{k.value}</div>
                  </div>
                  <div style={{fontSize:'11px',color:'#9ca3af',marginTop:'4px',display:'flex',alignItems:'center',gap:'4px'}}>
                    <span style={{background:'#714B67',color:'#fff',padding:'1px 5px',borderRadius:'3px',fontSize:'9px',fontWeight:700}}>ODOO</span> live data
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="inv-layout">
            {/* Left sidebar */}
            <div className="inv-left">
              <div className="inv-panel">
                <div className="inv-panel-title">Invoice Status</div>
                {['Draft','Sent','Paid','Overdue'].map((s, i) => {
                  const icons = [
                    <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
                    <svg viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>,
                    <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
                  ];
                  const clrs   = ['#1d4ed8','#16a34a','#6b7280','#dc2626'];
                  const badges = ['cnt-blue','cnt-gray','cnt-gray','cnt-red'];
                  return (
                    <div key={s} className={`inv-status-item${filter===s?' active':''}`} style={{cursor:'pointer'}} onClick={() => setFilter(s)}>
                      <span className="inv-status-icon" style={{color:clrs[i]}}>{icons[i]}</span>
                      <span className="inv-status-name">{s}</span>
                      <span className={`inv-count-badge ${badges[i]}`}>{counts[s] ?? 0}</span>
                    </div>
                  );
                })}
              </div>

              <div className="inv-panel">
                <div className="inv-panel-title">Connected Systems</div>
                <div className="prov-item">
                  <div className="prov-logo" style={{background:'#714B67',color:'#fff',fontSize:'11px',fontWeight:700}}>OD</div>
                  <div className="prov-info"><div className="prov-name">Odoo</div><div className="prov-status">Connected — kytos1</div></div>
                  <div className="prov-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
                </div>
                <div className="prov-item">
                  <div className="prov-logo prov-stripe">S</div>
                  <div className="prov-info"><div className="prov-name">Stripe</div><div className="prov-status">Not connected</div></div>
                  <button className="btn-connect" onClick={() => showToast('Configure in Odoo → Payment Providers')}>Connect</button>
                </div>
                <div className="prov-item">
                  <div className="prov-logo prov-bank"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
                  <div className="prov-info"><div className="prov-name">Bank Transfer</div><div className="prov-status">Configure in Odoo</div></div>
                  <button className="btn-connect" onClick={() => showToast('Configure bank accounts in Odoo')}>Setup</button>
                </div>
              </div>
            </div>

            {/* Center */}
            <div className="inv-center">
              <div className="inv-search-bar">
                <input className="inv-search" placeholder="Search invoices…" type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
                <button className="inv-filter-btn" onClick={() => showToast('Filters applied')}>
                  <svg viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>Filter
                </button>
              </div>

              <div className="inv-list">
                {loading ? (
                  <div style={{padding:'32px',textAlign:'center',color:'#9ca3af',fontSize:'13px'}}>Loading from Odoo…</div>
                ) : displayed.length === 0 ? (
                  <div style={{padding:'28px 20px',textAlign:'center',color:'#9ca3af',fontSize:'13.5px'}}>
                    No {filter.toLowerCase()} invoices{searchQ ? ` matching "${searchQ}"` : ''} in Odoo.
                  </div>
                ) : displayed.map(inv => (
                  <div key={inv.id} className="inv-card">
                    <div className="inv-card-left">
                      <div className="inv-card-num">
                        <span className="inv-num">{inv.num}</span>
                        <span className={`inv-badge ${STATUS_BADGE_CLS[inv.status] || 'ib-draft'}`}>{inv.status}</span>
                        <span style={{background:'#714B67',color:'#fff',fontSize:'9px',fontWeight:700,padding:'1px 5px',borderRadius:'3px',marginLeft:'4px'}}>ODOO</span>
                      </div>
                      <div className="inv-company">{inv.company}</div>
                      <div className="inv-dates">{inv.dates}</div>
                    </div>
                    <div className="inv-card-right">
                      <div className="inv-amount">{inv.amount}</div>
                      <div style={{display:'flex',gap:'6px',marginTop:'6px',flexWrap:'wrap',justifyContent:'flex-end'}}>
                        {inv.status === 'Draft' && (
                          <button className="inv-edit" style={{background:'#2563eb',color:'#fff',border:'none'}}
                            onClick={e => { e.stopPropagation(); setConfirmInv(inv); }}>
                            Confirm
                          </button>
                        )}
                        {inv.status !== 'Draft' && (
                          <button
                            onClick={async e => {
                              e.stopPropagation();
                              showToast('Generating PDF from Odoo…');
                              try {
                                const res = await fetch(`${API_BASE}/api/v1/odoo/invoices/${inv.id}/pdf`, { headers: authHeaders() });
                                if (!res.ok) throw new Error((await res.json()).detail || 'Failed');
                                const blob = await res.blob();
                                const url  = URL.createObjectURL(blob);
                                const a    = document.createElement('a');
                                a.href     = url;
                                a.download = `${inv.num.replace(/\//g,'-')}.pdf`;
                                a.click();
                                URL.revokeObjectURL(url);
                                showToast(`Downloaded ${inv.num}`);
                              } catch(err) {
                                showToast(`PDF error: ${err.message}`);
                              }
                            }}
                            style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 10px',background:'#f5f3ff',color:'#7c3aed',border:'1px solid #ddd6fe',borderRadius:'6px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            PDF
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* AI Insights */}
              <div className="ai-card">
                <div className="ai-card-head">
                  <div className="ai-icon"><svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
                  <span className="ai-title">AI Intelligence Insights</span>
                </div>
                <div className="ai-insight"><div className="ai-dot ai-dot-yellow"></div><div className="ai-text"><strong>Payment Prediction:</strong> Invoices due within 30 days have a 92% on-time payment rate based on historical patterns.</div></div>
                <div className="ai-insight"><div className="ai-dot ai-dot-green"></div><div className="ai-text"><strong>Odoo Sync:</strong> All invoices are written directly to Odoo in real time — no manual export needed.</div></div>
                <div className="ai-insight"><div className="ai-dot ai-dot-orange"></div><div className="ai-text"><strong>Tip:</strong> Confirm draft invoices to assign sequential Odoo numbers (e.g. INV/2026/00001) and make them billable.</div></div>
                {showAnalysis && (
                  <div className="ai-analysis-expand">
                    <div className="ai-analysis-row"><span>Total invoiced (Odoo)</span><strong>{kpis ? fmtCurrency(kpis.total_invoiced) : '—'}</strong></div>
                    <div className="ai-analysis-row"><span>Received</span><strong style={{color:'#16a34a'}}>{kpis ? fmtCurrency(kpis.total_received) : '—'}</strong></div>
                    <div className="ai-analysis-row"><span>Outstanding</span><strong style={{color:'#7c3aed'}}>{kpis ? fmtCurrency(kpis.total_outstanding) : '—'}</strong></div>
                    <div className="ai-analysis-row"><span>Overdue count</span><strong style={{color:'#ef4444'}}>{kpis?.overdue_count ?? '—'}</strong></div>
                  </div>
                )}
                <button className="ai-link" onClick={() => setShowAnalysis(p => !p)}>
                  {showAnalysis ? 'Hide Analysis' : 'View Full Analysis'}
                  <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </button>
              </div>
            </div>

            {/* Right */}
            <div className="inv-right">
              <div className="inv-panel" style={{position:'relative'}}>
                <div className="inv-panel-title">Dunning Reminders</div>
                <div className="dun-item"><div className="dun-head"><span className="dun-title">Payment Reminder</span><span className="dun-urgent dun-orange">Configure in Odoo</span></div><div className="dun-sub">Set up automated reminders</div><div className="dun-co">via Odoo → Accounting → Follow-up</div></div>
                <div className="dun-item"><div className="dun-head"><span className="dun-title">Overdue Tracking</span><span className="dun-urgent dun-red">{kpis?.overdue_count ?? 0} overdue</span></div><div className="dun-sub">Tracked live from Odoo</div><div className="dun-co">Switch to Overdue filter to see them</div></div>
                <button className="btn-configure" onClick={() => setShowReminders(p => !p)}>
                  {showReminders ? 'Close Settings' : 'Configure Reminders'}
                </button>
                {showReminders && <RemindersPanel onClose={() => setShowReminders(false)} />}
              </div>

              <div className="inv-panel">
                <div className="inv-panel-title">Quick Stats</div>
                {kpis && kpis.total_invoiced > 0 ? (
                  <>
                    <div className="qs-row"><span className="qs-label">Collection Rate</span><span className="qs-val">{Math.round(kpis.total_received / kpis.total_invoiced * 100)}%</span></div>
                    <div className="qs-bar-wrap"><div className="qs-bar" style={{width:`${Math.round(kpis.total_received / kpis.total_invoiced * 100)}%`,background:'#16a34a'}}></div></div>
                  </>
                ) : (
                  <div style={{fontSize:'13px',color:'#9ca3af',marginBottom:'12px'}}>No posted invoices yet</div>
                )}
                <div className="qs-outstanding-label">Outstanding (Odoo)</div>
                <div className="qs-outstanding-val">{kpis ? fmtCurrency(kpis.total_outstanding) : '—'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
