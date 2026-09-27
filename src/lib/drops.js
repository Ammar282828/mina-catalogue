/**
 * What the counter has changed since the last build, from api/catalog.php:
 *
 *   images     photographs uploaded from the POS (catalog-drop/ on the server),
 *              folded into their collections at load;
 *   overrides  the counter's changes to pieces already here — a name, the words,
 *              a hidden piece, a re-made photograph (api/_overrides.php), by
 *              mina/piece/<handle>.
 *
 * Never rejects and gives up after two seconds, so a slow or missing endpoint
 * costs nothing but the newest changes.
 */
export async function loadDrops() {
  const none = { images: [], overrides: {} };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch('/api/catalog.php', { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!res.ok) return none;
    const data = await res.json();
    const overrides = data?.overrides && typeof data.overrides === 'object' && !Array.isArray(data.overrides) ? data.overrides : {};
    return { images: Array.isArray(data?.images) ? data.images : [], overrides };
  } catch {
    return none;
  }
}
