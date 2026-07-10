import { Router } from "express";
import fetch from "node-fetch";
import { createLogger } from "../logger";

const log = createLogger("streamProxy");

export const streamProxyRouter = Router();

// GET /api/stream-proxy?url=<encoded-stream-url>
// Proxies the stream through the server so the browser can play it without CORS issues.
// Only used for in-app preview — the M3U playlist uses original URLs directly.
streamProxyRouter.get("/stream-proxy", async (req, res) => {
  const { url } = req.query;

  if (typeof url !== "string" || !url.startsWith("http")) {
    return res.status(400).json({ error: "url is required and must be an http(s) URL" });
  }

  try {
    const upstream = await fetch(url, {
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

    // For HLS manifests, rewrite relative segment URLs to go through the proxy too
    if (contentType.includes("mpegurl") || url.includes(".m3u8")) {
      const text = await upstream.text();
      const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);
      const rewritten = text
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) return line;
          const absoluteUrl = trimmed.startsWith("http") ? trimmed : `${baseUrl}${trimmed}`;
          return `/api/stream-proxy?url=${encodeURIComponent(absoluteUrl)}`;
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
