// Uygulama genelinde ortak etiketler ve seçenekler.

export const SEVERITIES = ["critical", "high", "medium", "low"];

export const ORIGINS = ["mobile", "web", "service"];
export const ORIGIN_LABEL = {
  mobile: "📱 Mobil", web: "🌐 Web", service: "🖥️ Servis", unknown: "❔ Bilinmiyor",
};
export const originLabel = (o) => ORIGIN_LABEL[o] || ORIGIN_LABEL.unknown;

export const STATUSES = ["open", "investigating", "resolved", "ignored"];
export const STATUS_LABEL = {
  open: "Açık", investigating: "İnceleniyor", resolved: "Çözüldü", ignored: "Yok sayıldı",
};
export const statusLabel = (s) => STATUS_LABEL[s] || s;

export const sevClass = (s) => `badge sev-${s || "medium"}`;

export const ROLES = ["admin", "developer", "po", "tester"];
export const ROLE_LABEL = {
  admin: "Admin", developer: "Developer", po: "PO/PM", tester: "Tester", member: "Developer",
};
export const roleLabel = (r) => ROLE_LABEL[r] || r;

export const LLM_LABEL = {
  local: "LM Studio", ollama: "Ollama", openai: "GPT", gemini: "Gemini", claude: "Claude",
};
export const llmLabel = (p) => LLM_LABEL[p] || p;

export function timeAgo(iso) {
  if (!iso) return "-";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}sn önce`;
  if (diff < 3600) return `${Math.floor(diff / 60)}dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa önce`;
  return `${Math.floor(diff / 86400)}g önce`;
}
