// ---------------------------------------------------------------------------
// AnikotoCzClient — scrapes anikoto.cz for search, episode lists, and streams
// ---------------------------------------------------------------------------

import CryptoJS from 'crypto-js';

import { RateLimitedError } from './errors';
import { htmlTree, descendants, hasClass, textContent } from './html-tree';
import type { AnikotoCzId, Episode, Mode, SearchResult, Stream, Subtitle } from './types';
import {
  encodeCzId,
  decodeCzId,
  validSlug,
  onlyDigits,
  isSafeRemoteUrl,
  hostMatches,
  readResolution,
  normalizeEpisode,
  sortStreams,
  utf8Bytes,
} from './utils';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const BASE = 'https://anikoto.cz';
const MAPPER_BASE = 'https://mapper.nekostream.site/api/mal';
const CZ_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const MAX_BYTES = 8 * 1024 * 1024;
const CACHE_MS = 5 * 60_000;

// ─── INTERNAL TYPES ──────────────────────────────────────────────────────────

type CacheEntry<T> = { expires: number; value: T };

type EpisodeRow = {
  number: string;
  slug: string;
  token: string;
  malId: string;
  timestamp: string;
  sub: boolean;
  dub: boolean;
};

type Series = { canonical: string; episodes: EpisodeRow[] };
type Server = { label: string; token: string };

// ─── PARSING HELPERS ─────────────────────────────────────────────────────────

function filterUrls(base: string, query: string, preferredSort?: string): string[] {
  const sorts = [
    undefined,
    preferredSort,
    'latest-updated',
    'latest-added',
    'score',
    'name-az',
    'release-date',
    'most-viewed',
    'number_of_episodes',
  ];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const sort of sorts) {
    const key = sort ?? '';
    if (seen.has(key)) continue;
    seen.add(key);
    const url = new URL('/filter', base);
    url.searchParams.set('keyword', query);
    url.searchParams.set('type', '');
    url.searchParams.set('ep_min', '');
    url.searchParams.set('ep_max', '');
    if (sort) url.searchParams.set('sort', sort);
    urls.push(url.toString());
  }
  return urls;
}

function parseSearch(base: string, html: string): SearchResult[] {
  const root = htmlTree(html);
  const baseUrl = new URL(base);
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  for (const list of descendants(root).filter((node) => node.attrs.id === 'list-items')) {
    for (const item of descendants(list).filter((node) => hasClass(node, 'item'))) {
      const anchor = descendants(item).find(
        (node) => node.tag === 'a' && node.attrs.href !== undefined
      );
      if (!anchor) continue;
      let url: URL;
      try {
        url = new URL(anchor.attrs.href, baseUrl);
      } catch {
        continue;
      }
      if (url.protocol !== 'https:' || url.host !== baseUrl.host) continue;
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] !== 'watch' || !parts[1] || !validSlug(parts[1]) || seen.has(parts[1])) continue;
      seen.add(parts[1]);
      const titleNode = descendants(item).find(
        (node) => hasClass(node, 'name') || hasClass(node, 'd-title')
      );
      const title = titleNode ? textContent(titleNode) : parts[1].split('-').join(' ');
      results.push({
        id: encodeCzId({ slug: parts[1], title }),
        name: title,
        episodes: 0,
        provider: 'anikoto2',
      });
    }
  }
  return results;
}

function parseShow(base: string, html: string): { showId: string; canonical: string } {
  const root = htmlTree(html);
  const element = descendants(root).find((node) => node.attrs.id === 'watch-main');
  const showId = element?.attrs['data-id'] ?? '';
  if (!showId || !onlyDigits(showId)) throw new Error('show page exposed an invalid catalog ID');
  const baseUrl = new URL(base);
  const canonical = new URL(element?.attrs['data-url'] ?? '', baseUrl);
  if (canonical.protocol !== 'https:' || canonical.host !== baseUrl.host)
    throw new Error('show page exposed an invalid canonical URL');
  let canonicalText = canonical.toString();
  while (canonicalText.endsWith('/')) canonicalText = canonicalText.slice(0, -1);
  return { showId, canonical: canonicalText };
}

