import { Router } from "express";
import {
  listVpnEndpoints,
  createVpnEndpoint,
  updateVpnEndpoint,
  deleteVpnEndpoint,
  checkVpnEndpoint,
} from "../services/vpnEndpointService";
import { db } from "../db";
import { createLogger } from "../logger";

const log = createLogger("vpnEndpointsRoute");

export const vpnEndpointsRouter = Router();

// GET /vpn-endpoints — configured VPN/geo-proxy endpoints with last-known live
// status and how many channels are currently routed through each.
vpnEndpointsRouter.get("/vpn-endpoints", (_req, res) => {
  const endpoints = listVpnEndpoints();
  const counts = db
    .prepare(
      "SELECT vpnEndpointId, COUNT(*) AS n FROM channel_vpn_assignments GROUP BY vpnEndpointId"
    )
    .all() as { vpnEndpointId: string; n: number }[];
  const countByEndpoint = new Map(counts.map((c) => [c.vpnEndpointId, c.n]));

  res.json({
    endpoints: endpoints.map((e) => ({ ...e, channelCount: countByEndpoint.get(e.id) ?? 0 })),
  });
});

// POST /vpn-endpoints  { name, country?, proxyUrl }
vpnEndpointsRouter.post("/vpn-endpoints", async (req, res) => {
  const { name, country, proxyUrl } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  if (typeof proxyUrl !== "string" || !proxyUrl.trim()) {
    return res.status(400).json({ error: "proxyUrl is required" });
  }
  if (country !== undefined && country !== null && typeof country !== "string") {
    return res.status(400).json({ error: "country must be a string" });
  }

  try {
    const endpoint = createVpnEndpoint({ name, country: country ?? null, proxyUrl });
    log.info(`created VPN endpoint "${endpoint.name}"`);
    const checked = await checkVpnEndpoint(endpoint.id);
    res.status(201).json(checked);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// PATCH /vpn-endpoints/:id  { name?, country?, proxyUrl? }
vpnEndpointsRouter.patch("/vpn-endpoints/:id", (req, res) => {
  const { name, country, proxyUrl } = req.body ?? {};
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return res.status(400).json({ error: "name must be a non-empty string" });
  }
  if (proxyUrl !== undefined && (typeof proxyUrl !== "string" || !proxyUrl.trim())) {
    return res.status(400).json({ error: "proxyUrl must be a non-empty string" });
  }
  if (country !== undefined && country !== null && typeof country !== "string") {
    return res.status(400).json({ error: "country must be a string" });
  }

  try {
    const endpoint = updateVpnEndpoint(req.params.id, { name, country, proxyUrl });
    res.json(endpoint);
  } catch (err) {
    const message = (err as Error).message;
    res.status(message === "vpn endpoint not found" ? 404 : 400).json({ error: message });
  }
});

// DELETE /vpn-endpoints/:id — also unassigns any channels routed through it
vpnEndpointsRouter.delete("/vpn-endpoints/:id", (req, res) => {
  const removed = deleteVpnEndpoint(req.params.id);
  if (!removed) return res.status(404).json({ error: "vpn endpoint not found" });
  log.info(`deleted VPN endpoint ${req.params.id}`);
  res.json({ ok: true });
});

// POST /vpn-endpoints/:id/check — force a fresh reachability check
vpnEndpointsRouter.post("/vpn-endpoints/:id/check", async (req, res) => {
  try {
    const endpoint = await checkVpnEndpoint(req.params.id);
    res.json(endpoint);
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});
