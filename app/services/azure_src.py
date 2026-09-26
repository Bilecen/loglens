"""
Azure DevOps kaynak-kod entegrasyonu (github_src ile aynı arayüz).

repo["full_name"] = "organizasyon/proje/repo" biçiminde saklanır, provider="azure".
Kimlik: PAT ile Basic auth (kullanıcı adı boş). Token repo.token ya da
settings.github_token'a DÜŞMEZ; azure için ayrı token gerekir (repo.token).

fetch_snippet(repo, stack_trace) -> {file, path, line, url, snippet} | None
"""
import base64

import httpx

from app.services import settings_store
from app.core.config import settings
from app.services.github_src import parse_locations, _best_path

_API_VER = "7.1"
_tree_cache: dict[str, list[str]] = {}


def _parts(repo: dict):
    """'org/project/repo' -> (org, project, repo). Repo adında '/' olmaz varsayımı."""
    segs = [s for s in repo["full_name"].split("/") if s]
    if len(segs) < 3:
        return None
    return segs[0], segs[1], "/".join(segs[2:])


def _headers(repo: dict, fallback: str | None = None) -> dict:
    h = {"Accept": "application/json"}
    tok = repo.get("token") or fallback or settings.azure_token or None
    if tok:
        basic = base64.b64encode(f":{tok}".encode()).decode()
        h["Authorization"] = f"Basic {basic}"
    return h


def _base_url(org: str, project: str, repo_name: str) -> str:
    return f"https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repo_name}"


async def _get_tree(client, base: str, branch: str, cache_key: str) -> list[str]:
    if cache_key in _tree_cache:
        return _tree_cache[cache_key]
    r = await client.get(f"{base}/items", params={
        "recursionLevel": "Full",
        "versionDescriptor.version": branch,
        "versionDescriptor.versionType": "branch",
        "api-version": _API_VER,
    })
    paths = []
    if r.status_code == 200:
        for it in r.json().get("value", []):
            if not it.get("isFolder") and it.get("path"):
                paths.append(it["path"].lstrip("/"))
    _tree_cache[cache_key] = paths
    return paths


async def fetch_snippet(repo: dict, stack_trace: str | None) -> dict | None:
    locs = parse_locations(stack_trace)
    parts = _parts(repo)
    if not locs or not parts:
        return None
    org, project, repo_name = parts
    branch = repo.get("default_branch") or "main"
    base = _base_url(org, project, repo_name)
    ctx = settings.source_context_lines
    az_token = (await settings_store.effective())["azure_token"]
    async with httpx.AsyncClient(timeout=20, headers=_headers(repo, az_token)) as client:
        paths = await _get_tree(client, base, branch, f"{repo['full_name']}@{branch}")
        if not paths:
            return None
        for loc in locs:
            path = _best_path(paths, loc, repo.get("path_prefix"))
            if not path:
                continue
            r = await client.get(f"{base}/items", params={
                "path": "/" + path,
                "includeContent": "true",
                "versionDescriptor.version": branch,
                "versionDescriptor.versionType": "branch",
                "api-version": _API_VER,
            })
            if r.status_code != 200:
                continue
            text = r.json().get("content")
            if not text:
                continue
            lines = text.splitlines()
            ln = loc["line"]
            lo, hi = max(1, ln - ctx), min(len(lines), ln + ctx)
            numbered = "\n".join(
                f"{'>' if i == ln else ' '} {i:>5} | {lines[i - 1]}"
                for i in range(lo, hi + 1)
            )
            url = (f"https://dev.azure.com/{org}/{project}/_git/{repo_name}"
                   f"?path=/{path}&version=GB{branch}&line={ln}&lineEnd={ln + 1}"
                   f"&lineStartColumn=1&lineEndColumn=1")
            return {"file": loc["file"], "path": path, "line": ln, "url": url, "snippet": numbered}
    return None


def clear_cache():
    _tree_cache.clear()
