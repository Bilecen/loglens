"""
GitHub kaynak-kod entegrasyonu.

Amaç: stack trace'teki "Dosya.ext:satır" bilgisini bağlı repodaki gerçek
dosyaya eşleyip, o satırın çevresinden bir snippet çıkarmak. Bu snippet hem
LLM'in kök-neden analizine bağlam olarak verilir hem de UI'da gösterilir.

Yaklaşım:
  1) Stack trace'ten (dosya adı, satır, paket ipucu) adaylarını ayıkla.
  2) Repo'nun git ağacını (recursive tree) bir kez çekip önbelleğe al.
  3) Dosya adına (mümkünse paket yoluna) göre en iyi eşleşen yolu bul.
  4) İçeriği çek, satır çevresinden snippet üret, blob linkini döndür.

Token yoksa repo.token, o da yoksa settings.github_token kullanılır.
Her şey best-effort: hata olursa sessizce None döner, akış bozulmaz.
"""
import base64
import re

import httpx

from app.services import settings_store
from app.core.config import settings

_API = "https://api.github.com"

# Frame biçimleri:
#  - Java/Kotlin/Swift:  at com.app.ui.HomeScreen.render(HomeScreen.kt:42)
_RE_PAREN = re.compile(r"([\w.$<>]+)?\(([\w+-]+\.[A-Za-z0-9]+):(\d+)\)")
#  - Python:             File "/app/db.py", line 40, in fn
_RE_PY = re.compile(r'File\s+"([^"]+)",\s+line\s+(\d+)')
#  - JS/TS genel:        at Foo (src/Dashboard.jsx:120:5)  |  Dashboard.jsx:120
_RE_JS = re.compile(r"([\w./@-]+\.[A-Za-z0-9]+):(\d+)(?::\d+)?")

# Basit süreç-içi önbellek: full_name@branch -> [yollar]
_tree_cache: dict[str, list[str]] = {}


def parse_locations(stack_trace: str | None) -> list[dict]:
    """Stack trace'ten {file, line, hint} adaylarını (en üstteki önce) döndür."""
    if not stack_trace:
        return []
    out, seen = [], set()

    def add(path: str, line: str, hint: str | None):
        fname = path.replace("\\", "/").split("/")[-1]
        key = (fname, line)
        if key in seen:
            return
        seen.add(key)
        out.append({"file": fname, "line": int(line), "hint": hint})

    for line in stack_trace.splitlines():
        m = _RE_PAREN.search(line)
        if m:
            qualified, fname, ln = m.group(1), m.group(2), m.group(3)
            hint = _package_hint(qualified, fname)
            add(fname, ln, hint)
            continue
        m = _RE_PY.search(line)
        if m:
            add(m.group(1), m.group(2), m.group(1).lstrip("/"))
            continue
        m = _RE_JS.search(line)
        if m:
            add(m.group(1), m.group(2), m.group(1).lstrip("/"))
    return out


def _package_hint(qualified: str | None, fname: str) -> str | None:
    """com.app.ui.HomeScreen.render + HomeScreen.kt -> 'com/app/ui/HomeScreen.kt'."""
    if not qualified:
        return None
    base = fname.rsplit(".", 1)[0]
    segs = qualified.replace("$", ".").split(".")
    if base in segs:
        pkg = segs[: segs.index(base)]
        if pkg:
            return "/".join(pkg) + "/" + fname
    return None


def _token(repo: dict, fallback: str | None = None) -> str | None:
    return repo.get("token") or fallback or settings.github_token or None


async def _get_tree(client: httpx.AsyncClient, repo: dict) -> list[str]:
    full, branch = repo["full_name"], repo.get("default_branch") or "main"
    cache_key = f"{full}@{branch}"
    if cache_key in _tree_cache:
        return _tree_cache[cache_key]
    r = await client.get(f"{_API}/repos/{full}/git/trees/{branch}",
                         params={"recursive": "1"})
    if r.status_code != 200:
        _tree_cache[cache_key] = []
        return []
    paths = [t["path"] for t in r.json().get("tree", []) if t.get("type") == "blob"]
    _tree_cache[cache_key] = paths
    return paths


def _best_path(paths: list[str], loc: dict, prefix: str | None) -> str | None:
    """Ağaçtaki yollar içinden loc'a en iyi eşleşeni seç."""
    fname = loc["file"]
    hint = (loc.get("hint") or "").replace("\\", "/")
    cands = [p for p in paths if p.split("/")[-1] == fname]
    if not cands:
        return None
    if prefix:
        pref = [p for p in cands if p.startswith(prefix.strip("/"))]
        cands = pref or cands
    # Paket ipucuyla biten yol en güçlü sinyal
    if hint:
        for p in cands:
            if p.endswith(hint):
                return p
    # Tek aday ya da en kısa yol
    return min(cands, key=len)


def _headers(repo: dict, fallback: str | None = None) -> dict:
    h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    tok = _token(repo, fallback)
    if tok:
        h["Authorization"] = f"Bearer {tok}"
    return h


async def fetch_snippet(repo: dict, stack_trace: str | None) -> dict | None:
    """Stack trace için ilk çözülebilen konumun kaynak snippet'ini döndür.

    Döner: {file, path, line, url, snippet} veya None.
    """
    locs = parse_locations(stack_trace)
    if not locs:
        return None
    branch = repo.get("default_branch") or "main"
    ctx = settings.source_context_lines
    gh_token = (await settings_store.effective())["github_token"]
    async with httpx.AsyncClient(timeout=20, headers=_headers(repo, gh_token)) as client:
        paths = await _get_tree(client, repo)
        if not paths:
            return None
        for loc in locs:
            path = _best_path(paths, loc, repo.get("path_prefix"))
            if not path:
                continue
            r = await client.get(f"{_API}/repos/{repo['full_name']}/contents/{path}",
                                 params={"ref": branch})
            if r.status_code != 200:
                continue
            content = r.json().get("content", "")
            try:
                text = base64.b64decode(content).decode("utf-8", errors="replace")
            except Exception:
                continue
            lines = text.splitlines()
            ln = loc["line"]
            lo, hi = max(1, ln - ctx), min(len(lines), ln + ctx)
            numbered = "\n".join(
                f"{'>' if i == ln else ' '} {i:>5} | {lines[i - 1]}"
                for i in range(lo, hi + 1)
            )
            url = f"https://github.com/{repo['full_name']}/blob/{branch}/{path}#L{ln}"
            return {"file": loc["file"], "path": path, "line": ln,
                    "url": url, "snippet": numbered}
    return None


def clear_cache():
    _tree_cache.clear()
