import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import { useLocale } from "./i18n";

// Temaya uygun genel modal kabuğu (IngestModal ile aynı dil).
// backdrop tıklaması + ESC ile kapanır.
export function Modal({ open, onClose, title, children, footer, size = 460 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div onClick={onClose}
      className="fixed inset-0 flex items-center justify-center p-5 z-50"
      style={{ animation: "fadeIn .2s", background: "rgba(15,18,26,.62)", backdropFilter: "blur(10px) saturate(.85)", WebkitBackdropFilter: "blur(10px) saturate(.85)" }}>
      <div onClick={(e) => e.stopPropagation()}
        className="anim-in card-surface w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        style={{ maxWidth: size }}>
        {title && (
          <div className="flex justify-between items-center gap-3 px-[22px] pt-[20px] pb-3 shrink-0">
            <h3 className="text-[17px] font-extrabold tracking-tight">{title}</h3>
            <button className="btn ghost sm" onClick={onClose} aria-label="Kapat"><Icon icon="lucide:x" size={15} /></button>
          </div>
        )}
        <div className={`px-[22px] overflow-auto flex-1 min-h-0 ${title ? "" : "pt-[22px]"} pb-[22px]`}>
          {children}
        </div>
        {footer && (
          <div className="flex gap-2.5 justify-end px-[22px] py-3.5 border-t border-line shrink-0 bg-surface">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ---- Imperative confirm: const confirm = useConfirm(); await confirm({...}) ----
const ConfirmCtx = createContext(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }) {
  const { t } = useLocale();
  const [state, setState] = useState(null); // { opts, resolve }

  const confirm = useCallback((opts) => new Promise((resolve) => {
    setState({ opts: typeof opts === "string" ? { message: opts } : (opts || {}), resolve });
  }), []);

  const close = (val) => { state?.resolve(val); setState(null); };
  const o = state?.opts || {};

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} size={410}
        title={o.title || t("common.confirmTitle")}
        footer={
          <>
            {o.cancelText !== null && (
              <button className="btn ghost" onClick={() => close(false)}>{o.cancelText || t("common.cancel")}</button>
            )}
            <button className="btn" onClick={() => close(true)} autoFocus
              style={o.danger ? { background: "var(--danger)", borderColor: "transparent", color: "#fff" } : undefined}>
              {o.confirmText || t("common.confirm")}
            </button>
          </>
        }>
        {o.message && <p className="text-muted text-[13.5px] leading-relaxed whitespace-pre-line">{o.message}</p>}
      </Modal>
    </ConfirmCtx.Provider>
  );
}
