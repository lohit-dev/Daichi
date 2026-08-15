// ---------------------------------------------------------------------------
// Provider Plugin System — Shared Types
// ---------------------------------------------------------------------------

export interface ProviderSearchResult {
  id: string;
  title: string;
  image?: string;
  type?: string;
  subCount?: number;
  dubCount?: number;
  episodeCount?: number;
  url?: string;
}

export interface ProviderEpisode {
  id: string;
  number: number;
  title?: string;
  image?: string;
}

export interface ProviderSubtitle {
  file: string;
  label: string;
  kind: string;
  default?: boolean;
}

export interface ProviderStreamSource {
  serverName: string;
  type: 'sub' | 'dub';
  m3u8Url: string;
  referer: string;
  subtitles: ProviderSubtitle[];
  headers?: Record<string, string>;
  intro?: { start: number; end: number } | null;
  outro?: { start: number; end: number } | null;
}

export interface StreamingProvider {
  readonly name: string;
  readonly baseUrl: string;

  search(query: string, page?: number): Promise<ProviderSearchResult[]>;
  getEpisodes(animeId: string): Promise<ProviderEpisode[]>;
  getStreamSources(episodeId: string, options?: { dub?: boolean }): Promise<ProviderStreamSource[]>;
}

export type ProviderName = 'animekai' | 'animepahe' | 'anikoto';
