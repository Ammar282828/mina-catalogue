import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FACETS, PRICE_BANDS } from '../lib/taxonomy.js';
import { PAGE_SIZE, galleryPath, trail } from '../lib/catalog.js';
import { Link, Breadcrumbs, Headline, PieceGrid, Pagination, ChevronDown, CloseIcon } from './ui.jsx';

const SORTS = [
  { key: 'new', label: 'Newest' },
  { key: 'low', label: 'Price: low to high' },
  { key: 'high', label: 'Price: high to low' },
];

/** Filters live in the query string, so a filtered gallery can be shared as a link. */
function readFilters() {
  const q = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const out = {};
  for (const f of [...FACETS.map((x) => x.key), 'plating', 'price']) {
    const v = q.get(f);
    if (v) out[f] = v.split(',');
  }
  return { filters: out, sort: q.get('sort') || 'new' };
}

function writeFilters(filters, sort) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v?.length) q.set(k, v.join(','));
  if (sort !== 'new') q.set('sort', sort);
  const s = q.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${s ? `?${s}` : ''}`);
}

const matches = (p, filters) => Object.entries(filters).every(([k, vals]) => {
  if (!vals?.length) return true;
  if (k === 'plating') return vals.some((v) => p.plating?.includes(v));
  if (k === 'price') {
    if (!p.price) return false;
    return vals.some((key) => { const b = PRICE_BANDS.find((x) => x.key === key); return b && p.price[0] <= b.max && p.price[1] >= b.min; });
  }
  return vals.some((v) => p.facets?.[k]?.includes(v));
});

function FilterMenu({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const count = selected.length;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={`press eyebrow inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 ${count ? 'border-accent text-accent' : 'border-line text-ink-2 hover:text-ink hover:border-ink-2/50'}`}>
        {label}{count ? ` · ${count}` : ''} <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 min-w-[210px] border border-line bg-bg p-1.5 shadow-xl shadow-black/5">
          {options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <button key={o.value} type="button" onClick={() => onChange(on ? selected.filter((x) => x !== o.value) : [...selected, o.value])}
                className="flex w-full items-center justify-between gap-6 px-3 py-2 text-left text-[13.5px] hover:bg-bg-2">
                <span className={on ? 'text-accent' : 'text-ink'}>{o.label}</span>
                <span className="text-[11px] tabular-nums text-ink-2">{on ? '✓' : o.count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Gallery({ route, cat }) {
  const { gallery: g, page } = route;
  const [{ filters, sort }, setState] = useState(readFilters);
  const filtering = Object.values(filters).some((v) => v?.length);

  useEffect(() => { writeFilters(filters, sort); }, [filters, sort]);

  // Only the filter values some piece here actually has, with how many.
  const menus = useMemo(() => {
    const menus = [];
    const plating = ['Gold', 'Rhodium', 'Rose Gold']
      .map((v) => ({ value: v, label: v === 'Gold' ? '21k Gold' : v, count: g.pieces.filter((p) => p.plating?.includes(v)).length }))
      .filter((o) => o.count);
    if (plating.length > 1) menus.push({ key: 'plating', label: 'Plating', options: plating });
    for (const f of FACETS) {
      const options = f.values.map((v) => ({ value: v.label, label: v.label, count: g.pieces.filter((p) => p.facets?.[f.key]?.includes(v.label)).length })).filter((o) => o.count);
      if (options.length > 1) menus.push({ key: f.key, label: f.label, options });
    }
    const price = PRICE_BANDS.map((b) => ({ value: b.key, label: b.label, count: g.pieces.filter((p) => matches(p, { price: [b.key] })).length })).filter((o) => o.count);
    if (price.length > 1) menus.push({ key: 'price', label: 'Price', options: price });
    return menus;
  }, [g]);

  const shown = useMemo(() => {
    const list = g.pieces.filter((p) => matches(p, filters));
    if (sort === 'low') return [...list].sort((a, b) => (a.price?.[0] ?? Infinity) - (b.price?.[0] ?? Infinity));
    if (sort === 'high') return [...list].sort((a, b) => (b.price?.[0] ?? -1) - (a.price?.[0] ?? -1));
    return list;
  }, [g, filters, sort]);

  // A filtered view is one long page: paging through a filter is a chore, and
  // the numbered pages exist for crawlers and for the unfiltered collection.
  const pages = Math.max(1, Math.ceil(g.pieces.length / PAGE_SIZE));
  const onPage = filtering || sort !== 'new' ? shown : shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const from = filtering || sort !== 'new' ? 1 : (page - 1) * PAGE_SIZE + 1;

  const set = (key, vals) => setState((s) => ({ ...s, filters: { ...s.filters, [key]: vals } }));
  const siblings = g.kind === 'collection' ? g.parent.collections : g.kind === 'chapter' ? g.collections : null;

  return (
    <div className="px-5 sm:px-8 md:px-12 pt-28 md:pt-32 pb-24">
      <div className="mx-auto max-w-[1280px]">
        <Breadcrumbs items={trail(route)} />

        <header className="mt-8 md:mt-10 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <div className="max-w-2xl">
            <Headline>{g.title}</Headline>
            {g.blurb && <p className="mt-5 text-[15px] leading-relaxed text-ink-2">{g.blurb}</p>}
          </div>
          <p className="eyebrow text-ink-2 tabular-nums">
            {shown.length ? `${String(from).padStart(2, '0')}–${String(from + onPage.length - 1).padStart(2, '0')} of ${shown.length}` : 'None'}
            {filtering && <span className="text-ink-2/60"> · of {g.pieces.length}</span>}
          </p>
        </header>

        {siblings && siblings.length > 1 && (
          <nav aria-label="Collections" className="no-scrollbar mt-10 -mx-5 px-5 flex gap-2 overflow-x-auto">
            {g.kind === 'collection' && (
              <Link to={galleryPath(g.parent.slug)} className="eyebrow shrink-0 rounded-full border border-line px-4 py-2 text-ink-2 hover:text-ink">All {g.parent.title}</Link>
            )}
            {siblings.map((c) => (
              <Link key={c.slug} to={galleryPath(c.slug)} aria-current={c.slug === g.slug ? 'page' : undefined}
                className={`eyebrow shrink-0 rounded-full border px-4 py-2 ${c.slug === g.slug ? 'border-accent bg-accent text-on-accent' : 'border-line text-ink-2 hover:text-ink'}`}>
                {c.title} <span className="opacity-60">{c.pieces.length}</span>
              </Link>
            ))}
          </nav>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-line pt-6">
          {menus.map((m) => (
            <FilterMenu key={m.key} label={m.label} options={m.options} selected={filters[m.key] || []} onChange={(v) => set(m.key, v)} />
          ))}
          {filtering && (
            <button type="button" onClick={() => setState((s) => ({ ...s, filters: {} }))} className="eyebrow inline-flex items-center gap-1 px-2 py-2 text-ink-2 hover:text-accent">
              <CloseIcon className="w-3 h-3" /> Clear
            </button>
          )}
          <label className="ml-auto flex items-center gap-2">
            <span className="sr-only">Sort</span>
            <select value={sort} onChange={(e) => setState((s) => ({ ...s, sort: e.target.value }))}
              className="eyebrow cursor-pointer appearance-none bg-transparent pr-1 text-ink-2 hover:text-ink focus:outline-none">
              {SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-10">
          {onPage.length ? (
            <PieceGrid pieces={onPage} isNew={cat.isNew} />
          ) : (
            <div className="py-24 text-center">
              <p className="serif text-2xl italic text-ink">Nothing matches all of that.</p>
              <button type="button" onClick={() => setState((s) => ({ ...s, filters: {} }))} className="eyebrow mt-6 text-accent">Clear the filters</button>
            </div>
          )}
        </div>

        {!filtering && sort === 'new' && <Pagination slug={g.slug} page={page} pages={pages} />}
      </div>
    </div>
  );
}
