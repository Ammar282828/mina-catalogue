/**
 * Counting visits to this site for the ERP's Website → Interest and Live (the owner, 2026-10-23: "add by location, live
 * visitors, everything Shopify shows"): sessions, pages, time, where people came from, searches, 404s, and how far they
 * got — a piece opened, saved, asked about on WhatsApp. interest.js's piece events ride the same beacon.
 *
 * No person, no cookie, no fingerprint: a random id kept in this browser (localStorage) tells a returning visitor from a
 * new one; the referrer is sent as its host only; the address is never sent (the ERP places the visitor from it, then
 * forgets it). Nothing is sent at all with Do Not Track or Global Privacy Control on, or from an automated browser.
 * A session ends after 30 minutes away. While the page is visible it beats every 30 seconds (Live counts the last five
 * minutes). Batched, sent with sendBeacon as text/plain to POST /api/public/events (the ERP's site-analytics.ts reads it).
 */

import { POS_API } from './account.js';

const SESSION_MS = 30 * 60_000;
const BEAT_MS = 30_000;
const V_KEY = 'erp_visitor';
const S_KEY = 'erp_session';

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const optedOut = () => {
  const n = navigator;
  return n.doNotTrack === '1' || window.doNotTrack === '1' || n.msDoNotTrack === '1' || n.globalPrivacyControl === true || n.webdriver === true;
};
export const counting = isBrowser && !optedOut();

const rid = () => {
  const b = new Uint8Array(12);
  (window.crypto || window.msCrypto).getRandomValues(b);
  return Array.from(b, (x) => x.toString(36).padStart(2, '0')).join('').slice(0, 20);
};
const karachiDay = () => new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: this visit only */ } };

let visitor = null; // { id, day, seen }
let session = null; // { id, last, n, pp, steps, c, opened }
let memoryOnly = null;
const out = { e: [], p: [], q: [], f: [] };
let firstToday = false;
let opens = false;
let visibleMs = 0;
let visibleSince = null;
let timer = null;

/** Where this visit came from, read once when it starts: the referrer's host, utm_* tags, an ad click id. */
function context(isNew) {
  const q = new URLSearchParams(window.location.search);
  let r = '';
  try { const h = new URL(document.referrer).host; if (h && h !== window.location.host) r = h; } catch { /* none */ }
  const k = q.get('gclid') || q.get('gbraid') || q.get('wbraid') ? 'g' : q.get('ttclid') ? 'tt' : q.get('igshid') ? 'ig' : q.get('fbclid') ? 'fb' : '';
  const u = { s: q.get('utm_source') || '', m: q.get('utm_medium') || '', c: q.get('utm_campaign') || '' };
  return { r, u, k, l: window.location.pathname, n: isNew ? 1 : 0 };
}

function start() {
  if (session || !counting) return;
  visitor = read(V_KEY);
  const isNew = !visitor || !visitor.id;
  if (isNew) visitor = { id: rid(), day: '', seen: Date.now() };
  const today = karachiDay();
  if (visitor.day !== today) { visitor.day = today; firstToday = true; }
  write(V_KEY, visitor);

  const c = context(isNew);
  const kept = read(S_KEY) || memoryOnly;
  // A visit from somewhere new (a referrer or a tagged link) starts a session, as Shopify and GA count them.
  const fromElsewhere = c.r || c.u.s || c.u.c || c.k;
  if (kept && kept.id && Date.now() - kept.last < SESSION_MS && !fromElsewhere) session = kept;
  else { session = { id: rid(), last: Date.now(), n: 0, pp: '', steps: [], c }; opens = true; }
  save();

  visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { pause(); flush(); }
    else { resume(); beat(); }
  });
  window.addEventListener('pagehide', () => { pause(); flush(); });
  // Every WhatsApp link on the site is the step the funnel ends in.
  document.addEventListener('click', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[href*="wa.me/"], a[href*="api.whatsapp.com"], a[href^="whatsapp:"]') : null;
    if (a) { step('enquire'); flush(); }
  }, { capture: true });
  setInterval(() => { if (document.visibilityState === 'visible') beat(); }, BEAT_MS);
}

