import fetch from "node-fetch";
import { db, setMeta } from "../db";
import { ChannelFilters, Channel, RawChannel, RawStream, RawGuide } from "../types";
import { loadSettings } from "./settingsService";
import { createLogger } from "../logger";

const log = createLogger("catalogService");

const API_BASE = process.env.IPTV_ORG_API_BASE || "https://iptv-org.github.io/api";

const CHANNELS_URL = `${API_BASE}/channels.json`;
const STREAMS_URL = `${API_BASE}/streams.json`;
const GUIDES_URL = `${API_BASE}/guides.json`;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

/**
 * Downloads channels.json, streams.json, and guides.json from iptv-org/api,
 * joins them on channel id, and upserts the flattened result into the
 * local `channels` table. Streams and guides are 1:many per channel in the
 * source data (multiple feeds/sites); we keep the first match for simplicity,
 * which covers the vast majority of channels that only have a single feed.
 */
export async function refreshCatalog(): Promise<{ channelCount: number }> {
  log.debug("fetching channels.json, streams.json, guides.json from iptv-org/api");
  const [rawChannels, rawStreams, rawGuides] = await Promise.all([
    fetchJson<RawChannel[]>(CHANNELS_URL),
    fetchJson<RawStream[]>(STREAMS_URL),
    fetchJson<RawGuide[]>(GUIDES_URL),
  ]);
  log.debug(
    `fetched ${rawChannels.length} channels, ${rawStreams.length} streams, ${rawGuides.length} guide entries`
  );

  const streamByChannel = new Map<string, RawStream>();
  const allStreamsByChannel = new Map<string, RawStream[]>();
  for (const s of rawStreams) {
    if (!s.channel) continue;
    if (!streamByChannel.has(s.channel)) streamByChannel.set(s.channel, s);
    const list = allStreamsByChannel.get(s.channel) ?? [];
    list.push(s);
    allStreamsByChannel.set(s.channel, list);
  }

  const guideByChannel = new Map<string, RawGuide>();
  for (const g of rawGuides) {
    if (g.channel && !guideByChannel.has(g.channel)) {
      guideByChannel.set(g.channel, g);
    }
  }

  const now = new Date().toISOString();

  const upsert = db.prepare(`
    INSERT INTO channels (
      id, name, country, categories, languages, logo, isClosed, isNsfw,
      streamUrl, streamQuality, epgSite, epgSiteId, epgLang, updatedAt
    ) VALUES (
      @id, @name, @country, @categories, @languages, @logo, @isClosed, @isNsfw,
      @streamUrl, @streamQuality, @epgSite, @epgSiteId, @epgLang, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      country = excluded.country,
      categories = excluded.categories,
      languages = excluded.languages,
      logo = excluded.logo,
      isClosed = excluded.isClosed,
      isNsfw = excluded.isNsfw,
      streamUrl = excluded.streamUrl,
      streamQuality = excluded.streamQuality,
      epgSite = excluded.epgSite,
      epgSiteId = excluded.epgSiteId,
      epgLang = excluded.epgLang,
      updatedAt = excluded.updatedAt
  `);

  const upsertStream = db.prepare(`
    INSERT INTO channel_streams (channelId, url, quality, sortOrder)
    VALUES (@channelId, @url, @quality, @sortOrder)
    ON CONFLICT(channelId, url) DO UPDATE SET quality = excluded.quality, sortOrder = excluded.sortOrder
  `);

  const insertMany = db.transaction((channels: RawChannel[]) => {
    for (const c of channels) {
      const stream = streamByChannel.get(c.id);
      const guide = guideByChannel.get(c.id);
      upsert.run({
        id: c.id,
        name: c.name,
        country: c.country,
        categories: (c.categories || []).join(","),
        languages: "",
        logo: c.logo,
        isClosed: c.closed ? 1 : 0,
        isNsfw: c.is_nsfw ? 1 : 0,
        streamUrl: stream ? stream.url : null,
        streamQuality: stream ? stream.quality : null,
        epgSite: guide ? guide.site : null,
        epgSiteId: guide ? guide.site_id : null,
        epgLang: guide ? guide.lang : null,
        updatedAt: now,
      });

      // Store all fallback streams
      const streams = allStreamsByChannel.get(c.id) ?? [];
      for (let i = 0; i < streams.length; i++) {
        upsertStream.run({ channelId: c.id, url: streams[i].url, quality: streams[i].quality ?? null, sortOrder: i });
      }
    }
  });

  insertMany(rawChannels);

  // Rebuild FTS index after full catalog refresh
  db.exec(`INSERT INTO channels_fts(channels_fts) VALUES('rebuild')`);

  setMeta("catalogRefreshedAt", now);
  log.debug(`upserted ${rawChannels.length} channels into local db`);

  // Update query planner statistics after a large data load
  db.exec("ANALYZE");

  return { channelCount: rawChannels.length };
}

