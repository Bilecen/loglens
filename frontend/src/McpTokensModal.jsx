import { useEffect, useState } from "react";
import { api } from "./api";
import { useConfirm, Modal } from "./Modal";
import { timeAgo } from "./labels";
import Icon from "./Icon";
import { useLocale } from "./i18n";

function CopyButton({ text, className = "btn ghost sm", label, doneLabel }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }
    catch { /* clipboard izni yoksa sessiz geç */ }
  };
  return <button type="button" className={`${className} inline-flex items-center gap-1`} onClick={copy}>{done ? <><Icon icon="lucide:check" size={13} /> {doneLabel}</> : label}</button>;
}

export default function McpTokensModal({ open, onClose }) {
  const confirm = useConfirm();
  const { t } = useLocale();
  const [tokens, setTokens] = useState([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [fresh, setFresh] = useState(null); // { token, name } — yalnızca oluşturunca bir kez

  const load = () => api.mcpTokens().then(setTokens).catch((e) => setErr(e.message));
  useEffect(() => { if (open) load(); }, [open]);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setErr(null);
    try {
      const row = await api.createMcpToken(name.trim());
      setFresh({ token: row.token, name: row.name });
      setName("");
      await load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const revoke = async (token) => {
    const yes = await confirm({
      title: t("mcpTokens.revokeTitle"),
      message: t("mcpTokens.revokeMessage", { name: token.name }),
      confirmText: t("mcpTokens.revokeButton"), danger: true,
    });
    if (!yes) return;
    try { await api.revokeMcpToken(token.id); if (fresh) setFresh(null); await load(); } catch (e) { setErr(e.message); }
  };

  const serverUrl = `${window.location.origin}/mcp/`;

  return (
    <Modal open={open} onClose={() => { setFresh(null); onClose(); }} title={t("mcpTokens.title")} size={560}>
      <p className="text-muted text-[13px] leading-relaxed mb-4">
        {t("mcpTokens.intro")}
      </p>

      {err && (
        <div className="mb-3 px-3.5 py-2.5 rounded-[10px] text-[13px] font-medium bg-danger-soft text-danger">{err}</div>
      )}

      {fresh && (
        <div className="mb-4 rounded-xl border p-3.5" style={{ borderColor: "var(--warn, var(--border-strong))", background: "var(--panel-2)" }}>
          <div className="flex items-center gap-1.5 text-[12.5px] font-bold mb-2">
            <Icon icon="lucide:triangle-alert" size={14} /> {t("mcpTokens.createdWarning", { name: fresh.name })}
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 text-[12px] font-mono bg-surface-2 border border-line rounded-lg px-2.5 py-2 overflow-x-auto whitespace-nowrap">
              {fresh.token}
            </code>
            <CopyButton text={fresh.token} label={t("mcpTokens.copy")} doneLabel={t("mcpTokens.copied")} />
          </div>
          <div className="mt-3 text-faint text-[11.5px]">{t("mcpTokens.connectLabel")}</div>
          <pre className="mt-1 bg-code border border-line-strong rounded-[10px] px-3 py-2.5 overflow-x-auto text-[11.5px] font-mono leading-relaxed m-0">
{`claude mcp add --transport http loglens ${serverUrl} \\\n  --header "Authorization: Bearer ${fresh.token}"`}
          </pre>
        </div>
      )}

      <form className="flex items-end gap-2 mb-4" onSubmit={create}>
        <div className="flex-1">
          <label className="field-label">{t("mcpTokens.newKeyLabel")}</label>
          <input placeholder={t("mcpTokens.newKeyPlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="btn" type="submit" disabled={busy || !name.trim()}>{t("mcpTokens.createButton")}</button>
      </form>

      <div className="text-faint text-[10.5px] uppercase tracking-wider font-bold mb-2">{t("mcpTokens.existingKeys")}</div>
      {tokens.length === 0 ? (
        <div className="text-faint text-[12.5px] py-3">{t("mcpTokens.emptyState")}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {tokens.map((token) => (
            <div key={token.id} className="flex items-center gap-2 rounded-lg border px-3 py-2.5" style={{ borderColor: "var(--border)" }}>
              <Icon icon="lucide:key" size={14} className="text-muted shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[13px] truncate">{token.name || t("mcpTokens.unnamed")}</div>
                <div className="text-faint text-[11px]">
                  {t("mcpTokens.createdAgo", { time: timeAgo(token.created_at) })} · {token.last_used_at ? t("mcpTokens.lastUsed", { time: timeAgo(token.last_used_at) }) : t("mcpTokens.neverUsed")}
                </div>
              </div>
              <button className="btn ghost sm danger" onClick={() => revoke(token)}>{t("mcpTokens.revokeButton")}</button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
