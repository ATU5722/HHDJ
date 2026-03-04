#!/usr/bin/env bash
set -euo pipefail

# Update admin token and disable web UI (API-only mode)
# Usage:
#   sudo bash harden_api_only.sh
#   sudo bash harden_api_only.sh "your_new_token"

APP_DIR="/opt/hv-report"
ENV_FILE="$APP_DIR/.env"
DISABLED_WEB_ROOT="$APP_DIR/disabled-web"
SERVICE_NAME="hv-report.service"
DOMAIN="report.6950695.xyz"
DEFAULT_ADMIN_TOKEN="82xdCD5Gw%NR"

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "Please run as root: sudo bash harden_api_only.sh"
    exit 1
  fi
}

ensure_file() {
  local f="$1"
  if [[ ! -f "$f" ]]; then
    echo "Missing file: $f"
    exit 1
  fi
}

set_env_var() {
  local key="$1"
  local value="$2"
  local file="$3"
  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf "%s=%s\n" "$key" "$value" >> "$file"
  fi
}

main() {
  require_root
  ensure_file "$ENV_FILE"

  local token="${1:-$DEFAULT_ADMIN_TOKEN}"

  cp -f "$ENV_FILE" "$ENV_FILE.bak.$(date +%Y%m%d%H%M%S)"

  mkdir -p "$DISABLED_WEB_ROOT"
  set_env_var "HV_REPORT_ADMIN_TOKEN" "$token" "$ENV_FILE"
  set_env_var "HV_REPORT_WEB_ROOT" "$DISABLED_WEB_ROOT" "$ENV_FILE"

  systemctl daemon-reload
  systemctl restart "$SERVICE_NAME"

  echo
  echo "Done: admin token updated and web UI disabled (API-only)."
  echo "Domain: https://$DOMAIN"
  echo "API still available: https://$DOMAIN/api/..."
  echo "Web UI endpoint now returns 404: https://$DOMAIN/"
  echo
  echo "New admin token: $token"
  echo "Please update client config token accordingly."
}

main "$@"
