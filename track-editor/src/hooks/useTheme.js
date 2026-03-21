import { useState, useEffect } from 'react';

const STORAGE_KEY = 'track-editor-theme';

function readTheme() {
  try { return localStorage.getItem(STORAGE_KEY) || 'dark'; } catch { return 'dark'; }
}
function writeTheme(t) {
  try { localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
}

export function useTheme() {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeTheme(theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return { theme, toggle };
}
