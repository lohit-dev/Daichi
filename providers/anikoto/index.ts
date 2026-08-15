/**
 * providers/anikoto/index.ts
 *
 * Direct-scraping provider for anikototv.to using axios.
 * Uses axios instead of fetch for reliable header/cookie handling in React Native.
 *
 * Debug logs are prefixed with [Anikoto] — filter metro logs by this tag.
 */

import axios, { AxiosInstance } from 'axios';
import {
  StreamingProvider,
  ProviderSearchResult,
  ProviderEpisode,
  ProviderStreamSource,
  ProviderSubtitle,
} from '../types';
import { loadHtml, HtmlDoc } from '../utils/html-parser';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const TAG = '[Anikoto]';

const MIRRORS = ['https://anikototv.to', 'https://anikoto.net', 'https://anikoto.me'];

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// Embed domain → API domain for stream resolution
const EMBED_API_MAP: Record<string, string> = {
  'vidtube.site': 'vidtube.site',
  'vidplay.site': 'vidplay.site',
  'megaplay.buzz': 'megaplay.buzz',
  'embed.bunkrerrer.com': 'vidtube.site',
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function log(...args: any[]) {
  console.log(TAG, ...args);
}

function warn(...args: any[]) {
  console.warn(TAG, '⚠', ...args);
}

function err(...args: any[]) {
  console.error(TAG, '❌', ...args);
}

/** Safely parse a JSON string; if it's already an object return as-is */
function tryJson<T = any>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ─── AXIOS FACTORY ───────────────────────────────────────────────────────────

/** Create an axios instance pre-configured for scraping anikototv */
function makeClient(baseURL: string, cookie?: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: 15_000,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Upgrade-Insecure-Requests': '1',
      Connection: 'keep-alive',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    // Don't throw on non-2xx so we can log the status ourselves
    validateStatus: () => true,
  });
}

