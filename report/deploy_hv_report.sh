#!/usr/bin/env bash
set -euo pipefail

# One-command deploy for low-memory Linux servers.
# Supports Debian/Ubuntu with systemd.

APP_DIR="/opt/hv-report"
BIN_DIR="$APP_DIR/bin"
WEB_DIR="$APP_DIR/web"
DATA_DIR="$APP_DIR/data"
SRC_DIR="$APP_DIR/src"
SERVICE_FILE="/etc/systemd/system/hv-report.service"
NGINX_CONF="/etc/nginx/sites-available/hv-report"
NGINX_LINK="/etc/nginx/sites-enabled/hv-report"

HOST="0.0.0.0"
PORT="8080"
DB_PATH="$DATA_DIR/hv_report.db"
API_KEY="hvtb_report_signing_key_v1_2026_03_04"
SIG_WINDOW_SEC="300"
ADMIN_TOKEN=""
SERVER_IP="192.3.253.227"

if [[ "${1:-}" == "--with-token" ]]; then
  ADMIN_TOKEN="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24 || true)"
fi

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "Please run as root: sudo bash deploy_hv_report.sh"
    exit 1
  fi
}

install_deps() {
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends golang-go nginx ca-certificates
}

create_layout() {
  mkdir -p "$BIN_DIR" "$WEB_DIR" "$DATA_DIR" "$SRC_DIR"
}

copy_files() {
  cp -f "./go.mod" "$SRC_DIR/go.mod"
  if [[ -f "./go.sum" ]]; then
    cp -f "./go.sum" "$SRC_DIR/go.sum"
  fi
  mkdir -p "$SRC_DIR/cmd/server"
  cp -f "./cmd/server/main.go" "$SRC_DIR/cmd/server/main.go"
  cp -f "./web/index.html" "$WEB_DIR/index.html"
}

build_server() {
  (
    cd "$SRC_DIR" && \
    GOFLAGS='-mod=mod' /usr/bin/go mod tidy && \
    GOFLAGS='-mod=mod' /usr/bin/go mod download && \
    GOFLAGS='-mod=mod' /usr/bin/go build -ldflags="-s -w" -o "$BIN_DIR/hv-report" ./cmd/server
  )
  chmod 755 "$BIN_DIR/hv-report"
}

write_env() {
  cat > "$APP_DIR/.env" <<EOF
HV_REPORT_HOST=$HOST
HV_REPORT_PORT=$PORT
HV_REPORT_DB=$DB_PATH
HV_REPORT_API_KEY=$API_KEY
HV_REPORT_SIG_WINDOW_SEC=$SIG_WINDOW_SEC
HV_REPORT_ADMIN_TOKEN=$ADMIN_TOKEN
EOF
  chmod 600 "$APP_DIR/.env"
}

write_service() {
  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=HV Report API Service
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=$BIN_DIR/hv-report
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=$APP_DIR

[Install]
WantedBy=multi-user.target
EOF
}

write_nginx() {
  rm -f /etc/nginx/sites-enabled/default || true
  cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name _;

    location /api/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 1m;
    }

    location / {
        root $APP_DIR;
        try_files \$uri \$uri/ /web/index.html;
    }
}
EOF
  ln -sf "$NGINX_CONF" "$NGINX_LINK"
  nginx -t
}

restart_services() {
  systemctl daemon-reload
  systemctl enable hv-report.service
  systemctl restart hv-report.service
  systemctl enable nginx
  systemctl restart nginx
}

show_result() {
  echo
  echo "Deploy complete."
  echo "Service status:"
  systemctl --no-pager --full status hv-report.service | sed -n '1,12p'
  echo
  echo "API endpoint:   http://$SERVER_IP/api/v1/report/daily"
  echo "Admin page:     http://$SERVER_IP/"
  if [[ -n "$ADMIN_TOKEN" ]]; then
    echo "Admin token:    $ADMIN_TOKEN"
  else
    echo "Admin token:    (empty, admin API open)"
  fi
  echo
  echo "HVTB.js should use:"
  echo "REPORT_ENDPOINT = \"http://$SERVER_IP/api/v1/report/daily\""
  echo "REPORT_API_KEY  = \"$API_KEY\""
}

main() {
  require_root
  if [[ ! -f "./go.mod" || ! -f "./cmd/server/main.go" || ! -f "./web/index.html" ]]; then
    echo "Run this script in project directory containing go.mod, cmd/server/main.go and web/index.html"
    exit 1
  fi
  install_deps
  create_layout
  copy_files
  build_server
  write_env
  write_service
  write_nginx
  restart_services
  show_result
}

main "$@"
