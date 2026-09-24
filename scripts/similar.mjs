// What to show beside a piece (the owner, 2026-09-25: "heavily add recommendation, upselling
// algorithms"): for every piece, the pieces most like it and the pieces that go with it
// (earrings and a pendant for a ring, a ring for a bangle, a set for earrings …).
//
//   npm run similar           embed pieces that have no embedding yet, then rank (owner's Mac)
//   SIMILAR_OFFLINE=1 npm run similar      rank only, from the committed embeddings
//
// 1. Embed: Vertex multimodalembedding@001 (256 numbers per photograph; project
//    jewelgen-mm-e3d43ecb, mmurtaza1970's ADC, the owner's ask; ~$0.0001 a photograph) looks at
//    the photograph a gallery tile shows. Stored in data/embeddings.json (int8, base64) by piece
//    slug, committed, so a re-run only sends new pieces.
// 2. Rank, locally, into data/recommend.json (buildCatalog reads it): how alike two photographs
//    look (cosine of their embeddings) plus plating, stones, occasion and style, and how pretty
//    each is (data/pretty.json). Kinds and what goes with what: src/lib/recommend.js.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog, mergeLocal, imageUrls } from '../src/lib/catalog.js';
import { KIND, GOES_WITH } from '../src/lib/recommend.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EMB = path.join(ROOT, 'data', 'embeddings.json');
const OUT = path.join(ROOT, 'data', 'recommend.json');
const ADC = process.env.SIMILAR_ADC || path.join(os.homedir(), '.config/gcloud/legacy_credentials/mmurtaza1970@gmail.com/adc.json');
const PROJECT = process.env.SIMILAR_PROJECT || 'jewelgen-mm-e3d43ecb';
const MODEL = 'multimodalembedding@001';
const DIM = 256;
const PARALLEL = 6;

const read = async (f) => JSON.parse(await fs.readFile(path.join(ROOT, f), 'utf8'));

// What a piece is and what goes with what: KIND and GOES_WITH in src/lib/recommend.js, which
// the site's own fallbacks use too.

// ── 1. Embeddings ───────────────────────────────────────────────────────────
let token = null, tokenAt = 0;
async function bearer() {
  if (token && Date.now() - tokenAt < 45 * 60e3) return token;
  const c = JSON.parse(await fs.readFile(ADC, 'utf8'));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: c.client_id, client_secret: c.client_secret, refresh_token: c.refresh_token }),
  });
  if (!r.ok) throw new Error(`token: ${r.status}`);
  token = (await r.json()).access_token; tokenAt = Date.now();
  return token;
}
async function embed(file) {
  const body = JSON.stringify({ instances: [{ image: { bytesBase64Encoded: (await fs.readFile(file)).toString('base64') } }], parameters: { dimension: DIM } });
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = await fetch(`https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/us-central1/publishers/google/models/${MODEL}:predict`, {
      method: 'POST', headers: { Authorization: `Bearer ${await bearer()}`, 'Content-Type': 'application/json', 'x-goog-user-project': PROJECT }, body,
    });
    if (r.ok) {
      const v = (await r.json()).predictions?.[0]?.imageEmbedding;
      if (v?.length === DIM) return v;
    }
    await new Promise((res) => setTimeout(res, (r.status === 429 ? 6e3 : 2e3) * (attempt + 1)));
  }
  return null;
}
// Unit length, then int8: 256 bytes a piece, and a cosine is a dot product.
const pack = (v) => { const n = Math.hypot(...v) || 1; return Buffer.from(Int8Array.from(v, (x) => Math.max(-127, Math.min(127, Math.round((x / n) * 127)))).buffer).toString('base64'); };
const unpack = (s) => { const b = Buffer.from(s, 'base64'); const a = new Float32Array(DIM); let n = 0; for (let i = 0; i < DIM; i++) { a[i] = (b[i] << 24 >> 24); n += a[i] * a[i]; } n = Math.sqrt(n) || 1; for (let i = 0; i < DIM; i++) a[i] /= n; return a; };

