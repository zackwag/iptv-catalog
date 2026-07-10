import { Channel } from "../types";

/**
 * Renders a list of channels as an M3U playlist compatible with
 * Channels DVR's Custom Channel (M3U) source type.
 *
 * @param flaggedChannelIds channel ids with an active (undismissed) failure
 *   notification — their display name gets a warning prefix so it's visible
 *   right in the Channels DVR guide, without needing a separate slate stream.
 * @param channelNumberStart base number for the channel-number tag, so
 *   multiple playlists added as separate Channels DVR sources don't collide
 *   on the same numbers. Numbers are assigned sequentially in the playlist's
 *   stored order, so they stay stable across regenerations rather than
 *   whatever Channels DVR would auto-assign on its own.
 */
export function generateM3U(
  channels: Channel[],
  baseUrl: string,
  playlistId: string,
  flaggedChannelIds: Set<string> = new Set(),
  channelNumberStart: number = 1
): string {
  const lines: string[] = ["#EXTM3U"];

  // Point Channels DVR at our own EPG endpoint for this playlist so it
  // picks up guide data automatically when adding the source.
  lines[0] += ` x-tvg-url="${baseUrl}/playlists/${playlistId}/guide.xml"`;

  let channelNumber = channelNumberStart;

  for (const ch of channels) {
    if (!ch.streamUrl) continue;

    const group = (ch.categories || "").split(",")[0] || "General";
    const attrs = [
      `tvg-id="${escapeAttr(ch.id)}"`,
      `channel-number="${channelNumber}"`,
      ch.logo ? `tvg-logo="${escapeAttr(ch.logo)}"` : null,
      ch.country ? `tvg-country="${escapeAttr(ch.country)}"` : null,
      `group-title="${escapeAttr(group)}"`,
    ]
      .filter(Boolean)
      .join(" ");

    const displayName = flaggedChannelIds.has(ch.id) ? `⚠ ${ch.name}` : ch.name;

    lines.push(`#EXTINF:-1 ${attrs},${displayName}`);
    lines.push(ch.streamUrl);

    channelNumber++;
  }

  return lines.join("\n") + "\n";
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;");
}
