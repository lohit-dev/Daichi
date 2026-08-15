import {
  StreamingProvider,
  ProviderSearchResult,
  ProviderEpisode,
  ProviderStreamSource,
} from '../types';
import { MegaUp } from './megaup';
import { USER_AGENT } from '../animepahe/utils';
import { loadHtml, HtmlDoc } from '../utils/html-parser';

const BASE_URL = 'https://anikai.stream';

function makeHeaders(): Record<string, string> {
  return {
    'User-Agent': USER_AGENT,
    Connection: 'keep-alive',
    Accept: 'text/html, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.5',
    'Sec-GPC': '1',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    Priority: 'u=0',
    Pragma: 'no-cache',
    'Cache-Control': 'no-cache',
    Referer: `${BASE_URL}/`,
    Cookie: '__p_mov=1; usertype=guest; session=vLrU4aKItp0QltI2asH83yugyWDsSSQtyl9sxWKO',
  };
}

export class AnimeKaiProvider implements StreamingProvider {
  readonly name = 'AnimeKai';
  readonly baseUrl = BASE_URL;

  async search(query: string, page = 1): Promise<ProviderSearchResult[]> {
    const url = `${BASE_URL}/browser?keyword=${encodeURIComponent(
      query.replace(/[\W_]+/g, '+')
    )}&page=${page}`;
    const res = await fetch(url, { headers: makeHeaders() });
    const html = await res.text();
    const $ = loadHtml(html);

    const results: ProviderSearchResult[] = [];
    const items = $.querySelectorClass('div', 'aitem');

    for (const card of items) {
      const inner = HtmlDoc.querySelector(card, 'div', { class: 'inner' });
      if (!inner) continue;
      const atag = HtmlDoc.children(inner).find((el) => el.name === 'a');
      if (!atag) continue;

      const id = (HtmlDoc.attr(atag, 'href') || '').replace('/watch/', '');
      const info = HtmlDoc.querySelector(card, 'div', { class: 'info' });
      const infoChildren = info ? HtmlDoc.children(info) : [];
      const type = infoChildren.length ? HtmlDoc.text(infoChildren[infoChildren.length - 1]) : '';

      const subEl = infoChildren.find((el) =>
        HtmlDoc.children(el).some((c) => HtmlDoc.text(c) === 'SUB')
      );
      const dubEl = infoChildren.find((el) =>
        HtmlDoc.children(el).some((c) => HtmlDoc.text(c) === 'DUB')
      );

      const img = HtmlDoc.querySelector(card, 'img');

      results.push({
        id,
        title: HtmlDoc.text(atag),
        url: `${BASE_URL}${HtmlDoc.attr(atag, 'href') || ''}`,
        image: HtmlDoc.attr(img, 'data-src') || HtmlDoc.attr(img, 'src') || '',
        type,
        subCount: parseInt(HtmlDoc.text(subEl) || '0') || 0,
        dubCount: parseInt(HtmlDoc.text(dubEl) || '0') || 0,
        episodeCount:
          parseInt(HtmlDoc.text(infoChildren[infoChildren.length - 2]) || '0') ||
          parseInt(HtmlDoc.text(subEl) || '0') ||
          0,
      });
    }

    return results;
  }

  async getEpisodes(animeId: string): Promise<ProviderEpisode[]> {
    try {
      const animeSlug = animeId.split('$')[0]!;
      const res = await fetch(`${BASE_URL}/watch/${animeSlug}`, {
        headers: makeHeaders(),
      });
      const html = await res.text();
      const $ = loadHtml(html);

      const aniId = HtmlDoc.attr($.querySelector('div', { id: 'anime-rating' }), 'data-id');
      if (!aniId) return [];

      const episodesToken = await MegaUp.generateToken(aniId);
      const episodesRes = await fetch(
        `${BASE_URL}/ajax/episodes/list?ani_id=${aniId}&_=${episodesToken}`,
        {
          headers: {
            ...makeHeaders(),
            'X-Requested-With': 'XMLHttpRequest',
            Referer: `${BASE_URL}/watch/${animeSlug}`,
          },
        }
      );

      const epData = await episodesRes.json();
      const epHtml = epData.result;
      if (typeof epHtml !== 'string') return [];

      const $$ = loadHtml(epHtml);
      const episodes: ProviderEpisode[] = [];

      const items = $$.querySelectorClass('a', '');
      for (const el of items) {
        const numAttr = HtmlDoc.attr(el, 'num');
        const tokenAttr = HtmlDoc.attr(el, 'token');
        if (!numAttr || !tokenAttr) continue;

        const number = parseInt(numAttr);
        const titleSpan = HtmlDoc.querySelector(el, 'span');

        episodes.push({
          id: `${animeSlug}$ep=${numAttr}$token=${tokenAttr}`,
          number,
          title: HtmlDoc.text(titleSpan) || `Episode ${number}`,
        });
      }

      return episodes;
    } catch (err) {
      console.error('AnimeKaiProvider getEpisodes error:', err);
      return [];
    }
  }

