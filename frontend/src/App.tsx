import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import OverviewPage from "./pages/OverviewPage";
import CatalogPage from "./pages/CatalogPage";
import PlaylistsPage from "./pages/PlaylistsPage";
import SettingsPage from "./pages/SettingsPage";
import NotificationsPage from "./pages/NotificationsPage";
import { fetchNotifications, fetchSettings } from "./api";
import { applyTheme, watchSystemTheme } from "./theme";

const POLL_INTERVAL_MS = 60_000;

export default function App() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchSettings()
      .then((s) => {
        applyTheme(s.theme);
        watchSystemTheme(s.theme);
      })
      .catch(() => {
        /* non-fatal — falls back to the default dark theme already in the CSS */
      });
  }, []);

  useEffect(() => {
    function poll() {
      fetchNotifications(false)
        .then((r) => setUnreadCount(r.notifications.length))
        .catch(() => {
          /* non-fatal — badge just won't update this cycle */
        });
    }
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <header className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1>📺 IPTV Catalog</h1>
          <NavLink
            to="/notifications"
            className={({ isActive }) => (isActive ? "active" : "")}
            style={{ position: "relative", padding: "4px 6px", fontSize: 16, lineHeight: 1 }}
          >
            🔔
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--danger)",
                  display: "block",
                }}
              />
            )}
          </NavLink>
        </div>
        <nav className="tabs">
          <NavLink to="/overview" className={({ isActive }) => (isActive ? "active" : "")}>
            Overview
          </NavLink>
          <NavLink to="/catalog" className={({ isActive }) => (isActive ? "active" : "")}>
            Browse Channels
          </NavLink>
          <NavLink to="/playlists" className={({ isActive }) => (isActive ? "active" : "")}>
            Playlists
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")}>
            Settings
          </NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/catalog" element={<CatalogPage key="new" />} />
          <Route path="/playlists" element={<PlaylistsPage />} />
          <Route path="/playlists/:id/edit" element={<CatalogPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </main>
    </>
  );
}
