export interface Channel {
  id: string;
  name: string;
  country: string | null;
  categories: string;
  logo: string | null;
  streamUrl: string | null;
  streamQuality: string | null;
  isNsfw: number;
  epgSite: string | null;
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  checkIntervalHours: number;
  lastTestedAt: string | null;
  channelNumberStart: number;
  channelCount: number;
  exceedsChannelsDvrLimit: boolean;
  m3uUrl: string;
  epgUrl: string;
}

export interface Notification {
  id: string;
  playlistId: string;
  playlistName: string;
  channelId: string;
  channelName: string;
  message: string;
  createdAt: string;
  dismissed: number;
  dismissedAt: string | null;
  failureCount: number;
  lastFailedAt: string | null;
  kind: "failure" | "removed";
}

export interface PlaylistWithChannels extends Playlist {
  channels: Channel[];
}

export interface ChannelFilters {
  search: string;
  country: string;
  category: string;
  hasStream: boolean;
  hasEpg: boolean;
}
