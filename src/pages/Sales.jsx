import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import '../styles/Sales.css';

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
function Modal({ title, onClose, width, children }) {
  return (
    <div className="pur-modal-overlay" onClick={onClose}>
      <div className="pur-modal" style={{ width: width || 480 }} onClick={e => e.stopPropagation()}>
        <div className="pur-modal-header">
          <span className="pur-modal-title">{title}</span>
          <button className="pur-modal-close" onClick={onClose}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div className="pur-modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ─── New Quote modal ─── */
function NewQuoteModal({ onClose, onSave }) {
  const [form, setForm] = useState({ client:'', product:'', qty:'', price:'', valid:'', notes:'' });
  const [saved, setSaved] = useState(false);
  const total = form.qty && form.price ? `$${(parseFloat(form.qty)*parseFloat(form.price)).toLocaleString('en-US',{minimumFractionDigits:2})}` : '—';
  function save() {
    if (!form.client || !form.product) return;
    setSaved(true);
    setTimeout(() => { onSave({ client:form.client, total, status:'Pending' }); onClose(); }, 900);
  }
  return (
    <Modal title="New Quotation" onClose={onClose}>
      {saved ? (
        <div className="pur-success"><svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><div>Quotation created!</div></div>
      ) : (
        <>
          <div className="pur-form-group"><label>Client / Company *</label><input type="text" placeholder="e.g. Acme Corp" value={form.client} onChange={e=>setForm({...form,client:e.target.value})}/></div>
          <div className="pur-form-group">
            <label>Product / Service *</label>
            <select value={form.product} onChange={e=>setForm({...form,product:e.target.value})}>
              <option value="">Select product…</option>
              <option>Software Licenses</option><option>Marketing Services</option><option>Custom Development</option><option>Consulting</option><option>Support Plan</option>
            </select>
          </div>
          <div className="pur-form-grid">
            <div className="pur-form-group"><label>Quantity</label><input type="number" placeholder="1" value={form.qty} onChange={e=>setForm({...form,qty:e.target.value})}/></div>
            <div className="pur-form-group"><label>Unit Price (USD)</label><input type="number" placeholder="0.00" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></div>
          </div>
          {form.qty && form.price && <div className="pur-total-row">Total: <strong>{total}</strong></div>}
          <div className="pur-form-grid">
            <div className="pur-form-group"><label>Valid Until</label><input type="date" value={form.valid} onChange={e=>setForm({...form,valid:e.target.value})}/></div>
            <div className="pur-form-group">
              <label>Payment Terms</label>
              <select><option>Net 30</option><option>Net 15</option><option>Net 60</option><option>Upfront</option></select>
            </div>
          </div>
          <div className="pur-form-group"><label>Notes</label><input type="text" placeholder="Special terms or conditions…" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
          <div className="pur-modal-actions">
            <button className="pur-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="pur-btn-primary" onClick={save}>Create Quote</button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ─── Convert to Order modal ─── */
function ConvertOrderModal({ quote, onClose, onSave }) {
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  function save() { setSaved(true); setTimeout(() => { onSave(`${quote.num} converted to Sales Order`); onClose(); }, 900); }
  return (
    <Modal title="Convert to Sales Order" onClose={onClose}>
      {saved ? (
        <div className="pur-success"><svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><div>Sales Order created!</div></div>
      ) : (
        <>
          <div className="pur-detail-row"><span>Quotation</span><strong>{quote.num}</strong></div>
          <div className="pur-detail-row"><span>Client</span><strong>{quote.client}</strong></div>
          <div className="pur-detail-row"><span>Value</span><strong style={{color:'#16a34a'}}>{quote.amount}</strong></div>
          <div className="pur-form-group" style={{marginTop:'16px'}}><label>Delivery Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
          <div className="pur-form-group"><label>Order Notes</label><input type="text" placeholder="Special instructions…" value={notes} onChange={e=>setNotes(e.target.value)}/></div>
          <div className="pur-modal-actions">
            <button className="pur-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="pur-btn-primary" onClick={save}>Confirm Order</button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ─── Apply Discount modal ─── */
function ApplyDiscountModal({ quote, onClose, onSave }) {
  const [type, setType] = useState('percent');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [saved, setSaved] = useState(false);
  const amount = quote?.amount ? parseFloat(quote.amount.replace(/[$,]/g,'')) : 0;
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
              <label className={`pur-radio${type==='percent'?' selected':''}`} onClick={()=>setType('percent')}>
                <input type="radio" checked={type==='percent'} readOnly style={{accentColor:'#7c3aed'}}/> Percentage (%)
              </label>
              <label className={`pur-radio${type==='fixed'?' selected':''}`} onClick={()=>setType('fixed')}>
                <input type="radio" checked={type==='fixed'} readOnly style={{accentColor:'#7c3aed'}}/> Fixed Amount ($)
              </label>
            </div>
          </div>
          <div className="pur-form-group">
            <label>{type==='percent' ? 'Discount %' : 'Discount Amount ($)'}</label>
            <input type="number" placeholder={type==='percent' ? 'e.g. 10' : 'e.g. 500'} value={value} onChange={e=>setValue(e.target.value)}/>
          </div>
          {discounted !== null && discounted > 0 && (
            <div className="pur-total-row" style={{color:'#16a34a'}}>
              New Total: <strong>${discounted.toLocaleString('en-US',{minimumFractionDigits:2})}</strong>
            </div>
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

/* ─── Quote detail modal ─── */
function QuoteDetailModal({ quote, onClose, onConvert, onDiscount }) {
  return (
    <Modal title={`${quote.num} — Details`} onClose={onClose}>
      <div className="pur-detail-row"><span>Client</span><strong>{quote.client}</strong></div>
      <div className="pur-detail-row"><span>Product</span><strong>{quote.desc}</strong></div>
      <div className="pur-detail-row"><span>Amount</span><strong style={{color:'#16a34a',fontSize:'16px'}}>{quote.amount}</strong></div>
      <div className="pur-detail-row"><span>Status</span><span style={{background:quote.statusBg,color:quote.statusColor,fontSize:'12px',fontWeight:600,padding:'2px 10px',borderRadius:'12px'}}>{quote.status}</span></div>
      <div className="pur-detail-row"><span>Dates</span><strong style={{color:'#6b7280',fontSize:'12.5px'}}>{quote.dates}</strong></div>
      <div className="pur-detail-row"><span>Notes</span><strong style={{color:'#6b7280',fontSize:'12.5px'}}>{quote.notes}</strong></div>
      <div className="pur-modal-actions" style={{marginTop:'20px'}}>
        <button className="pur-btn-cancel" onClick={onClose}>Close</button>
        <button className="pur-btn-secondary" onClick={()=>{onClose();onDiscount(quote);}}>Apply Discount</button>
        {(quote.status==='Pending'||quote.status==='Accepted') && <button className="pur-btn-primary" onClick={()=>{onClose();onConvert(quote);}}>Convert to Order</button>}
      </div>
    </Modal>
  );
}

/* ─── KPI drawer ─── */
const KPI_DETAILS = {
  revenue:    { title:'Revenue Breakdown',     rows:[{label:'Software',value:'$1.8M',color:'#3b82f6'},{label:'Services',value:'$1.2M',color:'#10b981'},{label:'Custom Dev',value:'$1.2M',color:'#7c3aed'}], note:'18% growth vs last month.' },
  quotes:     { title:'Active Quotes by Stage', rows:[{label:'New',value:'18',color:'#6b7280'},{label:'Sent',value:'14',color:'#3b82f6'},{label:'Negotiation',value:'10',color:'#f59e0b'}], note:'$850K combined potential value.' },
  orders:     { title:'Orders by Product',      rows:[{label:'Software',value:'72',color:'#2563eb'},{label:'Services',value:'48',color:'#16a34a'},{label:'Development',value:'36',color:'#7c3aed'}], note:'24% increase vs last month.' },
  conversion: { title:'Conversion Funnel',      rows:[{label:'Leads → Qualified',value:'75%',color:'#10b981'},{label:'Qualified → Proposal',value:'49%',color:'#f59e0b'},{label:'Proposal → Closed',value:'46%',color:'#16a34a'}], note:'Overall rate improved 5% this month.' },
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

/* ═══════════════════════════ MAIN ═══════════════════════════ */
const INITIAL_QUOTES = [
  { num:'QUO-2024-001', client:'TechCorp Solutions',   desc:'Enterprise Software License',       amount:'$45,500',  status:'Pending',      statusBg:'#fef9c3', statusColor:'#a16207', dates:'Created: Dec 15, 2024 • Valid until: Jan 15, 2025', notes:'15% discount applied. Follow-up in 3 days.' },
  { num:'QUO-2024-002', client:'Global Industries',    desc:'Marketing Services Package',         amount:'$28,900',  status:'Accepted',     statusBg:'#dcfce7', statusColor:'#15803d', dates:'Created: Dec 12, 2024 • Accepted: Dec 16, 2024',   notes:'10% volume discount. Ready for order creation.' },
  { num:'QUO-2024-003', client:'StartupXYZ',           desc:'Custom Development Project',         amount:'$125,000', status:'Under Review',  statusBg:'#dbeafe', statusColor:'#1d4ed8', dates:'Created: Dec 14, 2024 • Valid until: Jan 14, 2025', notes:'Custom pricing. Client reviewing terms.' },
];

const TABS = ['All Orders','Quotations','Orders','Fulfillment'];
const TAB_COUNTS = [245,42,156,89];

export default function Sales({ goPage }) {
  const [quotes, setQuotes]           = useState(INITIAL_QUOTES);
  const [activeTab, setActiveTab]     = useState(0);
  const [search, setSearch]           = useState('');
  const [modal, setModal]             = useState(null); // 'newquote'
  const [quoteDetail, setQuoteDetail] = useState(null);
  const [convertQuote, setConvertQuote] = useState(null);
  const [discountQuote, setDiscountQuote] = useState(null);
  const [openKpi, setOpenKpi]         = useState(null);
  const [toast, setToast]             = useState(null);
  const [tasks, setTasks]             = useState([
    { id:1, text:'Follow up with Enterprise Corp', due:'Today 3:00 PM', done:false, color:'#fffbeb', border:'#fde68a' },
    { id:2, text:'Prepare demo for RetailChain',    due:'Tomorrow 10:00 AM', done:false, color:'#eff6ff', border:'#bfdbfe' },
    { id:3, text:'Send proposal to TechStart',       due:'Completed', done:true },
  ]);
  const [newTask, setNewTask] = useState('');
  const [showTaskInput, setShowTaskInput] = useState(false);

  function showToast(msg) { setToast(msg); }
  function toggleKpi(k) { setOpenKpi(p => p===k ? null : k); }

  function addQuote(data) {
    const newQ = { num:`QUO-2024-00${quotes.length+1}`, client:data.client, desc:'New Quotation', amount:data.total, status:'Pending', statusBg:'#fef9c3', statusColor:'#a16207', dates:'Created: Today', notes:'' };
    setQuotes(p => [newQ, ...p]);
    showToast(`Quote created for ${data.client}`);
  }

  function toggleTask(id) { setTasks(p => p.map(t => t.id===id ? {...t,done:!t.done} : t)); }
  function addTask() { if (!newTask.trim()) return; setTasks(p => [...p, { id:Date.now(), text:newTask, due:'No due date', done:false, color:'#f9fafb', border:'#e5e7eb' }]); setNewTask(''); setShowTaskInput(false); }

  const filtered = quotes.filter(q => search==='' || q.client.toLowerCase().includes(search.toLowerCase()) || q.num.toLowerCase().includes(search.toLowerCase()));

  const FUNNEL = [
    { label:'Prospects',  count:'248 leads',      pct:'80%', color:'#3b82f6' },
    { label:'Qualified',  count:'186 qualified',   pct:'60%', color:'#f59e0b' },
    { label:'Proposals',  count:'92 proposals',    pct:'38%', color:'#f97316' },
    { label:'Negotiation',count:'61 in talks',     pct:'25%', color:'#10b981' },
    { label:'Closed Won', count:'42 closed',       pct:'15%', color:'#16a34a' },
  ];

  return (
    <div id="sales-page">
      {toast && <Toast msg={toast} onClose={()=>setToast(null)} />}
      {modal==='newquote' && <NewQuoteModal onClose={()=>setModal(null)} onSave={addQuote} />}
      {convertQuote && <ConvertOrderModal quote={convertQuote} onClose={()=>setConvertQuote(null)} onSave={showToast} />}
      {discountQuote && <ApplyDiscountModal quote={discountQuote} onClose={()=>setDiscountQuote(null)} onSave={showToast} />}
      {quoteDetail && <QuoteDetailModal quote={quoteDetail} onClose={()=>setQuoteDetail(null)} onConvert={setConvertQuote} onDiscount={setDiscountQuote} />}

      <Sidebar activePage="sales" goPage={goPage} />
      <div className="db-main">
        <div className="tb">
          <span className="tb-title"></span>
          <div className="tb-right">
            <div className="tb-bell"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <div className="tb-user"><div className="tb-avatar" style={{background:'linear-gradient(135deg,#16a34a,#10b981)'}}>SJ</div><div><div className="tb-uname">Sarah Johns</div><div className="tb-urole">Administrator</div></div></div>
          </div>
        </div>
        <div className="pg">
          <div className="pg-header">
            <div className="pg-header-left"><h1>Sales</h1><p>Manage quotations, sales orders, and track revenue pipeline</p></div>
            <div className="pg-header-actions">
              <button className="btn-action btn-blue" onClick={()=>setModal('newquote')}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New Quote
              </button>
              <button className="btn-action btn-green" onClick={()=>{ const accepted=quotes.find(q=>q.status==='Accepted'); if(accepted) setConvertQuote(accepted); else showToast('No accepted quotes to convert'); }}>
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Convert to Order
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="kpi-row" style={{marginBottom:'20px'}}>
            {[
              {key:'revenue',    label:'Total Revenue',     value:'$4.2M', icon:<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, cls:'ic-g', chg:'18% this month', up:true},
              {key:'quotes',     label:'Active Quotes',     value:'42',    icon:<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, cls:'ic-b', note:'$850K potential'},
              {key:'orders',     label:'Orders This Month', value:'156',   icon:<svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>, cls:'ic-o', chg:'24% vs last month', up:true},
              {key:'conversion', label:'Conversion Rate',   value:'68%',   icon:<svg viewBox="0 0 24 24"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>, cls:'ic-p', chg:'5% improvement', up:true},
            ].map(k=>(
              <div key={k.key} className={`kpi kpi-clickable${openKpi===k.key?' kpi-active':''}`} onClick={()=>toggleKpi(k.key)}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-body"><div className="kpi-value">{k.value}</div><div className={`kpi-icon ${k.cls}`}>{k.icon}</div></div>
                {k.chg ? <div className={`kpi-chg ${k.up?'up':'dn'}`}><svg viewBox="0 0 24 24">{k.up?<polyline points="18 15 12 9 6 15"/>:<polyline points="6 9 12 15 18 9"/>}</svg>{k.chg}</div>
                       : <div style={{fontSize:'13px',fontWeight:500,color:'#2563eb',marginTop:'6px'}}>{k.note}</div>}
                {openKpi===k.key && <KpiDrawer type={k.key} onClose={e=>{e.stopPropagation();setOpenKpi(null);}} />}
              </div>
            ))}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:'18px',alignItems:'start'}}>
            <div>
              {/* Sales Funnel */}
              <div className="pur-tab-card" style={{marginBottom:'16px'}}>
                <div style={{fontSize:'15px',fontWeight:700,color:'#111827',marginBottom:'20px'}}>Sales Funnel</div>
                {FUNNEL.map(f=>(
                  <div key={f.label} style={{display:'flex',alignItems:'center',gap:'14px',marginBottom:'14px',cursor:'pointer'}}
                    onClick={()=>showToast(`${f.label}: ${f.count}`)}>
                    <div style={{width:'12px',height:'12px',borderRadius:'50%',background:f.color,flexShrink:0}}></div>
                    <div style={{width:'130px',fontSize:'13.5px',color:'#374151'}}>{f.label}</div>
                    <div style={{flex:1,height:'8px',background:'#f3f4f6',borderRadius:'4px',overflow:'hidden'}}><div style={{width:f.pct,height:'100%',background:f.color,borderRadius:'4px'}}></div></div>
                    <div style={{fontSize:'13px',color:'#6b7280',width:'100px',textAlign:'right'}}>{f.count}</div>
                  </div>
                ))}
              </div>

              {/* Quotations list */}
              <div className="pur-tab-card" style={{overflow:'hidden',padding:0}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 22px 0'}}>
                  <div style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>Recent Quotations</div>
                </div>
                {/* Tabs */}
                <div style={{display:'flex',borderBottom:'1px solid #f3f4f6',padding:'10px 22px',gap:'18px'}}>
                  {TABS.map((tab,i)=>(
                    <div key={tab} style={{padding:'8px 0',fontSize:'13.5px',fontWeight:activeTab===i?700:400,color:activeTab===i?'#2563eb':'#6b7280',cursor:'pointer',borderBottom:activeTab===i?'2px solid #2563eb':'none'}} onClick={()=>setActiveTab(i)}>
                      {tab} <span style={{fontSize:'11.5px',color:'#9ca3af',marginLeft:'4px'}}>{TAB_COUNTS[i]}</span>
                    </div>
                  ))}
                </div>
                {/* Search */}
                <div style={{padding:'8px 22px 12px',borderBottom:'1px solid #f3f4f6',display:'flex',alignItems:'center',gap:'12px'}}>
                  <div style={{position:'relative',flex:1}}>
                    <svg style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',width:'14px',height:'14px',stroke:'#9ca3af',fill:'none'}} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input style={{width:'100%',height:'36px',border:'1px solid #e5e7eb',borderRadius:'8px',padding:'0 14px 0 34px',fontSize:'13.5px',color:'#374151',outline:'none'}} placeholder="Search quotations…" value={search} onChange={e=>setSearch(e.target.value)}/>
                  </div>
                  <button style={{height:'36px',padding:'0 14px',border:'1px solid #e5e7eb',borderRadius:'8px',background:'#fff',color:'#374151',fontSize:'13px',fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',gap:'6px'}} onClick={()=>showToast('Filter applied')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>Filter
                  </button>
                </div>
                {/* Quote rows */}
                {filtered.map(q=>(
                  <div key={q.num} style={{padding:'18px 22px',borderBottom:'1px solid #f3f4f6',cursor:'pointer'}} onClick={()=>setQuoteDetail(q)}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'5px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        <span style={{fontSize:'14px',fontWeight:700,color:'#111827'}}>{q.num}</span>
                        <span style={{background:q.statusBg,color:q.statusColor,fontSize:'11.5px',fontWeight:600,padding:'2px 8px',borderRadius:'12px'}}>{q.status}</span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
                        <span style={{fontSize:'14px',fontWeight:700,color:'#111827'}}>{q.amount}</span>
                        {q.status==='Accepted' && <button style={{fontSize:'13px',fontWeight:600,color:'#16a34a',background:'none',border:'none',cursor:'pointer'}} onClick={e=>{e.stopPropagation();setConvertQuote(q);}}>Create Order</button>}
                        {q.status==='Pending'  && <button style={{fontSize:'13px',fontWeight:600,color:'#2563eb',background:'none',border:'none',cursor:'pointer'}} onClick={e=>{e.stopPropagation();setConvertQuote(q);}}>Convert to Order</button>}
                        {q.status==='Under Review' && <button style={{fontSize:'13px',fontWeight:600,color:'#2563eb',background:'none',border:'none',cursor:'pointer'}} onClick={e=>{e.stopPropagation();setQuoteDetail(q);}}>View Details</button>}
                      </div>
                    </div>
                    <div style={{fontSize:'13px',color:'#374151',marginBottom:'3px'}}>{q.desc} — {q.client}</div>
                    <div style={{fontSize:'12px',color:'#9ca3af',marginBottom:'5px'}}>{q.dates}</div>
                    <div style={{fontSize:'12px',color:'#6b7280'}}>{q.notes}</div>
                  </div>
                ))}
                {filtered.length===0 && <div style={{padding:'24px',textAlign:'center',color:'#9ca3af',fontSize:'13.5px'}}>No quotes match "{search}".</div>}
              </div>
            </div>

            {/* Right sidebar */}
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              {/* Quick Actions */}
              <div className="pur-tab-card">
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'14px'}}>Quick Actions</div>
                <button className="pur-sidebar-btn pur-sidebar-btn-blue" onClick={()=>setModal('newquote')}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New Quote
                </button>
                <button className="pur-sidebar-btn pur-sidebar-btn-green" onClick={()=>{ const accepted=quotes.find(q=>q.status==='Accepted'); if(accepted) setConvertQuote(accepted); else showToast('No accepted quotes to convert'); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Convert to Order
                </button>
                <button className="pur-sidebar-btn pur-sidebar-btn-outline" onClick={()=>{ const first=quotes[0]; if(first) setDiscountQuote(first); else showToast('No quotes available'); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>Apply Discount
                </button>
              </div>

              {/* Top Products */}
              <div className="pur-tab-card">
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'14px'}}>Top Products</div>
                {[
                  {label:'Software Licenses',sub:'Enterprise Solutions',val:'$245K',grow:'↗ 22%',color:'#dbeafe',ic:'#2563eb'},
                  {label:'Marketing Services',sub:'Digital & Traditional',val:'$189K',grow:'↗ 18%',color:'#dcfce7',ic:'#16a34a'},
                  {label:'Custom Development',sub:'Web & Mobile Apps',val:'$156K',grow:'↗ 35%',color:'#f5f3ff',ic:'#7c3aed'},
                ].map(p=>(
                  <div key={p.label} style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'12px',cursor:'pointer'}} onClick={()=>showToast(`${p.label}: ${p.val} YTD`)}>
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
                  {label:'Volume Discount',sub:'Orders above $50K',val:'10-25%',valColor:'#16a34a'},
                  {label:'Early Bird',sub:'Payment within 7 days',val:'15%',valColor:'#16a34a'},
                  {label:'Loyalty Program',sub:'Based on customer tier',val:'5-20%',valColor:'#7c3aed'},
                ].map(r=>(
                  <div key={r.label} style={{padding:'11px 14px',borderRadius:'9px',border:'1px solid #e5e7eb',marginBottom:'8px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}}
                    onClick={()=>showToast(`Editing ${r.label} rule`)}>
                    <div><div style={{fontSize:'13px',fontWeight:600,color:'#111827'}}>{r.label}</div><div style={{fontSize:'12px',color:'#9ca3af',marginTop:'2px'}}>{r.sub}</div></div>
                    <span style={{fontSize:'12.5px',fontWeight:700,color:r.valColor}}>{r.val}</span>
                  </div>
                ))}
                <button className="pur-btn-secondary" style={{width:'100%',height:'34px',fontSize:'13px',marginTop:'4px'}} onClick={()=>showToast('Discount rules editor opened')}>Manage Rules</button>
              </div>

              {/* Fulfillment Status */}
              <div className="pur-tab-card">
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'14px'}}>Fulfillment Status</div>
                {[
                  {num:'SO-2024-089',status:'Delivered',color:'#dcfce7',icon:'#16a34a'},
                  {num:'SO-2024-088',status:'In Transit',color:'#dbeafe',icon:'#2563eb'},
                  {num:'SO-2024-087',status:'Processing',color:'#fef9c3',icon:'#a16207'},
                ].map(s=>(
                  <div key={s.num} style={{padding:'12px 14px',borderRadius:'9px',border:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px',cursor:'pointer'}}
                    onClick={()=>showToast(`Viewing ${s.num}`)}>
                    <div><div style={{fontSize:'13px',fontWeight:600,color:'#111827'}}>{s.num}</div><div style={{fontSize:'12px',color:'#9ca3af',marginTop:'2px'}}>{s.status}</div></div>
                    <div style={{width:'24px',height:'24px',background:s.color,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={s.icon} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  </div>
                ))}
                <button className="pur-btn-secondary" style={{width:'100%',height:'34px',fontSize:'13px'}} onClick={()=>showToast('Full fulfillment report opened')}>View All Orders</button>
              </div>

              {/* Quick Tasks (CRM-style) */}
              <div className="pur-tab-card">
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'14px'}}>Follow-up Tasks</div>
                {tasks.map(t=>(
                  <div key={t.id} style={{padding:'11px 12px',borderRadius:'9px',background:t.done?'#f9fafb':t.color,border:`1px solid ${t.done?'#e5e7eb':t.border}`,marginBottom:'8px',display:'flex',alignItems:'flex-start',gap:'10px',opacity:t.done?0.6:1}}>
                    <input type="checkbox" checked={t.done} onChange={()=>toggleTask(t.id)} style={{marginTop:'2px',accentColor:'#7c3aed'}}/>
                    <div><div style={{fontSize:'13px',fontWeight:600,color:'#111827',textDecoration:t.done?'line-through':'none'}}>{t.text}</div><div style={{fontSize:'12px',color:'#9ca3af',marginTop:'1px'}}>{t.due}</div></div>
                  </div>
                ))}
                {showTaskInput ? (
                  <div style={{display:'flex',gap:'6px',marginBottom:'8px'}}>
                    <input style={{flex:1,height:'34px',border:'1px solid #e5e7eb',borderRadius:'8px',padding:'0 10px',fontSize:'13px',outline:'none'}} placeholder="Task description…" value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTask()} autoFocus/>
                    <button className="pur-btn-primary" style={{height:'34px',padding:'0 12px',fontSize:'12.5px'}} onClick={addTask}>Add</button>
                  </div>
                ) : (
                  <button style={{width:'100%',height:'34px',background:'#fff',color:'#374151',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'13px',fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}} onClick={()=>setShowTaskInput(true)}>
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
