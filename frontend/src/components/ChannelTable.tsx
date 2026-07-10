import { Channel, ChannelFilters } from "../types";
import { countryName, countryFlag, titleCase } from "../textFormat";

interface Props {
  channels: Channel[];
  selectedIds: Set<string>;
  filters: ChannelFilters;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
  onRowClick: (channel: Channel) => void;
  onFilterChange: (patch: Partial<ChannelFilters>) => void;
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

const cellLink: React.CSSProperties = {
  cursor: "pointer",
  color: "var(--link)",
};

export default function ChannelTable({ channels, selectedIds, filters, onToggle, onToggleAll, onRowClick, onFilterChange, onBlock }: Props) {
  if (channels.length === 0) {
    return <div className="empty-state">No channels match these filters.</div>;
  }

  const allVisibleSelected = channels.every((c) => selectedIds.has(c.id));

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th style={{ width: 32 }}>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={() => onToggleAll(channels.map((c) => c.id))}
              />
            </th>
            <th className="hide-mobile"></th>
            <th>Name</th>
            <th className="hide-mobile">Country</th>
            <th className="hide-mobile">Category</th>
            <th className="hide-mobile">Stream</th>
            <th className="hide-mobile">EPG</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((ch) => {
            const selected = selectedIds.has(ch.id);
            const categories = ch.categories
              ? ch.categories.split(",").filter(Boolean)
              : [];

            return (
              <tr key={ch.id} className={selected ? "selected" : ""} style={{ cursor: "pointer" }} onClick={() => onToggle(ch.id)}>
                <td onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected} onChange={() => onToggle(ch.id)} />
                </td>
                <td className="hide-mobile">
                  {ch.logo ? (
                    <img
                      className="channel-logo"
                      src={ch.logo}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <span
                    className="channel-logo-fallback"
                    style={{ display: ch.logo ? "none" : "flex" }}
                  >
                    {initials(ch.name)}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <button className="icon-link" style={{ padding: 0, fontSize: 13 }} onClick={(e) => { e.stopPropagation(); onRowClick(ch); }}>{ch.name}</button>
                    {ch.isNsfw === 1 && (
                      <span className="badge" style={{ background: "#3d1a1a", color: "#f16c6c", fontSize: 10, flexShrink: 0 }}>NSFW</span>
                    )}
                    <button
                      className="danger-link"
                      style={{ padding: 0, fontSize: 11, opacity: 0.5, flexShrink: 0 }}
                      title="Block this channel"
                      onClick={(e) => { e.stopPropagation(); onBlock(ch); }}
                    >
                      Block
                    </button>
                  </div>
                </td>
                <td className="hide-mobile">
                  {ch.country ? (
                    <span
                      style={filters.country === ch.country ? undefined : cellLink}
                      onClick={() =>
                        ch.country && filters.country !== ch.country
                          ? onFilterChange({ country: ch.country })
                          : undefined
                      }
                    >
                      {countryFlag(ch.country)} {countryName(ch.country)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="hide-mobile">
                  {categories.length > 0 ? (
                    <span style={{ display: "flex", flexWrap: "wrap", gap: "0 6px" }}>
                      {categories.map((cat) => (
                        <span
                          key={cat}
                          className={filters.category === cat ? "badge category" : "badge category cell-link-plain"}
                          onClick={() =>
                            filters.category !== cat ? onFilterChange({ category: cat }) : undefined
                          }
                        >
                          {titleCase(cat)}
                        </span>
                      ))}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="hide-mobile">
                  {ch.streamUrl ? (
                    <span
                      className={filters.hasStream ? "badge stream" : "badge stream cell-link-plain"}
                      onClick={() => !filters.hasStream && onFilterChange({ hasStream: true })}
                    >
                      Available
                    </span>
                  ) : (
                    <span className="badge muted">Unavailable</span>
                  )}
                </td>
                <td className="hide-mobile">
                  {ch.epgSite ? (
                    <span
                      className={filters.hasEpg ? "badge epg" : "badge epg cell-link-plain"}
                      onClick={() => !filters.hasEpg && onFilterChange({ hasEpg: true })}
                    >
                      Available
                    </span>
                  ) : (
                    <span className="badge muted">Unavailable</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