function buildWhereClause(filters: ChannelFilters): { where: string; params: Record<string, unknown> } {
  const clauses: string[] = ["isClosed = 0"];
  const params: Record<string, unknown> = {};

  if (filters.search) {
    clauses.push("rowid IN (SELECT rowid FROM channels_fts WHERE channels_fts MATCH @search)");
    params.search = `${filters.search.replace(/[^a-zA-Z0-9 ]/g, " ")}*`;
  }
  if (filters.country) {
    clauses.push("country = @country");
    params.country = filters.country;
  }
  if (filters.category === "__none__") {
    clauses.push("(categories IS NULL OR categories = '')");
  } else if (filters.category) {
    clauses.push("(',' || categories || ',') LIKE @category");
    params.category = `%,${filters.category},%`;
  }
  if (filters.hasStream) {
    clauses.push("streamUrl IS NOT NULL");
  }
  if (filters.hasEpg) {
    clauses.push("epgSite IS NOT NULL");
  }

  // Apply blocklists from settings
  const settings = loadSettings();

  const blockedCountries = settings.blockCountries
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  for (let i = 0; i < blockedCountries.length; i++) {
    clauses.push(`(country IS NULL OR LOWER(country) != @blockedCountry${i})`);
    params[`blockedCountry${i}`] = blockedCountries[i];
  }

  const blockedCategories = settings.blockCategories
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  for (let i = 0; i < blockedCategories.length; i++) {
    clauses.push(`(categories IS NULL OR (',' || LOWER(categories) || ',') NOT LIKE @blockedCat${i})`);
    params[`blockedCat${i}`] = `%,${blockedCategories[i]},%`;
  }

  const blockedDomains = settings.blockStreamDomains
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  for (let i = 0; i < blockedDomains.length; i++) {
    clauses.push(`(streamUrl IS NULL OR LOWER(streamUrl) NOT LIKE @blockedDomain${i})`);
    params[`blockedDomain${i}`] = `%${blockedDomains[i]}%`;
  }

  if (settings.blockNsfw) {
    clauses.push("isNsfw = 0");
  }

  clauses.push("id NOT IN (SELECT channelId FROM blocked_channels)");

  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

export function getChannels(filters: ChannelFilters): Channel[] {
  const { where, params } = buildWhereClause(filters);
  const limit = filters.limit ?? 200;
  const offset = filters.offset ?? 0;

  const rows = db
    .prepare(`SELECT * FROM channels ${where} ORDER BY name ASC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset }) as Channel[];

  return rows;
}

/** Total number of channels matching the filters, ignoring limit/offset — for pagination. */
export function getChannelsCount(filters: ChannelFilters): number {
  const { where, params } = buildWhereClause(filters);
  const row = db.prepare(`SELECT COUNT(*) AS total FROM channels ${where}`).get(params) as {
    total: number;
  };
  return row.total;
}

export function getChannelsByIds(ids: string[]): Channel[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  return db
    .prepare(`SELECT * FROM channels WHERE id IN (${placeholders}) AND id NOT IN (SELECT channelId FROM blocked_channels)`)
    .all(...ids) as Channel[];
}

/**
 * Removes from every playlist any channel that is currently blocked by the
 * active blocklists (countries, categories, stream domains, or the
 * blocked_channels table). Called after blocklist settings are saved so
 * playlists stay consistent without requiring a manual per-channel block.
 */
export function purgeBlocklistedFromPlaylists(): number {
  const settings = loadSettings();

  const deletes: number[] = [];

  // blocked_channels table
  const r0 = db.prepare(`
    DELETE FROM playlist_channels WHERE channelId IN (
      SELECT channelId FROM blocked_channels
    )
  `).run();
  deletes.push(r0.changes);

  // NSFW
  if (settings.blockNsfw) {
    const rNsfw = db.prepare(`
      DELETE FROM playlist_channels WHERE channelId IN (
        SELECT id FROM channels WHERE isNsfw = 1
      )
    `).run();
    deletes.push(rNsfw.changes);
  }

  // blocked countries
  const blockedCountries = settings.blockCountries
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  for (const country of blockedCountries) {
    const r = db.prepare(`
      DELETE FROM playlist_channels WHERE channelId IN (
        SELECT id FROM channels WHERE LOWER(country) = ?
      )
    `).run(country);
    deletes.push(r.changes);
  }

  // blocked categories
  const blockedCategories = settings.blockCategories
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  for (const cat of blockedCategories) {
    const r = db.prepare(`
      DELETE FROM playlist_channels WHERE channelId IN (
        SELECT id FROM channels WHERE (',' || LOWER(categories) || ',') LIKE ?
      )
    `).run(`%,${cat},%`);
    deletes.push(r.changes);
  }

  // blocked stream domains
  const blockedDomains = settings.blockStreamDomains
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  for (const domain of blockedDomains) {
    const r = db.prepare(`
      DELETE FROM playlist_channels WHERE channelId IN (
        SELECT id FROM channels WHERE streamUrl IS NOT NULL AND LOWER(streamUrl) LIKE ?
      )
    `).run(`%${domain}%`);
    deletes.push(r.changes);
  }

  const total = deletes.reduce((a, b) => a + b, 0);
  if (total > 0) log.info(`purged ${total} blocked channel(s) from playlists`);
  return total;
}

/** Returns all known stream URLs for a channel in sort order, excluding the primary. */
export function getFallbackStreams(channelId: string): { url: string; quality: string | null }[] {
  const primary = (db.prepare("SELECT streamUrl FROM channels WHERE id = ?").get(channelId) as { streamUrl: string | null } | undefined)?.streamUrl;
  return db.prepare("SELECT url, quality FROM channel_streams WHERE channelId = ? ORDER BY sortOrder ASC")
    .all(channelId) as { url: string; quality: string | null }[];
}

/** Promotes a fallback URL to be the primary stream for a channel. */
export function promoteStream(channelId: string, url: string): void {
  db.prepare("UPDATE channels SET streamUrl = ?, streamQuality = (SELECT quality FROM channel_streams WHERE channelId = ? AND url = ?) WHERE id = ?")
    .run(url, channelId, url, channelId);
}

export function getDistinctCountries(filters: Omit<ChannelFilters, "country"> = {}): string[] {
  const { where, params } = buildWhereClause({ ...filters, country: undefined });
  const extraWhere = where
    ? `${where} AND country IS NOT NULL`
    : "WHERE country IS NOT NULL";
  const rows = db
    .prepare(`SELECT DISTINCT country FROM channels ${extraWhere} ORDER BY country`)
    .all(params) as { country: string }[];
  return rows.map((r) => r.country);
}

/** All distinct category slugs actually present across the catalog, for a filter dropdown. */
export function getDistinctCategories(filters: Omit<ChannelFilters, "category"> = {}): string[] {
  const { where, params } = buildWhereClause({ ...filters, category: undefined });

  const withCatWhere = where
    ? `${where} AND categories IS NOT NULL AND categories != ''`
    : "WHERE categories IS NOT NULL AND categories != ''";
  const rows = db
    .prepare(`SELECT DISTINCT categories FROM channels ${withCatWhere}`)
    .all(params) as { categories: string }[];

  const set = new Set<string>();
  for (const row of rows) {
    for (const cat of row.categories.split(",")) {
      const trimmed = cat.trim();
      if (trimmed) set.add(trimmed);
    }
  }

  const noCatWhere = where
    ? `${where} AND (categories IS NULL OR categories = '')`
    : "WHERE (categories IS NULL OR categories = '')";
  const uncategorized = db
    .prepare(`SELECT 1 FROM channels ${noCatWhere} LIMIT 1`)
    .get(params);
  if (uncategorized) set.add("__none__");

  return Array.from(set).sort();
}
