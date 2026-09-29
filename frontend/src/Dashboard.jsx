import { useEffect, useState } from "react";
import { api } from "./api";
import { useProject } from "./project";
import Icon from "./Icon";
import { BarChart, BreakdownBars, Donut } from "./charts";
import { ORIGIN_LABEL, STATUS_LABEL } from "./labels";
import { useLocale } from "./i18n";

function Tile({ label, value, accent, onClick }) {
  const bar = { danger: "bg-danger", warn: "bg-warn", ok: "bg-ok" }[accent] || "bg-brand";
  const txt = { danger: "text-danger", warn: "text-warn", ok: "text-ok" }[accent] || "text-fg";
  const Comp = onClick ? "button" : "div";
  return (
    <Comp type={onClick ? "button" : undefined} onClick={onClick}
      className={`group relative card-surface p-4 overflow-hidden text-left w-full transition-transform hover:-translate-y-0.5 hover:shadow ${onClick ? "cursor-pointer" : ""}`}>
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${bar} opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className={`text-[27px] font-extrabold tracking-tight leading-none ${txt}`}>{value ?? "—"}</div>
      <div className="text-muted text-[12px] mt-[7px] font-semibold">{label}</div>
    </Comp>
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
  const { t } = useLocale();

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
          <h2 className="text-[22px] font-extrabold tracking-tight">{t("dashboard.title")}</h2>
          <p className="text-muted text-[13px] mt-1">{t("dashboard.subtitle")}</p>
        </div>
        <button className="btn ghost sm inline-flex items-center gap-1" onClick={onOpenErrors}>{t("dashboard.allErrors")} <Icon icon="lucide:arrow-right" size={14} /></button>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-5">
        <Tile label={t("dashboard.tileErrorGroup")} value={stats?.clusters} onClick={() => onOpenErrors()} />
        <Tile label={t("dashboard.tileTotalEvents")} value={stats?.occurrences} onClick={() => onOpenErrors()} />
        <Tile label={t("dashboard.tileOpen")} value={stats?.open} accent="warn" onClick={() => onOpenErrors({ status: "open" })} />
        <Tile label={t("dashboard.tileResolved")} value={stats?.resolved} accent="ok" onClick={() => onOpenErrors({ status: "resolved" })} />
        <Tile label={t("dashboard.tileCritical")} value={stats?.critical} accent="danger" onClick={() => onOpenErrors({ severity: "critical" })} />
        <Tile label={t("dashboard.tileHigh")} value={stats?.high} accent="warn" onClick={() => onOpenErrors({ severity: "high" })} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel wide title={t("dashboard.eventTrend")} extra={
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-auto text-[12px] py-1.5">
            <option value={7}>{t("dashboard.last7Days")}</option>
            <option value={14}>{t("dashboard.last14Days")}</option>
            <option value={30}>{t("dashboard.last30Days")}</option>
          </select>
        }>
          <BarChart data={series} />
        </Panel>

        <Panel title={t("dashboard.sourceDistribution")}><Donut data={bd?.origin || []} labels={ORIGIN_LABEL} /></Panel>
        <Panel title={t("dashboard.severityLevel")}><BreakdownBars data={bd?.severity || []} onSelect={(key) => onOpenErrors({ severity: key })} /></Panel>
        <Panel title={t("dashboard.status")}><BreakdownBars data={bd?.status || []} labels={STATUS_LABEL} onSelect={(key) => onOpenErrors({ status: key })} /></Panel>
      </div>
    </div>
  );
}
