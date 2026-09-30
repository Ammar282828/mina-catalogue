// A piece keeps its handle when Shopify renames the product.
//
// Here the handle is a piece's identity: saved favourites and the POS travel as
// `mina/piece/<handle>`, the counter's changes (catalog-overrides.json) are keyed by
// it, and so are the photograph files (`<handle>/1-abc123`). Shopify changes a
// product's handle when it is renamed (and 301s the old address); on 2026-09-30,
// 50 of the shop's 209 products had been (`adele-er-single-round1ct-halo-pave` →
// `adele`). So the sync matches each product to the piece it already was — by
// Shopify's product id once a sync has recorded it (data/shopify-ids.json), else by
// its photographs — and keeps the old handle, with the shop's current one beside it
// (`sh`) for the link to houseofmina.store.

/**
 * @param {{ id: number, handle: string, photos: string[] }[]} products  what Shopify has now
 * @param {{ h: string, photos: string[] }[]} prev                     what the catalogue had
 * @param {Record<string, number>} ids                                  handle → product id, from earlier syncs
 * @returns {Map<string, string>} the shop's handle → the piece's own, only where they differ
 */
export function keptHandles(products, prev, ids = {}) {
  const current = new Set(products.map((p) => p.handle));
  const before = new Set(prev.map((p) => p.h));
  const byId = new Map(Object.entries(ids).map(([h, id]) => [String(id), h]));
  const byPhoto = new Map();
  for (const piece of prev) {
    for (const ph of piece.photos) {
      if (!byPhoto.has(ph)) byPhoto.set(ph, new Set());
      byPhoto.get(ph).add(piece.h);
    }
  }
  const out = new Map();
  const claimed = new Set();
  for (const p of products) {
    if (before.has(p.handle)) continue;
    // Drafts carry made-up negative ids (scripts/drafts-from-admin.mjs); only real ones count.
    let old = p.id > 0 ? byId.get(String(p.id)) : undefined;
    if (!old) {
      const hits = new Set(p.photos.flatMap((ph) => [...(byPhoto.get(ph) || [])]));
      if (hits.size === 1) old = [...hits][0];
    }
    // Another product has that handle now, or a copy already took it: a new piece after all.
    if (!old || old === p.handle || current.has(old) || claimed.has(old)) continue;
    claimed.add(old);
    out.set(p.handle, old);
  }
  return out;
}

/** The photo hash at the end of a file key: `adele/1-3fa9c2` → `3fa9c2`. */
export const photoHash = (f) => String(f).split('-').pop();
