// Weights from Mina's ERP → data/weights.json (commit it).
//
// The counter links an inventory product (hom-pos Firestore `products`) to a catalogue piece:
// `catalogueId` is the piece's handle here (`local-dsc09665`, a Shopify piece's handle) and
// `metalWeightG` its weight. A ring with a weight shows a price on the catalogue
// (catalog.js `weightPrice`, the owner, 2026-11-09). Run after linking more pieces:
//
//   npm run weights
//
// Needs a Google login that can read hom-pos's Firestore: gcloud's (`gcloud auth print-access-token`),
// e.g. the cloud sessions' claude-cloud@gemstrack-pos account or the owner's ADC on the Mac.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = process.env.WEIGHTS_PROJECT || 'hom-pos-52710474-ceeea';
const env = { ...process.env };
delete env.CLOUDSDK_AUTH_ACCESS_TOKEN; // a placeholder in cloud sessions; gcloud answers UNAUTHENTICATED with it
const token = execFileSync('gcloud', ['auth', 'print-access-token'], { env, encoding: 'utf8' }).trim();

const val = (f) => (f ? Object.values(f)[0] : undefined);
const docs = [];
let pageToken = '';
do {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/products?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Firestore ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d = await r.json();
  docs.push(...(d.documents || []));
  pageToken = d.nextPageToken || '';
} while (pageToken);

const pieces = {};
for (const doc of docs) {
  const f = doc.fields || {};
  const id = val(f.catalogueId);
  const g = Number(val(f.metalWeightG));
  if (typeof id !== 'string' || !id || !(g > 0)) continue;
  // Two products on one piece: the later-edited wins.
  const at = doc.updateTime || '';
  if (!pieces[id] || pieces[id].at < at) pieces[id] = { g: Math.round(g * 1000) / 1000, sku: val(f.sku) || '', at };
}
const out = {
  source: `hom-pos products (catalogueId → metalWeightG)`,
  syncedAt: new Date().toISOString(),
  pieces: Object.fromEntries(Object.entries(pieces).sort(([a], [b]) => a.localeCompare(b)).map(([h, { g, sku }]) => [h, { g, sku }])),
};
await fs.writeFile(path.join(ROOT, 'data', 'weights.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(`${docs.length} products, ${Object.keys(out.pieces).length} linked to a catalogue piece with a weight → data/weights.json`);
