# REELDECK

Descargador local de video y audio de YouTube, con interfaz web propia. Corre en tu máquina — no sube nada a ningún servidor externo salvo YouTube mismo.

## Requisitos

1. **Python 3.9+** — [python.org/downloads](https://www.python.org/downloads/) (marca "Add Python to PATH" al instalar).
2. **ffmpeg** — necesario para unir video+audio en MP4 y convertir a MP3.
   - Windows: `winget install ffmpeg` (o descárgalo de [ffmpeg.org](https://ffmpeg.org/download.html) y agrégalo al PATH).
   - macOS: `brew install ffmpeg`
   - Linux: `sudo apt install ffmpeg`

## Instalación y arranque

### Windows — un clic
Haz doble clic en **`run.bat`**. La primera vez instala el entorno automáticamente; luego abre el navegador solo.

### Manual (cualquier sistema)
```bash
cd yt-downloader
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
python app.py
```

Abre **http://127.0.0.1:5000** en tu navegador.

## Uso

1. Pega el enlace del video de YouTube en la ranura y pulsa **Analizar**.
2. Elige **Video** o **Audio**.
3. Elige la calidad (resoluciones disponibles para ese video, o el bitrate de MP3).
4. Pulsa **Descargar**. La barra tipo ecualizador muestra el progreso en tiempo real; al terminar, tu navegador descarga el archivo automáticamente.
5. Cada descarga queda listada en el historial de la sesión (se reinicia al cerrar el servidor).

## Notas técnicas

- Backend: Flask + [yt-dlp](https://github.com/yt-dlp/yt-dlp) (motor de descarga activamente mantenido).
- El video se descarga como MP4 (mejor video + mejor audio, fusionados con ffmpeg).
- El audio se extrae y convierte a MP3 en el bitrate elegido (o "Original" para el códec nativo sin recodificar, más rápido).
- Los archivos se guardan temporalmente en `downloads/<id>/` en el servidor; puedes borrar esa carpeta cuando quieras.

## Aviso

Usa este descargador solo con contenido del que tengas derecho a descargar una copia (tus propios videos, contenido con licencia libre, o para uso personal permitido en tu país). Respeta los Términos de Servicio de YouTube y los derechos de autor de cada creador.
