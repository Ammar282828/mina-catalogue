# mina-catalogue — catalogue.houseofmina.store

House of Mina's own catalogue site: every piece from its Shopify store — name, photographs, price,
platings, sizes, stones — presented the way taheri.shop presents Taheri's, and ending in a WhatsApp
enquiry rather than a cart. **Separate from Shopify** by the owner's choice: it reads Shopify's public
product feed when synced, copies the photographs onto its own server, and never loads from the Shopify
store at runtime. Since 2026-09-24 (the owner's ask) a piece **published** on houseofmina.store links to its
product page there ("Buy online"); drafts and the house's own images do not.

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
| `npm run pretty` | score new pieces' prettiness for the gallery order → `data/pretty.json` (Gemini; owner's Mac, after adding pieces) |
| `npm run similar` | embed new pieces' photos and rank the recommendations → `data/embeddings.json` + `data/recommend.json` (owner's Mac, after `pretty`) |
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
  (`/mens-rings`, `/natural-ruby-rings`, `/mens-chains`, `/mens-bracelets`; `/men` lists them all; the header no longer links to it — the owner took Men's off
  the header on 2026-09-24, it is reached from Collections and the front page). **Wristwear is a section too since 2026-09-24** (the owner): **Bangle & Ring Sets, Bangles & Cuffs,
  Bracelets** (`/bangle-and-ring-sets`, `/bangles-and-cuffs`, `/bracelets`; `/wristwear` lists all 108 in the prettiest
  order, and each sub-category follows that order unless `lead.json` names its own). `wristwearHome()` in taxonomy.js
  sorts a piece by type and name (sold with a ring → sets; a bangle or cuff → bangles; the rest → bracelets); the Shopify
  sync, `data/local.json` (`co: "wristwear"` stays valid) and POS drops (`Wristwear/<Sub>/`, and the old
  `Wristwear/Wristwear/` by file name) all go through it. The old `/wristwear/<piece>` addresses 301 to the sub-category
  (`public/.htaccess`). A chapter with `collections` is such a section; `chapterOf()` finds a home's chapter. A men's piece
  (`isMens()`: Shopify's men's collections or the "men's cuff" tag) lives in Men's, **not** in the category of its
  type. `classify()` gives every product exactly one home (its page lives at `/<home>/<piece>`). The first arrangement (5 chapters → 18 style collections: Engagement / Gemstone /
  Cocktail / Everyday Rings, Studs, Men's…) is retired: `RETIRED` maps each old slug to its category and
  `public/.htaccess` 301-redirects the old addresses (piece slugs are unique, so `/gemstone-rings/x` → `/rings-and-bands/x`).
  Every old address is **one hop** from its page (2026-10-01): the men's piece rules come first and take the oldest
  prefixes too (`/necklaces/box-chain` → `/mens-chains/box-chain`, not via `/chains-and-pendants`), all before the
  trailing-slash rule; `/for-him/…` goes to `/men`; a gallery's `/x/` 301s to `/x` even though `x/` is a folder.
  **Filed by hand** (`HOME_OF` in taxonomy.js, read by `classify()` and the build): Shopify types The Rania Set and Mina Classics
  "Set"; the owner (2026-11-14) filed The Rania Set under Rings & Bands and Mina Classics under Earrings; their `/sets/` addresses 301.
- `scripts/sync-shopify.mjs` — reads `houseofmina.store/products.json` + `collections.json` (public, no token).
  Refuses to shrink the catalogue by >40% without `--force`. Piece URLs use a slug of the **name**
  (`/rings-and-bands/adele`), not Shopify's handle (often a stock code); a clash falls back to the handle.
  **A piece keeps its handle when Shopify renames the product** (`scripts/identity.mjs`, 2026-09-30): the handle is a
  piece's identity here (favourites and the POS's `mina/piece/<handle>`, `catalog-overrides.json`, photo file names), and
  Shopify changes it on a rename — 50 of 209 had been (`adele-er-single-round1ct-halo-pave` → `adele`). The sync matches each
  product to the piece it was by Shopify's product id (`data/shopify-ids.json`, written every sync; commit it) or, before
  that, by its photographs, keeps the old `h`, and puts the shop's handle in `sh`; `byHandle` finds a piece by either.
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
- **Links to houseofmina.store** (the owner, 2026-09-24): the sync marks every product from the public feed `shop: true`
  (published there; drafts from `shopify-drafts.json` never are), and `shopUrl()` in `src/lib/contact.js` gives
  `https://houseofmina.store/products/<handle>` for those only — the piece page's "Buy online" button and a line under it,
  and a link on the prerendered page. A product unpublished on Shopify loses its link at the next `npm run sync`.
  The link uses the shop's current handle (`sh || h`): a stale one still works through Shopify's 301, but every visit —
  and every crawl, which is how Google finds the shop's product pages from here — pays a redirect. Sync after the shop
  renames products.
  **The shop's page is the original** (2026-09-30, the owner asked why Google finds no houseofmina.store product pages): a
  `shop` piece carries the shop's name, photographs and words here too, and Google keeps only one of two such pages — the
  catalogue's fast, marked-up copy could win. So its canonical (and og:url) is `shopUrl()`, it carries no Product JSON-LD
  (breadcrumbs only), and `sitemap.xml` / `image-sitemap.xml` leave it out (`elsewhere` in `seo.js`): 209 pieces, the
  sitemap 672 → 463. The page still shows and links as before; the other 410 pieces stay this site's own.
  **Crawlers** (2026-10-01): robots.txt (written by the prerender) keeps `/api/` closed except `catalog.php` and
  `img.php`, which the app reads before it draws. Each deploy tells IndexNow (Bing, and ChatGPT / Copilot / DuckDuckGo
  search through it) which addresses changed in three days (`scripts/indexnow.mjs`, key `public/indexnow.txt`).
  **Search Console** (2026-09-30): the ERP's service account (`claude-cloud@gemstrack-pos`) is a full user on the domain
  property `sc-domain:houseofmina.store`, which covers the shop and this site. That day it submitted both sites' sitemaps
  (none had ever been submitted) and **`public/shop-moved.xml`**: the shop's 129 old product and collection addresses
  that now redirect, so Google re-reads them and moves to the new pages. Before, 69% of the shop's product impressions
  landed on old addresses, and Google had never heard of 110 of its 209 products. **Temporary: delete
  `shop-moved.xml` after mid-November 2026** (and remove it in Search Console).
