import { useEffect, useRef, useState } from 'react';
import Sidebar from '../components/Sidebar';
import '../styles/Dashboard.css';

/* ─── Toast ─── */
function Toast({ msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 2800); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="db-toast">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      {msg}
    </div>
  );
}

/* ─── KPI drawer ─── */
const KPI_DETAILS = {
  revenue: {
    title: 'Revenue Breakdown',
    rows: [
      { label: 'Products',   value: '$381,384', pct: '45%', color: '#3b82f6' },
      { label: 'Services',   value: '$211,880', pct: '25%', color: '#10b981' },
      { label: 'Consulting', value: '$169,504', pct: '20%', color: '#f59e0b' },
      { label: 'Support',    value: '$84,752',  pct: '10%', color: '#a78bfa' },
    ],
    note: 'Revenue is up $94,171 vs last month.',
  },
  customers: {
    title: 'Customers by Segment',
    rows: [
      { label: 'Enterprise', value: '312',   pct: '11%', color: '#6366f1' },
      { label: 'SMB',        value: '1,847', pct: '65%', color: '#3b82f6' },
      { label: 'Startup',    value: '688',   pct: '24%', color: '#a78bfa' },
    ],
    note: '229 new customers added this month.',
  },
  invoices: {
    title: 'Open Invoices by Urgency',
    rows: [
      { label: 'Due this week', value: '42', pct: '27%', color: '#f59e0b' },
      { label: 'Due next week', value: '68', pct: '44%', color: '#3b82f6' },
      { label: 'Overdue',       value: '46', pct: '29%', color: '#ef4444' },
    ],
    note: 'Total outstanding: $1,240,800.',
  },
  inventory: {
    title: 'Inventory by Category',
    rows: [
      { label: 'Electronics', value: '$162,480', pct: '69%', color: '#2563eb' },
      { label: 'Furniture',   value: '$50,484',  pct: '21%', color: '#16a34a' },
      { label: 'Clothing',    value: '$21,926',  pct: '10%', color: '#7c3aed' },
    ],
    note: '23 items below reorder threshold.',
  },
};

function KpiDrawer({ type, onClose }) {
  const d = KPI_DETAILS[type];
  if (!d) return null;
  return (
    <div className="kpi-drawer" onClick={e => e.stopPropagation()}>
      <div className="kpi-drawer-header">
        <span className="kpi-drawer-title">{d.title}</span>
        <button className="kpi-drawer-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      {d.rows.map(r => (
        <div key={r.label} className="kpi-drawer-row">
          <div className="kpi-drawer-dot" style={{ background: r.color }}></div>
          <span className="kpi-drawer-label">{r.label}</span>
          <span className="kpi-drawer-val">{r.value}</span>
          <span className="kpi-drawer-pct">{r.pct}</span>
        </div>
      ))}
      <div className="kpi-drawer-note">{d.note}</div>
    </div>
  );
}

/* ─── Revenue trend data ─── */
const TREND_PTS = [
  { x: 55,  y: 61,  label: 'Jan', value: '$65,000' },
  { x: 175, y: 42,  label: 'Feb', value: '$72,000' },
  { x: 290, y: 47,  label: 'Mar', value: '$70,000' },
  { x: 405, y: 56,  label: 'Apr', value: '$67,000' },
  { x: 515, y: 26,  label: 'May', value: '$78,000' },
  { x: 630, y: 10,  label: 'Jun', value: '$84,000' },
];

