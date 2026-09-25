import { useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { useLocale } from "./i18n";
import Icon from "./Icon";
import ServerQR from "./ServerQR";

export default function Login() {
  const { t } = useLocale();
  const { login, register } = useAuth();
  const [needsBootstrap, setNeedsBootstrap] = useState(null);
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.bootstrap().then((r) => setNeedsBootstrap(r.needs_bootstrap)).catch(() => setNeedsBootstrap(false));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (needsBootstrap) await register({ email: form.email, password: form.password, name: form.name || null });
      else await login(form.email, form.password);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const bootstrap = needsBootstrap === true;

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-bg">
      {/* Sol: gradyan hero */}
      <div className="relative hidden md:flex overflow-hidden text-white
                      bg-[linear-gradient(150deg,#4f46e5_0%,#6366f1_45%,#0891b2_120%)]">
        <div className="absolute inset-0 opacity-90
             bg-[radial-gradient(600px_400px_at_80%_10%,rgba(255,255,255,0.18),transparent_60%),radial-gradient(500px_500px_at_10%_90%,rgba(255,255,255,0.10),transparent_55%)]" />
        <div className="relative px-14 py-16 max-w-[520px] flex flex-col justify-center">
          <div className="flex items-center gap-3">
            <Icon icon="lucide:scan-eye" size={30} />
            <h1 className="text-[22px] font-extrabold">LogLens</h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/20">v1.0.0</span>
          </div>
          <h2 className="text-[34px] leading-[1.2] font-extrabold tracking-tight mt-8 mb-4">
            {t("login.heroTitle").split("\n").map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </h2>
          <p className="text-[15px] leading-relaxed opacity-90 mb-7">
            {t("login.heroSubtitle")}
          </p>
          <ul className="flex flex-col gap-3">
            {[t("login.feature1"), t("login.feature2"), t("login.feature3")].map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-[14px] opacity-95">
                <span className="w-[18px] h-[18px] rounded-md bg-white/20 grid place-items-center"><Icon icon="lucide:check" size={12} /></span>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-9">
            <ServerQR />
          </div>
        </div>
      </div>

      {/* Sağ: form */}
      <div className="relative flex flex-col items-center justify-center p-10">
        <div className="w-full max-w-[380px]">
          <div className="md:hidden flex items-center gap-2.5 mb-8">
            <Icon icon="lucide:scan-eye" size={28} className="text-brand" />
            <h1 className="text-xl font-extrabold">LogLens</h1>
          </div>
          <h3 className="text-2xl font-extrabold tracking-tight mb-1.5">
            {bootstrap ? t("login.bootstrapTitle") : t("login.welcomeBackTitle")}
          </h3>
          <p className="text-muted text-[13px] mb-6">
            {bootstrap ? t("login.bootstrapSubtitle")
              : t("login.loginSubtitle")}
          </p>

          <form onSubmit={submit}>
            {bootstrap && (
              <>
                <label className="field-label">{t("login.nameLabel")}</label>
                <input value={form.name} onChange={set("name")} placeholder={t("login.namePlaceholder")} />
              </>
            )}
            <label className="field-label">{t("login.emailLabel")}</label>
            <input type="email" required value={form.email} onChange={set("email")} placeholder={t("login.emailPlaceholder")} autoFocus />
            <label className="field-label">{t("login.passwordLabel")}</label>
            <input type="password" required minLength={6} value={form.password} onChange={set("password")} placeholder={bootstrap ? t("login.passwordPlaceholderBootstrap") : t("login.passwordPlaceholderDefault")} />

            {err && <div className="mt-3 bg-danger-soft text-danger rounded-[10px] px-3.5 py-2.5 text-[13px]">{err}</div>}

            <button className="btn btn-block mt-4.5" style={{ marginTop: 18 }} type="submit" disabled={busy || needsBootstrap === null}>
              {busy ? "..." : bootstrap ? t("login.createAdminButton") : t("login.loginButton")}
            </button>
          </form>
        </div>
        <p className="absolute bottom-6 text-muted text-[12px]">{t("login.footer", { version: "1.0.0" })}</p>
      </div>
    </div>
  );
}
