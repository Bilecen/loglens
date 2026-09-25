import { useEffect, useState } from "react";
import { api } from "./api";
import { useProject } from "./project";
import Icon from "./Icon";
import { BarChart, BreakdownBars, Donut } from "./charts";
import { ORIGIN_LABEL, STATUS_LABEL } from "./labels";

function Tile({ label, value, accent }) {
  const bar = { danger: "bg-danger", warn: "bg-warn", ok: "bg-ok" }[accent] || "bg-brand";
  const txt = { danger: "text-danger", warn: "text-warn", ok: "text-ok" }[accent] || "text-fg";
  return (
    <div className="group relative card-surface p-4 overflow-hidden transition-transform hover:-translate-y-0.5 hover:shadow">
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${bar} opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className={`text-[27px] font-extrabold tracking-tight leading-none ${txt}`}>{value ?? "—"}</div>
      <div className="text-muted text-[12px] mt-[7px] font-semibold">{label}</div>
    </div>
  );
}

function Panel({ title, extra, children, wide }) {
  return (
    <div className={`card-surface p-[18px] ${wide ? "col-span-full" : ""}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-bold">{title}</h3>
        {extra}
      </div>
      {children}
    </div>
  );
}

export default function Dashboard({ onOpenErrors }) {
  const [stats, setStats] = useState(null);
  const [series, setSeries] = useState([]);
  const [bd, setBd] = useState(null);
  const [days, setDays] = useState(14);
  const { projectId } = useProject();

  useEffect(() => {
    if (!projectId) return;
    api.stats(projectId).then(setStats).catch(() => {});
    api.breakdown(projectId).then(setBd).catch(() => {});
  }, [projectId]);
  useEffect(() => {
    if (projectId) api.timeseries(projectId, days).then(setSeries).catch(() => {});
  }, [projectId, days]);

  return (
    <div className="anim-in">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[22px] font-extrabold tracking-tight">Genel bakış</h2>
          <p className="text-muted text-[13px] mt-1">Hata gruplarının, trendlerin ve dağılımların anlık özeti.</p>
        </div>
        <button className="btn ghost sm inline-flex items-center gap-1" onClick={onOpenErrors}>Tüm hatalar <Icon icon="lucide:arrow-right" size={14} /></button>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-5">
        <Tile label="Hata grubu" value={stats?.clusters} />
        <Tile label="Toplam olay" value={stats?.occurrences} />
        <Tile label="Açık" value={stats?.open} accent="warn" />
        <Tile label="Çözüldü" value={stats?.resolved} accent="ok" />
        <Tile label="Critical" value={stats?.critical} accent="danger" />
        <Tile label="High" value={stats?.high} accent="warn" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel wide title="Olay trendi" extra={
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-auto text-[12px] py-1.5">
            <option value={7}>Son 7 gün</option>
            <option value={14}>Son 14 gün</option>
            <option value={30}>Son 30 gün</option>
          </select>
        }>
          <BarChart data={series} />
        </Panel>

        <Panel title="Kaynak dağılımı"><Donut data={bd?.origin || []} labels={ORIGIN_LABEL} /></Panel>
        <Panel title="Önem derecesi"><BreakdownBars data={bd?.severity || []} /></Panel>
        <Panel title="Durum"><BreakdownBars data={bd?.status || []} labels={STATUS_LABEL} /></Panel>
      </div>
    </div>
  );
}
