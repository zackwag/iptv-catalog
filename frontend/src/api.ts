import { Channel, ChannelFilters, Notification, Playlist, PlaylistWithChannels } from "./types";

const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function fetchChannels(
  filters: Partial<ChannelFilters>,
  page: number,
  pageSize: number
): Promise<{ channels: Channel[]; count: number; total: number }> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.country) params.set("country", filters.country);
  if (filters.category) params.set("category", filters.category);
  if (filters.hasStream) params.set("hasStream", "true");
  if (filters.hasEpg) params.set("hasEpg", "true");
  params.set("limit", String(pageSize));
  params.set("offset", String((page - 1) * pageSize));
  return request(`/channels?${params.toString()}`);
}

export function fetchCountries(
  filters?: Partial<Omit<ChannelFilters, "country">>
): Promise<{ countries: string[] }> {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.category) params.set("category", filters.category);
  if (filters?.hasStream) params.set("hasStream", "true");
  if (filters?.hasEpg) params.set("hasEpg", "true");
  const qs = params.toString();
  return request(`/channels/countries${qs ? `?${qs}` : ""}`);
}

export function fetchCategories(
  filters?: Partial<Omit<ChannelFilters, "category">>
): Promise<{ categories: string[] }> {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.country) params.set("country", filters.country);
  if (filters?.hasStream) params.set("hasStream", "true");
  if (filters?.hasEpg) params.set("hasEpg", "true");
  const qs = params.toString();
  return request(`/channels/categories${qs ? `?${qs}` : ""}`);
}

export function fetchPlaylists(): Promise<{ playlists: Playlist[] }> {
  return request("/playlists");
}

export function fetchPlaylist(id: string): Promise<PlaylistWithChannels> {
  return request(`/playlists/${id}`);
}

export function createPlaylist(name: string, channelIds: string[]): Promise<Playlist> {
  return request("/playlists", {
    method: "POST",
    body: JSON.stringify({ name, channelIds }),
  });
}

export function updatePlaylist(
  id: string,
  updates: {
    name?: string;
    channelIds?: string[];
    checkIntervalHours?: number;
    channelNumberStart?: number;
    autoAssignNumbers?: boolean;
  }
): Promise<PlaylistWithChannels> {
  return request(`/playlists/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deletePlaylist(id: string): Promise<void> {
  return request(`/playlists/${id}`, { method: "DELETE" });
}

export interface EpgHealth {
  lastGeneratedAt: string | null;
  isStale: boolean;
  staleThresholdHours: number;
}

export type ThemeMode = "light" | "dark" | "system";

export interface AppSettings {
  catalogRefreshCron: string;
  catalogRefreshedAt: string | null;
  autoRemoveFailedChannels: boolean;
  autoRemoveFailureThreshold: number;
  webhookUrl: string;
  publicBaseUrl: string;
  epgStalenessWarningHours: number;
  theme: ThemeMode;
  epgHealth: EpgHealth;
  channelsDvrUrl: string;
  blockCountries: string;
  blockCategories: string;
  blockStreamDomains: string;
  blockNsfw: boolean;
  purgedFromPlaylists?: number;
  version: string;
}

export function fetchSettings(): Promise<AppSettings> {
  return request("/settings");
}

export function updateSettings(updates: {
  catalogRefreshCron?: string;
  autoRemoveFailedChannels?: boolean;
  autoRemoveFailureThreshold?: number;
  webhookUrl?: string;
  publicBaseUrl?: string;
  epgStalenessWarningHours?: number;
  theme?: ThemeMode;
  channelsDvrUrl?: string;
  blockCountries?: string;
  blockCategories?: string;
  blockStreamDomains?: string;
  blockNsfw?: boolean;
}): Promise<AppSettings> {
  return request("/settings", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function triggerCatalogRefresh(): Promise<{
  ok: boolean;
  channelCount?: number;
  error?: string;
}> {
  return request("/channels/refresh", { method: "POST" });
}

export function triggerPlaylistTest(
  id: string
): Promise<{ ok: boolean; tested?: number; failed?: number; removed?: number; error?: string }> {
  return request(`/playlists/${id}/test`, { method: "POST" });
}

export function fetchNotifications(
  dismissed?: boolean
): Promise<{ notifications: Notification[] }> {
  const params = dismissed !== undefined ? `?dismissed=${dismissed}` : "";
  return request(`/notifications${params}`);
}

export function dismissNotification(id: string): Promise<{ ok: boolean }> {
  return request(`/notifications/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ dismissed: true }),
  });
}

