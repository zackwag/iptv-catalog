/**
 * Minimal leveled logger. No dependency — just gated console output with a
 * consistent timestamp + level + scope prefix.
 *
 * Controlled by the LOG_LEVEL env var: "error" | "warn" | "info" | "debug"
 * (default: "info"). Each level includes everything above it in severity,
 * e.g. "warn" logs warn + error, "debug" logs everything.
 */

export type LogLevel = "error" | "warn" | "info" | "debug";

const LEVEL_ORDER: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function resolveConfiguredLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL || "info").toLowerCase();
  if (raw === "error" || raw === "warn" || raw === "info" || raw === "debug") {
    return raw;
  }
  // Don't silently swallow a typo'd env var — fall back to "info" but say so.
  // eslint-disable-next-line no-console
  console.warn(
    `[logger] LOG_LEVEL="${raw}" is not one of error|warn|info|debug, defaulting to "info"`
  );
  return "info";
}

const configuredLevel = resolveConfiguredLevel();

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] <= LEVEL_ORDER[configuredLevel];
}

function timestamp(): string {
  return new Date().toISOString();
}

function write(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const line = `${timestamp()} [${level.toUpperCase()}] [${scope}] ${message}`;
  const out = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (meta && Object.keys(meta).length > 0) {
    out(line, meta);
  } else {
    out(line);
  }
}

/** Creates a logger scoped to a module/component name, e.g. logger("catalogService"). */
export function createLogger(scope: string) {
  return {
    error: (message: string, meta?: Record<string, unknown>) => write("error", scope, message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => write("warn", scope, message, meta),
    info: (message: string, meta?: Record<string, unknown>) => write("info", scope, message, meta),
    debug: (message: string, meta?: Record<string, unknown>) => write("debug", scope, message, meta),
  };
}

export const activeLogLevel = configuredLevel;
