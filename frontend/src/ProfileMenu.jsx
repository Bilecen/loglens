import { useState } from "react";
import { useAuth } from "./auth";
import { useTheme, useStyle, STYLES } from "./theme";
import { useLocale, LOCALES } from "./i18n";
import { roleLabel } from "./labels";
import Icon from "./Icon";
import Avatar from "./Avatar";
import ProfileEditModal from "./ProfileEditModal";
import McpTokensModal from "./McpTokensModal";

export default function ProfileMenu() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { style, setStyle } = useStyle();
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 pl-3.5 pr-1.5 py-1 rounded-full bg-surface border border-line shadow-md hover:border-line-strong transition"
        title={user.name || user.email}>
        <span className="text-[13px] font-semibold text-fg max-w-[150px] truncate">{user.name || user.email}</span>
        <Avatar user={user} size={32} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[268px] card-surface p-3.5 shadow-2xl z-50 anim-in">
            {/* Kullanıcı */}
            <div className="flex items-center gap-2.5 pb-3 mb-3 border-b border-line">
              <Avatar user={user} size={40} />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[13.5px] truncate">{user.name || user.email}</div>
                <div className="text-[11.5px] text-muted">{roleLabel(user.role)}</div>
              </div>
              <button className="btn ghost sm" title={t("mcpTokens.title")}
                onClick={() => { setOpen(false); setMcpOpen(true); }}>
                <Icon icon="lucide:key" size={13} />
              </button>
              <button className="btn ghost sm" title={t("profileEdit.title")}
                onClick={() => { setOpen(false); setEditOpen(true); }}>
                <Icon icon="lucide:pencil" size={13} />
              </button>
            </div>

            {/* Tema */}
            <div className="text-faint text-[10.5px] uppercase tracking-wider font-bold mb-1.5">{t("profileMenu.theme")}</div>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg mb-3"
              style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}>
              {[["light", t("profileMenu.light"), "lucide:sun"], ["dark", t("profileMenu.dark"), "lucide:moon"]].map(([val, label, ic]) => {
                const active = theme === val;
                return (
                  <button key={val} onClick={() => theme !== val && toggle()}
                    className="flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12.5px] font-semibold transition-all"
                    style={{
                      background: active ? "var(--panel)" : "transparent",
                      color: active ? "var(--text)" : "var(--muted)",
                      boxShadow: active ? "0 1px 2px rgba(0,0,0,.08)" : "none",
                    }}>
                    <Icon icon={ic} size={14} /> {label}
                  </button>
                );
              })}
            </div>

            {/* Dil */}
            <div className="text-faint text-[10.5px] uppercase tracking-wider font-bold mb-1.5">{t("common.language")}</div>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg mb-3"
              style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}>
              {LOCALES.map((l) => {
                const active = locale === l.key;
                return (
                  <button key={l.key} onClick={() => setLocale(l.key)}
                    className="flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12.5px] font-semibold transition-all"
                    style={{
                      background: active ? "var(--panel)" : "transparent",
                      color: active ? "var(--text)" : "var(--muted)",
                      boxShadow: active ? "0 1px 2px rgba(0,0,0,.08)" : "none",
                    }}>
                    <Icon icon="lucide:languages" size={14} /> {t(l.labelKey)}
                  </button>
                );
              })}
            </div>

            {/* Tasarım stili */}
            <div className="text-faint text-[10.5px] uppercase tracking-wider font-bold mb-1.5">{t("profileMenu.design")}</div>
            <select className="mb-1 text-[13px] font-semibold py-2" value={style}
              onChange={(e) => setStyle(e.target.value)}>
              {STYLES.map((s) => (
                <option key={s.key} value={s.key}>{t(s.labelKey)} — {t(s.hintKey)}</option>
              ))}
            </select>
            <div className="text-faint text-[10.5px] mb-3.5">{t(STYLES.find((s) => s.key === style)?.hintKey)}</div>

            <button className="btn ghost w-full" onClick={logout}>{t("profileMenu.logout")}</button>
          </div>
        </>
      )}

      <ProfileEditModal open={editOpen} onClose={() => setEditOpen(false)} />
      <McpTokensModal open={mcpOpen} onClose={() => setMcpOpen(false)} />
    </div>
  );
}
