@echo off
title EcoDocs Server
echo ==========================================
echo      EcoDocs - Sistema de Gestao
echo ==========================================
echo.
echo [1/2] Instalando dependencias (apenas na primeira vez)...
cd server
call npm install --omit=dev
echo.
echo [2/2] Iniciando servidor...
echo O sistema estara disponivel em: http://localhost:3000
echo.
npm start
pause
