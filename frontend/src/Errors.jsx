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

const PAGE_SIZE = 8;
const TERMINAL = new Set(["resolved", "ignored"]);

export default function Errors() {
  const { user, isAdmin } = useAuth();
  const { projectId } = useProject();
  const [clusters, setClusters] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState("");
  const [origin, setOrigin] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("last_seen");

  const [selected, setSelected] = useState(null);
  const [showIngest, setShowIngest] = useState(false);
  const [users, setUsers] = useState([]);

  const [providers, setProviders] = useState([]);

  // Assignee seçenekleri = projenin ekibi (üyeler).
  useEffect(() => { if (projectId) api.projectMembers(projectId).then(setUsers).catch(() => {}); }, [projectId]);
  useEffect(() => { api.llmProviders().then((r) => setProviders(r.providers)).catch(() => {}); }, []);

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
          <h2 className="text-[22px] font-extrabold tracking-tight">Hatalar</h2>
          <p className="text-muted text-[13px] mt-1">Grupları filtrele, durumunu yönet, kaynak koda in.</p>
        </div>
        <button className="btn" onClick={() => setShowIngest(true)}>+ Test logu</button>
      </div>

      <section className="flex flex-wrap gap-2.5 mb-[18px]">
        <input className="flex-1 min-w-[200px]" placeholder="Başlık / özet ara…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={selectCls} value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">Tüm önem</option>{SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={selectCls} value={origin} onChange={(e) => setOrigin(e.target.value)}>
          <option value="">Tüm kaynaklar</option>{ORIGINS.map((o) => <option key={o} value={o}>{ORIGIN_LABEL[o]}</option>)}
        </select>
        <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tüm durumlar</option>{STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        <select className={selectCls} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="last_seen">Son görülme</option>
          <option value="count">En sık</option>
          <option value="first_seen">İlk görülme</option>
        </select>
      </section>

      {error && <div className="mb-3.5 bg-danger-soft text-danger rounded-[10px] px-3.5 py-2.5 text-[13px]">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-[18px] items-start">
        <main className="flex flex-col gap-[11px]">
          {loading && <div className="text-muted text-sm">Yükleniyor…</div>}
          {!loading && clusters.length === 0 && (
            <div className="text-muted py-12 text-center card-surface border-dashed">Hata grubu yok. "+ Test logu" ile bir log gönder.</div>
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
                  <span className="badge bg-warn-soft text-warn inline-flex items-center gap-1" title="LLM yorumu yok — yeniden yorumla">
                    <Icon icon="lucide:triangle-alert" size={11} /> yorumlanmadı
                  </span>
                )}
                <span className="ml-auto text-[12px] font-bold text-muted bg-surface-2 px-2 rounded-full">{c.occurrence_count}×</span>
              </div>
              <div className="font-bold mt-2.5 mb-0.5 text-[14.5px] tracking-tight leading-snug">{c.title || "Sınıflandırılmamış hata"}</div>
              <div className="text-muted text-[12px]">{c.source || "kaynak bilinmiyor"}</div>
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
                {total} sonuç{total > PAGE_SIZE && <> · sayfa {page + 1}/{pageCount}</>}
              </span>
              {pageCount > 1 && (
                <div className="flex gap-1.5">
                  <button className="btn ghost sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Önceki</button>
                  <button className="btn ghost sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Sonraki →</button>
                </div>
              )}
            </div>
          )}
        </main>

        <aside className="lg:sticky lg:top-6">
          {!selected ? (
            <div className="text-muted py-12 text-center card-surface border-dashed">Detay için bir hata grubu seç.</div>
          ) : (
            <Detail data={selected} users={users} me={user} isAdmin={isAdmin} providers={providers}
              onClose={() => setSelected(null)} onUpdated={onUpdated} />
          )}
        </aside>
      </div>

      <IngestModal open={showIngest} onClose={() => setShowIngest(false)} onDone={() => { setShowIngest(false); load(); }} />
    </div>
  );
}

const lbl = "text-faint text-[11px] uppercase tracking-wide font-bold mt-[18px] mb-[7px]";

