import { create } from "xmlbuilder2";
import fs from "fs";
import path from "path";
import { Channel } from "../types";

const EPG_SHARED_DIR = process.env.EPG_SHARED_DIR || "/app/epg-shared";

/**
 * Writes a *.channels.xml file in the format expected by the official
 * iptv-org/epg grabber (ghcr.io/iptv-org/epg), scoped to only the channels
 * that have a known guide source. This file is mounted into the epg sidecar
 * container, which uses it to know which sites/channels to scrape.
 *
 * See: https://github.com/iptv-org/epg#custom-channel-list
 */
export function writeEpgChannelsFile(channels: Channel[]): { path: string; count: number } {
  const withGuides = channels.filter((c) => c.epgSite && c.epgSiteId);

  const doc = create({ version: "1.0", encoding: "UTF-8" }).ele("channels");

  for (const ch of withGuides) {
    doc
      .ele("channel", {
        site: ch.epgSite as string,
        lang: ch.epgLang || "en",
        xmltv_id: ch.id,
        site_id: ch.epgSiteId as string,
      })
      .txt(ch.name)
      .up();
  }

  const xml = doc.end({ prettyPrint: true });

  if (!fs.existsSync(EPG_SHARED_DIR)) {
    fs.mkdirSync(EPG_SHARED_DIR, { recursive: true });
  }

  const filePath = path.join(EPG_SHARED_DIR, "channels.xml");
  fs.writeFileSync(filePath, xml, "utf-8");

  return { path: filePath, count: withGuides.length };
}

/** Reads the guide.xml produced by the epg sidecar, if it has run at least once. */
export function readGeneratedGuide(): string | null {
  const guidePath = path.join(EPG_SHARED_DIR, "guide.xml");
  if (!fs.existsSync(guidePath)) return null;
  return fs.readFileSync(guidePath, "utf-8");
}

/**
 * Returns when the epg sidecar last (re)wrote guide.xml, or null if it
 * hasn't produced one yet. This is our only real visibility into whether
 * that separate container is actually succeeding on its own schedule.
 */
export function getGuideLastGeneratedAt(): string | null {
  const guidePath = path.join(EPG_SHARED_DIR, "guide.xml");
  if (!fs.existsSync(guidePath)) return null;
  return fs.statSync(guidePath).mtime.toISOString();
}
