/**
 * The signed-in customer's record on House of Mina's POS (pos.houseofmina.store,
 * /api/public/me — the same route taheri.shop's accounts use, served by Mina's POS with its
 * own Firebase project and CORS for this site). It holds their details and their saved pieces,
 * so the heart follows them to every device.
 *
 * The POS keeps saved pieces as keys of three parts (Category/Collection/file on taheri.shop);
 * here a piece is `mina/piece/<handle>`, which that check accepts, so the POS needs no change.
 * On sign-in this browser's list and the account's are merged both ways once; after that every
 * change is saved a beat after the last tap. Signed out, saved pieces stay in this browser.
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { idToken, useUser } from './auth.js';
import { useFavourites, getFavourites, setFavourites } from './store.js';

export const POS_API = (import.meta.env?.VITE_POS_API || 'https://pos.houseofmina.store').replace(/\/+$/, '');

const toKey = (h) => `mina/piece/${h}`;
const toHandle = (k) => (typeof k === 'string' && k.startsWith('mina/piece/') ? k.slice('mina/piece/'.length) : null);

let record = null;      // { uid, email, displayName, photoURL, profile, favourites, orders } | null
let loadedFor = null;   // the uid the record belongs to
const listeners = new Set();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const get = () => record;

export function useAccount() { return useSyncExternalStore(subscribe, get, () => null); }

async function headers() {
  const t = await idToken();
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : null;
}

/** Fetch the record for the signed-in user; resolves to it, or null when signed out. */
export async function loadAccount(uid) {
  const h = await headers();
  if (!h) { record = null; loadedFor = null; notify(); return null; }
  try {
    const res = await fetch(`${POS_API}/api/public/me`, { headers: h });
    if (!res.ok) throw new Error(String(res.status));
    record = await res.json(); loadedFor = uid; notify();
    return record;
  } catch {
    return record;
  }
}

/** Save part of the record ({ profile } or { favourites }); resolves to the refreshed record. */
export async function saveAccount(patch) {
  const h = await headers();
  if (!h) return null;
  const res = await fetch(`${POS_API}/api/public/me`, { method: 'PUT', headers: h, body: JSON.stringify(patch) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not save.');
  record = data; notify();
  return record;
}

export function forgetAccount() { record = null; loadedFor = null; notify(); }

/** Saved pieces follow the account: App calls this once. */
export function useAccountSync() {
  const user = useUser();
  const account = useAccount();
  const fav = useFavourites();
  const merged = useRef(null);      // the uid whose lists were merged
  const lastSaved = useRef('');

  useEffect(() => {
    if (user === undefined) return;
    if (!user) { merged.current = null; forgetAccount(); return; }
    if (loadedFor !== user.uid) loadAccount(user.uid);
  }, [user]);

  // Once per sign-in: the union of both lists, here and there.
  useEffect(() => {
    if (!user || !account || account.uid !== user.uid || merged.current === user.uid) return;
    merged.current = user.uid;
    const remote = (account.favourites || []).map(toHandle).filter(Boolean);
    const local = getFavourites();
    const union = [...local, ...remote.filter((h) => !local.includes(h))];
    if (union.length !== local.length) setFavourites(union);
    const keys = union.map(toKey);
    lastSaved.current = JSON.stringify(keys);
    const theirs = account.favourites || [];
    if (keys.length !== theirs.length || keys.some((k, i) => k !== theirs[i])) saveAccount({ favourites: keys }).catch(() => {});
  }, [user, account]);

  // After that, every change, a beat after the last tap.
  useEffect(() => {
    if (!user || merged.current !== user.uid) return undefined;
    const keys = fav.list.map(toKey);
    if (JSON.stringify(keys) === lastSaved.current) return undefined;
    const t = setTimeout(() => { lastSaved.current = JSON.stringify(keys); saveAccount({ favourites: keys }).catch(() => {}); }, 800);
    return () => clearTimeout(t);
  }, [fav.list, user]);
}
