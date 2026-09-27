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
- **Links to houseofmina.store** (the owner, 2026-09-24): the sync marks every product from the public feed `shop: true`
  (published there; drafts from `shopify-drafts.json` never are), and `shopUrl()` in `src/lib/contact.js` gives
  `https://houseofmina.store/products/<handle>` for those only — the piece page's "Buy online" button and a line under it,
  and a link on the prerendered page. A product unpublished on Shopify loses its link at the next `npm run sync`.
- **No prices** (the owner, 2026-09-24): `SHOW_PRICES = false` in `src/lib/catalog.js`. The sync writes `price: null` and
  keeps the option that decided a price (`priceBy`) without its figures, so no price reaches the pages or the app's
  script. Piece pages say "Ask us on WhatsApp for the price"; there is no price filter or sort, no `Offer` in the
  JSON-LD and no `priceRange` in `index.html`. Flip the switch and run a sync to bring prices back.
- **Order of every gallery** (the owner, 2026-09-24: "sort by new and prettiness"): the pieces added in the last
  30 days first (`FIRST_DAYS`; a POS drop counts as new), prettiest first, then the rest, prettiest first; newer first on
  a tie (`orderer()` in catalog.js — categories, sub-categories, sections, edits and New Arrivals alike). Prettiness is
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
    gold-plated bezel). A portrait photo shows whole on a piece page (frame up to 2:3); tiles stay square.
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
  - **Sets from Instagram posts (2026-09-23):** seven "Full Set" posts (1080px, `~/Downloads/PHOTO-2026-….jpg`); four
    were already on the site (Ruby Line, Pavé Fan Bridal, Aqua Bloom, and Sapphire Two-Row — that post shows it gold
    with darker stones) and were not repeated. The other three are local pieces under their file names: Sapphire
    Pearl Choker Set, Emerald Swirl Set, Emerald Cascade Set.
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
  the site's **own** words (plus `story` and `facts` for the editor) and the POS lays the changes over them, live. Weights
  typed at the counter live in the change (`weightGrams`), not shown on the catalogue.

## Deploy (`.github/workflows/deploy.yml`)

Push to `main` → build (photos from cache or Shopify's CDN) → sanity gate → rsync over SSH to
`~/domains/catalogue.houseofmina.store/public_html` on the same Hostinger account as taheri.shop.
Gated by the repository variable `DEPLOY_ENABLED=1`. "Run workflow" with **sync** ticked re-copies
from Shopify first and commits it. rsync never deletes; `catalog-drop/` is never touched, nor any photograph the counter
re-made (the deploy reads the server's `catalog-overrides.json` first and excludes each `photo.edited` file; if it can't
read it, it stops rather than put the old photographs back).

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
