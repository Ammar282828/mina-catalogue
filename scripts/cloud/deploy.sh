#!/usr/bin/env bash
# catalogue.houseofmina.store goes live from Google Cloud Build (since 2026-11-23, when GitHub stopped giving the account's
# Actions a runner at all; owner: "move it to cloud build"). The same job as .github/workflows/cloud-deploy.yml + deploy.yml:
#
#   a push to claude/**  → main brought in, the catalogue built (photos from the cache, the rest from their sources), checked,
#                          the result put on main, then rsynced to Hostinger over SSH
#   a push to main       → built and rsynced, unless the branch build that put it there already deployed it
#
# The trigger (scripts/cloud/cloudbuild-trigger.json, made by scripts/cloud/cloudbuild-setup.sh) runs this file as main has
# it. Nothing is force-pushed; rsync never deletes; catalog-drop/ and the counter's re-made photographs are never touched.
#
#   WORKDIR       a clone of this repo, the pushed commit fetched;  COMMIT / BRANCH / BUILD from Cloud Build
#   PHOTOS        the photo cache (public/catalog-thumb, public/catalog-full), synced with the bucket around this step
#   DEPLOY_TOKEN  github-deploy-token: pushes main and sets the commit's "deploy (Cloud Build)" status; never printed
#   DRY_RUN=1     build and check only: no push, no upload, no status
#   SSH_KEY       hostinger-deploy-key: the deploy key whose public half is in hPanel → SSH Access; never printed
set -euo pipefail

REPO=Ammar282828/mina-catalogue
SITE=https://catalogue.houseofmina.store
SITE_DIR=domains/catalogue.houseofmina.store/public_html
SSH_HOST=145.79.26.82 SSH_PORT=65002 SSH_USER=u870899616
PHOTOS=${PHOTOS:-/workspace/photos}
LOG_URL="https://console.cloud.google.com/cloud-build/builds;region=us-central1/${BUILD:-}?project=gemstrack-pos"
FAIL="failed before the build"

status() { # sha state description
  [ -n "${DEPLOY_TOKEN:-}" ] && [ "${DRY_RUN:-0}" != 1 ] || return 0
  curl -fsS -o /dev/null -X POST "https://api.github.com/repos/$REPO/statuses/$1" \
    -H "Authorization: Bearer $DEPLOY_TOKEN" -H "Accept: application/vnd.github+json" \
    -d "{\"state\":\"$2\",\"context\":\"deploy (Cloud Build)\",\"description\":\"${3:0:130}\",\"target_url\":\"$LOG_URL\"}" || true
}
trap 'rc=$?; if [ $rc -ne 0 ]; then echo "ERROR: $FAIL"; status "$COMMIT" failure "$FAIL"; [ -n "${HEAD_SHA:-}" ] && status "$HEAD_SHA" failure "$FAIL"; fi' EXIT

cd "$WORKDIR"
git config credential.helper '!f() { echo username=x-access-token; echo "password=$DEPLOY_TOKEN"; }; f'
git config user.name "cloud-deploy"
git config user.email "cloud-deploy@gemstrack-pos.iam.gserviceaccount.com"
git checkout -q --detach "$COMMIT"

if [ "$BRANCH" = main ]; then
  # A branch build that put this commit on main has already shipped it (its status is on this commit).
  if curl -fsS -H "Authorization: Bearer ${DEPLOY_TOKEN:-}" "https://api.github.com/repos/$REPO/commits/$COMMIT/statuses" \
      | grep -q '"context": *"deploy (Cloud Build)"'; then
    echo "$COMMIT was deployed by the branch build that put it on main; nothing to do."; trap - EXIT; exit 0
  fi
else
  FAIL="could not fetch main"; git fetch --quiet origin main
  if ! git merge-base --is-ancestor origin/main HEAD; then
    git merge -q --no-edit -m "Merge main into $BRANCH" origin/main \
      || { git merge --abort || true; FAIL="main does not merge cleanly into $BRANCH: rebase the branch on main and push again"; exit 1; }
  fi
fi
HEAD_SHA=$(git rev-parse HEAD)
status "$COMMIT" pending "Building $(git rev-parse --short HEAD)"
echo "Deploying $BRANCH at $(git rev-parse --short HEAD)"

FAIL="could not install rsync"; command -v rsync >/dev/null || (apt-get update -qq && apt-get install -y -qq rsync >/dev/null) 2>&1 | tail -2
FAIL="npm ci failed"; npm ci --no-audit --no-fund --loglevel=error

# The photographs: the cache first, then whatever is missing from Shopify's CDN and catalog-src/ (npm run images).
mkdir -p public/catalog-thumb public/catalog-full "$PHOTOS/catalog-thumb" "$PHOTOS/catalog-full"
rsync -a "$PHOTOS/catalog-thumb/" public/catalog-thumb/; rsync -a "$PHOTOS/catalog-full/" public/catalog-full/
echo "$(find public/catalog-full -name '*.webp' | wc -l) photographs from the cache"
FAIL="npm run images failed"; npm run images
rsync -a public/catalog-thumb/ "$PHOTOS/catalog-thumb/"; rsync -a public/catalog-full/ "$PHOTOS/catalog-full/"
FAIL="the build failed"; npm run build
FAIL="the build's sanity check failed (scripts/check-build.mjs)"; node scripts/check-build.mjs

