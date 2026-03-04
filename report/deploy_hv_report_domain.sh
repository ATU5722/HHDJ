#!/usr/bin/env bash
set -euo pipefail

# Deploy hv-report with HTTPS domain reverse proxy.
# Domain fixed for this project: report.6950695.xyz

APP_DIR="/opt/hv-report"
BIN_DIR="$APP_DIR/bin"
WEB_DIR="$APP_DIR/web"
DATA_DIR="$APP_DIR/data"
SRC_DIR="$APP_DIR/src"
SERVICE_FILE="/etc/systemd/system/hv-report.service"
NGINX_SITE="/etc/nginx/sites-available/hv-report-domain"
NGINX_LINK="/etc/nginx/sites-enabled/hv-report-domain"

DOMAIN="report.6950695.xyz"
LOCAL_PORT="18080"
PUBLIC_API="https://$DOMAIN/api/v1/report/daily"

API_KEY="hvtb_report_signing_key_v1_2026_03_04"
SIG_WINDOW_SEC="300"
ADMIN_TOKEN=""

GO_VERSION="1.22.12"
GO_TGZ="go${GO_VERSION}.linux-amd64.tar.gz"
GO_URL="https://go.dev/dl/${GO_TGZ}"
GO_BIN="/usr/local/go/bin/go"

if [[ "${1:-}" == "--with-token" ]]; then
  ADMIN_TOKEN="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24 || true)"
fi

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "Please run as root: sudo bash deploy_hv_report_domain.sh"
    exit 1
  fi
}

install_deps() {
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends wget tar ca-certificates curl gnupg nginx certbot python3-certbot-nginx
}

go_version_value() {
  local v="$1"
  local a b c
  IFS='.' read -r a b c <<< "$v"
  a="${a:-0}"; b="${b:-0}"; c="${c:-0}"
  printf "%03d%03d%03d" "$a" "$b" "$c"
}

ensure_go() {
  local current=""
  if [[ -x "$GO_BIN" ]]; then
    current="$($GO_BIN version | awk '{print $3}' | sed 's/^go//')"
  elif command -v go >/dev/null 2>&1; then
    current="$(go version | awk '{print $3}' | sed 's/^go//')"
  fi

  local need_install=1
  if [[ -n "$current" ]] && [[ "$(go_version_value "$current")" -ge "$(go_version_value "$GO_VERSION")" ]]; then
    need_install=0
  fi

  if [[ "$need_install" -eq 1 ]]; then
    echo "Installing Go ${GO_VERSION} ..."
    cd /tmp
    rm -f "$GO_TGZ"
    wget -q "$GO_URL" -O "$GO_TGZ"
    rm -rf /usr/local/go
    tar -C /usr/local -xzf "$GO_TGZ"
    cat > /etc/profile.d/go.sh <<'EOF'
export PATH=/usr/local/go/bin:$PATH
EOF
    chmod 644 /etc/profile.d/go.sh
  fi

  "$GO_BIN" version
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
    GOFLAGS='-mod=mod' "$GO_BIN" mod tidy && \
    GOFLAGS='-mod=mod' "$GO_BIN" mod download && \
    GOFLAGS='-mod=mod' "$GO_BIN" build -ldflags="-s -w" -o "$BIN_DIR/hv-report" ./cmd/server
  )
  chmod 755 "$BIN_DIR/hv-report"
}

write_env() {
  cat > "$APP_DIR/.env" <<EOF
HV_REPORT_HOST=127.0.0.1
HV_REPORT_PORT=$LOCAL_PORT
HV_REPORT_DB=$DATA_DIR/hv_report.db
HV_REPORT_API_KEY=$API_KEY
HV_REPORT_SIG_WINDOW_SEC=$SIG_WINDOW_SEC
HV_REPORT_ADMIN_TOKEN=$ADMIN_TOKEN
HV_REPORT_WEB_ROOT=$WEB_DIR
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

write_nginx_site() {
  cat > "$NGINX_SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$LOCAL_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
  ln -sf "$NGINX_SITE" "$NGINX_LINK"
  nginx -t
}

enable_https() {
  certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email -d "$DOMAIN" --redirect || true
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
  echo "Domain: $DOMAIN"
  echo "Public API: $PUBLIC_API"
  echo "Public UI: https://$DOMAIN/"
  echo "Local service: http://127.0.0.1:$LOCAL_PORT"
  if [[ -n "$ADMIN_TOKEN" ]]; then
    echo "Admin token: $ADMIN_TOKEN"
  else
    echo "Admin token: (empty)"
  fi
  echo
  echo "HVTB.js endpoint should be:"
  echo "REPORT_ENDPOINT = \"$PUBLIC_API\""
}

main() {
  require_root
  if [[ ! -f "./go.mod" || ! -f "./cmd/server/main.go" || ! -f "./web/index.html" ]]; then
    echo "Run this script in directory containing go.mod, cmd/server/main.go, web/index.html"
    exit 1
  fi
  install_deps
  ensure_go
  create_layout
  copy_files
  build_server
  write_env
  write_service
  write_nginx_site
  restart_services
  enable_https
  systemctl restart nginx
  show_result
}

main "$@"
