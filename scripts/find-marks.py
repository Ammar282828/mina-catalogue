#!/usr/bin/env python3
"""Does a photograph already carry the MINA wordmark?

    python3 scripts/find-marks.py photo.jpg [more.jpg …]

Prints each file's score and "marked" or "plain". A photograph that is marked goes
into data/marked.json (by its variant key, e.g. "local/bb-001"), so scripts/brand.mjs
does not put a second mark on it. Run it on the ORIGINAL file, before it is built:
every built photograph carries the mark by then.

The wordmark is drawn as the site draws it (ui.jsx Wordmark) and looked for along
the top and bottom fifth of the photograph at seven sizes (10–30% of the width), on
a map of local contrast so its colour does not matter; a match must also show real
ink along the strokes, or a blank corner would pass. On 2026-09-24 every true mark
scored 0.40 or more and nothing else above 0.33 (1,637 photographs, checked by eye).
Needs OpenCV (pip install opencv-python) — this runs on the owner's Mac, not in CI.
"""
import sys
import numpy as np
import cv2

THRESHOLD = 0.38
LINES = [[(10, 404), (10, 12), (213, 392), (418, 12), (418, 404)], [(740, 0), (740, 404)],
         [(1062, 404), (1062, 14), (1376, 392), (1376, 0)], [(1700, 404), (1845, 12), (1990, 404)],
         [(1738, 328), (1952, 328)]]


def template(width):
    k = width / 2024.0
    t = np.zeros((int(round(428 * k)) + 6, int(round(2024 * k)) + 6), np.float32)
    for pl in LINES:
        pts = np.array([[int(round((x + 12) * k)) + 3, int(round((y + 12) * k)) + 3] for x, y in pl], np.int32)
        cv2.polylines(t, [pts], False, 1.0, max(1, int(round(21 * k * 1.2))), cv2.LINE_AA)
    return cv2.GaussianBlur(t, (3, 3), 0)


def score(path):
    im = cv2.imread(path, cv2.IMREAD_COLOR)
    if im is None:
        return None
    h, w = im.shape[:2]
    s = 1000.0 / max(h, w)
    im = cv2.resize(im, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)
    c = np.abs(g - cv2.GaussianBlur(g, (0, 0), 6))
    H, W = g.shape
    best = 0.0
    for y0, y1 in ((0, int(H * 0.22)), (int(H * 0.78), H)):
        region = c[y0:y1]
        for frac in (0.10, 0.13, 0.16, 0.19, 0.22, 0.26, 0.30):
            t = template(W * frac)
            if t.shape[0] >= region.shape[0] or t.shape[1] >= region.shape[1]:
                continue
            r = cv2.matchTemplate(region, t, cv2.TM_CCOEFF_NORMED)
            for _ in range(3):
                _, mx, _, (x, y) = cv2.minMaxLoc(r)
                win = region[y:y + t.shape[0], x:x + t.shape[1]]
                on = t > 0.5
                if float(win[on].mean() - win[~on].mean()) >= 4 and mx > best:
                    best = mx
                r[max(0, y - 8):y + 8, max(0, x - 8):x + 8] = -1
    return best


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for p in sys.argv[1:]:
        s = score(p)
        print(f'{"unreadable" if s is None else ("marked" if s >= THRESHOLD else "plain"):10} {s if s is None else round(s, 3)}  {p}')
