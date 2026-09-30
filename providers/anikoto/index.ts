// ---------------------------------------------------------------------------
// providers/anikoto/index.ts — public API barrel
//
// Re-exports everything callers need so imports look like:
//   import { AnikotoClient, anikoto, ... } from '~/providers/anikoto';
// ---------------------------------------------------------------------------

import { AnikotoClient } from './client';

export { AnikotoClient } from './client';
export type { ClientOptions } from './client';

export { AnikotoCzClient } from './cz-client';

export { RateLimitedError, friendlyError } from './errors';

export {
  // ID helpers
  encodeId,
  decodeId,
  encodeCzId,
  decodeCzId,
  providerFromShowId,
  validSlug,
  // Parsers
  parseSearchPayload,
  parseDetails,
  parseEpisodePayload,
  parseMegaplaySources,
  parseThumbnailVtt,
  parseDataId,
  parseSearchSort,
  // Stream helpers
  sortStreams,
  sortEpisodes,
  chooseQuality,
  expandEpisodeSelection,
  embedCandidates,
  // URL validation
  validateRemoteUrl,
  isMegaplayMediaHost,
  isSafeRemoteUrl,
  thumbAt,
  // Shared consts
  UA,
} from './utils';

export type {
  Mode,
  TranslationType,
  CatalogProvider,
  SearchSort,
  SearchOptions,
  AnikotoId,
  AnikotoCzId,
  SearchResult,
  TimeRange,
  ShowDetails,
  Episode,
  Subtitle,
  SubtitleTrack,
  RequestHeaders,
  Stream,
  StreamLink,
  ThumbCue,
} from './types';

// ─── Singleton client ───────────────────────────────────────────────────────

/**
 * Shared singleton — use this anywhere you need the Anikoto API.
 */
export const anikoto = new AnikotoClient();
