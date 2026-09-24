/**
 * How a visitor reaches the house. The catalogue has no cart and no checkout:
 * every piece ends in a WhatsApp message that already names it.
 */

import { SITE, piecePath, priceLabel } from './catalog.js';

export const WHATSAPP_NUMBER = '923161930960';
export const WHATSAPP_DISPLAY = '+92 316 1930960';
export const INSTAGRAM = { handle: '@houseofmina__', url: 'https://www.instagram.com/houseofmina__' };
export const TIKTOK = { handle: '@houseofmina', url: 'https://www.tiktok.com/@houseofmina' };

/**
 * A piece's own page on houseofmina.store — only for pieces published there
 * (`shop`, set by the sync from Shopify's public feed; drafts and the house's
 * own images have none). The owner's ask, 2026-09-24.
 */
export const SHOP = 'https://houseofmina.store';
export const shopUrl = (piece) => (piece?.shop ? `${SHOP}/products/${piece.h}` : null);

export const whatsapp = (text) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

/**
 * An enquiry about one piece, with the choices made on its page and the price they come to —
 * and any pieces ticked under "Complete the look" (`also`), in the same message.
 */
export function enquiry(piece, choices = {}, price = null, also = []) {
  const chosen = Object.entries(choices).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  const quoted = price || (piece.price ? priceLabel(piece) : '');
  return whatsapp([
    `Hi House of Mina, I'd like to ask about the ${piece.t}${quoted ? ` (${quoted})` : ''}.`,
    ...chosen,
    `${SITE}${piecePath(piece)}`,
    ...(also.length ? ['', 'And to go with it:', ...also.map((p, i) => `${i + 1}. ${p.t}\n   ${SITE}${piecePath(p)}`)] : []),
  ].join('\n'));
}

/** Everything saved, in one message — the favourites list, handed to the house. */
export function enquireList(pieces) {
  return whatsapp([
    'Hi House of Mina, these are the pieces I have saved:',
    ...pieces.map((p, i) => `${i + 1}. ${p.t}${priceLabel(p) ? ` — ${priceLabel(p)}` : ''}\n   ${SITE}${piecePath(p)}`),
  ].join('\n'));
}

export const hello = () => whatsapp('Hi House of Mina, I have a question about your jewelry.');
