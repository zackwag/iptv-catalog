import { Router } from "express";
import fetch from "node-fetch";
import { getChannelVpnEndpoint, agentForProxyUrl } from "../services/vpnEndpointService";
import { createLogger } from "../logger";

const log = createLogger("streamProxy");

export const streamProxyRouter = Router();

// GET /api/stream-proxy?url=<encoded-stream-url>&channelId=<id>
// Proxies the stream through the server. Used both for in-app preview and, when
// a channel is routed through a VPN/geo-proxy endpoint, as the target URL emitted
// in M3U playlists for that channel. channelId is optional — omitted, the stream
// is fetched directly with no proxy.
streamProxyRouter.get("/stream-proxy", async (req, res) => {
  const { url, channelId } = req.query;

  if (typeof url !== "string" || !url.startsWith("http")) {
    return res.status(400).json({ error: "url is required and must be an http(s) URL" });
  }

  try {
    const endpoint = typeof channelId === "string" ? getChannelVpnEndpoint(channelId) : null;
    const agent = endpoint ? agentForProxyUrl(endpoint.proxyUrl) : undefined;
    const upstream = await fetch(url, {
      agent,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; IPTV-Catalog-Preview/1.0)",
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` });
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");

    // For HLS manifests, rewrite relative segment URLs to go through the proxy too,
    // carrying the channelId along so segments follow the same VPN route as the manifest.
    if (contentType.includes("mpegurl") || url.includes(".m3u8")) {
      const text = await upstream.text();
      const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);
      const channelIdSuffix =
        typeof channelId === "string" ? `&channelId=${encodeURIComponent(channelId)}` : "";
      const rewritten = text
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) return line;
          const absoluteUrl = trimmed.startsWith("http") ? trimmed : `${baseUrl}${trimmed}`;
          return `/api/stream-proxy?url=${encodeURIComponent(absoluteUrl)}${channelIdSuffix}`;
        })
        .join("\n");
      return res.send(rewritten);
    }

    upstream.body?.pipe(res);
  } catch (err) {
    log.error("stream proxy error", { url, error: (err as Error).message });
    res.status(502).json({ error: "Failed to fetch stream" });
  }
});
