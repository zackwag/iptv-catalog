import { Router } from "express";
import cron from "node-cron";
import { loadSettings, saveSettings, ThemeMode } from "../services/settingsService";
import { scheduleCatalogRefresh } from "../services/epgSchedulerService";
import { purgeBlocklistedFromPlaylists } from "../services/catalogService";
import { regenerateEpgChannelsFile } from "../services/epgSchedulerService";
import { getEpgHealth } from "../services/epgHealthService";
import { getMeta } from "../db";
import { createLogger } from "../logger";
import { APP_VERSION } from "../version";

const log = createLogger("settingsRoute");

export const settingsRouter = Router();

const VALID_THEMES: ThemeMode[] = ["light", "dark", "system"];

// GET /settings
settingsRouter.get("/settings", (_req, res) => {
  const settings = loadSettings();
  res.json({
    ...settings,
    catalogRefreshedAt: getMeta("catalogRefreshedAt"),
    epgHealth: getEpgHealth(),
    version: APP_VERSION,
  });
});

// PATCH /settings  { catalogRefreshCron?, autoRemoveFailedChannels?, autoRemoveFailureThreshold?, webhookUrl?, publicBaseUrl?, epgStalenessWarningHours?, theme?, channelsDvrUrl? }
settingsRouter.patch("/settings", (req, res) => {
  const {
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
  } = req.body ?? {};

  if (catalogRefreshCron !== undefined) {
    if (typeof catalogRefreshCron !== "string" || !cron.validate(catalogRefreshCron)) {
      return res.status(400).json({
        error: `"${catalogRefreshCron}" is not a valid cron expression`,
      });
    }
  }
  if (autoRemoveFailedChannels !== undefined && typeof autoRemoveFailedChannels !== "boolean") {
    return res.status(400).json({ error: "autoRemoveFailedChannels must be a boolean" });
  }
  if (
    autoRemoveFailureThreshold !== undefined &&
    (!Number.isInteger(autoRemoveFailureThreshold) || autoRemoveFailureThreshold <= 0)
  ) {
    return res.status(400).json({ error: "autoRemoveFailureThreshold must be a positive integer" });
  }
  if (webhookUrl !== undefined && typeof webhookUrl !== "string") {
    return res.status(400).json({ error: "webhookUrl must be a string" });
  }
  if (publicBaseUrl !== undefined && typeof publicBaseUrl !== "string") {
    return res.status(400).json({ error: "publicBaseUrl must be a string" });
  }
  if (channelsDvrUrl !== undefined && typeof channelsDvrUrl !== "string") {
    return res.status(400).json({ error: "channelsDvrUrl must be a string" });
  }
  if (blockCountries !== undefined && typeof blockCountries !== "string") {
    return res.status(400).json({ error: "blockCountries must be a string" });
  }
  if (blockCategories !== undefined && typeof blockCategories !== "string") {
    return res.status(400).json({ error: "blockCategories must be a string" });
  }
  if (blockStreamDomains !== undefined && typeof blockStreamDomains !== "string") {
    return res.status(400).json({ error: "blockStreamDomains must be a string" });
  }
  if (blockNsfw !== undefined && typeof blockNsfw !== "boolean") {
    return res.status(400).json({ error: "blockNsfw must be a boolean" });
  }
  if (
    epgStalenessWarningHours !== undefined &&
    (!Number.isInteger(epgStalenessWarningHours) || epgStalenessWarningHours <= 0)
  ) {
    return res.status(400).json({ error: "epgStalenessWarningHours must be a positive integer" });
  }
  if (theme !== undefined && !VALID_THEMES.includes(theme)) {
    return res.status(400).json({ error: `theme must be one of: ${VALID_THEMES.join(", ")}` });
  }

  try {
    const updated = saveSettings({
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
    });

    // Apply immediately — no container restart required to pick up a new schedule.
    if (catalogRefreshCron !== undefined) {
      scheduleCatalogRefresh(updated.catalogRefreshCron);
    }

    let purgedCount = 0;
    if (
      blockCountries !== undefined ||
      blockCategories !== undefined ||
      blockStreamDomains !== undefined ||
      blockNsfw !== undefined
    ) {
      purgedCount = purgeBlocklistedFromPlaylists();
      if (purgedCount > 0) regenerateEpgChannelsFile();
    }

    res.json({
      purgedFromPlaylists: purgedCount,
      ...updated,
      catalogRefreshedAt: getMeta("catalogRefreshedAt"),
      epgHealth: getEpgHealth(),
      version: APP_VERSION,
    });
  } catch (err) {
    log.error("failed to save settings", { error: (err as Error).message });
    res.status(400).json({ error: (err as Error).message });
  }
});
