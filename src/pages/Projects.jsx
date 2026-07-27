/**
 * src/pages/Projects.jsx
 * Connected to /api/v1/projects/ — real CRUD for projects, tasks, milestones, time logs.
 */

import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config.js';
import Sidebar from '../components/layout/Sidebar';
import Modal  from '../components/ui/Modal';
import Toast  from '../components/ui/Toast';
import { AnalysisBarLineChart, AnalysisPieChart } from '../components/reports/AnalysisCharts';

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` };
}

const STATUS_COLORS = {
  planning:  { bg: '#f5f3ff', color: '#7c3aed', label: 'Planning' },
  active:    { bg: '#dcfce7', color: '#15803d', label: 'Active' },
  at_risk:   { bg: '#ffedd5', color: '#ea580c', label: 'At Risk' },
  completed: { bg: '#dbeafe', color: '#1d4ed8', label: 'Completed' },
};

const PRIORITY_COLORS = { low: '#16a34a', medium: '#d97706', high: '#dc2626' };

function fmt(n) { return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fmtH(h) { return `${Number(h || 0).toFixed(1)}h`; }

/* ── New Project Modal ── */
function NewProjectModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', client: '', status: 'planning', budget: '', start_date: '', end_date: '', description: '', billable: false });
  // Odoo-style "create tasks by email" alias — no inbound email infrastructure
  // exists for this yet, so it's visual-only and not sent to the backend.
  const [emailAlias, setEmailAlias] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function save() {
    if (!form.name.trim()) { setError('Project name is required.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/projects`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          name: form.name, client: form.client || undefined,
          status: form.status, budget: parseFloat(form.budget) || 0,
          start_date: form.start_date || undefined, end_date: form.end_date || undefined,
          description: form.description || undefined,
          billable: form.billable,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed');
      onSaved(await res.json());
      onClose();
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="New Project" onClose={onClose}>
      {error && <div style={{background:'#fef2f2',color:'#dc2626',padding:'10px 14px',borderRadius:'8px',marginBottom:'14px',fontSize:'13px'}}>{error}</div>}
      <div style={{display:'grid',gap:'12px'}}>
        <div><label style={{fontSize:'12px',fontWeight:600,color:'#374151',display:'block',marginBottom:'4px'}}>Project Name *</label>
          <input style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box'}} placeholder="e.g. Website Redesign" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>

        <label style={{display:'flex',alignItems:'flex-start',gap:'10px',cursor:'pointer'}}>
          <input type="checkbox" checked={form.billable} onChange={e=>setForm(f=>({...f,billable:e.target.checked}))} style={{marginTop:'2px',width:'15px',height:'15px',accentColor:'#2563eb',cursor:'pointer'}} />
          <span>
            <div style={{fontSize:'13px',fontWeight:600,color:'#111827'}}>Billable</div>
            <div style={{fontSize:'12px',color:'#9ca3af'}}>Invoice your time and material to customers</div>
          </span>
        </label>

        <div>
          <label style={{fontSize:'12px',fontWeight:600,color:'#374151',display:'flex',alignItems:'center',gap:'4px',marginBottom:'4px'}}>
            Create tasks by email
            <span title="Not connected to an email inbox yet — visual only." style={{fontSize:'11px',color:'#9ca3af',fontWeight:400,cursor:'help'}}>?</span>
          </label>
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
            <input style={{flex:1,padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box'}} placeholder="e.g. office-party" value={emailAlias} onChange={e=>setEmailAlias(e.target.value)} />
            <span style={{fontSize:'12.5px',color:'#9ca3af',whiteSpace:'nowrap'}}>@ kytos.app</span>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
          <div><label style={{fontSize:'12px',fontWeight:600,color:'#374151',display:'block',marginBottom:'4px'}}>Client</label>
            <input style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box'}} placeholder="Client name" value={form.client} onChange={e=>setForm(f=>({...f,client:e.target.value}))} /></div>
          <div><label style={{fontSize:'12px',fontWeight:600,color:'#374151',display:'block',marginBottom:'4px'}}>Status</label>
            <select style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box'}} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
              <option value="planning">Planning</option><option value="active">Active</option><option value="at_risk">At Risk</option><option value="completed">Completed</option>
            </select></div>
        </div>
        <div><label style={{fontSize:'12px',fontWeight:600,color:'#374151',display:'block',marginBottom:'4px'}}>Budget (SAR)</label>
          <input type="number" style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box'}} placeholder="0" value={form.budget} onChange={e=>setForm(f=>({...f,budget:e.target.value}))} /></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
          <div><label style={{fontSize:'12px',fontWeight:600,color:'#374151',display:'block',marginBottom:'4px'}}>Start Date</label>
            <input type="date" style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box'}} value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))} /></div>
          <div><label style={{fontSize:'12px',fontWeight:600,color:'#374151',display:'block',marginBottom:'4px'}}>End Date</label>
            <input type="date" style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box'}} value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))} /></div>
        </div>
        <div><label style={{fontSize:'12px',fontWeight:600,color:'#374151',display:'block',marginBottom:'4px'}}>Description</label>
          <textarea rows={3} style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box',resize:'vertical'}} placeholder="Brief description…" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} /></div>
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:'8px',marginTop:'16px'}}>
        <button onClick={onClose} style={{padding:'8px 16px',border:'1px solid #d1d5db',borderRadius:'8px',background:'#fff',cursor:'pointer',fontSize:'13px'}}>Cancel</button>
        <button onClick={save} disabled={saving} style={{padding:'8px 20px',background:'#2563eb',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
          {saving ? 'Creating…' : 'Create Project'}
        </button>
      </div>
    </Modal>
  );
}

