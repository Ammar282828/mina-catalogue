/**
 * The landing's particle sculpture: one cloud of points that becomes the MINA
 * wordmark, a ring, a pair of earrings, a pendant… as the visitor scrolls
 * through the chapters. The same idea as taheri.shop's landing, re-cut for this
 * house: gold and rhodium points (its two platings) with a thread of maroon.
 *
 * Purely decorative. `mountParticles` resolves to null if WebGL or Three.js is
 * unavailable, and the landing reads perfectly well without it.
 */

// ── Geometry ────────────────────────────────────────────────────────────────
function rotate(arr, rx, ry, rz) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  for (let i = 0; i < arr.length; i += 3) {
    const x = arr[i], y = arr[i + 1], z = arr[i + 2];
    const y1 = y * cx - z * sx, z1 = y * sx + z * cx;
    const x2 = x * cy + z1 * sy, z2 = -x * sy + z1 * cy;
    arr[i] = x2 * cz - y1 * sz; arr[i + 1] = x2 * sz + y1 * cz; arr[i + 2] = z2;
  }
  return arr;
}
const rand = (a = 1) => (Math.random() - 0.5) * a;

function cloud(N, radius) {
  const a = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), r = Math.cbrt(Math.random()) * radius;
    a[i * 3] = r * Math.sin(ph) * Math.cos(th); a[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); a[i * 3 + 2] = r * Math.cos(ph);
  }
  return a;
}

/** The wordmark, drawn from its own strokes (the logo is four thin-line letters). */
const WORDMARK = [
  [10, 404, 10, 10], [10, 10, 213, 395], [213, 395, 418, 10], [418, 10, 418, 404],   // M
  [740, 0, 740, 404],                                                                // I
  [1062, 404, 1062, 10], [1062, 10, 1376, 394], [1376, 394, 1376, 0],               // N
  [1700, 404, 1845, 10], [1845, 10, 1990, 404], [1738, 328, 1952, 328],             // A
];
function wordmark(N) {
  const a = new Float32Array(N * 3);
  const lens = WORDMARK.map(([x1, y1, x2, y2]) => Math.hypot(x2 - x1, y2 - y1));
  const total = lens.reduce((s, l) => s + l, 0);
  const s = 15 / 2000;
  for (let i = 0; i < N; i++) {
    // A fifth of the points hang around the letters as dust, so the mark
    // reads as made of light rather than printed.
    if (Math.random() < 0.18) {
      a[i * 3] = rand(19); a[i * 3 + 1] = rand(7); a[i * 3 + 2] = rand(6);
      continue;
    }
    let r = Math.random() * total, k = 0;
    while (r > lens[k]) { r -= lens[k]; k++; }
    const [x1, y1, x2, y2] = WORDMARK[k];
    const t = r / lens[k];
    const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
    a[i * 3] = (x - 1000) * s + rand(0.16);
    a[i * 3 + 1] = (202 - y) * s + rand(0.16);
    a[i * 3 + 2] = rand(0.5);
  }
  return a;
}

function sparkle(N) {
  const a = new Float32Array(N * 3);
  const rays = [[0, 1, 5.2], [0, -1, 5.2], [1, 0, 4.2], [-1, 0, 4.2]];
  const sats = [[4.6, 3.4, 1.7], [-3.9, -3.1, 1.3]];
  for (let i = 0; i < N; i++) {
    const r = Math.random(); let x, y;
    if (r < 0.16) { const rr = 1.05 * Math.cbrt(Math.random()), th = Math.random() * Math.PI * 2; x = rr * Math.cos(th); y = rr * Math.sin(th); }
    else if (r < 0.88) {
      const [ax, ay, L] = rays[Math.floor(Math.random() * 4)];
      const t = Math.pow(Math.random(), 1.6), w = 0.7 * (1 - t) * (1 - t) + 0.04;
      const along = L * t, across = rand(2 * w);
      x = ax * along + ay * across; y = ay * along + ax * across;
    } else {
      const [sx, sy, L] = sats[Math.floor(Math.random() * 2)];
      const v = Math.random() < 0.5, t = Math.pow(Math.random(), 1.4) * (Math.random() < 0.5 ? 1 : -1), w = 0.16 * (1 - Math.abs(t));
      x = sx + (v ? rand(w) : L * t); y = sy + (v ? L * t : rand(w));
    }
    a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = rand(0.5);
  }
  return rotate(a, 0.12, 0.38, 0.06);
}

