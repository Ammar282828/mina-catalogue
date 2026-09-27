<?php
// ---------------------------------------------------------------------------
// /api/override.php — the counter's change to a piece already on the site.
//
//   GET                       the whole list (also served as /catalog-overrides.json)
//   POST (multipart/form-data, Authorization: Bearer <WEBSITE_UPLOAD_SECRET>)
//     key     the piece: "Rings & Bands/Rings/Ring 12.webp" (taheri.shop) or
//             "mina/piece/<handle>" (the catalogue)
//     fields  JSON object of what changed — name, about, facts[], stone, metal, cut,
//             style, weightGrams, weightOnPhoto, hidden; null removes one
//     image   the photograph's path under catalog-full/ ("…/Ring 12.webp"), with
//     file    the re-made photograph (JPEG/PNG/WebP, any size up to 3000 px): it
//             replaces that photograph in the site's two sizes; or
//     photo   "revert" (with image) to put the original photograph back
//     action  "revert" to undo every change to the piece, its photograph included
//
// Response: { ok, key, override } (override is null once nothing is left of it).
// The secret is the same one upload.php checks; see _overrides.php for storage.
// ---------------------------------------------------------------------------

declare(strict_types=1);
require_once __DIR__ . '/_overrides.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const OVERRIDE_MAX_BYTES = 25 * 1024 * 1024;

function override_fail(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    echo json_encode(['ok' => true, 'overrides' => (object) overrides_read()], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') override_fail(405, 'GET the list, or POST a change.');

// ── Who is asking: the upload secret, as upload.php reads it ───────────────
function override_expected_secret(): ?string
{
    $env = getenv('WEBSITE_UPLOAD_SECRET');
    if (is_string($env) && $env !== '') return trim($env);
    foreach ([dirname(drops_site_root()) . '/.website-upload-secret', drops_site_root() . '/.website-upload-secret'] as $path) {
        if (is_readable($path)) {
            $v = trim((string) @file_get_contents($path));
            if ($v !== '') return $v;
        }
    }
    return null;
}
$expected = override_expected_secret();
if ($expected === null) override_fail(503, 'Changes are not configured on this server: no upload secret.');
$auth = '';
foreach ((function_exists('getallheaders') ? getallheaders() : []) as $name => $value) {
    if (strcasecmp($name, 'Authorization') === 0) { $auth = (string) $value; break; }
}
if ($auth === '') $auth = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
$given = preg_match('/^Bearer\s+(.+)$/i', trim($auth), $m) ? $m[1] : '';
if ($given === '' || !hash_equals($expected, $given)) override_fail(401, 'Unauthorized.');

// ── What is changing ───────────────────────────────────────────────────────
$key = overrides_clean_key((string) ($_POST['key'] ?? ''));
if ($key === null) override_fail(400, 'key must be the piece\'s key on this site.');

$fields = [];
if (isset($_POST['fields']) && $_POST['fields'] !== '') {
    $fields = json_decode((string) $_POST['fields'], true);
    if (!is_array($fields)) override_fail(400, 'fields must be a JSON object.');
}
$revertAll = ($_POST['action'] ?? '') === 'revert';

$image = isset($_POST['image']) && $_POST['image'] !== '' ? overrides_clean_image((string) $_POST['image']) : null;
if (isset($_POST['image']) && $_POST['image'] !== '' && $image === null) override_fail(400, 'image must be the photograph\'s path under catalog-full/, ending .webp.');

$photo = null;
try {
    if (($_POST['photo'] ?? '') === 'revert' || ($revertAll && $image !== null)) {
        if ($image === null) override_fail(400, 'Say which photograph to put back (image).');
        if (overrides_restore_photo($image)) $photo = ['image' => $image, 'edited' => false];
        elseif (!$revertAll) override_fail(404, 'There is no original kept for that photograph: it was never replaced here.');
    } elseif (!empty($_FILES['file'])) {
        if ($image === null) override_fail(400, 'Say which photograph this replaces (image).');
        $file = $_FILES['file'];
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) override_fail(400, 'The photograph did not arrive.');
        if (($file['size'] ?? 0) > OVERRIDE_MAX_BYTES) override_fail(413, 'That photograph is too large.');
        $info = @getimagesize($file['tmp_name']);
        if ($info === false || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) override_fail(415, 'That file is not a JPEG, PNG or WebP image.');
        overrides_replace_photo($image, $file['tmp_name']);
        $photo = ['image' => $image, 'edited' => true];
    }
} catch (InvalidArgumentException $e) {
    override_fail(404, $e->getMessage());
} catch (Throwable $e) {
    override_fail(500, $e->getMessage());
}

try {
    $entry = overrides_update($key, $fields, $photo, $revertAll);
} catch (Throwable $e) {
    override_fail(500, $e->getMessage());
}
echo json_encode(['ok' => true, 'key' => $key, 'override' => $entry], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
