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

const mapEpisode = (episode: AnikotoEpisode): Episode => {
  const number = getEpisodeNumberKey(episode.episode) || episode.episode;

  return {
    id: number,
    number,
    title: episode.title || `Episode ${number}`,
    image: undefined,
  };
};

export const useEpisodeList = (animeId: string, type?: 'sub' | 'dub', fallbackImage?: string) => {
  const episodesQuery = useQuery<Episode[]>({
    queryKey: ['anikoto', 'episodes', animeId, type],
    queryFn: async () => {
      const episodes = await fetchAnimeEpisode(animeId);
      return episodes
        .filter((episode) => (type ? Boolean(episode[type]) : episode.sub || episode.dub))
        .map(mapEpisode);
    },
    enabled: !!animeId,
    staleTime: 5 * 60 * 1000,
  });

  // Resolve Kitsu first. Its artwork is more complete for long-running shows
  // such as One Piece, while AniList is only used to fill missing frames.
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
  });

  const malId = animeMetadataQuery.data?.malId;
  const kitsuAnimeQuery = useQuery({
    queryKey: ['kitsu', 'anime-id', malId],
    queryFn: () => resolveKitsuAnimeIdFromMal(malId!),
    enabled: animeMetadataQuery.isSuccess && Boolean(malId),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  // Kitsu is loaded one page at a time. Page one appears immediately; later
  // pages are requested only when the user scrolls toward them.
  const kitsuImagesQuery = useInfiniteQuery({
    queryKey: ['kitsu', 'episode-images', kitsuAnimeQuery.data],
    queryFn: ({ pageParam }) => fetchKitsuEpisodeImagePage(kitsuAnimeQuery.data!, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: Boolean(kitsuAnimeQuery.data),
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const canFetchAniListFallback =
    animeMetadataQuery.isSuccess &&
    (!malId || kitsuAnimeQuery.isSuccess) &&
    (!kitsuAnimeQuery.data || kitsuImagesQuery.isSuccess);
  const anilistImagesQuery = useQuery({
    queryKey: ['anilist', 'streaming-episode-images', animeId],
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

    const mayUseCoverFallback = anilistImagesQuery.isSuccess;
    return episodesQuery.data.map((episode) => {
      const thumbnail = imageMap.get(getEpisodeNumberKey(episode.number) || '');
      if (thumbnail) return { ...episode, image: thumbnail };
      return mayUseCoverFallback ? { ...episode, image: fallbackImage } : episode;
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
