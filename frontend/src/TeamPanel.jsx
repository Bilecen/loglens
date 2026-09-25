import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { useRealtime } from "./realtime";
import Icon from "./Icon";
import Avatar from "./Avatar";
import { roleLabel, timeAgo } from "./labels";

export const PRESENCE = {
  available: { label: "Müsait", color: "#10b981" },
  away: { label: "Dışarıda", color: "#f59e0b" },
  busy: { label: "Meşgul", color: "#ef4444" },
};

export default function TeamPanel({ open, onClose }) {
  const { user } = useAuth();
  const { send: wsSend, subscribe, connected } = useRealtime();
  const [team, setTeam] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState("chat"); // chat | team
  const endRef = useRef(null);

  const loadTeam = useCallback(() => api.team().then(setTeam).catch(() => {}), []);
  const loadChat = useCallback(() => api.chat(0).then(setMessages).catch(() => {}), []);

  // İlk yükleme + panel her açılışta tazele (WS kopmuşsa yakala)
  useEffect(() => { loadTeam(); loadChat(); }, [loadTeam, loadChat]);
  useEffect(() => { if (open) { loadTeam(); loadChat(); } }, [open, loadTeam, loadChat]);

  // Canlı olaylar (WebSocket) — anlık chat + presence
  useEffect(() => subscribe((msg) => {
    if (msg.type === "chat") {
      setMessages((l) => (l.some((x) => x.id === msg.message.id) ? l : [...l, msg.message]));
    } else if (msg.type === "presence") {
      setTeam((t) => t.map((u) => (u.id === msg.user_id ? { ...u, presence: msg.presence } : u)));
    } else if (msg.type === "online") {
      setTeam((t) => t.map((u) => (u.id === msg.user_id ? { ...u, online: msg.online } : u)));
    }
  }), [subscribe]);

  useEffect(() => { if (tab === "chat") endRef.current?.scrollIntoView(); }, [messages, tab, open]);

  const me = team.find((u) => u.me);
  const setPresence = (p) => {
    setTeam((t) => t.map((u) => (u.me ? { ...u, presence: p } : u)));
    if (connected) wsSend({ type: "presence", presence: p });
    else api.setPresence(p).catch(() => {});
  };

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    if (connected) { wsSend({ type: "chat", body }); return; }  // broadcast ile geri gelir
    try { const m = await api.sendChat(body); setMessages((l) => [...l, m]); } catch { /* yut */ }
  };

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-screen w-full max-w-[360px] card-surface !rounded-none z-50 flex flex-col shadow-2xl anim-in">
        {/* Başlık + durum */}
        <div className="px-4 pt-4 pb-3 border-b border-line shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-extrabold flex items-center gap-2"><Icon icon="lucide:users" size={17} /> Ekip</h3>
            <button className="btn ghost sm" onClick={onClose}><Icon icon="lucide:x" size={15} /></button>
          </div>
          {/* Kendi durumun */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg"
            style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}>
            {Object.entries(PRESENCE).map(([key, cfg]) => {
              const active = me?.presence === key;
              return (
                <button key={key} onClick={() => setPresence(key)}
                  className="flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-semibold transition-all"
                  style={{ background: active ? "var(--panel)" : "transparent",
                           color: active ? "var(--text)" : "var(--muted)",
                           boxShadow: active ? "0 1px 2px rgba(0,0,0,.08)" : "none" }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} /> {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sekme */}
        <div className="flex gap-1 px-3 pt-2 shrink-0">
          {[["chat", "Sohbet"], ["team", "Ekip"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold ${tab === k ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2"}`}>{l}</button>
          ))}
        </div>

        {/* İçerik */}
        {tab === "team" ? (
          <div className="flex-1 overflow-auto px-3 py-2 flex flex-col gap-1">
            {team.map((u) => {
              const p = PRESENCE[u.presence] || PRESENCE.available;
              const dot = u.online ? p.color : "#9ca3af";          // çevrimdışı → gri
              const label = u.online ? p.label : "Çevrimdışı";
              return (
                <div key={u.id} className={`flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-surface-2 ${u.online ? "" : "opacity-60"}`}>
                  <div className="relative">
                    <Avatar user={u} size={30} />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2" style={{ background: dot, borderColor: "var(--panel)" }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold truncate">{u.name || u.email}{u.me ? " (ben)" : ""}</div>
                    <div className="text-faint text-[11px]">{roleLabel(u.role)} · {label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto px-3 py-3 flex flex-col gap-0.5">
              {messages.length === 0 && <div className="text-faint text-[12.5px] text-center py-8">Henüz mesaj yok. İlk mesajı sen yaz 👋</div>}
              {messages.map((m, i) => {
                const mine = m.user_id === user.id;
                const prev = messages[i - 1];
                const firstOfGroup = !prev || prev.user_id !== m.user_id;
                const author = team.find((u) => u.id === m.user_id) || { name: m.author_name, email: m.author_email };
                const name = author.name || author.email || "?";
                return (
                  <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"} ${firstOfGroup ? "mt-2.5" : ""}`}>
                    {firstOfGroup && (
                      <span className="text-[11px] font-bold mb-0.5 px-1">{mine ? "Sen" : name}</span>
                    )}
                    <div className={`max-w-[82%] px-3 py-2 rounded-2xl text-[12.5px] leading-snug break-words ${mine ? "bg-brand text-white rounded-br-sm" : "bg-surface-2 border border-line rounded-bl-sm"}`}>
                      {m.body}
                    </div>
                    <span className="text-faint text-[9.5px] mt-0.5 px-1">{timeAgo(m.created_at)}</span>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <div className="p-3 border-t border-line shrink-0 flex items-end gap-2">
              <textarea rows={1} value={draft} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Mesaj yaz…" className="resize-none py-2" />
              <button className="btn sm h-[38px]" disabled={!draft.trim()} onClick={send}><Icon icon="lucide:send" size={15} /></button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
