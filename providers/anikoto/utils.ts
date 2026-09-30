// ---------------------------------------------------------------------------
// Anikoto — pure utility functions (IDs, parsers, stream helpers)
// ---------------------------------------------------------------------------

import {
  AnikotoId,
  AnikotoCzId,
  SearchSort,
  SearchResult,
  ShowDetails,
  Episode,
  Stream,
  Subtitle,
  TimeRange,
  ThumbCue,
  Mode,
} from './types';

export { RateLimitedError } from './errors';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';

const MEGAPLAY_HOSTS = [
  'megaplay.buzz',
  'mewstream.buzz',
  'lostproject.club',
  'voltara.click',
  'kotocdn.site',
  'megap.shiora.top',
  'shiora.top',
  'megap.kotocdn.site',
  'megap.akirax.buzz',
  'akirax.buzz',
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// ─── ID HELPERS ──────────────────────────────────────────────────────────────

export const encodeId = (id: AnikotoId) => 'anikoto:' + encodeURIComponent(JSON.stringify(id));

export function decodeId(value: string): AnikotoId {
  if (value !== '' && [...value].every((c) => c >= '0' && c <= '9')) return { anikotoId: value };
  if (!value.startsWith('anikoto:')) throw new Error('invalid Anikoto show ID');
  try {
    return JSON.parse(decodeURIComponent(value.slice('anikoto:'.length)));
  } catch {
    throw new Error('invalid Anikoto show metadata');
  }
}

export const providerFromShowId = (id: string): 'anikoto' | 'anikoto2' =>
  id.startsWith('anikoto2:') ? 'anikoto2' : 'anikoto';

// ─── CZ ID HELPERS ───────────────────────────────────────────────────────────

export function encodeCzId(value: AnikotoCzId): string {
  const bytes = utf8Bytes(JSON.stringify(value));
  let encoded = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = bytes[index + 1];
    const c = bytes[index + 2];
    encoded += ALPHABET[a >> 2];
    encoded += ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (b !== undefined) encoded += ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (c !== undefined) encoded += ALPHABET[c & 63];
  }
  return `anikoto2:${encoded}`;
}

export function decodeCzId(value: string): AnikotoCzId {
  const rawSlug = value.startsWith('anikoto2:') ? undefined : value;
  if (rawSlug && validSlug(rawSlug)) return { slug: rawSlug, title: rawSlug.split('-').join(' ') };
  if (!value.startsWith('anikoto2:')) throw new Error('invalid Anikoto.cz show ID');
  const encoded = value.slice('anikoto2:'.length);
  const bytes: number[] = [];
  let accumulator = 0;
  let bits = 0;
  for (const character of encoded) {
    const digit = ALPHABET.indexOf(character);
    if (digit < 0) throw new Error('invalid Anikoto.cz show ID encoding');
    accumulator = (accumulator << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((accumulator >> bits) & 255);
    }
  }
  try {
    const percentEncoded = bytes.map((byte) => `%${byte.toString(16).padStart(2, '0')}`).join('');
    const decoded = JSON.parse(decodeURIComponent(percentEncoded)) as AnikotoCzId;
    if (!validSlug(decoded.slug) || typeof decoded.title !== 'string')
      throw new Error('invalid metadata');
    return decoded;
  } catch {
    throw new Error('invalid Anikoto.cz show metadata');
  }
}

export function validSlug(value: string): boolean {
  if (value.length < 1 || value.length > 200) return false;
  for (const character of value.toLowerCase()) {
    if (!(
      (character >= 'a' && character <= 'z') ||
      (character >= '0' && character <= '9') ||
      character === '-'
    ))
      return false;
  }
  return value[0] !== '-';
}

// ─── SEARCH / SORT HELPERS ───────────────────────────────────────────────────

export function parseSearchSort(value: string): SearchSort {
  const normalized = value.trim().toLowerCase().split('_').join('-');
  const aliases: Record<string, SearchSort> = {
    'latest-updated': 'latest-updated',
    'latest-added': 'latest-added',
    score: 'score',
    'name-az': 'name-az',
    nameaz: 'name-az',
    'release-date': 'release-date',
    releasedate: 'release-date',
    'most-viewed': 'most-viewed',
    mostviewed: 'most-viewed',
    'number-of-episodes': 'number_of_episodes',
    numberofepisodes: 'number_of_episodes',
  };
  const sort = aliases[normalized];
  if (!sort)
    throw new Error(
      'search sort must be one of: latest-updated, latest-added, score, name-az, release-date, most-viewed, number_of_episodes'
    );
  return sort;
}

