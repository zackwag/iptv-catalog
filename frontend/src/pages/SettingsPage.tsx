import { useEffect, useState } from "react";
import { fetchSettings, updateSettings, triggerCatalogRefresh, fetchCountries, fetchCategories, fetchBlockedChannels, unblockChannel, AppSettings, ThemeMode, BlockedChannel } from "../api";
import { applyTheme, watchSystemTheme } from "../theme";
import { describeCron } from "../cronFormat";
import { countryName } from "../textFormat";

const PRESETS: { label: string; value: string }[] = [
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Daily at 4:00 AM", value: "0 4 * * *" },
  { label: "Twice daily (4 AM / 4 PM)", value: "0 4,16 * * *" },
  { label: "Weekly (Sunday, 4:00 AM)", value: "0 4 * * 0" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [preset, setPreset] = useState<string>("custom");
  const [customCron, setCustomCron] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const [autoRemoveEnabled, setAutoRemoveEnabled] = useState(false);
  const [autoRemoveThreshold, setAutoRemoveThreshold] = useState("3");
  const [savingAutoRemove, setSavingAutoRemove] = useState(false);
  const [autoRemoveMessage, setAutoRemoveMessage] = useState<string | null>(null);

  const [webhookDraft, setWebhookDraft] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookMessage, setWebhookMessage] = useState<string | null>(null);

  const [baseUrlDraft, setBaseUrlDraft] = useState("");
  const [savingBaseUrl, setSavingBaseUrl] = useState(false);
  const [baseUrlMessage, setBaseUrlMessage] = useState<string | null>(null);

  const [dvrUrlDraft, setDvrUrlDraft] = useState("");
  const [savingDvrUrl, setSavingDvrUrl] = useState(false);
  const [dvrUrlMessage, setDvrUrlMessage] = useState<string | null>(null);

  const [blockedCountries, setBlockedCountries] = useState<string[]>([]);
  const [blockedCategories, setBlockedCategories] = useState<string[]>([]);
  const [blockStreamDomainsDraft, setBlockStreamDomainsDraft] = useState("");
  const [savingBlockDomains, setSavingBlockDomains] = useState(false);
  const [blockDomainsMessage, setBlockDomainsMessage] = useState<string | null>(null);
  const [allCountries, setAllCountries] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [countryPickerVal, setCountryPickerVal] = useState("");
  const [categoryPickerVal, setCategoryPickerVal] = useState("");
  const [blockedChannels, setBlockedChannels] = useState<BlockedChannel[]>([]);
  const [blocklistPurgeMessage, setBlocklistPurgeMessage] = useState<string | null>(null);
  const [blockNsfw, setBlockNsfw] = useState(false);

  const [epgStalenessDraft, setEpgStalenessDraft] = useState("12");
  const [savingEpgStaleness, setSavingEpgStaleness] = useState(false);
  const [epgStalenessMessage, setEpgStalenessMessage] = useState<string | null>(null);

  const [themeDraft, setThemeDraft] = useState<ThemeMode>("dark");
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeMessage, setThemeMessage] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetchSettings()
      .then((s) => {
        setSettings(s);
        const matchedPreset = PRESETS.find((p) => p.value === s.catalogRefreshCron);
        setPreset(matchedPreset ? matchedPreset.value : "custom");
        setCustomCron(s.catalogRefreshCron);
        setAutoRemoveEnabled(s.autoRemoveFailedChannels);
        setAutoRemoveThreshold(String(s.autoRemoveFailureThreshold));
        setWebhookDraft(s.webhookUrl);
        setBaseUrlDraft(s.publicBaseUrl);
        setEpgStalenessDraft(String(s.epgStalenessWarningHours));
        setThemeDraft(s.theme);
        setDvrUrlDraft(s.channelsDvrUrl || "");
        setBlockedCountries(s.blockCountries ? s.blockCountries.split(",").map(x => x.trim()).filter(Boolean) : []);
        setBlockedCategories(s.blockCategories ? s.blockCategories.split(",").map(x => x.trim()).filter(Boolean) : []);
        setBlockStreamDomainsDraft(s.blockStreamDomains || "");
        setBlockNsfw(s.blockNsfw ?? false);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  useEffect(() => {
    fetchCountries().then(r => setAllCountries([...r.countries].sort()));
    fetchCategories().then(r => setAllCategories([...r.categories].filter(c => c !== "__none__").sort()));
    fetchBlockedChannels().then(r => setBlockedChannels(r.channels));
  }, []);

  const effectiveCron = preset === "custom" ? customCron : preset;

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      const updated = await updateSettings({ catalogRefreshCron: effectiveCron });
      setSettings(updated);
      setSaveMessage("Schedule updated — takes effect immediately, no restart needed.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRefreshNow() {
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      const result = await triggerCatalogRefresh();
      if (result.ok) {
        setRefreshMessage(`Refreshed ${result.channelCount} channels.`);
        load();
      } else {
        setRefreshMessage(`Refresh failed: ${result.error}`);
      }
    } catch (e) {
      setRefreshMessage(`Refresh failed: ${(e as Error).message}`);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleToggleAutoRemove(enabled: boolean) {
    setAutoRemoveEnabled(enabled);
    setSavingAutoRemove(true);
    setAutoRemoveMessage(null);
    try {
      const updated = await updateSettings({
        autoRemoveFailedChannels: enabled,
        autoRemoveFailureThreshold: Number(autoRemoveThreshold) || 3,
      });
      setSettings(updated);
      setAutoRemoveMessage(enabled ? "Auto-removal enabled." : "Auto-removal disabled.");
    } catch (e) {
      setAutoRemoveEnabled(!enabled); // revert on failure
      setError((e as Error).message);
    } finally {
      setSavingAutoRemove(false);
    }
  }

  async function handleSaveThreshold() {
    const threshold = Number(autoRemoveThreshold);
    if (!Number.isInteger(threshold) || threshold <= 0) {
      setError("Threshold must be a positive whole number");
      return;
    }
    setSavingAutoRemove(true);
    setAutoRemoveMessage(null);
    try {
      const updated = await updateSettings({ autoRemoveFailureThreshold: threshold });
      setSettings(updated);
      setAutoRemoveMessage("Threshold updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingAutoRemove(false);
    }
  }

  async function handleSaveWebhook() {
    setSavingWebhook(true);
    setWebhookMessage(null);
    setError(null);
    try {
      const updated = await updateSettings({ webhookUrl: webhookDraft.trim() });
      setSettings(updated);
      setWebhookMessage(webhookDraft.trim() ? "Webhook URL saved." : "Webhook disabled.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingWebhook(false);
    }
  }

  async function handleSaveBaseUrl() {
    setSavingBaseUrl(true);
    setBaseUrlMessage(null);
    setError(null);
    try {
      const updated = await updateSettings({ publicBaseUrl: baseUrlDraft.trim() });
      setSettings(updated);
      setBaseUrlDraft(updated.publicBaseUrl);
      setBaseUrlMessage(updated.publicBaseUrl ? "Override saved." : "Reverted to auto-detect.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingBaseUrl(false);
    }
  }

  async function handleSaveDvrUrl() {
    setSavingDvrUrl(true);
    setDvrUrlMessage(null);
    setError(null);
    try {
      const updated = await updateSettings({ channelsDvrUrl: dvrUrlDraft.trim() });
      setSettings(updated);
      setDvrUrlDraft(updated.channelsDvrUrl || "");
      setDvrUrlMessage(updated.channelsDvrUrl ? "Channels DVR URL saved." : "Channels DVR URL cleared.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingDvrUrl(false);
    }
  }

  async function handleSaveEpgStaleness() {
    const hours = Number(epgStalenessDraft);
    if (!Number.isInteger(hours) || hours <= 0) {
      setError("Staleness threshold must be a positive whole number of hours");
      return;
    }
    setSavingEpgStaleness(true);
    setEpgStalenessMessage(null);
    setError(null);
    try {
      const updated = await updateSettings({ epgStalenessWarningHours: hours });
      setSettings(updated);
      setEpgStalenessMessage("Threshold updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingEpgStaleness(false);
    }
  }

  async function handleSaveTheme(mode: ThemeMode) {
    setThemeDraft(mode);
    setSavingTheme(true);
    setThemeMessage(null);
    setError(null);
    try {
      const updated = await updateSettings({ theme: mode });
      setSettings(updated);
      applyTheme(mode);
      watchSystemTheme(mode);
      setThemeMessage("Appearance saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingTheme(false);
    }
  }

  async function saveBlockedCountries(next: string[]) {
    setBlockedCountries(next);
    try {
      const updated = await updateSettings({ blockCountries: next.join(",") });
      setSettings(updated);
      if (updated.purgedFromPlaylists) setBlocklistPurgeMessage(`Removed ${updated.purgedFromPlaylists} channel(s) from playlists.`);
    } catch (e) { setError((e as Error).message); }
  }

  async function saveBlockedCategories(next: string[]) {
    setBlockedCategories(next);
    try {
      const updated = await updateSettings({ blockCategories: next.join(",") });
      setSettings(updated);
      if (updated.purgedFromPlaylists) setBlocklistPurgeMessage(`Removed ${updated.purgedFromPlaylists} channel(s) from playlists.`);
    } catch (e) { setError((e as Error).message); }
  }

  async function handleUnblockChannel(channelId: string) {
    try {
      await unblockChannel(channelId);
      setBlockedChannels(prev => prev.filter(c => c.channelId !== channelId));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleToggleBlockNsfw(enabled: boolean) {
    setBlockNsfw(enabled);
    try {
      const updated = await updateSettings({ blockNsfw: enabled });
      setSettings(updated);
      if (updated.purgedFromPlaylists) setBlocklistPurgeMessage(`Removed ${updated.purgedFromPlaylists} channel(s) from playlists.`);
    } catch (e) {
      setBlockNsfw(!enabled);
      setError((e as Error).message);
    }
  }

  async function handleSaveBlockDomains() {
    setSavingBlockDomains(true);
    setBlockDomainsMessage(null);
    setError(null);
    try {
      const updated = await updateSettings({ blockStreamDomains: blockStreamDomainsDraft.trim() });
      setSettings(updated);
      setBlockDomainsMessage(updated.purgedFromPlaylists
        ? `Saved. Removed ${updated.purgedFromPlaylists} channel(s) from playlists.`
        : "Saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingBlockDomains(false);
    }
  }

  if (loading) return <div className="empty-state">Loading settings…</div>;

  return (
    <div className="settings-grid">
      <div className="settings-section-heading">Appearance</div>
      <div className="playlist-card">
        <h3>Theme</h3>
        <div className="meta" style={{ marginBottom: 14 }}>
          Applies immediately and is shared across anyone using this instance — it's a server
          setting, not a per-browser preference.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["light", "dark", "system"] as ThemeMode[]).map((mode) => (
            <button
              key={mode}
              className={themeDraft === mode ? "primary" : "secondary"}
              disabled={savingTheme}
              onClick={() => handleSaveTheme(mode)}
            >
              {mode === "system" ? "Follow system" : mode[0].toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        {themeMessage && (
          <div style={{ fontSize: 13, color: "var(--success)", marginTop: 10 }}>{themeMessage}</div>
        )}
      </div>

      <div className="settings-section-heading">Catalog</div>
      <div className="playlist-card">
        <h3>Refresh schedule</h3>
        <div className="meta" style={{ marginBottom: 14 }}>
          Controls how often channels, streams, and EPG source mappings are re-pulled from
          iptv-org. Changing this takes effect right away — the running schedule is updated
          in place, no container restart required.
        </div>

        <div className="filters" style={{ marginBottom: 10 }}>
          <select value={preset} onChange={(e) => setPreset(e.target.value)}>
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom cron expression…</option>
          </select>
        </div>

        {preset === "custom" && (
          <>
            <input
              type="text"
              placeholder="e.g. 0 4 * * *"
              value={customCron}
              onChange={(e) => setCustomCron(e.target.value)}
              style={{ width: "100%", marginBottom: 6 }}
            />
            {customCron.trim() && (
              <div className="meta" style={{ marginBottom: 10 }}>
                {describeCron(customCron.trim())}
              </div>
            )}
          </>
        )}

        {error && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{error}</div>}
        {saveMessage && <div style={{ color: "var(--success)", fontSize: 13, marginBottom: 10 }}>{saveMessage}</div>}

        <button className="primary" disabled={saving || !effectiveCron.trim()} onClick={handleSave}>
          {saving ? "Saving…" : "Save schedule"}
        </button>
      </div>

      <div className="playlist-card">
        <h3>Manual refresh</h3>

        <div className="meta" style={{ marginBottom: 14 }}>
          Last synced:{" "}
          {settings?.catalogRefreshedAt
            ? new Date(settings.catalogRefreshedAt).toLocaleString()
            : "never"}
        </div>
        <button className="secondary" disabled={refreshing} onClick={handleRefreshNow}>
          {refreshing ? "Refreshing…" : "Refresh catalog now"}
        </button>
        {refreshMessage && (
          <div style={{ fontSize: 13, marginTop: 10, color: "var(--text-dim)" }}>{refreshMessage}</div>
        )}
      </div>

      <div className="settings-section-heading">EPG</div>
      <div className="playlist-card">
        <h3>Sidecar health</h3>
        <div className="meta" style={{ marginBottom: 14 }}>
          The <code style={{ fontSize: 11 }}>iptv-org/epg</code> container generates program
          guide data on its own schedule (its own <code style={{ fontSize: 11 }}>CRON_SCHEDULE</code>,
          separate from this app). This reports whether it's actually still producing fresh data.
        </div>
        {settings?.epgHealth.isStale ? (
          <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 14 }}>
            ⚠{" "}
            {settings.epgHealth.lastGeneratedAt
              ? `Guide data hasn't updated in over ${settings.epgHealth.staleThresholdHours}h (last: ${new Date(
                  settings.epgHealth.lastGeneratedAt
                ).toLocaleString()}). Check the epg container's logs.`
              : "Guide data has never been generated yet. Check the epg container's logs."}
          </div>
        ) : (
          <div style={{ color: "var(--success)", fontSize: 13, marginBottom: 14 }}>
            ✓ Fresh — last generated{" "}
            {settings?.epgHealth.lastGeneratedAt
              ? new Date(settings.epgHealth.lastGeneratedAt).toLocaleString()
              : "never"}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="meta">Flag as stale after</span>
          <input
            type="number"
            min={1}
            value={epgStalenessDraft}
            onChange={(e) => setEpgStalenessDraft(e.target.value)}
            style={{ width: 60 }}
          />
          <span className="meta">hours with no update</span>
          <button
            className="secondary"
            disabled={savingEpgStaleness || epgStalenessDraft === String(settings?.epgStalenessWarningHours)}
            onClick={handleSaveEpgStaleness}
          >
            Save
          </button>
        </div>
        {epgStalenessMessage && (
          <div style={{ fontSize: 13, color: "var(--success)", marginTop: 8 }}>{epgStalenessMessage}</div>
        )}
      </div>

      <div className="settings-section-heading">Channel health</div>
      <div className="playlist-card">
        <h3>Auto-remove failing channels</h3>
        <div className="meta" style={{ marginBottom: 14 }}>
          Off by default. When enabled, a channel is dropped from its playlist after this many
          consecutive failed checks — you'll still get a notification when it happens, so
          nothing disappears silently.
        </div>

        <label className="checkbox" style={{ marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={autoRemoveEnabled}
            disabled={savingAutoRemove}
            onChange={(e) => handleToggleAutoRemove(e.target.checked)}
          />
          Auto-remove after repeated failures
        </label>

        {autoRemoveEnabled && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span className="meta">Consecutive failures before removal:</span>
            <input
              type="number"
              min={1}
              value={autoRemoveThreshold}
              onChange={(e) => setAutoRemoveThreshold(e.target.value)}
              style={{ width: 60 }}
            />
            <button
              className="secondary"
              disabled={savingAutoRemove || autoRemoveThreshold === String(settings?.autoRemoveFailureThreshold)}
              onClick={handleSaveThreshold}
            >
              Save
            </button>
          </div>
        )}

        {autoRemoveMessage && (
          <div style={{ fontSize: 13, color: "var(--success)" }}>{autoRemoveMessage}</div>
        )}
      </div>

      <div className="settings-section-heading">Blocklists</div>
      {blocklistPurgeMessage && (
        <div style={{ fontSize: 13, color: "var(--success)", gridColumn: "1 / -1" }}>{blocklistPurgeMessage}</div>
      )}
      <div className="playlist-card">
        <h3>Block countries</h3>
        <div className="meta" style={{ marginBottom: 10 }}>
          Channels from blocked countries are hidden from Browse Channels.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <select
            value={countryPickerVal}
            onChange={(e) => setCountryPickerVal(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">Add a country…</option>
            {allCountries
              .filter(c => !blockedCountries.includes(c.toLowerCase()))
              .map(c => (
                <option key={c} value={c}>{countryName(c)} ({c})</option>
              ))}
          </select>
          <button
            className="secondary"
            disabled={!countryPickerVal}
            onClick={() => {
              if (countryPickerVal) {
                saveBlockedCountries([...blockedCountries, countryPickerVal.toLowerCase()]);
                setCountryPickerVal("");
              }
            }}
          >
            Add
          </button>
        </div>
        {blockedCountries.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {blockedCountries.map(c => (
              <span key={c} className="badge muted" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {c}
                <button
                  onClick={() => saveBlockedCountries(blockedCountries.filter(x => x !== c))}
                  style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 13 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="meta">No countries blocked.</div>
        )}
      </div>

      <div className="playlist-card">
        <h3>Block categories</h3>
        <div className="meta" style={{ marginBottom: 10 }}>
          Channels in blocked categories are hidden from Browse Channels.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <select
            value={categoryPickerVal}
            onChange={(e) => setCategoryPickerVal(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">Add a category…</option>
            {allCategories
              .filter(c => !blockedCategories.includes(c.toLowerCase()))
              .map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
          </select>
          <button
            className="secondary"
            disabled={!categoryPickerVal}
            onClick={() => {
              if (categoryPickerVal) {
                saveBlockedCategories([...blockedCategories, categoryPickerVal.toLowerCase()]);
                setCategoryPickerVal("");
              }
            }}
          >
            Add
          </button>
        </div>
        {blockedCategories.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {blockedCategories.map(c => (
              <span key={c} className="badge muted" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {c}
                <button
                  onClick={() => saveBlockedCategories(blockedCategories.filter(x => x !== c))}
                  style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 13 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="meta">No categories blocked.</div>
        )}
      </div>

      <div className="playlist-card">
        <h3>Block NSFW content</h3>
        <div className="meta" style={{ marginBottom: 10 }}>
          When enabled, channels flagged as adult/NSFW in the iptv-org catalog are hidden from Browse Channels and removed from playlists.
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={blockNsfw}
            onChange={(e) => handleToggleBlockNsfw(e.target.checked)}
          />
          Hide NSFW channels
        </label>
      </div>

      <div className="playlist-card">
        <h3>Block stream domains</h3>
        <div className="meta" style={{ marginBottom: 10 }}>
          Channels whose stream URL contains any listed domain are hidden. Comma-separated, matched as a substring.
        </div>
        <input
          type="text"
          placeholder="e.g. example.com, badhost.net"
          value={blockStreamDomainsDraft}
          onChange={(e) => setBlockStreamDomainsDraft(e.target.value)}
          style={{ width: "100%", marginBottom: 10 }}
        />
        <button
          className="primary"
          disabled={savingBlockDomains || blockStreamDomainsDraft.trim() === (settings?.blockStreamDomains || "")}
          onClick={handleSaveBlockDomains}
        >
          {savingBlockDomains ? "Saving…" : "Save"}
        </button>
        {blockDomainsMessage && (
          <div style={{ fontSize: 13, color: "var(--success)", marginTop: 8 }}>{blockDomainsMessage}</div>
        )}
      </div>

      <div className="playlist-card">
        <h3>Blocked channels</h3>
        <div className="meta" style={{ marginBottom: 10 }}>
          Individually blocked via the Browse Channels table. Click × to unblock.
        </div>
        {blockedChannels.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {blockedChannels.map(c => (
              <span key={c.channelId} className="badge muted" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {c.name || c.channelId}
                <button
                  onClick={() => handleUnblockChannel(c.channelId)}
                  style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 13 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="meta">No individually blocked channels.</div>
        )}
      </div>

      <div className="settings-section-heading">Integrations</div>
      <div className="playlist-card">
        <h3>Webhook notifications</h3>
        <div className="meta" style={{ marginBottom: 14 }}>
          Optional. Fires a <code style={{ fontSize: 11 }}>POST</code> with a JSON body whenever
          a channel starts failing or gets auto-removed — leave blank to disable. Works with any
          endpoint that can receive a webhook, including Home Assistant's REST/webhook triggers.
        </div>

        <input
          type="text"
          placeholder="https://your-server/webhook"
          value={webhookDraft}
          onChange={(e) => setWebhookDraft(e.target.value)}
          style={{ width: "100%", marginBottom: 10 }}
        />

        <button
          className="primary"
          disabled={savingWebhook || webhookDraft.trim() === (settings?.webhookUrl || "")}
          onClick={handleSaveWebhook}
        >
          {savingWebhook ? "Saving…" : "Save webhook URL"}
        </button>

        {webhookMessage && (
          <div style={{ fontSize: 13, color: "var(--success)", marginTop: 10 }}>{webhookMessage}</div>
        )}

        <div className="meta" style={{ marginTop: 12, fontSize: 11 }}>
          Payload: <code style={{ fontSize: 11 }}>
            {`{ event: "channel_failing" | "channel_removed", playlistName, channelName, message, timestamp }`}
          </code>
        </div>
      </div>

      <div className="playlist-card">
        <h3>Channels DVR</h3>
        <div className="meta" style={{ marginBottom: 14 }}>
          Optional. Set your Channels DVR server URL to enable one-click "Push to Channels DVR"
          from any playlist's Export menu. Format:{" "}
          <code style={{ fontSize: 11 }}>http://192.168.1.50:8089</code>
        </div>

        <input
          type="text"
          placeholder="http://192.168.1.50:8089 (leave blank to disable)"
          value={dvrUrlDraft}
          onChange={(e) => setDvrUrlDraft(e.target.value)}
          style={{ width: "100%", marginBottom: 10 }}
        />

        <button
          className="primary"
          disabled={savingDvrUrl || dvrUrlDraft.trim() === (settings?.channelsDvrUrl || "")}
          onClick={handleSaveDvrUrl}
        >
          {savingDvrUrl ? "Saving…" : "Save Channels DVR URL"}
        </button>

        {dvrUrlMessage && (
          <div style={{ fontSize: 13, color: "var(--success)", marginTop: 10 }}>{dvrUrlMessage}</div>
        )}
      </div>

      <div className="settings-section-heading">Advanced</div>
      <div className="playlist-card">
        <h3>Public URL override</h3>
        <div className="meta" style={{ marginBottom: 14 }}>
          Controls the host:port used when building each playlist's M3U/EPG URLs. Leave blank to
          auto-detect from the request (works for most setups) — only set this if that detection
          picks the wrong address, e.g. behind a reverse proxy.
        </div>

        <input
          type="text"
          placeholder="http://192.168.4.50:6932 (leave blank for auto-detect)"
          value={baseUrlDraft}
          onChange={(e) => setBaseUrlDraft(e.target.value)}
          style={{ width: "100%", marginBottom: 10 }}
        />

        <button
          className="primary"
          disabled={savingBaseUrl || baseUrlDraft.trim() === (settings?.publicBaseUrl || "")}
          onClick={handleSaveBaseUrl}
        >
          {savingBaseUrl ? "Saving…" : "Save override"}
        </button>

        {baseUrlMessage && (
          <div style={{ fontSize: 13, color: "var(--success)", marginTop: 10 }}>{baseUrlMessage}</div>
        )}
      </div>
      <div style={{ gridColumn: "1 / -1", marginTop: 8, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <span className="meta" style={{ fontSize: 12 }}>iptv-catalog v{settings?.version}</span>
      </div>
    </div>
  );
}