if [ "${DRY_RUN:-0}" = 1 ]; then echo "Dry run: $(git rev-parse --short HEAD) built and checked; nothing pushed or uploaded."; trap - EXIT; exit 0; fi

# Put the build's commit on main before it ships, as cloud-deploy.yml did; a race merges what landed and tries again.
if [ "$BRANCH" != main ]; then
  status "$HEAD_SHA" pending "Deploying (pushed by the build of $BRANCH)"
  for attempt in 1 2 3 4; do
    FAIL="the push to main was refused"
    git push --quiet origin HEAD:refs/heads/main && break
    [ "$attempt" = 4 ] && exit 1
    sleep $((attempt * 5)); git fetch --quiet origin main
    git merge -q --no-edit -m "Merge main into $BRANCH" origin/main \
      || { git merge --abort || true; FAIL="main moved and no longer merges into $BRANCH: rebase and push again"; exit 1; }
    FAIL="the rebuild after main moved failed"; npm run build && node scripts/check-build.mjs
    HEAD_SHA=$(git rev-parse HEAD); status "$HEAD_SHA" pending "Deploying (pushed by the build of $BRANCH)"
  done
fi

FAIL="could not connect to Hostinger"
mkdir -p ~/.ssh && chmod 700 ~/.ssh
printf '%s\n' "$SSH_KEY" > ~/.ssh/deploy && chmod 600 ~/.ssh/deploy
for i in 1 2 3 4 5; do  # the shared host drops connections when it is busy
  ssh-keyscan -p "$SSH_PORT" -H "$SSH_HOST" >> ~/.ssh/known_hosts 2>/dev/null && break
  echo "keyscan attempt $i failed; waiting"; sleep 15
done
grep -q . ~/.ssh/known_hosts
printf 'Host site\n  HostName %s\n  Port %s\n  User %s\n  IdentityFile ~/.ssh/deploy\n  IdentitiesOnly yes\n  ServerAliveInterval 30\n' \
  "$SSH_HOST" "$SSH_PORT" "$SSH_USER" > ~/.ssh/config

FAIL="the target folder is not the catalogue: nothing written"
ssh site "cd '$SITE_DIR' && test -f .mina-catalogue && echo 'ok: marker present'"

# A photograph re-made at the counter was written over its file on the server; this build's copy is the old one.
FAIL="could not read the counter's changes (catalog-overrides.json): refusing to deploy over them"
ssh site "cd '$SITE_DIR' && cat catalog-overrides.json 2>/dev/null || true" > /workspace/overrides.json
node -e '
  const fs = require("fs");
  const all = JSON.parse(fs.readFileSync("/workspace/overrides.json", "utf8").trim() || "{}");
  const keep = Object.values(all).filter((o) => o && o.photo && o.photo.edited && o.photo.image)
    .flatMap((o) => ["thumb", "full"].map((v) => `/catalog-${v}/${o.photo.image}`));
  fs.writeFileSync("/workspace/keep.txt", keep.map((k) => k + "\n").join(""));
  console.log(`${keep.length / 2} re-made photographs kept as they are`);
'

FAIL="rsync to Hostinger failed"
rsync -rlptz --no-perms --no-owner --no-group --omit-dir-times --itemize-changes \
  --exclude 'catalog-drop/' --exclude 'catalog-drop-cache/' --exclude-from /workspace/keep.txt \
  -e ssh dist/ "site:$SITE_DIR/" | grep -cE '^[<>]f' | xargs echo "files written:"
ssh site "cd '$SITE_DIR' && rm -f default.php && touch .mina-catalogue && mkdir -p catalog-drop"

FAIL="the files did not land on the server"
ssh site "cd '$SITE_DIR' \
  && test -s index.html && test -s .htaccess && test -s api/upload.php && test -s catalog-tree.json \
  && test -s rings-and-bands.html && test -d catalog-thumb && test -d catalog-full \
  && echo \"ok: pages, api, tree and \$(find catalog-full -name '*.webp' | wc -l) photographs on the server\""

node scripts/indexnow.mjs || echo "IndexNow (advisory) did not answer"
for p in / /rings-and-bands /catalog-tree.json; do
  echo "  $p → $(curl -sS -o /dev/null -w '%{http_code}' -L --max-time 30 "$SITE$p" || echo 000)"
done

msg="Live as $(git rev-parse --short HEAD)"
status "$COMMIT" success "$msg"; [ "$HEAD_SHA" != "$COMMIT" ] && status "$HEAD_SHA" success "$msg"
trap - EXIT
echo "$msg on $SITE"
