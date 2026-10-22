/**
 * Google Analytics 4 and the Meta pixel (2026-10-22, the owner: "add google analytics or smth to taheri and hom").
 * The catalogue had neither, so its visitors, the pages they leave from and the WhatsApp enquiries ads bring
 * could not be counted, and no visitor could be shown an ad again.
 *
 * GA4 is House of Mina's own property, the one houseofmina.store (Shopify) already reports to, so the catalogue
 * and the shop are one picture; the linker carries a visitor's session across "Buy online". The pixel's id comes
 * from the ERP (/api/public/pixel, chosen in Ads → Setup), as on taheri.shop; with none chosen nothing loads.
 * Both load after the page is idle, never ahead of the first paint, and never from local dev or the prerender.
 *
 * Sent: page_view on every route (with the address's query, so utm_* tags count), and from interest.js the same
 * moments the ERP counts: a piece opened (view_item / ViewContent), saved (add_to_wishlist / AddToWishlist),
 * asked about on WhatsApp (inquiry_whatsapp); any wa.me tap is the pixel's Contact. Every pixel event carries page_path, section, page_type.
 */

import { POS_API } from './account.js';

const GA_MEASUREMENT_ID = 'G-X5Y0LCK19G'; // House of Mina's GA4 (houseofmina.store's) — '' to disable

const isBrowser = typeof window !== 'undefined';
const isLocalHost = isBrowser && /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(window.location.hostname);
const enabled = isBrowser && !isLocalHost && !navigator.webdriver;

let started = false;
let pixelReady = false;
const pixelQueue = [];

function gtag() { (window.dataLayer = window.dataLayer || []).push(arguments); }

function fbq(...args) {
  if (pixelReady && window.fbq) window.fbq(...args);
  else if (pixelQueue.length < 50) pixelQueue.push(args);
}

/** Where an event happened: { page_path, section, page_type }. */
function pageParams(path = isBrowser ? window.location.pathname : '/') {
  const clean = String(path || '/').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const parts = clean.split('/').filter(Boolean);
  const section = parts[0] || 'home';
  const info = ['collections', 'favourites', 'account', 'men', 'wristwear'];
  const page_type = !parts.length ? 'home' : parts.length > 1 ? 'piece' : info.includes(section) ? 'info' : 'collection';
  return { page_path: clean, section, page_type };
}

export function initAnalytics() {
  if (started || !enabled) return;
  started = true;
  if (GA_MEASUREMENT_ID) {
    gtag('js', new Date());
    // page_view is sent by hand on each route (a single-page app), so the automatic one is off.
    gtag('config', GA_MEASUREMENT_ID, { send_page_view: false, linker: { domains: ['catalogue.houseofmina.store', 'houseofmina.store'] } });
  }
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2500));
  const start = () => idle(() => {
    if (GA_MEASUREMENT_ID) {
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
      document.head.appendChild(s);
    }
    initPixel().catch(() => undefined);
  });
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start, { once: true });
}

async function initPixel() {
  const res = await fetch(`${POS_API}/api/public/pixel`, { credentials: 'omit' });
  const id = res.ok ? (await res.json()).id : null;
  if (!id || !/^\d{6,20}$/.test(String(id))) return;
  // Meta's base code, as published.
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', String(id));
  pixelReady = true;
  if (!pixelQueue.some((a) => a[1] === 'PageView')) window.fbq('track', 'PageView', pageParams());
  pixelQueue.splice(0).forEach((a) => window.fbq(...a));
  // Every WhatsApp link on the site is a conversation started: Contact (as on taheri.shop).
  document.addEventListener('click', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[href*="wa.me/"]') : null;
    if (a) window.fbq('track', 'Contact', pageParams());
  }, { capture: true });
}

/** Every route change (App.jsx). */
export function trackPageView(path, title) {
  if (!enabled) return;
  fbq('track', 'PageView', pageParams(path));
  if (GA_MEASUREMENT_ID) gtag('event', 'page_view', { page_path: path, page_location: window.location.origin + path + window.location.search, page_title: title });
}

/** The moments interest.js counts, told to GA and the pixel as well. */
export function trackPiece(kind, handles) {
  if (!enabled) return;
  const list = [].concat(handles).filter(Boolean).map(String);
  if (!list.length) return;
  const items = list.map((h) => ({ item_id: h }));
  if (kind === 'view') {
    if (GA_MEASUREMENT_ID) gtag('event', 'view_item', { items });
    fbq('track', 'ViewContent', { content_ids: list, content_type: 'product', ...pageParams() });
  } else if (kind === 'save') {
    if (GA_MEASUREMENT_ID) gtag('event', 'add_to_wishlist', { items });
    fbq('track', 'AddToWishlist', { content_ids: list, ...pageParams() });
  } else if (kind === 'enquire') {
    // The pixel's Contact is sent by the wa.me tap itself (initPixel), so it is counted once.
    if (GA_MEASUREMENT_ID) gtag('event', 'inquiry_whatsapp', { items, count: list.length });
  }
}
