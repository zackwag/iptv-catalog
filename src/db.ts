import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.DATA_DIR || "/app/data";
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, "catalog.db");
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("cache_size = -8000"); // 8 MB page cache
db.pragma("temp_store = MEMORY"); // temp tables/indexes in memory
db.pragma("mmap_size = 134217728"); // 128 MB memory-mapped I/O

db.exec(`
  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT,
    categories TEXT,
    languages TEXT,
    logo TEXT,
    isClosed INTEGER NOT NULL DEFAULT 0,
    isNsfw INTEGER NOT NULL DEFAULT 0,
    streamUrl TEXT,
    streamQuality TEXT,
    epgSite TEXT,
    epgSiteId TEXT,
    epgLang TEXT,
    updatedAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_channels_country ON channels(country);
  CREATE INDEX IF NOT EXISTS idx_channels_name ON channels(name);
  CREATE INDEX IF NOT EXISTS idx_channels_closed_name ON channels(isClosed, name);
  CREATE INDEX IF NOT EXISTS idx_channels_stream ON channels(streamUrl);
  CREATE INDEX IF NOT EXISTS idx_channels_epg ON channels(epgSite);
  CREATE INDEX IF NOT EXISTS idx_channels_categories ON channels(categories);

  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS playlist_channels (
    playlistId TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    channelId TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (playlistId, channelId)
  );

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    playlistId TEXT NOT NULL,
    playlistName TEXT NOT NULL,
    channelId TEXT NOT NULL,
    channelName TEXT NOT NULL,
    message TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    dismissed INTEGER NOT NULL DEFAULT 0,
    dismissedAt TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_dismissed ON notifications(dismissed);
  CREATE INDEX IF NOT EXISTS idx_notifications_playlist_channel ON notifications(playlistId, channelId);

  CREATE TABLE IF NOT EXISTS blocked_channels (
    channelId TEXT PRIMARY KEY,
    blockedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS channel_streams (
    channelId TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    quality TEXT,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (channelId, url)
  );

  CREATE INDEX IF NOT EXISTS idx_channel_streams_channel ON channel_streams(channelId, sortOrder);
`);

// --- FTS5 virtual table for fast channel name search ---
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS channels_fts USING fts5(
    name,
    content=channels,
    content_rowid=rowid,
    tokenize='unicode61'
  );
`);

// Populate FTS if empty (first boot or after catalog wipe)
const ftsCount = (db.prepare("SELECT COUNT(*) AS n FROM channels_fts").get() as { n: number }).n;
const channelCount = (db.prepare("SELECT COUNT(*) AS n FROM channels").get() as { n: number }).n;
if (ftsCount === 0 && channelCount > 0) {
  db.exec(`INSERT INTO channels_fts(channels_fts) VALUES('rebuild')`);
}

// --- migration: add feed-testing columns to playlists for dbs created before this feature ---
const playlistColumns = db.prepare("PRAGMA table_info(playlists)").all() as { name: string }[];
const existingColumnNames = new Set(playlistColumns.map((c) => c.name));

if (!existingColumnNames.has("checkIntervalHours")) {
  db.exec("ALTER TABLE playlists ADD COLUMN checkIntervalHours INTEGER NOT NULL DEFAULT 6");
}
if (!existingColumnNames.has("lastTestedAt")) {
  db.exec("ALTER TABLE playlists ADD COLUMN lastTestedAt TEXT");
}
if (!existingColumnNames.has("channelNumberStart")) {
  // Base number for the channel-number tag emitted in the M3U — lets
  // multiple playlists coexist as separate Channels DVR sources without
  // their channel numbers colliding.
  db.exec("ALTER TABLE playlists ADD COLUMN channelNumberStart INTEGER NOT NULL DEFAULT 1");
}
if (!existingColumnNames.has("autoAssignNumbers")) {
  // When 0, channel-number tags are omitted from the M3U entirely and
  // Channels DVR assigns numbers itself.
  db.exec("ALTER TABLE playlists ADD COLUMN autoAssignNumbers INTEGER NOT NULL DEFAULT 1");
}

// --- migration: add failure-streak tracking to notifications ---
const notificationColumns = db.prepare("PRAGMA table_info(notifications)").all() as {
  name: string;
}[];
const existingNotificationColumns = new Set(notificationColumns.map((c) => c.name));

if (!existingNotificationColumns.has("failureCount")) {
  db.exec("ALTER TABLE notifications ADD COLUMN failureCount INTEGER NOT NULL DEFAULT 1");
}
if (!existingNotificationColumns.has("lastFailedAt")) {
  db.exec("ALTER TABLE notifications ADD COLUMN lastFailedAt TEXT");
}
if (!existingNotificationColumns.has("kind")) {
  // 'failure' = channel is currently unreachable; 'removed' = it was auto-removed
  // from the playlist after too many consecutive failures.
  db.exec("ALTER TABLE notifications ADD COLUMN kind TEXT NOT NULL DEFAULT 'failure'");
}

export function getMeta(key: string): string | null {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    { value: string } | undefined;
  return row ? row.value : null;
}

export function setMeta(key: string, value: string): void {
  db.prepare(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}
