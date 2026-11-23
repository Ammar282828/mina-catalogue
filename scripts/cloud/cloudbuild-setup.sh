#!/usr/bin/env bash
# One-time setup: taheri.shop and catalogue.houseofmina.store deploy from Google Cloud Build instead of GitHub Actions
# (2026-11-23, owner: "move it to cloud build"). Run it ONCE on the owner's Mac, where gcloud is signed in as the owner
# and the Hostinger deploy key lives (~/.ssh/taheri_deploy):
#
#   curl -fsSL https://raw.githubusercontent.com/Ammar282828/mina-catalogue/main/scripts/cloud/cloudbuild-setup.sh | bash
#   (before this is on main: the branch's address in place of main, and REF=<that branch> before bash)
#
# Safe to run again. It makes, on gemstrack-pos (us-central1), beside the ERP's own deploy (taheri-pos scripts/cloud/):
#   - the secret hostinger-deploy-key, from ~/.ssh/taheri_deploy (never printed), readable by cloud-deploy@;
#   - the bucket gemstrack-pos-site-builds: the catalogue's photo cache between builds;
#   - Developer Connect links to taheri-site and mina-catalogue, on the ERP's GitHub App connection;
#   - the triggers deploy-taheri-site and deploy-mina-catalogue (each repo's scripts/cloud/cloudbuild-trigger.json),
#     the next push to either repo deploys it.
# It checks that github-deploy-token (the ERP's GitHub token) may push both repositories, and says what to do if not.
set -euo pipefail

P=gemstrack-pos
R=us-central1
SA=cloud-deploy@$P.iam.gserviceaccount.com
BUCKET=gemstrack-pos-site-builds
KEY=${KEY:-$HOME/.ssh/taheri_deploy}
REF=${REF:-main}
REPOS="taheri-site mina-catalogue"

say() { printf '\n%s\n' "$*"; }
api() { curl -fsS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$@"; }

[ -f "$KEY" ] || { echo "No deploy key at $KEY (the one deploy.yml's SSH_PRIVATE_KEY holds). Run this on the Mac, or KEY=/path bash …" >&2; exit 1; }
gcloud config set project "$P" >/dev/null 2>&1
TOKEN=$(gcloud auth print-access-token)

say "1/4 The Hostinger key → Secret Manager (hostinger-deploy-key)"
gcloud secrets describe hostinger-deploy-key >/dev/null 2>&1 \
  || gcloud secrets create hostinger-deploy-key --replication-policy=automatic >/dev/null
NEW=$(shasum -a 256 < "$KEY" | cut -c1-16)
OLD=$(gcloud secrets versions access latest --secret=hostinger-deploy-key 2>/dev/null | shasum -a 256 | cut -c1-16 || true)
if [ "$NEW" != "$OLD" ]; then gcloud secrets versions add hostinger-deploy-key --data-file="$KEY" >/dev/null; echo "   stored"; else echo "   already stored"; fi
gcloud secrets add-iam-policy-binding hostinger-deploy-key --member="serviceAccount:$SA" \
  --role=roles/secretmanager.secretAccessor --condition=None >/dev/null

say "2/4 The photo cache (gs://$BUCKET)"
gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1 \
  || gcloud storage buckets create "gs://$BUCKET" --location="$R" --uniform-bucket-level-access >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$SA" --role=roles/storage.objectAdmin >/dev/null
echo "   ready"

say "3/4 May github-deploy-token push both sites?"
GH=$(gcloud secrets versions access latest --secret=github-deploy-token)
MISSING=""
for r in $REPOS; do
  can=$(curl -fsS -H "Authorization: Bearer $GH" "https://api.github.com/repos/Ammar282828/$r" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("permissions",{}).get("push",False))' 2>/dev/null || echo False)
  echo "   $r: $([ "$can" = True ] && echo yes || echo NO)"; [ "$can" = True ] || MISSING="$MISSING $r"
done
unset GH
if [ -n "$MISSING" ]; then
  cat >&2 <<EOF

   The ERP's deploy token cannot push:$MISSING
   On github.com: Settings → Developer settings → Personal access tokens → Fine-grained tokens → the token the ERP's
   deploy uses (it covers taheri-pos and gemstrack-pos) → Edit → Repository access: add$MISSING →
   Permissions: Contents "Read and write", Commit statuses "Read and write" → Update. Then run this again.
EOF
  exit 1
fi

say "4/4 Links to the two repositories (Developer Connect) and their triggers"
DC=https://developerconnect.googleapis.com/v1/projects/$P/locations/$R
CB=https://cloudbuild.googleapis.com/v1/projects/$P/locations/$R/triggers
CONN=$(api "$DC/connections" | python3 -c 'import json,sys; [print(c["name"]) for c in json.load(sys.stdin).get("connections",[]) if c.get("githubConfig",{}).get("githubApp")=="DEVELOPER_CONNECT"]' | head -1)
[ -n "$CONN" ] || { echo "No Developer Connect GitHub connection in $R (the ERP's deploy uses one)." >&2; exit 1; }
for r in $REPOS; do
  LINK=$(api "https://developerconnect.googleapis.com/v1/$CONN/gitRepositoryLinks" | python3 -c "
import json,sys
for l in json.load(sys.stdin).get('gitRepositoryLinks',[]):
    if l.get('cloneUri','').lower().rstrip('/').endswith(('ammar282828/$r','ammar282828/$r.git')): print(l['name']); break")
  if [ -z "$LINK" ]; then
    if ! api -X POST "https://developerconnect.googleapis.com/v1/$CONN/gitRepositoryLinks?gitRepositoryLinkId=$r" \
        -d "{\"cloneUri\":\"https://github.com/Ammar282828/$r.git\"}" >/dev/null; then
      echo "   Could not link $r. On github.com: Settings → Applications → Installed GitHub Apps → the Developer Connect app" >&2
      echo "   → Configure → Repository access: add taheri-site and mina-catalogue → Save. Then run this again." >&2
      exit 1
    fi
    sleep 15; LINK="$CONN/gitRepositoryLinks/$r"
  fi
  BODY=$(curl -fsSL "https://raw.githubusercontent.com/Ammar282828/$r/$REF/scripts/cloud/cloudbuild-trigger.json" \
    | python3 -c "import json,sys; t=json.load(sys.stdin); t['developerConnectEventConfig']['gitRepositoryLink']='$LINK'; print(json.dumps(t))")
  NAME=deploy-$r
  ID=$(api "$CB" | python3 -c "import json,sys; [print(t['id']) for t in json.load(sys.stdin).get('triggers',[]) if t.get('name')=='$NAME']")
  if [ -n "$ID" ]; then api -X PATCH "$CB/$ID" -d "$BODY" >/dev/null; echo "   $r: linked, $NAME updated"
  else api -X POST "$CB" -d "$BODY" >/dev/null; echo "   $r: linked, $NAME made"; fi
done

say "Done. Both sites now deploy from Cloud Build on every push to main or claude/** (no GitHub Actions)."
echo "Watch: gcloud builds list --region $R --project $P --limit 4"
