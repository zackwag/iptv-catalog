import cron, { ScheduledTask } from "node-cron";
import { getAllReferencedChannelIds } from "./playlistService";
import { getChannelsByIds } from "./catalogService";
import { writeEpgChannelsFile } from "./epgChannelsService";
import { refreshCatalog, purgeBlocklistedFromPlaylists } from "./catalogService";
import { loadSettings } from "./settingsService";
import { createLogger } from "../logger";

const log = createLogger("scheduler");

let currentTask: ScheduledTask | null = null;

/**
 * Regenerates the channels.xml consumed by the iptv-org/epg sidecar so it
 * only scrapes guide data for channels that are actually in a saved
 * playlist (not the whole iptv-org catalog).
 */
export function regenerateEpgChannelsFile(): { path: string; count: number } {
  const channelIds = getAllReferencedChannelIds();
  const channels = getChannelsByIds(channelIds);
  const result = writeEpgChannelsFile(channels);
  log.debug(`wrote epg channels.xml with ${result.count} channel(s)`, { path: result.path });
  return result;
}

async function runCatalogRefresh(): Promise<void> {
  log.info("running scheduled catalog refresh");
  try {
    const result = await refreshCatalog();
    log.info(`refreshed ${result.channelCount} channels`);
    const purged = purgeBlocklistedFromPlaylists();
    if (purged > 0)
      log.info(`purged ${purged} newly-blocked channel(s) from playlists after refresh`);
    regenerateEpgChannelsFile();
  } catch (err) {
    log.error("scheduled catalog refresh failed", { error: (err as Error).message });
  }
}

/**
 * (Re)schedules the catalog refresh cron job using the given expression,
 * stopping any previously running task first. Called on boot with whatever
 * is currently in settings.json, and again whenever the schedule is changed
 * via PATCH /settings — no container restart required.
 */
export function scheduleCatalogRefresh(cronExpression: string): void {
  if (currentTask) {
    currentTask.stop();
    log.debug("stopped previous catalog refresh schedule");
  }

  currentTask = cron.schedule(cronExpression, runCatalogRefresh);
  log.info(`catalog refresh scheduled with cron "${cronExpression}"`);
}

export function startSchedulers(): void {
  const settings = loadSettings();
  scheduleCatalogRefresh(settings.catalogRefreshCron);
}
