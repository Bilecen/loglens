import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { useConfirm } from "./Modal";
import { timeAgo, ROLES, roleLabel } from "./labels";

const EMPTY = { email: "", name: "", password: "", role: "developer" };
const PAGE_SIZE = 8;

export default function Users() {
  const { user: me } = useAuth();
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState("");
  const [role, setRoleFilter] = useState("");
  const [page, setPage] = useState(0);

  const load = () => api.users().then(setUsers).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => { setPage(0); }, [query, role]);

  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    return users.filter((u) =>
      (!role || u.role === role) &&
      (!t || (u.name || "").toLowerCase().includes(t) || u.email.toLowerCase().includes(t)));
  }, [users, query, role]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null); setOk(null);
    try {
      await api.createUser({ email: form.email.trim(), name: form.name.trim() || null, password: form.password, role: form.role });
      setOk(`${form.email} oluşturuldu`); setForm(EMPTY); await load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const setRole = async (id, role) => {
    setBusy(true); setErr(null);
    try { await api.setUserRole(id, role); await load(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const remove = async (id, label) => {
    const yes = await confirm({
      title: "Kullanıcıyı sil",
      message: `${label} kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      confirmText: "Sil", danger: true,
    });
    if (!yes) return;
    setBusy(true); setErr(null);
    try { await api.deleteUser(id); await load(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="anim-in">
      <div className="mb-6">
        <h2 className="text-[22px] font-extrabold tracking-tight">Kullanıcılar</h2>
        <p className="text-muted text-[13px] mt-1">Ekibini yönet, rol ata, yeni hesap oluştur.</p>
      </div>
      {err && <div className="mb-3.5 bg-danger-soft text-danger rounded-[10px] px-3.5 py-2.5 text-[13px]">{err}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-[18px] items-start">
        <div className="flex flex-col gap-3">
          {/* Filtre çubuğu */}
          <div className="flex flex-wrap gap-2.5">
            <input className="flex-1 min-w-[200px]" placeholder="İsim / e-posta ara…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select className="w-auto min-w-[130px] text-[13px] py-2" value={role} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">Tüm roller</option>
              {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
          </div>

          <div className="card-surface overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-2">
                  {["Ad", "E-posta", "Rol", "Kayıt", ""].map((h, i) => (
                    <th key={i} className="text-left text-[11px] uppercase tracking-wide text-faint font-bold px-4 py-3 border-b border-line">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted text-[13px]">Eşleşen kullanıcı yok.</td></tr>
                )}
                {paged.map((u) => (
                  <tr key={u.id} className="border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3 text-[13px]">
                      <span className="avatar w-[26px] h-[26px] mr-2 align-middle">{(u.name || u.email)[0].toUpperCase()}</span>
                      {u.name || "—"}{u.id === me.id && <span className="text-muted"> (ben)</span>}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-mono">{u.email}</td>
                    <td className="px-4 py-3">
                      <select className="w-auto text-[12px] font-semibold rounded-full py-1 pl-2.5 pr-6" value={u.role}
                        disabled={busy || u.id === me.id} onChange={(e) => setRole(u.id, e.target.value)}>
                        {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted">{timeAgo(u.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {u.id !== me.id && <button className="btn ghost sm danger" disabled={busy} onClick={() => remove(u.id, u.name || u.email)}>Sil</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sayfalama */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-muted text-[12px]">
                {filtered.length} kullanıcı{filtered.length > PAGE_SIZE && <> · sayfa {page + 1}/{pageCount}</>}
              </span>
              {pageCount > 1 && (
                <div className="flex gap-1.5">
                  <button className="btn ghost sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Önceki</button>
                  <button className="btn ghost sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Sonraki →</button>
                </div>
              )}
            </div>
          )}
        </div>

        <form className="card-surface p-[18px]" onSubmit={create}>
          <h3 className="text-[14px] font-bold mb-1">Yeni kullanıcı</h3>
          <label className="field-label">E-posta</label>
          <input required type="email" placeholder="uye@sirket.com" value={form.email} onChange={set("email")} />
          <label className="field-label">Ad</label>
          <input placeholder="Ad (opsiyonel)" value={form.name} onChange={set("name")} />
          <label className="field-label">Geçici parola</label>
          <input required type="password" minLength={6} placeholder="En az 6 karakter" value={form.password} onChange={set("password")} />
          <label className="field-label">Rol</label>
          <select value={form.role} onChange={set("role")}>
            {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
          {ok && <div className="mt-3 bg-ok-soft text-ok rounded-[9px] px-3 py-2 text-[13px] font-semibold">{ok}</div>}
          <button className="btn btn-block mt-4" type="submit" disabled={busy}>{busy ? "Oluşturuluyor…" : "Kullanıcı oluştur"}</button>
        </form>
      </div>
    </div>
  );
}
