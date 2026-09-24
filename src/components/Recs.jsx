import React, { useMemo } from 'react';
import { imageUrls, piecePath, galleryPath } from '../lib/catalog.js';
import { kindOf, KIND_LABEL } from '../lib/recommend.js';
import { useFavourites, useRecent } from '../lib/store.js';
import { Link, Photo, PieceGrid, ArrowRight } from './ui.jsx';

/**
 * The recommendation shelves (src/lib/recommend.js): a titled grid, "Complete the look" with
 * a tick that puts a piece into the same WhatsApp message, and "Picked for you" from what this
 * visitor looked at and saved. Every one hides itself when it has too little to show.
 */

export function Shelf({ eyebrow, title, pieces, cat, more, className = 'mt-24' }) {
  if (!pieces?.length) return null;
  return (
    <section className={className}>
      <div className="flex items-end justify-between gap-6">
        <div>
          {eyebrow && <p className="eyebrow text-accent">{eyebrow}</p>}
          <h2 className="display mt-2 text-[clamp(1.8rem,3.6vw,2.6rem)] leading-none">{title}<span className="text-rose not-italic">.</span></h2>
        </div>
        {more && (
          <Link to={more.to} className="eyebrow inline-flex shrink-0 items-center gap-2 text-ink-2 hover:text-accent">
            {more.label} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
      <div className="mt-8"><PieceGrid pieces={pieces} isNew={cat.isNew} eagerCount={0} /></div>
    </section>
  );
}

/** What this visitor has looked at and saved, newest first, as pieces. */
export function useHistory(cat) {
  const recent = useRecent();
  const fav = useFavourites();
  return useMemo(() => ({
    viewed: recent.map((h) => cat.byHandle.get(h)).filter(Boolean),
    saved: fav.list.map((h) => cat.byHandle.get(h)).filter(Boolean),
  }), [recent, fav.list, cat]);
}

/** Picked for this visitor; nothing on a first visit, or with fewer than four to show. */
export function PickedForYou({ cat, exclude = [], n = 8, title = 'Picked for you', eyebrow = 'From what you looked at and saved', only, className, band = false }) {
  const { viewed, saved } = useHistory(cat);
  const pieces = useMemo(() => cat.rec.forYou({ viewed, saved, exclude, n, only }), [cat, viewed, saved, exclude, n, only]);
  if (pieces.length < 4) return null;
  const shelf = <Shelf eyebrow={eyebrow} title={title} pieces={pieces} cat={cat} className={band ? '' : className} />;
  // On the front page, a band of its own like the sections around it.
  return band ? <section className={`px-5 sm:px-8 md:px-12 py-20 md:py-24 border-t border-line ${className || ''}`}><div className="mx-auto max-w-[1280px]">{shelf}</div></section> : shelf;
}

/**
 * Pieces that go with this one, each with a tick: ticked pieces go into the same WhatsApp
 * message as the piece itself (Piece.jsx passes them to enquiry()).
 */
export function CompleteTheLook({ pieces, chosen, onToggle, title = 'Complete the look', note = 'Tick any you would like to ask about too — they go in the same WhatsApp message.' }) {
  if (!pieces.length) return null;
  return (
    <section aria-label={title} className="mt-10 border-t border-line pt-8">
      <h2 className="label-lg text-ink">{title}</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{note}</p>
      <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 p-0">
        {pieces.map((x) => {
          const on = chosen.includes(x.h);
          return (
            <li key={x.h} className="list-none">
              <Link to={piecePath(x)} className="group block">
                <div className="aspect-square overflow-hidden bg-bg-2">
                  <Photo src={imageUrls(x.img[0]).thumb} alt={x.t} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                </div>
                <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-ink-2">{KIND_LABEL[kindOf(x)] || ''}</p>
                <p className="serif mt-0.5 text-[14.5px] leading-snug text-ink line-clamp-2 group-hover:text-accent">{x.t}</p>
              </Link>
              <button type="button" onClick={() => onToggle(x.h)} aria-pressed={on}
                className={`press mt-2.5 inline-flex w-full items-center justify-center gap-1.5 border px-2 py-2.5 text-[13px] ${on ? 'border-accent bg-accent text-on-accent' : 'border-line text-ink hover:border-accent hover:text-accent'}`}>
                {on ? <>&#10003; Added</> : 'Ask about this too'}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "All 333 Rings & Bands" under a shelf of one gallery. */
export const allOf = (g) => (g ? { to: galleryPath(g.slug), label: `All ${g.pieces.length}` } : null);
