import os
import re
import uuid
import threading
from pathlib import Path

from flask import Flask, request, jsonify, send_file, render_template, abort
import yt_dlp

BASE_DIR = Path(__file__).resolve().parent
DOWNLOAD_DIR = BASE_DIR / "downloads"
DOWNLOAD_DIR.mkdir(exist_ok=True)

app = Flask(__name__)

# Almacén de trabajos en memoria: job_id -> dict con el estado de la descarga
JOBS = {}
JOBS_LOCK = threading.Lock()

YOUTUBE_RE = re.compile(
    r"^(https?://)?(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)/", re.I
)


def is_youtube_url(url: str) -> bool:
    return bool(url) and bool(YOUTUBE_RE.match(url.strip()))


def format_duration(seconds):
    seconds = int(seconds or 0)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/info", methods=["POST"])
def api_info():
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()

    if not url:
        return jsonify({"error": "Pega un enlace de YouTube para continuar."}), 400
    if not is_youtube_url(url):
        return jsonify({"error": "Ese enlace no parece ser de YouTube."}), 400

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError:
        return jsonify({"error": "No se pudo leer ese video. Revisa el enlace e intenta de nuevo."}), 422
    except Exception:
        return jsonify({"error": "Ocurrió un error inesperado al analizar el video."}), 500

    formats = info.get("formats") or []

    heights = set()
    for f in formats:
        h = f.get("height")
        vcodec = f.get("vcodec")
        if h and vcodec and vcodec != "none":
            heights.add(int(h))

    common = [2160, 1440, 1080, 720, 480, 360, 240]
    available_video = [h for h in common if h in heights]
    if not available_video and heights:
        available_video = sorted(heights, reverse=True)[:5]

    duration = info.get("duration") or 0

    result = {
        "id": info.get("id"),
        "title": info.get("title"),
        "uploader": info.get("uploader") or info.get("channel"),
        "thumbnail": info.get("thumbnail"),
        "duration": duration,
        "duration_str": format_duration(duration),
        "video_qualities": available_video,
        "webpage_url": info.get("webpage_url") or url,
    }
    return jsonify(result)


@app.route("/api/download", methods=["POST"])
def api_download():
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    mode = data.get("mode")  # "video" | "audio"
    quality = data.get("quality")  # int (altura) para video, string para audio

    if not is_youtube_url(url):
        return jsonify({"error": "Ese enlace no parece ser de YouTube."}), 400
    if mode not in ("video", "audio"):
        return jsonify({"error": "Selecciona un formato válido."}), 400

    job_id = uuid.uuid4().hex
    job_dir = DOWNLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    with JOBS_LOCK:
        JOBS[job_id] = {
            "status": "starting",
            "percent": 0.0,
            "speed": None,
            "eta": None,
            "error": None,
            "filepath": None,
            "filename": None,
        }

    thread = threading.Thread(
        target=run_download, args=(job_id, url, mode, quality, job_dir), daemon=True
    )
    thread.start()

    return jsonify({"job_id": job_id})


def run_download(job_id, url, mode, quality, job_dir: Path):
    def hook(d):
        with JOBS_LOCK:
            job = JOBS.get(job_id)
            if not job:
                return
            if d["status"] == "downloading":
                total = d.get("total_bytes") or d.get("total_bytes_estimate")
                downloaded = d.get("downloaded_bytes") or 0
                percent = (downloaded / total * 100) if total else 0
                job["status"] = "downloading"
                job["percent"] = round(percent, 1)
                job["speed"] = d.get("speed")
                job["eta"] = d.get("eta")
            elif d["status"] == "finished":
                job["status"] = "processing"
                job["percent"] = 100.0

    outtmpl = str(job_dir / "%(title).150s.%(ext)s")

    ydl_opts = {
        "outtmpl": outtmpl,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "progress_hooks": [hook],
        "windowsfilenames": True,
    }

    if mode == "video":
        height = int(quality) if quality else 1080
        ydl_opts["format"] = (
            f"bestvideo[height<={height}][ext=mp4]+bestaudio[ext=m4a]/"
            f"bestvideo[height<={height}]+bestaudio/best[height<={height}]"
        )
        ydl_opts["merge_output_format"] = "mp4"
    else:
        ydl_opts["format"] = "bestaudio/best"
        bitrate = str(quality) if quality and quality != "original" else "192"
        ydl_opts["postprocessors"] = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": bitrate,
        }]

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filepath = ydl.prepare_filename(info)
            if mode == "audio":
                base, _ = os.path.splitext(filepath)
                mp3path = base + ".mp3"
                if os.path.exists(mp3path):
                    filepath = mp3path

        with JOBS_LOCK:
            job = JOBS.get(job_id)
            job["status"] = "done"
            job["percent"] = 100.0
            job["filepath"] = filepath
            job["filename"] = os.path.basename(filepath)
    except Exception:
        with JOBS_LOCK:
            job = JOBS.get(job_id)
            job["status"] = "error"
            job["error"] = "No se pudo completar la descarga. Prueba otra calidad o revisa el enlace."


@app.route("/api/progress/<job_id>")
def api_progress(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return jsonify({"error": "not_found"}), 404
        return jsonify(job)


@app.route("/api/file/<job_id>")
def api_file(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job or job.get("status") != "done" or not job.get("filepath"):
        abort(404)
    filepath = job["filepath"]
    if not os.path.exists(filepath):
        abort(404)
    return send_file(filepath, as_attachment=True, download_name=job["filename"])


if __name__ == "__main__":
    print("\n  REELDECK corriendo en http://127.0.0.1:5000\n")
    app.run(debug=False, port=5000)
