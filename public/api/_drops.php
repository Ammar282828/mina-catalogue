<?php
// ---------------------------------------------------------------------------
// Shared helpers for the "drop folder" catalog.
//
// The site's normal catalog is baked into the JS bundle at build time (see
// src/catalog.json). That's fast, but it means adding a photo requires
// a sync and a deploy. The drop folder is the shortcut: upload an
// image straight into
//
//     public_html/catalog-drop/<Chapter>/<Collection>/whatever.jpg
//
// via Hostinger's File Manager and it appears on the site on the next page load
// — no build, no redeploy.
//
// Two endpoints sit on top of this file:
//   api/catalog.php  — lists the drop folder as JSON for the app.
//   api/img.php      — makes the 720px / 3000px WebP variants on first request
//                      and caches them under public_html/catalog-drop-cache/,
//                      so every later request is a plain static file.
//
// Nothing here is required for the site to work: if PHP is unavailable or the
// folders don't exist, the app's fetch fails silently and the site behaves
// exactly as it did before.
// ---------------------------------------------------------------------------

declare(strict_types=1);

const DROP_DIR_NAME  = 'catalog-drop';
const CACHE_DIR_NAME = 'catalog-drop-cache';

// Source formats accepted in the drop folder.
const DROP_EXTS = ['jpg', 'jpeg', 'png', 'webp'];

// Must mirror VARIANTS in scripts/images.mjs so a photo uploaded from the
// counter looks like one copied over from the catalogue.
const DROP_VARIANTS = [
    'thumb' => ['max' => 720,  'q' => 74],
    'full'  => ['max' => 2000, 'q' => 84],
];

// Category/file.jpg (2) or Category/Sub-category/file.jpg (3). Deeper nesting
// has no meaning in the site's menu, so it's ignored.
const DROP_MAX_DEPTH = 3;

function drops_site_root(): string { return dirname(__DIR__); }
function drops_dir(): string       { return drops_site_root() . '/' . DROP_DIR_NAME; }
function drops_cache_dir(): string { return drops_site_root() . '/' . CACHE_DIR_NAME; }

// Normalise + validate a caller-supplied relative path. Returns null for
// anything that escapes the drop folder, is the wrong depth, or has an
// extension we don't handle. This is the only guard between a query string and
// the filesystem, so it stays strict: no "..", no absolute paths, no NUL.
function drops_clean_rel(string $rel): ?string
{
    $rel = str_replace('\\', '/', $rel);
    if ($rel === '' || strpos($rel, "\0") !== false) return null;

    $parts = [];
    foreach (explode('/', $rel) as $seg) {
        if ($seg === '' || $seg === '.') continue;
        if ($seg === '..') return null;
        $parts[] = $seg;
    }
    if (count($parts) < 2 || count($parts) > DROP_MAX_DEPTH) return null;

    $ext = strtolower(pathinfo(end($parts), PATHINFO_EXTENSION));
    if (!in_array($ext, DROP_EXTS, true)) return null;

    return implode('/', $parts);
}

// ── Image engine detection ─────────────────────────────────────────────────
// Imagick is preferred: it decodes JPEGs at a reduced size (the "jpeg:size"
// hint), which keeps a 6000px original from blowing the memory limit. GD is the
// fallback. If neither can write WebP we still resize, just to JPEG.

function drops_have_imagick(): bool
{
    return class_exists('Imagick');
}

function drops_imagick_webp(): bool
{
    if (!drops_have_imagick()) return false;
    try { return count(Imagick::queryFormats('WEBP')) > 0; } catch (Throwable $e) { return false; }
}

function drops_engine(): string
{
    if (drops_have_imagick()) return 'imagick';
    if (function_exists('imagecreatetruecolor')) return 'gd';
    return 'none';
}

// Extension the cached variants are written with — .webp everywhere WebP is
// available (all modern Hostinger stacks), .jpg on the rare host without it.
function drops_out_ext(): string
{
    if (drops_have_imagick()) return drops_imagick_webp() ? 'webp' : 'jpg';
    if (function_exists('imagewebp')) return 'webp';
    return 'jpg';
}

