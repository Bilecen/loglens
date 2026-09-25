import { useEffect, useState } from "react";

const THEME_KEY = "loglens_theme";
const STYLE_KEY = "loglens_style";

// Seçilebilir tasarım stilleri (data-style ile CSS override edilir). label/hint metinleri
// i18n anahtarı — ProfileMenu.jsx t() ile çözer (bu dosya component olmadığı için hook kullanamaz).
export const STYLES = [
  { key: "default", labelKey: "profileMenu.styles.default.label", hintKey: "profileMenu.styles.default.hint" },
  { key: "neomorphism", labelKey: "profileMenu.styles.neomorphism.label", hintKey: "profileMenu.styles.neomorphism.hint" },
  { key: "neominimal", labelKey: "profileMenu.styles.neominimal.label", hintKey: "profileMenu.styles.neominimal.hint" },
  { key: "neofuturism", labelKey: "profileMenu.styles.neofuturism.label", hintKey: "profileMenu.styles.neofuturism.hint" },
  { key: "neoclassic", labelKey: "profileMenu.styles.neoclassic.label", hintKey: "profileMenu.styles.neoclassic.hint" },
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
