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
 * category and its page lives at /<category>/<piece>. Shopify lets a product sit
 * in a dozen collections; here those memberships become edits (Ascension,
 * Heirloom, For Him…) and link to the piece without owning it.
 *
 * `CHAPTERS` keeps its name: the landing scrolls through them as chapters.
 */
export const CHAPTERS = [
  { slug: 'rings-and-bands', title: 'Rings & Bands', shape: 'rings', blurb: 'Solitaires, halos, coloured stones and the bands worn every day.' },
  { slug: 'wristwear', title: 'Wristwear', shape: 'bangles', blurb: 'Bracelets, bangles and cuffs — and bangles with a ring to match.' },
  { slug: 'chains-and-pendants', title: 'Chains & Pendants', shape: 'chains', blurb: 'Pendants, chokers and fine chains.' },
  { slug: 'sets', title: 'Sets', shape: 'gem', blurb: 'Pieces made to be worn together.' },
  { slug: 'earrings', title: 'Earrings', shape: 'earrings', blurb: 'Studs, hoops, huggies and drops.' },
];

/** Where each retired style collection (and chapter) went — the .htaccess redirects say the same. */
export const RETIRED = {
  rings: 'rings-and-bands', 'engagement-rings': 'rings-and-bands', 'gemstone-rings': 'rings-and-bands',
  'cocktail-rings': 'rings-and-bands', 'everyday-rings': 'rings-and-bands', 'mens-rings': 'rings-and-bands',
  bracelets: 'wristwear', 'tennis-bracelets': 'wristwear', 'everyday-bracelets': 'wristwear',
  'bangles-and-cuffs': 'wristwear', 'mens-bracelets': 'wristwear',
  necklaces: 'chains-and-pendants', pendants: 'chains-and-pendants', chokers: 'chains-and-pendants',
  'everyday-necklaces': 'chains-and-pendants', 'mens-chains': 'chains-and-pendants',
  studs: 'earrings', 'hoops-and-huggies': 'earrings', 'statement-earrings': 'earrings', 'everyday-earrings': 'earrings',
  men: 'for-him',
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
  // Not a Shopify collection: every men's piece (see isMens), so they stay one
  // tap away now that Men's is no longer a category.
  { handle: null, slug: 'for-him', title: 'For Him', blurb: 'Rings, chains, bracelets and cuffs with clean lines.' },
];

const lc = (s) => String(s || '').trim().toLowerCase();

/** A men's piece, by Shopify's men's collections or tag. It joins the For Him edit. */
export function isMens(tags, memberships) {
  return ['mens-collection', 'mens-rings', 'mens-chains', 'mens-bracelets'].some((x) => memberships.has(x)) || tags.has("men's cuff");
}

/** The category of one Shopify product, by what it is. `tags` is a set of lower-cased tags. */
export function classify(product, tags) {
  const type = lc(product.product_type);
  if (type === 'ring') return 'rings-and-bands';
  if (type === 'earrings') return 'earrings';
  if (type === 'set') return 'sets';
  if (type === 'bracelet' || type === 'bangle' || tags.has('cuff') || tags.has("men's cuff")) return 'wristwear';
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
      { label: 'American Diamond', match: ['american diamonds', 'american diamond', 'cubic zirconia'] },
      { label: 'Moissanite', match: ['moissanite'] },
      { label: 'Pearl', match: ['freshwater pearl', 'freshwater pearls', 'pearl'] },
      { label: 'Emerald', match: ['emerald', 'simulated emerald'] },
      { label: 'Ruby', match: ['ruby'] },
      { label: 'Blue Topaz', match: ['blue topaz'] },
      { label: 'Zircon', match: ['zircon', 'european zircon', 'european zircons', 'green zircon', 'green zirconia', 'pavé zircon'] },
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
    ...CHAPTERS.map((c) => c.slug),
    ...EDITS.map((e) => e.slug),
  ];
}
