#!/bin/bash
echo "Dosya izinleri kontrol ediliyor ve düzeltiliyor..."
sudo chown -R $(whoami) .

if [ ! -d "node_modules" ]; then
    echo "Ana dizindeki node_modules bulunamadi, yukleniyor..."
    npm install --include=dev
fi

if [ ! -d "server/node_modules" ]; then
    echo "Sunucu dizinindeki node_modules bulunamadi, yukleniyor..."
    cd server && npm install --include=dev && cd ..
fi

echo "Frontend derleniyor..."
npm run build

echo "Backend derleniyor..."
npm run server:build

echo "Uygulama başlatılıyor (Frontend + Backend)..."
npm run start:all
read -p "Press any key to continue..."
