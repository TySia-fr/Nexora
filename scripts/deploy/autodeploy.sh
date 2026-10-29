#!/usr/bin/env bash
# Pull-based continuous deployment for NEXORA.
#
# Runs every two minutes from a systemd timer (see install-autodeploy.sh). When
# origin/main has moved, it fast-forwards the checkout, rebuilds and restarts the
# compose stack (the one-shot `migrate` service applies migrations first), then
# checks /api/health. Nothing is pushed to the server: it only ever pulls from the
# public repository, so no deploy keys or GitHub secrets are needed.
#
# Safety:
# - flock: a slow build is never started twice
# - --ff-only: if someone edited files on the server, it stops instead of merging
# - the git commands run as the checkout's owner, Docker as root
set -euo pipefail

APP_DIR="${NEXORA_DIR:?NEXORA_DIR is not set}"
LOCK=/run/nexora-autodeploy.lock
log() { echo "$(date -Is) $*"; }

exec 9>"$LOCK"
if ! flock -n 9; then
  log "previous deploy still running, skipping"
  exit 0
fi

OWNER=$(stat -c %U "$APP_DIR")
as_owner() { sudo -u "$OWNER" -H git -C "$APP_DIR" "$@"; }

as_owner fetch --quiet origin main
LOCAL=$(as_owner rev-parse HEAD)
REMOTE=$(as_owner rev-parse origin/main)
if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

log "deploying ${LOCAL:0:7} -> ${REMOTE:0:7}"
if ! as_owner merge --ff-only --quiet origin/main; then
  log "ERROR: cannot fast-forward (local changes on the server?). Fix by hand: git -C $APP_DIR status"
  exit 1
fi

cd "$APP_DIR"
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null

PORT=$(grep -E '^APP_PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '"' || true)
PORT=${PORT:-3002}
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    log "deployed ${REMOTE:0:7}, health ok"
    exit 0
  fi
  sleep 2
done
log "ERROR: ${REMOTE:0:7} is up but /api/health did not answer within 60 s"
exit 1
