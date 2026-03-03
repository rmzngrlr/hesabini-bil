#!/bin/bash
echo "Dosya izinleri kontrol ediliyor ve düzeltiliyor..."
sudo chown -R $(whoami) .

if [ ! -d "node_modules" ]; then
    echo "Ana dizindeki node_modules bulunamadi, yukleniyor..."
    npm install
fi

if [ ! -d "server/node_modules" ]; then
    echo "Sunucu dizinindeki node_modules bulunamadi, yukleniyor..."
    npm run server:install
fi

echo "Frontend ve Backend geliştirme ortamı başlatılıyor..."
npm run dev:all
read -p "Press any key to continue..."
