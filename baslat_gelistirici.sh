#!/bin/bash
if [ ! -d "node_modules" ]; then
    echo "Node modules bulunamadi, yukleniyor..."
    npm install
fi
echo "Baslatiliyor..."
npm run dev -- --host
read -p "Press any key to continue..."
