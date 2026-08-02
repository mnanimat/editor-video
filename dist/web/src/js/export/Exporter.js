/**
 * CineForge Pro — Video Exporter
 * Handles video export via FFmpeg.wasm or MediaRecorder API
 */
window.Exporter = (() => {
  'use strict';

  let ffmpeg = null;
  let isExporting = false;
  let renderQueue = [];

  // Resolution map
  const RESOLUTIONS = {
    '480p':  { w: 854,  h: 480  },
    '720p':  { w: 1280, h: 720  },
    '1080p': { w: 1920, h: 1080 },
    '1440p': { w: 2560, h: 1440 },
    '4k':    { w: 3840, h: 2160 },
    'dci4k': { w: 4096, h: 2160 },
  };

  // Bitrate map in kbps
  const BITRATES = {
    'low':      4000,
    'medium':   10000,
    'high':     25000,
    'ultra':    50000,
    'lossless': 80000,
  };

  function init() {
    console.log('[Exporter] Initialized');
  }

  /**
   * Start export process
   * @param {Object} config - Export configuration
   */
  async function start(config) {
    if (isExporting) {
      window.showToast?.('Exportação já em andamento', 'warning');
      return;
    }

    const duration = window.Timeline ? Timeline.getDuration() : 0;
    if (duration <= 0) {
      window.showToast?.('Timeline vazia — adicione clipes antes de exportar', 'warning');
      return;
    }

    isExporting = true;
    EventBus?.emit('export:progress', { progress: 0, status: 'starting' });

    try {
      await exportWithMediaRecorder(config, duration);
    } catch (err) {
      console.error('[Exporter] Export failed:', err);
      EventBus?.emit('export:progress', { progress: 0, status: 'error', error: err.message });
      window.showToast?.('Erro na exportação: ' + err.message, 'error');
    } finally {
      isExporting = false;
    }
  }

  /**
   * Export using MediaRecorder + canvas capture
   */
  async function exportWithMediaRecorder(config, duration) {
    const res = RESOLUTIONS[config.resolution] || RESOLUTIONS['1080p'];
    const fps = config.fps || 24;
    const bitrateKbps = BITRATES[config.bitrate] || 25000;
    const filename = config.filename || 'output.webm';

    // Create offscreen render canvas
    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = res.w;
    renderCanvas.height = res.h;
    const ctx = renderCanvas.getContext('2d');

    // Create MediaRecorder
    const stream = renderCanvas.captureStream(fps);

    // Add audio if available
    let audioTrack = null;
    if (window.AudioEngine) {
      const audioStream = AudioEngine.getDestinationStream?.();
      if (audioStream) {
        audioStream.getAudioTracks().forEach(t => stream.addTrack(t));
      }
    }

    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: bitrateKbps * 1000,
    });

    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    recorder.start(100); // collect every 100ms

    // Render all frames
    const totalFrames = Math.ceil(duration * fps);
    const frameInterval = 1 / fps;

    const startTime = performance.now();

    for (let frame = 0; frame < totalFrames; frame++) {
      const time = frame * frameInterval;
      const progress = (frame / totalFrames) * 100;

      // Render frame to canvas
      await renderFrameToCanvas(ctx, res.w, res.h, time);

      // Update progress every 10 frames
      if (frame % 10 === 0) {
        const elapsed = (performance.now() - startTime) / 1000;
        const framesPerSec = frame / elapsed;
        const remaining = (totalFrames - frame) / framesPerSec;
        const eta = formatETA(remaining);

        EventBus?.emit('export:progress', {
          progress: progress,
          eta,
          status: 'rendering',
          frame,
          totalFrames,
        });
      }

      // Throttle to not freeze UI completely
      if (frame % 30 === 0) {
        await new Promise(r => setTimeout(r, 1));
      }
    }

    // Stop recording and compile video
    recorder.stop();

    await new Promise((resolve) => {
      recorder.onstop = resolve;
    });

    // Create and download the file
    const outputMime = mimeType || 'video/webm';
    const blob = new Blob(chunks, { type: outputMime });
    const url = URL.createObjectURL(blob);

    const outputFilename = filename.replace(/\.(mp4|mov|webm|gif)$/i, '') +
      (mimeType.includes('mp4') ? '.mp4' : '.webm');

    const link = document.createElement('a');
    link.href = url;
    link.download = outputFilename;
    link.click();

    URL.revokeObjectURL(url);

    EventBus?.emit('export:progress', { progress: 100, status: 'complete' });
    window.showToast?.(`Exportado: ${outputFilename}`, 'success');

    // Also offer GIF export if requested
    if (config.format === 'gif') {
      exportAsGIF(renderCanvas, duration, fps, filename);
    }
  }

  /**
   * Render a single frame to an offscreen canvas
   */
  async function renderFrameToCanvas(ctx, w, h, time) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    if (!window.Timeline || !window.Project) return;

    // Get all clips active at this time
    const activeClips = Timeline.getClipsAtTime(time);

    for (const { clip, track } of activeClips) {
      if (track.type === 'video' && !track.muted) {
        await renderVideoClipToCanvas(ctx, clip, time, w, h);
      } else if (track.type === 'text') {
        renderTextClipToCanvas(ctx, clip, time, w, h);
      }
    }

    // Apply color grade + effects if available
    const selectedClipId = Project.state.selectedClipId;
    if (selectedClipId && window.ColorGrading) {
      const imageData = ctx.getImageData(0, 0, w, h);
      ColorGrading.processImageData(imageData);
      ctx.putImageData(imageData, 0, 0);
    }
  }

  async function renderVideoClipToCanvas(ctx, clip, globalTime, w, h) {
    const mediaItem = window.Project?.getMedia(clip.mediaId);
    if (!mediaItem) return;

    const clipTime = globalTime - clip.start + clip.inPoint;

    if (mediaItem.type === 'video' && mediaItem.element) {
      const el = mediaItem.element;
      if (Math.abs(el.currentTime - clipTime) > 0.1) {
        el.currentTime = clipTime;
        await new Promise(r => { el.onseeked = r; setTimeout(r, 100); });
      }

      // Apply transform
      const scaleX = (clip.scaleX || 100) / 100;
      const scaleY = (clip.scaleY || 100) / 100;
      const rotation = ((clip.rotation || 0) * Math.PI) / 180;
      const opacity = clip.opacity || 1;
      const x = (clip.x || 0) + w / 2;
      const y = (clip.y || 0) + h / 2;

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(scaleX, scaleY);

      const dw = w * scaleX;
      const dh = h * scaleY;
      ctx.drawImage(el, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();

    } else if (mediaItem.type === 'image' && mediaItem.imageElement) {
      ctx.save();
      ctx.globalAlpha = clip.opacity || 1;
      ctx.drawImage(mediaItem.imageElement, 0, 0, w, h);
      ctx.restore();
    }
  }

  function renderTextClipToCanvas(ctx, clip, globalTime, w, h) {
    if (!clip.text) return;

    const progress = Math.min(1, Math.max(0, (globalTime - clip.start) / Math.min(0.5, clip.duration)));

    ctx.save();
    ctx.globalAlpha = clip.animation === 'Fade In' ? progress : (clip.opacity || 1);

    const fontSize = clip.size || 48;
    const fontStyle = (clip.bold ? 'bold ' : '') + (clip.italic ? 'italic ' : '');
    ctx.font = `${fontStyle}${fontSize}px '${clip.font || 'Inter'}'`;
    ctx.fillStyle = clip.color || '#ffffff';
    ctx.textAlign = clip.align === 'Esquerda' ? 'left' : clip.align === 'Direita' ? 'right' : 'center';
    ctx.textBaseline = 'middle';

    // Shadow for readability
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    const lines = clip.text.split('\n');
    const lineH = fontSize * 1.4;
    const totalH = lines.length * lineH;
    const startY = h * 0.85 - totalH / 2;

    lines.forEach((line, i) => {
      const tx = clip.align === 'Esquerda' ? 50 : clip.align === 'Direita' ? w - 50 : w / 2;
      let ty = startY + i * lineH;

      if (clip.animation === 'Slide Up') {
        ty += (1 - progress) * 60;
      } else if (clip.animation === 'Zoom In') {
        ctx.scale(0.8 + 0.2 * progress, 0.8 + 0.2 * progress);
      }

      ctx.fillText(line, tx, ty);
    });

    ctx.restore();
  }

  /**
   * Export as animated GIF (simplified)
   */
  async function exportAsGIF(canvas, duration, fps, filename) {
    window.showToast?.('GIF: use a resolução baixa para melhor desempenho', 'info');
    // In a full implementation, we'd use gif.js library
    // For now, export as WebM and notify user
  }

  function getSupportedMimeType() {
    const types = [
      'video/webm;codecs=h264',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'video/webm';
  }

  function formatETA(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Add job to render queue
   */
  function addToQueue(config) {
    renderQueue.push({ ...config, id: 'job_' + Date.now(), status: 'pending' });
    updateQueueUI();
  }

  function updateQueueUI() {
    const container = document.getElementById('render-queue');
    if (!container) return;
    const emptyEl = container.querySelector('.queue-empty');
    if (renderQueue.length > 0 && emptyEl) emptyEl.remove();

    // Rebuild queue list
    const listEl = container.querySelector('.queue-list') || document.createElement('div');
    listEl.className = 'queue-list';
    listEl.innerHTML = renderQueue.map(job => `
      <div class="queue-item" data-job="${job.id}">
        <span>${job.filename || 'output'}</span>
        <span class="queue-status">${job.status}</span>
      </div>
    `).join('');
    container.appendChild(listEl);
  }

  return { init, start, addToQueue };
})();
