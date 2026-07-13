import React, { useState, useEffect, useRef } from 'react';
import { Download, History, Link2 } from 'lucide-react';

interface VideoInfo {
  id: string;
  title: string;
  uploader: string;
  thumbnail: string;
  duration: number;
  duration_str: string;
  video_qualities: number[];
  webpage_url: string;
}

interface DownloadJob {
  status: 'starting' | 'downloading' | 'processing' | 'done' | 'error';
  percent: number;
  speed: number | null;
  eta: number | null;
  error: string | null;
  filepath: string | null;
  filename: string | null;
}

interface HistoryItem {
  id: string;
  title: string;
  thumbnail: string;
  mode: 'video' | 'audio';
  quality: string;
  filename: string;
  timestamp: number;
}

const WAVE_BARS = 28;
const AUDIO_QUALITIES = [
  { value: '320', label: '320 kbps' },
  { value: '192', label: '192 kbps' },
  { value: '128', label: '128 kbps' },
  { value: 'original', label: 'Original' },
];

export default function App() {
  const [url, setUrl] = useState('');
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [infoError, setInfoError] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);

  const [mode, setMode] = useState<'video' | 'audio'>('video');
  const [quality, setQuality] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  // Job progress polling
  const [progress, setProgress] = useState<DownloadJob | null>(null);
  const pollingRef = useRef<number | null>(null);

  // History state
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem('mts_download_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('mts_download_history', JSON.stringify(history));
  }, [history]);

  // Clean polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const isValidYoutubeUrl = (rawUrl: string) => {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\//i.test(rawUrl.trim());
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoError('');
    setVideoInfo(null);
    setDownloadError('');
    setProgress(null);

    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setInfoError('Pega un enlace de YouTube para continuar.');
      return;
    }
    if (!isValidYoutubeUrl(cleanUrl)) {
      setInfoError('Ese enlace no parece ser de YouTube.');
      return;
    }

    setLoadingInfo(true);
    try {
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl }),
      });
      const data = await res.json();

      if (!res.ok) {
        setInfoError(data.error || 'No se pudo analizar el video.');
        return;
      }

      setVideoInfo(data);
      setMode('video');
      if (data.video_qualities && data.video_qualities.length > 0) {
        setQuality(String(data.video_qualities[0]));
      } else {
        setQuality('1080');
      }
    } catch (err) {
      setInfoError('No se pudo conectar con el servidor local.');
    } finally {
      setLoadingInfo(false);
    }
  };

  // Change mode (Video / Audio)
  const handleModeChange = (newMode: 'video' | 'audio') => {
    setMode(newMode);
    if (newMode === 'video') {
      if (videoInfo?.video_qualities && videoInfo.video_qualities.length > 0) {
        setQuality(String(videoInfo.video_qualities[0]));
      } else {
        setQuality('1080');
      }
    } else {
      setQuality(AUDIO_QUALITIES[0].value);
    }
  };

  // Handle Download start
  const handleDownload = async () => {
    if (!videoInfo) return;
    setDownloadError('');
    setDownloading(true);
    setProgress({
      status: 'starting',
      percent: 0,
      speed: null,
      eta: null,
      error: null,
      filepath: null,
      filename: null,
    });

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: videoInfo.webpage_url,
          mode,
          quality,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setDownloadError(data.error || 'No se pudo iniciar la descarga.');
        setDownloading(false);
        setProgress(null);
        return;
      }

      startPolling(data.job_id);
    } catch (err) {
      setDownloadError('No se pudo conectar con el servidor local.');
      setDownloading(false);
      setProgress(null);
    }
  };

  // Poll progress state from API
  const startPolling = (jobId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/progress/${jobId}`);
        const job: DownloadJob = await res.json();

        if (!res.ok) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setDownloadError('Se perdió el estado de la descarga.');
          setDownloading(false);
          return;
        }

        setProgress(job);

        if (job.status === 'done') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setDownloading(false);
          
          // Trigger browser download
          triggerFileDownload(jobId, job.filename || 'download');

          // Add to history
          if (videoInfo) {
            const historyItem: HistoryItem = {
              id: jobId,
              title: videoInfo.title,
              thumbnail: videoInfo.thumbnail,
              mode,
              quality: mode === 'video' ? `${quality}p` : `${quality}kbps`,
              filename: job.filename || 'download',
              timestamp: Date.now(),
            };
            setHistory((prev) => [historyItem, ...prev]);
          }
        } else if (job.status === 'error') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setDownloadError(job.error || 'Ocurrió un error durante la descarga.');
          setDownloading(false);
        }
      } catch (err) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setDownloadError('Se perdió la conexión con el servidor local.');
        setDownloading(false);
      }
    }, 700) as unknown as number;
  };

  const triggerFileDownload = (jobId: string, filename: string) => {
    const a = document.createElement('a');
    a.href = `/api/file/${jobId}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Helper formattings
  const formatBytesPerSec = (bps: number | null) => {
    if (bps === null || bps === undefined) return '—';
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let i = 0;
    let speedVal = bps;
    while (speedVal >= 1024 && i < units.length - 1) {
      speedVal /= 1024;
      i++;
    }
    return `${speedVal.toFixed(1)} ${units[i]}`;
  };

  const formatEta = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return '—';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `ETA ${m}:${String(s).padStart(2, '0')}`;
  };

  // Waveform fill logic
  const filledBarsCount = progress ? Math.round((progress.percent / 100) * WAVE_BARS) : 0;

  return (
    <div className="app-container">
      <div className="tape-noise" aria-hidden="true" />

      {/* Header */}
      <header className="hero">
        <div className="hero__eyebrow">
          <span className={`rec-dot ${videoInfo ? 'is-live' : ''}`} aria-hidden="true" />
          <span>Descargas locales · Compatibilidad Celular y PC</span>
        </div>
        <h1 className="hero__title">
          MTS.<span>DOWNLOADER</span>
        </h1>
        <p className="hero__tagline">Pega el enlace de YouTube, selecciona el formato y descarga directamente.</p>
      </header>

      {/* Input section */}
      <section className="glass-card" aria-label="Analizar enlace de YouTube">
        <form onSubmit={handleAnalyze} className="deck__slot" autoComplete="off">
          <Link2 className="deck__icon" size={20} />
          <input
            id="urlInput"
            type="text"
            inputMode="url"
            className="deck__input"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loadingInfo || downloading}
            required
          />
          <button type="submit" className="btn btn--primary" disabled={loadingInfo || downloading}>
            {loadingInfo ? (
              <>
                <span className="spinner" />
                <span>Analizando</span>
              </>
            ) : (
              <span>Analizar</span>
            )}
          </button>
        </form>
        {infoError && <p className="deck__error" role="alert">{infoError}</p>}
      </section>

      {/* Preview and Download control */}
      {videoInfo && (
        <section className="glass-card preview">
          <div className="preview__card">
            <div className="preview__thumb-wrap">
              <img src={videoInfo.thumbnail} className="preview__thumb" alt={videoInfo.title} />
              <span className="preview__duration">{videoInfo.duration_str}</span>
            </div>
            <div className="preview__meta">
              <h2 className="preview__title" title={videoInfo.title}>
                {videoInfo.title}
              </h2>
              <p className="preview__channel">{videoInfo.uploader}</p>
            </div>
          </div>

          <div className="options">
            {/* Format toggle (Video / Audio) */}
            <div className="options__group">
              <span className="options__label">Formato</span>
              <div className="segmented" role="tablist">
                <button
                  type="button"
                  className={`segmented__btn ${mode === 'video' ? 'is-active' : ''}`}
                  onClick={() => handleModeChange('video')}
                  disabled={downloading}
                  role="tab"
                  aria-selected={mode === 'video'}
                >
                  Video
                </button>
                <button
                  type="button"
                  className={`segmented__btn ${mode === 'audio' ? 'is-active' : ''}`}
                  onClick={() => handleModeChange('audio')}
                  disabled={downloading}
                  role="tab"
                  aria-selected={mode === 'audio'}
                >
                  Audio
                </button>
              </div>
            </div>

            {/* Quality list */}
            <div className="options__group">
              <span className="options__label">
                {mode === 'video' ? 'Calidad de Video' : 'Calidad de Audio'}
              </span>
              <div className="pills" role="radiogroup">
                {mode === 'video' ? (
                  (videoInfo.video_qualities && videoInfo.video_qualities.length > 0
                    ? videoInfo.video_qualities
                    : [1080, 720, 480]
                  ).map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={`pill ${quality === String(q) ? 'is-active' : ''}`}
                      onClick={() => setQuality(String(q))}
                      disabled={downloading}
                      role="radio"
                      aria-checked={quality === String(q)}
                    >
                      {q}p
                    </button>
                  ))
                ) : (
                  AUDIO_QUALITIES.map((q) => (
                    <button
                      key={q.value}
                      type="button"
                      className={`pill ${quality === q.value ? 'is-active' : ''}`}
                      onClick={() => setQuality(q.value)}
                      disabled={downloading}
                      role="radio"
                      aria-checked={quality === q.value}
                    >
                      {q.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Download button and progress statistics */}
          <div className="transport">
            <div className={`waveform ${downloading ? 'is-active' : ''}`}>
              {Array.from({ length: WAVE_BARS }).map((_, idx) => (
                <div
                  key={idx}
                  className={`waveform__bar ${idx < filledBarsCount ? 'is-filled' : ''}`}
                  style={{
                    ['--peak' as any]: `${20 + Math.sin(idx * 0.4) * 30 + Math.random() * 25}%`,
                    animationDelay: `${(idx * 0.04).toFixed(2)}s`,
                  }}
                />
              ))}
            </div>

            <div className="transport__row">
              <button
                type="button"
                className="btn btn--accent"
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <>
                    <span className="spinner spinner--light" />
                    <span>Descargando...</span>
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    <span>Grabar y Descargar Archivo</span>
                  </>
                )}
              </button>

              {progress && (
                <div className="transport__stats">
                  <span>{Math.round(progress.percent)}%</span>
                  <span className="dot-sep">·</span>
                  <span>{formatBytesPerSec(progress.speed)}</span>
                  <span className="dot-sep">·</span>
                  <span>
                    {progress.status === 'processing'
                      ? 'Procesando y convirtiendo a formato compatible...'
                      : formatEta(progress.eta)}
                  </span>
                </div>
              )}
            </div>

            {downloadError && <p className="transport__error">{downloadError}</p>}
          </div>
        </section>
      )}

      {/* History */}
      <section className="glass-card history">
        <h3 className="history__title">
          <History size={18} />
          <span>Historial de Descargas</span>
        </h3>
        {history.length === 0 ? (
          <div className="history__empty">
            Todavía no hay descargas registradas en esta máquina. ¡Tus archivos listos aparecerán aquí!
          </div>
        ) : (
          <ul className="history__list">
            {history.map((item) => (
              <li key={item.id} className="history__item">
                <img src={item.thumbnail} className="history__thumb" alt={item.title} />
                <div className="history__info">
                  <div className="history__item-title" title={item.title}>
                    {item.title}
                  </div>
                  <div>
                    <span className={item.mode === 'video' ? 'tag--video' : 'tag--audio'}>
                      {item.mode.toUpperCase()} · {item.quality}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>
          MTS.DOWNLOADER corre de forma segura en tu red local · Videos codificados en H.264/AAC MP4 para reproducción directa
        </p>
      </footer>
    </div>
  );
}
