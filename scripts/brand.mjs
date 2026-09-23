// The MINA wordmark on every photograph that does not carry it yet (the owner,
// 2026-09-24), placed as on the house's own catalogue photographs (the bangles'
// "MINA", top right): 19% of the width across, 4.8% in from the right edge and
// 3.7% down from the top. Maroon where that corner is light, white where it is dark.
//
// Photographs that already carry the mark — the Instagram posts, the bangles, some
// lockets — are listed in data/marked.json and are left alone (found by
// scripts/find-marks.py; add a new post's photograph there by hand, or run it again).
// scripts/images.mjs applies this after the ring framing (whitespace.mjs), and
// PHOTO_VERSION in catalog.js goes into every photograph's URL, so raising it
// brands everything again (after a change here) and browsers fetch the new files.

import sharp from 'sharp';

// The wordmark as the site draws it (src/components/ui.jsx, Wordmark).
const WORDMARK = [
  '<polyline points="10,404 10,12 213,392 418,12 418,404" />',
  '<line x1="740" y1="0" x2="740" y2="404" />',
  '<polyline points="1062,404 1062,14 1376,392 1376,0" />',
  '<polyline points="1700,404 1845,12 1990,404" />',
  '<line x1="1738" y1="328" x2="1952" y2="328" />',
].join('');

const WIDTH = 0.19, RIGHT = 0.048, TOP = 0.037;
const MAROON = '#3A0000', WHITE = '#FFFFFF';

export async function brand(input) {
  const { data, info } = await sharp(input).rotate().flatten({ background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  const mw = Math.round(W * WIDTH), mh = Math.round((mw * 428) / 2024);
  const left = W - Math.round(W * RIGHT) - mw, top = Math.round(W * TOP);

  // How light the corner is where the mark goes.
  let sum = 0, n = 0;
  for (let y = top; y < Math.min(H, top + mh); y += 2) for (let x = left; x < left + mw; x += 2) {
    const i = (y * W + x) * C; sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; n++;
  }
  const light = n ? sum / n : 255;
  const colour = light >= 128 ? MAROON : WHITE;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}" viewBox="-12 -12 2024 428">`
    + `<g fill="none" stroke="${colour}" stroke-opacity="${colour === MAROON ? 0.88 : 0.92}" stroke-width="21" stroke-linejoin="miter" stroke-miterlimit="12">${WORDMARK}</g></svg>`;

  return sharp(data, { raw: { width: W, height: H, channels: C } })
    .composite([{ input: Buffer.from(svg), left, top }])
    .png({ compressionLevel: 3 })
    .toBuffer();
}
