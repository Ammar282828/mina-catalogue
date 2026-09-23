/**
 * The catalogue as the app and the prerender both see it.
 *
 * `buildCatalog(data, drops)` turns src/catalog.json (written by
 * scripts/sync-shopify.mjs) plus any photographs the counter has dropped onto
 * the server into galleries, lookups and routes. Pure — no DOM, no fetch — so
 * scripts/prerender.mjs builds every page from the very same function.
 */

import { CHAPTERS, EDITS, chapterOf } from './taxonomy.js';
import { houseWording } from './stones.js';

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
/**
 * No prices anywhere on the catalogue (the owner, 2026-09-24): every piece is
 * "ask us on WhatsApp". scripts/sync-shopify.mjs leaves them out of
 * src/catalog.json as well, so none reach the pages or the app's script. Set
 * true and run a sync to bring them back.
 */
export const SHOW_PRICES = false;

export const formatPKR = (n) => `PKR ${Math.round(n).toLocaleString('en-US')}`;

/**
 * "PKR 10,000", "From PKR 10,000", or — for a piece the counter photographed but
 * has not priced — "Price on request". Nothing at all while prices are off.
 */
export function priceLabel(p) {
  if (!SHOW_PRICES) return '';
  if (!p.price) return 'Price on request';
  const [lo, hi] = p.price;
  return lo === hi ? formatPKR(lo) : `From ${formatPKR(lo)}`;
}

// ── Drops ───────────────────────────────────────────────────────────────────
// A photograph uploaded from the POS lands in catalog-drop/<Category>/<Category>/<file>,
// named by the category TITLE (that is what the counter picks from). The folder is two
// deep because the POS's drop contract is Category/Collection everywhere; a category
// here is its own one collection, as Watches is on taheri.shop. Men's has real
// sub-categories: Men's/Men's Rings/<file>.
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const CAMERA_NAME = /^(img|dsc|dscn|pxl|photo|image|whatsapp image|screenshot)[\s_-]*\d/i;

