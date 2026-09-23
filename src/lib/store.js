/**
 * What this browser remembers: favourites, the theme, pieces lately looked at.
 *
 * All of it is a convenience for the person holding the phone — per device, in
 * localStorage, never a record anyone else relies on. A blocked or private
 * store simply means nothing is remembered; every read and write is guarded.
 */

import { useSyncExternalStore } from 'react';

const read = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
};
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not remembered, still works */ } };

function createStore(key, fallback) {
  let value = typeof window === 'undefined' ? fallback : read(key, fallback);
  const listeners = new Set();
  const store = {
    get: () => value,
    set(next) {
      value = typeof next === 'function' ? next(value) : next;
      write(key, value);
      listeners.forEach((l) => l());
    },
    subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  };
  // Another tab changed it: follow.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== key) return;
      value = read(key, fallback);
      listeners.forEach((l) => l());
    });
  }
  return store;
}

const favourites = createStore('mina:favourites', []);
const recent = createStore('mina:recent', []);

export function useFavourites() {
  const list = useSyncExternalStore(favourites.subscribe, favourites.get, () => []);
  return {
    list,
    has: (h) => list.includes(h),
    toggle: (h) => favourites.set((xs) => (xs.includes(h) ? xs.filter((x) => x !== h) : [h, ...xs])),
    clear: () => favourites.set([]),
  };
}

export function useRecent() {
  return useSyncExternalStore(recent.subscribe, recent.get, () => []);
}
export const noteViewed = (h) => recent.set((xs) => [h, ...xs.filter((x) => x !== h)].slice(0, 12));

// ── Theme ───────────────────────────────────────────────────────────────────
const theme = createStore('mina:theme', 'light');
export function useTheme() {
  const t = useSyncExternalStore(theme.subscribe, theme.get, () => 'light');
  return [t, () => {
    const next = t === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    theme.set(next);
  }];
}
