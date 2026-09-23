import React, { useEffect, useMemo, useRef, useState } from 'react';
import { galleryPath, imageUrls, piecePath, priceLabel, SHOW_PRICES } from '../lib/catalog.js';
import { hello, WHATSAPP_DISPLAY, INSTAGRAM, TIKTOK } from '../lib/contact.js';
import { useFavourites, useTheme } from '../lib/store.js';
import { Link, Wordmark, HeartIcon, SearchIcon, SunIcon, MoonIcon, CloseIcon, Photo, useNav, WhatsAppIcon, ArrowRight } from './ui.jsx';

// ── Ribbon ──────────────────────────────────────────────────────────────────
/** The house's promises, one at a time, above the front page. */
export function Ribbon({ cat }) {
  const latest = cat.edits[0];
  const messages = useMemo(() => [
    { text: '925 silver · 21k gold & rhodium plating' },
    { text: 'Handcrafted to order in Karachi' },
    latest && { text: `${latest.title} — ${latest.pieces.length} pieces`, to: galleryPath(latest.slug) },
    { text: 'One free repolish on every piece' },
    { text: '7-day returns & buy-back' },
  ].filter(Boolean), [latest]);
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % messages.length), 4500);
    return () => clearInterval(t);
  }, [messages.length]);
  const m = messages[i];
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-8 bg-accent text-on-accent">
      <div key={i} className="ribbon-in flex h-full items-center justify-center px-4 eyebrow whitespace-nowrap text-[8.5px] tracking-[0.2em] sm:text-[9.5px] sm:tracking-[0.28em]">
        {m.to ? <Link to={m.to} className="inline-flex items-center gap-2 hover:opacity-80">{m.text} <ArrowRight className="w-3 h-3" /></Link> : m.text}
      </div>
    </div>
  );
}

