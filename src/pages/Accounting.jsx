import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import '../styles/Accounting.css';

/* ─── Shared modal overlay ─── */
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

/* ─── New Journal Entry form ─── */
function JournalEntryModal({ onClose }) {
  const [form, setForm] = useState({ date: '', ref: '', desc: '', debit: '', credit: '', account: '' });
  const [saved, setSaved] = useState(false);
  function save() { if (!form.desc || (!form.debit && !form.credit)) return; setSaved(true); setTimeout(onClose, 1200); }
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
              <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
            </div>
            <div className="acc-form-group">
              <label>Reference</label>
              <input type="text" placeholder="JE-2024-004" value={form.ref} onChange={e=>setForm({...form,ref:e.target.value})}/>
            </div>
          </div>
          <div className="acc-form-group">
            <label>Account</label>
            <select value={form.account} onChange={e=>setForm({...form,account:e.target.value})}>
              <option value="">Select account…</option>
              <option>1000 - Cash</option>
              <option>1200 - Accounts Receivable</option>
              <option>2000 - Accounts Payable</option>
              <option>4000 - Revenue</option>
              <option>5000 - Cost of Goods Sold</option>
            </select>
          </div>
          <div className="acc-form-group">
            <label>Description *</label>
            <input type="text" placeholder="e.g. Monthly utility payment" value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})}/>
          </div>
          <div className="acc-form-grid">
            <div className="acc-form-group">
              <label>Debit (USD)</label>
              <input type="number" placeholder="0.00" value={form.debit} onChange={e=>setForm({...form,debit:e.target.value,credit:''})}/>
            </div>
            <div className="acc-form-group">
              <label>Credit (USD)</label>
              <input type="number" placeholder="0.00" value={form.credit} onChange={e=>setForm({...form,credit:e.target.value,debit:''})}/>
            </div>
          </div>
          <div className="acc-modal-actions">
            <button className="acc-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="acc-btn-save" onClick={save}>Save Entry</button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ─── Import Bank Statement ─── */
function ImportBankModal({ onClose }) {
  const [step, setStep] = useState(0); // 0=select, 1=processing, 2=done
  function handleFile() { setStep(1); setTimeout(()=>setStep(2), 1400); }
  return (
    <Modal title="Import Bank Statement" onClose={onClose}>
      {step === 0 && (
        <>
          <div className="acc-upload-zone">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <div className="acc-upload-label">Drop your .CSV or .OFX file here</div>
            <div className="acc-upload-sub">or click to browse</div>
          </div>
          <div className="acc-form-group" style={{marginTop:'16px'}}>
            <label>Bank Account</label>
            <select><option>Main Checking</option><option>Savings Account</option><option>Credit Card</option></select>
          </div>
          <div className="acc-modal-actions">
            <button className="acc-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="acc-btn-save" onClick={handleFile}>Import Statement</button>
          </div>
        </>
      )}
      {step === 1 && (
        <div className="acc-form-success" style={{color:'#374151'}}>
          <div className="acc-spinner"></div>
          <div>Processing transactions…</div>
        </div>
      )}
      {step === 2 && (
        <div className="acc-form-success">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div>47 transactions imported successfully.</div>
          <button className="acc-btn-save" style={{marginTop:'12px'}} onClick={onClose}>Done</button>
        </div>
      )}
    </Modal>
  );
}

