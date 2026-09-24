/**
 * What to show beside a piece, and what to show a returning visitor (the owner, 2026-09-25:
 * "heavily add recommendation, upselling algorithms").
 *
 * scripts/similar.mjs ranks once, on the owner's Mac, into data/recommend.json: for each piece
 * the pieces most like it (`like` — the same kind, by how alike the photographs look to Vertex
 * image embeddings, then stones, plating, style and prettiness) and the pieces that go with it
 * (`pair` — other kinds, GOES_WITH below, plating matched: gold with gold). This file turns those
 * lists into what a page shows, and into "picked for you" from what this visitor looked at and
 * saved (this device only, src/lib/store.js). A piece the ranking has not seen yet (a counter
 * drop, a piece added since) falls back to its kind's prettiest pieces.
 */

/** What a piece is, by its home. */
export const KIND = {
  'rings-and-bands': 'ring', 'bangle-and-ring-sets': 'wrist-set', 'bangles-and-cuffs': 'bangle', bracelets: 'bracelet',
  'chains-and-pendants': 'pendant', lockets: 'locket', sets: 'set', earrings: 'earring',
  'mens-rings': 'mens-ring', 'natural-ruby-rings': 'mens-ring', 'mens-chains': 'mens-chain', 'mens-bracelets': 'mens-bracelet',
};

/** "Complete the look": the kinds that go with a kind, most wanted first. */
export const GOES_WITH = {
  ring: ['earring', 'pendant', 'bracelet', 'set'],
  earring: ['ring', 'pendant', 'set', 'bracelet'],
  pendant: ['earring', 'ring', 'bracelet'],
  locket: ['pendant'],
  bangle: ['ring', 'earring', 'bracelet'],
  bracelet: ['ring', 'earring', 'pendant'],
  'wrist-set': ['earring', 'pendant', 'set'],
  set: ['ring', 'bracelet', 'bangle'],
  'mens-ring': ['mens-chain', 'mens-bracelet'],
  'mens-chain': ['mens-ring', 'mens-bracelet'],
  'mens-bracelet': ['mens-ring', 'mens-chain'],
};

/** What a kind is called beside a recommendation ("Earrings to match"). */
export const KIND_LABEL = {
  ring: 'Ring', earring: 'Earrings', pendant: 'Pendant', locket: 'Locket', bangle: 'Bangle', bracelet: 'Bracelet',
  'wrist-set': 'Bangle & ring', set: 'Set', 'mens-ring': "Men's ring", 'mens-chain': "Men's chain", 'mens-bracelet': "Men's bracelet",
};

export const kindOf = (p) => (p ? KIND[p.co] || null : null);
const id = (p) => p.s || p.h;

export function recommender(pieces, bySlug, rec = {}, pretty = {}, isNew = () => false) {
  const keys = rec.keys || [];
  const at = new Map(keys.map((k, i) => [k, i]));
  const vals = Object.values(pretty).filter((n) => typeof n === 'number').sort((a, b) => a - b);
  const median = vals.length ? vals[vals.length >> 1] : 50;
  const prettyOf = (p) => pretty[id(p)] ?? median;
  const byKind = new Map();
  for (const p of [...pieces].sort((a, b) => prettyOf(b) - prettyOf(a))) {
    const k = kindOf(p);
    if (!k) continue;
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k).push(p);
  }
  const listed = (field, p) => {
    const i = at.get(id(p));
    return i == null ? null : (rec[field]?.[i] || []).map((n) => bySlug.get(keys[n])).filter((x) => x && x !== p);
  };
  const platingFits = (a, b) => !a.plating?.length || !b.plating?.length || a.plating.some((v) => b.plating.includes(v));

  /** The pieces most like this one, of the same kind. */
  function like(p, n = 8) {
    const got = listed('like', p);
    if (got?.length) return got.slice(0, n);
    return (byKind.get(kindOf(p)) || []).filter((x) => x !== p && x.co === p.co).slice(0, n);
  }

  /** Pieces of other kinds that go with this one — one of each kind first. */
  function pairs(p, n = 4) {
    let got = listed('pair', p);
    if (!got) {
      got = (GOES_WITH[kindOf(p)] || []).flatMap((k) => (byKind.get(k) || []).filter((x) => platingFits(p, x)).slice(0, 2));
    }
    const kinds = new Set();
    const first = [], rest = [];
    for (const x of got) (kinds.has(kindOf(x)) ? rest : (kinds.add(kindOf(x)), first)).push(x);
    return [...first, ...rest].slice(0, n);
  }

  /** The same, for a list (the saved pieces): what goes with them that is not in it already. */
  function pairsForList(list, n = 8) {
    const have = new Set(list.map(id));
    const haveKinds = new Set(list.map(kindOf));
    const score = new Map();
    list.slice(0, 12).forEach((p, i) => pairs(p, 6).forEach((x, r) => {
      if (have.has(id(x))) return;
      score.set(x, (score.get(x) || 0) + (1 / (1 + i * 0.2)) / (1 + r * 0.4) + (haveKinds.has(kindOf(x)) ? 0 : 0.3));
    }));
    return spread([...score].sort((a, b) => b[1] - a[1]).map(([x]) => x), n);
  }

  /**
   * Picked for this visitor: pieces like the ones they saved (counted double) and looked at
   * (the latest counts most), and a little of what goes with them; then a nudge for pretty
   * and new pieces, and no more than a third from one gallery. Empty for a first visit.
   */
  function forYou({ viewed = [], saved = [], exclude = [], n = 12, only } = {}) {
    const seeds = [...saved.slice(0, 16).map((p, i) => [p, 2 / (1 + i * 0.15)]), ...viewed.slice(0, 12).map((p, i) => [p, 1 / (1 + i * 0.3)])];
    if (!seeds.length) return [];
    const skip = new Set([...viewed, ...saved, ...exclude].map(id));
    const score = new Map();
    const bump = (x, w) => { if (!skip.has(id(x)) && (!only || only(x))) score.set(x, (score.get(x) || 0) + w); };
    for (const [p, w] of seeds) {
      like(p, 12).forEach((x, r) => bump(x, w / (1 + r * 0.25)));
      pairs(p, 6).forEach((x, r) => bump(x, (0.4 * w) / (1 + r * 0.3)));
    }
    const ranked = [...score]
      .map(([x, s]) => [x, s * (1 + 0.25 * ((prettyOf(x) - 50) / 50) + (isNew(x) ? 0.15 : 0))])
      .sort((a, b) => b[1] - a[1])
      .map(([x]) => x);
    return spread(ranked, n);
  }

  // No more than a third of a list from one gallery, keeping the order otherwise.
  function spread(ranked, n) {
    const cap = Math.max(2, Math.ceil(n / 3));
    const per = new Map();
    const out = [], later = [];
    for (const x of ranked) {
      const c = per.get(x.co) || 0;
      if (c < cap) { out.push(x); per.set(x.co, c + 1); } else later.push(x);
      if (out.length === n) break;
    }
    return out.length < n ? [...out, ...later].slice(0, n) : out;
  }

  return { like, pairs, pairsForList, forYou, prettyOf };
}
