#!/usr/bin/env bash
# One-time setup of automatic deploys on the server. Run from the checkout:
#   cd ~/apps/nexora && git pull && sudo bash scripts/deploy/install-autodeploy.sh
# Afterwards every push to main is live within a few minutes (the build itself
# takes most of that). Logs: journalctl -u nexora-autodeploy -f
# Pause:  sudo systemctl stop nexora-autodeploy.timer
# Remove: sudo systemctl disable --now nexora-autodeploy.timer
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo." >&2
  exit 1
fi
APP_DIR=$(cd "$(dirname "$0")/../.." && pwd)
[ -f "$APP_DIR/compose.yaml" ] || { echo "compose.yaml not found in $APP_DIR" >&2; exit 1; }
[ -f "$APP_DIR/.env" ] || { echo ".env not found in $APP_DIR" >&2; exit 1; }

install -m 0755 "$APP_DIR/scripts/deploy/autodeploy.sh" /usr/local/bin/nexora-autodeploy

cat > /etc/systemd/system/nexora-autodeploy.service <<UNIT
[Unit]
Description=NEXORA: deploy origin/main when it changes
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
Environment=NEXORA_DIR=$APP_DIR
ExecStart=/usr/local/bin/nexora-autodeploy
TimeoutStartSec=1800
UNIT

cat > /etc/systemd/system/nexora-autodeploy.timer <<UNIT
[Unit]
Description=NEXORA: check for new commits every 2 minutes

[Timer]
OnBootSec=2min
OnUnitInactiveSec=2min
Persistent=true

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now nexora-autodeploy.timer
systemctl start --no-block nexora-autodeploy.service
echo "Auto-deploy enabled for $APP_DIR."
echo "First check started in the background (a rebuild takes a few minutes)."
echo "Follow it with: journalctl -u nexora-autodeploy -f"
