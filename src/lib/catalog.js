/**
 * The catalogue as the app and the prerender both see it.
 *
 * `buildCatalog(data, drops)` turns src/catalog.json (written by
 * scripts/sync-shopify.mjs) plus any photographs the counter has dropped onto
 * the server into galleries, lookups and routes. Pure — no DOM, no fetch — so
 * scripts/prerender.mjs builds every page from the very same function.
 */

import { CHAPTERS, EDITS } from './taxonomy.js';

export const SITE = 'https://catalogue.houseofmina.store';
export const PAGE_SIZE = 36;

/** How recent counts as new, in days. */
const NEW_DAYS = 60;
const NEW_ARRIVALS = { slug: 'new-arrivals', title: 'New Arrivals', blurb: 'The latest pieces to join the house.' };

// ── Paths ───────────────────────────────────────────────────────────────────
export const piecePath = (p) => `/${p.co}/${p.s || p.h}`;
export const galleryPath = (slug, page = 1) => (page > 1 ? `/${slug}/${page}` : `/${slug}`);

export function imageUrls(img) {
  if (img.thumb) return { thumb: img.thumb, full: img.full || img.thumb };
  return { thumb: `/catalog-thumb/${img.f}.webp`, full: `/catalog-full/${img.f}.webp` };
}

// ── Money ───────────────────────────────────────────────────────────────────
export const formatPKR = (n) => `PKR ${Math.round(n).toLocaleString('en-US')}`;

/** "PKR 10,000", "From PKR 10,000", or — for a piece the counter photographed but has not priced — "Price on request". */
export function priceLabel(p) {
  if (!p.price) return 'Price on request';
  const [lo, hi] = p.price;
  return lo === hi ? formatPKR(lo) : `From ${formatPKR(lo)}`;
}

// ── Drops ───────────────────────────────────────────────────────────────────
// A photograph uploaded from the POS lands in catalog-drop/<Chapter>/<Collection>/<file>,
// named by the chapter and collection TITLES (that is what the counter picks from).
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const CAMERA_NAME = /^(img|dsc|dscn|pxl|photo|image|whatsapp image|screenshot)[\s_-]*\d/i;

