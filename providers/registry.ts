import { StreamingProvider, ProviderName } from './types';
import { AnimeKaiProvider } from './animekai';
import { AnimePaheProvider } from './animepahe';
import { AnikotoProvider } from './anikoto';

const providers: Record<ProviderName, StreamingProvider> = {
  animekai: new AnimeKaiProvider(),
  animepahe: new AnimePaheProvider(),
  anikoto: new AnikotoProvider(),
};

export function getProvider(name: ProviderName): StreamingProvider {
  const p = providers[name];
  if (!p) throw new Error(`Provider ${name} not found`);
  return p;
}

export function getAllProviders(): StreamingProvider[] {
  return Object.values(providers);
}

export function getProviderNames(): ProviderName[] {
  return Object.keys(providers) as ProviderName[];
}

export { ProviderName, StreamingProvider };
export type { ProviderSearchResult, ProviderEpisode, ProviderStreamSource } from './types';
