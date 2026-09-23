/**
 * Photographs the counter has uploaded from the POS since the last build.
 *
 * They sit in catalog-drop/ on the server and api/catalog.php lists them; the
 * app folds them into their collections at load. Never rejects and gives up
 * after two seconds, so a slow or missing endpoint costs nothing but the
 * newest pieces.
 */
export async function loadDrops() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch('/api/catalog.php', { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.images) ? data.images : [];
  } catch {
    return [];
  }
}
