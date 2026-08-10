import {
  AniListAnimeDetails,
  AniListHomeResponse,
  AniListSearchResponse,
  Anime,
  SearchParams,
} from '~/types';

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const REQUEST_TIMEOUT_MS = 12_000;

export class AniListRequestError extends Error {
  status: number;
  retryAfterMs?: number;

  constructor(message: string, status: number, retryAfterMs?: number) {
    super(message);
    this.name = 'AniListRequestError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

type RawDate = {
  year?: number | null;
  month?: number | null;
  day?: number | null;
};

type RawMedia = {
  id: number;
  idMal?: number | null;
  title?: { romaji?: string | null; english?: string | null; native?: string | null } | null;
  synonyms?: string[] | null;
  coverImage?: { large?: string | null; extraLarge?: string | null } | null;
  bannerImage?: string | null;
  trailer?: { id?: string | null; site?: string | null } | null;
  description?: string | null;
  averageScore?: number | null;
  format?: string | null;
  status?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  startDate?: RawDate | null;
  episodes?: number | null;
  duration?: number | null;
  genres?: string[] | null;
  popularity?: number | null;
  nextAiringEpisode?: { episode?: number | null } | null;
};

type RawCharacter = {
  id: number;
  name?: { full?: string | null; native?: string | null } | null;
  image?: { large?: string | null } | null;
};

type RawVoiceActor = {
  id: number;
  name?: { full?: string | null; native?: string | null } | null;
  image?: { large?: string | null } | null;
  languageV2?: string | null;
};

type RawExtrasMedia = {
  bannerImage?: string | null;
  studios?: {
    nodes?: { name?: string | null; isAnimationStudio?: boolean | null }[] | null;
  } | null;
  characters?: {
    edges?:
      | {
          role?: string | null;
          node?: RawCharacter | null;
          voiceActors?: RawVoiceActor[] | null;
        }[]
      | null;
  } | null;
  recommendations?: { nodes?: { mediaRecommendation?: RawMedia | null }[] | null } | null;
};

type RawPage = {
  pageInfo: { currentPage: number; hasNextPage: boolean };
  media: RawMedia[];
};

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  synonyms
  coverImage { large extraLarge }
  bannerImage
  trailer { id site }
  description
  averageScore
  format
  status
  season
  seasonYear
  startDate { year month day }
  episodes
  duration
  genres
  popularity
  nextAiringEpisode { episode }
`;

const HOME_QUERY = `
  query HomeCatalogue {
    spotlight: Page(page: 1, perPage: 10) {
      media(type: ANIME, isAdult: false, sort: [TRENDING_DESC]) { ${MEDIA_FIELDS} }
    }
    airing: Page(page: 1, perPage: 20) {
      media(type: ANIME, isAdult: false, status: RELEASING, sort: [POPULARITY_DESC]) { ${MEDIA_FIELDS} }
    }
    recent: Page(page: 1, perPage: 20) {
      media(type: ANIME, isAdult: false, status: RELEASING, sort: [UPDATED_AT_DESC]) { ${MEDIA_FIELDS} }
    }
    upcoming: Page(page: 1, perPage: 20) {
      media(type: ANIME, isAdult: false, status: NOT_YET_RELEASED, sort: [POPULARITY_DESC]) { ${MEDIA_FIELDS} }
    }
    popular: Page(page: 1, perPage: 20) {
      media(type: ANIME, isAdult: false, sort: [POPULARITY_DESC]) { ${MEDIA_FIELDS} }
    }
    completed: Page(page: 1, perPage: 20) {
      media(type: ANIME, isAdult: false, status: FINISHED, sort: [SCORE_DESC]) { ${MEDIA_FIELDS} }
    }
  }
`;

const SUBBED_QUERY = `
  query SubbedAnime {
    Page(page: 1, perPage: 30) {
      media(
        type: ANIME
        isAdult: false
        countryOfOrigin: JP
        sort: [POPULARITY_DESC]
      ) { ${MEDIA_FIELDS} }
    }
  }
`;

const DUBBED_QUERY = `
  query DubbedAnime {
    Page(page: 1, perPage: 30) {
      media(
        type: ANIME
        isAdult: false
        countryOfOrigin: JP
        sort: [SCORE_DESC]
        status_in: [FINISHED, RELEASING]
        averageScore_greater: 70
        popularity_greater: 100000
      ) { ${MEDIA_FIELDS} }
    }
  }
`;

const SEARCH_QUERY = `
  query SearchAnime(
    $page: Int!
    $search: String!
    $genreIn: [String]
    $formatIn: [MediaFormat]
    $season: MediaSeason
    $status: MediaStatus
    $year: String
    $sort: [MediaSort]
  ) {
    Page(page: $page, perPage: 24) {
      pageInfo { currentPage hasNextPage }
      media(
        type: ANIME
        isAdult: false
        search: $search
        genre_in: $genreIn
        format_in: $formatIn
        season: $season
        status: $status
        startDate_like: $year
        sort: $sort
      ) { ${MEDIA_FIELDS} }
    }
  }
`;

const DETAILS_QUERY = `
  query AnimeDetails($id: Int, $search: String) {
    Media(id: $id, search: $search, type: ANIME) { ${MEDIA_FIELDS} }
  }
`;

const EXTRAS_QUERY = `
  query AnimeExtras($id: Int!) {
    Media(id: $id, type: ANIME) {
      bannerImage
      studios(isMain: true) { nodes { name isAnimationStudio } }
      characters(page: 1, perPage: 12, sort: [ROLE, RELEVANCE]) {
        edges {
          role
          node { id name { full native } image { large } }
          voiceActors(language: JAPANESE) {
            id
            name { full native }
            image { large }
            languageV2
          }
        }
      }
      recommendations(page: 1, perPage: 12) {
        nodes {
          mediaRecommendation { ${MEDIA_FIELDS} }
        }
      }
    }
  }
`;

const cleanHtml = (value: string | null | undefined) =>
  (value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const titleOf = (media: RawMedia) =>
  media.title?.english?.trim() ||
  media.title?.romaji?.trim() ||
  media.title?.native?.trim() ||
  'Untitled';

const formatLabel = (value: string | null | undefined) =>
  value ? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Anime';

const statusLabel = (value: string | null | undefined) => {
  switch (value) {
    case 'RELEASING':
      return 'Currently Airing';
    case 'FINISHED':
      return 'Finished Airing';
    case 'NOT_YET_RELEASED':
      return 'Not Yet Aired';
    case 'HIATUS':
      return 'Hiatus';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return formatLabel(value);
  }
};

const seasonLabel = (media: RawMedia) => {
  if (media.season && media.seasonYear) return `${formatLabel(media.season)} ${media.seasonYear}`;
  if (media.startDate?.year) return String(media.startDate.year);
  return 'TBA';
};

const mapAnime = (media: RawMedia, rank?: number): Anime => ({
  title: titleOf(media),
  slug: String(media.id),
  image: media.coverImage?.extraLarge || media.coverImage?.large || '',
  trailer: media.trailer?.id
    ? { id: media.trailer.id, site: media.trailer.site || undefined }
    : undefined,
  synopsis: cleanHtml(media.description),
  quality: formatLabel(media.format),
  rating: media.averageScore ? `${(media.averageScore / 10).toFixed(1)}` : 'N/A',
  date: seasonLabel(media),
  type: formatLabel(media.format),
  episode: media.episodes ? `${media.episodes} Episodes` : undefined,
  episodeNumber: media.episodes ? String(media.episodes) : undefined,
  genres: media.genres ?? [],
  rank,
  aniListId: media.id,
  malId: media.idMal ?? null,
});

const mapDetails = (media: RawMedia): AniListAnimeDetails => {
  const titles = [
    media.title?.english,
    media.title?.romaji,
    media.title?.native,
    ...(media.synonyms ?? []),
  ]
    .filter((title): title is string => Boolean(title?.trim()))
    .filter((title, index, values) => values.indexOf(title) === index);

  return {
    id: String(media.id),
    title: titleOf(media),
    alternateTitles: titles.filter((title) => title !== titleOf(media)),
    image: media.coverImage?.extraLarge || media.coverImage?.large || '',
    bannerImage: media.bannerImage || undefined,
    synopsis: cleanHtml(media.description) || 'No description is available for this anime.',
    rating: media.averageScore ? `${(media.averageScore / 10).toFixed(1)}` : 'N/A',
    quality: formatLabel(media.format),
    genres: media.genres ?? [],
    status: statusLabel(media.status),
    released: seasonLabel(media),
    duration: media.duration ? `${media.duration} min` : 'Unknown duration',
    type: formatLabel(media.format),
    malRating: media.averageScore ? `${media.averageScore}%` : 'N/A',
    aniListId: media.id,
    malId: media.idMal ?? null,
  };
};

const parseRetryAfter = (value: string | null) => {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
};

async function queryAniList<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(ANILIST_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    const payload = (await response.json()) as { data?: T; errors?: { message?: string }[] };
    const message =
      payload.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join(' ') || `AniList request failed (${response.status})`;

    if (!response.ok || payload.errors?.length || !payload.data) {
      throw new AniListRequestError(
        message,
        response.status,
        parseRetryAfter(response.headers.get('Retry-After'))
      );
    }

    return payload.data;
  } catch (error) {
    if (error instanceof AniListRequestError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AniListRequestError('AniList request timed out. Please try again.', 408);
    }
    throw new AniListRequestError(
      error instanceof Error ? error.message : 'Unable to reach AniList.',
      0
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const fetchAniListHomePage = async (): Promise<AniListHomeResponse> => {
  const data = await queryAniList<{
    spotlight: Pick<RawPage, 'media'>;
    airing: Pick<RawPage, 'media'>;
    recent: Pick<RawPage, 'media'>;
    upcoming: Pick<RawPage, 'media'>;
    popular: Pick<RawPage, 'media'>;
    completed: Pick<RawPage, 'media'>;
  }>(HOME_QUERY);

  return {
    data: {
      spotlight: data.spotlight.media.map((media, index) => mapAnime(media, index + 1)),
      recentUpdates: data.recent.media.map(mapAnime),
      upcoming: data.upcoming.media.map(mapAnime),
      topTables: {
        newReleases: data.airing.media.map(mapAnime),
        newlyAdded: data.popular.media.map(mapAnime),
        justCompleted: data.completed.media.map(mapAnime),
      },
    },
  };
};

const toFormat = (value?: string) => (value ? value.replace(/\s+/g, '_').toUpperCase() : undefined);

const toStatus = (value?: string) => {
  if (!value) return undefined;
  if (value === 'Currently Airing') return 'RELEASING';
  if (value === 'Finished Airing') return 'FINISHED';
  if (value === 'Not yet aired') return 'NOT_YET_RELEASED';
  return toFormat(value);
};

const toSort = (value?: string) => {
  switch (value?.toLowerCase()) {
    case 'score':
    case 'score_desc':
      return ['SCORE_DESC'];
    case 'title':
    case 'title_romaji':
      return ['TITLE_ROMAJI'];
    case 'newest':
    case 'start_date_desc':
      return ['START_DATE_DESC'];
    default:
      return ['POPULARITY_DESC'];
  }
};

export const fetchAniListSearch = async (params: SearchParams): Promise<AniListSearchResponse> => {
  const filters = params.filters;
  const data = await queryAniList<{ Page: RawPage }>(SEARCH_QUERY, {
    page: params.page ?? 1,
    search: params.q.trim(),
    genreIn: filters?.genres ? [filters.genres] : undefined,
    formatIn: filters?.type ? [toFormat(filters.type)] : undefined,
    season: toFormat(filters?.season),
    status: toStatus(filters?.status),
    year: filters?.start_date,
    sort: toSort(filters?.sort || filters?.score),
  });

  return {
    results: data.Page.media.map(mapAnime),
    pagination: {
      currentPage: data.Page.pageInfo.currentPage,
      hasNextPage: data.Page.pageInfo.hasNextPage,
    },
  };
};

export const fetchAniListAnimeById = async (identifier: string): Promise<AniListAnimeDetails> => {
  const numericId = Number(identifier);
  const data = await queryAniList<{ Media: RawMedia | null }>(DETAILS_QUERY, {
    id: Number.isInteger(numericId) && numericId > 0 ? numericId : undefined,
    search:
      Number.isInteger(numericId) && numericId > 0 ? undefined : identifier.replace(/-/g, ' '),
  });

  if (!data.Media) throw new AniListRequestError('Anime not found on AniList.', 404);
  return mapDetails(data.Media);
};

export const fetchAniListAnimeExtras = async (animeId: string) => {
  const id = Number(animeId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AniListRequestError('An AniList ID is required to load anime extras.', 400);
  }

  const data = await queryAniList<{ Media: RawExtrasMedia | null }>(EXTRAS_QUERY, { id });
  if (!data.Media) throw new AniListRequestError('Anime extras were not found on AniList.', 404);

  const cast = (data.Media.characters?.edges ?? [])
    .map((edge) => {
      const character = edge.node;
      if (!character) return null;
      const actor = edge.voiceActors?.[0];

      return {
        id: String(character.id),
        name: character.name?.full || character.name?.native || 'Unknown character',
        image: character.image?.large || '',
        role: formatLabel(edge.role),
        voiceActor: actor
          ? {
              id: String(actor.id),
              name: actor.name?.full || actor.name?.native || 'Unknown voice actor',
              image: actor.image?.large || '',
              language: actor.languageV2 || undefined,
            }
          : undefined,
      };
    })
    .filter((member): member is NonNullable<typeof member> => Boolean(member));

  return {
    bannerImage: data.Media.bannerImage || undefined,
    studios: (data.Media.studios?.nodes ?? [])
      .filter((studio) => studio.isAnimationStudio !== false)
      .map((studio) => studio.name)
      .filter((name): name is string => Boolean(name)),
    cast,
    recommendations: (data.Media.recommendations?.nodes ?? [])
      .map((recommendation) => recommendation.mediaRecommendation)
      .filter((media): media is RawMedia => Boolean(media))
      .map(mapAnime),
  };
};

export const fetchAniListSubbed = async (): Promise<Anime[]> => {
  const data = await queryAniList<{ Page: Pick<RawPage, 'media'> }>(SUBBED_QUERY);
  return data.Page.media.map(mapAnime);
};

export const fetchAniListDubbed = async (): Promise<Anime[]> => {
  const data = await queryAniList<{ Page: Pick<RawPage, 'media'> }>(DUBBED_QUERY);
  return data.Page.media.map(mapAnime);
};

// ---------------------------------------------------------------------------
// Episode images – from AniList streamingEpisodes (Crunchyroll / HiDive etc.)
// ---------------------------------------------------------------------------

const EPISODE_IMAGES_QUERY = `
  query EpisodeImages($id: Int!) {
    Media(id: $id, type: ANIME) {
      streamingEpisodes {
        title
        thumbnail
        url
        site
      }
    }
  }
`;

type RawStreamingEpisode = {
  title?: string | null;
  thumbnail?: string | null;
  url?: string | null;
  site?: string | null;
};

export type AniListEpisodeImage = {
  /** 1-based episode number parsed from the title string, or 0 if unparseable */
  number: number;
  title: string;
  thumbnail: string;
};

/**
 * Fetches per-episode thumbnails from AniList's `streamingEpisodes` field.
 * AniList titles are usually formatted as "Episode N - Title" or "Episode N".
 * Returns an empty array when the anime has no streaming episode data.
 */
export const fetchAniListEpisodeImages = async (
  animeId: string
): Promise<AniListEpisodeImage[]> => {
  const numericId = Number(animeId);
  if (!Number.isInteger(numericId) || numericId <= 0) return [];

  try {
    const data = await queryAniList<{
      Media: { streamingEpisodes?: RawStreamingEpisode[] | null } | null;
    }>(EPISODE_IMAGES_QUERY, { id: numericId });

    const episodes = data.Media?.streamingEpisodes ?? [];
    return episodes
      .filter((ep): ep is Required<Pick<RawStreamingEpisode, 'thumbnail'>> & RawStreamingEpisode =>
        Boolean(ep.thumbnail)
      )
      .map((ep) => {
        // Parse "Episode 3 - The Battle Begins" → number=3, title="The Battle Begins"
        // or "Episode 3" → number=3, title="Episode 3"
        const match = ep.title?.match(/Episode\s+(\d+(?:\.\d+)?)\s*(?:-\s*(.+))?/i);
        const number = match ? parseFloat(match[1]) : 0;
        const parsedTitle = match?.[2]?.trim() || ep.title || `Episode ${number}`;

        return {
          number,
          title: parsedTitle,
          thumbnail: ep.thumbnail!,
        };
      });
  } catch {
    // Silently fail — episode images are a nice-to-have enhancement
    return [];
  }
};

// ---------------------------------------------------------------------------
// Browse (View All) – paginated by category key
// ---------------------------------------------------------------------------

export type BrowseCategory =
  'trending' | 'airing' | 'upcoming' | 'popular' | 'completed' | 'recent';

const BROWSE_QUERY_NO_STATUS = `
  query Browse($page: Int!, $perPage: Int!, $sort: [MediaSort]) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { currentPage hasNextPage }
      media(type: ANIME, isAdult: false, sort: $sort) { ${MEDIA_FIELDS} }
    }
  }
