import { getGuideLastGeneratedAt } from "./epgChannelsService";
import { loadSettings } from "./settingsService";
import { createLogger } from "../logger";

const log = createLogger("epgHealth");

// Only log when crossing from fresh -> stale (or stale -> fresh), not on
// every check, so a long-lasting problem doesn't spam the logs every tick.
let wasStaleLastCheck = false;

export interface EpgHealth {
  lastGeneratedAt: string | null;
  isStale: boolean;
  staleThresholdHours: number;
}

export function getEpgHealth(): EpgHealth {
  const { epgStalenessWarningHours } = loadSettings();
  const lastGeneratedAt = getGuideLastGeneratedAt();

  if (!lastGeneratedAt) {
    return { lastGeneratedAt: null, isStale: true, staleThresholdHours: epgStalenessWarningHours };
  }

  const hoursSince = (Date.now() - new Date(lastGeneratedAt).getTime()) / 3_600_000;
  const isStale = hoursSince >= epgStalenessWarningHours;

  return { lastGeneratedAt, isStale, staleThresholdHours: epgStalenessWarningHours };
}

/** Call periodically (e.g. from an existing scheduler tick) to log on stale transitions. */
export function checkEpgHealthAndLog(): void {
  const health = getEpgHealth();

  if (health.isStale && !wasStaleLastCheck) {
    log.warn(
      health.lastGeneratedAt
        ? `epg guide.xml hasn't been updated in over ${health.staleThresholdHours}h (last: ${health.lastGeneratedAt}) — check the epg sidecar container`
        : `epg guide.xml has never been generated — check the epg sidecar container`
    );
  } else if (!health.isStale && wasStaleLastCheck) {
    log.info(`epg guide.xml is fresh again (last: ${health.lastGeneratedAt})`);
  }

  wasStaleLastCheck = health.isStale;
}
