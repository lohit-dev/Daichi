import { useQuery } from '@tanstack/react-query';

import type { Episode } from '~/components/watch/EpisodeList';
import { fetchAnimeEpisode } from '~/services/AnimeService';
import { fetchAniListEpisodeImages } from '~/services/AniListService';
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

export const useEpisodeList = (animeId: string, type?: 'sub' | 'dub') => {
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

  // Parallel query for AniList episode thumbnails — silently returns [] on failure
  const imagesQuery = useQuery({
    queryKey: ['anilist', 'episode-images', animeId],
    queryFn: () => fetchAniListEpisodeImages(animeId),
    enabled: !!animeId,
    staleTime: 30 * 60 * 1000,
  });

  // Merge thumbnails into episodes by matching episode number
  const data: Episode[] | undefined = episodesQuery.data?.map((ep) => {
    const match = imagesQuery.data?.find((img) => String(img.number) === ep.number);
    return match ? { ...ep, image: match.thumbnail } : ep;
  });

  return {
    data,
    isLoading: episodesQuery.isLoading,
    error: episodesQuery.error,
  };
};