function parseEpisodes(html: string): EpisodeRow[] {
  const root = htmlTree(html);
  const episodes: EpisodeRow[] = [];
  const seen = new Set<string>();
  for (const element of descendants(root)) {
    if (
      element.tag !== 'a' ||
      element.attrs['data-num'] === undefined ||
      element.attrs['data-ids'] === undefined
    )
      continue;
    let number: string;
    try {
      number = normalizeEpisode(element.attrs['data-num']);
    } catch {
      continue;
    }
    if (seen.has(number)) continue;
    seen.add(number);
    episodes.push({
      number,
      slug: element.attrs['data-slug'] ?? number,
      token: element.attrs['data-ids'] ?? '',
      malId: element.attrs['data-mal'] ?? '',
      timestamp: element.attrs['data-timestamp'] ?? '',
      sub: element.attrs['data-sub'] === '1',
      dub: element.attrs['data-dub'] === '1',
    });
  }
  episodes.sort((a, b) => Number(a.number) - Number(b.number));
  return episodes;
}

function providerResult(value: any, context: string): any {
  if (value?.status !== 200)
    throw new Error(`invalid Anikoto.cz ${context} response: ${value?.message ?? context}`);
  if (value.result === undefined) throw new Error(`${context} response has no result`);
  return value.result;
}

function isWord(character: string): boolean {
  return (character >= 'a' && character <= 'z') || (character >= '0' && character <= '9');
}

function serverKind(typeName: string, label: string): 'sub' | 'hsub' | 'dub' {
  const tokens = `${typeName} ${label}`
    .toLowerCase()
    .split('')
    .map((c) => (isWord(c) ? c : ' '))
    .join('')
    .split(' ')
    .filter(Boolean);
  const has = (...values: string[]) => values.some((value) => tokens.includes(value));
  if (typeName.toLowerCase() === 'dub' || has('adub', 'dub', 'hdub') || (has('a') && has('dub')))
    return 'dub';
  if (typeName.toLowerCase() === 'hsub' || has('hsub') || (has('h') && has('sub'))) return 'hsub';
  return 'sub';
}

function parseServers(html: string, mode: Mode): Server[] {
  const root = htmlTree(html);
  const servers: Server[] = [];
  const seen = new Set<string>();
  for (const group of descendants(root).filter(
    (node) => node.tag === 'div' && hasClass(node, 'type')
  )) {
    const typeName = group.attrs['data-type'] ?? '';
    const label = textContent(descendants(group).find((node) => node.tag === 'label') ?? group);
    const kind = serverKind(typeName, label);
    if ((mode === 'dub') !== (kind === 'dub')) continue;
    for (const item of descendants(group).filter(
      (node) => node.tag === 'li' && node.attrs['data-link-id'] !== undefined
    )) {
      const token = item.attrs['data-link-id'];
      if (!token || seen.has(token)) continue;
      seen.add(token);
      const name = textContent(item) || 'Server';
      servers.push({
        label: `${kind === 'hsub' ? 'H-SUB' : kind.toUpperCase()} · ${name}`,
        token,
      });
    }
  }
  return servers;
}

function parseMapper(value: any, mode: Mode): Server[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const labels: Record<string, string> = {
    gogoanime: 'Vidstream',
    animepahe: 'Kiwi-Stream',
    anivibe: 'Vibe-Stream',
  };
  const servers: Server[] = [];
  for (const [provider, item] of Object.entries(value)) {
    if (provider === 'status') continue;
    const token = (item as any)?.[mode]?.url;
    if (typeof token !== 'string') continue;
    servers.push({
      label: `${mode === 'dub' ? 'A-DUB' : 'H-SUB'} · ${labels[provider] ?? provider}`,
      token,
    });
  }
  return servers;
}

function parseCzDataId(html: string): string | undefined {
  for (const node of descendants(htmlTree(html))) {
    const value = node.attrs['data-id'];
    if (value && onlyDigits(value)) return value;
  }
  return undefined;
}

