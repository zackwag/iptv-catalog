import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchChannels,
  fetchCountries,
  fetchCategories,
  fetchPlaylist,
  createPlaylist,
  updatePlaylist,
  blockChannel,
  fetchPlaylistMembers,
  fetchChannelVpnAssignments,
} from "../api";
import { Channel, ChannelFilters } from "../types";
import Filters from "../components/Filters";
import ChannelTable from "../components/ChannelTable";
import SaveModal from "../components/SaveModal";
import ChannelDetailModal from "../components/ChannelDetailModal";

const emptyFilters: ChannelFilters = {
  search: "",
  country: "",
  category: "",
  hasStream: true,
  hasEpg: false,
};

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];
const DEFAULT_PAGE_SIZE = 50;

export default function CatalogPage() {
  const { id: editingPlaylistId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [filters, setFilters] = useState<ChannelFilters>(emptyFilters);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [countries, setCountries] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedChannels, setSelectedChannels] = useState<Map<string, Channel>>(new Map());
  const [playlistMemberIds, setPlaylistMemberIds] = useState<Set<string>>(new Set());
  const [vpnAssignments, setVpnAssignments] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem("catalogPageSize");
    const n = saved ? Number(saved) : NaN;
    return PAGE_SIZE_OPTIONS.includes(n) ? n : DEFAULT_PAGE_SIZE;
  });
  const [loading, setLoading] = useState(true);
  const [loadingEditTarget, setLoadingEditTarget] = useState(!!editingPlaylistId);
  const [error, setError] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [detailChannel, setDetailChannel] = useState<Channel | null>(null);

  useEffect(() => {
    fetchPlaylistMembers()
      .then((r) => setPlaylistMemberIds(new Set(r.channelIds)))
      .catch(() => {});
    fetchChannelVpnAssignments()
      .then((r) => setVpnAssignments(r.assignments))
      .catch(() => {});
  }, []);

  function handleVpnAssignmentChange(channelId: string, vpnEndpointId: string | null) {
    setVpnAssignments((prev) => {
      const next = { ...prev };
      if (vpnEndpointId) next[channelId] = vpnEndpointId;
      else delete next[channelId];
      return next;
    });
  }

  useEffect(() => {
    fetchCountries({
      search: filters.search,
      category: filters.category,
      hasStream: filters.hasStream,
      hasEpg: filters.hasEpg,
    })
      .then((r) => {
        setCountries(r.countries);
        if (filters.country && !r.countries.includes(filters.country)) {
          setFilters((prev) => ({ ...prev, country: "" }));
        }
      })
      .catch(() => {});
    fetchCategories({
      search: filters.search,
      country: filters.country,
      hasStream: filters.hasStream,
      hasEpg: filters.hasEpg,
    })
      .then((r) => {
        setCategories(r.categories);
        if (filters.category && !r.categories.includes(filters.category)) {
          setFilters((prev) => ({ ...prev, category: "" }));
        }
      })
      .catch(() => {});
  }, [filters]);

  // When arriving via /playlists/:id/edit, load that playlist's current
  // channel selection. A page refresh here re-fetches from the URL rather
  // than relying on any in-memory state, which is the point of real routes.
  useEffect(() => {
    if (!editingPlaylistId) {
      setSelectedIds(new Set());
      setSelectedChannels(new Map());
      setLoadingEditTarget(false);
      return;
    }
    setLoadingEditTarget(true);
    fetchPlaylist(editingPlaylistId)
      .then((p) => {
        setSelectedIds(new Set(p.channels.map((c) => c.id)));
        setSelectedChannels(new Map(p.channels.map((c) => [c.id, c])));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingEditTarget(false));
  }, [editingPlaylistId]);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const handle = setTimeout(() => {
      fetchChannels(filters, page, pageSize)
        .then((r) => {
          setChannels(r.channels);
          setTotal(r.total);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250); // debounce search typing

    return () => clearTimeout(handle);
  }, [filters, page, pageSize]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
      setSelectedChannels((prev) => {
        const m = new Map(prev);
        m.delete(id);
        return m;
      });
    } else {
      next.add(id);
      const ch = channels.find((c) => c.id === id);
      if (ch) setSelectedChannels((prev) => new Map(prev).set(id, ch));
    }
    setSelectedIds(next);
  }

  function toggleAll(ids: string[]) {
    const allSelected = ids.every((id) => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) {
      ids.forEach((id) => next.delete(id));
      setSelectedChannels((prev) => {
        const m = new Map(prev);
        ids.forEach((id) => m.delete(id));
        return m;
      });
    } else {
      ids.forEach((id) => next.add(id));
      setSelectedChannels((prev) => {
        const m = new Map(prev);
        channels.forEach((ch) => {
          if (ids.includes(ch.id)) m.set(ch.id, ch);
        });
        return m;
      });
    }
    setSelectedIds(next);
  }

  async function handleSaveNew(name: string) {
    setSaving(true);
    try {
      await createPlaylist(name, Array.from(selectedIds));
      setShowSaveModal(false);
      navigate("/playlists");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleBlock(channel: Channel) {
    if (
      !confirm(
        `Block "${channel.name}"? It will be removed from all playlists and hidden from Browse Channels.`
      )
    )
      return;
    try {
      await blockChannel(channel.id);
      setChannels((prev) => prev.filter((c) => c.id !== channel.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(channel.id);
        return next;
      });
      setSelectedChannels((prev) => {
        const m = new Map(prev);
        m.delete(channel.id);
        return m;
      });
      if (detailChannel?.id === channel.id) setDetailChannel(null);
      setTotal((prev) => prev - 1);
      setToast(`"${channel.name}" blocked.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleBulkBlock() {
    const count = selectedIds.size;
    if (
      !confirm(
        `Block ${count} channel${count === 1 ? "" : "s"}? They will be removed from all playlists and hidden from Browse Channels.`
      )
    )
      return;
    const ids = Array.from(selectedIds);
    let blocked = 0;
    for (const id of ids) {
      try {
        await blockChannel(id);
        blocked++;
      } catch {
        /* continue */
      }
    }
    setChannels((prev) => prev.filter((c) => !ids.includes(c.id)));
    setSelectedIds(new Set());
    setSelectedChannels(new Map());
    setTotal((prev) => prev - blocked);
    setToast(`${blocked} channel${blocked === 1 ? "" : "s"} blocked.`);
  }

  async function handleUpdateExisting() {
    if (!editingPlaylistId) return;
    setSaving(true);
    try {
      await updatePlaylist(editingPlaylistId, { channelIds: Array.from(selectedIds) });
      navigate("/playlists");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loadingEditTarget) {
    return <div className="empty-state">Loading playlist…</div>;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <>
      {editingPlaylistId && (
        <div className="badge" style={{ marginBottom: 12, display: "inline-block" }}>
          Editing existing playlist — selection changes will update it, not create a new one
        </div>
      )}

      <Filters
        filters={filters}
        onChange={setFilters}
        countries={countries}
        categories={categories}
      />

      {error && (
        <div className="empty-state" style={{ color: "var(--danger)" }}>
          {error}
        </div>
      )}
      {loading ? (
        <div className="empty-state">Loading channels…</div>
      ) : (
        <>
          <ChannelTable
            channels={channels}
            selectedIds={selectedIds}
            selectedChannels={selectedChannels}
            playlistMemberIds={playlistMemberIds}
            vpnRoutedIds={new Set(Object.keys(vpnAssignments))}
            filters={filters}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onRowClick={setDetailChannel}
            onFilterChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
            onBlock={handleBlock}
          />
          {total > 0 && (
            <div className="pagination">
              <div className="pagination-nav">
                <button
                  className="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span className="range-text">
                  {rangeStart}–{rangeEnd} of {total}
                </span>
                <select
                  value={page}
                  onChange={(e) => setPage(Number(e.target.value))}
                  style={{
                    background: "var(--panel)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    borderRadius: 6,
                    padding: "6px 8px",
                    fontSize: 13,
                  }}
                >
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      Page {n} of {totalPages}
                    </option>
                  ))}
                </select>
                <button
                  className="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
              <select
                className="pagination-size"
                value={pageSize}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  localStorage.setItem("catalogPageSize", String(n));
                  setPageSize(n);
                }}
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  borderRadius: 6,
                  padding: "6px 8px",
                  fontSize: 13,
                }}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} per page
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      <div className="selection-bar">
        <span className="count">
          {selectedIds.size} channel{selectedIds.size === 1 ? "" : "s"} selected
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {selectedIds.size > 0 && (
            <>
              <button
                className="secondary"
                onClick={() => {
                  setSelectedIds(new Set());
                  setSelectedChannels(new Map());
                }}
              >
                Clear
              </button>
              <button
                className="secondary"
                style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                onClick={handleBulkBlock}
              >
                Block {selectedIds.size}
              </button>
            </>
          )}
          {editingPlaylistId ? (
            <>
              <button className="secondary" onClick={() => navigate("/playlists")}>
                Cancel edit
              </button>
              <button className="primary" disabled={saving} onClick={handleUpdateExisting}>
                {saving ? "Saving…" : "Update playlist"}
              </button>
            </>
          ) : (
            <button
              className="primary"
              disabled={selectedIds.size === 0}
              onClick={() => setShowSaveModal(true)}
            >
              Save as playlist
            </button>
          )}
        </div>
      </div>

      {showSaveModal && (
        <SaveModal onSave={handleSaveNew} onCancel={() => setShowSaveModal(false)} />
      )}

      {detailChannel && (
        <ChannelDetailModal
          channel={detailChannel}
          selected={selectedIds.has(detailChannel.id)}
          onToggle={toggle}
          onClose={() => setDetailChannel(null)}
          onBlock={handleBlock}
          vpnEndpointId={vpnAssignments[detailChannel.id]}
          onVpnAssignmentChange={handleVpnAssignmentChange}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
