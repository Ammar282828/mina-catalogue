<?php
// ---------------------------------------------------------------------------
// GET /api/img.php/<variant>/<Category>/<Sub-category>/<name>.webp
//
// Builds the 720px ("thumb") or 3000px ("full") variant of an image sitting in
// public_html/catalog-drop/, writes it to public_html/catalog-drop-cache/, and
// streams it back. Only the FIRST request for a given image runs this code —
// after that api/catalog.php reports the cached file's own URL, and Apache /
// LiteSpeed serves it as a plain static file with no PHP involved.
//
// The URL is path-style rather than ?p=... on purpose: the app derives a
// piece's share key from the last path segment, so the URL has to end in the
// image's own name (see src/lib/recent.js).
//
// Degrades rather than fails: no Imagick and no GD, or an original too large to
// decode within the memory limit, and it simply redirects to the original file.
// The picture still shows up, it's just heavier.
// ---------------------------------------------------------------------------

declare(strict_types=1);

require __DIR__ . '/_drops.php';

// ── Parse "<variant>/<rel-path>.<ext>" out of the URL ──────────────────────
$pathInfo = $_SERVER['PATH_INFO'] ?? '';
if ($pathInfo === '') {
    // Some LiteSpeed / CGI setups don't populate PATH_INFO. Recover it from the
    // raw request URI instead.
    $uri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
    $marker = '/img.php/';
    $at = strpos($uri, $marker);
    if ($at !== false) $pathInfo = rawurldecode(substr($uri, $at + strlen($marker) - 1));
}
// Last resort for anyone hitting it by hand: ?v=thumb&p=Cat/Sub/file.jpg
if ($pathInfo === '' && isset($_GET['p'])) {
    $pathInfo = '/' . (string) ($_GET['v'] ?? 'thumb') . '/' . (string) $_GET['p'];
}

$pathInfo = ltrim($pathInfo, '/');
$slash = strpos($pathInfo, '/');
if ($slash === false) {
    http_response_code(400);
    exit('Bad request');
}

$variant = substr($pathInfo, 0, $slash);
$requested = substr($pathInfo, $slash + 1);

if (!array_key_exists($variant, DROP_VARIANTS)) {
    http_response_code(404);
    exit('Unknown variant');
}

// The requested name carries the OUTPUT extension (.webp); the source on disk
// may be any accepted format, so strip it and probe.
$requestedDir = dirname($requested);
$requestedBase = pathinfo($requested, PATHINFO_FILENAME);
$stem = ($requestedDir === '.' || $requestedDir === '') ? $requestedBase : $requestedDir . '/' . $requestedBase;

$srcRel = null;
foreach (DROP_EXTS as $ext) {
    foreach ([$ext, strtoupper($ext)] as $cased) {
        $candidate = drops_clean_rel($stem . '.' . $cased);
        if ($candidate !== null && is_file(drops_dir() . '/' . $candidate)) {
            $srcRel = $candidate;
            break 2;
        }
    }
}

if ($srcRel === null) {
    http_response_code(404);
    exit('Not found');
}

$srcAbs = drops_dir() . '/' . $srcRel;
$outExt = drops_out_ext();
$cacheAbs = drops_cache_path($variant, $srcRel, $outExt);

