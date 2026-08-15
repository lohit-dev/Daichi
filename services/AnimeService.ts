import { useProviderMappingStore } from '~/app/_store/useProviderMappingStore';
import { getProvider } from '~/providers/registry';
import type { AnikotoEpisodesResponse, AnikotoStreamResponse } from '~/types';

const STREAM_REQUEST_TIMEOUT_MS = 15_000;

const ANIKOTO_BASE_URL = 'https://dainsleif6284-anikoto-api.hf.space';

async function fetchAbsoluteData<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STREAM_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Anime service request failed (${response.status}).`);
    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Anime service request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── LEGACY FALLBACKS ─────────────────────────────────────────────────────

export const fetchAnimeEpisodeLegacy = async (slug: string): Promise<AnikotoEpisodesResponse> => {
  return fetchAbsoluteData<AnikotoEpisodesResponse>(
    `${ANIKOTO_BASE_URL}/api/anime/episodes/${encodeURIComponent(slug)}`
  );
};

export const fetchAnimeStreamingLinkLegacy = async (
  slug: string,
  episodeNumber: string
): Promise<AnikotoStreamResponse> => {
  return fetchAbsoluteData<AnikotoStreamResponse>(
    `${ANIKOTO_BASE_URL}/api/anime/stream/${encodeURIComponent(slug)}/${encodeURIComponent(episodeNumber)}`
  );
};

// ─── PROVIDER-AWARE FETCHING ───────────────────────────────────────────────

async function resolveProviderAnimeId(animeId: string, animeTitle: string): Promise<string | null> {
  const store = useProviderMappingStore.getState();
  const cached = store.getMapping(animeId);

  if (cached && Date.now() - cached.searchedAt < 7 * 24 * 60 * 60 * 1000) {
    return cached.providerAnimeId;
  }

  const providerName = store.activeProvider;
  const provider = getProvider(providerName);

  try {
    const results = await provider.search(animeTitle);
    if (!results.length) return null;

    const best = results[0];
    store.setMapping(animeId, {
      providerAnimeId: best.id,
      title: best.title,
      searchedAt: Date.now(),
    });

    return best.id;
  } catch {
    return null;
  }
}

export const fetchAnimeEpisode = async (
  slug: string,
  animeTitle?: string
): Promise<AnikotoEpisodesResponse> => {
  if (!animeTitle) return fetchAnimeEpisodeLegacy(slug);

  const providerId = await resolveProviderAnimeId(slug, animeTitle);
  if (!providerId) return fetchAnimeEpisodeLegacy(slug);

  const providerName = useProviderMappingStore.getState().activeProvider;
  const provider = getProvider(providerName);

  try {
    const episodes = await provider.getEpisodes(providerId);
    return episodes.map((ep) => ({
      id: String(ep.number),
      episode: String(ep.number),
      slug: ep.id,
      malId: '',
      timestamp: '',
      sub: true,
      dub: false,
      serversId: ep.id,
      title: ep.title || `Episode ${ep.number}`,
      url: '',
    }));
  } catch {
    return fetchAnimeEpisodeLegacy(slug);
  }
};

export const fetchAnimeStreamingLink = async (
  animeId: string,
  providerEpisodeId: string,
  animeTitle?: string,
  type: 'sub' | 'dub' = 'sub'
): Promise<AnikotoStreamResponse> => {
  const store = useProviderMappingStore.getState();
  const mapping = store.getMapping(animeId);

  if (!mapping || !animeTitle) {
    return fetchAnimeStreamingLinkLegacy(animeId, providerEpisodeId);
  }

  const provider = getProvider(store.activeProvider);

  try {
    const sources = await provider.getStreamSources(providerEpisodeId, { dub: type === 'dub' });

    if (!sources.length) {
      return fetchAnimeStreamingLinkLegacy(animeId, providerEpisodeId);
    }

    return {
      success: true,
      data: {
        animeSlug: animeId,
        episodeNumber: providerEpisodeId,
        episodeTitle: `Episode`,
        aniListId: null,
        malId: null,
        intro: sources[0]?.intro || null,
        outro: sources[0]?.outro || null,
        serversId: providerEpisodeId,
        totalServers: sources.length,
        servers: sources.map((s, i) => ({
          serverName: s.serverName || `${provider.name} ${i + 1}`,
          type: s.type,
          svId: String(i),
          epId: providerEpisodeId,
          cmId: '',
          embedUrl: '',
          referer: s.referer,
          m3u8Url: s.m3u8Url,
          subtitles: s.subtitles.map((sub) => ({
            file: sub.file,
            label: sub.label,
            kind: sub.kind,
          })),
        })),
      },
    };
  } catch {
    return fetchAnimeStreamingLinkLegacy(animeId, providerEpisodeId);
  }
};
