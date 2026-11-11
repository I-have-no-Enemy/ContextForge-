import { useCallback, useState } from 'react';

export type Theme = 'dark' | 'light';
const KEY = 'cf-theme';

/** Current theme, as set on <html data-theme> by the inline script in index.html. */
const current = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current);
  const toggle = useCallback(() => {
    const next: Theme = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode: the choice lasts for this page only */
    }
    setTheme(next);
  }, []);
  return { theme, toggle };
}