function Detail({ data, users, me, isAdmin, providers = [], onClose, onUpdated }) {
  const { cluster: c, occurrences } = data;
  const confirm = useConfirm();
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
    catch (e) { await confirm({ title: "Yeniden yorumlanamadı", message: e.message, confirmText: "Tamam", cancelText: null }); }
    finally { setReinterpreting(false); }
  };

  const askOpinion = async (provider) => {
    setAskingProvider(provider);
    try { const op = await api.clusterOpinion(c.id, provider); setOpinions((l) => [...l, op]); }
    catch (e) { await confirm({ title: `${llmLabel(provider)} yanıt vermedi`, message: e.message, confirmText: "Tamam", cancelText: null }); }
    finally { setAskingProvider(null); }
  };

  const onStatusChange = async (next) => {
    if (next === c.status) return;
    // Nihai durumdan geri alma yalnızca admin'e açık.
    if (TERMINAL.has(c.status) && !isAdmin) {
      await confirm({
        title: "Yetki gerekli",
        message: `"${statusLabel(c.status)}" nihai bir durum. Geri almak için admin yetkisi gerekir.`,
        confirmText: "Anladım", cancelText: null,
      });
      return;
    }
    const toTerminal = TERMINAL.has(next);
    const ok = await confirm({
      title: "Son kararınız mı?",
      message: `Durum "${statusLabel(c.status)}" → "${statusLabel(next)}" olarak değişecek.`
        + (toTerminal ? "\n\nBu nihai bir durum: sonradan yalnızca admin geri alabilir." : ""),
      confirmText: "Evet, değiştir", danger: toTerminal,
    });
    if (!ok) return;
    try { await patch({ status: next }); }
    catch (e) {
      await confirm({ title: "Değiştirilemedi", message: e.message, confirmText: "Tamam", cancelText: null });
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
      await confirm({ title: "Not eklenemedi", message: e.message, confirmText: "Tamam", cancelText: null });
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
      await confirm({ title: "Düzenlenemedi", message: e.message, confirmText: "Tamam", cancelText: null });
    }
  };

  const removeNote = async (note) => {
    const ok = await confirm({ title: "Notu sil", message: "Bu not silinsin mi?", confirmText: "Sil", danger: true });
    if (!ok) return;
    try {
      await api.deleteNote(c.id, note.id);
      setNotes((l) => l.filter((x) => x.id !== note.id));
    } catch (e) {
      await confirm({ title: "Silinemedi", message: e.message, confirmText: "Tamam", cancelText: null });
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

      <h2 className="mt-3.5 mb-1.5 text-[19px] font-extrabold tracking-tight leading-tight">{c.title || "Sınıflandırılmamış hata"}</h2>
      <div className="text-muted text-[12.5px] mb-[18px]">
        <span className="font-mono">{c.group_key}</span> · {c.occurrence_count} olay · {c.source || "kaynak yok"}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={lbl}>Durum</div>
          <select className="w-full" value={c.status} disabled={saving || statusLocked}
            onChange={(e) => onStatusChange(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          {statusLocked && <div className="text-faint text-[11px] mt-1.5 flex items-center gap-1"><Icon icon="lucide:lock" size={11} /> Nihai durum — geri alma admin yetkisinde.</div>}
        </div>
        <div>
          <div className={lbl}>Atanan</div>
          <select className="w-full" value={c.assignee_id ?? ""} disabled={saving}
            onChange={(e) => patch({ assignee_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Atanmamış</option>
            {assignOptions.filter(Boolean).map((u) => (
              <option key={u.id} value={u.id}>{u.name || u.email}{u.id === me.id ? " (ben)" : ""}</option>
            ))}
          </select>
        </div>
      </div>

      {c.llm_ok === false && (
        <div className="mt-[18px] rounded-xl px-3.5 py-3 flex items-center gap-2.5 flex-wrap"
          style={{ background: "var(--warn-soft)" }}>
          <Icon icon="lucide:triangle-alert" size={16} className="text-warn" />
          <div className="flex-1 min-w-[140px] text-[12.5px] text-warn font-medium">
            LLM erişilemediği için yorumlanmadı. Sağlayıcı çalışınca yeniden yorumlat.
          </div>
          <button className="btn sm" disabled={reinterpreting} onClick={reinterpret}>
            {reinterpreting ? "Yorumlanıyor…" : <><Icon icon="lucide:sparkles" size={13} /> Yeniden yorumla</>}
          </button>
        </div>
      )}

      {c.summary && (
        <div className="mt-[18px] bg-surface-2 border border-line rounded-xl" style={{ padding: "13px 15px" }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-faint text-[11px] uppercase tracking-wide font-bold">LLM yorumu</span>
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
            <span className="text-faint text-[11px] uppercase tracking-wide font-bold">İkinci görüş</span>
            {providers.map((p) => (
              <button key={p} className="btn ghost sm" disabled={!!askingProvider} onClick={() => askOpinion(p)}>
                {askingProvider === p
                  ? "Soruluyor…"
                  : <><Icon icon="lucide:sparkles" size={12} /> {llmLabel(p)}'e sor</>}
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
            Kaynak kod {c.source_url && <a href={c.source_url} target="_blank" rel="noreferrer" className="text-brand no-underline hover:underline text-[11px] ml-2 font-semibold normal-case tracking-normal inline-flex items-center gap-0.5">Kaynağı aç <Icon icon="lucide:external-link" size={11} /></a>}
          </div>
          <pre className="bg-code border border-line-strong rounded-[10px] px-3.5 py-3 overflow-x-auto whitespace-pre leading-relaxed m-0 max-h-[280px] text-[11.5px] font-mono">{c.source_snippet}</pre>
        </div>
      )}

      {/* ---------- Not akışı ---------- */}
      <div className={lbl}>Notlar ({notes.length})</div>
      <div className="flex flex-col gap-2.5">
        {notes.length === 0 && <div className="text-faint text-[12.5px]">Henüz not yok. İlk notu sen ekle.</div>}
        {notes.map((n) => {
          const mine = n.author_id === me.id;
          const editing = editId === n.id;
          return (
            <div key={n.id} className="bg-surface-2 border border-line rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="avatar w-[22px] h-[22px] text-[10px]">
                  {(n.author_name || n.author_email || "?")[0].toUpperCase()}
                </span>
                <span className="text-[12.5px] font-semibold">{n.author_name || n.author_email || "Silinmiş kullanıcı"}</span>
                <span className="text-faint text-[11px] ml-auto">{timeAgo(n.created_at)}</span>
                {!editing && (mine || isAdmin) && (
                  <div className="flex items-center gap-0.5">
                    {mine && (
                      <button className="text-faint hover:text-fg px-1" title="Düzenle"
                        onClick={() => { setEditId(n.id); setEditDraft(n.body); }}><Icon icon="lucide:pencil" size={13} /></button>
                    )}
                    <button className="text-faint hover:text-danger px-1" title="Sil"
                      onClick={() => removeNote(n)}><Icon icon="lucide:trash" size={13} /></button>
                  </div>
                )}
              </div>
              {editing ? (
                <div className="flex flex-col gap-1.5">
                  <textarea rows={2} value={editDraft} autoFocus onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit(n); if (e.key === "Escape") setEditId(null); }} />
                  <div className="flex gap-1.5 justify-end">
                    <button className="btn ghost sm" onClick={() => setEditId(null)}>Vazgeç</button>
                    <button className="btn sm" disabled={!editDraft.trim()} onClick={() => saveEdit(n)}>Kaydet</button>
                  </div>
                </div>
              ) : (
                <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{n.body}</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-col gap-2">
        <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Bir not ekle…"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote(); }} />
        <div className="flex items-center justify-between">
          <span className="text-faint text-[11px]">⌘/Ctrl + Enter ile gönder</span>
          <button className="btn sm" disabled={posting || !draft.trim()} onClick={addNote}>
            {posting ? "Ekleniyor…" : "Not ekle"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div><div className={lbl}>İlk sürüm</div><div>{c.first_seen_version || "-"}</div></div>
        <div><div className={lbl}>Son sürüm</div><div>{c.last_seen_version || "-"}</div></div>
      </div>

      <div className={lbl}>Son olaylar ({occurrences.length})</div>
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
    <Modal open={open} onClose={onClose} title="Test logu gönder" size={480}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Kapat</button>
          {result && <button className="btn ghost" onClick={onDone}>Kapat & yenile</button>}
          <button className="btn" onClick={submit} disabled={busy}>{busy ? "Gönderiliyor…" : "Gönder"}</button>
        </>
      }>
      <label className="field-label">Mesaj</label>
      <input value={form.message} onChange={set("message")} />
      <label className="field-label">Hata tipi</label>
      <input value={form.error_type || ""} onChange={set("error_type")} />
      <label className="field-label">Stack trace</label>
      <textarea rows={4} value={form.stack_trace || ""} onChange={set("stack_trace")} />
      <div className="grid grid-cols-2 gap-3">
        <div><label className="field-label">Sürüm</label><input value={form.app_version || ""} onChange={set("app_version")} /></div>
        <div><label className="field-label">Platform</label><input value={form.platform || ""} onChange={set("platform")} /></div>
      </div>
      {err && <div className="mt-3 bg-danger-soft text-danger rounded-[10px] px-3.5 py-2.5 text-[13px]">{err}</div>}
      {result && (
        <div className={`mt-3.5 px-3.5 py-2.5 rounded-[10px] border text-[13px] ${result.status === "new_cluster" ? "border-ok bg-ok-soft" : "border-line bg-surface-2"}`}>
          <b>{result.status}</b>{result.match && <> · eşleşme: {result.match}</>} · {result.group_key} · {result.occurrence_count}×
        </div>
      )}
    </Modal>
  );
}