function save() { session.last = Date.now(); memoryOnly = session; write(S_KEY, session); }
function pause() { if (visibleSince != null) { visibleMs += Date.now() - visibleSince; visibleSince = null; } }
function resume() {
  if (visibleSince == null) visibleSince = Date.now();
  // Back after half an hour away: a new session, as if arriving.
  if (session && Date.now() - session.last >= SESSION_MS) { session = { id: rid(), last: Date.now(), n: 0, pp: '', steps: [], c: { ...context(false), l: window.location.pathname } }; opens = true; firstToday = visitor.day !== karachiDay(); if (firstToday) { visitor.day = karachiDay(); write(V_KEY, visitor); } save(); }
}

function beat() { if (session && Date.now() - session.last < SESSION_MS * 2) flush(true); }
function later(ms = 3000) { if (!timer) timer = setTimeout(() => flush(), ms); }

function flush(heartbeat = false) {
  clearTimeout(timer); timer = null;
  if (!counting || !session) return;
  if (visibleSince != null) { visibleMs += Date.now() - visibleSince; visibleSince = Date.now(); }
  const t = Math.round(visibleMs);
  const any = out.e.length || out.p.length || out.q.length || out.f.length || opens;
  if (!any && !heartbeat) return;
  const body = {
    // The browser's own agent: the ERP's front end replaces the header with "Google", so devices and bots are told from this.
    v: visitor.id, s: session.id, ua: navigator.userAgent, c: session.c, n: session.n, pp: session.pp,
    at: window.location.pathname, t,
    ...(opens ? { o: 1 } : {}), ...(firstToday ? { d: 1 } : {}),
    ...(out.p.length ? { p: out.p.splice(0, 30) } : {}), ...(out.q.length ? { q: out.q.splice(0, 10) } : {}),
    ...(out.f.length ? { f: out.f.splice(0) } : {}), ...(out.e.length ? { e: out.e.splice(0, 50) } : {}),
  };
  if (body.p) { session.n += body.p.length; session.pp = body.p[body.p.length - 1][0]; }
  opens = false; firstToday = false; visibleMs = 0;
  save();
  if (out.p.length || out.e.length) later(500);
  const url = `${POS_API}/api/public/events`;
  const text = JSON.stringify(body);
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([text], { type: 'text/plain' }))) return;
    fetch(url, { method: 'POST', body: text, keepalive: true, mode: 'no-cors', headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
  } catch { /* never in the way of the page */ }
}

/** A page seen (every route change). kind: home | collection | piece | info | search | 404 | other. */
export function notePage(path, kind = 'other') {
  if (!counting) return;
  start();
  const p = String(path || '/').split(/[?#]/)[0] || '/';
  if (out.p.length && out.p[out.p.length - 1][0] === p) return;
  out.p.push([p, kind]);
  // The first page goes at once, so Live shows the visitor; later ones ride the next batch.
  later(session.n === 0 && out.p.length === 1 ? 300 : 3000);
}

/** Words typed into the site's search (sent once the visitor stops typing or closes it). */
export function noteSearch(term) {
  const q = String(term || '').trim().toLowerCase();
  if (!counting || q.length < 2) return;
  start(); out.q.push(q.slice(0, 60)); later();
}

/** A step of the funnel (piece | save | enquire), counted once per session. */
export function step(name) {
  if (!counting) return;
  start();
  if (session.steps.includes(name)) return;
  session.steps.push(name); out.f.push(name); save(); later();
}

/** interest.js's per-piece events, carried in the same batch. */
export function queuePiece(ev) {
  if (!counting) return;
  start();
  out.e.push(ev);
  if (out.e.length >= 40) flush(); else later();
}
export { flush };
