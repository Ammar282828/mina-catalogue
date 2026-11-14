/**
 * How House of Mina's pieces are arranged: categories, the edits that cut
 * across them, and the facets a gallery filters by.
 *
 * Shared by scripts/sync-shopify.mjs, which decides each piece's category when
 * it copies the catalogue over, and by the app, which lays the menus out. Plain
 * JavaScript with no imports, so both Node and Vite can load it.
 *
 * Arranged the way taheri.shop is: by what a piece IS (a ring, something for
 * the wrist, a chain or pendant, a set, earrings) — one level, no style
 * sub-collections (the owner's call, 2026-09-23; the style of a piece is a
 * filter — stone, setting, occasion — not a place). Every piece has exactly one
 * home and its page lives at /<home>/<piece>. Shopify lets a product sit in a
 * dozen collections; here those memberships become edits (Ascension,
 * Heirloom…) and link to the piece without owning it.
 *
 * Men's is the one section with sub-categories (the owner, later on 2026-09-23):
 * a men's piece lives there — /mens-rings/emblem-ring — not in the category of
 * its type. A chapter with `collections` is that kind of section; its own page
 * lists every piece of its sub-categories.
 *
 * `CHAPTERS` keeps its name: the landing scrolls through them as chapters.
 */
export const CHAPTERS = [
  { slug: 'rings-and-bands', title: 'Rings & Bands', shape: 'rings', blurb: 'Solitaires, halos, coloured stones and the bands worn every day.' },
  {
    // A section since 2026-09-24 (the owner): each piece's home is one of these, sorted by
    // wristwearHome() below — the Shopify sync, data/local.json and the POS drops all go through it.
    slug: 'wristwear', title: 'Wristwear', shape: 'bangles', blurb: 'Bracelets, bangles and cuffs — and bangles with a ring to match.',
    collections: [
      { slug: 'bangle-and-ring-sets', title: 'Bangle & Ring Sets', blurb: 'Bangles and bracelets, each with its matching ring.' },
      { slug: 'bangles-and-cuffs', title: 'Bangles & Cuffs', blurb: 'Single bangles and pairs, open bangles and cuffs.' },
      { slug: 'bracelets', title: 'Bracelets', blurb: 'Tennis, line and chain bracelets, and the Stackables.' },
    ],
  },
  { slug: 'chains-and-pendants', title: 'Chains & Pendants', shape: 'chains', blurb: 'Pendants, chokers and fine chains.' },
  // Calligraphy pendants and lockets that open (the owner, 2026-09-24): a category of their own.
  { slug: 'lockets', title: 'Lockets', shape: 'heart', blurb: 'Allah, the Kalma, Ali and calligraphy coins — pendants and lockets that open.' },
  { slug: 'sets', title: 'Sets', shape: 'gem', blurb: 'Pieces made to be worn together.' },
  // A locket with earrings to match, often a ring, once a bangle (the owner, 2026-10-01: "make a new locket set category").
  { slug: 'locket-sets', title: 'Locket Sets', shape: 'chains', blurb: 'A locket and earrings to match — many with a ring.' },
  { slug: 'earrings', title: 'Earrings', shape: 'earrings', blurb: 'Studs, hoops, huggies and drops.' },
  {
    slug: 'men', title: "Men's", noun: "Men's Jewelry", shape: 'band',
    blurb: 'Rings, natural rubies, chains, bracelets and cuffs with clean lines.',
    material: '925 sterling silver, some set with natural rubies',
    collections: [
      { slug: 'mens-rings', title: "Men's Rings", blurb: 'Bands and signets, cut clean.' },
      { slug: 'natural-ruby-rings', title: 'Natural Ruby Rings', blurb: "Gents' rings in silver, each set with a natural ruby in a gold-plated bezel.",
        material: 'silver, each set with a natural ruby' },
      { slug: 'mens-chains', title: "Men's Chains", blurb: 'Box, Cuban, curb, rope and snake.' },
      { slug: 'mens-bracelets', title: "Men's Bracelets & Cuffs", blurb: 'Links, chains and cuffs for the wrist.' },
    ],
  },
];

/**
 * Where a wrist piece lives in Wristwear, from its type and name: sold with a ring (a
 * "Bangle & Ring", "Bracelet & Ring", or a bangle-and-ring "Set") → Bangle & Ring Sets; a
 * bangle or a cuff → Bangles & Cuffs; anything else — tennis, line, chain → Bracelets.
 */
