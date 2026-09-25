import { createContext, useContext, useState } from "react";
import tr from "./locales/tr.json";
import en from "./locales/en.json";

const DICTS = { tr, en };
export const LOCALES = [
  { key: "tr", labelKey: "common.turkish" },
  { key: "en", labelKey: "common.english" },
];
const KEY = "loglens_locale";

const LocaleCtx = createContext(null);

function lookup(dict, key) {
  return key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), dict);
}

function translate(locale, key, vars) {
  const raw = lookup(DICTS[locale], key) ?? lookup(DICTS.tr, key) ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), raw);
}

// Hook dışından (labels.js gibi component-olmayan yardımcılardan) senkron okuma için.
// setLocale çağrısında React state'ten ÖNCE senkron güncellenir + dinleyiciler tetiklenir,
// böylece aynı render turunda enum etiketleri (ORIGIN_LABEL vb.) de güncel gelir.
let _currentLocale = localStorage.getItem(KEY) || "tr";
const _listeners = new Set();
export const getLocale = () => _currentLocale;
export const onLocaleChange = (fn) => { _listeners.add(fn); return () => _listeners.delete(fn); };
export const tGlobal = (key, vars) => translate(_currentLocale, key, vars);

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(() => _currentLocale);

  const setLocale = (l) => {
    _currentLocale = l;
    localStorage.setItem(KEY, l);
    _listeners.forEach((fn) => fn(l));
    setLocaleState(l);
  };

  // key: "namespace.key", vars: {ad: "değer"} -> metindeki {ad} yerine geçer.
  // Çeviri eksikse tr'ye, o da yoksa anahtarın kendisine düşer (kırık ekran yerine görünür iz).
  const t = (key, vars) => translate(locale, key, vars);

  return (
    <LocaleCtx.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleCtx.Provider>
  );
}

export const useLocale = () => useContext(LocaleCtx);
