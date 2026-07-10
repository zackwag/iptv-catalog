import { useEffect, useState } from "react";
import { fetchBackupPlaylists, exportBackup, BackupPlaylistSummary } from "../api";

interface Props {
  onClose: () => void;
}

export default function ExportBackupModal({ onClose }: Props) {
  const [playlists, setPlaylists] = useState<BackupPlaylistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [includeSettings, setIncludeSettings] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchBackupPlaylists()
      .then((r) => {
        setPlaylists(r.playlists);
        setSelectedIds(new Set(r.playlists.map((p) => p.id))); // default: all selected
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function toggleAll() {
    if (selectedIds.size === playlists.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(playlists.map((p) => p.id)));
    }
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const bundle = await exportBackup(Array.from(selectedIds), includeSettings);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "iptv-catalog-backup.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const canExport = selectedIds.size > 0 || includeSettings;

  return (
    <div className="iptv-dialog-overlay" onClick={onClose}>
      <div className="modal" style={{ width: "min(420px, 92vw)" }} onClick={(e) => e.stopPropagation()}>
        <h3>Export backup</h3>

        {loading ? (
          <div className="empty-state">Loading playlists…</div>
        ) : playlists.length === 0 ? (
          <div className="meta" style={{ marginBottom: 14 }}>
            No playlists yet — you can still export just the app settings below.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="meta">Playlists to include</span>
              <button className="icon-link" onClick={toggleAll}>
                {selectedIds.size === playlists.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div style={{ maxHeight: 220, overflowY: "auto", marginBottom: 14 }}>
              {playlists.map((p) => (
                <label
                  key={p.id}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer" }}
                >
                  <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggle(p.id)} />
                  <span style={{ flex: 1 }}>{p.name}</span>
                  <span className="meta" style={{ fontSize: 11 }}>
                    {p.channelCount} ch
                  </span>
                </label>
              ))}
            </div>
          </>
        )}

        <label className="checkbox" style={{ marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={includeSettings}
            onChange={(e) => setIncludeSettings(e.target.checked)}
          />
          Include app settings (schedule, auto-remove, webhook, EPG threshold, theme)
        </label>

        {error && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{error}</div>}

        <div className="actions">
          <button className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={!canExport || exporting} onClick={handleExport}>
            {exporting ? "Exporting…" : "Download backup"}
          </button>
        </div>
      </div>
    </div>
  );
}
