# MTS.DOWNLOADER

Descargador local de video y audio de YouTube, con interfaz web moderna desarrollada en React + TypeScript y backend en Flask. Corre en tu máquina y convierte los archivos para garantizar máxima compatibilidad con teléfonos celulares (iOS/Android) y PC.

> [!IMPORTANT]
> **Aviso Legal / Fines Educativos:** Este proyecto ha sido desarrollado exclusivamente con **fines educativos y experimentales** para el análisis de flujos de descarga y estructuración de aplicaciones modernas (React + Flask). El desarrollador no se hace responsable del uso indebido del software.

## Requisitos

1. **Python 3.9+** — [python.org/downloads](https://www.python.org/downloads/) (marca "Add Python to PATH" al instalar).
2. **Node.js 18+** — necesario para compilar la interfaz de React.
3. **ffmpeg** — necesario para unir video+audio en MP4 (H.264/AAC) y convertir a MP3.
   - Windows: `winget install ffmpeg` (o descárgalo de [ffmpeg.org](https://ffmpeg.org/download.html) y agrégalo al PATH).
   - macOS: `brew install ffmpeg`
   - Linux: `sudo apt install ffmpeg`

## Instalación y arranque

### Windows — un clic
Haz doble clic en **`run.bat`**. La primera vez instalará el entorno virtual de Python, instalará las dependencias de React (`node_modules`), compilará el frontend automáticamente e iniciará la aplicación abriéndola en tu navegador.

### Manual (cualquier sistema)

#### 1. Construir el Frontend de React:
```bash
cd frontend
npm install
npm run build
cd ..
```

#### 2. Arrancar el Backend en Flask:
```bash
# Crear entorno virtual de Python
python -m venv .venv

# Activar entorno virtual
# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

# Instalar dependencias y correr
pip install -r requirements.txt
python app.py
```

Abre **http://127.0.0.1:5000** en tu navegador.

## Uso

1. Pega el enlace del video de YouTube en el campo y pulsa **Analizar**.
2. Elige **Video** o **Audio**.
3. Elige la calidad (resoluciones disponibles para ese video, o el bitrate de MP3).
4. Pulsa **Grabar y Descargar Archivo**. El ecualizador interactivo te mostrará el progreso en tiempo real. Al terminar, el navegador iniciará la descarga automáticamente.
5. Las descargas completadas se guardarán en el historial local persistente.

## Notas técnicas

- **Frontend**: Single-Page Application construida con React (TypeScript), Vite y CSS premium con soporte para pantallas táctiles y móviles.
- **Backend**: Flask + [yt-dlp](https://github.com/yt-dlp/yt-dlp).
- **Compatibilidad**: Los videos se descargan y recodifican usando FFmpeg a un contenedor MP4 con codecs **H.264** y **AAC**, garantizando reproducción fluida directa en cualquier teléfono móvil (iOS/Android) y PC.

## Aviso

Usa este descargador solo con contenido del que tengas derecho a descargar una copia (tus propios videos, contenido con licencia libre, o para uso personal permitido en tu país). Respeta los Términos de Servicio de YouTube y los derechos de autor de cada creador.

