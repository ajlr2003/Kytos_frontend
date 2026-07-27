/**
 * src/pages/Intelligence.jsx
 *
 * Business Intelligence module. Every number on this page is now either:
 *   - REAL: computed directly from your data (data-source health, cash flow
 *     totals/trend, current revenue, inventory demand from actual stock
 *     movements, order-data completeness, bank reconciliation rate), or
 *   - a disclosed SIMPLE MODEL built on real data (linear-trend revenue
 *     forecast with an honest R² confidence score, threshold-based anomaly
 *     detection, a live what-if calculator seeded from real baselines), or
 *   - explicitly flagged as having NO DATA SOURCE (Customer Acquisition
 *     Cost / Churn Rate — there is no marketing-spend or retention tracking
 *     anywhere in the backend to compute these from).
 *
 * There is no real ML model anywhere in this system, so "Model Health" was
 * replaced with "Data Health" — real completeness/reconciliation metrics.
 */

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Toast from '../components/ui/Toast';
import { API_BASE } from '../config.js';
import '../styles/Intelligence.css';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

function fmtMoney(n) {
  if (n == null || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
function fmtPct(n) { return n == null ? '—' : `${n.toFixed(1)}%`; }

const SOURCE_CHECKS = [
  { key: 'accounting', label: 'Accounting System', path: '/api/v1/accounting/kpis' },
  { key: 'crm',        label: 'Sales CRM',          path: '/api/v1/crm/kpis' },
  { key: 'inventory',  label: 'Inventory DB',        path: '/api/v1/inventory/kpis' },
  { key: 'odoo',       label: 'External API (Odoo)', path: '/api/v1/odoo/invoices/kpis' },
];

/** Simple least-squares linear fit. Returns null if fewer than 2 points or zero x-variance. */
function linearForecast(values) {
  const points = values.map((y, x) => ({ x, y }));
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const meanY = sumY / n;
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? null : Math.max(0, 1 - ssRes / ssTot);
  const nextX = n; // one step past the last known point
  const predicted = Math.max(0, slope * nextX + intercept);
  return { slope, r2, predicted };
}

/** Map a series of values onto an SVG polyline's point list within a fixed viewBox. */
function linePoints(values, { w = 460, h = 200, padL = 40, padR = 12, padT = 12, padB = 26 } = {}) {
  const max = Math.max(...values, 1);
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const step = values.length > 1 ? plotW / (values.length - 1) : 0;
  return values.map((v, i) => ({
    x: padL + step * i,
    y: padT + plotH - (v / max) * plotH,
  }));
}

function DemoBadge({ text = 'DEMO' }) {
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '5px', padding: '2px 7px', letterSpacing: '.03em' }}>
      {text}
    </span>
  );
}
function RealBadge() {
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '5px', padding: '2px 7px', letterSpacing: '.03em' }}>
      LIVE
    </span>
  );
}

