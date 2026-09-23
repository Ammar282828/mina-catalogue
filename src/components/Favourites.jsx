import React from 'react';
import { useFavourites } from '../lib/store.js';
import { enquireList } from '../lib/contact.js';
import { Headline, PieceGrid, Link, WhatsAppIcon, ArrowRight } from './ui.jsx';

/**
 * The pieces this visitor has saved, and one button that sends the whole list
 * to the house on WhatsApp — the catalogue's answer to a cart.
 */
export default function Favourites({ cat }) {
  const fav = useFavourites();
  const pieces = fav.list.map((h) => cat.byHandle.get(h)).filter(Boolean);
  return (
    <div className="px-5 sm:px-8 md:px-12 pt-28 md:pt-32 pb-24">
      <div className="mx-auto max-w-[1280px]">
        <Headline>Saved</Headline>
        {pieces.length ? (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <p className="text-[15px] text-ink-2">{pieces.length} {pieces.length === 1 ? 'piece' : 'pieces'}, kept on this device.</p>
              <a href={enquireList(pieces)} target="_blank" rel="noopener" className="press inline-flex items-center gap-2.5 bg-accent px-5 py-3 text-on-accent eyebrow">
                <WhatsAppIcon className="w-4 h-4" /> Send the list on WhatsApp
              </a>
              <button type="button" onClick={fav.clear} className="eyebrow text-ink-2 hover:text-accent">Clear</button>
            </div>
            <div className="mt-12"><PieceGrid pieces={pieces} isNew={cat.isNew} /></div>
          </>
        ) : (
          <div className="mt-10 max-w-lg">
            <p className="text-[15px] leading-relaxed text-ink-2">Nothing saved yet. The heart on any piece keeps it here, so you can come back to it — or send the whole list to us on WhatsApp.</p>
            <Link to="/collections" className="press eyebrow mt-8 inline-flex items-center gap-2 bg-accent px-6 py-3.5 text-on-accent">Browse the collections <ArrowRight className="w-3.5 h-3.5" /></Link>
          </div>
        )}
      </div>
    </div>
  );
}
