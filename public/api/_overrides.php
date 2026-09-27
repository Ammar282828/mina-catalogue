<?php
// ---------------------------------------------------------------------------
// The counter's changes to pieces already on the site ("overrides").
//
// The catalogue is baked at build time; a photo re-cropped at the counter, a
// weight stamped on, a name or description corrected, has to show without a
// build. The POS (Website → Edit a piece) sends the change to api/override.php,
// which keeps the words here:
//
//   public_html/catalog-overrides.json   { "<key>": { name?, about?, facts?, stone?, metal?,
//                                           karat?, cut?, style?, weightGrams?, weightOnPhoto?, hidden?,
//                                           photo?: { image, v, edited, w, h }, at } }
//
// and a new photograph IN PLACE of the old one: a photograph's address is the
// piece's identity everywhere (favourites, bags, prices, recommendations, its
// page), so the re-made image is written over catalog-thumb/<image> and
// catalog-full/<image> in the site's own two sizes (the same settings as the
// drop folder and the local pipeline), the original kept once under
// catalog-edit/originals/ for going back, and `photo.v` put on its URL (?v=) so no
// browser or CDN keeps the old picture. Going back restores the original under a
// new `v` for the same reason.
//
// api/catalog.php hands the list to the app with the drops, at load; the
// prerender reads catalog-overrides.json from the live site, so the static pages
// catch up at the next deploy. The key is the site's own: a photograph's path on
// taheri.shop ("Rings & Bands/Rings/Ring 12.webp"), mina/piece/<handle> on the
// catalogue; `photo.image` is the photograph's path under catalog-full/.
// ---------------------------------------------------------------------------

declare(strict_types=1);
require_once __DIR__ . '/_drops.php';

const OVERRIDES_FILE = 'catalog-overrides.json';
const OVERRIDES_DIR  = 'catalog-edit';

// What a change may touch, and what kind of value each is.
const OVERRIDE_TEXT  = ['name' => 160, 'about' => 4000, 'stone' => 80, 'metal' => 80, 'karat' => 8, 'cut' => 80, 'style' => 80];
const OVERRIDE_BOOLS = ['weightOnPhoto', 'hidden'];

function overrides_path(): string { return drops_site_root() . '/' . OVERRIDES_FILE; }
function overrides_dir(): string  { return drops_site_root() . '/' . OVERRIDES_DIR; }

