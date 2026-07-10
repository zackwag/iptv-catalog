import express from "express";
import path from "path";
import fs from "fs";
import "./db"; // ensures schema is created on boot
import { channelsRouter } from "./routes/channels";
import { playlistsRouter } from "./routes/playlists";
import { publicPlaylistFilesRouter } from "./routes/publicPlaylistFiles";
import { settingsRouter } from "./routes/settings";
import { notificationsRouter } from "./routes/notifications";
import { backupRouter } from "./routes/backup";
import { streamProxyRouter } from "./routes/streamProxy";
import { refreshCatalog, getChannels } from "./services/catalogService";
import { startSchedulers, regenerateEpgChannelsFile } from "./services/epgSchedulerService";
import { startFeedTestScheduler } from "./services/feedTestScheduler";
import { getMeta } from "./db";
import { createLogger, activeLogLevel } from "./logger";
import { requestLogger } from "./middleware/requestLogger";
import { APP_VERSION } from "./version";

const log = createLogger("bootstrap");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(requestLogger);

app.get("/health", (_req, res) => res.json({ ok: true, version: APP_VERSION }));

// Management/CRUD API used by the web UI — mounted under /api so these
// paths (e.g. /api/playlists, /api/settings) never collide with the
// frontend's own client-side page routes of the same name (/playlists,
// /settings). This is the same split nginx used to enforce when the
// frontend was a separate container; now it's just Express route mounting.
app.use("/api", channelsRouter);
app.use("/api", playlistsRouter);
app.use("/api", settingsRouter);
app.use("/api", notificationsRouter);
app.use("/api", backupRouter);
app.use("/api", streamProxyRouter);

// The actual M3U/EPG file URLs handed to Channels DVR and VLC stay
// unprefixed at the root path — these are "product" URLs meant to be
// pasted into other software, not part of the JSON API surface.
app.use(publicPlaylistFilesRouter);

// Serve the built frontend (see frontend/ — copied into ./public at build
// time) and fall back to index.html for any unrecognized path so the SPA's
// own client-side routes (/catalog, /playlists, /settings, etc.) work on
// direct navigation and refresh, not just in-app navigation.
const PUBLIC_DIR = path.join(__dirname, "../public");
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });
} else {
  log.warn(`no frontend build found at ${PUBLIC_DIR} — API will work, but the web UI will not`);
}

async function bootstrap() {
  log.info(`iptv-catalog v${APP_VERSION} starting`);
  log.info(`log level set to "${activeLogLevel}" (override with LOG_LEVEL env var)`);

  // Populate the catalog on first boot if it's empty.
  const existing = getChannels({ limit: 1 });
  if (existing.length === 0) {
    log.info("catalog empty on boot, fetching from iptv-org...");
    try {
      const result = await refreshCatalog();
      log.info(`catalog loaded ${result.channelCount} channels`);
    } catch (err) {
      log.error("initial catalog fetch failed", { error: (err as Error).message });
      log.warn("/api/channels will return no results until /api/channels/refresh succeeds");
    }
  } else {
    log.info("using existing catalog data", { lastRefreshedAt: getMeta("catalogRefreshedAt") });
  }

  regenerateEpgChannelsFile();
  startSchedulers();
  startFeedTestScheduler();

  app.listen(PORT, () => {
    log.info(`iptv-catalog-api listening on port ${PORT}`);
  });
}

bootstrap();
