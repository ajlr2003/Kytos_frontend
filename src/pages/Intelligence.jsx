import Sidebar from '../components/Sidebar';
import '../styles/Intelligence.css';

function Intelligence({ goPage }) {
  return (
    <div id="intelligence-page">
      <Sidebar activePage="intelligence" goPage={goPage} extraNav={
        <>
          <div style={{ padding: '16px 12px 6px', fontSize: '10.5px', fontWeight: 700, color: '#9ca3af', letterSpacing: '.08em', textTransform: 'uppercase' }}>Intelligence Views</div>
          <a className="ni active" href="#" style={{ background: '#ede9fe', color: '#7c3aed' }}><svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Insights</a>
          <a className="ni" href="#"><svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>Simulations</a>
          <a className="ni" href="#"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Predictions</a>
        </>
      } />
      <div className="db-main">
        <div className="tb"><span className="tb-title"></span><div className="tb-right"><div className="tb-bell"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div><div className="tb-user"><div className="tb-avatar" style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)' }}>SJ</div><div><div className="tb-uname">Sarah Johns</div><div className="tb-urole">Administrator</div></div></div></div></div>
        <div className="pg">
          <div className="pg-header">
            <div className="pg-header-left"><h1>Intelligence Hub</h1><p>AI-powered analytics, predictive models, and scenario simulations for strategic insights</p></div>
            <div className="pg-header-actions">
              <button className="btn-action btn-green"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>Run Simulation</button>
              <button className="btn-action btn-purple"><svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Generate Forecast</button>
            </div>
          </div>

          {/* Top 3-col */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '18px', marginBottom: '18px' }}>
            {/* Model Health */}
            <div style={{ background: '#faf8ff', borderRadius: '12px', border: '1px solid #ede9fe', boxShadow: '0 1px 3px rgba(124,58,237,.06)', padding: '22px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}><div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Model Health</div><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }}></div></div>
              {[['Revenue Model','98.7%','#16a34a'],['Inventory Model','94.2%','#2563eb'],['Cash Flow Model','87.5%','#f59e0b']].map(([label,val,color]) => (
                <div key={label} style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><span style={{ fontSize: '13px', color: '#374151' }}>{label}</span><span style={{ fontSize: '13px', fontWeight: 700, color }}>{val}</span></div>
                  <div style={{ height: '7px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}><div style={{ width: val, height: '100%', background: color, borderRadius: '4px' }}></div></div>
                </div>
              ))}
            </div>
            {/* Data Sources */}
            <div style={{ background: '#faf8ff', borderRadius: '12px', border: '1px solid #ede9fe', boxShadow: '0 1px 3px rgba(124,58,237,.06)', padding: '22px 24px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Data Sources</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: '8px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#22c55e' }}></div><span style={{ fontSize: '13px', color: '#111827' }}>Accounting System</span></div><span style={{ fontSize: '12.5px', fontWeight: 600, color: '#16a34a' }}>Connected</span></div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: '8px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#22c55e' }}></div><span style={{ fontSize: '13px', color: '#111827' }}>Sales CRM</span></div><span style={{ fontSize: '12.5px', fontWeight: 600, color: '#16a34a' }}>Connected</span></div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fde68a', marginBottom: '8px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#f59e0b' }}></div><span style={{ fontSize: '13px', color: '#111827' }}>Inventory DB</span></div><span style={{ fontSize: '12.5px', fontWeight: 600, color: '#d97706' }}>Syncing</span></div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', background: '#fff5f5', border: '1px solid #fecaca' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ef4444' }}></div><span style={{ fontSize: '13px', color: '#111827' }}>External API</span></div><span style={{ fontSize: '12.5px', fontWeight: 600, color: '#dc2626' }}>Error</span></div>
            </div>
            {/* Anomaly Alerts */}
            <div style={{ background: '#faf8ff', borderRadius: '12px', border: '1px solid #ede9fe', boxShadow: '0 1px 3px rgba(124,58,237,.06)', padding: '22px 24px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Anomaly Alerts</div>
              <div style={{ padding: '12px 14px', borderRadius: '9px', background: '#fff5f5', border: '1px solid #fecaca', marginBottom: '8px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '3px' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626' }}>Cash Flow Drop</span></div><div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>Detected 23% decrease vs forecast</div><div style={{ fontSize: '11.5px', color: '#9ca3af' }}>2 hours ago</div></div>
              <div style={{ padding: '12px 14px', borderRadius: '9px', background: '#fffbeb', border: '1px solid #fde68a', marginBottom: '8px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '3px' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span style={{ fontSize: '13px', fontWeight: 700, color: '#d97706' }}>Inventory Spike</span></div><div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>Product X demand 40% above normal</div><div style={{ fontSize: '11.5px', color: '#9ca3af' }}>5 hours ago</div></div>
              <div style={{ padding: '12px 14px', borderRadius: '9px', background: '#eff6ff', border: '1px solid #bfdbfe' }}><div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '3px' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><span style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb' }}>Revenue Pattern</span></div><div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>New seasonal trend identified</div><div style={{ fontSize: '11.5px', color: '#9ca3af' }}>1 day ago</div></div>
            </div>
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
            {/* Revenue Forecast */}
            <div style={{ background: '#faf8ff', borderRadius: '12px', border: '1px solid #ede9fe', boxShadow: '0 1px 3px rgba(124,58,237,.06)', padding: '22px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}><div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Revenue Forecast</div><select style={{ height: '30px', padding: '0 22px 0 8px', border: '1px solid #ede9fe', borderRadius: '7px', fontSize: '12.5px', color: '#374151', background: '#fff', appearance: 'none', cursor: 'pointer' }}><option>Next 6 Months</option><option>Next 12 Months</option></select></div>
              <svg viewBox="0 0 460 200" style={{ width: '100%', height: '200px' }}>
                <line x1="40" y1="10" x2="40" y2="175" stroke="#e5e7eb" strokeWidth="1"/>
                <line x1="40" y1="175" x2="450" y2="175" stroke="#e5e7eb" strokeWidth="1"/>
                <text x="32" y="14" fontSize="9" fill="#9ca3af" textAnchor="end">1000</text>
                <text x="32" y="53" fontSize="9" fill="#9ca3af" textAnchor="end">950</text>
                <text x="32" y="92" fontSize="9" fill="#9ca3af" textAnchor="end">900</text>
                <text x="32" y="131" fontSize="9" fill="#9ca3af" textAnchor="end">850</text>
                <text x="32" y="170" fontSize="9" fill="#9ca3af" textAnchor="end">800</text>
                <line x1="40" y1="10" x2="450" y2="10" stroke="#f3f4f6" strokeWidth="1"/>
                <line x1="40" y1="49" x2="450" y2="49" stroke="#f3f4f6" strokeWidth="1"/>
                <line x1="40" y1="88" x2="450" y2="88" stroke="#f3f4f6" strokeWidth="1"/>
                <line x1="40" y1="127" x2="450" y2="127" stroke="#f3f4f6" strokeWidth="1"/>
                <path d="M50,148 L120,115 L190,88 L260,105 L330,74 L400,55 L450,32" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="5,4" fill="none"/>
                <path d="M50,168 L120,145 L190,128 L260,142 L330,118 L400,102 L450,82" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="5,4" fill="none"/>
                <path d="M50,148 L120,115 L190,88 L260,105 L330,74 L400,55 L450,32 L450,82 L400,102 L330,118 L260,142 L190,128 L120,145 L50,168 Z" fill="#7c3aed" fillOpacity="0.07"/>
                <path d="M50,158 L120,130 L190,108 L260,124 L330,96 L400,78 L450,57" stroke="#16a34a" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="50" cy="158" r="4" fill="#16a34a"/><circle cx="120" cy="130" r="4" fill="#16a34a"/>
                <circle cx="190" cy="108" r="4" fill="#16a34a"/><circle cx="260" cy="124" r="4" fill="#16a34a"/>
                <circle cx="330" cy="96" r="4" fill="#16a34a"/><circle cx="400" cy="78" r="4" fill="#16a34a"/>
                <circle cx="450" cy="57" r="4" fill="#16a34a"/>
                {['Jan','Feb','Mar','Apr','May','Jun'].map((m,i) => (
                  <text key={m} x={50+70*i} y="190" fontSize="9" fill="#9ca3af" textAnchor="middle">{m}</text>
                ))}
              </svg>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #ede9fe' }}>
                <div><div style={{ fontSize: '11.5px', color: '#9ca3af' }}>Current</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>$847K</div></div>
                <div><div style={{ fontSize: '11.5px', color: '#9ca3af' }}>Predicted</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#16a34a' }}>$923K</div></div>
                <div><div style={{ fontSize: '11.5px', color: '#9ca3af' }}>Confidence</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#7c3aed' }}>94.2%</div></div>
              </div>
            </div>
            {/* Cash Flow Projection */}
            <div style={{ background: '#faf8ff', borderRadius: '12px', border: '1px solid #ede9fe', boxShadow: '0 1px 3px rgba(124,58,237,.06)', padding: '22px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}><div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Cash Flow Projection</div><select style={{ height: '30px', padding: '0 22px 0 8px', border: '1px solid #ede9fe', borderRadius: '7px', fontSize: '12.5px', color: '#374151', background: '#fff', appearance: 'none', cursor: 'pointer' }}><option>Monthly View</option><option>Quarterly View</option></select></div>
              <svg viewBox="0 0 460 200" style={{ width: '100%', height: '200px' }}>
                <line x1="40" y1="10" x2="40" y2="175" stroke="#e5e7eb" strokeWidth="1"/>
                <line x1="40" y1="175" x2="450" y2="175" stroke="#e5e7eb" strokeWidth="1"/>
                <line x1="40" y1="100" x2="450" y2="100" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3,3"/>
                <text x="32" y="14" fontSize="9" fill="#9ca3af" textAnchor="end">1000</text>
                <text x="32" y="104" fontSize="9" fill="#9ca3af" textAnchor="end">0</text>
                <text x="32" y="175" fontSize="9" fill="#9ca3af" textAnchor="end">-1000</text>
                {[55,125,195,265,335,405].map((x,i) => <rect key={i} x={x} y={[40,35,38,32,36,30][i]} width="25" height={[60,65,62,68,64,70][i]} fill="#16a34a" rx="2"/>)}
                {[55,125,195,265,335,405].map((x,i) => <rect key={i+'r'} x={x} y="100" width="25" height={[55,60,52,58,56,50][i]} fill="#ef4444" rx="2"/>)}
                {['Jan','Feb','Mar','Apr','May','Jun'].map((m,i) => (
                  <text key={m} x={67+70*i} y="190" fontSize="9" fill="#9ca3af" textAnchor="middle">{m}</text>
                ))}
              </svg>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #ede9fe' }}>
                <div><div style={{ fontSize: '11.5px', color: '#9ca3af' }}>Inflow</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#16a34a' }}>$1.2M</div></div>
                <div><div style={{ fontSize: '11.5px', color: '#9ca3af' }}>Outflow</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#ef4444' }}>$987K</div></div>
                <div><div style={{ fontSize: '11.5px', color: '#9ca3af' }}>Net Flow</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#7c3aed' }}>+$213K</div></div>
              </div>
            </div>
          </div>

          {/* Inventory Demand Prediction */}
          <div style={{ background: '#faf8ff', borderRadius: '12px', border: '1px solid #ede9fe', boxShadow: '0 1px 3px rgba(124,58,237,.06)', padding: '22px 24px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}><div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Inventory Demand Prediction</div><select style={{ height: '30px', padding: '0 22px 0 8px', border: '1px solid #ede9fe', borderRadius: '7px', fontSize: '12.5px', color: '#374151', background: '#fff', appearance: 'none', cursor: 'pointer' }}><option>All Products</option></select></div>
            <svg viewBox="0 0 920 220" style={{ width: '100%', height: '180px' }}>
              <line x1="40" y1="10" x2="40" y2="185" stroke="#e5e7eb" strokeWidth="1"/>
              <line x1="40" y1="185" x2="910" y2="185" stroke="#e5e7eb" strokeWidth="1"/>
              <text x="32" y="14" fontSize="9" fill="#9ca3af" textAnchor="end">600</text>
              <text x="32" y="72" fontSize="9" fill="#9ca3af" textAnchor="end">400</text>
              <text x="32" y="130" fontSize="9" fill="#9ca3af" textAnchor="end">200</text>
              <text x="32" y="188" fontSize="9" fill="#9ca3af" textAnchor="end">0</text>
              <rect x="60" y="87" width="40" height="98" fill="#4f8ef7" rx="3"/><rect x="105" y="70" width="40" height="115" fill="#8b5cf6" rx="3"/>
              <rect x="240" y="110" width="40" height="75" fill="#4f8ef7" rx="3"/><rect x="285" y="92" width="40" height="93" fill="#8b5cf6" rx="3"/>
              <rect x="420" y="50" width="40" height="135" fill="#4f8ef7" rx="3"/><rect x="465" y="32" width="40" height="153" fill="#8b5cf6" rx="3"/>
              <rect x="600" y="118" width="40" height="67" fill="#4f8ef7" rx="3"/><rect x="645" y="100" width="40" height="85" fill="#8b5cf6" rx="3"/>
              <rect x="780" y="68" width="40" height="117" fill="#4f8ef7" rx="3"/><rect x="825" y="52" width="40" height="133" fill="#8b5cf6" rx="3"/>
              {['Product A','Product B','Product C','Product D','Product E'].map((p,i) => (
                <text key={p} x={103+180*i} y="200" fontSize="10" fill="#6b7280" textAnchor="middle">{p}</text>
              ))}
            </svg>
            <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: '#4f8ef7', borderRadius: '2px' }}></div><span style={{ fontSize: '12.5px', color: '#6b7280' }}>Current Stock</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: '#8b5cf6', borderRadius: '2px' }}></div><span style={{ fontSize: '12.5px', color: '#6b7280' }}>Predicted Demand</span></div>
            </div>
          </div>

          {/* Scenario Workspace */}
          <div style={{ background: '#faf8ff', borderRadius: '12px', border: '1px solid #ede9fe', boxShadow: '0 1px 3px rgba(124,58,237,.06)', padding: '22px 24px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '18px' }}>Scenario Workspace</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '16px' }}>What-If Analysis</div>
                {[['Market Growth Rate','-10%','5%','20%',-10,20,5],['Operating Costs','-20%','3%','30%',-20,30,3],['Staff Headcount','-15%','8%','25%',-15,25,8]].map(([label,min,cur,max,minV,maxV,defaultV]) => (
                  <div key={label} style={{ marginBottom: '18px' }}>
                    <div style={{ fontSize: '13px', color: '#374151', marginBottom: '6px' }}>{label}</div>
                    <input type="range" min={minV} max={maxV} defaultValue={defaultV} style={{ width: '100%', accentColor: '#7c3aed' }}/>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}><span style={{ fontSize: '11.5px', color: '#9ca3af' }}>{min}</span><span style={{ fontSize: '12px', fontWeight: 700, color: '#7c3aed' }}>{cur}</span><span style={{ fontSize: '11.5px', color: '#9ca3af' }}>{max}</span></div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '16px' }}>Key Assumptions</div>
                {[['Customer Acquisition Cost','$450 per customer'],['Monthly Churn Rate','2.3% per month'],['Average Order Value','$287 per order']].map(([title,sub]) => (
                  <div key={title} style={{ border: '1px solid #ede9fe', borderRadius: '9px', padding: '14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{title}</div><div style={{ fontSize: '12.5px', color: '#9ca3af', marginTop: '2px' }}>{sub}</div></div>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </div>
                ))}
                <button style={{ width: '100%', height: '42px', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', border: 'none', borderRadius: '9px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>Run Scenario Analysis
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Intelligence;
