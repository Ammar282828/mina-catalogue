import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { resolvePath } from './lib/catalog.js';
import { metaFor } from './lib/seo.js';
import { NavContext } from './components/ui.jsx';
import { Header, Footer, Ribbon, CollectionsPage, NotFound } from './components/Chrome.jsx';
import Gallery from './components/Gallery.jsx';
import Piece from './components/Piece.jsx';
import Favourites from './components/Favourites.jsx';
import Account from './components/Account.jsx';
import { useAccountSync } from './lib/account.js';
import { trackPageView } from './lib/analytics.js';

// The landing carries Three.js; nobody arriving on a piece page should wait for it.
const Landing = lazy(() => import('./components/Landing.jsx'));

export default function App({ cat }) {
  const [path, setPath] = useState(() => window.location.pathname);

  const navigate = useCallback((to) => {
    const url = new URL(to, window.location.origin);
    if (url.pathname + url.search === window.location.pathname + window.location.search && !url.hash) return;
    window.history.pushState({}, '', url.pathname + url.search + url.hash);
    setPath(url.pathname);
    if (!url.hash) window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const route = useMemo(() => resolvePath(path, cat), [path, cat]);
  // Signed in, saved pieces follow the account (src/lib/account.js).
  useAccountSync();

  // The title and description follow the visitor; the prerender wrote the same
  // values into the page for crawlers, from the same function.
  useEffect(() => {
    const m = metaFor(route, cat, path);
    document.title = m.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', m.description);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', m.canonical);
  }, [route, cat, path]);

  // One page view per address (GA4 and the pixel, lib/analytics.js).
  useEffect(() => { trackPageView(path, document.title); }, [path]);

  const home = route.kind === 'home';
  let page;
  switch (route.kind) {
    case 'home': page = <Suspense fallback={<div className="h-screen" />}><Landing cat={cat} /></Suspense>; break;
    case 'collections': page = <CollectionsPage cat={cat} />; break;
    case 'favourites': page = <Favourites cat={cat} />; break;
    case 'account': page = <Account cat={cat} />; break;
    case 'gallery': page = <Gallery key={route.gallery.slug} route={route} cat={cat} />; break;
    case 'piece': page = <Piece key={route.piece.h} route={route} cat={cat} />; break;
    default: page = <NotFound />;
  }

  return (
    <NavContext.Provider value={{ navigate, path }}>
      {home && <Ribbon cat={cat} />}
      <Header cat={cat} home={home} />
      <main id="main">{page}</main>
      <Footer cat={cat} />
    </NavContext.Provider>
  );
}
