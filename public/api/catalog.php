<?php
// ---------------------------------------------------------------------------
// GET /api/catalog.php
//
// Lists everything sitting in public_html/catalog-drop/ as JSON so the app can
// fold those images into the right galleries at runtime. Response shape:
//
//   {
//     "ok": true,
//     "engine": "imagick",
//     "count": 3,
//     "images": [
//       { "p": "Rings/Engagement Rings/Elara.jpg",
//         "t": 1765432100,
//         "thumb": "/catalog-drop-cache/thumb/Rings/Engagement%20Rings/Elara.webp",
//         "full":  "/api/img.php/full/Rings/Engagement%20Rings/Elara.webp" },
//       ...
//     ]
//   }
//
// "p" is the path relative to catalog-drop/ (category + sub-category + file);
// "t" is the upload time, which is what puts a new piece at the top of a
// newest-first gallery. Each URL points at the cached static file when it has
// already been generated, and at api/img.php when it hasn't — so the first view
// builds it and every view after that is served straight off disk.
//
// This endpoint never resizes anything itself: dropping 50 photos at once would
// otherwise make one page load do 50 conversions and time out.
// ---------------------------------------------------------------------------

declare(strict_types=1);

require __DIR__ . '/_drops.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
// Short cache: new uploads should show up within a page refresh or two, but a
// visitor clicking through five collections shouldn't re-scan five times.
header('Cache-Control: public, max-age=30');

$root = drops_dir();
if (!is_dir($root)) {
    echo json_encode([
        'ok'     => true,
        'images' => [],
        'note'   => 'catalog-drop folder not found',
    ]);
    exit;
}

$items = drops_scan();
$ext = drops_out_ext();
$images = [];

foreach ($items as $item) {
    $rel = $item['rel'];
    $srcAbs = $root . '/' . $rel;

    $urls = [];
    foreach (array_keys(DROP_VARIANTS) as $variant) {
        $cacheAbs = drops_cache_path($variant, $rel, $ext);
        $urls[$variant] = drops_cache_is_fresh($cacheAbs, $srcAbs)
            ? drops_cache_url($variant, $rel, $ext)
            : drops_img_url($variant, $rel);
    }

    $images[] = [
        'p'     => $rel,
        't'     => $item['t'],
        'thumb' => $urls['thumb'],
        'full'  => $urls['full'],
    ];
}

echo json_encode([
    'ok'     => true,
    'engine' => drops_engine(),
    'count'  => count($images),
    'images' => $images,
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
