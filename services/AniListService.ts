import { cleanHtml, formatIdToTitle } from '~/helpers/common';
import { getEpisodeNumberKey } from '~/helpers/episodeNumbers';
import {
  AniListAnimeDetails,
  AniListHomeResponse,
  AniListSearchResponse,
  Anime,
  SearchParams,
  CastPersonDetails,
  CastPersonKind,
  CastWork,
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
  studios?: {
    nodes?: { name?: string | null }[] | null;
  } | null;
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
  studios(isMain: true) { nodes { name } }
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

const PERSON_WORK_FIELDS = `
  id
  title { romaji english }
  coverImage { large extraLarge }
  format
`;

const CHARACTER_DETAILS_QUERY = `
  query CharacterDetails($id: Int!) {
    Character(id: $id) {
      id
      name { full native alternative alternativeSpoiler }
      image { large }
      description(asHtml: false)
      gender
      dateOfBirth { year month day }
      age
      bloodType
      favourites
      siteUrl
      media(page: 1, perPage: 30, sort: [POPULARITY_DESC]) {
        edges {
          node { ${PERSON_WORK_FIELDS} }
          characterRole
        }
      }
    }
  }
`;

const STAFF_DETAILS_QUERY = `
  query StaffDetails($id: Int!) {
    Staff(id: $id) {
      id
      name { full native alternative }
      image { large }
      description(asHtml: false)
      gender
      dateOfBirth { year month day }
      age
      bloodType
      languageV2
      primaryOccupations
      homeTown
      yearsActive
      siteUrl
      favourites
      staffMedia(page: 1, perPage: 30, sort: [POPULARITY_DESC]) {
        edges {
          node { ${PERSON_WORK_FIELDS} }
        }
      }
    }
  }
`;

const titleOf = (media: RawMedia) =>
  media.title?.english?.trim() ||
  media.title?.romaji?.trim() ||
  media.title?.native?.trim() ||
  'Untitled';

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
      return value ? value.charAt(0) + value.slice(1).toLowerCase() : 'Unknown';
  }
};

const seasonOf = (media: RawMedia) => {
  if (media.season && media.seasonYear)
    return `${formatIdToTitle(media.season)} ${media.seasonYear}`;
  if (media.startDate?.year) return String(media.startDate.year);
  return undefined;
};