function parseSources(payload: any): { sources: [string, string][]; subtitles: Subtitle[] } {
  const sources: [string, string][] = [];
  const visitSource = (value: any): void => {
    if (typeof value === 'string') {
      sources.push([value, 'Auto']);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visitSource);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const url = [value.file, value.url, value.src].find((item) => typeof item === 'string');
    if (url) {
      const label = [value.label, value.quality].find((item) => typeof item === 'string') ?? 'Auto';
      sources.push([url, label]);
    }
    let nested = false;
    for (const key of ['sources', 'source', 'links']) {
      if (value[key] !== undefined) {
        visitSource(value[key]);
        nested = true;
      }
    }
    if (!nested && !['file', 'url', 'src'].some((key) => key in value))
      Object.values(value).forEach(visitSource);
  };

  const subtitles: Subtitle[] = [];
  const visitTracks = (value: any): void => {
    if (Array.isArray(value)) {
      value.forEach(visitTracks);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const kind = String(value.kind ?? value.type ?? '').toLowerCase();
    if (kind && !kind.includes('caption') && !kind.includes('subtitle') && !kind.includes('sub'))
      return;
    const url = [value.file, value.src, value.url].find((item) => typeof item === 'string');
    if (url && isSafeRemoteUrl(url)) {
      subtitles.push({
        label: value.label ?? value.title ?? 'Unknown',
        url,
        default: value.default === true,
      });
    }
  };

  if (payload?.sources !== undefined) visitSource(payload.sources);
  if (payload?.source !== undefined) visitSource(payload.source);
  for (const key of ['tracks', 'captions', 'subtitles'])
    if (payload?.[key] !== undefined) visitTracks(payload[key]);

  const uniqueSources: [string, string][] = [];
  const seenSource = new Set<string>();
  for (const entry of sources) {
    if (isSafeRemoteUrl(entry[0]) && !seenSource.has(entry[0])) {
      seenSource.add(entry[0]);
      uniqueSources.push(entry);
    }
  }
  const uniqueSubtitles: Subtitle[] = [];
  const seenSubtitle = new Set<string>();
  for (const track of subtitles) {
    if (!seenSubtitle.has(track.url)) {
      seenSubtitle.add(track.url);
      uniqueSubtitles.push(track);
    }
  }
  return { sources: uniqueSources, subtitles: uniqueSubtitles };
}

// ─── CRYPTO HELPERS ──────────────────────────────────────────────────────────

function parseJsString(
  source: string,
  quoteIndex: number
): { value: string; next: number } | undefined {
  const quote = source[quoteIndex];
  if (quote !== '"' && quote !== "'") return undefined;
  let index = quoteIndex + 1;
  let escaped = false;
  for (; index < source.length; index++) {
    if (escaped) escaped = false;
    else if (source[index] === '\\') escaped = true;
    else if (source[index] === quote) break;
  }
  if (index >= source.length) return undefined;
  const raw = source.slice(quoteIndex, index + 1);
  try {
    const value =
      quote === '"'
        ? (JSON.parse(raw) as string)
        : (JSON.parse(`"${raw.slice(1, -1).replaceAll('"', '\\"')}"`) as string);
    return { value, next: index + 1 };
  } catch {
    return { value: raw.slice(1, -1), next: index + 1 };
  }
}

function playerParameters(script: string): {
  key: string;
  iv: string;
  secret: string;
  ttl: number;
} {
  let constIndex = script.indexOf('const ');
  while (constIndex >= 0) {
    let cursor = constIndex + 6;
    const strings: string[] = [];
    let valid = true;
    for (let part = 0; part < 3; part++) {
      while (cursor < script.length && script[cursor] !== '=') cursor++;
      if (cursor >= script.length) {
        valid = false;
        break;
      }
      const parsed = parseJsString(script, cursor + 1);
      if (!parsed) {
        valid = false;
        break;
      }
      strings.push(parsed.value);
      cursor = parsed.next;
      while (cursor < script.length && script[cursor] !== ',') cursor++;
      if (cursor >= script.length) {
        valid = false;
        break;
      }
      cursor++;
    }
    let ttl = '';
    if (valid) {
      while (cursor < script.length && script[cursor] !== '=') cursor++;
      if (cursor < script.length) {
        cursor++;
        while (cursor < script.length && script[cursor] >= '0' && script[cursor] <= '9')
          ttl += script[cursor++];
      }
    }
    const window = script.slice(cursor, cursor + 2500);
    if (valid && strings.length === 3 && ttl && window.includes('AES-CBC')) {
      return { key: strings[0], iv: strings[1], secret: strings[2], ttl: Number(ttl) };
    }
    const next = script.indexOf('const ', constIndex + 6);
    constIndex = next;
  }
  throw new Error('Player crypto parameters changed; update playerParameters().');
}

function base64UrlDecode(value: string): CryptoJS.lib.WordArray {
  let base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  while (base64.length % 4 !== 0) base64 += '=';
  return CryptoJS.enc.Base64.parse(base64);
}

function decryptSource(encoded: string, key: string, iv: string): any {
  const keyBytes = CryptoJS.enc.Utf8.parse(key.padEnd(32, '\0').slice(0, 32));
  const ivBytes = CryptoJS.enc.Utf8.parse(iv.padEnd(16, '\0').slice(0, 16));
  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: base64UrlDecode(encoded) } as CryptoJS.lib.CipherParams,
    keyBytes,
    { iv: ivBytes, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
  ).toString(CryptoJS.enc.Utf8);
  if (!decrypted) throw new Error('Decryption failed');
  try {
    return JSON.parse(decrypted);
  } catch {
    throw new Error('Invalid JSON in decrypted data');
  }
}

