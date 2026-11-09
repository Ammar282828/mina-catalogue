/**
 * The catalogue as the app and the prerender both see it.
 *
 * `buildCatalog(data, drops)` turns src/catalog.json (written by
 * scripts/sync-shopify.mjs) plus any photographs the counter has dropped onto
 * the server into galleries, lookups and routes. Pure — no DOM, no fetch — so
 * scripts/prerender.mjs builds every page from the very same function.
 */

import { CHAPTERS, EDITS, chapterOf, homeOf, wristwearHome } from './taxonomy.js';
import { houseWording } from './stones.js';
import { recommender } from './recommend.js';

export const SITE = 'https://catalogue.houseofmina.store';
export const PAGE_SIZE = 36;

/** How recent counts as new, in days. */
const NEW_DAYS = 60;
const NEW_ARRIVALS = { slug: 'new-arrivals', title: 'New Arrivals', blurb: 'The latest pieces to join the house.' };

// ── Paths ───────────────────────────────────────────────────────────────────
export const piecePath = (p) => `/${p.co}/${p.s || p.h}`;
export const galleryPath = (slug, page = 1) => (page > 1 ? `/${slug}/${page}` : `/${slug}`);

/**
 * The version of every photograph this site builds (scripts/images.mjs): raised when
 * they all change — the MINA wordmark (scripts/brand.mjs) is version 1 — so a browser
 * fetches the new file instead of keeping the old. A re-framed ring adds its framing
 * version (data/framed.json): "1.3".
 */
export const PHOTO_VERSION = 1;

export function imageUrls(img) {
  if (img.thumb) return { thumb: img.thumb, full: img.full || img.thumb };
  const v = `?v=${PHOTO_VERSION}${img.v ? `.${img.v}` : ''}`;
  return { thumb: `/catalog-thumb/${img.f}.webp${v}`, full: `/catalog-full/${img.f}.webp${v}` };
}

/**
 * The homes whose photographs get standard whitespace (scripts/whitespace.mjs): every
 * ring the same size in the same square. data/framed.json lists the ones re-framed.
 */
export const RING_HOMES = ['rings-and-bands', 'mens-rings', 'natural-ruby-rings'];

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
  if (!SHOW_PRICES && !p.byWeight) return '';
  if (!p.price) return 'Price on request';
  const [lo, hi] = p.price;
  return lo === hi ? formatPKR(lo) : `From ${formatPKR(lo)}`;
}

/**
 * Rings priced by weight (the owner, 2026-11-09: "for rings that have weights start showing their
 * prices — multiply the weight by 3000 and round to the nearest 500 or 1000"): a ring the counter has
 * weighed (Mina's ERP links an inventory product to the piece, data/weights.json, `npm run weights`)
 * shows PKR 3,000 a gram, to the nearest 500 — even while SHOW_PRICES is off. Not a ring the shop
 * sells: houseofmina.store has its price ("skip this for rings with website prices present").
 */
export const RATE_PER_GRAM = 3000;
export const weightPrice = (g) => Math.round((g * RATE_PER_GRAM) / 500) * 500;

function byWeight(weights) {
  const all = weights?.pieces || {};
  return (p) => {
    if (p.shop || p.price || !RING_HOMES.includes(p.co)) return p;
    const w = all[p.h] || (p.sh && all[p.sh]);
    const price = w?.g > 0 ? weightPrice(w.g) : 0;
    return price > 0 ? { ...p, price: [price, price], byWeight: true, grams: w.g } : p;
  };
}

// ── Drops ───────────────────────────────────────────────────────────────────
// A photograph uploaded from the POS lands in catalog-drop/<Category>/<Category>/<file>,
// named by the category TITLE (that is what the counter picks from). The folder is two
// deep because the POS's drop contract is Category/Collection everywhere; a category
// here is its own one collection, as Watches is on taheri.shop. Men's and Wristwear have
// real sub-categories: Men's/Men's Rings/<file>, Wristwear/Bracelets/<file>.
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const CAMERA_NAME = /^(img|dsc|dscn|pxl|photo|image|whatsapp image|screenshot)[\s_-]*\d/i;