function RevenueTrendChart() {
  const [tip, setTip] = useState(null);
  const svgRef = useRef(null);

  function onMove(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (700 / rect.width);
    let best = null, dist = Infinity;
    TREND_PTS.forEach(p => { const d = Math.abs(p.x - mx); if (d < dist) { dist = d; best = p; } });
    setTip(dist < 55 ? best : null);
  }

  return (
    <div className="area-outer" style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 700 280"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible', cursor: 'crosshair' }}
        onMouseMove={onMove}
        onMouseLeave={() => setTip(null)}
      >
        <defs>
          <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.20"/>
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        {/* Grid */}
        {[20,75,130,185,240].map(y => (
          <line key={y} x1="50" y1={y} x2="680" y2={y} stroke="#f1f5f9" strokeWidth="1"/>
        ))}
        {/* Y-axis labels */}
        {[['80k',25],['60k',79],['40k',134],['20k',189],['0',244]].map(([l,y]) => (
          <text key={l} x="44" y={y} fontSize="12" fill="#9ca3af" fontFamily="-apple-system,sans-serif" textAnchor="end">{l}</text>
        ))}
        {/* Y-axis title */}
        <text x="12" y="140" fontSize="11" fill="#9ca3af" fontFamily="-apple-system,sans-serif" textAnchor="middle" transform="rotate(-90,12,140)">Revenue</text>
        {/* X labels */}
        {TREND_PTS.map(p => (
          <text key={p.label} x={p.x} y="265" fontSize="12" fill="#9ca3af" fontFamily="-apple-system,sans-serif" textAnchor="middle">{p.label}</text>
        ))}
        {/* Area */}
        <path d="M55,61 C90,52 135,38 175,42 C218,46 252,46 290,47 C328,49 368,56 405,56 C442,56 478,23 515,26 C552,29 592,12 630,10 L630,240 L55,240 Z" fill="url(#ag)"/>
        {/* Line */}
        <path d="M55,61 C90,52 135,38 175,42 C218,46 252,46 290,47 C328,49 368,56 405,56 C442,56 478,23 515,26 C552,29 592,12 630,10" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Hover crosshair */}
        {tip && <line x1={tip.x} y1="10" x2={tip.x} y2="240" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,3" opacity="0.5"/>}
        {/* Data points */}
        {TREND_PTS.map(p => (
          <circle key={p.label} cx={p.x} cy={p.y}
            r={tip?.label === p.label ? 6 : 4}
            fill={tip?.label === p.label ? '#1d4ed8' : '#3b82f6'}
            stroke="#fff" strokeWidth="2"
          />
        ))}
      </svg>
      {tip && (
        <div className="chart-tooltip" style={{
          left: `calc(${(tip.x / 700) * 100}% + 12px)`,
          top:  `${(tip.y / 280) * 100}%`,
        }}>
          <div className="chart-tooltip-month">{tip.label}</div>
          <div className="chart-tooltip-val">{tip.value}</div>
        </div>
      )}
    </div>
  );
}

/* ─── Pie chart ─── */
const PIE_SLICES = [
  { pct: 0.45, color: '#3b82f6', label: 'Products',   sub: '45%', value: '$381,384' },
  { pct: 0.25, color: '#10b981', label: 'Services',   sub: '25%', value: '$211,880' },
  { pct: 0.20, color: '#f59e0b', label: 'Consulting', sub: '20%', value: '$169,504' },
  { pct: 0.10, color: '#a78bfa', label: 'Support',    sub: '10%', value: '$84,752'  },
];