function isHex(value: string): boolean {
  return [...value.toLowerCase()].every(
    (character) => (character >= '0' && character <= '9') || (character >= 'a' && character <= 'f')
  );
}

function signedUrl(value: string, secret: string, ttl: number): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.searchParams.has('token')) return value;
  const segments = url.pathname.split('/').filter(Boolean);
  let pair: [string, string] | undefined;
  for (let index = 0; index < segments.length - 1; index++) {
    if (
      segments[index].length === 32 &&
      segments[index + 1].length === 32 &&
      isHex(segments[index]) &&
      isHex(segments[index + 1])
    ) {
      pair = [segments[index].toLowerCase(), segments[index + 1].toLowerCase()];
      break;
    }
  }
  if (!pair) return undefined;
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const message = `${expires}|${pair[0]}/${pair[1]}`;
  const signature = CryptoJS.HmacSHA256(message, secret)
    .toString(CryptoJS.enc.Base64)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  const encodedMessage = CryptoJS.enc.Utf8.parse(message)
    .toString(CryptoJS.enc.Base64)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  url.searchParams.append('token', `${encodedMessage}.${signature}`);
  return url.toString();
}

function signSourceUrls(value: any, secret: string, ttl: number): void {
  if (typeof value === 'string') return;
  if (Array.isArray(value)) {
    value.forEach((item) => signSourceUrls(item, secret, ttl));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if ((key === 'file' || key === 'url' || key === 'src') && typeof child === 'string') {
      value[key] = signedUrl(child, secret, ttl) ?? child;
    } else signSourceUrls(child, secret, ttl);
  }
}

// ─── CLIENT ──────────────────────────────────────────────────────────────────

export type { AnikotoCzId };

export class AnikotoCzClient {
  private readonly base: string;
  private readonly mapperBase: string;
  private readonly userAgent: string;
  private readonly seriesCache = new Map<string, CacheEntry<Series>>();

  constructor(options: { base?: string; mapperBase?: string; userAgent?: string } = {}) {
    let base = options.base ?? BASE;
    while (base.endsWith('/')) base = base.slice(0, -1);
    let mapperBase = options.mapperBase ?? MAPPER_BASE;
    while (mapperBase.endsWith('/')) mapperBase = mapperBase.slice(0, -1);
    this.base = base;
    this.mapperBase = mapperBase;
    this.userAgent = options.userAgent ?? CZ_UA;
  }

