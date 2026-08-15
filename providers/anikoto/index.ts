import {
  StreamingProvider,
  ProviderSearchResult,
  ProviderEpisode,
  ProviderStreamSource,
  ProviderSubtitle,
} from '../types';
import { loadHtml, HtmlDoc } from '../utils/html-parser';

const BASE_URL = 'https://anikototv.to';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36';

function makeHeaders(): Record<string, string> {
  return {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Upgrade-Insecure-Requests': '1',
  };
}

export class AnikotoProvider implements StreamingProvider {
  readonly name = 'Anikoto';
  readonly baseUrl = BASE_URL;

  private _sessionCookie: string = '';

  private async getSessionCookie(): Promise<string> {
    if (this._sessionCookie) return this._sessionCookie;
    try {
      const res = await fetch(`${BASE_URL}/home`, { headers: makeHeaders() });
      const cookie = res.headers.get('set-cookie')?.split(';')[0];
      if (cookie) this._sessionCookie = cookie;
    } catch (e) {
      console.error('Failed to get session cookie', e);
    }
    return this._sessionCookie;
  }

  // ─── SEARCH ─────────────────────────────────────────────────────────

  async search(query: string, page = 1): Promise<ProviderSearchResult[]> {
    const url = `${BASE_URL}/filter?keyword=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: makeHeaders() });
    const html = await res.text();
    const $ = loadHtml(html);

    const results: ProviderSearchResult[] = [];
    const items = $.querySelectorClass('div', 'item');

    for (const card of items) {
      const atag = HtmlDoc.querySelector(card, 'a');
      const slug = (HtmlDoc.attr(atag, 'href') || '').split('/watch/').pop() || '';

      const posterImg = HtmlDoc.querySelector(card, 'img');
      const poster = HtmlDoc.attr(posterImg, 'src') || '';

      const infoDiv = HtmlDoc.querySelectorClassOne(card, 'div', 'info');
      const titleAnchor = infoDiv ? HtmlDoc.querySelectorClassOne(infoDiv, 'a', 'name') : null;
      const title = titleAnchor ? HtmlDoc.text(titleAnchor) : '';

      const subEl = HtmlDoc.querySelectorClassOne(card, 'div', 'sub');
      const sub = parseInt(HtmlDoc.text(subEl)) || 0;

      const dubEl = HtmlDoc.querySelectorClassOne(card, 'div', 'dub');
      const dub = parseInt(HtmlDoc.text(dubEl)) || 0;

      const totalEl = HtmlDoc.querySelectorClassOne(card, 'div', 'total');
      const episodeCount = parseInt(HtmlDoc.text(totalEl)) || 0;

      if (slug) {
        results.push({
          id: slug,
          title,
          url: `${BASE_URL}/watch/${slug}`,
          image: poster,
          subCount: sub,
          dubCount: dub,
          episodeCount: episodeCount || Math.max(sub, dub),
        });
      }
    }

    return results;
  }

  // ─── EPISODES ───────────────────────────────────────────────────────

  async getEpisodes(animeSlug: string): Promise<ProviderEpisode[]> {
    try {
      // 1. Fetch watch page to get the internal anime ID
      const watchUrl = `${BASE_URL}/watch/${animeSlug}`;
      const watchRes = await fetch(watchUrl, { headers: makeHeaders() });
      const watchHtml = await watchRes.text();
      const watchDoc = loadHtml(watchHtml);

      const mainDiv = watchDoc.querySelector('div', { id: 'watch-main' });
      const animeId = HtmlDoc.attr(mainDiv, 'data-id');

      if (!animeId) {
        throw new Error('Could not find anime ID on watch page');
      }

      // 2. Fetch episodes list via AJAX
      const episodesRes = await fetch(`${BASE_URL}/ajax/episode/list/${animeId}`, {
        headers: {
          ...makeHeaders(),
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      const epData = await episodesRes.json();
      const epHtml = epData?.result || '';
      const $ = loadHtml(epHtml);

      const episodes: ProviderEpisode[] = [];
      const listItems = $.querySelectorAll('li');

      for (const li of listItems) {
        if (!HtmlDoc.attr(li, 'data-html')) continue;

        const a = HtmlDoc.querySelector(li, 'a');
        if (!a) continue;

        const epId = (HtmlDoc.attr(a, 'data-ids') || '').replace(/^\\?["']|\\?["']$/g, '');
        const num = parseInt(HtmlDoc.attr(a, 'data-num') || '0');
        const titleText = HtmlDoc.attr(li, 'title') || '';
        const jpTitleEl = HtmlDoc.querySelectorClassOne(a, 'span', 'd-title');
        const jpTitle = jpTitleEl ? HtmlDoc.attr(jpTitleEl, 'data-jp') : '';

        if (epId) {
          episodes.push({
            id: epId, // This is the episode ID we need for getStreamSources
            number: num,
            title: titleText || jpTitle || `Episode ${num}`,
          });
        }
      }

      return episodes;
    } catch (err) {
      console.error('Anikoto getEpisodes error:', err);
      return [];
    }
  }

  // ─── STREAMS ────────────────────────────────────────────────────────

  async getStreamSources(
    episodeId: string,
    options?: { dub?: boolean }
  ): Promise<ProviderStreamSource[]> {
    try {
      const isDub = options?.dub ?? false;

      const cookie = await this.getSessionCookie();

      // 1. Fetch server list for the episode
      const serversUrl = `${BASE_URL}/ajax/server/list?servers=${episodeId}`;
      const serversRes = await fetch(serversUrl, {
        headers: {
          ...makeHeaders(),
          'X-Requested-With': 'XMLHttpRequest',
          ...(cookie ? { Cookie: cookie } : {}),
        },
      });
      const serversData = await serversRes.json();
      const $ = loadHtml(serversData?.result || '');

      const servers: { linkId: string; name: string; type: string }[] = [];
      const typeEls = $.querySelectorClass('div', 'type');

      for (const typeEl of typeEls) {
        const type = HtmlDoc.attr(typeEl, 'data-type') || 'sub';
        if ((isDub && type !== 'dub') || (!isDub && type !== 'sub' && type !== 'raw')) {
          continue;
        }

        const listItems = HtmlDoc.querySelectorAll(typeEl, 'li');
        for (const li of listItems) {
          const linkId = HtmlDoc.attr(li, 'data-link-id');
          if (linkId) {
            servers.push({
              linkId,
              name: HtmlDoc.text(li) || '',
              type,
            });
          }
        }
      }

      const sources: ProviderStreamSource[] = [];

      // 2. Resolve each server's embed URL
      for (const server of servers) {
        try {
          const streamInfoRes = await fetch(`${BASE_URL}/ajax/server?get=${server.linkId}`, {
            headers: {
              ...makeHeaders(),
              'X-Requested-With': 'XMLHttpRequest',
              ...(cookie ? { Cookie: cookie } : {}),
            },
          });
          const streamInfoData = await streamInfoRes.json();

          const embedUrl = streamInfoData?.result?.url;
          if (!embedUrl) continue;

          // 3. Resolve the actual stream URL from the embed
          const resolved = await this._resolveEmbed(embedUrl);
          if (resolved?.url) {
            sources.push({
              serverName: server.name || 'Auto',
              type: server.type as 'sub' | 'dub',
              m3u8Url: resolved.url,
              referer: embedUrl,
              subtitles: resolved.subtitles || [],
              headers: {
                Referer: embedUrl,
                'User-Agent': USER_AGENT,
              },
              intro: resolved.skipData?.intro
                ? { start: resolved.skipData.intro[0], end: resolved.skipData.intro[1] }
                : undefined,
              outro: resolved.skipData?.outro
                ? { start: resolved.skipData.outro[0], end: resolved.skipData.outro[1] }
                : undefined,
            });
          }
        } catch (err) {
          console.error(`Failed to resolve server ${server.name}`, err);
        }
      }

      return sources;
    } catch (err) {
      console.error('Anikoto getStreamSources error:', err);
      return [];
    }
  }

  private async _resolveEmbed(embedUrl: string) {
    try {
      // Fetch embed page to get data-id
      const embedRes = await fetch(embedUrl, {
        headers: {
          ...makeHeaders(),
          Referer: BASE_URL,
        },
      });
      const embedHtml = await embedRes.text();
      const dataIdMatch = embedHtml.match(/data-id="(\d+)"/);
      const dataId = dataIdMatch ? dataIdMatch[1] : null;

      if (!dataId) return null;

      // Map domain
      const embedDomain = new URL(embedUrl).hostname;
      const apiDomain =
        {
          'vidtube.site': 'megaplay-1.buzz',
          'vidplay.site': 'megaplay-1.buzz',
          'megaplay.buzz': 'megaplay-1.buzz',
          'embed.bunkrerrer.com': 'megaplay-1.buzz',
        }[embedDomain] || embedDomain;

      // Fetch sources
      const sourcesRes = await fetch(`https://${apiDomain}/ajax/sources/${dataId}`, {
        headers: {
          ...makeHeaders(),
          Referer: embedUrl,
          Origin: `https://${embedDomain}`,
        },
      });
      const sourcesData = await sourcesRes.json();

      const url = sourcesData?.source || sourcesData?.url || sourcesData?.file;

      const subtitles: ProviderSubtitle[] = [];
      if (sourcesData?.tracks && Array.isArray(sourcesData.tracks)) {
        for (const track of sourcesData.tracks) {
          if (track.kind === 'subtitles' || track.type === 'subtitles') {
            subtitles.push({
              label: track.label || track.language || 'Unknown',
              kind: track.kind || 'captions',
              file: track.file || track.src || '',
            });
          }
        }
      }

      return {
        url,
        subtitles,
        skipData: sourcesData?.skip_data,
      };
    } catch (err) {
      console.error('Anikoto embed resolution error:', err);
      return null;
    }
  }
}
