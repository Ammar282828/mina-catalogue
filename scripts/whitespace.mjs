// Standard whitespace for ring photographs (the owner, 2026-09-24).
//
// A ring photographed on a plain, light background is re-framed so that it sits
// in the middle of a square and spans the same share of it as every other ring:
// its outline (with its reflection or shadow, which belong to the photograph)
// fills FILL of the square's side — the share houseofmina.store's own product
// photographs give their rings. The background is the photograph's own,
// taken from its edges; where the new frame reaches past the photograph it is
// continued in that colour. A transparent image is laid on white first.
//
// A photograph that is not a plain background — on a hand, on a box, in a scene,
// with lettering — is returned as it was: re-framing a scene would cut it up.
//
// Used by scripts/images.mjs for every photograph of a piece whose home is a ring
// category (RING_HOMES in catalog.js). VERSION is written to data/framed.json and
// goes into those images' URLs, so browsers fetch the new framing rather than keep
// the old; raise it after changing FILL or the detection, and every ring is framed
// again on the next build.

import sharp from 'sharp';

export const VERSION = 3;
/**
 * The ring's outline spans this share of the square, and its middle sits this far
 * below the square's: houseofmina.store's own ring photographs, measured with
 * measure() on 2026-09-24 (130 of them: 55.5% median, 55–56.5% for nine in ten;
 * centred across, 0.5% low), so every ring here matches the website.
 */
export const FILL = 0.555;
export const DROP = 0.005;

const ANALYSE = 400;      // analysis size, px on the longer side
const BORDER = 0.04;      // the band along each edge that must be background
const TOLERANCE = 22;     // how far a pixel may differ from the background and still be background
const PLAIN = 0.9;        // share of the border band that must be background

/**
 * Where the piece is in a photograph: { plain, reason, W, H, full, C, med, box: [x0, y0, x1, y1] }
 * in the photograph's own pixels, or plain: false for a scene.
 */