function dropPiece(d) {
  const [chTitle, coTitle, file] = String(d.p).split('/');
  const chapter = CHAPTERS.find((c) => c.title === chTitle);
  let home = chapter?.collections ? chapter.collections.find((k) => k.title === coTitle) : chapter;
  // Wristwear/Wristwear/ was its drop folder before it had sub-categories: sort by the file's name.
  if (!home && chapter?.slug === 'wristwear' && coTitle === chapter.title && file) {
    home = chapter.collections.find((k) => k.slug === wristwearHome({ t: file }));
  }
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
// Shopify piece, `instead` shows the house's own photographs in place of Shopify's
// (the white product shots); `pieces` are pieces known only from an image (no price —
// "Price on request"), with `also` for more images of the same piece and
// `photoPlating` for which plating an image shows. An image id is a file under
// the server's catalog-src/local/ — "DSC08985" means DSC08985.png, anything with
// an extension is that file. scripts/images.mjs builds the variants from there.
// `px` is the image's size: one number for a square, [width, height] otherwise.
export const localFile = (id) => (/\.[a-z0-9]+$/i.test(id) ? id : `${id}.png`);
const localKey = (id) => id.replace(/\.[a-z0-9]+$/i, '');

/** Every image id data/local.json uses (heroes, instead and pieces, not `held`). */
export function localImageIds(local) {
  const ids = (xs) => (xs || []).map((x) => (typeof x === 'string' ? x : x.id));
  return [
    ...Object.values(local?.heroes || {}).flatMap(ids),
    ...Object.values(local?.instead || {}).flatMap(ids),
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
  const instead = local.instead || {};
  const taken = new Set(data.pieces.map((p) => p.s || p.h));
  const hero = (x) => (typeof x === 'string' ? localImg(x) : localImg(x.id, x.plating, x.px));
  const shopify = data.pieces.map((p) => (heroes[p.h] || instead[p.h]
    ? { ...p, img: [...(heroes[p.h] || []).map(hero), ...(instead[p.h] ? instead[p.h].map(hero) : p.img)] }
    : p));
  const own = (local.pieces || []).map((x) => {
    const co = homeOf(x.co, x);
    const chapter = chapterOf(co);
    if (!chapter) return null;
    const base = slugify(x.t);
    let s = base;
    for (let n = 2; taken.has(s); n++) s = `${base}-${n}`;
    taken.add(s);
    const facets = {};
    for (const k of ['stone', 'setting', 'cut', 'occasion', 'style']) if (x[k]?.length) facets[k] = x[k];
    const h = `local-${localKey(x.id).toLowerCase()}`;
    // heroes work for the house's own pieces too (by handle): a box photograph put first on a
    // bangle the PDF showed (2026-10-14), without changing the piece's id, address or saves.
    const imgs = [...(heroes[h] || []).map(hero), ...[x.id, ...(x.also || [])].map((id) => localImg(id, x.photoPlating?.[id], x.px))];
    return {
      h, s, t: x.t, type: x.type || 'Ring', ch: chapter.slug, co,
      price: null, plating: x.plating || [], facets, story: x.story || [], facts: x.facts || [], edits: x.edits || [],
      at: x.addedAt || local.addedAt, img: imgs, local: true, ...(x.natural ? { natural: true } : {}),
      // No date of its own: it came in with the launch import (local.addedAt, 2026-09-23, 288 pieces), and is
      // stock the site opened with, not an arrival. Counting it new filled New Arrivals with the launch for 60 days.
      ...(x.addedAt ? {} : { launch: true }),
    };
  }).filter(Boolean);
  return { ...data, pieces: [...shopify, ...own] };
}

// ── Build ───────────────────────────────────────────────────────────────────
/** The piece that stands for a collection: a best seller where there is one, else the newest. */

/**
 * A gallery's order (the owner, 2026-09-24, for every collection): the pieces added in the
 * last FIRST_DAYS days first, prettiest first, then the rest, prettiest first; newer first
 * where two score the same. Prettiness is data/pretty.json (scripts/pretty.mjs, Gemini);
 * a piece without a score counts as the median. The cover is the first piece, unless
 * data/lead.json `covers` names one.
 */
export const FIRST_DAYS = 30;
function orderer(pretty = {}, now = Date.now()) {
  const vals = Object.values(pretty).filter((n) => typeof n === 'number').sort((a, b) => a - b);
  const median = vals.length ? vals[vals.length >> 1] : 50;
  const since = new Date(now - FIRST_DAYS * 864e5).toISOString().slice(0, 10);
  const score = (p) => pretty[p.s || p.h] ?? median;
  const fresh = (p) => (p.drop || (!p.launch && (p.at || '') >= since) ? 1 : 0);
  return (list) => {
    const pieces = [...list].sort((a, b) => (fresh(b) - fresh(a)) || (score(b) - score(a)) || (b.at || '').localeCompare(a.at || ''));
    return { pieces, cover: pieces.find((p) => !p.drop) || pieces[0] };
  };
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

// ── The counter's changes ───────────────────────────────────────────────────
// A piece corrected from the POS (Website → Edit a piece) after the build: its
// name, its words, its facts, hidden (off every page), or a re-made photograph
// written over the old file (api/_overrides.php). `data.overrides` is { "mina/piece/<handle>": change },
// from api/catalog.php in the app and from the live site in the prerender. The
// piece keeps its address: only what it says and shows changes.
export const pieceKey = (p) => `mina/piece/${p.h}`;
const paragraphs = (text) => String(text || '').split(/\n\s*\n/).map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);

function counterChanges(overrides) {
  const all = overrides && typeof overrides === 'object' ? overrides : {};
  if (!Object.keys(all).length) return (p) => p;
  return (p) => {
    const o = all[pieceKey(p)];
    if (!o) return p;
    const out = { ...p, ...(o.hidden ? { hidden: true } : {}) };
    if (typeof o.name === 'string' && o.name.trim()) out.t = o.name.trim();
    if (typeof o.about === 'string') out.story = paragraphs(o.about);
    if (Array.isArray(o.facts)) out.facts = o.facts.filter((f) => typeof f === 'string' && f.trim());
    // The photograph was replaced in place: a new version on its address, so nobody keeps the old one.
    const ph = o.photo;
    if (ph?.image && ph.v) {
      // Re-made in another shape (square from portrait): its size says so, for the page's layout.
      const size = ph.w > 0 && ph.h > 0 ? { w: ph.w, h: ph.h } : {};
      out.img = p.img.map((im) => (im.f && `${im.f}.webp` === ph.image ? { ...im, ...size, v: im.v ? `${im.v}.${ph.v}` : ph.v } : im));
    }
    return out;
  };
}

export function buildCatalog(data, drops = [], now = Date.now()) {
  const dropped = drops.map(dropPiece).filter(Boolean);
  // A re-framed ring photograph is square now, and its URL carries the framing version.
  const framed = new Set(data.framed?.framed || []);
  const reframe = (p) => (p.img.some((im) => framed.has(im.f))
    ? { ...p, img: p.img.map((im) => (framed.has(im.f) ? { ...im, w: 2000, h: 2000, v: data.framed.version } : im)) }
    : p);
  // A catalogue synced before Wristwear had sub-categories still says "wristwear".
  const rehome = (p) => (p.co === 'wristwear' ? { ...p, co: homeOf(p.co, p) } : p);
  const changed = counterChanges(data.overrides);
  const priced = byWeight(data.weights);
  const pieces = [...dropped, ...data.pieces].map(rehome).map(worded).map(reframe).map(changed).map(priced).filter((p) => !p.hidden)
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const byHandle = new Map(pieces.map((p) => [p.h, p]));
  // A product Shopify renamed is also found by the shop's handle (`sh`, scripts/identity.mjs).
  for (const p of pieces) if (p.sh && !byHandle.has(p.sh)) byHandle.set(p.sh, p);
  const bySlug = new Map(pieces.map((p) => [p.s || p.h, p]));
  const cutoff = new Date(now - NEW_DAYS * 864e5).toISOString().slice(0, 10);

  const order = orderer(data.pretty?.pieces, now);
  const galleries = new Map();
  // One level: a category is the gallery, newest first. The style of a piece is a filter.
  // Men's is a section: each sub-category a gallery, and the section's own page lists
  // them one after another, in their order.
  const chapters = CHAPTERS.map((ch) => {
    if (!ch.collections) {
      const chapter = { ...ch, kind: 'chapter', ...order(pieces.filter((p) => p.co === ch.slug)) };
      galleries.set(ch.slug, chapter);
      return chapter;
    }
    const collections = ch.collections
      .map((k) => ({ ...k, kind: 'collection', ...order(pieces.filter((p) => p.co === k.slug)) }))
      .filter((k) => k.pieces.length);
    const list = collections.flatMap((k) => k.pieces);
    const chapter = { ...ch, kind: 'chapter', collections, ...order(list) };
    for (const k of collections) { k.parent = chapter; galleries.set(k.slug, k); }
    galleries.set(ch.slug, chapter);
    return chapter;
  }).filter((c) => c.pieces.length);

  const edits = EDITS.map((e) => {
    const meta = (data.edits || []).find((x) => x.slug === e.slug) || {};
    const list = pieces.filter((p) => p.edits?.includes(e.slug));
    return { ...e, blurb: meta.blurb || e.blurb || '', kind: 'edit', ...order(list) };
  }).filter((e) => e.pieces.length);
  for (const e of edits) galleries.set(e.slug, e);

  // New Arrivals is the newest first (owner, 2026-10-12: "why are new arrivals hardcoded"). Ordered by
  // prettiness, the shelf showed the same launch pieces for two months, and a piece added today, with no
  // score yet, sat in the middle of it. Prettiness only breaks a tie within one day.
  const isNew = (p) => p.drop || (!p.launch && p.at >= cutoff);
  const score = (p) => data.pretty?.pieces?.[p.s || p.h] ?? 0;
  const newestFirst = (list) => [...list].sort((a, b) => (b.at || '').localeCompare(a.at || '') || (score(b) - score(a)));
  const fresh = pieces.filter(isNew);
  const newArrivals = {
    ...NEW_ARRIVALS, kind: 'edit',
    // Never an empty shelf: when little is recent, the newest twenty-four that are not launch stock.
    pieces: newestFirst(fresh.length >= 8 ? fresh : pieces.filter((p) => !p.launch).slice(0, 24)),
  };
  newArrivals.cover = newArrivals.pieces[0];
  galleries.set(newArrivals.slug, newArrivals);

  // Covers chosen by hand (data/lead.json `covers`), wherever the piece is in that gallery.
  for (const [slug, s] of Object.entries(data.lead?.covers || {})) {
    const g = galleries.get(slug);
    const p = g?.pieces.find((x) => (x.s || x.h) === s);
    if (p) g.cover = p;
  }

  // More like this, Complete the look, Picked for you (src/lib/recommend.js, data/recommend.json).
  const rec = recommender(pieces, bySlug, data.recommend, data.pretty?.pieces, isNew);
  return { pieces, byHandle, bySlug, galleries, chapters, edits, newArrivals, syncedAt: data.syncedAt, isNew, rec };
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
  if (clean === '/account') return { kind: 'account' };

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
