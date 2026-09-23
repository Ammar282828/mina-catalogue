// After `vite build`: one static HTML document per route, plus the files
// search engines and the POS read.
//
//   dist/index.html, dist/rings-and-bands.html, dist/rings-and-bands/2.html,
//   dist/rings-and-bands/elara-ring.html …    every route, each with its own
//       title, description, canonical, Open Graph image, structured data, and
//       a plain rendering of its content inside #root for crawlers and for
//       anyone without JavaScript. The app replaces it on load.
//   dist/404.html                             the app shell, for routes only the
//       app knows (a photo the counter uploaded since the last build).
//   dist/sitemap.xml, image-sitemap.xml, robots.txt, llms.txt
//   dist/catalog-tree.json                    the categories (drop folders), for the
//       POS's Add Photos picker — the site states its own tree.
//
// Routes, titles and structured data come from src/lib (catalog.js, seo.js),
// the same functions the app runs, so the two cannot disagree.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog, mergeLocal, resolvePath, trail as trailOf, piecePath, galleryPath, imageUrls, priceLabel, PAGE_SIZE, SITE, SHOW_PRICES } from '../src/lib/catalog.js';
import { metaFor, BRAND } from '../src/lib/seo.js';
import { CHAPTERS } from '../src/lib/taxonomy.js';
import { WHATSAPP_DISPLAY, INSTAGRAM, enquiry } from '../src/lib/contact.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const shopify = JSON.parse(await fs.readFile(path.join(ROOT, 'src', 'catalog.json'), 'utf8'));
const local = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'local.json'), 'utf8'));
const renders = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'renders.json'), 'utf8'));
const lead = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'lead.json'), 'utf8'));
const framed = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'framed.json'), 'utf8'));
const cat = buildCatalog({ ...mergeLocal(shopify, local, renders), lead, framed }, []);
const template = await fs.readFile(path.join(DIST, 'index.html'), 'utf8');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ldJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

// ── Head ────────────────────────────────────────────────────────────────────
function head(m) {
  return [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}" />`,
    `<link rel="canonical" href="${esc(m.canonical)}" />`,
    m.noindex ? '<meta name="robots" content="noindex, follow" />' : '',
    m.prev ? `<link rel="prev" href="${esc(m.prev)}" />` : '',
    m.next ? `<link rel="next" href="${esc(m.next)}" />` : '',
    `<meta property="og:site_name" content="${BRAND}" />`,
    `<meta property="og:type" content="${m.ogType || 'website'}" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${esc(m.canonical)}" />`,
    `<meta property="og:image" content="${esc(m.image)}" />`,
    m.imageAlt ? `<meta property="og:image:alt" content="${esc(m.imageAlt)}" />` : '',
    '<meta property="og:locale" content="en_PK" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    ...m.jsonLd.map((o) => `<script type="application/ld+json">${ldJson(o)}</script>`),
  ].filter(Boolean).join('\n    ');
}

// ── Body: the page, plainly ─────────────────────────────────────────────────
const nav = `<nav aria-label="Site"><a href="/">House of Mina</a><a href="/collections">Collections</a>${CHAPTERS.map((c) => `<a href="${galleryPath(c.slug)}">${esc(c.title)}</a>`).join('')}</nav>`;
const crumbs = (items) => `<nav aria-label="Breadcrumb"><ol style="list-style:none;padding:0;display:flex;gap:.5rem;flex-wrap:wrap">${items.map((c) => `<li><a href="${esc(c.path)}">${esc(c.title)}</a></li>`).join('<li aria-hidden="true">/</li>')}</ol></nav>`;
const tile = (p) => {
  const co = cat.galleries.get(p.co);
  return `<li><a href="${esc(piecePath(p))}"><img src="${esc(imageUrls(p.img[0]).thumb)}" alt="${esc(`${p.t} — ${co?.title || ''}, ${BRAND}`)}" width="720" height="720" loading="lazy" /><strong>${esc(p.t)}</strong>${priceLabel(p) ? `<br /><span>${esc(priceLabel(p))}</span>` : ''}</a></li>`;
};
const grid = (pieces) => `<ul class="grid">${pieces.map(tile).join('')}</ul>`;
// A category, and — for Men's — the sub-categories inside it.
const subs = (ch) => (ch.collections ? `<ul>${ch.collections.map((k) => `<li><a href="${galleryPath(k.slug)}">${esc(k.title)}</a> (${k.pieces.length})</li>`).join('')}</ul>` : '');
const contact = `<p>Enquire on WhatsApp: <a href="https://wa.me/923161930960">${WHATSAPP_DISPLAY}</a> · Instagram <a href="${INSTAGRAM.url}">${INSTAGRAM.handle}</a></p>`;

