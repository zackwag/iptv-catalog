export interface Channel {
  id: string; // iptv-org channel id, e.g. "CNNInternational.us"
  name: string;
  country: string | null;
  categories: string; // comma-separated category ids
  languages: string; // comma-separated language codes
  logo: string | null;
  isClosed: number; // 0/1
  isNsfw: number; // 0/1
  streamUrl: string | null;
  streamQuality: string | null;
  epgSite: string | null;
  epgSiteId: string | null;
  epgLang: string | null;
  updatedAt: string;
}

export interface ChannelFilters {
  search?: string;
  country?: string;
  category?: string;
  language?: string;
  hasStream?: boolean;
  hasEpg?: boolean;
  limit?: number;
  offset?: number;
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  checkIntervalHours: number;
  lastTestedAt: string | null;
  channelNumberStart: number;
  autoAssignNumbers: number; // 0/1 (sqlite boolean)
  channelCount: number;
}

export interface PlaylistWithChannels extends Playlist {
  channels: Channel[];
}

export interface Notification {
  id: string;
  playlistId: string;
  playlistName: string;
  channelId: string;
  channelName: string;
  message: string;
  createdAt: string;
  dismissed: number; // 0/1 (sqlite boolean)
  dismissedAt: string | null;
  failureCount: number;
  lastFailedAt: string | null;
  kind: "failure" | "removed";
}

// Raw shapes from iptv-org/api (https://iptv-org.github.io/api/)
export interface RawChannel {
  id: string;
  name: string;
  alt_names: string[];
  network: string | null;
  owners: string[];
  country: string | null;
  subdivision: string | null;
  city: string | null;
  categories: string[];
  is_nsfw: boolean;
  launched: string | null;
  closed: string | null;
  replaced_by: string | null;
  website: string | null;
  logo: string | null;
}

export interface RawStream {
  channel: string | null;
  feed: string | null;
  title: string;
  url: string;
  referrer: string | null;
  user_agent: string | null;
  quality: string | null;
}

export interface RawGuide {
  channel: string | null;
  feed: string | null;
  site: string;
  site_id: string;
  site_name: string;
  lang: string;
}
