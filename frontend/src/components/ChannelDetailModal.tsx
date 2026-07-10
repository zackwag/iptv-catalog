import { useEffect, useState } from "react";
import { Channel } from "../types";
import { countryName, countryFlag, titleCase } from "../textFormat";
import StreamPreview from "./StreamPreview";
import { fetchChannelStreams, fetchChannelPlaylists } from "../api";

interface Props {
  channel: Channel;
  selected: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
  onBlock: (channel: Channel) => void;
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function qualityLabel(q: string | null): string {
  if (!q) return "";
  return q.toUpperCase();
}

export default function ChannelDetailModal({ channel, selected, onToggle, onClose, onBlock }: Props) {
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [streams, setStreams] = useState<{ url: string; quality: string | null; sortOrder: number }[]>([]);
  const [playlists, setPlaylists] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchChannelStreams(channel.id).then(r => setStreams(r.streams)).catch(() => {});
    fetchChannelPlaylists(channel.id).then(r => setPlaylists(r.playlists)).catch(() => {});
  }, [channel.id]);

  function copyUrl() {
    navigator.clipboard.writeText(channel.streamUrl!);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const categories = channel.categories
    ? channel.categories.split(",").filter(Boolean).map(titleCase)
    : [];

  const fallbackCount = streams.filter(s => s.url !== channel.streamUrl).length;

  return (
    <div className="iptv-dialog-overlay" onClick={onClose}>
      <div className="modal" style={{ width: "min(420px, 92vw)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          {channel.logo ? (
            <img
              src={channel.logo}
              alt=""
              style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8, background: "#000" }}
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div
              style={{
                width: 56, height: 56, borderRadius: 8, background: "var(--accent-dim)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 16, color: "var(--text)", flexShrink: 0,
              }}
            >
              {initials(channel.name)}
            </div>
          )}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0 }}>{channel.name}</h3>
              {channel.isNsfw === 1 && (
                <span className="badge" style={{ background: "#3d1a1a", color: "#f16c6c", fontSize: 10 }}>NSFW</span>
              )}
            </div>
            <div className="meta">
              {countryFlag(channel.country)} {countryName(channel.country)}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div className="meta" style={{ marginBottom: 4 }}>Categories</div>
          {categories.length > 0 ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {categories.map((c) => (
                <span key={c} className="badge category">{c}</span>
              ))}
            </div>
          ) : (
            <span className="meta">None listed</span>
          )}
        </div>

        <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <div className="meta" style={{ marginBottom: 4 }}>Stream</div>
            {channel.streamUrl ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span className="badge stream">Available</span>
                {channel.streamQuality && (
                  <span className="badge" style={{ background: "#1e2a1a", color: "#7fc87a", fontSize: 10 }}>
                    {qualityLabel(channel.streamQuality)}
                  </span>
                )}
                {fallbackCount > 0 && (
                  <span className="meta" style={{ fontSize: 11 }}>+{fallbackCount} fallback{fallbackCount > 1 ? "s" : ""}</span>
                )}
              </div>
            ) : (
              <span className="badge muted">None</span>
            )}
          </div>
          <div>
            <div className="meta" style={{ marginBottom: 4 }}>EPG guide</div>
            {channel.epgSite ? <span className="badge epg">Available</span> : <span className="badge muted">None</span>}
          </div>
        </div>

        {playlists.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="meta" style={{ marginBottom: 4 }}>In playlists</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {playlists.map(p => (
                <span key={p.id} className="badge muted">{p.name}</span>
              ))}
            </div>
          </div>
        )}

        {channel.streamUrl && (
          <>
            {showPreview ? (
              <StreamPreview streamUrl={channel.streamUrl} />
            ) : (
              <div style={{ marginBottom: 16 }}>
                <button className="secondary" style={{ width: "100%" }} onClick={() => setShowPreview(true)}>
                  ▶ Preview stream
                </button>
              </div>
            )}
            <div className="url-field" style={{ marginBottom: 16 }}>
              <code style={{ fontSize: 11 }}>{channel.streamUrl}</code>
              <button className="icon-link" style={{ padding: 0, flexShrink: 0 }} onClick={copyUrl}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </>
        )}

        <div className="actions" style={{ justifyContent: "stretch" }}>
          <button className="primary" style={{ flex: 1 }} onClick={() => onToggle(channel.id)}>
            {selected ? "Remove from selection" : "Add to selection"}
          </button>
          <button className="secondary" style={{ flex: 1 }} onClick={onClose}>
            Close
          </button>
        </div>
        <div style={{ marginTop: 10, textAlign: "center" }}>
          <button className="danger-link" style={{ fontSize: 12 }} onClick={() => onBlock(channel)}>
            Block this channel
          </button>
        </div>
      </div>
    </div>
  );
}
