import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { API_BASE } from '../config.js';
import '../styles/Expenses.css';
const token = () => localStorage.getItem('token');
const authH = () => ({ Authorization: `Bearer ${token()}` });

const CATEGORIES = ['Hotel', 'Food', 'Fuel', 'Car Rental', 'Travel', 'Meals', 'Supplies', 'Software', 'Other'];
const CAT_COLORS = { Hotel:'#7c3aed', Food:'#16a34a', Fuel:'#ea580c', 'Car Rental':'#2563eb', Travel:'#7c3aed', Meals:'#16a34a', Supplies:'#a78bfa', Software:'#f59e0b', Other:'#6b7280' };

function fmt(n) { return Number(n ?? 0).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtShort(n) {
  if (!n) return 'SAR 0';
  if (n >= 1_000_000) return `SAR ${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `SAR ${(n/1_000).toFixed(0)}K`;
  return `SAR ${fmt(n)}`;
}
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); }

const statusBadge = (s) => {
  const map = { submitted:['#fef9c3','#a16207','Pending'], approved:['#dcfce7','#15803d','Approved'], rejected:['#fee2e2','#dc2626','Rejected'], reimbursed:['#dbeafe','#1d4ed8','Reimbursed'] };
  const [bg, color, label] = map[s] ?? ['#f3f4f6','#6b7280', s];
  return <span style={{ background:bg, color, fontSize:'12px', fontWeight:600, padding:'3px 10px', borderRadius:'12px' }}>{label}</span>;
};

const initials = (name) => (name ?? 'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
const avatarColor = (name) => { const colors = ['linear-gradient(135deg,#7c3aed,#a78bfa)','linear-gradient(135deg,#f59e0b,#ef4444)','linear-gradient(135deg,#16a34a,#10b981)','linear-gradient(135deg,#2563eb,#7c3aed)']; return colors[(name??'').length % colors.length]; };

const EMPTY_FORM = { title:'', category:'Hotel', amount:'', currency:'SAR', expense_date:'', submitted_by_name:'', project_name:'', notes:'' };

export default function Expenses({ goPage }) {
  const [expenses, setExpenses]   = useState([]);
  const [kpis, setKpis]           = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading]     = useState(false);
  const [toast, setToast]         = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: 100 });
      if (statusFilter) p.set('status', statusFilter);
      const r = await fetch(`${API_BASE}/api/v1/expenses?${p}`, { headers: authH() });
      if (r.ok) { const d = await r.json(); setExpenses(d.items); }
    } finally { setLoading(false); }
  }, [statusFilter]);

  const fetchKpis = useCallback(async () => {
    const r = await fetch(`${API_BASE}/api/v1/expenses/kpis`, { headers: authH() });
    if (r.ok) setKpis(await r.json());
  }, []);

  useEffect(() => {
    fetchExpenses(); fetchKpis();
    fetch(`${API_BASE}/api/v1/auth/me`, { headers: authH() })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) setCurrentUser(u); })
      .catch(() => {});
  }, [fetchExpenses, fetchKpis]);

  const submitExpense = async () => {
    if (!form.title.trim() || !form.amount) { showToast('Title and amount are required'); return; }
    setSaving(true);
    try {
      const body = { ...form, amount: Number(form.amount), expense_date: form.expense_date || null };
      const r = await fetch(`${API_BASE}/api/v1/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authH() },
        body: JSON.stringify(body),
      });
      if (r.ok) { showToast('Expense submitted'); setShowModal(false); setForm(EMPTY_FORM); fetchExpenses(); fetchKpis(); }
      else { const e = await r.json().catch(()=>({})); showToast(e.detail ?? 'Failed'); }
    } finally { setSaving(false); }
  };

  const updateStatus = async (id, status, rejection_reason) => {
    const r = await fetch(`${API_BASE}/api/v1/expenses/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authH() },
      body: JSON.stringify({ status, rejection_reason }),
    });
    if (r.ok) { showToast(`Marked as ${status}`); fetchExpenses(); fetchKpis(); }
    else showToast('Action failed');
  };

  const deleteExpense = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    const r = await fetch(`${API_BASE}/api/v1/expenses/${id}`, { method: 'DELETE', headers: authH() });
    if (r.ok || r.status === 204) { showToast('Deleted'); fetchExpenses(); fetchKpis(); }
  };

  // Category breakdown for sidebar
  const catBreakdown = kpis?.category_breakdown ?? [];
  const maxCat = catBreakdown.length > 0 ? catBreakdown[0].total : 1;

  const userInitials = currentUser ? initials(currentUser.full_name) : 'U';

  const inp = { width:'100%', height:36, border:'1px solid #e5e7eb', borderRadius:8, padding:'0 10px', fontSize:13, outline:'none', boxSizing:'border-box' };
  const lbl = { display:'block', fontSize:12, fontWeight:600, color:'#6b7280', marginBottom:4 };

  return (
    <div id="expenses-page">
      <Sidebar activePage="expenses" goPage={goPage} />
      <div className="db-main">
        {/* Topbar */}
        <div className="tb">
          <div className="tb-title tb-title-block">
            <div>Expense Management</div>
            <div className="tb-subtitle">Track employee expenses, manage approvals, and ensure policy compliance</div>
          </div>
          <div className="tb-right">
            <div className="tb-bell"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <div className="tb-user">
              <div className="tb-avatar" style={{ background:'linear-gradient(135deg,#7c3aed,#a78bfa)' }}>{userInitials}</div>
              <div><div className="tb-uname">{currentUser?.full_name ?? 'User'}</div><div className="tb-urole">{currentUser?.role ?? ''}</div></div>
            </div>
          </div>
        </div>

        <div className="pg">
          {/* Header */}
          <div className="pg-header">
            <div className="pg-header-left"></div>
            <div className="pg-header-actions">
              <button className="btn-action btn-blue" onClick={() => setShowModal(true)}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Submit Expense
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="kpi-row" style={{ marginBottom:'20px' }}>
            <div className="kpi">
              <div className="kpi-label">Pending Approval</div>
              <div className="kpi-body">
                <div className="kpi-value">{kpis ? fmtShort(kpis.pending_amount) : '—'}</div>
                <div className="kpi-icon ic-o"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
              </div>
              <div style={{ fontSize:'13px', fontWeight:500, color:'#d97706', marginTop:'6px' }}>{kpis?.pending_count ?? 0} submissions</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Approved</div>
              <div className="kpi-body">
                <div className="kpi-value">{kpis ? fmtShort(kpis.approved_amount) : '—'}</div>
                <div className="kpi-icon ic-g"><svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
              </div>
              <div style={{ fontSize:'13px', fontWeight:500, color:'#16a34a', marginTop:'6px' }}>Total approved</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Reimbursed</div>
              <div className="kpi-body">
                <div className="kpi-value">{kpis ? fmtShort(kpis.reimbursed_amount) : '—'}</div>
                <div className="kpi-icon ic-b"><svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
              </div>
              <div style={{ fontSize:'13px', fontWeight:500, color:'#2563eb', marginTop:'6px' }}>Paid out</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Rejected</div>
              <div className="kpi-body">
                <div className="kpi-value" style={{ color:'#dc2626' }}>{kpis?.rejected_count ?? '—'}</div>
                <div className="kpi-icon" style={{ background:'#fee2e2', color:'#dc2626', width:'48px', height:'48px', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg viewBox="0 0 24 24" style={{ width:'24px', height:'24px' }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
              </div>
              <div style={{ fontSize:'13px', fontWeight:500, color:'#dc2626', marginTop:'6px' }}>
                {(kpis?.rejected_count ?? 0) > 0 ? 'Requires review' : 'None rejected'}
              </div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:'18px', alignItems:'start' }}>
            <div>
              {/* Recent Submissions */}
              <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e5e7eb', boxShadow:'0 1px 3px rgba(0,0,0,.06)', padding:'22px 24px', marginBottom:'16px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'18px' }}>
                  <div style={{ fontSize:'15px', fontWeight:700, color:'#111827' }}>Recent Submissions</div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <select
                      style={{ height:'34px', padding:'0 28px 0 10px', border:'1px solid #e5e7eb', borderRadius:'8px', fontSize:'13px', color:'#374151', background:'#fff', appearance:'none', cursor:'pointer' }}
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                    >
                      <option value="">All Status</option>
                      <option value="submitted">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="reimbursed">Reimbursed</option>
                    </select>
                  </div>
                </div>

                {loading && <div style={{ textAlign:'center', color:'#9ca3af', padding:'32px 0', fontSize:'13px' }}>Loading…</div>}
                {!loading && expenses.length === 0 && (
                  <div style={{ textAlign:'center', color:'#9ca3af', padding:'40px 0', fontSize:'13px' }}>
                    No expenses found. Click "Submit Expense" to add one.
                  </div>
                )}

                {expenses.map(exp => (
                  <div key={exp.id} style={{ border:`1px solid ${exp.status==='rejected'?'#fecaca':'#e5e7eb'}`, borderRadius:'10px', padding:'18px', marginBottom:'12px', background: exp.status==='rejected'?'#fff5f5':'#fff' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                        <div style={{ width:'36px', height:'36px', borderRadius:'50%', background: avatarColor(exp.submitted_by_name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:700, color:'#fff', flexShrink:0 }}>
                          {initials(exp.submitted_by_name)}
                        </div>
                        <div>
                          <div style={{ fontSize:'14px', fontWeight:700, color:'#111827' }}>{exp.title}</div>
                          <div style={{ fontSize:'12px', color:'#9ca3af' }}>
                            {exp.submitted_by_name || 'Unknown'} • {fmtDate(exp.expense_date || exp.created_at)}
                            {exp.project_name && <span style={{ marginLeft:6, color:'#7c3aed', fontWeight:600 }}>• {exp.project_name}</span>}
                          </div>
                        </div>
                      </div>
                      {statusBadge(exp.status)}
                    </div>

                    {exp.rejection_reason && (
                      <div style={{ background:'#fee2e2', borderRadius:'7px', padding:'8px 12px', marginBottom:'12px', display:'flex', alignItems:'center', gap:'8px', fontSize:'12.5px', color:'#dc2626', fontWeight:500 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        {exp.rejection_reason}
                      </div>
                    )}

                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom: exp.status==='submitted'?'14px':'0' }}>
                      <div>
                        <div style={{ fontSize:'11.5px', color:'#9ca3af', marginBottom:'2px' }}>Amount</div>
                        <div style={{ fontSize:'14px', fontWeight:700, color: exp.status==='rejected'?'#dc2626':'#111827' }}>SAR {fmt(exp.amount)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:'11.5px', color:'#9ca3af', marginBottom:'2px' }}>Category</div>
                        <div style={{ fontSize:'14px', fontWeight:600, color:'#111827' }}>{exp.category}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:'11.5px', color:'#9ca3af', marginBottom:'2px' }}>Project</div>
                        <div style={{ fontSize:'14px', fontWeight:600, color:'#111827' }}>{exp.project_name || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:'11.5px', color:'#9ca3af', marginBottom:'2px' }}>Notes</div>
                        <div style={{ fontSize:'13px', fontWeight:500, color:'#374151' }}>{exp.notes || '—'}</div>
                      </div>
                    </div>

                    {exp.status === 'submitted' && (
                      <div style={{ display:'flex', gap:'10px', alignItems:'center', marginTop:'14px' }}>
                        <button
                          style={{ flex:1, height:'36px', background:'#16a34a', color:'#fff', border:'none', borderRadius:'8px', fontSize:'13.5px', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}
                          onClick={() => updateStatus(exp.id, 'approved')}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          Approve
                        </button>
                        <button
                          style={{ flex:1, height:'36px', background:'#dc2626', color:'#fff', border:'none', borderRadius:'8px', fontSize:'13.5px', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}
                          onClick={() => { const r = prompt('Rejection reason (optional):'); updateStatus(exp.id, 'rejected', r || undefined); }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          Reject
                        </button>
                        <button
                          style={{ width:'36px', height:'36px', border:'1px solid #e5e7eb', borderRadius:'8px', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                          onClick={() => deleteExpense(exp.id)}
                          title="Delete"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                        </button>
                      </div>
                    )}
                    {exp.status === 'approved' && (
                      <div style={{ display:'flex', gap:'10px', marginTop:'14px' }}>
                        <button
                          style={{ flex:1, height:'36px', background:'#2563eb', color:'#fff', border:'none', borderRadius:'8px', fontSize:'13.5px', fontWeight:600, cursor:'pointer' }}
                          onClick={() => updateStatus(exp.id, 'reimbursed')}
                        >
                          Mark as Reimbursed
                        </button>
                        <button
                          style={{ width:'36px', height:'36px', border:'1px solid #e5e7eb', borderRadius:'8px', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                          onClick={() => deleteExpense(exp.id)}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Approval Workflow + Expense Reports */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                {/* Approval Workflow */}
                <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e5e7eb', boxShadow:'0 1px 3px rgba(0,0,0,.06)', padding:'22px 24px' }}>
                  <div style={{ fontSize:'15px', fontWeight:700, color:'#111827', marginBottom:'20px' }}>Approval Workflow</div>
                  {[
                    { label:'Employee Submission', sub:'Expense submitted with details', done: true, count: kpis?.total_submitted, color:'#16a34a' },
                    { label:'Manager Review', sub:'Policy compliance check and approval', done: false, count: kpis?.pending_count, color:'#7c3aed' },
                    { label:'Finance Approval', sub:'Final review and accounting processing', done: false, count: null, color:'#e5e7eb', textColor:'#6b7280' },
                    { label:'Reimbursement', sub:'Payment processing and notification', done: true, count: null, color:'#7c3aed' },
                  ].map((step, i, arr) => (
                    <div key={step.label} style={{ display:'flex', gap:'14px', marginBottom: i < arr.length-1 ? '16px':'0' }}>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                        <div style={{ width:'32px', height:'32px', background: step.color, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={step.color==='#e5e7eb'?'#6b7280':'#fff'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            {step.done ? <polyline points="20 6 9 17 4 12"/> : <circle cx="12" cy="12" r="8"/>}
                          </svg>
                        </div>
                        {i < arr.length-1 && <div style={{ width:'2px', flex:1, background:'#e5e7eb', margin:'6px 0' }}></div>}
                      </div>
                      <div style={{ paddingTop:'4px' }}>
                        <div style={{ fontSize:'13.5px', fontWeight:600, color:'#111827', marginBottom:'2px' }}>{step.label}</div>
                        <div style={{ fontSize:'12.5px', color:'#6b7280', marginBottom:'3px' }}>{step.sub}</div>
                        <div style={{ fontSize:'12px', fontWeight:600, color: step.done ? step.color : '#7c3aed' }}>
                          {step.done ? `✓ ${step.count ?? 0} total` : `⏱ ${step.count ?? 0} pending`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Expense Summary by Status */}
                <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e5e7eb', boxShadow:'0 1px 3px rgba(0,0,0,.06)', padding:'22px 24px' }}>
                  <div style={{ fontSize:'15px', fontWeight:700, color:'#111827', marginBottom:'16px' }}>Expense Summary</div>
                  {expenses.length === 0 && (
                    <div style={{ textAlign:'center', color:'#9ca3af', fontSize:'13px', padding:'24px 0' }}>No expenses yet.</div>
                  )}
                  {expenses.slice(0, 4).map(exp => (
                    <div key={exp.id} style={{ border:'1px solid #e5e7eb', borderRadius:'9px', padding:'14px', marginBottom:'10px' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                          <div style={{ width:'30px', height:'30px', borderRadius:'50%', background: avatarColor(exp.submitted_by_name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', fontWeight:700, color:'#fff' }}>
                            {initials(exp.submitted_by_name)}
                          </div>
                          <div>
                            <div style={{ fontSize:'13px', fontWeight:600, color:'#111827' }}>{exp.title}</div>
                            <div style={{ fontSize:'11.5px', color:'#9ca3af' }}>{exp.submitted_by_name || '—'} • {fmtDate(exp.expense_date || exp.created_at)}</div>
                          </div>
                        </div>
                        {statusBadge(exp.status)}
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
                        <div><div style={{ fontSize:'11px', color:'#9ca3af' }}>Amount</div><div style={{ fontSize:'12.5px', fontWeight:700, color:'#111827' }}>SAR {fmt(exp.amount)}</div></div>
                        <div><div style={{ fontSize:'11px', color:'#9ca3af' }}>Category</div><div style={{ fontSize:'12.5px', fontWeight:600, color:'#111827' }}>{exp.category}</div></div>
                        <div><div style={{ fontSize:'11px', color:'#9ca3af' }}>Project</div><div style={{ fontSize:'12.5px', fontWeight:600, color:'#111827' }}>{exp.project_name || '—'}</div></div>
                        <div><div style={{ fontSize:'11px', color:'#9ca3af' }}>Status</div><div style={{ fontSize:'12.5px', fontWeight:600, color: exp.status==='approved'?'#16a34a':exp.status==='rejected'?'#dc2626':'#d97706' }}>{exp.status}</div></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              {/* Category Breakdown */}
              <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e5e7eb', boxShadow:'0 1px 3px rgba(0,0,0,.06)', padding:'20px' }}>
                <div style={{ fontSize:'14.5px', fontWeight:700, color:'#111827', marginBottom:'16px' }}>Category Breakdown</div>
                {catBreakdown.length === 0 && <div style={{ textAlign:'center', color:'#9ca3af', fontSize:'13px', padding:'12px 0' }}>No data yet.</div>}
                {catBreakdown.map(({ category, total }) => {
                  const w = Math.round((total / maxCat) * 100);
                  const color = CAT_COLORS[category] ?? '#6b7280';
                  return (
                    <div key={category} style={{ marginBottom:'12px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
                        <span style={{ fontSize:'13px', color:'#374151' }}>{category}</span>
                        <span style={{ fontSize:'13px', fontWeight:700, color:'#111827' }}>SAR {fmt(total)}</span>
                      </div>
                      <div style={{ height:'6px', background:'#f3f4f6', borderRadius:'3px', overflow:'hidden' }}>
                        <div style={{ width:`${w}%`, height:'100%', background:color, borderRadius:'3px' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Actions */}
              <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e5e7eb', boxShadow:'0 1px 3px rgba(0,0,0,.06)', padding:'20px' }}>
                <div style={{ fontSize:'14.5px', fontWeight:700, color:'#111827', marginBottom:'14px' }}>Quick Actions</div>
                {[
                  ['Submit New Expense', '#2563eb', () => setShowModal(true)],
                  ['View Pending', '#d97706', () => setStatusFilter('submitted')],
                  ['View Approved', '#16a34a', () => setStatusFilter('approved')],
                  ['View All', '#7c3aed', () => setStatusFilter('')],
                ].map(([label, color, action]) => (
                  <div key={label} onClick={action} style={{ padding:'12px 14px', borderRadius:'9px', border:'1px solid #e5e7eb', marginBottom:'8px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
                    <span style={{ fontSize:'13.5px', fontWeight:600, color }}>{label}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Submit Expense Modal ── */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setShowModal(false)}>
          <div style={{ background:'#fff', borderRadius:14, width:560, maxHeight:'90vh', overflowY:'auto', padding:28 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:17, fontWeight:700, color:'#111827', marginBottom:20 }}>Submit Expense</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div style={{ gridColumn:'span 2' }}>
                <label style={lbl}>Title *</label>
                <input style={inp} placeholder="e.g. Hotel stay — Riyadh" value={form.title} onChange={e => setForm(f=>({...f, title:e.target.value}))} />
              </div>
              <div>
                <label style={lbl}>Category *</label>
                <select style={inp} value={form.category} onChange={e => setForm(f=>({...f, category:e.target.value}))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Amount (SAR) *</label>
                <input type="number" min={0} step="0.01" style={inp} value={form.amount} onChange={e => setForm(f=>({...f, amount:e.target.value}))} />
              </div>
              <div>
                <label style={lbl}>Expense Date</label>
                <input type="date" style={inp} value={form.expense_date} onChange={e => setForm(f=>({...f, expense_date:e.target.value}))} />
              </div>
              <div>
                <label style={lbl}>Your Name</label>
                <input style={inp} placeholder="Full name" value={form.submitted_by_name} onChange={e => setForm(f=>({...f, submitted_by_name:e.target.value}))} />
              </div>
              <div style={{ gridColumn:'span 2' }}>
                <label style={lbl}>Project (optional)</label>
                <input style={inp} placeholder="Link to a project name" value={form.project_name} onChange={e => setForm(f=>({...f, project_name:e.target.value}))} />
              </div>
              <div style={{ gridColumn:'span 2' }}>
                <label style={lbl}>Notes</label>
                <input style={inp} value={form.notes} onChange={e => setForm(f=>({...f, notes:e.target.value}))} />
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:22 }}>
              <button style={{ height:36, padding:'0 16px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff', color:'#374151', fontSize:13, fontWeight:600, cursor:'pointer' }} onClick={() => setShowModal(false)}>Cancel</button>
              <button style={{ height:36, padding:'0 18px', border:'none', borderRadius:8, background:'#7c3aed', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }} onClick={submitExpense} disabled={saving}>{saving ? 'Submitting…' : 'Submit'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:28, right:28, background:'#1f2937', color:'#fff', padding:'12px 20px', borderRadius:10, fontSize:14, fontWeight:500, zIndex:2000, boxShadow:'0 4px 16px rgba(0,0,0,.25)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
