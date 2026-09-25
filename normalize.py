"""
Log normalizasyonu: değişken kısımları maskele, fingerprint üret.

ÖNEMLİ: Embedding'i HAM mesajdan değil, buradaki temizlenmiş şablondan al.
ID / sayı / adres maskelenmezse aynı hata farklı kümelere dağılır.
"""
import re
import hashlib

# Sıra önemli: özel desenler (UUID, IP, HEX) sayıdan ÖNCE çalışmalı.
_PATTERNS = [
    (re.compile(r"0x[0-9a-fA-F]+"), "<HEX>"),
    (re.compile(r"\b[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}\b"), "<UUID>"),
    (re.compile(r"[\w.\-+]+@[\w.\-]+\.\w+"), "<EMAIL>"),
    (re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"), "<IP>"),
    (re.compile(r"\b\d{4,}\b"), "<NUM>"),          # uzun sayılar (id, timestamp)
    (re.compile(r"@[0-9a-fA-F]+"), "@<REF>"),      # obje referansları: Foo@1a2b3c
]


# Gelen "platform" alanından hatanın kaynak katmanını kestir.
# Kesin eşleşme yoksa None döner ve kararı LLM verir.
_ORIGIN_MAP = {
    # mobil istemci
    "android": "mobile", "ios": "mobile", "ipados": "mobile",
    "flutter": "mobile", "react-native": "mobile", "reactnative": "mobile",
    "kotlin": "mobile", "swift": "mobile", "mobile": "mobile",
    # web istemci
    "web": "web", "browser": "web", "js": "web", "javascript": "web",
    "react": "web", "chrome": "web", "firefox": "web", "safari": "web", "edge": "web",
    # backend / sunucu
    "server": "service", "backend": "service", "api": "service",
    "service": "service", "node": "service", "python": "service",
    "django": "service", "fastapi": "service", "java-server": "service",
}


def classify_origin(platform: str | None) -> str | None:
    """Platform etiketinden hatanın katmanını (mobile/web/service) kestir.

    Net eşleşme yoksa None döner; bu durumda origin'i LLM belirler.
    """
    if not platform:
        return None
    return _ORIGIN_MAP.get(platform.strip().lower())


def mask(text: str) -> str:
    """Değişken kısımları yer tutucularla değiştirir."""
    if not text:
        return ""
    out = text
    for pattern, repl in _PATTERNS:
        out = pattern.sub(repl, out)
    return out


def top_frames(stack_trace: str, n: int) -> list[str]:
    """Stack trace'in en üstteki n anlamlı frame'ini döndürür (maskelenmiş)."""
    if not stack_trace:
        return []
    frames = []
    for line in stack_trace.splitlines():
        line = line.strip()
        if not line:
            continue
        # Java/Kotlin "at ...", Python "File ...", genel satırlar
        frames.append(mask(line))
        if len(frames) >= n:
            break
    return frames


def build_template(error_type: str | None, message: str,
                   stack_trace: str | None, n: int) -> str:
    """
    Embedding ve fingerprint için ortak metin.
    Kaynak string ne olursa olsun aynı hata aynı şablona düşmeli.
    """
    parts = []
    if error_type:
        parts.append(mask(error_type))
    parts.append(mask(message or ""))
    parts.extend(top_frames(stack_trace or "", n))
    return "\n".join(p for p in parts if p)


def fingerprint(error_type: str | None, stack_trace: str | None, n: int) -> str:
    """
    Kesin eşleşme anahtarı: hata tipi + üst frame'lerin hash'i.
    Mesajın değişken kısımları maskelendiği için birebir aynı hatalar
    aynı fingerprint'e düşer (ucuz, deterministik).
    """
    basis = (mask(error_type or "")) + "|" + "|".join(top_frames(stack_trace or "", n))
    return hashlib.sha256(basis.encode("utf-8")).hexdigest()