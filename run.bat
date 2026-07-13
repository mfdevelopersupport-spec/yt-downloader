@echo off
title MTS.DOWNLOADER
cd /d "%~dp0"

echo.
echo   Verificando entorno...
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo   No se encontro Python. Instalalo desde https://www.python.org/downloads/
    echo   ^(marca la casilla "Add Python to PATH" durante la instalacion^)
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo   AVISO: No se encontro Node.js en el PATH.
    echo   Es necesario para construir el frontend de React.
    echo   Instalalo desde https://nodejs.org/
    pause
    exit /b 1
)

where ffmpeg >nul 2>nul
if errorlevel 1 (
    echo   AVISO: no se encontro ffmpeg en el PATH.
    echo   Es necesario para unir video+audio y convertir a MP3.
    echo   Instalalo con: winget install ffmpeg
    echo.
)

if not exist ".venv" (
    echo   Creando entorno virtual de Python por primera vez...
    python -m venv .venv
)

call .venv\Scripts\activate.bat

echo   Instalando dependencias de Python...
pip install -r requirements.txt -q --disable-pip-version-check

echo.
echo   Verificando dependencias del Frontend (React)...
echo.
cd frontend
if not exist "node_modules" (
    echo   Instalando node_modules del frontend...
    call npm install
)

echo   Compilando el frontend de React...
call npm run build
cd ..

echo.
echo   Iniciando MTS.DOWNLOADER en http://127.0.0.1:5000
echo   ^(deja esta ventana abierta mientras usas la app^)
echo.

start "" http://127.0.0.1:5000
python app.py

pause