  async search(query: string, sort?: string): Promise<SearchResult[]> {
    const cleaned = query.trim();
    if (!cleaned) throw new Error('empty search query');
    const urls = filterUrls(this.base, cleaned, sort);
    const ajax = new URL('/ajax/anime/search', this.base);
    ajax.searchParams.set('keyword', cleaned);
    urls.push(ajax.toString());
    for (const url of urls) {
      try {
        let html: string;
        if (url.includes('/filter')) {
          html = await this.getText(url, this.base, false);
        } else {
          const payload = await this.getJson(url, this.base, true);
          const result = providerResult(payload, 'search');
          html =
            typeof result === 'string'
              ? result
              : typeof result?.html === 'string'
                ? result.html
                : '';
          if (!html) continue;
        }
        const results = parseSearch(this.base, html);
        if (results.length) return results;
      } catch {
        continue;
      }
    }
    return [];
  }

  async episodes(showId: string, mode: Mode): Promise<string[]> {
    const id = decodeCzId(showId);
    const series = await this.loadSeries(id.slug);
    const episodes = series.episodes
      .filter((episode) => (mode === 'sub' ? episode.sub : episode.dub))
      .map((episode) => episode.number);
    episodes.sort((a, b) => Number(a) - Number(b));
    if (!episodes.length) throw new Error(`Anikoto.cz has no ${mode} episodes for ${id.title}`);
    return episodes;
  }

  async episodeList(showId: string): Promise<Episode[]> {
    const id = decodeCzId(showId);
    const series = await this.loadSeries(id.slug);
    if (!series.episodes.length) throw new Error('No episodes are available');
    return series.episodes.map((episode) => ({
      number: episode.number,
      title: `Episode ${episode.number}`,
      raw: { ...episode },
    }));
  }

