import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ApiProvider = 'anilist' | 'kitsu';

interface SettingsState {
  provider: ApiProvider;
  setProvider: (provider: ApiProvider) => void;
  switchToKitsu: () => void;
  switchToAniList: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      provider: 'anilist',
      setProvider: (provider) => set({ provider }),
      switchToKitsu: () => set({ provider: 'kitsu' }),
      switchToAniList: () => set({ provider: 'anilist' }),
    }),
    {
      name: 'daichi-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
