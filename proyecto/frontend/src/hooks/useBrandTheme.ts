import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "zarpi-theme";
const THEME_EVENT = "zarpi-theme-change";
type TransitionOrigin = {
  clientX: number;
  clientY: number;
  currentTarget?: {
    getBoundingClientRect: () => {
      left: number;
      top: number;
      width: number;
      height: number;
    };
  };
};

function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}

function readTheme(): boolean {
  if (typeof window === "undefined") return true; // Por defecto oscuro en SSR
  try {
    const val = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (val === null) return true; // Por defecto oscuro si no existe
    return val === "dark";
  } catch {
    return true; // Por defecto oscuro ante cualquier error de almacenamiento
  }
}

export function useBrandTheme() {
  const [dark, setDark] = useState(readTheme);

  useEffect(() => {
    applyTheme(dark);
    const handleThemeChange = (event: Event) => {
      const next = (event as CustomEvent<boolean>).detail;
      setDark(next);
      applyTheme(next);
    };
    window.addEventListener(THEME_EVENT, handleThemeChange);
    return () => window.removeEventListener(THEME_EVENT, handleThemeChange);
  }, [dark]);

  function toggleTheme(origin?: TransitionOrigin) {
    const next = !dark;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      /* sin almacenamiento */
    }

    const change = () => {
      setDark(next);
      applyTheme(next);
      window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
    };

    const transitions = document as Document & {
      startViewTransition?: (update: () => void) => { finished: Promise<void> };
    };

    if (origin && transitions.startViewTransition) {
      const bounds = origin.currentTarget?.getBoundingClientRect();
      const x = bounds ? bounds.left + bounds.width / 2 : origin.clientX;
      const y = bounds ? bounds.top + bounds.height / 2 : origin.clientY;
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );
      document.documentElement.style.setProperty("--zarpi-theme-x", `${x}px`);
      document.documentElement.style.setProperty("--zarpi-theme-y", `${y}px`);
      document.documentElement.style.setProperty("--zarpi-theme-radius", `${radius}px`);
      document.documentElement.dataset.themeTransition = next ? "dark" : "light";

      const view = transitions.startViewTransition(change);
      view.finished.finally(() => {
        delete document.documentElement.dataset.themeTransition;
      });
    } else {
      change();
    }
  }

  return { dark, toggleTheme };
}