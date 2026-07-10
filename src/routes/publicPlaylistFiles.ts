import { Router } from "express";
import { getPlaylist } from "../services/playlistService";
import { generateM3U } from "../services/m3uService";
import { readGeneratedGuide } from "../services/epgChannelsService";
import { getBaseUrl } from "./playlists";
import { db } from "../db";
import { createLogger } from "../logger";

const log = createLogger("publicPlaylistFiles");

export const publicPlaylistFilesRouter = Router();

// GET /playlists/:id/playlist.m3u — this is the URL you drop into Channels DVR
publicPlaylistFilesRouter.get("/playlists/:id/playlist.m3u", (req, res) => {
  const playlist = getPlaylist(req.params.id);
  if (!playlist) return res.status(404).send("playlist not found");

  const flaggedChannelIds = new Set(
    (
      db
        .prepare(
          "SELECT channelId FROM notifications WHERE playlistId = ? AND dismissed = 0 AND kind = 'failure'"
        )
        .all(playlist.id) as { channelId: string }[]
    ).map((r) => r.channelId)
  );

  const baseUrl = getBaseUrl(req);
  const m3u = generateM3U(
    playlist.channels,
    baseUrl,
    playlist.id,
    flaggedChannelIds,
    playlist.channelNumberStart
  );

  res.setHeader("Content-Type", "application/x-mpegurl; charset=utf-8");
  res.send(m3u);
});

// GET /playlists/:id/guide.xml — XMLTV guide data for this playlist
publicPlaylistFilesRouter.get("/playlists/:id/guide.xml", (req, res) => {
  const playlist = getPlaylist(req.params.id);
  if (!playlist) return res.status(404).send("playlist not found");

  const guide = readGeneratedGuide();
  if (!guide) {
    // Blocking rather than silently returning an empty/misleading guide:
    // the epg sidecar hasn't produced a guide.xml yet.
    log.warn(`guide.xml requested for playlist ${playlist.id} before epg sidecar has produced one`);
    return res
      .status(202)
      .send("EPG guide has not been generated yet. Check back after the next epg grab cycle.");
  }

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.send(guide);
});
