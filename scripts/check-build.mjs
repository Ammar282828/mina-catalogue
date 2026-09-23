// The deploy gate: refuse to ship a build that lost the catalogue or any of the
// images its pages show (Shopify's and the house's own, data/local.json).
import fs from 'node:fs';
import { mergeLocal } from '../src/lib/catalog.js';

const shopify = JSON.parse(fs.readFileSync('src/catalog.json', 'utf8'));
const local = JSON.parse(fs.readFileSync('data/local.json', 'utf8'));
const renders = JSON.parse(fs.readFileSync('data/renders.json', 'utf8'));
const pieces = mergeLocal(shopify, local, renders).pieces;
const pages = fs.readdirSync('dist', { recursive: true }).filter((f) => f.endsWith('.html')).length;
const missing = pieces.flatMap((p) => p.img).filter((i) => i.f && (!fs.existsSync(`dist/catalog-thumb/${i.f}.webp`) || !fs.existsSync(`dist/catalog-full/${i.f}.webp`)));

console.log(`pieces: ${pieces.length} (Shopify ${shopify.pieces.length})   documents: ${pages}   images missing: ${missing.length}`);
const fail = (m) => { console.error(m); process.exit(1); };
if (shopify.pieces.length < 150) fail('catalog.json looks truncated — refusing to deploy');
if (pages < 200) fail('too few prerendered pages — refusing to deploy');
if (missing.length) fail(`images missing: ${missing.slice(0, 5).map((i) => i.f).join(', ')}`);
