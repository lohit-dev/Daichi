/**
 * API integration tests — Detective Conan / Case Closed
 *
 * All requests run sequentially with a 1-second pause between each one.
 * No mocks. No global state. Each test fetches what it needs and asserts.
 */

import {
  fetchAniListHomePage,
  fetchAniListSearch,
  fetchAniListAnimeById,
  fetchAniListAnimeExtras,
  fetchAniListAnimeCastPage,
  fetchAniListCastPerson,
  fetchAniListSubbed,
  fetchAniListDubbed,
  fetchAniListBrowse,
  fetchAniListStreamingEpisodeImages,
  fetchAniListEpisodeDiscussion,
  resolveKitsuAnimeIdFromMal,
  fetchKitsuEpisodeImagePage,
  fetchKitsuEpisodeDetails,
} from '../services/AniListService';
import { fetchAnimeEpisode, fetchAnimeStreamingLink } from '../services/AnimeService';

// Detective Conan / Case Closed
const ANILIST_ID = '235';
const MAL_ID = 235;
const KITSU_ID = '210';
const CHARACTER_ID = '1742'; // Conan Edogawa
const STAFF_ID = '95024'; // Minami Takayama (VA)

const wait = () => new Promise((r) => setTimeout(r, 1000));

// ---------------------------------------------------------------------------

test('1. home page has all sections', async () => {
  const result = await fetchAniListHomePage();
  expect(result.data.spotlight.length).toBeGreaterThan(0);
  expect(result.data.recentUpdates.length).toBeGreaterThan(0);
  expect(Array.isArray(result.data.upcoming)).toBe(true);
  expect(Array.isArray(result.data.topTables.newReleases)).toBe(true);
  expect(Array.isArray(result.data.topTables.newlyAdded)).toBe(true);
  expect(Array.isArray(result.data.topTables.justCompleted)).toBe(true);
  await wait();
});

test('2. search finds Detective Conan', async () => {
  const result = await fetchAniListSearch({ q: 'Detective Conan', page: 1 });
  expect(result.results.length).toBeGreaterThan(0);
  expect(result.pagination.currentPage).toBe(1);
  expect(result.results.some((a) => a.title.toLowerCase().includes('conan'))).toBe(true);
  await wait();
});

test('3. anime details for Detective Conan', async () => {
  const result = await fetchAniListAnimeById(ANILIST_ID);
  expect(result.id).toBe(ANILIST_ID);
  expect(result.aniListId).toBe(Number(ANILIST_ID));
  expect(result.malId).toBe(MAL_ID);
  expect(result.title).toContain('Conan');
  expect(result.synopsis.length).toBeGreaterThan(0);
  expect(result.genres.length).toBeGreaterThan(0);
  await wait();
});

test('4. anime extras — studios, cast, recommendations', async () => {
  const result = await fetchAniListAnimeExtras(ANILIST_ID);
  expect(Array.isArray(result.studios)).toBe(true);
  expect(result.cast.length).toBeGreaterThan(0);
  expect(result.cast[0]).toMatchObject({
    id: expect.any(String),
    name: expect.any(String),
    role: expect.any(String),
  });
  expect(Array.isArray(result.recommendations)).toBe(true);
  await wait();
});

test('5. cast page is paginated', async () => {
  const result = await fetchAniListAnimeCastPage(ANILIST_ID, 1, 10);
  expect(result.cast.length).toBeGreaterThan(0);
  expect(result.currentPage).toBe(1);
  expect(typeof result.hasNextPage).toBe('boolean');
  for (const m of result.cast.slice(0, 3)) {
    expect(typeof m.id).toBe('string');
    expect(typeof m.name).toBe('string');
    expect(typeof m.role).toBe('string');
  }
  await wait();
});

test('6. character profile — Conan Edogawa', async () => {
  const result = await fetchAniListCastPerson('character', CHARACTER_ID);
  expect(result.id).toBe(CHARACTER_ID);
  expect(result.kind).toBe('character');
  expect(typeof result.name).toBe('string');
  expect(Array.isArray(result.works)).toBe(true);
  expect(result.works.length).toBeGreaterThan(0);
  await wait();
});

test('7. staff profile — Minami Takayama', async () => {
  const result = await fetchAniListCastPerson('staff', STAFF_ID);
  expect(result.id).toBe(STAFF_ID);
  expect(result.kind).toBe('staff');
  expect(typeof result.name).toBe('string');
  expect(Array.isArray(result.works)).toBe(true);
  expect(result.works.length).toBeGreaterThan(0);
  await wait();
});

test('8. subbed anime list', async () => {
  const result = await fetchAniListSubbed();
  expect(result.length).toBeGreaterThan(0);
  expect(typeof result[0].title).toBe('string');
  expect(typeof result[0].slug).toBe('string');
  await wait();
});

