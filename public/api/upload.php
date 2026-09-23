<?php
// ---------------------------------------------------------------------------
// POST /api/upload.php — put a photograph into the drop folder.
//
// The counter's side of the drop-folder workflow. Everything else in this
// folder reads; this is the one endpoint that writes, so it is the one that
// needs a secret. The POS calls it server-to-server with a bearer token that
// never reaches a browser; a photograph lands in
//
//     public_html/catalog-drop/<Category>/<Sub-category>/<file>.jpg
//
// and the site folds it into that gallery on the next page load, exactly as
// though it had been dropped in through File Manager. No rebuild, no deploy.
//
// Request (multipart/form-data):
//   Authorization: Bearer <WEBSITE_UPLOAD_SECRET>
//   rel   = "Rings/Engagement Rings/Elara.jpg"   (Chapter/Collection/filename)
//   file  = the image
//
// Response: { ok, rel, bytes, thumb, full } or { ok:false, error }.
//
// Path safety is not re-invented here: drops_clean_rel() is the same
// sanitiser catalog.php and img.php use, and it rejects "..", absolute paths,
// wrong depths and anything outside DROP_EXTS. A name that survives it can
// only ever resolve inside catalog-drop/.
// ---------------------------------------------------------------------------

declare(strict_types=1);
require_once __DIR__ . '/_drops.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const UPLOAD_MAX_BYTES = 25 * 1024 * 1024;   // a camera JPEG, with room to spare

function upload_fail(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

// ── Who is asking ──────────────────────────────────────────────────────────
// The secret never lives in the repository. Two places are accepted, in order:
//
//   1. WEBSITE_UPLOAD_SECRET in the environment, where the host offers that.
//   2. A file named .website-upload-secret one level ABOVE public_html —
//      i.e. ~/domains/catalogue.houseofmina.store/.website-upload-secret. Outside the web root,
//      so no request can ever fetch it, and outside the deploy set, so a push
//      cannot overwrite it. On shared hosting this is the practical one:
//      create it once in File Manager, paste the secret, save.
//
// No secret means the endpoint is closed rather than open — a server that was
// never configured cannot be written to by anyone.
function upload_expected_secret(): ?string
{
    $env = getenv('WEBSITE_UPLOAD_SECRET');
    if (is_string($env) && $env !== '') return trim($env);

    foreach ([
        dirname(drops_site_root()) . '/.website-upload-secret',   // above public_html — preferred
        drops_site_root() . '/.website-upload-secret',            // inside it; see .htaccess deny
    ] as $path) {
        if (is_readable($path)) {
            $v = trim((string) @file_get_contents($path));
            if ($v !== '') return $v;
        }
    }
    return null;
}

$expected = upload_expected_secret();
if ($expected === null) {
    upload_fail(503, 'Uploads are not configured on this server: no WEBSITE_UPLOAD_SECRET and no .website-upload-secret file.');
}

$headers = function_exists('getallheaders') ? getallheaders() : [];
$auth = '';
foreach ($headers as $name => $value) {
    if (strcasecmp($name, 'Authorization') === 0) { $auth = (string) $value; break; }
}
if ($auth === '' && isset($_SERVER['HTTP_AUTHORIZATION'])) $auth = (string) $_SERVER['HTTP_AUTHORIZATION'];
if ($auth === '' && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) $auth = (string) $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];

$given = preg_match('/^Bearer\s+(.+)$/i', trim($auth), $m) ? $m[1] : '';
// Constant-time: a timing difference here would leak the secret a byte at a time.
if ($given === '' || !hash_equals($expected, $given)) {
    upload_fail(401, 'Unauthorized.');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    upload_fail(405, 'POST an image as multipart/form-data.');
}

// ── What is being uploaded ─────────────────────────────────────────────────
$rel = isset($_POST['rel']) ? (string) $_POST['rel'] : '';
$clean = drops_clean_rel($rel);
if ($clean === null) {
    upload_fail(400, 'rel must be "Category/Sub-category/name.jpg" and end in ' . implode(', ', DROP_EXTS) . '.');
}

if (!isset($_FILES['file'])) upload_fail(400, 'No file was received.');
$file = $_FILES['file'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    // The PHP-side limits are separate from ours and worth naming, because
    // "upload failed" with a 6 MB photo is otherwise a mystery.
    $why = [
        UPLOAD_ERR_INI_SIZE   => 'larger than this server\'s upload_max_filesize',
        UPLOAD_ERR_FORM_SIZE  => 'larger than the form allows',
        UPLOAD_ERR_PARTIAL    => 'only partially uploaded',
        UPLOAD_ERR_NO_FILE    => 'missing',
        UPLOAD_ERR_NO_TMP_DIR => 'rejected: the server has no temp folder',
        UPLOAD_ERR_CANT_WRITE => 'rejected: the server could not write it',
    ][$file['error']] ?? 'rejected by the server';
    upload_fail(400, 'The photograph was ' . $why . '.');
}
if (!is_uploaded_file($file['tmp_name'])) upload_fail(400, 'Not an uploaded file.');
if (($file['size'] ?? 0) > UPLOAD_MAX_BYTES) {
    upload_fail(413, 'That photograph is over ' . (UPLOAD_MAX_BYTES / 1048576) . ' MB.');
}

// It must actually be an image, whatever the name says. getimagesize() reads
// the header rather than trusting the extension or the browser's MIME type.
$info = @getimagesize($file['tmp_name']);
if ($info === false || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
    upload_fail(415, 'That file is not a JPEG, PNG or WebP image.');
}

// ── Write it ───────────────────────────────────────────────────────────────
$dest = drops_dir() . '/' . $clean;
$dir  = dirname($dest);
if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
    upload_fail(500, 'Could not create the collection folder.');
}
if (!is_writable($dir)) upload_fail(500, 'The collection folder is not writable.');

// Never silently replace a piece that is already on the site: a second photo
// with the same name becomes "Elara-2.jpg" rather than overwriting.
if (file_exists($dest)) {
    $ext  = pathinfo($dest, PATHINFO_EXTENSION);
    $stem = substr($dest, 0, -(strlen($ext) + 1));
    for ($n = 2; $n < 500 && file_exists($dest); $n++) $dest = $stem . '-' . $n . '.' . $ext;
    if (file_exists($dest)) upload_fail(409, 'Too many photographs with that name.');
    $clean = substr($dest, strlen(drops_dir()) + 1);
}

if (!@move_uploaded_file($file['tmp_name'], $dest)) {
    upload_fail(500, 'Could not save the photograph.');
}
@chmod($dest, 0644);

echo json_encode([
    'ok'    => true,
    'rel'   => $clean,
    'bytes' => filesize($dest) ?: 0,
    'thumb' => drops_img_url('thumb', $clean),
    'full'  => drops_img_url('full', $clean),
]);
