import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import '../styles/Invoicing.css';

/* ─── Toast ─── */
function InvToast({ msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 2800); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{position:'fixed',bottom:'28px',right:'28px',background:'#111827',color:'#fff',borderRadius:'10px',padding:'12px 18px',display:'flex',alignItems:'center',gap:'10px',fontSize:'13.5px',fontWeight:500,zIndex:9999,boxShadow:'0 8px 24px rgba(0,0,0,0.2)',animation:'toast-in .22s ease'}}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      {msg}
    </div>
  );
}

/* ─── Modal ─── */
function Modal({ title, onClose, children }) {
  return (
    <div className="acc-modal-overlay" onClick={onClose}>
      <div className="acc-modal" onClick={e=>e.stopPropagation()}>
        <div className="acc-modal-header">
          <span className="acc-modal-title">{title}</span>
          <button className="acc-modal-close" onClick={onClose}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div className="acc-modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ─── New Invoice modal ─── */
function NewInvoiceModal({ onClose, onSave }) {
  const [form, setForm] = useState({ client:'', amount:'', due:'', desc:'' });
  const [saved, setSaved] = useState(false);
  function save() {
    if (!form.client || !form.amount) return;
    setSaved(true);
    setTimeout(() => { onSave(form); onClose(); }, 1000);
  }
  return (
    <Modal title="New Invoice" onClose={onClose}>
      {saved ? (
        <div className="acc-form-success">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div>Invoice created successfully!</div>
        </div>
      ) : (
        <>
          <div className="acc-form-group">
            <label>Client / Company *</label>
            <input type="text" placeholder="e.g. Acme Corporation" value={form.client} onChange={e=>setForm({...form,client:e.target.value})}/>
          </div>
          <div className="acc-form-grid">
            <div className="acc-form-group">
              <label>Amount (USD) *</label>
              <input type="number" placeholder="0.00" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/>
            </div>
            <div className="acc-form-group">
              <label>Due Date</label>
              <input type="date" value={form.due} onChange={e=>setForm({...form,due:e.target.value})}/>
            </div>
          </div>
          <div className="acc-form-group">
            <label>Description</label>
            <input type="text" placeholder="Services rendered…" value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})}/>
          </div>
          <div className="acc-form-group">
            <label>Payment Terms</label>
            <select><option>Net 30</option><option>Net 15</option><option>Net 60</option><option>Due on Receipt</option></select>
          </div>
          <div className="acc-modal-actions">
            <button className="acc-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="acc-btn-save" onClick={save}>Create Invoice</button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ─── Invoice detail / edit modal ─── */
function EditInvoiceModal({ inv, onClose, onUpdate }) {
  const [form, setForm] = useState({ ...inv });
  const [saved, setSaved] = useState(false);
  function save() { setSaved(true); setTimeout(()=>{ onUpdate(form); onClose(); }, 900); }
  return (
    <Modal title={`Edit ${inv.num}`} onClose={onClose}>
      {saved ? (
        <div className="acc-form-success">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div>Invoice updated!</div>
        </div>
      ) : (
        <>
          <div className="acc-form-group"><label>Client</label><input type="text" value={form.company} onChange={e=>setForm({...form,company:e.target.value})}/></div>
          <div className="acc-form-grid">
            <div className="acc-form-group"><label>Amount</label><input type="text" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></div>
            <div className="acc-form-group">
              <label>Status</label>
              <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                <option>Draft</option><option>Sent</option><option>Paid</option><option>Overdue</option>
              </select>
            </div>
          </div>
          <div className="acc-modal-actions">
            <button className="acc-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="acc-btn-save" onClick={save}>Save Changes</button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ─── Configure Reminders panel ─── */
function RemindersPanel({ onClose }) {
  const [settings, setSettings] = useState({ before: '2', after: '5', final: '14', email: true, sms: false });
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
            <select value={settings.before} onChange={e=>setSettings({...settings,before:e.target.value})}>
              {['1','2','3','5','7'].map(v=><option key={v}>{v}</option>)}
            </select>
          </div>
          <div className="acc-form-group" style={{marginBottom:'10px'}}>
            <label style={{fontSize:'12px'}}>First overdue notice after X days</label>
            <select value={settings.after} onChange={e=>setSettings({...settings,after:e.target.value})}>
              {['1','3','5','7','10'].map(v=><option key={v}>{v}</option>)}
            </select>
          </div>
          <div className="acc-form-group" style={{marginBottom:'12px'}}>
            <label style={{fontSize:'12px'}}>Final notice after X days overdue</label>
            <select value={settings.final} onChange={e=>setSettings({...settings,final:e.target.value})}>
              {['7','10','14','21','30'].map(v=><option key={v}>{v}</option>)}
            </select>
          </div>
          <div style={{display:'flex',gap:'12px',marginBottom:'14px'}}>
            <label style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',cursor:'pointer'}}>
              <input type="checkbox" checked={settings.email} onChange={e=>setSettings({...settings,email:e.target.checked})} style={{accentColor:'#7c3aed'}}/>Email
            </label>
            <label style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',cursor:'pointer'}}>
              <input type="checkbox" checked={settings.sms} onChange={e=>setSettings({...settings,sms:e.target.checked})} style={{accentColor:'#7c3aed'}}/>SMS
            </label>
          </div>
          <button className="acc-btn-save" style={{width:'100%'}} onClick={()=>setSaved(true)}>Save Settings</button>
        </>
      )}
    </div>
  );
}

/* ═════════════════════════ MAIN ═════════════════════════ */
const INITIAL_INVOICES = [
  { num:'INV-2024-001', company:'Acme Corporation',     dates:'Created: Dec 15, 2024 • Due: Jan 15, 2025', amount:'$12,450.00', status:'Draft' },
  { num:'INV-2024-002', company:'TechStart Inc.',        dates:'Created: Dec 14, 2024 • Due: Jan 14, 2025', amount:'$8,900.00',  status:'Draft' },
  { num:'INV-2024-003', company:'Global Solutions Ltd.', dates:'Created: Dec 13, 2024 • Due: Jan 13, 2025', amount:'$15,750.00', status:'Draft' },
  { num:'INV-2024-004', company:'Innovation Partners',   dates:'Created: Dec 12, 2024 • Due: Jan 12, 2025', amount:'$6,200.00',  status:'Draft' },
];

const STATUS_BADGE_CLS = { Draft:'ib-draft', Sent:'ib-sent', Paid:'ib-paid', Overdue:'ib-over' };
const STATUS_COUNTS    = { Draft:12, Sent:34, Paid:156, Overdue:8 };

export default function Invoicing({ goPage }) {
  const [invoices, setInvoices]     = useState(INITIAL_INVOICES);
  const [filter, setFilter]         = useState('Draft');
  const [modal, setModal]           = useState(null); // 'new'
  const [editInv, setEditInv]       = useState(null);
  const [showReminders, setShowReminders] = useState(false);
  const [showAnalysis, setShowAnalysis]   = useState(false);
  const [toast, setToast]           = useState(null);
  const [searchQ, setSearchQ]       = useState('');

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null), 2800); }

  function handleExport() {
    showToast('Exporting invoices as PDF…');
  }

  function addInvoice(form) {
    const newInv = {
      num: `INV-2024-00${invoices.length+1}`,
      company: form.client,
      dates: `Created: Today • Due: ${form.due || 'TBD'}`,
      amount: `$${parseFloat(form.amount||0).toFixed(2)}`,
      status: 'Draft',
    };
    setInvoices(prev => [newInv, ...prev]);
    showToast(`Invoice created for ${form.client}`);
  }

  function updateInvoice(updated) {
    setInvoices(prev => prev.map(inv => inv.num === updated.num ? updated : inv));
    showToast(`${updated.num} updated`);
  }

  const displayed = invoices.filter(inv =>
    inv.status === filter &&
    (searchQ === '' || inv.company.toLowerCase().includes(searchQ.toLowerCase()) || inv.num.toLowerCase().includes(searchQ.toLowerCase()))
  );

  return (
    <div id="invoicing-page">
      {toast && <InvToast msg={toast} onClose={()=>setToast(null)} />}
      {modal==='new' && <NewInvoiceModal onClose={()=>setModal(null)} onSave={addInvoice} />}
      {editInv && <EditInvoiceModal inv={editInv} onClose={()=>setEditInv(null)} onUpdate={updateInvoice} />}

      <Sidebar activePage="invoicing" goPage={goPage} />
      <div className="db-main">
        <div className="tb">
          <span className="tb-title"></span>
          <div className="tb-right">
            <div className="tb-bell"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <div className="tb-user">
              <div className="tb-avatar" style={{background:'linear-gradient(135deg,#16a34a,#10b981)'}}>SJ</div>
              <div><div className="tb-uname">Sarah Johns</div><div className="tb-urole">Administrator</div></div>
            </div>
          </div>
        </div>
        <div className="pg">
          <div className="pg-header">
            <div className="pg-header-left"><h1>Invoicing</h1><p>Manage invoices, track payments, and automate billing</p></div>
            <div className="pg-header-actions">
              <button className="btn-action btn-blue" onClick={()=>setModal('new')}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New Invoice
              </button>
              <button className="btn-action btn-purple" onClick={handleExport}>
                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export
              </button>
            </div>
          </div>

          <div className="inv-layout">
            {/* Left */}
            <div className="inv-left">
              <div className="inv-panel">
                <div className="inv-panel-title">Invoice Status</div>
                {['Draft','Sent','Paid','Overdue'].map((s,i)=>{
                  const icons = [
                    <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
                    <svg viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>,
                    <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
                  ];
                  const clrs = ['#1d4ed8','#6b7280','#16a34a','#6b7280'];
                  const badges = ['cnt-blue','cnt-gray','cnt-gray','cnt-red'];
                  return (
                    <div key={s} className={`inv-status-item${filter===s?' active':''}`} style={{cursor:'pointer'}} onClick={()=>setFilter(s)}>
                      <span className="inv-status-icon" style={{color:clrs[i]}}>{icons[i]}</span>
                      <span className="inv-status-name">{s}</span>
                      <span className={`inv-count-badge ${badges[i]}`}>{STATUS_COUNTS[s]}</span>
                    </div>
                  );
                })}
              </div>
              <div className="inv-panel">
                <div className="inv-panel-title">Payment Provider Status</div>
                <div className="prov-item"><div className="prov-logo prov-stripe">S</div><div className="prov-info"><div className="prov-name">Stripe</div><div className="prov-status">Connected</div></div><div className="prov-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div></div>
                <div className="prov-item"><div className="prov-logo prov-paypal">P</div><div className="prov-info"><div className="prov-name">PayPal</div><div className="prov-status">Connected</div></div><div className="prov-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div></div>
                <div className="prov-item">
                  <div className="prov-logo prov-bank"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
                  <div className="prov-info"><div className="prov-name">Bank Transfer</div><div className="prov-status">Not Connected</div></div>
                  <button className="btn-connect" onClick={()=>showToast('Opening bank connection setup…')}>Connect</button>
                </div>
              </div>
            </div>

            {/* Center */}
            <div className="inv-center">
              <div className="inv-search-bar">
                <input className="inv-search" placeholder="Search invoices…" type="text" value={searchQ} onChange={e=>setSearchQ(e.target.value)}/>
                <button className="inv-filter-btn" onClick={()=>showToast('Filter panel opened')}>
                  <svg viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>Filter
                </button>
                <button className="inv-sort-btn" onClick={()=>showToast('Sorted by date')}>
                  <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>Sort
                </button>
              </div>
              <div className="inv-list">
                {displayed.length === 0 ? (
                  <div style={{padding:'28px 20px',textAlign:'center',color:'#9ca3af',fontSize:'13.5px'}}>
                    No {filter.toLowerCase()} invoices{searchQ ? ` matching "${searchQ}"` : ''}.
                  </div>
                ) : displayed.map(inv=>(
                  <div key={inv.num} className="inv-card" onClick={()=>setEditInv(inv)}>
                    <div className="inv-card-left">
                      <div className="inv-card-num">
                        <span className="inv-num">{inv.num}</span>
                        <span className={`inv-badge ${STATUS_BADGE_CLS[inv.status]||'ib-draft'}`}>{inv.status}</span>
                      </div>
                      <div className="inv-company">{inv.company}</div>
                      <div className="inv-dates">{inv.dates}</div>
                    </div>
                    <div className="inv-card-right">
                      <div className="inv-amount">{inv.amount}</div>
                      <button className="inv-edit" onClick={e=>{e.stopPropagation();setEditInv(inv);}}>Edit</button>
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
                <div className="ai-insight"><div className="ai-dot ai-dot-yellow"></div><div className="ai-text"><strong>Payment Prediction:</strong> INV-2024-001 has 92% probability of payment within 5 days of due date based on customer history.</div></div>
                <div className="ai-insight"><div className="ai-dot ai-dot-green"></div><div className="ai-text"><strong>Revenue Forecast:</strong> Expected $43,200 in payments next week. Recommend sending 3 reminder emails.</div></div>
                <div className="ai-insight"><div className="ai-dot ai-dot-orange"></div><div className="ai-text"><strong>Risk Alert:</strong> 2 customers show delayed payment patterns. Consider adjusting payment terms.</div></div>
                {showAnalysis && (
                  <div className="ai-analysis-expand">
                    <div className="ai-analysis-row"><span>Avg days to payment</span><strong>18 days</strong></div>
                    <div className="ai-analysis-row"><span>On-time payment rate</span><strong style={{color:'#16a34a'}}>94.2%</strong></div>
                    <div className="ai-analysis-row"><span>Highest risk customer</span><strong style={{color:'#ef4444'}}>Digital Systems Inc.</strong></div>
                    <div className="ai-analysis-row"><span>Predicted Q1 revenue</span><strong style={{color:'#7c3aed'}}>$218,400</strong></div>
                  </div>
                )}
                <button className="ai-link" onClick={()=>setShowAnalysis(p=>!p)}>
                  {showAnalysis ? 'Hide Analysis' : 'View Full Analysis'}
                  <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </button>
              </div>
            </div>

            {/* Right */}
            <div className="inv-right">
              <div className="inv-panel" style={{position:'relative'}}>
                <div className="inv-panel-title">Dunning Reminders</div>
                <div className="dun-item"><div className="dun-head"><span className="dun-title">Payment Reminder</span><span className="dun-urgent dun-orange">Due in 2 days</span></div><div className="dun-sub">INV-2023-156 • $4,500</div><div className="dun-co">TechVentures LLC</div></div>
                <div className="dun-item"><div className="dun-head"><span className="dun-title">Overdue Notice</span><span className="dun-urgent dun-red">5 days overdue</span></div><div className="dun-sub">INV-2023-142 • $7,200</div><div className="dun-co">Digital Systems Inc.</div></div>
                <div className="dun-item"><div className="dun-head"><span className="dun-title">Final Notice</span><span className="dun-urgent dun-amber">Due today</span></div><div className="dun-sub">INV-2023-138 • $3,100</div><div className="dun-co">Smart Solutions Co.</div></div>
                <button className="btn-configure" onClick={()=>setShowReminders(p=>!p)}>
                  {showReminders ? 'Close Settings' : 'Configure Reminders'}
                </button>
                {showReminders && <RemindersPanel onClose={()=>setShowReminders(false)} />}
              </div>
              <div className="inv-panel">
                <div className="inv-panel-title">Quick Stats</div>
                <div className="qs-row"><span className="qs-label">Collection Rate</span><span className="qs-val">94.2%</span></div>
                <div className="qs-bar-wrap"><div className="qs-bar" style={{width:'94.2%',background:'#16a34a'}}></div></div>
                <div className="qs-row"><span className="qs-label">Avg. Payment Time</span><span className="qs-val">18 days</span></div>
                <div className="qs-bar-wrap"><div className="qs-bar" style={{width:'60%',background:'#2563eb'}}></div></div>
                <div className="qs-outstanding-label">Outstanding Amount</div>
                <div className="qs-outstanding-val">$89,456</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
