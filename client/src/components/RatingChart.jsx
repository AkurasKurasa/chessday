import { useRef, useState } from "react";

const W = 640, H = 230, PL = 46, PR = 14, PT = 14, PB = 28;
const fmt = (t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function RatingChart({ series }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);
  if (series.length < 3) return <p className="muted">Not enough rated games to draw a line yet.</p>;

  const rs = series.map((d) => d.r);
  const lo = Math.floor((Math.min(...rs) - 15) / 25) * 25;
  const hi = Math.ceil((Math.max(...rs) + 15) / 25) * 25;
  const x = (i) => PL + (i / (series.length - 1)) * (W - PL - PR);
  const y = (r) => PT + ((hi - r) / (hi - lo)) * (H - PT - PB);
  const step = Math.max(25, Math.ceil((hi - lo) / 4 / 25) * 25);
  const ticks = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  const pts = series.map((d, i) => `${x(i).toFixed(1)},${y(d.r).toFixed(1)}`);
  const last = series.length - 1;
  const peak = rs.indexOf(Math.max(...rs));

  function onMove(e) {
    const b = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - b.left) / b.width) * W;
    const i = Math.max(0, Math.min(last, Math.round(((sx - PL) / (W - PL - PR)) * last)));
    setHover({ i, left: (x(i) / W) * b.width, top: (y(series[i].r) / H) * b.height });
  }

  const h = hover && series[hover.i];
  return (
    <div className="chart">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Rating from ${series[0].r} to ${series[last].r} over ${series.length} games`}>
        <g className="axis">
          {ticks.map((v) => (
            <g key={v}>
              <line className="grid-line" x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} />
              <text x={PL - 8} y={y(v) + 4} textAnchor="end">{v}</text>
            </g>
          ))}
          <text x={PL} y={H - 6}>{fmt(series[0].t)}</text>
          <text x={W - PR} y={H - 6} textAnchor="end">{fmt(series[last].t)}</text>
        </g>
        <path d={`M${pts[0]} L${pts.join(" L")} L${x(last)},${H - PB} L${PL},${H - PB}Z`} className="area" />
        <polyline points={pts.join(" ")} fill="none" stroke="var(--chart-line)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(peak)} cy={y(rs[peak])} r="6" fill="var(--pink)" stroke="var(--outline)" strokeWidth="2.5" />
        <text x={x(peak)} y={y(rs[peak]) - 12} textAnchor="middle" fill="var(--ink)" fontSize="14" fontWeight="800" fontFamily="var(--display)">peak {rs[peak]}</text>
        <circle cx={x(last)} cy={y(rs[last])} r="7" fill="var(--yellow)" stroke="var(--outline)" strokeWidth="2.5" />
        {h && (
          <>
            <line x1={x(hover.i)} x2={x(hover.i)} y1={PT} y2={H - PB} stroke="var(--ink)" strokeDasharray="4 4" opacity="0.5" />
            <circle cx={x(hover.i)} cy={y(h.r)} r="6" fill="var(--ink)" stroke="var(--outline)" strokeWidth="2.5" />
          </>
        )}
        <rect x={PL} y="0" width={W - PL - PR} height={H} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {h && (
        <div className="tip" style={{ left: hover.left, top: hover.top }}>
          {h.r} · {h.g.score === 1 ? "Won" : h.g.score === 0 ? "Lost" : "Drew"} vs {h.g.opp} · {fmt(h.t)}
        </div>
      )}
    </div>
  );
}
