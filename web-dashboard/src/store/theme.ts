// Light/dark theme persisted to localStorage, applied via a data attribute.
import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'wli-theme';

function initialTheme(): ThemeMode {
  const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

interface ThemeState {
  mode: ThemeMode;
  toggle: () => void;
  set: (m: ThemeMode) => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  mode: initialTheme(),
  toggle: () => get().set(get().mode === 'dark' ? 'light' : 'dark'),
  set: (mode) => {
    localStorage.setItem(STORAGE_KEY, mode);
    document.documentElement.setAttribute('data-theme', mode);
    set({ mode });
  },
}));

/** Apply the persisted theme to <html> on first load. */
export function applyInitialTheme(): void {
  document.documentElement.setAttribute('data-theme', useTheme.getState().mode);
}
