#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/root/huffpuff"
SERVICE_NAME="huffpuff"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
NODE_BIN="$(which node)"

echo "==> Installing dependencies..."
cd "$APP_DIR"
npm install --production

echo "==> Creating systemd service..."
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Huffpuff Workspace (Express + ttyd)
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
ExecStart=${NODE_BIN} server.js
Restart=on-failure
RestartSec=3
Environment=NODE_ENV=production
EnvironmentFile=-${APP_DIR}/.env

[Install]
WantedBy=multi-user.target
EOF

echo "==> Reloading systemd and (re)starting service..."
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo "==> Service status:"
systemctl status "$SERVICE_NAME" --no-pager

echo ""
echo "Done! Huffpuff is running as a systemd service."
echo "  Logs:    journalctl -u ${SERVICE_NAME} -f"
echo "  Restart: systemctl restart ${SERVICE_NAME}"
echo "  Stop:    systemctl stop ${SERVICE_NAME}"