const normalizeTitle = (s: string) =>
  [...s]
    .filter((c) => c.toLowerCase() !== c.toUpperCase() || (c >= '0' && c <= '9'))
    .join('')
    .toLowerCase();

// ─── EPISODE HELPERS ─────────────────────────────────────────────────────────

export function sortEpisodes(episodes: string[]): void {
  episodes.sort((left, right) => {
    const a = Number(left);
    const b = Number(right);
    if (Number.isFinite(a) && Number.isFinite(b)) return a - b;
    return left.localeCompare(right);
  });
}

export function expandEpisodeSelection(selection: string, available: string[]): string[] {
  const trimmed = selection.trim();
  if (trimmed === '-1') {
    const last = available[available.length - 1];
    if (last === undefined) throw new Error('no episodes available');
    return [last];
  }
  if ([...trimmed].some((character) => character.trim() === '')) {
    const requested: string[] = [];
    let current = '';
    for (const character of trimmed) {
      if (character.trim() === '') {
        if (current) requested.push(current);
        current = '';
      } else current += character;
    }
    if (current) requested.push(current);
    if (requested.every((episode) => available.includes(episode))) return requested;
    throw new Error('one or more selected episodes do not exist');
  }
  const rangeSeparator = trimmed.indexOf('-');
  if (rangeSeparator >= 0) {
    const start = trimmed.slice(0, rangeSeparator);
    let end = trimmed.slice(rangeSeparator + 1);
    if (end === '-1' || end === '') end = available[available.length - 1] ?? '';
    const startIndex = available.indexOf(start);
    const endIndex = available.indexOf(end);
    if (startIndex < 0) throw new Error('range start does not exist');
    if (endIndex < 0) throw new Error('range end does not exist');
    if (startIndex > endIndex) throw new Error('episode range is reversed');
    return available.slice(startIndex, endIndex + 1);
  }
  if (available.includes(trimmed)) return [trimmed];
  throw new Error('episode does not exist');
}

// ─── STREAM HELPERS ──────────────────────────────────────────────────────────

function resolutionWeight(value: string): number {
  let digits = '';
  for (const character of value) {
    if (character >= '0' && character <= '9') digits += character;
    else break;
  }
  return Number(digits) || (value.toLowerCase() === 'auto' ? -1 : 0);
}

function providerWeight(value: string | undefined): number {
  const provider = (value ?? '').toLowerCase();
  if (provider.includes('s-mp4')) return 3000;
  if (provider.includes('mp4')) return 2000;
  if (provider.includes('default')) return 1000;
  return 0;
}

export function sortStreams(streams: Stream[]): void {
  streams.sort(
    (a, b) =>
      providerWeight(b.provider) - providerWeight(a.provider) ||
      resolutionWeight(b.resolution) - resolutionWeight(a.resolution) ||
      Number(b.hls) - Number(a.hls) ||
      (a.provider ?? '').localeCompare(b.provider ?? '')
  );
}

export function chooseQuality(streams: Stream[], quality: string): Stream | undefined {
  if (!streams.length) return undefined;
  const requested = quality.trim().toLowerCase();
  if (requested === 'best') return streams[0];
  if (requested === 'worst') {
    const numbered = streams.filter((stream) => resolutionWeight(stream.resolution) > 0);
    return (
      numbered.reduce<Stream | undefined>(
        (worst, stream) =>
          !worst || resolutionWeight(stream.resolution) < resolutionWeight(worst.resolution)
            ? stream
            : worst,
        undefined
      ) ?? streams[streams.length - 1]
    );
  }
  return (
    streams.find((stream) => stream.resolution.toLowerCase().includes(requested)) ?? streams[0]
  );
}

// ─── PAYLOAD PARSERS ─────────────────────────────────────────────────────────

const str = (v: any): string | undefined => {
  if (typeof v === 'string') return v.trim() || undefined;
  if (typeof v === 'number') return String(v);
  return undefined;
};

const num = (v: any): number | undefined => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return undefined;
};

