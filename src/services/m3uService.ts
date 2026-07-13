import { Channel, StreamProxyRule } from "../types";

/**
 * Renders a list of channels as an M3U playlist compatible with
 * Channels DVR's Custom Channel (M3U) source type.
 *
 * @param flaggedChannelIds channel ids with an active (undismissed) failure
 *   notification — their display name gets a warning prefix so it's visible
 *   right in the Channels DVR guide, without needing a separate slate stream.
 * @param channelNumberStart base number for the channel-number tag. Has no
 *   effect when autoAssignNumbers is false.
 * @param autoAssignNumbers when false, channel-number tags are omitted and
 *   Channels DVR assigns numbers itself.
 */
export function generateM3U(
  channels: Channel[],
  baseUrl: string,
  playlistId: string,
  flaggedChannelIds: Set<string> = new Set(),
  channelNumberStart: number = 1,
  autoAssignNumbers: boolean = true,
  proxyRules: StreamProxyRule[] = []
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
      autoAssignNumbers ? `channel-number="${channelNumber}"` : null,
      ch.logo ? `tvg-logo="${escapeAttr(ch.logo)}"` : null,
      ch.country ? `tvg-country="${escapeAttr(ch.country)}"` : null,
      `group-title="${escapeAttr(group)}"`,
    ]
      .filter(Boolean)
      .join(" ");

    const displayName = flaggedChannelIds.has(ch.id) ? `⚠ ${ch.name}` : ch.name;

    const matchingRule = proxyRules.find((r) => ch.streamUrl!.includes(r.pattern));
    const streamUrl = matchingRule
      ? `${baseUrl}/api/stream-proxy?url=${encodeURIComponent(ch.streamUrl!)}`
      : ch.streamUrl;

    lines.push(`#EXTINF:-1 ${attrs},${displayName}`);
    lines.push(streamUrl!);

    channelNumber++;
  }

  return lines.join("\n") + "\n";
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;");
}
