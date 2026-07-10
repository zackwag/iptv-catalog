import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchSettings, fetchPlaylists, fetchNotifications, triggerCatalogRefresh, AppSettings } from "../api";
import { Playlist, Notification } from "../types";
import { describeCron } from "../cronFormat";

export default function OverviewPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingCatalog, setRefreshingCatalog] = useState(false);
  const [catalogRefreshMessage, setCatalogRefreshMessage] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([fetchSettings(), fetchPlaylists(), fetchNotifications(false)])
      .then(([s, p, n]) => {
        setSettings(s);
        setPlaylists(p.playlists);
        setNotifications(n.notifications);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleRefreshCatalog() {
    setRefreshingCatalog(true);
    setCatalogRefreshMessage(null);
    try {
      const result = await triggerCatalogRefresh();
      setCatalogRefreshMessage(
        result.ok ? `Refreshed ${result.channelCount} channels.` : `Refresh failed: ${result.error}`
      );
      load();
    } catch (e) {
      setCatalogRefreshMessage(`Refresh failed: ${(e as Error).message}`);
    } finally {
      setRefreshingCatalog(false);
    }
  }

  if (loading) return <div className="empty-state">Loading overview…</div>;
  if (error) return <div className="empty-state" style={{ color: "var(--danger)" }}>{error}</div>;
  if (!settings) return null;

  const totalChannels = playlists.reduce((sum, p) => sum + p.channelCount, 0);
  const overLimitPlaylists = playlists.filter((p) => p.exceedsChannelsDvrLimit);
  const failingCount = notifications.filter((n) => n.kind === "failure").length;
  const removedCount = notifications.filter((n) => n.kind === "removed").length;
  const neverTestedCount = playlists.filter((p) => !p.lastTestedAt).length;

  return (
    <div className="overview-grid">
      <div className="playlist-card">
        <h3>Catalog</h3>
        <div className="meta">
          Last synced:{" "}
          {settings.catalogRefreshedAt
            ? new Date(settings.catalogRefreshedAt).toLocaleString()
            : "never"}
        </div>
        <div className="meta" style={{ marginTop: 4 }} title={settings.catalogRefreshCron}>
          Refresh schedule: {describeCron(settings.catalogRefreshCron)}
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center" }}>
          <button className="secondary" disabled={refreshingCatalog} onClick={handleRefreshCatalog}>
            {refreshingCatalog ? "Refreshing…" : "Refresh now"}
          </button>
          <Link to="/settings" className="icon-link">
            Manage in Settings →
          </Link>
        </div>
        {catalogRefreshMessage && (
          <div className="meta" style={{ marginTop: 8 }}>
            {catalogRefreshMessage}
          </div>
        )}
      </div>

      <div className="playlist-card">
        <h3>EPG guide</h3>
        {settings.epgHealth.isStale ? (
          playlists.length === 0 ? (
            <div className="meta">
              Nothing to generate yet — the EPG sidecar only fetches guide data for channels
              used in a playlist. Create one, then the sidecar's next run (or a restart of the{" "}
              <code style={{ fontSize: 11 }}>iptv-catalog-epg</code> container, to trigger it
              immediately) will pick it up.
            </div>
          ) : (
            <div style={{ color: "var(--danger)", fontSize: 13 }}>
              ⚠{" "}
              {settings.epgHealth.lastGeneratedAt
                ? `Stale — last generated ${new Date(settings.epgHealth.lastGeneratedAt).toLocaleString()}`
                : "Never generated yet, despite having playlists — check the epg sidecar's logs."}
            </div>
          )
        ) : (
          <div style={{ color: "var(--success)", fontSize: 13 }}>
            ✓ Fresh — last generated{" "}
            {settings.epgHealth.lastGeneratedAt
              ? new Date(settings.epgHealth.lastGeneratedAt).toLocaleString()
              : "never"}
          </div>
        )}
      </div>

      <div className="playlist-card">
        <h3>Playlists</h3>
        <div className="meta">
          {playlists.length} playlist{playlists.length === 1 ? "" : "s"} · {totalChannels} channel
          {totalChannels === 1 ? "" : "s"} monitored
        </div>
        {neverTestedCount > 0 && (
          <div className="meta" style={{ marginTop: 4 }}>
            {neverTestedCount} playlist{neverTestedCount === 1 ? "" : "s"} not tested yet
          </div>
        )}
        {overLimitPlaylists.length > 0 && (
          <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>
            ⚠ {overLimitPlaylists.length} playlist{overLimitPlaylists.length === 1 ? "" : "s"} over
            Channels DVR's 500-channel limit: {overLimitPlaylists.map((p) => p.name).join(", ")}
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <Link to="/playlists" className="icon-link">
            Manage playlists →
          </Link>
        </div>
      </div>

      <div className="playlist-card">
        <h3>Active alerts</h3>
        {notifications.length === 0 ? (
          <div style={{ color: "var(--success)", fontSize: 13 }}>✓ Nothing to report</div>
        ) : (
          <div className="meta">
            {failingCount > 0 && (
              <span style={{ color: "var(--danger)" }}>
                {failingCount} channel{failingCount === 1 ? "" : "s"} failing
              </span>
            )}
            {failingCount > 0 && removedCount > 0 && " · "}
            {removedCount > 0 && <span>{removedCount} auto-removed</span>}
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <Link to="/notifications" className="icon-link">
            View notifications →
          </Link>
        </div>
      </div>
    </div>
  );
}
