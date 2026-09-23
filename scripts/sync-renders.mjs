// Brings the 3D renders onto the site as they are made.
//
//   node scripts/sync-renders.mjs            upload new/changed renders, update data/renders.json
//   node scripts/sync-renders.mjs --publish  …then commit data/renders.json and push (the deploy does the rest)
//
// The renders are made elsewhere (the owner's render session) and land in iCloud:
// heroes-white-1500/3d-renders/DSC#####.png — the same names as the images in
// data/local.json. On this Mac a new one first appears as an iCloud placeholder
// ("dataless"); this asks iCloud for it and takes it on a later pass. A render
// that is ready goes to the server (catalog-src/local-3d/, chmod 644 — iCloud
// files are 600 and would be refused) and into data/renders.json with a hash of
// its bytes, so a re-rolled render gets a new file name everywhere.
//
// Owner's Mac only: it needs iCloud and the deploy key (~/.ssh/taheri_deploy).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = process.env.RENDERS_DIR || path.join(os.homedir(), 'Library/Mobile Documents/com~apple~CloudDocs/heroes-white-1500/3d-renders');
const SOURCE_DIR = path.dirname(DIR);
const RENDERS = path.join(ROOT, 'data', 'renders.json');
const SSH = ['-i', path.join(os.homedir(), '.ssh/taheri_deploy'), '-p', '65002', '-o', 'IdentitiesOnly=yes', '-o', 'ConnectTimeout=30'];
const HOST = 'u870899616@145.79.26.82';
const REMOTE = 'domains/catalogue.houseofmina.store/public_html/catalog-src/local-3d';
const PUBLISH = process.argv.includes('--publish');

const isPlaceholder = (file) => /dataless/.test(execFileSync('stat', ['-f', '%Sf', file], { encoding: 'utf8' }));
const pngs = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^DSC\d+\.png$/i.test(f)) : []);

const renders = JSON.parse(fs.readFileSync(RENDERS, 'utf8'));
const files = pngs(DIR);
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'mina-renders-'));
const fresh = [];
let waiting = 0;

for (const f of files) {
  const file = path.join(DIR, f);
  const id = f.replace(/\.png$/i, '');
  if (isPlaceholder(file)) {
    waiting++;
    spawn('brctl', ['download', file], { detached: true, stdio: 'ignore' }).unref();   // ask; take it next pass
    continue;
  }
  const bytes = fs.readFileSync(file);
  const v = crypto.createHash('sha1').update(bytes).digest('hex').slice(0, 8);
  if (renders[id]?.v === v) continue;
  const meta = await sharp(bytes).metadata();
  fs.writeFileSync(path.join(stage, f), bytes);
  fresh.push({ id, v, w: meta.width, h: meta.height });
}

if (fresh.length) {
  execFileSync('ssh', [...SSH, HOST, `mkdir -p ${REMOTE}`]);
  execFileSync('rsync', ['-t', '-e', `ssh ${SSH.join(' ')}`, ...fresh.map((r) => path.join(stage, `${r.id}.png`)), `${HOST}:${REMOTE}/`]);
  execFileSync('ssh', [...SSH, HOST, `chmod 644 ${REMOTE}/*.png`]);
  for (const r of fresh) renders[r.id] = { v: r.v, w: r.w, h: r.h };
  const sorted = Object.fromEntries(Object.entries(renders).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(RENDERS, JSON.stringify(sorted, null, 1).replace(/\{\n\s+"v"/g, '{ "v"').replace(/,\n\s+"(w|h)"/g, ', "$1"').replace(/\n\s+\}/g, ' }') + '\n');
}
fs.rmSync(stage, { recursive: true, force: true });

const total = pngs(SOURCE_DIR).length;
const done = Object.keys(renders).length;
console.log(`${new Date().toISOString().slice(11, 19)}  renders: ${fresh.length} new/changed, ${waiting} still downloading, ${done} on the site of ${total} images${done >= total && !waiting ? ' — all in' : ''}`);

if (PUBLISH && fresh.length) {
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' });
  git('add', 'data/renders.json');
  git('commit', '-m', `3D renders: ${fresh.length} more (${done} of ${total})\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, '--', 'data/renders.json');
  git('push', '-q');
  console.log(`  pushed — the deploy builds the new photographs (${fresh.map((r) => r.id).join(', ')})`);
}
// Exit 3 when every image has its render and nothing is waiting: the loop can stop.
process.exitCode = done >= total && !waiting ? 3 : 0;
