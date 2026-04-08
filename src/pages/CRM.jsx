import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import '../styles/CRM.css';

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

/* ─── Add Lead modal ─── */
function AddLeadModal({ onClose, onSave }) {
  const [form, setForm] = useState({ company:'', contact:'', email:'', phone:'', value:'', stage:'New Leads', source:'' });
  const [saved, setSaved] = useState(false);
  function save() {
    if (!form.company || !form.contact) return;
    setSaved(true);
    setTimeout(() => { onSave(form); onClose(); }, 900);
  }
  return (
    <Modal title="Add New Lead" onClose={onClose}>
      {saved ? (
        <div className="pur-success"><svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><div>Lead added to pipeline!</div></div>
      ) : (
        <>
          <div className="pur-form-grid">
            <div className="pur-form-group"><label>Company *</label><input type="text" placeholder="Company name" value={form.company} onChange={e=>setForm({...form,company:e.target.value})}/></div>
            <div className="pur-form-group"><label>Contact Person *</label><input type="text" placeholder="Full name" value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})}/></div>
          </div>
          <div className="pur-form-grid">
            <div className="pur-form-group"><label>Email</label><input type="email" placeholder="email@company.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
            <div className="pur-form-group"><label>Phone</label><input type="text" placeholder="+1 (555) 000-0000" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
          </div>
          <div className="pur-form-grid">
            <div className="pur-form-group">
              <label>Deal Value (USD)</label>
              <input type="number" placeholder="0" value={form.value} onChange={e=>setForm({...form,value:e.target.value})}/>
            </div>
            <div className="pur-form-group">
              <label>Pipeline Stage</label>
              <select value={form.stage} onChange={e=>setForm({...form,stage:e.target.value})}>
                <option>New Leads</option><option>Qualified</option><option>Proposal</option><option>Closed Won</option>
              </select>
            </div>
          </div>
          <div className="pur-form-group">
            <label>Lead Source</label>
            <select value={form.source} onChange={e=>setForm({...form,source:e.target.value})}>
              <option value="">Select source…</option>
              <option>Website</option><option>Referral</option><option>Cold Outreach</option><option>Trade Show</option><option>LinkedIn</option>
            </select>
          </div>
          <div className="pur-modal-actions">
            <button className="pur-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="pur-btn-primary" onClick={save}>Add Lead</button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ─── Log Call modal ─── */
function LogCallModal({ onClose, onSave }) {
  const [form, setForm] = useState({ company:'', contact:'', duration:'', outcome:'', notes:'', followUp:'' });
  const [saved, setSaved] = useState(false);
  function save() {
    if (!form.company) return;
    setSaved(true);
    setTimeout(() => { onSave(`Call logged with ${form.company}`); onClose(); }, 900);
  }
  return (
    <Modal title="Log Call Activity" onClose={onClose}>
      {saved ? (
        <div className="pur-success"><svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><div>Call activity logged!</div></div>
      ) : (
        <>
          <div className="pur-form-grid">
            <div className="pur-form-group">
              <label>Company *</label>
              <select value={form.company} onChange={e=>setForm({...form,company:e.target.value})}>
                <option value="">Select company…</option>
                <option>TechStart Solutions</option><option>Enterprise Corp</option><option>RetailChain Inc</option><option>FinanceHub Ltd</option>
              </select>
            </div>
            <div className="pur-form-group"><label>Contact Name</label><input type="text" placeholder="Name" value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})}/></div>
          </div>
          <div className="pur-form-grid">
            <div className="pur-form-group">
              <label>Duration (mins)</label>
              <input type="number" placeholder="e.g. 30" value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})}/>
            </div>
            <div className="pur-form-group">
              <label>Outcome</label>
              <select value={form.outcome} onChange={e=>setForm({...form,outcome:e.target.value})}>
                <option value="">Select outcome…</option>
                <option>Interested — follow up</option><option>Meeting scheduled</option><option>Proposal requested</option><option>Not interested</option><option>No answer</option>
              </select>
            </div>
          </div>
          <div className="pur-form-group"><label>Call Notes</label><input type="text" placeholder="Key discussion points…" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
          <div className="pur-form-group"><label>Follow-up Date</label><input type="date" value={form.followUp} onChange={e=>setForm({...form,followUp:e.target.value})}/></div>
          <div className="pur-modal-actions">
            <button className="pur-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="pur-btn-primary" onClick={save}>Log Call</button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ─── Lead detail modal ─── */
