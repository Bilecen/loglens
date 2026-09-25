// Bağımlılıksız, hafif grafik bileşenleri (Tailwind + CSS değişkenleri ile).
import { useState } from "react";
import { tGlobal } from "./i18n";

const PALETTE = {
  critical: "#f43f5e", high: "#f59e0b", medium: "#6366f1", low: "#94a3b8",
  mobile: "#8b5cf6", web: "#06b6d4", service: "#10b981", unknown: "#94a3b8",
  open: "#6366f1", investigating: "#f59e0b", resolved: "#10b981", ignored: "#94a3b8",
};
export const colorFor = (k) => PALETTE[k] || "#6366f1";

const Empty = ({ h }) => (
  <div className="flex items-center justify-center text-faint text-[13px]" style={{ height: h }}>
    {tGlobal("charts.noData")}
  </div>
);

// "Güzel" bir tavan sayı bul (grafik y-ekseni 12 → 15, 23 → 25 gibi).
function niceMax(v) {
  if (v <= 5) return 5;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

// Az sayıda ise hepsini, çoksa ~6 eşit aralıklı etiketi göster.
function tickIdx(len, want = 6) {
  if (len <= want) return new Set(Array.from({ length: len }, (_, i) => i));
  const s = new Set();
  for (let k = 0; k < want; k++) s.add(Math.round((k * (len - 1)) / (want - 1)));
  return s;
}

export function BarChart({ data, height = 180 }) {
  const [hi, setHi] = useState(null);
  if (!data?.length) return <Empty h={height} />;

  const rawMax = Math.max(...data.map((d) => d.count));
  const ceil = niceMax(Math.max(1, rawMax));
  const avg = data.reduce((s, d) => s + d.count, 0) / data.length;
  const ticks = [ceil, ceil * 0.75, ceil * 0.5, ceil * 0.25, 0];
  const labels = tickIdx(data.length);

  return (
    <div className="select-none">
      <div className="flex gap-2.5" style={{ height }}>
        {/* Y ekseni */}
        <div className="flex flex-col justify-between text-faint text-[10px] font-mono text-right w-7 shrink-0 -mt-1.5">
          {ticks.map((t) => <span key={t}>{Math.round(t)}</span>)}
        </div>

        {/* Çizim alanı */}
        <div className="relative flex-1 min-w-0">
          {/* Izgara çizgileri */}
          {ticks.map((t, i) => (
            <div key={i} className="absolute left-0 right-0 border-t border-dashed"
              style={{ top: `${(i / (ticks.length - 1)) * 100}%`, borderColor: "var(--border)", opacity: i === ticks.length - 1 ? 0.9 : 0.5 }} />
          ))}
          {/* Ortalama çizgisi */}
          {rawMax > 0 && (
            <div className="absolute left-0 right-0 border-t-2 border-dotted pointer-events-none"
              style={{ top: `${(1 - avg / ceil) * 100}%`, borderColor: "var(--accent)", opacity: 0.35 }}>
              <span className="absolute right-0 -top-4 text-[9.5px] font-mono px-1"
                style={{ color: "var(--accent)" }}>ort {avg.toFixed(1)}</span>
            </div>
          )}
          {/* Çubuklar */}
          <div className="absolute inset-0 flex items-end gap-[3px]">
            {data.map((d, i) => {
              const pct = (d.count / ceil) * 100;
              const active = hi === i;
              return (
                <div key={d.day} className="flex-1 h-full flex items-end min-w-0"
                  onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
                  <div className="w-full rounded-t-[3px] transition-all duration-200"
                    style={{
                      height: `${Math.max(pct, d.count ? 2 : 0)}%`,
                      background: d.count
                        ? "linear-gradient(180deg, var(--accent-2), var(--accent))"
                        : "var(--panel-3)",
                      opacity: hi === null || active ? 1 : 0.45,
                      boxShadow: active ? "0 0 0 1px var(--accent)" : "none",
                    }} />
                </div>
              );
            })}
          </div>

          {/* Tooltip */}
          {hi !== null && (
            <div className="absolute -top-2 -translate-y-full -translate-x-1/2 pointer-events-none z-10 whitespace-nowrap
                            rounded-lg px-2.5 py-1.5 text-[11px] shadow-lg border"
              style={{
                left: `${((hi + 0.5) / data.length) * 100}%`,
                background: "var(--panel)", borderColor: "var(--border-strong)",
              }}>
              <div className="font-mono text-faint text-[10px]">{data[hi].day}</div>
              <div className="font-bold text-fg">{data[hi].count} olay</div>
            </div>
          )}
        </div>
      </div>

      {/* X ekseni tarih etiketleri */}
      <div className="flex gap-[3px] mt-2 ml-[38px]">
        {data.map((d, i) => (
          <span key={d.day} className="flex-1 text-center text-faint text-[10px] font-mono truncate">
            {labels.has(i) ? d.day?.slice(5) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BreakdownBars({ data, labels = {} }) {
  if (!data?.length) return <Empty h={120} />;
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  return (
    <div className="flex flex-col gap-3.5">
      {data.map((d) => {
        const pct = (d.count / total) * 100;
        return (
          <div key={d.key} className="flex items-center gap-3">
            <span className="w-[92px] text-[12.5px] font-semibold capitalize flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorFor(d.key) }} />
              {labels[d.key] || d.key}
            </span>
            <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "var(--panel-3)" }}>
              <div className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%`, background: colorFor(d.key) }} />
            </div>
            <span className="w-12 text-right text-[12px] tabular-nums">
              <span className="font-bold text-fg">{d.count}</span>
              <span className="text-faint ml-1">%{Math.round(pct)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Donut({ data, labels = {}, size = 150 }) {
  const [hi, setHi] = useState(null);
  if (!data?.length) return <Empty h={size} />;
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const r = 15.9155;
  let acc = 0;
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 42 42" style={{ width: size, height: size }} className="shrink-0 -rotate-90">
        <circle cx="21" cy="21" r={r} fill="transparent" stroke="var(--panel-3)" strokeWidth="4" />
        {data.map((d, i) => {
          const frac = d.count / total;
          const gap = 0.6; // segmentler arası ince boşluk
          const dash = `${Math.max(frac * 100 - gap, 0)} ${100 - Math.max(frac * 100 - gap, 0)}`;
          const offset = -acc * 100;
          acc += frac;
          const dim = hi !== null && hi !== i;
          return (
            <circle key={d.key} cx="21" cy="21" r={r} fill="transparent" stroke={colorFor(d.key)}
              strokeWidth={hi === i ? 5.4 : 4} strokeDasharray={dash} strokeDashoffset={offset}
              strokeLinecap="butt" className="transition-all duration-200"
              style={{ opacity: dim ? 0.35 : 1 }}
              onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
              <title>{`${labels[d.key] || d.key}: ${d.count} (%${Math.round(frac * 100)})`}</title>
            </circle>
          );
        })}
        <g className="rotate-90" style={{ transformOrigin: "center" }}>
          <text x="21" y="20.5" textAnchor="middle" fontSize="8" fill="var(--text)" fontWeight="800">
            {hi !== null ? data[hi].count : total}
          </text>
          <text x="21" y="25.5" textAnchor="middle" fontSize="2.7" fill="var(--muted)" fontWeight="600">
            {hi !== null ? (labels[data[hi].key] || data[hi].key) : tGlobal("charts.total")}
          </text>
        </g>
      </svg>
      <div className="flex flex-col gap-2.5 text-[12.5px] flex-1">
        {data.map((d, i) => (
          <div key={d.key} className="flex items-center gap-2 font-medium cursor-default transition-opacity"
            style={{ opacity: hi !== null && hi !== i ? 0.4 : 1 }}
            onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
            <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: colorFor(d.key) }} />
            <span className="capitalize">{labels[d.key] || d.key}</span>
            <span className="ml-auto tabular-nums">
              <span className="font-bold">{d.count}</span>
              <span className="text-faint ml-1.5">%{Math.round((d.count / total) * 100)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
