@echo off
if not exist node_modules (
    echo Node modules bulunamadi, yukleniyor...
    call npm install
)
echo Baslatiliyor...
npm run dev -- --host
pause
