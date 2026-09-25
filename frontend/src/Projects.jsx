import { useEffect, useState } from "react";
import { api } from "./api";
import { useProject } from "./project";
import { useConfirm } from "./Modal";
import ProjectRepos from "./ProjectRepos";
import { roleLabel } from "./labels";
import { useLocale } from "./i18n";

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export default function Projects() {
  const confirm = useConfirm();
  const { t } = useLocale();
  const { reload, projectId } = useProject();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: "", key: "" });
  const [keyEdited, setKeyEdited] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [members, setMembers] = useState([]);

  const loadProjects = () => api.projects().then(setProjects).catch((e) => setErr(e.message));
  useEffect(() => { loadProjects(); api.users().then(setUsers).catch(() => {}); }, []);

  const loadMembers = (id) => api.projectMembers(id).then(setMembers).catch(() => {});
  const openProject = (id) => { const next = openId === id ? null : id; setOpenId(next); if (next) loadMembers(next); };

  const create = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await api.createProject({ name: form.name.trim(), key: (form.key || slugify(form.name)).trim() });
      setForm({ name: "", key: "" }); setKeyEdited(false);
      await loadProjects(); await reload();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const remove = async (p) => {
    const yes = await confirm({
      title: t("projects.deleteTitle"),
      message: t("projects.deleteMessage", { name: p.name }),
      confirmText: t("projects.delete"), danger: true,
    });
    if (!yes) return;
    try {
      await api.deleteProject(p.id);
      if (openId === p.id) setOpenId(null);
      await loadProjects(); await reload();
    } catch (e) { setErr(e.message); }
  };

  const addMember = async (userId) => {
    setMembers(await api.addProjectMember(openId, Number(userId)));
    loadProjects();
  };
  const removeMember = async (userId) => {
    await api.removeProjectMember(openId, userId);
    loadMembers(openId); loadProjects();
  };

  const memberIds = new Set(members.map((m) => m.id));
  const nonMembers = users.filter((u) => !memberIds.has(u.id));

  return (
    <div className="anim-in">
      <div className="mb-6">
        <h2 className="text-[22px] font-extrabold tracking-tight">{t("projects.title")}</h2>
        <p className="text-muted text-[13px] mt-1 max-w-2xl">
          {t("projects.subtitle")}
        </p>
      </div>

      {err && <div className="mb-4 px-4 py-3 rounded-xl text-[13px] font-medium"
        style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>{err}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-start">
        {/* Yeni proje */}
        <form className="card-surface p-[18px]" onSubmit={create}>
          <h3 className="text-[14px] font-bold mb-3">{t("projects.newProject")}</h3>
          <label className="field-label">{t("projects.name")}</label>
          <input required placeholder={t("projects.namePlaceholder")} value={form.name}
            onChange={(e) => setForm((f) => ({ name: e.target.value, key: keyEdited ? f.key : slugify(e.target.value) }))} />
          <label className="field-label">{t("projects.keyLabel")}</label>
          <input required placeholder={t("projects.keyPlaceholder")} value={form.key}
            onChange={(e) => { setKeyEdited(true); setForm((f) => ({ ...f, key: e.target.value })); }} />
          <p className="text-faint text-[11.5px] mt-1.5">{t("projects.keyHint")}</p>
          <button className="btn w-full mt-4" type="submit" disabled={busy}>
            {busy ? t("projects.creating") : t("projects.createProject")}
          </button>
        </form>

        {/* Proje listesi */}
        <div className="card-surface p-[18px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold">{t("projects.title")}</h3>
            <span className="badge sev-low">{projects.length}</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {projects.map((p) => (
              <div key={p.id} className="rounded-xl border" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2 p-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[14px]">{p.name}</span>
                      {p.id === projectId && <span className="badge badge-ok">{t("projects.selected")}</span>}
                    </div>
                    <div className="text-faint text-[11.5px] mt-0.5 font-mono">{p.key} · {t("projects.memberCount", { count: p.member_count })}</div>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <button className="btn ghost sm" onClick={() => openProject(p.id)}>
                      {openId === p.id ? t("projects.close") : t("projects.edit")}
                    </button>
                    <button className="btn ghost sm danger" onClick={() => remove(p)}>{t("projects.delete")}</button>
                  </div>
                </div>

                {openId === p.id && (
                  <div className="border-t px-3.5 py-3" style={{ borderColor: "var(--border)" }}>
                    <div className="text-faint text-[11px] uppercase tracking-wide font-bold mb-2">{t("projects.team", { count: members.length })}</div>
                    {members.length === 0 && <div className="text-faint text-[12.5px] mb-2">{t("projects.noMembers")}</div>}
                    <div className="flex flex-col gap-1.5 mb-3">
                      {members.map((m) => (
                        <div key={m.id} className="flex items-center gap-2">
                          <span className="avatar w-[24px] h-[24px] text-[10px]">{(m.name || m.email)[0].toUpperCase()}</span>
                          <span className="text-[13px] font-semibold">{m.name || m.email}</span>
                          <span className="badge sev-low !text-muted">{roleLabel(m.role)}</span>
                          <button className="ml-auto btn ghost sm danger" onClick={() => removeMember(m.id)}>{t("projects.remove")}</button>
                        </div>
                      ))}
                    </div>
                    <label className="field-label">{t("projects.addMember")}</label>
                    <select value="" onChange={(e) => e.target.value && addMember(e.target.value)}>
                      <option value="">{t("projects.selectUser")}</option>
                      {nonMembers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name || u.email} · {roleLabel(u.role)}</option>
                      ))}
                    </select>

                    <div className="text-faint text-[11px] uppercase tracking-wide font-bold mt-5 mb-2">{t("projects.repos")}</div>
                    <ProjectRepos projectId={p.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