  async streams(showId: string, episode: string, mode: Mode): Promise<Stream[]> {
    const id = decodeCzId(showId);
    const series = await this.loadSeries(id.slug);
    const number = normalizeEpisode(episode);
    const selected = series.episodes.find((item) => item.number === number);
    if (!selected) throw new Error(`episode ${episode} is not available for this anime`);
    const available = mode === 'sub' ? selected.sub : selected.dub;
    if (!available) throw new Error(`Anikoto.cz has no ${mode} episodes for ${id.title}`);

    const episodeUrl = `${series.canonical}/ep-${encodeURIComponent(selected.slug)}`;
    await this.getText(episodeUrl, series.canonical, false);
    const serverUrl = new URL('/ajax/server/list', this.base);
    serverUrl.searchParams.set('servers', selected.token);
    const payload = await this.getJson(serverUrl.toString(), episodeUrl, true);
    const markup = providerResult(payload, 'server list');
    if (typeof markup !== 'string') throw new Error('server list contained no markup');
    const servers = parseServers(markup, mode);
    servers.push(...(await this.mapperServers(selected, mode)));
    const uniqueServers = servers.filter(
      (server, index) => servers.findIndex((other) => other.token === server.token) === index
    );
    const streams: Stream[] = [];
    const failures: string[] = [];
    for (const server of uniqueServers) {
      try {
        const embed = await this.resolveServer(server, episodeUrl);
        streams.push(...(await this.extractNative(embed, server.label, episodeUrl, mode)));
      } catch (error) {
        if (error instanceof RateLimitedError) throw error;
        failures.push(`${server.label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const unique = streams.filter(
      (stream, index) => streams.findIndex((other) => other.url === stream.url) === index
    );
    sortStreams(unique);
    if (!unique.length) {
      const detail = failures.length
        ? failures.join('; ')
        : 'no supported native servers were returned';
      console.warn(`Anikoto.cz native source resolution failed: ${detail}`);
      throw new Error(`no playable sources for ${id.title} episode ${episode} (${mode})`);
    }
    return unique;
  }

  async expandStreamQualities(stream: Stream): Promise<Stream[]> {
    if (!stream.hls) return [stream];
    const variants = await this.expandHls(stream.url, stream.headers);
    const expanded = variants.map((variant) => ({
      ...stream,
      url: variant.url,
      resolution: variant.resolution === 'Auto' ? stream.resolution : variant.resolution,
    }));
    return expanded.length ? expanded : [stream];
  }

  private async loadSeries(slug: string): Promise<Series> {
    if (!validSlug(slug)) throw new Error('invalid Anikoto.cz show slug');
    const cached = this.seriesCache.get(slug);
    if (cached && cached.expires > Date.now()) return cached.value;
    if (cached) this.seriesCache.delete(slug);

    const showHtml = await this.getText(`${this.base}/watch/${slug}`, this.base, false);
    const { showId, canonical } = parseShow(this.base, showHtml);

    const listUrl = new URL(`/ajax/episode/list/${showId}`, this.base);
    listUrl.searchParams.set('style', 'grid');
    listUrl.searchParams.set('vrf', '');
    const payload = await this.getJson(listUrl.toString(), canonical, true);
    const markup = providerResult(payload, 'episode list');
    if (typeof markup !== 'string') throw new Error('episode list contained no markup');
    const episodes = parseEpisodes(markup);
    if (!episodes.length) throw new Error('No episodes are available');

    const series = { canonical, episodes };
    if (this.seriesCache.size >= 100)
      this.seriesCache.delete(this.seriesCache.keys().next().value!);
    this.seriesCache.set(slug, { expires: Date.now() + CACHE_MS, value: series });
    return series;
  }

  private async mapperServers(episode: EpisodeRow, mode: Mode): Promise<Server[]> {
    if (!episode.malId || !episode.timestamp) return [];
    const url = `${this.mapperBase}/${encodeURIComponent(episode.malId)}/${encodeURIComponent(episode.slug)}/${encodeURIComponent(episode.timestamp)}`;
    try {
      return parseMapper(await this.getJson(url, this.base, false), mode);
    } catch {
      return [];
    }
  }

  private async resolveServer(server: Server, episodeUrl: string): Promise<string> {
    const url = new URL('/ajax/server', this.base);
    url.searchParams.set('get', server.token);
    const payload = await this.getJson(url.toString(), episodeUrl, true);
    const result = providerResult(payload, 'server');
    const raw = typeof result === 'string' ? result : result?.url;
    if (typeof raw !== 'string') throw new Error('server returned no embed URL');
    if (!isSafeRemoteUrl(raw)) throw new Error('unsafe provider URL');
    return raw;
  }

  private async extractNative(
    embedUrl: string,
    provider: string,
    episodeUrl: string,
    mode: Mode
  ): Promise<Stream[]> {
    if (!isSafeRemoteUrl(embedUrl)) throw new Error('unsafe provider URL');
    const embed = new URL(embedUrl);
    const supported = [
      'megaplay.buzz',
      'vidtube.site',
      'megap.shiora.top',
      'shiora.top',
      'megap.kotocdn.site',
      'megap.akirax.buzz',
      'akirax.buzz',
    ];
    if (!supported.some((domain) => hostMatches(embed.hostname, domain)))
      throw new Error(`unsupported embed host: ${embed.hostname}`);
    const origin = embed.origin;
    const html = await this.getText(embedUrl, episodeUrl, false);
    const dataId = parseCzDataId(html);
    if (!dataId) throw new Error('embed did not expose a playable source id');
    const payload = await this.getNativeSources(origin, embedUrl, dataId, mode, html);
    const { sources, subtitles } = parseSources(payload);
    if (!sources.length) throw new Error(`No native streams from ${embed.hostname}`);
    const headers = {
      Referer: `${origin}/`,
      Origin: origin,
      'User-Agent': this.userAgent,
    };
    const streams: Stream[] = [];
    for (const [url, label] of sources) {
      const parsed = new URL(url);
      const hls =
        parsed.pathname.toLowerCase().includes('.m3u8') || parsed.search.includes('.m3u8');
      streams.push({
        url,
        resolution: label.toLowerCase() === 'auto' ? label : label,
        hls,
        headers,
        subtitles,
        provider,
        downloadable: true,
      });
    }
    return streams;
  }

  private async getNativeSources(
    origin: string,
    embedUrl: string,
    dataId: string,
    mode: Mode,
    html: string
  ): Promise<any> {
    const sourceUrl = new URL('/stream/getSourcesNew', origin);
    sourceUrl.searchParams.set('id', dataId);
    sourceUrl.searchParams.set('type', mode);
    const response = await this.request(sourceUrl.toString(), embedUrl, true, origin);
    const raw = await this.checkedText(response);
    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error('provider returned invalid JSON');
    }
    if (typeof payload?.enc === 'string') {
      const scriptNode = descendants(htmlTree(html)).find(
        (node) => node.tag === 'script' && (node.attrs.src ?? '').includes('e1-player')
      );
      let scriptUrl = scriptNode?.attrs.src;
      if (!scriptUrl) throw new Error('Missing e1-player script');
      if (scriptUrl.startsWith('//')) scriptUrl = `https:${scriptUrl}`;
      else if (scriptUrl.startsWith('/')) scriptUrl = `${origin}${scriptUrl}`;
      const js = await this.getText(scriptUrl, embedUrl, false);
      const params = playerParameters(js);
      const decrypted = decryptSource(payload.enc, params.key, params.iv);
      signSourceUrls(decrypted, params.secret, params.ttl);
      payload.sources = decrypted;
    }
    return payload;
  }

  private async expandHls(
    url: string,
    headers: Record<string, string>
  ): Promise<{ resolution: string; url: string }[]> {
    const response = await this.request(url, headers.Referer ?? this.base, false, headers.Origin);
    if (!response.ok) return [{ resolution: 'Auto', url }];
    const text = await this.checkedText(response, 4 * 1024 * 1024);
    if (!text.trimStart().startsWith('#EXTM3U') || !text.includes('#EXT-X-STREAM-INF'))
      return [{ resolution: 'Auto', url }];
    const lines = text.split('\n');
    const variants: { resolution: string; url: string }[] = [];
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index].trim();
      if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;
      const resolution = readResolution(line) ?? 'Auto';
      for (let next = index + 1; next < lines.length; next++) {
        const path = lines[next].trim();
        if (!path || path.startsWith('#')) continue;
        variants.push({ resolution, url: new URL(path, url).toString() });
        break;
      }
    }
    return variants.length ? variants : [{ resolution: 'Auto', url }];
  }

  private async getJson(
    url: string,
    referer: string,
    ajax: boolean,
    origin?: string
  ): Promise<any> {
    const response = await this.request(url, referer, ajax, origin);
    const text = await this.checkedText(response);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('provider returned invalid JSON');
    }
  }

  private async getText(url: string, referer: string, ajax: boolean): Promise<string> {
    return this.checkedText(await this.request(url, referer, ajax));
  }

  private async request(
    url: string,
    referer: string,
    ajax: boolean,
    origin?: string
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Referer: referer,
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': this.userAgent,
      Accept: ajax
        ? 'application/json, text/javascript, */*; q=0.01'
        : 'text/html,application/xhtml+xml,*/*;q=0.8',
      ...(ajax ? { 'X-Requested-With': 'XMLHttpRequest' } : {}),
      ...(origin ? { Origin: origin } : {}),
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      return await fetch(url, { headers, credentials: 'include', signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async checkedText(response: Response, maxBytes = MAX_BYTES): Promise<string> {
    if (response.status === 429)
      throw new RateLimitedError('Anikoto.cz', Number(response.headers.get('retry-after')) || 120);
    if (!response.ok) throw new Error(`Anikoto.cz HTTP ${response.status}`);
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > maxBytes)
      throw new Error(`Anikoto.cz response exceeds ${maxBytes} bytes`);
    const text = await response.text();
    if (utf8Bytes(text).length > maxBytes)
      throw new Error(`Anikoto.cz response exceeds ${maxBytes} bytes`);
    return text;
  }
}
