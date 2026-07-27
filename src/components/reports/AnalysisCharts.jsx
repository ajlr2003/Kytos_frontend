/**
 * src/components/reports/AnalysisCharts.jsx
 *
 * Lightweight, dependency-free bar/line/pie charts shared by the Purchase
 * Analysis (Purchases → Reporting) and Sales Analysis (Sales → Reporting)
 * pages. No charting library — plain SVG.
 */

/* ─── Bar / line chart over a series of {label, total, count} buckets ─── */
export function AnalysisBarLineChart({ buckets, measure, type, hover, setHover }) {
  const W = 900, H = 320, padL = 56, padB = 32, padT = 16, padR = 16;
  const values = buckets.map(b => measure === 'count' ? b.count : b.total);
  const maxVal = Math.max(1, ...values);
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const step = buckets.length > 1 ? plotW / (buckets.length - 1) : plotW / 2;
  const barW = Math.min(48, (plotW / buckets.length) * 0.5);

  const yTicks = 5;
  const fmt = v => v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 2)}k` : v.toFixed(0);

  function xFor(i) { return buckets.length > 1 ? padL + i * step : padL + plotW / 2; }
  function yFor(v)  { return padT + plotH - (v / maxVal) * plotH; }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rpt-svg">
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const v = (maxVal / yTicks) * i;
        const y = yFor(v);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f0f0f0" />
            <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#9ca3af">{measure === 'count' ? Math.round(v) : fmt(v)}</text>
          </g>
        );
      })}

      {type === 'bar' ? buckets.map((b, i) => {
        const v = measure === 'count' ? b.count : b.total;
        const x = xFor(i) - barW / 2;
        const y = yFor(v);
        return (
          <g key={b.label}>
            <rect
              x={x} y={y} width={barW} height={plotH + padT - y}
              fill={hover === i ? '#053b2c' : '#074E3B'} rx="2"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            />
          </g>
        );
      }) : (
        <>
          <polyline
            fill="none" stroke="#074E3B" strokeWidth="2"
            points={buckets.map((b, i) => `${xFor(i)},${yFor(measure === 'count' ? b.count : b.total)}`).join(' ')}
          />
          {buckets.map((b, i) => (
            <circle
              key={b.label} cx={xFor(i)} cy={yFor(measure === 'count' ? b.count : b.total)} r={hover === i ? 5 : 3.5}
              fill="#074E3B" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }}
            />
          ))}
        </>
      )}

      {buckets.map((b, i) => (
        buckets.length <= 14 || i % Math.ceil(buckets.length / 14) === 0 ? (
          <text key={b.label} x={xFor(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#9ca3af">{b.label}</text>
        ) : null
      ))}

      {hover != null && buckets[hover] && (
        <foreignObject x={Math.min(Math.max(xFor(hover) - 90, 0), W - 190)} y={Math.max(yFor(measure === 'count' ? buckets[hover].count : buckets[hover].total) - 74, 0)} width="180" height="64">
          <div className="rpt-tooltip">
            <div className="rpt-tooltip-title">{measure === 'count' ? 'Count' : 'Untaxed Total'}</div>
            <div className="rpt-tooltip-row">
              <span className="rpt-tooltip-dot" />
              {buckets[hover].label}
              <strong>{measure === 'count' ? buckets[hover].count : `${fmt(buckets[hover].total)}`}</strong>
            </div>
          </div>
        </foreignObject>
      )}
    </svg>
  );
}

/* ─── Generic pie chart: slices = [{ label, value, color }] ─── */
export function AnalysisPieChart({ slices }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <div className="prd-empty">No data in the selected range.</div>;
  const r = 90, cx = 130, cy = 130;
  let cumAngle = 0;
  const paths = slices.filter(s => s.value > 0).map(s => {
    const startAngle = cumAngle;
    const sliceAngle = (s.value / total) * 2 * Math.PI;
    cumAngle += sliceAngle;
    const endAngle = cumAngle;
    const x1 = cx + r * Math.sin(startAngle), y1 = cy - r * Math.cos(startAngle);
    const x2 = cx + r * Math.sin(endAngle),   y2 = cy - r * Math.cos(endAngle);
    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    return { ...s, d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z` };
  });

  return (
    <div className="rpt-pie-wrap">
      <svg viewBox="0 0 260 260" width="260" height="260">
        {paths.map(p => <path key={p.label} d={p.d} fill={p.color} />)}
      </svg>
      <div className="rpt-pie-legend">
        {slices.map(s => (
          <div key={s.label}><span style={{ background: s.color }} /> {s.label} — {s.value}</div>
        ))}
      </div>
    </div>
  );
}
