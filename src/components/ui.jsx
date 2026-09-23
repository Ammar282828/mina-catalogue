import React, { createContext, useContext, useState } from 'react';
import { imageUrls, piecePath, priceLabel, galleryPath } from '../lib/catalog.js';
import { useFavourites } from '../lib/store.js';

// ── Navigation ──────────────────────────────────────────────────────────────
export const NavContext = createContext({ navigate: () => {}, path: '/' });
export const useNav = () => useContext(NavContext);

/** An <a> that moves within the app without a page load; modified clicks still open tabs. */
export function Link({ to, children, className = '', onClick, ...rest }) {
  const { navigate } = useNav();
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

// ── The wordmark ────────────────────────────────────────────────────────────
/**
 * MINA, redrawn from the logo's own strokes (public/logo.png is four thin-line
 * letters), so it takes the ink colour in either theme and stays sharp at any size.
 */
export function Wordmark({ className = '', title = 'House of Mina' }) {
  return (
    <svg viewBox="-12 -12 2024 428" className={className} role="img" aria-label={title} fill="none" stroke="currentColor" strokeWidth="21" strokeLinejoin="miter" strokeMiterlimit="12">
      <polyline points="10,404 10,12 213,392 418,12 418,404" />
      <line x1="740" y1="0" x2="740" y2="404" />
      <polyline points="1062,404 1062,14 1376,392 1376,0" />
      <polyline points="1700,404 1845,12 1990,404" />
      <line x1="1738" y1="328" x2="1952" y2="328" />
    </svg>
  );
}

// ── Icons (1.5px strokes, to sit with the thin wordmark) ────────────────────
const Icon = ({ children, className = 'w-[18px] h-[18px]', ...rest }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...rest}>{children}</svg>
);
export const HeartIcon = ({ filled, className }) => (
  <Icon className={className} fill={filled ? 'currentColor' : 'none'}><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.7 3.7 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.3 0 5.4 3.2 4.2 6.6C19.5 15.9 12 20.5 12 20.5z" /></Icon>
);
export const SearchIcon = (p) => <Icon {...p}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></Icon>;
export const CloseIcon = (p) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>;
export const ArrowRight = (p) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const ChevronLeft = (p) => <Icon {...p}><path d="M15 5l-7 7 7 7" /></Icon>;
export const ChevronRight = (p) => <Icon {...p}><path d="M9 5l7 7-7 7" /></Icon>;
export const ChevronDown = (p) => <Icon {...p}><path d="M6 9l6 6 6-6" /></Icon>;
export const ShareIcon = (p) => <Icon {...p}><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" /></Icon>;
export const SunIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>;
export const MoonIcon = (p) => <Icon {...p}><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" /></Icon>;
export const WhatsAppIcon = ({ className = 'w-[18px] h-[18px]' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 004.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.82 14.07c-.24.68-1.42 1.3-1.95 1.38-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.94-4.36-.14-.2-1.18-1.57-1.18-3s.75-2.13 1.02-2.42c.26-.29.57-.36.77-.36h.55c.18 0 .41-.07.64.49.24.57.81 1.99.88 2.13.07.15.12.32.02.51-.1.2-.14.32-.29.49-.14.17-.3.38-.43.51-.14.14-.29.3-.13.58.17.29.74 1.22 1.59 1.97 1.09.97 2.01 1.27 2.3 1.42.28.14.45.12.62-.07.17-.2.71-.83.9-1.12.19-.28.38-.24.64-.14.26.09 1.66.78 1.95.92.28.15.47.22.54.34.07.12.07.69-.17 1.37z" />
  </svg>
);

// ── Photographs ─────────────────────────────────────────────────────────────
/** An image that fades in when it has arrived, over the ivory ground. */
export function Photo({ src, alt, className = '', eager = false, sizes, ...rest }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      sizes={sizes}
      onLoad={() => setLoaded(true)}
      className={`img-in ${loaded ? 'loaded' : ''} ${className}`}
      {...rest}
    />
  );
}

