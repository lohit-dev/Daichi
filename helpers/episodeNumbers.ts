/**
 * Canonical key for episode matching across Anikoto, Kitsu, and AniList.
 *
 * `1`, `01`, and `1.0` represent the same episode, while `1.5` remains a
 * distinct special episode. Never round here: rounding made Kitsu's 1.5
 * thumbnail incorrectly replace episode 2.
 */
export const getEpisodeNumberKey = (value: string | number | null | undefined): string | null => {
  if (value === null || value === undefined || `${value}`.trim() === '') return null;

  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;

  return String(number);
};
