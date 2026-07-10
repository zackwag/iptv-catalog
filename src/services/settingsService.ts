import cron from "node-cron";
import { getMeta, setMeta } from "../db";
import { createLogger } from "../logger";

const log = createLogger("settingsService");

const CATALOG_CRON_KEY = "catalogRefreshCron";
const AUTO_REMOVE_ENABLED_KEY = "autoRemoveFailedChannels";
const AUTO_REMOVE_THRESHOLD_KEY = "autoRemoveFailureThreshold";
const WEBHOOK_URL_KEY = "webhookUrl";
const PUBLIC_BASE_URL_KEY = "publicBaseUrl";
const EPG_STALENESS_WARNING_HOURS_KEY = "epgStalenessWarningHours";
const THEME_KEY = "theme";
const CHANNELS_DVR_URL_KEY = "channelsDvrUrl";
const BLOCK_COUNTRIES_KEY = "blockCountries";
const BLOCK_CATEGORIES_KEY = "blockCategories";
const BLOCK_STREAM_DOMAINS_KEY = "blockStreamDomains";
const BLOCK_NSFW_KEY = "blockNsfw";

const FALLBACK_DEFAULT_CRON = "0 4 * * *"; // daily at 4am
const DEFAULT_AUTO_REMOVE_ENABLED = false;
const DEFAULT_AUTO_REMOVE_THRESHOLD = 3;
const DEFAULT_EPG_STALENESS_WARNING_HOURS = 12;
const DEFAULT_THEME: ThemeMode = "dark";

export type ThemeMode = "light" | "dark" | "system";

const VALID_THEMES: ThemeMode[] = ["light", "dark", "system"];