function Intelligence({ goPage }) {
  const [toast, setToast] = useState(null);
  const showToast = (msg) => setToast(msg);

  const [sources, setSources] = useState(
    Object.fromEntries(SOURCE_CHECKS.map(s => [s.key, 'checking']))
  );
  const [cashFlow, setCashFlow] = useState(null);         // YTD totals
  const [cashFlowTrend, setCashFlowTrend] = useState(null); // monthly series
  const [revenue, setRevenue] = useState(null);            // current total_revenue
  const [revenueTrend, setRevenueTrend] = useState(null);  // monthly series + completeness
  const [demand, setDemand] = useState(null);               // top items + real predicted demand
  const [pricingCompleteness, setPricingCompleteness] = useState(null);

  // Scenario Workspace — controlled sliders, recompute live from real baseline
  const [marketGrowth, setMarketGrowth] = useState(5);
  const [opCostChange, setOpCostChange] = useState(3);
  const [headcountChange, setHeadcountChange] = useState(8);

  useEffect(() => {
    SOURCE_CHECKS.forEach(({ key, path }) => {
      fetch(`${API_BASE}${path}`, { headers: authHeaders() })
        .then(r => setSources(s => ({ ...s, [key]: r.ok ? 'connected' : 'error' })))
        .catch(() => setSources(s => ({ ...s, [key]: 'error' })));
    });

    fetch(`${API_BASE}/api/v1/accounting/reports/cash-flow`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null).then(d => { if (d) setCashFlow(d); }).catch(() => {});

    fetch(`${API_BASE}/api/v1/accounting/reports/cash-flow-trend`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null).then(d => { if (d) setCashFlowTrend(d); }).catch(() => {});

    fetch(`${API_BASE}/api/v1/dashboard/sales`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null).then(d => { if (d) setRevenue(d.total_revenue); }).catch(() => {});

    fetch(`${API_BASE}/api/v1/dashboard/revenue-trend`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null).then(d => { if (d) setRevenueTrend(d); }).catch(() => {});

    fetch(`${API_BASE}/api/v1/inventory/demand-forecast?limit=5`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null).then(d => { if (d) setDemand(d.items ?? []); }).catch(() => {});

    fetch(`${API_BASE}/api/v1/inventory/items?limit=500`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        const items = d.items ?? [];
        if (items.length === 0) { setPricingCompleteness(null); return; }
        const priced = items.filter(i => i.unit_price != null).length;
        setPricingCompleteness(Math.round((priced / items.length) * 1000) / 10);
      })
      .catch(() => {});
  }, []);

  const SOURCE_STYLE = {
    connected: { bg: '#f0fdf4', border: '#bbf7d0', dot: '#22c55e', text: '#16a34a', label: 'Connected' },
    error:     { bg: '#fff5f5', border: '#fecaca', dot: '#ef4444', text: '#dc2626', label: 'Error' },
    checking:  { bg: '#f9fafb', border: '#e5e7eb', dot: '#9ca3af', text: '#6b7280', label: 'Checking…' },
  };

  // ── Real linear-trend revenue forecast ──────────────────────────────────
  const revenueForecast = useMemo(() => {
    if (!revenueTrend?.months?.length) return null;
    return linearForecast(revenueTrend.months.map(m => m.total));
  }, [revenueTrend]);

  // ── Real threshold-based anomaly detection (>25% deviation from trailing average) ──
  const anomalies = useMemo(() => {
    const found = [];
    if (revenueTrend?.months?.length >= 3) {
      const months = revenueTrend.months;
      const latest = months[months.length - 1].total;
      const prior = months.slice(0, -1);
      const avg = prior.reduce((s, m) => s + m.total, 0) / prior.length;
      if (avg > 0) {
        const dev = (latest - avg) / avg;
        if (Math.abs(dev) >= 0.25) {
          found.push({
            key: 'revenue', color: dev < 0 ? '#dc2626' : '#2563eb', bg: dev < 0 ? '#fff5f5' : '#eff6ff', border: dev < 0 ? '#fecaca' : '#bfdbfe',
            title: dev < 0 ? 'Revenue Drop' : 'Revenue Spike',
            detail: `${months[months.length - 1].label} revenue is ${Math.abs(dev * 100).toFixed(0)}% ${dev < 0 ? 'below' : 'above'} the trailing average`,
          });
        }
      }
    }
    if (cashFlowTrend?.months?.length >= 3) {
      const months = cashFlowTrend.months;
      const latest = months[months.length - 1].net;
      const prior = months.slice(0, -1);
      const avgAbs = prior.reduce((s, m) => s + Math.abs(m.net), 0) / prior.length;
      if (avgAbs > 0) {
        const dev = (latest - months[0].net) ; // fallback direction signal
        const pctDev = Math.abs(latest - (prior.reduce((s,m)=>s+m.net,0)/prior.length)) / avgAbs;
        if (pctDev >= 0.25) {
          found.push({
            key: 'cashflow', color: latest < 0 ? '#dc2626' : '#d97706', bg: latest < 0 ? '#fff5f5' : '#fffbeb', border: latest < 0 ? '#fecaca' : '#fde68a',
            title: 'Cash Flow Shift',
            detail: `${months[months.length - 1].label} net cash flow moved sharply vs. the trailing average`,
          });
        }
      }
    }
    if (demand && demand.length > 0) {
      const risk = demand.find(i => i.has_movement_history && i.predicted_demand > i.current_stock);
      if (risk) {
        found.push({
          key: 'stockout', color: '#d97706', bg: '#fffbeb', border: '#fde68a',
          title: 'Stockout Risk',
          detail: `${risk.name}: projected monthly demand (${risk.predicted_demand}) exceeds current stock (${risk.current_stock})`,
        });
      }
    }
    return found.slice(0, 3);
  }, [revenueTrend, cashFlowTrend, demand]);

  // ── Live Scenario Workspace — real baseline, disclosed simple model ────
  const baselineRevenue = revenue ?? 0;
  const baselineCosts = cashFlow?.total_outflows ?? 0;
  const projectedRevenue = baselineRevenue * (1 + marketGrowth / 100);
  // Simplifying assumption (disclosed in UI): operating costs scale with
  // opCostChange directly, and headcount change carries half-weight since
  // labor is typically a large but not sole share of opex. No payroll data
  // exists to model this precisely.
  const projectedCosts = baselineCosts * (1 + (opCostChange + headcountChange * 0.5) / 100);
  const projectedNet = projectedRevenue - projectedCosts;

  const avgOrderValue = (revenueTrend?.total_orders ?? 0) > 0
    ? (revenue ?? 0) / revenueTrend.total_orders
    : null;

  const revValues = revenueTrend?.months?.map(m => m.total) ?? [];
  const revPts = revValues.length ? linePoints([...revValues, revenueForecast?.predicted ?? revValues[revValues.length - 1]]) : [];
  const cfMonths = cashFlowTrend?.months ?? [];
  const cfMaxAbs = Math.max(1, ...cfMonths.map(m => Math.max(m.inflow, m.outflow)));

  return (
    <div id="intelligence-page">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      <Sidebar activePage="intelligence" goPage={goPage} extraNav={
        <>
          <div style={{ padding: '16px 12px 6px', fontSize: '10.5px', fontWeight: 700, color: '#9ca3af', letterSpacing: '.08em', textTransform: 'uppercase' }}>Intelligence Views</div>
          <a className="ni active" href="#" style={{ background: '#ede9fe', color: '#7c3aed' }}><svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Insights</a>
          <a className="ni" href="#" onClick={e => { e.preventDefault(); showToast('Simulations use the live Scenario Workspace below'); }}><svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>Simulations</a>
          <a className="ni" href="#" onClick={e => { e.preventDefault(); showToast('The Revenue Forecast and Inventory Demand cards below are live predictions'); }}><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Predictions</a>
        </>
      } />
      <div className="db-main">
        <div className="tb"><span className="tb-title"></span><div className="tb-right"><div className="tb-bell"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div><div className="tb-user"><div className="tb-avatar" style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)' }}>SJ</div><div><div className="tb-uname">Sarah Johns</div><div className="tb-urole">Administrator</div></div></div></div></div>
        <div className="pg">
          <div className="pg-header">
            <div className="pg-header-left"><h1>Intelligence Hub</h1><p>Live data checks, real trend-based forecasts, and a real-baseline what-if calculator — DEMO badges mark the few things with no real data source</p></div>
            <div className="pg-header-actions">
              <button className="btn-action btn-green" onClick={() => document.getElementById('scenario-workspace')?.scrollIntoView({ behavior: 'smooth' })}><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>Run Simulation</button>
              <button className="btn-action btn-purple" onClick={() => showToast(revenueForecast ? `Next-month forecast: ${fmtMoney(revenueForecast.predicted)}` : 'Not enough order history yet to forecast')}><svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Generate Forecast</button>
            </div>
          </div>

          {/* Top 3-col */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '18px', marginBottom: '18px' }}>
            {/* Data Health — real completeness/reconciliation metrics, replaces "Model Health" (no real ML exists) */}
            <div style={{ background: '#faf8ff', borderRadius: '12px', border: '1px solid #ede9fe', boxShadow: '0 1px 3px rgba(124,58,237,.06)', padding: '22px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Data Health</div><RealBadge /></div></div>
              {[
                ['Order Data Completeness', revenueTrend?.data_completeness_pct, '#16a34a'],
                ['Bank Reconciliation', cashFlowTrend?.reconciliation_pct, '#2563eb'],
                ['Inventory Pricing Coverage', pricingCompleteness, '#f59e0b'],
              ].map(([label, pct, color]) => (
                <div key={label} style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><span style={{ fontSize: '13px', color: '#374151' }}>{label}</span><span style={{ fontSize: '13px', fontWeight: 700, color }}>{pct == null ? 'No data' : fmtPct(pct)}</span></div>
                  <div style={{ height: '7px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}><div style={{ width: `${pct ?? 0}%`, height: '100%', background: color, borderRadius: '4px' }}></div></div>
                </div>
              ))}
            </div>
            {/* Data Sources — real connectivity checks */}
            <div style={{ background: '#faf8ff', borderRadius: '12px', border: '1px solid #ede9fe', boxShadow: '0 1px 3px rgba(124,58,237,.06)', padding: '22px 24px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Data Sources</div>
              {SOURCE_CHECKS.map(({ key, label }) => {
                const st = SOURCE_STYLE[sources[key]];
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', background: st.bg, border: `1px solid ${st.border}`, marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '9px', height: '9px', borderRadius: '50%', background: st.dot }}></div><span style={{ fontSize: '13px', color: '#111827' }}>{label}</span></div>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: st.text }}>{st.label}</span>
                  </div>
                );
              })}
            </div>
            {/* Anomaly Alerts — real threshold-based detection */}
            <div style={{ background: '#faf8ff', borderRadius: '12px', border: '1px solid #ede9fe', boxShadow: '0 1px 3px rgba(124,58,237,.06)', padding: '22px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Anomaly Alerts</div><RealBadge /></div>
              {anomalies.length === 0 ? (
                <div style={{ fontSize: '12.5px', color: '#9ca3af', padding: '8px 0' }}>No anomalies detected — all metrics within 25% of their trailing average.</div>
              ) : anomalies.map(a => (
                <div key={a.key} style={{ padding: '12px 14px', borderRadius: '9px', background: a.bg, border: `1px solid ${a.border}`, marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '3px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={a.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: a.color }}>{a.title}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{a.detail}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
            {/* Revenue Forecast — real linear trend + honest R² confidence */}
            <div style={{ background: '#faf8ff', borderRadius: '12px', border: '1px solid #ede9fe', boxShadow: '0 1px 3px rgba(124,58,237,.06)', padding: '22px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Revenue Forecast</div><RealBadge /></div><span style={{ fontSize: '11px', color: '#9ca3af' }}>Linear trend, last 6 months</span></div>
              {revValues.length < 2 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Loading…</div>
              ) : (
                <svg viewBox="0 0 460 200" style={{ width: '100%', height: '200px' }}>
                  <line x1="40" y1="10" x2="40" y2="175" stroke="#e5e7eb" strokeWidth="1"/>
                  <line x1="40" y1="175" x2="450" y2="175" stroke="#e5e7eb" strokeWidth="1"/>
                  <polyline fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    points={revPts.slice(0, revValues.length).map(p => `${p.x},${p.y}`).join(' ')} />
                  {revPts.length > revValues.length && (
                    <line x1={revPts[revValues.length - 1].x} y1={revPts[revValues.length - 1].y} x2={revPts[revValues.length].x} y2={revPts[revValues.length].y} stroke="#7c3aed" strokeWidth="2.5" strokeDasharray="5,4" strokeLinecap="round"/>
                  )}
                  {revPts.slice(0, revValues.length).map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="#16a34a"/>)}
                  {revPts.length > revValues.length && <circle cx={revPts[revValues.length].x} cy={revPts[revValues.length].y} r="4" fill="#7c3aed"/>}
                  {(revenueTrend?.months ?? []).map((m, i) => (
                    <text key={m.label + i} x={40 + (410 / Math.max(1, revValues.length)) * i} y="190" fontSize="9" fill="#9ca3af" textAnchor="middle">{m.label}</text>
                  ))}
                  <text x={revPts[revPts.length - 1]?.x ?? 450} y="190" fontSize="9" fill="#7c3aed" textAnchor="middle">Next</text>
                </svg>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #ede9fe' }}>
                <div><div style={{ fontSize: '11.5px', color: '#9ca3af' }}>Current Month</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{fmtMoney(revValues[revValues.length - 1])}</div></div>
                <div><div style={{ fontSize: '11.5px', color: '#9ca3af' }}>Next Month (trend)</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#16a34a' }}>{revenueForecast ? fmtMoney(revenueForecast.predicted) : '—'}</div></div>
                <div><div style={{ fontSize: '11.5px', color: '#9ca3af' }}>Fit Confidence (R²)</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#7c3aed' }}>{revenueForecast?.r2 != null ? fmtPct(revenueForecast.r2 * 100) : 'N/A'}</div></div>
              </div>
            </div>
            {/* Cash Flow — real monthly trend */}
            <div style={{ background: '#faf8ff', borderRadius: '12px', border: '1px solid #ede9fe', boxShadow: '0 1px 3px rgba(124,58,237,.06)', padding: '22px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Cash Flow</div><RealBadge /></div>{cashFlow && <span style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '5px', padding: '2px 7px' }}>{cashFlow.period_label}</span>}</div>
              {cfMonths.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Loading…</div>
              ) : (
                <svg viewBox="0 0 460 200" style={{ width: '100%', height: '200px' }}>
                  <line x1="40" y1="10" x2="40" y2="175" stroke="#e5e7eb" strokeWidth="1"/>
                  <line x1="40" y1="175" x2="450" y2="175" stroke="#e5e7eb" strokeWidth="1"/>
                  <line x1="40" y1="92" x2="450" y2="92" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3,3"/>
                  <text x="32" y="14" fontSize="9" fill="#9ca3af" textAnchor="end">{fmtMoney(cfMaxAbs)}</text>
                  <text x="32" y="96" fontSize="9" fill="#9ca3af" textAnchor="end">0</text>
                  {cfMonths.map((m, i) => {
                    const cx = 55 + (395 / cfMonths.length) * i;
                    const barW = Math.min(25, 395 / cfMonths.length / 2 - 4);
                    const inH = (m.inflow / cfMaxAbs) * 82;
                    const outH = (m.outflow / cfMaxAbs) * 82;
                    return (
                      <g key={m.label + i}>
                        <rect x={cx} y={92 - inH} width={barW} height={inH} fill="#16a34a" rx="2"/>
                        <rect x={cx} y="92" width={barW} height={outH} fill="#ef4444" rx="2"/>
                        <text x={cx + barW / 2} y="190" fontSize="9" fill="#9ca3af" textAnchor="middle">{m.label}</text>
                      </g>
                    );
                  })}
                </svg>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #ede9fe' }}>
                <div><div style={{ fontSize: '11.5px', color: '#9ca3af' }}>Inflow (YTD)</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#16a34a' }}>{cashFlow ? fmtMoney(cashFlow.total_inflows) : '—'}</div></div>
                <div><div style={{ fontSize: '11.5px', color: '#9ca3af' }}>Outflow (YTD)</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#ef4444' }}>{cashFlow ? fmtMoney(cashFlow.total_outflows) : '—'}</div></div>
                <div><div style={{ fontSize: '11.5px', color: '#9ca3af' }}>Net Flow (YTD)</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#7c3aed' }}>{cashFlow ? fmtMoney(cashFlow.net_cash_flow) : '—'}</div></div>
              </div>
            </div>
          </div>

          {/* Inventory Demand Prediction — real current stock + real velocity-based projection */}
          <div style={{ background: '#faf8ff', borderRadius: '12px', border: '1px solid #ede9fe', boxShadow: '0 1px 3px rgba(124,58,237,.06)', padding: '22px 24px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Inventory Demand Prediction</div><RealBadge /></div><span style={{ fontSize: '11px', color: '#9ca3af' }}>Predicted = avg. monthly OUT movements, trailing 90 days</span></div>
            {!demand ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Loading…</div>
            ) : demand.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>No stock data yet.</div>
            ) : (
              <>
                <svg viewBox="0 0 920 220" style={{ width: '100%', height: '180px' }}>
                  <line x1="40" y1="10" x2="40" y2="185" stroke="#e5e7eb" strokeWidth="1"/>
                  <line x1="40" y1="185" x2="910" y2="185" stroke="#e5e7eb" strokeWidth="1"/>
                  {(() => {
                    const maxV = Math.max(1, ...demand.map(i => Math.max(i.current_stock, i.predicted_demand)));
                    return (
                      <>
                        <text x="32" y="14" fontSize="9" fill="#9ca3af" textAnchor="end">{maxV}</text>
                        <text x="32" y="188" fontSize="9" fill="#9ca3af" textAnchor="end">0</text>
                        {demand.map((item, i) => {
                          const cx = 100 + 180 * i;
                          const h = (item.current_stock / maxV) * 165;
                          const predH = (item.predicted_demand / maxV) * 165;
                          return (
                            <g key={item.id}>
                              <rect x={cx - 45} y={185 - h} width="40" height={h} fill="#4f8ef7" rx="3"/>
                              {item.has_movement_history
                                ? <rect x={cx} y={185 - predH} width="40" height={predH} fill="#8b5cf6" rx="3"/>
                                : <text x={cx + 20} y="180" fontSize="8.5" fill="#9ca3af" textAnchor="middle">no history</text>}
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                  {demand.map((item, i) => (
                    <text key={item.id + 'lbl'} x={103 + 180 * i} y="205" fontSize="9.5" fill="#6b7280" textAnchor="middle">
                      {(item.name ?? 'Item').slice(0, 14)}
                    </text>
                  ))}
                </svg>
                <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: '#4f8ef7', borderRadius: '2px' }}></div><span style={{ fontSize: '12.5px', color: '#6b7280' }}>Current Stock</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: '#8b5cf6', borderRadius: '2px' }}></div><span style={{ fontSize: '12.5px', color: '#6b7280' }}>Predicted Monthly Demand</span></div>
                </div>
              </>
            )}
          </div>

          {/* Scenario Workspace — live calculator on real baseline */}
          <div id="scenario-workspace" style={{ background: '#faf8ff', borderRadius: '12px', border: '1px solid #ede9fe', boxShadow: '0 1px 3px rgba(124,58,237,.06)', padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}><div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Scenario Workspace</div><RealBadge /></div>
            <div style={{ fontSize: '11.5px', color: '#9ca3af', marginBottom: '16px' }}>Baseline = your real current revenue &amp; YTD costs. Simplified model: revenue scales with Market Growth; costs scale with Operating Costs + half of Headcount change (no payroll data exists to model this precisely).</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '16px' }}>What-If Analysis</div>
                {[
                  { label: 'Market Growth Rate', min: -10, max: 20, value: marketGrowth, set: setMarketGrowth },
                  { label: 'Operating Costs',    min: -20, max: 30, value: opCostChange, set: setOpCostChange },
                  { label: 'Staff Headcount',    min: -15, max: 25, value: headcountChange, set: setHeadcountChange },
                ].map(({ label, min, max, value, set }) => (
                  <div key={label} style={{ marginBottom: '18px' }}>
                    <div style={{ fontSize: '13px', color: '#374151', marginBottom: '6px' }}>{label}</div>
                    <input type="range" min={min} max={max} value={value} onChange={e => set(Number(e.target.value))} style={{ width: '100%', accentColor: '#7c3aed' }}/>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}><span style={{ fontSize: '11.5px', color: '#9ca3af' }}>{min}%</span><span style={{ fontSize: '12px', fontWeight: 700, color: '#7c3aed' }}>{value >= 0 ? '+' : ''}{value}%</span><span style={{ fontSize: '11.5px', color: '#9ca3af' }}>{max}%</span></div>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid #ede9fe' }}>
                  <div><div style={{ fontSize: '11px', color: '#9ca3af' }}>Proj. Revenue</div><div style={{ fontSize: '15px', fontWeight: 700, color: '#16a34a' }}>{fmtMoney(projectedRevenue)}</div></div>
                  <div><div style={{ fontSize: '11px', color: '#9ca3af' }}>Proj. Costs</div><div style={{ fontSize: '15px', fontWeight: 700, color: '#ef4444' }}>{fmtMoney(projectedCosts)}</div></div>
                  <div><div style={{ fontSize: '11px', color: '#9ca3af' }}>Proj. Net</div><div style={{ fontSize: '15px', fontWeight: 700, color: '#7c3aed' }}>{fmtMoney(projectedNet)}</div></div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '16px' }}>Key Assumptions</div>
                <div style={{ border: '1px solid #ede9fe', borderRadius: '9px', padding: '14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>Average Order Value</div><div style={{ fontSize: '12.5px', color: '#9ca3af', marginTop: '2px' }}>{avgOrderValue != null ? `${fmtMoney(avgOrderValue)} per order` : 'No orders yet'}</div></div>
                  <RealBadge />
                </div>
                {[['Customer Acquisition Cost'], ['Monthly Churn Rate']].map(([title]) => (
                  <div key={title} style={{ border: '1px solid #ede9fe', borderRadius: '9px', padding: '14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.7 }}>
                    <div><div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{title}</div><div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>No data source — needs marketing spend / retention tracking</div></div>
                    <DemoBadge text="NO DATA" />
                  </div>
                ))}
                <button
                  onClick={() => showToast(`Scenario: Revenue ${fmtMoney(projectedRevenue)}, Costs ${fmtMoney(projectedCosts)}, Net ${fmtMoney(projectedNet)}`)}
                  style={{ width: '100%', height: '42px', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', border: 'none', borderRadius: '9px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
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