export function parseSearchPayload(value: any, allowAdult: boolean): SearchResult[] {
  const items: any[] =
    value?.data?.Page?.media ??
    (Array.isArray(value?.data) ? value.data : Array.isArray(value) ? value : []);
  const out: SearchResult[] = [];
  for (const item of items) {
    if (!allowAdult && (item?.isAdult ?? item?.is_adult) === true) continue;
    const anilistId = str(item?.ani_id ?? item?.id);
    if (!anilistId) continue;
    const t = item.title;
    const title =
      (typeof t === 'string' ? t : undefined) ??
      (t && typeof t === 'object'
        ? (['english', 'romaji', 'native'] as const).map((k) => str(t[k])).find(Boolean)
        : undefined) ??
      str(item.name) ??
      `AniList ${anilistId}`;
    const episodes = num(item.episodes) ?? 0;
    let anikotoId: string | undefined;
    if (item.ani_id !== undefined) {
      const itemId = str(item.id);
      if (itemId !== str(item.ani_id)) anikotoId = itemId;
    }
    const cover =
      str(item.coverImage?.extraLarge) ??
      str(item.coverImage?.large) ??
      str(item.poster ?? item.image ?? item.cover);
    const year = num(item.seasonYear) ?? num(item.year);
    out.push({
      cover,
      banner: str(item.bannerImage),
      color: str(item.coverImage?.color),
      format: str(item.format),
      status: str(item.status),
      year,
      score: num(item.averageScore),
      genres: Array.isArray(item.genres)
        ? item.genres.filter((g: any) => typeof g === 'string')
        : undefined,
      provider: 'anikoto',
      id: encodeId({
        anilistId,
        malId: str(item.idMal ?? item.mal_id),
        anikotoId,
        title,
        episodes: Number.isFinite(episodes) && episodes > 0 ? Math.trunc(episodes) : undefined,
      }),
      name: title,
      episodes,
    });
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');
function fuzzyDate(d: any): string | undefined {
  if (!d?.year) return undefined;
  return d.month
    ? d.day
      ? `${d.year}-${pad(d.month)}-${pad(d.day)}`
      : `${d.year}-${pad(d.month)}`
    : String(d.year);
}

export function parseDetails(value: any): ShowDetails | null {
  const m = value?.data?.Media;
  if (!m || m.id === undefined) return null;
  const trailer =
    m.trailer?.id && m.trailer?.site
      ? {
          site: String(m.trailer.site),
          id: String(m.trailer.id),
          url:
            m.trailer.site === 'youtube'
              ? `https://www.youtube.com/watch?v=${m.trailer.id}`
              : undefined,
        }
      : undefined;
  return {
    anilistId: String(m.id),
    malId: str(m.idMal),
    title: {
      romaji: str(m.title?.romaji),
      english: str(m.title?.english),
      native: str(m.title?.native),
    },
    synonyms: Array.isArray(m.synonyms) ? m.synonyms : [],
    description: str(m.description),
    cover: str(m.coverImage?.extraLarge) ?? str(m.coverImage?.large),
    banner: str(m.bannerImage),
    color: str(m.coverImage?.color),
    format: str(m.format),
    status: str(m.status),
    season: str(m.season),
    year: num(m.seasonYear),
    startDate: fuzzyDate(m.startDate),
    endDate: fuzzyDate(m.endDate),
    episodes: num(m.episodes),
    duration: num(m.duration),
    score: num(m.averageScore),
    popularity: num(m.popularity),
    genres: Array.isArray(m.genres) ? m.genres : [],
    tags: (m.tags ?? []).map((t: any) => ({
      name: String(t.name),
      rank: num(t.rank) ?? 0,
      spoiler: !!(t.isMediaSpoiler || t.isGeneralSpoiler),
    })),
    studios: (m.studios?.nodes ?? [])
      .filter((n: any) => n.isAnimationStudio)
      .map((n: any) => String(n.name)),
    nextEpisode: m.nextAiringEpisode
      ? { episode: m.nextAiringEpisode.episode, airingAt: m.nextAiringEpisode.airingAt }
      : undefined,
    trailer,
    streamingEpisodes: (m.streamingEpisodes ?? []).map((e: any) => ({
      title: String(e.title),
      thumbnail: str(e.thumbnail),
      url: str(e.url),
    })),
    relations: (m.relations?.edges ?? []).map((e: any) => ({
      type: String(e.relationType),
      id: String(e.node?.id),
      title: str(e.node?.title?.english) ?? str(e.node?.title?.romaji),
      format: str(e.node?.format),
    })),
  };
}

export function mergeSearchResults(
  recent: SearchResult[],
  anilist: SearchResult[]
): SearchResult[] {
  const seen = new Set<string>();
  return [...recent, ...anilist].filter((item) => {
    let key: string;
    try {
      const a = decodeId(item.id).anilistId;
      key = a ? `ani:${a}` : `title:${normalizeTitle(item.name)}`;
    } catch {
      key = `title:${normalizeTitle(item.name)}`;
    }
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseEpisodePayload(value: any): Episode[] {
  const data = value?.data ?? value;
  const list: any[] = Array.isArray(data?.episodes) ? data.episodes : [];
  const eps: Episode[] = [];
  for (const item of list) {
    const number = str(item?.number ?? item?.episode ?? item?.episode_number);
    if (!number) continue;
    eps.push({
      number,
      embedId: str(item.episode_embed_id),
      subUrl: str(item.embed_url?.sub),
      dubUrl: str(item.embed_url?.dub),
      title: str(item.title ?? item.name ?? item.episode_title),
      thumbnail: str(item.thumbnail ?? item.image ?? item.poster ?? item.snapshot),
      aired: str(item.aired ?? item.air_date ?? item.released ?? item.date),
      raw: item,
    });
  }
  return eps.sort(
    (a, b) => Number(a.number) - Number(b.number) || a.number.localeCompare(b.number)
  );
}

export function embedCandidates(
  base: string,
  id: AnikotoId,
  episode: string,
  mode: Mode,
  selected?: Episode
): string[] {
  const c: string[] = [];
  if (selected) {
    const explicit = mode === 'sub' ? selected.subUrl : selected.dubUrl;
    if (explicit) c.push(explicit);
    if (selected.embedId) c.push(`${base}/stream/s-2/${selected.embedId}/${mode}`);
  }
  if (id.anilistId) c.push(`${base}/stream/ani/${id.anilistId}/${episode}/${mode}`);
  if (id.malId) c.push(`${base}/stream/mal/${id.malId}/${episode}/${mode}`);
  return [...new Set(c)];
}

// ─── MEGAPLAY HELPERS ────────────────────────────────────────────────────────

export function parseDataId(html: string): string | null {
  const lower = html.toLowerCase();
  let from = 0;
  while (true) {
    const at = lower.indexOf('data-id=', from);
    if (at === -1) return null;
    const quote = html[at + 8];
    from = at + 8;
    if (quote !== '"' && quote !== "'") continue;
    const end = html.indexOf(quote, at + 9);
    if (end === -1) return null;
    const digits = html.slice(at + 9, end);
    if (digits !== '' && [...digits].every((ch) => ch >= '0' && ch <= '9')) return digits;
  }
}

export function parseMegaplaySources(value: any): {
  sources: [string, string][];
  subtitles: Subtitle[];
  thumbnails?: string;
  intro?: TimeRange;
  outro?: TimeRange;
} {
  const sources: [string, string][] = [];
  const tracks: Subtitle[] = [];
  let thumbnails: string | undefined;

  const collectSources = (v: any) => {
    if (typeof v === 'string') sources.push([v, 'Auto']);
    else if (Array.isArray(v)) v.forEach(collectSources);
    else if (v && typeof v === 'object') {
      const url = [v.file, v.url, v.src].find((x) => typeof x === 'string');
      if (url)
        sources.push([url, [v.label, v.quality].find((x) => typeof x === 'string') ?? 'Auto']);
      for (const k of ['sources', 'source', 'links']) if (v[k] !== undefined) collectSources(v[k]);
    }
  };

  const collectTracks = (v: any) => {
    if (Array.isArray(v)) v.forEach(collectTracks);
    else if (v && typeof v === 'object') {
      const kind = String([v.kind, v.type].find((x) => typeof x === 'string') ?? '').toLowerCase();
      if (kind.includes('thumbnail')) {
        const t = [v.file, v.url, v.src].find((x) => typeof x === 'string');
        if (t && !thumbnails) thumbnails = t;
        return;
      }
      if (kind && !kind.includes('caption') && !kind.includes('subtitle') && !kind.includes('sub'))
        return;
      const url = [v.file, v.url, v.src].find((x) => typeof x === 'string');
      if (url)
        tracks.push({
          label: [v.label, v.title].find((x) => typeof x === 'string') ?? 'Subtitle',
          url,
          default: v.default === true,
        });
    }
  };

  if (value?.sources !== undefined) collectSources(value.sources);
  if (value?.source !== undefined) collectSources(value.source);
  for (const k of ['tracks', 'captions', 'subtitles'])
    if (value?.[k] !== undefined) collectTracks(value[k]);

  const seenS = new Set<string>();
  const seenT = new Set<string>();
  return {
    sources: sources.filter(([u]) => !seenS.has(u) && seenS.add(u)),
    subtitles: tracks.filter((t) => !seenT.has(t.url) && seenT.add(t.url)),
    thumbnails,
    intro: timeRange(value?.intro),
    outro: timeRange(value?.outro),
  };
}

function timeRange(v: any): TimeRange | undefined {
  const start = num(v?.start);
  const end = num(v?.end);
  return start !== undefined && end !== undefined && end > start ? { start, end } : undefined;
}

export function isMegaplayMediaHost(host: string): boolean {
  let h = host.toLowerCase();
  while (h.endsWith('.')) h = h.slice(0, -1);
  return MEGAPLAY_HOSTS.some((d) => h === d || h.endsWith('.' + d));
}

export function validateRemoteUrl(value: string): URL {
  const url = new URL(value);
  if (url.username || url.password) throw new Error('media URL contains credentials');
  const loopback =
    url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
    throw new Error('media URL must use HTTPS');
  return url;
}

// ─── THUMBNAIL VTT ───────────────────────────────────────────────────────────

function parseVttTime(t: string): number {
  const parts = t.trim().split(':').map(Number);
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function parseThumbnailVtt(vtt: string, baseUrl: string): ThumbCue[] {
  const lines = vtt.split('\n').map((l) => l.trim());
  const cues: ThumbCue[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('-->')) continue;
    const [a, b] = lines[i].split('-->');
    const target = lines[i + 1];
    if (!target) continue;
    const [path, frag] = target.split('#xywh=');
    if (!frag) continue;
    const [x, y, w, h] = frag.split(',').map(Number);
    if ([x, y, w, h].some((n) => !Number.isFinite(n))) continue;
    cues.push({
      start: parseVttTime(a),
      end: parseVttTime(b),
      url: new URL(path, baseUrl).toString(),
      x,
      y,
      w,
      h,
    });
  }
  return cues;
}

export const thumbAt = (cues: ThumbCue[], seconds: number) =>
  cues.find((c) => seconds >= c.start && seconds < c.end);

// ─── SHARED INTERNAL HELPERS ─────────────────────────────────────────────────

export function utf8Bytes(value: string): number[] {
  const bytes: number[] = [];
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x7f) bytes.push(code);
    else if (code <= 0x7ff) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code <= 0xffff)
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
  }
  return bytes;
}

export function onlyDigits(value: string): boolean {
  return value.length > 0 && [...value].every((character) => character >= '0' && character <= '9');
}

export function isSafeRemoteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !!url.hostname &&
      !url.username &&
      !url.password &&
      !isIpLiteral(url.hostname)
    );
  } catch {
    return false;
  }
}

