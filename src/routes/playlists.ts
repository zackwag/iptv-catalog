import { Router } from "express";
import https from "https";
import {
  createPlaylist,
  listPlaylists,
  getPlaylist,
  updatePlaylist,
  deletePlaylist,
} from "../services/playlistService";
import { regenerateEpgChannelsFile } from "../services/epgSchedulerService";
import { testPlaylist } from "../services/feedTesterService";
import { loadSettings } from "../services/settingsService";
import { createLogger } from "../logger";

const log = createLogger("playlistsRoute");

export const playlistsRouter = Router();

// Channels DVR caps a single Custom Channel (M3U) source at 500 channels;
// past that it silently drops the rest rather than erroring, so we surface
// a warning instead of letting that happen quietly.
const CHANNELS_DVR_SOURCE_LIMIT = 500;

function withLimitWarning<T extends { channelCount: number }>(playlist: T) {
  return { ...playlist, exceedsChannelsDvrLimit: playlist.channelCount > CHANNELS_DVR_SOURCE_LIMIT };
}

export function getBaseUrl(req: import("express").Request): string {
  const configured = loadSettings().publicBaseUrl;
  if (configured) return configured;
  return `${req.protocol}://${req.get("host")}`;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && value > 0;
}

// These routes are all mounted under /api by index.ts — this is the
// management/CRUD surface used by the web UI, distinct from the public
// playlist.m3u/guide.xml file URLs handed to Channels DVR/VLC (those live
// in publicPlaylistFiles.ts, mounted at the root path instead).

// POST /playlists  { name, channelIds: string[], checkIntervalHours?, channelNumberStart? }
playlistsRouter.post("/playlists", (req, res) => {
  const { name, channelIds, checkIntervalHours, channelNumberStart } = req.body ?? {};

  if (typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ error: "name is required" });
  }
  if (!Array.isArray(channelIds) || channelIds.some((c) => typeof c !== "string")) {
    return res.status(400).json({ error: "channelIds must be an array of strings" });
  }
  if (checkIntervalHours !== undefined && !isPositiveNumber(checkIntervalHours)) {
    return res.status(400).json({ error: "checkIntervalHours must be a positive number" });
  }
  if (channelNumberStart !== undefined && !isPositiveNumber(channelNumberStart)) {
    return res.status(400).json({ error: "channelNumberStart must be a positive number" });
  }

  const playlist = createPlaylist(name.trim(), channelIds, checkIntervalHours, channelNumberStart);
  regenerateEpgChannelsFile(); // scope the epg sidecar to all channels now referenced

  const baseUrl = getBaseUrl(req);
  res.status(201).json({
    ...withLimitWarning(playlist),
    m3uUrl: `${baseUrl}/playlists/${playlist.id}/playlist.m3u`,
    epgUrl: `${baseUrl}/playlists/${playlist.id}/guide.xml`,
  });
});

// GET /playlists
playlistsRouter.get("/playlists", (req, res) => {
  const baseUrl = getBaseUrl(req);
  const playlists = listPlaylists().map((p) => ({
    ...withLimitWarning(p),
    m3uUrl: `${baseUrl}/playlists/${p.id}/playlist.m3u`,
    epgUrl: `${baseUrl}/playlists/${p.id}/guide.xml`,
  }));
  res.json({ playlists });
});

// GET /playlists/:id
playlistsRouter.get("/playlists/:id", (req, res) => {
  const playlist = getPlaylist(req.params.id);
  if (!playlist) return res.status(404).json({ error: "playlist not found" });

  const baseUrl = getBaseUrl(req);
  res.json({
    ...withLimitWarning(playlist),
    m3uUrl: `${baseUrl}/playlists/${playlist.id}/playlist.m3u`,
    epgUrl: `${baseUrl}/playlists/${playlist.id}/guide.xml`,
  });
});