function dropPiece(d) {
  const [chTitle, coTitle, file] = String(d.p).split('/');
  const chapter = CHAPTERS.find((c) => c.title === chTitle);
  const home = chapter?.collections ? chapter.collections.find((k) => k.title === coTitle) : chapter;
  if (!home || !file) return null;
  const stem = file.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+\d+$/, '').trim();
  const named = stem && !CAMERA_NAME.test(stem) && !/^\d+$/.test(stem);
  return {
    h: `new-${slugify(stem || 'piece')}-${d.t}`,
    t: named ? stem.replace(/[_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : `New in ${home.title}`,
    ch: chapter.slug,
    co: home.slug,
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

// ── The house's own images ──────────────────────────────────────────────────
// data/local.json: images that are not on Shopify. `heroes` puts one first on a
// Shopify piece; `pieces` are pieces known only from an image (no price —
// "Price on request"), with `also` for more images of the same piece and
// `photoPlating` for which plating an image shows. An image id is a file under
// the server's catalog-src/local/ — "DSC08985" means DSC08985.png, anything with
// an extension is that file. scripts/images.mjs builds the variants from there.
// `px` is the image's size: one number for a square, [width, height] otherwise.
export const localFile = (id) => (/\.[a-z0-9]+$/i.test(id) ? id : `${id}.png`);
const localKey = (id) => id.replace(/\.[a-z0-9]+$/i, '');

/** Every image id data/local.json uses (heroes and pieces, not `held`). */
export function localImageIds(local) {
  const ids = (xs) => (xs || []).map((x) => (typeof x === 'string' ? x : x.id));
  return [
    ...Object.values(local?.heroes || {}).flatMap(ids),
    ...(local?.pieces || []).flatMap((p) => [p.id, ...(p.also || [])]),
  ];
}

/**
 * The 3D render of a DSC image, when there is one (data/renders.json, written by
 * scripts/sync-renders.mjs from iCloud heroes-white-1500/3d-renders/): it takes
 * the image's place everywhere. The hash is in the file name, so a re-rolled
 * render is a new URL and no browser keeps the old one.
 */
export const renderKey = (id, r) => `local-3d/${localKey(id)}-${r.v}`;

export function mergeLocal(data, local, renders = {}) {
  if (!local) return data;
  const localImg = (id, plating, px = 1500) => {
    const r = renders[localKey(id)];
    const [w, h] = Array.isArray(px) ? px : [px, px];
    return r
      ? { f: renderKey(id, r), w: r.w || w, h: r.h || h, ...(plating ? { plating } : {}) }
      : { f: `local/${localKey(id)}`, w, h, ...(plating ? { plating } : {}) };
  };
  const heroes = local.heroes || {};
  const taken = new Set(data.pieces.map((p) => p.s || p.h));
  const hero = (x) => (typeof x === 'string' ? localImg(x) : localImg(x.id, x.plating, x.px));
  const shopify = data.pieces.map((p) => (heroes[p.h] ? { ...p, img: [...heroes[p.h].map(hero), ...p.img] } : p));
  const own = (local.pieces || []).map((x) => {
    const chapter = chapterOf(x.co);
    if (!chapter) return null;
    const base = slugify(x.t);
    let s = base;
    for (let n = 2; taken.has(s); n++) s = `${base}-${n}`;
    taken.add(s);
    const facets = {};
    for (const k of ['stone', 'setting', 'cut', 'occasion', 'style']) if (x[k]?.length) facets[k] = x[k];
    const imgs = [x.id, ...(x.also || [])].map((id) => localImg(id, x.photoPlating?.[id], x.px));
    return {
      h: `local-${localKey(x.id).toLowerCase()}`, s, t: x.t, type: x.type || 'Ring', ch: chapter.slug, co: x.co,
      price: null, plating: x.plating || [], facets, story: x.story || [], facts: x.facts || [], edits: x.edits || [],
      at: x.addedAt || local.addedAt, img: imgs, local: true, ...(x.natural ? { natural: true } : {}),
    };
  }).filter(Boolean);
  return { ...data, pieces: [...shopify, ...own] };
}

// ── Build ───────────────────────────────────────────────────────────────────
/** The piece that stands for a collection: a best seller where there is one, else the newest. */
const coverOf = (pieces) => pieces.find((p) => p.edits?.includes('best-sellers')) || pieces.find((p) => !p.drop) || pieces[0];

/**
 * A gallery's own order: the pieces data/lead.json names for it first, in that
 * order, then the rest as they were (newest first). Its first piece is then the cover.
 */
function led(list, slugs) {
  if (!slugs?.length) return { pieces: list, cover: coverOf(list) };
  const at = new Map(slugs.map((s, i) => [s, i]));
  const pieces = [...list].sort((a, b) => (at.get(a.s || a.h) ?? Infinity) - (at.get(b.s || b.h) ?? Infinity));
  return { pieces, cover: at.has(pieces[0]?.s || pieces[0]?.h) ? pieces[0] : coverOf(pieces) };
}

/**
 * A piece in the house's words: every coloured stone simulated, CZ / zircon as
 * American Diamonds (src/lib/stones.js). Names are left as they are.
 * A piece the house marks `natural` (data/local.json) is set with a natural
 * stone, and its words are kept as written.
 */
function worded(p) {
  if (p.natural) return p;
  const st = p.facets?.stone || [];
  // A moissanite / lab-grown piece with no coloured stone: its "emerald" is the cut.
  const emeraldIsCut = (st.includes('Moissanite') || st.includes('Lab-Grown Diamond')) && !st.some((x) => /Emerald|Ruby|Topaz/.test(x));
  const w = (t) => houseWording(t, { emeraldIsCut });
  const stone = st.length ? [...new Set(st.map((x) => (x === 'Zircon' ? 'American Diamond' : x)))] : null;
  return {
    ...p,
    ...(stone ? { facets: { ...p.facets, stone } } : {}),
    story: (p.story || []).map(w),
    facts: (p.facts || []).map(w),
    ...(p.stones ? { stones: p.stones.map((v) => w(`Stone: ${v}`).slice('Stone: '.length)) } : {}),
  };
}

export function buildCatalog(data, drops = [], now = Date.now()) {
  const dropped = drops.map(dropPiece).filter(Boolean);
  const pieces = [...dropped, ...data.pieces].map(worded).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const byHandle = new Map(pieces.map((p) => [p.h, p]));
  const bySlug = new Map(pieces.map((p) => [p.s || p.h, p]));
  const cutoff = new Date(now - NEW_DAYS * 864e5).toISOString().slice(0, 10);

  const galleries = new Map();
  // One level: a category is the gallery, newest first. The style of a piece is a filter.
  // Men's is a section: each sub-category a gallery, and the section's own page lists
  // them one after another, in their order.
  const chapters = CHAPTERS.map((ch) => {
    if (!ch.collections) {
      const chapter = { ...ch, kind: 'chapter', ...led(pieces.filter((p) => p.co === ch.slug), data.lead?.[ch.slug]) };
      galleries.set(ch.slug, chapter);
      return chapter;
    }
    const collections = ch.collections
      .map((k) => ({ ...k, kind: 'collection', ...led(pieces.filter((p) => p.co === k.slug), data.lead?.[k.slug]) }))
      .filter((k) => k.pieces.length);
    const list = collections.flatMap((k) => k.pieces);
    const chapter = { ...ch, kind: 'chapter', collections, ...led(list, data.lead?.[ch.slug]) };
    for (const k of collections) { k.parent = chapter; galleries.set(k.slug, k); }
    galleries.set(ch.slug, chapter);
    return chapter;
  }).filter((c) => c.pieces.length);

  const edits = EDITS.map((e) => {
    const meta = (data.edits || []).find((x) => x.slug === e.slug) || {};
    const list = pieces.filter((p) => p.edits?.includes(e.slug));
    return { ...e, blurb: meta.blurb || e.blurb || '', kind: 'edit', pieces: list, cover: coverOf(list) };
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

  // Covers chosen by hand (data/lead.json `covers`), wherever the piece is in that gallery.
  for (const [slug, s] of Object.entries(data.lead?.covers || {})) {
    const g = galleries.get(slug);
    const p = g?.pieces.find((x) => (x.s || x.h) === s);
    if (p) g.cover = p;
  }

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
    if (g.kind === 'edit') out.push({ title: 'Collections', path: '/collections' });
    if (g.parent) out.push({ title: g.parent.title, path: galleryPath(g.parent.slug) });
    out.push({ title: g.title, path: galleryPath(g.slug) });
  }
  return out;
}
