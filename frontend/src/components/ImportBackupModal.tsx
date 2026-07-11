import { useState } from "react";
import { importBackup, BackupBundle, BackupPlaylistDefinition } from "../api";

interface Props {
  bundle: BackupBundle;
  onClose: () => void;
  onImported: () => void;
}

function normalizePlaylists(bundle: BackupBundle): BackupPlaylistDefinition[] {
  if (Array.isArray(bundle.playlists)) return bundle.playlists;
  // Legacy single-playlist export format
  if (bundle.name && Array.isArray(bundle.channelIds)) {
    return [
      {
        name: bundle.name,
        channelIds: bundle.channelIds,
        checkIntervalHours: 6,
        channelNumberStart: 1,
      },
    ];
  }
  return [];
}

export default function ImportBackupModal({ bundle, onClose, onImported }: Props) {
  const playlists = normalizePlaylists(bundle);
  const hasSettings = !!bundle.settings;

  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(
    new Set(playlists.map((_, i) => i))
  );
  const [applySettings, setApplySettings] = useState(hasSettings);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(index: number) {
    const next = new Set(selectedIndexes);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelectedIndexes(next);
  }

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      const selectedPlaylists = playlists.filter((_, i) => selectedIndexes.has(i));
      const result = await importBackup({
        playlists: selectedPlaylists,
        settings: applySettings ? bundle.settings : undefined,
      });
      if (!result.ok) throw new Error(result.error || "Import failed");
      onImported();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  const canImport = selectedIndexes.size > 0 || applySettings;

  return (
    <div className="iptv-dialog-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ width: "min(420px, 92vw)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Import backup</h3>

        {playlists.length === 0 && !hasSettings ? (
          <div className="meta" style={{ marginBottom: 14 }}>
            This file doesn't contain any playlists or settings recognized as a backup.
          </div>
        ) : (
          <>
            {playlists.length > 0 && (
              <>
                <div className="meta" style={{ marginBottom: 8 }}>
                  Playlists in this file
                </div>
                <div style={{ maxHeight: 220, overflowY: "auto", marginBottom: 14 }}>
                  {playlists.map((p, i) => (
                    <label
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 0",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIndexes.has(i)}
                        onChange={() => toggle(i)}
                      />
                      <span style={{ flex: 1 }}>{p.name}</span>
                      <span className="meta" style={{ fontSize: 11 }}>
                        {p.channelIds.length} ch
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}

            {hasSettings && (
              <label className="checkbox" style={{ marginBottom: 16 }}>
                <input
                  type="checkbox"
                  checked={applySettings}
                  onChange={(e) => setApplySettings(e.target.checked)}
                />
                Apply app settings from this file (overwrites current settings)
              </label>
            )}
          </>
        )}

        {error && (
          <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{error}</div>
        )}

        <div className="actions">
          <button className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={!canImport || importing} onClick={handleImport}>
            {importing ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