// Absolute path of a cached variant, mirroring the drop folder's tree.
function drops_cache_path(string $variant, string $rel, ?string $ext = null): string
{
    $ext = $ext ?: drops_out_ext();
    $dir = dirname($rel);
    $base = pathinfo($rel, PATHINFO_FILENAME);
    $sub = ($dir === '.' || $dir === '') ? '' : $dir . '/';
    return drops_cache_dir() . '/' . $variant . '/' . $sub . $base . '.' . $ext;
}

// Public URL of a cached variant. Path segments are encoded individually so
// spaces become %20 while "&" stays literal — the same rule the baked catalog
// uses (see _variantUrls in src/App.jsx), because Apache/LiteSpeed match the
// URL path literally against the filesystem.
function drops_encode_path(string $rel): string
{
    return implode('/', array_map('rawurlencode', explode('/', $rel)));
}

function drops_cache_url(string $variant, string $rel, ?string $ext = null): string
{
    $ext = $ext ?: drops_out_ext();
    $dir = dirname($rel);
    $base = pathinfo($rel, PATHINFO_FILENAME);
    $sub = ($dir === '.' || $dir === '') ? '' : $dir . '/';
    return '/' . CACHE_DIR_NAME . '/' . $variant . '/' . drops_encode_path($sub . $base . '.' . $ext);
}

// URL of the on-demand generator. Path-style (PATH_INFO) by default rather than
// a query string, so the URL still ENDS in the image's own filename — the app
// derives a piece's share key from the last path segment (see lib/recent.js).
//
// If a server refuses PATH_INFO on PHP files (rare; some locked-down LiteSpeed
// setups) those URLs 404. Flip this to false and they become
// /api/img.php?v=thumb&p=... instead, which always works — the only loss is
// slightly uglier share keys for images added this way.
const DROP_IMG_PATH_STYLE = true;

function drops_img_url(string $variant, string $rel): string
{
    if (!DROP_IMG_PATH_STYLE) {
        return '/api/img.php?v=' . rawurlencode($variant) . '&p=' . rawurlencode($rel);
    }
    $dir = dirname($rel);
    $base = pathinfo($rel, PATHINFO_FILENAME);
    $sub = ($dir === '.' || $dir === '') ? '' : $dir . '/';
    return '/api/img.php/' . $variant . '/' . drops_encode_path($sub . $base . '.' . drops_out_ext());
}

// A cached variant counts only if it's at least as new as its source, so
// re-uploading an image over an old one transparently regenerates it.
function drops_cache_is_fresh(string $cacheAbs, string $srcAbs): bool
{
    if (!is_file($cacheAbs)) return false;
    return filemtime($cacheAbs) >= filemtime($srcAbs);
}

// ── Directory walk ─────────────────────────────────────────────────────────
// Returns [['rel' => 'Rings/Engagement Rings/Elara.jpg', 't' => 1699999999], ...].
// Skips dotfiles and Hostinger/macOS cruft.
function drops_scan(): array
{
    $root = drops_dir();
    if (!is_dir($root)) return [];

    $out = [];
    $walk = function (string $abs, string $rel, int $depth) use (&$walk, &$out) {
        if ($depth > DROP_MAX_DEPTH) return;
        $entries = @scandir($abs);
        if ($entries === false) return;
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..' || $entry[0] === '.') continue;
            if ($entry === '__MACOSX') continue;
            $childAbs = $abs . '/' . $entry;
            $childRel = $rel === '' ? $entry : $rel . '/' . $entry;
            if (is_dir($childAbs)) {
                $walk($childAbs, $childRel, $depth + 1);
                continue;
            }
            $ext = strtolower(pathinfo($entry, PATHINFO_EXTENSION));
            if (!in_array($ext, DROP_EXTS, true)) continue;
            // A file directly in catalog-drop/ has no category — ignore it
            // rather than guessing where it belongs.
            if (substr_count($childRel, '/') < 1) continue;
            $mtime = @filemtime($childAbs);
            $out[] = ['rel' => $childRel, 't' => $mtime ?: 0];
        }
    };
    $walk($root, '', 1);
    return $out;
}
