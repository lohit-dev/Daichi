import { cleanHtml, formatIdToTitle } from '~/helpers/text';
import {
  AniListAnimeDetails,
  AniListAnimeExtras,
  AniListHomeResponse,
  AniListSearchResponse,
  Anime,
  CastPersonDetails,
  CastPersonKind,
  CharacterVoiceActor,
  SearchParams,
} from '~/types';

export type BrowseCategory =
  'trending' | 'popular' | 'airing' | 'upcoming' | 'completed' | 'recent';

export type AniListCastPageResponse = {
  cast: CharacterVoiceActor[];
  currentPage: number;
  hasNextPage: boolean;
};

const KITSU_BASE_URL = 'https://kitsu.io/api/edge';
const REQUEST_TIMEOUT_MS = 12_000;

export class KitsuRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'KitsuRequestError';
    this.status = status;
  }
}

type KitsuAnimeAttributes = {
  slug?: string;
  synopsis?: string;
  description?: string;
  titles?: {
    en?: string | null;
    en_jp?: string | null;
    ja_jp?: string | null;
  };
  canonicalTitle?: string;
  abbreviatedTitles?: string[];
  averageRating?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  subtype?: string | null;
  status?: string | null;
  posterImage?: {
    tiny?: string;
    small?: string;
    medium?: string;
    large?: string;
    original?: string;
  } | null;
  coverImage?: {
    tiny?: string;
    small?: string;
    large?: string;
    original?: string;
  } | null;
  episodeCount?: number | null;
  episodeLength?: number | null;
  youtubeVideoId?: string | null;
};

export type KitsuAnimeItem = {
  id: string;
  type: string;
  attributes: KitsuAnimeAttributes;
  relationships?: Record<string, unknown>;
};

type KitsuIncludedItem = {
  id: string;
  type: string;
  attributes: Record<string, any>;
};

type KitsuListResponse = {
  data: KitsuAnimeItem[];
  included?: KitsuIncludedItem[];
  meta?: { count?: number };
  links?: { next?: string };
};

type KitsuSingleResponse = {
  data: KitsuAnimeItem | null;
  included?: KitsuIncludedItem[];
};

