import { Router } from "express";
import { db } from "../db";
import { Notification } from "../types";
import { createLogger } from "../logger";

const log = createLogger("notificationsRoute");

export const notificationsRouter = Router();

// GET /notifications?dismissed=false
notificationsRouter.get("/notifications", (req, res) => {
  const { dismissed } = req.query;

  let query = "SELECT * FROM notifications";
  const params: unknown[] = [];

  if (dismissed !== undefined) {
    query += " WHERE dismissed = ?";
    params.push(dismissed === "true" ? 1 : 0);
  }
  query += " ORDER BY createdAt DESC";

  const notifications = db.prepare(query).all(...params) as Notification[];
  res.json({ notifications });
});

// POST /notifications/dismiss-all — dismiss every currently active notification
notificationsRouter.post("/notifications/dismiss-all", (_req, res) => {
  const now = new Date().toISOString();
  const result = db
    .prepare("UPDATE notifications SET dismissed = 1, dismissedAt = ? WHERE dismissed = 0")
    .run(now);

  log.info(`bulk-dismissed ${result.changes} notification(s)`);
  res.json({ ok: true, dismissed: result.changes });
});

// PATCH /notifications/:id  { dismissed: true }
notificationsRouter.patch("/notifications/:id", (req, res) => {
  const { dismissed } = req.body ?? {};
  if (typeof dismissed !== "boolean") {
    return res.status(400).json({ error: "dismissed must be a boolean" });
  }

  const result = db
    .prepare("UPDATE notifications SET dismissed = ?, dismissedAt = ? WHERE id = ?")
    .run(dismissed ? 1 : 0, dismissed ? new Date().toISOString() : null, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "notification not found" });
  }

  log.debug(`notification ${req.params.id} marked dismissed=${dismissed}`);
  res.json({ ok: true });
});

// DELETE /notifications/:id
notificationsRouter.delete("/notifications/:id", (req, res) => {
  const result = db.prepare("DELETE FROM notifications WHERE id = ?").run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: "notification not found" });
  }
  res.status(204).send();
});

// POST /dev/notifications — undocumented test endpoint for creating fake notifications
notificationsRouter.post("/dev/notifications", (req, res) => {
  const {
    playlistId = "test-playlist",
    playlistName = "Test Playlist",
    channelId = "test-channel",
    channelName = "Test Channel",
    message = "Stream check failed",
    kind = "failure",
    failureCount = 1,
  } = req.body ?? {};

  const id = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO notifications (id, playlistId, playlistName, channelId, channelName, message, createdAt, dismissed, failureCount, lastFailedAt, kind)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `
  ).run(
    id,
    playlistId,
    playlistName,
    channelId,
    channelName,
    message,
    now,
    failureCount,
    now,
    kind
  );

  log.info(`dev: created test notification ${id}`);
  res.status(201).json({ ok: true, id });
});
