import fetch from "node-fetch";
import { loadSettings } from "./settingsService";
import { createLogger } from "../logger";

const log = createLogger("webhook");

const WEBHOOK_TIMEOUT_MS = Number(process.env.WEBHOOK_TIMEOUT_MS || 5000);

export interface WebhookPayload {
  event: "channel_failing" | "channel_removed";
  playlistName: string;
  channelName: string;
  message: string;
  timestamp: string;
}

/**
 * Fires an outbound webhook if one is configured. Fire-and-forget from the
 * caller's perspective — errors are logged, never thrown, so a dead or
 * misconfigured webhook endpoint can't break feed testing itself.
 */
export async function sendWebhook(payload: WebhookPayload): Promise<void> {
  const { webhookUrl } = loadSettings();
  if (!webhookUrl) return; // disabled

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      log.warn(`webhook returned ${res.status} for event "${payload.event}"`, {
        channelName: payload.channelName,
      });
    } else {
      log.debug(`webhook delivered for event "${payload.event}"`, {
        channelName: payload.channelName,
      });
    }
  } catch (err) {
    const isAbort = (err as Error).name === "AbortError";
    log.warn(`webhook delivery failed for event "${payload.event}"`, {
      channelName: payload.channelName,
      error: isAbort ? `timed out after ${WEBHOOK_TIMEOUT_MS}ms` : (err as Error).message,
    });
  } finally {
    clearTimeout(timeout);
  }
}
