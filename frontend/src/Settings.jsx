import { useEffect, useState } from "react";
import { api } from "./api";
import Icon from "./Icon";
import { useLocale } from "./i18n";

const PROVIDERS = [
  { key: "local", label: "LM Studio", hintKey: "settings.providerHint.local" },
  { key: "ollama", label: "Ollama", hintKey: "settings.providerHint.ollama" },
  { key: "openai", label: "OpenAI (GPT)", hintKey: "settings.providerHint.openai" },
  { key: "gemini", label: "Gemini", hintKey: "settings.providerHint.gemini" },
  { key: "claude", label: "Anthropic", hintKey: "settings.providerHint.claude" },
];

// Gizli alan input'u: değeri asla geri gelmez, sadece "ayarlı mı" bilinir.
function SecretInput({ label, name, form, set, isSet, placeholder }) {
  const { t } = useLocale();
  return (
    <div>
      <label className="field-label">{label} {isSet && <span className="text-ok font-bold inline-flex items-center gap-0.5">{t("settings.alreadySet")} <Icon icon="lucide:check" size={12} /></span>}</label>
      <input type="password" autoComplete="new-password" value={form[name]} onChange={set(name)}
        placeholder={isSet ? t("settings.secretPlaceholderWhenSet") : (placeholder || "")} />
    </div>
  );
}

