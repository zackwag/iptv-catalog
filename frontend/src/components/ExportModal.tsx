import { useState } from "react";
import { pushPlaylistToDvr } from "../api";

interface Props {
  playlistId: string;
  playlistName: string;
  m3uUrl: string;
  epgUrl: string;
  hasDvrUrl: boolean;
  onClose: () => void;
}

function CopyRow({
  label,
  value,
  monospace = false,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="meta" style={{ marginBottom: 4 }}>
        {label}
      </div>
      <div className="url-field">
        <code style={monospace ? { fontFamily: "monospace" } : undefined}>{value}</code>
        <button className="icon-link" onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9\-_]+/gi, "_").toLowerCase() || "playlist";
}

export default function ExportModal({
  playlistId,
  playlistName,
  m3uUrl,
  epgUrl,
  hasDvrUrl,
  onClose,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch(m3uUrl);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const text = await res.text();

      const blob = new Blob([text], { type: "application/x-mpegurl" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${sanitizeFilename(playlistName)}.m3u`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(`Couldn't download the file: ${(e as Error).message}`);
    } finally {
      setDownloading(false);
    }
  }

  async function handlePushToDvr() {
    setPushing(true);
    setPushResult(null);
    try {
      const result = await pushPlaylistToDvr(playlistId);
      setPushResult({ ok: true, message: `Added "${result.sourceName}" to Channels DVR.` });
    } catch (e) {
      setPushResult({ ok: false, message: (e as Error).message });
    } finally {
      setPushing(false);
    }
  }

  const vlcCommand = `vlc "${m3uUrl}"`;

  return (
    <div className="iptv-dialog-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ width: "min(480px, 92vw)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Export "{playlistName}"</h3>

        <CopyRow label="M3U playlist URL" value={m3uUrl} />
        <CopyRow label="EPG guide URL" value={epgUrl} />

        <div style={{ marginBottom: 14 }}>
          <button className="secondary" disabled={downloading} onClick={handleDownload}>
            {downloading ? "Downloading…" : "Download .m3u file"}
          </button>
          {downloadError && (
            <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>
              {downloadError}
            </div>
          )}
          <div className="meta" style={{ marginTop: 6 }}>
            If VLC is your system's default app for .m3u files, double-clicking the downloaded file
            opens it straight in VLC — no menu navigation needed.
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Channels DVR</div>
          {hasDvrUrl ? (
            <div style={{ marginBottom: 16 }}>
              <button
                className="primary"
                style={{ marginBottom: 8 }}
                disabled={pushing}
                onClick={handlePushToDvr}
              >
                {pushing ? "Pushing…" : "Push to Channels DVR"}
              </button>
              {pushResult && (
                <div
                  style={{
                    fontSize: 13,
                    marginTop: 6,
                    color: pushResult.ok ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {pushResult.message}
                </div>
              )}
              <div className="meta" style={{ marginTop: 8 }}>
                Adds or updates this playlist as a Custom Channel (M3U) source in your Channels DVR
                server. The EPG guide is wired up automatically.
              </div>
            </div>
          ) : (
            <>
              <ol
                style={{
                  fontSize: 13,
                  color: "var(--text-dim)",
                  paddingLeft: 18,
                  margin: 0,
                  marginBottom: 16,
                }}
              >
                <li>Open the Channels DVR Server web admin</li>
                <li>Go to Settings → Sources → Add Source</li>
                <li>Choose Custom Channel (M3U)</li>
                <li>Paste the M3U playlist URL above and save</li>
              </ol>
              <div className="meta" style={{ marginBottom: 16 }}>
                The EPG guide URL is embedded in the M3U itself (as an{" "}
                <code style={{ fontSize: 11 }}>x-tvg-url</code> tag), so Channels DVR should pick up
                program data automatically — you shouldn't need to add it as a separate source. Set
                your Channels DVR URL in Settings to enable one-click push.
              </div>
            </>
          )}

          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Import into VLC</div>
          <ol
            style={{
              fontSize: 13,
              color: "var(--text-dim)",
              paddingLeft: 18,
              margin: 0,
              marginBottom: 12,
            }}
          >
            <li>Open VLC</li>
            <li>Media → Open Network Stream (Ctrl/Cmd + N)</li>
            <li>Paste the M3U playlist URL above</li>
            <li>Click Play</li>
          </ol>

          <CopyRow label="Or run directly from a terminal" value={vlcCommand} monospace />

          <div className="meta">
            VLC plays the stream but doesn't use the EPG guide URL — that's a Channels DVR (or
            similar DVR software) feature for program listings, not a video player one.
          </div>
        </div>

        <div className="actions" style={{ marginTop: 16 }}>
          <button className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
