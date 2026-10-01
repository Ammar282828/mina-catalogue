// Tells IndexNow (Bing, Yandex, Seznam, Naver — Bing's index is what ChatGPT, Copilot and DuckDuckGo
// search read) which catalogue addresses changed, so they are re-read in hours rather than weeks.
// Google does not take part; its way in is the sitemap in Search Console.
//
//   node scripts/indexnow.mjs            addresses whose sitemap lastmod is within the last 3 days
//   node scripts/indexnow.mjs --all      every address in the sitemap (after a site-wide change)
//
// The key is public/indexnow.txt, served at https://catalogue.houseofmina.store/indexnow.txt (IndexNow reads it there
// to check the request is the site's own). Run after the deploy has put the new pages up.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'catalogue.houseofmina.store';
const key = fs.readFileSync(path.join(root, 'public', 'indexnow.txt'), 'utf8').trim();
const sitemap = ['dist', 'public'].map((d) => path.join(root, d, 'sitemap.xml')).find((f) => fs.existsSync(f));
const xml = fs.readFileSync(sitemap, 'utf8');
const all = process.argv.includes('--all');
const since = Date.now() - 3 * 86_400_000;
const urls = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)]
  .filter(([, , lastmod]) => all || (lastmod && Date.parse(lastmod) >= since))
  .map(([, loc]) => loc);
if (!urls.length) { console.log('IndexNow: nothing changed in the last 3 days'); process.exit(0); }
for (let i = 0; i < urls.length; i += 10_000) {
  const urlList = urls.slice(i, i + 10_000);
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/indexnow.txt`, urlList }),
    signal: AbortSignal.timeout(30_000),
  });
  console.log(`IndexNow: ${urlList.length} addresses → ${res.status} ${res.statusText}`);
  if (res.status >= 400) process.exitCode = 1;
}
