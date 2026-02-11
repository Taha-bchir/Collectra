import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { getPreferencesStorageKey, getDefaultTheme } from '@/config/env'

type Theme = 'light' | 'dark' | 'system'

interface PreferencesState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = getPreferencesStorageKey()
const DEFAULT_THEME = getDefaultTheme()

const storage =
  typeof window !== 'undefined'
    ? createJSONStorage<Pick<PreferencesState, 'theme'>>(() => localStorage)
    : undefined

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: STORAGE_KEY,
      storage,
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
)
