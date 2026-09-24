/**
 * Who is signed in — a Google account, through House of Mina's POS's own Firebase project
 * (hom-pos). Accounts are the owner's ask of 2026-09-25 ("like taheri.shop"), built the way
 * taheri.shop's are (taheri-site/src/lib/auth.js): a customer is a user in that pool with no
 * role in the book; the POS verifies their token and answers only for their own record.
 *
 * Firebase is not on the path to first paint. It loads the first time someone presses Sign in,
 * or on startup only when this browser has signed in before (a flag left on sign-in), so the
 * many who only browse never fetch it. catalogue.houseofmina.store is an authorised domain of
 * the project (added 2026-09-25, Identity Toolkit config).
 */

import { useSyncExternalStore } from 'react';

// Public web config of hom-pos (the POS's own, apphosting.mina.yaml); not a secret.
const CONFIG = {
  apiKey: 'AIzaSyBJsDVAI_b7RvnSf-cpnSNLXQ-R0OH0qU4',
  authDomain: 'hom-pos-52710474-ceeea.firebaseapp.com',
  projectId: 'hom-pos-52710474-ceeea',
  appId: '1:288366939838:web:044c8eec0a5610688798ef',
};
const HINT = 'mina:signed-in';

let user;               // undefined until known, null when nobody, else { uid, name, email, photo }
let loading = null;     // the Firebase load, once started
let authInstance = null;
let authModule = null;
const listeners = new Set();
const notify = () => listeners.forEach((l) => l());
const shape = (u) => (u ? { uid: u.uid, name: u.displayName || '', email: u.email || '', photo: u.photoURL || '' } : null);

function load() {
  if (loading) return loading;
  loading = Promise.all([import('firebase/app'), import('firebase/auth')]).then(([app, auth]) => {
    const a = app.getApps().length ? app.getApp() : app.initializeApp(CONFIG);
    authInstance = auth.getAuth(a);
    authModule = auth;
    auth.onAuthStateChanged(authInstance, (u) => {
      user = shape(u);
      try { if (u) localStorage.setItem(HINT, '1'); else localStorage.removeItem(HINT); } catch { /* fine */ }
      notify();
    });
    // A redirect sign-in (the popup fallback) lands back here with its result.
    auth.getRedirectResult(authInstance).catch(() => {});
    return authInstance;
  }).catch(() => {
    user = null; notify();
    return null;
  });
  return loading;
}

let hinted = false;
const subscribe = (l) => {
  listeners.add(l);
  if (!hinted) {
    hinted = true;
    let seen = false;
    try { seen = localStorage.getItem(HINT) === '1'; } catch { /* fine */ }
    if (seen) load(); else { user = null; }
  }
  return () => listeners.delete(l);
};
const get = () => user;

/** The signed-in customer, null when nobody, undefined while a saved session restores. */
export function useUser() {
  return useSyncExternalStore(subscribe, get, () => undefined);
}

export async function signIn() {
  const auth = await load();
  if (!auth) throw new Error('Sign-in is not available right now.');
  const provider = new authModule.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await authModule.signInWithPopup(auth, provider);
  } catch (e) {
    const code = e?.code || '';
    if (/popup-blocked|operation-not-supported|cancelled-popup-request/.test(code)) {
      await authModule.signInWithRedirect(auth, provider);
      return;
    }
    if (/popup-closed/.test(code)) return; // they changed their mind
    throw e;
  }
}

export async function signOut() {
  const auth = await load();
  if (auth) await authModule.signOut(auth);
}

/** A fresh ID token for the POS, or null when nobody is signed in. */
export async function idToken() {
  if (!authInstance?.currentUser) return null;
  try { return await authInstance.currentUser.getIdToken(); } catch { return null; }
}
