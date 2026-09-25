import { useEffect, useState } from "react";
import { api } from "./api";
import { useConfirm } from "./Modal";
import Icon from "./Icon";
import { timeAgo } from "./labels";

const EMPTY = {
  type: "crashlytics", name: "", bq_project: "", bq_table: "",
  ga_dataset: "", event_pattern: "(?i)(error|exception|fail)",
  credentials_json: "", interval_minutes: 5,
};

export default function DataSources({ projectId }) {
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [running, setRunning] = useState(null);

  const load = () => projectId && api.dataSources(projectId).then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [projectId]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const add = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const body = {
        type: form.type, name: form.name.trim(), bq_project: form.bq_project.trim(),
        credentials_json: form.credentials_json.trim() || null,
        interval_minutes: Number(form.interval_minutes) || 5,
        ...(form.type === "crashlytics"
          ? { bq_table: form.bq_table.trim() }
          : { ga_dataset: form.ga_dataset.trim(), event_pattern: form.event_pattern.trim() || null }),
      };
      await api.createDataSource(projectId, body);
      setForm(EMPTY); setOpen(false); await load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const toggle = async (d) => { try { await api.toggleDataSource(d.id, !d.enabled); await load(); } catch (e) { setErr(e.message); } };
  const remove = async (d) => {
    if (!(await confirm({ title: "Veri kaynağını sil", message: `"${d.name}" silinecek.`, confirmText: "Sil", danger: true }))) return;
    try { await api.deleteDataSource(d.id); await load(); } catch (e) { setErr(e.message); }
  };
  const run = async (d) => {
    setRunning(d.id);
    try {
      const r = await api.runDataSource(d.id);
      await load();
      if (!r.ok) await confirm({ title: "Çalıştırılamadı", message: r.error, confirmText: "Tamam", cancelText: null });
    } catch (e) { await confirm({ title: "Hata", message: e.message, confirmText: "Tamam", cancelText: null }); }
    finally { setRunning(null); }
  };

  const statusColor = (s) => (s === "ok" ? "var(--ok)" : s === "error" ? "var(--danger)" : "var(--faint)");

  return (
    <div className="card-surface p-[18px]">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[14px] font-bold flex items-center gap-2"><Icon icon="lucide:flame" size={16} className="text-warn" /> Firebase / BigQuery (otomatik)</h3>
        <button className="btn ghost sm" onClick={() => setOpen((o) => !o)}>{open ? "Kapat" : "+ Kaynak ekle"}</button>
      </div>
      <p className="text-faint text-[11.5px] mb-3">
        Crashlytics/Analytics BigQuery export'undan hatalar periyodik olarak otomatik çekilir. Service account
        gerekir (BigQuery Data Viewer + Job User yetkisi).
      </p>

      {err && <div className="mb-3 text-danger text-[12px]">{err}</div>}

      {open && (
        <form onSubmit={add} className="rounded-lg p-3 mb-3" style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}>
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg mb-2" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
            {[["crashlytics", "Crashlytics"], ["analytics", "Analytics (GA4)"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setForm({ ...form, type: k })}
                className="py-1.5 rounded-md text-[12.5px] font-semibold"
                style={{ background: form.type === k ? "var(--accent-soft)" : "transparent", color: form.type === k ? "var(--accent)" : "var(--muted)" }}>{l}</button>
            ))}
          </div>
          <input className="text-[12.5px] py-1.5 mb-2" required placeholder="İsim (örn. Android Crashlytics)" value={form.name} onChange={set("name")} />
          <input className="text-[12.5px] py-1.5 mb-2" required placeholder="GCP proje id (bq_project)" value={form.bq_project} onChange={set("bq_project")} />
          {form.type === "crashlytics" ? (
            <input className="text-[12.5px] py-1.5 mb-2" required placeholder="Tablo: firebase_crashlytics.com_app_ANDROID" value={form.bq_table} onChange={set("bq_table")} />
          ) : (
            <>
              <input className="text-[12.5px] py-1.5 mb-2" required placeholder="Dataset: analytics_123456789" value={form.ga_dataset} onChange={set("ga_dataset")} />
              <input className="text-[12.5px] py-1.5 mb-2" placeholder="Event deseni (regex)" value={form.event_pattern} onChange={set("event_pattern")} />
            </>
          )}
          <textarea rows={3} className="text-[11.5px] py-1.5 mb-2 font-mono" placeholder="Service account JSON'unu buraya yapıştır" value={form.credentials_json} onChange={set("credentials_json")} />
          <div className="flex items-center gap-2 mb-2">
            <span className="text-faint text-[12px]">Periyot (dk)</span>
            <input type="number" min="1" className="w-20 text-[12.5px] py-1.5" value={form.interval_minutes} onChange={set("interval_minutes")} />
          </div>
          <button className="btn sm" type="submit" disabled={busy}>{busy ? "Ekleniyor…" : "Kaynağı ekle"}</button>
        </form>
      )}

      {items.length === 0 ? (
        <div className="text-faint text-[12.5px]">Henüz otomatik veri kaynağı yok.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((d) => (
            <div key={d.id} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", opacity: d.enabled ? 1 : 0.6 }}>
              <div className="flex items-center gap-2 flex-wrap">
                <Icon icon="lucide:database" size={14} className="text-muted" />
                <span className="font-bold text-[13px]">{d.name}</span>
                <span className="repo-badge" data-provider="github">{d.type}</span>
                <span className="badge" style={{ background: "var(--panel-2)", color: statusColor(d.last_status) }}>
                  ● {d.last_status || "hiç çalışmadı"}{d.last_status === "ok" ? ` · ${d.last_count} kayıt` : ""}
                </span>
                {d.last_run_at && <span className="text-faint text-[11px]">{timeAgo(d.last_run_at)}</span>}
                <div className="ml-auto flex items-center gap-1.5">
                  <button className="btn ghost sm" disabled={running === d.id} onClick={() => run(d)}>
                    {running === d.id ? "Çalışıyor…" : <><Icon icon="lucide:play" size={12} /> Çalıştır</>}
                  </button>
                  <button className="btn ghost sm" onClick={() => toggle(d)}>{d.enabled ? "Durdur" : "Başlat"}</button>
                  <button className="btn ghost sm danger" onClick={() => remove(d)}>Sil</button>
                </div>
              </div>
              {d.last_status === "error" && d.last_error && (
                <div className="text-danger text-[11.5px] mt-1.5 font-mono break-words">{d.last_error}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
