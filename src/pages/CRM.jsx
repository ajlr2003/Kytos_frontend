/**
 * @file src/pages/CRM.jsx
 *
 * Customer Relationship Management module. Manages:
 *   - Lead pipeline with Kanban-style and List views.
 *   - Add Lead modal with company, contact, and deal-value capture.
 *   - Real-time KPI summary: total leads, pipeline value, win rate, conversion rate.
 *   - Lead detail modal with stage progression and quick actions.
 *   - Quick Tasks and Recent Notes panels in the right sidebar.
 *
 * API endpoints consumed:
 *   GET  /api/v1/crm/kpis                — dashboard KPI snapshot
 *   GET  /api/v1/crm/leads               — list all leads
 *   POST /api/v1/crm/leads               — create a new lead
 *   PATCH /api/v1/crm/leads/{id}/stage   — move lead to a new pipeline stage
 *   DELETE /api/v1/crm/leads/{id}        — delete a lead
 *   GET  /api/v1/auth/me                 — current user for toolbar display
 */

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Toast   from '../components/ui/Toast';
import Modal   from '../components/ui/Modal';
import ActivityTimeline from '../components/ui/ActivityTimeline';
import { API_BASE } from '../config';
import '../styles/CRM.css';

/* === Helpers === */

/** Returns auth headers with the stored JWT. */
function authHeaders() {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

/** Maps the backend stage enum value to a human-readable label. */
const STAGE_LABEL = {
  new_leads:  'New Leads',
  qualified:  'Qualified',
  proposal:   'Proposal',
  closed_won: 'Closed Won',
};

/** Maps a human-readable stage label back to the backend enum value. */
const STAGE_KEY = {
  'New Leads':  'new_leads',
  'Qualified':  'qualified',
  'Proposal':   'proposal',
  'Closed Won': 'closed_won',
};

/** Visual config per stage for colours and backgrounds. */
const STAGE_CONFIG = {
  new_leads:  { bg: '#f8fafc', countBg: '#dbeafe', countColor: '#1d4ed8', tagBg: '#dbeafe', tagColor: '#1d4ed8' },
  qualified:  { bg: '#fffbeb', countBg: '#fef9c3', countColor: '#a16207', tagBg: '#fef9c3', tagColor: '#a16207' },
  proposal:   { bg: '#fff7ed', countBg: '#ffedd5', countColor: '#ea580c', tagBg: '#ffedd5', tagColor: '#ea580c' },
  closed_won: { bg: '#f0fdf4', countBg: '#dcfce7', countColor: '#15803d', tagBg: '#dcfce7', tagColor: '#15803d' },
};

/** Deterministic gradient picked by cycling through a palette based on company name. */
const GRADIENTS = [
  'linear-gradient(135deg,#6366f1,#a78bfa)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#ec4899,#8b5cf6)',
  'linear-gradient(135deg,#2563eb,#1d4ed8)',
  'linear-gradient(135deg,#f97316,#fbbf24)',
];
function gradientFor(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) n += str.charCodeAt(i);
  return GRADIENTS[n % GRADIENTS.length];
}

