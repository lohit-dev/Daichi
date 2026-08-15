import { USER_AGENT } from '../animepahe/utils';

export class MegaUp {
  private static apiBase = 'https://enc-dec.app/api';

  static async generateToken(n: string): Promise<string> {
    try {
      const res = await fetch(`${this.apiBase}/enc-kai?text=${encodeURIComponent(n)}`);
      const data = await res.json();
      return data.result;
    } catch (error: any) {
      throw new Error(error.message, { cause: error });
    }
  }

  static async decodeIframeData(n: string): Promise<{
    url: string;
    skip: {
      intro: [number, number];
      outro: [number, number];
    };
  }> {
    try {
      const res = await fetch(`${this.apiBase}/dec-kai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: n }),
      });
      const data = await res.json();
      return data.result;
    } catch (error: any) {
      throw new Error(error.message, { cause: error });
    }
  }

  static async decode(n: string): Promise<{
    sources: { file: string }[];
    tracks: { kind: string; file: string; label: string }[];
    download: string;
  }> {
    try {
      const res = await fetch(`${this.apiBase}/dec-mega`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: n,
          agent: USER_AGENT,
        }),
      });
      const data = await res.json();
      return data.result;
    } catch (error: any) {
      throw new Error(error.message, { cause: error });
    }
  }

  static async extract(videoUrl: string): Promise<any> {
    try {
      const url = videoUrl.replace('/e/', '/media/');
      const res = await fetch(url, {
        headers: {
          Connection: 'keep-alive',
          'User-Agent': USER_AGENT,
        },
      });
      const data = await res.json();
      const decrypted = await this.decode(data.result);

      return {
        sources: decrypted.sources.map((s: any) => ({
          url: s.file,
          isM3U8: s.file.includes('.m3u8') || s.file.endsWith('m3u8'),
        })),
        subtitles: decrypted.tracks.map((t: any) => ({
          kind: t.kind,
          url: t.file,
          lang: t.label,
        })),
        download: decrypted.download,
      };
    } catch (error: any) {
      throw new Error(error.message, { cause: error });
    }
  }
}
