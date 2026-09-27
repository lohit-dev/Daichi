import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type HistoryItem = {
  animeId: string;
  animeSlug?: string;
  animeTitle: string;
  animeImage: string;
  episodeId: string;
  episodeNumber: string;
  episodeTitle?: string;
  episodeDescription?: string;
  episodeThumbnail?: string;
  progress: number;
  duration: number;
  timestamp: number;
};

interface HistoryState {
  history: Record<string, HistoryItem>;
  saveProgress: (item: Omit<HistoryItem, 'timestamp'>) => void;
  removeHistory: (animeId: string) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      history: {},
      saveProgress: (item) => {
        const { history } = get();
        set({
          history: {
            ...history,
            [item.animeId]: {
              ...item,
              timestamp: Date.now(),
            },
          },
        });
      },
      removeHistory: (animeId) => {
        const { history } = get();
        const newHistory = { ...history };
        delete newHistory[animeId];
        set({ history: newHistory });
      },
      clearHistory: () => {
        set({ history: {} });
      },
    }),
    {
      name: 'anime-history-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
