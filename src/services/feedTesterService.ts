import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import { getPlaylist } from "./playlistService";
import { getFallbackStreams, promoteStream } from "./catalogService";
import { loadSettings } from "./settingsService";
import { regenerateEpgChannelsFile } from "./epgSchedulerService";
import { sendWebhook } from "./webhookService";
import { mapWithConcurrency } from "../utils/concurrency";
import { createLogger } from "../logger";
import { Notification } from "../types";

const log = createLogger("feedTester");

const TEST_TIMEOUT_MS = Number(process.env.FEED_TEST_TIMEOUT_MS || 8000);
const TEST_CONCURRENCY = Number(process.env.FEED_TEST_CONCURRENCY || 10);

interface StreamTestResult {
  ok: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * Checks whether a stream URL is reachable without downloading the stream
 * itself — many IPTV feeds are continuous MPEG-TS streams that never end,
 * so we abort as soon as we have a response status and destroy the
 * response body immediately rather than reading it.
 */
async function testStreamUrl(url: string): Promise<StreamTestResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

  try {
    let res = await attemptRequest(url, "HEAD", controller.signal).catch(() => null);

    // Some IPTV/CDN servers reject HEAD outright (network error) or respond
    // with 405/501; either way, fall back to GET and bail out immediately
    // after we see the status.
    if (!res || res.status === 405 || res.status === 501) {
      res = await attemptRequest(url, "GET", controller.signal);
    }

    const statusCode = res.status;
    destroyBody(res);

    if (res.ok) {
      return { ok: true, statusCode };
    }
    return { ok: false, statusCode, error: `HTTP ${statusCode}` };
  } catch (err) {
    const isAbort = (err as Error).name === "AbortError";
    return {
      ok: false,
      error: isAbort ? `timed out after ${TEST_TIMEOUT_MS}ms` : (err as Error).message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function attemptRequest(url: string, method: "HEAD" | "GET", signal: AbortSignal) {
  return fetch(url, { method, signal, redirect: "follow" });
}

function destroyBody(res: Awaited<ReturnType<typeof fetch>>): void {
  // node-fetch v2 exposes a Node Readable here; destroying it releases the
  // socket instead of leaving a live-stream connection open indefinitely.
  if (res.body && typeof (res.body as { destroy?: () => void }).destroy === "function") {
    (res.body as unknown as { destroy: () => void }).destroy();
  }
}

function getActiveFailure(playlistId: string, channelId: string): Notification | undefined {
  return db
    .prepare(
      "SELECT * FROM notifications WHERE playlistId = ? AND channelId = ? AND dismissed = 0 AND kind = 'failure'"
    )
    .get(playlistId, channelId) as Notification | undefined;
}

/**
 * Records a failed check. If there's already an active failure notification
 * for this channel+playlist, bumps its failure count in place rather than
 * creating a duplicate. Returns the resulting count and whether this was a
 * brand new notification (vs. an existing one getting its count bumped) —
 * the webhook only fires on genuinely new occurrences, not every re-check
 * of something already known to be down.
 */
function recordFailure(
  playlistId: string,
  playlistName: string,
  channelId: string,
  channelName: string,
  message: string
): { failureCount: number; isNew: boolean } {
  const now = new Date().toISOString();
  const existing = getActiveFailure(playlistId, channelId);

  if (existing) {
    const nextCount = existing.failureCount + 1;
    db.prepare("UPDATE notifications SET message = ?, lastFailedAt = ?, failureCount = ? WHERE id = ?").run(
      message,
      now,
      nextCount,
      existing.id
    );
    return { failureCount: nextCount, isNew: false };
  }

  db.prepare(
    `INSERT INTO notifications
       (id, playlistId, playlistName, channelId, channelName, message, createdAt, lastFailedAt, dismissed, failureCount, kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 'failure')`
  ).run(uuidv4(), playlistId, playlistName, channelId, channelName, message, now, now);

  log.warn(`feed check failed: "${channelName}" in playlist "${playlistName}"`, { message });
  return { failureCount: 1, isNew: true };
}

/** Auto-resolves any active failure notification for a channel that's now passing again. */
function autoResolve(playlistId: string, channelId: string): void {
  db.prepare(
    "UPDATE notifications SET dismissed = 1, dismissedAt = ? WHERE playlistId = ? AND channelId = ? AND dismissed = 0 AND kind = 'failure'"
  ).run(new Date().toISOString(), playlistId, channelId);
}

function removeChannelFromPlaylist(playlistId: string, channelId: string): void {
  db.prepare("DELETE FROM playlist_channels WHERE playlistId = ? AND channelId = ?").run(playlistId, channelId);
}

function recordRemoval(
  playlistId: string,
  playlistName: string,
  channelId: string,
  channelName: string,
  failureCount: number
): void {
  // The failure notification is now moot — the channel is gone from the
  // playlist, so there's nothing left to warn about in the M3U. Close it
  // out and raise a distinct "removed" notification in its place.
  db.prepare(
    "UPDATE notifications SET dismissed = 1, dismissedAt = ? WHERE playlistId = ? AND channelId = ? AND dismissed = 0 AND kind = 'failure'"
  ).run(new Date().toISOString(), playlistId, channelId);

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO notifications
       (id, playlistId, playlistName, channelId, channelName, message, createdAt, lastFailedAt, dismissed, failureCount, kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'removed')`
  ).run(
    uuidv4(),
    playlistId,
    playlistName,
    channelId,
    channelName,
    `Removed from playlist after ${failureCount} consecutive failed checks`,
    now,
    now,
    failureCount
  );

  log.warn(`auto-removed "${channelName}" from playlist "${playlistName}" after ${failureCount} failures`);
}

function markTested(playlistId: string): void {
  db.prepare("UPDATE playlists SET lastTestedAt = ? WHERE id = ?").run(new Date().toISOString(), playlistId);
}

export async function testPlaylist(playlistId: string): Promise<{ tested: number; failed: number; removed: number }> {
  const playlist = getPlaylist(playlistId);
  if (!playlist) {
    throw new Error(`playlist ${playlistId} not found`);
  }

  const settings = loadSettings();
  const channelsWithStream = playlist.channels.filter((c) => !!c.streamUrl);
  log.info(
    `testing ${channelsWithStream.length} channel(s) in playlist "${playlist.name}" (max ${TEST_CONCURRENCY} concurrent)`,
    { playlistId }
  );

  let failed = 0;
  let removed = 0;

  await mapWithConcurrency(channelsWithStream, TEST_CONCURRENCY, async (ch) => {
    // Try primary stream first
    let result = await testStreamUrl(ch.streamUrl as string);

    // If primary fails, walk fallbacks in order
    if (!result.ok) {
      const fallbacks = getFallbackStreams(ch.id).filter(f => f.url !== ch.streamUrl);
      for (const fallback of fallbacks) {
        const fallbackResult = await testStreamUrl(fallback.url);
        if (fallbackResult.ok) {
          // Promote the working fallback to primary
          promoteStream(ch.id, fallback.url);
          log.info(`promoted fallback stream for "${ch.name}": ${fallback.url}`);
          result = fallbackResult;
          break;
        }
      }
    }

    if (result.ok) {
      autoResolve(playlistId, ch.id);
      return;
    }

    failed++;
    const { failureCount, isNew } = recordFailure(
      playlistId,
      playlist.name,
      ch.id,
      ch.name,
      result.error || "unknown error"
    );

    if (isNew) {
      await sendWebhook({
        event: "channel_failing",
        playlistName: playlist.name,
        channelName: ch.name,
        message: result.error || "unknown error",
        timestamp: new Date().toISOString(),
      });
    }

    if (settings.autoRemoveFailedChannels && failureCount >= settings.autoRemoveFailureThreshold) {
      removeChannelFromPlaylist(playlistId, ch.id);
      recordRemoval(playlistId, playlist.name, ch.id, ch.name, failureCount);
      removed++;

      await sendWebhook({
        event: "channel_removed",
        playlistName: playlist.name,
        channelName: ch.name,
        message: `Removed after ${failureCount} consecutive failed checks`,
        timestamp: new Date().toISOString(),
      });
    }
  });

  markTested(playlistId);

  if (removed > 0) {
    regenerateEpgChannelsFile(); // playlist membership changed, epg scope needs to reflect it
  }

  log.info(
    `finished testing playlist "${playlist.name}": ${failed} of ${channelsWithStream.length} failing, ${removed} auto-removed`,
    { playlistId }
  );

  return { tested: channelsWithStream.length, failed, removed };
}
