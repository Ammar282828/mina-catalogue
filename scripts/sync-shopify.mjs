// Copy House of Mina's catalogue from its Shopify store into this site.
//
//   npm run sync            fetch, classify, write src/catalog.json + data/image-sources.json
//   npm run sync -- --force write even if the product count dropped sharply
//
// Reads only Shopify's PUBLIC storefront feeds (products.json, collections.json)
// — no token, nothing that could change the store. What it writes is the whole
// of this site's knowledge of a piece: its name, home collection, price, the
// options it comes in, what it is made of, and where each photograph came from.
// The photographs themselves are fetched by scripts/images.mjs into this site's
// own image folders; nothing on the live site ever loads from Shopify.
//
// Both output files are committed. A sync is a reviewable diff: pieces added,
// prices changed, photos swapped.

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CHAPTERS, EDITS, classify, chapterOf, facetsOf, allGallerySlugs } from '../src/lib/taxonomy.js';
import { SHOW_PRICES } from '../src/lib/catalog.js';
import { keptHandles, photoHash } from './identity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORE = 'https://houseofmina.store';
const CATALOG_PATH = path.join(ROOT, 'src', 'catalog.json');
const SOURCES_PATH = path.join(ROOT, 'data', 'image-sources.json');
const DRAFTS_PATH = path.join(ROOT, 'data', 'shopify-drafts.json');
const IDS_PATH = path.join(ROOT, 'data', 'shopify-ids.json');
const FORCE = process.argv.includes('--force');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'mina-catalogue-sync/1.0', Accept: 'application/json' } });
      if (res.status === 429 && attempt < 6) { await sleep(2000 * attempt); continue; }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e) {
      if (attempt >= 4) throw new Error(`${url}: ${e.message}`);
      await sleep(1000 * attempt);
    }
  }
}

