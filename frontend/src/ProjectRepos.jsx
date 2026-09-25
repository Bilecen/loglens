import { useEffect, useState } from "react";
import { api } from "./api";
import { useConfirm } from "./Modal";
import { timeAgo } from "./labels";
import Icon from "./Icon";

const EMPTY = { provider: "github", full_name: "", default_branch: "main", token: "", path_prefix: "" };

const PROVIDERS = {
  github: {
    label: "GitHub", icon: "simple-icons:github",
    nameLabel: "Repo (owner/repo)", namePlaceholder: "acme/mobile-app",
    tokenPlaceholder: "ghp_… (boşsa sunucudaki token)",
    url: (fn) => `https://github.com/${fn}`,
  },
  azure: {
    label: "Azure DevOps", icon: "simple-icons:azuredevops",
    nameLabel: "Repo (org / proje / repo)", namePlaceholder: "acme/Mobile/mobile-app",
    tokenPlaceholder: "Azure PAT (Code:Read) — boşsa sunucudaki token",
    url: (fn) => {
      const [org, project, ...rest] = fn.split("/");
      return `https://dev.azure.com/${org}/${project}/_git/${rest.join("/")}`;
    },
  },
};

// Bir projeye bağlı repoları yönetir (liste + bağla + kaldır).
export default function ProjectRepos({ projectId, onChange }) {
  const confirm = useConfirm();
  const [repos, setRepos] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const load = () => api.repos(projectId).then(setRepos).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [projectId]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const P = PROVIDERS[form.provider] || PROVIDERS.github;

  const add = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api.addRepo(projectId, {
        provider: form.provider,
        full_name: form.full_name.trim(),
        default_branch: form.default_branch.trim() || "main",
        token: form.token.trim() || null,
        path_prefix: form.path_prefix.trim() || null,
      });
      setForm({ ...EMPTY, provider: form.provider });
      await load(); onChange?.();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const remove = async (r) => {
    const yes = await confirm({
      title: "Repoyu kaldır",
      message: `${r.full_name} bağlantısı kaldırılacak. Kaynak kod eşlemesi çalışmayacak.`,
      confirmText: "Kaldır", danger: true,
    });
    if (!yes) return;
    try { await api.deleteRepo(r.id); await load(); onChange?.(); } catch (e) { setErr(e.message); }
  };

  return (
    <div>
      {err && <div className="mb-2 text-danger text-[12px]">{err}</div>}

      {/* Bağlı repolar */}
      {repos.length === 0
        ? <div className="text-faint text-[12.5px] mb-3">Bu projeye henüz repo bağlı değil.</div>
        : (
          <div className="flex flex-col gap-1.5 mb-3">
            {repos.map((r) => {
              const cfg = PROVIDERS[r.provider] || PROVIDERS.github;
              return (
                <div key={r.id} className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-md grid place-items-center shrink-0 ${
                    r.provider === "azure" ? "bg-info-soft text-info" : "bg-brand-soft text-brand"}`}>
                    <Icon icon={cfg.icon} size={14} />
                  </span>
                  <span className="font-mono text-[12.5px] font-semibold truncate">{r.full_name}</span>
                  <span className="text-faint text-[11px]">{r.default_branch}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <a className="btn ghost sm inline-flex items-center gap-1" href={cfg.url(r.full_name)} target="_blank" rel="noreferrer">Aç <Icon icon="lucide:external-link" size={12} /></a>
                    <button className="btn ghost sm danger" onClick={() => remove(r)}>Kaldır</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {/* Repo bağla (kompakt form) */}
      <form onSubmit={add} className="rounded-lg p-3" style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}>
        <div className="flex gap-2 mb-2">
          <select className="w-auto min-w-[130px] text-[12.5px] py-1.5" value={form.provider} onChange={set("provider")}>
            <option value="github">GitHub</option>
            <option value="azure">Azure DevOps</option>
          </select>
          <input className="flex-1 text-[12.5px] py-1.5" required placeholder={P.namePlaceholder}
            value={form.full_name} onChange={set("full_name")} />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input className="text-[12.5px] py-1.5" placeholder="dal (main)" value={form.default_branch} onChange={set("default_branch")} />
          <input className="text-[12.5px] py-1.5" placeholder="yol öneki (app/src/)" value={form.path_prefix} onChange={set("path_prefix")} />
        </div>
        <input className="text-[12.5px] py-1.5 mb-2" type="password" placeholder={P.tokenPlaceholder}
          value={form.token} onChange={set("token")} />
        <button className="btn sm" type="submit" disabled={busy}>
          {busy ? "Bağlanıyor…" : <><Icon icon={P.icon} size={14} /> Repo bağla</>}
        </button>
      </form>
    </div>
  );
}
