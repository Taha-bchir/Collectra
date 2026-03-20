import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface PreferencesState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = process.env.NEXT_PUBLIC_APP_PREFERENCES_STORAGE_KEY!
const DEFAULT_THEME = process.env.NEXT_PUBLIC_DEFAULT_THEME as Theme

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