/** A solitaire: a band with a stone raised on prongs. */
function ring(N) {
  const a = new Float32Array(N * 3);
  const R = 3.6;
  for (let i = 0; i < N; i++) {
    let x, y, z;
    if (Math.random() < 0.2) {
      // The stone: a cone for the pavilion, a flat table on top.
      const up = Math.random() < 0.35, th = Math.random() * Math.PI * 2;
      if (up) { const r = Math.sqrt(Math.random()) * 0.9; x = r * Math.cos(th); z = r * Math.sin(th); y = R + 1.55 + rand(0.05); }
      else { const h = Math.random(), r = 1.25 * h; x = r * Math.cos(th); z = r * Math.sin(th); y = R + 0.3 + h * 1.25; }
    } else {
      const u = Math.random() * Math.PI * 2, v = Math.random() * Math.PI * 2, tube = 0.32 + rand(0.08);
      x = (R + tube * Math.cos(v)) * Math.cos(u); y = (R + tube * Math.cos(v)) * Math.sin(u); z = tube * Math.sin(v) * 1.6;
    }
    a[i * 3] = x; a[i * 3 + 1] = y - 0.6; a[i * 3 + 2] = z;
  }
  return rotate(a, 0.55, 0.45, 0);
}

function earrings(N) {
  const a = new Float32Array(N * 3), half = Math.floor(N / 2);
  for (let side = 0; side < 2; side++) {
    const ox = side ? 3.4 : -3.4;
    for (let i = 0; i < half; i++) {
      const idx = (side * half + i) * 3; const p = Math.random(); let x, y, z;
      if (p < 0.4) {
        // A huggie hoop at the lobe.
        const u = Math.random() * Math.PI * 2, v = Math.random() * Math.PI * 2, R = 1.3, tube = 0.22;
        x = (R + tube * Math.cos(v)) * Math.cos(u); y = (R + tube * Math.cos(v)) * Math.sin(u) + 3.2; z = tube * Math.sin(v);
      } else {
        // A pear-shaped drop beneath it.
        const t = Math.random() * Math.PI * 2, s = Math.sqrt(Math.random());
        const px = Math.sin(t) * (1 - Math.cos(t) * 0.35) * 1.5, py = -Math.cos(t) * 2.1;
        x = px * s; y = py * s - 1.2; z = rand(0.45) * (1 - s * 0.5);
      }
      a[idx] = x + ox; a[idx + 1] = y; a[idx + 2] = z;
    }
  }
  return rotate(a, 0.1, 0.25, 0);
}

/** A fine chain falling in a curve to a single stone. */
function pendant(N) {
  const a = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    let x, y, z;
    if (Math.random() < 0.7) {
      // The chain hangs as a curve from the shoulders to the throat.
      const t = Math.random() * 2 - 1;
      x = 5.2 * t + rand(0.08); y = 0.2 + 3.4 * t * t + rand(0.08); z = rand(0.15) + (1 - t * t) * 0.6;
    } else {
      // The stone: an oval under a small bail, dense at the rim to catch the light.
      const th = Math.random() * Math.PI * 2, r = Math.random() < 0.55 ? 1 : Math.sqrt(Math.random());
      x = Math.cos(th) * 0.95 * r; y = Math.sin(th) * 1.3 * r - 1.35; z = rand(0.5) * (1 - r) + 0.6;
    }
    a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
  }
  return rotate(a, 0.15, 0.2, 0);
}

function bangles(N) {
  const a = new Float32Array(N * 3), n = 3, per = Math.floor(N / n);
  for (let b = 0; b < n; b++) {
    const oz = (b - 1) * 1.1, R = 4.6;
    for (let i = 0; i < per; i++) {
      const idx = (b * per + i) * 3; if (idx >= N * 3) break;
      const u = Math.random() * Math.PI * 2, v = Math.random() * Math.PI * 2, tube = b === 1 ? 0.5 : 0.28;
      a[idx] = (R + tube * Math.cos(v)) * Math.cos(u); a[idx + 1] = (R + tube * Math.cos(v)) * Math.sin(u); a[idx + 2] = tube * Math.sin(v) * 0.5 + oz;
    }
  }
  return rotate(a, 1.15, 0.35, 0);
}

/** A men's band: wide and flat, with a bevelled edge. */
function band(N) {
  const a = new Float32Array(N * 3), R = 3.9, W = 1.7;
  for (let i = 0; i < N; i++) {
    const u = Math.random() * Math.PI * 2, side = Math.random();
    let r, z;
    if (side < 0.7) { r = R + rand(0.08); z = rand(W); }              // the face
    else if (side < 0.85) { r = R - 0.35 + rand(0.05); z = rand(W); } // the inside
    else { r = R - Math.random() * 0.35; z = (Math.random() < 0.5 ? -1 : 1) * W / 2; } // the rims
    a[i * 3] = r * Math.cos(u); a[i * 3 + 1] = r * Math.sin(u); a[i * 3 + 2] = z;
  }
  return rotate(a, 0.95, 0.5, 0.1);
}