`;

const BROWSE_QUERY_WITH_STATUS = `
  query Browse($page: Int!, $perPage: Int!, $sort: [MediaSort], $status: MediaStatus!) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { currentPage hasNextPage }
      media(type: ANIME, isAdult: false, sort: $sort, status: $status) { ${MEDIA_FIELDS} }
    }
  }
`;

const CATEGORY_VARS: Record<BrowseCategory, { sort: string[]; status?: string }> = {
  trending: { sort: ['TRENDING_DESC'] },
  airing: { sort: ['POPULARITY_DESC'], status: 'RELEASING' },
  upcoming: { sort: ['POPULARITY_DESC'], status: 'NOT_YET_RELEASED' },
  popular: { sort: ['POPULARITY_DESC'] },
  completed: { sort: ['SCORE_DESC'], status: 'FINISHED' },
  recent: { sort: ['UPDATED_AT_DESC'], status: 'RELEASING' },
};

export const fetchAniListBrowse = async (
  category: BrowseCategory,
  page: number,
  perPage = 24
): Promise<AniListSearchResponse> => {
  const vars = CATEGORY_VARS[category];

  const data = await queryAniList<{ Page: RawPage }>(
    vars.status ? BROWSE_QUERY_WITH_STATUS : BROWSE_QUERY_NO_STATUS,
    vars.status
      ? { page, perPage, sort: vars.sort, status: vars.status }
      : { page, perPage, sort: vars.sort }
  );

  return {
    results: data.Page.media.map(mapAnime),
    pagination: {
      currentPage: data.Page.pageInfo.currentPage,
      hasNextPage: data.Page.pageInfo.hasNextPage,
    },
  };
};