function PieChart() {
  const canvasRef = useRef(null);
  const [hov, setHov] = useState(null);
  const anglesRef = useRef([]);

  function buildAngles() {
    const out = []; let start = -Math.PI / 2;
    PIE_SLICES.forEach(s => {
      const sweep = s.pct * 2 * Math.PI;
      out.push({ ...s, start, end: start + sweep });
      start += sweep;
    });
    anglesRef.current = out;
    return out;
  }

  function draw(hovLabel) {
    const canvas = canvasRef.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 260 * dpr; canvas.height = 260 * dpr;
    canvas.style.width = '260px'; canvas.style.height = '260px';
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
    const cx = 130, cy = 130, r = 118;
    buildAngles().forEach(s => {
      const isH = s.label === hovLabel;
      const mid = (s.start + s.end) / 2;
      const ox = isH ? Math.cos(mid) * 8 : 0;
      const oy = isH ? Math.sin(mid) * 8 : 0;
      ctx.beginPath(); ctx.moveTo(cx+ox, cy+oy); ctx.arc(cx+ox, cy+oy, r, s.start, s.end); ctx.closePath();
      ctx.fillStyle = s.color; ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx+ox, cy+oy);
      ctx.lineTo(cx+ox+Math.cos(s.start)*r, cy+oy+Math.sin(s.start)*r);
      ctx.strokeStyle='#fff'; ctx.lineWidth=2.5; ctx.stroke();
      const lr=r*0.65, lx=cx+ox+Math.cos(mid)*lr, ly=cy+oy+Math.sin(mid)*lr;
      ctx.fillStyle='#fff'; ctx.font='bold 11px -apple-system,sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(s.label, lx, ly-7); ctx.fillText(s.sub, lx, ly+7);
    });
  }

  useEffect(() => { draw(null); }, []);

  function onMove(e) {
    const r = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX-r.left-130, my = e.clientY-r.top-130;
    const dist = Math.sqrt(mx*mx+my*my);
    if (dist > 118) { if (hov) { setHov(null); draw(null); } return; }
    let a = Math.atan2(my, mx);
    if (a < -Math.PI/2) a += 2*Math.PI;
    const found = anglesRef.current.find(s => a >= s.start && a < s.end);
    const lbl = found?.label || null;
    if (lbl !== hov) { setHov(lbl); draw(lbl); }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas ref={canvasRef} width="260" height="260"
        style={{ flexShrink:0, display:'block', cursor:'pointer' }}
        onMouseMove={onMove} onMouseLeave={() => { setHov(null); draw(null); }}
      />
      {hov && (() => {
        const s = PIE_SLICES.find(p => p.label === hov);
        return (
          <div className="pie-tooltip">
            <div className="pie-tooltip-dot" style={{ background: s.color }}></div>
            <div>
              <div className="pie-tooltip-label">{s.label}</div>
              <div className="pie-tooltip-val">{s.value} <span>({s.sub})</span></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ═══════════════════════════ MAIN ═══════════════════════════ */
export default function Dashboard({ goPage }) {
  const [openKpi, setOpenKpi] = useState(null);
  const [toast,   setToast]   = useState(null);

  const showToast = msg => setToast(msg);
  const toggleKpi = key => setOpenKpi(p => p === key ? null : key);

  const kpis = [
    { key:'revenue',   label:'Total Revenue',    value:'$847,520', icon:<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, cls:'ic-g', chg:'+12.5% from last month', up:true },
    { key:'customers', label:'Active Customers', value:'2,847',    icon:<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, cls:'ic-b', chg:'+8.2% from last month', up:true },
    { key:'invoices',  label:'Open Invoices',    value:'156',      icon:<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>, cls:'ic-o', chg:'-3.1% from last month', up:false },
    { key:'inventory', label:'Inventory Value',  value:'$234,890', icon:<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>, cls:'ic-p', chg:'+5.7% from last month', up:true },
  ];

  return (
    <div id="dashboard-page">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      <Sidebar activePage="dashboard" goPage={goPage} />
      <div className="db-main">

        {/* Topbar */}
        <div className="tb">
          <span className="tb-title">Dashboard Overview</span>
          <div className="tb-right">
            <div className="tb-bell">
              <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span className="tb-dot"></span>
            </div>
            <div className="tb-user">
              <div className="tb-avatar">JS</div>
              <div><div className="tb-uname">John Sm...</div><div className="tb-urole">Administra...</div></div>
            </div>
          </div>
        </div>

        <div className="pg">

          {/* KPI Cards */}
          <div className="kpi-row">
            {kpis.map(k => (
              <div key={k.key} className={`kpi kpi-clickable${openKpi===k.key?' kpi-active':''}`} onClick={() => toggleKpi(k.key)}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-body">
                  <div className="kpi-value">{k.value}</div>
                  <div className={`kpi-icon ${k.cls}`}>{k.icon}</div>
                </div>
                <div className={`kpi-chg ${k.up?'up':'dn'}`}>
                  <svg viewBox="0 0 24 24">{k.up?<polyline points="18 15 12 9 6 15"/>:<polyline points="6 9 12 15 18 9"/>}</svg>
                  {k.chg}
                </div>
                {openKpi===k.key && <KpiDrawer type={k.key} onClose={e=>{e.stopPropagation();setOpenKpi(null);}} />}
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="charts-row">
            <div className="chart-card">
              <div className="card-title">Revenue Trend</div>
              <RevenueTrendChart />
            </div>
            <div className="chart-card">
              <div className="card-title">Sales by Category</div>
              <div className="pie-section">
                <PieChart />
                <div className="pie-legend">
                  {PIE_SLICES.map(s=>(
                    <div key={s.label} className="leg-row">
                      <div className="leg-sq" style={{background:s.color}}></div>{s.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions + Recent Activity */}
          <div className="bottom-row">
            <div className="panel">
              <div className="card-title">Quick Actions</div>
              <button className="qa qa-b" onClick={()=>goPage('invoicing')}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Create Invoice
              </button>
              <button className="qa qa-g" onClick={()=>goPage('sales')}>
                <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>New Quotation
              </button>
              <button className="qa qa-p" onClick={()=>goPage('purchases')}>
                <svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>Purchase Order
              </button>
              <button className="qa qa-o" onClick={()=>goPage('crm')}>
                <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>Add Customer
              </button>
            </div>
            <div className="panel">
              <div className="card-title">Recent Activity</div>
              <div className="act">
                <div className="act-ico aig"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
                <div className="act-body"><div className="act-t">Invoice #INV-2024-001 paid</div><div className="act-s">$5,250 received from TechCorp Ltd.</div></div>
                <div className="act-time">2 hours ago</div>
              </div>
              <div className="act">
                <div className="act-ico aib"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                <div className="act-body"><div className="act-t">New quotation created</div><div className="act-s">QUO-2024-045 for Global Industries</div></div>
                <div className="act-time">4 hours ago</div>
              </div>
              <div className="act">
                <div className="act-ico aip"><svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></div>
                <div className="act-body"><div className="act-t">Inventory updated</div><div className="act-s">Stock levels adjusted for 15 items</div></div>
                <div className="act-time">6 hours ago</div>
              </div>
            </div>
          </div>

          {/* Supplier Quotation & Cost Comparison */}
          <div className="sqc-wrap">
            <div className="sqc-header">
              <div className="sqc-header-left">
                <div className="sqc-header-icon">
                  <svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>
                </div>
                <div>
                  <div className="sqc-header-title">Supplier Quotation &amp; Cost Comparison</div>
                  <div className="sqc-header-sub">Organize supplier quotes and compare costs</div>
                </div>
              </div>
              <div className="sqc-header-stats">
                <div className="sqc-stat"><div className="sqc-stat-val">5</div><div className="sqc-stat-label">Active Suppliers</div></div>
                <div className="sqc-stat"><div className="sqc-stat-val">76%</div><div className="sqc-stat-label">Response Rate</div></div>
                <div className="sqc-stat"><div className="sqc-stat-val">12</div><div className="sqc-stat-label">Quotes Due</div></div>
              </div>
            </div>
            <div className="sqc-grid" style={{borderRadius:0,borderBottom:'none'}}>
              <div className="sqc-col">
                <div className="sqcc-head"><div className="sqcc-title-wrap"><svg viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg><span className="sqcc-title">RFQ Distribution</span></div><span className="sqcc-badge badge-blue">12 sent</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Sent this week</span><span className="sqcc-row-val blue">12</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Awaiting response</span><span className="sqcc-row-val">7</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Responded</span><span className="sqcc-row-val green">5</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Declined</span><span className="sqcc-row-val">2</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Avg response time</span><span className="sqcc-row-val">18h</span></div>
                <div className="sqcc-actions"><button className="sqcc-btn-primary" onClick={()=>goPage('purchases')}>Send RFQ</button><button className="sqcc-btn-secondary" onClick={()=>goPage('purchases')}>View Sent</button></div>
              </div>
              <div className="sqc-col">
                <div className="sqcc-head"><div className="sqcc-title-wrap"><svg viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg><span className="sqcc-title">Quote Comparison</span></div><span className="sqcc-badge badge-orange">8 ready</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Ready to compare</span><span className="sqcc-row-val blue">8</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Avg quotes per RFQ</span><span className="sqcc-row-val">3.2</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Savings identified</span><span className="sqcc-row-val green">$24,400</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Best bid gap (avg)</span><span className="sqcc-row-val">12%</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Awaiting quotes</span><span className="sqcc-row-val">5</span></div>
                <div className="sqcc-actions"><button className="sqcc-btn-primary" onClick={()=>goPage('purchases')}>Compare Quotes</button><button className="sqcc-btn-secondary" onClick={()=>goPage('purchases')}>View All</button></div>
              </div>
              <div className="sqc-col">
                <div className="sqcc-head"><div className="sqcc-title-wrap"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span className="sqcc-title">Price Tracking</span></div><span className="sqcc-badge badge-green">Updated</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Items tracked</span><span className="sqcc-row-val blue">312</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Price increases (30d)</span><span className="sqcc-row-val orange">18</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Price decreases (30d)</span><span className="sqcc-row-val green">11</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Avg lead time</span><span className="sqcc-row-val">17 days</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Currencies monitored</span><span className="sqcc-row-val">6</span></div>
                <div className="sqcc-actions"><button className="sqcc-btn-primary" onClick={()=>showToast('Price history report opened')}>Price History</button><button className="sqcc-btn-secondary" onClick={()=>showToast('Add item dialog opened')}>Add Item</button></div>
              </div>
            </div>
            <div className="sqc-grid" style={{borderRadius:'0 0 12px 12px'}}>
              <div className="sqc-col" style={{borderTop:'1px solid #e5e7eb'}}>
                <div className="sqcc-head"><div className="sqcc-title-wrap"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg><span className="sqcc-title">Historical Pricing</span></div><span className="sqcc-badge badge-purple">2.4k records</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Total price records</span><span className="sqcc-row-val blue">2,412</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Suppliers covered</span><span className="sqcc-row-val">5</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">SKUs tracked</span><span className="sqcc-row-val">287</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Oldest record</span><span className="sqcc-row-val">Jan 2022</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Last imported</span><span className="sqcc-row-val green">Today</span></div>
                <div className="sqcc-actions"><button className="sqcc-btn-primary" onClick={()=>showToast('Browsing 2,412 price records…')}>Browse Records</button><button className="sqcc-btn-secondary" onClick={()=>showToast('Import data dialog opened')}>Import Data</button></div>
              </div>
              <div className="sqc-col" style={{borderTop:'1px solid #e5e7eb'}}>
                <div className="sqcc-head"><div className="sqcc-title-wrap"><svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg><span className="sqcc-title">Performance Tracking</span></div><span className="sqcc-badge badge-blue">5 suppliers</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Top supplier score</span><span className="sqcc-row-val green">4.8 / 5</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">On-time delivery (avg)</span><span className="sqcc-row-val">88%</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Quality pass rate</span><span className="sqcc-row-val green">96%</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Below threshold</span><span className="sqcc-row-val orange">1</span></div>
                <div className="sqcc-row"><span className="sqcc-row-label">Preferred suppliers</span><span className="sqcc-row-val">2</span></div>
                <div className="sqcc-actions"><button className="sqcc-btn-primary" onClick={()=>goPage('purchases')}>Scorecard</button><button className="sqcc-btn-secondary" onClick={()=>goPage('purchases')}>All Suppliers</button></div>
              </div>
              <div className="sqc-col" style={{borderTop:'1px solid #e5e7eb'}}>
                <div className="sqcc-head"><div className="sqcc-title-wrap"><svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span className="sqcc-title">Pillar 2 Health</span></div></div>
                <div style={{fontSize:'12px',color:'#9ca3af',marginBottom:'10px'}}>Module performance</div>
                <div className="prog-row"><span className="prog-label">Supplier response</span><div className="prog-bar-wrap"><div className="prog-bar" style={{width:'76%',background:'#7c3aed'}}></div></div><span className="prog-val">76%</span></div>
                <div className="prog-row"><span className="prog-label">Quote coverage</span><div className="prog-bar-wrap"><div className="prog-bar" style={{width:'81%',background:'#7c3aed'}}></div></div><span className="prog-val">81%</span></div>
                <div className="prog-row"><span className="prog-label">Price accuracy</span><div className="prog-bar-wrap"><div className="prog-bar" style={{width:'93%',background:'#16a34a'}}></div></div><span className="prog-val">93%</span></div>
                <div className="prog-row" style={{marginBottom:'14px'}}><span className="prog-label">Supplier health</span><div className="prog-bar-wrap"><div className="prog-bar" style={{width:'88%',background:'#16a34a'}}></div></div><span className="prog-val">88%</span></div>
                <div className="sqcc-actions"><button className="sqcc-btn-primary" style={{flex:1}} onClick={()=>showToast('Full supplier health report generated')}>Full Report</button></div>
              </div>
            </div>
          </div>

          {/* Modules */}
          <div className="sec-title">InfroneX Modules</div>
          <div className="mod-grid">
            {[
              {page:'accounting', color:'#2563eb', icon:<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>, name:'Accounting',  desc:'Chart of accounts, journals, financial statements'},
              {page:'invoicing',  color:'#16a34a', icon:<svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>, name:'Invoicing',   desc:'Customer & supplier invoicing, payments'},
              {page:'purchases',  color:'#ea580c', icon:<svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>, name:'Purchases',   desc:'RFQ, purchase orders, price lists'},
              {page:'sales',      color:'#2563eb', icon:<svg viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>, name:'Sales',       desc:'Quotations, orders, upselling'},
              {page:'crm',        color:'#dc2626', icon:<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, name:'CRM',         desc:'Leads, opportunities, sales pipeline'},
              {page:'inventory',  color:'#0891b2', icon:<svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>, name:'Inventory',   desc:'Multi-store, products, valuation'},
              {page:'projects',   color:'#7c3aed', icon:<svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>, name:'Projects',    desc:'Tasks, time tracking, field services'},
              {page:'documents',  color:'#d97706', icon:<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>, name:'Documents',   desc:'Share, categorize, archive documents'},
            ].map(m=>(
              <div key={m.page} className="mod" onClick={()=>goPage(m.page)}>
                <div className="mod-ico" style={{color:m.color}}>{m.icon}</div>
                <div className="mod-name">{m.name}</div>
                <div className="mod-desc">{m.desc}</div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
