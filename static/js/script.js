(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const urlForm = $("#urlForm");
  const urlInput = $("#urlInput");
  const analyzeBtn = $("#analyzeBtn");
  const formError = $("#formError");
  const recDot = $("#recDot");

  const previewSection = $("#previewSection");
  const previewThumb = $("#previewThumb");
  const previewDuration = $("#previewDuration");
  const previewTitle = $("#previewTitle");
  const previewChannel = $("#previewChannel");

  const modeTabs = $("#modeTabs");
  const qualityLabel = $("#qualityLabel");
  const qualityPills = $("#qualityPills");

  const waveform = $("#waveform");
  const downloadBtn = $("#downloadBtn");
  const downloadError = $("#downloadError");
  const statPercent = $("#statPercent");
  const statSpeed = $("#statSpeed");
  const statEta = $("#statEta");

  const historyList = $("#historyList");
  const historyEmpty = $("#historyEmpty");

  const WAVE_BARS = 28;
  const AUDIO_QUALITIES = [
    { value: "320", label: "320 kbps" },
    { value: "192", label: "192 kbps" },
    { value: "128", label: "128 kbps" },
    { value: "original", label: "Original" },
  ];

  let state = {
    currentInfo: null,
    mode: "video",
    quality: null,
    polling: null,
  };

  // ---------- helpers ----------
  function formatBytesPerSec(bps) {
    if (!bps) return "—";
    const units = ["B/s", "KB/s", "MB/s", "GB/s"];
    let i = 0;
    while (bps >= 1024 && i < units.length - 1) {
      bps /= 1024;
      i++;
    }
    return `${bps.toFixed(1)} ${units[i]}`;
  }

  function formatEta(seconds) {
    if (seconds === null || seconds === undefined) return "—";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `ETA ${m}:${String(s).padStart(2, "0")}`;
  }

  function setLoading(btn, loading) {
    btn.classList.toggle("is-loading", loading);
    btn.disabled = loading;
  }

  function isValidYoutubeUrl(url) {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\//i.test(url.trim());
  }

  // ---------- waveform ----------
  function buildWaveform() {
    waveform.innerHTML = "";
    for (let i = 0; i < WAVE_BARS; i++) {
      const bar = document.createElement("div");
      bar.className = "waveform__bar";
      bar.style.setProperty("--peak", `${20 + Math.random() * 65}%`);
      bar.style.animationDelay = `${(i * 0.05).toFixed(2)}s`;
      waveform.appendChild(bar);
    }
  }

  function setWaveformProgress(percent) {
    const bars = waveform.querySelectorAll(".waveform__bar");
    const filledCount = Math.round((percent / 100) * bars.length);
    bars.forEach((bar, idx) => {
      bar.classList.toggle("is-filled", idx < filledCount);
    });
  }

  buildWaveform();

  // ---------- URL analysis ----------
  urlForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    formError.textContent = "";
    const url = urlInput.value.trim();

    if (!url) {
      formError.textContent = "Pega un enlace de YouTube para continuar.";
      return;
    }
    if (!isValidYoutubeUrl(url)) {
      formError.textContent = "Ese enlace no parece ser de YouTube.";
      recDot.classList.remove("is-live");
      return;
    }

    setLoading(analyzeBtn, true);
    try {
      const res = await fetch("/api/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!res.ok) {
        formError.textContent = data.error || "No se pudo analizar el video.";
        recDot.classList.remove("is-live");
        previewSection.hidden = true;
        return;
      }

      recDot.classList.add("is-live");
      state.currentInfo = data;
      renderPreview(data);
    } catch (err) {
      formError.textContent = "No se pudo conectar con el servidor local.";
    } finally {
      setLoading(analyzeBtn, false);
    }
  });

  function renderPreview(info) {
    previewThumb.src = info.thumbnail || "";
    previewThumb.alt = info.title || "Miniatura del video";
    previewDuration.textContent = info.duration_str || "0:00";
    previewTitle.textContent = info.title || "Título no disponible";
    previewChannel.textContent = info.uploader || "Canal desconocido";

    previewSection.hidden = false;
    downloadError.textContent = "";
    statPercent.textContent = "0%";
    statSpeed.textContent = "—";
    statEta.textContent = "—";
    setWaveformProgress(0);
    waveform.classList.remove("is-active");

    state.mode = "video";
    modeTabs.querySelectorAll(".segmented__btn").forEach((btn) => {
      const active = btn.dataset.mode === "video";
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });

    renderQualityOptions(info);
    previewSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderQualityOptions(info) {
    qualityPills.innerHTML = "";

    if (state.mode === "video") {
      qualityLabel.textContent = "Calidad de video";
      const qualities = info.video_qualities && info.video_qualities.length
        ? info.video_qualities
        : [1080, 720, 480];

      qualities.forEach((h, idx) => {
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = "pill" + (idx === 0 ? " is-active" : "");
        pill.textContent = `${h}p`;
        pill.dataset.value = h;
        pill.setAttribute("role", "radio");
        pill.setAttribute("aria-checked", String(idx === 0));
        pill.addEventListener("click", () => selectQuality(pill, h));
        qualityPills.appendChild(pill);
      });
      state.quality = qualities[0];
    } else {
      qualityLabel.textContent = "Calidad de audio";
      AUDIO_QUALITIES.forEach((q, idx) => {
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = "pill" + (idx === 0 ? " is-active" : "");
        pill.textContent = q.label;
        pill.dataset.value = q.value;
        pill.setAttribute("role", "radio");
        pill.setAttribute("aria-checked", String(idx === 0));
        pill.addEventListener("click", () => selectQuality(pill, q.value));
        qualityPills.appendChild(pill);
      });
      state.quality = AUDIO_QUALITIES[0].value;
    }
  }

  function selectQuality(pillEl, value) {
    qualityPills.querySelectorAll(".pill").forEach((p) => {
      p.classList.remove("is-active");
      p.setAttribute("aria-checked", "false");
    });
    pillEl.classList.add("is-active");
    pillEl.setAttribute("aria-checked", "true");
    state.quality = value;
  }

  // ---------- format tabs ----------
  modeTabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented__btn");
    if (!btn || !state.currentInfo) return;

    modeTabs.querySelectorAll(".segmented__btn").forEach((b) => {
      b.classList.toggle("is-active", b === btn);
      b.setAttribute("aria-selected", String(b === btn));
    });
    state.mode = btn.dataset.mode;
    renderQualityOptions(state.currentInfo);
  });

  // ---------- download ----------
  downloadBtn.addEventListener("click", async () => {
    if (!state.currentInfo) return;
    downloadError.textContent = "";
    setLoading(downloadBtn, true);
    waveform.classList.add("is-active");
    setWaveformProgress(0);

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: state.currentInfo.webpage_url,
          mode: state.mode,
          quality: state.quality,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        downloadError.textContent = data.error || "No se pudo iniciar la descarga.";
        setLoading(downloadBtn, false);
        waveform.classList.remove("is-active");
        return;
      }

      pollProgress(data.job_id);
    } catch (err) {
      downloadError.textContent = "No se pudo conectar con el servidor local.";
      setLoading(downloadBtn, false);
      waveform.classList.remove("is-active");
    }
  });

  function pollProgress(jobId) {
    if (state.polling) clearInterval(state.polling);

    state.polling = setInterval(async () => {
      try {
        const res = await fetch(`/api/progress/${jobId}`);
        const job = await res.json();

        if (!res.ok) {
          clearInterval(state.polling);
          downloadError.textContent = "Se perdió el estado de la descarga.";
          finishDownloadUI(false);
          return;
        }

        const percent = job.percent || 0;
        statPercent.textContent = `${Math.round(percent)}%`;
        statSpeed.textContent = formatBytesPerSec(job.speed);
        statEta.textContent = job.status === "processing" ? "Procesando…" : formatEta(job.eta);
        setWaveformProgress(percent);

        if (job.status === "done") {
          clearInterval(state.polling);
          statPercent.textContent = "100%";
          statEta.textContent = "Listo";
          finishDownloadUI(true);
          triggerFileDownload(jobId, job.filename);
          addHistoryItem(job.filename);
        } else if (job.status === "error") {
          clearInterval(state.polling);
          downloadError.textContent = job.error || "Ocurrió un error durante la descarga.";
          finishDownloadUI(false);
        }
      } catch (err) {
        clearInterval(state.polling);
        downloadError.textContent = "Se perdió la conexión con el servidor local.";
        finishDownloadUI(false);
      }
    }, 700);
  }

  function finishDownloadUI(success) {
    setLoading(downloadBtn, false);
    waveform.classList.remove("is-active");
    if (!success) setWaveformProgress(0);
  }

  function triggerFileDownload(jobId, filename) {
    const a = document.createElement("a");
    a.href = `/api/file/${jobId}`;
    a.download = filename || "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function addHistoryItem(filename) {
    if (!state.currentInfo) return;
    historyEmpty.remove();

    const li = document.createElement("li");
    li.className = "history__item";

    const isAudio = state.mode === "audio";
    const tag = isAudio
      ? `<span class="tag--audio">AUDIO</span>`
      : `<span class="tag--video">VIDEO · ${state.quality}p</span>`;

    li.innerHTML = `
      <img class="history__thumb" src="${state.currentInfo.thumbnail || ""}" alt="" />
      <div class="history__info">
        <div class="history__item-title">${escapeHtml(state.currentInfo.title || filename)}</div>
        <div class="history__item-meta">${tag}</div>
      </div>
    `;

    historyList.prepend(li);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