// ── Text ────────────────────────────────────────────────────────────────────
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', eacute: 'é' };
const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
const text = (html) => decode(String(html || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** body_html → { story: [paragraphs], facts: [list items] } */
function describe(html) {
  const facts = [...String(html || '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => text(m[1])).filter(Boolean);
  const withoutLists = String(html || '').replace(/<(ul|ol)[^>]*>[\s\S]*?<\/\1>/gi, '\n');
  const story = withoutLists
    .split(/<\/p>|<br\s*\/?>\s*<br\s*\/?>|\n{2,}/i)
    .map(text)
    .filter((p) => p.length > 1);
  return { story, facts };
}

// ── Options ─────────────────────────────────────────────────────────────────
const optIndex = (product, re) => product.options.findIndex((o) => re.test(o.name));
const variantValue = (v, i) => (i < 0 ? null : v[`option${i + 1}`]);

function platingOf(value) {
  const v = String(value || '').toLowerCase();
  if (v.includes('rose')) return 'Rose Gold';
  if (v.includes('rhodium') || v.includes('silver') || v.includes('white')) return 'Rhodium';
  if (v.includes('gold')) return 'Gold';
  return null;
}

function sizesOf(values) {
  const nums = values.map(Number);
  if (nums.length && nums.every((n) => Number.isFinite(n))) {
    const lo = Math.min(...nums), hi = Math.max(...nums);
    return lo === hi ? `${lo}` : `${lo} – ${hi}`;
  }
  return values.join(', ');
}

/**
 * When one option alone explains every price difference ("Stone Type:
 * Moissanite costs more"), the piece page can say so. Null when the price is
 * flat, or when it moves with more than one option at once.
 */
function priceBy(product) {
  const prices = new Set(product.variants.map((v) => Number(v.price)));
  if (prices.size < 2) return null;
  for (let i = 0; i < product.options.length; i++) {
    const by = new Map();
    let consistent = true;
    for (const v of product.variants) {
      const key = variantValue(v, i), price = Number(v.price);
      if (by.has(key) && by.get(key) !== price) { consistent = false; break; }
      by.set(key, price);
    }
    if (consistent && new Set(by.values()).size > 1) {
      // In the option's own order. Sizes that share a price read as one range —
      // "3 – 7.5" rather than eight rows of the same figure.
      const ordered = product.options[i].values.filter((v) => by.has(v)).map((v) => ({ v, price: by.get(v) }));
      const numeric = ordered.every((x) => Number.isFinite(Number(x.v)));
      const values = [];
      for (const x of ordered) {
        const last = values[values.length - 1];
        if (numeric && last && last.price === x.price) { last.to = x.v; continue; }
        values.push({ ...x });
      }
      return {
        name: product.options[i].name,
        values: values.map(({ v, to, price }) => ({ v: to ? `${v} – ${to}` : v, price })),
      };
    }
  }
  return null;
}

const hash6 = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 6);
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const bareSrc = (src) => String(src).split('?')[0];

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const slugs = allGallerySlugs();
  const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  if (dupes.length) throw new Error(`Two galleries share a slug: ${dupes.join(', ')}`);

  console.log(`Reading ${STORE} …`);
  const products = [];
  for (let page = 1; page < 40; page++) {
    const batch = (await getJSON(`${STORE}/products.json?limit=250&page=${page}`)).products || [];
    products.push(...batch);
    if (batch.length < 250) break;
  }
  const collections = (await getJSON(`${STORE}/collections.json?limit=250`)).collections || [];
  const members = new Map();   // product handle → Set of collection handles
  for (const c of collections) {
    const list = (await getJSON(`${STORE}/collections/${c.handle}/products.json?limit=250`)).products || [];
    for (const p of list) {
      if (!members.has(p.handle)) members.set(p.handle, new Set());
      members.get(p.handle).add(c.handle);
    }
    await sleep(250);
  }
  const published = products.length;
  // Everything in the public feed is published on houseofmina.store; a piece
  // from it links to its product page there (`shop`). Drafts never do.
  const live = new Set(products.map((p) => p.handle));
  console.log(`  ${published} products, ${collections.length} collections`);

  // Drafts: not in the public feed, so kept in data/shopify-drafts.json (written
  // from the Admin API by scripts/drafts-from-admin.mjs). Treated exactly like a
  // published product; their collection memberships come with them.
  try {
    const drafts = JSON.parse(await fs.readFile(DRAFTS_PATH, 'utf8')).products || [];
    for (const d of drafts) {
      if (live.has(d.handle)) continue;   // published since it was drafted: the feed wins
      products.push(d);
      members.set(d.handle, new Set(d.collections || []));
    }
    console.log(`  + ${products.length - published} drafts from ${path.relative(ROOT, DRAFTS_PATH)}`);
  } catch (e) { if (e.code !== 'ENOENT') throw e; }

  // A feed that suddenly returns far fewer pieces is an outage, not a clearance.
  let prev = null;
  try {
    prev = JSON.parse(await fs.readFile(CATALOG_PATH, 'utf8'));
  } catch (e) { if (e.code !== 'ENOENT' && !/SyntaxError/.test(e.name)) throw e; }
  const before = prev?.published ?? prev?.pieces?.length;
  if (!FORCE && before && published < before * 0.6) {
    throw new Error(`Shopify returned ${published} published products; the catalogue had ${before}. Refusing to shrink it by that much — run with --force if this is real.`);
  }

  // A product Shopify renamed stays the piece it was (scripts/identity.mjs).
  let ids = {};
  try { ids = JSON.parse(await fs.readFile(IDS_PATH, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const kept = keptHandles(
    products.map((p) => ({ id: Number(p.id), handle: p.handle, photos: (p.images || []).map((img) => hash6(bareSrc(img.src))) })),
    (prev?.pieces || []).map((x) => ({ h: x.h, photos: (x.img || []).map((im) => photoHash(im.f)) })),
    ids,
  );
  if (kept.size) console.log(`  ${kept.size} renamed on Shopify, kept as the pieces they were: ${[...kept].slice(0, 5).map(([now, was]) => `${was} → ${now}`).join(', ')}${kept.size > 5 ? ' …' : ''}`);

  const editByHandle = new Map(EDITS.map((e) => [e.handle, e]));
  const sources = {};
  const pieces = [];

  for (const p of products) {
    const h = kept.get(p.handle) || p.handle;
    const tags = new Set((p.tags || []).map((t) => String(t).trim().toLowerCase()));
    const mem = members.get(p.handle) || new Set();
    const home = classify(p, tags, mem);

    const prices = p.variants.map((v) => Number(v.price)).filter((n) => Number.isFinite(n) && n > 0);
    const platingIdx = optIndex(p, /^plating$/i);
    const sizeIdx = optIndex(p, /size/i);
    const stoneIdx = optIndex(p, /stone/i);
    const finishIdx = optIndex(p, /finish/i);

    let plating = platingIdx >= 0 ? [...new Set(p.options[platingIdx].values.map(platingOf).filter(Boolean))] : [];
    if (!plating.length) {
      if (tags.has('21k gold plating') || tags.has('gold')) plating.push('Gold');
      if (tags.has('rhodium plating') || tags.has('rhodium plated') || tags.has('rhodium')) plating.push('Rhodium');
    }

    // Which plating a photograph shows, when Shopify ties the photo to variants
    // that all share one plating. Lets the piece page switch photos with the chip.
    const variantPlating = new Map(p.variants.map((v) => [v.id, platingOf(variantValue(v, platingIdx))]));

    const images = [...p.images].sort((a, b) => a.position - b.position).map((img, i) => {
      const f = `${h}/${i + 1}-${hash6(bareSrc(img.src))}`;
      sources[f] = img.src;
      const plates = new Set((img.variant_ids || []).map((id) => variantPlating.get(id)).filter(Boolean));
      return {
        f,
        w: img.width || 0,
        h: img.height || 0,
        ...(img.alt ? { alt: img.alt } : {}),
        ...(plates.size === 1 ? { plating: [...plates][0] } : {}),
      };
    });

    const { story, facts } = describe(p.body_html);
    const nickelFree = finishIdx >= 0 && p.options[finishIdx].values.some((v) => /nickel/i.test(v));

    pieces.push({
      h,
      // The shop's own handle, when it has moved on from the piece's: the link to houseofmina.store.
      ...(h !== p.handle ? { sh: p.handle } : {}),
      t: p.title.trim(),
      type: p.product_type || '',
      ch: chapterOf(home).slug,
      co: home,
      // Prices stay out of the catalogue while they are off (SHOW_PRICES); the option
      // that decides one is kept, without its figures, so an enquiry still names it.
      price: SHOW_PRICES && prices.length ? [Math.min(...prices), Math.max(...prices)] : null,
      ...(priceBy(p) ? { priceBy: SHOW_PRICES ? priceBy(p) : { ...priceBy(p), values: priceBy(p).values.map(({ v }) => ({ v })) } } : {}),
      plating,
      ...(sizeIdx >= 0 ? { size: { name: p.options[sizeIdx].name, range: sizesOf(p.options[sizeIdx].values) } } : {}),
      ...(stoneIdx >= 0 ? { stones: p.options[stoneIdx].values } : {}),
      ...(nickelFree ? { nickelFree: true } : {}),
      facets: facetsOf(tags),
      story,
      facts,
      edits: [...mem].map((h) => editByHandle.get(h)?.slug).filter(Boolean),
      at: (p.published_at || p.created_at || '').slice(0, 10),
      img: images,
      ...(live.has(p.handle) ? { shop: true } : {}),
    });
  }

  // Newest first — the order a gallery shows by default.
  pieces.sort((a, b) => b.at.localeCompare(a.at) || a.t.localeCompare(b.t));

  // The address of a piece comes from its name (/rings-and-bands/adele), not
  // Shopify's handle, which is often a stock code. Where two pieces share a
  // name, the one whose handle already is that slug keeps it (then the
  // shortest handle); the others use their handle, which Shopify keeps unique.
  // Deterministic, so a sync never moves a piece's address by itself.
  const bySlug = new Map();
  for (const piece of pieces) {
    const s = slugify(piece.t) || piece.h;
    if (!bySlug.has(s)) bySlug.set(s, []);
    bySlug.get(s).push(piece);
  }
  for (const [s, group] of bySlug) {
    const winner = group.find((x) => x.h === s || x.sh === s) || [...group].sort((a, b) => a.h.length - b.h.length || a.h.localeCompare(b.h))[0];
    for (const piece of group) piece.s = piece === winner ? s : piece.h;
  }

  const edits = EDITS.map((e) => {
    const c = e.handle && collections.find((x) => x.handle === e.handle);
    const count = pieces.filter((p) => p.edits.includes(e.slug)).length;
    return { slug: e.slug, title: e.title, blurb: text(c?.body_html || '') || e.blurb || '', count };
  }).filter((e) => e.count > 0);

  const catalog = { syncedAt: new Date().toISOString(), source: STORE, count: pieces.length, published, edits, pieces };
  await fs.mkdir(path.dirname(SOURCES_PATH), { recursive: true });
  await fs.writeFile(CATALOG_PATH, JSON.stringify(catalog) + '\n');
  await fs.writeFile(SOURCES_PATH, JSON.stringify(sources, null, 0).replace(/","/g, '",\n"') + '\n');
  // Each piece's Shopify product id, so a rename is recognised next time without the photos.
  const idsNow = Object.fromEntries(products.filter((p) => Number(p.id) > 0)
    .map((p) => [kept.get(p.handle) || p.handle, Number(p.id)]).sort(([a], [b]) => a.localeCompare(b)));
  await fs.writeFile(IDS_PATH, JSON.stringify(idsNow, null, 0).replace(/,"/g, ',\n"') + '\n');

  // A readable summary of where everything landed.
  for (const ch of CHAPTERS) {
    console.log(`  ${ch.title.padEnd(22)} ${String(pieces.filter((p) => p.ch === ch.slug).length).padStart(4)}`);
    for (const k of ch.collections || []) console.log(`    ${k.title.padEnd(20)} ${String(pieces.filter((p) => p.co === k.slug).length).padStart(4)}`);
  }
  console.log(`  Edits: ${edits.map((e) => `${e.title} ${e.count}`).join(' · ')}`);
  console.log(`Wrote ${pieces.length} pieces, ${Object.keys(sources).length} photographs.`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