/** Extract Set-Cookie header from an axios response into a single cookie string */
function extractCookies(headers: Record<string, any>): string {
  // axios normalises headers to lowercase
  const raw = headers['set-cookie'];
  if (!raw) return '';
  if (Array.isArray(raw)) {
    return raw.map((c: string) => c.split(';')[0]).join('; ');
  }
  // Some RN environments return a comma-joined string
  return String(raw)
    .split(/,\s*(?=[A-Za-z0-9_%-]+=)/)
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

// ─── PROVIDER ────────────────────────────────────────────────────────────────

export class AnikotoProvider implements StreamingProvider {
  readonly name = 'Anikoto';
  readonly baseUrl = MIRRORS[0];

  private _cookie = '';
  private _mirror = MIRRORS[0];

  // ── SESSION & MIRROR ───────────────────────────────────────────────────────

  /**
   * Try each mirror until one responds with a valid session cookie.
   * Called automatically before any request that needs a cookie.
   */
  private async _ensureSession(force = false): Promise<void> {
    if (this._cookie && !force) {
      log('Session already established, mirror:', this._mirror);
      return;
    }

    log('Establishing session — trying', MIRRORS.length, 'mirrors…');

    for (const mirror of MIRRORS) {
      try {
        log('  → trying mirror:', mirror);
        const client = makeClient(mirror);
        const res = await client.get('/home');

        log('  ← status:', res.status, 'from', mirror);

        if (res.status === 200) {
          const cookie = extractCookies(res.headers);
          log('  ← cookies:', cookie ? cookie.substring(0, 80) + '…' : '(none)');

          this._mirror = mirror;
          this._cookie = cookie;
          log('Session OK — using mirror:', mirror);
          return;
        }
      } catch (e: any) {
        warn('Mirror failed:', mirror, e?.message);
      }
    }

    warn('All mirrors failed — proceeding without session cookie');
  }

  // ── SEARCH ────────────────────────────────────────────────────────────────

  async search(query: string, _page = 1): Promise<ProviderSearchResult[]> {
    log('search()', JSON.stringify(query));
    await this._ensureSession();

    const client = makeClient(this._mirror, this._cookie);
    const res = await client.get('/filter', { params: { keyword: query } });

    log('search status:', res.status);
    if (res.status !== 200) {
      warn('search: unexpected status', res.status);
      return [];
    }

    const $ = loadHtml(String(res.data));
    const results: ProviderSearchResult[] = [];
    const items = $.querySelectorClass('div', 'item');
    log('search: found', items.length, 'result cards');

    for (const card of items) {
      const atag = HtmlDoc.querySelector(card, 'a');
      const slug = (HtmlDoc.attr(atag, 'href') || '').split('/watch/').pop() || '';
      const posterImg = HtmlDoc.querySelector(card, 'img');
      const poster = HtmlDoc.attr(posterImg, 'data-src') || HtmlDoc.attr(posterImg, 'src') || '';
      const infoDiv = HtmlDoc.querySelectorClassOne(card, 'div', 'info');
      const titleAnchor = infoDiv ? HtmlDoc.querySelectorClassOne(infoDiv, 'a', 'name') : null;
      const title = titleAnchor ? HtmlDoc.text(titleAnchor) : '';
      const sub = parseInt(HtmlDoc.text(HtmlDoc.querySelectorClassOne(card, 'div', 'sub'))) || 0;
      const dub = parseInt(HtmlDoc.text(HtmlDoc.querySelectorClassOne(card, 'div', 'dub'))) || 0;
      const total =
        parseInt(HtmlDoc.text(HtmlDoc.querySelectorClassOne(card, 'div', 'total'))) || 0;

      if (slug) {
        results.push({
          id: slug,
          title,
          url: `${this._mirror}/watch/${slug}`,
          image: poster,
          subCount: sub,
          dubCount: dub,
          episodeCount: total || Math.max(sub, dub),
        });
      }
    }

    log('search: returning', results.length, 'results');
    return results;
  }

  // ── EPISODES ──────────────────────────────────────────────────────────────

  /**
   * Get all episodes for an anime slug.
   * Episode `id` = the `data-ids` base64 string needed by getStreamSources.
   */
  async getEpisodes(animeSlug: string): Promise<ProviderEpisode[]> {
    log('getEpisodes()', animeSlug);
    await this._ensureSession();

    const client = makeClient(this._mirror, this._cookie);

    // ── Step 1: fetch watch page → extract numeric anime data-id ─────────────
    log('  1. Fetching watch page:', `${this._mirror}/watch/${animeSlug}`);
    const watchRes = await client.get(`/watch/${animeSlug}`);
    log('  1. watch page status:', watchRes.status);

    if (watchRes.status !== 200) {
      err('getEpisodes: watch page returned', watchRes.status, 'for', animeSlug);
      return [];
    }

    const watchDoc = loadHtml(String(watchRes.data));
    const mainDiv = watchDoc.querySelector('div', { id: 'watch-main' });
    const animeId = HtmlDoc.attr(mainDiv, 'data-id');

    log('  1. extracted data-id:', animeId);

    if (!animeId) {
      err('getEpisodes: could not find #watch-main[data-id] on page for slug:', animeSlug);
      // Dump first 500 chars of body to help debug
      log('  1. body snippet:', String(watchRes.data).substring(0, 500));
      return [];
    }

    // ── Step 2: AJAX episode list ─────────────────────────────────────────────
    const ajaxUrl = `/ajax/episode/list/${animeId}`;
    log('  2. Fetching episode list AJAX:', ajaxUrl);

    const epRes = await client.get(ajaxUrl, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/plain, */*',
        Referer: `${this._mirror}/watch/${animeSlug}`,
      },
    });

    log('  2. episode AJAX status:', epRes.status);

    if (epRes.status !== 200) {
      err('getEpisodes: episode AJAX returned', epRes.status);
      log('  2. response body:', String(epRes.data).substring(0, 300));
      return [];
    }

    // Response is { result: "<html>" }
    const epJson = tryJson<{ result?: string }>(epRes.data);
    log('  2. response type:', typeof epRes.data, '— has result:', !!epJson?.result);

    const epHtml = epJson?.result ?? '';
    if (!epHtml) {
      err('getEpisodes: AJAX result is empty');
      log('  2. raw response:', String(epRes.data).substring(0, 300));
      return [];
    }

    // ── Step 3: parse episode HTML ────────────────────────────────────────────
    //
    // <ul class="ep-range" data-range="001-012">
    //   <li title="Episode Title" data-html="true">
    //     <a data-num="1" data-ids="<base64>" data-sub="1" data-dub="0" ...>
    //     </a>
    //   </li>
    // </ul>
    //
    const $ = loadHtml(epHtml);
    const episodes: ProviderEpisode[] = [];
    const listItems = $.querySelectorAll('li');
    log('  3. li elements in episode HTML:', listItems.length);

    for (const li of listItems) {
      if (!HtmlDoc.attr(li, 'data-html')) continue;

      const a = HtmlDoc.querySelector(li, 'a');
      if (!a) continue;

      const numAttr = HtmlDoc.attr(a, 'data-num');
      if (!numAttr) continue;

      const rawIds = HtmlDoc.attr(a, 'data-ids') || '';
      const epId = rawIds.replace(/^\\?["']|\\?["']$/g, '').trim();
      if (!epId) continue;

      const num = parseInt(numAttr) || 0;
      const title = HtmlDoc.attr(li, 'title') || `Episode ${num}`;

      episodes.push({ id: epId, number: num, title });
    }

    log('  3. parsed', episodes.length, 'episodes');
    if (episodes.length > 0) {
      log('  3. first episode id (first 60 chars):', episodes[0].id.substring(0, 60));
    }

    return episodes;
  }

  // ── STREAM SOURCES ────────────────────────────────────────────────────────

  /**
   * Resolve m3u8 stream URLs for an episode.
   * @param episodeId  The `data-ids` base64 string from getEpisodes
   * @param options    { dub: true } to prefer dub servers
   *
   * @throws if no sources could be resolved (lets caller handle fallback)
   */
  async getStreamSources(
    episodeId: string,
    options?: { dub?: boolean }
  ): Promise<ProviderStreamSource[]> {
    log('getStreamSources() id length:', episodeId.length, 'dub:', options?.dub);
    await this._ensureSession();

    const isDub = options?.dub ?? false;
    const client = makeClient(this._mirror, this._cookie);

    // ── Step 1: fetch server list ─────────────────────────────────────────────
    log('  1. Fetching server list via /ajax/server/list');
    const serversRes = await client.get('/ajax/server/list', {
      params: { servers: episodeId },
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/plain, */*',
        Referer: this._mirror,
      },
    });

    log('  1. server list status:', serversRes.status);

    if (serversRes.status !== 200) {
      err('getStreamSources: server list returned', serversRes.status);
      log('  1. body:', String(serversRes.data).substring(0, 300));
      throw new Error(`Server list request failed with status ${serversRes.status}`);
    }

    const serversJson = tryJson<{ result?: string }>(serversRes.data);
    log('  1. has result html:', !!serversJson?.result);

    if (!serversJson?.result) {
      err('getStreamSources: server list result is empty');
      log('  1. raw data:', String(serversRes.data).substring(0, 300));
      throw new Error('Server list returned empty result');
    }

    // ── Step 2: parse server HTML ─────────────────────────────────────────────
    //
    // <div class="servers">
    //   <div class="type" data-type="sub">
    //     <ul><li data-link-id="abc123">VidPlay-1</li></ul>
    //   </div>
    //   <div class="type" data-type="dub"> … </div>
    // </div>
    //
    const $ = loadHtml(serversJson.result);
    const allServers: { linkId: string; name: string; type: string }[] = [];
    const typeEls = $.querySelectorClass('div', 'type');
    log('  2. server type groups found:', typeEls.length);

    for (const typeEl of typeEls) {
      const type = HtmlDoc.attr(typeEl, 'data-type') || 'sub';
      const listItems = HtmlDoc.querySelectorAll(typeEl, 'li');
      for (const li of listItems) {
        const linkId = HtmlDoc.attr(li, 'data-link-id');
        if (linkId) {
          allServers.push({ linkId, name: HtmlDoc.text(li).trim() || 'Server', type });
        }
      }
    }

    log(
      '  2. total servers parsed:',
      allServers.length,
      allServers.map((s) => `${s.name}(${s.type})`).join(', ')
    );

    const preferredServers = allServers.filter((s) =>
      isDub ? s.type === 'dub' : s.type === 'sub' || s.type === 'raw'
    );
    log('  2. preferred servers after filter:', preferredServers.length);

    if (preferredServers.length === 0 && allServers.length > 0) {
      warn('  2. No', isDub ? 'dub' : 'sub', 'servers — falling back to all servers');
      preferredServers.push(...allServers);
    }

    // ── Step 3: resolve each server's embed URL ───────────────────────────────
    const sources: ProviderStreamSource[] = [];

    for (const server of preferredServers) {
      log(`  3. Resolving server "${server.name}" (${server.linkId.substring(0, 12)}…)`);

      try {
        // GET /ajax/server?get=<linkId> → { result: "{\"url\":\"...\",\"backup\":\"...\"}" }
        const streamInfoRes = await client.get('/ajax/server', {
          params: { get: server.linkId },
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json, text/plain, */*',
            Referer: this._mirror,
          },
        });

        log(`  3. stream-info status for "${server.name}":`, streamInfoRes.status);

        if (streamInfoRes.status !== 200) {
          warn(`  3. stream-info failed for "${server.name}" — status`, streamInfoRes.status);
          continue;
        }

        // result is a JSON string: "{\"url\":\"https://vidtube.site/...\",\"backup\":\"...\"}"
        const streamInfoJson = tryJson<{ result?: unknown }>(streamInfoRes.data);
        const resultObj = tryJson<{ url?: string; backup?: string; skip_data?: any }>(
          streamInfoJson?.result
        );

        log(`  3. embed URL for "${server.name}":`, resultObj?.url?.substring(0, 60) ?? '(none)');

        const embedUrl = resultObj?.url;
        if (!embedUrl) {
          warn(`  3. No embed URL for server "${server.name}"`);
          continue;
        }

        // ── Step 4: resolve embed URL → actual m3u8 ──────────────────────────
        const resolved = await this._resolveEmbed(embedUrl);

        if (resolved?.url) {
          log(`  4. ✅ resolved stream for "${server.name}":`, resolved.url.substring(0, 80));
          sources.push({
            serverName: server.name,
            type: server.type as 'sub' | 'dub',
            m3u8Url: resolved.url,
            referer: embedUrl,
            subtitles: resolved.subtitles,
            headers: {
              Referer: embedUrl,
              Origin: new URL(embedUrl).origin,
              'User-Agent': USER_AGENT,
            },
            intro: resolved.skipData?.intro
              ? { start: resolved.skipData.intro[0], end: resolved.skipData.intro[1] }
              : null,
            outro: resolved.skipData?.outro
              ? { start: resolved.skipData.outro[0], end: resolved.skipData.outro[1] }
              : null,
          });
        } else {
          warn(`  4. Could not resolve stream for "${server.name}". Trying backup…`);

          if (resultObj?.backup) {
            const backupResolved = await this._resolveEmbed(resultObj.backup);
            if (backupResolved?.url) {
              log(
                `  4. ✅ backup resolved for "${server.name}":`,
                backupResolved.url.substring(0, 80)
              );
              sources.push({
                serverName: `${server.name} (Backup)`,
                type: server.type as 'sub' | 'dub',
                m3u8Url: backupResolved.url,
                referer: resultObj.backup,
                subtitles: backupResolved.subtitles,
                headers: {
                  Referer: resultObj.backup,
                  Origin: new URL(resultObj.backup).origin,
                  'User-Agent': USER_AGENT,
                },
                intro: backupResolved.skipData?.intro
                  ? {
                      start: backupResolved.skipData.intro[0],
                      end: backupResolved.skipData.intro[1],
                    }
                  : null,
                outro: backupResolved.skipData?.outro
                  ? {
                      start: backupResolved.skipData.outro[0],
                      end: backupResolved.skipData.outro[1],
                    }
                  : null,
              });
            } else {
              warn(`  4. Backup also failed for "${server.name}"`);
            }
          }
        }
      } catch (e: any) {
        err(`  3. Exception resolving server "${server.name}":`, e?.message);
      }
    }

    log('getStreamSources: total sources resolved:', sources.length);

    if (sources.length === 0) {
      throw new Error(
        `No stream sources resolved for episode. Tried ${preferredServers.length} servers.`
      );
    }

    return sources;
  }

  // ── EMBED RESOLVER ────────────────────────────────────────────────────────

  /**
   * Resolve the actual m3u8/mp4 from an embed player URL.
   *
   * Chain:
   *   vidtube.site/... → extract data-id
   *     → megaplay-1.buzz/ajax/sources/<data-id>
   *       → { source/url/file: "<m3u8>" }
   */
  private async _resolveEmbed(embedUrl: string): Promise<{
    url: string | null;
    subtitles: ProviderSubtitle[];
    skipData: any;
  } | null> {
    log('    _resolveEmbed:', embedUrl.substring(0, 80));

    try {
      const embedClient = axios.create({
        timeout: 12_000,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          Referer: `${this._mirror}/`,
          Origin: this._mirror,
        },
        validateStatus: () => true,
      });

      const embedRes = await embedClient.get(embedUrl);
      log('    embed page status:', embedRes.status);

      if (embedRes.status !== 200) {
        warn('    embed page returned', embedRes.status);
        return { url: null, subtitles: [], skipData: null };
      }

      const embedHtml = String(embedRes.data);

      // Extract data-id from the player element
      const dataId =
        embedHtml.match(/data-id="(\d+)"/)?.[1] ||
        embedHtml.match(/['"]id['"]\s*:\s*['"](\d+)['"]/)?.[1];

      log('    embed data-id:', dataId ?? '(not found)');

      if (!dataId) {
        warn('    No data-id in embed page. Body snippet:', embedHtml.substring(0, 300));
        return { url: null, subtitles: [], skipData: null };
      }

      const embedDomain = new URL(embedUrl).hostname;
      console.log('Embeded doman', embedDomain);
      // Map embed domain → API domain
      let apiDomain: string;
      try {
        apiDomain = EMBED_API_MAP[embedDomain] ?? embedDomain;
        log('    embed domain:', embedDomain, '→ api domain:', apiDomain);
      } catch {
        apiDomain = 'megaplay-1.buzz';
        log('    URL parse failed, using default api domain:', apiDomain);
      }

      const sourcesUrl = `https://${apiDomain}/ajax/sources/${dataId}`;
      log('    fetching sources from:', sourcesUrl);

      const sourcesRes = await axios.get(sourcesUrl, {
        timeout: 10_000,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json, text/plain, */*',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept-Language': 'en-US,en;q=0.5',
          Connection: 'keep-alive',
          Referer: embedUrl,
          Origin: `https://${embedDomain}`,
        },
        validateStatus: () => true,
      });

      log('    sources status:', sourcesRes.status);

      if (sourcesRes.status !== 200) {
        warn('    sources endpoint returned', sourcesRes.status);
        return { url: null, subtitles: [], skipData: null };
      }

      const sourcesJson = tryJson<any>(sourcesRes.data);
      log('    sources keys:', sourcesJson ? Object.keys(sourcesJson).join(', ') : '(null)');

      const streamUrl: string | null =
        sourcesJson?.source || sourcesJson?.url || sourcesJson?.file || null;

      log('    stream URL:', streamUrl?.substring(0, 80) ?? '(none)');

      // Extract subtitles
      const subtitles: ProviderSubtitle[] = [];
      const tracks: any[] = sourcesJson?.tracks ?? sourcesJson?.subtitles ?? [];
      for (const track of tracks) {
        if (track.kind === 'subtitles' || track.type === 'subtitles' || track.kind === 'captions') {
          subtitles.push({
            file: track.file || track.src || track.url || '',
            label: track.label || track.language || 'Unknown',
            kind: track.kind || 'captions',
          });
        }
      }

      return { url: streamUrl, subtitles, skipData: sourcesJson?.skip_data ?? null };
    } catch (e: any) {
      err('    _resolveEmbed exception:', e?.message);
      return null;
    }
  }
}
