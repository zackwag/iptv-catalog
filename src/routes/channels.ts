import { Router } from "express";
import {
  getChannels,
  getChannelsCount,
  getDistinctCountries,
  getDistinctCategories,
  refreshCatalog,
  purgeBlocklistedFromPlaylists,
} from "../services/catalogService";
import { regenerateEpgChannelsFile } from "../services/epgSchedulerService";
import { getMeta, db } from "../db";
import { createLogger } from "../logger";

const log = createLogger("channelsRoute");

export const channelsRouter = Router();

// GET /channels?search=&country=&category=&hasStream=true&hasEpg=true&limit=&offset=
channelsRouter.get("/channels", (req, res) => {
  const { search, country, category, hasStream, hasEpg, limit, offset } = req.query;

  const filters = {
    search: typeof search === "string" ? search : undefined,
    country: typeof country === "string" ? country : undefined,
    category: typeof category === "string" ? category : undefined,
    hasStream: hasStream === "true",
    hasEpg: hasEpg === "true",
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
  };

  const channels = getChannels(filters);
  const total = getChannelsCount(filters);

  res.json({ channels, count: channels.length, total });
});

// GET /channels/countries?search=&category=&hasStream=true&hasEpg=true
channelsRouter.get("/channels/countries", (req, res) => {
  const { search, category, hasStream, hasEpg } = req.query;
  res.json({
    countries: getDistinctCountries({
      search: typeof search === "string" ? search : undefined,
      category: typeof category === "string" ? category : undefined,
      hasStream: hasStream === "true",
      hasEpg: hasEpg === "true",
    }),
  });
});

// GET /channels/categories?search=&country=&hasStream=true&hasEpg=true
channelsRouter.get("/channels/categories", (req, res) => {
  const { search, country, hasStream, hasEpg } = req.query;
  res.json({
    categories: getDistinctCategories({
      search: typeof search === "string" ? search : undefined,
      country: typeof country === "string" ? country : undefined,
      hasStream: hasStream === "true",
      hasEpg: hasEpg === "true",
    }),
  });
});

// GET /channels/status
channelsRouter.get("/channels/status", (_req, res) => {
  res.json({ catalogRefreshedAt: getMeta("catalogRefreshedAt") });
});

// GET /channels/playlistmembers — returns the set of channel IDs present in any playlist
channelsRouter.get("/channels/playlistmembers", (_req, res) => {
  const rows = db.prepare("SELECT DISTINCT channelId FROM playlist_channels").all() as {
    channelId: string;
  }[];
  res.json({ channelIds: rows.map((r) => r.channelId) });
});

// POST /channels/:id/block — block a channel and remove it from all playlists
channelsRouter.post("/channels/:id/block", (req, res) => {
  const { id } = req.params;
  const channel = db.prepare("SELECT id FROM channels WHERE id = ?").get(id);
  if (!channel) return res.status(404).json({ error: "channel not found" });

  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare("INSERT OR IGNORE INTO blocked_channels (channelId, blockedAt) VALUES (?, ?)").run(
      id,
      now
    );
    db.prepare("DELETE FROM playlist_channels WHERE channelId = ?").run(id);
  })();

  regenerateEpgChannelsFile();
  log.info(`blocked channel ${id}`);
  res.json({ ok: true });
});

// GET /channels/:id/playlists — which playlists contain this channel
channelsRouter.get("/channels/:id/playlists", (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT p.id, p.name FROM playlists p
    JOIN playlist_channels pc ON pc.playlistId = p.id
    WHERE pc.channelId = ?
    ORDER BY p.name ASC
  `
    )
    .all(req.params.id) as { id: string; name: string }[];
  res.json({ playlists: rows });
});

// GET /channels/:id/streams — all known stream URLs for a channel
channelsRouter.get("/channels/:id/streams", (req, res) => {
  const streams = db
    .prepare(
      "SELECT url, quality, sortOrder FROM channel_streams WHERE channelId = ? ORDER BY sortOrder ASC"
    )
    .all(req.params.id) as { url: string; quality: string | null; sortOrder: number }[];
  res.json({ streams });
});

// GET /channels/blocked — list all individually blocked channels
channelsRouter.get("/channels/blocked", (_req, res) => {
  const rows = db
    .prepare(
      `
    SELECT bc.channelId, bc.blockedAt, c.name
    FROM blocked_channels bc
    LEFT JOIN channels c ON c.id = bc.channelId
    ORDER BY bc.blockedAt DESC
  `
    )
    .all() as { channelId: string; blockedAt: string; name: string }[];
  res.json({ channels: rows });
});

// DELETE /channels/:id/block — unblock a channel
channelsRouter.delete("/channels/:id/block", (req, res) => {
  const result = db.prepare("DELETE FROM blocked_channels WHERE channelId = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "channel not in blocklist" });
  log.info(`unblocked channel ${req.params.id}`);
  res.json({ ok: true });
});

// POST /channels/refresh — manually trigger a re-pull from iptv-org
channelsRouter.post("/channels/refresh", async (_req, res) => {
  log.info("manual catalog refresh triggered");
  try {
    const result = await refreshCatalog();
    log.info(`manual refresh loaded ${result.channelCount} channels`);
    const purged = purgeBlocklistedFromPlaylists();
    if (purged > 0) regenerateEpgChannelsFile();
    res.json({ ok: true, ...result });
  } catch (err) {
    log.error("manual catalog refresh failed", { error: (err as Error).message });
    res.status(502).json({ ok: false, error: (err as Error).message });
  }
});