// ── Search ──────────────────────────────────────────────────────────────────
function Search({ cat, onClose }) {
  const [q, setQ] = useState('');
  const input = useRef(null);
  useEffect(() => {
    input.current?.focus();
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = prev; };
  }, [onClose]);

  // Every word must appear somewhere in the piece: its name, collection, stones, story.
  const hits = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    if (!words.length) return [];
    return cat.pieces.filter((p) => {
      const home = cat.galleries.get(p.co);
      const hay = [p.t, p.type, home?.title, home?.parent?.title, ...(p.plating || []), ...Object.values(p.facets || {}).flat(), ...(p.story || [])].join(' ').toLowerCase();
      return words.every((w) => hay.includes(w));
    }).slice(0, 30);
  }, [q, cat]);

  const galleries = useMemo(() => {
    const w = q.trim().toLowerCase();
    if (w.length < 2) return [];
    return [...cat.galleries.values()].filter((g) => g.title.toLowerCase().includes(w)).slice(0, 6);
  }, [q, cat]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Search the catalogue" className="fixed inset-0 z-[70] overflow-y-auto bg-bg/95 backdrop-blur-md">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-8 pt-8 pb-24">
        <div className="flex items-center gap-4 border-b border-ink/20 pb-3">
          <SearchIcon className="w-5 h-5 text-ink-2" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rings, moissanite, pearl…"
            className="serif min-w-0 flex-1 bg-transparent text-[clamp(1.4rem,3.5vw,2.2rem)] font-light italic text-ink placeholder:text-ink-2/50 focus:outline-none" aria-label="Search" />
          <button type="button" onClick={onClose} className="press p-2 text-ink-2 hover:text-accent" aria-label="Close search"><CloseIcon className="w-5 h-5" /></button>
        </div>
        {galleries.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {galleries.map((g) => (
              <Link key={g.slug} to={galleryPath(g.slug)} onClick={onClose} className="eyebrow rounded-full border border-line px-4 py-2 text-ink hover:border-accent hover:text-accent">
                {g.title} <span className="text-ink-2">{g.pieces.length}</span>
              </Link>
            ))}
          </div>
        )}
        {q.trim().length > 1 && (
          <p className="eyebrow mt-8 text-ink-2">{hits.length ? `${hits.length}${hits.length === 30 ? '+' : ''} pieces` : 'No pieces match'}</p>
        )}
        <ul className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-8 p-0">
          {hits.map((p) => (
            <li key={p.h} className="list-none">
              <Link to={piecePath(p)} onClick={onClose} className="group block">
                <div className="aspect-square overflow-hidden bg-bg-2"><Photo src={imageUrls(p.img[0]).thumb} alt="" className="h-full w-full object-cover" /></div>
                <p className="serif mt-2 text-[14.5px] text-ink group-hover:text-accent truncate">{p.t}</p>
                {priceLabel(p) && <p className="text-[12px] text-ink-2">{priceLabel(p)}</p>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────
export function Header({ cat, home }) {
  const { path } = useNav();
  const fav = useFavourites();
  const [theme, toggleTheme] = useTheme();
  const [searching, setSearching] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    const slash = (e) => {
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) { e.preventDefault(); setSearching(true); }
    };
    document.addEventListener('keydown', slash);
    return () => { window.removeEventListener('scroll', on); document.removeEventListener('keydown', slash); };
  }, []);

  const solid = !home || scrolled;
  const mens = cat.chapters.find((c) => c.collections);
  const inMens = !!mens && [mens, ...mens.collections].some((g) => path === galleryPath(g.slug) || path.startsWith(`${galleryPath(g.slug)}/`));
  return (
    <>
      <header className={`fixed inset-x-0 z-40 transition-colors duration-300 ${home ? 'top-8' : 'top-0'} ${solid ? 'bg-bg/90 backdrop-blur-md border-b border-line' : 'bg-transparent border-b border-transparent'}`}>
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8 md:px-12">
          <Link to="/" aria-label="House of Mina — home" className="text-accent">
            <Wordmark className="h-[13px] w-auto md:h-[15px]" />
          </Link>
          <nav className="flex items-center gap-0.5 sm:gap-2" aria-label="Site">
            <Link to="/collections" aria-current={path === '/collections' ? 'page' : undefined}
              className={`eyebrow px-2 sm:px-2.5 py-2 transition-colors ${path === '/collections' ? 'text-accent' : 'text-ink hover:text-accent'}`}>
              Collections
            </Link>
            {/* Men's is a section of its own, one tap from anywhere. */}
            {mens && (
              <Link to={galleryPath(mens.slug)} aria-current={inMens ? 'page' : undefined}
                className={`eyebrow px-1.5 sm:px-2.5 py-2 transition-colors ${inMens ? 'text-accent' : 'text-ink hover:text-accent'}`}>
                {mens.title}
              </Link>
            )}
            <span className="mx-1 hidden h-4 w-px bg-line sm:block" aria-hidden="true" />
            <button type="button" onClick={() => setSearching(true)} className="press p-1.5 sm:p-2 text-ink hover:text-accent" aria-label="Search (press /)"><SearchIcon /></button>
            <Link to="/favourites" className="press relative p-1.5 sm:p-2 text-ink hover:text-accent" aria-label={`Saved pieces${fav.list.length ? `, ${fav.list.length}` : ''}`}>
              <HeartIcon filled={fav.list.length > 0} />
              {fav.list.length > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[16px] rounded-full bg-accent px-1 text-center text-[9.5px] leading-4 text-on-accent tabular-nums">{fav.list.length}</span>}
            </Link>
            <button type="button" onClick={toggleTheme} className="press p-1.5 sm:p-2 text-ink hover:text-accent" aria-label={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </nav>
        </div>
      </header>
      {searching && <Search cat={cat} onClose={() => setSearching(false)} />}
    </>
  );
}

// ── Footer ──────────────────────────────────────────────────────────────────
export function Footer({ cat }) {
  return (
    <footer className="border-t border-line bg-bg-2/60 px-5 sm:px-8 md:px-12 pt-16 pb-10">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid gap-12 md:grid-cols-[1.3fr_1fr_1fr_1.1fr]">
          <div>
            <Wordmark className="h-[18px] w-auto text-accent" />
            <p className="mt-6 max-w-[34ch] text-[14px] leading-relaxed text-ink-2">
              Fine jewelry in 925 sterling silver, plated in 21k gold or rhodium, set with simulated stones and American Diamonds, and handcrafted to order in Karachi.
            </p>
          </div>
          <div>
            <p className="eyebrow text-ink-2">Chapters</p>
            <ul className="mt-4 space-y-2.5 p-0">
              {cat.chapters.map((c) => <li key={c.slug} className="list-none"><Link to={galleryPath(c.slug)} className="text-[14px] text-ink hover:text-accent">{c.title}</Link></li>)}
              <li className="list-none"><Link to={galleryPath('new-arrivals')} className="text-[14px] text-ink hover:text-accent">New Arrivals</Link></li>
            </ul>
          </div>
          <div>
            <p className="eyebrow text-ink-2">Edits</p>
            <ul className="mt-4 space-y-2.5 p-0">
              {cat.edits.slice(0, 7).map((e) => <li key={e.slug} className="list-none"><Link to={galleryPath(e.slug)} className="text-[14px] text-ink hover:text-accent">{e.title}</Link></li>)}
            </ul>
          </div>
          <div>
            <p className="eyebrow text-ink-2">Ask us anything</p>
            <a href={hello()} target="_blank" rel="noopener" className="press mt-4 inline-flex items-center gap-2.5 bg-accent px-5 py-3 text-on-accent eyebrow">
              <WhatsAppIcon className="w-4 h-4" /> {WHATSAPP_DISPLAY}
            </a>
            <ul className="mt-5 space-y-2.5 p-0 text-[14px]">
              <li className="list-none"><a href={INSTAGRAM.url} target="_blank" rel="noopener" className="text-ink hover:text-accent">Instagram <span className="text-ink-2">{INSTAGRAM.handle}</span></a></li>
              <li className="list-none"><a href={TIKTOK.url} target="_blank" rel="noopener" className="text-ink hover:text-accent">TikTok <span className="text-ink-2">{TIKTOK.handle}</span></a></li>
            </ul>
          </div>
        </div>
        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-[12px] text-ink-2">
          <p>© {new Date().getFullYear()} House of Mina · Karachi</p>
          <p>{SHOW_PRICES ? 'Prices in Pakistani rupees' : 'Prices on WhatsApp'} · {cat.pieces.length} pieces</p>
        </div>
      </div>
    </footer>
  );
}

// ── Pages without a gallery of their own ────────────────────────────────────
export function CollectionsPage({ cat }) {
  const cover = (g) => imageUrls((g.cover || g.pieces[0]).img[0]).thumb;
  useEffect(() => {
    if (window.location.hash === '#edits') document.getElementById('edits')?.scrollIntoView();
  }, []);
  return (
    <div className="px-5 sm:px-8 md:px-12 pt-28 md:pt-32 pb-24">
      <div className="mx-auto max-w-[1280px]">
        <h1 className="display text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.95]">Collections<span className="text-rose not-italic">.</span></h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-2">
          {cat.pieces.length} pieces in {cat.chapters.length} categories, and the edits that run across them.
        </p>

        <ul className="mt-14 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 md:gap-6 p-0">
          {cat.chapters.map((ch) => (
            <li key={ch.slug} className="list-none">
              <Link to={galleryPath(ch.slug)} className="group block">
                <div className="aspect-square overflow-hidden bg-bg-2">
                  <Photo src={cover(ch)} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                </div>
                <p className="serif mt-3 text-[19px] text-ink group-hover:text-accent transition-colors">{ch.title}</p>
                <p className="text-[12px] text-ink-2">{ch.pieces.length} {ch.pieces.length === 1 ? 'piece' : 'pieces'}</p>
              </Link>
              {ch.collections && (
                <ul className="mt-2 space-y-1 p-0">
                  {ch.collections.map((k) => (
                    <li key={k.slug} className="list-none">
                      <Link to={galleryPath(k.slug)} className="text-[13px] text-ink-2 hover:text-accent">{k.title} <span className="opacity-60">{k.pieces.length}</span></Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>

        <section id="edits" className="mt-20 border-t border-line pt-10 scroll-mt-24">
          <p className="eyebrow text-accent">Edits &amp; drops</p>
          <h2 className="display mt-2 text-[clamp(1.9rem,4vw,3rem)] leading-none">The Edits</h2>
          <ul className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 p-0">
            {[cat.newArrivals, ...cat.edits].map((e) => (
              <li key={e.slug} className="list-none">
                <Link to={galleryPath(e.slug)} className="group block">
                  <div className="aspect-square overflow-hidden bg-bg-2">
                    <Photo src={cover(e)} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                  </div>
                  <p className="serif mt-3 text-[17px] text-ink group-hover:text-accent transition-colors">{e.title}</p>
                  <p className="text-[12px] text-ink-2">{e.pieces.length} pieces</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 pt-24 text-center">
      <p className="eyebrow text-accent">Not in the catalogue</p>
      <h1 className="display mt-4 text-[clamp(2.2rem,5vw,3.6rem)]">This page has moved on<span className="text-rose not-italic">.</span></h1>
      <p className="mt-4 max-w-md text-[15px] text-ink-2">The piece may have been retired, or the link mistyped. Everything current is in the collections.</p>
      <Link to="/collections" className="press eyebrow mt-8 inline-flex items-center gap-2 bg-accent px-6 py-3.5 text-on-accent">See the collections <ArrowRight className="w-3.5 h-3.5" /></Link>
    </div>
  );
}
