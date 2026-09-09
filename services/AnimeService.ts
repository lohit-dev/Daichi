import { resolveAniListIdFromKitsuId } from './KitsuService';

import { useSettingsStore } from '~/app/_store/useSettingsStore';
import { AnikotoEpisodesResponse, AnikotoStreamResponse } from '~/types';

// Hugging Face remains the source of playable episode availability and streams.
// Anikoto requires AniList ID for episode lists and streams.
const ANIKOTO_BASE_URL = 'https://dainsleif6284-anikoto-api.hf.space';
const STREAM_REQUEST_TIMEOUT_MS = 15_000;

async function fetchAbsoluteData<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STREAM_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Anime service request failed (${response.status}).`);
    }

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

/**
 * Anikoto requires the numeric AniList ID to fetch episode lists and stream links.
 * If in Kitsu mode or given a Kitsu ID, resolve the AniList ID via Kitsu mappings.
 */
const resolveAniListIdForAnikoto = async (idOrSlug: string): Promise<string> => {
  const numeric = Number(idOrSlug);
  if (Number.isInteger(numeric) && numeric > 0) {
    const isKitsu = (() => {
      try {
        return useSettingsStore.getState().provider === 'kitsu';
      } catch {
        return false;
      }
    })();

    if (isKitsu) {
      const mappedAniListId = await resolveAniListIdFromKitsuId(idOrSlug);
      if (mappedAniListId) return mappedAniListId;
    }
  }

  return idOrSlug;
};

export const fetchAnimeEpisode = async (slug: string): Promise<AnikotoEpisodesResponse> => {
  const anilistId = await resolveAniListIdForAnikoto(slug);
  return await fetchAbsoluteData<AnikotoEpisodesResponse>(
    `${ANIKOTO_BASE_URL}/api/anime/episodes/${encodeURIComponent(anilistId)}`
  );
};

export const fetchAnimeStreamingLink = async (
  slug: string,
  episodeNumber: string
): Promise<AnikotoStreamResponse> => {
  let targetSlug = slug;
  const numeric = Number(slug);
  if (Number.isInteger(numeric) && numeric > 0) {
    targetSlug = await resolveAniListIdForAnikoto(slug);
  }

  return await fetchAbsoluteData<AnikotoStreamResponse>(
    `${ANIKOTO_BASE_URL}/api/anime/stream/${encodeURIComponent(targetSlug)}/${encodeURIComponent(episodeNumber)}`
  );
};
