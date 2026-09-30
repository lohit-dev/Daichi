// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

import { anikoto, AnikotoClient } from './anikoto';

export { anikoto };
export type { AnikotoClient };

// Re-export shared types that the rest of the app references via this module
export type { ProviderEpisode, ProviderStreamSource } from './types';
export type { SearchResult, ShowDetails, Episode, Stream, Mode, Subtitle } from './anikoto';
