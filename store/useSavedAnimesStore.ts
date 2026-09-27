import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { Anime } from '~/types';

interface SavedAnimesState {
  animes: Anime[];
  addAnime: (anime: Anime) => void;
  removeAnime: (slug: string) => void;
  clearLibrary: () => void;
}

export const useSavedAnimesStore = create<SavedAnimesState>()(
  persist(
    (set, get) => ({
      animes: [],
      addAnime: (anime) => {
        const exists = get().animes.some((a) => a.slug === anime.slug);
        if (!exists) {
          set({ animes: [...get().animes, anime] });
        }
      },
      removeAnime: (slug) => {
        set({ animes: get().animes.filter((a) => a.slug !== slug) });
      },
      clearLibrary: () => {
        set({ animes: [] });
      },
    }),
    {
      name: 'saved-animes-storage', // unique name
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
