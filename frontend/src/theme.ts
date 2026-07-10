export type ThemeMode = "light" | "dark" | "system";

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return mode;
}

export function applyTheme(mode: ThemeMode): void {
  const resolved = resolveTheme(mode);
  if (resolved === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

let cleanupSystemWatcher: (() => void) | null = null;

/**
 * Keeps the applied theme in sync with the OS/browser preference while
 * mode is "system" — e.g. the app flips from dark to light automatically
 * if the person's system switches at sunset, without needing a refresh.
 * Call this again whenever the mode changes to replace the previous watcher.
 */
export function watchSystemTheme(mode: ThemeMode): void {
  if (cleanupSystemWatcher) {
    cleanupSystemWatcher();
    cleanupSystemWatcher = null;
  }

  if (mode !== "system") return;

  const mq = window.matchMedia("(prefers-color-scheme: light)");
  const handler = () => applyTheme(mode);
  mq.addEventListener("change", handler);
  cleanupSystemWatcher = () => mq.removeEventListener("change", handler);
}
