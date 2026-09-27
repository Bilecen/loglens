// Backend istemcisi. Dev'de vite proxy sayesinde "/api" -> localhost:8000.
// Prod'da backend frontend'i AYNI origin'den sunar (bkz. Dockerfile + app/main.py) —
// build sırasında VITE_API_BASE="" verilir. "??" şart: "" değeri "||" ile "/api"ye düşerdi.
const BASE = import.meta.env.VITE_API_BASE ?? "/api";
const TOKEN_KEY = "loglens_token";
const REFRESH_KEY = "loglens_refresh";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const refreshStore = {
  get: () => localStorage.getItem(REFRESH_KEY),
  set: (t) => localStorage.setItem(REFRESH_KEY, t),
  clear: () => localStorage.removeItem(REFRESH_KEY),
};

// 401 olduğunda tetiklenir (App bunu dinleyip oturumu kapatır).
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function req(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    onUnauthorized();
    throw new Error("Oturum sonlandı, tekrar giriş yapın");
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch { /* metin gövde */ }
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

const qs = (obj) => {
  const p = new URLSearchParams();
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const api = {
  // auth
  bootstrap: () => req("/auth/bootstrap"),
  register: (body) => req("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => req("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  logout: (refresh_token) => req("/auth/logout", { method: "POST", body: JSON.stringify({ refresh_token }) }),
  me: () => req("/auth/me"),

  // stats & charts (proje bazlı)
  health: () => req("/health"),
  stats: (projectId) => req(`/stats${qs({ project_id: projectId })}`),
  timeseries: (projectId, days = 14) => req(`/stats/timeseries${qs({ project_id: projectId, days })}`),
  breakdown: (projectId) => req(`/stats/breakdown${qs({ project_id: projectId })}`),

  // projects & members
  projects: () => req("/projects"),
  createProject: (body) => req("/projects", { method: "POST", body: JSON.stringify(body) }),
  deleteProject: (id) => req(`/projects/${id}`, { method: "DELETE" }),
  projectMembers: (id) => req(`/projects/${id}/members`),
  addProjectMember: (id, userId) => req(`/projects/${id}/members`, { method: "POST", body: JSON.stringify({ user_id: userId }) }),
  removeProjectMember: (id, userId) => req(`/projects/${id}/members/${userId}`, { method: "DELETE" }),

  // clusters (params proje_id içerir)
  clusters: (params) => req(`/clusters${qs(params)}`),
  cluster: (id) => req(`/clusters/${id}`),
  updateCluster: (id, patch) => req(`/clusters/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  reinterpret: (id) => req(`/clusters/${id}/interpret`, { method: "POST" }),
  llmProviders: () => req("/llm/providers"),
  clusterOpinion: (id, provider) => req(`/clusters/${id}/opinion`, { method: "POST", body: JSON.stringify({ provider }) }),
  addNote: (id, body) => req(`/clusters/${id}/notes`, { method: "POST", body: JSON.stringify({ body }) }),
  updateNote: (id, noteId, body) => req(`/clusters/${id}/notes/${noteId}`, { method: "PATCH", body: JSON.stringify({ body }) }),
  deleteNote: (id, noteId) => req(`/clusters/${id}/notes/${noteId}`, { method: "DELETE" }),
  ingest: (log) => req("/ingest", { method: "POST", body: JSON.stringify(log) }),

  // profil (kendi)
  updateMe: (body) => req("/users/me", { method: "PATCH", body: JSON.stringify(body) }),

  // users (admin)
  users: () => req("/users"),
  createUser: (body) => req("/users", { method: "POST", body: JSON.stringify(body) }),
  setUserRole: (id, role) => req(`/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  deleteUser: (id) => req(`/users/${id}`, { method: "DELETE" }),

  // repos (admin, proje bazlı)
  repos: (projectId) => req(`/repos${qs({ project_id: projectId })}`),
  addRepo: (projectId, body) => req(`/repos${qs({ project_id: projectId })}`, { method: "POST", body: JSON.stringify(body) }),
  deleteRepo: (id) => req(`/repos/${id}`, { method: "DELETE" }),

  // settings (admin) — AI / entegrasyon
  settings: () => req("/settings"),
  saveSettings: (body) => req("/settings", { method: "PUT", body: JSON.stringify(body) }),
  testLlm: () => req("/settings/test-llm", { method: "POST" }),

  // notifications (in-app inbox)
  notifications: (limit = 50) => req(`/notifications${qs({ limit })}`),
  readNotification: (id) => req(`/notifications/${id}/read`, { method: "POST" }),
  readAllNotifications: () => req("/notifications/read-all", { method: "POST" }),

  // team presence + chat
  team: () => req("/team"),
  setPresence: (presence) => req("/team/presence", { method: "PATCH", body: JSON.stringify({ presence }) }),
  chat: (after = 0) => req(`/chat${qs({ after })}`),
  sendChat: (body) => req("/chat", { method: "POST", body: JSON.stringify({ body }) }),

  // data sources (admin, Firebase/BigQuery otomatik çekim)
  dataSources: (projectId) => req(`/datasources${qs({ project_id: projectId })}`),
  createDataSource: (projectId, body) => req(`/datasources${qs({ project_id: projectId })}`, { method: "POST", body: JSON.stringify(body) }),
  toggleDataSource: (id, enabled) => req(`/datasources/${id}`, { method: "PATCH", body: JSON.stringify({ enabled }) }),
  deleteDataSource: (id) => req(`/datasources/${id}`, { method: "DELETE" }),
  runDataSource: (id) => req(`/datasources/${id}/run`, { method: "POST" }),

  // webhooks (admin, proje bazlı) — inbound
  webhooks: (projectId) => req(`/webhooks${qs({ project_id: projectId })}`),
  createWebhook: (projectId, body) => req(`/webhooks${qs({ project_id: projectId })}`, { method: "POST", body: JSON.stringify(body) }),
  toggleWebhook: (id, active) => req(`/webhooks/${id}`, { method: "PATCH", body: JSON.stringify({ active }) }),
  deleteWebhook: (id) => req(`/webhooks/${id}`, { method: "DELETE" }),

  // MCP (Model Context Protocol) erişim anahtarları — kullanıcı kendi AI aracını bağlar
  mcpTokens: () => req("/mcp-tokens"),
  createMcpToken: (name) => req("/mcp-tokens", { method: "POST", body: JSON.stringify({ name }) }),
  revokeMcpToken: (id) => req(`/mcp-tokens/${id}`, { method: "DELETE" }),
};
