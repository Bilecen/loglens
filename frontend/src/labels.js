// Uygulama genelinde ortak etiketler ve seçenekler.
// Çeviriler locales/{tr,en}.json "common" altında; fonksiyon imzaları sabit kalır (çağıranlar
// component olmak zorunda değil) — tGlobal() aktif dili modül-seviyesinde okur.
import { tGlobal, onLocaleChange } from "./i18n";

export const SEVERITIES = ["critical", "high", "medium", "low"];

export const ORIGINS = ["mobile", "web", "service"];
export const originLabel = (o) => tGlobal(`common.origin.${ORIGINS.includes(o) ? o : "unknown"}`);

export const STATUSES = ["open", "investigating", "resolved", "ignored"];
export const statusLabel = (s) => tGlobal(`common.status.${s}`);

export const sevClass = (s) => `badge sev-${s || "medium"}`;

export const ROLES = ["admin", "developer", "po", "tester"];
export const roleLabel = (r) => tGlobal(`common.role.${r === "member" ? "developer" : r}`);

export const llmLabel = (p) => tGlobal(`common.llm.${p}`);

export function timeAgo(iso) {
  if (!iso) return "-";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return tGlobal("common.time.secondsAgo", { n: Math.floor(diff) });
  if (diff < 3600) return tGlobal("common.time.minutesAgo", { n: Math.floor(diff / 60) });
  if (diff < 86400) return tGlobal("common.time.hoursAgo", { n: Math.floor(diff / 3600) });
  return tGlobal("common.time.daysAgo", { n: Math.floor(diff / 86400) });
}

// Bazı ekranlar (Dashboard grafik lejantları, Errors filtre listesi) ham {key: etiket} map'i
// bekliyor. ES module binding'leri canlıdır — setLocale() değişince onLocaleChange dinleyicisi
// bunları tazeler, importer'lar aynı isimle yeni değeri görür.
export let ORIGIN_LABEL = {};
export let STATUS_LABEL = {};
export let ROLE_LABEL = {};
export let LLM_LABEL = {};

function recompute() {
  ORIGIN_LABEL = { mobile: originLabel("mobile"), web: originLabel("web"), service: originLabel("service"), unknown: originLabel("unknown") };
  STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s, statusLabel(s)]));
  ROLE_LABEL = { ...Object.fromEntries(ROLES.map((r) => [r, roleLabel(r)])), member: roleLabel("developer") };
  LLM_LABEL = { local: llmLabel("local"), ollama: llmLabel("ollama"), openai: llmLabel("openai"), gemini: llmLabel("gemini"), claude: llmLabel("claude") };
}
recompute();
onLocaleChange(recompute);
