import { useEffect, useState } from "react";
import { Channel, Playlist } from "../types";
import { countryName, countryFlag, titleCase } from "../textFormat";
import { copyText } from "../clipboard";
import StreamPreview from "./StreamPreview";
import {
  fetchChannelStreams,
  fetchChannelPlaylists,
  fetchPlaylists,
  addChannelToPlaylist,
  fetchVpnEndpoints,
  assignChannelVpn,
  unassignChannelVpn,
  promoteChannelStream,
  VpnEndpoint,
} from "../api";

interface Props {
  channel: Channel;
  selected: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
  onBlock: (channel: Channel) => void;
  vpnEndpointId?: string;
  onVpnAssignmentChange?: (channelId: string, vpnEndpointId: string | null) => void;
  onStreamPromoted?: (channelId: string, streamUrl: string, streamQuality: string | null) => void;
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

export default function ChannelDetailModal({
  channel,
  selected,
  onToggle,
  onClose,
  onBlock,
  vpnEndpointId,
  onVpnAssignmentChange,
  onStreamPromoted,
}: Props) {
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [streams, setStreams] = useState<
    { url: string; quality: string | null; sortOrder: number }[]
  >([]);
  const [playlists, setPlaylists] = useState<{ id: string; name: string }[]>([]);
  const [allPlaylists, setAllPlaylists] = useState<Playlist[]>([]);
  const [addingToPlaylist, setAddingToPlaylist] = useState(false);
  const [vpnEndpoints, setVpnEndpoints] = useState<VpnEndpoint[]>([]);
  const [savingVpnAssignment, setSavingVpnAssignment] = useState(false);
  const [activeStreamUrl, setActiveStreamUrl] = useState(channel.streamUrl ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [promotingUrl, setPromotingUrl] = useState<string | null>(null);
  const [promoteError, setPromoteError] = useState<string | null>(null);

  useEffect(() => {
    setActiveStreamUrl(channel.streamUrl ?? null);
    setPreviewUrl(null);
    setPromoteError(null);
    fetchChannelStreams(channel.id)
      .then((r) => setStreams(r.streams))
      .catch(() => {});
    fetchChannelPlaylists(channel.id)
      .then((r) => setPlaylists(r.playlists))
      .catch(() => {});
    fetchPlaylists()
      .then((r) => setAllPlaylists(r.playlists))
      .catch(() => {});
    fetchVpnEndpoints()
      .then((r) => setVpnEndpoints(r.endpoints))
      .catch(() => {});
  }, [channel.id]);

  async function handleVpnChange(nextId: string) {
    setSavingVpnAssignment(true);
    try {
      if (nextId) {
        await assignChannelVpn(channel.id, nextId);
        onVpnAssignmentChange?.(channel.id, nextId);
      } else {
        await unassignChannelVpn(channel.id);
        onVpnAssignmentChange?.(channel.id, null);
      }
    } catch {
      // ignore — dropdown just won't reflect the change
    } finally {
      setSavingVpnAssignment(false);
    }
  }

  async function handlePromote(url: string) {
    setPromotingUrl(url);
    setPromoteError(null);
    try {
      const r = await promoteChannelStream(channel.id, url);
      setActiveStreamUrl(r.streamUrl);
      onStreamPromoted?.(channel.id, r.streamUrl as string, r.streamQuality);
    } catch (err) {
      setPromoteError(err instanceof Error ? err.message : "Failed to switch feed");
    } finally {
      setPromotingUrl(null);
    }
  }

  async function handleAddToPlaylist(playlistId: string) {
    setAddingToPlaylist(true);
    try {
      await addChannelToPlaylist(playlistId, channel.id);
      fetchChannelPlaylists(channel.id)
        .then((r) => setPlaylists(r.playlists))
        .catch(() => {});
    } catch {
      // ignore
    } finally {
      setAddingToPlaylist(false);
    }
  }

  async function copyUrl() {
    if (!activeStreamUrl) return;
    if (await copyText(activeStreamUrl)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const categories = channel.categories
    ? channel.categories.split(",").filter(Boolean).map(titleCase)
    : [];

  // The primary feed may not (yet) appear in channel_streams — e.g. right
  // after a manual DB edit — so make sure it's always represented as a row.
  const feedList =
    activeStreamUrl && !streams.some((s) => s.url === activeStreamUrl)
      ? [{ url: activeStreamUrl, quality: channel.streamQuality, sortOrder: -1 }, ...streams]
      : streams;
  const fallbackCount = feedList.filter((s) => s.url !== activeStreamUrl).length;

  return (
    <div className="iptv-dialog-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ width: "min(420px, 92vw)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          {channel.logo ? (
            <img
              src={channel.logo}
              alt=""
              style={{
                width: 56,
                height: 56,
                objectFit: "contain",
                borderRadius: 8,
                background: "#000",
              }}
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 8,
                background: "var(--accent-dim)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 16,
                color: "var(--text)",
                flexShrink: 0,
              }}
            >
              {initials(channel.name)}
            </div>
          )}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0 }}>{channel.name}</h3>
              {channel.isNsfw === 1 && (
                <span
                  className="badge"
                  style={{ background: "#3d1a1a", color: "#f16c6c", fontSize: 10 }}
                >
                  NSFW
                </span>
              )}
            </div>
            <div className="meta">
              {countryFlag(channel.country)} {countryName(channel.country)}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div className="meta" style={{ marginBottom: 4 }}>
            Categories
          </div>
          {categories.length > 0 ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {categories.map((c) => (
                <span key={c} className="badge category">
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <span className="meta">None listed</span>
          )}
        </div>

        <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <div className="meta" style={{ marginBottom: 4 }}>
              Stream
            </div>
            {activeStreamUrl ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span className="badge stream">Available</span>
                {channel.streamQuality && (
                  <span
                    className="badge"
                    style={{ background: "#1e2a1a", color: "#7fc87a", fontSize: 10 }}
                  >
                    {qualityLabel(channel.streamQuality)}
                  </span>
                )}
                {fallbackCount > 0 && (
                  <span className="meta" style={{ fontSize: 11 }}>
                    +{fallbackCount} fallback{fallbackCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            ) : (
              <span className="badge muted">None</span>
            )}
          </div>
          <div>
            <div className="meta" style={{ marginBottom: 4 }}>
              EPG guide
            </div>
            {channel.epgSite ? (
              <span className="badge epg">Available</span>
            ) : (
              <span className="badge muted">None</span>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div className="meta" style={{ marginBottom: 4 }}>
            Playlists
          </div>
          {playlists.length > 0 ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              {playlists.map((p) => (
                <span key={p.id} className="badge muted">
                  ✓ {p.name}
                </span>
              ))}
            </div>
          ) : (
            <div className="meta" style={{ marginBottom: 6 }}>
              Not in any playlist.
            </div>
          )}
          {allPlaylists.filter((p) => !playlists.some((mp) => mp.id === p.id)).length > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              <select
                defaultValue=""
                disabled={addingToPlaylist}
                onChange={(e) => {
                  if (e.target.value) handleAddToPlaylist(e.target.value);
                  e.target.value = "";
                }}
                style={{
                  flex: 1,
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  padding: "6px 10px",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                <option value="">Add to playlist…</option>
                {allPlaylists
                  .filter((p) => !playlists.some((mp) => mp.id === p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {channel.streamUrl && (
          <div style={{ marginBottom: 16 }}>
            <div className="meta" style={{ marginBottom: 4 }}>
              Route via VPN
            </div>
            <select
              value={vpnEndpointId || ""}
              disabled={savingVpnAssignment}
              onChange={(e) => handleVpnChange(e.target.value)}
              style={{
                width: "100%",
                background: "var(--panel)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                padding: "6px 10px",
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              <option value="">Direct (no proxy)</option>
              {vpnEndpoints.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.country ? ` (${e.country.toUpperCase()})` : ""}
                  {e.lastStatus === "down" ? " — down" : ""}
                </option>
              ))}
            </select>
            {vpnEndpoints.length === 0 && (
              <div className="meta" style={{ marginTop: 4 }}>
                No VPN endpoints registered yet — add one in Settings.
              </div>
            )}
          </div>
        )}

        {feedList.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="meta" style={{ marginBottom: 4 }}>
              Feeds ({feedList.length})
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                marginBottom: 10,
                maxHeight: 160,
                overflowY: "auto",
              }}
            >
              {feedList.map((s) => {
                const isActive = s.url === activeStreamUrl;
                const isSelected = s.url === (previewUrl ?? activeStreamUrl);
                return (
                  <label
                    key={s.url}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: isSelected ? "var(--accent-dim)" : "var(--panel)",
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="feed"
                      checked={isSelected}
                      onChange={() => {
                        setPreviewUrl(s.url);
                        setShowPreview(true);
                      }}
                      style={{ flexShrink: 0 }}
                    />
                    <code
                      style={{
                        fontSize: 11,
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={s.url}
                    >
                      {s.url}
                    </code>
                    {s.quality && (
                      <span className="badge" style={{ fontSize: 10, flexShrink: 0 }}>
                        {qualityLabel(s.quality)}
                      </span>
                    )}
                    {isActive && (
                      <span
                        className="badge"
                        style={{
                          background: "#1e2a1a",
                          color: "#7fc87a",
                          fontSize: 10,
                          flexShrink: 0,
                        }}
                      >
                        PRIMARY
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {(previewUrl ?? activeStreamUrl) && showPreview && (
              <StreamPreview
                streamUrl={(previewUrl ?? activeStreamUrl) as string}
                channelId={channel.id}
              />
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="secondary"
                style={{ flex: 1 }}
                onClick={() => setShowPreview((v) => !v)}
                disabled={!(previewUrl ?? activeStreamUrl)}
              >
                {showPreview ? "Hide preview" : "▶ Preview selected feed"}
              </button>
              <button
                className="primary"
                style={{ flex: 1 }}
                disabled={!previewUrl || previewUrl === activeStreamUrl || promotingUrl !== null}
                onClick={() => previewUrl && handlePromote(previewUrl)}
              >
                {promotingUrl ? "Switching…" : "Use this feed"}
              </button>
            </div>
            {promoteError && (
              <div className="meta" style={{ color: "#f16c6c", marginTop: 6, fontSize: 11 }}>
                {promoteError}
              </div>
            )}

            {activeStreamUrl && (
              <div className="url-field" style={{ marginTop: 10 }}>
                <code style={{ fontSize: 11 }}>{activeStreamUrl}</code>
                <button
                  className="icon-link"
                  style={{ padding: 0, flexShrink: 0 }}
                  onClick={copyUrl}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
          </div>
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
