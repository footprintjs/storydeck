'use client';
import { useEffect, useState, useCallback } from 'react';

// Headless theming: read/set/persist the light|dark choice. storydeck owns the mechanism (flip an
// html class + persist), the CONSUMER owns what light/dark mean (their token values). A consumer
// can use this hook with their own toggle UI, or use the default <ThemeToggle>.
// Pair with this inline script in <head> to avoid a flash (dark default here):
//   (function(){try{var t=localStorage.getItem('theme');if(t!=='light')t='dark';
//    document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})();
export function useTheme() {
  const [theme, setThemeState] = useState('dark');

  useEffect(() => {
    setThemeState(document.documentElement.classList.contains('light') ? 'light' : 'dark');
  }, []);

  const setTheme = useCallback((next) => {
    const el = document.documentElement;
    el.classList.remove('light', 'dark');
    el.classList.add(next);
    try { localStorage.setItem('theme', next); } catch (_) {}
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      const el = document.documentElement;
      el.classList.remove('light', 'dark');
      el.classList.add(next);
      try { localStorage.setItem('theme', next); } catch (_) {}
      return next;
    });
  }, []);

  return { theme, setTheme, toggle };
}
