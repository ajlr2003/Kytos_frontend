import Sidebar from '../components/Sidebar';

function Projects({ goPage }) {
  return (
    <div id="projects-page">
      <Sidebar activePage="projects" goPage={goPage} />
      <div className="db-main">
        <div className="tb"><span className="tb-title"></span><div className="tb-right"><div className="tb-bell"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div><div className="tb-user"><div className="tb-avatar" style={{background:'linear-gradient(135deg,#16a34a,#10b981)'}}>SJ</div><div><div className="tb-uname">Sarah Johns</div><div className="tb-urole">Administrator</div></div></div></div></div>
        <div className="pg">
          <div className="pg-header">
            <div className="pg-header-left"><h1>Project Management</h1><p>Track projects, milestones, tasks, time, budget, and resource allocation</p></div>
            <div className="pg-header-actions">
              <button className="btn-action btn-purple"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Log Time</button>
              <button className="btn-action btn-green"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Task</button>
              <button className="btn-action btn-blue"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New Project</button>
            </div>
          </div>
          <div className="kpi-row" style={{marginBottom:'20px'}}>
            <div className="kpi"><div className="kpi-label">Active Projects</div><div className="kpi-body"><div className="kpi-value">18</div><div className="kpi-icon ic-b"><svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div></div><div className="kpi-chg up"><svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>3 started this month</div></div>
            <div className="kpi"><div className="kpi-label">Total Hours Logged</div><div className="kpi-body"><div className="kpi-value">1,247</div><div className="kpi-icon ic-g"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div></div><div style={{fontSize:'13px',fontWeight:500,color:'#6b7280',marginTop:'6px'}}>This month</div></div>
            <div className="kpi"><div className="kpi-label">Budget Utilization</div><div className="kpi-body"><div className="kpi-value">68%</div><div className="kpi-icon ic-o"><svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div></div><div style={{fontSize:'13px',fontWeight:500,color:'#ea580c',marginTop:'6px'}}>$487K of $720K</div></div>
            <div className="kpi"><div className="kpi-label">Team Members</div><div className="kpi-body"><div className="kpi-value">42</div><div className="kpi-icon ic-p"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div></div><div style={{fontSize:'13px',fontWeight:500,color:'#6b7280',marginTop:'6px'}}>Across all projects</div></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:'18px',alignItems:'start'}}>
            <div>
              {/* Project Health */}
              <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',padding:'22px 24px',marginBottom:'16px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'18px'}}><div style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>Project Health &amp; Status</div></div>
                {/* E-Commerce Platform */}
                <div style={{border:'1px solid #e5e7eb',borderRadius:'10px',padding:'18px',marginBottom:'12px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'12px'}}><div style={{width:'38px',height:'38px',background:'#dcfce7',borderRadius:'9px',display:'flex',alignItems:'center',justifyContent:'center'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div><div><div style={{fontSize:'14px',fontWeight:700,color:'#111827'}}>E-Commerce Platform</div><div style={{fontSize:'12px',color:'#9ca3af'}}>Client: TechCorp Ltd.</div></div></div>
                    <span style={{background:'#dcfce7',color:'#15803d',fontSize:'12px',fontWeight:600,padding:'3px 10px',borderRadius:'12px'}}>On Track</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px',marginBottom:'12px'}}>
                    <div><div style={{fontSize:'11.5px',color:'#9ca3af',marginBottom:'3px'}}>Progress</div><div style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>72%</div></div>
                    <div><div style={{fontSize:'11.5px',color:'#9ca3af',marginBottom:'3px'}}>Budget</div><div style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>$85K/$120K</div></div>
                    <div><div style={{fontSize:'11.5px',color:'#9ca3af',marginBottom:'3px'}}>Hours</div><div style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>456/650</div></div>
                    <div><div style={{fontSize:'11.5px',color:'#9ca3af',marginBottom:'3px'}}>Due</div><div style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>Jan 15</div></div>
                  </div>
                  <div style={{height:'7px',background:'#f3f4f6',borderRadius:'4px',overflow:'hidden'}}><div style={{width:'72%',height:'100%',background:'#16a34a',borderRadius:'4px'}}></div></div>
                </div>
                {/* Mobile App */}
                <div style={{border:'1px solid #e5e7eb',borderRadius:'10px',padding:'18px',marginBottom:'12px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'12px'}}><div style={{width:'38px',height:'38px',background:'#ffedd5',borderRadius:'9px',display:'flex',alignItems:'center',justifyContent:'center'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></div><div><div style={{fontSize:'14px',fontWeight:700,color:'#111827'}}>Mobile App Development</div><div style={{fontSize:'12px',color:'#9ca3af'}}>Client: StartupXYZ</div></div></div>
                    <span style={{background:'#ffedd5',color:'#ea580c',fontSize:'12px',fontWeight:600,padding:'3px 10px',borderRadius:'12px'}}>At Risk</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px',marginBottom:'12px'}}>
                    <div><div style={{fontSize:'11.5px',color:'#9ca3af',marginBottom:'3px'}}>Progress</div><div style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>45%</div></div>
                    <div><div style={{fontSize:'11.5px',color:'#9ca3af',marginBottom:'3px'}}>Budget</div><div style={{fontSize:'15px',fontWeight:700,color:'#dc2626'}}>$62K/$55K</div></div>
                    <div><div style={{fontSize:'11.5px',color:'#9ca3af',marginBottom:'3px'}}>Hours</div><div style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>312/480</div></div>
                    <div><div style={{fontSize:'11.5px',color:'#9ca3af',marginBottom:'3px'}}>Due</div><div style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>Dec 28</div></div>
                  </div>
                  <div style={{height:'7px',background:'#f3f4f6',borderRadius:'4px',overflow:'hidden'}}><div style={{width:'45%',height:'100%',background:'#f59e0b',borderRadius:'4px'}}></div></div>
                </div>
                {/* Data Migration */}
                <div style={{border:'1px solid #e5e7eb',borderRadius:'10px',padding:'18px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'12px'}}><div style={{width:'38px',height:'38px',background:'#dbeafe',borderRadius:'9px',display:'flex',alignItems:'center',justifyContent:'center'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div><div style={{fontSize:'14px',fontWeight:700,color:'#111827'}}>Data Migration Project</div><div style={{fontSize:'12px',color:'#9ca3af'}}>Client: Enterprise Co.</div></div></div>
                    <span style={{background:'#dcfce7',color:'#15803d',fontSize:'12px',fontWeight:600,padding:'3px 10px',borderRadius:'12px'}}>On Track</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px',marginBottom:'12px'}}>
                    <div><div style={{fontSize:'11.5px',color:'#9ca3af',marginBottom:'3px'}}>Progress</div><div style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>88%</div></div>
                    <div><div style={{fontSize:'11.5px',color:'#9ca3af',marginBottom:'3px'}}>Budget</div><div style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>$42K/$50K</div></div>
                    <div><div style={{fontSize:'11.5px',color:'#9ca3af',marginBottom:'3px'}}>Hours</div><div style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>267/300</div></div>
                    <div><div style={{fontSize:'11.5px',color:'#9ca3af',marginBottom:'3px'}}>Due</div><div style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>Dec 20</div></div>
                  </div>
                  <div style={{height:'7px',background:'#f3f4f6',borderRadius:'4px',overflow:'hidden'}}><div style={{width:'88%',height:'100%',background:'#2563eb',borderRadius:'4px'}}></div></div>
                </div>
              </div>
              {/* Task Board + Time Tracking */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
                <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',padding:'20px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}><div style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>Task Board</div><button style={{height:'32px',padding:'0 12px',background:'#2563eb',color:'#fff',border:'none',borderRadius:'7px',fontSize:'12.5px',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:'5px'}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Task</button></div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>
                    <div style={{background:'#f8fafc',borderRadius:'9px',padding:'12px'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}><span style={{fontSize:'12.5px',fontWeight:600,color:'#374151'}}>To Do</span><span style={{background:'#f3f4f6',color:'#374151',fontSize:'11.5px',fontWeight:700,padding:'1px 7px',borderRadius:'10px'}}>8</span></div><div style={{background:'#fff',borderRadius:'7px',border:'1px solid #e5e7eb',padding:'10px',marginBottom:'6px'}}><div style={{fontSize:'12.5px',fontWeight:600,color:'#111827',marginBottom:'2px'}}>Design homepage mockup</div><div style={{fontSize:'11.5px',color:'#9ca3af',marginBottom:'6px'}}>E-Commerce Platform</div><div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><span style={{fontSize:'11.5px',color:'#ea580c',fontWeight:500}}>High Priority</span><div style={{width:'20px',height:'20px',borderRadius:'50%',background:'linear-gradient(135deg,#6366f1,#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'7.5px',fontWeight:700,color:'#fff'}}>MC</div></div></div></div>
                    <div style={{background:'#eff6ff',borderRadius:'9px',padding:'12px'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}><span style={{fontSize:'12.5px',fontWeight:600,color:'#374151'}}>In Progress</span><span style={{background:'#dbeafe',color:'#1d4ed8',fontSize:'11.5px',fontWeight:700,padding:'1px 7px',borderRadius:'10px'}}>5</span></div><div style={{background:'#fff',borderRadius:'7px',border:'1px solid #e5e7eb',padding:'10px',marginBottom:'6px'}}><div style={{fontSize:'12.5px',fontWeight:600,color:'#111827',marginBottom:'2px'}}>Database schema design</div><div style={{fontSize:'11.5px',color:'#9ca3af',marginBottom:'6px'}}>Data Migration</div><div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><span style={{fontSize:'11.5px',color:'#ea580c',fontWeight:500}}>High Priority</span><div style={{width:'20px',height:'20px',borderRadius:'50%',background:'linear-gradient(135deg,#16a34a,#10b981)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'7.5px',fontWeight:700,color:'#fff'}}>SJ</div></div></div></div>
                    <div style={{background:'#f0fdf4',borderRadius:'9px',padding:'12px'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}><span style={{fontSize:'12.5px',fontWeight:600,color:'#374151'}}>Done</span><span style={{background:'#dcfce7',color:'#15803d',fontSize:'11.5px',fontWeight:700,padding:'1px 7px',borderRadius:'10px'}}>12</span></div><div style={{background:'#fff',borderRadius:'7px',border:'1px solid #e5e7eb',padding:'10px',marginBottom:'6px'}}><div style={{fontSize:'12.5px',fontWeight:600,color:'#111827',marginBottom:'2px'}}>Requirements gathering</div><div style={{fontSize:'11.5px',color:'#9ca3af',marginBottom:'4px'}}>Mobile App</div><div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><span style={{fontSize:'11.5px',color:'#16a34a',fontWeight:500}}>✓ Completed</span><div style={{width:'20px',height:'20px',borderRadius:'50%',background:'linear-gradient(135deg,#6366f1,#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'7.5px',fontWeight:700,color:'#fff'}}>MC</div></div></div></div>
                  </div>
                </div>
                <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',padding:'20px'}}>
                  <div style={{fontSize:'15px',fontWeight:700,color:'#111827',marginBottom:'16px'}}>Time Tracking Summary</div>
                  <div style={{marginBottom:'14px'}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}><span style={{fontSize:'13px',color:'#374151'}}>E-Commerce Platform</span><span style={{fontSize:'13px',fontWeight:600,color:'#111827'}}>456h</span></div><div style={{height:'6px',background:'#f3f4f6',borderRadius:'3px',overflow:'hidden'}}><div style={{width:'70%',height:'100%',background:'#16a34a',borderRadius:'3px'}}></div></div></div>
                  <div style={{marginBottom:'14px'}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}><span style={{fontSize:'13px',color:'#374151'}}>Mobile App Development</span><span style={{fontSize:'13px',fontWeight:600,color:'#111827'}}>312h</span></div><div style={{height:'6px',background:'#f3f4f6',borderRadius:'3px',overflow:'hidden'}}><div style={{width:'48%',height:'100%',background:'#f59e0b',borderRadius:'3px'}}></div></div></div>
                  <div style={{marginBottom:'14px'}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}><span style={{fontSize:'13px',color:'#374151'}}>Data Migration Project</span><span style={{fontSize:'13px',fontWeight:600,color:'#111827'}}>267h</span></div><div style={{height:'6px',background:'#f3f4f6',borderRadius:'3px',overflow:'hidden'}}><div style={{width:'41%',height:'100%',background:'#2563eb',borderRadius:'3px'}}></div></div></div>
                  <div style={{paddingTop:'12px',borderTop:'1px solid #f3f4f6'}}><div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:'13.5px',fontWeight:700,color:'#111827'}}>Total This Month</span><span style={{fontSize:'15px',fontWeight:700,color:'#111827'}}>1,247h</span></div></div>
                </div>
              </div>
            </div>
            {/* Right sidebar */}
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',padding:'20px'}}>
                <div style={{fontSize:'14.5px',fontWeight:700,color:'#111827',marginBottom:'14px'}}>Upcoming Milestones</div>
                {[{bg:'#eff6ff',brd:'#bfdbfe',ico:'#2563eb',icoSvg:<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,title:'Beta Release',sub:'E-Commerce Platform',due:'Due: Dec 22, 2024',dClr:'#2563eb'},{bg:'#f0fdf4',brd:'#bbf7d0',ico:'#16a34a',icoSvg:<polyline points="20 6 9 17 4 12"/>,title:'Data Validation',sub:'Data Migration Project',due:'Due: Dec 18, 2024',dClr:'#16a34a'},{bg:'#f5f3ff',brd:'#ddd6fe',ico:'#7c3aed',icoSvg:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></>,title:'UI/UX Review',sub:'Mobile App Development',due:'Due: Dec 25, 2024',dClr:'#7c3aed'},{bg:'#fff7ed',brd:'#fed7aa',ico:'#ea580c',icoSvg:<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,title:'Client Presentation',sub:'E-Commerce Platform',due:'Due: Jan 05, 2025',dClr:'#ea580c'}].map((m,i)=>(
                  <div key={i} style={{padding:'12px 14px',borderRadius:'9px',background:m.bg,border:`1px solid ${m.brd}`,marginBottom:'8px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'10px'}}><div style={{width:'28px',height:'28px',background:m.ico,borderRadius:'7px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{m.icoSvg}</svg></div><div><div style={{fontSize:'13px',fontWeight:600,color:'#111827'}}>{m.title}</div><div style={{fontSize:'12px',color:'#6b7280'}}>{m.sub}</div><div style={{fontSize:'12px',fontWeight:600,color:m.dClr}}>{m.due}</div></div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Projects;
