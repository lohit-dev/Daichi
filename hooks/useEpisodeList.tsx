import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { Episode } from '~/components/watch/EpisodeList';
import { getEpisodeNumberKey } from '~/helpers/episodeNumbers';
import {
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
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const episodesQuery = useQuery<AnikotoEpisode[]>({
    queryKey: ['anikoto', 'episodes', animeId],
    queryFn: () => fetchAnimeEpisode(animeId),
    // Episode availability is independent from the optional MAL ID used for
    // Kitsu thumbnail mapping.
    enabled: !!animeId,
    staleTime: 5 * 60 * 1000,
  });

  // Kitsu is intentionally the first source. AniList fills only missing
  // episodes, and the anime cover is the final per-episode fallback.
  const resolvedMalId = malId;
  const kitsuAnimeQuery = useQuery({
    queryKey: ['kitsu', 'anime-id', resolvedMalId],
    queryFn: () => resolveKitsuAnimeIdFromMal(resolvedMalId!),
    enabled: Boolean(resolvedMalId),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  const kitsuImagesQuery = useInfiniteQuery({
    queryKey: ['kitsu', 'episode-images-v2', kitsuAnimeQuery.data],
    queryFn: ({ pageParam }) => fetchKitsuEpisodeImagePage(kitsuAnimeQuery.data!, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: Boolean(kitsuAnimeQuery.data),
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Eagerly fetch all remaining Kitsu pages in the background so thumbnails
  // and descriptions appear for all episodes without waiting for scroll events.
  // BottomSheetFlatList doesn't reliably fire onEndReached, so we prefetch.
  useEffect(() => {
    if (
      mountedRef.current &&
      kitsuImagesQuery.hasNextPage &&
      !kitsuImagesQuery.isFetchingNextPage
    ) {
      kitsuImagesQuery.fetchNextPage();
    }
  }, [
    kitsuImagesQuery.hasNextPage,
    kitsuImagesQuery.isFetchingNextPage,
    kitsuImagesQuery.fetchNextPage,
    kitsuImagesQuery.data?.pages.length,
  ]);

  const canFetchAniListFallback =
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

    const metadataMap = new Map<
      string,
      { thumbnail?: string; description?: string; airDate?: string }
    >();
    for (const page of kitsuImagesQuery.data?.pages ?? []) {
      for (const item of page.images) {
        const key = getEpisodeNumberKey(item.number);
        if (key) {
          metadataMap.set(key, {
            thumbnail: item.thumbnail,
            description: item.description,
            airDate: item.airDate,
          });
        }
      }
    }
    for (const item of anilistImagesQuery.data ?? []) {
      const key = getEpisodeNumberKey(item.number);
      if (key && !metadataMap.has(key)) {
        metadataMap.set(key, {
          thumbnail: item.thumbnail,
          description: item.description,
          airDate: item.airDate,
        });
      }
    }

    return episodesQuery.data
      .filter((episode) => (type ? Boolean(episode[type]) : episode.sub || episode.dub))
      .map(mapEpisode)
      .map((episode) => {
        const meta = metadataMap.get(getEpisodeNumberKey(episode.number) || '');
        const thumbnail = meta?.thumbnail;
        const description = meta?.description;
        const airDate = meta?.airDate;
        return {
          ...episode,
          image: thumbnail || (anilistImagesQuery.isSuccess ? fallbackImage : episode.image),
          description: description || episode.description,
          airDate: airDate || episode.airDate,
        };
      });
  }, [
    anilistImagesQuery.data,
    anilistImagesQuery.isSuccess,
    episodesQuery.data,
    fallbackImage,
    kitsuImagesQuery.data,
    type,
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