- **No prices** (the owner, 2026-09-24): `SHOW_PRICES = false` in `src/lib/catalog.js`. The sync writes `price: null` and
  keeps the option that decided a price (`priceBy`) without its figures, so no price reaches the pages or the app's
  script. Piece pages say "Ask us on WhatsApp for the price"; there is no price filter or sort, no `Offer` in the
  JSON-LD and no `priceRange` in `index.html`. Flip the switch and run a sync to bring prices back.
  **Except rings weighed at the counter** (the owner, 2026-11-09: "for rings that have weights start showing their prices —
  multiply the weight by 3000 and round to nearest 500 or 1000"; "skip this for rings with website prices present"): Mina's
  ERP links an inventory product (hom-pos Firestore `products`) to a piece by `catalogueId` (the piece's handle) with its
  `metalWeightG`. `npm run weights` (`scripts/weights.mjs`, gcloud's login; works from a cloud session) writes
  `data/weights.json` — commit it. `byWeight()` in catalog.js prices a ring that is not on houseofmina.store
  (`shop`) at PKR 3,000 a gram to the nearest 500 (`weightPrice`), `priced: true`: the price shows on its tile, page,
  WhatsApp message and prerendered page, and the page is a Product with an Offer. 184 rings on 2026-11-09 (171 Rings & Bands,
  13 Natural Ruby Rings; the 33 shop rings skipped). **Wristwear** (Wristwear's three galleries and Men's Bracelets) is PKR 2,600 a
  gram (`RATE_PER_GRAM`, the owner, same day) — none linked in the ERP yet. **A price the owner sets** on a local piece:
  `price` in data/local.json, a number or `{ name, values: [{ v, price }] }` (chips on the page): Opal and Ruby Bangle & Ring
  (bb-062) 75,000 simulated / 200,000 natural (`natural: true` so its words keep both), Mother-of-Pearl Hexagon Bangle & Ring
  (bb-019) 85,000. Every priced piece carries `priced: true`. A `natural` piece (the natural ruby rings) adds PKR 10,000 for the
  stone (`NATURAL_STONE_PRICE`, the owner, 2026-11-09: "add 10000 stone price to each for now"). **Re-run `npm run weights` after the counter links more rings.**
- **Order of every gallery** (the owner, 2026-09-24: "sort by new and prettiness"): the pieces added in the last
  30 days first (`FIRST_DAYS`; a POS drop counts as new), prettiest first, then the rest, prettiest first; newer first on
  a tie (`orderer()` in catalog.js — categories, sub-categories, sections and edits).
  **New Arrivals is newest first** (2026-10-12, the owner: "why are new arrivals hardcoded"): ordered by prettiness it
  showed the same launch pieces for two months while a piece added that day, unscored, sat ~130th. Prettiness now only
  breaks a tie within a day. **Launch stock is never new:** a `local.json` piece with no `addedAt` of its own came in with the
  2026-09-23 import (`launch: true`) and counts as neither an arrival nor fresh in a gallery, nor gets the New badge (288
  pieces; 371 of 647 had counted as new). **Give every piece added to `local.json` its own `addedAt`**, or it is launch stock. Prettiness is
  `data/pretty.json` (1–100 per piece slug): `npm run pretty` asks Gemini 3.8 Flash on Vertex (project
  `jewelgen-mm-e3d43ecb`, mmurtaza1970's ADC — the owner's ask) to score each piece's gallery photo, only those without a
  score, and is **run on the owner's Mac after adding pieces**, then committed (a piece with no score sorts as the median).
  Pro was tried first and queues bulk requests on that project (20 took 108 s). `data/lead.json` now only holds `covers`:
  the hand-picked Rings & Bands opening and the Wristwear ranking (Gemini 3.1 Pro, side by side) were superseded by the
  rule. Its `covers` names, per gallery, the piece whose first photograph stands for it (Collections page, landing, the
  POS picker): all 22 chosen by hand on 2026-09-24, no piece twice; a gallery not listed uses its first piece. The sort
  menu's default reads "New & prettiest". Collection and edit tiles are all square.
- **Recommendations** (the owner, 2026-09-25: "heavily add recommendation, upselling algorithms"): `npm run similar`
  (`scripts/similar.mjs`) embeds each piece's gallery photograph with Vertex `multimodalembedding@001` (256 numbers, project
  `jewelgen-mm-e3d43ecb`, mmurtaza1970's ADC; ~$0.0001 a photo; kept in `data/embeddings.json`, re-embedded only when a
  piece's lead photo changes) and ranks, per piece, **`like`** (same kind — `KIND` in `src/lib/recommend.js` — by how alike the
  photos look, then stones, plating, style, prettiness; greedy MMR so a list is not one design twelve times) and **`pair`**
  (other kinds per `GOES_WITH`: earrings/pendant/bracelet/set for a ring…, men's only with men's; plating must match — gold with
  gold; a piece that looks like everything is discounted (CSLS) and each use of a piece makes it a little dearer (`LOAD`), so
  a dozen crowd-pleasers do not stand beside everything) into `data/recommend.json`, which `buildCatalog` reads (`cat.rec`).
  Where they show: the piece page — **Complete the look** (four pairs, each with "Ask about this too", which puts it in the same
  WhatsApp message: `enquiry(…, also)`), **More like this** (replacing "More <gallery>"), **Picked for you**; the foot of every
  gallery ("To wear with <gallery>" and Picked for you); the Saved page ("Goes with what you saved"); the front page (a
  "Welcome back" shelf before the Edits); the account page. **Picked for you** (`forYou`) is item-based from this device's
  saved pieces (double weight) and recent views, plus a nudge for pretty and new pieces, at most a third from one gallery;
  nothing on a first visit. The prerendered piece pages link their pairs and look-alikes too. A piece the ranking has not
  seen (a POS drop, a piece added since) falls back to its kind's prettiest. Run `npm run pretty` then `npm run similar`
  after adding pieces, and commit both.
- **Interest** (the owner, 2026-10-22: "which ones are saved, inquired about, looked at for the longest"): `src/lib/interest.js`
  counts, anonymously per piece (`mina/piece/<handle>`), a piece page opened, time on it while visible, the heart on and off,
  and a WhatsApp enquiry naming it (Enquire, and both "send the list" buttons). Batched and sent with `sendBeacon` as
  text/plain to the POS's `POST /api/public/events`; the POS's Website → Interest ranks them. Browser-only.
- **Accounts** (the owner, 2026-09-25: "add accounts … like taheri.shop"): Google sign-in through **Mina's POS's own Firebase
  project** (hom-pos; public web config in `src/lib/auth.js`, Firebase loaded only on Sign in or for a browser that signed in
  before), the record on **pos.houseofmina.store `/api/public/me`** — the same route and Firestore collection
  (`website_customers`) taheri.shop uses, served by Mina's POS, whose `WEBSITE_ORIGIN` already allows this site. Saved pieces
  follow the account: the POS only keeps three-part keys, so a piece travels as `mina/piece/<handle>` and the POS needed no
  change; on sign-in both lists are merged once, then every change is saved 800 ms after the last tap
  (`useAccountSync()` in `src/lib/account.js`). `/account` (noindex): a sign-in card, then saved pieces, details (name,
  WhatsApp number, city, address) and Picked for you. The header says "Sign in" (a person icon on phones), then shows the
  customer's photo. `catalogue.houseofmina.store` was added to hom-pos's authorised domains on 2026-09-25 (Identity Toolkit
  `admin/v2/projects/hom-pos-52710474-ceeea/config`, PATCH `authorizedDomains` with the whole list). Locally the POS refuses
  localhost (CORS), so the record only loads on the live site.
- `src/lib/catalog.js` — `buildCatalog()` and `resolvePath()`: the app and the prerender share them,
  so a crawled page and the app's page are always the same page. `src/lib/seo.js` — titles, descriptions,
  JSON-LD (CollectionPage + ItemList, BreadcrumbList; a piece is an ItemPage with its photographs as ImageObjects while
  prices are off, a Product with Offer/AggregateOffer once they are on — a Product with no offer, review or rating is an
  invalid rich result, and Search Console flagged all 410 piece pages for it on 2026-10-01). Titles stay within 65
  characters (a long one drops its gallery); two pieces with one name (a render named like a Shopify piece) are told apart
  by the address's number ("Ruby Twist Ring No. 2"); a piece's description leads with its name; a gallery's later pages
  name the pieces on them, so no two pages share a title or a description.
- `src/components/` — `Landing.jsx` + `particles.js` (Three.js, lazy chunk; the cloud assembles the MINA
  wordmark, then each category's shape — a ring, bangles, a pendant, a cut stone, earrings — then the edits and a heart), `Gallery.jsx`
  (filters in the query string), `Piece.jsx` (plating chips switch to that plating's photo; size or
  option picks the exact price; all of it goes into the WhatsApp message), `Chrome.jsx` (ribbon,
  header, search, footer, Collections page), `Favourites.jsx` (send the saved list on WhatsApp).
- Brand: cream `#FAF7F2` / maroon `#3A0000` / rose `#E8A5AE`, Newsreader + Red Hat Text — taken from the
  Shopify theme (`~/Projects/house-of-mina-theme`). The wordmark is an inline SVG redrawn from
  `public/logo.png`'s strokes. Light is the default theme; dark is maroon-black with rose accents.
- Contact: WhatsApp **+92 316 1930960** (from the Shopify theme), Instagram @houseofmina__. **No TikTok:** @houseofmina is
  someone else's account (owner, 2026-09-30: "the tiktok isnt hers"); the footer link and `sameAs` were removed.
  Copy says **Karachi**, never "Saddar" (the owner's rule for Taheri, applied here too).

## Photography

- Never in git. `data/image-sources.json` records each photo's Shopify CDN source; `npm run images`
  (locally or in CI, with a cache) makes a 720px and a 2000px WebP. File names carry a hash of the
  source, so a photo replaced in Shopify gets a new file.
- **Standard whitespace for rings** (the owner, 2026-09-24) — `scripts/whitespace.mjs`, run by `npm run images` on every
  photograph of a piece in `RING_HOMES` (catalog.js): on a plain light background the ring (with its reflection) is
  centred in a square and spans `FILL` = 55.5% of it — the share houseofmina.store's own product photos give their rings
  (measured 2026-09-24: 130 photos, 55–56.5% for nine in ten, 0.5% below centre, `DROP`) —, the backdrop continued from its own edges (read off all four, so a
  vignette is not mistaken for the ring). Scenes — hands, fabric, boxes, lettering — are left alone. Which were framed
  is in `data/framed.json` (committed; the site makes those square and adds `?v=<VERSION>` to their URLs) and in
  `public/catalog-full/.framing.json` beside the cached variants. Raise `VERSION` after changing the rule and the next
  build frames every ring again. 763 of 1,014 ring photographs framed on 2026-09-24.
- **The MINA wordmark on every photograph** (the owner, 2026-09-24) — `scripts/brand.mjs`, run by `npm run images` after
  the ring framing: the site's own wordmark, top right, 19% of the width, 4.8% in and 3.7% down (as on the bangles
  catalogue's photos), maroon on a light corner and white on a dark one. Photographs that already carry it are listed in
  `data/marked.json` (47 on 2026-09-24: the posts, the bangles, some lockets) and left alone; before adding a post's
  photograph, run `python3 scripts/find-marks.py <file>` on the original and list it if it prints "marked" (OpenCV;
  owner's Mac only). `PHOTO_VERSION` in catalog.js goes into every photo URL (`?v=1`, rings `?v=1.4`); raise it after
  changing the mark. `public/catalog-full/.branding.json` records which cached variants carry it. Photos the counter
  uploads from the POS (catalog-drop) are resized by the server and are not branded.
- **The mark on every square** (2026-09-27, the owner, both sites: "keep them their og size, however add the overlay on the 1x1
  thumbnail so its uniform in collections and on viewing before opening full pic"): photographs keep their shape; every square
  tile of a piece (grids, recommendations, search) and the piece page's photo draw the MINA mark themselves — `TileMark.jsx`,
  brand.mjs's geometry and colours (19% across, 4.8% in, 3.7% down; maroon on a light corner, white on a dark one, read off the
  pixels) — when the photo is not square (the crop cut its burned-in mark off) or is a POS drop (never branded). A square
  built photo already shows its mark and gets none. The viewer shows the photograph whole. Taheri's site does the same with
  its wordmark (taheri-site `TileMark.jsx`).
- **The house's own images** — `data/local.json` (committed) lists images that are not on Shopify: `heroes` puts one
  first on a Shopify piece (by handle); `pieces` are pieces known only from an image (no price → "Price on request"),
  with `also` (more images of the piece) and `photoPlating` (the plating chip then shows that image); `held` records
  images deliberately left off, with the reason. Originals: `public_html/catalog-src/local/<id>` on the server
  ("DSC08985" = DSC08985.png; an id with an extension is that file), uploaded by rsync + `chmod 644` (macOS rsync has
  no `--chmod`; iCloud files arrive 600 → HTTP 403). Never in git; rsync never deletes them. `mergeLocal()` in
  `catalog.js` folds them in for the app, the prerender and the deploy gate (`scripts/check-build.mjs`).
  **Without SSH** (a cloud session, 2026-09-28): `api/upload.php` with `to=local`, `name=<file>` and the image (same
  bearer secret as a drop) writes `catalog-src/local/<name>` at 644 — never over an existing file (409), on no page until
  `data/local.json` names it. Upload first, then commit `local.json`: the build fetches the original over HTTPS.
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
  - **Renders are never another product's photo** (the owner, 2026-09-24). On 2026-09-23 renders were paired with 11
    published rings and 31 drafts as their lead images (`heroes`), and the drafts' guessed pieces removed; the owner said
    those were different products. All of it is undone: `heroes` is empty, the 32 pieces come back as they were, the 10
    renders that had only ever been heroes are pieces of their own (named off the image), and bangle Nos. 44 and 95 are
    no longer held as "the same as" drafts. Verso and Zobi stay held — the bangle catalogue names them as the Shopify cuffs.
    Don't pair a render with a Shopify product by eye again; ask the owner.
  - **3D renders (2026-09-23, arriving):** the owner's render session writes `heroes-white-1500/3d-renders/DSC#####.png`.
    `scripts/sync-renders.mjs` uploads each finished one to `catalog-src/local-3d/` and records `{v: hash, w, h}` in
    `data/renders.json`; `mergeLocal()` then shows the render wherever that DSC image appears (a local piece or a hero),
    as `local-3d/<id>-<hash>` — a re-roll is a new file name. Held images stay held. New files first appear on this Mac as
    iCloud placeholders ("dataless"); the script asks iCloud for them and takes them on a later pass.
    **Brightened (2026-09-24):** the owner found six rings' metal dull — Ruby Halo Split-Band (DSC09099), Ruby Pear Halo
    (09105), Baguette Band Solitaire (09112), Baguette Dome (09116), Round Halo Solitaire (09121), Peridot Oval Swirl
    (09133, which had no 3D render). Each was re-rendered with gemini-3-pro-image to bright polished rhodium, everything
    else kept, and written into `3d-renders/` so the render sync publishes it; the dull versions are not kept there.
    Say "no yellow gold anywhere" for a rhodium piece, or the model gilds the claws.
  - **Gents' natural ruby rings (2026-09-23):** 13 real photographs (Sony RAW, `~/Downloads/New Folder With Items 3`,
    DSC07562–74), each a different ring: silver, a natural ruby in a gold-plated crown bezel. Converted with `sips`
    (the full-size conversion is portrait, the camera's true orientation; `sips -Z` previews drop it). The owner
    found them too dark and wanted them uncropped: **the whole frame, 1333×2000**, shadows and midtones lifted
    (gamma 0.78), the warm cast eased from the white velvet holder, colour +10% → `catalog-src/local/DSC075NN-v2.jpg`
    (`px: [1333, 2000]`; a replaced photo needs a new name, since the photo cache keeps the old one). The first
    square crops (`DSC075NN.jpg`) are unused. Named **Natural Ruby Ring No. 1–13** in shoot order (a longer name hides
    the number on a gallery card), in Men's → Natural Ruby Rings, `natural: true`, plating left empty (silver band,
    gold-plated bezel). Since 2026-09-27 a piece page shows its photo square like every tile, with the mark; the viewer shows it whole
    (it used to show a portrait whole, up to 2:3).
    **Retouched (2026-09-24, the owner: "retouch all gents ruby rings … using open ai"):** GPT Image 2.5 (OpenAI's model,
    via Magnific `gpt-2-mini`, flare, high, 2k, 2:3; this Mac has no OpenAI key) cleaned the velvet box, the maroon
    backdrop and the fingertips and neutralised the colour; then each ring's **own pixels were pasted back** through a
    Gemini segmentation mask (dilated 4 px, feathered), colour-matched to the retouched velvet around it — the model
    redraws a natural ruby's inclusions otherwise. Output at the photo's own 1333×2000 → `catalog-src/local/DSC075NN-v3.jpg`.
    Masks, raw renders and the v2 originals: `~/Projects/house-of-mina-photo-backups/natural-ruby-rings-retouch-2026-09-24/`.
    **Then the rings too** (the owner, same evening: "retouch the rings themselves also") → `DSC075NN-v4.jpg`: GPT 2.5 on
    each v3 — metal polished bright, scratches/dust/fingerprints off, the beaded bezel crisp, surface dust off the stone,
    keeping each ring's design and each ruby's shape, cut and natural inclusions; the retouched ring (mask dilated 14 px,
    feathered 6 px, velvet-matched) set back into the v3 frame so the approved background is untouched.
    **Nos. 14–18 and five bracelets (2026-09-27):** a later shoot (DSC09284–93, maroon backdrop), retouched the same way on
    Magnific (GPT 2.5; each piece's own pixels kept, its polish set back by frequency separation so metals keep their colour),
    whole frame 2160×3840 → `catalog-src/local/DSC092NN.jpg`. The bracelets are local pieces in Wristwear → Bracelets
    (Sapphire / Pink Halo Line, Pavé Buckle, Triple Flower, Gold Station; named off the photo — the owner may rename).
  - **Sets from Instagram posts (2026-09-23):** seven "Full Set" posts (1080px, `~/Downloads/PHOTO-2026-….jpg`); four
    were already on the site (Ruby Line, Pavé Fan Bridal, Aqua Bloom, and Sapphire Two-Row — that post shows it gold
    with darker stones) and were not repeated. The other three are local pieces under their file names: Sapphire
    Pearl Choker Set, Emerald Swirl Set, Emerald Cascade Set.
  - **Boxed sets, 2026-09-28** (the owner's Drive folder "HOM SETS": 19 retouched shots, DSC09345–64 without 09346, sets in
    the maroon Mina box, 1254² PNG; uploaded from a cloud session with upload.php `to=local`). Eight designs were already
    here, so their photographs went to those pieces, never repeated as new ones: **in place of** the white Shopify shots
    (`instead` in local.json; the owner: "put the duplicate sets pics in place of their white images") on Aqua Bloom
    (09358 + 09359, one set shot twice), Ruby Line (09352), Ruby Vine (09353), Sapphire Scroll (09351), Pavé Fan Bridal
    (09347) — houseofmina.store keeps its white shots; `also` (after the Instagram "Full Set" post, which is not a white
    shot) on the local Sapphire Pearl Choker (09354), Emerald Swirl (09363), Emerald Cascade (09355). The other ten are new local sets named off the photo (the owner may rename): Amethyst Fringe, Pavé Wave, Pavé
    Scroll Drop, Emerald Marquise Halo (necklace and earrings only), Petite Teardrop, Marquise Leaf, Ruby Marquise Drop,
    Pavé Ripple, Pavé Lattice Bib, Emerald Blossom. Not on taheri.shop (the owner: "house of mina catalogue only").
  - **Earrings and Locket Sets, 2026-10-01** (the owner's Drive folder "Retouched-imagegen", "catalogue hom earrings" and
    "catalogue hom locket sets": 26 retouched shots, DSC09417–42, 1254² PNG, on the cream velvet trays and in the maroon Mina
    box; uploaded from a cloud session with upload.php `to=local`). **Locket Sets is a category of its own** (the owner: "make a
    new locket set category"; `locket-sets` in CHAPTERS after Sets, kind `locket-set` in recommend.js): 17 new local sets — a
    locket with earrings, many with a ring — named off the photo, plus the Topaz Locket Set with Bangle (bb-057), moved from
    Sets (`/sets/topaz-locket-set-with-bangle` 301s). Earrings: DSC09442 is **Bianca Butterfly Drop Earrings** (Shopify),
    put first on it (`heroes`); the other eight are new local earrings. DSC09440 (Emerald Oval Double-Halo Studs) looks like
    Shopify's **Minerva Emerald Double-Halo Studs** (white renders) — left its own piece until the owner says they are one.
  - **Bangle pairs, 2026-10-12** (the owner's Drive folder "retouched-red-bangles-v2": 8 retouched shots, DSC09548–55, 1254²
    PNG, on the maroon cloth; uploaded from a cloud session with upload.php `to=local`): four new local pairs in Wristwear →
    Bangles & Cuffs, named off the photo (the owner may rename) — Gold Bead & Pavé Cluster (09548, `also` 09549–50), Faceted
    Pavé Bar (09551, 09552), Pavé Bar Double-Rail (09553), Pavé Twist (09554, 09555). No burned-in mark; brand.mjs adds it.
  - **Box photographs of bangle sets, 2026-10-14** (the owner's Drive folder "hom bracelet and ring sets": DSC09597–09642,
    retouched 1254² PNGs in the maroon Mina box; uploaded with upload.php `to=local`). They first went to taheri.shop by
    mistake (the maroon box is Mina's) and were taken off there (held, words reverted). 38 photos are new shots of bangle sets
    already here, all `bb-NNN` pieces from the bangles PDF: each is now that piece's **lead** (the owner: "keep the box photos
    as the hero") through `heroes`, which since this batch also takes a local piece's handle (`local-bb-021`) — `mergeLocal`
    puts them first without changing the piece's id, address or saves. DSC09599 is DSC09597's set from another angle;
    DSC09613 is the Emerald Bypass design in rhodium (`plating` on the hero). Six are new local sets named off the photo:
    Emerald Marquise Leaf, Pavé Leaf Bypass, Slim Pavé Link, Sapphire Marquise Vine, Multi-Colour Flower Bypass, Pearl
    Emerald Halo. DSC09638 had not reached the folder.
    `pretty` and `similar` were run from the cloud session the same day: **billing is off on `jewelgen-mm-e3d43ecb`**
    (403 "requires billing"), and both scripts swallow the error — `pretty` still prints "Scored N" and writes nothing.
    They ran on gemstrack-pos instead (`PRETTY_PROJECT=gemstrack-pos`, `SIMILAR_PROJECT=gemstrack-pos`), which bills;
    93 pieces scored (the 38 re-led ones rescored on the box photo), 101 photos embedded. On the Mac, add those two
    variables until jewelgen's billing is back.
  - **Tri-tone bangle pairs, 2026-10-24** (the owner's Drive folder of two pairs: DSC09802–09815, retouched on the maroon cloth;
    uploaded with upload.php `to=local`): Tri-Tone Scattered Stone Bangles (09808, `also` 09809/02/03/05/07) and Tri-Tone
    Textured Bangles (09813, `also` 09814/15/10/11) in Wristwear → Bangles & Cuffs, plating Gold, Rose Gold and Rhodium. The three
    portrait frames (941×1672) were cropped 1:1 on the bangles before upload (the owner wants every photo square). Actions did
    not start that day (`runner_id` 0), so each pair went up first as a POS drop (`Wristwear/Bangles & Cuffs/<name>.png`, words
    through override.php); once this build is live the two drops are taken off (upload.php `action=remove`, then `revert`).
  - **Shoot of 2026-11-05** (the owner's Drive folder "add to hom and taheri", retouched 1254² PNGs; uploaded with upload.php `to=local`):
    27 rings on white ("white ecommerce house of mina rings": DSC09896–09923, 09902 + 09903 one ring) and, from "textured-photos/HOM" on the
    maroon cloth, five bracelets, two bangles, a pair of bangles and three Locket Sets (DSC09926–09945; one folder = one piece, its
    photos in `also`). All new local pieces named off the photo (the owner may rename); the stones are worded simulated. The
    same folder's "taheri" half went to taheri.shop.
  - **Boxed sets, 2026-11-12** (the owner's Drive folder "photos/hom sets": DSC09961–09968 without 09966, retouched 1254² PNGs in the
    maroon Mina box; uploaded with upload.php `to=local`): seven new local sets in Sets, named off the photo (the owner may rename). The
    same folder's "taheri rings" (DSC09969–09999) went to taheri.shop's Rings as drops.
  - **Diamond-style sets and meena bangles, 2026-11-14** (the owner's Drive folder "photos": "hom sets one pic per set" and "hom bangles";
    retouched 1254² PNGs; the camera's numbers repeat the 2026-11-12 sets, so every file went up as `DSC0NNNN-b.png`): nine sets in Sets,
    each "an exclusive diamond-style design" (the owner: "the diamond style sets are very exclusive diamond style designs") — the
    words never say diamond alone, the stones stay American Diamond; in Bangles & Cuffs a zircon bamboo pair, four meenakari pairs (sky
    blue, white, navy, pink; each with the group photo 09976-b second) and the four pairs together (09975-b + 09976/77/74-b).
  - **New products, 2026-11-23** (the owner's Drive folder "NEW PRODUCTS HOM": DSC09980–09997 without 09983, retouched 1254² PNGs, gold plated;
    uploaded with upload.php `to=local`): a chevron set (Sets), two bangle and ring sets (Wristwear → Bangle & Ring Sets; the Ruby Channel
    set's photo shows only the bangle) and nine opal and pearl rings in Rings & Bands (a folder of two photos = one piece, the second in
    `also`). All named off the photo (the owner may rename); coloured stones worded simulated. Actions would not start that day (`startup_failure`: GitHub's payment,
    sorted the next day), so each lead photo went up first as a POS drop named after the piece (words through
    override.php, key `mina/piece/new-<slug>-<t>`). Drops are never branded, so the ERP and posts showed them without the MINA mark
    (the owner: "why dont any of the images have my logo"): each went up again branded by `scripts/brand.mjs` as `<name>-2.png`, its words
    moved to the new key and the unmarked first copy hidden (this repo's upload.php has no `action=remove`). Once this build is live, hide
    all 24 drops (override.php `hidden`) and send each drop address to its piece's page (`public/.htaccess`).
  - **Ruby Emerald Choker Set with Tikka, 2026-11-23** (the owner's Drive file `IMG_3835-retouched.png`, 1086×1448 on a grey tray):
    cropped square on the set and sized to 1254² → `catalog-src/local/IMG_3835.png`, a local piece in Sets; up first as a branded drop
    like the batch above (`Sets/Sets/Ruby Emerald Choker Set with Tikka.png`), to be hidden the same way once this build is live.
  - **Two more sets, 2026-11-23** (the owner's Drive files `IMG_6133.PNG`, 1024² on a maroon bust, and `IMG_2750-retouched.png`, 1086×1448 in
    the red box, cropped square on the set to 1254²): Gold Filigree Leaf Drop Set and Pearl Fringe Jhumka Choker Set (rhodium) in Sets, named
    off the photo; up first as branded drops like the batch above, to be hidden the same way once this build is live.
  - **Rings from Gemini renders (2026-09-23):** six renders in taheri-shop `output/imagegen/mina-catalogue-2026-09-23/`
    (its `final-manifest.json` names each source photo) → `ring-0N-….jpg`, **each its own piece** — three looked like
    Shopify rings (Ruby Wishbone, Azzura, Emerald Double Halo) and the owner said they are not the same.
  - **3D renders from an iCloud shared album (2026-09-24):** the owner's album "03-Sep-2020" (4 photos, DSC09171–74,
    Sony A6400, only 311×552 in the share) → e-commerce 3D product renders with `gemini-3-pro-image` on Vertex
    (project `jewelgen-mm-e3d43ecb`, mmurtaza1970's ADC): pure white, mirror reflection, bright rhodium, the stones as
    photographed. Two to four rolls each, the closest kept → `ring-07`…`ring-10-….jpg` (2048², `catalog-src/local/`),
    each its own piece in Rings & Bands. The shared album's originals come from CloudKit
    (`shared/changes/zone` with the share's `publicAccessAuthToken` and the owner record from `public/records/resolve`).
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
- **Changes from the counter** (2026-09-27) — the POS's Website → Edit a piece re-makes a piece's photograph (crop, the
  weight and the mark, AI enhance) or changes its name, words (`story`, blank line = paragraph) and facts, or hides it,
  through `public/api/override.php` (same secret as upload.php; the same two files as taheri.shop's, `api/_overrides.php`).
  Words: `public_html/catalog-overrides.json`, keyed `mina/piece/<handle>`, handed to the app by `api/catalog.php` and applied
  in `buildCatalog` (`data.overrides`; a hidden piece leaves every page, the address stays). A photograph is written over
  its own `catalog-thumb/`/`catalog-full/` files (original kept in `catalog-edit/originals/`), with `photo.v` (and its new
  `w`/`h`) on the image. The prerender reads the live list (`/api/override.php`) for the pages; `catalog-pieces.json` lists
  the site's **own** words (plus `story`, `facts`, the first photo's `source` before framing and the MINA mark — Shopify's CDN
  or `catalog-src/` — and `marked` when the source carries a mark already) and the POS lays the changes over them, live. The
  POS edits from `source` and puts the MINA mark back where brand.mjs does (`/brand/mina-wordmark.svg` in the POS). Weights
  typed at the counter live in the change (`weightGrams`), not shown on the catalogue.

## Deploy (`.github/workflows/deploy.yml`)

**A Cloud Build fallback is ready but not wired** (2026-11-23): while GitHub gave the account's Actions no runner, deploys were
moved to Google Cloud Build (`scripts/cloud/deploy.sh`, `cloudbuild-trigger.json`, `cloudbuild-setup.sh`; dry-run tested). The
owner's setup stored `hostinger-deploy-key` and made `gs://gemstrack-pos-site-builds`, then stopped at the GitHub token check;
the owner fixed GitHub's payment the next day ("route everything back normally"), so pushes deploy through Actions as before
and no trigger exists. To switch over again: finish `cloudbuild-setup.sh` and take the `push:` triggers off both workflows.

Push to `main` → build (photos from cache or Shopify's CDN) → sanity gate → rsync over SSH to
`~/domains/catalogue.houseofmina.store/public_html` on the same Hostinger account as taheri.shop.
Gated by the repository variable `DEPLOY_ENABLED=1`. "Run workflow" with **sync** ticked re-copies
from Shopify first and commits it. rsync never deletes; `catalog-drop/` is never touched, nor any photograph the counter
re-made (the deploy reads the server's `catalog-overrides.json` first and excludes each `photo.edited` file; if it can't
read it, it stops rather than put the old photographs back).

GitHub Actions ran out of minutes in October 2026 (runs failed at once, `runner_id` 0); the owner raised the spending limit on 2026-10-12. They stopped again on 2026-10-24 (every run in this repo and taheri-pos failed at once); the owner raised the budget on 2026-10-26. A run that failed that way is not re-runnable from a cloud session (403): push again. On 2026-11-23 runs failed at startup (`startup_failure`, path `BuildFailed`) with the budget unspent: the repo had
become private; the owner made it public again that day (public repos' Actions are free). Keep it public.
**Cloud sessions** (claude.ai/code) can push only their own `claude/…` branch; `cloud-deploy.yml` merges main into it,
puts it on main and starts this deploy — no review (owner, 2026-09-27). A branch that doesn't merge cleanly fails there:
rebase on main and push again. The ERP's CLAUDE.md (taheri-pos), "Cloud sessions", has the rest.

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
