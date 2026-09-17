import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { Readable } from "node:stream";
import { db } from "../db";

vi.mock("../utils/fetch", () => ({
  fetch: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockedResponse = any;

import { fetch } from "../utils/fetch";
import { streamProxyRouter } from "./streamProxy";
import { assignChannelVpn, createVpnEndpoint } from "../services/vpnEndpointService";

const app = express();
app.use("/api", streamProxyRouter);

const mockedFetch = vi.mocked(fetch);

function textResponse(body: string, contentType = "text/plain"): MockedResponse {
  return {
    ok: true,
    status: 200,
    headers: { get: () => contentType },
    text: async () => body,
  };
}

function streamResponse(chunks: string[], contentType = "video/mp2t"): MockedResponse {
  return {
    ok: true,
    status: 200,
    headers: { get: () => contentType },
    body: Readable.from(chunks.map((c) => Buffer.from(c))),
  };
}

beforeEach(() => {
  mockedFetch.mockReset();
});

afterEach(() => {
  db.exec("DELETE FROM channel_vpn_assignments; DELETE FROM vpn_endpoints; DELETE FROM channels;");
});

describe("GET /api/stream-proxy", () => {
  it("400s when url is missing", async () => {
    const res = await request(app).get("/api/stream-proxy");
    expect(res.status).toBe(400);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("400s for a non-http url", async () => {
    const res = await request(app).get("/api/stream-proxy?url=ftp://example.com/x");
    expect(res.status).toBe(400);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("streams a plain response body through with no proxy agent when no channelId is given", async () => {
    mockedFetch.mockResolvedValue(streamResponse(["hello ", "world"]));

    const res = await request(app).get(
      "/api/stream-proxy?url=" + encodeURIComponent("https://example.com/video.ts")
    );

    expect(res.status).toBe(200);
    // superagent only populates res.text for content types it recognizes as
    // text; video/mp2t isn't one, so the raw bytes land in res.body instead.
    expect(Buffer.from(res.body).toString()).toBe("hello world");
    expect(mockedFetch).toHaveBeenCalledWith(
      "https://example.com/video.ts",
      expect.objectContaining({ agent: undefined })
    );
  });

  it("rewrites relative segment URLs in an m3u8 manifest to go back through the proxy", async () => {
    const manifest = "#EXTM3U\nsegment1.ts\nsegment2.ts\n";
    mockedFetch.mockResolvedValue(textResponse(manifest, "application/vnd.apple.mpegurl"));

    const target = "https://example.com/path/playlist.m3u8";
    const res = await request(app).get("/api/stream-proxy?url=" + encodeURIComponent(target));

    expect(res.status).toBe(200);
    const expectedSegment = encodeURIComponent("https://example.com/path/segment1.ts");
    expect(res.text).toContain(`/api/stream-proxy?url=${expectedSegment}`);
    // no channelId was passed in, so the rewritten segment URLs shouldn't carry one either
    expect(res.text).not.toContain("channelId=");
  });

  it("leaves absolute segment URLs and comment lines alone when rewriting a manifest", async () => {
    const manifest = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\nhttps://cdn.example.com/abs.ts\n";
    mockedFetch.mockResolvedValue(textResponse(manifest, "application/vnd.apple.mpegurl"));

    const res = await request(app).get(
      "/api/stream-proxy?url=" + encodeURIComponent("https://example.com/path/playlist.m3u8")
    );

    expect(res.text).toContain("#EXT-X-STREAM-INF:BANDWIDTH=1000");
    expect(res.text).toContain(
      `/api/stream-proxy?url=${encodeURIComponent("https://cdn.example.com/abs.ts")}`
    );
  });

  it("carries channelId along into rewritten manifest segment URLs", async () => {
    mockedFetch.mockResolvedValue(
      textResponse("#EXTM3U\nsegment1.ts\n", "application/vnd.apple.mpegurl")
    );

    const now = new Date().toISOString();
    db.prepare("INSERT INTO channels (id, name, updatedAt) VALUES (?, ?, ?)").run(
      "chan-1",
      "Test Channel",
      now
    );

    const target = "https://example.com/path/playlist.m3u8";
    const res = await request(app).get(
      `/api/stream-proxy?url=${encodeURIComponent(target)}&channelId=chan-1`
    );

    expect(res.status).toBe(200);
    expect(res.text).toContain("channelId=chan-1");
  });

  it("routes the upstream fetch through the channel's configured VPN proxy agent", async () => {
    mockedFetch.mockResolvedValue(streamResponse(["data"]));

    const now = new Date().toISOString();
    db.prepare("INSERT INTO channels (id, name, updatedAt) VALUES (?, ?, ?)").run(
      "chan-2",
      "Test Channel 2",
      now
    );
    const endpoint = createVpnEndpoint({
      name: "vpn-1",
      country: "US",
      proxyUrl: "http://proxy.example.com:8080",
    });
    assignChannelVpn("chan-2", endpoint.id);

    await request(app).get(
      `/api/stream-proxy?url=${encodeURIComponent("https://example.com/video.ts")}&channelId=chan-2`
    );

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockedFetch.mock.calls[0];
    expect(init.agent).toBeDefined();
    expect(init.agent.constructor.name).toBe("HttpsProxyAgent");
  });

  it("passes through a non-ok upstream status", async () => {
    mockedFetch.mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => "text/plain" },
    });

    const res = await request(app).get(
      "/api/stream-proxy?url=" + encodeURIComponent("https://example.com/missing.ts")
    );

    expect(res.status).toBe(404);
  });

  it("returns 502 when the upstream fetch throws", async () => {
    mockedFetch.mockRejectedValue(new Error("network error"));

    const res = await request(app).get(
      "/api/stream-proxy?url=" + encodeURIComponent("https://example.com/video.ts")
    );

    expect(res.status).toBe(502);
  });
});