export async function measure(input) {
  const base = sharp(input).rotate().flatten({ background: '#ffffff' });
  const { data: full, info: fi } = await base.clone().raw().toBuffer({ resolveWithObject: true });
  const W = fi.width, H = fi.height, C = fi.channels;
  const k = Math.min(1, ANALYSE / Math.max(W, H));
  const { data: a, info } = await sharp(full, { raw: { width: W, height: H, channels: C } })
    .resize(Math.max(1, Math.round(W * k)), Math.max(1, Math.round(H * k)), { kernel: 'cubic' })
    .raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, c = info.channels;
  const px = (x, y) => { const i = (y * w + x) * c; return [a[i], a[i + 1], a[i + 2]]; };

  // The background: the median of the border band, and how much of the band it covers.
  const bw = Math.max(2, Math.round(Math.min(w, h) * BORDER));
  const band = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x < bw || y < bw || x >= w - bw || y >= h - bw) band.push(px(x, y));
  }
  const med = [0, 1, 2].map((ch) => { const v = band.map((p) => p[ch]).sort((m, n) => m - n); return v[v.length >> 1]; });
  const near = (p) => Math.max(Math.abs(p[0] - med[0]), Math.abs(p[1] - med[1]), Math.abs(p[2] - med[2])) <= TOLERANCE;
  const plainShare = band.filter(near).length / band.length;
  const light = 0.2126 * med[0] + 0.7152 * med[1] + 0.0722 * med[2];
  if (plainShare < PLAIN) return { plain: false, reason: `edges not plain (${Math.round(plainShare * 100)}%)` };
  if (light < 200) return { plain: false, reason: `background too dark (${Math.round(light)})` };

  // The background where the piece is: a studio backdrop is rarely one flat colour (a
  // grey vignette, a lighter centre), so it is read off the four edges and blended
  // across — each row between its left and right edge, each column between its top
  // and bottom — and a pixel is the piece where it is darker than that, or of another
  // colour. Lighter than the backdrop (a highlight, a brighter centre) is not.
  const edge = (pick, n) => {
    const raw = Array.from({ length: n }, (_, i) => [0, 1, 2].map((ch) => {
      const v = []; for (let j = 0; j < bw; j++) v.push(pick(i, j)[ch]);
      return v.sort((m, q) => m - q)[v.length >> 1];
    }));
    return raw.map((_, i) => [0, 1, 2].map((ch) => {           // a gentle moving average
      let s = 0, m = 0; for (let d = -6; d <= 6; d++) { const r = raw[i + d]; if (r) { s += r[ch]; m++; } } return s / m;
    }));
  };
  const L = edge((y, j) => px(j, y), h), R = edge((y, j) => px(w - 1 - j, y), h);
  const T = edge((x, j) => px(x, j), w), B = edge((x, j) => px(x, h - 1 - j), w);
  const piece = (x, y) => {
    const p = px(x, y), u = x / (w - 1), t = y / (h - 1);
    let dark = 0, hue = 0;
    const d = [0, 1, 2].map((ch) => ((L[y][ch] * (1 - u) + R[y][ch] * u) + (T[x][ch] * (1 - t) + B[x][ch] * t)) / 2 - p[ch]);
    dark = Math.min(...d); hue = Math.max(...d) - Math.min(...d);
    return dark > TOLERANCE || hue > TOLERANCE;
  };

  // The piece: every row and column with enough of it.
  const rows = new Array(h).fill(0), cols = new Array(w).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (piece(x, y)) { rows[y]++; cols[x]++; }
  const minRow = Math.max(1, Math.round(w * 0.004)), minCol = Math.max(1, Math.round(h * 0.004));
  const y0 = rows.findIndex((n) => n >= minRow), y1 = h - 1 - [...rows].reverse().findIndex((n) => n >= minRow);
  const x0 = cols.findIndex((n) => n >= minCol), x1 = w - 1 - [...cols].reverse().findIndex((n) => n >= minCol);
  if (y0 < 0 || x0 < 0 || x1 <= x0 || y1 <= y0) return { plain: false, reason: 'no piece found' };
  return { plain: true, W, H, C, full, med, box: [x0 / k, y0 / k, (x1 + 1) / k, (y1 + 1) / k] };
}

/**
 * { buffer, framed, reason } — `framed` false means the photograph was left alone.
 * The buffer is a lossless PNG, at most 2400 px, for the variant builder.
 */
export async function standardWhitespace(input) {
  const m = await measure(input);
  if (!m.plain) return { buffer: input, framed: false, reason: m.reason };
  const { W, H, C, full, med } = m;
  const [bx0, by0, bx1, by1] = m.box;

  // The new square, in the photograph's own pixels.
  const side = Math.round(Math.max(bx1 - bx0, by1 - by0) / FILL);
  const left = Math.round((bx0 + bx1) / 2 - side / 2), top = Math.round((by0 + by1) / 2 - side / 2 - DROP * side);
  const pad = { left: Math.max(0, -left), top: Math.max(0, -top), right: Math.max(0, left + side - W), bottom: Math.max(0, top + side - H) };
  const background = { r: med[0], g: med[1], b: med[2] };

  let out = sharp(full, { raw: { width: W, height: H, channels: C } });
  if (pad.left || pad.top || pad.right || pad.bottom) {
    out = sharp(await out.extend({ ...pad, background }).raw().toBuffer(), {
      raw: { width: W + pad.left + pad.right, height: H + pad.top + pad.bottom, channels: C },
    });
  }
  const buffer = await out
    .extract({ left: left + pad.left, top: top + pad.top, width: side, height: side })
    .resize({ width: Math.min(side, 2400), height: Math.min(side, 2400) })
    .png({ compressionLevel: 3 })
    .toBuffer();
  return { buffer, framed: true, reason: `framed (${Math.round((bx1 - bx0) / W * 100)}% × ${Math.round((by1 - by0) / H * 100)}% of the original)` };
}
