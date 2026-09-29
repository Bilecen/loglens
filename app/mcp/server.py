"""
MCP (Model Context Protocol) sunucusu.

Kullanıcı kendi AI aracını (Claude Code/Desktop, Cursor…) buraya bağlar: LogLens'teki hata
kümelerini okur, kaynak kod bağlamıyla birlikte inceler, düzeltmeyi KENDİ araçlarıyla
(dosya erişimi zaten onda) yapar, sonra LogLens'e not düşer / durumu günceller. LogLens
burada sadece zengin bir "veri akışı" sağlar — hangi AI'yı nasıl kullanacağı kullanıcıya
kalır (bu yüzden Ayarlar'daki 5 sabit LLM sağlayıcısına bağlı değildir).

Streamable HTTP transport, `/mcp` altında (bkz. main.py). Kimlik doğrulama MCP SDK'nın
OAuth katmanı YERİNE LogLens'in kendi `mcp_tokens` tablosuyla yapılır (Bearer token) —
daha az hareketli parça, self-hosted tek-kiracılı bir sistem için yeterli ve basit.
"""
import contextvars

from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core import security
from app.core.config import settings
from app.db import clusters as db_clusters
from app.db import projects as db_projects
from app.db import users as db_users
from app.routers.clusters import TERMINAL_STATUS

mcp = MCPServer(
    name="loglens",
    version=settings.api_version,
    instructions=(
        "LogLens self-hosted hata-analiz platformundaki hata kümelerine erişir. "
        "Bir hatayı düzeltmeden önce get_error ile tam bağlamı (stack trace, kaynak kod "
        "snippet'i, geçmiş oluşumlar) çek. Düzeltme sonrası add_note ile özet bırak ve "
        "update_status ile 'resolved' işaretle."
    ),
)

_current_user_id: contextvars.ContextVar[int | None] = contextvars.ContextVar(
    "mcp_user_id", default=None)


def _uid() -> int:
    uid = _current_user_id.get()
    if uid is None:
        raise RuntimeError("MCP isteği kimliksiz ulaştı (middleware garanti etmeliydi)")
    return uid


class _BearerAuthMiddleware:
    """`/mcp` altındaki her isteği LogLens `mcp_tokens` tablosuna göre doğrular."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = dict(scope["headers"])
        raw = headers.get(b"authorization", b"").decode()
        token = raw[7:].strip() if raw.lower().startswith("bearer ") else None
        user_id = await db_users.get_mcp_user_id(security.hash_token(token)) if token else None
        if not user_id:
            resp = JSONResponse(
                {"error": "unauthorized", "detail": "Geçersiz ya da eksik MCP anahtarı (Authorization: Bearer <key>)"},
                status_code=401)
            await resp(scope, receive, send)
            return
        reset_token = _current_user_id.set(user_id)
        try:
            await self.app(scope, receive, send)
        finally:
            _current_user_id.reset(reset_token)


def _transport_security() -> TransportSecuritySettings | None:
    """MCP SDK, host="127.0.0.1" varsayılanıyla DNS-rebinding korumasını (Host/Origin
    allowlist) otomatik açar ve yalnızca localhost'a izin verir — self-hosted kurulum
    keyfi bir domain'in (Coolify/Cloudflare) arkasında olduğunda bu "Invalid Host header"
    ile reddeder. Korumayı KAPATMAK yerine, ayarlanmışsa gerçek deploy domain'ini de
    allowlist'e ekliyoruz; korumanın kendisi açık kalıyor."""
    if not settings.public_host:
        return None  # kütüphanenin güvenli varsayılanı: yalnız localhost
    host = settings.public_host
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=[host, f"{host}:*", "127.0.0.1:*", "localhost:*", "[::1]:*"],
        allowed_origins=[f"https://{host}", f"http://{host}",
                         "http://127.0.0.1:*", "http://localhost:*", "http://[::1]:*"],
    )


