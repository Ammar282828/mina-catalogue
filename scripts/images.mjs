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
// These folders are gitignored; CI runs this same script (with a cache) and
// rsyncs the result, so photography never has to enter the repository.

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { localFile, localImageIds, renderKey } from '../src/lib/catalog.js';

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
      if (attempt >= 4) throw new Error(`${src}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

async function build(f, src) {
  const input = await fetchImage(src);
  for (const v of VARIANTS) {
    const out = outPath(v.dir, f);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await sharp(input)
      .rotate()
      .resize({ width: v.maxEdge, height: v.maxEdge, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: v.quality, effort: 5 })
      .toFile(out);
  }
}

const todo = Object.entries(SOURCES).filter(([f]) => FORCE || VARIANTS.some((v) => !existsSync(outPath(v.dir, f))));
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
if (failed) process.exit(1);