function dropPiece(d) {
  const [chTitle, coTitle, file] = String(d.p).split('/');
  const chapter = CHAPTERS.find((c) => c.title === chTitle);
  const collection = chapter?.collections.find((c) => c.title === coTitle);
  if (!chapter || !collection) return null;
  const stem = file.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+\d+$/, '').trim();
  const named = stem && !CAMERA_NAME.test(stem) && !/^\d+$/.test(stem);
  return {
    h: `new-${slugify(stem || 'piece')}-${d.t}`,
    t: named ? stem.replace(/[_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : `New in ${collection.title}`,
    ch: chapter.slug,
    co: collection.slug,
    price: null,
    plating: [],
    facets: {},
    story: [],
    facts: [],
    edits: [],
    at: new Date((d.t || 0) * 1000).toISOString().slice(0, 10),
    img: [{ thumb: d.thumb, full: d.full, w: 0, h: 0 }],
    drop: true,
  };
}

// ── The house's own photographs ─────────────────────────────────────────────
// data/local.json: studio photographs that are not on Shopify. `heroes` puts one
// first on a Shopify piece; `pieces` are pieces known only from a photograph
// (no price — "Price on request"). scripts/images.mjs builds their variants
// from the originals on the server (catalog-src/local/<id>.png).
const localImg = (id) => ({ f: `local/${id}`, w: 1500, h: 1500 });

export function mergeLocal(data, local) {
  if (!local) return data;
  const heroes = local.heroes || {};
  const taken = new Set(data.pieces.map((p) => p.s || p.h));
  const shopify = data.pieces.map((p) => (heroes[p.h] ? { ...p, img: [...heroes[p.h].map(localImg), ...p.img] } : p));
  const own = (local.pieces || []).map((x) => {
    const chapter = CHAPTERS.find((c) => c.collections.some((k) => k.slug === x.co));
    if (!chapter) return null;
    const base = slugify(x.t);
    let s = base;
    for (let n = 2; taken.has(s); n++) s = `${base}-${n}`;
    taken.add(s);
    const facets = {};
    for (const k of ['stone', 'setting', 'cut', 'occasion', 'style']) if (x[k]?.length) facets[k] = x[k];
    return {
      h: `local-${x.id.toLowerCase()}`, s, t: x.t, type: x.type || 'Ring', ch: chapter.slug, co: x.co,
      price: null, plating: x.plating || [], facets, story: [], facts: [], edits: [],
      at: x.addedAt || local.addedAt, img: [localImg(x.id)], local: true,
    };
  }).filter(Boolean);
  return { ...data, pieces: [...shopify, ...own] };
}

// ── Build ───────────────────────────────────────────────────────────────────
/** The piece that stands for a collection: a best seller where there is one, else the newest. */
const coverOf = (pieces) => pieces.find((p) => p.edits?.includes('best-sellers')) || pieces.find((p) => !p.drop) || pieces[0];

export function buildCatalog(data, drops = [], now = Date.now()) {
  const dropped = drops.map(dropPiece).filter(Boolean);
  const pieces = [...dropped, ...data.pieces].sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const byHandle = new Map(pieces.map((p) => [p.h, p]));
  const bySlug = new Map(pieces.map((p) => [p.s || p.h, p]));
  const cutoff = new Date(now - NEW_DAYS * 864e5).toISOString().slice(0, 10);

  const galleries = new Map();
  const chapters = CHAPTERS.map((ch) => {
    const collections = ch.collections
      .map((c) => ({ ...c, kind: 'collection', parent: ch, pieces: pieces.filter((p) => p.co === c.slug) }))
      .filter((c) => c.pieces.length);
    for (const c of collections) c.cover = coverOf(c.pieces);
    // A chapter lists its collections in their own order, newest first within each.
    const chPieces = collections.flatMap((c) => c.pieces);
    const chapter = { ...ch, kind: 'chapter', collections, pieces: chPieces, cover: coverOf(chPieces) };
    for (const c of collections) { c.parent = chapter; galleries.set(c.slug, c); }
    galleries.set(ch.slug, chapter);
    return chapter;
  }).filter((c) => c.pieces.length);

  const edits = EDITS.map((e) => {
    const meta = (data.edits || []).find((x) => x.slug === e.slug) || {};
    const list = pieces.filter((p) => p.edits?.includes(e.slug));
    return { ...e, blurb: meta.blurb || '', kind: 'edit', pieces: list, cover: coverOf(list) };
  }).filter((e) => e.pieces.length);
  for (const e of edits) galleries.set(e.slug, e);

  const fresh = pieces.filter((p) => p.at >= cutoff);
  const newArrivals = {
    ...NEW_ARRIVALS, kind: 'edit',
    // Never an empty shelf: when nothing is recent, the newest twenty-four.
    pieces: fresh.length >= 8 ? fresh : pieces.slice(0, 24),
  };
  newArrivals.cover = newArrivals.pieces[0];
  galleries.set(newArrivals.slug, newArrivals);

  return { pieces, byHandle, bySlug, galleries, chapters, edits, newArrivals, syncedAt: data.syncedAt, isNew: (p) => p.at >= cutoff };
}

// ── Routes ──────────────────────────────────────────────────────────────────
/**
 * What a path shows. Shared with the prerender so a page Google reads and the
 * page the app draws are always the same page.
 */
export function resolvePath(pathname, cat) {
  const clean = decodeURIComponent(pathname.split(/[?#]/)[0]).replace(/\/+$/, '') || '/';
  if (clean === '/') return { kind: 'home' };
  if (clean === '/collections') return { kind: 'collections' };
  if (clean === '/favourites') return { kind: 'favourites' };

  const [a, b, ...rest] = clean.slice(1).split('/');
  if (rest.length) return { kind: 'notfound' };
  const gallery = cat.galleries.get(a);
  if (!gallery) return { kind: 'notfound' };
  if (b === undefined) return { kind: 'gallery', gallery, page: 1 };
  if (/^\d+$/.test(b)) {
    const page = Number(b);
    const pages = Math.max(1, Math.ceil(gallery.pieces.length / PAGE_SIZE));
    return page >= 1 && page <= pages ? { kind: 'gallery', gallery, page } : { kind: 'notfound' };
  }
  // By name first; a Shopify handle still finds its piece (and the app then shows the canonical address).
  const piece = cat.bySlug.get(b) || cat.byHandle.get(b);
  if (!piece) return { kind: 'notfound' };
  // A piece reached through an edit (/ascension/elara-ring) is the same piece;
  // the canonical address is always under its home collection.
  return { kind: 'piece', piece, via: gallery };
}

/** The breadcrumb trail for a gallery or piece: [{ title, path }]. */
export function trail(route) {
  const out = [{ title: 'Home', path: '/' }];
  const g = route.kind === 'piece' ? null : route.gallery;
  if (route.kind === 'gallery') {
    if (g.kind === 'collection') out.push({ title: g.parent.title, path: galleryPath(g.parent.slug) });
    else if (g.kind === 'edit') out.push({ title: 'Collections', path: '/collections' });
    out.push({ title: g.title, path: galleryPath(g.slug) });
  }
  return out;
}