function LeadDetailModal({ lead, onClose, onMove, onLog }) {
  const stages = ['New Leads','Qualified','Proposal','Closed Won'];
  const currentIdx = stages.indexOf(lead.stage);
  return (
    <Modal title={lead.company} onClose={onClose} width={520}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px',paddingBottom:'16px',borderBottom:'1px solid #f3f4f6'}}>
        <div style={{width:'48px',height:'48px',borderRadius:'50%',background:lead.gradient,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:700,color:'#fff',flexShrink:0}}>{lead.initials}</div>
        <div>
          <div style={{fontSize:'16px',fontWeight:700,color:'#111827'}}>{lead.company}</div>
          <div style={{fontSize:'13px',color:'#9ca3af'}}>{lead.type}</div>
        </div>
      </div>
      <div className="pur-detail-row"><span>Deal Value</span><strong style={{color:'#16a34a',fontSize:'15px'}}>{lead.value}</strong></div>
      <div className="pur-detail-row"><span>Stage</span><span style={{background:lead.stageBg,color:lead.stageColor,fontSize:'12px',fontWeight:600,padding:'2px 10px',borderRadius:'12px'}}>{lead.stage}</span></div>
      <div className="pur-detail-row"><span>Owner</span><strong>{lead.owner}</strong></div>
      {/* Stage progression */}
      <div style={{margin:'16px 0 12px'}}>
        <div style={{fontSize:'12.5px',fontWeight:600,color:'#374151',marginBottom:'10px'}}>Move to Stage</div>
        <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
          {stages.map((s,i) => (
            <button key={s} style={{padding:'5px 12px',borderRadius:'8px',border:`1px solid ${s===lead.stage?'#7c3aed':'#e5e7eb'}`,background:s===lead.stage?'#f5f3ff':'#fff',color:s===lead.stage?'#7c3aed':'#374151',fontSize:'12.5px',fontWeight:s===lead.stage?700:400,cursor:s===lead.stage?'default':'pointer'}}
              onClick={()=>{ if(s!==lead.stage){ onMove(lead, s); onClose(); } }}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="pur-modal-actions" style={{marginTop:'16px'}}>
        <button className="pur-btn-cancel" onClick={onClose}>Close</button>
        <button className="pur-btn-secondary" onClick={()=>{ onLog(); onClose(); }}>Log Call</button>
        <button className="pur-btn-primary" onClick={()=>{ onMove(lead,'Closed Won'); onClose(); }}>Mark Won</button>
      </div>
    </Modal>
  );
}

/* ─── KPI drawer ─── */
const KPI_DETAILS = {
  leads:      { title:'Leads by Source',        rows:[{label:'Website',value:'124',color:'#3b82f6'},{label:'Referral',value:'89',color:'#16a34a'},{label:'Cold Outreach',value:'78',color:'#f59e0b'},{label:'Other',value:'56',color:'#9ca3af'}], note:'12% increase vs last week.' },
  conversion: { title:'Conversion by Stage',    rows:[{label:'Lead → Qualified',value:'75%',color:'#10b981'},{label:'Qualified → Proposal',value:'49%',color:'#f59e0b'},{label:'Proposal → Won',value:'46%',color:'#16a34a'}], note:'3% improvement overall this month.' },
  pipeline:   { title:'Pipeline by Product',    rows:[{label:'Software',value:'$980K',color:'#2563eb'},{label:'Services',value:'$850K',color:'#16a34a'},{label:'Consulting',value:'$570K',color:'#7c3aed'}], note:'89 active opportunities.' },
  customers:  { title:'Customers by Tier',      rows:[{label:'Enterprise',value:'187',color:'#6366f1'},{label:'Growth',value:'624',color:'#3b82f6'},{label:'Starter',value:'436',color:'#a78bfa'}], note:'18 new customers added this month.' },
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
const STAGES = [
  { key:'New Leads',  bg:'#f8fafc', count:23, countBg:'#dbeafe', countColor:'#1d4ed8' },
  { key:'Qualified',  bg:'#fffbeb', count:18, countBg:'#fef9c3', countColor:'#a16207' },
  { key:'Proposal',   bg:'#fff7ed', count:12, countBg:'#ffedd5', countColor:'#ea580c' },
  { key:'Closed Won', bg:'#f0fdf4', count:8,  countBg:'#dcfce7', countColor:'#15803d' },
];

const INITIAL_LEADS = [
  { id:1, stage:'New Leads',  company:'TechStart Solutions',  type:'Software Development', value:'$45K', initials:'TS', gradient:'linear-gradient(135deg,#6366f1,#a78bfa)', owner:'Mike Chen',    stageBg:'#dbeafe', stageColor:'#1d4ed8' },
  { id:2, stage:'New Leads',  company:'Global Manufacturing',  type:'ERP Implementation',  value:'$125K',initials:'GM', gradient:'linear-gradient(135deg,#f59e0b,#ef4444)', owner:'Sarah Johnson',stageBg:'#dbeafe', stageColor:'#1d4ed8' },
  { id:3, stage:'Qualified',  company:'Enterprise Corp',       type:'Cloud Migration',      value:'$89K', initials:'EC', gradient:'linear-gradient(135deg,#10b981,#059669)', owner:'Mike Chen',    stageBg:'#fef9c3', stageColor:'#a16207' },
  { id:4, stage:'Proposal',   company:'RetailChain Inc',       type:'POS System Upgrade',   value:'$67K', initials:'RC', gradient:'linear-gradient(135deg,#ec4899,#8b5cf6)', owner:'David Park',   stageBg:'#ffedd5', stageColor:'#ea580c' },
  { id:5, stage:'Closed Won', company:'FinanceHub Ltd',        type:'Security Audit',        value:'$34K', initials:'FH', gradient:'linear-gradient(135deg,#2563eb,#1d4ed8)', owner:'Sarah Johnson',stageBg:'#dcfce7', stageColor:'#15803d' },
];

export default function CRM({ goPage }) {
  const [modal, setModal]         = useState(null); // 'addlead'|'logcall'
  const [leads, setLeads]         = useState(INITIAL_LEADS);
  const [leadDetail, setLeadDetail] = useState(null);
  const [openKpi, setOpenKpi]     = useState(null);
  const [toast, setToast]         = useState(null);
  const [view, setView]           = useState('kanban'); // 'kanban'|'list'
  const [tasks, setTasks]         = useState([
    { id:1, text:'Follow up with Enterprise Corp', due:'Today 3:00 PM',     done:false, color:'#fffbeb', border:'#fde68a' },
    { id:2, text:'Prepare demo for RetailChain',    due:'Tomorrow 10:00 AM', done:false, color:'#eff6ff', border:'#bfdbfe' },
    { id:3, text:'Send proposal to TechStart',       due:'Completed',         done:true  },
  ]);
  const [notes, setNotes]         = useState([
    { id:1, time:'2 hours ago', initials:'MC', gradient:'linear-gradient(135deg,#6366f1,#a78bfa)', text:'Client is interested in our enterprise package. Scheduling technical demo for next week.' },
    { id:2, time:'Yesterday',   initials:'SJ', gradient:'linear-gradient(135deg,#16a34a,#10b981)', text:'Initial contact made. Decision maker identified as CTO John Smith.' },
  ]);
  const [newTask, setNewTask]     = useState('');
  const [showTaskInput, setShowTaskInput] = useState(false);
  const [newNote, setNewNote]     = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [selectedLead, setSelectedLead]   = useState(leads[0]); // for Customer 360

  function showToast(msg) { setToast(msg); }
  function toggleKpi(k) { setOpenKpi(p=>p===k?null:k); }

  function addLead(form) {
    const newLead = {
      id: Date.now(), stage: form.stage, company: form.company, type: form.source || 'New Lead',
      value: form.value ? `$${parseFloat(form.value).toLocaleString()}` : 'TBD',
      initials: form.company.slice(0,2).toUpperCase(),
      gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)', owner: 'Mike Chen',
      stageBg:'#dbeafe', stageColor:'#1d4ed8',
    };
    setLeads(p=>[...p,newLead]);
    showToast(`${form.company} added to pipeline`);
  }

  function moveLead(lead, newStage) {
    const stageConfig = { 'New Leads':{bg:'#dbeafe',color:'#1d4ed8'}, 'Qualified':{bg:'#fef9c3',color:'#a16207'}, 'Proposal':{bg:'#ffedd5',color:'#ea580c'}, 'Closed Won':{bg:'#dcfce7',color:'#15803d'} };
    setLeads(p=>p.map(l=>l.id===lead.id ? {...l, stage:newStage, stageBg:stageConfig[newStage].bg, stageColor:stageConfig[newStage].color} : l));
    showToast(`${lead.company} moved to ${newStage}`);
    if (selectedLead?.id===lead.id) setSelectedLead(p=>({...p, stage:newStage}));
  }

  function toggleTask(id) { setTasks(p=>p.map(t=>t.id===id?{...t,done:!t.done}:t)); }
  function addTask() {
    if (!newTask.trim()) return;
    setTasks(p=>[...p,{id:Date.now(),text:newTask,due:'No due date',done:false,color:'#f9fafb',border:'#e5e7eb'}]);
    setNewTask(''); setShowTaskInput(false);
  }
  function addNote() {
    if (!newNote.trim()) return;
    setNotes(p=>[{id:Date.now(),time:'Just now',initials:'SJ',gradient:'linear-gradient(135deg,#16a34a,#10b981)',text:newNote},...p]);
    setNewNote(''); setShowNoteInput(false);
    showToast('Note added');
  }

  return (
    <div id="crm-page">
      {toast && <Toast msg={toast} onClose={()=>setToast(null)} />}
      {modal==='addlead' && <AddLeadModal onClose={()=>setModal(null)} onSave={addLead} />}
      {modal==='logcall' && <LogCallModal onClose={()=>setModal(null)} onSave={showToast} />}
      {leadDetail && <LeadDetailModal lead={leadDetail} onClose={()=>setLeadDetail(null)} onMove={moveLead} onLog={()=>setModal('logcall')} />}

      <Sidebar activePage="crm" goPage={goPage} />
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
            <div className="pg-header-left"><h1>CRM Pipeline</h1><p>Manage leads, opportunities, and customer relationships</p></div>
            <div className="pg-header-actions">
              <button className="btn-action btn-blue" onClick={()=>setModal('addlead')}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Lead
              </button>
              <button className="btn-action btn-green" onClick={()=>setModal('logcall')}>
                <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.27 12 19.79 19.79 0 0 1 1.15 3.18 2 2 0 0 1 3.12 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg>Log Call
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="kpi-row" style={{marginBottom:'20px'}}>
            {[
              {key:'leads',      label:'Total Leads',      value:'347',   icon:<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>, cls:'ic-b', chg:'12% this week', up:true },
              {key:'conversion', label:'Conversion Rate',  value:'24%',   icon:<svg viewBox="0 0 24 24"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>, cls:'ic-g', chg:'3% improvement', up:true },
              {key:'pipeline',   label:'Pipeline Value',   value:'$2.4M', icon:<svg viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>, cls:'ic-p', note:'89 opportunities' },
              {key:'customers',  label:'Active Customers', value:'1,247', icon:<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, cls:'ic-o', chg:'18 this month', up:true },
            ].map(k=>(
              <div key={k.key} className={`kpi kpi-clickable${openKpi===k.key?' kpi-active':''}`} onClick={()=>toggleKpi(k.key)}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-body"><div className="kpi-value">{k.value}</div><div className={`kpi-icon ${k.cls}`}>{k.icon}</div></div>
                {k.chg ? <div className={`kpi-chg ${k.up?'up':'dn'}`}><svg viewBox="0 0 24 24">{k.up?<polyline points="18 15 12 9 6 15"/>:<polyline points="6 9 12 15 18 9"/>}</svg>{k.chg}</div>
                       : <div style={{fontSize:'13px',fontWeight:500,color:'#7c3aed',marginTop:'6px'}}>{k.note}</div>}
                {openKpi===k.key && <KpiDrawer type={k.key} onClose={e=>{e.stopPropagation();setOpenKpi(null);}} />}
              </div>
            ))}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:'18px',alignItems:'start'}}>
            <div>
              {/* Pipeline section with Kanban / List toggle */}
              <div className="pur-tab-card" style={{marginBottom:'16px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'18px'}}>
                  <div style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>Sales Pipeline</div>
                  <div style={{display:'flex',gap:'8px'}}>
                    <button style={{height:'32px',padding:'0 12px',background:view==='kanban'?'#2563eb':'#fff',color:view==='kanban'?'#fff':'#374151',border:view==='kanban'?'none':'1px solid #e5e7eb',borderRadius:'7px',fontSize:'12.5px',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:'5px'}} onClick={()=>setView('kanban')}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>Kanban
                    </button>
                    <button style={{height:'32px',padding:'0 12px',background:view==='list'?'#2563eb':'#fff',color:view==='list'?'#fff':'#374151',border:view==='list'?'none':'1px solid #e5e7eb',borderRadius:'7px',fontSize:'12.5px',fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',gap:'5px'}} onClick={()=>setView('list')}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/></svg>List
                    </button>
                  </div>
                </div>

                {/* Kanban view */}
                {view==='kanban' && (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px'}}>
                    {STAGES.map(stage=>{
                      const stageLeads = leads.filter(l=>l.stage===stage.key);
                      return (
                        <div key={stage.key} style={{background:stage.bg,borderRadius:'10px',padding:'14px'}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
                            <div style={{fontSize:'13px',fontWeight:600,color:'#374151'}}>{stage.key}</div>
                            <div style={{background:stage.countBg,color:stage.countColor,fontSize:'11.5px',fontWeight:700,padding:'2px 7px',borderRadius:'10px'}}>{stageLeads.length}</div>
                          </div>
                          {stageLeads.map(lead=>(
                            <div key={lead.id} style={{background:'#fff',borderRadius:'8px',border:'1px solid #e5e7eb',padding:'12px',marginBottom:'8px',cursor:'pointer'}}
                              onClick={()=>{ setLeadDetail(lead); setSelectedLead(lead); }}>
                              <div style={{fontSize:'13px',fontWeight:600,color:'#111827',marginBottom:'2px'}}>{lead.company}</div>
                              <div style={{fontSize:'12px',color:'#9ca3af',marginBottom:'8px'}}>{lead.type}</div>
                              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                                <span style={{fontSize:'13px',fontWeight:700,color:'#16a34a'}}>{lead.value}</span>
                                <div style={{width:'24px',height:'24px',borderRadius:'50%',background:lead.gradient,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:700,color:'#fff'}}>{lead.initials}</div>
                              </div>
                            </div>
                          ))}
                          <button style={{width:'100%',height:'30px',border:'1px dashed #d1d5db',borderRadius:'8px',background:'transparent',color:'#9ca3af',fontSize:'12px',cursor:'pointer',marginTop:'4px'}}
                            onClick={()=>setModal('addlead')}>+ Add Lead</button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* List view */}
                {view==='list' && (
                  <table className="pur-table">
                    <thead><tr><th>Company</th><th>Type</th><th>Stage</th><th className="right">Value</th><th>Owner</th><th className="center">Action</th></tr></thead>
                    <tbody>
                      {leads.map(l=>(
                        <tr key={l.id} className="pur-table-row" onClick={()=>{ setLeadDetail(l); setSelectedLead(l); }}>
                          <td style={{fontWeight:600,color:'#111827'}}>
                            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                              <div style={{width:'28px',height:'28px',borderRadius:'50%',background:l.gradient,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:700,color:'#fff',flexShrink:0}}>{l.initials}</div>
                              {l.company}
                            </div>
                          </td>
                          <td style={{color:'#6b7280',fontSize:'13px'}}>{l.type}</td>
                          <td><span style={{background:l.stageBg,color:l.stageColor,fontSize:'11.5px',fontWeight:600,padding:'2px 8px',borderRadius:'12px'}}>{l.stage}</span></td>
                          <td className="right" style={{fontWeight:700,color:'#16a34a'}}>{l.value}</td>
                          <td style={{color:'#374151',fontSize:'13px'}}>{l.owner}</td>
                          <td className="center"><button className="pur-link-btn" onClick={e=>{e.stopPropagation();setLeadDetail(l);}}>View</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Activity Timeline */}
              <div className="pur-tab-card">
                <div style={{fontSize:'15px',fontWeight:700,color:'#111827',marginBottom:'18px'}}>Activity Timeline</div>
                {[
                  {bg:'#dbeafe',icon:'#2563eb',ico:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.27 12 19.79 19.79 0 0 1 1.15 3.18 2 2 0 0 1 3.12 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg>,title:'Call with TechStart Solutions',time:'2 hours ago',desc:'Discussed requirements and timeline for software development project',by:'MC',byGrad:'linear-gradient(135deg,#6366f1,#a78bfa)',byName:'by Mike Chen'},
                  {bg:'#dcfce7',ico:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,title:'Email sent to Enterprise Corp',time:'4 hours ago',desc:'Proposal for cloud migration project sent to decision makers',by:'SJ',byGrad:'linear-gradient(135deg,#16a34a,#10b981)',byName:'by Sarah Johnson'},
                  {bg:'#f5f3ff',ico:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,title:'Meeting scheduled with RetailChain Inc',time:'Yesterday',desc:'Product demo scheduled for next Friday at 2:00 PM',by:'DP',byGrad:'linear-gradient(135deg,#f59e0b,#ef4444)',byName:'by David Park'},
                ].map((a,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'flex-start',gap:'14px',padding:'12px 0',borderBottom:i<2?'1px solid #f3f4f6':'none',cursor:'pointer'}} onClick={()=>showToast(a.title)}>
                    <div style={{width:'36px',height:'36px',borderRadius:'50%',background:a.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{a.ico}</div>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'3px'}}><span style={{fontSize:'13.5px',fontWeight:600,color:'#111827'}}>{a.title}</span><span style={{fontSize:'12px',color:'#9ca3af'}}>{a.time}</span></div>
                      <div style={{fontSize:'13px',color:'#6b7280',marginBottom:'5px'}}>{a.desc}</div>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}><div style={{width:'20px',height:'20px',borderRadius:'50%',background:a.byGrad,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px',fontWeight:700,color:'#fff'}}>{a.by}</div><span style={{fontSize:'12px',color:'#9ca3af'}}>{a.byName}</span></div>
                    </div>
                  </div>
                ))}
                <button style={{width:'100%',height:'34px',border:'1px solid #e5e7eb',borderRadius:'8px',background:'#fff',color:'#374151',fontSize:'13px',fontWeight:500,cursor:'pointer',marginTop:'12px'}} onClick={()=>setModal('logcall')}>
                  + Log New Activity
                </button>
              </div>
            </div>

            {/* Right sidebar */}
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              {/* Customer 360 Profile */}
              <div className="pur-tab-card" style={{position:'relative'}}>
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'16px'}}>Customer 360 Profile</div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:'16px',paddingBottom:'16px',borderBottom:'1px solid #f3f4f6'}}>
                  <div style={{width:'56px',height:'56px',borderRadius:'50%',background:selectedLead?.gradient||'linear-gradient(135deg,#6366f1,#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:700,color:'#fff',marginBottom:'8px'}}>{selectedLead?.initials||'TS'}</div>
                  <div style={{fontSize:'14px',fontWeight:700,color:'#111827'}}>{selectedLead?.company||'TechStart Solutions'}</div>
                  <div style={{fontSize:'12px',color:'#9ca3af',marginTop:'2px'}}>{selectedLead?.type||'Software Company'}</div>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><span style={{fontSize:'13px',color:'#6b7280'}}>Deal Value</span><span style={{fontSize:'13px',fontWeight:700,color:'#111827'}}>{selectedLead?.value||'$45,000'}</span></div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><span style={{fontSize:'13px',color:'#6b7280'}}>Stage</span><span style={{fontSize:'12px',fontWeight:600,background:selectedLead?.stageBg||'#dbeafe',color:selectedLead?.stageColor||'#1d4ed8',padding:'2px 8px',borderRadius:'10px'}}>{selectedLead?.stage||'New Lead'}</span></div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><span style={{fontSize:'13px',color:'#6b7280'}}>Last Contact</span><span style={{fontSize:'13px',color:'#111827'}}>2 hours ago</span></div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'16px'}}><span style={{fontSize:'13px',color:'#6b7280'}}>Owner</span><span style={{fontSize:'13px',color:'#111827'}}>{selectedLead?.owner||'Mike Chen'}</span></div>
                <div style={{paddingTop:'14px',borderTop:'1px solid #f3f4f6'}}>
                  <div style={{fontSize:'13.5px',fontWeight:600,color:'#111827',marginBottom:'10px'}}>Contact Info</div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'7px'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg><span style={{fontSize:'13px',color:'#374151'}}>contact@{(selectedLead?.company||'techstart').toLowerCase().replace(/\s/g,'')}.com</span></div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.27 12 19.79 19.79 0 0 1 1.15 3.18 2 2 0 0 1 3.12 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg><span style={{fontSize:'13px',color:'#374151'}}>+1 (555) 123-4567</span></div>
                  <div style={{display:'flex',gap:'8px'}}>
                    <button className="pur-btn-primary" style={{flex:1,height:'32px',fontSize:'12.5px'}} onClick={()=>setModal('logcall')}>Log Call</button>
                    <button className="pur-btn-secondary" style={{flex:1,height:'32px',fontSize:'12.5px'}} onClick={()=>showToast('Email composer opened')}>Send Email</button>
                  </div>
                </div>
              </div>

              {/* Quick Tasks */}
              <div className="pur-tab-card">
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'14px'}}>Quick Tasks</div>
                {tasks.map(t=>(
                  <div key={t.id} style={{padding:'11px 12px',borderRadius:'9px',background:t.done?'#f9fafb':t.color||'#f9fafb',border:`1px solid ${t.done?'#e5e7eb':t.border||'#e5e7eb'}`,marginBottom:'8px',display:'flex',alignItems:'flex-start',gap:'10px',opacity:t.done?0.6:1}}>
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

              {/* Recent Notes */}
              <div className="pur-tab-card">
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'14px'}}>Recent Notes</div>
                {notes.map((n,i)=>(
                  <div key={n.id} style={{marginBottom:'14px',paddingBottom:'14px',borderBottom:i<notes.length-1?'1px solid #f3f4f6':'none'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px'}}>
                      <span style={{fontSize:'12px',color:'#9ca3af'}}>{n.time}</span>
                      <div style={{width:'22px',height:'22px',borderRadius:'50%',background:n.gradient,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px',fontWeight:700,color:'#fff'}}>{n.initials}</div>
                    </div>
                    <div style={{fontSize:'13px',color:'#374151',lineHeight:1.5}}>{n.text}</div>
                  </div>
                ))}
                {showNoteInput ? (
                  <div>
                    <textarea style={{width:'100%',minHeight:'80px',border:'1px solid #e5e7eb',borderRadius:'8px',padding:'10px',fontSize:'13px',outline:'none',resize:'vertical',marginBottom:'8px'}} placeholder="Add a note…" value={newNote} onChange={e=>setNewNote(e.target.value)} autoFocus/>
                    <div style={{display:'flex',gap:'6px'}}>
                      <button className="pur-btn-cancel" style={{height:'32px',flex:1,fontSize:'12.5px'}} onClick={()=>setShowNoteInput(false)}>Cancel</button>
                      <button className="pur-btn-primary" style={{height:'32px',flex:1,fontSize:'12.5px'}} onClick={addNote}>Save Note</button>
                    </div>
                  </div>
                ) : (
                  <button style={{width:'100%',height:'34px',background:'#fff',color:'#374151',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'13px',fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}} onClick={()=>setShowNoteInput(true)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Add Note
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