async function fetchKitsuJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const url = path.startsWith('http') ? path : `${KITSU_BASE_URL}${path}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new KitsuRequestError(`Kitsu request failed (${response.status})`, response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof KitsuRequestError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new KitsuRequestError('Kitsu request timed out. Please try again.', 408);
    }
    throw new KitsuRequestError(
      error instanceof Error ? error.message : 'Unable to reach Kitsu.',
      0
    );
  } finally {
    clearTimeout(timeout);
  }
}

const resolveTitle = (attr: KitsuAnimeAttributes): string => {
  return attr.canonicalTitle || attr.titles?.en || attr.titles?.en_jp || 'Unknown Title';
};

const resolveStatus = (status?: string | null): string => {
  switch (status?.toLowerCase()) {
    case 'current':
      return 'Releasing';
    case 'finished':
      return 'Finished';
    case 'upcoming':
    case 'unreleased':
    case 'tba':
      return 'Not Yet Aired';
    default:
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  }
};

const extractMappings = (included?: KitsuIncludedItem[]) => {
  let anilistId: number | null = null;
  let malId: number | null = null;

  if (included) {
    for (const item of included) {
      if (item.type === 'mappings') {
        const site = item.attributes?.externalSite;
        const externalId = Number(item.attributes?.externalId);
        if (Number.isFinite(externalId)) {
          if (site === 'anilist/anime') anilistId = externalId;
          if (site === 'myanimelist/anime') malId = externalId;
        }
      }
    }
  }

  return { anilistId, malId };
};

const extractCategories = (included?: KitsuIncludedItem[]): string[] => {
  if (!included) return [];
  return included
    .filter((item) => item.type === 'categories')
    .map((item) => item.attributes?.title)
    .filter((title): title is string => Boolean(title));
};

export const mapKitsuAnime = (
  item: KitsuAnimeItem,
  rank?: number,
  included?: KitsuIncludedItem[]
): Anime => {
  const attr = item.attributes;
  const { anilistId, malId } = extractMappings(included);
  const categories = extractCategories(included);

  const rating = attr.averageRating ? (Number(attr.averageRating) / 10).toFixed(1) : undefined;

  const year = attr.startDate ? attr.startDate.split('-')[0] : 'TBA';
  const format = formatIdToTitle(attr.subtype || 'TV');

  return {
    title: resolveTitle(attr),
    slug: item.id,
    image:
      attr.posterImage?.large ||
      attr.posterImage?.original ||
      attr.posterImage?.medium ||
      attr.posterImage?.small ||
      '',
    trailer: attr.youtubeVideoId ? { id: attr.youtubeVideoId, site: 'youtube' } : undefined,
    synopsis: cleanHtml(attr.synopsis || attr.description || ''),
    quality: format,
    rating,
    date: year,
    type: format,
    episode: attr.episodeCount ? `${attr.episodeCount} Episodes` : undefined,
    episodeNumber: attr.episodeCount ? String(attr.episodeCount) : undefined,
    genres: categories,
    rank,
    aniListId: anilistId ?? Number(item.id),
    malId,
  };
};

export const mapKitsuDetails = (
  item: KitsuAnimeItem,
  included?: KitsuIncludedItem[],
  originalIdentifier?: string
): AniListAnimeDetails => {
  const attr = item.attributes;
  const title = resolveTitle(attr);
  const { anilistId, malId } = extractMappings(included);
  const categories = extractCategories(included);

  const titles = [
    attr.titles?.en,
    attr.titles?.en_jp,
    attr.titles?.ja_jp,
    ...(attr.abbreviatedTitles ?? []),
  ]
    .filter((t): t is string => Boolean(t?.trim()))
    .filter((t, i, arr) => arr.indexOf(t) === i && t !== title);

  const format = formatIdToTitle(attr.subtype || 'TV');
  const duration = attr.episodeLength ? `${attr.episodeLength}m` : 'Unknown';
  const year = attr.startDate ? attr.startDate.split('-')[0] : 'TBA';
  const rating = attr.averageRating ? (Number(attr.averageRating) / 10).toFixed(1) : 'N/A';

  const numericOriginal = Number(originalIdentifier);
  const resolvedAniListId =
    anilistId ??
    (Number.isInteger(numericOriginal) && numericOriginal > 0 ? numericOriginal : null);

  return {
    id: item.id,
    title,
    alternateTitles: titles,
    image:
      attr.posterImage?.large ||
      attr.posterImage?.original ||
      attr.posterImage?.medium ||
      attr.posterImage?.small ||
      '',
    bannerImage:
      attr.coverImage?.large || attr.coverImage?.original || attr.coverImage?.small || undefined,
    synopsis:
      cleanHtml(attr.synopsis || attr.description || '') ||
      'No description is available for this anime.',
    rating,
    quality: format,
    genres: categories.length ? categories : ['Anime'],
    status: resolveStatus(attr.status),
    released: year,
    duration,
    type: format,
    malRating: attr.averageRating ? `${attr.averageRating}%` : 'N/A',
    aniListId: resolvedAniListId,
    malId,
    trailer: attr.youtubeVideoId ? { id: attr.youtubeVideoId, site: 'youtube' } : undefined,
    studios: [],
  };
};

// ---------------------------------------------------------------------------
// 1. Home Page
// ---------------------------------------------------------------------------

export const fetchKitsuHomePage = async (): Promise<AniListHomeResponse> => {
  const [trendingRes, recentRes, upcomingRes, topAiringRes, newlyAddedRes, completedRes] =
    await Promise.all([
      fetchKitsuJson<KitsuListResponse>('/trending/anime?limit=10'),
      fetchKitsuJson<KitsuListResponse>(
        '/anime?filter[status]=current&sort=-startDate&page[limit]=20'
      ),
      fetchKitsuJson<KitsuListResponse>(
        '/anime?filter[status]=upcoming&sort=-userCount&page[limit]=20'
      ),
      fetchKitsuJson<KitsuListResponse>(
        '/anime?filter[status]=current&sort=-userCount&page[limit]=20'
      ),
      fetchKitsuJson<KitsuListResponse>('/anime?sort=-userCount&page[limit]=20'),
      fetchKitsuJson<KitsuListResponse>(
        '/anime?filter[status]=finished&sort=-userCount&page[limit]=20'
      ),
    ]);

  return {
    data: {
      spotlight: trendingRes.data.map((item, index) => mapKitsuAnime(item, index + 1)),
      recentUpdates: recentRes.data.map((item) => mapKitsuAnime(item)),
      upcoming: upcomingRes.data.map((item) => mapKitsuAnime(item)),
      topTables: {
        newReleases: topAiringRes.data.map((item) => mapKitsuAnime(item)),
        newlyAdded: newlyAddedRes.data.map((item) => mapKitsuAnime(item)),
        justCompleted: completedRes.data.map((item) => mapKitsuAnime(item)),
      },
    },
  };
};

// ---------------------------------------------------------------------------
// 2. Search
// ---------------------------------------------------------------------------

export const fetchKitsuSearch = async (params: SearchParams): Promise<AniListSearchResponse> => {
  const page = params.page ?? 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  let queryUrl = `/anime?page[limit]=${limit}&page[offset]=${offset}`;

  if (params.q && params.q.trim().length > 0) {
    queryUrl += `&filter[text]=${encodeURIComponent(params.q.trim())}`;
  } else {
    queryUrl += `&sort=-userCount`;
  }

  const response = await fetchKitsuJson<KitsuListResponse>(queryUrl);

  const results = response.data.map((item) => mapKitsuAnime(item, undefined, response.included));

  const hasNextPage = Boolean(response.links?.next || response.data.length === limit);

  return {
    results,
    pagination: {
      currentPage: page,
      hasNextPage,
    },
  };
};

// ---------------------------------------------------------------------------
// 3. Anime Details
// ---------------------------------------------------------------------------

export const resolveAniListIdFromKitsuId = async (
  kitsuId: string | number
): Promise<string | null> => {
  try {
    const res = await fetchKitsuJson<{
      data: { attributes: { externalSite: string; externalId: string } }[];
    }>(`/anime/${kitsuId}/mappings?filter[external_site]=anilist/anime`);
    const mapping = res.data?.find((m) => m.attributes?.externalSite === 'anilist/anime');
    return mapping?.attributes?.externalId || null;
  } catch {
    return null;
  }
};

export const fetchKitsuAnimeByKitsuId = async (
  kitsuId: string | number,
  originalIdentifier?: string
): Promise<AniListAnimeDetails> => {
  const directRes = await fetchKitsuJson<KitsuSingleResponse>(
    `/anime/${kitsuId}?include=categories,mappings`
  );
  if (!directRes.data) {
    throw new KitsuRequestError('Anime not found on Kitsu.', 404);
  }
  const details = mapKitsuDetails(directRes.data, directRes.included, originalIdentifier);
  if (!details.aniListId) {
    const mappedAniListId = await resolveAniListIdFromKitsuId(kitsuId);
    if (mappedAniListId) {
      details.aniListId = Number(mappedAniListId);
    }
  }
  return details;
};

export const fetchKitsuAnimeByAniListId = async (
  aniListId: string | number
): Promise<AniListAnimeDetails> => {
  const numericId = Number(aniListId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new KitsuRequestError('A valid numeric AniList ID is required.', 400);
  }

  const mappingRes = await fetchKitsuJson<{
    data: { id: string }[];
    included?: KitsuIncludedItem[];
  }>(`/mappings?filter[external_site]=anilist/anime&filter[external_id]=${numericId}&include=item`);

  const animeItem = mappingRes.included?.find((item) => item.type === 'anime');
  if (!animeItem) {
    throw new KitsuRequestError(`No Kitsu mapping found for AniList ID ${aniListId}.`, 404);
  }

  return fetchKitsuAnimeByKitsuId(animeItem.id, String(aniListId));
};

export const fetchKitsuAnimeById = async (
  identifier: string,
  preferAniListMapping = false
): Promise<AniListAnimeDetails> => {
  const cleanId = identifier.trim();

  // If explicitly requested or prefixed with anilist-, look up external mapping
  if (preferAniListMapping || cleanId.startsWith('anilist:') || cleanId.startsWith('anilist-')) {
    const rawId = cleanId.replace(/^anilist[:-]/, '');
    return fetchKitsuAnimeByAniListId(rawId);
  }

  const numericId = Number(cleanId);

  // Strategy 1: Direct Kitsu ID lookup
  if (Number.isInteger(numericId) && numericId > 0) {
    try {
      return await fetchKitsuAnimeByKitsuId(numericId, cleanId);
    } catch {
      // Fall through to external mapping if direct Kitsu ID failed
    }
  }

  // Strategy 2: Check if numeric ID is an AniList ID in external mappings
  if (Number.isInteger(numericId) && numericId > 0) {
    try {
      return await fetchKitsuAnimeByAniListId(numericId);
    } catch {
      // Fall through
    }
  }

  // Strategy 3: Lookup by slug
  try {
    const slugRes = await fetchKitsuJson<KitsuListResponse>(
      `/anime?filter[slug]=${encodeURIComponent(cleanId)}&include=categories,mappings`
    );
    if (slugRes.data.length > 0) {
      return mapKitsuDetails(slugRes.data[0], slugRes.included, cleanId);
    }
  } catch {
    // Fall through
  }

  // Strategy 4: Fallback search by title
  const searchRes = await fetchKitsuJson<KitsuListResponse>(
    `/anime?filter[text]=${encodeURIComponent(cleanId.replace(/-/g, ' '))}&page[limit]=1&include=categories,mappings`
  );

  if (!searchRes.data.length) {
    throw new KitsuRequestError('Anime not found on Kitsu.', 404);
  }

  return mapKitsuDetails(searchRes.data[0], searchRes.included, cleanId);
};

// ---------------------------------------------------------------------------
// 4. Extras (Studios, Cast, Recommendations)
// ---------------------------------------------------------------------------

export const fetchKitsuAnimeExtras = async (identifier: string): Promise<AniListAnimeExtras> => {
  let kitsuId = identifier;

  // Resolve Kitsu ID if needed
  const numericId = Number(identifier);
  if (Number.isInteger(numericId) && numericId > 0) {
    try {
      const details = await fetchKitsuAnimeById(identifier);
      kitsuId = details.id;
    } catch {
      // continue with identifier
    }
  }

  const [charactersRes, relationshipsRes] = await Promise.allSettled([
    fetchKitsuJson<{
      data: { id: string; attributes: { role?: string } }[];
      included?: KitsuIncludedItem[];
    }>(`/anime/${kitsuId}/characters?include=character&page[limit]=12`),
    fetchKitsuJson<{
      data: { id: string }[];
      included?: KitsuIncludedItem[];
    }>(`/anime/${kitsuId}/media-relationships?include=destination&page[limit]=12`),
  ]);

  const cast: CharacterVoiceActor[] = [];
  if (charactersRes.status === 'fulfilled' && charactersRes.value.included) {
    const included = charactersRes.value.included;
    for (const charData of charactersRes.value.data) {
      const role = charData.attributes?.role || 'supporting';
      const charId = (charData as any).relationships?.character?.data?.id;
      const charItem = included.find((inc) => inc.type === 'characters' && inc.id === charId);
      if (charItem) {
        cast.push({
          id: charItem.id,
          name: charItem.attributes?.canonicalName || charItem.attributes?.names?.en || 'Unknown',
          image:
            charItem.attributes?.image?.large ||
            charItem.attributes?.image?.original ||
            charItem.attributes?.image?.medium ||
            '',
          role: role.charAt(0).toUpperCase() + role.slice(1),
        });
      }
    }
  }

  const recommendations: Anime[] = [];
  if (relationshipsRes.status === 'fulfilled' && relationshipsRes.value.included) {
    const animeItems = relationshipsRes.value.included.filter((inc) => inc.type === 'anime');
    for (const item of animeItems) {
      recommendations.push(
        mapKitsuAnime({
          id: item.id,
          type: 'anime',
          attributes: item.attributes,
        })
      );
    }
  }

  return {
    studios: [],
    cast,
    recommendations,
  };
};

// ---------------------------------------------------------------------------
// 5. Cast Page
// ---------------------------------------------------------------------------

export const fetchKitsuAnimeCastPage = async (
  identifier: string,
  page = 1,
  perPage = 10
): Promise<AniListCastPageResponse> => {
  let kitsuId = identifier;
  const numericId = Number(identifier);
  if (Number.isInteger(numericId) && numericId > 0) {
    try {
      const details = await fetchKitsuAnimeById(identifier);
      kitsuId = details.id;
    } catch {
      // ignore
    }
  }

  const offset = (page - 1) * perPage;
  const res = await fetchKitsuJson<{
    data: { id: string; attributes: { role?: string } }[];
    included?: KitsuIncludedItem[];
    links?: { next?: string };
  }>(
    `/anime/${kitsuId}/characters?include=character&page[limit]=${perPage}&page[offset]=${offset}`
  );

  const cast: CharacterVoiceActor[] = [];
  if (res.included) {
    for (const charData of res.data) {
      const role = charData.attributes?.role || 'supporting';
      const charId = (charData as any).relationships?.character?.data?.id;
      const charItem = res.included.find((inc) => inc.type === 'characters' && inc.id === charId);
      if (charItem) {
        cast.push({
          id: charItem.id,
          name: charItem.attributes?.canonicalName || charItem.attributes?.names?.en || 'Unknown',
          image:
            charItem.attributes?.image?.large ||
            charItem.attributes?.image?.original ||
            charItem.attributes?.image?.medium ||
            '',
          role: role.charAt(0).toUpperCase() + role.slice(1),
        });
      }
    }
  }

  return {
    cast,
    currentPage: page,
    hasNextPage: Boolean(res.links?.next || res.data.length === perPage),
  };
};

// ---------------------------------------------------------------------------
// 6. Cast Person / Character Details
// ---------------------------------------------------------------------------

export const fetchKitsuCastPerson = async (
  kind: CastPersonKind,
  personId: string
): Promise<CastPersonDetails> => {
  if (kind === 'character') {
    const res = await fetchKitsuJson<{
      data: {
        id: string;
        attributes: {
          canonicalName?: string;
          names?: Record<string, string>;
          image?: { large?: string; original?: string };
          description?: string;
        };
      };
      included?: KitsuIncludedItem[];
    }>(`/characters/${personId}?include=mediaCharacters.media`);

    const attr = res.data.attributes;
    const works = (res.included || [])
      .filter((inc) => inc.type === 'anime')
      .map((inc) => ({
        id: inc.id,
        title: inc.attributes?.canonicalTitle || inc.attributes?.titles?.en || 'Unknown',
        image: inc.attributes?.posterImage?.large || inc.attributes?.posterImage?.original || '',
        format: inc.attributes?.subtype || 'TV',
      }));

    const alternateNames = attr.names ? Object.values(attr.names).filter(Boolean) : [];
    return {
      id: res.data.id,
      kind: 'character',
      name: attr.canonicalName || attr.names?.en || 'Unknown character',
      alternateNames,
      spoilerNames: [],
      image: attr.image?.large || attr.image?.original || '',
      description: cleanHtml(attr.description || ''),
      works,
    };
  }

  // Staff / Person fallback
  try {
    const res = await fetchKitsuJson<{
      data: {
        id: string;
        attributes: {
          name?: string;
          image?: { large?: string; original?: string };
          description?: string;
        };
      };
    }>(`/people/${personId}`);

    return {
      id: res.data.id,
      kind: 'staff',
      name: res.data.attributes?.name || 'Unknown staff',
      alternateNames: [],
      spoilerNames: [],
      image: res.data.attributes?.image?.large || res.data.attributes?.image?.original || '',
      description: cleanHtml(res.data.attributes?.description || ''),
      works: [],
    };
  } catch {
    return {
      id: personId,
      kind: 'staff',
      name: 'Unknown staff',
      alternateNames: [],
      spoilerNames: [],
      image: '',
      description: '',
      works: [],
    };
  }
};

// ---------------------------------------------------------------------------
// 7. Subbed / Dubbed / Browse
// ---------------------------------------------------------------------------

export const fetchKitsuSubbed = async (): Promise<Anime[]> => {
  const res = await fetchKitsuJson<KitsuListResponse>(
    '/anime?sort=-userCount&page[limit]=20&include=categories'
  );
  return res.data.map((item) => mapKitsuAnime(item, undefined, res.included));
};

export const fetchKitsuDubbed = async (): Promise<Anime[]> => {
  const res = await fetchKitsuJson<KitsuListResponse>(
    '/anime?sort=-averageRating&page[limit]=20&include=categories'
  );
  return res.data.map((item) => mapKitsuAnime(item, undefined, res.included));
};

export const fetchKitsuSubbedPage = async (
  page = 1,
  perPage = 12
): Promise<AniListSearchResponse> => {
  const offset = (page - 1) * perPage;
  const res = await fetchKitsuJson<KitsuListResponse>(
    `/anime?sort=-userCount&page[limit]=${perPage}&page[offset]=${offset}&include=categories`
  );
  return {
    results: res.data.map((item) => mapKitsuAnime(item, undefined, res.included)),
    pagination: {
      currentPage: page,
      hasNextPage: Boolean(res.links?.next || res.data.length === perPage),
    },
  };
};

export const fetchKitsuDubbedPage = async (
  page = 1,
  perPage = 12
): Promise<AniListSearchResponse> => {
  const offset = (page - 1) * perPage;
  const res = await fetchKitsuJson<KitsuListResponse>(
    `/anime?sort=-averageRating&page[limit]=${perPage}&page[offset]=${offset}&include=categories`
  );
  return {
    results: res.data.map((item) => mapKitsuAnime(item, undefined, res.included)),
    pagination: {
      currentPage: page,
      hasNextPage: Boolean(res.links?.next || res.data.length === perPage),
    },
  };
};

export const fetchKitsuBrowse = async (
  category: BrowseCategory,
  page = 1,
  perPage = 12
): Promise<AniListSearchResponse> => {
  const offset = (page - 1) * perPage;
  let query = '';

  switch (category) {
    case 'trending':
      query = `/trending/anime?limit=${perPage}&page[offset]=${offset}`;
      break;
    case 'airing':
      query = `/anime?filter[status]=current&sort=-userCount&page[limit]=${perPage}&page[offset]=${offset}`;
      break;
    case 'upcoming':
      query = `/anime?filter[status]=upcoming&sort=-userCount&page[limit]=${perPage}&page[offset]=${offset}`;
      break;
    case 'completed':
      query = `/anime?filter[status]=finished&sort=-userCount&page[limit]=${perPage}&page[offset]=${offset}`;
      break;
    case 'recent':
      query = `/anime?filter[status]=current&sort=-startDate&page[limit]=${perPage}&page[offset]=${offset}`;
      break;
    case 'popular':
    default:
      query = `/anime?sort=-userCount&page[limit]=${perPage}&page[offset]=${offset}`;
      break;
  }

  const res = await fetchKitsuJson<KitsuListResponse>(query);
  return {
    results: res.data.map((item) => mapKitsuAnime(item)),
    pagination: {
      currentPage: page,
      hasNextPage: Boolean(res.links?.next || res.data.length === perPage),
    },
  };
};
