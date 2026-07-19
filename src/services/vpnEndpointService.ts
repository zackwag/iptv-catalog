import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import cron from "node-cron";
import { db } from "../db";
import { VpnEndpoint } from "../types";
import { createLogger } from "../logger";

const log = createLogger("vpnEndpointService");

// Any URL that returns our outbound IP as JSON works here — used purely as a
// reachability probe for the configured proxy, not a real dependency.
const HEALTH_CHECK_URL = process.env.VPN_HEALTH_CHECK_URL || "https://api.ipify.org?format=json";
const HEALTH_CHECK_TIMEOUT_MS = 6000;
const HEALTH_CHECK_CRON = process.env.VPN_HEALTH_CHECK_CRON || "*/5 * * * *";

const VALID_PROXY_PROTOCOLS = new Set(["http:", "https:", "socks:", "socks4:", "socks5:"]);

function isValidProxyUrl(value: string): boolean {
  try {
    return VALID_PROXY_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function agentForProxyUrl(proxyUrl: string): any {
  return proxyUrl.startsWith("socks")
    ? new SocksProxyAgent(proxyUrl)
    : new HttpsProxyAgent(proxyUrl);
}

interface VpnEndpointRow {
  id: string;
  name: string;
  country: string | null;
  proxyUrl: string;
  createdAt: string;
  lastCheckedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  lastExitIp: string | null;
}

function rowToEndpoint(row: VpnEndpointRow): VpnEndpoint {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    proxyUrl: row.proxyUrl,
    createdAt: row.createdAt,
    lastCheckedAt: row.lastCheckedAt,
    lastStatus: row.lastStatus === "up" || row.lastStatus === "down" ? row.lastStatus : null,
    lastError: row.lastError,
    lastExitIp: row.lastExitIp,
  };
}

export function listVpnEndpoints(): VpnEndpoint[] {
  return (
    db.prepare("SELECT * FROM vpn_endpoints ORDER BY name ASC").all() as VpnEndpointRow[]
  ).map(rowToEndpoint);
}

export function getVpnEndpoint(id: string): VpnEndpoint | null {
  const row = db.prepare("SELECT * FROM vpn_endpoints WHERE id = ?").get(id) as
    VpnEndpointRow | undefined;
  return row ? rowToEndpoint(row) : null;
}

export function createVpnEndpoint(input: {
  name: string;
  country: string | null;
  proxyUrl: string;
}): VpnEndpoint {
  const name = input.name.trim();
  const proxyUrl = input.proxyUrl.trim();
  if (!name) throw new Error("name is required");
  if (!isValidProxyUrl(proxyUrl)) {
    throw new Error(`"${proxyUrl}" is not a valid proxy URL (expected http(s):// or socks5://)`);
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  try {
    db.prepare(
      "INSERT INTO vpn_endpoints (id, name, country, proxyUrl, createdAt) VALUES (?, ?, ?, ?, ?)"
    ).run(id, name, input.country?.trim() || null, proxyUrl, now);
  } catch (err) {
    if (/UNIQUE/.test((err as Error).message)) {
      throw new Error(`a VPN endpoint named "${name}" already exists`, { cause: err });
    }
    throw err;
  }
  return getVpnEndpoint(id)!;
}

export function updateVpnEndpoint(
  id: string,
  updates: { name?: string; country?: string | null; proxyUrl?: string }
): VpnEndpoint {
  const existing = getVpnEndpoint(id);
  if (!existing) throw new Error("vpn endpoint not found");

  const name = updates.name !== undefined ? updates.name.trim() : existing.name;
  if (!name) throw new Error("name is required");

  const proxyUrl = updates.proxyUrl !== undefined ? updates.proxyUrl.trim() : existing.proxyUrl;
  if (!isValidProxyUrl(proxyUrl)) {
    throw new Error(`"${proxyUrl}" is not a valid proxy URL (expected http(s):// or socks5://)`);
  }

  const country =
    updates.country !== undefined ? updates.country?.trim() || null : existing.country;

  try {
    db.prepare("UPDATE vpn_endpoints SET name = ?, country = ?, proxyUrl = ? WHERE id = ?").run(
      name,
      country,
      proxyUrl,
      id
    );
  } catch (err) {
    if (/UNIQUE/.test((err as Error).message)) {
      throw new Error(`a VPN endpoint named "${name}" already exists`, { cause: err });
    }
    throw err;
  }
  return getVpnEndpoint(id)!;
}

export function deleteVpnEndpoint(id: string): boolean {
  db.prepare("DELETE FROM channel_vpn_assignments WHERE vpnEndpointId = ?").run(id);
  const result = db.prepare("DELETE FROM vpn_endpoints WHERE id = ?").run(id);
  return result.changes > 0;
}

export async function checkVpnEndpoint(id: string): Promise<VpnEndpoint> {
  const endpoint = getVpnEndpoint(id);
  if (!endpoint) throw new Error("vpn endpoint not found");

  const now = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

  try {
    const agent = agentForProxyUrl(endpoint.proxyUrl);
    const upstream = await fetch(HEALTH_CHECK_URL, { agent, signal: controller.signal });
    if (!upstream.ok) throw new Error(`upstream returned ${upstream.status}`);

    let exitIp: string | null = null;
    try {
      const body = (await upstream.json()) as { ip?: string };
      exitIp = body.ip ?? null;
    } catch {
      // health check URL didn't return the expected JSON shape — reachability alone still proves the proxy is up
    }

    db.prepare(
      "UPDATE vpn_endpoints SET lastCheckedAt = ?, lastStatus = 'up', lastError = NULL, lastExitIp = ? WHERE id = ?"
    ).run(now, exitIp, id);
  } catch (err) {
    db.prepare(
      "UPDATE vpn_endpoints SET lastCheckedAt = ?, lastStatus = 'down', lastError = ?, lastExitIp = NULL WHERE id = ?"
    ).run(now, (err as Error).message, id);
  } finally {
    clearTimeout(timeout);
  }

  return getVpnEndpoint(id)!;
}

export async function checkAllVpnEndpoints(): Promise<void> {
  const endpoints = listVpnEndpoints();
  await Promise.all(
    endpoints.map((e) =>
      checkVpnEndpoint(e.id).catch((err) =>
        log.error(`health check failed for VPN endpoint ${e.id}`, { error: (err as Error).message })
      )
    )
  );
}

export function startVpnHealthScheduler(): void {
  cron.schedule(HEALTH_CHECK_CRON, () => {
    checkAllVpnEndpoints().catch((err) =>
      log.error("vpn health check tick failed", { error: (err as Error).message })
    );
  });
  log.info(`vpn endpoint health checks ticking on "${HEALTH_CHECK_CRON}"`);
}

export function getChannelVpnAssignments(): Map<string, string> {
  const rows = db.prepare("SELECT channelId, vpnEndpointId FROM channel_vpn_assignments").all() as {
    channelId: string;
    vpnEndpointId: string;
  }[];
  return new Map(rows.map((r) => [r.channelId, r.vpnEndpointId]));
}

export function getChannelVpnEndpoint(channelId: string): VpnEndpoint | null {
  const row = db
    .prepare(
      `
    SELECT ve.* FROM channel_vpn_assignments cva
    JOIN vpn_endpoints ve ON ve.id = cva.vpnEndpointId
    WHERE cva.channelId = ?
  `
    )
    .get(channelId) as VpnEndpointRow | undefined;
  return row ? rowToEndpoint(row) : null;
}

export function assignChannelVpn(channelId: string, vpnEndpointId: string): void {
  if (!getVpnEndpoint(vpnEndpointId)) throw new Error("vpn endpoint not found");
  db.prepare(
    `
    INSERT INTO channel_vpn_assignments (channelId, vpnEndpointId) VALUES (?, ?)
    ON CONFLICT(channelId) DO UPDATE SET vpnEndpointId = excluded.vpnEndpointId
  `
  ).run(channelId, vpnEndpointId);
}

export function unassignChannelVpn(channelId: string): boolean {
  const result = db
    .prepare("DELETE FROM channel_vpn_assignments WHERE channelId = ?")
    .run(channelId);
  return result.changes > 0;
}
