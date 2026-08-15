export interface AnimeKaiSearchItem {
  id: string;
  title: string;
  url: string;
  image?: string;
  japaneseTitle?: string;
  type?: string;
  sub: number;
  dub: number;
  episodes: number;
}

export interface AnimeKaiPagedResult<T> {
  currentPage: number;
  hasNextPage: boolean;
  totalPages: number;
  results: T[];
}

export interface AnimeKaiEpisode {
  id: string;
  number: string;
  title: string;
  image?: string;
  japaneseTitle?: string;
}

export interface AnimeKaiServer {
  name: string;
  dataId: string;
}

export interface AnimeKaiInfo {
  id: string;
  title: string;
  japaneseTitle?: string;
  image?: string;
  banner?: string;
  description?: string;
  type?: string;
  quality?: string;
  duration?: string;
  premiered?: string;
  aired?: string;
  status?: string;
  score?: string;
  genres: string[];
  studios: string[];
  producers: string[];
  sub: number;
  dub: number;
  episodes: AnimeKaiEpisode[];
}
