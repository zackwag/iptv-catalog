import cron from "node-cron";
import { listPlaylists } from "./playlistService";
import { testPlaylist } from "./feedTesterService";
import { checkEpgHealthAndLog } from "./epgHealthService";
import { createLogger } from "../logger";
import { Playlist } from "../types";

const log = createLogger("feedTestScheduler");

// How often we check which playlists are due — independent of each
// playlist's own checkIntervalHours, which just needs to be coarser than
// this tick for the schedule to be respected accurately. Also doubles as
// the epg sidecar health-check interval, since checking a file's mtime is
// essentially free.
const TICK_CRON = process.env.FEED_TEST_TICK_CRON || "*/15 * * * *";

function isDue(playlist: Playlist): boolean {
  if (!playlist.lastTestedAt) return true;
  const hoursSinceLastTest = (Date.now() - new Date(playlist.lastTestedAt).getTime()) / 3_600_000;
  return hoursSinceLastTest >= playlist.checkIntervalHours;
}

export function startFeedTestScheduler(): void {
  cron.schedule(TICK_CRON, async () => {
    checkEpgHealthAndLog();

    const due = listPlaylists().filter(isDue);
    if (due.length === 0) return;

    log.debug(`${due.length} playlist(s) due for feed testing`);
    for (const playlist of due) {
      try {
        await testPlaylist(playlist.id);
      } catch (err) {
        log.error(`feed test failed for playlist ${playlist.id}`, { error: (err as Error).message });
      }
    }
  });

  log.info(`feed test scheduler ticking on "${TICK_CRON}" (per-playlist interval set by checkIntervalHours)`);
}
