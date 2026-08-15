export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export const DDOS_GUARD_HEADERS: Record<string, string> = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  DNT: '1',
  Connection: 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Sec-GPC': '1',
  Priority: 'u=0, i',
};

export function substringBefore(str: string, separator: string): string {
  const idx = str.indexOf(separator);
  return idx === -1 ? str : str.substring(0, idx);
}

export function substringAfter(str: string, separator: string): string {
  const idx = str.indexOf(separator);
  return idx === -1 ? '' : str.substring(idx + separator.length);
}

export function substringAfterLast(str: string, separator: string): string {
  const idx = str.lastIndexOf(separator);
  return idx === -1 ? '' : str.substring(idx + separator.length);
}

export function getMapValue(map: Record<string, string>, key: string): string | undefined {
  for (const [k, v] of Object.entries(map)) {
    if (k.toLowerCase() === key.toLowerCase()) return v;
  }
  return undefined;
}
