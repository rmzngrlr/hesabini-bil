#!/bin/bash

# ==============================================================================
# Hesabini Bil - Otomatik MySQL Yedekleme Betiği
# Bu betik her çalıştığında xserver Docker konteynerindeki hesabini_bil
# veritabanının bir yedeğini alır. Sadece en son alınan yedeği tutar (eskiyi siler).
# ==============================================================================

# Yedek dosyasının kaydedileceği klasör (bu betiğin bulunduğu klasör)
BACKUP_DIR="/home/xserver/hesabini-bil"
# Oluşturulacak yedek dosyasının sabit adı (her seferinde üzerine yazılır)
BACKUP_FILE="${BACKUP_DIR}/latest_budget_backup.sql"

# Docker'daki MySQL (xserver) içinden budget_docker_user ile hesabini_bil veritabanını yedekle
# Şifreniz .env içindeki şifrenizle aynıdır (Xx2026?. veya .env'de ne yazıyorsa).
# Uyarı: Terminale açık şifre yazıldığında güvenlik uyarısı almamak ve yedeği
# güvenle almak için mysql_config_editor vs kullanılabilir ancak şu an direkt bash üzerinden atıyoruz.
# NOT: Şifrenizi aşağıya Tırnak İşaretleri ("") arasına kendi şifrenizi ekleyiniz.

DB_USER="budget_docker_user"
DB_PASS="sifrenizi_buraya_yazin"
DB_NAME="hesabini_bil"
CONTAINER_NAME="xserver"

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Yedekleme basliyor..."

# Docker içinden mysqldump komutunu çalıştır ve çıktıyı dışarıdaki dosyaya yönlendir
sudo docker exec ${CONTAINER_NAME} mysqldump -u${DB_USER} -p"${DB_PASS}" ${DB_NAME} > ${BACKUP_FILE}

# İşlem sonucunu kontrol et
if [ $? -eq 0 ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] Yedekleme basariyla tamamlandi. Dosya: ${BACKUP_FILE}"
else
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] HATA: Yedekleme basarisiz oldu!"
fi