/** Format a number as a compact dollar string, e.g. 45000 → "$45K". */
function fmtValue(v) {
  if (!v && v !== 0) return 'TBD';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

/** Enrich a raw API lead with UI-only derived fields. */
function enrichLead(l) {
  const cfg = STAGE_CONFIG[l.stage] || STAGE_CONFIG.new_leads;
  return {
    ...l,
    stageLabel: STAGE_LABEL[l.stage] || l.stage,
    stageBg:    cfg.tagBg,
    stageColor: cfg.tagColor,
    initials:   l.company.slice(0, 2).toUpperCase(),
    gradient:   gradientFor(l.company),
    valueDisplay: fmtValue(l.deal_value),
    type:       l.industry || 'Lead',
  };
}


/* === Add Lead modal === */

/**
 * @param {object} props
 * @param {Function} props.onClose - Close the modal.
 * @param {Function} props.onSave  - Called with the new lead object after creation.
 */
function AddLeadModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    company: '', contact_person: '', email: '', phone: '',
    deal_value: '', stage: 'new_leads', source: '', industry: '', owner: '',
    customer_reference: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');

  async function save() {
    if (!form.company.trim() || !form.contact_person.trim()) {
      setError('Company and Contact Person are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/crm/leads`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          ...form,
          deal_value: form.deal_value ? parseFloat(form.deal_value) : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed to create lead');
      const newLead = await res.json();
      setSaved(true);
      setTimeout(() => { onSave(newLead); onClose(); }, 900);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add New Lead" onClose={onClose}>
      {saved ? (
        <div className="pur-success">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <div>Lead added to pipeline!</div>
        </div>
      ) : (
        <>
          {error && <div style={{background:'#fef2f2',color:'#dc2626',padding:'10px 14px',borderRadius:'8px',marginBottom:'14px',fontSize:'13px'}}>{error}</div>}
          <div className="pur-form-grid">
            <div className="pur-form-group">
              <label>Company *</label>
              <input type="text" placeholder="Company name" value={form.company} onChange={e => setForm({...form, company: e.target.value})} />
            </div>
            <div className="pur-form-group">
              <label>Contact Person *</label>
              <input type="text" placeholder="Full name" value={form.contact_person} onChange={e => setForm({...form, contact_person: e.target.value})} />
            </div>
          </div>
          <div className="pur-form-grid">
            <div className="pur-form-group">
              <label>Email</label>
              <input type="email" placeholder="email@company.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
            <div className="pur-form-group">
              <label>Phone</label>
              <input type="text" placeholder="+1 (555) 000-0000" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
          </div>
          <div className="pur-form-grid">
            <div className="pur-form-group">
              <label>Deal Value (SAR)</label>
              <input type="number" placeholder="0" value={form.deal_value} onChange={e => setForm({...form, deal_value: e.target.value})} />
            </div>
            <div className="pur-form-group">
              <label>Pipeline Stage</label>
              <select value={form.stage} onChange={e => setForm({...form, stage: e.target.value})}>
                <option value="new_leads">New Leads</option>
                <option value="qualified">Qualified</option>
                <option value="proposal">Proposal</option>
                <option value="closed_won">Closed Won</option>
              </select>
            </div>
          </div>
          <div className="pur-form-grid">
            <div className="pur-form-group">
              <label>Industry / Type</label>
              <input type="text" placeholder="e.g. ERP Implementation" value={form.industry} onChange={e => setForm({...form, industry: e.target.value})} />
            </div>
            <div className="pur-form-group">
              <label>Lead Source</label>
              <select value={form.source} onChange={e => setForm({...form, source: e.target.value})}>
                <option value="">Select source…</option>
                <option value="website">Website</option>
                <option value="referral">Referral</option>
                <option value="cold_outreach">Cold Outreach</option>
                <option value="trade_show">Trade Show</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </div>
          </div>
          <div className="pur-form-group">
            <label>Owner (Salesperson)</label>
            <input type="text" placeholder="Name of responsible salesperson" value={form.owner} onChange={e => setForm({...form, owner: e.target.value})} />
          </div>
          <div className="pur-form-group">
            <label>Customer's Own Reference / Lead Number</label>
            <input type="text" placeholder="e.g. 44 (the number the customer gave you)" value={form.customer_reference} onChange={e => setForm({...form, customer_reference: e.target.value})} />
          </div>
          <div className="pur-modal-actions">
            <button className="pur-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="pur-btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add Lead'}</button>
          </div>
        </>
      )}
    </Modal>
  );
}


/* === Log Call modal (persists to the lead's activity timeline) === */

/**
 * @param {object}   props
 * @param {object[]} props.leads      - Lead list for company dropdown.
 * @param {string}   [props.leadId]   - Pre-selected lead id, if opened from a lead's detail view.
 * @param {Function} props.onClose    - Close the modal.
 * @param {Function} props.onSave     - Called with a status message string.
 */
function LogCallModal({ leads, leadId, onClose, onSave }) {
  const [form, setForm] = useState({ leadId: leadId || '', contact: '', duration: '', outcome: '', notes: '', followUp: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!form.leadId) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/crm/leads/${form.leadId}/calls`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          contact_person: form.contact.trim() || null,
          duration_minutes: form.duration ? parseInt(form.duration, 10) : null,
          outcome: form.outcome || null,
          notes: form.notes.trim() || null,
          follow_up_date: form.followUp || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Failed to log call');
      setSaving(false);
      const company = leads.find(l => l.id === form.leadId)?.company || 'lead';
      onSave(`Call logged with ${company}`);
      onClose();
    } catch (e) {
      setSaving(false);
      setError(e.message);
    }
  }

  return (
    <Modal title="Log Call Activity" onClose={onClose}>
          {error && <div style={{color:'#dc2626',fontSize:'12.5px',marginBottom:'10px'}}>{error}</div>}
          <div className="pur-form-grid">
            <div className="pur-form-group">
              <label>Company *</label>
              <select value={form.leadId} onChange={e => setForm({...form, leadId: e.target.value})}>
                <option value="">Select company…</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.company}</option>)}
              </select>
            </div>
            <div className="pur-form-group">
              <label>Contact Name</label>
              <input type="text" placeholder="Name" value={form.contact} onChange={e => setForm({...form, contact: e.target.value})} />
            </div>
          </div>
          <div className="pur-form-grid">
            <div className="pur-form-group">
              <label>Duration (mins)</label>
              <input type="number" placeholder="e.g. 30" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} />
            </div>
            <div className="pur-form-group">
              <label>Outcome</label>
              <select value={form.outcome} onChange={e => setForm({...form, outcome: e.target.value})}>
                <option value="">Select outcome…</option>
                <option>Interested — follow up</option>
                <option>Meeting scheduled</option>
                <option>Proposal requested</option>
                <option>Not interested</option>
                <option>No answer</option>
              </select>
            </div>
          </div>
          <div className="pur-form-group">
            <label>Call Notes</label>
            <input type="text" placeholder="Key discussion points…" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
          </div>
          <div className="pur-form-group">
            <label>Follow-up Date</label>
            <input type="date" value={form.followUp} onChange={e => setForm({...form, followUp: e.target.value})} />
          </div>
          <div className="pur-modal-actions">
            <button className="pur-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="pur-btn-primary" onClick={save} disabled={saving}>{saving ? 'Logging…' : 'Log Call'}</button>
          </div>
    </Modal>
  );
}


/* === Lead detail modal === */

/**
 * @param {object}   props
 * @param {object}   props.lead    - Enriched lead object.
 * @param {Function} props.onClose - Close the modal.
 * @param {Function} props.onMove  - Called with (lead, newStageKey) to move the lead.
 * @param {Function} props.onLog   - Opens the Log Call modal.
 */
function LeadDetailModal({ lead, onClose, onMove, onLog }) {
  const stageKeys = ['new_leads', 'qualified', 'proposal', 'closed_won'];
  const [linkedRfqs, setLinkedRfqs] = useState([]);

  useEffect(() => {
    if (!lead.id) return;
    fetch(`${API_BASE}/api/v1/crm/leads/${lead.id}/rfqs`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setLinkedRfqs(d.items ?? []))
      .catch(() => {});
  }, [lead.id]);

  return (
    <Modal title={lead.company} onClose={onClose}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px',paddingBottom:'16px',borderBottom:'1px solid #f3f4f6'}}>
        <div style={{width:'48px',height:'48px',borderRadius:'50%',background:lead.gradient,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:700,color:'#fff',flexShrink:0}}>{lead.initials}</div>
        <div>
          <div style={{fontSize:'16px',fontWeight:700,color:'#111827'}}>{lead.company}</div>
          <div style={{fontSize:'13px',color:'#9ca3af'}}>{lead.type}</div>
        </div>
      </div>

      <div className="pur-detail-row"><span>Deal Value</span><strong style={{color:'#16a34a',fontSize:'15px'}}>{lead.valueDisplay}</strong></div>
      <div className="pur-detail-row"><span>Stage</span><span style={{background:lead.stageBg,color:lead.stageColor,fontSize:'12px',fontWeight:600,padding:'2px 10px',borderRadius:'12px'}}>{lead.stageLabel}</span></div>
      {lead.owner && <div className="pur-detail-row"><span>Owner</span><strong>{lead.owner}</strong></div>}
      {lead.email && <div className="pur-detail-row"><span>Email</span><span>{lead.email}</span></div>}
      {lead.phone && <div className="pur-detail-row"><span>Phone</span><span>{lead.phone}</span></div>}
      {lead.quote_number && <div className="pur-detail-row"><span>Quotation</span><strong style={{color:'#2563eb'}}>{lead.quote_number}</strong></div>}
      {lead.rfq_number && <div className="pur-detail-row"><span>RFQ</span><strong style={{color:'#2563eb'}}>{lead.rfq_number}</strong></div>}
      {lead.customer_reference && <div className="pur-detail-row"><span>Customer RFQ Ref</span><strong style={{color:'#2563eb'}}>{lead.customer_reference}</strong></div>}

      {linkedRfqs.length > 0 && (
        <div style={{margin:'12px 0'}}>
          <div style={{fontSize:'12.5px',fontWeight:600,color:'#374151',marginBottom:'8px'}}>
            RFQs Raised for this Lead ({linkedRfqs.length})
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
            {linkedRfqs.map(r => (
              <div key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#f9fafb',border:'1px solid #f3f4f6',borderRadius:'8px',padding:'8px 10px'}}>
                <span style={{fontSize:'12.5px',fontWeight:600,color:'#2563eb'}}>{r.rfq_number}</span>
                <span style={{fontSize:'11.5px',color:'#6b7280',textTransform:'capitalize'}}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{margin:'16px 0 8px',fontSize:'12.5px',fontWeight:600,color:'#374151'}}>Activity</div>
      <ActivityTimeline entityType="crm_lead" entityId={lead.id} />

      <div style={{margin:'16px 0 12px'}}>
        <div style={{fontSize:'12.5px',fontWeight:600,color:'#374151',marginBottom:'10px'}}>Move to Stage</div>
        <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
          {stageKeys.map(sk => {
            const isCurrent = sk === lead.stage;
            const cfg = STAGE_CONFIG[sk];
            return (
              <button key={sk}
                style={{padding:'5px 12px',borderRadius:'8px',border:`1px solid ${isCurrent ? '#7c3aed' : '#e5e7eb'}`,background:isCurrent ? '#f5f3ff' : '#fff',color:isCurrent ? '#7c3aed' : '#374151',fontSize:'12.5px',fontWeight:isCurrent ? 700 : 400,cursor:isCurrent ? 'default' : 'pointer'}}
                onClick={() => { if (!isCurrent) { onMove(lead, sk); onClose(); } }}>
                {STAGE_LABEL[sk]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pur-modal-actions" style={{marginTop:'16px'}}>
        <button className="pur-btn-cancel" onClick={onClose}>Close</button>
        <button className="pur-btn-secondary" onClick={() => { onLog(); onClose(); }}>Log Call</button>
        <button className="pur-btn-primary" onClick={() => { onMove(lead, 'closed_won'); onClose(); }}>Mark Won</button>
      </div>
    </Modal>
  );
}


/* === KPI drill-down drawer (static breakdown — decorative) === */

const KPI_DETAILS = {
  leads:      { title: 'Leads by Source', rows: [{label:'Website',value:'—',color:'#3b82f6'},{label:'Referral',value:'—',color:'#16a34a'},{label:'Cold Outreach',value:'—',color:'#f59e0b'},{label:'Other',value:'—',color:'#9ca3af'}], note: 'Based on live pipeline data.' },
  conversion: { title: 'Conversion by Stage', rows: [{label:'Lead → Qualified',value:'—',color:'#10b981'},{label:'Qualified → Proposal',value:'—',color:'#f59e0b'},{label:'Proposal → Won',value:'—',color:'#16a34a'}], note: 'Calculated from pipeline movements.' },
  pipeline:   { title: 'Active Pipeline', rows: [{label:'New Leads',value:'—',color:'#2563eb'},{label:'Qualified',value:'—',color:'#16a34a'},{label:'Proposal',value:'—',color:'#7c3aed'}], note: 'Sum of deal values per stage.' },
  customers:  { title: 'Pipeline Breakdown', rows: [{label:'Won',value:'—',color:'#6366f1'},{label:'Active',value:'—',color:'#3b82f6'},{label:'New',value:'—',color:'#a78bfa'}], note: 'Based on current stage distribution.' },
};

/**
 * @param {object}   props
 * @param {string}   props.type    - KPI key: leads | conversion | pipeline | customers.
 * @param {Function} props.onClose - Close the drawer.
 */
function KpiDrawer({ type, onClose }) {
  const d = KPI_DETAILS[type];
  if (!d) return null;
  return (
    <div className="kpi-drawer" onClick={e => e.stopPropagation()}>
      <div className="kpi-drawer-header">
        <span className="kpi-drawer-title">{d.title}</span>
        <button className="kpi-drawer-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      {d.rows.map(r => (
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


/* ═══════════════════════════ MAIN COMPONENT ═══════════════════════════ */

const STAGES = [
  { key: 'new_leads',  label: 'New Leads'  },
  { key: 'qualified',  label: 'Qualified'  },
  { key: 'proposal',   label: 'Proposal'   },
  { key: 'closed_won', label: 'Closed Won' },
];

/**
 * CRM Pipeline page component.
 *
 * @param {object}   props
 * @param {Function} props.goPage - Navigates to another page by key.
 */
export default function CRM({ goPage }) {
  const [modal,        setModal]        = useState(null);   // 'addlead' | 'logcall'
  const [logCallLeadId, setLogCallLeadId] = useState('');
  const [leads,        setLeads]        = useState([]);
  const [kpis,         setKpis]         = useState(null);
  const [currentUser,  setCurrentUser]  = useState(null);
  const [leadDetail,   setLeadDetail]   = useState(null);
  const [openKpi,      setOpenKpi]      = useState(null);
  const [toast,        setToast]        = useState(null);
  const [view,         setView]         = useState('kanban');
  const [loading,      setLoading]      = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);

  // Sidebar panels — kept local (not persisted to API)
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Follow up with first qualified lead', due: 'Today',     done: false, color: '#fffbeb', border: '#fde68a' },
    { id: 2, text: 'Prepare demo for proposal stage',    due: 'This week',  done: false, color: '#eff6ff', border: '#bfdbfe' },
  ]);
  const [notes, setNotes] = useState([
    { id: 1, time: 'Just now', initials: 'SJ', gradient: 'linear-gradient(135deg,#16a34a,#10b981)', text: 'CRM pipeline now connected to live backend data.' },
  ]);
  const [newTask,        setNewTask]        = useState('');
  const [showTaskInput,  setShowTaskInput]  = useState(false);
  const [newNote,        setNewNote]        = useState('');
  const [showNoteInput,  setShowNoteInput]  = useState(false);

  function showToast(msg) { setToast(msg); }

  /* --- Data loading --- */

  const loadAll = useCallback(async () => {
    try {
      const [leadsRes, kpisRes, userRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/crm/leads`,   { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/crm/kpis`,    { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/auth/me`,      { headers: authHeaders() }),
      ]);

      if (leadsRes.ok) {
        const data = await leadsRes.json();
        const enriched = (data.items || []).map(enrichLead);
        setLeads(enriched);
        // Keep selected lead in sync after reload
        setSelectedLead(prev => {
          if (!prev) return enriched[0] || null;
          return enriched.find(l => l.id === prev.id) || enriched[0] || null;
        });
      }
      if (kpisRes.ok) setKpis(await kpisRes.json());
      if (userRes.ok) setCurrentUser(await userRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* --- Lead actions --- */

  function onLeadCreated(newLead) {
    showToast(`${newLead.company} added to pipeline`);
    loadAll();
  }

  async function moveLead(lead, newStageKey) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/crm/leads/${lead.id}/stage`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ stage: newStageKey }),
      });
      if (!res.ok) throw new Error('Stage update failed');
      showToast(`${lead.company} moved to ${STAGE_LABEL[newStageKey]}`);
      loadAll();
    } catch {
      showToast('Failed to update stage — please try again');
    }
  }

  /* --- Task / note helpers (local only) --- */

  function toggleTask(id) { setTasks(p => p.map(t => t.id === id ? {...t, done: !t.done} : t)); }

  function addTask() {
    if (!newTask.trim()) return;
    setTasks(p => [...p, {id: Date.now(), text: newTask, due: 'No due date', done: false, color: '#f9fafb', border: '#e5e7eb'}]);
    setNewTask(''); setShowTaskInput(false);
  }

  function addNote() {
    if (!newNote.trim()) return;
    const initials = currentUser ? currentUser.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'ME';
    setNotes(p => [{id: Date.now(), time: 'Just now', initials, gradient: 'linear-gradient(135deg,#16a34a,#10b981)', text: newNote}, ...p]);
    setNewNote(''); setShowNoteInput(false);
    showToast('Note added');
  }

  /* --- Derived toolbar values --- */

  const userInitials = currentUser
    ? currentUser.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '…';
  const userName = currentUser?.full_name || '…';
  const userRole = currentUser?.role || '';

  /* --- KPI display values --- */

  const kpiCards = [
    {
      key: 'leads', label: 'Total Leads',
      value: kpis ? kpis.total_leads.toString() : '—',
      icon: <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>,
      cls: 'ic-b', chg: kpis ? `${leads.length} active` : null, up: true,
    },
    {
      key: 'conversion', label: 'Conversion Rate',
      value: kpis ? `${kpis.conversion_rate}%` : '—',
      icon: <svg viewBox="0 0 24 24"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>,
      cls: 'ic-g', chg: 'past new_leads stage', up: true,
    },
    {
      key: 'pipeline', label: 'Pipeline Value',
      value: kpis ? fmtValue(kpis.pipeline_value) : '—',
      icon: <svg viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
      cls: 'ic-p', note: 'active opportunities',
    },
    {
      key: 'customers', label: 'Win Rate',
      value: kpis ? `${kpis.win_rate}%` : '—',
      icon: <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
      cls: 'ic-o', chg: 'closed won vs total', up: true,
    },
  ];

  /* --- Render --- */

  return (
    <div id="crm-page">
      {toast     && <Toast msg={toast} onClose={() => setToast(null)} />}
      {modal === 'addlead' && <AddLeadModal onClose={() => setModal(null)} onSave={onLeadCreated} />}
      {modal === 'logcall' && <LogCallModal leads={leads} leadId={logCallLeadId} onClose={() => { setModal(null); setLogCallLeadId(''); }} onSave={showToast} />}
      {leadDetail && (
        <LeadDetailModal
          lead={leadDetail}
          onClose={() => setLeadDetail(null)}
          onMove={moveLead}
          onLog={() => { setLogCallLeadId(leadDetail.id); setModal('logcall'); }}
        />
      )}

      <Sidebar activePage="crm" goPage={goPage} />

      <div className="db-main">
        {/* Toolbar */}
        <div className="tb">
          <div className="tb-title tb-title-block">
            <div>CRM Pipeline</div>
            <div className="tb-subtitle">Manage leads, opportunities, and customer relationships</div>
          </div>
          <div className="tb-right">
            <div className="tb-bell">
              <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
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
              <button className="btn-action btn-blue" onClick={() => setModal('addlead')}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Lead
              </button>
              <button className="btn-action btn-green" onClick={() => setModal('logcall')}>
                <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.27 12 19.79 19.79 0 0 1 1.15 3.18 2 2 0 0 1 3.12 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg>Log Call
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="kpi-row" style={{marginBottom:'20px'}}>
            {kpiCards.map(k => (
              <div key={k.key} className={`kpi kpi-clickable${openKpi === k.key ? ' kpi-active' : ''}`} onClick={() => setOpenKpi(p => p === k.key ? null : k.key)}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-body">
                  <div className="kpi-value">{k.value}</div>
                  <div className={`kpi-icon ${k.cls}`}>{k.icon}</div>
                </div>
                {k.chg
                  ? <div className={`kpi-chg ${k.up ? 'up' : 'dn'}`}><svg viewBox="0 0 24 24">{k.up ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}</svg>{k.chg}</div>
                  : <div style={{fontSize:'13px',fontWeight:500,color:'#7c3aed',marginTop:'6px'}}>{k.note}</div>
                }
                {openKpi === k.key && <KpiDrawer type={k.key} onClose={e => { e.stopPropagation(); setOpenKpi(null); }} />}
              </div>
            ))}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:'18px',alignItems:'start'}}>
            <div>
              {/* Pipeline section */}
              <div className="pur-tab-card" style={{marginBottom:'16px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'18px'}}>
                  <div style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>Sales Pipeline</div>
                  <div style={{display:'flex',gap:'8px'}}>
                    {['kanban','list'].map(v => (
                      <button key={v}
                        style={{height:'32px',padding:'0 12px',background:view===v?'#2563eb':'#fff',color:view===v?'#fff':'#374151',border:view===v?'none':'1px solid #e5e7eb',borderRadius:'7px',fontSize:'12.5px',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:'5px'}}
                        onClick={() => setView(v)}>
                        {v === 'kanban'
                          ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>Kanban</>
                          : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/></svg>List</>
                        }
                      </button>
                    ))}
                  </div>
                </div>

                {loading && (
                  <div style={{textAlign:'center',padding:'40px',color:'#9ca3af',fontSize:'13px'}}>Loading pipeline…</div>
                )}

                {/* Kanban view */}
                {!loading && view === 'kanban' && (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px'}}>
                    {STAGES.map(stage => {
                      const stageLeads = leads.filter(l => l.stage === stage.key);
                      const cfg = STAGE_CONFIG[stage.key];
                      return (
                        <div key={stage.key} style={{background:cfg.bg,borderRadius:'10px',padding:'14px'}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
                            <div style={{fontSize:'13px',fontWeight:600,color:'#374151'}}>{stage.label}</div>
                            <div style={{background:cfg.countBg,color:cfg.countColor,fontSize:'11.5px',fontWeight:700,padding:'2px 7px',borderRadius:'10px'}}>{stageLeads.length}</div>
                          </div>
                          {stageLeads.map(lead => (
                            <div key={lead.id}
                              style={{background:'#fff',borderRadius:'8px',border:'1px solid #e5e7eb',padding:'12px',marginBottom:'8px',cursor:'pointer'}}
                              onClick={() => { setLeadDetail(lead); setSelectedLead(lead); }}>
                              <div style={{fontSize:'13px',fontWeight:600,color:'#111827',marginBottom:'2px'}}>{lead.company}</div>
                              <div style={{fontSize:'12px',color:'#9ca3af',marginBottom:'8px'}}>{lead.type}</div>
                              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                                <span style={{fontSize:'13px',fontWeight:700,color:'#16a34a'}}>{lead.valueDisplay}</span>
                                <div style={{width:'24px',height:'24px',borderRadius:'50%',background:lead.gradient,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:700,color:'#fff'}}>{lead.initials}</div>
                              </div>
                              {lead.quote_number && (
                                <div style={{marginTop:'6px',fontSize:'11px',color:'#2563eb',fontWeight:600}}>📄 {lead.quote_number}</div>
                              )}
                              {lead.customer_reference && (
                                <div style={{marginTop:'2px',fontSize:'11px',color:'#6b7280'}}>Cust. Ref: {lead.customer_reference}</div>
                              )}
                            </div>
                          ))}
                          <button
                            style={{width:'100%',height:'30px',border:'1px dashed #d1d5db',borderRadius:'8px',background:'transparent',color:'#9ca3af',fontSize:'12px',cursor:'pointer',marginTop:'4px'}}
                            onClick={() => setModal('addlead')}>+ Add Lead</button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* List view */}
                {!loading && view === 'list' && (
                  <table className="pur-table">
                    <thead>
                      <tr><th>Company</th><th>Industry</th><th>Stage</th><th className="right">Value</th><th>Owner</th><th className="center">Action</th></tr>
                    </thead>
                    <tbody>
                      {leads.map(l => (
                        <tr key={l.id} className="pur-table-row" onClick={() => { setLeadDetail(l); setSelectedLead(l); }}>
                          <td style={{fontWeight:600,color:'#111827'}}>
                            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                              <div style={{width:'28px',height:'28px',borderRadius:'50%',background:l.gradient,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:700,color:'#fff',flexShrink:0}}>{l.initials}</div>
                              {l.company}
                            </div>
                          </td>
                          <td style={{color:'#6b7280',fontSize:'13px'}}>{l.type}</td>
                          <td><span style={{background:l.stageBg,color:l.stageColor,fontSize:'11.5px',fontWeight:600,padding:'2px 8px',borderRadius:'12px'}}>{l.stageLabel}</span></td>
                          <td className="right" style={{fontWeight:700,color:'#16a34a'}}>{l.valueDisplay}</td>
                          <td style={{color:'#374151',fontSize:'13px'}}>{l.owner || '—'}</td>
                          <td className="center">
                            <button className="pur-link-btn" onClick={e => { e.stopPropagation(); setLeadDetail(l); }}>View</button>
                          </td>
                        </tr>
                      ))}
                      {leads.length === 0 && (
                        <tr><td colSpan={6} style={{textAlign:'center',color:'#9ca3af',padding:'32px',fontSize:'13px'}}>No leads yet — add the first one!</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Activity Timeline (static — illustrative) */}
              <div className="pur-tab-card">
                <div style={{fontSize:'15px',fontWeight:700,color:'#111827',marginBottom:'18px'}}>Activity Timeline</div>
                {[
                  {bg:'#dbeafe',ico:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.27 12 19.79 19.79 0 0 1 1.15 3.18 2 2 0 0 1 3.12 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg>,title:'CRM pipeline connected to live backend',time:'Today',desc:'All leads, KPIs, and stage transitions now read from and write to the database.',by:'SY',byGrad:'linear-gradient(135deg,#2563eb,#1d4ed8)',byName:'by System'},
                  {bg:'#dcfce7',ico:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,title:'KPIs now reflect real data',time:'Today',desc:'Win rate, conversion rate, and pipeline value computed from live database records.',by:'SY',byGrad:'linear-gradient(135deg,#16a34a,#10b981)',byName:'by System'},
                ].map((a,i) => (
                  <div key={i} style={{display:'flex',alignItems:'flex-start',gap:'14px',padding:'12px 0',borderBottom:i<1?'1px solid #f3f4f6':'none'}}>
                    <div style={{width:'36px',height:'36px',borderRadius:'50%',background:a.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{a.ico}</div>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'3px'}}><span style={{fontSize:'13.5px',fontWeight:600,color:'#111827'}}>{a.title}</span><span style={{fontSize:'12px',color:'#9ca3af'}}>{a.time}</span></div>
                      <div style={{fontSize:'13px',color:'#6b7280',marginBottom:'5px'}}>{a.desc}</div>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}><div style={{width:'20px',height:'20px',borderRadius:'50%',background:a.byGrad,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px',fontWeight:700,color:'#fff'}}>{a.by}</div><span style={{fontSize:'12px',color:'#9ca3af'}}>{a.byName}</span></div>
                    </div>
                  </div>
                ))}
                <button
                  style={{width:'100%',height:'34px',border:'1px solid #e5e7eb',borderRadius:'8px',background:'#fff',color:'#374151',fontSize:'13px',fontWeight:500,cursor:'pointer',marginTop:'12px'}}
                  onClick={() => setModal('logcall')}>
                  + Log New Activity
                </button>
              </div>
            </div>

            {/* Right sidebar */}
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>

              {/* Customer 360 Profile */}
              <div className="pur-tab-card" style={{position:'relative'}}>
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'16px'}}>Customer 360 Profile</div>
                {selectedLead ? (
                  <>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:'16px',paddingBottom:'16px',borderBottom:'1px solid #f3f4f6'}}>
                      <div style={{width:'56px',height:'56px',borderRadius:'50%',background:selectedLead.gradient,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:700,color:'#fff',marginBottom:'8px'}}>{selectedLead.initials}</div>
                      <div style={{fontSize:'14px',fontWeight:700,color:'#111827'}}>{selectedLead.company}</div>
                      <div style={{fontSize:'12px',color:'#9ca3af',marginTop:'2px'}}>{selectedLead.type}</div>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><span style={{fontSize:'13px',color:'#6b7280'}}>Deal Value</span><span style={{fontSize:'13px',fontWeight:700,color:'#111827'}}>{selectedLead.valueDisplay}</span></div>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><span style={{fontSize:'13px',color:'#6b7280'}}>Stage</span><span style={{fontSize:'12px',fontWeight:600,background:selectedLead.stageBg,color:selectedLead.stageColor,padding:'2px 8px',borderRadius:'10px'}}>{selectedLead.stageLabel}</span></div>
                    {selectedLead.owner && <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><span style={{fontSize:'13px',color:'#6b7280'}}>Owner</span><span style={{fontSize:'13px',color:'#111827'}}>{selectedLead.owner}</span></div>}
                    {selectedLead.quote_number && <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><span style={{fontSize:'13px',color:'#6b7280'}}>Quotation</span><span style={{fontSize:'13px',fontWeight:600,color:'#2563eb'}}>{selectedLead.quote_number}</span></div>}
                    {selectedLead.rfq_number && <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><span style={{fontSize:'13px',color:'#6b7280'}}>RFQ</span><span style={{fontSize:'13px',fontWeight:600,color:'#2563eb'}}>{selectedLead.rfq_number}</span></div>}
                    {selectedLead.customer_reference && <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><span style={{fontSize:'13px',color:'#6b7280'}}>Customer RFQ Ref</span><span style={{fontSize:'13px',fontWeight:600,color:'#2563eb'}}>{selectedLead.customer_reference}</span></div>}
                    <div style={{paddingTop:'14px',borderTop:'1px solid #f3f4f6'}}>
                      <div style={{fontSize:'13.5px',fontWeight:600,color:'#111827',marginBottom:'10px'}}>Contact Info</div>
                      {selectedLead.email && (
                        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'7px'}}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                          <span style={{fontSize:'13px',color:'#374151'}}>{selectedLead.email}</span>
                        </div>
                      )}
                      {selectedLead.phone && (
                        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.27 12 19.79 19.79 0 0 1 1.15 3.18 2 2 0 0 1 3.12 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg>
                          <span style={{fontSize:'13px',color:'#374151'}}>{selectedLead.phone}</span>
                        </div>
                      )}
                      <div style={{display:'flex',gap:'8px'}}>
                        <button className="pur-btn-primary"    style={{flex:1,height:'32px',fontSize:'12.5px'}} onClick={() => { setLogCallLeadId(selectedLead.id); setModal('logcall'); }}>Log Call</button>
                        <button className="pur-btn-secondary"  style={{flex:1,height:'32px',fontSize:'12.5px'}} onClick={() => showToast('Email composer coming soon')}>Send Email</button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{color:'#9ca3af',fontSize:'13px',textAlign:'center',padding:'20px 0'}}>Click a lead card to see its profile</div>
                )}
              </div>

              {/* Quick Tasks */}
              <div className="pur-tab-card">
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'14px'}}>Quick Tasks</div>
                {tasks.map(t => (
                  <div key={t.id} style={{padding:'11px 12px',borderRadius:'9px',background:t.done?'#f9fafb':t.color||'#f9fafb',border:`1px solid ${t.done?'#e5e7eb':t.border||'#e5e7eb'}`,marginBottom:'8px',display:'flex',alignItems:'flex-start',gap:'10px',opacity:t.done?0.6:1}}>
                    <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} style={{marginTop:'2px',accentColor:'#7c3aed'}} />
                    <div>
                      <div style={{fontSize:'13px',fontWeight:600,color:'#111827',textDecoration:t.done?'line-through':'none'}}>{t.text}</div>
                      <div style={{fontSize:'12px',color:'#9ca3af',marginTop:'1px'}}>{t.due}</div>
                    </div>
                  </div>
                ))}
                {showTaskInput ? (
                  <div style={{display:'flex',gap:'6px',marginBottom:'8px'}}>
                    <input style={{flex:1,height:'34px',border:'1px solid #e5e7eb',borderRadius:'8px',padding:'0 10px',fontSize:'13px',outline:'none'}} placeholder="Task description…" value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} autoFocus />
                    <button className="pur-btn-primary" style={{height:'34px',padding:'0 12px',fontSize:'12.5px'}} onClick={addTask}>Add</button>
                  </div>
                ) : (
                  <button style={{width:'100%',height:'34px',background:'#fff',color:'#374151',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'13px',fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}} onClick={() => setShowTaskInput(true)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Task
                  </button>
                )}
              </div>

              {/* Recent Notes */}
              <div className="pur-tab-card">
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'14px'}}>Recent Notes</div>
                {notes.map((n, i) => (
                  <div key={n.id} style={{marginBottom:'14px',paddingBottom:'14px',borderBottom:i < notes.length-1 ? '1px solid #f3f4f6' : 'none'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px'}}>
                      <span style={{fontSize:'12px',color:'#9ca3af'}}>{n.time}</span>
                      <div style={{width:'22px',height:'22px',borderRadius:'50%',background:n.gradient,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px',fontWeight:700,color:'#fff'}}>{n.initials}</div>
                    </div>
                    <div style={{fontSize:'13px',color:'#374151',lineHeight:1.5}}>{n.text}</div>
                  </div>
                ))}
                {showNoteInput ? (
                  <div>
                    <textarea style={{width:'100%',minHeight:'80px',border:'1px solid #e5e7eb',borderRadius:'8px',padding:'10px',fontSize:'13px',outline:'none',resize:'vertical',marginBottom:'8px'}} placeholder="Add a note…" value={newNote} onChange={e => setNewNote(e.target.value)} autoFocus />
                    <div style={{display:'flex',gap:'6px'}}>
                      <button className="pur-btn-cancel"  style={{height:'32px',flex:1,fontSize:'12.5px'}} onClick={() => setShowNoteInput(false)}>Cancel</button>
                      <button className="pur-btn-primary" style={{height:'32px',flex:1,fontSize:'12.5px'}} onClick={addNote}>Save Note</button>
                    </div>
                  </div>
                ) : (
                  <button style={{width:'100%',height:'34px',background:'#fff',color:'#374151',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'13px',fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}} onClick={() => setShowNoteInput(true)}>
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
