import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

function initial(): ThemeMode {
  try {
    const stocke = localStorage.getItem('theme');
    if (stocke === 'light' || stocke === 'dark') return stocke;
  } catch { /* stockage indisponible */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function appliquer(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#062316' : '#008840');
}

interface ThemeState {
  mode: ThemeMode;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const mode = initial();
  appliquer(mode);
  return {
    mode,
    toggle: () => {
      const suivant: ThemeMode = get().mode === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', suivant); } catch { /* ignoré */ }
      appliquer(suivant);
      set({ mode: suivant });
    },
  };
});
