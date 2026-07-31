"use client";

import { useState } from "react";

export function TrendChart({ data }: { data: { date: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <div className="grid h-40 place-items-center text-sm text-muted">Sem dados suficientes no período.</div>
    );
  }

  const w = 640;
  const h = 200;
  const padX = 6;
  const padTop = 26;
  const padBottom = 6;
  const max = Math.max(...data.map((d) => d.value), 1);
  const x = (i: number) => padX + (i / (data.length - 1)) * (w - 2 * padX);
  const y = (v: number) => padTop + (1 - v / max) * (h - padTop - padBottom);
  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h - padBottom} L${pts[0][0].toFixed(1)},${h - padBottom} Z`;
  const peak = data.reduce((mi, d, i, arr) => (d.value > arr[mi].value ? i : mi), 0);

  function onMove(e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    const frac = (cx - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(frac * (data.length - 1)))));
  }

  const fmtDate = (s: string) => {
    const [, m, d] = s.split("-");
    return `${d}/${m}`;
  };

  const hx = hover !== null ? x(hover) : 0;
  const hy = hover !== null ? y(data[hover].value) : 0;

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="block w-full touch-none"
        style={{ height: "auto" }}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onTouchStart={onMove}
        onTouchMove={onMove}
        onTouchEnd={() => setHover(null)}
      >
        <defs>
          <linearGradient id="trendg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1c6fce" stopOpacity="0.28" />
            <stop offset="1" stopColor="#1c6fce" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g) => {
          const gy = padTop + (1 - g) * (h - padTop - padBottom);
          return <line key={g} x1={padX} x2={w - padX} y1={gy} y2={gy} stroke="#e7edf5" strokeWidth="1" />;
        })}
        <path d={area} fill="url(#trendg)" />
        <path d={line} fill="none" stroke="#1c6fce" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {hover === null && (
          <>
            <circle cx={x(peak)} cy={y(data[peak].value)} r="4.5" fill="#1c6fce" stroke="white" strokeWidth="2.5" />
            <text
              x={Math.min(Math.max(x(peak), 40), w - 40)}
              y={Math.max(y(data[peak].value) - 10, 14)}
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill="#154f97"
            >
              {data[peak].value.toLocaleString("pt-BR")}
            </text>
          </>
        )}

        {hover !== null && (
          <>
            <line x1={hx} x2={hx} y1={padTop} y2={h - padBottom} stroke="#1c6fce" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <circle cx={hx} cy={hy} r="5.5" fill="#1c6fce" stroke="white" strokeWidth="2.5" />
          </>
        )}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-white shadow-pop"
          style={{ left: `${(hx / w) * 100}%`, top: `${(hy / h) * 100}%`, marginTop: "-10px" }}
        >
          {data[hover].value.toLocaleString("pt-BR")}
          <span className="ml-1.5 font-normal opacity-70">{fmtDate(data[hover].date)}</span>
        </div>
      )}
    </div>
  );
}
