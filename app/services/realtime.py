"""Gerçek-zamanlı yayın (WebSocket). Tek global oda: sohbet + presence + bildirim.
Bağlı tüm istemcilere broadcast eder; istemci kendine ait olanı süzer.
Ayrıca kimlerin ONLINE olduğunu (aktif WS bağlantısı) takip eder."""
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active: dict[WebSocket, int] = {}   # ws -> user_id
        self.counts: dict[int, int] = {}          # user_id -> açık bağlantı sayısı (çok sekme)

    async def connect(self, ws: WebSocket, user_id: int) -> bool:
        """Bağlar; kullanıcı YENİ online olduysa True döner."""
        await ws.accept()
        self.active[ws] = user_id
        self.counts[user_id] = self.counts.get(user_id, 0) + 1
        return self.counts[user_id] == 1

    def disconnect(self, ws: WebSocket) -> tuple[int | None, bool]:
        """Kaldırır; (user_id, artık_offline_mi) döner."""
        user_id = self.active.pop(ws, None)
        if user_id is None:
            return None, False
        self.counts[user_id] = self.counts.get(user_id, 1) - 1
        if self.counts[user_id] <= 0:
            self.counts.pop(user_id, None)
            return user_id, True
        return user_id, False

    def is_online(self, user_id: int) -> bool:
        return self.counts.get(user_id, 0) > 0

    async def broadcast(self, message: dict) -> None:
        dead = []
        for ws in list(self.active):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()