export function wristwearHome(p) {
  const type = lc(p.type || p.product_type), title = lc(p.t || p.title);
  if (/\bring\b/.test(type) || type === 'set' || /\bring\b/.test(title)) return 'bangle-and-ring-sets';
  if (/\bcuffs?\b/.test(`${type} ${title}`) || /\bbangles?\b/.test(type) || /\bbangles?\b/.test(title)) return 'bangles-and-cuffs';
  return 'bracelets';
}

/** A home as data may still name it: "wristwear" is a section now, so it becomes one of its sub-categories. */
export const homeOf = (co, p) => (co === 'wristwear' ? wristwearHome(p) : co);

/** The chapter a home belongs to: a category, or the section a sub-category sits in. */
export const chapterOf = (slug) => CHAPTERS.find((c) => (c.collections ? c.collections.some((k) => k.slug === slug) : c.slug === slug));

/** Where each retired style collection (and chapter) went — the .htaccess redirects say the same. */
export const RETIRED = {
  rings: 'rings-and-bands', 'engagement-rings': 'rings-and-bands', 'gemstone-rings': 'rings-and-bands',
  'cocktail-rings': 'rings-and-bands', 'everyday-rings': 'rings-and-bands',
  // Bracelets and Bangles & Cuffs are Wristwear's own sub-categories again (2026-09-24).
  'tennis-bracelets': 'bracelets', 'everyday-bracelets': 'bracelets',
  necklaces: 'chains-and-pendants', pendants: 'chains-and-pendants', chokers: 'chains-and-pendants',
  'everyday-necklaces': 'chains-and-pendants',
  studs: 'earrings', 'hoops-and-huggies': 'earrings', 'statement-earrings': 'earrings', 'everyday-earrings': 'earrings',
  // For Him was an edit until Men's became a section of its own.
  'for-him': 'men',
};

/**
 * Shopify collections that become edits here, in the order they are shown.
 * Anything not listed (Women's Rings, Fine Rings, the per-type subsets of an
 * edit) duplicates a chapter and is left out.
 */
export const EDITS = [
  { handle: 'campaign-spring-26', slug: 'spring-drop-26', title: "Spring Drop '26" },
  { handle: 'ascension', slug: 'ascension', title: 'Ascension' },
  { handle: 'heirloom-jewelry', slug: 'heirloom', title: 'Heirloom' },
  { handle: 'campaign-eid-gemstone', slug: 'gemstone-edit', title: 'The Gemstone Edit' },
  { handle: 'painted-summer-collection', slug: 'painted-summer', title: 'Painted Summer' },
  { handle: 'moissanite', slug: 'moissanite', title: 'Moissanite' },
  { handle: 'pearl', slug: 'pearl', title: 'Pearl' },
  { handle: 'birthstone-jewelry', slug: 'birthstones', title: 'Birthstones' },
  { handle: 'campaign-valentines', slug: 'valentines-edit', title: "Valentine's Edit" },
  { handle: 'best-sellers', slug: 'best-sellers', title: 'Best Sellers' },
];

const lc = (s) => String(s || '').trim().toLowerCase();

/** A men's piece, by Shopify's men's collections or tag. Its home is in Men's. */
export function isMens(tags, memberships) {
  return ['mens-collection', 'mens-rings', 'mens-chains', 'mens-bracelets'].some((x) => memberships.has(x)) || tags.has("men's cuff");
}

/**
 * The home of one Shopify product: a men's piece in its Men's sub-category, any
 * other in the category of what it is. `tags` is a set of lower-cased tags,
 * `memberships` the handles of its Shopify collections.
 */
/**
 * Pieces Shopify types wrongly, filed by hand (the owner, 2026-11-14: "mina classics are earrings and rania set
 * are rings, shouldnt be in sets"). Keyed by the piece's handle here and the shop's; the sync and the build both
 * read it, so a later sync keeps them where they belong.
 */
export const HOME_OF = { 'the-rania-set': 'rings-and-bands', 'mina-classics': 'earrings' };

export function classify(product, tags, memberships = new Set()) {
  if (HOME_OF[product.handle]) return HOME_OF[product.handle];
  const type = lc(product.product_type);
  if (isMens(tags, memberships)) {
    if (type === 'ring') return 'mens-rings';
    if (type === 'bracelet' || type === 'bangle' || tags.has('cuff') || tags.has("men's cuff")) return 'mens-bracelets';
    return 'mens-chains';
  }
  if (type === 'ring') return 'rings-and-bands';
  if (type === 'earrings') return 'earrings';
  // A bracelet (or bangle) with its ring is worn on the wrist — taheri.shop files
  // "Bangle & Ring" under Wristwear too. Sets proper are necklace sets.
  if (type === 'set' && (product.options || []).some((o) => /bracelet|bangle/i.test(o.name))) return wristwearHome(product);
  if (type === 'set') return 'sets';
  if (type === 'bracelet' || type === 'bangle' || tags.has('cuff') || tags.has("men's cuff")) return wristwearHome(product);
  if (tags.has('locket') || /\blockets?\b/i.test(product.title || '')) return 'lockets';
  if (type === 'necklace' || type === 'pendant' || type === 'chain') return 'chains-and-pendants';
  // A type this list has not met yet. Better a home than no page.
  return 'rings-and-bands';
}

