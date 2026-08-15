import {
  StreamingProvider,
  ProviderSearchResult,
  ProviderEpisode,
  ProviderStreamSource,
} from '../types';
import { decrypt } from './decrypt';
import type { AnimePaheSearchItem, AnimePaheEpisode, AnimePaheStreamResult } from './types';
import { unpackJsAndCombine } from './unpacker';
import {
  USER_AGENT,
  DDOS_GUARD_HEADERS,
  substringBefore,
  substringAfter,
  substringAfterLast,
} from './utils';
import { loadHtml, HtmlDoc } from '../utils/html-parser';

const BASE_URL = 'https://animepahe.pw';

function headers(): Record<string, string> {
  return { ...DDOS_GUARD_HEADERS };
}

export class AnimePaheProvider implements StreamingProvider {
  readonly name = 'AnimePahe';
  readonly baseUrl = BASE_URL;

  async search(query: string): Promise<ProviderSearchResult[]> {
    const res = await fetch(`${BASE_URL}/api?m=search&l=8&q=${encodeURIComponent(query)}`, {
      headers: headers(),
    });
    const json = await res.json().catch(() => ({ data: [] }));
    return (json.data || []).map((item: any) => ({
      id: item.session,
      title: item.title,
      type: item.type,
      episodeCount: item.episodes,
      poster: item.poster.startsWith('http')
        ? item.poster
        : `https://i.animepahe.si/posters/${item.poster}`,
      url: `${BASE_URL}/anime/${item.session}`,
    }));
  }

  async getEpisodes(animeId: string): Promise<ProviderEpisode[]> {
    const allEpisodes: AnimePaheEpisode[] = [];
    let page = 1;
    let lastPage = 1;

    do {
      const res = await fetch(
        `${BASE_URL}/api?m=release&id=${animeId}&sort=episode_asc&page=${page}`,
        { headers: headers() }
      );
      const json = await res.json().catch(() => null);
      if (!json || !json.data) break;

      allEpisodes.push(...json.data);
      lastPage = json.last_page || 1;
      page++;
    } while (page <= lastPage);

    return allEpisodes.map((ep) => ({
      id: ep.session,
      number: ep.episode,
      title: ep.title || `Episode ${ep.episode}`,
      image: ep.snapshot.startsWith('http')
        ? ep.snapshot
        : `https://i.animepahe.si/screenshots/${ep.snapshot}`,
    }));
  }

  async getStreamSources(
    episodeId: string,
    _options?: { dub?: boolean }
  ): Promise<ProviderStreamSource[]> {
    const results: ProviderStreamSource[] = [];

    for await (const stream of this._streams(episodeId)) {
      if (stream.url || stream.directUrl) {
        results.push({
          serverName: stream.title || 'Default',
          type: stream.audio === 'jpn' ? 'sub' : 'dub',
          m3u8Url: stream.directUrl || stream.url,
          referer: 'https://kwik.cx/',
          subtitles: [],
          headers: stream.corsHeaders || {
            Referer: 'https://kwik.cx/',
            'User-Agent': USER_AGENT,
          },
        });
      }
    }

    return results;
  }

  private async *_streams(session: string): AsyncGenerator<AnimePaheStreamResult> {
    try {
      const res = await fetch(`${BASE_URL}/api?m=links&id=${session}&p=kwik`, {
        headers: headers(),
      });
      const json = await res.json().catch(() => ({ data: [] }));
      const data = json.data || [];

      for (const qualityGroup of data) {
        for (const [quality, linkObj] of Object.entries(qualityGroup)) {
          const link = linkObj as any;
          if (!link.kwik) continue;

          try {
            const stream = await this._extractKwik(link.kwik, quality);
            if (stream) yield stream;
          } catch {
            // skip broken
          }
        }
      }
    } catch {
      // no streams
    }
  }

  private async _extractKwik(
    kwikUrl: string,
    quality: string
  ): Promise<AnimePaheStreamResult | null> {
    const res = await fetch(kwikUrl, {
      headers: {
        ...headers(),
        Referer: `${BASE_URL}/`,
      },
    });
    const html = await res.text();

    const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\).*?<\/script>/s);
    if (!packedMatch) return null;

    const unpacked = unpackJsAndCombine(packedMatch[0]);

    const formMatch = unpacked.match(
      /<form[^>]+action="([^"]+)"[^>]*>.*?<input[^>]+value="([^"]+)"/s
    );
    if (!formMatch) return null;

    const actionUrl = formMatch[1];
    const token = formMatch[2];

    const postRes = await fetch(actionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: kwikUrl,
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({ _token: token }).toString(),
    });
    const postHtml = await postRes.text();

    const sourceMatch = postHtml.match(/source\s*=\s*['"]([^'"]+)['"]/);
    if (!sourceMatch) return null;

    return {
      id: kwikUrl,
      title: `${quality}p`,
      url: sourceMatch[1],
      directUrl: sourceMatch[1],
      quality,
      audio: 'jpn',
      type: 'sub',
      corsHeaders: {
        Referer: kwikUrl,
        'User-Agent': USER_AGENT,
      },
    };
  }
}