export function dismissAllNotifications(): Promise<{ ok: boolean; dismissed: number }> {
  return request("/notifications/dismiss-all", { method: "POST" });
}

export interface PlaylistExport {
  iptvCatalogPlaylistExport: number;
  name: string;
  channelIds: string[];
  checkIntervalHours: number;
  channelNumberStart: number;
  autoAssignNumbers?: number;
}

export function exportPlaylist(id: string): Promise<PlaylistExport> {
  return request(`/playlists/${id}/export`);
}

export function importPlaylist(definition: PlaylistExport): Promise<Playlist> {
  return request("/playlists/import", {
    method: "POST",
    body: JSON.stringify(definition),
  });
}

export interface BackupPlaylistSummary {
  id: string;
  name: string;
  channelCount: number;
}

export interface BackupPlaylistDefinition {
  name: string;
  channelIds: string[];
  checkIntervalHours: number;
  channelNumberStart: number;
  autoAssignNumbers?: number;
}

export interface BackupBundle {
  iptvCatalogBackup?: number;
  exportedAt?: string;
  playlists?: BackupPlaylistDefinition[];
  settings?: Partial<AppSettings>;
  // Legacy single-playlist export format, also accepted on import:
  iptvCatalogPlaylistExport?: number;
  name?: string;
  channelIds?: string[];
}

export function fetchBackupPlaylists(): Promise<{ playlists: BackupPlaylistSummary[] }> {
  return request("/backup/playlists");
}

export function exportBackup(
  playlistIds: string[],
  includeSettings: boolean
): Promise<BackupBundle> {
  return request("/backup/export", {
    method: "POST",
    body: JSON.stringify({ playlistIds, includeSettings }),
  });
}

export function importBackup(
  bundle: BackupBundle
): Promise<{ ok: boolean; playlistsImported: number; settingsImported: boolean; error?: string }> {
  return request("/backup/import", {
    method: "POST",
    body: JSON.stringify(bundle),
  });
}

export function duplicatePlaylist(id: string): Promise<Playlist> {
  return request(`/playlists/${id}/duplicate`, { method: "POST" });
}

export function pushPlaylistToDvr(id: string): Promise<{ ok: boolean; sourceName: string }> {
  return request(`/playlists/${id}/push-to-dvr`, { method: "POST" });
}

export function blockChannel(id: string): Promise<{ ok: boolean }> {
  return request(`/channels/${id}/block`, { method: "POST" });
}

export function unblockChannel(id: string): Promise<{ ok: boolean }> {
  return request(`/channels/${id}/block`, { method: "DELETE" });
}

export interface BlockedChannel {
  channelId: string;
  blockedAt: string;
  name: string;
}

export function fetchBlockedChannels(): Promise<{ channels: BlockedChannel[] }> {
  return request("/channels/blocked");
}

export function fetchChannelStreams(
  id: string
): Promise<{ streams: { url: string; quality: string | null; sortOrder: number }[] }> {
  return request(`/channels/${id}/streams`);
}

export function fetchChannelPlaylists(
  id: string
): Promise<{ playlists: { id: string; name: string }[] }> {
  return request(`/channels/${id}/playlists`);
}

export function fetchPlaylistMembers(): Promise<{ channelIds: string[] }> {
  return request("/channels/playlistmembers");
}