  async getStreamSources(
    episodeId: string,
    options?: { dub?: boolean }
  ): Promise<ProviderStreamSource[]> {
    try {
      const tokenMatch = episodeId.match(/\$token=([^$]+)/);
      if (!tokenMatch) return [];
      const token = tokenMatch[1];

      const ajaxToken = await MegaUp.generateToken(token);
      const serversUrl = `${BASE_URL}/ajax/links/list?token=${token}&_=${ajaxToken}`;
      const res = await fetch(serversUrl, { headers: makeHeaders() });
      const data = await res.json();
      const serverHtml = data.result;

      if (typeof serverHtml !== 'string') return [];

      const $ = loadHtml(serverHtml);
      const results: ProviderStreamSource[] = [];
      const seen = new Set<string>();

      const isDubRequest = options?.dub;
      const targetGroups = isDubRequest
        ? [{ id: 'dub', label: 'dub', subType: null }]
        : [
            { id: 'sub', label: 'hardsub', subType: 'hard' },
            { id: 'softsub', label: 'softsub', subType: 'soft' },
          ];

      const allGroups = $.querySelectorClass('div', 'lang-group');

      for (const group of targetGroups) {
        const targetGroup = allGroups.find((g) => HtmlDoc.attr(g, 'data-id') === group.id);
        if (!targetGroup) continue;

        const serverItems = HtmlDoc.children(targetGroup).filter((c) =>
          HtmlDoc.hasClass(c, 'server')
        );

        for (const item of serverItems) {
          const lid = HtmlDoc.attr(item, 'data-lid');
          if (!lid || seen.has(lid)) continue;
          seen.add(lid);

          try {
            const viewToken = await MegaUp.generateToken(lid);
            const viewRes = await fetch(`${BASE_URL}/ajax/links/view?id=${lid}&_=${viewToken}`, {
              headers: makeHeaders(),
            });
            const viewData = await viewRes.json();

            const decoded = await MegaUp.decodeIframeData(viewData.result);
            const videoSources = await MegaUp.extract(decoded.url);

            const formattedSubtitles = (videoSources.subtitles || []).map((sub: any) => ({
              file: sub.url,
              label: sub.lang,
              kind: sub.kind || 'captions',
            }));

            const suffix =
              group.label === 'hardsub'
                ? ' (HardSub)'
                : group.label === 'softsub'
                  ? ' (SoftSub)'
                  : group.label === 'dub'
                    ? ' (Dub)'
                    : '';

            const m3u8Source =
              videoSources.sources.find((s: any) => s.isM3U8) || videoSources.sources[0];
            if (!m3u8Source) continue;

            results.push({
              serverName: `MegaUp ${HtmlDoc.text(item).trim()}${suffix}`,
              type: isDubRequest ? 'dub' : 'sub',
              m3u8Url: m3u8Source.url,
              referer: decoded.url,
              subtitles: formattedSubtitles,
              headers: {
                Referer: decoded.url,
                'User-Agent': USER_AGENT,
              },
              intro: decoded.skip?.intro
                ? { start: decoded.skip.intro[0], end: decoded.skip.intro[1] }
                : undefined,
              outro: decoded.skip?.outro
                ? { start: decoded.skip.outro[0], end: decoded.skip.outro[1] }
                : undefined,
            });
          } catch (e) {
            console.error('Error fetching source for lid', lid, e);
          }
        }
      }

      return results;
    } catch (err) {
      console.error('AnimeKai streams error:', err);
      return [];
    }
  }
}
