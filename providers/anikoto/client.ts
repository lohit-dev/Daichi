// ---------------------------------------------------------------------------
// AnikotoClient — main provider combining AniList, Anikoto API, and MegaPlay
// ---------------------------------------------------------------------------

import { AnikotoCzClient } from './cz-client';
import { RateLimitedError } from './errors';
import type {
  AnikotoId,
  Episode,
  Mode,
  SearchOptions,
  SearchResult,
  ShowDetails,
  Stream,
} from './types';
import {
  decodeId,
  decodeCzId,
  parseSearchPayload,
  parseEpisodePayload,
  embedCandidates,
  parseMegaplaySources,
  parseDataId,
  validateRemoteUrl,
  isMegaplayMediaHost,
  sortStreams,
  UA,
} from './utils';

// ─── CACHE HELPERS ───────────────────────────────────────────────────────────

const CACHE_TTL = 5 * 60_000;
const CACHE_LIMIT = 100;

type Cached<T> = { exp: number; value: T };

function cacheGet<T>(m: Map<string, Cached<T>>, k: string): T | undefined {
  const hit = m.get(k);
  if (!hit) return undefined;
  if (hit.exp <= Date.now()) {
    m.delete(k);
    return undefined;
  }
  return hit.value;
}

function cachePut<T>(m: Map<string, Cached<T>>, k: string, value: T) {
  if (m.size >= CACHE_LIMIT) m.delete(m.keys().next().value!);
  m.set(k, { exp: Date.now() + CACHE_TTL, value });
}

// ─── INTERNAL HELPERS ────────────────────────────────────────────────────────

function mediaHeaders(host: string): Record<string, string> {
  return isMegaplayMediaHost(host)
    ? { Referer: 'https://megaplay.buzz/', Origin: 'https://megaplay.buzz', 'User-Agent': UA }
    : {};
}

// ─── CLIENT OPTIONS TYPE (re-exported for convenience) ───────────────────────

export type ClientOptions = {
  anikotoApi?: string;
  anilistApi?: string;
  megaplayBase?: string;
  anikotoCzBase?: string;
  mapperBase?: string;
};

// ─── MAIN CLIENT ─────────────────────────────────────────────────────────────

export class AnikotoClient {
  private anikotoApi: string;
  private anilistApi: string;
  private megaplayBase: string;
  private searches = new Map<string, Cached<SearchResult[]>>();
  private series = new Map<string, Cached<Episode[]>>();
  private detailsCache = new Map<string, Cached<ShowDetails>>();
  private anikotoCz: AnikotoCzClient;

  constructor(o: ClientOptions = {}) {
    this.anikotoApi = (o.anikotoApi ?? 'https://anikotoapi.site').replace(/\/+$/, '');
    this.anilistApi = o.anilistApi ?? 'https://graphql.anilist.co';
    this.megaplayBase = (o.megaplayBase ?? 'https://megaplay.buzz').replace(/\/+$/, '');
    this.anikotoCz = new AnikotoCzClient({
      base: o.anikotoCzBase,
      mapperBase: o.mapperBase,
    });
  }

  // ── INTERNAL FETCH HELPERS ─────────────────────────────────────────────────

  private async checked(res: Response, provider: string) {
    if (res.status === 429)
      throw new RateLimitedError(provider, Number(res.headers.get('retry-after')) || 120);
    if (!res.ok) throw new Error(`${provider} HTTP ${res.status}`);
    return res;
  }

  private async getJson(url: string, headers: Record<string, string> = {}) {
    const provider = url.startsWith(this.megaplayBase) ? 'MegaPlay' : 'Anikoto';
    const res = await fetch(url, {
      headers: { Accept: 'application/json,text/plain,*/*', ...headers },
    });
    return (await this.checked(res, provider)).json();
  }

  // ── SEARCH ─────────────────────────────────────────────────────────────────

