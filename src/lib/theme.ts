export type Theme = "dark" | "light";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const t = localStorage.getItem("theme");
    return t === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // ignore storage errors
  }
}
