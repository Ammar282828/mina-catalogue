# mina-catalogue — catalogue.houseofmina.store

House of Mina's own catalogue site: every piece from its Shopify store — name, photographs, price,
platings, sizes, stones — presented the way taheri.shop presents Taheri's, and ending in a WhatsApp
enquiry rather than a cart. **Separate from Shopify** by the owner's choice: it reads Shopify's public
product feed when synced, copies the photographs onto its own server, and never links to or loads
from the Shopify store at runtime.

Sibling of **taheri-site** (`~/Projects/taheri-site`, taheri.shop) — same engine ideas (particle landing,
chapters → collections, prerendered routes, drop folder), deliberately **not** the same codebase: the
two differ in brand, taxonomy and pricing model (fixed Shopify prices here, gold-rate quotes there).
The POS both houses share is **taheri-shop** (`~/Projects/taheri-shop`); read its CLAUDE.md.

## Commands

| | |
|---|---|
| `npm run dev` | dev server on :5190 (launch config "mina-catalogue" in `taheri-shop/.claude/launch.json`) |
| `npm run sync` | re-copy the catalogue from Shopify → `src/catalog.json` + `data/image-sources.json` (commit both) |
| `npm run images` | build any missing photo variants into `public/catalog-thumb|full` (gitignored) |
| `npm run build` | `vite build` + `scripts/prerender.mjs` (one HTML document per route, sitemaps, llms.txt, catalog-tree.json) |
| `npm run preview` | serve `dist/` on :5191 (launch config "mina-catalogue (build)") |

## How it fits together

- `src/lib/taxonomy.js` — **the arrangement**: 5 chapters (Rings, Earrings, Necklaces & Pendants,
  Bracelets & Bangles, Men's) → 18 collections, 10 edits (Shopify campaign collections), filter facets.
  `classify()` gives every product exactly one home collection (its page lives at `/<collection>/<piece>`);
  precedence is men's → gemstone (by tag *or* by name) → engagement → cocktail → everyday.
  Shopify tags are hand-typed and inconsistent — fix a misfiled piece here, not in the data.
- `scripts/sync-shopify.mjs` — reads `houseofmina.store/products.json` + `collections.json` (public, no token).
  Refuses to shrink the catalogue by >40% without `--force`. Piece URLs use a slug of the **name**
  (`/engagement-rings/adele`), not Shopify's handle (often a stock code); a clash falls back to the handle.
- `src/lib/catalog.js` — `buildCatalog()` and `resolvePath()`: the app and the prerender share them,
  so a crawled page and the app's page are always the same page. `src/lib/seo.js` — titles, descriptions,
  JSON-LD (Product with Offer/AggregateOffer, CollectionPage + ItemList, BreadcrumbList).
- `src/components/` — `Landing.jsx` + `particles.js` (Three.js, lazy chunk; the cloud assembles the MINA
  wordmark, then a ring, earrings, a pendant, bangles, a men's band, a cut stone, a heart), `Gallery.jsx`
  (filters in the query string), `Piece.jsx` (plating chips switch to that plating's photo; size or
  option picks the exact price; all of it goes into the WhatsApp message), `Chrome.jsx` (ribbon,
  header, search, footer, Collections page), `Favourites.jsx` (send the saved list on WhatsApp).
- Brand: cream `#FAF7F2` / maroon `#3A0000` / rose `#E8A5AE`, Newsreader + Red Hat Text — taken from the
  Shopify theme (`~/Projects/house-of-mina-theme`). The wordmark is an inline SVG redrawn from
  `public/logo.png`'s strokes. Light is the default theme; dark is maroon-black with rose accents.
- Contact: WhatsApp **+92 316 1930960** (from the Shopify theme), Instagram @houseofmina__, TikTok @houseofmina.
  Copy says **Karachi**, never "Saddar" (the owner's rule for Taheri, applied here too).

## Photography

- Never in git. `data/image-sources.json` records each photo's Shopify CDN source; `npm run images`
  (locally or in CI, with a cache) makes a 720px and a 2000px WebP. File names carry a hash of the
  source, so a photo replaced in Shopify gets a new file.
- **The house's own images** — `data/local.json` (committed) lists images that are not on Shopify: `heroes` puts one
  first on a Shopify piece (by handle); `pieces` are pieces known only from an image (no price → "Price on request"),
  with `also` (more images of the piece) and `photoPlating` (the plating chip then shows that image); `held` records
  images deliberately left off, with the reason. Originals: `public_html/catalog-src/local/<id>` on the server
  ("DSC08985" = DSC08985.png; an id with an extension is that file), uploaded by rsync + `chmod 644` (macOS rsync has
  no `--chmod`; iCloud files arrive 600 → HTTP 403). Never in git; rsync never deletes them. `mergeLocal()` in
  `catalog.js` folds them in for the app, the prerender and the deploy gate (`scripts/check-build.mjs`).
  - **Rings, 2026-09-23:** iCloud `heroes-white-1500`, 179 files. These are **AI renders** (Nano Banana) of the shop's
    DSC photos, not photographs; the folder's `_REVIEW.txt` flags ten that differ from the real piece — those are
    `held`. 150 ring pieces, 12 Shopify rings with a new lead image. Names, collections, platings and stones were read
    off the images; the owner may correct them. The owner removed Blossom Pearl Ring's lead image.
  - **Removing a piece:** the deploy never deletes, so its old page stays on the server — delete
    `public_html/<collection>/<slug>.html` over SSH after the deploy.
- **Drop folder** — photos uploaded from the POS's Add Photos land in
  `public_html/catalog-drop/<Chapter title>/<Collection title>/` via `public/api/upload.php` (bearer
  secret in `~/domains/catalogue.houseofmina.store/.website-upload-secret`, outside the web root).
  `api/catalog.php` lists them, `api/img.php` resizes them; the app folds them in at load as
  "price on request" pieces. `catalog-tree.json` (written by the prerender) tells the POS which folders exist.

## Deploy (`.github/workflows/deploy.yml`)

Push to `main` → build (photos from cache or Shopify's CDN) → sanity gate → rsync over SSH to
`~/domains/catalogue.houseofmina.store/public_html` on the same Hostinger account as taheri.shop.
Gated by the repository variable `DEPLOY_ENABLED=1`. "Run workflow" with **sync** ticked re-copies
from Shopify first and commits it. rsync never deletes; `catalog-drop/` is never touched.

## Go-live status (2026-09-23)

- Hostinger website **created** through the Hostinger API (Business plan, order 1008754559, beside taheri.shop):
  `~/domains/catalogue.houseofmina.store/public_html`, server IP **145.79.26.82**. `DEPLOY_ENABLED=1`; the first
  deploy shipped 2,319 files and all 1,025 photographs; every route verified against the server with the Host header.
- Upload secret in place on both ends (hom-pos Secret Manager `website-upload-secret` with the App Hosting SAs'
  access, and `~/domains/catalogue.houseofmina.store/.website-upload-secret`; sha256 prefix `c6701cb1`); an
  authenticated test upload was listed by `api/catalog.php` and removed. Mina's POS carries the website variables.
- DNS **done** 2026-09-23 through the GoDaddy API: `A  catalogue  145.79.26.82` (TTL 600) on houseofmina.store,
  whose DNS stays at GoDaddy. The site answered over HTTP by name straight away.
- SSL **done**: Hostinger issued a Let's Encrypt certificate on its own ~4 minutes after the name resolved
  (renewed by the host). `.htaccess` sends plain HTTP to HTTPS.
- Duplicate listings: the same products (and descriptions) are on houseofmina.store. Both are self-canonical.
