import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Episode } from '~/components/watch/EpisodeList';
import { fetchAniListAnimeById, fetchEpisodeImagesForAnime } from '~/services/AniListService';
import { fetchAnimeEpisode } from '~/services/AnimeService';
import type { AnikotoEpisode } from '~/types';

const getProviderAnimeSlug = (url: string): string | undefined => {
  const match = url.match(/\/watch\/([^/]+)(?:\/|$)/);
  return match?.[1] || undefined;
};

const mapEpisode = (episode: AnikotoEpisode): Episode => {
  const number = `${Number.parseInt(episode.episode, 10) || 0}`;

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

  // Kitsu is intentionally the first source. AniList fills only missing
  // episodes, and the anime cover is the final per-episode fallback.
  const imagesQuery = useQuery({
    queryKey: ['anilist', 'episode-images', animeId, 'kitsu-priority-v2'],
    queryFn: async () => {
      try {
        const anime = await fetchAniListAnimeById(animeId);
        return fetchEpisodeImagesForAnime(animeId, anime.malId);
      } catch {
        return fetchEpisodeImagesForAnime(animeId);
      }
    },
    enabled: !!animeId,
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const data: Episode[] | undefined = useMemo(() => {
    if (!episodesQuery.data) return undefined;

    const imageMap = new Map<number, string>();
    for (const image of imagesQuery.data ?? []) {
      imageMap.set(Math.round(image.number), image.thumbnail);
    }

    return episodesQuery.data.map((episode) => {
      const episodeNumber = Math.round(Number.parseFloat(episode.number));
      const thumbnail = imageMap.get(episodeNumber);
      if (thumbnail) return { ...episode, image: thumbnail };
      return imagesQuery.isSuccess ? { ...episode, image: fallbackImage } : episode;
    });
  }, [episodesQuery.data, fallbackImage, imagesQuery.data, imagesQuery.isSuccess]);

  return {
    data,
    isLoading: episodesQuery.isLoading,
    error: episodesQuery.error,
    loadMoreImages: () => undefined,
    hasMoreImages: false,
  };
};
