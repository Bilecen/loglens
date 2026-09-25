import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { useRealtime } from "./realtime";
import Icon from "./Icon";
import { timeAgo } from "./labels";

export default function NotificationBell() {
  const { user } = useAuth();
  const { subscribe } = useRealtime();
  const [data, setData] = useState({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);

  const load = useCallback(() => api.notifications(30).then(setData).catch(() => {}), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60000); // yedek polling (WS varken seyrek)
    return () => clearInterval(t);
  }, [load]);

  // Gerçek-zamanlı: bana bildirim geldiyse anında tazele
  useEffect(() => subscribe((msg) => {
    if (msg.type === "notification" && msg.user_ids?.includes(user.id)) load();
  }), [subscribe, user.id, load]);

  const readOne = async (n) => {
    if (n.is_read) return;
    await api.readNotification(n.id).catch(() => {});
    setData((d) => ({ items: d.items.map((x) => x.id === n.id ? { ...x, is_read: true } : x),
                      unread: Math.max(0, d.unread - 1) }));
  };
  const readAll = async () => {
    await api.readAllNotifications().catch(() => {});
    setData((d) => ({ items: d.items.map((x) => ({ ...x, is_read: true })), unread: 0 }));
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="relative w-[36px] h-[36px] rounded-lg grid place-items-center text-muted hover:text-fg hover:bg-surface-2 transition"
        title="Bildirimler">
        <Icon icon="lucide:bell" size={18} />
        {data.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold grid place-items-center">
            {data.unread > 9 ? "9+" : data.unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[320px] card-surface shadow-2xl z-50 anim-in overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-line">
              <span className="font-bold text-[13.5px]">Bildirimler</span>
              {data.unread > 0 && (
                <button className="text-brand text-[11.5px] font-semibold hover:underline flex items-center gap-1"
                  onClick={readAll}><Icon icon="lucide:check-check" size={13} /> Hepsini okundu</button>
              )}
            </div>
            <div className="max-h-[380px] overflow-auto">
              {data.items.length === 0 ? (
                <div className="text-faint text-[12.5px] text-center py-8">Bildirim yok</div>
              ) : data.items.map((n) => (
                <button key={n.id} onClick={() => readOne(n)}
                  className={`w-full text-left px-3.5 py-2.5 border-b border-line last:border-0 hover:bg-surface-2 transition-colors flex gap-2.5 ${n.is_read ? "opacity-60" : ""}`}>
                  <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.is_read ? "bg-transparent" : "bg-brand"}`} />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-semibold">{n.title}</span>
                    {n.body && <span className="block text-[12px] text-muted truncate">{n.body}</span>}
                    <span className="block text-faint text-[11px] mt-0.5">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
