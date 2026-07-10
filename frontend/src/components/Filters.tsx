import { ChannelFilters } from "../types";
import { titleCase, countryName } from "../textFormat";

interface Props {
  filters: ChannelFilters;
  onChange: (filters: ChannelFilters) => void;
  countries: string[];
  categories: string[];
}

export default function Filters({ filters, onChange, countries, categories }: Props) {
  const sortedCountries = [...countries].sort((a, b) => countryName(a).localeCompare(countryName(b)));

  return (
    <div className="filters">
      <div className="search-wrap" style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search channel name..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          style={{ paddingRight: filters.search ? 28 : undefined }}
        />
        {filters.search && (
          <button
            onClick={() => onChange({ ...filters, search: "" })}
            style={{ position: "absolute", right: 6, background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        )}
      </div>
      <select
        value={filters.country}
        onChange={(e) => onChange({ ...filters, country: e.target.value })}
      >
        <option value="">All countries</option>
        {sortedCountries.map((c) => (
          <option key={c} value={c}>
            {countryName(c)}
          </option>
        ))}
      </select>
      <select
        value={filters.category}
        onChange={(e) => onChange({ ...filters, category: e.target.value })}
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c === "__none__" ? "No category" : titleCase(c)}
          </option>
        ))}
      </select>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={filters.hasStream}
          onChange={(e) => onChange({ ...filters, hasStream: e.target.checked })}
        />
        Has Stream
        <span className="info-tip" data-tip="iptv-org tracks channels as a directory — not all have a known stream URL. Channels without one can't be added to a playlist.">i</span>
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={filters.hasEpg}
          onChange={(e) => onChange({ ...filters, hasEpg: e.target.checked })}
        />
        Has EPG
        <span className="info-tip" data-tip="EPG (Electronic Program Guide) provides schedule data. Only channels with a known EPG source will have guide info in Channels DVR.">i</span>
      </label>
    </div>
  );
}
