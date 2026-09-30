// ---------------------------------------------------------------------------
// Anikoto — shared domain types
// ---------------------------------------------------------------------------

export type Mode = 'sub' | 'dub';
export type TranslationType = Mode;

export type CatalogProvider = 'anikoto' | 'anikoto2';

export type SearchSort =
  | 'latest-updated'
  | 'latest-added'
  | 'score'
  | 'name-az'
  | 'release-date'
  | 'most-viewed'
  | 'number_of_episodes';

export type SearchOptions = { allowAdult?: boolean; sort?: SearchSort };

export type AnikotoId = {
  anilistId?: string;
  malId?: string;
  anikotoId?: string;
  title?: string;
  episodes?: number;
};

export type SearchResult = {
  id: string;
  name: string;
  episodes: number;
  cover?: string;
  banner?: string;
  color?: string;
  format?: string;
  status?: string;
  year?: number;
  score?: number; // 0-100
  genres?: string[];
  provider?: CatalogProvider;
};

export type TimeRange = { start: number; end: number };

export type ShowDetails = {
  anilistId: string;
  malId?: string;
  title: { romaji?: string; english?: string; native?: string };
  synonyms: string[];
  description?: string;
  cover?: string;
  banner?: string;
  color?: string;
  format?: string;
  status?: string;
  season?: string;
  year?: number;
  startDate?: string;
  endDate?: string;
  episodes?: number;
  duration?: number;
  score?: number;
  popularity?: number;
  genres: string[];
  tags: { name: string; rank: number; spoiler: boolean }[];
  studios: string[];
  nextEpisode?: { episode: number; airingAt: number };
  trailer?: { site: string; id: string; url?: string };
  streamingEpisodes: { title: string; thumbnail?: string; url?: string }[];
  relations: { type: string; id: string; title?: string; format?: string }[];
};

export type Episode = {
  number: string;
  embedId?: string;
  subUrl?: string;
  dubUrl?: string;
  title?: string;
  thumbnail?: string;
  aired?: string;
  raw?: any; // untouched upstream item so no unknown fields are lost
};

export type Subtitle = { label: string; url: string; default: boolean };
export type SubtitleTrack = Subtitle;

// Expo's native player expects request headers as a flat key/value object.
export type RequestHeaders = Record<string, string>;

export type Stream = {
  url: string;
  resolution: string;
  hls: boolean;
  headers: Record<string, string>;
  subtitles: Subtitle[];
  thumbnails?: string; // WebVTT sprite map for seek previews
  intro?: TimeRange;
  outro?: TimeRange;
  provider?: string;
  downloadable?: boolean;
};
export type StreamLink = Stream;

export type ThumbCue = {
  start: number;
  end: number;
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

// Internal Anikoto.cz types
export type AnikotoCzId = { slug: string; title: string; episodes?: number };
