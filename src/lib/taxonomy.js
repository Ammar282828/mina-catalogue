/**
 * How House of Mina's pieces are arranged: chapters, the collections inside
 * them, the edits that cut across them, and the facets a gallery filters by.
 *
 * Shared by scripts/sync-shopify.mjs, which decides each piece's home when it
 * copies the catalogue over, and by the app, which lays the menus out. Plain
 * JavaScript with no imports, so both Node and Vite can load it.
 *
 * Every piece has exactly one home — a collection inside a chapter — because
 * its page lives at /<collection>/<piece>. Shopify lets a product sit in a
 * dozen collections; here those memberships become edits (Ascension, Heirloom,
 * Spring Drop '26…) and link to the piece without owning it.
 */

export const CHAPTERS = [
  {
    slug: 'rings', title: 'Rings', shape: 'rings',
    blurb: 'Solitaires, halos, heirloom stones and the bands worn every day.',
    collections: [
      { slug: 'engagement-rings', title: 'Engagement Rings', blurb: 'Solitaires and halos, set to be asked with.' },
      { slug: 'gemstone-rings', title: 'Gemstone Rings', blurb: 'Emerald, ruby and coloured stones in heirloom settings.' },
      { slug: 'cocktail-rings', title: 'Cocktail Rings', blurb: 'Rings meant to be noticed across the room.' },
      { slug: 'everyday-rings', title: 'Everyday Rings', blurb: 'Bands and small stones to wear from morning to night.' },
    ],
  },
  {
    slug: 'earrings', title: 'Earrings', shape: 'earrings',
    blurb: 'Studs, hoops, huggies and drops.',
    collections: [
      { slug: 'studs', title: 'Studs', blurb: 'A single stone, close to the ear.' },
      { slug: 'hoops-and-huggies', title: 'Hoops & Huggies', blurb: 'Circles, small and large.' },
      { slug: 'statement-earrings', title: 'Statement Earrings', blurb: 'Drops and clusters for the evening and the wedding.' },
      { slug: 'everyday-earrings', title: 'Everyday Earrings', blurb: 'Light enough to forget you are wearing them.' },
    ],
  },
  {
    slug: 'necklaces', title: 'Necklaces & Pendants', shape: 'chains',
    blurb: 'Pendants, chokers and fine chains.',
    collections: [
      { slug: 'pendants', title: 'Pendants', blurb: 'One stone, one charm, one chain.' },
      { slug: 'chokers', title: 'Chokers', blurb: 'Pearl and pavé, close at the throat.' },
      { slug: 'everyday-necklaces', title: 'Everyday Necklaces', blurb: 'Fine chains and collars in sterling silver.' },
      { slug: 'sets', title: 'Sets', blurb: 'Pieces made to be worn together.' },
    ],
  },
  {
    slug: 'bracelets', title: 'Bracelets & Bangles', shape: 'bangles',
    blurb: 'Tennis bracelets, chains, bangles and cuffs.',
    collections: [
      { slug: 'tennis-bracelets', title: 'Tennis Bracelets', blurb: 'An unbroken line of stones.' },
      { slug: 'everyday-bracelets', title: 'Everyday Bracelets', blurb: 'Chains, charms and links for the wrist.' },
      { slug: 'bangles-and-cuffs', title: 'Bangles & Cuffs', blurb: 'Solid circles in silver.' },
    ],
  },
  {
    slug: 'men', title: "Men's", shape: 'band',
    blurb: 'Rings, chains and bracelets with clean lines.',
    collections: [
      { slug: 'mens-rings', title: "Men's Rings", blurb: 'Bands and signets, cut clean.' },
      { slug: 'mens-chains', title: "Men's Chains", blurb: 'Rope, box, Cuban and curb.' },
      { slug: 'mens-bracelets', title: "Men's Bracelets", blurb: 'Links and cuffs for the wrist.' },
    ],
  },
];

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

/**
 * The home of one Shopify product. `tags` and `memberships` are sets of
 * lower-cased tags and collection handles. The order of the tests is the
 * precedence: a men's emerald ring is a men's ring before it is a gemstone ring.
 */
export function classify(product, tags, memberships) {
  const has = (...xs) => xs.some((x) => tags.has(x));
  const inCol = (...xs) => xs.some((x) => memberships.has(x));
  const type = lc(product.product_type);

  if (inCol('mens-collection', 'mens-rings', 'mens-chains', 'mens-bracelets') || has("men's cuff")) {
    if (type === 'ring') return ['men', 'mens-rings'];
    if (type === 'bracelet' || type === 'bangle') return ['men', 'mens-bracelets'];
    return ['men', 'mens-chains'];
  }

  // The name is often more exact than the tags: "Azira Sapphire Ring" carries no
  // sapphire tag. "Emerald cut" is a shape, not a stone.
  const namedStone = /\b(sapphire|ruby|emerald(?!\s+cut)|peridot|opal|topaz|amethyst|garnet|citrine|aquamarine|morganite|tourmaline)\b/i.test(product.title || '');

  if (type === 'ring') {
    if (inCol('heirloom-jewelry-emerald-rings', 'heirloom-jewelry-ruby-rings') || namedStone
      || has('emerald', 'simulated emerald', 'ruby', 'sapphire', 'blue topaz')) return ['rings', 'gemstone-rings'];
    if (has('engagement ring', 'solitaire', 'halo ring')) return ['rings', 'engagement-rings'];
    if (has('cocktail ring', 'statement ring')) return ['rings', 'cocktail-rings'];
    return ['rings', 'everyday-rings'];
  }

  if (type === 'earrings') {
    if (has('studs', 'stud')) return ['earrings', 'studs'];
    if (has('hoops', 'hoop earrings', 'huggies', 'huggie earrings', 'bali earrings', 'climber')) return ['earrings', 'hoops-and-huggies'];
    if (has('statement', 'drop earrings', 'bridal', 'festive')) return ['earrings', 'statement-earrings'];
    return ['earrings', 'everyday-earrings'];
  }

  if (type === 'set') return ['necklaces', 'sets'];
  if (type === 'pendant' || has('solitaire pendant', 'pendant necklace')) return ['necklaces', 'pendants'];
  if (type === 'necklace') {
    if (inCol('womens-chokers') || has('choker')) return ['necklaces', 'chokers'];
    if (inCol('womens-pendants') || has('pendant')) return ['necklaces', 'pendants'];
    return ['necklaces', 'everyday-necklaces'];
  }

  if (type === 'bracelet' || type === 'bangle') {
    if (has('tennis bracelet')) return ['bracelets', 'tennis-bracelets'];
    if (type === 'bangle' || has('cuff', 'bangle')) return ['bracelets', 'bangles-and-cuffs'];
    return ['bracelets', 'everyday-bracelets'];
  }

  // A type this list has not met yet. Better an everyday home than no page.
  return ['rings', 'everyday-rings'];
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
    ...CHAPTERS.flatMap((c) => c.collections.map((x) => x.slug)),
    ...EDITS.map((e) => e.slug),
  ];
}
