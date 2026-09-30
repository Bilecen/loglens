import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { useProject } from "./project";
import { Modal, useConfirm } from "./Modal";
import Icon from "./Icon";
import {
  SEVERITIES, ORIGINS, ORIGIN_LABEL, originLabel,
  STATUSES, statusLabel, sevClass, timeAgo, llmLabel,
} from "./labels";
import { useLocale } from "./i18n";

const PAGE_SIZE = 8;
const TERMINAL = new Set(["resolved", "ignored"]);

export default function Errors({ initialFilter }) {
  const { t } = useLocale();
  const { user, isAdmin, isReadOnly } = useAuth();
  const { projectId } = useProject();
  const [clusters, setClusters] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState(initialFilter?.severity || "");
  const [origin, setOrigin] = useState("");
  const [status, setStatus] = useState(initialFilter?.status || "");
  const [sort, setSort] = useState("last_seen");

  const [selected, setSelected] = useState(null);
  const [showIngest, setShowIngest] = useState(false);
  const [users, setUsers] = useState([]);

  const [providers, setProviders] = useState([]);
  const [llmConfigured, setLlmConfigured] = useState(false);
  const [showTestLog, setShowTestLog] = useState(false);

  // Assignee seçenekleri = projenin ekibi (üyeler).
  useEffect(() => { if (projectId) api.projectMembers(projectId).then(setUsers).catch(() => {}); }, [projectId]);
  useEffect(() => {
    api.llmProviders().then((r) => { setProviders(r.providers); setLlmConfigured(!!r.configured); }).catch(() => {});
    api.health().then((h) => setShowTestLog(h.environment !== "production")).catch(() => {});
  }, []);

  // Filtre ya da proje değişince ilk sayfaya dön; açık detayı kapat.
  useEffect(() => { setPage(0); }, [q, severity, origin, status, sort, projectId]);
  useEffect(() => { setSelected(null); }, [projectId]);

  const load = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    api.clusters({ project_id: projectId, q, severity, origin, status, sort,
                   limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((r) => { setClusters(r.items); setTotal(r.total); })
      .catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [projectId, q, severity, origin, status, sort, page]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  // Sayfa açıkken listeyi kendi kendine tazele — yenilemeden yeni hatalar görünsün.
  useEffect(() => {
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  const openDetail = async (id) => {
    try { setSelected(await api.cluster(id)); } catch (e) { setError(e.message); }
  };

  const onUpdated = (u) => {
    setSelected((s) => (s ? { ...s, cluster: u } : s));
    setClusters((list) => list.map((c) => (c.id === u.id ? u : c)));
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectCls = "w-auto min-w-[130px] text-[13px] py-2";

  return (
    <div className="anim-in">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[22px] font-extrabold tracking-tight">{t("errors.title")}</h2>
          <p className="text-muted text-[13px] mt-1">{t("errors.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button className="btn ghost" onClick={load} disabled={loading} title={t("errors.refresh")}>
            <Icon icon="lucide:refresh-cw" size={14} className={loading ? "animate-spin" : ""} /> {t("errors.refresh")}
          </button>
          {showTestLog && !isReadOnly && <button className="btn" onClick={() => setShowIngest(true)}>{t("errors.testLog")}</button>}
        </div>
      </div>

      <section className="flex flex-wrap gap-2.5 mb-[18px]">
        <input className="flex-1 min-w-[200px]" placeholder={t("errors.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={selectCls} value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">{t("errors.allSeverities")}</option>{SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={selectCls} value={origin} onChange={(e) => setOrigin(e.target.value)}>
          <option value="">{t("errors.allOrigins")}</option>{ORIGINS.map((o) => <option key={o} value={o}>{ORIGIN_LABEL[o]}</option>)}
        </select>
        <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t("errors.allStatuses")}</option>{STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        <select className={selectCls} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="last_seen">{t("errors.sortLastSeen")}</option>
          <option value="count">{t("errors.sortMostFrequent")}</option>
          <option value="first_seen">{t("errors.sortFirstSeen")}</option>
        </select>
      </section>

      {error && <div className="mb-3.5 bg-danger-soft text-danger rounded-[10px] px-3.5 py-2.5 text-[13px]">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-[18px] items-start">
        <main className="flex flex-col gap-[11px]">
          {loading && <div className="text-muted text-sm">{t("errors.loading")}</div>}
          {!loading && clusters.length === 0 && (
            <div className="text-muted py-12 text-center card-surface border-dashed">{t("errors.noClustersEmptyState")}</div>
          )}
          {clusters.map((c) => (
            <button key={c.id} onClick={() => openDetail(c.id)}
              className={`text-left card-surface p-4 w-full transition-all hover:-translate-y-px hover:shadow
                ${selected?.cluster?.id === c.id ? "border-brand ring-[3px] ring-brand-soft" : "hover:border-line-strong"}`}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={sevClass(c.severity)}>{c.severity}</span>
                <span className={`badge origin-${c.origin || "unknown"}`}>{originLabel(c.origin)}</span>
                <span className={`badge st-${c.status}`}>{statusLabel(c.status)}</span>
                {c.llm_ok === false && (
                  <span className="badge bg-warn-soft text-warn inline-flex items-center gap-1" title={t("errors.llmNoInterpretationTitle")}>
                    <Icon icon="lucide:triangle-alert" size={11} /> {t("errors.notInterpreted")}
                  </span>
                )}
                <span className="ml-auto text-[12px] font-bold text-muted bg-surface-2 px-2 rounded-full">{c.occurrence_count}×</span>
              </div>
              <div className="font-bold mt-2.5 mb-0.5 text-[14.5px] tracking-tight leading-snug">{c.title || t("errors.unclassifiedError")}</div>
              <div className="text-muted text-[12px]">{c.source || t("errors.unknownSource")}</div>
              <div className="flex justify-between items-center mt-2.5 text-muted text-[12px]">
                <span className="font-mono">{c.group_key}</span>
                <span className="flex items-center gap-1">{c.assignee_name ? <><Icon icon="lucide:user" size={12} /> {c.assignee_name}</> : timeAgo(c.last_seen_at)}</span>
              </div>
            </button>
          ))}

          {/* Sayfalama */}
          {total > 0 && (
            <div className="flex items-center justify-between mt-1 px-1">
              <span className="text-muted text-[12px]">
                {t("errors.resultCount", { count: total })}{total > PAGE_SIZE && <> · {t("errors.pageOf", { page: page + 1, pageCount })}</>}
              </span>
              {pageCount > 1 && (
                <div className="flex gap-1.5">
                  <button className="btn ghost sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{t("errors.previous")}</button>
                  <button className="btn ghost sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>{t("errors.next")}</button>
                </div>
              )}
            </div>
          )}
        </main>

        <aside className="lg:sticky lg:top-6">
          {!selected ? (
            <div className="text-muted py-12 text-center card-surface border-dashed">{t("errors.selectClusterForDetail")}</div>
          ) : (
            <Detail data={selected} users={users} me={user} isAdmin={isAdmin} isReadOnly={isReadOnly} providers={providers} llmConfigured={llmConfigured}
              onClose={() => setSelected(null)} onUpdated={onUpdated} />
          )}
        </aside>
      </div>

      <IngestModal open={showIngest} onClose={() => setShowIngest(false)} onDone={() => { setShowIngest(false); load(); }} />
    </div>
  );
}

const lbl = "text-faint text-[11px] uppercase tracking-wide font-bold mt-[18px] mb-[7px]";

function Detail({ data, users, me, isAdmin, isReadOnly = false, providers = [], llmConfigured = false, onClose, onUpdated }) {
  const { cluster: c, occurrences } = data;
  const confirm = useConfirm();
  const { t } = useLocale();
  const [saving, setSaving] = useState(false);
  const [opinions, setOpinions] = useState(data.opinions || []);
  const [askingProvider, setAskingProvider] = useState(null);
  useEffect(() => { setOpinions(data.opinions || []); }, [c.id]); // eslint-disable-line

  const [notes, setNotes] = useState(data.notes || []);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  useEffect(() => { setNotes(data.notes || []); setDraft(""); setEditId(null); }, [c.id]); // eslint-disable-line

  const [reinterpreting, setReinterpreting] = useState(false);

  const patch = async (fields) => {
    setSaving(true);
    try { onUpdated(await api.updateCluster(c.id, fields)); } finally { setSaving(false); }
  };

  const reinterpret = async () => {
    setReinterpreting(true);
    try { onUpdated(await api.reinterpret(c.id)); }
    catch (e) { await confirm({ title: t("errors.reinterpretFailedTitle"), message: e.message, confirmText: t("errors.ok"), cancelText: null }); }
    finally { setReinterpreting(false); }
  };

  const askOpinion = async (provider) => {
    setAskingProvider(provider);
    try { const op = await api.clusterOpinion(c.id, provider); setOpinions((l) => [...l, op]); }
    catch (e) { await confirm({ title: t("errors.opinionFailedTitle", { provider: llmLabel(provider) }), message: e.message, confirmText: t("errors.ok"), cancelText: null }); }
    finally { setAskingProvider(null); }
  };

  const onStatusChange = async (next) => {
    if (next === c.status) return;
    // Nihai durumdan geri alma yalnızca admin'e açık.
    if (TERMINAL.has(c.status) && !isAdmin) {
      await confirm({
        title: t("errors.permissionRequiredTitle"),
        message: t("errors.permissionRequiredMessage", { status: statusLabel(c.status) }),
        confirmText: t("errors.understood"), cancelText: null,
      });
      return;
    }
    const toTerminal = TERMINAL.has(next);
    const ok = await confirm({
      title: t("errors.finalDecisionTitle"),
      message: t("errors.statusChangeMessage", { from: statusLabel(c.status), to: statusLabel(next) })
        + (toTerminal ? t("errors.terminalStatusHint") : ""),
      confirmText: t("errors.yesChange"), danger: toTerminal,
    });
    if (!ok) return;
    try { await patch({ status: next }); }
    catch (e) {
      await confirm({ title: t("errors.changeFailedTitle"), message: e.message, confirmText: t("errors.ok"), cancelText: null });
    }
  };

  const addNote = async () => {
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    try {
      const n = await api.addNote(c.id, body);
      setNotes((l) => [...l, n]);
      setDraft("");
    } catch (e) {
      await confirm({ title: t("errors.noteAddFailedTitle"), message: e.message, confirmText: t("errors.ok"), cancelText: null });
    } finally { setPosting(false); }
  };

  const saveEdit = async (note) => {
    const body = editDraft.trim();
    if (!body || body === note.body) { setEditId(null); return; }
    try {
      const updated = await api.updateNote(c.id, note.id, body);
      setNotes((l) => l.map((x) => (x.id === note.id ? updated : x)));
      setEditId(null);
    } catch (e) {
      await confirm({ title: t("errors.noteEditFailedTitle"), message: e.message, confirmText: t("errors.ok"), cancelText: null });
    }
  };

  const removeNote = async (note) => {
    const ok = await confirm({ title: t("errors.deleteNoteTitle"), message: t("errors.deleteNoteMessage"), confirmText: t("errors.delete"), danger: true });
    if (!ok) return;
    try {
      await api.deleteNote(c.id, note.id);
      setNotes((l) => l.filter((x) => x.id !== note.id));
    } catch (e) {
      await confirm({ title: t("errors.noteDeleteFailedTitle"), message: e.message, confirmText: t("errors.ok"), cancelText: null });
    }
  };

  const assignOptions = isAdmin
    ? users
    : [me, ...(c.assignee_id && c.assignee_id !== me.id ? [{ id: c.assignee_id, name: c.assignee_name, email: c.assignee_email }] : [])];

  const statusLocked = TERMINAL.has(c.status) && !isAdmin;

  return (
    <div className="card-surface p-[22px] shadow">
      <div className="flex justify-between items-start gap-3">
        <div className="flex gap-1.5 flex-wrap">
          <span className={sevClass(c.severity)}>{c.severity}</span>
          <span className={`badge origin-${c.origin || "unknown"}`}>{originLabel(c.origin)}</span>
          <span className={`badge st-${c.status}`}>{statusLabel(c.status)}</span>
        </div>
        <button className="btn ghost sm" onClick={onClose}><Icon icon="lucide:x" size={15} /></button>
      </div>

      <h2 className="mt-3.5 mb-1.5 text-[19px] font-extrabold tracking-tight leading-tight">{c.title || t("errors.unclassifiedError")}</h2>
      <div className="text-muted text-[12.5px] mb-[18px]">
        <span className="font-mono">{c.group_key}</span> · {t("errors.occurrenceCount", { count: c.occurrence_count })} · {c.source || t("errors.noSource")}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={lbl}>{t("errors.status")}</div>
          <select className="w-full" value={c.status} disabled={saving || statusLocked || isReadOnly}
            onChange={(e) => onStatusChange(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          {statusLocked && <div className="text-faint text-[11px] mt-1.5 flex items-center gap-1"><Icon icon="lucide:lock" size={11} /> {t("errors.terminalStatusLocked")}</div>}
        </div>
        <div>
          <div className={lbl}>{t("errors.assignee")}</div>
          <select className="w-full" value={c.assignee_id ?? ""} disabled={saving || isReadOnly}
            onChange={(e) => patch({ assignee_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">{t("errors.unassigned")}</option>
            {assignOptions.filter(Boolean).map((u) => (
              <option key={u.id} value={u.id}>{u.name || u.email}{u.id === me.id ? t("errors.meSuffix") : ""}</option>
            ))}
          </select>
        </div>
      </div>

      {c.llm_ok === false && (
        <div className="mt-[18px] rounded-xl px-3.5 py-3 flex items-center gap-2.5 flex-wrap"
          style={{ background: "var(--warn-soft)" }}>
          <Icon icon="lucide:triangle-alert" size={16} className="text-warn" />
          <div className="flex-1 min-w-[140px] text-[12.5px] text-warn font-medium">
            {llmConfigured ? t("errors.llmUnreachableMessage") : t("errors.llmNotConfiguredMessage")}
          </div>
          {llmConfigured && !isReadOnly && (
            <button className="btn sm" disabled={reinterpreting} onClick={reinterpret}>
              {reinterpreting ? t("errors.interpreting") : <><Icon icon="lucide:sparkles" size={13} /> {t("errors.reinterpret")}</>}
            </button>
          )}
        </div>
      )}

      {c.summary && (
        <div className="mt-[18px] bg-surface-2 border border-line rounded-xl" style={{ padding: "13px 15px" }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-faint text-[11px] uppercase tracking-wide font-bold">{t("errors.llmComment")}</span>
            {c.llm_model && (
              <span className="badge bg-brand-soft text-brand !text-[10px] font-mono normal-case">
                <Icon icon="lucide:sparkles" size={10} /> {c.llm_model}
              </span>
            )}
          </div>
          <p className="m-0 leading-relaxed text-[13.5px]">{c.summary}</p>
        </div>
      )}

      {/* İkinci görüş: başka AI'lara sor */}
      {c.llm_ok && (
        <div className="mt-[18px]">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-faint text-[11px] uppercase tracking-wide font-bold">{t("errors.secondOpinion")}</span>
            {!isReadOnly && providers.map((p) => (
              <button key={p} className="btn ghost sm" disabled={!!askingProvider} onClick={() => askOpinion(p)}>
                {askingProvider === p
                  ? t("errors.asking")
                  : <><Icon icon="lucide:sparkles" size={12} /> {t("errors.askProvider", { provider: llmLabel(p) })}</>}
              </button>
            ))}
          </div>
          {opinions.map((op) => (
            <div key={op.id} className="mt-2 bg-surface-2 border border-line rounded-xl px-3.5 py-3">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="badge bg-brand-soft text-brand !text-[10px] font-mono normal-case">
                  <Icon icon="lucide:sparkles" size={10} /> {llmLabel(op.provider)}{op.model ? ` · ${op.model}` : ""}
                </span>
                {op.severity && <span className={sevClass(op.severity)}>{op.severity}</span>}
              </div>
              <p className="m-0 leading-relaxed text-[13px]">{op.summary || op.title}</p>
            </div>
          ))}
        </div>
      )}

      {c.source_snippet && (
        <div>
          <div className={lbl}>
            {t("errors.sourceCode")} {c.source_url && <a href={c.source_url} target="_blank" rel="noreferrer" className="text-brand no-underline hover:underline text-[11px] ml-2 font-semibold normal-case tracking-normal inline-flex items-center gap-0.5">{t("errors.openSource")} <Icon icon="lucide:external-link" size={11} /></a>}
          </div>
          <pre className="bg-code border border-line-strong rounded-[10px] px-3.5 py-3 overflow-x-auto whitespace-pre leading-relaxed m-0 max-h-[280px] text-[11.5px] font-mono">{c.source_snippet}</pre>
        </div>
      )}

      {/* ---------- Not akışı ---------- */}
      <div className={lbl}>{t("errors.notes", { count: notes.length })}</div>
      <div className="flex flex-col gap-2.5">
        {notes.length === 0 && <div className="text-faint text-[12.5px]">{t("errors.noNotesYet")}</div>}
        {notes.map((n) => {
          const mine = n.author_id === me.id;
          const editing = editId === n.id;
          return (
            <div key={n.id} className="bg-surface-2 border border-line rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="avatar w-[22px] h-[22px] text-[10px]">
                  {(n.author_name || n.author_email || "?")[0].toUpperCase()}
                </span>
                <span className="text-[12.5px] font-semibold">{n.author_name || n.author_email || t("errors.deletedUser")}</span>
                {n.origin === "mcp" && (
                  <span className="badge bg-brand-soft text-brand !text-[10px] font-mono normal-case" title={t("errors.mcpBadgeTitle")}>
                    <Icon icon="lucide:plug-zap" size={10} /> MCP
                  </span>
                )}
                <span className="text-faint text-[11px] ml-auto">{timeAgo(n.created_at)}</span>
                {!editing && ((mine && !isReadOnly) || isAdmin) && (
                  <div className="flex items-center gap-0.5">
                    {mine && !isReadOnly && (
                      <button className="text-faint hover:text-fg px-1" title={t("errors.edit")}
                        onClick={() => { setEditId(n.id); setEditDraft(n.body); }}><Icon icon="lucide:pencil" size={13} /></button>
                    )}
                    {isAdmin && (
                      <button className="text-faint hover:text-danger px-1" title={t("errors.delete")}
                        onClick={() => removeNote(n)}><Icon icon="lucide:trash" size={13} /></button>
                    )}
                  </div>
                )}
              </div>
              {editing ? (
                <div className="flex flex-col gap-1.5">
                  <textarea rows={2} value={editDraft} autoFocus onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit(n); if (e.key === "Escape") setEditId(null); }} />
                  <div className="flex gap-1.5 justify-end">
                    <button className="btn ghost sm" onClick={() => setEditId(null)}>{t("errors.cancel")}</button>
                    <button className="btn sm" disabled={!editDraft.trim()} onClick={() => saveEdit(n)}>{t("errors.save")}</button>
                  </div>
                </div>
              ) : (
                <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{n.body}</div>
              )}
            </div>
          );
        })}
      </div>
      {!isReadOnly && (
        <div className="mt-2.5 flex flex-col gap-2">
          <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("errors.addNotePlaceholder")}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote(); }} />
          <div className="flex items-center justify-between">
            <span className="text-faint text-[11px]">{t("errors.sendHint")}</span>
            <button className="btn sm" disabled={posting || !draft.trim()} onClick={addNote}>
              {posting ? t("errors.adding") : t("errors.addNote")}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div><div className={lbl}>{t("errors.firstVersion")}</div><div>{c.first_seen_version || "-"}</div></div>
        <div><div className={lbl}>{t("errors.lastVersion")}</div><div>{c.last_seen_version || "-"}</div></div>
      </div>

      <div className={lbl}>{t("errors.recentEvents", { count: occurrences.length })}</div>
      <div className="flex flex-col gap-2.5 max-h-[320px] overflow-auto">
        {occurrences.map((o) => (
          <div key={o.id} className="bg-surface-2 border border-line rounded-[10px] px-3 py-2.5">
            <div className="flex gap-3 text-[12px] text-muted mb-1.5 font-semibold">
              <span>{o.platform || "—"}</span><span>{o.app_version || "—"}</span>
              <span className="text-muted font-normal">{timeAgo(o.seen_at)}</span>
            </div>
            <div className="break-words leading-normal font-mono text-[12px]">{o.raw_message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const SAMPLE = {
  message: "NullPointerException: Cannot read property 'id' of undefined",
  error_type: "NullPointerException",
  stack_trace: "at com.app.HomeScreen.render(HomeScreen.kt:42)\nat com.app.MainActivity.onCreate(MainActivity.kt:18)",
  app_version: "1.4.2", platform: "android", source: "firebase",
};

function IngestModal({ open, onClose, onDone }) {
  const { t } = useLocale();
  const [form, setForm] = useState(SAMPLE);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    setBusy(true); setErr(null);
    try { setResult(await api.ingest(form)); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("errors.sendTestLogTitle")} size={480}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>{t("errors.close")}</button>
          {result && <button className="btn ghost" onClick={onDone}>{t("errors.closeAndRefresh")}</button>}
          <button className="btn" onClick={submit} disabled={busy}>{busy ? t("errors.sending") : t("errors.send")}</button>
        </>
      }>
      <label className="field-label">{t("errors.message")}</label>
      <input value={form.message} onChange={set("message")} />
      <label className="field-label">{t("errors.errorType")}</label>
      <input value={form.error_type || ""} onChange={set("error_type")} />
      <label className="field-label">{t("errors.stackTrace")}</label>
      <textarea rows={4} value={form.stack_trace || ""} onChange={set("stack_trace")} />
      <div className="grid grid-cols-2 gap-3">
        <div><label className="field-label">{t("errors.version")}</label><input value={form.app_version || ""} onChange={set("app_version")} /></div>
        <div><label className="field-label">{t("errors.platform")}</label><input value={form.platform || ""} onChange={set("platform")} /></div>
      </div>
      {err && <div className="mt-3 bg-danger-soft text-danger rounded-[10px] px-3.5 py-2.5 text-[13px]">{err}</div>}
      {result && (
        <div className={`mt-3.5 px-3.5 py-2.5 rounded-[10px] border text-[13px] ${result.status === "new_cluster" ? "border-ok bg-ok-soft" : "border-line bg-surface-2"}`}>
          <b>{result.status}</b>{result.match && <> · {t("errors.matchLabel", { match: result.match })}</>} · {result.group_key} · {result.occurrence_count}×
        </div>
      )}
    </Modal>
  );
}