export interface Settings {
  /** Cron expression controlling how often the iptv-org catalog is re-pulled. */
  catalogRefreshCron: string;
  /** Off by default: whether a channel gets auto-removed from a playlist after repeated failures. */
  autoRemoveFailedChannels: boolean;
  /** Consecutive failed checks before auto-removal kicks in, when enabled. */
  autoRemoveFailureThreshold: number;
  /** Optional outbound webhook URL, fired on new failure/removal notifications. Empty = disabled. */
  webhookUrl: string;
  /**
   * Optional override for the host:port used when building m3uUrl/epgUrl and
   * the M3U's embedded x-tvg-url. Empty = inferred from the incoming
   * request, which works fine for most setups — only needed if that
   * inference picks the wrong address (e.g. behind a reverse proxy).
   */
  publicBaseUrl: string;
  /** Hours since guide.xml last changed before the epg sidecar is flagged unhealthy. */
  epgStalenessWarningHours: number;
  /** Web UI appearance: light, dark, or follow the browser/OS preference. */
  theme: ThemeMode;
  /** Optional Channels DVR base URL (e.g. http://192.168.1.50:8089) for one-click push. */
  channelsDvrUrl: string;
  /** Comma-separated country codes to hide from the catalog (e.g. "ru,cn"). */
  blockCountries: string;
  /** Comma-separated category slugs to hide from the catalog (e.g. "xxx,adult"). */
  blockCategories: string;
  /** Comma-separated stream URL domain substrings to hide (e.g. "example.com"). */
  blockStreamDomains: string;
  /** Whether to hide NSFW-flagged channels from the catalog. */
  blockNsfw: boolean;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

let _settingsCache: Settings | null = null;

export function invalidateSettingsCache(): void {
  _settingsCache = null;
}

export function loadSettings(): Settings {
  if (_settingsCache) return _settingsCache;
  let catalogRefreshCron = getMeta(CATALOG_CRON_KEY);
  if (!catalogRefreshCron) {
    catalogRefreshCron = FALLBACK_DEFAULT_CRON;
    setMeta(CATALOG_CRON_KEY, catalogRefreshCron);
    log.info(`no catalogRefreshCron stored yet, seeded with default "${catalogRefreshCron}"`);
  } else if (!cron.validate(catalogRefreshCron)) {
    log.error(`stored catalogRefreshCron "${catalogRefreshCron}" is invalid, falling back to default`);
    catalogRefreshCron = FALLBACK_DEFAULT_CRON;
  }

  const autoRemoveEnabledRaw = getMeta(AUTO_REMOVE_ENABLED_KEY);
  const autoRemoveFailedChannels =
    autoRemoveEnabledRaw === null ? DEFAULT_AUTO_REMOVE_ENABLED : autoRemoveEnabledRaw === "true";

  const autoRemoveThresholdRaw = getMeta(AUTO_REMOVE_THRESHOLD_KEY);
  const parsedThreshold = autoRemoveThresholdRaw ? parseInt(autoRemoveThresholdRaw, 10) : NaN;
  const autoRemoveFailureThreshold =
    Number.isInteger(parsedThreshold) && parsedThreshold > 0
      ? parsedThreshold
      : DEFAULT_AUTO_REMOVE_THRESHOLD;

  const webhookUrl = getMeta(WEBHOOK_URL_KEY) || "";
  const publicBaseUrl = getMeta(PUBLIC_BASE_URL_KEY) || "";
  const channelsDvrUrl = getMeta(CHANNELS_DVR_URL_KEY) || "";
  const blockCountries = getMeta(BLOCK_COUNTRIES_KEY) || "";
  const blockCategories = getMeta(BLOCK_CATEGORIES_KEY) || "";
  const blockStreamDomains = getMeta(BLOCK_STREAM_DOMAINS_KEY) || "";
  const blockNsfwRaw = getMeta(BLOCK_NSFW_KEY);
  const blockNsfw = blockNsfwRaw === null ? true : blockNsfwRaw === "true";

  const epgStalenessRaw = getMeta(EPG_STALENESS_WARNING_HOURS_KEY);
  const parsedEpgStaleness = epgStalenessRaw ? parseInt(epgStalenessRaw, 10) : NaN;
  const epgStalenessWarningHours =
    Number.isInteger(parsedEpgStaleness) && parsedEpgStaleness > 0
      ? parsedEpgStaleness
      : DEFAULT_EPG_STALENESS_WARNING_HOURS;

  const themeRaw = getMeta(THEME_KEY);
  const theme: ThemeMode = VALID_THEMES.includes(themeRaw as ThemeMode)
    ? (themeRaw as ThemeMode)
    : DEFAULT_THEME;

  _settingsCache = {
    catalogRefreshCron,
    autoRemoveFailedChannels,
    autoRemoveFailureThreshold,
    webhookUrl,
    publicBaseUrl,
    epgStalenessWarningHours,
    theme,
    channelsDvrUrl,
    blockCountries,
    blockCategories,
    blockStreamDomains,
    blockNsfw,
  };
  return _settingsCache;
}

export function saveSettings(updates: Partial<Settings>): Settings {
  if (updates.catalogRefreshCron !== undefined) {
    if (!cron.validate(updates.catalogRefreshCron)) {
      throw new Error(`"${updates.catalogRefreshCron}" is not a valid cron expression`);
    }
    setMeta(CATALOG_CRON_KEY, updates.catalogRefreshCron);
  }

  if (updates.autoRemoveFailedChannels !== undefined) {
    setMeta(AUTO_REMOVE_ENABLED_KEY, updates.autoRemoveFailedChannels ? "true" : "false");
  }

  if (updates.autoRemoveFailureThreshold !== undefined) {
    if (!Number.isInteger(updates.autoRemoveFailureThreshold) || updates.autoRemoveFailureThreshold <= 0) {
      throw new Error("autoRemoveFailureThreshold must be a positive integer");
    }
    setMeta(AUTO_REMOVE_THRESHOLD_KEY, String(updates.autoRemoveFailureThreshold));
  }

  if (updates.webhookUrl !== undefined) {
    if (updates.webhookUrl !== "" && !isValidHttpUrl(updates.webhookUrl)) {
      throw new Error(`"${updates.webhookUrl}" is not a valid http(s) URL`);
    }
    setMeta(WEBHOOK_URL_KEY, updates.webhookUrl);
  }

  if (updates.publicBaseUrl !== undefined) {
    if (updates.publicBaseUrl !== "" && !isValidHttpUrl(updates.publicBaseUrl)) {
      throw new Error(`"${updates.publicBaseUrl}" is not a valid http(s) URL`);
    }
    setMeta(PUBLIC_BASE_URL_KEY, updates.publicBaseUrl.replace(/\/$/, ""));
  }

  if (updates.epgStalenessWarningHours !== undefined) {
    if (!Number.isInteger(updates.epgStalenessWarningHours) || updates.epgStalenessWarningHours <= 0) {
      throw new Error("epgStalenessWarningHours must be a positive integer");
    }
    setMeta(EPG_STALENESS_WARNING_HOURS_KEY, String(updates.epgStalenessWarningHours));
  }

  if (updates.theme !== undefined) {
    if (!VALID_THEMES.includes(updates.theme)) {
      throw new Error(`theme must be one of: ${VALID_THEMES.join(", ")}`);
    }
    setMeta(THEME_KEY, updates.theme);
  }

  if (updates.channelsDvrUrl !== undefined) {
    if (updates.channelsDvrUrl !== "" && !isValidHttpUrl(updates.channelsDvrUrl)) {
      throw new Error(`"${updates.channelsDvrUrl}" is not a valid http(s) URL`);
    }
    setMeta(CHANNELS_DVR_URL_KEY, updates.channelsDvrUrl.replace(/\/$/, ""));
  }

  if (updates.blockCountries !== undefined) {
    setMeta(BLOCK_COUNTRIES_KEY, updates.blockCountries);
  }
  if (updates.blockCategories !== undefined) {
    setMeta(BLOCK_CATEGORIES_KEY, updates.blockCategories);
  }
  if (updates.blockStreamDomains !== undefined) {
    setMeta(BLOCK_STREAM_DOMAINS_KEY, updates.blockStreamDomains);
  }
  if (updates.blockNsfw !== undefined) {
    setMeta(BLOCK_NSFW_KEY, updates.blockNsfw ? "true" : "false");
  }

  log.info("settings updated", { ...updates });
  invalidateSettingsCache();
  return loadSettings();
}
