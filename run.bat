@echo off
title REELDECK
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

where ffmpeg >nul 2>nul
if errorlevel 1 (
    echo   AVISO: no se encontro ffmpeg en el PATH.
    echo   Es necesario para unir video+audio y convertir a MP3.
    echo   Instalalo con: winget install ffmpeg
    echo.
)

if not exist ".venv" (
    echo   Creando entorno virtual por primera vez...
    python -m venv .venv
)

call .venv\Scripts\activate.bat

echo   Instalando dependencias...
pip install -r requirements.txt -q --disable-pip-version-check

echo.
echo   Iniciando REELDECK en http://127.0.0.1:5000
echo   ^(deja esta ventana abierta mientras usas la app^)
echo.

start "" http://127.0.0.1:5000
python app.py

pause