// ── A piece in a grid ───────────────────────────────────────────────────────
export function PieceTile({ piece, isNew = false, eager = false }) {
  const fav = useFavourites();
  const saved = fav.has(piece.h);
  const [a, b] = piece.img;
  return (
    <li className="group relative list-none">
      <Link to={piecePath(piece)} className="block" aria-label={`${piece.t}, ${priceLabel(piece)}`}>
        <div className="relative aspect-square overflow-hidden bg-bg-2">
          <Photo src={imageUrls(a).thumb} alt={a.alt || piece.t} eager={eager} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
          {/* The second photograph on hover — usually the piece worn, or the other plating. */}
          {b && (
            <img src={imageUrls(b).thumb} alt="" aria-hidden="true" loading="lazy" decoding="async"
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 hidden md:block" />
          )}
          {isNew && <span className="eyebrow absolute left-2.5 top-2.5 bg-bg/85 px-2 py-1 text-[9px] text-accent backdrop-blur-sm">New</span>}
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3 pr-8">
          <h3 className="serif text-[15px] md:text-[16px] leading-snug text-ink truncate">{piece.t}</h3>
        </div>
        <p className="mt-0.5 text-[12.5px] tabular-nums text-ink-2">{priceLabel(piece)}</p>
      </Link>
      <button
        type="button"
        onClick={() => fav.toggle(piece.h)}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${piece.t} from saved` : `Save ${piece.t}`}
        className={`press absolute right-0 bottom-[22px] p-1.5 ${saved ? 'text-accent' : 'text-ink-2 hover:text-accent'}`}
      >
        <HeartIcon filled={saved} className="w-[17px] h-[17px]" />
      </button>
    </li>
  );
}

export function PieceGrid({ pieces, isNew = () => false, eagerCount = 4 }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 md:gap-x-6 md:gap-y-12 p-0 m-0">
      {pieces.map((p, i) => <PieceTile key={p.h} piece={p} isNew={isNew(p)} eager={i < eagerCount} />)}
    </ul>
  );
}

// ── Page furniture ──────────────────────────────────────────────────────────
export function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="eyebrow flex flex-wrap items-center gap-2 text-ink-2/80">
      {items.map((c, i) => (
        <React.Fragment key={c.path + i}>
          {i > 0 && <span aria-hidden="true" className="text-ink-2/40">/</span>}
          {i === items.length - 1
            ? <span className="text-ink" aria-current="page">{c.title}</span>
            : <Link to={c.path} className="hover:text-accent transition-colors">{c.title}</Link>}
        </React.Fragment>
      ))}
    </nav>
  );
}

/** "Rings." — the house's italic headline with its full stop in the accent. */
export function Headline({ children, as: Tag = 'h1', className = '' }) {
  return (
    <Tag className={`display text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.95] text-ink ${className}`}>
      {children}<span className="text-rose not-italic">.</span>
    </Tag>
  );
}

export function Pagination({ slug, page, pages }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1);
  return (
    <nav aria-label="Pages" className="mt-16 flex items-center justify-center gap-1.5">
      {page > 1 && <Link to={galleryPath(slug, page - 1)} rel="prev" className="press p-2 text-ink-2 hover:text-accent" aria-label="Previous page"><ChevronLeft /></Link>}
      {nums.map((n) => (
        <Link key={n} to={galleryPath(slug, n)} aria-current={n === page ? 'page' : undefined}
          className={`press min-w-9 h-9 px-2 inline-flex items-center justify-center text-[13px] tabular-nums border ${n === page ? 'border-accent text-accent' : 'border-transparent text-ink-2 hover:text-ink'}`}>
          {n}
        </Link>
      ))}
      {page < pages && <Link to={galleryPath(slug, page + 1)} rel="next" className="press p-2 text-ink-2 hover:text-accent" aria-label="Next page"><ChevronRight /></Link>}
    </nav>
  );
}
