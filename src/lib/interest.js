/**
 * Counting interest in each piece, anonymously, for the POS's Website → Interest screen (the owner's ask,
 * 2026-10-22: "which ones are saved, inquired about, looked at for the longest").
 *
 * Events: a piece page opened, how long it was looked at (visible time only), the heart on and off, a WhatsApp
 * enquiry naming it. No person, cookie or account — just the piece's key (`mina/piece/<handle>`, as favourites and
 * the POS name it). Batched, then sent with sendBeacon as text/plain (a simple request: no preflight, and it
 * survives the page closing) to POST /api/public/events. Browser-only: the prerender never calls these.
 */

import { POS_API } from './account.js';
import { trackPiece } from './analytics.js';

const key = (h) => `mina/piece/${h}`;
const queue = [];
let timer = null;

function flush() {
  clearTimeout(timer); timer = null;
  if (!queue.length || typeof navigator === 'undefined') return;
  const body = JSON.stringify({ e: queue.splice(0, 50) });
  const url = `${POS_API}/api/public/events`;
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return;
    fetch(url, { method: 'POST', body, keepalive: true, mode: 'no-cors', headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
  } catch { /* never in the way of the page */ }
}

function note(type, h, ms) {
  if (typeof window === 'undefined' || !h) return;
  queue.push(ms == null ? [type, key(h)] : [type, key(h), Math.round(ms)]);
  if (queue.length >= 40) flush();
  else if (!timer) timer = setTimeout(flush, 3000);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}

export const noteOpened = (h) => { note('view', h); trackPiece('view', h); };
/** The heart: pass whether it was saved before the tap. */
export const noteHeart = (h, wasSaved) => { note(wasSaved ? 'unsave' : 'save', h); if (!wasSaved) trackPiece('save', h); };
/** A WhatsApp message naming these pieces (one, or a saved list). */
export const noteEnquiry = (handles) => { for (const h of handles) note('enquire', h); flush(); trackPiece('enquire', handles); };

/**
 * Time on a piece page while the tab is visible: started on open, paused while hidden,
 * sent when the page leaves the piece (another piece, another page, the tab closed).
 */
export function startDwell(h) {
  if (typeof document === 'undefined') return () => {};
  let total = 0;
  let since = document.visibilityState === 'visible' ? Date.now() : null;
  const onVis = () => {
    if (document.visibilityState === 'hidden') {
      if (since != null) { total += Date.now() - since; since = null; }
      if (total) { note('dwell', h, total); total = 0; flush(); }
    } else if (since == null) since = Date.now();
  };
  document.addEventListener('visibilitychange', onVis);
  return () => {
    document.removeEventListener('visibilitychange', onVis);
    if (since != null) total += Date.now() - since;
    if (total) note('dwell', h, total);
  };
}