const mapAnime = (media: RawMedia, rank?: number): Anime => ({
  title: titleOf(media),
  slug: String(media.id),
  image: media.coverImage?.extraLarge || media.coverImage?.large || '',
  trailer: media.trailer?.id
    ? { id: media.trailer.id, site: media.trailer.site || undefined }
    : undefined,
  synopsis: cleanHtml(media.description),
  quality: formatIdToTitle(media.format) || 'Anime',
  rating: media.averageScore ? `${(media.averageScore / 10).toFixed(1)}` : 'N/A',
  date: seasonOf(media) || 'TBA',
  type: formatIdToTitle(media.format) || 'Anime',
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
    quality: formatIdToTitle(media.format) || 'Anime',
    genres: media.genres ?? [],
    status: statusLabel(media.status),
    released: seasonOf(media) || 'TBA',
    duration: media.duration ? `${media.duration}m` : 'Unknown',
    type: formatIdToTitle(media.format) || 'Anime',
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
        role: formatIdToTitle(edge.role) || 'Unknown',
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

const ANIME_CAST_PAGE_QUERY = `
  query AnimeCastPage($id: Int!, $page: Int!, $perPage: Int!) {
    Media(id: $id, type: ANIME) {
      characters(page: $page, perPage: $perPage, sort: [ROLE, RELEVANCE]) {
        pageInfo { currentPage hasNextPage }
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
    }
  }
`;

export const fetchAniListAnimeCastPage = async (animeId: string, page: number, perPage = 10) => {
  const id = Number(animeId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AniListRequestError('An AniList ID is required to load cast.', 400);
  }

  const data = await queryAniList<{
    Media: {
      characters: {
        pageInfo: { currentPage: number; hasNextPage: boolean };
        edges: NonNullable<RawExtrasMedia['characters']>['edges'];
      };
    } | null;
  }>(ANIME_CAST_PAGE_QUERY, { id, page, perPage });

  if (!data.Media) throw new AniListRequestError('Anime cast was not found.', 404);
  const cast = (data.Media.characters.edges ?? [])
    .map((edge) => {
      if (!edge?.node) return null;
      const actor = edge.voiceActors?.[0];
      return {
        id: String(edge.node.id),
        name: edge.node.name?.full || edge.node.name?.native || 'Unknown character',
        image: edge.node.image?.large || '',
        role: formatIdToTitle(edge.role) || 'Unknown',
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
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return { cast, ...data.Media.characters.pageInfo };
};

const formatPersonDate = (date?: RawDate | null) => {
  if (!date?.year) return undefined;
  return [date.day, date.month, date.year].filter(Boolean).join(' / ');
};

const mapCastWork = (
  media: {
    id: number;
    title?: { romaji?: string | null; english?: string | null } | null;
    coverImage?: { large?: string | null; extraLarge?: string | null } | null;
    format?: string | null;
  },
  role?: string
): CastWork => ({
  id: String(media.id),
  title: media.title?.english?.trim() || media.title?.romaji?.trim() || 'Untitled',
  image: media.coverImage?.extraLarge || media.coverImage?.large || '',
  role,
  format: media.format || undefined,
});

export const fetchAniListCastPerson = async (
  kind: CastPersonKind,
  personId: string
): Promise<CastPersonDetails> => {
  const id = Number(personId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AniListRequestError('A valid cast member ID is required.', 400);
  }

  if (kind === 'character') {
    const data = await queryAniList<{
      Character: {
        id: number;
        name?: {
          full?: string | null;
          native?: string | null;
          alternative?: string[] | null;
          alternativeSpoiler?: string[] | null;
        } | null;
        image?: { large?: string | null } | null;
        description?: string | null;
        gender?: string | null;
        dateOfBirth?: RawDate | null;
        age?: number | null;
        bloodType?: string | null;
        favourites?: number | null;
        media?: {
          edges?:
            | {
                node?: Parameters<typeof mapCastWork>[0] | null;
                characterRole?: string | null;
              }[]
            | null;
        } | null;
      } | null;
    }>(CHARACTER_DETAILS_QUERY, { id });

    if (!data.Character) throw new AniListRequestError('Character not found.', 404);
    const character = data.Character;
    return {
      id: String(character.id),
      kind,
      name: character.name?.full || character.name?.native || 'Unknown character',
      nativeName: character.name?.native || undefined,
      alternateNames: character.name?.alternative ?? [],
      spoilerNames: character.name?.alternativeSpoiler ?? [],
      image: character.image?.large || '',
      description: cleanHtml(character.description),
      gender: character.gender || undefined,
      dateOfBirth: formatPersonDate(character.dateOfBirth),
      age: character.age || undefined,
      bloodType: character.bloodType || undefined,
      favourites: character.favourites || undefined,
      siteUrl: undefined,
      works: (character.media?.edges ?? [])
        .filter((edge): edge is typeof edge & { node: Parameters<typeof mapCastWork>[0] } =>
          Boolean(edge.node)
        )
        .map((edge) => mapCastWork(edge.node, edge.characterRole || undefined)),
    };
  }

  const data = await queryAniList<{
    Staff: {
      id: number;
      name?: {
        full?: string | null;
        native?: string | null;
        alternative?: string[] | null;
      } | null;
      image?: { large?: string | null } | null;
      description?: string | null;
      gender?: string | null;
      dateOfBirth?: RawDate | null;
      age?: number | null;
      bloodType?: string | null;
      languageV2?: string | null;
      primaryOccupations?: string[] | null;
      homeTown?: string | null;
      yearsActive?: number[] | null;
      siteUrl?: string | null;
      favourites?: number | null;
      staffMedia?: {
        edges?:
          | {
              node?: Parameters<typeof mapCastWork>[0] | null;
            }[]
          | null;
      } | null;
    } | null;
  }>(STAFF_DETAILS_QUERY, { id });

  if (!data.Staff) throw new AniListRequestError('Voice actor not found.', 404);
  const staff = data.Staff;
  const years = staff.yearsActive;
  return {
    id: String(staff.id),
    kind,
    name: staff.name?.full || staff.name?.native || 'Unknown voice actor',
    nativeName: staff.name?.native || undefined,
    alternateNames: staff.name?.alternative ?? [],
    spoilerNames: [],
    image: staff.image?.large || '',
    description: cleanHtml(staff.description),
    gender: staff.gender || undefined,
    dateOfBirth: formatPersonDate(staff.dateOfBirth),
    age: staff.age || undefined,
    bloodType: staff.bloodType || undefined,
    language: staff.languageV2 || undefined,
    occupations: staff.primaryOccupations ?? [],
    homeTown: staff.homeTown || undefined,
    yearsActive: years?.length
      ? `${years[0]}${years[1] ? ` — ${years[1]}` : ' — Present'}`
      : undefined,
    agency: undefined,
    favourites: staff.favourites || undefined,
    siteUrl: staff.siteUrl || undefined,
    nonAnimeRoles: [],
    works: (staff.staffMedia?.edges ?? [])
      .filter((edge): edge is typeof edge & { node: Parameters<typeof mapCastWork>[0] } =>
        Boolean(edge.node)
      )
      .map((edge) => mapCastWork(edge.node)),
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

const MEDIA_THREADS_QUERY = `
  query MediaThreads($mediaId: Int!) {
    Page(page: 1, perPage: 50) {
      threads(mediaCategoryId: $mediaId, sort: REPLIED_AT_DESC) {
        id
        title
        body
        replyCount
        createdAt
        user { name avatar { medium } }
      }
    }
  }
`;

export type AniListDiscussionThread = {
  id: number;
  title: string;
  body: string;
  replyCount: number;
  createdAt: number;
  user: { name: string; avatar?: string };
};

const toThreadText = (value?: string | null) =>
  (value ?? '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * AniList exposes discussions per anime, not a first-class per-episode thread
 * API. This returns episode-matching threads first, followed by recent anime
 * community threads so the UI can label the distinction honestly.
 */
export const fetchAniListEpisodeDiscussion = async (
  animeId: string,
  episodeNumber: string,
  episodeTitle?: string
): Promise<{
  episodeThreads: AniListDiscussionThread[];
  communityThreads: AniListDiscussionThread[];
}> => {
  const mediaId = Number(animeId);
  if (!Number.isInteger(mediaId) || mediaId <= 0)
    return { episodeThreads: [], communityThreads: [] };

  const data = await queryAniList<{
    Page: {
      threads: {
        id: number;
        title?: string | null;
        body?: string | null;
        replyCount?: number | null;
        createdAt?: number | null;
        user?: { name?: string | null; avatar?: { medium?: string | null } | null } | null;
      }[];
    };
  }>(MEDIA_THREADS_QUERY, { mediaId });

  const titleWords = (episodeTitle ?? '')
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 4)
    .slice(0, 3);
  const episodePattern = new RegExp(
    `\\bepisode\\s*${episodeNumber}\\b|\\bep\\.?\\s*${episodeNumber}\\b`,
    'i'
  );
  const mapped = data.Page.threads.map((thread) => ({
    id: thread.id,
    title: thread.title?.trim() || 'Untitled discussion',
    body: toThreadText(thread.body),
    replyCount: thread.replyCount ?? 0,
    createdAt: thread.createdAt ?? 0,
    user: {
      name: thread.user?.name || 'AniList user',
      avatar: thread.user?.avatar?.medium || undefined,
    },
  }));
  const episodeThreads = mapped.filter((thread) => {
    const searchable = `${thread.title} ${thread.body}`.toLowerCase();
    return episodePattern.test(searchable) || titleWords.some((word) => searchable.includes(word));
  });

  return {
    episodeThreads: episodeThreads.slice(0, 3),
    communityThreads: mapped
      .filter((thread) => !episodeThreads.some((match) => match.id === thread.id))
      .slice(0, 3),
  };
};

type KitsuMappingResponse = {
  data?: {
    id?: string;
    type?: string;
    attributes?: {
      externalSite?: string | null;
      externalId?: string | number | null;
    } | null;
    relationships?: {
      item?: {
        data?: {
          id?: string | null;
          type?: string | null;
        } | null;
      } | null;
    } | null;
  }[];
  included?: {
    id?: string;
    type?: string;
    attributes?: Record<string, unknown>;
  }[];
};

type KitsuEpisodeThumbnail =
  | string
  | {
      original?: string | null;
      url?: string | null;
      meta?: Record<string, unknown> | null;
    }
  | null
  | undefined;

type KitsuEpisodeResponse = {
  data?:
    | {
        id?: string;
        attributes?: {
          number?: number | string | null;
          relativeNumber?: number | string | null;
          canonicalTitle?: string | null;
          titles?: Record<string, string | null> | null;
          description?: string | null;
          synopsis?: string | null;
          airDate?: string | null;
          length?: number | null;
          seasonNumber?: number | null;
          thumbnail?: KitsuEpisodeThumbnail;
        } | null;
      }[]
    | null;
  meta?: {
    count?: number | null;
  } | null;
};

export type KitsuEpisodeMetadata = {
  number: number;
  title: string;
  description?: string;
  synopsis?: string;
  airDate?: string;
  length?: number;
  seasonNumber?: number;
  thumbnail?: string;
};

export type AniListEpisodeImage = {
  /** 1-based episode number parsed from the title string, or 0 if unparseable */
  number: number;
  title: string;
  thumbnail: string;
};

export const resolveKitsuAnimeIdFromMal = async (
  malId: number | string
): Promise<string | null> => {
  if (!malId || Number(malId) <= 0) return null;

  const url =
    `https://kitsu.io/api/edge/mappings?` +
    `filter%5BexternalSite%5D=myanimelist%2Fanime&` +
    `filter%5BexternalId%5D=${encodeURIComponent(String(malId))}&include=item`;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/vnd.api+json' },
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as KitsuMappingResponse;
    const matchingEntry = payload.data?.find(
      (entry) =>
        entry.attributes?.externalSite === 'myanimelist/anime' ||
        entry.attributes?.externalId?.toString() === String(malId)
    );

    const item = matchingEntry?.relationships?.item?.data;
    if (item?.id) return String(item.id);

    const includedAnime = payload.included?.find((entry) => entry.type === 'anime');
    return includedAnime?.id ?? null;
  } catch {
    return null;
  }
};

export type KitsuEpisodeImagePage = {
  images: AniListEpisodeImage[];
  nextOffset?: number;
};

const KITSU_EPISODE_PAGE_LIMIT = 20;

const resolveKitsuEpisodeThumbnail = (thumbnail: KitsuEpisodeThumbnail): string | null => {
  if (typeof thumbnail === 'string' && thumbnail.trim()) return thumbnail;

  if (thumbnail && typeof thumbnail === 'object') {
    const original = thumbnail.original;
    const url = thumbnail.url;

    if (typeof original === 'string' && original.trim()) return original;
    if (typeof url === 'string' && url.trim()) return url;
  }

  return null;
};

const mapKitsuEpisodeMetadata = (
  episode: NonNullable<KitsuEpisodeResponse['data']>[number]
): KitsuEpisodeMetadata | null => {
  const attributes = episode.attributes ?? {};
  const rawNumber = Number(attributes.number ?? attributes.relativeNumber ?? 0);
  const number = Number.isFinite(rawNumber) && rawNumber > 0 ? rawNumber : 0;
  if (!number) return null;

  const title =
    (attributes.titles && (attributes.titles.en || attributes.titles.en_jp)) ||
    attributes.canonicalTitle ||
    `Episode ${number}`;

  return {
    number,
    title,
    description: attributes.description?.trim() || undefined,
    synopsis: attributes.synopsis?.trim() || undefined,
    airDate: attributes.airDate || undefined,
    length: attributes.length ?? undefined,
    seasonNumber: attributes.seasonNumber ?? undefined,
    thumbnail: resolveKitsuEpisodeThumbnail(attributes.thumbnail) || undefined,
  };
};

export const fetchKitsuEpisodeImagesByMalId = async (
  malId: number | string | null | undefined,
  maxPages = Number.POSITIVE_INFINITY
): Promise<AniListEpisodeImage[]> => {
  if (!malId || Number(malId) <= 0) return [];

  const kitsuAnimeId = await resolveKitsuAnimeIdFromMal(malId);
  if (!kitsuAnimeId) {
    return [];
  }

  try {
    const allEpisodes: AniListEpisodeImage[] = [];
    let offset = 0;
    let pageCount = 0;
    while (true) {
      const page = await fetchKitsuEpisodeImagePage(kitsuAnimeId, offset);
      allEpisodes.push(...page.images);
      pageCount += 1;
      if (!page.nextOffset || pageCount >= maxPages) break;
      offset = page.nextOffset;
    }

    return allEpisodes;
  } catch {
    return [];
  }
};

/** Fetch one Kitsu page so episode artwork can appear immediately instead of after a long series. */
export const fetchKitsuEpisodeImagePage = async (
  kitsuAnimeId: string,
  offset = 0
): Promise<KitsuEpisodeImagePage> => {
  try {
    const response = await fetch(
      `https://kitsu.io/api/edge/anime/${encodeURIComponent(kitsuAnimeId)}/episodes?` +
        `page%5Blimit%5D=${KITSU_EPISODE_PAGE_LIMIT}&page%5Boffset%5D=${offset}&sort=number`,
      { headers: { Accept: 'application/vnd.api+json' } }
    );

    if (!response.ok) return { images: [] };

    const payload = (await response.json()) as KitsuEpisodeResponse;
    const rawEpisodes = payload.data ?? [];
    const images = rawEpisodes
      .map(mapKitsuEpisodeMetadata)
      .filter((episode): episode is KitsuEpisodeMetadata => Boolean(episode?.thumbnail))
      .map(
        ({ number, title, thumbnail }) =>
          ({ number, title, thumbnail: thumbnail! }) satisfies AniListEpisodeImage
      );

    const totalCount = payload.meta?.count ?? 0;
    const hasMore =
      rawEpisodes.length === KITSU_EPISODE_PAGE_LIMIT &&
      (totalCount === 0 || offset + rawEpisodes.length < totalCount);

    return {
      images,
      nextOffset: hasMore ? offset + rawEpisodes.length : undefined,
    };
  } catch {
    return { images: [] };
  }
};

/**
 * Fetches one Kitsu episode by its 1-based number. Keeping this request small
 * avoids loading every episode of long-running anime just to populate the
 * player metadata panel.
 */
export const fetchKitsuEpisodeDetails = async (
  kitsuAnimeId: string,
  episodeNumber: string
): Promise<KitsuEpisodeMetadata | null> => {
  const number = Number(episodeNumber);
  if (!kitsuAnimeId || !Number.isFinite(number) || number <= 0) return null;

  try {
    const response = await fetch(
      `https://kitsu.io/api/edge/anime/${encodeURIComponent(kitsuAnimeId)}/episodes?` +
        `page%5Blimit%5D=1&page%5Boffset%5D=${Math.max(0, Math.floor(number) - 1)}&sort=number`,
      { headers: { Accept: 'application/vnd.api+json' } }
    );

    if (!response.ok) return null;
    const payload = (await response.json()) as KitsuEpisodeResponse;
    const episode = payload.data?.map(mapKitsuEpisodeMetadata).find(Boolean) ?? null;
    return episode?.number === number ? episode : null;
  } catch {
    return null;
  }
};

/**
 * Fetches per-episode thumbnails from AniList's `streamingEpisodes` field.
 * AniList titles are usually formatted as "Episode N - Title" or "Episode N".
 * Returns an empty array when the anime has no streaming episode data.
 */
export const fetchAniListStreamingEpisodeImages = async (
  animeId: string
): Promise<AniListEpisodeImage[]> => {
  const numericId = Number(animeId);
  if (!Number.isInteger(numericId) || numericId <= 0) return [];

  try {
    const data = await queryAniList<{
      Media: { streamingEpisodes?: RawStreamingEpisode[] | null } | null;
    }>(EPISODE_IMAGES_QUERY, { id: numericId });

    return (data.Media?.streamingEpisodes ?? [])
      .filter((ep): ep is Required<Pick<RawStreamingEpisode, 'thumbnail'>> & RawStreamingEpisode =>
        Boolean(ep.thumbnail)
      )
      .map((ep) => {
        const match = ep.title?.match(/Episode\s+(\d+(?:\.\d+)?)\s*(?:-\s*(.+))?/i);
        const number = match ? parseFloat(match[1]) : 0;
        const title = match?.[2]?.trim() || ep.title || `Episode ${number}`;
        return { number, title, thumbnail: ep.thumbnail! };
      });
  } catch {
    return [];
  }
};

export const fetchEpisodeImagesForAnime = async (
  animeId: string,
  malId?: number | null
): Promise<AniListEpisodeImage[]> => {
  const results = new Map<string, AniListEpisodeImage>();
  const [kitsuImages, anilistImages] = await Promise.all([
    fetchKitsuEpisodeImagesByMalId(malId),
    fetchAniListStreamingEpisodeImages(animeId),
  ]);

  for (const image of [...kitsuImages, ...anilistImages]) {
    const key = getEpisodeNumberKey(image.number);
    if (key && !results.has(key)) results.set(key, image);
  }

  return Array.from(results.values()).sort((a, b) => a.number - b.number);
};

export const fetchAniListEpisodeImages = async (
  animeId: string,
  malId?: number | null
): Promise<AniListEpisodeImage[]> => fetchEpisodeImagesForAnime(animeId, malId);

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
