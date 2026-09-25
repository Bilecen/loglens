import { useEffect, useState } from "react";
import { api } from "./api";
import { useProject } from "./project";
import { useConfirm } from "./Modal";
import { timeAgo } from "./labels";
import Icon from "./Icon";
import { useLocale } from "./i18n";

function CopyButton({ text, className = "btn ghost sm", children }) {
  const { t } = useLocale();
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }
    catch { /* clipboard izni yoksa sessiz geç */ }
  };
  return <button type="button" className={`${className} inline-flex items-center gap-1`} onClick={copy}>{done ? <><Icon icon="lucide:check" size={13} /> {t("webhooks.copied")}</> : (children ?? t("webhooks.copy"))}</button>;
}

const curlOf = (url) =>
  `curl -X POST "${url}" \\\n  -H "Content-Type: application/json" \\\n` +
  `  -d '{"message":"NullPointerException","stack_trace":"at Foo.bar(Foo.java:1)","platform":"service","app_version":"1.0.0"}'`;

export default function Webhooks() {
  const { t } = useLocale();
  const confirm = useConfirm();
  const { projectId } = useProject();
  const [hooks, setHooks] = useState([]);
  const [form, setForm] = useState({ name: "", source: "" });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [openCurl, setOpenCurl] = useState(null); // hangi webhook'un curl'ü açık

  const load = () => projectId && api.webhooks(projectId).then(setHooks).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [projectId]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api.createWebhook(projectId, { name: form.name.trim(), source: form.source.trim() || null });
      setForm({ name: "", source: "" });
      await load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const toggle = async (h) => {
    try { await api.toggleWebhook(h.id, !h.active); await load(); } catch (e) { setErr(e.message); }
  };

  const remove = async (h) => {
    const yes = await confirm({
      title: t("webhooks.deleteConfirmTitle"),
      message: t("webhooks.deleteConfirmMessage", { name: h.name }),
      confirmText: t("webhooks.delete"), danger: true,
    });
    if (!yes) return;
    try { await api.deleteWebhook(h.id); await load(); } catch (e) { setErr(e.message); }
  };

  return (
    <div className="anim-in">
      <div className="mb-6">
        <h2 className="text-[22px] font-extrabold tracking-tight">Webhooks</h2>
        <p className="text-muted text-[13px] mt-1 max-w-2xl">
          {t("webhooks.descriptionPrefix")} <span className="font-mono">POST</span>{t("webhooks.descriptionSuffix")}
        </p>
      </div>

      {err && (
        <div className="mb-4 px-4 py-3 rounded-xl text-[13px] font-medium"
          style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>{err}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 items-start">
        {/* ---------- Üret ---------- */}
        <form className="card-surface p-[18px]" onSubmit={create}>
          <h3 className="text-[14px] font-bold mb-3">{t("webhooks.generateNew")}</h3>
          <label className="field-label">{t("webhooks.nameLabel")}</label>
          <input required placeholder={t("webhooks.namePlaceholder")} value={form.name} onChange={set("name")} />
          <label className="field-label">{t("webhooks.sourceLabelField")}</label>
          <input placeholder="payment-svc" value={form.source} onChange={set("source")} />
          <p className="text-faint text-[11.5px] mt-1.5">
            {t("webhooks.sourceHelp")}
          </p>
          <button className="btn w-full mt-4" type="submit" disabled={busy}>
            {busy ? t("webhooks.generating") : t("webhooks.generateButton")}
          </button>
        </form>

        {/* ---------- Liste ---------- */}
        <div className="card-surface p-[18px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold">{t("webhooks.listTitle")}</h3>
            <span className="badge sev-low">{hooks.length}</span>
          </div>

          {hooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
              <div className="w-11 h-11 rounded-xl grid place-items-center text-muted"
                style={{ background: "var(--panel-2)" }}><Icon icon="lucide:webhook" size={20} /></div>
              <div className="text-[13px] font-semibold">{t("webhooks.emptyTitle")}</div>
              <div className="text-faint text-[12px] max-w-[260px]">{t("webhooks.emptyHint")}</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {hooks.map((h) => (
                <div key={h.id} className="rounded-xl border p-3.5" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[14px]">{h.name}</span>
                    {h.source && <span className="repo-badge" data-provider="github">{h.source}</span>}
                    <span className={`badge ${h.active ? "badge-ok" : "sev-low"}`}>{h.active ? t("webhooks.active") : t("webhooks.inactive")}</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <button className="btn ghost sm" onClick={() => toggle(h)}>{h.active ? t("webhooks.deactivate") : t("webhooks.activate")}</button>
                      <button className="btn ghost sm danger" onClick={() => remove(h)}>{t("webhooks.delete")}</button>
                    </div>
                  </div>

                  {/* URL */}
                  <div className="flex items-center gap-2 mt-3">
                    <code className="flex-1 min-w-0 text-[12px] font-mono bg-surface-2 border border-line rounded-lg px-2.5 py-2 overflow-x-auto whitespace-nowrap">
                      {h.ingest_url}
                    </code>
                    <CopyButton text={h.ingest_url} />
                  </div>

                  {/* Meta + curl */}
                  <div className="flex items-center gap-3 mt-2.5 text-faint text-[11.5px]">
                    <span>{t("webhooks.deliveryCount", { count: h.delivery_count })}</span>
                    <span>·</span>
                    <span>{h.last_used_at ? t("webhooks.lastUsed", { time: timeAgo(h.last_used_at) }) : t("webhooks.neverUsed")}</span>
                    <button type="button" className="ml-auto text-brand font-semibold hover:underline"
                      onClick={() => setOpenCurl(openCurl === h.id ? null : h.id)}>
                      {openCurl === h.id ? t("webhooks.hideCurl") : t("webhooks.curlExample")}
                    </button>
                  </div>

                  {openCurl === h.id && (
                    <div className="mt-2.5">
                      <pre className="bg-code border border-line-strong rounded-[10px] px-3 py-2.5 overflow-x-auto text-[11.5px] font-mono leading-relaxed m-0">{curlOf(h.ingest_url)}</pre>
                      <div className="mt-1.5"><CopyButton text={curlOf(h.ingest_url)} className="btn ghost sm">{t("webhooks.copyCurl")}</CopyButton></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