export default function Settings() {
  const { t } = useLocale();
  const [data, setData] = useState(null);        // GET görünümü (maskeli + _set bayrakları)
  const [form, setForm] = useState(null);        // düzenlenebilir değerler
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);          // {ok, text}
  const [test, setTest] = useState(null);        // test-llm sonucu

  const load = () => api.settings().then((d) => {
    setData(d);
    setForm({
      llm_provider: d.llm_provider || "local",
      response_language: d.response_language || "Türkçe",
      claude_model: d.claude_model || "",
      local_base_url: d.local_base_url || "",
      local_model: d.local_model || "",
      ollama_base_url: d.ollama_base_url || "",
      ollama_model: d.ollama_model || "",
      openai_base_url: d.openai_base_url || "",
      openai_model: d.openai_model || "",
      gemini_base_url: d.gemini_base_url || "",
      gemini_model: d.gemini_model || "",
      // secret'lar boş başlar (değeri sunucudan gelmez)
      anthropic_api_key: "", local_api_key: "", openai_api_key: "", gemini_api_key: "",
      github_token: "", azure_token: "",
    });
  }).catch((e) => setMsg({ ok: false, text: e.message }));
  useEffect(() => { load(); }, []);

  if (!form) return <div className="anim-in text-muted">{t("settings.loading")}</div>;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const provider = form.llm_provider;

  const save = async () => {
    setBusy(true); setMsg(null); setTest(null);
    // Non-secret alanlar her zaman; secret alanlar yalnız doldurulduysa.
    const payload = {
      llm_provider: form.llm_provider,
      response_language: form.response_language,
      claude_model: form.claude_model, local_base_url: form.local_base_url, local_model: form.local_model,
      ollama_base_url: form.ollama_base_url, ollama_model: form.ollama_model,
      openai_base_url: form.openai_base_url, openai_model: form.openai_model,
      gemini_base_url: form.gemini_base_url, gemini_model: form.gemini_model,
    };
    for (const s of ["anthropic_api_key", "local_api_key", "openai_api_key", "gemini_api_key", "github_token", "azure_token"]) {
      if (form[s].trim()) payload[s] = form[s].trim();
    }
    try {
      const d = await api.saveSettings(payload);
      setData(d);
      setForm((f) => ({ ...f, anthropic_api_key: "", local_api_key: "", openai_api_key: "", gemini_api_key: "", github_token: "", azure_token: "" }));
      setMsg({ ok: true, text: t("settings.savedMessage") });
    } catch (e) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };

  const runTest = async () => {
    setBusy(true); setTest(null); setMsg(null);
    try { setTest(await api.testLlm()); }
    catch (e) { setTest({ ok: false, error: e.message }); } finally { setBusy(false); }
  };

  return (
    <div className="anim-in">
      <div className="mb-6">
        <h2 className="text-[22px] font-extrabold tracking-tight">{t("settings.title")}</h2>
        <p className="text-muted text-[13px] mt-1 max-w-2xl">
          {t("settings.descriptionPrefix")}
          <span className="font-mono"> .env</span>{t("settings.descriptionSuffix")}
        </p>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-[13px] font-medium ${msg.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* ---------- LLM sağlayıcı ---------- */}
        <div className="card-surface p-[18px]">
          <h3 className="text-[14px] font-bold mb-3">{t("settings.providerSectionTitle")}</h3>

          <div className="flex flex-wrap gap-1.5 p-1 rounded-xl mb-3"
            style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}>
            {PROVIDERS.map((p) => {
              const active = provider === p.key;
              return (
                <button key={p.key} type="button" onClick={() => setForm({ ...form, llm_provider: p.key })}
                  className="flex-1 min-w-[86px] py-2 rounded-lg text-[12.5px] font-semibold transition-all"
                  style={{
                    background: active ? "var(--panel)" : "transparent",
                    color: active ? "var(--text)" : "var(--muted)",
                    boxShadow: active ? "0 1px 2px rgba(0,0,0,.06)" : "none",
                    border: active ? "1px solid var(--border-strong)" : "1px solid transparent",
                  }}>
                  {p.label}
                </button>
              );
            })}
          </div>
          <p className="text-faint text-[11.5px] -mt-1 mb-2">{t(PROVIDERS.find((p) => p.key === provider)?.hintKey)}</p>

          <label className="field-label">{t("settings.responseLanguageLabel")}</label>
          <input list="response-language-options" value={form.response_language} onChange={set("response_language")} placeholder="Türkçe" />
          <datalist id="response-language-options">
            <option value="Türkçe" />
            <option value="English" />
            <option value="Deutsch" />
            <option value="Français" />
            <option value="Español" />
          </datalist>
          <p className="text-faint text-[11.5px] mt-1 mb-2">
            {t("settings.responseLanguageHelp")}
          </p>

          {provider === "local" && (
            <>
              <label className="field-label">Base URL</label>
              <input value={form.local_base_url} onChange={set("local_base_url")} placeholder="http://localhost:1234/v1" />
              <label className="field-label">Model</label>
              <input value={form.local_model} onChange={set("local_model")} placeholder="qwen/qwen3.8-27b" />
              <SecretInput label={t("settings.localApiKeyLabel")} name="local_api_key" form={form} set={set} isSet={data?.local_api_key_set} />
            </>
          )}
          {provider === "ollama" && (
            <>
              <label className="field-label">Base URL</label>
              <input value={form.ollama_base_url} onChange={set("ollama_base_url")} placeholder="http://localhost:11434/v1" />
              <label className="field-label">Model</label>
              <input value={form.ollama_model} onChange={set("ollama_model")} placeholder="llama3.1" />
            </>
          )}
          {provider === "openai" && (
            <>
              <SecretInput label={t("settings.openaiApiKeyLabel")} name="openai_api_key" form={form} set={set} isSet={data?.openai_api_key_set} placeholder="sk-…" />
              <label className="field-label">Model</label>
              <input value={form.openai_model} onChange={set("openai_model")} placeholder="gpt-4o-mini" />
              <label className="field-label">{t("settings.baseUrlOptionalLabel")}</label>
              <input value={form.openai_base_url} onChange={set("openai_base_url")} placeholder="https://api.openai.com/v1" />
            </>
          )}
          {provider === "gemini" && (
            <>
              <SecretInput label={t("settings.geminiApiKeyLabel")} name="gemini_api_key" form={form} set={set} isSet={data?.gemini_api_key_set} placeholder="AIza…" />
              <label className="field-label">Model</label>
              <input value={form.gemini_model} onChange={set("gemini_model")} placeholder="gemini-2.0-flash" />
              <label className="field-label">{t("settings.baseUrlOptionalLabel")}</label>
              <input value={form.gemini_base_url} onChange={set("gemini_base_url")} placeholder="https://generativelanguage.googleapis.com/v1beta/openai" />
            </>
          )}
          {provider === "claude" && (
            <>
              <SecretInput label={t("settings.anthropicApiKeyLabel")} name="anthropic_api_key" form={form} set={set} isSet={data?.anthropic_api_key_set} placeholder="sk-ant-…" />
              <label className="field-label">Model</label>
              <input value={form.claude_model} onChange={set("claude_model")} placeholder="claude-sonnet-5" />
            </>
          )}

          <div className="flex items-center gap-2 mt-4">
            <button className="btn ghost" onClick={runTest} disabled={busy}>{t("settings.testConnection")}</button>
            <span className="text-faint text-[11px]">{t("settings.triesSavedConfig")}</span>
          </div>
          {test && (
            <div className={`mt-3 px-3.5 py-2.5 rounded-[10px] text-[13px] ${test.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>
              {test.ok ? <span className="inline-flex items-center gap-1.5"><Icon icon="lucide:circle-check" size={15} /> {t("settings.testSuccessPrefix")} <b>{test.sample_title}</b></span> : <span className="inline-flex items-center gap-1.5"><Icon icon="lucide:circle-x" size={15} /> {test.error}</span>}
            </div>
          )}
        </div>

        {/* ---------- Kaynak kod erişimi ---------- */}
        <div className="card-surface p-[18px]">
          <h3 className="text-[14px] font-bold mb-1">{t("settings.sourceCodeAccessTitle")}</h3>
          <p className="text-faint text-[11.5px] mb-2">
            {t("settings.sourceCodeAccessDesc")}
          </p>
          <SecretInput label="GitHub token" name="github_token" form={form} set={set} isSet={data?.github_token_set} placeholder="ghp_…" />
          <SecretInput label="Azure DevOps token (PAT)" name="azure_token" form={form} set={set} isSet={data?.azure_token_set} placeholder="Azure PAT" />
          <div className="mt-3 text-faint text-[11.5px]">
            <Icon icon="lucide:lock" size={12} className="inline align-[-0.1em] mr-1" />{t("settings.secretsNeverReturned")}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <button className="btn" onClick={save} disabled={busy}>{busy ? t("settings.saving") : t("settings.saveSettings")}</button>
      </div>
    </div>
  );
}
