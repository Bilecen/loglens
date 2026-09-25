import { useEffect, useState } from "react";

const THEME_KEY = "loglens_theme";
const STYLE_KEY = "loglens_style";

// Seçilebilir tasarım stilleri (data-style ile CSS override edilir).
export const STYLES = [
  { key: "default", label: "Varsayılan", hint: "Modern SaaS" },
  { key: "neomorphism", label: "Neomorphism", hint: "Yumuşak kabartma" },
  { key: "neominimal", label: "Neo-minimalizm", hint: "Düz, ince çizgi" },
  { key: "neofuturism", label: "Neo-fütürizm", hint: "Neon + cam" },
  { key: "neoclassic", label: "Neo-klasizm", hint: "Serif, sıcak" },
];

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  return { theme, toggle };
}

export function useStyle() {
  const [style, setStyle] = useState(() => localStorage.getItem(STYLE_KEY) || "default");

  useEffect(() => {
    document.documentElement.setAttribute("data-style", style);
    localStorage.setItem(STYLE_KEY, style);
  }, [style]);

  return { style, setStyle };
}