/* ── Add Task Modal ── */
function AddTaskModal({ projects, onClose, onSaved }) {
  const [form, setForm] = useState({ project_id: projects[0]?.id || '', title: '', priority: 'medium', assignee: '', due_date: '', status: 'todo' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function save() {
    if (!form.project_id) { setError('Select a project.'); return; }
    if (!form.title.trim()) { setError('Task title is required.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/projects/${form.project_id}/tasks`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ title: form.title, priority: form.priority, assignee: form.assignee || undefined, due_date: form.due_date || undefined, status: form.status }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed');
      onSaved(await res.json());
      onClose();
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Add Task" onClose={onClose}>
      {error && <div style={{background:'#fef2f2',color:'#dc2626',padding:'10px 14px',borderRadius:'8px',marginBottom:'14px',fontSize:'13px'}}>{error}</div>}
      <div style={{display:'grid',gap:'12px'}}>
        <div><label style={{fontSize:'12px',fontWeight:600,color:'#374151',display:'block',marginBottom:'4px'}}>Project *</label>
          <select style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box'}} value={form.project_id} onChange={e=>setForm(f=>({...f,project_id:e.target.value}))}>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
        <div><label style={{fontSize:'12px',fontWeight:600,color:'#374151',display:'block',marginBottom:'4px'}}>Task Title *</label>
          <input style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box'}} placeholder="e.g. Design homepage mockup" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} /></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
          <div><label style={{fontSize:'12px',fontWeight:600,color:'#374151',display:'block',marginBottom:'4px'}}>Priority</label>
            <select style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box'}} value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select></div>
          <div><label style={{fontSize:'12px',fontWeight:600,color:'#374151',display:'block',marginBottom:'4px'}}>Status</label>
            <select style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box'}} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
              <option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="done">Done</option>
            </select></div>
        </div>
        <div><label style={{fontSize:'12px',fontWeight:600,color:'#374151',display:'block',marginBottom:'4px'}}>Assignee</label>
          <input style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box'}} placeholder="Name or initials" value={form.assignee} onChange={e=>setForm(f=>({...f,assignee:e.target.value}))} /></div>
        <div><label style={{fontSize:'12px',fontWeight:600,color:'#374151',display:'block',marginBottom:'4px'}}>Due Date</label>
          <input type="date" style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box'}} value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} /></div>
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:'8px',marginTop:'16px'}}>
        <button onClick={onClose} style={{padding:'8px 16px',border:'1px solid #d1d5db',borderRadius:'8px',background:'#fff',cursor:'pointer',fontSize:'13px'}}>Cancel</button>
        <button onClick={save} disabled={saving} style={{padding:'8px 20px',background:'#16a34a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
          {saving ? 'Adding…' : 'Add Task'}
        </button>
      </div>
    </Modal>
  );
}

/* ── Log Time Modal ── */
function LogTimeModal({ projects, onClose, onSaved }) {
  const [form, setForm] = useState({ project_id: projects[0]?.id || '', hours: '', date: new Date().toISOString().slice(0,10), description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function save() {
    if (!form.project_id) { setError('Select a project.'); return; }
    if (!form.hours || parseFloat(form.hours) <= 0) { setError('Enter valid hours.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/projects/${form.project_id}/time-logs`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ hours: parseFloat(form.hours), date: form.date, description: form.description || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed');
      onSaved(await res.json());
      onClose();
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Log Time" onClose={onClose}>
      {error && <div style={{background:'#fef2f2',color:'#dc2626',padding:'10px 14px',borderRadius:'8px',marginBottom:'14px',fontSize:'13px'}}>{error}</div>}
      <div style={{display:'grid',gap:'12px'}}>
        <div><label style={{fontSize:'12px',fontWeight:600,color:'#374151',display:'block',marginBottom:'4px'}}>Project *</label>
          <select style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box'}} value={form.project_id} onChange={e=>setForm(f=>({...f,project_id:e.target.value}))}>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
          <div><label style={{fontSize:'12px',fontWeight:600,color:'#374151',display:'block',marginBottom:'4px'}}>Hours *</label>
            <input type="number" step="0.5" min="0.5" style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box'}} placeholder="e.g. 2.5" value={form.hours} onChange={e=>setForm(f=>({...f,hours:e.target.value}))} /></div>
          <div><label style={{fontSize:'12px',fontWeight:600,color:'#374151',display:'block',marginBottom:'4px'}}>Date</label>
            <input type="date" style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box'}} value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
        </div>
        <div><label style={{fontSize:'12px',fontWeight:600,color:'#374151',display:'block',marginBottom:'4px'}}>Description</label>
          <input style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box'}} placeholder="What did you work on?" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} /></div>
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:'8px',marginTop:'16px'}}>
        <button onClick={onClose} style={{padding:'8px 16px',border:'1px solid #d1d5db',borderRadius:'8px',background:'#fff',cursor:'pointer',fontSize:'13px'}}>Cancel</button>
        <button onClick={save} disabled={saving} style={{padding:'8px 20px',background:'#7c3aed',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
          {saving ? 'Logging…' : 'Log Time'}
        </button>
      </div>
    </Modal>
  );
}

/* ── Project Detail / Task Board ── */
const DEFAULT_STAGES = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
];

function loadStages(projectId) {
  try {
    const raw = localStorage.getItem(`kytos_project_stages_${projectId}`);
    if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed) && parsed.length) return parsed; }
  } catch { /* ignore malformed local data */ }
  return DEFAULT_STAGES;
}

function ProjectDetailPage({ project, onBack, onUpdated, showToast }) {
  const [tab, setTab]         = useState('tasks'); // tasks | milestones | time
  const [newMs, setNewMs]     = useState('');
  const [msDue, setMsDue]     = useState('');
  const [savingMs, setSavingMs] = useState(false);
  const [openOnlyFilter, setOpenOnlyFilter] = useState(true);
  const [taskSearch, setTaskSearch] = useState('');
  const [addingCol, setAddingCol] = useState(null); // stage key | null
  const [quickTitle, setQuickTitle] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const [stages, setStages] = useState(() => loadStages(project.id));
  const [addingStage, setAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [editingStageKey, setEditingStageKey] = useState(null);

  function saveStages(next) {
    setStages(next);
    localStorage.setItem(`kytos_project_stages_${project.id}`, JSON.stringify(next));
  }

  function addStage() {
    if (!newStageName.trim()) { setAddingStage(false); return; }
    const key = `stage_${Date.now()}`;
    saveStages([...stages, { key, label: newStageName.trim() }]);
    setNewStageName('');
    setAddingStage(false);
  }

  function renameStage(key, label) {
    saveStages(stages.map(s => s.key === key ? { ...s, label } : s));
  }

  function removeStage(key) {
    if (project.tasks.some(t => t.status === key)) { showToast?.('Move or delete tasks in this stage first'); return; }
    saveStages(stages.filter(s => s.key !== key));
  }

  async function moveTask(taskId, newStatus) {
    const res = await fetch(`${API_BASE}/api/v1/projects/tasks/${taskId}/status`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) onUpdated();
  }

  async function deleteTask(taskId) {
    await fetch(`${API_BASE}/api/v1/projects/tasks/${taskId}`, { method: 'DELETE', headers: authHeaders() });
    onUpdated();
  }

  async function quickAddTask(status) {
    if (!quickTitle.trim()) { setAddingCol(null); return; }
    setQuickSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/projects/${project.id}/tasks`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ title: quickTitle, priority: 'medium', status }),
      });
      if (res.ok) { setQuickTitle(''); onUpdated(); showToast?.('Task added'); }
    } finally { setQuickSaving(false); setAddingCol(status); }
  }

  async function addMilestone() {
    if (!newMs.trim()) return;
    setSavingMs(true);
    const res = await fetch(`${API_BASE}/api/v1/projects/${project.id}/milestones`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ title: newMs, due_date: msDue || undefined }),
    });
    if (res.ok) { setNewMs(''); setMsDue(''); onUpdated(); }
    setSavingMs(false);
  }

  async function toggleMilestone(msId) {
    await fetch(`${API_BASE}/api/v1/projects/milestones/${msId}/toggle`, { method: 'POST', headers: authHeaders() });
    onUpdated();
  }

  const lastStageKey = stages[stages.length - 1]?.key;
  const allTasks     = project.tasks.filter(t => taskSearch === '' || t.title.toLowerCase().includes(taskSearch.toLowerCase()));
  const visibleTasks = openOnlyFilter ? allTasks.filter(t => t.status !== lastStageKey) : allTasks;
  const tasksByStage = stages.reduce((acc, s) => { acc[s.key] = visibleTasks.filter(t => t.status === s.key); return acc; }, {});
  const sc          = STATUS_COLORS[project.status] || STATUS_COLORS.planning;

  function TaskCard({ task, prevStatus, nextStatus, prevLabel, nextLabel }) {
    return (
      <div className="prd-card" style={{ borderLeftColor: PRIORITY_COLORS[task.priority] || '#e5e7eb', cursor: 'default' }}>
        <div className="prd-card-title" style={{ marginBottom: '6px' }}>{task.title}</div>
        {task.assignee && <div className="rfq-buyer-avatar" style={{ marginRight: '6px' }}>{task.assignee[0]?.toUpperCase()}</div>}
        {task.assignee && <span style={{fontSize:'12px',color:'#6b7280'}}>{task.assignee}</span>}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:'10px'}}>
          <span style={{fontSize:'11px',fontWeight:700,color:PRIORITY_COLORS[task.priority]}}>{task.priority?.toUpperCase()}</span>
          <div style={{display:'flex',gap:'4px'}}>
            {prevStatus && <button onClick={()=>moveTask(task.id,prevStatus)} style={{fontSize:'10px',padding:'2px 6px',background:'#f3f4f6',border:'1px solid #d1d5db',borderRadius:'5px',cursor:'pointer'}}>← {prevLabel}</button>}
            {nextStatus && <button onClick={()=>moveTask(task.id,nextStatus)} style={{fontSize:'10px',padding:'2px 6px',background:'#ecfef6',border:'1px solid #bbf7d0',borderRadius:'5px',cursor:'pointer',color:'#074E3B'}}>{nextLabel} →</button>}
            <button onClick={()=>deleteTask(task.id)} style={{fontSize:'10px',padding:'2px 6px',background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:'5px',cursor:'pointer',color:'#dc2626'}}>✕</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="nrfq-page">
      <div className="nrfq-actionbar">
        <button className="nrfq-btn-ghost" onClick={onBack}>← Back to Projects</button>
      </div>
      <div className="nrfq-breadcrumb"><span className="nrfq-crumb-link" onClick={onBack}>Projects</span> <span>/</span> {project.name}</div>

      {/* Header info */}
      <div className="rfq-odoo-card" style={{ padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{display:'flex',gap:'16px',alignItems:'center',marginBottom:'12px',flexWrap:'wrap'}}>
          <span style={{fontSize:'17px',fontWeight:700,color:'#111827'}}>{project.name}</span>
          <span style={{background:sc.bg,color:sc.color,fontSize:'12px',fontWeight:600,padding:'3px 10px',borderRadius:'12px'}}>{sc.label}</span>
          {project.billable && <span style={{background:'#ecfef6',color:'#074E3B',fontSize:'12px',fontWeight:600,padding:'3px 10px',borderRadius:'12px'}}>Billable</span>}
          {project.client && <span style={{fontSize:'13px',color:'#6b7280'}}>Client: <strong>{project.client}</strong></span>}
          <span style={{fontSize:'13px',color:'#6b7280'}}>Progress: <strong>{project.progress}%</strong></span>
          <span style={{fontSize:'13px',color:'#6b7280'}}>Hours: <strong>{fmtH(project.total_hours)}</strong></span>
          <span style={{fontSize:'13px',color:'#6b7280'}}>Budget: <strong>SAR {fmt(project.budget_spent)} / {fmt(project.budget)}</strong></span>
        </div>
        <div style={{height:'6px',background:'#f3f4f6',borderRadius:'3px'}}>
          <div style={{height:'100%',width:`${project.progress}%`,background: project.status==='at_risk'?'#f59e0b':project.status==='completed'?'#2563eb':'#16a34a',borderRadius:'3px',transition:'width .3s'}}/>
        </div>
      </div>

      <div className="rfq-odoo-card">
        <div className="rfq-toolbar">
          <div className="rfq-toolbar-btns">
            <button className="btn-action btn-blue" onClick={() => { setTab('tasks'); setAddingCol(stages[0]?.key); setQuickTitle(''); }}>
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New
            </button>
          </div>
          {tab === 'tasks' && (
            <div className="rfq-toolbar-search">
              {openOnlyFilter && (
                <span className="vnd-filter-chip">
                  Open
                  <button onClick={() => setOpenOnlyFilter(false)}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </span>
              )}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Search…" value={taskSearch} onChange={e => setTaskSearch(e.target.value)} />
            </div>
          )}
          <div className="rfq-view-icons" style={{ marginLeft: 'auto' }}>
            {[['tasks','Task Board'],['milestones','Milestones'],['time','Time Logs']].map(([k,label])=>(
              <button key={k} className={tab===k ? 'active' : ''} onClick={()=>setTab(k)} title={label} style={{ width: 'auto', padding: '0 12px', fontSize: '12.5px', fontWeight: 600 }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Task Board */}
        {tab==='tasks' && (() => {
          const STAGE_COLORS = [
            { color: '#374151', bg: '#e5e7eb' },
            { color: '#1d4ed8', bg: '#dbeafe' },
            { color: '#a16207', bg: '#fef9c3' },
            { color: '#15803d', bg: '#dcfce7' },
            { color: '#7c3aed', bg: '#ede9fe' },
          ];

          function ColHeader({ stage, idx }) {
            const sc2 = STAGE_COLORS[idx % STAGE_COLORS.length];
            const isEditing = editingStageKey === stage.key;
            return (
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px',gap:'6px'}}>
                {isEditing ? (
                  <input
                    autoFocus
                    defaultValue={stage.label}
                    onBlur={e => { renameStage(stage.key, e.target.value.trim() || stage.label); setEditingStageKey(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingStageKey(null); }}
                    style={{fontSize:'12.5px',fontWeight:700,border:'1px solid #d1d5db',borderRadius:'5px',padding:'2px 6px',width:'110px'}}
                  />
                ) : (
                  <div style={{fontSize:'12.5px',fontWeight:700,color:sc2.color,cursor:'pointer'}} onClick={() => setEditingStageKey(stage.key)} title="Click to rename stage">
                    {stage.label} <span style={{background:sc2.bg,borderRadius:'10px',padding:'1px 7px',fontWeight:700,fontSize:'11px'}}>{tasksByStage[stage.key]?.length || 0}</span>
                  </div>
                )}
                <div style={{display:'flex',gap:'4px',flexShrink:0}}>
                  <button onClick={() => { setAddingCol(stage.key); setQuickTitle(''); }} title={`Add task to ${stage.label}`} style={{width:'20px',height:'20px',border:'none',background:'#f3f4f6',borderRadius:'5px',cursor:'pointer',fontSize:'13px',lineHeight:1,color:'#374151'}}>+</button>
                  {stages.length > 1 && (
                    <button onClick={() => removeStage(stage.key)} title="Remove stage" style={{width:'20px',height:'20px',border:'none',background:'#f3f4f6',borderRadius:'5px',cursor:'pointer',fontSize:'11px',lineHeight:1,color:'#9ca3af'}}>✕</button>
                  )}
                </div>
              </div>
            );
          }
          function QuickAddRow({ stageKey }) {
            if (addingCol !== stageKey) return null;
            return (
              <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:'8px',padding:'10px',marginBottom:'8px'}}>
                <input
                  autoFocus
                  style={{width:'100%',border:'none',borderBottom:'1px solid #e5e7eb',padding:'4px 0',fontSize:'13px',outline:'none',marginBottom:'8px',boxSizing:'border-box'}}
                  placeholder="e.g. Send Invitations"
                  value={quickTitle}
                  onChange={e => setQuickTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') quickAddTask(stageKey); if (e.key === 'Escape') setAddingCol(null); }}
                />
                <div style={{display:'flex',gap:'8px'}}>
                  <button onClick={() => quickAddTask(stageKey)} disabled={quickSaving || !quickTitle.trim()} className="nrfq-btn-primary" style={{padding:'5px 14px',fontSize:'12.5px'}}>Add</button>
                  <button onClick={() => setAddingCol(null)} className="nrfq-btn-ghost" style={{padding:'5px 14px',fontSize:'12.5px'}}>Discard</button>
                </div>
              </div>
            );
          }
          return (
          <div className="prd-kanban" style={{ gridTemplateColumns: `repeat(${stages.length}, 1fr) 170px`, alignItems: 'start' }}>
            {stages.map((stage, idx) => {
              const list = tasksByStage[stage.key] || [];
              const prevStage = stages[idx - 1];
              const nextStage = stages[idx + 1];
              return (
                <div key={stage.key}>
                  <ColHeader stage={stage} idx={idx} />
                  <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                    {list.map(t => (
                      <TaskCard
                        key={t.id} task={t}
                        prevStatus={prevStage?.key} prevLabel={prevStage?.label}
                        nextStatus={nextStage?.key} nextLabel={nextStage?.label}
                      />
                    ))}
                    {!list.length && addingCol !== stage.key && <div style={{fontSize:'12px',color:'#9ca3af',textAlign:'center',padding:'12px 0'}}>No tasks</div>}
                    <QuickAddRow stageKey={stage.key} />
                  </div>
                </div>
              );
            })}
            <div>
              {addingStage ? (
                <div style={{display:'flex',gap:'6px'}}>
                  <input
                    autoFocus
                    placeholder="Stage…"
                    value={newStageName}
                    onChange={e => setNewStageName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addStage(); if (e.key === 'Escape') setAddingStage(false); }}
                    style={{flex:1,padding:'6px 8px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'12.5px',minWidth:0}}
                  />
                  <button onClick={addStage} title="Confirm" style={{width:'26px',height:'26px',border:'none',borderRadius:'6px',background:'#074E3B',color:'#fff',cursor:'pointer',flexShrink:0}}>✓</button>
                  <button onClick={() => { setAddingStage(false); setNewStageName(''); }} title="Cancel" style={{width:'26px',height:'26px',border:'none',borderRadius:'6px',background:'#fee2e2',color:'#b91c1c',cursor:'pointer',flexShrink:0}}>✕</button>
                </div>
              ) : (
                <button onClick={() => setAddingStage(true)} style={{display:'flex',alignItems:'center',gap:'6px',border:'1px dashed #d1d5db',background:'transparent',borderRadius:'8px',padding:'8px 12px',cursor:'pointer',fontSize:'12.5px',color:'#6b7280',width:'100%'}}>
                  <span style={{fontSize:'15px',lineHeight:1}}>+</span> Add Stage
                </button>
              )}
            </div>
          </div>
          );
        })()}

        {/* Milestones */}
        {tab==='milestones' && (
          <div style={{ padding: '16px' }}>
            {project.milestones.map(ms=>(
              <div key={ms.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',background:ms.completed?'#f0fdf4':'#f8fafc',border:'1px solid #e5e7eb',borderRadius:'8px',marginBottom:'8px'}}>
                <input type="checkbox" checked={ms.completed} onChange={()=>toggleMilestone(ms.id)} style={{width:'16px',height:'16px',cursor:'pointer',accentColor:'#16a34a'}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:'13px',fontWeight:600,color: ms.completed?'#6b7280':'#111827',textDecoration:ms.completed?'line-through':'none'}}>{ms.title}</div>
                  {ms.due_date && <div style={{fontSize:'12px',color:'#9ca3af'}}>Due: {ms.due_date}</div>}
                </div>
              </div>
            ))}
            {!project.milestones.length && <div style={{fontSize:'13px',color:'#9ca3af',textAlign:'center',padding:'16px 0'}}>No milestones yet</div>}
            <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
              <input style={{flex:1,padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px'}} placeholder="New milestone…" value={newMs} onChange={e=>setNewMs(e.target.value)}/>
              <input type="date" style={{padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px'}} value={msDue} onChange={e=>setMsDue(e.target.value)}/>
              <button onClick={addMilestone} disabled={savingMs||!newMs.trim()} className="nrfq-btn-primary">Add</button>
            </div>
          </div>
        )}

        {/* Time Logs */}
        {tab==='time' && (
          <div style={{ padding: '16px' }}>
            {project.time_logs?.length ? (
              <table className="rfq-odoo-table">
                <thead><tr>
                  <th>Date</th>
                  <th>Hours</th>
                  <th>By</th>
                  <th>Description</th>
                </tr></thead>
                <tbody>{project.time_logs.map(tl=>(
                  <tr key={tl.id}>
                    <td style={{ color:'#6b7280', fontSize:'13px' }}>{tl.date}</td>
                    <td style={{fontWeight:600,color:'#074E3B'}}>{fmtH(tl.hours)}</td>
                    <td style={{color:'#6b7280'}}>{tl.logged_by||'—'}</td>
                    <td style={{color:'#6b7280'}}>{tl.description||'—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            ) : <div style={{fontSize:'13px',color:'#9ca3af',textAlign:'center',padding:'16px 0'}}>No time logged yet</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════ ROOT COMPONENT ════ */
export default function Projects({ goPage }) {
  const [projects,  setProjects]  = useState([]);
  const [kpis,      setKpis]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState(null);
  const [modal,     setModal]     = useState(null); // 'project' | 'task' | 'time'
  const [detail,    setDetail]    = useState(null);
  const [activeTab, setActiveTab] = useState('projects'); // projects | tasks | reporting
  const [taskSearch, setTaskSearch] = useState('');
  const [reportChartType, setReportChartType] = useState('bar');
  const [reportHover, setReportHover] = useState(null);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, kRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/projects`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/projects/kpis`, { headers: authHeaders() }),
      ]);
      if (pRes.ok) { const d = await pRes.json(); setProjects(d.items || []); }
      if (kRes.ok) setKpis(await kRes.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function onProjectSaved(p) {
    setProjects(prev => [p, ...prev]);
    showToast(`Project "${p.name}" created`);
    load(); // refresh kpis
  }

  function onTaskSaved(updatedProject) {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    if (detail?.id === updatedProject.id) setDetail(updatedProject);
    showToast('Task added');
    load();
  }

  async function openDetail(p) {
    // Fetch fresh copy with all relations
    const res = await fetch(`${API_BASE}/api/v1/projects`, { headers: authHeaders() });
    if (res.ok) {
      const d = await res.json();
      const fresh = (d.items || []).find(x => x.id === p.id);
      setDetail(fresh || p);
    } else setDetail(p);
  }

  async function refreshDetail(p) {
    const res = await fetch(`${API_BASE}/api/v1/projects`, { headers: authHeaders() });
    if (res.ok) {
      const d = await res.json();
      const fresh = (d.items || []).find(x => x.id === p.id);
      setDetail(fresh || p);
      setProjects(d.items || []);
    }
    load();
  }

  const totalHours = projects.reduce((s, p) => s + (p.total_hours || 0), 0);

  return (
    <div id="projects-page">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      {modal === 'project' && <NewProjectModal onClose={() => setModal(null)} onSaved={onProjectSaved} />}
      {modal === 'task'    && <AddTaskModal projects={projects} onClose={() => setModal(null)} onSaved={onTaskSaved} />}
      {modal === 'time'    && <LogTimeModal  projects={projects} onClose={() => setModal(null)} onSaved={p => { onTaskSaved(p); showToast('Time logged'); }} />}

      <Sidebar
        activePage="projects"
        goPage={goPage}
        subNavGroups={[
          {
            key: 'projects', label: 'Projects', children: [
              { label: 'Projects', active: activeTab === 'projects', onClick: () => setActiveTab('projects') },
            ],
          },
          {
            key: 'tasks', label: 'Tasks', children: [
              { label: 'My Tasks',  active: activeTab === 'mytasks', onClick: () => setActiveTab('mytasks') },
              { label: 'All Tasks', active: activeTab === 'tasks',   onClick: () => setActiveTab('tasks') },
            ],
          },
          {
            key: 'reporting', label: 'Reporting', children: [
              { label: 'Projects', active: activeTab === 'reporting',      onClick: () => setActiveTab('reporting') },
              { label: 'Tasks',    active: activeTab === 'reportingTasks', onClick: () => setActiveTab('reportingTasks') },
            ],
          },
          {
            key: 'config', label: 'Configuration', children: [
              { label: 'Settings', onClick: () => showToast('Settings coming soon') },
              { label: 'Tags',     onClick: () => showToast('Tags coming soon') },
            ],
          },
        ]}
      />
      <div className="db-main">
        <div className="tb">
          <div className="tb-title tb-title-block">
            <div>Project Management</div>
            <div className="tb-subtitle">Track projects, milestones, tasks, time, and budget</div>
          </div>
          <div className="tb-right"><div className="tb-bell"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <div className="tb-user"><div className="tb-avatar" style={{background:'linear-gradient(135deg,#16a34a,#10b981)'}}>SJ</div><div><div className="tb-uname">Sarah Johns</div><div className="tb-urole">Administrator</div></div></div></div></div>

        <div className="pg">
          {detail ? (
          <ProjectDetailPage
            project={detail}
            onBack={() => setDetail(null)}
            onUpdated={() => refreshDetail(detail)}
            showToast={showToast}
          />
          ) : (
          <>
          {activeTab === 'projects' && (
          <div className="pg-header">
            <div className="pg-header-left"></div>
            <div className="pg-header-actions">
              <button className="btn-action btn-purple" onClick={() => setModal('time')}><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Log Time</button>
              <button className="btn-action btn-green"  onClick={() => projects.length ? setModal('task') : showToast('Create a project first')}><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Task</button>
              <button className="btn-action btn-blue"   onClick={() => setModal('project')}><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New Project</button>
            </div>
          </div>
          )}

          {/* KPI row — Projects landing tab only */}
          {activeTab === 'projects' && (
          <div className="kpi-row" style={{marginBottom:'20px'}}>
            <div className="kpi"><div className="kpi-label">Active Projects</div><div className="kpi-body"><div className="kpi-value">{kpis?.active_projects ?? '—'}</div><div className="kpi-icon ic-b"><svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div></div><div style={{fontSize:'13px',color:'#6b7280',marginTop:'6px'}}>{kpis?.total_projects ?? 0} total</div></div>
            <div className="kpi"><div className="kpi-label">Total Hours Logged</div><div className="kpi-body"><div className="kpi-value">{kpis ? fmt(kpis.total_hours) : '—'}</div><div className="kpi-icon ic-g"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div></div><div style={{fontSize:'13px',color:'#6b7280',marginTop:'6px'}}>Across all projects</div></div>
            <div className="kpi"><div className="kpi-label">Budget Utilization</div><div className="kpi-body"><div className="kpi-value">{kpis ? `${kpis.budget_utilization_pct}%` : '—'}</div><div className="kpi-icon ic-o"><svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div></div><div style={{fontSize:'13px',color:'#6b7280',marginTop:'6px'}}>Spent vs budget</div></div>
            <div className="kpi"><div className="kpi-label">Team Members</div><div className="kpi-body"><div className="kpi-value">{kpis?.total_team_members ?? '—'}</div><div className="kpi-icon ic-p"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div></div><div style={{fontSize:'13px',color:'#6b7280',marginTop:'6px'}}>Unique assignees</div></div>
          </div>
          )}

          {/* Projects list */}
          {activeTab === 'projects' && (loading ? (
            <div style={{textAlign:'center',padding:'60px 0',color:'#9ca3af',fontSize:'14px'}}>Loading projects…</div>
          ) : projects.length === 0 ? (
            <div style={{textAlign:'center',padding:'60px 0',color:'#9ca3af'}}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom:'12px'}}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              <div style={{fontSize:'14px',fontWeight:600,color:'#6b7280',marginBottom:'8px'}}>No projects yet</div>
              <button onClick={() => setModal('project')} style={{padding:'8px 20px',background:'#2563eb',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Create your first project</button>
            </div>
          ) : (
            <div style={{display:'grid',gap:'14px'}}>
              {projects.map(p => {
                const sc = STATUS_COLORS[p.status] || STATUS_COLORS.planning;
                const todo = p.tasks.filter(t=>t.status==='todo').length;
                const inprog = p.tasks.filter(t=>t.status==='in_progress').length;
                const done = p.tasks.filter(t=>t.status==='done').length;
                return (
                  <div key={p.id} onClick={() => openDetail(p)} style={{background:'#fff',borderRadius:'12px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,.06)',padding:'20px 24px',cursor:'pointer',transition:'box-shadow .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,.1)'}
                    onMouseLeave={e=>e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,.06)'}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                        <div style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>{p.name}</div>
                        <span style={{background:sc.bg,color:sc.color,fontSize:'11px',fontWeight:700,padding:'2px 9px',borderRadius:'10px'}}>{sc.label}</span>
                        {p.billable && <span style={{background:'#ecfef6',color:'#074E3B',fontSize:'11px',fontWeight:700,padding:'2px 9px',borderRadius:'10px'}}>Billable</span>}
                      </div>
                      <div style={{fontSize:'13px',color:'#9ca3af'}}>{p.client || ''}</div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'12px',marginBottom:'12px'}}>
                      <div><div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'2px'}}>Progress</div><div style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>{p.progress}%</div></div>
                      <div><div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'2px'}}>Budget</div><div style={{fontSize:'15px',fontWeight:700,color: p.budget_spent > p.budget && p.budget > 0 ?'#dc2626':'#111827'}}>SAR {fmt(p.budget_spent)}/{fmt(p.budget)}</div></div>
                      <div><div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'2px'}}>Hours</div><div style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>{fmtH(p.total_hours)}</div></div>
                      <div><div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'2px'}}>Tasks</div><div style={{fontSize:'13px',fontWeight:600,color:'#374151'}}><span style={{color:'#6b7280'}}>{todo} todo</span> · <span style={{color:'#2563eb'}}>{inprog} active</span> · <span style={{color:'#16a34a'}}>{done} done</span></div></div>
                      <div><div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'2px'}}>Due</div><div style={{fontSize:'13px',fontWeight:600,color:'#374151'}}>{p.end_date || '—'}</div></div>
                    </div>
                    <div style={{height:'6px',background:'#f3f4f6',borderRadius:'3px'}}>
                      <div style={{height:'100%',width:`${p.progress}%`,background:p.status==='at_risk'?'#f59e0b':p.status==='completed'?'#2563eb':'#16a34a',borderRadius:'3px',transition:'width .3s'}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {activeTab === 'tasks' && (
            <div className="rfq-odoo-card">
              <div className="rfq-toolbar">
                <div className="rfq-breadcrumb">
                  All Tasks
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </div>
                <div className="rfq-toolbar-search">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input type="text" placeholder="Search…" value={taskSearch} onChange={e => setTaskSearch(e.target.value)} />
                </div>
                <div className="rfq-toolbar-btns">
                  <button className="btn-action btn-green" onClick={() => projects.length ? setModal('task') : showToast('Create a project first')}>
                    <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Task
                  </button>
                </div>
              </div>

              {(() => {
                const allTasks = projects.flatMap(p => (p.tasks || []).map(t => ({ ...t, projectName: p.name, project: p })))
                  .filter(t => taskSearch === '' || t.title.toLowerCase().includes(taskSearch.toLowerCase()));
                const TASK_STATUS_META = {
                  todo:        { label: 'To Do',        bg: '#f3f4f6', color: '#374151' },
                  in_progress: { label: 'In Progress',   bg: '#dbeafe', color: '#1d4ed8' },
                  done:        { label: 'Done',          bg: '#dcfce7', color: '#15803d' },
                };
                return (
                  <table className="rfq-odoo-table">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Project</th>
                        <th>Assignee</th>
                        <th className="center">Priority</th>
                        <th>Due Date</th>
                        <th className="center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTasks.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding:'16px', textAlign:'center', color:'#9ca3af', fontSize:'13.5px' }}>No tasks match your search.</td></tr>
                      ) : allTasks.map(t => {
                        const meta = TASK_STATUS_META[t.status] || TASK_STATUS_META.todo;
                        return (
                          <tr key={t.id} className="rfq-odoo-row" onClick={() => openDetail(t.project)}>
                            <td style={{ fontWeight:600, color:'#111827' }}>{t.title}</td>
                            <td style={{ color:'#374151' }}>{t.projectName}</td>
                            <td style={{ color:'#374151' }}>{t.assignee || '—'}</td>
                            <td className="center" style={{ color: PRIORITY_COLORS[t.priority], fontWeight:600, fontSize:'12px' }}>{t.priority?.toUpperCase() || '—'}</td>
                            <td style={{ color:'#6b7280', fontSize:'13px' }}>{t.due_date || '—'}</td>
                            <td className="center"><span style={{ background:meta.bg, color:meta.color, fontSize:'12px', fontWeight:600, padding:'3px 10px', borderRadius:'20px' }}>{meta.label}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          )}

          {activeTab === 'mytasks' && (() => {
            const CURRENT_USER = 'Sarah Johns';
            const myTasks = projects.flatMap(p => (p.tasks || []).map(t => ({ ...t, projectName: p.name, project: p })))
              .filter(t => t.status !== 'done')
              .filter(t => !t.assignee || t.assignee === CURRENT_USER)
              .filter(t => taskSearch === '' || t.title.toLowerCase().includes(taskSearch.toLowerCase()));

            function bucketOf(dueDateStr) {
              if (!dueDateStr) return 'inbox';
              const due = new Date(dueDateStr + 'T00:00:00');
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const diffDays = Math.round((due - today) / 86400000);
              if (diffDays <= 0) return 'today';
              if (diffDays <= 7) return 'week';
              if (diffDays <= 31) return 'month';
              return 'later';
            }

            const BUCKETS = [
              { key: 'inbox', label: 'Inbox',      hint: 'No due date',        accent: '#6b7280' },
              { key: 'today', label: 'Today',      hint: 'Due today or overdue', accent: '#b91c1c' },
              { key: 'week',  label: 'This Week',  hint: 'Next 7 days',        accent: '#a16207' },
              { key: 'month', label: 'This Month', hint: 'Next 31 days',       accent: '#1d4ed8' },
              { key: 'later', label: 'Later',      hint: 'Beyond a month',     accent: '#074E3B' },
            ];
            const grouped = BUCKETS.reduce((acc, b) => { acc[b.key] = myTasks.filter(t => bucketOf(t.due_date) === b.key); return acc; }, {});

            return (
              <div className="rfq-odoo-card">
                <div className="rfq-toolbar">
                  <div className="rfq-breadcrumb">
                    My Tasks
                    <span style={{ fontSize: '12px', fontWeight: 400, color: '#9ca3af', marginLeft: '8px' }}>assigned to you or unassigned</span>
                  </div>
                  <div className="rfq-toolbar-search">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" placeholder="Search…" value={taskSearch} onChange={e => setTaskSearch(e.target.value)} />
                  </div>
                  <div className="rfq-toolbar-btns">
                    <button className="btn-action btn-green" onClick={() => projects.length ? setModal('task') : showToast('Create a project first')}>
                      <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Task
                    </button>
                  </div>
                </div>
                <div className="prd-kanban" style={{ gridTemplateColumns: `repeat(${BUCKETS.length}, 1fr)`, padding: '16px', alignItems: 'start' }}>
                  {BUCKETS.map(b => {
                    const list = grouped[b.key];
                    return (
                      <div key={b.key}>
                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ fontSize: '12.5px', fontWeight: 700, color: b.accent }}>
                            {b.label} <span style={{ background: '#f3f4f6', borderRadius: '10px', padding: '1px 7px', fontWeight: 700, fontSize: '11px', color: '#374151' }}>{list.length}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{b.hint}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {list.map(t => (
                            <div key={t.id} className="prd-card" style={{ borderLeftColor: PRIORITY_COLORS[t.priority] || '#e5e7eb', cursor: 'pointer' }} onClick={() => openDetail(t.project)}>
                              <div className="prd-card-title" style={{ marginBottom: '4px' }}>{t.title}</div>
                              <div style={{ fontSize: '11.5px', color: '#9ca3af', marginBottom: '6px' }}>{t.projectName}</div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: PRIORITY_COLORS[t.priority] }}>{t.priority?.toUpperCase() || ''}</span>
                                {t.due_date && <span style={{ fontSize: '11px', color: '#6b7280' }}>{t.due_date}</span>}
                              </div>
                            </div>
                          ))}
                          {!list.length && <div style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>Nothing here</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {activeTab === 'reporting' && (() => {
            const buckets = projects.map(p => ({ label: p.name, total: p.budget_spent || 0, count: (p.tasks || []).length }));
            const statusSlices = Object.entries(STATUS_COLORS).map(([key, meta]) => ({
              label: meta.label,
              value: projects.filter(p => p.status === key).length,
              color: meta.color,
            }));
            return (
              <div className="rfq-odoo-card">
                <div className="rfq-toolbar">
                  <div className="rfq-breadcrumb">
                    Project Analysis
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </div>
                  <div className="rpt-icon-group" style={{ marginLeft: 'auto' }}>
                    <button className={reportChartType === 'bar' ? 'active' : ''} title="Bar chart" onClick={() => setReportChartType('bar')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg></button>
                    <button className={reportChartType === 'line' ? 'active' : ''} title="Line chart" onClick={() => setReportChartType('line')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 17 9 11 13 15 21 6"/></svg></button>
                    <button className={reportChartType === 'pie' ? 'active' : ''} title="Pie chart" onClick={() => setReportChartType('pie')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg></button>
                  </div>
                </div>
                <div className="rpt-chart-area">
                  {buckets.length === 0 ? (
                    <div className="prd-empty">No projects yet.</div>
                  ) : reportChartType === 'pie' ? (
                    <AnalysisPieChart slices={statusSlices} />
                  ) : (
                    <AnalysisBarLineChart buckets={buckets} measure="total" type={reportChartType} hover={reportHover} setHover={setReportHover} />
                  )}
                </div>
              </div>
            );
          })()}

          {activeTab === 'reportingTasks' && (() => {
            const allTasks = projects.flatMap(p => (p.tasks || []).map(t => ({ ...t, projectName: p.name })));
            const buckets = projects.map(p => ({ label: p.name, total: (p.tasks || []).length, count: (p.tasks || []).length }));
            const TASK_STATUS_META = {
              todo:        { label: 'To Do',        color: '#374151' },
              in_progress: { label: 'In Progress',   color: '#1d4ed8' },
              done:        { label: 'Done',          color: '#15803d' },
            };
            const statusSlices = Object.entries(TASK_STATUS_META).map(([key, meta]) => ({
              label: meta.label,
              value: allTasks.filter(t => t.status === key).length,
              color: meta.color,
            }));
            return (
              <div className="rfq-odoo-card">
                <div className="rfq-toolbar">
                  <div className="rfq-breadcrumb">
                    Tasks Analysis
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '12px' }}>Count of tasks per project</div>
                  <div className="rpt-icon-group" style={{ marginLeft: 'auto' }}>
                    <button className={reportChartType === 'bar' ? 'active' : ''} title="Bar chart" onClick={() => setReportChartType('bar')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg></button>
                    <button className={reportChartType === 'line' ? 'active' : ''} title="Line chart" onClick={() => setReportChartType('line')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 17 9 11 13 15 21 6"/></svg></button>
                    <button className={reportChartType === 'pie' ? 'active' : ''} title="Pie chart — by status" onClick={() => setReportChartType('pie')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg></button>
                  </div>
                </div>
                <div className="rpt-chart-area">
                  {allTasks.length === 0 ? (
                    <div className="prd-empty">No tasks yet.</div>
                  ) : reportChartType === 'pie' ? (
                    <AnalysisPieChart slices={statusSlices} />
                  ) : (
                    <AnalysisBarLineChart buckets={buckets} measure="count" type={reportChartType} hover={reportHover} setHover={setReportHover} />
                  )}
                </div>
              </div>
            );
          })()}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
