import React, { useLayoutEffect, useRef, useState } from 'react';

/**
 * The MINA mark on a square tile (the owner, 2026-09-27: "keep them their og size, however
 * add the overlay on the 1x1 thumbnail so its uniform in collections and on viewing before
 * opening full pic" — on both houses' sites).
 *
 * The build burns the mark into every photograph (scripts/brand.mjs), top right of the whole
 * frame. A square photograph shows whole in its tile, mark and all. Any other shape is cropped
 * to the square, which cuts the mark off, so the tile draws it again in the tile's own corner —
 * brand.mjs's geometry and colours: 19% across, 4.8% in, 3.7% down, maroon on a light corner and
 * white on a dark one, read off the pixels under it. A photograph uploaded from the POS
 * (catalog-drop, no `f`) is not branded at all, so its tile gets the mark whatever its shape.
 * Only the tile: the zoom viewer shows the photograph as it is.
 */
const WIDTH = 0.19, RIGHT = 0.048, TOP = 0.037;
const MAROON = '#3A0000', WHITE = '#FFFFFF';
// The wordmark as the site draws it (ui.jsx Wordmark, brand.mjs).
const RATIO = 428 / 2024;

export default function TileMark({ branded = true, className = '' }) {
  const ref = useRef(null);
  const [ink, setInk] = useState(null);   // the colour once the photograph is read, or null for no mark

  useLayoutEffect(() => {
    setInk(null);
    // The photograph is the nearest <img> before this one.
    let img = ref.current?.previousElementSibling;
    while (img && !(img instanceof HTMLImageElement)) img = img.previousElementSibling;
    if (!img) return undefined;
    const read = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) return;
      const square = Math.abs(w / h - 1) <= 0.02;
      setInk(branded && square ? null : inkUnder(img));
    };
    read();
    img.addEventListener('load', read);
    return () => img.removeEventListener('load', read);
  }, [branded]);

  return (
    <svg
      ref={ref}
      aria-hidden="true"
      viewBox="-12 -12 2024 428"
      className={`pointer-events-none absolute ${className}`}
      style={ink ? { right: `${RIGHT * 100}%`, top: `${TOP * 100}%`, width: `${WIDTH * 100}%`, height: 'auto', aspectRatio: `${1 / RATIO}` } : { display: 'none' }}
    >
      {ink && (
        <g fill="none" stroke={ink} strokeOpacity={ink === MAROON ? 0.88 : 0.92} strokeWidth="21" strokeLinejoin="miter" strokeMiterlimit="12">
          <polyline points="10,404 10,12 213,392 418,12 418,404" />
          <line x1="740" y1="0" x2="740" y2="404" />
          <polyline points="1062,404 1062,14 1376,392 1376,0" />
          <polyline points="1700,404 1845,12 1990,404" />
          <line x1="1738" y1="328" x2="1952" y2="328" />
        </g>
      )}
    </svg>
  );
}

/** brand.mjs's rule on the square the tile shows: maroon where the corner is light (≥ 128), white otherwise. */
function inkUnder(img) {
  try {
    const w = img.naturalWidth, h = img.naturalHeight, s = Math.min(w, h);
    const ox = (w - s) / 2, oy = (h - s) / 2;
    const mw = WIDTH * s, mh = mw * RATIO;
    const c = document.createElement('canvas');
    c.width = 24; c.height = 6;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, ox + s - RIGHT * s - mw, oy + TOP * s, mw, mh, 0, 0, 24, 6);
    const d = ctx.getImageData(0, 0, 24, 6).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    return sum / (d.length / 4) >= 128 ? MAROON : WHITE;
  } catch {
    return WHITE;
  }
}
