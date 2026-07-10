import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import { Playlist, PlaylistWithChannels } from "../types";
import { getChannelsByIds } from "./catalogService";
import { createLogger } from "../logger";

const log = createLogger("playlistService");

const DEFAULT_CHECK_INTERVAL_HOURS = 6;
const DEFAULT_CHANNEL_NUMBER_START = 1;

export function createPlaylist(
  name: string,
  channelIds: string[],
  checkIntervalHours: number = DEFAULT_CHECK_INTERVAL_HOURS,
  channelNumberStart: number = DEFAULT_CHANNEL_NUMBER_START
): Playlist {
  const id = uuidv4();
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      "INSERT INTO playlists (id, name, createdAt, updatedAt, checkIntervalHours, channelNumberStart) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, name, now, now, checkIntervalHours, channelNumberStart);
    insertChannelLinks(id, channelIds);
  });
  tx();

  log.info(`created playlist "${name}"`, {
    id,
    channelCount: channelIds.length,
    checkIntervalHours,
    channelNumberStart,
  });
  return {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    checkIntervalHours,
    lastTestedAt: null,
    channelNumberStart,
    channelCount: channelIds.length,
  };
}

export function listPlaylists(): Playlist[] {
  return db
    .prepare(
      `SELECT p.id, p.name, p.createdAt, p.updatedAt, p.checkIntervalHours, p.lastTestedAt,
              p.channelNumberStart, COUNT(pc.channelId) AS channelCount
       FROM playlists p
       LEFT JOIN playlist_channels pc ON pc.playlistId = p.id
       GROUP BY p.id
       ORDER BY p.createdAt DESC`
    )
    .all() as Playlist[];
}

export function getPlaylist(id: string): PlaylistWithChannels | null {
  const playlist = db
    .prepare(
      "SELECT id, name, createdAt, updatedAt, checkIntervalHours, lastTestedAt, channelNumberStart FROM playlists WHERE id = ?"
    )
    .get(id) as Playlist | undefined;

  if (!playlist) return null;

  const channelIds = db
    .prepare(
      "SELECT channelId FROM playlist_channels WHERE playlistId = ? ORDER BY sortOrder ASC"
    )
    .all(id) as { channelId: string }[];

  const channels = getChannelsByIds(channelIds.map((c) => c.channelId));
  // preserve saved order
  const order = new Map(channelIds.map((c, i) => [c.channelId, i]));
  channels.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return { ...playlist, channels, channelCount: channels.length };
}

export function updatePlaylist(
  id: string,
  updates: {
    name?: string;
    channelIds?: string[];
    checkIntervalHours?: number;
    channelNumberStart?: number;
  }
): PlaylistWithChannels | null {
  const existing = db.prepare("SELECT id FROM playlists WHERE id = ?").get(id);
  if (!existing) return null;

  if (updates.checkIntervalHours !== undefined && updates.checkIntervalHours <= 0) {
    throw new Error("checkIntervalHours must be a positive number");
  }
  if (updates.channelNumberStart !== undefined && updates.channelNumberStart <= 0) {
    throw new Error("channelNumberStart must be a positive number");
  }

  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    const fields: string[] = ["updatedAt = ?"];
    const params: unknown[] = [now];

    if (updates.name !== undefined) {
      fields.push("name = ?");
      params.push(updates.name);
    }
    if (updates.checkIntervalHours !== undefined) {
      fields.push("checkIntervalHours = ?");
      params.push(updates.checkIntervalHours);
    }
    if (updates.channelNumberStart !== undefined) {
      fields.push("channelNumberStart = ?");
      params.push(updates.channelNumberStart);
    }

    params.push(id);
    db.prepare(`UPDATE playlists SET ${fields.join(", ")} WHERE id = ?`).run(...params);

    if (updates.channelIds !== undefined) {
      db.prepare("DELETE FROM playlist_channels WHERE playlistId = ?").run(id);
      insertChannelLinks(id, updates.channelIds);
    }
  });
  tx();

  log.info(`updated playlist ${id}`, {
    nameChanged: updates.name !== undefined,
    channelCount: updates.channelIds?.length,
    checkIntervalHours: updates.checkIntervalHours,
    channelNumberStart: updates.channelNumberStart,
  });

  return getPlaylist(id);
}

export function deletePlaylist(id: string): boolean {
  const result = db.prepare("DELETE FROM playlists WHERE id = ?").run(id);
  const deleted = result.changes > 0;
  if (deleted) log.info(`deleted playlist ${id}`);
  return deleted;
}

/** Returns the set of channel ids referenced by ANY playlist, for scoping EPG grabs. */
export function getAllReferencedChannelIds(): string[] {
  const rows = db
    .prepare("SELECT DISTINCT channelId FROM playlist_channels")
    .all() as { channelId: string }[];
  return rows.map((r) => r.channelId);
}

function insertChannelLinks(playlistId: string, channelIds: string[]): void {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO playlist_channels (playlistId, channelId, sortOrder) VALUES (?, ?, ?)"
  );
  channelIds.forEach((channelId, index) => {
    insert.run(playlistId, channelId, index);
  });
}
