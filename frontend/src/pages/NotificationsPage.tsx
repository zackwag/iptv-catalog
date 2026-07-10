import { useEffect, useState } from "react";
import { fetchNotifications, dismissNotification, dismissAllNotifications } from "../api";
import { Notification } from "../types";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  function load() {
    setLoading(true);
    fetchNotifications(false)
      .then((r) => setNotifications(r.notifications))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleDismiss(id: string) {
    setBusyId(id);
    try {
      await dismissNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismissAll() {
    if (!confirm(`Dismiss all ${notifications.length} active alert(s)?`)) return;
    setBulkBusy(true);
    try {
      await dismissAllNotifications();
      setNotifications([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBulkBusy(false);
    }
  }

  if (loading) return <div className="empty-state">Loading notifications…</div>;
  if (error) return <div className="empty-state" style={{ color: "var(--danger)" }}>{error}</div>;
  if (notifications.length === 0) {
    return <div className="empty-state">No active alerts — every tested feed is responding.</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
          Active alerts <span className="meta" style={{ fontWeight: 400 }}>({notifications.length})</span>
        </h2>
        <button className="secondary" disabled={bulkBusy} onClick={handleDismissAll}>
          {bulkBusy ? "Dismissing…" : "Dismiss all"}
        </button>
      </div>

      {notifications.map((n) => {
        const isRemoved = n.kind === "removed";
        return (
          <div
            key={n.id}
            className="playlist-card"
            style={{ borderLeft: `3px solid ${isRemoved ? "var(--border)" : "var(--danger)"}`, paddingLeft: 14 }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{n.channelName}</span>
                  <span
                    className="badge"
                    style={isRemoved
                      ? { background: "#2a2f38", color: "var(--text-dim)" }
                      : { background: "rgba(241,108,108,0.15)", color: "var(--danger)" }
                    }
                  >
                    {isRemoved ? "removed" : `failing ×${n.failureCount}`}
                  </span>
                </div>
                <div className="meta" style={{ marginBottom: 6 }}>
                  {n.playlistName} · {new Date(n.lastFailedAt || n.createdAt).toLocaleString()}
                </div>
                <div style={{ fontSize: 13, color: isRemoved ? "var(--text-dim)" : "var(--danger)" }}>
                  {n.message}
                </div>
              </div>
              <button
                className="danger-link"
                style={{ flexShrink: 0, paddingTop: 0 }}
                disabled={busyId === n.id}
                onClick={() => handleDismiss(n.id)}
              >
                {busyId === n.id ? "…" : "Dismiss"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