  async search(
    query: string,
    allowAdultOrOptions: boolean | SearchOptions = false
  ): Promise<SearchResult[]> {
    query = query.trim();
    if (!query) throw new Error('empty search query');
    const options =
      typeof allowAdultOrOptions === 'boolean'
        ? { allowAdult: allowAdultOrOptions }
        : allowAdultOrOptions;
    const sort = options.sort;
    const key = `${sort ?? ''}:${query.toLowerCase()}`;
    const cached = cacheGet(this.searches, key);
    if (cached) return cached;

    let values: SearchResult[] = [];
    try {
      values = await this.anikotoCz.search(query, sort);
    } catch (e) {
      console.warn('[AnikotoClient] anikotoCz search failed:', e);
    }

    if (!values.length) {
      try {
        values = await this.searchRecent(query, options.allowAdult ?? false);
      } catch {}
    }

    cachePut(this.searches, key, values);
    return values;
  }

  private async searchRecent(query: string, allowAdult: boolean) {
    const v = await this.getJson(`${this.anikotoApi}/recent-anime?page=1&per_page=40`);
    const needle = query.toLowerCase();
    return parseSearchPayload(v, allowAdult).filter((r) => r.name.toLowerCase().includes(needle));
  }

  // ── DETAILS ───────────────────────────────────────────────────────────────

  async details(showId: string): Promise<ShowDetails> {
    if (showId.startsWith('anikoto2:')) {
      const metadata = decodeCzId(showId);
      const res = await this.anikotoCz.search(metadata.title);
      return {
        anilistId: '',
        title: { english: metadata.title },
        synonyms: [],
        episodes: res.length ? res[0].episodes : 0,
        genres: [],
        tags: [],
        studios: [],
        streamingEpisodes: [],
        relations: [],
      };
    }
    const id = decodeId(showId);
    return {
      anilistId: id.anilistId ?? '',
      malId: id.malId,
      title: { english: id.title },
      synonyms: [],
      episodes: id.episodes ?? 0,
      genres: [],
      tags: [],
      studios: [],
      streamingEpisodes: [],
      relations: [],
    };
  }

  // ── EPISODE LIST ──────────────────────────────────────────────────────────

  async episodeList(showId: string): Promise<Episode[]> {
    if (showId.startsWith('anikoto2:')) return this.anikotoCz.episodeList(showId);
    const id = decodeId(showId);
    const series = await this.loadSeries(id).catch(() => [] as Episode[]);
    if (series.length) return series;
    return (await this.episodes(showId)).map((number) => ({ number }));
  }

  private async loadSeries(id: AnikotoId): Promise<Episode[]> {
    if (!id.anikotoId) return [];
    const cached = cacheGet(this.series, id.anikotoId);
    if (cached) return cached;
    const v = parseEpisodePayload(await this.getJson(`${this.anikotoApi}/series/${id.anikotoId}`));
    cachePut(this.series, id.anikotoId, v);
    return v;
  }

  async episodes(showId: string): Promise<string[]> {
    if (showId.startsWith('anikoto2:')) return this.anikotoCz.episodes(showId, 'sub');
    const id = decodeId(showId);
    let series: Episode[] = [];
    try {
      series = await this.loadSeries(id);
    } catch (e) {
      if (!id.episodes && !id.anilistId && !id.malId) throw e;
    }
    if (series.length) return series.map((e) => e.number);
    let count = id.episodes;
    if ((!count || count < 1) && (id.anilistId || id.malId)) {
      count = (await this.details(showId)).episodes;
    }
    if (!count || !Number.isFinite(count) || count < 1) {
      throw new Error(`no episodes available for ${id.title ?? 'this show'}`);
    }
    return Array.from({ length: Math.trunc(count) }, (_, i) => String(i + 1));
  }

  // ── STREAMS ───────────────────────────────────────────────────────────────

