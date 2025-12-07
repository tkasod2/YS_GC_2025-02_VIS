import { useSize } from "../hooks/useSize";

export default function SummaryBars({ data, budget }) {
  const [ref, { width, height }] = useSize();
  const W = Math.max(320, width), H = Math.max(260, height);
  const m = { top: 18, right: 18, bottom: 32, left: 90 };
  const iw = W - m.left - m.right, ih = H - m.top - m.bottom;

  const sorted = [...data].sort((a, b) => a.price - b.price).slice(0, 8);
  const minP = Math.min(...sorted.map(d => d.price), 0);
  const maxP = Math.max(...sorted.map(d => d.price), 1);
  const x = v => ((v - minP) / Math.max(1e-6, (maxP - minP))) * iw;

  return (
    <div className="panel" ref={ref}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <rect width={W} height={H} fill="#0b0f1a" />
        <g transform={`translate(${m.left},${m.top})`}>
          {sorted.map((d, i) => {
            const y = (i * ih) / sorted.length;
            const h = ih / sorted.length - 8;
            const ok = d.price <= budget;
            return (
              <g key={d.id} transform={`translate(0,${y})`}>
                <text x={-8} y={h/2} textAnchor="end" dominantBaseline="middle" fill="#cbd5e1" fontSize="12">
                  {d.dong}
                </text>
                <rect x={0} y={0} width={x(d.price)} height={h} rx={6} fill={ok ? "#22c55e" : "#475569"} />
                <text x={x(d.price)+6} y={h/2} dominantBaseline="middle" fill="#e2e8f0" fontSize="12">
                  {d.price.toFixed(1)}억 / {d.area}㎡
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
