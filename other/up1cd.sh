#!/bin/bash 
# 一键更新域名

set -euo pipefail

CONF_FILE="/etc/nginx/conf.d/guacamole.conf"
DEFAULT_EMAIL="zshyydyx@163.com"

if [ "${EUID}" -ne 0 ]; then
  echo "Please run as root: sudo bash UP1CD.sh"
  exit 1
fi

echo "Please input your new domain (e.g., desktop.example.com):"
read -r NEW_DOMAIN

if [ -z "$NEW_DOMAIN" ]; then
  echo "Domain cannot be empty."
  exit 1
fi
EMAIL="$DEFAULT_EMAIL"

if [ ! -f "$CONF_FILE" ]; then
  echo "Nginx config not found: $CONF_FILE"
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "nginx is not installed."
  exit 1
fi

if ! command -v certbot >/dev/null 2>&1; then
  echo "certbot is not installed."
  exit 1
fi

CURRENT_SERVER_NAME_LINE="$(grep -E '^[[:space:]]*server_name[[:space:]]+' "$CONF_FILE" | head -n 1 || true)"
if [ -z "$CURRENT_SERVER_NAME_LINE" ]; then
  echo "server_name not found in $CONF_FILE"
  exit 1
fi

CURRENT_DOMAIN="$(echo "$CURRENT_SERVER_NAME_LINE" | sed -E 's/^[[:space:]]*server_name[[:space:]]+([^;]+);/\1/' | awk '{print $1}')"
BACKUP_FILE="${CONF_FILE}.bak.$(date +%Y%m%d%H%M%S)"

cp "$CONF_FILE" "$BACKUP_FILE"

sed -i -E "s|^[[:space:]]*server_name[[:space:]]+[^;]+;|        server_name ${NEW_DOMAIN};|" "$CONF_FILE"

if ! nginx -t; then
  echo "Nginx config test failed. Rolling back..."
  cp "$BACKUP_FILE" "$CONF_FILE"
  nginx -t
  exit 1
fi

systemctl reload nginx

certbot --nginx --non-interactive --agree-tos --redirect --hsts --email "$EMAIL" -d "$NEW_DOMAIN"

if [ -f "/etc/letsencrypt/live/${NEW_DOMAIN}/fullchain.pem" ]; then
  echo "Domain updated successfully."
  echo "Old domain: ${CURRENT_DOMAIN}"
  echo "New domain: ${NEW_DOMAIN}"
  echo "Access URL: https://${NEW_DOMAIN}"
  echo "Nginx backup: ${BACKUP_FILE}"
else
  echo "Certificate issuance may have failed."
  exit 1
fi