/**
 * Filter facets, read from Shopify's tags. The tags are hand-typed and come in
 * several spellings ("Pavé", "Pave", "Pavé Zircon"); each facet value lists
 * the spellings it gathers, lower-cased.
 */
export const FACETS = [
  {
    key: 'stone', label: 'Stone', values: [
      // Zircon / CZ is what the house calls American Diamonds (src/lib/stones.js).
      { label: 'American Diamond', match: ['american diamonds', 'american diamond', 'cubic zirconia', 'zircon', 'european zircon', 'european zircons', 'green zircon', 'green zirconia', 'pavé zircon'] },
      { label: 'Moissanite', match: ['moissanite'] },
      { label: 'Pearl', match: ['freshwater pearl', 'freshwater pearls', 'pearl'] },
      { label: 'Emerald', match: ['emerald', 'simulated emerald'] },
      { label: 'Ruby', match: ['ruby'] },
      // A real stone, not simulated: the gents' silver rings (data/local.json, `natural`).
      { label: 'Natural Ruby', match: ['natural ruby'] },
      { label: 'Blue Topaz', match: ['blue topaz'] },
      { label: 'Lab-Grown Diamond', match: ['lab-grown diamonds'] },
      { label: 'No Stone', match: ['no stone', 'plain'] },
    ],
  },
  {
    key: 'setting', label: 'Setting', values: [
      { label: 'Solitaire', match: ['solitaire', 'solitaire pendant'] },
      { label: 'Halo', match: ['halo ring', 'halo', 'halo bracelet'] },
      { label: 'Pavé', match: ['pavé', 'pave'] },
      { label: '4-Prong', match: ['4-prong'] },
      { label: '6-Prong', match: ['6-prong'] },
      { label: 'High Set', match: ['high set'] },
      { label: 'Low Set', match: ['low set'] },
    ],
  },
  {
    key: 'cut', label: 'Cut', values: [
      { label: 'Round', match: ['round cut stone'] },
      { label: 'Oval', match: ['oval cut stone'] },
      { label: 'Emerald Cut', match: ['emerald cut stone'] },
      { label: 'Princess', match: ['princess cut stone', 'princess cut stones'] },
      { label: 'Pear', match: ['pear cut stones'] },
      { label: 'Marquise', match: ['marquise cut stone'] },
      { label: 'Heart', match: ['heart cut', 'heart'] },
    ],
  },
  {
    key: 'occasion', label: 'Occasion', values: [
      { label: 'Everyday', match: ['everyday', 'casual'] },
      { label: 'Bridal', match: ['bridal', 'wedding'] },
      { label: 'Festive', match: ['festive', 'evening wear'] },
      { label: 'Gifting', match: ['gifting'] },
    ],
  },
  {
    key: 'style', label: 'Style', values: [
      { label: 'Minimalist', match: ['minimalist'] },
      { label: 'Statement', match: ['statement', 'statement ring', 'cocktail ring'] },
      { label: 'Vintage', match: ['vintage'] },
    ],
  },
];

/** { stone: ['Moissanite'], occasion: ['Bridal', 'Festive'], … } for one product's tags. */
export function facetsOf(tags) {
  const out = {};
  for (const f of FACETS) {
    const hits = f.values.filter((v) => v.match.some((m) => tags.has(m))).map((v) => v.label);
    if (hits.length) out[f.key] = hits;
  }
  return out;
}

/** Price bands for the price filter, in rupees. */
export const PRICE_BANDS = [
  { key: 'u8', label: 'Under 8,000', min: 0, max: 7999 },
  { key: '8-15', label: '8,000 – 15,000', min: 8000, max: 15000 },
  { key: '15-25', label: '15,000 – 25,000', min: 15001, max: 25000 },
  { key: '25+', label: 'Over 25,000', min: 25001, max: Infinity },
];

/** Every route slug a gallery can own. Used to refuse a collision at sync time. */
export function allGallerySlugs() {
  return [
    ...CHAPTERS.flatMap((c) => [c.slug, ...(c.collections || []).map((k) => k.slug)]),
    ...EDITS.map((e) => e.slug),
  ];
}