function body(route) {
  switch (route.kind) {
    case 'home':
      return `${nav}<h1>House of Mina</h1><p>Fine jewelry in 925 sterling silver, plated in 21k gold or rhodium, set with simulated stones and American Diamonds, and handcrafted to order in Karachi. ${cat.pieces.length} pieces.</p>
<section><h2>Categories</h2><ul>${cat.chapters.map((ch) => `<li><a href="${galleryPath(ch.slug)}">${esc(ch.title)}</a> (${ch.pieces.length}) — ${esc(ch.blurb)}${subs(ch)}</li>`).join('')}</ul></section>
<section><h2>The Edits</h2><ul>${cat.edits.map((e) => `<li><a href="${galleryPath(e.slug)}">${esc(e.title)}</a> (${e.pieces.length})</li>`).join('')}</ul></section>
<section><h2><a href="${galleryPath('new-arrivals')}">New Arrivals</a></h2>${grid(cat.newArrivals.pieces.slice(0, 12))}</section>${contact}`;

    case 'collections':
      return `${nav}<h1>Collections</h1><section><h2>Categories</h2><ul>${cat.chapters.map((ch) => `<li><a href="${galleryPath(ch.slug)}">${esc(ch.title)}</a> (${ch.pieces.length})${subs(ch)}</li>`).join('')}</ul></section>
<section><h2>The Edits</h2><ul>${[cat.newArrivals, ...cat.edits].map((e) => `<li><a href="${galleryPath(e.slug)}">${esc(e.title)}</a> (${e.pieces.length})</li>`).join('')}</ul></section>`;

    case 'gallery': {
      const g = route.gallery;
      const pages = Math.max(1, Math.ceil(g.pieces.length / PAGE_SIZE));
      const trail = trailOf(route);
      const onPage = g.pieces.slice((route.page - 1) * PAGE_SIZE, route.page * PAGE_SIZE);
      const pager = pages > 1 ? `<nav aria-label="Pages">${Array.from({ length: pages }, (_, i) => i + 1).map((n) => (n === route.page ? `<strong>${n}</strong>` : `<a href="${galleryPath(g.slug, n)}">${n}</a>`)).join(' ')}</nav>` : '';
      const inside = g.collections ? `<nav aria-label="${esc(g.title)} categories">${g.collections.map((k) => `<a href="${galleryPath(k.slug)}">${esc(k.title)}</a>`).join(' · ')}</nav>` : '';
      return `${nav}${crumbs(trail)}<h1>${esc(g.title)}${route.page > 1 ? ` — page ${route.page}` : ''}</h1><p>${esc(g.blurb || '')} ${g.pieces.length} pieces in 925 sterling silver.</p>${inside}${grid(onPage)}${pager}`;
    }

    case 'piece': {
      const p = route.piece;
      const co = cat.galleries.get(p.co);
      const trail = [{ title: 'Home', path: '/' }, ...(co?.parent ? [{ title: co.parent.title, path: galleryPath(co.parent.slug) }] : []), ...(co ? [{ title: co.title, path: galleryPath(co.slug) }] : []), { title: p.t, path: piecePath(p) }];
      return `${nav}${crumbs(trail)}<article><h1>${esc(p.t)}</h1><p><strong>${esc(priceLabel(p) || 'Ask us on WhatsApp for the price.')}</strong>${SHOW_PRICES && p.priceBy ? ` — ${p.priceBy.values.map((v) => `${esc(p.priceBy.name)} ${esc(v.v)}: PKR ${v.price.toLocaleString('en-US')}`).join('; ')}` : ''}</p>
${p.img.map((im, i) => `<img src="${esc(imageUrls(im).full)}" alt="${esc(im.alt || `${p.t}, view ${i + 1} — ${BRAND}`)}" width="${im.w || 2000}" height="${im.h || 2000}" ${i ? 'loading="lazy"' : ''} />`).join('')}
${p.story.map((s) => `<p>${esc(s)}</p>`).join('')}${p.facts.length ? `<ul>${p.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
<p>925 sterling silver${p.plating.length ? `, ${esc(p.plating.map((x) => (x === 'Gold' ? '21k gold' : x.toLowerCase())).join(' or '))} plating` : ''}. Handcrafted to order in Karachi.</p>
<p><a href="${esc(enquiry(p))}">Enquire about the ${esc(p.t)} on WhatsApp</a>${co ? ` · <a href="${galleryPath(co.slug)}">More ${esc(co.title)}</a>` : ''}</p></article>`;
    }

    case 'favourites':
      return `${nav}<h1>Saved pieces</h1><p>The pieces you save with the heart are kept here, on your device.</p>`;
    default:
      return `${nav}<h1>This page is not in the catalogue</h1><p><a href="/collections">See the collections</a></p>`;
  }
}

// ── Write ───────────────────────────────────────────────────────────────────
function render(route, pathname) {
  const m = metaFor(route, cat, pathname);
  return template
    .replace(/<!-- route-head:start[\s\S]*?route-head:end -->/, head(m))
    .replace('<div id="root"><!-- route-body --></div>', `<div id="root"><div class="ssr">${body(route)}</div></div>`);
}

async function emit(pathname, html) {
  const file = pathname === '/' ? path.join(DIST, 'index.html') : path.join(DIST, `${pathname.slice(1)}.html`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, html);
}

const routes = ['/', '/collections', '/favourites'];
for (const g of cat.galleries.values()) {
  const pages = Math.max(1, Math.ceil(g.pieces.length / PAGE_SIZE));
  for (let n = 1; n <= pages; n++) routes.push(galleryPath(g.slug, n));
}
for (const p of cat.pieces) routes.push(piecePath(p));

const indexable = [];
for (const r of routes) {
  const route = resolvePath(r, cat);
  if (route.kind === 'notfound') throw new Error(`Route ${r} does not resolve — the prerender and the app disagree.`);
  await emit(r, render(route, r));
  if (!metaFor(route, cat, r).noindex) indexable.push({ path: r, route });
}
await emit('/404', render({ kind: 'notfound' }, '/404').replace('</title>', '</title>\n    <meta name="robots" content="noindex" />'));

// ── Sitemaps and friends ────────────────────────────────────────────────────
const day = (shopify.syncedAt || new Date().toISOString()).slice(0, 10);
const lastmod = (r) => (r.route.kind === 'piece' && r.route.piece.at ? r.route.piece.at : day);
await fs.writeFile(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexable.map((r) => `  <url><loc>${SITE}${r.path === '/' ? '/' : r.path}</loc><lastmod>${lastmod(r)}</lastmod></url>`).join('\n')}
</urlset>
`);

await fs.writeFile(path.join(DIST, 'image-sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${cat.pieces.map((p) => `  <url><loc>${SITE}${piecePath(p)}</loc>${p.img.map((im) => `<image:image><image:loc>${SITE}${imageUrls(im).full}</image:loc></image:image>`).join('')}</url>`).join('\n')}
</urlset>
`);

await fs.writeFile(path.join(DIST, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${SITE}/sitemap.xml
Sitemap: ${SITE}/image-sitemap.xml
`);

await fs.writeFile(path.join(DIST, 'llms.txt'), `# House of Mina — Catalogue

> Fine jewelry in 925 sterling silver, plated in 21k gold or rhodium, set with simulated stones and American Diamonds, and handcrafted to order in Karachi, Pakistan. ${cat.pieces.length} pieces; ${SHOW_PRICES ? 'prices in Pakistani rupees' : 'prices on request'}. Enquiries and orders on WhatsApp ${WHATSAPP_DISPLAY}. Instagram ${INSTAGRAM.handle}.

## Categories
${cat.chapters.map((ch) => [`- [${ch.title}](${SITE}${galleryPath(ch.slug)}): ${ch.blurb} ${ch.pieces.length} pieces`,
  ...(ch.collections || []).map((k) => `  - [${k.title}](${SITE}${galleryPath(k.slug)}): ${k.blurb} ${k.pieces.length} pieces`)].join('\n')).join('\n')}

## Edits
${[cat.newArrivals, ...cat.edits].map((e) => `- [${e.title}](${SITE}${galleryPath(e.slug)}): ${e.pieces.length} pieces`).join('\n')}

## Pieces
${cat.pieces.map((p) => `- [${p.t}](${SITE}${piecePath(p)}) — ${cat.galleries.get(p.co)?.title}${priceLabel(p) ? `, ${priceLabel(p)}` : ''}`).join('\n')}
`);

// The POS's Add Photos reads this to offer the counter exactly these folders.
// Its drop contract is two deep (Category/Collection); a category here is its
// own one collection, so the folder is "Rings & Bands/Rings & Bands" — as
// taheri.shop's Watches is. Men's has real sub-categories: "Men's/Men's Rings".
// `path` is where the photographs then show.
const folder = (category, home) => {
  const g = cat.galleries.get(home.slug);
  return {
    category,
    collection: home.title,
    folder: `${category}/${home.title}`,
    path: galleryPath(home.slug),
    count: g?.pieces.length || 0,
    sample: g?.cover ? `${SITE}${imageUrls(g.cover.img[0]).thumb}` : '',
  };
};
await fs.writeFile(path.join(DIST, 'catalog-tree.json'), JSON.stringify({
  site: SITE,
  collections: CHAPTERS.flatMap((ch) => (ch.collections ? ch.collections.map((k) => folder(ch.title, k)) : [folder(ch.title, ch)])),
}, null, 2));

console.log(`Prerendered ${routes.length + 1} documents (${indexable.length} in the sitemap), ${cat.pieces.length} pieces.`);