/** The whole list; an empty object when there is none yet or it cannot be read. */
function overrides_read(): array
{
    $raw = @file_get_contents(overrides_path());
    if ($raw === false || $raw === '') return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** A key the site could have: two or three path segments, or mina/piece/<handle>; nothing that climbs. */
function overrides_clean_key(string $key): ?string
{
    $key = trim(str_replace('\\', '/', $key));
    if ($key === '' || strlen($key) > 400 || strpos($key, "\0") !== false) return null;
    $parts = explode('/', $key);
    if (count($parts) < 2 || count($parts) > 3) return null;
    foreach ($parts as $p) if ($p === '' || $p === '.' || $p === '..') return null;
    return $key;
}

/** A photograph's path under catalog-full/ ("Rings & Bands/Rings/Ring 12.webp"), or null. */
function overrides_clean_image(string $image): ?string
{
    $image = ltrim(str_replace('\\', '/', trim($image)), '/');
    if ($image === '' || strlen($image) > 400 || strpos($image, "\0") !== false || !preg_match('/\.webp$/i', $image)) return null;
    foreach (explode('/', $image) as $p) if ($p === '' || $p === '.' || $p === '..') return null;
    return $image;
}

function overrides_variant_path(string $variant, string $image): string
{
    return drops_site_root() . '/catalog-' . $variant . '/' . $image;
}

/** Make one of the site's sizes from `$src` straight onto `$dest` (atomically), as the drop folder does. */
function overrides_make_variant(string $src, string $dest, int $max, int $quality): void
{
    if (!class_exists('Imagick')) throw new RuntimeException('This server cannot make WebP images (no Imagick).');
    $tmp = $dest . '.' . uniqid('', true) . '.tmp';
    $im = new Imagick();
    $im->setOption('jpeg:size', $max . 'x' . $max);
    $im->readImage($src);
    if (method_exists($im, 'autoOrient')) $im->autoOrient();
    if ($im->getImageWidth() > $max || $im->getImageHeight() > $max) $im->resizeImage($max, $max, Imagick::FILTER_LANCZOS, 1, true);
    $im->stripImage();
    $im->setImageFormat('webp');
    $im->setImageCompressionQuality($quality);
    $ok = $im->writeImage($tmp);
    $im->clear();
    $im->destroy();
    if (!$ok || !@rename($tmp, $dest)) { @unlink($tmp); throw new RuntimeException('Could not write the new photograph.'); }
    @chmod($dest, 0644);
}

/** Put `$src` in place of the photograph at `$image`, keeping the original once. */
function overrides_replace_photo(string $image, string $src): void
{
    foreach (array_keys(DROP_VARIANTS) as $variant) {
        $live = overrides_variant_path($variant, $image);
        if (!is_file($live)) throw new InvalidArgumentException("There is no photograph at catalog-$variant/$image to replace.");
        $keep = overrides_dir() . "/originals/$variant/$image";
        if (!is_file($keep)) {
            if (!is_dir(dirname($keep)) && !@mkdir(dirname($keep), 0755, true)) throw new RuntimeException('Could not keep the original photograph.');
            if (!@copy($live, $keep)) throw new RuntimeException('Could not keep the original photograph.');
        }
    }
    foreach (DROP_VARIANTS as $variant => $spec) overrides_make_variant($src, overrides_variant_path($variant, $image), $spec['max'], $spec['q']);
}

/** Put the kept original back. False when there is none to restore. */
function overrides_restore_photo(string $image): bool
{
    $restored = false;
    foreach (array_keys(DROP_VARIANTS) as $variant) {
        $keep = overrides_dir() . "/originals/$variant/$image";
        if (!is_file($keep)) continue;
        $live = overrides_variant_path($variant, $image);
        $tmp = $live . '.' . uniqid('', true) . '.tmp';
        if (@copy($keep, $tmp) && @rename($tmp, $live)) { @chmod($live, 0644); $restored = true; } else @unlink($tmp);
    }
    return $restored;
}

/** A new photo version: "20260927085620a1b2". */
function overrides_stamp(): string { return gmdate('YmdHis') . substr(bin2hex(random_bytes(3)), 0, 4); }

/** The size of the photograph now at catalog-full/<image>: [w, h], or null. */
function overrides_full_size(string $image): ?array
{
    $info = @getimagesize(overrides_variant_path('full', $image));
    return $info ? [(int) $info[0], (int) $info[1]] : null;
}

/**
 * Apply `$fields` (already decoded) to one key under a lock, and write the file.
 * A field sent as null is removed. `$photo` is null (photo untouched), an array
 * { image, edited } after a replacement or a restore (its size is read from the
 * file: a photograph re-made in another shape tells the catalogue so). Returns
 * the key's entry, or null when nothing is left of it.
 */
function overrides_update(string $key, array $fields, ?array $photo = null, bool $revertAll = false): ?array
{
    $fh = @fopen(overrides_path(), 'c+');
    if ($fh === false) throw new RuntimeException('Could not open the overrides file.');
    try {
        flock($fh, LOCK_EX);
        $raw = stream_get_contents($fh);
        $all = $raw ? (json_decode($raw, true) ?: []) : [];
        $old = $all[$key] ?? [];
        $entry = $revertAll ? [] : $old;

        foreach ($fields as $name => $value) {
            if ($value === null) { unset($entry[$name]); continue; }
            if (isset(OVERRIDE_TEXT[$name])) {
                $entry[$name] = mb_substr(trim((string) $value), 0, OVERRIDE_TEXT[$name]);
            } elseif ($name === 'facts' && is_array($value)) {
                $entry['facts'] = array_values(array_slice(array_filter(array_map(fn($f) => mb_substr(trim((string) $f), 0, 200), $value), 'strlen'), 0, 12));
            } elseif ($name === 'weightGrams') {
                $w = (float) $value;
                if ($w > 0 && $w < 5000) $entry['weightGrams'] = round($w, 3); else unset($entry['weightGrams']);
            } elseif (in_array($name, OVERRIDE_BOOLS, true)) {
                if ($value) $entry[$name] = true; else unset($entry[$name]);
            }
        }

        // The photograph: a new version whenever its file changed, edited or put back —
        // a version stays even once put back, so nobody is left with the edited copy cached.
        if (is_array($photo)) {
            $entry['photo'] = ['image' => $photo['image'], 'v' => overrides_stamp(), 'edited' => (bool) $photo['edited']];
            $size = overrides_full_size($photo['image']);
            if ($size) [$entry['photo']['w'], $entry['photo']['h']] = $size;
        }
        elseif ($revertAll && !empty($old['photo'])) $entry['photo'] = $old['photo'];

        $content = array_diff_key($entry, ['at' => 1, 'by' => 1]);
        if ($content) { $entry['at'] = gmdate('c'); $all[$key] = $entry; } else { unset($all[$key]); $entry = null; }

        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($all, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        fflush($fh);
        flock($fh, LOCK_UN);
        return $entry;
    } finally {
        fclose($fh);
    }
}
