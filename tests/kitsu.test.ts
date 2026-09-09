/**
 * Kitsu API integration tests — Detective Conan / Case Closed
 *
 * All requests run sequentially with a 1-second pause between each one.
 * No mocks. No global state. Each test fetches what it needs and asserts.
 */

import {
  resolveKitsuAnimeIdFromMal,
  fetchKitsuEpisodeImagePage,
  fetchKitsuEpisodeDetails,
} from '../services/AniListService';
import {
  fetchKitsuHomePage,
  fetchKitsuSearch,
  fetchKitsuAnimeById,
  fetchKitsuAnimeExtras,
  fetchKitsuAnimeCastPage,
  fetchKitsuCastPerson,
  fetchKitsuSubbed,
  fetchKitsuDubbed,
  fetchKitsuSubbedPage,
  fetchKitsuDubbedPage,
  fetchKitsuBrowse,
} from '../services/KitsuService';

// Detective Conan / Case Closed
const ANILIST_ID = '235';
const MAL_ID = 235;
const KITSU_ID = '210';
const CHARACTER_ID = '4370'; // Conan Edogawa on Kitsu

const wait = () => new Promise((r) => setTimeout(r, 1000));

// ---------------------------------------------------------------------------

test('1. Kitsu home page has all sections', async () => {
  const result = await fetchKitsuHomePage();
  expect(result.data.spotlight.length).toBeGreaterThan(0);
  expect(result.data.recentUpdates.length).toBeGreaterThan(0);
  expect(Array.isArray(result.data.upcoming)).toBe(true);
  expect(Array.isArray(result.data.topTables.newReleases)).toBe(true);
  expect(Array.isArray(result.data.topTables.newlyAdded)).toBe(true);
  expect(Array.isArray(result.data.topTables.justCompleted)).toBe(true);
  await wait();
});

test('2. Kitsu search finds Detective Conan', async () => {
  const result = await fetchKitsuSearch({ q: 'Detective Conan', page: 1 });
  expect(result.results.length).toBeGreaterThan(0);
  expect(result.pagination.currentPage).toBe(1);
  expect(result.results.some((a) => a.title.toLowerCase().includes('conan'))).toBe(true);
  await wait();
});

test('3. Kitsu anime details by AniList ID mapping (235)', async () => {
  const result = await fetchKitsuAnimeById(ANILIST_ID, true);
  expect(result.id).toBe(KITSU_ID);
  expect(result.title).toContain('Conan');
  expect(result.synopsis.length).toBeGreaterThan(0);
  expect(result.genres.length).toBeGreaterThan(0);
  await wait();
});

test('4. Kitsu anime details by Kitsu ID (210)', async () => {
  const result = await fetchKitsuAnimeById(KITSU_ID);
  expect(result.id).toBe(KITSU_ID);
  expect(result.title).toContain('Conan');
  await wait();
});

test('5. Kitsu anime extras — cast and recommendations', async () => {
  const result = await fetchKitsuAnimeExtras(KITSU_ID);
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

test('6. Kitsu cast page is paginated', async () => {
  const result = await fetchKitsuAnimeCastPage(KITSU_ID, 1, 10);
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

test('7. Kitsu character profile — Conan Edogawa', async () => {
  const result = await fetchKitsuCastPerson('character', CHARACTER_ID);
  expect(result.id).toBe(CHARACTER_ID);
  expect(result.kind).toBe('character');
  expect(typeof result.name).toBe('string');
  expect(Array.isArray(result.works)).toBe(true);
  await wait();
});

test('8. Kitsu subbed anime list', async () => {
  const result = await fetchKitsuSubbed();
  expect(result.length).toBeGreaterThan(0);
  expect(typeof result[0].title).toBe('string');
  expect(typeof result[0].slug).toBe('string');
  await wait();
});

test('9. Kitsu dubbed anime list', async () => {
  const result = await fetchKitsuDubbed();
  expect(result.length).toBeGreaterThan(0);
  expect(typeof result[0].title).toBe('string');
  expect(typeof result[0].slug).toBe('string');
  await wait();
});

test('10. Kitsu browse trending', async () => {
  const result = await fetchKitsuBrowse('trending', 1, 10);
  expect(result.results.length).toBeGreaterThan(0);
  expect(result.pagination.currentPage).toBe(1);
  await wait();
});

test('11. Kitsu MAL→ID mapping', async () => {
  const result = await resolveKitsuAnimeIdFromMal(MAL_ID);
  expect(result).toBe(KITSU_ID);
  await wait();
});

test('12. Kitsu episode image page', async () => {
  const result = await fetchKitsuEpisodeImagePage(KITSU_ID, 0);
  expect(result.images.length).toBeGreaterThan(0);
  for (const img of result.images.slice(0, 3)) {
    expect(img.number).toBeGreaterThan(0);
    expect(typeof img.title).toBe('string');
  }
  await wait();
});

test('13. Kitsu episode 1 details', async () => {
  const result = await fetchKitsuEpisodeDetails(KITSU_ID, '1');
  expect(result).not.toBeNull();
  expect(result!.number).toBe(1);
  expect(typeof result!.title).toBe('string');
  await wait();
});

test('14. fetchKitsuSubbedPage — page 1 returns paginated results', async () => {
  const result = await fetchKitsuSubbedPage(1, 12);
  expect(result.results.length).toBeGreaterThan(0);
  expect(result.pagination.currentPage).toBe(1);
  expect(typeof result.pagination.hasNextPage).toBe('boolean');
  for (const anime of result.results.slice(0, 3)) {
    expect(typeof anime.title).toBe('string');
    expect(typeof anime.slug).toBe('string');
    expect(typeof anime.image).toBe('string');
    expect(Array.isArray(anime.genres)).toBe(true);
  }
  await wait();
});

test('15. fetchKitsuDubbedPage — page 1 returns paginated results', async () => {
  const result = await fetchKitsuDubbedPage(1, 12);
  expect(result.results.length).toBeGreaterThan(0);
  expect(result.pagination.currentPage).toBe(1);
  expect(typeof result.pagination.hasNextPage).toBe('boolean');
  for (const anime of result.results.slice(0, 3)) {
    expect(typeof anime.title).toBe('string');
    expect(typeof anime.slug).toBe('string');
    expect(typeof anime.image).toBe('string');
    expect(Array.isArray(anime.genres)).toBe(true);
  }
  await wait();
});

test('16. full flow: home → search → details → cast', async () => {
  // Home
  const home = await fetchKitsuHomePage();
  expect(home.data.spotlight.length).toBeGreaterThan(0);
  await wait();

  // Search
  const search = await fetchKitsuSearch({ q: 'Detective Conan', page: 1 });
  expect(search.results.some((a) => a.title.toLowerCase().includes('conan'))).toBe(true);
  await wait();

  // Details
  const details = await fetchKitsuAnimeById(KITSU_ID);
  expect(details.id).toBe(KITSU_ID);
  expect(details.title).toContain('Conan');
  await wait();

  // Extras (cast)
  const extras = await fetchKitsuAnimeExtras(KITSU_ID);
  expect(extras.cast.length).toBeGreaterThan(0);
  await wait();

  // Cast page
  const castPage = await fetchKitsuAnimeCastPage(KITSU_ID, 1, 5);
  expect(castPage.cast.length).toBeGreaterThan(0);
});