// ── Serve ──────────────────────────────────────────────────────────────────
function drops_serve(string $path, string $mime): void
{
    $len = filesize($path);
    $mtime = filemtime($path);
    $etag = '"' . md5($path . '|' . $mtime . '|' . $len) . '"';

    header('Content-Type: ' . $mime);
    header('Cache-Control: public, max-age=2592000');
    header('ETag: ' . $etag);
    header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');

    if (trim($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
        http_response_code(304);
        exit;
    }

    header('Content-Length: ' . $len);
    readfile($path);
    exit;
}

function drops_mime_for(string $path): string
{
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    switch ($ext) {
        case 'webp': return 'image/webp';
        case 'png':  return 'image/png';
        default:     return 'image/jpeg';
    }
}

// Already built and still current → straight to disk.
if (drops_cache_is_fresh($cacheAbs, $srcAbs)) {
    drops_serve($cacheAbs, drops_mime_for($cacheAbs));
}

// ── Generate ───────────────────────────────────────────────────────────────
$max = DROP_VARIANTS[$variant]['max'];
$quality = DROP_VARIANTS[$variant]['q'];

@ini_set('memory_limit', '512M');
@set_time_limit(120);

if (!@mkdir(dirname($cacheAbs), 0755, true) && !is_dir(dirname($cacheAbs))) {
    // Can't write the cache — send the original so the page still shows it.
    drops_serve($srcAbs, drops_mime_for($srcAbs));
}

// Atomic publish: build to a temp name in the same directory, then rename, so
// two visitors racing on a brand-new image can never see a half-written file.
$tmp = $cacheAbs . '.' . uniqid('', true) . '.tmp';

function drops_make_imagick(string $srcAbs, string $tmp, int $max, int $quality, string $outExt): bool
{
    try {
        $im = new Imagick();
        // Decode straight to (roughly) the target size where the format allows
        // it — the difference between 96 MB and 6 MB of peak memory on a big
        // JPEG, which is what keeps this working on shared hosting.
        $im->setOption('jpeg:size', $max . 'x' . $max);
        $im->readImage($srcAbs);
        $im->setImageOrientation($im->getImageOrientation() ?: Imagick::ORIENTATION_TOPLEFT);
        if (method_exists($im, 'autoOrient')) {
            $im->autoOrient();
        }
        $w = $im->getImageWidth();
        $h = $im->getImageHeight();
        if ($w > $max || $h > $max) {
            // bestfit, no enlargement — matches the local sharp pipeline.
            $im->resizeImage($max, $max, Imagick::FILTER_LANCZOS, 1, true);
        }
        $im->stripImage();
        $im->setImageFormat($outExt === 'webp' ? 'webp' : 'jpeg');
        $im->setImageCompressionQuality($quality);
        $ok = $im->writeImage($tmp);
        $im->clear();
        $im->destroy();
        return (bool) $ok;
    } catch (Throwable $e) {
        return false;
    }
}

function drops_make_gd(string $srcAbs, string $tmp, int $max, int $quality, string $outExt): bool
{
    $info = @getimagesize($srcAbs);
    if (!$info) return false;
    [$w, $h] = $info;

    // GD holds the whole decoded image in memory at 4 bytes/pixel, twice over
    // (source + destination). Bail out before triggering a fatal OOM.
    $limit = drops_memory_limit_bytes();
    if ($limit > 0) {
        $needed = ($w * $h * 4) + ($max * $max * 4) + (16 * 1024 * 1024);
        if ($needed > $limit - memory_get_usage(true)) return false;
    }

    switch ($info[2]) {
        case IMAGETYPE_JPEG: $src = @imagecreatefromjpeg($srcAbs); break;
        case IMAGETYPE_PNG:  $src = @imagecreatefrompng($srcAbs);  break;
        case IMAGETYPE_WEBP: $src = function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($srcAbs) : false; break;
        default: $src = false;
    }
    if (!$src) return false;

    // Honour EXIF orientation on JPEGs (phone photos are routinely rotated).
    if ($info[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
        $exif = @exif_read_data($srcAbs);
        $orient = (int) ($exif['Orientation'] ?? 1);
        $angle = [3 => 180, 6 => -90, 8 => 90][$orient] ?? 0;
        if ($angle !== 0) {
            $rotated = @imagerotate($src, $angle, 0);
            if ($rotated) {
                imagedestroy($src);
                $src = $rotated;
                $w = imagesx($src);
                $h = imagesy($src);
            }
        }
    }

    $scale = min(1, $max / max($w, $h)); // never enlarge
    $tw = max(1, (int) round($w * $scale));
    $th = max(1, (int) round($h * $scale));

    $dst = imagecreatetruecolor($tw, $th);
    // Flatten transparency onto white rather than onto black.
    $white = imagecolorallocate($dst, 255, 255, 255);
    imagefilledrectangle($dst, 0, 0, $tw, $th, $white);
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $tw, $th, $w, $h);
    imagedestroy($src);

    $ok = ($outExt === 'webp' && function_exists('imagewebp'))
        ? imagewebp($dst, $tmp, $quality)
        : imagejpeg($dst, $tmp, $quality);
    imagedestroy($dst);
    return (bool) $ok;
}

function drops_memory_limit_bytes(): int
{
    $raw = trim((string) ini_get('memory_limit'));
    if ($raw === '' || $raw === '-1') return 0; // unlimited
    $unit = strtolower(substr($raw, -1));
    $val = (int) $raw;
    switch ($unit) {
        case 'g': return $val * 1024 * 1024 * 1024;
        case 'm': return $val * 1024 * 1024;
        case 'k': return $val * 1024;
        default:  return $val;
    }
}

$built = drops_have_imagick()
    ? drops_make_imagick($srcAbs, $tmp, $max, $quality, $outExt)
    : false;

if (!$built && function_exists('imagecreatetruecolor')) {
    $built = drops_make_gd($srcAbs, $tmp, $max, $quality, $outExt);
}

if ($built && is_file($tmp) && filesize($tmp) > 0) {
    @rename($tmp, $cacheAbs);
    @chmod($cacheAbs, 0644);
    drops_serve(is_file($cacheAbs) ? $cacheAbs : $tmp, drops_mime_for($cacheAbs));
}

@unlink($tmp);
// Nothing could resize it — serve the original rather than showing a broken tile.
drops_serve($srcAbs, drops_mime_for($srcAbs));
