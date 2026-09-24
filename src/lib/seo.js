/**
 * Titles, descriptions and structured data for every route. The app sets the
 * document title from here as the visitor moves around; scripts/prerender.mjs
 * writes the same values into each page's static HTML for crawlers and link
 * previews. One source, so the two can never disagree.
 */

import { SITE, PAGE_SIZE, SHOW_PRICES, piecePath, galleryPath, imageUrls, priceLabel } from './catalog.js';

export const BRAND = 'House of Mina';
const MATERIAL = '925 sterling silver with 21k gold or rhodium plating, set with simulated stones and American Diamonds';

const clip = (s, n = 158) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…`;
};
const abs = (p) => `${SITE}${p}`;

const DEFAULT_IMAGE = abs('/logo.png');

function collectionOf(piece, cat) { return cat.galleries.get(piece.co); }

/** { title, description, canonical, image, noindex, jsonLd[] } for a resolved route. */
export function metaFor(route, cat, path = '/') {
  switch (route.kind) {
    case 'home':
      return {
        title: `${BRAND} — Sterling Silver Jewelry Catalogue, Karachi`,
        description: `The ${BRAND} catalogue: ${cat.pieces.length} rings, earrings, necklaces and bracelets in ${MATERIAL}, handcrafted to order in Karachi. Enquire on WhatsApp.`,
        canonical: abs('/'),
        image: DEFAULT_IMAGE,
        jsonLd: [{
          '@context': 'https://schema.org', '@type': 'WebSite', name: `${BRAND} Catalogue`, url: abs('/'),
          publisher: { '@id': `${SITE}/#store` },
        }],
      };

    case 'collections':
      return {
        title: `All Collections | ${BRAND}`,
        description: `Every chapter and edit of the ${BRAND} catalogue — ${cat.chapters.map((c) => c.title).join(', ')} — in ${MATERIAL}.`,
        canonical: abs('/collections'),
        image: DEFAULT_IMAGE,
        jsonLd: [],
      };

    case 'favourites':
      return { title: `Saved pieces | ${BRAND}`, description: 'The pieces you have saved.', canonical: abs('/favourites'), image: DEFAULT_IMAGE, noindex: true, jsonLd: [] };

    case 'account':
      return { title: `Your account | ${BRAND}`, description: 'Sign in with Google to keep your saved pieces on every device.', canonical: abs('/account'), image: DEFAULT_IMAGE, noindex: true, jsonLd: [] };

    case 'gallery': {
      const g = route.gallery;
      const pages = Math.max(1, Math.ceil(g.pieces.length / PAGE_SIZE));
      const first = g.pieces[(route.page - 1) * PAGE_SIZE];
      const suffix = route.page > 1 ? ` — Page ${route.page} of ${pages}` : '';
      const noun = g.kind === 'edit' ? g.title : `${g.noun || g.title} in Sterling Silver`;
      const crumbs = [{ name: 'Home', url: abs('/') }];
      if (g.parent) crumbs.push({ name: g.parent.title, url: abs(galleryPath(g.parent.slug)) });
      crumbs.push({ name: g.title, url: abs(galleryPath(g.slug)) });
      const onPage = g.pieces.slice((route.page - 1) * PAGE_SIZE, route.page * PAGE_SIZE);
      return {
        title: `${noun}${suffix} | ${BRAND}`,
        description: clip(`${g.blurb ? `${g.blurb} ` : ''}${g.pieces.length} pieces in ${g.material || MATERIAL}, from ${BRAND}, Karachi. ${SHOW_PRICES ? 'Prices shown; enquire' : 'Prices and orders'} on WhatsApp.`),
        canonical: abs(galleryPath(g.slug, route.page)),
        image: first ? abs(imageUrls(first.img[0]).full) : DEFAULT_IMAGE,
        prev: route.page > 1 ? abs(galleryPath(g.slug, route.page - 1)) : null,
        next: route.page < pages ? abs(galleryPath(g.slug, route.page + 1)) : null,
        jsonLd: [
          {
            '@context': 'https://schema.org', '@type': 'CollectionPage', name: g.title, url: abs(galleryPath(g.slug, route.page)),
            isPartOf: { '@type': 'WebSite', name: `${BRAND} Catalogue`, url: abs('/') },
            mainEntity: {
              '@type': 'ItemList', numberOfItems: g.pieces.length,
              itemListElement: onPage.map((p, i) => ({ '@type': 'ListItem', position: (route.page - 1) * PAGE_SIZE + i + 1, url: abs(piecePath(p)), name: p.t })),
            },
          },
          breadcrumbs(crumbs),
        ],
      };
    }

    case 'piece': {
      const p = route.piece;
      const co = collectionOf(p, cat);
      const lead = p.story?.[0] || `${p.t}, ${MATERIAL}.`;
      const crumbs = [
        { name: 'Home', url: abs('/') },
        ...(co?.parent ? [{ name: co.parent.title, url: abs(galleryPath(co.parent.slug)) }] : []),
        ...(co ? [{ name: co.title, url: abs(galleryPath(co.slug)) }] : []),
        { name: p.t, url: abs(piecePath(p)) },
      ];
      const images = p.img.map((i) => abs(imageUrls(i).full));
      const offers = !p.price ? undefined : p.price[0] === p.price[1]
        ? { '@type': 'Offer', price: p.price[0], priceCurrency: 'PKR', availability: 'https://schema.org/InStock', url: abs(piecePath(p)), seller: { '@id': `${SITE}/#store` } }
        : { '@type': 'AggregateOffer', lowPrice: p.price[0], highPrice: p.price[1], priceCurrency: 'PKR', offerCount: 1, availability: 'https://schema.org/InStock', url: abs(piecePath(p)) };
      return {
        title: `${p.t}${co ? ` — ${co.title}` : ''} | ${BRAND}`,
        description: clip(`${lead} ${p.price ? `${priceLabel(p)}.` : ''}`),
        canonical: abs(piecePath(p)),
        image: images[0] || DEFAULT_IMAGE,
        imageAlt: `${p.t}, ${BRAND}`,
        ogType: 'product',
        jsonLd: [
          {
            '@context': 'https://schema.org', '@type': 'Product', name: p.t, sku: p.h, url: abs(piecePath(p)),
            image: images, description: clip([...(p.story || []), ...(p.facts || [])].join(' '), 600) || lead,
            brand: { '@type': 'Brand', name: BRAND }, category: co?.title || p.type, material: '925 Sterling Silver',
            ...(offers ? { offers } : {}),
          },
          breadcrumbs(crumbs),
        ],
      };
    }

    default:
      return { title: `Not found | ${BRAND}`, description: 'This page is not in the catalogue.', canonical: abs(path), image: DEFAULT_IMAGE, noindex: true, jsonLd: [] };
  }
}

function breadcrumbs(items) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
  };
}