test('9. dubbed anime list', async () => {
  const result = await fetchAniListDubbed();
  expect(result.length).toBeGreaterThan(0);
  expect(typeof result[0].title).toBe('string');
  expect(typeof result[0].slug).toBe('string');
  await wait();
});

test('10. browse trending', async () => {
  const result = await fetchAniListBrowse('trending', 1, 10);
  expect(result.results.length).toBeGreaterThan(0);
  expect(result.pagination.currentPage).toBe(1);
  await wait();
});

test('11. streaming episode images', async () => {
  const result = await fetchAniListStreamingEpisodeImages(ANILIST_ID);
  expect(Array.isArray(result)).toBe(true);
  // Conan may or may not have streaming images — just check the shape
  for (const img of result.slice(0, 3)) {
    expect(img.number).toBeGreaterThanOrEqual(0);
    expect(typeof img.title).toBe('string');
    expect(typeof img.thumbnail).toBe('string');
  }
  await wait();
});

test('12. episode discussion threads', async () => {
  const result = await fetchAniListEpisodeDiscussion(
    ANILIST_ID,
    '1',
    'The Roller Coaster Murder Case'
  );
  expect(Array.isArray(result.episodeThreads)).toBe(true);
  expect(Array.isArray(result.communityThreads)).toBe(true);
  expect(result.episodeThreads.length).toBeLessThanOrEqual(3);
  expect(result.communityThreads.length).toBeLessThanOrEqual(3);
  await wait();
});

test('13. Kitsu MAL→ID mapping', async () => {
  const result = await resolveKitsuAnimeIdFromMal(MAL_ID);
  expect(result).toBe(KITSU_ID);
  await wait();
});

test('14. Kitsu episode image page', async () => {
  const result = await fetchKitsuEpisodeImagePage(KITSU_ID, 0);
  expect(result.images.length).toBeGreaterThan(0);
  for (const img of result.images.slice(0, 3)) {
    expect(img.number).toBeGreaterThan(0);
    expect(typeof img.title).toBe('string');
  }
  await wait();
});

test('15. Kitsu episode 1 details', async () => {
  const result = await fetchKitsuEpisodeDetails(KITSU_ID, '1');
  expect(result).not.toBeNull();
  expect(result!.number).toBe(1);
  expect(typeof result!.title).toBe('string');
  await wait();
});

test('16. Anikoto — episode list for Detective Conan', async () => {
  const result = await fetchAnimeEpisode(ANILIST_ID);
  expect(result.length).toBeGreaterThan(0);
  expect(typeof result[0].id).toBe('string');
  expect(typeof result[0].episode).toBe('string');
  expect(typeof result[0].title).toBe('string');
  expect(result[0].url).toMatch(/^https:\/\//);
  await wait();
});

// ---------------------------------------------------------------------------
// Main flow: home → search Conan → details → extras → episodes → stream ep 1
// ---------------------------------------------------------------------------

test('full flow: home → search → details → cast → episodes → stream', async () => {
  // Home
  const home = await fetchAniListHomePage();
  expect(home.data.spotlight.length).toBeGreaterThan(0);
  await wait();

  // Search
  const search = await fetchAniListSearch({ q: 'Case Closed', page: 1 });
  expect(search.results.some((a) => a.title.toLowerCase().includes('conan'))).toBe(true);
  await wait();

  // Details
  const details = await fetchAniListAnimeById(ANILIST_ID);
  expect(details.id).toBe(ANILIST_ID);
  expect(details.title).toContain('Conan');
  await wait();

  // Extras (studios + cast)
  const extras = await fetchAniListAnimeExtras(ANILIST_ID);
  expect(extras.cast.length).toBeGreaterThan(0);
  await wait();

  // Cast page
  const castPage = await fetchAniListAnimeCastPage(ANILIST_ID, 1, 5);
  expect(castPage.cast.length).toBeGreaterThan(0);
  await wait();

  // Episode list
  const episodes = await fetchAnimeEpisode(ANILIST_ID);
  expect(episodes.length).toBeGreaterThan(0);
  await wait();

  // Stream episode 1
  const ep1 = episodes.find((e) => e.episode === '1');
  expect(ep1).toBeDefined();
  const stream = await fetchAnimeStreamingLink(ANILIST_ID, ep1!.episode);
  expect(stream.success).toBe(true);
  expect(stream.data.servers.length).toBeGreaterThan(0);
  expect(stream.data.totalServers).toBe(stream.data.servers.length);
  expect(stream.data.servers.some((s) => s.type === 'sub')).toBe(true);
});
