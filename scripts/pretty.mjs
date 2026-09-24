// How pretty each piece looks, for the gallery order (the owner, 2026-09-24: every
// collection opens with its new pieces, prettiest first, then the rest, prettiest first).
//
//   npm run pretty            score every piece that has no score yet (owner's Mac only)
//
// Gemini 3.8 Flash on Vertex (project jewelgen-mm-e3d43ecb, billed to Murtaza; the owner's
// ask) looks at the photograph a gallery tile shows — the piece's first image — and scores
// it 1–100. Signed with mmurtaza1970's ADC (~/.config/gcloud/legacy_credentials/…/adc.json).
// Scores go into data/pretty.json by piece slug and are committed; the build only reads
// them. A piece without a score sorts as the median. Re-running is cheap: only new pieces
// are sent. PRETTY_RESCORE=1 scores everything again.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog, mergeLocal, imageUrls } from '../src/lib/catalog.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'pretty.json');
const ADC = process.env.PRETTY_ADC || path.join(os.homedir(), '.config/gcloud/legacy_credentials/mmurtaza1970@gmail.com/adc.json');
const PROJECT = process.env.PRETTY_PROJECT || 'jewelgen-mm-e3d43ecb';
const MODEL = 'gemini-3.8-flash'; // Pro queues bulk requests on this project (20 took 108 s); Flash scores ~2/s
const PARALLEL = 4;

const read = async (f) => JSON.parse(await fs.readFile(path.join(ROOT, f), 'utf8'));

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

const PROMPT = (gallery) => `You are the creative director of House of Mina, a Karachi jewellery house (925 sterling silver, 21k gold or rhodium plating, simulated stones). This is the photograph a shopper sees as a tile in the catalogue's ${gallery} gallery. Rate how pretty it is to a woman shopping for jewellery: the beauty and finesse of the design, sparkle and colour, how desirable it looks, and how well the photograph shows it (sharp, well lit, flattering, clean). Ignore the small MINA wordmark. Before judging a hand, count its fingers carefully. Score 1-100; keep 90+ for pieces that would stop someone scrolling, and use the whole range.`;

const BATCH = 12;
// Up to BATCH photographs of one gallery in one request, each labelled, scored together:
// far fewer requests (the project's limit is per request), and each photo is judged beside
// its neighbours.
async function scoreBatch(files, gallery) {
  const parts = [];
  for (let n = 0; n < files.length; n++) {
    parts.push({ text: `Photo ${n + 1}:` });
    parts.push({ inlineData: { mimeType: 'image/webp', data: (await fs.readFile(files[n])).toString('base64') } });
  }
  parts.push({ text: `${PROMPT(gallery)} There are ${files.length} photos, each is a separate tile; score every one of them on its own merits, by its number.` });
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: {
      type: 'OBJECT', properties: { scores: { type: 'ARRAY', items: { type: 'OBJECT', properties: { photo: { type: 'INTEGER' }, score: { type: 'INTEGER' } }, required: ['photo', 'score'] } } }, required: ['scores'] } },
  };
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = await fetch(`https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${MODEL}:generateContent`, {
      method: 'POST', headers: { Authorization: `Bearer ${await bearer()}`, 'Content-Type': 'application/json', 'x-goog-user-project': PROJECT }, body: JSON.stringify(body),
    });
    if (r.ok) {
      const d = await r.json();
      const out = new Map();
      for (const x of JSON.parse(d.candidates[0].content.parts.map((p) => p.text || '').join('')).scores || []) {
        if (x.photo >= 1 && x.photo <= files.length) out.set(x.photo - 1, Math.max(1, Math.min(100, Math.round(x.score))));
      }
      return out;
    }
    await new Promise((res) => setTimeout(res, (r.status === 429 ? 8e3 : 3e3) * (attempt + 1)));
  }
  return new Map();
}

const shopify = await read('src/catalog.json');
const [local, renders, lead, framed] = await Promise.all(['data/local.json', 'data/renders.json', 'data/lead.json', 'data/framed.json'].map(read));
const cat = buildCatalog({ ...mergeLocal(shopify, local, renders), lead, framed }, []);
let saved = { _about: '', pieces: {} };
try { saved = JSON.parse(await fs.readFile(OUT, 'utf8')); } catch { /* first run */ }
saved._about = 'How pretty each piece looks (1–100, Gemini 3.8 Flash on its gallery photograph), by piece slug. Written by scripts/pretty.mjs; the gallery order reads it (catalog.js).';
const todo = cat.pieces.filter((p) => process.env.PRETTY_RESCORE || saved.pieces[p.s || p.h] === undefined);
console.log(`${cat.pieces.length} pieces; ${todo.length} to score.`);

let done = 0;
const save = () => fs.writeFile(OUT, JSON.stringify({ ...saved, pieces: Object.fromEntries(Object.entries(saved.pieces).sort()) }, null, 0).replace(/,"/g, ',\n"') + '\n');
const byGallery = new Map();
for (const p of todo) {
  const g = cat.galleries.get(p.co)?.title || 'jewellery';
  if (!byGallery.has(g)) byGallery.set(g, []);
  byGallery.get(g).push(p);
}
const batches = [...byGallery].flatMap(([g, list]) => Array.from({ length: Math.ceil(list.length / BATCH) }, (_, k) => ({ g, list: list.slice(k * BATCH, (k + 1) * BATCH) })));
let b = 0;
async function worker() {
  while (b < batches.length) {
    const { g, list } = batches[b++];
    const files = list.map((p) => path.join(ROOT, 'public', imageUrls(p.img[0]).thumb.split('?')[0]));
    const got = await scoreBatch(files, g).catch(() => new Map());
    got.forEach((s, n) => { saved.pieces[list[n].s || list[n].h] = s; });
    done += list.length;
    await save(); console.log(`${done}/${todo.length}`);
  }
}
await Promise.all(Array.from({ length: PARALLEL }, worker));
await save();
console.log(`Scored ${done}; ${Object.keys(saved.pieces).length} pieces have a score.`);
