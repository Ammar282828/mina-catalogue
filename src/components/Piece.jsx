import React, { useEffect, useMemo, useRef, useState } from 'react';
import { imageUrls, piecePath, priceLabel, formatPKR, galleryPath, SITE, SHOW_PRICES } from '../lib/catalog.js';
import { enquiry } from '../lib/contact.js';
import { stoneLabel } from '../lib/stones.js';
import { useFavourites, noteViewed, useRecent } from '../lib/store.js';
import { Link, Breadcrumbs, Photo, PieceGrid, HeartIcon, ShareIcon, WhatsAppIcon, ChevronLeft, ChevronRight, CloseIcon } from './ui.jsx';

const PLATING_LABEL = { Gold: '21k Gold', Rhodium: 'Rhodium', 'Rose Gold': 'Rose Gold' };

/** Full-screen photographs: arrows, swipe, Escape; a tap zooms to where it landed. */
function Viewer({ images, index, onIndex, onClose, title }) {
  const [zoom, setZoom] = useState(null);
  const touch = useRef(null);
  const go = (d) => { setZoom(null); onIndex((index + d + images.length) % images.length); };
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    document.addEventListener('keydown', key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = prev; };
  });
  const img = images[index];
  return (
    <div role="dialog" aria-modal="true" aria-label={`${title}, photograph ${index + 1} of ${images.length}`} className="fixed inset-0 z-[60] bg-bg">
      <div className="absolute inset-0 overflow-hidden"
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - (touch.current ?? 0); if (!zoom && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }}>
        <img
          src={imageUrls(img).full} alt={img.alt || title}
          onClick={(e) => {
            if (zoom) { setZoom(null); return; }
            const r = e.currentTarget.getBoundingClientRect();
            setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
          }}
          className={`h-full w-full object-contain transition-transform duration-300 ${zoom ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
          style={zoom ? { transform: 'scale(2.2)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
        />
      </div>
      <button type="button" onClick={onClose} className="press absolute right-4 top-4 bg-bg/80 p-3 text-ink backdrop-blur" aria-label="Close"><CloseIcon /></button>
      {images.length > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} className="press absolute left-3 top-1/2 -translate-y-1/2 bg-bg/80 p-3 text-ink backdrop-blur" aria-label="Previous photograph"><ChevronLeft /></button>
          <button type="button" onClick={() => go(1)} className="press absolute right-3 top-1/2 -translate-y-1/2 bg-bg/80 p-3 text-ink backdrop-blur" aria-label="Next photograph"><ChevronRight /></button>
          <p className="eyebrow absolute bottom-5 left-1/2 -translate-x-1/2 text-ink-2 tabular-nums">{index + 1} / {images.length}</p>
        </>
      )}
    </div>
  );
}

export default function Piece({ route, cat }) {
  const p = route.piece;
  const co = cat.galleries.get(p.co);
  const fav = useFavourites();
  const recent = useRecent();
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState(false);
  const [plating, setPlating] = useState(p.plating?.length === 1 ? p.plating[0] : '');
  const [size, setSize] = useState('');
  const [option, setOption] = useState('');
  const [shared, setShared] = useState(false);
  const strip = useRef(null);

  useEffect(() => { noteViewed(p.h); }, [p.h]);

  // Choosing a plating shows a photograph of the piece in it, where there is one.
  const choosePlating = (v) => {
    setPlating(v);
    const i = p.img.findIndex((im) => im.plating === v);
    if (i >= 0) setIndex(i);
  };

  const sizeValues = useMemo(() => {
    if (!p.size) return [];
    const m = p.size.range.match(/^([\d.]+) – ([\d.]+)$/);
    if (!m) return p.size.range.split(', ');
    const out = [];
    for (let v = Number(m[1]); v <= Number(m[2]) + 1e-9; v += 0.5) out.push(String(v));
    return out;
  }, [p.size]);

  // The price for what is chosen, when one option decides it.
  const chosenPrice = useMemo(() => {
    if (!SHOW_PRICES || !p.priceBy) return null;
    const isSize = /size/i.test(p.priceBy.name);
    const pick = isSize ? size : option;
    if (!pick) return null;
    for (const row of p.priceBy.values) {
      const m = row.v.match(/^([\d.]+) – ([\d.]+)$/);
      if (m ? Number(pick) >= Number(m[1]) && Number(pick) <= Number(m[2]) : row.v === pick) return row.price;
    }
    return null;
  }, [p.priceBy, size, option]);

  const priceByIsSize = p.priceBy && /size/i.test(p.priceBy.name);
  const extraOption = p.priceBy && !priceByIsSize ? p.priceBy : null;

  const share = async () => {
    const url = `${SITE}${piecePath(p)}`;
    try {
      if (navigator.share) await navigator.share({ title: `${p.t} — House of Mina`, url });
      else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 2000); }
    } catch { /* dismissed */ }
  };

  const related = (co?.pieces || []).filter((x) => x.h !== p.h).slice(0, 8);
  const seen = recent.filter((h) => h !== p.h).map((h) => cat.byHandle.get(h)).filter(Boolean).slice(0, 4);
  const edits = cat.edits.filter((e) => p.edits?.includes(e.slug));
  const saved = fav.has(p.h);
  // A portrait photograph is shown whole, in its own shape (up to 2:3); anything else in a square.
  const shown = p.img[index];
  const tall = shown.w && shown.h && shown.h > shown.w * 1.02;

  const crumbs = [
    { title: 'Home', path: '/' },
    ...(co?.parent ? [{ title: co.parent.title, path: galleryPath(co.parent.slug) }] : []),
    ...(co ? [{ title: co.title, path: galleryPath(co.slug) }] : []),
    { title: p.t, path: piecePath(p) },
  ];

  return (
    <div className="px-5 sm:px-8 md:px-12 pt-24 md:pt-28 pb-24">
      <div className="mx-auto max-w-[1280px]">
        <Breadcrumbs items={crumbs} />

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
          {/* Photographs */}
          <div>
            <button type="button" onClick={() => setViewer(true)} aria-label="Open the photographs full screen"
              style={tall ? { aspectRatio: `${shown.w} / ${Math.min(shown.h, shown.w * 1.5)}` } : undefined}
              className={`relative block w-full overflow-hidden bg-bg-2 cursor-zoom-in ${tall ? '' : 'aspect-square'}`}>
              <Photo key={p.img[index].f || p.img[index].thumb} src={imageUrls(p.img[index]).full} alt={p.img[index].alt || p.t} eager className="h-full w-full object-cover" />
            </button>
            {p.img.length > 1 && (
              <div ref={strip} className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
                {p.img.map((im, i) => (
                  <button key={im.f || i} type="button" onClick={() => setIndex(i)} aria-label={`Photograph ${i + 1}`} aria-current={i === index}
                    className={`press h-16 w-16 md:h-20 md:w-20 shrink-0 overflow-hidden bg-bg-2 ring-1 ${i === index ? 'ring-accent' : 'ring-transparent opacity-70 hover:opacity-100'}`}>
                    <Photo src={imageUrls(im).thumb} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* The piece */}
          <div className="lg:pt-2">
            {co && <Link to={galleryPath(co.slug)} className="eyebrow text-accent hover:underline underline-offset-4">{co.title}</Link>}
            <h1 className="display mt-3 text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[0.98] text-ink">{p.t}</h1>
            {SHOW_PRICES ? (
              <p className="mt-4 text-[20px] tabular-nums text-ink">
                {chosenPrice ? formatPKR(chosenPrice) : priceLabel(p)}
              </p>
            ) : !p.local && !p.drop && (
              <p className="mt-4 text-[15px] text-ink-2">Ask us on WhatsApp for the price.</p>
            )}
            {p.drop && <p className={`${SHOW_PRICES ? 'mt-1 text-[13px]' : 'mt-4 text-[15px]'} text-ink-2`}>Newly photographed at the counter — ask us for the price and details.</p>}
            {p.local && <p className={`${SHOW_PRICES ? 'mt-1 text-[13px]' : 'mt-4 text-[15px]'} text-ink-2`}>New to the house — ask us on WhatsApp for the price, platings and sizes.</p>}

            {/* Choices, carried into the WhatsApp message */}
            <div className="mt-8 space-y-6">
              {p.plating?.length > 1 && (
                <fieldset>
                  <legend className="eyebrow text-ink-2">Plating</legend>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {p.plating.map((v) => (
                      <button key={v} type="button" onClick={() => choosePlating(v)} aria-pressed={plating === v}
                        className={`press inline-flex items-center gap-2 border px-4 py-2.5 text-[13.5px] ${plating === v ? 'border-accent text-accent' : 'border-line text-ink hover:border-ink-2/50'}`}>
                        <span className={`h-3 w-3 rounded-full ${v === 'Gold' ? 'bg-[#C9A24B]' : v === 'Rose Gold' ? 'bg-[#D7A08E]' : 'bg-[#C9CCD1]'}`} aria-hidden="true" />
                        {PLATING_LABEL[v] || v}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {sizeValues.length > 0 && (
                <label className="block">
                  <span className="eyebrow text-ink-2">{p.size.name.replace(/\s*\(US\)/i, '')} <span className="normal-case tracking-normal">(US)</span></span>
                  <select value={size} onChange={(e) => setSize(e.target.value)}
                    className="mt-2.5 block w-full max-w-[240px] border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink focus:border-accent focus:outline-none">
                    <option value="">Choose a size</option>
                    {sizeValues.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
              )}

              {extraOption && (
                <fieldset>
                  <legend className="eyebrow text-ink-2">{extraOption.name}</legend>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {extraOption.values.map((o) => (
                      <button key={o.v} type="button" onClick={() => setOption(o.v)} aria-pressed={option === o.v}
                        className={`press border px-4 py-2.5 text-[13.5px] ${option === o.v ? 'border-accent text-accent' : 'border-line text-ink hover:border-ink-2/50'}`}>
                        {o.v}{SHOW_PRICES && o.price != null && <span className="ml-1.5 text-ink-2 tabular-nums">{formatPKR(o.price)}</span>}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {SHOW_PRICES && priceByIsSize && (
                <p className="text-[13px] text-ink-2">
                  {p.priceBy.values.map((r) => `Sizes ${r.v}: ${formatPKR(r.price)}`).join(' · ')}
                </p>
              )}
              {p.stones?.length > 1 && !extraOption && (
                <p className="text-[13px] text-ink-2">Available with {p.stones.join(' or ')}.</p>
              )}
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href={enquiry(p, { Plating: plating && (PLATING_LABEL[plating] || plating), Size: size && `${size} (US)`, [extraOption?.name || 'Option']: option }, chosenPrice && formatPKR(chosenPrice))}
                target="_blank" rel="noopener"
                className="press inline-flex flex-1 sm:flex-none items-center justify-center gap-2.5 bg-accent px-7 py-4 text-on-accent eyebrow"
              >
                <WhatsAppIcon className="w-4 h-4" /> Enquire on WhatsApp
              </a>
              <button type="button" onClick={() => fav.toggle(p.h)} aria-pressed={saved}
                className={`press inline-flex items-center gap-2 border px-5 py-4 eyebrow ${saved ? 'border-accent text-accent' : 'border-line text-ink hover:border-accent'}`}>
                <HeartIcon filled={saved} className="w-4 h-4" /> {saved ? 'Saved' : 'Save'}
              </button>
              <button type="button" onClick={share} className="press p-4 text-ink-2 hover:text-accent" aria-label="Share this piece">
                <ShareIcon className="w-4 h-4" />
              </button>
              {shared && <span className="text-[12px] text-ink-2">Link copied</span>}
            </div>
            <p className="mt-3 text-[12.5px] text-ink-2">Handcrafted to order. We reply on WhatsApp with timing and delivery.</p>

            {(p.story?.length > 0 || p.facts?.length > 0) && (
              <div className="mt-10 border-t border-line pt-8 space-y-4 text-[15px] leading-relaxed text-ink-2">
                {p.story.map((s, i) => <p key={i}>{s}</p>)}
                {p.facts?.length > 0 && (
                  <ul className="space-y-1.5 pt-1">
                    {p.facts.map((f, i) => {
                      const [k, ...v] = f.split(':');
                      return <li key={i} className="flex gap-2">{v.length ? <><span className="text-ink">{k}:</span><span>{v.join(':').trim()}</span></> : f}</li>;
                    })}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-8 text-[13px]">
              <div><p className="eyebrow text-ink-2">Metal</p><p className="mt-1 text-ink">925 sterling silver</p></div>
              {p.plating?.length > 0 && <div><p className="eyebrow text-ink-2">Plating</p><p className="mt-1 text-ink">{p.plating.map((v) => PLATING_LABEL[v] || v).join(' or ')}{p.nickelFree ? '; nickel-free on request' : ''}</p></div>}
              {p.facets?.stone && <div><p className="eyebrow text-ink-2">Stones</p><p className="mt-1 text-ink">{p.facets.stone.map(stoneLabel).join(', ')}</p></div>}
              <div><p className="eyebrow text-ink-2">Care</p><p className="mt-1 text-ink">One free repolish on every piece</p></div>
            </div>

            {edits.length > 0 && (
              <p className="mt-8 text-[13px] text-ink-2">
                Part of {edits.map((e, i) => (
                  <React.Fragment key={e.slug}>{i > 0 && (i === edits.length - 1 ? ' and ' : ', ')}<Link to={galleryPath(e.slug)} className="text-ink underline decoration-line underline-offset-4 hover:text-accent">{e.title}</Link></React.Fragment>
                ))}.
              </p>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-24">
            <div className="flex items-end justify-between gap-6">
              <h2 className="display text-[clamp(1.8rem,3.6vw,2.6rem)] leading-none">More {co.title}<span className="text-rose not-italic">.</span></h2>
              <Link to={galleryPath(co.slug)} className="eyebrow text-ink-2 hover:text-accent">All {co.pieces.length}</Link>
            </div>
            <div className="mt-8"><PieceGrid pieces={related} isNew={cat.isNew} eagerCount={0} /></div>
          </section>
        )}

        {seen.length > 0 && (
          <section className="mt-20">
            <h2 className="eyebrow text-ink-2">Recently viewed</h2>
            <div className="mt-6"><PieceGrid pieces={seen} isNew={cat.isNew} eagerCount={0} /></div>
          </section>
        )}
      </div>

      {viewer && <Viewer images={p.img} index={index} onIndex={setIndex} onClose={() => setViewer(false)} title={p.t} />}
    </div>
  );
}
