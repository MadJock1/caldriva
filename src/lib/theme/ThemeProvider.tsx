"use client";

import { createContext, useContext, useEffect, useState, useCallback, startTransition, ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type CanvasBackground = "white" | "black";

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  canvasBackground: CanvasBackground;
  syncCanvasWithTheme: boolean;
  setTheme: (theme: ThemeMode) => void;
  setCanvasBackground: (background: CanvasBackground) => void;
  setSyncCanvasWithTheme: (sync: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = "caldriva-theme";
const CANVAS_BG_STORAGE_KEY = "caldriva-canvas-bg";
const SYNC_CANVAS_STORAGE_KEY = "caldriva-sync-canvas";

function resolveTheme(theme: ThemeMode): "light" | "dark" {
  if (theme === "system") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Keep the initial client render identical to SSR; browser preferences load after hydration.
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");
  const [canvasBackground, setCanvasBackgroundState] = useState<CanvasBackground>("white");
  const [syncCanvasWithTheme, setSyncCanvasWithThemeState] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Update resolved theme and apply to DOM
  const updateResolvedTheme = useCallback((newTheme: ThemeMode) => {
    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("light", resolved === "light");
      document.documentElement.setAttribute("data-theme", resolved);
    }
  }, []);

  // Apply DOM updates when resolvedTheme or canvasBackground changes
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("light", resolvedTheme === "light");
      document.documentElement.setAttribute("data-theme", resolvedTheme);
      document.documentElement.setAttribute("data-canvas-bg", canvasBackground);
    }
  }, [resolvedTheme, canvasBackground]);

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    const savedCanvas = localStorage.getItem(CANVAS_BG_STORAGE_KEY) as CanvasBackground | null;
    startTransition(() => {
      setThemeState(savedTheme ?? "dark");
      setCanvasBackgroundState(savedCanvas ?? "white");
      setSyncCanvasWithThemeState(localStorage.getItem(SYNC_CANVAS_STORAGE_KEY) === "true");
      setMounted(true);
    });
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        updateResolvedTheme("system");
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, updateResolvedTheme]);

  // Apply theme changes to localStorage and DOM
  useEffect(() => {
    if (!mounted) return;
    startTransition(() => updateResolvedTheme(theme));
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [mounted, theme, updateResolvedTheme]);

  // Apply canvas background changes to localStorage and DOM
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(CANVAS_BG_STORAGE_KEY, canvasBackground);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-canvas-bg", canvasBackground);
    }
  }, [canvasBackground, mounted]);

  // Apply sync preference to localStorage
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(SYNC_CANVAS_STORAGE_KEY, String(syncCanvasWithTheme));
  }, [mounted, syncCanvasWithTheme]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
  }, []);

  const setCanvasBackground = useCallback((background: CanvasBackground) => {
    setCanvasBackgroundState(background);
    if (syncCanvasWithTheme) {
      setSyncCanvasWithThemeState(false);
      localStorage.setItem(SYNC_CANVAS_STORAGE_KEY, "false");
    }
  }, [syncCanvasWithTheme]);

  const setSyncCanvasWithTheme = useCallback((sync: boolean) => {
    setSyncCanvasWithThemeState(sync);
    // Sync canvas immediately when user enables sync
    if (sync) {
      setCanvasBackgroundState(resolvedTheme === "light" ? "white" : "black");
    }
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        canvasBackground,
        syncCanvasWithTheme,
        setTheme,
        setCanvasBackground,
        setSyncCanvasWithTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
