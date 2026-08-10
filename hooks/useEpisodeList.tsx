import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Episode } from '~/components/watch/EpisodeList';
import { fetchAniListAnimeById, fetchEpisodeImagesForAnime } from '~/services/AniListService';
import { fetchAnimeEpisode } from '~/services/AnimeService';
import type { AnikotoEpisode } from '~/types';

const mapEpisode = (episode: AnikotoEpisode): Episode => {
  const number = `${Number.parseInt(episode.episode, 10) || 0}`;

  return {
    // The streaming endpoint consumes the episode number, so the player and
    // picker intentionally use it as their shared route identity.
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

  // Parallel query for AniList episode thumbnails (Crunchyroll / HiDive scenes).
  // Silently returns [] on failure — thumbnails are a nice-to-have.
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

  // Merge thumbnails into episodes by matching episode number.
  // Wrapped in useMemo so the merged list recomputes when EITHER query resolves.
  const data: Episode[] | undefined = useMemo(() => {
    if (!episodesQuery.data) return undefined;

    const imageMap = new Map<number, string>();
    for (const img of imagesQuery.data ?? []) {
      imageMap.set(Math.round(img.number), img.thumbnail);
    }

    console.log(
      '[episode-list-merge-debug] imageMap size',
      imageMap.size,
      'episodes',
      episodesQuery.data.length
    );
    console.log(
      '[episode-list-merge-debug] first 5 mapped keys',
      Array.from(imageMap.entries()).slice(0, 5)
    );

    return episodesQuery.data.map((ep) => {
      const epNum = Math.round(parseFloat(ep.number));
      const thumbnail = imageMap.get(epNum);
      if (thumbnail) {
        console.log('[episode-list-merge-debug] applied thumbnail for ep', ep.number, thumbnail);
      }
      return thumbnail ? { ...ep, image: thumbnail } : { ...ep, image: fallbackImage };
    });
  }, [episodesQuery.data, imagesQuery.data, fallbackImage]);

  return {
    data,
    isLoading: episodesQuery.isLoading,
    error: episodesQuery.error,
  };
};
