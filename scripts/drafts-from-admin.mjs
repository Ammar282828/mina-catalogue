// Shopify's DRAFT products, for the catalogue. The public feed sync-shopify.mjs
// reads (products.json) lists only published products, so drafts come from the
// Admin API instead — fetched with the owner's Shopify connection, not from CI —
// and are kept in data/shopify-drafts.json in the public feed's shape, so the
// sync treats a draft exactly as it treats a published product.
//
//   node scripts/drafts-from-admin.mjs <admin-graphql.json>…
//
// Each input is an Admin GraphQL result (or a JSON array of its product nodes)
// with: handle title productType tags createdAt descriptionHtml options{name values}
// variants{nodes{price selectedOptions{name value}}} media{nodes{...on MediaImage{image{url width height altText}}}}
// collections{nodes{handle}}. Variant lists split across files (a head and a
// reversed tail) are merged by their options.

import fs from 'node:fs';

const nodes = process.argv.slice(2).flatMap((f) => {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  return Array.isArray(j) ? j : j.data?.products?.nodes || [];
});

const byHandle = new Map();
for (const n of nodes) {
  const prev = byHandle.get(n.handle);
  if (!prev) { byHandle.set(n.handle, { ...n, variants: { nodes: [...(n.variants?.nodes || [])] } }); continue; }
  // A second slice of the same product: keep what the first lacked.
  for (const k of Object.keys(n)) if (prev[k] == null && k !== 'variants') prev[k] = n[k];
  const seen = new Set(prev.variants.nodes.map((v) => JSON.stringify(v.selectedOptions)));
  for (const v of n.variants?.nodes || []) if (!seen.has(JSON.stringify(v.selectedOptions))) prev.variants.nodes.push(v);
}

const products = [...byHandle.values()].filter((p) => p.title).map((p, pi) => ({
  id: -(pi + 1),
  handle: p.handle,
  title: p.title,
  product_type: p.productType || '',
  tags: p.tags || [],
  body_html: p.descriptionHtml || '',
  created_at: p.createdAt,
  published_at: null,
  status: 'draft',
  options: (p.options || []).map((o, i) => ({ name: o.name, position: i + 1, values: o.values })),
  variants: p.variants.nodes.map((v, i) => {
    const out = { id: i + 1, price: v.price };
    (p.options || []).forEach((o, k) => { out[`option${k + 1}`] = v.selectedOptions.find((s) => s.name === o.name)?.value ?? null; });
    return out;
  }),
  images: (p.media?.nodes || []).filter((m) => m.image).map((m, i) => ({
    src: m.image.url, width: m.image.width, height: m.image.height, alt: m.image.altText || null, position: i + 1, variant_ids: [],
  })),
  collections: (p.collections?.nodes || []).map((c) => c.handle),
}));

products.sort((a, b) => a.handle.localeCompare(b.handle));
fs.writeFileSync('data/shopify-drafts.json', JSON.stringify({ fetchedAt: new Date().toISOString(), count: products.length, products }, null, 0).replace(/\},\{"id"/g, '},\n{"id"') + '\n');
console.log(`${products.length} drafts → data/shopify-drafts.json (variants: ${products.map((p) => p.variants.length).reduce((a, b) => a + b, 0)})`);
