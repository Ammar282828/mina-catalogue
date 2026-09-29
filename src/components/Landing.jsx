import React, { useEffect, useMemo, useRef, useState } from 'react';
import { mountParticles, scrollState } from './particles.js';
import { Link, Wordmark, ArrowRight, WhatsAppIcon, Photo, PieceGrid } from './ui.jsx';
import { imageUrls, piecePath, galleryPath } from '../lib/catalog.js';
import { hello, WHATSAPP_DISPLAY, INSTAGRAM } from '../lib/contact.js';
import { useTheme } from '../lib/store.js';
import { PickedForYou } from './Recs.jsx';

/**
 * The front page: a tall scroll through the house's chapters. A particle
 * sculpture holds the centre of the screen and becomes each chapter's piece as
 * you scroll; the chapter's words and a handful of its newest pieces sit
 * beneath it. After the last chapter, the edits and the newest pieces, laid
 * out plainly for anyone who scrolled past the show.
 */
export default function Landing({ cat }) {
  const [theme] = useTheme();
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const engineRef = useRef(null);
  const [state, setState] = useState({ active: 0, textOpacity: 1 });
  const [webgl, setWebgl] = useState(true);
  const mobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const sections = useMemo(() => [
    { key: 'intro', shape: 'wordmark' },
    { key: 'new', shape: 'sparkle', eyebrow: 'Just arrived', title: 'New Arrivals', desc: 'The latest pieces to join the house.', path: galleryPath('new-arrivals'), pieces: cat.newArrivals.pieces },
    ...cat.chapters.map((c) => ({
      key: c.slug, shape: c.shape, eyebrow: `${c.pieces.length} pieces`,
      title: c.title, desc: c.blurb, path: galleryPath(c.slug), pieces: c.pieces,
    })),
    { key: 'edits', shape: 'gem', eyebrow: 'Edits & drops', title: 'The Edits', desc: cat.edits.slice(0, 4).map((e) => e.title).join(' · '), path: '/collections#edits', pieces: cat.edits.map((e) => e.cover).filter(Boolean) },
    { key: 'hello', shape: 'heart', eyebrow: 'Made to order in Karachi', title: 'Say hello', desc: 'Every piece is made for you. Ask about a size, a plating, or a gift.' },
  ], [cat]);

  const progress = () => {
    const el = containerRef.current;
    if (!el) return 0;
    const top = el.getBoundingClientRect().top + window.scrollY;
    return (window.scrollY - top) / Math.max(1, el.offsetHeight - window.innerHeight);
  };

  // The sculpture.
  useEffect(() => {
    let cancelled = false;
    mountParticles(stageRef.current, { shapes: sections.map((s) => s.shape), getProgress: progress, theme, mobile })
      .then((engine) => {
        if (cancelled) { engine?.destroy(); return; }
        if (!engine) setWebgl(false);
        engineRef.current = engine;
      });
    return () => { cancelled = true; engineRef.current?.destroy(); engineRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.length]);

  useEffect(() => { engineRef.current?.setTheme(theme); }, [theme]);

  // The words follow the scroll; the sculpture rests once it is off screen.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const s = scrollState(progress(), sections.length);
        setState((prev) => (prev.active === s.active && Math.abs(prev.textOpacity - s.textOpacity) < 0.02 ? prev : { active: s.active, textOpacity: s.textOpacity }));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const io = new IntersectionObserver(([e]) => engineRef.current?.setPaused(!e.isIntersecting));
    if (containerRef.current) io.observe(containerRef.current);
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); io.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.length]);

  const jump = (i) => {
    const el = containerRef.current;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const max = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + (i / (sections.length - 1)) * max, behavior: 'smooth' });
  };

  const s = sections[state.active];

  return (
    <>
      <div ref={containerRef} style={{ height: `${sections.length * 100}vh` }} className="relative">
        <div className="sticky top-0 h-[100svh] overflow-hidden">
          <div ref={stageRef} className="absolute inset-0" aria-hidden="true" />

          {/* Without WebGL the wordmark is drawn instead, and nothing else changes. */}
          {!webgl && state.active === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Wordmark className="w-[min(70vw,560px)] text-accent" />
            </div>
          )}

          {/* The chapter rail. */}
          <nav aria-label="Chapters" className="absolute left-5 md:left-8 top-1/2 -translate-y-1/2 hidden sm:flex flex-col gap-3.5">
            {sections.map((x, i) => (
              <button key={x.key} type="button" onClick={() => jump(i)} className="group flex items-center gap-3"
                aria-label={x.title || 'House of Mina'} aria-current={i === state.active ? 'step' : undefined}>
                <span className={`block h-px transition-all duration-500 ${i === state.active ? 'w-8 bg-accent' : 'w-4 bg-ink-2/35 group-hover:w-6 group-hover:bg-ink-2'}`} />
                <span className={`label-lg !text-[11px] transition-opacity duration-300 ${i === state.active ? 'opacity-100 text-accent' : 'opacity-60 group-hover:opacity-100 text-ink-2'}`}>
                  {x.title || 'Mina'}
                </span>
              </button>
            ))}
          </nav>

          <div className="absolute inset-x-0 bottom-0 pb-[max(env(safe-area-inset-bottom),5vh)] px-6 text-center pointer-events-none"
            style={{ opacity: state.textOpacity }}>
            {state.active === 0 ? (
              // What to do, said plainly on the first screen (the owner, 2026-09-24: easy for
              // older visitors): the words first, then the two things to do, in big buttons.
              // No box since 2026-09-29 (the owner: "aesthetically improve the front page pop up"):
              // the page's own ground rises from the foot, the words sit on it below the wordmark
              // (the boxed card covered the foot of the letters), set like the chapters' titles. On a
              // computer the ground fades at its sides too, so the chapter rail stays clear.
              <div className="relative mx-auto max-w-[35rem]">
                <div aria-hidden="true" className="pointer-events-none absolute left-1/2 -translate-x-1/2 w-screen sm:w-[62rem] sm:[mask-image:linear-gradient(to_right,transparent,#000_24%,#000_76%,transparent)] -bottom-[12vh] h-[calc(100%+22vh)] bg-gradient-to-t from-bg from-45% via-bg/85 via-75% to-transparent" />
                <div className="pointer-events-auto relative">
                  <p className="label-lg text-accent flex items-center justify-center gap-3">
                    <span aria-hidden="true" className="h-px w-7 md:w-12 bg-gradient-to-l from-accent/60 to-transparent" />
                    Sterling silver · Karachi
                    <span aria-hidden="true" className="h-px w-7 md:w-12 bg-gradient-to-r from-accent/60 to-transparent" />
                  </p>
                  <h1 className="display mt-3 text-[34px] md:text-[50px] leading-[1.02] text-ink">
                    Welcome to House of Mina<span className="text-rose not-italic">.</span>
                  </h1>
                  <p className="mx-auto mt-3 max-w-[31rem] text-[17px] md:text-[18px] leading-relaxed text-ink/85">
                    Fine jewellery in sterling silver, made in Karachi. Look through the pieces, tap one you like,
                    then message us on WhatsApp for the price or to order.
                  </p>
                  <div className="mx-auto mt-6 grid max-w-[35rem] grid-cols-1 gap-3 sm:grid-cols-2 [&>a]:whitespace-nowrap">
                    <Link to="/collections" className="press btn-big bg-accent text-on-accent shadow-[0_12px_28px_-14px_rgb(var(--accent)/0.9)] hover:opacity-90">
                      See the jewellery <ArrowRight className="w-4 h-4" />
                    </Link>
                    <a href={hello()} target="_blank" rel="noopener" className="press btn-big border border-accent/70 bg-bg/50 text-accent backdrop-blur-sm hover:bg-accent/5">
                      <WhatsAppIcon className="w-5 h-5" /> Ask us on WhatsApp
                    </a>
                  </div>
                  <p className="mt-5 text-[15px] text-ink-2">WhatsApp <span className="select-all whitespace-nowrap text-ink">{WHATSAPP_DISPLAY}</span></p>
                  <button type="button" onClick={() => jump(1)} className="mt-2 inline-flex items-center gap-2 py-1 text-[15px] text-ink-2 hover:text-accent transition-colors">
                    Or scroll down to see more <span aria-hidden="true" className="motion-safe:animate-bounce">↓</span>
                  </button>
                </div>
              </div>
            ) : (
              <div key={s.key} className="pointer-events-auto mx-auto max-w-2xl">
                <p className="label-lg text-accent">{s.eyebrow}</p>
                <h2 className="display mt-3 text-[clamp(2.6rem,7vw,5rem)] leading-[0.95] text-ink">
                  {s.path ? <Link to={s.path} className="hover:text-accent transition-colors">{s.title}</Link> : s.title}
                  <span className="text-rose not-italic">.</span>
                </h2>
                <p className="mt-4 text-[17px] md:text-[18px] leading-relaxed text-ink">{s.desc}</p>

                {s.pieces?.length > 0 && (
                  <div className="mt-6 flex items-center justify-center gap-2 md:gap-3">
                    {s.pieces.slice(0, mobile ? 4 : 6).map((p) => (
                      <Link key={p.h} to={piecePath(p)} className="press block h-12 w-12 md:h-16 md:w-16 overflow-hidden bg-bg-2 ring-1 ring-line hover:ring-accent" aria-label={p.t}>
                        <Photo src={imageUrls(p.img[0]).thumb} alt="" className="h-full w-full object-cover" />
                      </Link>
                    ))}
                  </div>
                )}

                {s.key === 'hello' ? (
                  <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <a href={hello()} target="_blank" rel="noopener" className="press btn-big bg-accent text-on-accent">
                      <WhatsAppIcon className="w-5 h-5" /> WhatsApp {WHATSAPP_DISPLAY}
                    </a>
                    <a href={INSTAGRAM.url} target="_blank" rel="noopener" className="press btn-big border-2 border-line text-ink hover:border-accent hover:text-accent">
                      Instagram {INSTAGRAM.handle}
                    </a>
                  </div>
                ) : s.path && (
                  <Link to={s.path} className="press btn-big mt-6 bg-accent text-on-accent hover:opacity-90">
                    See all {s.title} <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* A returning visitor's own shelf, before the plain listings. */}
      <PickedForYou cat={cat} band eyebrow="Welcome back" title="Picked for you" />

      {/* Laid out plainly, for anyone who scrolled past the show. */}
      <section id="edits" className="px-5 sm:px-8 md:px-12 py-20 md:py-28 border-t border-line">
        <div className="mx-auto max-w-[1280px]">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="eyebrow text-accent">Edits &amp; drops</p>
              <h2 className="display mt-3 text-[clamp(2rem,4.5vw,3.4rem)] leading-[0.95]">The Edits<span className="text-rose not-italic">.</span></h2>
            </div>
            <Link to="/collections" className="eyebrow hidden sm:inline-flex items-center gap-2 text-ink-2 hover:text-accent">All collections <ArrowRight className="w-3.5 h-3.5" /></Link>
          </div>
          <ul className="mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 p-0">
            {cat.edits.map((e) => (
              <li key={e.slug} className="list-none">
                <Link to={galleryPath(e.slug)} className="group block">
                  <div className="aspect-square overflow-hidden bg-bg-2">
                    <Photo src={imageUrls((e.cover || e.pieces[0]).img[0]).thumb} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                  </div>
                  <p className="serif mt-3 text-[17px] text-ink group-hover:text-accent transition-colors">{e.title}</p>
                  <p className="text-[12px] text-ink-2">{e.pieces.length} pieces</p>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-24 flex items-end justify-between gap-6">
            <div>
              <p className="eyebrow text-accent">Just arrived</p>
              <h2 className="display mt-3 text-[clamp(2rem,4.5vw,3.4rem)] leading-[0.95]">New Arrivals<span className="text-rose not-italic">.</span></h2>
            </div>
            <Link to={galleryPath('new-arrivals')} className="eyebrow inline-flex items-center gap-2 text-ink-2 hover:text-accent">See all <ArrowRight className="w-3.5 h-3.5" /></Link>
          </div>
          <div className="mt-10">
            <PieceGrid pieces={cat.newArrivals.pieces.slice(0, 8)} isNew={cat.isNew} eagerCount={0} />
          </div>
        </div>
      </section>
    </>
  );
}