def build() -> tuple[ASGIApp, Starlette]:
    """(main.py'nin mount edeceği app, lifespan'i main.py'de çalıştırılacak ham Starlette app)."""
    inner = mcp.streamable_http_app(
        streamable_http_path="/",
        transport_security=_transport_security(),
    )
    return _BearerAuthMiddleware(inner), inner


# ---------------------------------------------------------------------------
# Tool'lar — okuma ağırlıklı; add_note/update_status "adam istediği gibi kullansın"
# döngüsünü kapatan minimal yazma yolu.
# ---------------------------------------------------------------------------

@mcp.tool()
async def list_projects() -> list[dict]:
    """LogLens'teki tüm projeleri listeler (id, name, key)."""
    return await db_projects.list_projects()


@mcp.tool()
async def list_errors(
    project_id: int,
    status: str | None = None,
    severity: str | None = None,
    q: str | None = None,
    limit: int = 20,
) -> dict:
    """Bir projedeki hata kümelerini listeler (en son görülene göre sıralı).
    status: open|investigating|resolved|ignored. severity: critical|high|medium|low.
    q: başlık/özet içinde serbest metin arama. Her öğe get_error için bir cluster_id içerir."""
    items = await db_clusters.list_clusters(
        project_id, q=q, severity=severity, origin=None, status=status,
        sort="last_seen", limit=min(limit, 100), offset=0)
    return {"items": items}


@mcp.tool()
async def get_error(cluster_id: int) -> dict:
    """Bir hata kümesinin TÜM bağlamını döner: başlık, özet, önem derecesi, hata şablonu,
    (varsa) bağlı repodan çekilmiş kaynak kod snippet'i + dosya URL'i, son oluşumlar, takım
    notları ve önceki LLM yorumları. Kod düzeltmesi yapmadan ÖNCE bunu çağır."""
    cluster = await db_clusters.get_cluster(cluster_id)
    if not cluster:
        raise ValueError(f"cluster {cluster_id} bulunamadı")
    return {
        "cluster": cluster,
        "recent_occurrences": await db_clusters.list_occurrences(cluster_id, limit=20),
        "notes": await db_clusters.list_notes(cluster_id),
        "llm_opinions": await db_clusters.list_opinions(cluster_id),
    }


@mcp.tool()
async def get_stats(project_id: int) -> dict:
    """Proje için özet istatistik: açık/çözülen hata sayısı, önem derecesi dağılımı, kaynak
    (mobil/web/servis) dağılımı."""
    return await db_clusters.stats(project_id)


@mcp.tool()
async def add_note(cluster_id: int, body: str) -> dict:
    """Bir hata kümesine not bırakır — örn. yaptığın düzeltmenin özeti ya da bulguların.
    Not takımın gördüğü panelde görünür."""
    if not await db_clusters.get_cluster(cluster_id):
        raise ValueError(f"cluster {cluster_id} bulunamadı")
    return await db_clusters.add_note(cluster_id, author_id=_uid(), body=body.strip())


@mcp.tool()
async def update_status(cluster_id: int, status: str) -> dict:
    """Hata kümesinin durumunu değiştirir: open|investigating|resolved|ignored. Düzeltmeyi
    tamamladıysan 'resolved' yap. NOT: zaten resolved/ignored olan bir kaydı geri açmak
    (reversal) yalnızca admin rolündeki kullanıcının MCP anahtarıyla mümkündür."""
    if status not in {"open", "investigating", "resolved", "ignored"}:
        raise ValueError("status: open|investigating|resolved|ignored olmalı")
    current = await db_clusters.get_cluster(cluster_id)
    if not current:
        raise ValueError(f"cluster {cluster_id} bulunamadı")
    is_reversal = status != current["status"] and current["status"] in TERMINAL_STATUS
    if is_reversal:
        user = await db_users.get_user_by_id(_uid())
        if not user or user.get("role") != "admin":
            raise ValueError(
                "Nihai bir durumu (resolved/ignored) geri almak için admin yetkili bir MCP anahtarı gerekir.")
    return await db_clusters.update_cluster_meta(cluster_id, {"status": status})
