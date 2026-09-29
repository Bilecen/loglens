import { useEffect, useState } from "react";
import { api } from "./api";
import { AuthProvider, useAuth } from "./auth";
import { ProjectProvider, useProject } from "./project";
import { RealtimeProvider } from "./realtime";
import { ConfirmProvider } from "./Modal";
import { LocaleProvider, useLocale } from "./i18n";
import ProfileMenu from "./ProfileMenu";
import NotificationBell from "./NotificationBell";
import TeamPanel from "./TeamPanel";
import Icon from "./Icon";
import Login from "./Login";
import Dashboard from "./Dashboard";
import Errors from "./Errors";
import Users from "./Users";
import Webhooks from "./Webhooks";
import Projects from "./Projects";
import Integrations from "./Integrations";
import Docs from "./Docs";
import Settings from "./Settings";

const NAV = [
  { key: "dashboard", labelKey: "app.nav.dashboard", icon: "lucide:layout-dashboard" },
  { key: "errors", labelKey: "app.nav.errors", icon: "lucide:triangle-alert" },
  { key: "projects", labelKey: "app.nav.projects", icon: "lucide:folders", admin: true },
  { key: "users", labelKey: "app.nav.users", icon: "lucide:users", admin: true },
  { key: "webhooks", labelKey: "app.nav.webhooks", icon: "lucide:webhook", admin: true },
  { key: "integrations", labelKey: "app.nav.integrations", icon: "lucide:plug", admin: true },
  { key: "settings", labelKey: "app.nav.settings", icon: "lucide:settings", admin: true },
  { key: "docs", labelKey: "app.nav.docs", icon: "lucide:book-open" },
];

function Shell() {
  const { t } = useLocale();
  const { isAdmin } = useAuth();
  const { projects, projectId, setProjectId } = useProject();
  const [view, setView] = useState("dashboard");
  const [errorsFilter, setErrorsFilter] = useState(null);
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [teamOpen, setTeamOpen] = useState(false);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ ok: false }));
    if (projectId) api.stats(projectId).then(setStats).catch(() => {});
  }, [view, projectId]);

  const items = NAV.filter((n) => !n.admin || isAdmin);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ---------- Topbar ---------- */}
      <header className="h-14 shrink-0 flex items-center gap-2.5 px-3 md:px-4 border-b border-line bg-surface sticky top-0 z-30">
        <button onClick={() => setSidebarOpen((o) => !o)} title={t("app.topbar.toggleSidebar")}
          className="w-[36px] h-[36px] rounded-lg grid place-items-center text-muted hover:text-fg hover:bg-surface-2 transition">
          <Icon icon="lucide:menu" size={19} />
        </button>
        <Icon icon="lucide:scan-eye" size={22} className="text-brand" />
        <span className="font-extrabold text-[16px] tracking-tight hidden sm:block">LogLens</span>
        <select className="w-auto max-w-[190px] text-[13px] font-semibold py-1.5 ml-1"
          value={projectId ?? ""} onChange={(e) => setProjectId(Number(e.target.value))}>
          {projects.length === 0 && <option value="">{t("app.topbar.noProject")}</option>}
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setTeamOpen(true)} title={t("app.topbar.teamChat")}
            className="w-[36px] h-[36px] rounded-lg grid place-items-center text-muted hover:text-fg hover:bg-surface-2 transition">
            <Icon icon="lucide:messages-square" size={18} />
          </button>
          <NotificationBell />
          <ProfileMenu />
        </div>
      </header>

      {/* ---------- Gövde: sidebar + main ---------- */}
      <div className="flex flex-1 min-h-0">
        {sidebarOpen && (
          <aside className="w-[228px] shrink-0 bg-surface border-r border-line px-3 py-4 flex flex-col sticky top-14 h-[calc(100vh-3.5rem)] overflow-auto anim-in">
            <nav className="flex flex-col gap-0.5 flex-1">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-faint px-2.5 mb-1.5">{t("app.sidebar.menu")}</div>
              {items.map((n) => {
                const active = view === n.key;
                return (
                  <button key={n.key} onClick={() => { setErrorsFilter(null); setView(n.key); }}
                    className={`flex items-center gap-3 px-2.5 py-2 rounded-[9px] text-[13.5px] font-semibold text-left w-full transition-colors
                      ${active ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2 hover:text-fg"}`}>
                    <Icon icon={n.icon} size={18} />
                    {t(n.labelKey)}
                    {n.key === "errors" && stats?.open > 0 && (
                      <span className={`ml-auto text-[11px] font-bold px-1.5 rounded-full ${active ? "bg-brand text-white" : "bg-surface-3 text-muted"}`}>
                        {stats.open}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="pt-4 border-t border-line">
              {health && (
                <span className={`badge ${health.ok ? "badge-ok" : "badge-err"}`}>
                  {health.ok ? `● ${health.provider}` : `● ${t("app.sidebar.noConnection")}`}
                </span>
              )}
            </div>
          </aside>
        )}

        <main className="flex-1 min-w-0 p-5 md:px-8 md:py-7">
          <div className="max-w-[1240px]">
            {view === "dashboard" && <Dashboard onOpenErrors={(f) => { setErrorsFilter(f || null); setView("errors"); }} />}
            {view === "errors" && <Errors initialFilter={errorsFilter} />}
            {view === "projects" && isAdmin && <Projects />}
            {view === "users" && isAdmin && <Users />}
            {view === "webhooks" && isAdmin && <Webhooks />}
            {view === "integrations" && isAdmin && <Integrations />}
            {view === "settings" && isAdmin && <Settings />}
            {view === "docs" && <Docs />}
          </div>
        </main>
      </div>

      <TeamPanel open={teamOpen} onClose={() => setTeamOpen(false)} />
    </div>
  );
}

function Gate() {
  const { t } = useLocale();
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-muted">{t("app.loading")}</div>;
  return user ? <ProjectProvider><RealtimeProvider><Shell /></RealtimeProvider></ProjectProvider> : <Login />;
}

export default function App() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <ConfirmProvider>
          <Gate />
        </ConfirmProvider>
      </AuthProvider>
    </LocaleProvider>
  );
}