/** A brilliant-cut stone seen from the side: table, crown, girdle, pavilion. */
function gem(N) {
  const a = new Float32Array(N * 3), G = 4.2, T = 2.5, CH = 1.5, PH = 4.6;
  for (let i = 0; i < N; i++) {
    const th = Math.random() * Math.PI * 2, p = Math.random(); let r, y;
    if (p < 0.14) { r = Math.sqrt(Math.random()) * T; y = CH; }
    else if (p < 0.45) { const t = Math.random(); r = T + (G - T) * t; y = CH * (1 - t); }
    else { const t = Math.pow(Math.random(), 0.8); r = G * (1 - t); y = -PH * t; }
    // Eight facets: the points gather on the facet edges.
    const facet = Math.round(th / (Math.PI / 4)) * (Math.PI / 4);
    const ang = th + (facet - th) * 0.35;
    a[i * 3] = r * Math.cos(ang); a[i * 3 + 1] = y + 1.4; a[i * 3 + 2] = r * Math.sin(ang);
  }
  return rotate(a, 0.35, 0.3, 0);
}

function heart(N) {
  const a = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const t = Math.random() * Math.PI * 2, s = Math.random() < 0.6 ? 1 : Math.sqrt(Math.random());
    const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    a[i * 3] = x * 0.27 * s + rand(0.12); a[i * 3 + 1] = y * 0.27 * s + 1.1 + rand(0.12); a[i * 3 + 2] = rand(0.8) * (1 - s * 0.6);
  }
  return rotate(a, 0.05, 0.3, 0);
}

export const SHAPES = { wordmark, sparkle, rings: ring, earrings, chains: pendant, bangles, band, gem, heart };

// ── Scroll ──────────────────────────────────────────────────────────────────
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Where the scroll sits between chapters: which two shapes to blend, how far,
 * and how visible the chapter's words are. Each chapter holds still for the
 * first and last 15% of its stretch, so the words can be read.
 */
export function scrollState(progress, n) {
  const p = Math.max(0, Math.min(1, progress));
  const step = 1 / (n - 1);
  const i = Math.floor(p / step);
  if (i >= n - 1) return { s1: n - 1, s2: n - 1, mix: 0, active: n - 1, textOpacity: 1 };
  const local = (p - i * step) / step;
  if (local <= 0.15) return { s1: i, s2: i + 1, mix: 0, active: i, textOpacity: 1 };
  if (local >= 0.85) return { s1: i, s2: i + 1, mix: 1, active: i + 1, textOpacity: 1 };
  const m = (local - 0.15) / 0.7;
  const textOpacity = m < 0.25 ? 1 - m / 0.25 : m > 0.75 ? (m - 0.75) / 0.25 : 0;
  return { s1: i, s2: i + 1, mix: easeInOutCubic(m), active: m > 0.5 ? i + 1 : i, textOpacity };
}

function fit(w, h) {
  const aspect = w / h, tanHalf = Math.tan((45 * Math.PI) / 360);
  const cameraZ = Math.max(20 / (2 * tanHalf * aspect), 18.5 / (2 * tanHalf));
  const size = Math.max(0.075, 0.095 + (cameraZ - 20) * 0.0038);
  const halfH = cameraZ * tanHalf;
  return { cameraZ, size, cloudRadius: Math.hypot(halfH * aspect, halfH) * 1.4 };
}

// ── Engine ──────────────────────────────────────────────────────────────────
const PALETTE = {
  light: { gold: [0.56, 0.39, 0.11], silver: [0.36, 0.38, 0.42], accent: [0.30, 0.02, 0.03] },
  dark: { gold: [0.86, 0.67, 0.31], silver: [0.80, 0.83, 0.90], accent: [0.90, 0.60, 0.65] },
};

/**
 * Mount the sculpture into `container`.
 *   shapes      shape keys, one per chapter
 *   getProgress () => 0..1 scroll progress through the chapters
 * Resolves to { setTheme, setPaused, destroy } — or null when WebGL is not there.
 */
