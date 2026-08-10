import { Dimensions } from 'react-native';

const { width: deviceWidth, height: deviceHeight } = Dimensions.get('window');

export const hp = (percentage: number) => {
  return (percentage * deviceHeight) / 100;
};

export const wp = (percentage: number) => {
  return (percentage * deviceWidth) / 100;
};

export const formatTime = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0:00';
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${m}:${pad(s)}`;
};

export const formatIdToTitle = (id: string | null | undefined): string => {
  if (!id) return '';
  // Replaces hyphens and underscores with spaces, then capitalizes each word
  return id.replace(/[-_]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
};

export const cleanHtml = (value: string | null | undefined): string => {
  return (value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