/* ─── Close Period ─── */
function ClosePeriodModal({ onClose }) {
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState(false);
  function close() { setDone(true); setTimeout(onClose, 1200); }
  return (
    <Modal title="Close Accounting Period" onClose={onClose}>
      {done ? (
        <div className="acc-form-success">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div>Period closed successfully.</div>
        </div>
      ) : (
        <>
          <div className="acc-close-period-info">
            <div className="acc-close-row"><span>Period</span><strong>December 2024</strong></div>
            <div className="acc-close-row"><span>Open Journal Entries</span><strong style={{color:'#d97706'}}>1 draft</strong></div>
            <div className="acc-close-row"><span>Unreconciled Transactions</span><strong style={{color:'#dc2626'}}>2 pending</strong></div>
            <div className="acc-close-row"><span>Net Profit (Period)</span><strong style={{color:'#16a34a'}}>$24,560.00</strong></div>
          </div>
          <div className="acc-warning-box">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Closing this period will lock all transactions. This cannot be undone.
          </div>
          <label className="acc-confirm-check">
            <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
            I confirm I want to close December 2024
          </label>
          <div className="acc-modal-actions">
            <button className="acc-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="acc-btn-danger" disabled={!confirmed} onClick={close}>Close Period</button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ─── Journal Entry detail ─── */
function JeDetailModal({ entry, onClose }) {
  return (
    <Modal title={`Journal Entry — ${entry.ref}`} onClose={onClose}>
      <div className="acc-close-period-info">
        <div className="acc-close-row"><span>Date</span><strong>{entry.date}</strong></div>
        <div className="acc-close-row"><span>Description</span><strong>{entry.desc}</strong></div>
        <div className="acc-close-row"><span>Debit</span><strong>{entry.debit}</strong></div>
        <div className="acc-close-row"><span>Credit</span><strong>{entry.credit}</strong></div>
        <div className="acc-close-row"><span>Status</span><strong style={{color:entry.status==='Posted'?'#15803d':'#a16207'}}>{entry.status}</strong></div>
      </div>
      <div className="acc-modal-actions">
        {entry.status==='Draft' && <button className="acc-btn-save">Post Entry</button>}
        <button className="acc-btn-cancel" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

/* ─── Report detail panel ─── */
const REPORT_DATA = {
  'Profit & Loss':  { period:'Jan – Dec 2024', revenue:'$847,520', expenses:'$690,731', net:'$156,789', margin:'18.5%' },
  'Balance Sheet':  { assets:'$1,247,832', liabilities:'$580,043', equity:'$667,789', ratio:'2.15' },
  'Cash Flow':      { operating:'$312,450', investing:'-$98,600', financing:'-$54,200', net:'$159,650' },
  'Trial Balance':  { totalDebit:'$978,045', totalCredit:'$978,045', accounts:'42', balanced:'Yes' },
};

function ReportPanel({ name, onClose }) {
  const d = REPORT_DATA[name];
  return (
    <div className="acc-report-panel">
      <div className="acc-report-panel-header">
        <span>{name}</span>
        <button onClick={onClose}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      {Object.entries(d).map(([k,v])=>(
        <div key={k} className="acc-close-row" style={{padding:'7px 0',borderBottom:'1px solid #f3f4f6'}}>
          <span style={{textTransform:'capitalize',color:'#6b7280',fontSize:'13px'}}>{k.replace(/([A-Z])/g,' $1').trim()}</span>
          <strong style={{fontSize:'13.5px',color:'#111827'}}>{v}</strong>
        </div>
      ))}
      <button className="acc-btn-save" style={{width:'100%',marginTop:'14px'}}>Download PDF</button>
    </div>
  );
}

/* ─── KPI drawer ─── */
const KPI_DETAILS = {
  cash:  { title:'Cash Balance Detail',       rows:[{label:'Main Checking',value:'$198,640',color:'#16a34a'},{label:'Savings Account',value:'$41,820',color:'#3b82f6'},{label:'Petty Cash',value:'$7,372',color:'#f59e0b'}], note:'Last reconciled: Dec 14, 2024' },
  ar:    { title:'Accounts Receivable Aging', rows:[{label:'0–30 days',value:'$52,300',color:'#16a34a'},{label:'31–60 days',value:'$24,800',color:'#f59e0b'},{label:'61–90 days',value:'$9,200',color:'#ef4444'},{label:'90+ days',value:'$3,156',color:'#dc2626'}], note:'2 overdue accounts require follow-up.' },
  ap:    { title:'Accounts Payable by Vendor', rows:[{label:'TechSupply Co.',value:'$18,400',color:'#7c3aed'},{label:'Office Depot',value:'$12,300',color:'#3b82f6'},{label:'Cloud Services',value:'$9,800',color:'#f59e0b'},{label:'Others',value:'$4,623',color:'#9ca3af'}], note:'$12,300 due within 7 days.' },
  profit:{ title:'Net Profit Breakdown',       rows:[{label:'Gross Profit',value:'$253,740',color:'#16a34a'},{label:'Operating Expenses',value:'-$96,951',color:'#ef4444'},{label:'Net Profit',value:'$156,789',color:'#7c3aed'}], note:'Profit margin: 18.5% YTD' },
};

function KpiDrawer({ type, onClose }) {
  const d = KPI_DETAILS[type]; if (!d) return null;
  return (
    <div className="kpi-drawer" onClick={e=>e.stopPropagation()}>
      <div className="kpi-drawer-header">
        <span className="kpi-drawer-title">{d.title}</span>
        <button className="kpi-drawer-close" onClick={onClose}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      {d.rows.map(r=>(
        <div key={r.label} className="kpi-drawer-row">
          <div className="kpi-drawer-dot" style={{background:r.color}}></div>
          <span className="kpi-drawer-label">{r.label}</span>
          <span className="kpi-drawer-val">{r.value}</span>
        </div>
      ))}
      <div className="kpi-drawer-note">{d.note}</div>
    </div>
  );
}

/* ═════════════════════════ MAIN ═════════════════════════ */
export default function Accounting({ goPage }) {
  const [modal, setModal]       = useState(null); // 'journal'|'import'|'close'
  const [openKpi, setOpenKpi]   = useState(null);
  const [jeDetail, setJeDetail] = useState(null);
  const [report, setReport]     = useState(null);

  const JE_DATA = [
    { date:'Dec 15, 2024', ref:'JE-2024-001', desc:'Monthly rent payment',       debit:'$5,000.00',  credit:'-',          status:'Posted' },
    { date:'Dec 14, 2024', ref:'JE-2024-002', desc:'Customer payment received',  debit:'-',           credit:'$12,500.00', status:'Posted' },
    { date:'Dec 13, 2024', ref:'JE-2024-003', desc:'Equipment depreciation',     debit:'$1,250.00',  credit:'-',          status:'Draft'  },
  ];

  return (
    <div id="accounting-page">
      {modal==='journal' && <JournalEntryModal onClose={()=>setModal(null)} />}
      {modal==='import'  && <ImportBankModal   onClose={()=>setModal(null)} />}
      {modal==='close'   && <ClosePeriodModal  onClose={()=>setModal(null)} />}
      {jeDetail && <JeDetailModal entry={jeDetail} onClose={()=>setJeDetail(null)} />}

      <Sidebar activePage="accounting" goPage={goPage} />
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
          {/* Header */}
          <div className="pg-header">
            <div className="pg-header-left"><h1>Accounting Dashboard</h1><p>Monitor your financial health and manage accounting operations</p></div>
            <div className="pg-header-actions">
              <button className="btn-action btn-blue" onClick={()=>setModal('journal')}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New Journal Entry
              </button>
              <button className="btn-action btn-green" onClick={()=>setModal('import')}>
                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Import Bank Statement
              </button>
              <button className="btn-action btn-purple" onClick={()=>setModal('close')}>
                <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Close Period
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="kpi-row" style={{marginBottom:'20px'}}>
            {[
              {key:'cash',  label:'Cash Balance',        value:'$247,832', icon:<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, cls:'ic-g', chg:'+12.5% from last month', up:true},
              {key:'ar',    label:'Accounts Receivable', value:'$89,456',  icon:<svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>, cls:'ic-o', chg:'+3.2% from last month', up:true},
              {key:'ap',    label:'Accounts Payable',    value:'$45,123',  icon:<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>, cls:'ic-o', clsOverride:{background:'#fee2e2',color:'#dc2626'}, chg:'-8.1% from last month', up:false},
              {key:'profit',label:'Net Profit (YTD)',    value:'$156,789', icon:<svg viewBox="0 0 24 24"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>, cls:'ic-p', chg:'+18.7% from last year', up:true},
            ].map(k=>(
              <div key={k.key} className={`kpi kpi-clickable${openKpi===k.key?' kpi-active':''}`} onClick={()=>setOpenKpi(p=>p===k.key?null:k.key)}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-body">
                  <div className="kpi-value">{k.value}</div>
                  <div className={`kpi-icon ${k.cls}`} style={k.clsOverride}>{k.icon}</div>
                </div>
                <div className={`kpi-chg ${k.up?'up':'dn'}`}>
                  <svg viewBox="0 0 24 24">{k.up?<polyline points="18 15 12 9 6 15"/>:<polyline points="6 9 12 15 18 9"/>}</svg>
                  {k.chg}
                </div>
                {openKpi===k.key && <KpiDrawer type={k.key} onClose={e=>{e.stopPropagation();setOpenKpi(null);}} />}
              </div>
            ))}
          </div>

          {/* Main layout */}
          <div className="acc-layout">
            <div>
              {/* Chart of Accounts */}
              <div className="acc-table-card">
                <div className="acc-table-head"><span className="acc-table-head-title">Chart of Accounts</span><a className="acc-view-all" onClick={()=>{}}>View All</a></div>
                <table className="acc-tbl">
                  <thead><tr><th>Account</th><th>Type</th><th className="right">Balance</th><th className="center">Status</th></tr></thead>
                  <tbody>
                    {[
                      {name:'1000 - Cash',               sub:'Primary checking account', type:'Asset',   bal:'$247,832.00'},
                      {name:'1200 - Accounts Receivable',sub:'Customer invoices',         type:'Asset',   bal:'$89,456.00'},
                      {name:'2000 - Accounts Payable',   sub:'Vendor bills',              type:'Liability',bal:'$45,123.00'},
                      {name:'4000 - Revenue',             sub:'Sales income',              type:'Revenue', bal:'$425,890.00'},
                      {name:'5000 - Cost of Goods Sold', sub:'Direct costs',              type:'Expense', bal:'$169,234.00'},
                    ].map(row=>(
                      <tr key={row.name} className="acc-tbl-row-clickable" onClick={()=>{}}>
                        <td><div className="acc-acct-name">{row.name}</div><div className="acc-acct-sub">{row.sub}</div></td>
                        <td>{row.type}</td>
                        <td className="right">{row.bal}</td>
                        <td className="center"><span className="status-badge sb-active">Active</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Recent Journal Entries */}
              <div className="je-card">
                <div className="je-head"><span className="je-head-title">Recent Journal Entries</span><a className="acc-view-all">View All</a></div>
                <table className="je-tbl">
                  <thead><tr><th>Date</th><th>Reference</th><th>Description</th><th className="right">Debit</th><th className="right">Credit</th><th className="center">Status</th></tr></thead>
                  <tbody>
                    {JE_DATA.map(e=>(
                      <tr key={e.ref} className="acc-tbl-row-clickable" onClick={()=>setJeDetail(e)}>
                        <td>{e.date}</td>
                        <td><span className="je-ref">{e.ref}</span></td>
                        <td>{e.desc}</td>
                        <td className="right">{e.debit}</td>
                        <td className="right je-dash">{e.credit}</td>
                        <td className="center"><span className={`je-badge ${e.status==='Posted'?'je-posted':'je-draft'}`}>{e.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="acc-side">
              <div className="acc-side-card">
                <div className="acc-side-title">Bank Reconciliation</div>
                <div className="bank-item"><div className="bank-icon bi-green"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div><div className="bank-info"><div className="bank-name">Main Checking</div><div className="bank-date">Dec 2024</div></div><span className="bank-status bs-reconciled">Reconciled</span></div>
                <div className="bank-item"><div className="bank-icon bi-yellow"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><div className="bank-info"><div className="bank-name">Savings Account</div><div className="bank-date">Dec 2024</div></div><span className="bank-status bs-pending">Pending</span></div>
                <div className="bank-item"><div className="bank-icon bi-red"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><div className="bank-info"><div className="bank-name">Credit Card</div><div className="bank-date">Nov 2024</div></div><span className="bank-status bs-overdue">Overdue</span></div>
              </div>

              {/* Financial Reports */}
              <div className="acc-side-card" style={{position:'relative'}}>
                <div className="acc-side-title">Financial Reports</div>
                {['Profit & Loss','Balance Sheet','Cash Flow','Trial Balance'].map((name,i)=>{
                  const icons = [
                    <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
                    <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
                    <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
                    <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
                  ];
                  const cls = ['ri-blue','ri-green','ri-indigo','ri-orange'][i];
                  return (
                    <div key={name} className="report-item" onClick={()=>setReport(r=>r===name?null:name)}>
                      <div className={`report-icon ${cls}`}>{icons[i]}</div>
                      <span className="report-name">{name}</span>
                      <span className="report-arrow"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></span>
                    </div>
                  );
                })}
                {report && <ReportPanel name={report} onClose={()=>setReport(null)} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