export async function mountParticles(container, { shapes, getProgress, theme = 'light', mobile = false }) {
  let THREE;
  try {
    THREE = await import('./three-lite.js');
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return null;
  } catch { return null; }

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const N = mobile ? 7000 : 15000;
  let f = fit(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.z = f.cameraZ;
  // The words sit in the lower third of the screen, so the sculpture is drawn
  // a little above centre: the view is shifted, not every shape.
  const LIFT = 0.075;
  const frame = () => camera.setViewOffset(window.innerWidth, window.innerHeight, 0, window.innerHeight * LIFT, window.innerWidth, window.innerHeight);
  frame();
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch { return null; }
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 2 : 1.5));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const material = new THREE.PointsMaterial({ size: f.size, transparent: true, sizeAttenuation: true, vertexColors: true, depthWrite: false });
  const sprite = (dark) => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(dark ? 0.3 : 0.45, `rgba(255,255,255,${dark ? 1 : 0.75})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  };
  let palette = PALETTE[theme] || PALETTE.light;
  const setTheme = (t) => {
    palette = PALETTE[t] || PALETTE.light;
    material.map?.dispose();
    material.map = sprite(t === 'dark');
    material.opacity = t === 'dark' ? 0.85 : 0.92;
    material.blending = t === 'dark' ? THREE.AdditiveBlending : THREE.NormalBlending;
    material.needsUpdate = true;
  };
  setTheme(theme);

  const targets = shapes.map((k) => (SHAPES[k] || ((n) => cloud(n, 8)))(N));
  const pos = cloud(N, f.cloudRadius);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const colors = new Float32Array(N * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  scene.add(new THREE.Points(geometry, material));

  // Each point is gold, rhodium or — one in twelve — the house's maroon, for good.
  const kind = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const r = Math.random(); kind[i] = r < 0.52 ? 0 : r < 0.92 ? 1 : 2; }
  const phaseC = new Float32Array(N), phaseS = new Float32Array(N);
  for (let i = 0; i < N; i++) { phaseC[i] = Math.cos(i * 0.1); phaseS[i] = Math.sin(i * 0.1); }

  // The pointer parts the points: a soft ring opens around it.
  const mouse = new THREE.Vector2(-9999, -9999), hit = new THREE.Vector3(9999, 9999, 9999), smooth = new THREE.Vector3(9999, 9999, 9999);
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const onMove = (x, y) => { mouse.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1); };
  const onMouse = (e) => onMove(e.clientX, e.clientY);
  const onTouch = (e) => { const t = e.touches[0]; if (t) onMove(t.clientX, t.clientY); };
  const onLeave = () => mouse.set(-9999, -9999);
  window.addEventListener('mousemove', onMouse, { passive: true });
  window.addEventListener('touchmove', onTouch, { passive: true });
  document.addEventListener('mouseleave', onLeave);

  const onResize = () => {
    f = fit(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight; camera.position.z = f.cameraZ; frame(); camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    material.size = f.size;
  };
  window.addEventListener('resize', onResize);

  let paused = false, raf = 0;
  const animate = () => {
    raf = requestAnimationFrame(animate);
    if (paused || document.hidden) return;
    const time = performance.now() / 1000;
    const { s1, s2, mix } = scrollState(getProgress(), targets.length);
    const A = targets[s1], B = targets[s2];

    ray.setFromCamera(mouse, camera);
    if (!ray.ray.intersectPlane(plane, hit)) hit.set(9999, 9999, 9999);
    smooth.lerp(hit, 0.3);
    const drift = reduced ? 0.04 : 0.18;
    const s5 = Math.sin(time * 0.5) * drift, c5 = Math.cos(time * 0.5) * drift;
    const s4 = Math.sin(time * 0.4) * drift, c4 = Math.cos(time * 0.4) * drift;
    const s3 = Math.sin(time * 0.3) * drift, c3 = Math.cos(time * 0.3) * drift;
    const radius = mobile ? 2.0 : 1.7, r2 = radius * radius;
    const { gold, silver, accent } = palette;

    for (let i = 0, j = 0; i < N; i++, j += 3) {
      let tx = A[j] + (B[j] - A[j]) * mix, ty = A[j + 1] + (B[j + 1] - A[j + 1]) * mix, tz = A[j + 2] + (B[j + 2] - A[j + 2]) * mix;
      const co = phaseC[i], so = phaseS[i];
      tx += s5 * co + c5 * so; ty += c4 * co - s4 * so; tz += s3 * co + c3 * so;

      const dx = tx - smooth.x, dy = ty - smooth.y, d2 = dx * dx + dy * dy;
      let force = 0, home = 0.14;
      if (d2 < r2 && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        force = 1 - d / radius;
        const push = (force * (mobile ? 2.6 : 1.3)) / d;
        tx += dx * push; ty += dy * push; tz += force * 0.8;
        home = 0.06;
      }
      const base = kind[i] === 0 ? gold : kind[i] === 1 ? silver : accent;
      const bloom = force * 0.45;
      colors[j] = base[0] + bloom; colors[j + 1] = base[1] + bloom; colors[j + 2] = base[2] + bloom;
      pos[j] += (tx - pos[j]) * home; pos[j + 1] += (ty - pos[j + 1]) * home; pos[j + 2] += (tz - pos[j + 2]) * home;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    renderer.render(scene, camera);
  };
  animate();

  return {
    setTheme,
    setPaused: (v) => { paused = v; },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('touchmove', onTouch);
      document.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', onResize);
      geometry.dispose(); material.map?.dispose(); material.dispose(); renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
