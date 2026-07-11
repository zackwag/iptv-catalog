import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchPlaylists,
  fetchSettings,
  deletePlaylist,
  updatePlaylist,
  triggerPlaylistTest,
  duplicatePlaylist,
  BackupBundle,
  AppSettings,
} from "../api";
import { Playlist } from "../types";
import ExportModal from "../components/ExportModal";
import ExportBackupModal from "../components/ExportBackupModal";
import ImportBackupModal from "../components/ImportBackupModal";

export default function PlaylistsPage() {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [intervalDrafts, setIntervalDrafts] = useState<Record<string, string>>({});
  const [numberStartDrafts, setNumberStartDrafts] = useState<Record<string, string>>({});
  const [testMessages, setTestMessages] = useState<Record<string, string>>({});
  const [exportingPlaylist, setExportingPlaylist] = useState<Playlist | null>(null);
  const [showExportBackup, setShowExportBackup] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [importPreviewBundle, setImportPreviewBundle] = useState<BackupBundle | null>(null);
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  function load() {
    setLoading(true);
    fetchPlaylists()
      .then((r) => {
        setPlaylists(r.playlists);
        const intervalDraftMap: Record<string, string> = {};
        const numberDraftMap: Record<string, string> = {};
        r.playlists.forEach((p) => {
          intervalDraftMap[p.id] = String(p.checkIntervalHours);
          numberDraftMap[p.id] = String(p.channelNumberStart);
        });
        setIntervalDrafts(intervalDraftMap);
        setNumberStartDrafts(numberDraftMap);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    fetchSettings()
      .then(setAppSettings)
      .catch(() => {});
  }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete playlist "${name}"? This can't be undone.`)) return;
    setBusyId(id);
    try {
      await deletePlaylist(id);
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveInterval(id: string) {
    const raw = intervalDrafts[id];
    const hours = Number(raw);
    if (!raw || isNaN(hours) || hours <= 0) {
      setError("Check interval must be a positive number of hours");
      return;
    }
    setBusyId(id);
    try {
      const updated = await updatePlaylist(id, { checkIntervalHours: hours });
      setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveNumberStart(id: string) {
    const raw = numberStartDrafts[id];
    const start = Number(raw);
    if (!raw || isNaN(start) || start <= 0) {
      setError("Starting channel number must be a positive number");
      return;
    }
    setBusyId(id);
    try {
      const updated = await updatePlaylist(id, { channelNumberStart: start });
      setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleTestNow(id: string) {
    setBusyId(id);
    setTestMessages((prev) => ({ ...prev, [id]: "Testing…" }));
    try {
      const result = await triggerPlaylistTest(id);
      setTestMessages((prev) => ({
        ...prev,
        [id]: result.ok
          ? `Tested ${result.tested} channel(s), ${result.failed} failing${
              result.removed ? `, ${result.removed} auto-removed` : ""
            }.`
          : `Test failed: ${result.error}`,
      }));
      load();
    } catch (e) {
      setTestMessages((prev) => ({ ...prev, [id]: `Test failed: ${(e as Error).message}` }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDuplicate(id: string) {
    setBusyId(id);
    try {
      await duplicatePlaylist(id);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleImportFileSelected(file: File) {
    setImportFileError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupBundle;
      setImportPreviewBundle(parsed);
    } catch (e) {
      setImportFileError(`Couldn't read that file: ${(e as Error).message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function startRename(p: Playlist) {
    setEditingNameId(p.id);
    setNameDraft(p.name);
  }

  function cancelRename() {
    setEditingNameId(null);
    setNameDraft("");
  }

  async function handleSaveName(id: string) {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setError("Playlist name can't be empty");
      return;
    }
    setSavingName(true);
    setError(null);
    try {
      const updated = await updatePlaylist(id, { name: trimmed });
      setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
      setEditingNameId(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingName(false);
    }
  }

  if (loading) return <div className="empty-state">Loading playlists…</div>;

  return (
    <div>
      <div className="playlist-toolbar">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFileSelected(file);
          }}
        />
        <button className="secondary" onClick={() => fileInputRef.current?.click()}>
          Import backup…
        </button>
        <button className="secondary" onClick={() => setShowExportBackup(true)}>
          Export backup…
        </button>
      </div>

      {importFileError && (
        <div className="empty-state" style={{ color: "var(--danger)", padding: "0 0 16px" }}>
          {importFileError}
        </div>
      )}
      {error && (
        <div className="empty-state" style={{ color: "var(--danger)", padding: "0 0 16px" }}>
          {error}
        </div>
      )}

      {playlists.length === 0 ? (
        <div className="empty-state">
          No playlists yet. Head to "Browse Channels" to build one, or import a backup above.
        </div>
      ) : (
        playlists.map((p) => (
          <div className="playlist-card" key={p.id}>
            <div className="row">
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingNameId === p.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <input
                      type="text"
                      autoFocus
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveName(p.id);
                        if (e.key === "Escape") cancelRename();
                      }}
                      style={{ fontSize: 15, fontWeight: 600, flex: 1 }}
                    />
                    <button
                      className="secondary"
                      disabled={savingName}
                      onClick={() => handleSaveName(p.id)}
                    >
                      {savingName ? "Saving…" : "Save"}
                    </button>
                    <button className="secondary" disabled={savingName} onClick={cancelRename}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <h3>{p.name}</h3>
                )}
                <div className="meta">
                  {p.channelCount} channel{p.channelCount === 1 ? "" : "s"} · Updated{" "}
                  {new Date(p.updatedAt).toLocaleString()}
                </div>
                {p.exceedsChannelsDvrLimit && (
                  <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>
                    ⚠ Exceeds Channels DVR's 500-channel limit per source — channels past 500 will
                    be silently dropped when added there.
                  </div>
                )}
              </div>
              <div className="playlist-actions">
                {editingNameId !== p.id && (
                  <button
                    className="icon-link"
                    disabled={busyId === p.id}
                    onClick={() => startRename(p)}
                  >
                    Rename
                  </button>
                )}
                <button
                  className="icon-link"
                  disabled={busyId === p.id}
                  onClick={() => setExportingPlaylist(p)}
                >
                  Export
                </button>
                <button
                  className="icon-link"
                  disabled={busyId === p.id}
                  onClick={() => handleDuplicate(p.id)}
                >
                  Duplicate
                </button>
                <button
                  className="icon-link"
                  disabled={busyId === p.id}
                  onClick={() => navigate(`/playlists/${p.id}/edit`)}
                >
                  Edit channels
                </button>
                <button
                  className="danger-link"
                  disabled={busyId === p.id}
                  onClick={() => handleDelete(p.id, p.name)}
                >
                  Delete
                </button>
              </div>
            </div>

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="meta">Check every</span>
                <input
                  type="number"
                  min={1}
                  value={intervalDrafts[p.id] ?? ""}
                  onChange={(e) =>
                    setIntervalDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))
                  }
                  style={{
                    width: 60,
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    borderRadius: 6,
                    padding: "6px 8px",
                  }}
                />
                <span className="meta">hours</span>
                <button
                  className="secondary"
                  disabled={
                    busyId === p.id || intervalDrafts[p.id] === String(p.checkIntervalHours)
                  }
                  onClick={() => handleSaveInterval(p.id)}
                >
                  Save
                </button>
                <span style={{ flex: 1 }} />
                <span className="meta">
                  Last tested:{" "}
                  {p.lastTestedAt ? new Date(p.lastTestedAt).toLocaleString() : "never"}
                </span>
                <button
                  className="secondary"
                  disabled={busyId === p.id}
                  onClick={() => handleTestNow(p.id)}
                >
                  Test now
                </button>
              </div>
              {testMessages[p.id] && (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-dim)" }}>
                  {testMessages[p.id]}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 10,
                }}
              >
                <span className="meta">Channel numbers start at</span>
                <input
                  type="number"
                  min={1}
                  value={numberStartDrafts[p.id] ?? ""}
                  onChange={(e) =>
                    setNumberStartDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))
                  }
                  style={{
                    width: 70,
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    borderRadius: 6,
                    padding: "6px 8px",
                  }}
                />
                <button
                  className="secondary"
                  disabled={
                    busyId === p.id || numberStartDrafts[p.id] === String(p.channelNumberStart)
                  }
                  onClick={() => handleSaveNumberStart(p.id)}
                >
                  Save
                </button>
                <span className="meta" style={{ fontSize: 11 }}>
                  Change this if multiple playlists are added to Channels DVR so their numbers don't
                  overlap.
                </span>
              </div>
            </div>
          </div>
        ))
      )}

      {exportingPlaylist && (
        <ExportModal
          playlistId={exportingPlaylist.id}
          playlistName={exportingPlaylist.name}
          m3uUrl={exportingPlaylist.m3uUrl}
          epgUrl={exportingPlaylist.epgUrl}
          hasDvrUrl={!!appSettings?.channelsDvrUrl}
          onClose={() => setExportingPlaylist(null)}
        />
      )}

      {showExportBackup && <ExportBackupModal onClose={() => setShowExportBackup(false)} />}

      {importPreviewBundle && (
        <ImportBackupModal
          bundle={importPreviewBundle}
          onClose={() => setImportPreviewBundle(null)}
          onImported={load}
        />
      )}
    </div>
  );
}
