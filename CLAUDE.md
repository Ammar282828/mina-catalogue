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
| `npm run sync` | re-copy the catalogue from Shopify → `src/catalog.json` + `data/image-sources.json` (commit both); includes the drafts in `data/shopify-drafts.json` |
| `npm run renders` | take any new 3D renders from iCloud onto the site (upload + `data/renders.json` + push) — owner's Mac only |
| `npm run images` | build any missing photo variants into `public/catalog-thumb|full` (gitignored) |
| `npm run build` | `vite build` + `scripts/prerender.mjs` (one HTML document per route, sitemaps, llms.txt, catalog-tree.json) |
| `npm run preview` | serve `dist/` on :5191 (launch config "mina-catalogue (build)") |

## How it fits together

- `src/lib/taxonomy.js` — **the arrangement**, **like taheri.shop's** (the owner's call, 2026-09-23): five
  categories by what a piece *is* — **Rings & Bands, Wristwear, Chains & Pendants, Sets, Earrings** — one level,
  plus **Lockets** (calligraphy pendants and lockets that open, the owner 2026-09-24; a Shopify product tagged or titled
  "locket" is filed there),
  **no sub-collections**. Style (stone, setting, occasion…) is a gallery filter, not a place. 10 edits are Shopify
  campaign collections. **Men's is a sixth, separate section with sub-categories** (the owner, later on 2026-09-23;
  it replaced the For Him edit): **Men's Rings, Natural Ruby Rings, Men's Chains, Men's Bracelets & Cuffs**
  (`/mens-rings`, `/natural-ruby-rings`, `/mens-chains`, `/mens-bracelets`; `/men` lists them all, and the header
  links to it). A chapter with `collections` is such a section; `chapterOf()` finds a home's chapter. A men's piece
  (`isMens()`: Shopify's men's collections or the "men's cuff" tag) lives in Men's, **not** in the category of its
  type. `classify()` gives every product exactly one home (its page lives at `/<home>/<piece>`). The first arrangement (5 chapters → 18 style collections: Engagement / Gemstone /
  Cocktail / Everyday Rings, Studs, Men's…) is retired: `RETIRED` maps each old slug to its category and
  `public/.htaccess` 301-redirects the old addresses (piece slugs are unique, so `/gemstone-rings/x` → `/rings-and-bands/x`).
- `scripts/sync-shopify.mjs` — reads `houseofmina.store/products.json` + `collections.json` (public, no token).
  Refuses to shrink the catalogue by >40% without `--force`. Piece URLs use a slug of the **name**
  (`/rings-and-bands/adele`), not Shopify's handle (often a stock code); a clash falls back to the handle.
- **Drafts are on the site too** (owner, 2026-09-23). Shopify's public feed has only published products, so
  `data/shopify-drafts.json` holds the drafts in the feed's shape, written by `scripts/drafts-from-admin.mjs` from an
  Admin GraphQL export (the owner's Shopify connector; CI has no Admin token). Refresh: export `status:draft` products
  (fields listed in that script; `variants(first: 250)` plus a `reverse: true` tail for 300-variant sets), run the
  script, then `npm run sync`. 95 drafts on 2026-09-23 (53 rings, 22 sets, 18 earrings…); 5 unpriced → "Price on request".
- **Stone wording** — `src/lib/stones.js` `houseWording()`, applied to every piece's story/facts/stone options at build:
  a coloured stone is always "simulated" (never real/natural/genuine, no mine of origin), CZ / zircon → American
  Diamond(s); the stone filter says "Simulated Emerald". The theme WORKLOG's rule, restated by the owner 2026-09-23.
  **Moissanite and lab-grown diamond are left alone** — priced options Shopify sells (Adele 27,000 vs 101,000); the owner
  was asked. Names are never rewritten. The site-wide material line says "set with simulated stones and American Diamonds".
  **The one exception is a natural stone**: a local piece marked `natural: true` skips the rewording (`worded()` in
  `catalog.js`) — the gents' natural ruby rings (owner, 2026-09-23), whose stone filter value is "Natural Ruby".
- **No prices** (the owner, 2026-09-24): `SHOW_PRICES = false` in `src/lib/catalog.js`. The sync writes `price: null` and
  keeps the option that decided a price (`priceBy`) without its figures, so no price reaches the pages or the app's
  script. Piece pages say "Ask us on WhatsApp for the price"; there is no price filter or sort, no `Offer` in the
  JSON-LD and no `priceRange` in `index.html`. Flip the switch and run a sync to bring prices back.
- **Opening order** — `data/lead.json` names, per gallery slug, the pieces it opens with, in order; the rest follow
  newest first, and the first named piece is the cover. Rings & Bands opens with 36 hand-picked statement rings (the owner
  asked for the best-looking first, 2026-09-24); edit that list to change the page. Its `covers` names, per gallery, the
  piece whose first photograph stands for it (Collections page, landing, the POS picker): all 22 chosen by hand on
  2026-09-24, no piece twice. Collection and edit tiles are all square.
- `src/lib/catalog.js` — `buildCatalog()` and `resolvePath()`: the app and the prerender share them,
  so a crawled page and the app's page are always the same page. `src/lib/seo.js` — titles, descriptions,
  JSON-LD (Product with Offer/AggregateOffer, CollectionPage + ItemList, BreadcrumbList).
- `src/components/` — `Landing.jsx` + `particles.js` (Three.js, lazy chunk; the cloud assembles the MINA
  wordmark, then each category's shape — a ring, bangles, a pendant, a cut stone, earrings — then the edits and a heart), `Gallery.jsx`
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
- **Standard whitespace for rings** (the owner, 2026-09-24) — `scripts/whitespace.mjs`, run by `npm run images` on every
  photograph of a piece in `RING_HOMES` (catalog.js): on a plain light background the ring (with its reflection) is
  centred in a square and spans `FILL` = 78% of it, the backdrop continued from its own edges (read off all four, so a
  vignette is not mistaken for the ring). Scenes — hands, fabric, boxes, lettering — are left alone. Which were framed
  is in `data/framed.json` (committed; the site makes those square and adds `?v=<VERSION>` to their URLs) and in
  `public/catalog-full/.framing.json` beside the cached variants. Raise `VERSION` after changing the rule and the next
  build frames every ring again. 763 of 1,014 ring photographs framed on 2026-09-24.
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
  - **Bangles & bracelets, 2026-09-23:** the 122 photographs in `~/Downloads/House of Mina — Bangles & Bracelets 3.pdf`
    (built in `house-of-mina-theme/tools/catalogue/bangles/`; source images lost with a scratch folder / Work SSD 1),
    extracted from the PDF by each image's "No." label → `catalog-src/local/bb-NNN.jpg`. 20 of them are already Shopify
    products (Raya, Aylin, Soleil, Lyra, Cuban, Verso, Zobi…) and are not repeated; the 25 marked "new — Taheri" in the item list
    are **Taheri's photographs** (the green-backdrop shoots and a few on black boxes) and the owner had them taken off —
    they are `held`, never to be shown here. 74 pieces remain (Nos. 77 and 78 are one bangle; Nos. 84–85, the Verso
    and Zobi cuffs, turned out to be Shopify's "Verso - Men's Cuff" / "Zobi - Men's Silver Cuff" and are `held`).
    `story` is the PDF's description (No. 44's "rhodium" dropped — its photo is gold). Plating is left empty where the
    text and photo disagree.
  - **Drafts that are these renders (2026-09-23):** 31 Shopify drafts (the Heirloom collection) were made from the same
    DSC photos; their render is now the draft's lead image (`heroes`) and the guessed local piece is gone, so the draft's
    name, description and price win. Two wrist-shot bangle sets likewise (Nos. 44, 95 → held).
  - **3D renders (2026-09-23, arriving):** the owner's render session writes `heroes-white-1500/3d-renders/DSC#####.png`.
    `scripts/sync-renders.mjs` uploads each finished one to `catalog-src/local-3d/` and records `{v: hash, w, h}` in
    `data/renders.json`; `mergeLocal()` then shows the render wherever that DSC image appears (a local piece or a hero),
    as `local-3d/<id>-<hash>` — a re-roll is a new file name. Held images stay held. New files first appear on this Mac as
    iCloud placeholders ("dataless"); the script asks iCloud for them and takes them on a later pass.
  - **Gents' natural ruby rings (2026-09-23):** 13 real photographs (Sony RAW, `~/Downloads/New Folder With Items 3`,
    DSC07562–74), each a different ring: silver, a natural ruby in a gold-plated crown bezel. Converted with `sips`
    (the full-size conversion is portrait, the camera's true orientation; `sips -Z` previews drop it). The owner
    found them too dark and wanted them uncropped: **the whole frame, 1333×2000**, shadows and midtones lifted
    (gamma 0.78), the warm cast eased from the white velvet holder, colour +10% → `catalog-src/local/DSC075NN-v2.jpg`
    (`px: [1333, 2000]`; a replaced photo needs a new name, since the photo cache keeps the old one). The first
    square crops (`DSC075NN.jpg`) are unused. Named **Natural Ruby Ring No. 1–13** in shoot order (a longer name hides
    the number on a gallery card), in Men's → Natural Ruby Rings, `natural: true`, plating left empty (silver band,
    gold-plated bezel). A portrait photo shows whole on a piece page (frame up to 2:3); tiles stay square.
  - **Sets from Instagram posts (2026-09-23):** seven "Full Set" posts (1080px, `~/Downloads/PHOTO-2026-….jpg`); four
    were already on the site (Ruby Line, Pavé Fan Bridal, Aqua Bloom, and Sapphire Two-Row — that post shows it gold
    with darker stones) and were not repeated. The other three are local pieces under their file names: Sapphire
    Pearl Choker Set, Emerald Swirl Set, Emerald Cascade Set.
  - **Rings from Gemini renders (2026-09-23):** six renders in taheri-shop `output/imagegen/mina-catalogue-2026-09-23/`
    (its `final-manifest.json` names each source photo) → `ring-0N-….jpg`, **each its own piece** — three looked like
    Shopify rings (Ruby Wishbone, Azzura, Emerald Double Halo) and the owner said they are not the same.
  - **Lockets (2026-09-24):** 34 images from `~/Downloads/New Folder With Items 4` → `lk-NN.jpg` (`src` on each piece
    names its file), 30 pieces (repeat photos folded into `also`). All are AI-drawn, including the May "photos"
    (1024², no camera data), so small inscriptions (verse coins, the engraved locket, filigree cells) are not legible
    Arabic. The big Allah / Kalma / Ali calligraphy reads true. The coins are "Calligraphy Coin …" until the owner says
    which verse each carries. The five `locket-IMG_58xx` renders' source photos were taken at a counter with Taheri's
    sign in view — check with the owner if any are Taheri's pieces.
    **Four more, 2026-09-24** (the owner's Instagram posts, `~/Downloads/PHOTO-2026-07-…`): `lk-35` Ya Hussain Octagon
    Locket (it shows no bail and may be a brooch — ask), `lk-37` Allah Ruby Twist Locket, `lk-38` Panjatan Flower Locket;
    `lk-36` is the same design as lk-23 and is now that piece's lead photo (lk-23 in `also`). A fifth,
    PHOTO-2026-06-30-14-01-28, is the same image as lk-09 and was not repeated.
    lk-07 and lk-33 are the front and back of one locket (the owner): one piece, Engraved Calligraphy Oval Locket, with
    lk-33 in `also`; `/lockets/enamel-floral-locket` 301s to it (`public/.htaccess`).
  - **Removing a piece:** the deploy never deletes, so its old page stays on the server — delete
    `public_html/<category>/<slug>.html` over SSH after the deploy.
- **Drop folder** — photos uploaded from the POS's Add Photos land in
  `public_html/catalog-drop/<Category>/<Category>/` (two deep because that is the POS's drop contract; a category is
  its own one collection, like taheri.shop's Watches/Watches; Men's has real ones, `Men's/Men's Rings/`) via `public/api/upload.php` (bearer
  secret in `~/domains/catalogue.houseofmina.store/.website-upload-secret`, outside the web root).
  `api/catalog.php` lists them, `api/img.php` resizes them; the app folds them in at load as
  "price on request" pieces. `catalog-tree.json` (written by the prerender) tells the POS which folders exist and
  each one's `path`, which the POS links to after an upload.

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
