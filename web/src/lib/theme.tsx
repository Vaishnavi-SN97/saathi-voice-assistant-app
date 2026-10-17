import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "saathi.theme";

const systemTheme = (): Theme => (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null; // private window or blocked storage
  }
}

const apply = (t: Theme) => document.documentElement.setAttribute("data-theme", t);

/** Bright / dark theme. Follows the device until the person chooses, then remembers the choice. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => stored() ?? systemTheme());

  useEffect(() => { apply(theme); }, [theme]);

  // keep following the device while nothing has been chosen here
  useEffect(() => {
    if (stored()) return;
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const on = () => !stored() && setTheme(systemTheme());
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  return [
    theme,
    () =>
      setTheme((prev) => {
        const next: Theme = prev === "dark" ? "light" : "dark";
        try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
        return next;
      }),
  ];
}

/** Big, obvious sun / moon switch (56 px high, like the other senior-friendly controls). */
export function ThemeToggle({ labels }: { labels?: { light: string; dark: string } }) {
  const [theme, toggle] = useTheme();
  const isDark = theme === "dark";
  const text = labels ? (isDark ? labels.light : labels.dark) : isDark ? "Bright" : "Dark";
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-pressed={isDark} title={text}>
      <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
      <span className="theme-toggle-label">{text}</span>
    </button>
  );
}
