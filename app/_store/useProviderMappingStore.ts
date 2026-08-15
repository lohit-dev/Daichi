import { create } from 'zustand';

interface Mapping {
  providerAnimeId: string;
  title: string;
  searchedAt: number;
}

interface ProviderMappingState {
  activeProvider: 'animekai' | 'animepahe' | 'anikoto';
  mappings: Record<string, Mapping>;
  setActiveProvider: (name: 'animekai' | 'animepahe' | 'anikoto') => void;
  setMapping: (animeId: string, mapping: Mapping) => void;
  getMapping: (animeId: string) => Mapping | undefined;
  clearMappings: () => void;
}

export const useProviderMappingStore = create<ProviderMappingState>((set, get) => ({
  activeProvider: 'anikoto',
  mappings: {},
  setActiveProvider: (name) => set({ activeProvider: name }),
  setMapping: (animeId, mapping) =>
    set((state) => ({
      mappings: { ...state.mappings, [animeId]: mapping },
    })),
  getMapping: (animeId) => get().mappings[animeId],
  clearMappings: () => set({ mappings: {} }),
}));
