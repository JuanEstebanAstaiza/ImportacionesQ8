import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "zarpi-theme";
const THEME_EVENT = "zarpi-theme-change";

export function useBrandTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark";
  });

  useEffect(() => {
    const applyTheme = (isDark: boolean) => {
      document.documentElement.classList.toggle("dark", isDark);
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    };
    const handleThemeChange = (event: Event) => {
      const next = (event as CustomEvent<boolean>).detail;
      setDark(next);
      applyTheme(next);
    };
    applyTheme(dark);
    window.addEventListener(THEME_EVENT, handleThemeChange);
    return () => window.removeEventListener(THEME_EVENT, handleThemeChange);
  }, [dark]);

  function toggleTheme() {
    const next = !dark;
    window.localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
  }

  return { dark, toggleTheme };
}
