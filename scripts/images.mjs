// Build this site's own copies of every photograph in data/image-sources.json.
//
//   npm run images            only what is missing
//   npm run images -- --force re-encode everything (after changing VARIANTS)
//
// Each source is fetched once, at a width no larger than the full variant needs
// (Shopify's CDN resizes on request), and written as two WebPs:
//
//   public/catalog-thumb/<handle>/<n>-<hash>.webp   720px  — gallery tiles
//   public/catalog-full/<handle>/<n>-<hash>.webp   2000px  — the piece page
//
// The hash in the name is of the source URL, so a photo replaced in Shopify
// gets a new file rather than silently keeping the old one under a cached URL.
// Photographs in data/local.json come from catalog-src/local/ on the server.
// Every photograph of a ring is given standard whitespace first (scripts/whitespace.mjs):
// which ones were re-framed is kept beside the variants (catalog-full/.framing.json, so a
// cached variant is not framed twice) and in data/framed.json, which the site reads.
// These folders are gitignored; CI runs this same script (with a cache) and
// rsyncs the result, so photography never has to enter the repository.

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { localFile, localImageIds, renderKey, mergeLocal, RING_HOMES, PHOTO_VERSION } from '../src/lib/catalog.js';
import { standardWhitespace, VERSION as FRAMING } from './whitespace.mjs';
import { brand } from './brand.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'image-sources.json'), 'utf8'));
// The house's own images (data/local.json): originals on the server, never in git.
const LOCAL = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'local.json'), 'utf8'));
const LOCAL_ORIGIN = 'https://catalogue.houseofmina.store/catalog-src/local';
for (const id of localImageIds(LOCAL)) {
  SOURCES[`local/${id.replace(/\.[a-z0-9]+$/i, '')}`] = `${LOCAL_ORIGIN}/${localFile(id)}`;
}
// Their 3D renders (data/renders.json), uploaded by scripts/sync-renders.mjs.
const RENDERS = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'renders.json'), 'utf8'));
const USED = new Set(localImageIds(LOCAL).map((id) => id.replace(/\.[a-z0-9]+$/i, '')));
for (const [id, r] of Object.entries(RENDERS)) {
  if (!USED.has(id)) continue;   // a held image's render is not shown either
  SOURCES[renderKey(id, r)] = `https://catalogue.houseofmina.store/catalog-src/local-3d/${id}.png?v=${r.v}`;
}
const FORCE = process.argv.includes('--force');
const CONCURRENCY = 6;

// The photographs of rings, by variant key.
const CATALOG = JSON.parse(await fs.readFile(path.join(ROOT, 'src', 'catalog.json'), 'utf8'));
const RINGS = new Set(mergeLocal(CATALOG, LOCAL, RENDERS).pieces
  .filter((p) => RING_HOMES.includes(p.co)).flatMap((p) => p.img.map((im) => im.f)).filter(Boolean));
const RECORD = path.join(ROOT, 'public', 'catalog-full', '.framing.json');
let record = {};
try {
  const r = JSON.parse(await fs.readFile(RECORD, 'utf8'));
  if (r.version === FRAMING) record = r.framed || {};
} catch { /* first run, or a new framing version: every ring is framed again */ }

// The MINA wordmark goes on every photograph not already carrying it (data/marked.json);
// which variants carry it at PHOTO_VERSION is kept beside them.
const MARKED = new Set(JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'marked.json'), 'utf8')).marked);
const BRANDING = path.join(ROOT, 'public', 'catalog-full', '.branding.json');
let branded = {};
try {
  const r = JSON.parse(await fs.readFile(BRANDING, 'utf8'));
  if (r.version === PHOTO_VERSION) branded = r.done || {};
} catch { /* first run, or a new PHOTO_VERSION: every photograph is branded again */ }

export const VARIANTS = [
  { dir: 'catalog-thumb', maxEdge: 720, quality: 74 },
  { dir: 'catalog-full', maxEdge: 2000, quality: 84 },
];
const FETCH_WIDTH = 2000;

const outPath = (dir, f) => path.join(ROOT, 'public', dir, `${f}.webp`);

async function fetchImage(src) {
  const url = `${src}${src.includes('?') ? '&' : '?'}width=${FETCH_WIDTH}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'mina-catalogue-images/1.0' } });
      if (!res.ok) throw new Error(`${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      // Our own host (catalog-src/) sometimes refuses a runner for a minute; be patient with it.
      const ours = src.includes('catalogue.houseofmina.store');
      if (attempt >= (ours ? 7 : 4)) throw new Error(`${src}: ${e.message}`);
      await new Promise((r) => setTimeout(r, ours ? 2000 * 2 ** attempt : 1500 * attempt));
    }
  }
}

async function build(f, src) {
  let input = await fetchImage(src);
  if (RINGS.has(f)) {
    const r = await standardWhitespace(input);
    record[f] = r.framed;
    input = r.buffer;
  }
  if (!MARKED.has(f)) input = await brand(input);
  for (const v of VARIANTS) {
    const out = outPath(v.dir, f);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await sharp(input)
      .rotate()
      .resize({ width: v.maxEdge, height: v.maxEdge, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: v.quality, effort: 5 })
      .toFile(out);
  }
  if (!MARKED.has(f)) branded[f] = true;
}

const todo = Object.entries(SOURCES).filter(([f]) => FORCE || VARIANTS.some((v) => !existsSync(outPath(v.dir, f)))
  || (RINGS.has(f) && !(f in record)) || (!MARKED.has(f) && !branded[f]));
console.log(`${Object.keys(SOURCES).length} photographs; ${todo.length} to build.`);

let done = 0, failed = 0;
const queue = [...todo];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const [f, src] = queue.shift();
    try { await build(f, src); done++; }
    catch (e) { failed++; console.error(`  ✗ ${f}: ${e.message}`); }
    if ((done + failed) % 50 === 0) console.log(`  ${done + failed} / ${todo.length}`);
  }
}));
console.log(`Built ${done}${failed ? `, ${failed} failed` : ''}.`);

await fs.mkdir(path.dirname(RECORD), { recursive: true });
await fs.writeFile(RECORD, JSON.stringify({ version: FRAMING, framed: record }));
await fs.writeFile(BRANDING, JSON.stringify({ version: PHOTO_VERSION, done: branded }));
const framed = [...RINGS].filter((f) => record[f]).sort();
await fs.writeFile(path.join(ROOT, 'data', 'framed.json'), `${JSON.stringify({ version: FRAMING, framed }, null, 0).replace(/","/g, '",\n"')}\n`);
console.log(`Rings: ${framed.length} of ${RINGS.size} photographs given standard whitespace; the rest are scenes, left as they are.`);
if (failed) process.exit(1);