// PATCH /playlists/:id  { name?, channelIds?, checkIntervalHours?, channelNumberStart? }
playlistsRouter.patch("/playlists/:id", (req, res) => {
  const { name, channelIds, checkIntervalHours, channelNumberStart } = req.body ?? {};

  if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
    return res.status(400).json({ error: "name must be a non-empty string" });
  }
  if (channelIds !== undefined) {
    if (!Array.isArray(channelIds) || channelIds.some((c) => typeof c !== "string")) {
      return res.status(400).json({ error: "channelIds must be an array of strings" });
    }
  }
  if (checkIntervalHours !== undefined && !isPositiveNumber(checkIntervalHours)) {
    return res.status(400).json({ error: "checkIntervalHours must be a positive number" });
  }
  if (channelNumberStart !== undefined && !isPositiveNumber(channelNumberStart)) {
    return res.status(400).json({ error: "channelNumberStart must be a positive number" });
  }

  try {
    const updated = updatePlaylist(req.params.id, {
      name: name !== undefined ? name.trim() : undefined,
      channelIds,
      checkIntervalHours,
      channelNumberStart,
    });
    if (!updated) return res.status(404).json({ error: "playlist not found" });

    if (channelIds !== undefined) {
      regenerateEpgChannelsFile();
    }

    res.json(withLimitWarning(updated));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// DELETE /playlists/:id
playlistsRouter.delete("/playlists/:id", (req, res) => {
  const deleted = deletePlaylist(req.params.id);
  if (!deleted) return res.status(404).json({ error: "playlist not found" });
  regenerateEpgChannelsFile();
  res.status(204).send();
});

// POST /playlists/:id/test — manually trigger a feed test right now
playlistsRouter.post("/playlists/:id/test", async (req, res) => {
  log.info(`manual feed test triggered for playlist ${req.params.id}`);
  try {
    const result = await testPlaylist(req.params.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(404).json({ ok: false, error: (err as Error).message });
  }
});

// GET /playlists/:id/export — a portable JSON definition (name + channel
// selection + settings), NOT the M3U/EPG URLs. Meant for backup/versioning
// or moving a playlist definition to another instance, not for Channels DVR.
playlistsRouter.get("/playlists/:id/export", (req, res) => {
  const playlist = getPlaylist(req.params.id);
  if (!playlist) return res.status(404).json({ error: "playlist not found" });

  res.setHeader("Content-Disposition", `attachment; filename="${playlist.name}.json"`);
  res.json({
    iptvCatalogPlaylistExport: 1,
    name: playlist.name,
    channelIds: playlist.channels.map((c) => c.id),
    checkIntervalHours: playlist.checkIntervalHours,
    channelNumberStart: playlist.channelNumberStart,
  });
});

// POST /playlists/import — recreates a playlist from a previously exported
// definition. Channel ids no longer in the catalog are silently skipped
// (same tolerance as any other playlist channel lookup).
playlistsRouter.post("/playlists/import", (req, res) => {
  const { name, channelIds, checkIntervalHours, channelNumberStart } = req.body ?? {};

  if (typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ error: "name is required" });
  }
  if (!Array.isArray(channelIds) || channelIds.some((c) => typeof c !== "string")) {
    return res.status(400).json({ error: "channelIds must be an array of strings" });
  }
  if (checkIntervalHours !== undefined && !isPositiveNumber(checkIntervalHours)) {
    return res.status(400).json({ error: "checkIntervalHours must be a positive number" });
  }
  if (channelNumberStart !== undefined && !isPositiveNumber(channelNumberStart)) {
    return res.status(400).json({ error: "channelNumberStart must be a positive number" });
  }

  const playlist = createPlaylist(name.trim(), channelIds, checkIntervalHours, channelNumberStart);
  regenerateEpgChannelsFile();

  log.info(`imported playlist "${playlist.name}" from a definition file`, { id: playlist.id });

  const baseUrl = getBaseUrl(req);
  res.status(201).json({
    ...withLimitWarning(playlist),
    m3uUrl: `${baseUrl}/playlists/${playlist.id}/playlist.m3u`,
    epgUrl: `${baseUrl}/playlists/${playlist.id}/guide.xml`,
  });
});

// POST /playlists/:id/push-to-dvr — registers this playlist as a Custom Channel (M3U)
// source in Channels DVR using the PUT /providers/m3u/sources/{name} API.
playlistsRouter.post("/playlists/:id/push-to-dvr", async (req, res) => {
  const playlist = getPlaylist(req.params.id);
  if (!playlist) return res.status(404).json({ error: "playlist not found" });

  const settings = loadSettings();
  const dvrUrl = settings.channelsDvrUrl.replace(/\/$/, "");
  if (!dvrUrl) {
    return res.status(400).json({ error: "Channels DVR URL is not configured in Settings." });
  }

  const baseUrl = getBaseUrl(req);
  const m3uUrl = `${baseUrl}/playlists/${playlist.id}/playlist.m3u`;
  const epgUrl = `${baseUrl}/playlists/${playlist.id}/guide.xml`;

  // Channels DVR requires a safe alphanumeric key for the source name
  const safeName = playlist.name.replace(/[^a-zA-Z0-9]/g, "");

  const payload = JSON.stringify({
    name: playlist.name,
    type: "m3u",
    source: "URL",
    url: m3uUrl,
    xmltv_url: epgUrl,
    xmltv_refresh: "3600",
    refresh: "24",
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const url = new URL(`${dvrUrl}/providers/m3u/sources/${safeName}`);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname,
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        rejectUnauthorized: false,
      };

      const makeRequest = url.protocol === "https:"
        ? https.request
        : require("http").request;

      const dvReq = makeRequest(options, (dvRes: import("http").IncomingMessage) => {
        const chunks: Buffer[] = [];
        dvRes.on("data", (chunk: Buffer) => chunks.push(chunk));
        dvRes.on("end", () => {
          const body = Buffer.concat(chunks).toString();
          if (dvRes.statusCode && dvRes.statusCode >= 200 && dvRes.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`DVR ${dvRes.statusCode}: ${body.slice(0, 300)}`));
          }
        });
      });

      dvReq.on("error", reject);
      dvReq.setTimeout(10000, () => {
        dvReq.destroy();
        reject(new Error("Request to Channels DVR timed out"));
      });
      dvReq.write(payload);
      dvReq.end();
    });

    log.info(`pushed playlist "${playlist.name}" to Channels DVR at ${dvrUrl}`);
    res.json({ ok: true, sourceName: playlist.name });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
      return res.status(502).json({ error: `Could not connect to Channels DVR at ${dvrUrl}` });
    }
    if (msg.includes("timed out")) {
      return res.status(504).json({ error: "Channels DVR timed out" });
    }
    return res.status(502).json({ error: msg });
  }
});

// POST /playlists/:id/duplicate — copies an existing playlist's definition
// into a new one ("<name> (copy)"), same channels and settings.
playlistsRouter.post("/playlists/:id/duplicate", (req, res) => {
  const source = getPlaylist(req.params.id);
  if (!source) return res.status(404).json({ error: "playlist not found" });

  const copy = createPlaylist(
    `${source.name} (copy)`,
    source.channels.map((c) => c.id),
    source.checkIntervalHours,
    source.channelNumberStart
  );
  regenerateEpgChannelsFile();

  log.info(`duplicated playlist ${source.id} as ${copy.id}`);

  const baseUrl = getBaseUrl(req);
  res.status(201).json({
    ...withLimitWarning(copy),
    m3uUrl: `${baseUrl}/playlists/${copy.id}/playlist.m3u`,
    epgUrl: `${baseUrl}/playlists/${copy.id}/guide.xml`,
  });
});
