// =====================================================================
//  Préférence de thème (Mode Sombre / Mode Clair), persistée en localStorage
//  et appliquée via l'attribut [data-theme] sur <html> (voir index.css).
//  L'application initiale (anti-flash) se fait dans index.html <head>.
// =====================================================================
import { useCallback, useState } from 'react';

export type Theme = 'dark' | 'light';
const KEY = 'kkcoil.theme';

function readTheme(): Theme {
  return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem(KEY, theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readTheme);
  const setTheme = useCallback((t: Theme) => {
    applyTheme(t);
    setThemeState(t);
  }, []);
  return { theme, setTheme };
}
