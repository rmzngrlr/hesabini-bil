#!/bin/bash
if [ ! -d "node_modules" ]; then
    echo "Ana dizindeki node_modules bulunamadi, yukleniyor..."
    npm install
fi

if [ ! -d "server/node_modules" ]; then
    echo "Sunucu dizinindeki node_modules bulunamadi, yukleniyor..."
    npm run server:install
fi

echo "Frontend derleniyor..."
npm run build

echo "Backend derleniyor..."
npm run server:build

echo "Uygulama başlatılıyor (Frontend + Backend)..."
npm run start:all
read -p "Press any key to continue..."
