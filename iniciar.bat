@echo off
rem RedSOS - iniciar con un clic (Windows)
rem Antes: enciende la "Zona con cobertura inalambrica" de Windows con el nombre RedSOS.
rem Para cambiar el nombre o la clave que se muestra en el QR, edita las dos lineas siguientes.
set REDSOS_WIFI=RedSOS
set REDSOS_WIFI_CLAVE=redsos2026
cd /d "%~dp0"
title RedSOS

where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instalalo desde https://nodejs.org ^(version 22.13 o superior^).
  pause
  exit /b 1
)

if not exist node_modules (
  echo Primera vez: instalando dependencias ^(necesita Internet solo esta vez^)...
  call npm install
)

rem Abre en esta laptop la pantalla con los QR y arranca el servidor
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000/conectar.html"
node --disable-warning=ExperimentalWarning server.js
pause
