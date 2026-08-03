#!/bin/bash

# ==============================================================================
# Hesabini Bil - Otomatik MySQL Yedekleme Betigi
# ------------------------------------------------------------------------------
# - Sifre BETIGE GOMULMEZ; uygulamanin kullandigi server/.env icindeki
#   DB_PASSWORD degeri okunur. Sifre degisse bile yedekleme calismaya devam eder.
# - Once gecici dosyaya yazar; yalnizca yedek BASARILI ve DOLU ise gercek
#   dosyanin uzerine tasir. Boylece basarisiz bir yedek, onceki gecerli yedegi
#   0 baytla ezmez.
# - Sadece en son yedek tutulur (latest_budget_backup.sql her seferinde yenilenir).
# ==============================================================================
set -o pipefail

# Betigin bulundugu klasor (baska makineye tasinsa/kopyalansa da dogru calisir)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_FILE="${SCRIPT_DIR}/latest_budget_backup.sql"
ENV_FILE="${SCRIPT_DIR}/server/.env"

DB_USER="budget_docker_user"
DB_NAME="hesabini_bil"
CONTAINER_NAME="xserver"

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"; }

log "Yedekleme basliyor..."

# --- Sifreyi server/.env icindeki DB_PASSWORD'dan oku ---
if [ ! -f "$ENV_FILE" ]; then
    log "HATA: $ENV_FILE bulunamadi."
    exit 1
fi
DB_PASS=$(grep -E '^DB_PASSWORD=' "$ENV_FILE" | sed 's/^DB_PASSWORD=//; s/^"//; s/"$//' | tr -d '\r')
if [ -z "$DB_PASS" ]; then
    log "HATA: server/.env icinde DB_PASSWORD bulunamadi."
    exit 1
fi

# --- Once gecici dosyaya al; sadece basarili + dolu ise yerine tasi ---
# MYSQL_PWD kullanildigi icin sifre komut satirinda gorunmez (mysqldump uyarisi cikmaz).
TMP_FILE="$(mktemp "${BACKUP_FILE}.XXXXXX")"
if sudo docker exec -e MYSQL_PWD="$DB_PASS" "$CONTAINER_NAME" \
        mysqldump -u"$DB_USER" --single-transaction --no-tablespaces "$DB_NAME" > "$TMP_FILE" \
   && [ -s "$TMP_FILE" ]; then
    mv "$TMP_FILE" "$BACKUP_FILE"
    log "Yedekleme basariyla tamamlandi. Dosya: ${BACKUP_FILE} ($(du -h "$BACKUP_FILE" | cut -f1))"
else
    rm -f "$TMP_FILE"
    log "HATA: Yedekleme basarisiz oldu! Onceki yedek korundu (uzerine yazilmadi)."
    exit 1
fi
