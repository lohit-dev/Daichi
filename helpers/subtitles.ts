import { File, Paths } from 'expo-file-system';

import { SubtitleCue, SubtitleTrack } from '~/types';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

// ---------------------------------------------------------------------------
// VTT parsing
// ---------------------------------------------------------------------------

const parseVttTimestamp = (timestamp: string) => {
  const values = timestamp.trim().replace(',', '.').split(':').map(Number);
  if (values.some(Number.isNaN)) return null;

  if (values.length === 3) {
    return values[0] * 60 * 60 + values[1] * 60 + values[2];
  }

  return values.length === 2 ? values[0] * 60 + values[1] : null;
};

const getCuePlacement = (settings: string, text: string): SubtitleCue['placement'] => {
  const alignment = text.match(/\{\\an([1-9])\}/)?.[1];
  if (alignment && ['7', '8', '9'].includes(alignment)) return 'top';

  const line = settings.match(/line:([\d.]+)%?/i)?.[1];
  if (line && Number(line) <= 35) return 'top';

  return 'bottom';
};

export const parseVttCues = (content: string): SubtitleCue[] =>
  content
    .replace(/^\uFEFF?WEBVTT[^\n]*\n?/i, '')
    .split(/\r?\n\s*\r?\n/)
    .flatMap((block) => {
      const lines = block.split(/\r?\n/).filter(Boolean);
      const timingLineIndex = lines.findIndex((line) => line.includes('-->'));
      if (timingLineIndex === -1) return [];

      const [start, endWithSettings] = lines[timingLineIndex].split('-->');
      const startTime = parseVttTimestamp(start);
      // The value after `-->` starts with a space in standard VTT files.
      // Trim it before taking the timestamp, otherwise every end time is empty.
      const [endTimestamp, ...settings] = endWithSettings.trim().split(/\s+/);
      const endTime = parseVttTimestamp(endTimestamp);
      const rawText = lines.slice(timingLineIndex + 1).join('\n');
      const text = rawText.replace(/<[^>]*>|\{\\an[1-9]\}/g, '').trim();

      return startTime !== null && endTime !== null && text
        ? [{ startTime, endTime, text, placement: getCuePlacement(settings.join(' '), rawText) }]
        : [];
    });

// ---------------------------------------------------------------------------
// Subtitle download & cache
// ---------------------------------------------------------------------------

export const MAX_SUBTITLE_RETRIES = 3;

const subtitleDownloadCache = new Map<string, Promise<string>>();

const hashSubtitleUrl = (url: string) => {
  let hash = 0;
  for (let index = 0; index < url.length; index += 1) {
    hash = (hash * 31 + url.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
};

// Single download attempt (no retry here — retry is orchestrated by the
// caller so we can update status text between attempts).
export const loadSubtitleVttOnce = (url: string, referer: string) => {
  const cacheKey = `${url}|${referer}`;
  const existingRequest = subtitleDownloadCache.get(cacheKey);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const subtitleFile = new File(Paths.cache, `subtitle-${hashSubtitleUrl(url)}.vtt`);

    if (subtitleFile.exists) {
      const cachedContent = await subtitleFile.text();
      if (cachedContent.includes('-->')) {
        return cachedContent;
      }
    }

    const downloadedFile = await File.downloadFileAsync(url, subtitleFile, {
      headers: { Referer: referer },
      idempotent: true,
    });
    return downloadedFile.text();
  })();

  subtitleDownloadCache.set(cacheKey, request);
  request.catch(() => subtitleDownloadCache.delete(cacheKey));
  return request;
};

export const getPreferredSubtitleIndex = (tracks: SubtitleTrack[]) => {
  const englishIndex = tracks.findIndex((track) => track.title.toLowerCase().includes('english'));
  if (englishIndex !== -1) return englishIndex;

  const defaultIndex = tracks.findIndex((track) => track.isDefault);
  return defaultIndex !== -1 ? defaultIndex : tracks.length > 0 ? 0 : null;
};