const shopify = await read('src/catalog.json');
const [local, renders, lead, framed] = await Promise.all(['data/local.json', 'data/renders.json', 'data/lead.json', 'data/framed.json'].map(read));
let pretty = {};
try { pretty = (await read('data/pretty.json')).pieces || {}; } catch { /* not scored yet */ }
const cat = buildCatalog({ ...mergeLocal(shopify, local, renders), lead, framed }, []);
const pieces = cat.pieces.filter((p) => KIND[p.co]);
const id = (p) => p.s || p.h;
// The photograph that was embedded, so a new lead photograph is embedded again.
const photoOf = (p) => imageUrls(p.img[0]).thumb.split('?')[0];

let store = { _about: '', model: MODEL, dim: DIM, vectors: {} };
try { store = JSON.parse(await fs.readFile(EMB, 'utf8')); } catch { /* first run */ }
store._about = `Each piece's gallery photograph as ${DIM} numbers (${MODEL}; unit length, int8, base64) and the photograph it was taken from, by piece slug. Written by scripts/similar.mjs; only the recommendations read it.`;
const saveEmb = () => fs.writeFile(EMB, JSON.stringify({ ...store, vectors: Object.fromEntries(Object.entries(store.vectors).sort()) }).replace(/,"/g, ',\n"') + '\n');

if (!process.env.SIMILAR_OFFLINE) {
  const todo = pieces.filter((p) => store.vectors[id(p)]?.photo !== photoOf(p));
  console.log(`${pieces.length} pieces; ${todo.length} to embed.`);
  let i = 0, done = 0;
  await Promise.all(Array.from({ length: PARALLEL }, async () => {
    while (i < todo.length) {
      const p = todo[i++];
      const v = await embed(path.join(ROOT, 'public', photoOf(p))).catch(() => null);
      if (v) store.vectors[id(p)] = { photo: photoOf(p), v: pack(v) };
      if (++done % 50 === 0) { await saveEmb(); console.log(`${done}/${todo.length}`); }
    }
  }));
  await saveEmb();
  console.log(`Embedded; ${Object.keys(store.vectors).length} pieces have one.`);
}

// ── 2. Rank ─────────────────────────────────────────────────────────────────
const scores = Object.values(pretty).sort((a, b) => a - b);
const median = scores.length ? scores[scores.length >> 1] : 50;
const COMMON = new Set(['American Diamond', 'No Stone']);
const items = pieces.filter((p) => store.vectors[id(p)]).map((p) => ({
  id: id(p), kind: KIND[p.co], co: p.co, v: unpack(store.vectors[id(p)].v),
  plating: new Set(p.plating || []),
  stones: new Set((p.facets?.stone || []).filter((s) => !COMMON.has(s))),
  occasion: new Set(p.facets?.occasion || []), style: new Set(p.facets?.style || []),
  pretty: ((pretty[id(p)] ?? median) - 50) / 50,
}));
const index = new Map(items.map((it, n) => [it.id, n]));
const byKind = new Map();
for (const it of items) { if (!byKind.has(it.kind)) byKind.set(it.kind, []); byKind.get(it.kind).push(it); }
const dot = (a, b) => { let s = 0; for (let i = 0; i < DIM; i++) s += a[i] * b[i]; return s; };
const meets = (a, b) => { for (const x of a) if (b.has(x)) return true; return false; };

// Gold with gold, rhodium with rhodium: a plating in common, or a clash.
const platingFit = (a, b) => (!a.plating.size || !b.plating.size ? 0 : meets(a.plating, b.plating) ? 0.08 : -0.14);
const SAME_PIECE = 0.975;   // the same piece photographed twice is no recommendation

// Greedy pick with a penalty for looking like what was already picked (maximal marginal
// relevance), so a list is not eight photographs of one design.
function diverse(scored, n, lambda = 0.82) {
  const pool = scored.slice(0, n * 6);
  const out = [];
  while (out.length < n && pool.length) {
    let best = -1, bestS = -Infinity;
    for (let j = 0; j < pool.length; j++) {
      const c = pool[j];
      const red = out.length ? Math.max(...out.map((o) => dot(o.it.v, c.it.v))) : 0;
      if (red > SAME_PIECE) continue;
      const s = lambda * c.s - (1 - lambda) * red;
      if (s > bestS) { bestS = s; best = j; }
    }
    if (best < 0) break;
    out.push(pool.splice(best, 1)[0]);
  }
  return out;
}

// A piece that looks a little like everything would stand beside every piece of another kind
// (a "hub"). Each candidate's pull on a kind is the mean of its ten closest in that kind, and
// counts against it (cross-domain similarity local scaling), so each piece gets its own match.
const pull = new Map();   // `${it.id}|${kind}` → mean of top-10 cosines
function pullOf(b, kind) {
  const k = `${b.id}|${kind}`;
  if (!pull.has(k)) {
    const top = (byKind.get(kind) || []).map((a) => dot(a.v, b.v)).sort((x, y) => y - x).slice(0, 10);
    pull.set(k, top.length ? top.reduce((s, x) => s + x, 0) / top.length : 0);
  }
  return pull.get(k);
}

const like = [], pair = [];
for (const a of items) {
  const scored = [];
  for (const b of byKind.get(a.kind)) {
    if (b === a) continue;
    const cos = dot(a.v, b.v);
    if (cos > SAME_PIECE) continue;
    scored.push({ it: b, s: cos + (b.co === a.co ? 0.03 : 0) + (meets(a.stones, b.stones) ? 0.04 : 0) + platingFit(a, b) * 0.4 + (meets(a.style, b.style) ? 0.02 : 0) + b.pretty * 0.04 });
  }
  scored.sort((x, y) => y.s - x.s);
  like.push(diverse(scored, 12).map((c) => index.get(c.it.id)));
}

// Complete the look, in a second pass: prettiest pieces choose first, and each time a piece is
// chosen it costs a little more next time (LOAD), so a few crowd-pleasers do not stand beside
// every piece of another kind.
const LOAD = 0.003;
const uses = new Map();
for (const n of items.map((_, n) => n).sort((x, y) => items[y].pretty - items[x].pretty)) {
  const a = items[n];
  const out = [];
  for (const kind of GOES_WITH[a.kind] || []) {
    const cands = (byKind.get(kind) || []).map((b) => ({
      it: b,
      s: dot(a.v, b.v) - 0.5 * pullOf(b, a.kind) + platingFit(a, b) + b.pretty * 0.06 - LOAD * (uses.get(b) || 0) + (meets(a.stones, b.stones) ? 0.08 : 0) + (meets(a.occasion, b.occasion) ? 0.03 : 0) + (meets(a.style, b.style) ? 0.03 : 0),
    })).sort((x, y) => y.s - x.s);
    out.push(...diverse(cands, 2, 0.85).map((c) => ({ n: index.get(c.it.id), s: c.s })));
  }
  for (const c of out) uses.set(items[c.n], (uses.get(items[c.n]) || 0) + 1);
  pair[n] = out.sort((x, y) => y.s - x.s).map((c) => c.n);
}

await fs.writeFile(OUT, JSON.stringify({
  _about: 'What to show beside each piece (indices into keys, piece slugs): like = more like it (same kind), pair = goes with it (other kinds). Written by scripts/similar.mjs from data/embeddings.json + pretty.json; buildCatalog (catalog.js) reads it.',
  keys: items.map((it) => it.id), like, pair,
}).replace(/\],\[/g, '],\n['));
console.log(`Ranked ${items.length} pieces → ${path.relative(ROOT, OUT)}.`);