  async streams(showId: string, episode: string, mode: Mode): Promise<Stream[]> {
    if (showId.startsWith('anikoto2:')) return this.anikotoCz.streams(showId, episode, mode);
    const id = decodeId(showId);
    if (id.title) {
      try {
        const results = await this.anikotoCz.search(id.title);
        if (results.length) {
          return await this.anikotoCz.streams(results[0].id, episode, mode);
        }
      } catch (e) {
        console.warn('[AnikotoClient] CZ streams fallback failed:', e);
      }
    }
    let series: Episode[] = [];
    try {
      series = await this.loadSeries(id);
    } catch (e) {
      if (!(id.anilistId || id.malId)) throw e;
    }
    const selected = series.find((e) => e.number === episode);
    const candidates = embedCandidates(this.megaplayBase, id, episode, mode, selected);
    if (!candidates.length) throw new Error(`no episodes available for ${id.title ?? 'this show'}`);

    const failures: string[] = [];
    for (const c of candidates) {
      try {
        const s = await this.resolveMegaplay(c);
        if (s.length) return s;
        failures.push('MegaPlay returned no native streams');
      } catch (e) {
        if (e instanceof RateLimitedError) throw e;
        failures.push(String(e));
      }
    }
    console.warn('Anikoto source resolution failures:', failures.join('; '));
    throw new Error(
      `no playable sources for ${id.title ?? 'this show'} episode ${episode} (${mode})`
    );
  }

  async discoverQualities(stream: Stream): Promise<Stream[]> {
    return this.anikotoCz.expandStreamQualities(stream);
  }

  async resolveMegaplay(embedUrl: string): Promise<Stream[]> {
    validateRemoteUrl(embedUrl);
    const res = await fetch(embedUrl, {
      headers: {
        Referer: `${this.megaplayBase}/`,
        Accept: 'text/html,application/json,text/plain,*/*',
      },
    });
    const html = await (await this.checked(res, 'MegaPlay')).text();
    const dataId = parseDataId(html);
    if (!dataId) throw new Error('embed did not expose a playable source id');

    const payload = await this.getJson(`${this.megaplayBase}/stream/getSources?id=${dataId}`, {
      Referer: embedUrl,
      Origin: this.megaplayBase,
    });
    const { sources, subtitles, thumbnails, intro, outro } = parseMegaplaySources(payload);
    if (!sources.length) throw new Error('MegaPlay returned no native streams');

    const streams: Stream[] = [];
    for (const [url, resolution] of sources) {
      const parsed = validateRemoteUrl(url);
      const hls =
        parsed.pathname.toLowerCase().includes('.m3u8') || parsed.search.includes('.m3u8');
      const headers = mediaHeaders(parsed.hostname);
      streams.push({
        url,
        resolution,
        hls,
        headers,
        subtitles,
        thumbnails,
        intro,
        outro,
        provider: 'MegaPlay',
        downloadable: true,
      });
    }
    const seen = new Set<string>();
    const unique = streams.filter((s) => !seen.has(s.url) && seen.add(s.url));
    sortStreams(unique);
    return unique;
  }

  async expandHls(
    url: string,
    fallback: string,
    headers: Record<string, string>
  ): Promise<Stream[]> {
    const single = (): Stream[] => [
      { url, resolution: fallback, hls: true, headers, subtitles: [] },
    ];
    const res = await fetch(url, { headers });
    if (!res.ok) return single();
    const text = await res.text();
    if (!text.trimStart().startsWith('#EXTM3U')) return single();
    const lines = text.split('\n').map((l) => l.trim());
    const out: Stream[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith('#EXT-X-STREAM-INF:')) continue;
      const at = lines[i].indexOf('RESOLUTION=');
      const height =
        at === -1
          ? undefined
          : lines[i]
              .slice(at + 11)
              .split(',')[0]
              .split('x')[1];
      const next = lines.slice(i + 1).find((l) => l && !l.startsWith('#'));
      if (next)
        out.push({
          url: new URL(next, url).toString(),
          resolution: height ? `${height}p` : fallback,
          hls: true,
          headers,
          subtitles: [],
        });
    }
    return out.length ? out : single();
  }
}
