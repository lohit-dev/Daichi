// ---------------------------------------------------------------------------
// Provider Plugin System — Shared Types (updated for AnikotoClient)
// ---------------------------------------------------------------------------

export type { SearchResult, ShowDetails, Episode, Stream, Mode, Subtitle } from './anikoto/types';

// ─── Convenience aliases used by AnimeService ────────────────────────────────

/**
 * The app-level episode shape used by EpisodeListSheet and the player.
 * Derived from the Anikoto Episode type but with a mandatory slug-style id
 * field that the legacy API also expects.
 */
export type ProviderEpisode = {
  /** Episode number as a string, e.g. "1", "2.5" */
  number: string;
  title?: string;
  thumbnail?: string;
  /** True if a sub stream exists, false/undefined otherwise */
  sub?: boolean;
  /** True if a dub stream exists, false/undefined otherwise */
  dub?: boolean;
};

/**
 * Resolved playable stream returned to the player screen.
 */
export type ProviderStreamSource = {
  serverName: string;
  type: 'sub' | 'dub';
  url: string;
  resolution: string;
  hls: boolean;
  headers: Record<string, string>;
  subtitles: { label: string; url: string; default: boolean }[];
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  thumbnails?: string;
  downloadable?: boolean;
};
