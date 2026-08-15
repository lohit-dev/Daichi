import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import type { Episode } from '~/components/watch/EpisodeList';
import { getEpisodeNumberKey } from '~/helpers/episodeNumbers';
import {
  fetchAniListAnimeById,
  fetchAniListStreamingEpisodeImages,
  fetchKitsuEpisodeImagePage,
  resolveKitsuAnimeIdFromMal,
} from '~/services/AniListService';
import { fetchAnimeEpisode } from '~/services/AnimeService';
import type { AnikotoEpisode } from '~/types';

const getProviderAnimeSlug = (url: string): string | undefined => {
  const match = url.match(/\/watch\/([^/]+)(?:\/|$)/);
  return match?.[1] || undefined;
};

const mapEpisode = (episode: AnikotoEpisode): Episode => {
  const number = getEpisodeNumberKey(episode.episode) || episode.episode;

  return {
    id: number,
    number,
    title: episode.title || `Episode ${number}`,
    image: undefined,
    // Anikoto's `slug` is the episode slug/number. The season-specific anime
    // slug lives in the watch URL and must be passed to the stream endpoint.
    animeSlug: getProviderAnimeSlug(episode.url),
  };
};

export const useEpisodeList = (
  animeId: string,
  type?: 'sub' | 'dub',
  fallbackImage?: string,
  malId?: number | null
) => {
  const episodesQuery = useQuery<Episode[]>({
    queryKey: ['anikoto', 'episodes', animeId, type],
    queryFn: async () => {
      const episodes = await fetchAnimeEpisode(animeId);
      return episodes
        .filter((episode) => (type ? Boolean(episode[type]) : episode.sub || episode.dub))
        .map(mapEpisode);
    },
    // Episode availability is independent from the optional MAL ID used for
    // Kitsu thumbnail mapping.
    enabled: !!animeId,
    staleTime: 5 * 60 * 1000,
  });

  // Kitsu is intentionally the first source. AniList fills only missing
  // episodes, and the anime cover is the final per-episode fallback.
  const animeMetadataQuery = useQuery({
    queryKey: ['anilist', 'anime-mal-id', animeId],
    queryFn: async () => {
      try {
        return await fetchAniListAnimeById(animeId);
      } catch {
        return null;
      }
    },
    enabled: !!animeId,
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const resolvedMalId = malId ?? animeMetadataQuery.data?.malId;
  const kitsuAnimeQuery = useQuery({
    queryKey: ['kitsu', 'anime-id', resolvedMalId],
    queryFn: () => resolveKitsuAnimeIdFromMal(resolvedMalId!),
    enabled: (malId != null || animeMetadataQuery.isSuccess) && Boolean(resolvedMalId),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  const kitsuImagesQuery = useInfiniteQuery({
    // Bump this identity after the old all-pages implementation could cache an
    // empty result for long-running series such as One Piece.
    queryKey: ['kitsu', 'episode-images-v2', kitsuAnimeQuery.data],
    queryFn: ({ pageParam }) => fetchKitsuEpisodeImagePage(kitsuAnimeQuery.data!, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: Boolean(kitsuAnimeQuery.data),
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const canFetchAniListFallback =
    (malId != null || animeMetadataQuery.isSuccess) &&
    (!resolvedMalId || kitsuAnimeQuery.isSuccess) &&
    (!kitsuAnimeQuery.data || kitsuImagesQuery.isSuccess);
  const anilistImagesQuery = useQuery({
    queryKey: ['anilist', 'streaming-episode-images-v2', animeId],
    queryFn: () => fetchAniListStreamingEpisodeImages(animeId),
    enabled: canFetchAniListFallback && !!animeId,
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const data: Episode[] | undefined = useMemo(() => {
    if (!episodesQuery.data) return undefined;

    const imageMap = new Map<string, string>();
    for (const page of kitsuImagesQuery.data?.pages ?? []) {
      for (const image of page.images) {
        const key = getEpisodeNumberKey(image.number);
        if (key) imageMap.set(key, image.thumbnail);
      }
    }
    for (const image of anilistImagesQuery.data ?? []) {
      const key = getEpisodeNumberKey(image.number);
      if (key && !imageMap.has(key)) imageMap.set(key, image.thumbnail);
    }

    return episodesQuery.data.map((episode) => {
      const thumbnail = imageMap.get(getEpisodeNumberKey(episode.number) || '');
      if (thumbnail) return { ...episode, image: thumbnail };
      return anilistImagesQuery.isSuccess ? { ...episode, image: fallbackImage } : episode;
    });
  }, [
    anilistImagesQuery.data,
    anilistImagesQuery.isSuccess,
    episodesQuery.data,
    fallbackImage,
    kitsuImagesQuery.data,
  ]);

  const loadMoreImages = useCallback(() => {
    if (kitsuImagesQuery.hasNextPage && !kitsuImagesQuery.isFetchingNextPage) {
      kitsuImagesQuery.fetchNextPage();
    }
  }, [
    kitsuImagesQuery.fetchNextPage,
    kitsuImagesQuery.hasNextPage,
    kitsuImagesQuery.isFetchingNextPage,
  ]);

  return {
    data,
    isLoading: episodesQuery.isLoading,
    error: episodesQuery.error,
    loadMoreImages,
    hasMoreImages: Boolean(kitsuImagesQuery.hasNextPage),
  };
};
