import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { tokenStore } from "./api";

// Tek global WebSocket bağlantısı. Girişten sonra (Shell içinde) mount edilir.
// Kopunca otomatik yeniden bağlanır. subscribe(fn) ile olayları dinle, send(msg) ile gönder.
const RealtimeCtx = createContext(null);

export function RealtimeProvider({ children }) {
  const wsRef = useRef(null);
  const listeners = useRef(new Set());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = tokenStore.get();
    if (!token) return;
    let closed = false, retry;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${location.host}/api/ws?token=${encodeURIComponent(token)}`;
    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => {
        let msg; try { msg = JSON.parse(e.data); } catch { return; }
        listeners.current.forEach((fn) => fn(msg));
      };
      ws.onclose = () => { setConnected(false); if (!closed) retry = setTimeout(connect, 2000); };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => { closed = true; clearTimeout(retry); wsRef.current?.close(); };
  }, []);

  const send = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  return <RealtimeCtx.Provider value={{ send, subscribe, connected }}>{children}</RealtimeCtx.Provider>;
}

export const useRealtime = () => useContext(RealtimeCtx);
