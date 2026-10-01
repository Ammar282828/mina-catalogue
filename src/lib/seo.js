/**
 * Titles, descriptions and structured data for every route. The app sets the
 * document title from here as the visitor moves around; scripts/prerender.mjs
 * writes the same values into each page's static HTML for crawlers and link
 * previews. One source, so the two can never disagree.
 */

import { SITE, PAGE_SIZE, SHOW_PRICES, piecePath, galleryPath, imageUrls, priceLabel } from './catalog.js';
import { shopUrl } from './contact.js';

export const BRAND = 'House of Mina';
const MATERIAL = '925 sterling silver with 21k gold or rhodium plating, set with simulated stones and American Diamonds';

const clip = (s, n = 158) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…`;
};
const abs = (p) => `${SITE}${p}`;

const DEFAULT_IMAGE = abs('/logo.png');
// Google shows about 60 characters of a title; past this a piece's title drops its gallery.
const TITLE_MAX = 65;

// Pieces that share a name (a render named off its photo can match a Shopify piece's name)
// would share a title: the later one's address ends in -2, -3…, and its title says No. 2.
const nameCounts = new WeakMap();
function sameName(piece, cat) {
  let counts = nameCounts.get(cat);
  if (!counts) {
    counts = new Map();
    for (const q of cat.pieces) counts.set(q.t.toLowerCase(), (counts.get(q.t.toLowerCase()) || 0) + 1);
    nameCounts.set(cat, counts);
  }
  return counts.get(piece.t.toLowerCase()) > 1;
}
function pieceTitle(p, co, cat) {
  const n = sameName(p, cat) ? (p.s || p.h || '').match(/-(\d+)$/)?.[1] : null;
  const name = n ? `${p.t} No. ${n}` : p.t;
  const full = `${name}${co ? ` — ${co.title}` : ''} | ${BRAND}`;
  return full.length <= TITLE_MAX ? full : `${name} | ${BRAND}`;
}

function collectionOf(piece, cat) { return cat.galleries.get(piece.co); }

/** { title, description, canonical, elsewhere?, image, noindex, jsonLd[] } for a resolved route (`elsewhere`: the canonical is the shop's page). */
export function metaFor(route, cat, path = '/') {
  switch (route.kind) {
    case 'home':
      return {
        title: `${BRAND} — Sterling Silver Jewelry Catalogue, Karachi`,
        description: `${cat.pieces.length} rings, earrings, necklaces and bracelets in 925 sterling silver with 21k gold or rhodium plating, handcrafted to order in Karachi. Enquire on WhatsApp.`,
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
        description: clip(`Every chapter and edit of the ${BRAND} catalogue — ${cat.chapters.map((c) => c.title).join(', ')} — in 925 sterling silver, handcrafted in Karachi.`),
        canonical: abs('/collections'),
        image: DEFAULT_IMAGE,
        jsonLd: [breadcrumbs([{ name: 'Home', url: abs('/') }, { name: 'All Collections', url: abs('/collections') }])],
      };

    case 'favourites':
      return { title: `Saved pieces | ${BRAND}`, description: 'The pieces you have saved.', canonical: abs('/favourites'), image: DEFAULT_IMAGE, noindex: true, jsonLd: [] };

    case 'account':
      return { title: `Your account | ${BRAND}`, description: 'Sign in with Google to keep your saved pieces on every device.', canonical: abs('/account'), image: DEFAULT_IMAGE, noindex: true, jsonLd: [] };

    case 'gallery': {
      const g = route.gallery;
      const pages = Math.max(1, Math.ceil(g.pieces.length / PAGE_SIZE));
      const first = g.pieces[(route.page - 1) * PAGE_SIZE];
      const noun = g.kind === 'edit' ? g.title : `${g.noun || g.title} in Sterling Silver`;
      let suffix = route.page > 1 ? ` — Page ${route.page} of ${pages}` : '';
      if (`${noun}${suffix} | ${BRAND}`.length > TITLE_MAX) suffix = route.page > 1 ? ` — Page ${route.page}` : '';
      const crumbs = [{ name: 'Home', url: abs('/') }];
      if (g.parent) crumbs.push({ name: g.parent.title, url: abs(galleryPath(g.parent.slug)) });
      crumbs.push({ name: g.title, url: abs(galleryPath(g.slug)) });
      const onPage = g.pieces.slice((route.page - 1) * PAGE_SIZE, route.page * PAGE_SIZE);
      return {
        title: `${noun}${suffix} | ${BRAND}`,
        // Page 1 describes the gallery; a later page names what is on it, so no two pages share one.
        description: route.page > 1
          ? clip(`${g.title}, page ${route.page} of ${pages}: ${onPage.slice(0, 4).map((p) => p.t).join(', ')} and more, in ${g.material || '925 sterling silver'}, from ${BRAND}, Karachi.`)
          : clip(`${g.blurb ? `${g.blurb} ` : `${g.title}: `}${g.pieces.length} pieces in ${g.material || MATERIAL}, from ${BRAND}, Karachi. ${SHOW_PRICES ? 'Prices shown; enquire' : 'Prices and orders'} on WhatsApp.`),
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
      // Name-led, as a search for the piece reads; some pieces share their first line (the
      // natural ruby rings, two pearl bangles), and the name keeps their descriptions apart.
      const named = lead.toLowerCase().includes(p.t.toLowerCase()) ? lead : `${p.t} — ${lead.replace(/^(?:A|An|The) /, (w) => w.toLowerCase())}`;
      const summary = clip(`${named}${named.length < 110 ? ` From ${BRAND}, Karachi.` : ''} ${p.price ? `${priceLabel(p)}.` : ''}`);
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
      // A piece the shop sells has the same name, photographs and words on houseofmina.store, and
      // Google keeps one of two such pages. The shop's is the one to find — it has the price and
      // the checkout — so this page names it as the original and carries no Product of its own
      // (the shop's page has one). Its link to the shop stays; the sitemap leaves it out.
      const shop = shopUrl(p);
      if (shop) {
        return {
          title: pieceTitle(p, co, cat),
          description: summary,
          canonical: shop,
          elsewhere: true,
          image: images[0] || DEFAULT_IMAGE,
          imageAlt: `${p.t}, ${BRAND}`,
          ogType: 'product',
          jsonLd: [breadcrumbs(crumbs)],
        };
      }
      const description = clip([...(p.story || []), ...(p.facts || [])].join(' '), 600) || lead;
      // A Product with no offer, review or rating is an invalid rich result, which Search Console
      // listed on every piece page (2026-10-01) while prices are off: then the page is an ItemPage
      // whose photographs are the subject, as on taheri.shop, and a Product once there is a price.
      const photos = images.map((url, i) => ({
        '@type': 'ImageObject', contentUrl: url, url: abs(piecePath(p)), name: `${p.t}, ${BRAND}`,
        caption: i ? `${p.t}, photograph ${i + 1}` : p.t, representativeOfPage: i === 0, creditText: BRAND,
        creator: { '@type': 'Organization', name: BRAND }, copyrightNotice: BRAND,
      }));
      const subject = offers
        ? {
          '@context': 'https://schema.org', '@type': 'Product', name: p.t, sku: p.h, url: abs(piecePath(p)),
          image: images, description, brand: { '@type': 'Brand', name: BRAND }, category: co?.title || p.type,
          material: '925 Sterling Silver', offers,
        }
        : {
          '@context': 'https://schema.org', '@type': 'ItemPage', name: p.t, url: abs(piecePath(p)), description,
          isPartOf: { '@type': 'WebSite', name: `${BRAND} Catalogue`, url: abs('/') },
          primaryImageOfPage: photos[0], image: photos,
        };
      return {
        title: pieceTitle(p, co, cat),
        description: summary,
        canonical: abs(piecePath(p)),
        image: images[0] || DEFAULT_IMAGE,
        imageAlt: `${p.t}, ${BRAND}`,
        ogType: 'product',
        jsonLd: [subject, breadcrumbs(crumbs)],
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
