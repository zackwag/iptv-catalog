import { Router } from "express";
import { getPlaylist, createPlaylist, listPlaylists } from "../services/playlistService";
import { loadSettings, saveSettings, Settings } from "../services/settingsService";
import { regenerateEpgChannelsFile } from "../services/epgSchedulerService";
import { createLogger } from "../logger";

const log = createLogger("backupRoute");

export const backupRouter = Router();

const BUNDLE_VERSION = 1;

// publicBaseUrl is inherently tied to *this* machine's address — exporting
// and re-importing it onto a different host would silently point playlist
// URLs at the wrong place, so it's deliberately excluded from backups.
type ExportableSettings = Omit<Settings, "publicBaseUrl">;

interface PlaylistDefinition {
  name: string;
  channelIds: string[];
  checkIntervalHours: number;
  channelNumberStart: number;
  autoAssignNumbers?: number;
}

interface BackupBundle {
  iptvCatalogBackup: number;
  exportedAt: string;
  playlists: PlaylistDefinition[];
  settings?: ExportableSettings;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && value > 0;
}

function isValidPlaylistDefinition(value: unknown): value is PlaylistDefinition {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    v.name.trim() !== "" &&
    Array.isArray(v.channelIds) &&
    v.channelIds.every((c) => typeof c === "string")
  );
}

// GET /backup/playlists — lightweight list for the export-picker UI (id, name, channel count)
backupRouter.get("/backup/playlists", (_req, res) => {
  const playlists = listPlaylists().map((p) => ({
    id: p.id,
    name: p.name,
    channelCount: p.channelCount,
  }));
  res.json({ playlists });
});

// POST /backup/export  { playlistIds: string[], includeSettings?: boolean }
backupRouter.post("/backup/export", (req, res) => {
  const { playlistIds, includeSettings } = req.body ?? {};

  if (!Array.isArray(playlistIds) || playlistIds.some((id) => typeof id !== "string")) {
    return res.status(400).json({ error: "playlistIds must be an array of strings" });
  }
  if (playlistIds.length === 0 && !includeSettings) {
    return res.status(400).json({ error: "select at least one playlist or include settings" });
  }

  const playlists: PlaylistDefinition[] = [];
  for (const id of playlistIds) {
    const playlist = getPlaylist(id);
    if (!playlist) {
      return res.status(404).json({ error: `playlist ${id} not found` });
    }
    playlists.push({
      name: playlist.name,
      channelIds: playlist.channels.map((c) => c.id),
      checkIntervalHours: playlist.checkIntervalHours,
      channelNumberStart: playlist.channelNumberStart,
      autoAssignNumbers: playlist.autoAssignNumbers,
    });
  }

  const bundle: BackupBundle = {
    iptvCatalogBackup: BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    playlists,
  };

  if (includeSettings) {
    const { publicBaseUrl: _omit, ...exportable } = loadSettings();
    bundle.settings = exportable;
  }

  log.info(
    `exported backup bundle: ${playlists.length} playlist(s), settings=${!!includeSettings}`
  );

  res.setHeader("Content-Disposition", `attachment; filename="iptv-catalog-backup.json"`);
  res.json(bundle);
});

// POST /backup/import — accepts either a bundle ({ playlists: [...], settings?: {...} })
// or a single legacy playlist-export object ({ name, channelIds, ... }), for files
// downloaded via the older per-playlist "Backup (.json)" button.
backupRouter.post("/backup/import", (req, res) => {
  const body = req.body ?? {};

  let playlistDefs: PlaylistDefinition[];
  let settingsToApply: Partial<Settings> | undefined;

  if (Array.isArray(body.playlists)) {
    // Bundle format
    if (!body.playlists.every(isValidPlaylistDefinition)) {
      return res.status(400).json({ error: "one or more playlist definitions are invalid" });
    }
    playlistDefs = body.playlists;

    if (body.settings !== undefined) {
      if (typeof body.settings !== "object" || body.settings === null) {
        return res.status(400).json({ error: "settings must be an object" });
      }
      // Strip publicBaseUrl even if present in a hand-edited file — same
      // host-specific exclusion policy as export, enforced on the way in too.
      const { publicBaseUrl: _omit, ...rest } = body.settings;
      settingsToApply = rest;
    }
  } else if (isValidPlaylistDefinition(body)) {
    // Legacy single-playlist format
    playlistDefs = [body];
  } else {
    return res.status(400).json({ error: "unrecognized import format" });
  }

  for (const def of playlistDefs) {
    if (def.checkIntervalHours !== undefined && !isPositiveNumber(def.checkIntervalHours)) {
      return res.status(400).json({ error: `invalid checkIntervalHours for "${def.name}"` });
    }
    if (def.channelNumberStart !== undefined && !isPositiveNumber(def.channelNumberStart)) {
      return res.status(400).json({ error: `invalid channelNumberStart for "${def.name}"` });
    }
  }

  try {
    let playlistsImported = 0;
    for (const def of playlistDefs) {
      createPlaylist(
        def.name,
        def.channelIds,
        def.checkIntervalHours,
        def.channelNumberStart,
        def.autoAssignNumbers
      );
      playlistsImported++;
    }
    if (playlistsImported > 0) {
      regenerateEpgChannelsFile();
    }

    let settingsImported = false;
    if (settingsToApply) {
      saveSettings(settingsToApply); // validates each field itself, throws on bad input
      settingsImported = true;
    }

    log.info(`imported backup: ${playlistsImported} playlist(s), settings=${settingsImported}`);
    res.status(201).json({ ok: true, playlistsImported, settingsImported });
  } catch (err) {
    log.error("backup import failed", { error: (err as Error).message });
    res.status(400).json({ ok: false, error: (err as Error).message });
  }
});
