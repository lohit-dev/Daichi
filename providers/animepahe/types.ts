export interface AnimePaheSearchItem {
  id: string;
  title: string;
  type: string;
  episodes: number;
  status: string;
  year: number;
  score: number;
  poster: string;
  session: string;
}

export interface AnimePaheAiringItem {
  id: string;
  title: string;
  episode: number;
  snapshot: string;
  session: string;
  fansub: string;
  created_at: string;
}

export interface AnimePaheEpisode {
  id: number;
  anime_id: number;
  episode: number;
  episode2: number;
  edition: string;
  title: string;
  snapshot: string;
  disc: string;
  audio: string;
  duration: string;
  session: string;
  filler: number;
  created_at: string;
}

export interface AnimePaheMeta {
  id: string;
  name: string;
  description: string;
  poster: string | null;
  background: string | null;
  aired: string;
  duration: string;
  genres: string[];
  externalLinks: string[];
}

export interface AnimePaheStreamResult {
  id: string;
  title: string;
  url: string;
  directUrl?: string | null;
  quality: string;
  audio: string;
  type?: string;
  downloadUrl?: string | null;
  corsHeaders?: Record<string, string>;
  animeName?: string;
}