function isIpLiteral(host: string): boolean {
  if (host.startsWith('[') && host.endsWith(']')) return true;
  const pieces = host.split('.');
  return pieces.length === 4 && pieces.every((part) => onlyDigits(part) && Number(part) <= 255);
}

export function hostMatches(host: string, domain: string): boolean {
  let normalized = host.toLowerCase();
  while (normalized.endsWith('.')) normalized = normalized.slice(0, -1);
  return normalized === domain || normalized.endsWith(`.${domain}`);
}

export function readResolution(line: string): string | undefined {
  const start = line.indexOf('RESOLUTION=');
  if (start < 0) return undefined;
  const dimension = line.slice(start + 11).split(',')[0];
  const x = dimension.indexOf('x');
  if (x < 0) return undefined;
  const height = dimension.slice(x + 1);
  return onlyDigits(height) ? `${height}p` : undefined;
}

export function normalizeEpisode(value: string): string {
  const number = Number(value.trim());
  if (!Number.isFinite(number) || number < 0) throw new Error('invalid episode number');
  return String(number);
}

export function mediaHeaders(host: string): Record<string, string> {
  return isMegaplayMediaHost(host)
    ? { Referer: 'https://megaplay.buzz/', Origin: 'https://megaplay.buzz', 'User-Agent': UA }
    : {};
}
