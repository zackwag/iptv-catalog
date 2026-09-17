import { afterEach, describe, expect, it } from "vitest";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { db } from "../db";
import {
  agentForProxyUrl,
  assignChannelVpn,
  createVpnEndpoint,
  deleteVpnEndpoint,
  getChannelVpnEndpoint,
  listVpnEndpoints,
  unassignChannelVpn,
  updateVpnEndpoint,
} from "./vpnEndpointService";

afterEach(() => {
  db.exec("DELETE FROM channel_vpn_assignments; DELETE FROM vpn_endpoints; DELETE FROM channels;");
});

// This is exactly the logic that silently broke for ~2 months (see
// https://github.com/zackwag/iptv-catalog/issues/59): a dependency bump
// made https-proxy-agent/socks-proxy-agent ESM-only, which the build
// tooling caught, but nothing verified the *runtime* agent selection
// itself still worked correctly.
describe("agentForProxyUrl", () => {
  it("returns an HttpsProxyAgent for an http:// proxy URL", async () => {
    const agent = await agentForProxyUrl("http://proxy.example.com:8080");
    expect(agent).toBeInstanceOf(HttpsProxyAgent);
  });

  it("returns an HttpsProxyAgent for an https:// proxy URL", async () => {
    const agent = await agentForProxyUrl("https://proxy.example.com:8443");
    expect(agent).toBeInstanceOf(HttpsProxyAgent);
  });

  it("returns a SocksProxyAgent for a socks5:// proxy URL", async () => {
    const agent = await agentForProxyUrl("socks5://proxy.example.com:1080");
    expect(agent).toBeInstanceOf(SocksProxyAgent);
  });

  it("returns a SocksProxyAgent for a socks4:// proxy URL", async () => {
    const agent = await agentForProxyUrl("socks4://proxy.example.com:1080");
    expect(agent).toBeInstanceOf(SocksProxyAgent);
  });

  it("returns a SocksProxyAgent for a bare socks:// proxy URL", async () => {
    const agent = await agentForProxyUrl("socks://proxy.example.com:1080");
    expect(agent).toBeInstanceOf(SocksProxyAgent);
  });
});

describe("createVpnEndpoint", () => {
  it("creates and persists a VPN endpoint", () => {
    const endpoint = createVpnEndpoint({
      name: "test-endpoint",
      country: "US",
      proxyUrl: "http://proxy.example.com:8080",
    });

    expect(endpoint.id).toBeTruthy();
    expect(endpoint.name).toBe("test-endpoint");
    expect(endpoint.country).toBe("US");
    expect(endpoint.proxyUrl).toBe("http://proxy.example.com:8080");
    expect(listVpnEndpoints()).toHaveLength(1);
  });

  it("rejects an invalid proxy URL", () => {
    expect(() => createVpnEndpoint({ name: "bad", country: null, proxyUrl: "not a url" })).toThrow(
      /not a valid proxy URL/
    );
  });

  it("rejects a proxy URL with an unsupported protocol", () => {
    expect(() =>
      createVpnEndpoint({ name: "bad-protocol", country: null, proxyUrl: "ftp://proxy:21" })
    ).toThrow(/not a valid proxy URL/);
  });

  it("rejects a duplicate name", () => {
    createVpnEndpoint({ name: "dup", country: null, proxyUrl: "http://proxy1:8080" });
    expect(() =>
      createVpnEndpoint({ name: "dup", country: null, proxyUrl: "http://proxy2:8080" })
    ).toThrow(/already exists/);
  });

  it("rejects an empty name", () => {
    expect(() =>
      createVpnEndpoint({ name: "   ", country: null, proxyUrl: "http://proxy:8080" })
    ).toThrow(/name is required/);
  });
});

describe("updateVpnEndpoint", () => {
  it("updates the fields that are provided and leaves the rest alone", () => {
    const created = createVpnEndpoint({
      name: "original",
      country: "US",
      proxyUrl: "http://proxy:8080",
    });

    const updated = updateVpnEndpoint(created.id, { name: "renamed" });

    expect(updated.name).toBe("renamed");
    expect(updated.country).toBe("US");
    expect(updated.proxyUrl).toBe("http://proxy:8080");
  });

  it("throws for a nonexistent endpoint", () => {
    expect(() => updateVpnEndpoint("nonexistent-id", { name: "x" })).toThrow(/not found/);
  });
});

describe("deleteVpnEndpoint", () => {
  it("removes the endpoint and its channel assignments", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO channels (id, name, updatedAt) VALUES (?, ?, ?)").run(
      "chan-1",
      "Test Channel",
      now
    );

    const endpoint = createVpnEndpoint({
      name: "e1",
      country: null,
      proxyUrl: "http://proxy:8080",
    });
    assignChannelVpn("chan-1", endpoint.id);
    expect(getChannelVpnEndpoint("chan-1")?.id).toBe(endpoint.id);

    expect(deleteVpnEndpoint(endpoint.id)).toBe(true);
    expect(getChannelVpnEndpoint("chan-1")).toBeNull();
    expect(listVpnEndpoints()).toHaveLength(0);
  });

  it("returns false for a nonexistent endpoint", () => {
    expect(deleteVpnEndpoint("nonexistent-id")).toBe(false);
  });
});

describe("assignChannelVpn / unassignChannelVpn", () => {
  it("assigns, reassigns, and unassigns a channel's VPN endpoint", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO channels (id, name, updatedAt) VALUES (?, ?, ?)").run(
      "chan-1",
      "Test Channel",
      now
    );
    const e1 = createVpnEndpoint({ name: "e1", country: null, proxyUrl: "http://proxy1:8080" });
    const e2 = createVpnEndpoint({ name: "e2", country: null, proxyUrl: "http://proxy2:8080" });

    assignChannelVpn("chan-1", e1.id);
    expect(getChannelVpnEndpoint("chan-1")?.id).toBe(e1.id);

    assignChannelVpn("chan-1", e2.id);
    expect(getChannelVpnEndpoint("chan-1")?.id).toBe(e2.id);

    expect(unassignChannelVpn("chan-1")).toBe(true);
    expect(getChannelVpnEndpoint("chan-1")).toBeNull();
  });

  it("throws when assigning a nonexistent VPN endpoint", () => {
    expect(() => assignChannelVpn("chan-1", "nonexistent-id")).toThrow(/not found/);
  });
});
