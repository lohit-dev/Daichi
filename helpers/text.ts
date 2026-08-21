export const formatIdToTitle = (id: string | null | undefined): string => {
  if (!id) return '';
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
