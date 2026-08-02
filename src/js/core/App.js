/**
 * CineForge Pro — Main Application Controller
 * Orchestrates all modules and manages UI interactions
 */
window.App = (() => {
  'use strict';

  // ─── State ───
  let currentPage = 'edit';
  let isPlaying = false;
  let playbackRAF = null;
  let playbackStartTime = 0;
  let playbackOffset = 0;
  let snapEnabled = true;
  let currentTool = 'select';
  let deferredInstallPrompt = null;

  // ─── Init ───
  function init() {
    console.log('%c🎬 CineForge Pro initializing...', 'color:#00c8ff;font-weight:bold;font-size:14px');

    // Init sub-systems
    if (window.EventBus) EventBus.emit('app:init');
    if (window.Project) Project.init();
    if (window.VideoRenderer) VideoRenderer.init();
    if (window.Timeline) Timeline.init();
    if (window.AudioEngine) AudioEngine.init();
    if (window.ColorGrading) ColorGrading.init();
    if (window.EffectsEngine) EffectsEngine.init();
    if (window.MotionDesigner) MotionDesigner.init();
    if (window.UIManager) UIManager.init();
    if (window.Inspector) Inspector.init();
    if (window.Exporter) Exporter.init();

    setupPageTabs();
    setupTransportControls();
    setupMenuBar();
    setupMediaImport();
    setupToolbar();
    setupKeyboardShortcuts();
    setupDragDrop();
    setupColorGradingPage();
    setupEffectsPage();
    setupMotionPage();
    setupAudioPage();
    setupExportPage();
    setupSliderSyncValues();
    setupContextMenu();
    setupPWAInstall();
    setupResizeHandles();

    // Subscribe to events
    if (window.EventBus) {
      EventBus.on('clip:selected', onClipSelected);
      EventBus.on('clip:deselected', onClipDeselected);
      EventBus.on('playhead:moved', onPlayheadMoved);
      EventBus.on('project:changed', onProjectChanged);
      EventBus.on('export:progress', onExportProgress);
    }

    // Initial draw
    if (window.VideoRenderer) {
      VideoRenderer.drawCheckerboard();
    }

    showToast('CineForge Pro carregado ✓', 'success');
    console.log('%c✅ Ready', 'color:#00ff88;font-weight:bold');
  }

  // ─── Page Navigation ───
  function setupPageTabs() {
    const tabs = document.querySelectorAll('.page-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const page = tab.dataset.page;
        switchPage(page);
      });
    });
  }

  function switchPage(pageName) {
    currentPage = pageName;

    // Update tab active state
    document.querySelectorAll('.page-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.page === pageName);
    });

    // Update page active state
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `page-${pageName}`);
    });

    // Page-specific actions
    switch (pageName) {
      case 'color':
        if (window.ColorGrading) {
          ColorGrading.renderAllWheels();
          ColorGrading.updateScopes();
        }
        break;
      case 'effects':
        if (window.EffectsEngine) EffectsEngine.refreshPreview();
        break;
      case 'motion':
        if (window.MotionDesigner) MotionDesigner.refresh();
        break;
      case 'audio':
        if (window.AudioEngine) AudioEngine.refreshMixer();
        break;
    }

    EventBus && EventBus.emit('page:changed', { page: pageName });
  }

  // ─── Transport Controls ───
  function setupTransportControls() {
    const btnPlay = document.getElementById('btn-play');
    const btnGoStart = document.getElementById('btn-go-start');
    const btnGoEnd = document.getElementById('btn-go-end');
    const btnStepBack = document.getElementById('btn-step-back');
    const btnStepFwd = document.getElementById('btn-step-fwd');

    btnPlay && btnPlay.addEventListener('click', togglePlayback);
    btnGoStart && btnGoStart.addEventListener('click', () => setPlayhead(0));
    btnGoEnd && btnGoEnd.addEventListener('click', () => {
      const dur = window.Project ? Project.getDuration() : 0;
      setPlayhead(dur);
    });
    btnStepBack && btnStepBack.addEventListener('click', () => {
      const fps = window.Project ? Project.state.fps : 24;
      const current = window.Timeline ? Timeline.state.playheadTime : 0;
      setPlayhead(Math.max(0, current - 1 / fps));
    });
    btnStepFwd && btnStepFwd.addEventListener('click', () => {
      const fps = window.Project ? Project.state.fps : 24;
      const current = window.Timeline ? Timeline.state.playheadTime : 0;
      const dur = window.Project ? Project.getDuration() : 0;
      setPlayhead(Math.min(dur, current + 1 / fps));
    });
  }

  function togglePlayback() {
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }

  function startPlayback() {
    isPlaying = true;
    const btn = document.getElementById('btn-play');
    if (btn) {
      btn.querySelector('.icon-play').classList.add('hidden');
      btn.querySelector('.icon-pause').classList.remove('hidden');
    }
    playbackStartTime = performance.now();
    playbackOffset = window.Timeline ? Timeline.state.playheadTime : 0;

    const videoEl = document.getElementById('video-player');
    if (videoEl && videoEl.src) videoEl.play();

    function loop() {
      if (!isPlaying) return;
      const elapsed = (performance.now() - playbackStartTime) / 1000;
      const t = playbackOffset + elapsed;
      const dur = window.Project ? Project.getDuration() : 0;

      if (t >= dur && dur > 0) {
        pausePlayback();
        setPlayhead(0);
        return;
      }

      setPlayhead(t);
      if (window.VideoRenderer) VideoRenderer.renderAtTime(t);
      if (window.ColorGrading && currentPage === 'color') ColorGrading.updateScopes();
      playbackRAF = requestAnimationFrame(loop);
    }

    playbackRAF = requestAnimationFrame(loop);
    EventBus && EventBus.emit('playback:started');
  }

  function pausePlayback() {
    isPlaying = false;
    if (playbackRAF) cancelAnimationFrame(playbackRAF);

    const btn = document.getElementById('btn-play');
    if (btn) {
      btn.querySelector('.icon-play').classList.remove('hidden');
      btn.querySelector('.icon-pause').classList.add('hidden');
    }

    const videoEl = document.getElementById('video-player');
    if (videoEl) videoEl.pause();

    EventBus && EventBus.emit('playback:paused');
  }

  function setPlayhead(time) {
    if (window.Timeline) Timeline.setPlayhead(time);
    if (window.VideoRenderer) VideoRenderer.renderAtTime(time);
    updateTimecodeDisplay(time);
    EventBus && EventBus.emit('playhead:moved', { time });
  }

  function updateTimecodeDisplay(time) {
    const fps = window.Project ? Project.state.fps : 24;
    const el = document.getElementById('timecode-current');
    if (el) el.textContent = secondsToTimecode(time, fps);
  }

  function updateDurationDisplay(duration) {
    const fps = window.Project ? Project.state.fps : 24;
    const el = document.getElementById('timecode-total');
    if (el) el.textContent = secondsToTimecode(duration, fps);
  }

  function secondsToTimecode(totalSeconds, fps = 24) {
    fps = parseFloat(fps);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    const f = Math.floor((totalSeconds % 1) * fps);
    return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
  }

  function pad(n) { return String(Math.floor(n)).padStart(2, '0'); }

  // ─── Menu Bar ───
  function setupMenuBar() {
    const menuItems = document.querySelectorAll('.menu-item');
    const dropdowns = document.querySelectorAll('.dropdown-menu');

    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const menuId = `dropdown-${item.dataset.menu}`;
        const dropdown = document.getElementById(menuId);
        if (!dropdown) return;

        const isOpen = !dropdown.classList.contains('hidden');
        dropdowns.forEach(d => d.classList.add('hidden'));
        if (!isOpen) {
          dropdown.classList.remove('hidden');
          const rect = item.getBoundingClientRect();
          dropdown.style.left = rect.left + 'px';
        }
        item.classList.toggle('active', !isOpen);
      });
    });

    // Action handlers
    document.querySelectorAll('.dd-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        handleMenuAction(item.dataset.action);
        dropdowns.forEach(d => d.classList.add('hidden'));
        menuItems.forEach(m => m.classList.remove('active'));
      });
    });

    // Close on outside click
    document.addEventListener('click', () => {
      dropdowns.forEach(d => d.classList.add('hidden'));
      menuItems.forEach(m => m.classList.remove('active'));
    });
  }

  function handleMenuAction(action) {
    switch (action) {
      case 'new-project':
        if (confirm('Criar novo projeto? Alterações não salvas serão perdidas.')) {
          if (window.Project) Project.reset();
          if (window.Timeline) Timeline.clear();
          showToast('Novo projeto criado', 'info');
        }
        break;
      case 'open-project':
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.cineforge,.json';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const data = JSON.parse(ev.target.result);
              if (window.Project) Project.deserialize(data);
              showToast(`Projeto "${file.name}" carregado`, 'success');
            } catch (err) {
              showToast('Erro ao carregar projeto', 'error');
            }
          };
          reader.readAsText(file);
        };
        input.click();
        break;
      case 'save-project':
        saveProject();
        break;
      case 'save-as':
        saveProjectAs();
        break;
      case 'import-media':
        document.getElementById('file-input')?.click();
        break;
      case 'import-lut':
        document.getElementById('file-input-lut')?.click();
        break;
      case 'export':
        switchPage('export');
        break;
      case 'export-frame':
        exportCurrentFrame();
        break;
      case 'undo':
        if (window.Timeline) Timeline.undo();
        break;
      case 'redo':
        if (window.Timeline) Timeline.redo();
        break;
      case 'select-all':
        EventBus && EventBus.emit('select:all');
        break;
    }
  }

  function saveProject() {
    if (!window.Project) return;
    const data = Project.serialize();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (data.name || 'projeto') + '.cineforge';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Projeto salvo', 'success');
  }

  function saveProjectAs() {
    const name = prompt('Nome do projeto:', window.Project?.state?.name || 'Meu Projeto');
    if (name && window.Project) {
      Project.state.name = name;
      saveProject();
    }
  }

  function exportCurrentFrame() {
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `frame_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Frame exportado como PNG', 'success');
  }

  // ─── Media Import ───
  function setupMediaImport() {
    const fileInput = document.getElementById('file-input');
    const btnBrowse = document.getElementById('btn-browse');
    const dropZone = document.getElementById('media-drop-zone');
    const btnImport = document.getElementById('btn-import');

    btnBrowse && btnBrowse.addEventListener('click', () => fileInput?.click());
    btnImport && btnImport.addEventListener('click', () => fileInput?.click());

    fileInput && fileInput.addEventListener('change', (e) => {
      handleFiles(Array.from(e.target.files));
      e.target.value = '';
    });

    // LUT import
    const lutInput = document.getElementById('file-input-lut');
    lutInput && lutInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleLUTImport(file);
      e.target.value = '';
    });
  }

  function handleFiles(files) {
    files.forEach(file => {
      const type = file.type.startsWith('video/') ? 'video' :
                   file.type.startsWith('audio/') ? 'audio' :
                   file.type.startsWith('image/') ? 'image' : null;
      if (!type) return;

      const id = 'media_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const url = URL.createObjectURL(file);

      const mediaItem = {
        id, name: file.name, type, url,
        file, size: file.size,
        duration: 0, width: 0, height: 0
      };

      if (type === 'video' || type === 'audio') {
        const el = document.createElement(type === 'video' ? 'video' : 'audio');
        el.src = url;
        el.onloadedmetadata = () => {
          mediaItem.duration = el.duration;
          if (type === 'video') {
            mediaItem.width = el.videoWidth;
            mediaItem.height = el.videoHeight;
          }
          addMediaToLibrary(mediaItem);
        };
      } else {
        const img = new Image();
        img.onload = () => {
          mediaItem.width = img.width;
          mediaItem.height = img.height;
          mediaItem.duration = 5; // default 5s for images
          addMediaToLibrary(mediaItem);
        };
        img.src = url;
      }
    });
  }

  function addMediaToLibrary(mediaItem) {
    if (window.Project) Project.addMedia(mediaItem);

    // Show media grid
    const dropZone = document.getElementById('media-drop-zone');
    const mediaGrid = document.getElementById('media-grid');
    if (dropZone) dropZone.classList.add('hidden');
    if (mediaGrid) mediaGrid.classList.remove('hidden');

    // Create thumbnail
    const thumb = document.createElement('div');
    thumb.className = 'media-thumb';
    thumb.dataset.mediaId = mediaItem.id;
    thumb.draggable = true;

    const duration = mediaItem.duration ? formatDuration(mediaItem.duration) : '';
    const typeIcon = mediaItem.type === 'video' ? '🎬' : mediaItem.type === 'audio' ? '🔊' : '🖼';

    thumb.innerHTML = `
      <div class="media-thumb-img" style="display:flex;align-items:center;justify-content:center;font-size:24px;background:#1a1a1e">${typeIcon}</div>
      <div class="media-thumb-info">
        <div class="media-thumb-name">${mediaItem.name}</div>
        <div class="media-thumb-duration">${duration}</div>
      </div>
      <div class="media-thumb-badge">${mediaItem.type.toUpperCase()}</div>
    `;

    // Generate video thumbnail
    if (mediaItem.type === 'video') {
      const video = document.createElement('video');
      video.src = mediaItem.url;
      video.currentTime = 1;
      video.onloadeddata = () => {
        const c = document.createElement('canvas');
        c.width = 120; c.height = 68;
        const ctx = c.getContext('2d');
        ctx.drawImage(video, 0, 0, 120, 68);
        thumb.querySelector('.media-thumb-img').style.backgroundImage = `url(${c.toDataURL()})`;
        thumb.querySelector('.media-thumb-img').style.backgroundSize = 'cover';
        thumb.querySelector('.media-thumb-img').textContent = '';
      };
    }

    // Click to load in preview
    thumb.addEventListener('click', () => {
      document.querySelectorAll('.media-thumb').forEach(t => t.classList.remove('selected'));
      thumb.classList.add('selected');
      loadMediaInPreview(mediaItem);
    });

    // Double-click to add to timeline
    thumb.addEventListener('dblclick', () => {
      addMediaToTimeline(mediaItem);
    });

    // Drag to timeline
    thumb.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('mediaId', mediaItem.id);
      e.dataTransfer.setData('mediaType', mediaItem.type);
    });

    mediaGrid && mediaGrid.appendChild(thumb);
    showToast(`"${mediaItem.name}" importado`, 'success');
  }

  function loadMediaInPreview(mediaItem) {
    const videoEl = document.getElementById('video-player');
    if (!videoEl) return;

    if (mediaItem.type === 'video') {
      videoEl.src = mediaItem.url;
      videoEl.load();
      if (window.VideoRenderer) VideoRenderer.loadVideo(videoEl);
      if (window.AudioEngine) AudioEngine.connectMediaElement('preview', videoEl);
    }
  }

  function addMediaToTimeline(mediaItem) {
    if (!window.Timeline || !window.Project) return;

    // Find or create appropriate track
    let trackId = null;
    const tracks = Timeline.state.tracks;
    const targetType = mediaItem.type === 'audio' ? 'audio' : 'video';

    for (const track of tracks) {
      if (track.type === targetType) {
        trackId = track.id;
        break;
      }
    }

    if (!trackId) {
      trackId = Timeline.addTrack(targetType, targetType === 'video' ? 'Vídeo 1' : 'Áudio 1');
    }

    const playhead = Timeline.state.playheadTime;
    const clip = {
      id: 'clip_' + Date.now(),
      mediaId: mediaItem.id,
      name: mediaItem.name,
      start: playhead,
      duration: mediaItem.duration || 5,
      inPoint: 0,
      outPoint: mediaItem.duration || 5,
      type: mediaItem.type,
      color: targetType === 'video' ? '#1e6bb8' : '#b8761e',
    };

    Timeline.addClip(trackId, clip);
    updateDurationDisplay(Timeline.getDuration());
    showToast(`"${mediaItem.name}" adicionado à timeline`, 'info');
  }

  function handleLUTImport(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const cubeData = e.target.result;
      if (window.ColorGrading) {
        ColorGrading.importLUT(file.name, cubeData);
        showToast(`LUT "${file.name}" importado`, 'success');
      }
    };
    reader.readAsText(file);
  }

  function formatDuration(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  // ─── Drag & Drop ───
  function setupDragDrop() {
    const dropZone = document.getElementById('media-drop-zone');

    const onDragOver = (e) => {
      e.preventDefault();
      dropZone && dropZone.classList.add('dragover');
    };
    const onDragLeave = () => {
      dropZone && dropZone.classList.remove('dragover');
    };
    const onDrop = (e) => {
      e.preventDefault();
      dropZone && dropZone.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files);
      if (files.length) handleFiles(files);
    };

    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDrop);
  }

  // ─── Toolbar ───
  function setupToolbar() {
    const tools = { 'tool-select': 'select', 'tool-razor': 'razor', 'tool-hand': 'hand' };
    Object.entries(tools).forEach(([id, tool]) => {
      const btn = document.getElementById(id);
      btn && btn.addEventListener('click', () => {
        currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (window.Timeline) Timeline.setTool(tool);
      });
    });

    // Timeline tools
    const tlTools = { 'tl-select': 'select', 'tl-razor': 'razor', 'tl-ripple': 'ripple', 'tl-slip': 'slip' };
    Object.entries(tlTools).forEach(([id, tool]) => {
      const btn = document.getElementById(id);
      btn && btn.addEventListener('click', () => {
        document.querySelectorAll('.tl-tool').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (window.Timeline) Timeline.setTool(tool);
      });
    });

    // Snap toggle
    const snapBtn = document.getElementById('tl-snap');
    snapBtn && snapBtn.addEventListener('click', () => {
      snapEnabled = !snapEnabled;
      snapBtn.classList.toggle('active', snapEnabled);
      if (window.Timeline) Timeline.setSnap(snapEnabled);
    });
    snapBtn && snapBtn.classList.add('active');

    // Add tracks
    document.getElementById('tl-add-v')?.addEventListener('click', () => {
      if (window.Timeline) {
        const n = Timeline.state.tracks.filter(t => t.type === 'video').length + 1;
        Timeline.addTrack('video', `Vídeo ${n}`);
      }
    });
    document.getElementById('tl-add-a')?.addEventListener('click', () => {
      if (window.Timeline) {
        const n = Timeline.state.tracks.filter(t => t.type === 'audio').length + 1;
        Timeline.addTrack('audio', `Áudio ${n}`);
      }
    });
    document.getElementById('tl-add-t')?.addEventListener('click', () => {
      if (window.Timeline) {
        Timeline.addTrack('text', 'Títulos');
      }
    });

    // Undo/redo
    document.getElementById('tl-undo')?.addEventListener('click', () => window.Timeline?.undo());
    document.getElementById('tl-redo')?.addEventListener('click', () => window.Timeline?.redo());

    // Zoom slider
    const zoomSlider = document.getElementById('tl-zoom');
    zoomSlider?.addEventListener('input', (e) => {
      if (window.Timeline) Timeline.setZoom(parseFloat(e.target.value));
    });

    // Fit button
    document.getElementById('tl-fit')?.addEventListener('click', () => {
      if (window.Timeline) Timeline.fitToView();
    });

    // Preview tools
    document.getElementById('btn-scopes-toggle')?.addEventListener('click', () => {
      const bar = document.getElementById('scopes-bar');
      if (bar) {
        bar.classList.toggle('hidden');
        if (!bar.classList.contains('hidden') && window.ColorGrading) {
          ColorGrading.updateScopes();
        }
      }
    });

    document.getElementById('btn-safe-zones')?.addEventListener('click', () => {
      const overlay = document.getElementById('safe-zones-overlay');
      overlay?.classList.toggle('hidden');
    });

    document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
      const wrap = document.getElementById('preview-canvas-wrap');
      if (wrap) {
        if (!document.fullscreenElement) {
          wrap.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
      }
    });

    // Render main button
    document.getElementById('btn-render-main')?.addEventListener('click', () => switchPage('export'));

    // Preview zoom
    document.getElementById('preview-zoom')?.addEventListener('change', (e) => {
      if (window.VideoRenderer) VideoRenderer.setZoom(e.target.value);
    });

    // Scopes tabs
    document.querySelectorAll('.scope-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.scope-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (window.ColorGrading) ColorGrading.drawScope(btn.dataset.scope);
      });
    });
  }

  // ─── Color Grading Page ───
  function setupColorGradingPage() {
    // CG Tabs
    document.querySelectorAll('.cg-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.cg-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.cg-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const content = document.getElementById(`cgtab-${tab.dataset.cgtab}`);
        content && content.classList.add('active');

        if (tab.dataset.cgtab === 'curves' && window.ColorGrading) {
          ColorGrading.initCurvesEditor();
        }
      });
    });

    // Curves channel tabs
    document.querySelectorAll('.cch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cch-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (window.ColorGrading) ColorGrading.setCurvesChannel(btn.dataset.cch);
      });
    });

    // Primary sliders sync
    document.querySelectorAll('.cg-content #cgtab-wheels input[type=range]').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const next = e.target.nextElementSibling;
        if (next && next.classList.contains('sv')) {
          next.textContent = parseFloat(e.target.value).toFixed(2) + (e.target.id === 'cg-hue' ? '°' : '');
        }
        if (window.ColorGrading) ColorGrading.applyFromUI();
      });
    });

    // LUT select
    document.getElementById('lut-select')?.addEventListener('change', (e) => {
      const intensity = parseFloat(document.getElementById('lut-intensity')?.value || 100) / 100;
      if (window.ColorGrading) ColorGrading.applyLUT(e.target.value, intensity);
    });
    document.getElementById('lut-intensity')?.addEventListener('input', (e) => {
      const sv = e.target.nextElementSibling;
      if (sv) sv.textContent = e.target.value + '%';
      const lutName = document.getElementById('lut-select')?.value;
      if (lutName && window.ColorGrading) ColorGrading.applyLUT(lutName, parseFloat(e.target.value) / 100);
    });

    // HSL sliders
    document.querySelectorAll('.hsl-s').forEach(slider => {
      slider.addEventListener('input', () => {
        if (window.ColorGrading) ColorGrading.applyHSLFromUI();
      });
    });

    // LUT items in left panel
    document.querySelectorAll('.lut-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.lut-item').forEach(l => l.classList.remove('active'));
        item.classList.add('active');
        if (window.ColorGrading) ColorGrading.applyLUT(item.dataset.lut, 1.0);
        // Update select
        const sel = document.getElementById('lut-select');
        if (sel) sel.value = item.dataset.lut;
      });
    });

    // Curves reset
    document.getElementById('curves-reset-btn')?.addEventListener('click', () => {
      if (window.ColorGrading) ColorGrading.resetCurves();
    });
  }

  // ─── Effects Page ───
  function setupEffectsPage() {
    const libItems = document.querySelectorAll('[data-vfx]');
    libItems.forEach(item => {
      item.addEventListener('click', () => {
        libItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const effectName = item.dataset.vfx;
        showEffectParams(effectName);
        if (window.EffectsEngine) EffectsEngine.previewEffect(effectName);
      });
    });

    document.getElementById('vfx-apply-btn')?.addEventListener('click', () => {
      const selectedClipId = window.Project?.state?.selectedClipId;
      if (!selectedClipId) {
        showToast('Selecione um clipe na timeline primeiro', 'warning');
        return;
      }
      if (window.EffectsEngine) {
        const effect = EffectsEngine.getSelectedEffect();
        if (effect) {
          if (window.Project) Project.addEffect(selectedClipId, effect);
          showToast(`Efeito "${effect.name}" aplicado`, 'success');
        }
      }
    });
  }

  function showEffectParams(effectName) {
    const title = document.getElementById('vfx-params-title');
    const body = document.getElementById('vfx-params-body');
    if (!title || !body) return;

    const effect = window.EffectsEngine?.getEffectDef(effectName);
    if (!effect) {
      title.textContent = effectName;
      body.innerHTML = '<p class="hint-text">Parâmetros do efeito</p>';
      return;
    }

    title.textContent = effect.label || effectName;
    if (window.EffectsEngine) {
      EffectsEngine.renderEffectParams(body, effectName, effect.defaultParams, (params) => {
        EffectsEngine.updatePreviewParams(params);
      });
    }
  }

  // ─── Motion Page ───
  function setupMotionPage() {
    // Easing select
    document.getElementById('kf-easing')?.addEventListener('change', (e) => {
      if (window.MotionDesigner) {
        MotionDesigner.setEasing(e.target.value);
        const canvas = document.getElementById('easing-preview');
        if (canvas) MotionDesigner.drawEasingCurve(canvas, e.target.value);
      }
    });

    // Motion presets
    document.querySelectorAll('.motion-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const clipId = window.Project?.state?.selectedClipId;
        if (!clipId) {
          showToast('Selecione um clipe na timeline', 'warning');
          return;
        }
        const preset = btn.dataset.mpreset;
        if (window.MotionDesigner) {
          MotionDesigner.applyPreset(clipId, preset, 0, 3);
          showToast(`Preset "${preset}" aplicado`, 'success');
        }
      });
    });

    // KF action buttons
    document.getElementById('kf-add-btn')?.addEventListener('click', () => {
      const clipId = window.Project?.state?.selectedClipId;
      const time = window.Timeline?.state?.playheadTime || 0;
      if (clipId && window.MotionDesigner) {
        MotionDesigner.addKeyframeAtCurrent(clipId, time);
      }
    });

    document.getElementById('kf-del-btn')?.addEventListener('click', () => {
      if (window.MotionDesigner) MotionDesigner.removeSelectedKeyframe();
    });

    // Preview play/reset
    document.getElementById('mpc-play')?.addEventListener('click', () => {
      if (window.MotionDesigner) MotionDesigner.playPreview();
    });
    document.getElementById('mpc-reset')?.addEventListener('click', () => {
      if (window.MotionDesigner) MotionDesigner.stopPreview();
    });

    // Keyframe enable buttons
    document.querySelectorAll('.kf-enable-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const prop = btn.dataset.prop;
        if (window.MotionDesigner) MotionDesigner.togglePropKeyframes(prop, btn.classList.contains('active'));
      });
    });

    // Draw initial easing preview
    const easingCanvas = document.getElementById('easing-preview');
    if (easingCanvas && window.MotionDesigner) {
      MotionDesigner.drawEasingCurve(easingCanvas, 'ease-in-out');
    }
  }

  // ─── Audio Page ───
  function setupAudioPage() {
    // Audio FX tabs
    document.querySelectorAll('.afx-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.afx-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.afx-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const content = document.getElementById(`afx-${tab.dataset.afx}`);
        content && content.classList.add('active');
      });
    });

    // EQ bands
    document.querySelectorAll('.eq-gain').forEach((slider, i) => {
      slider.addEventListener('input', (e) => {
        const gainDb = parseFloat(e.target.value);
        if (window.AudioEngine) AudioEngine.setEQBand('master', i, gainDb);
        if (window.AudioEngine) AudioEngine.drawEQ(document.getElementById('eq-canvas'));
      });
    });

    // Compressor
    ['threshold', 'ratio', 'attack', 'release', 'makeup'].forEach(param => {
      const el = document.getElementById(`comp-${param}`);
      el && el.addEventListener('input', (e) => {
        const sv = e.target.nextElementSibling;
        const val = parseFloat(e.target.value);
        if (sv) {
          if (param === 'threshold' || param === 'makeup') sv.textContent = val + ' dB';
          else if (param === 'ratio') sv.textContent = val + ':1';
          else sv.textContent = val + 'ms';
        }
        if (window.AudioEngine) AudioEngine.setCompressor(param, val);
        if (window.AudioEngine) AudioEngine.drawCompressor(document.getElementById('comp-graph'));
      });
    });

    // Reverb
    ['size', 'damp', 'pre', 'wet'].forEach(param => {
      const el = document.getElementById(`rev-${param}`);
      el && el.addEventListener('input', (e) => {
        const sv = e.target.nextElementSibling;
        const val = parseFloat(e.target.value);
        if (sv) {
          if (param === 'pre') sv.textContent = val + 'ms';
          else sv.textContent = Math.round(val * 100) + '%';
        }
        if (window.AudioEngine) AudioEngine.setReverb(param, val);
      });
    });
  }

  // ─── Export Page ───
  function setupExportPage() {
    // Export presets
    document.querySelectorAll('.export-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.export-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyExportPreset(btn.dataset.preset);
      });
    });

    // Start export
    document.getElementById('btn-start-export')?.addEventListener('click', startExport);
    document.getElementById('btn-add-queue')?.addEventListener('click', addToRenderQueue);
  }

  function applyExportPreset(preset) {
    const format = document.getElementById('exp-format');
    const res = document.getElementById('exp-resolution');
    const fps = document.getElementById('exp-fps');
    const bitrate = document.getElementById('exp-bitrate');

    const presets = {
      'youtube-4k': { format: 'mp4', res: '4k', fps: '30', bitrate: 'ultra' },
      'youtube-1080': { format: 'mp4', res: '1080p', fps: '30', bitrate: 'high' },
      'instagram-reels': { format: 'mp4', res: '1080p', fps: '30', bitrate: 'high' },
      'tiktok': { format: 'mp4', res: '1080p', fps: '30', bitrate: 'medium' },
      'twitter': { format: 'mp4', res: '720p', fps: '30', bitrate: 'medium' },
      'cinema-4k': { format: 'mp4', res: 'dci4k', fps: '24', bitrate: 'ultra' },
      'prores': { format: 'mov', res: '1080p', fps: '24', bitrate: 'lossless' },
      'custom': {}
    };

    const config = presets[preset] || {};
    if (format && config.format) format.value = config.format;
    if (res && config.res) res.value = config.res;
    if (fps && config.fps) fps.value = config.fps;
    if (bitrate && config.bitrate) bitrate.value = config.bitrate;
  }

  function startExport() {
    if (!window.Exporter) {
      showToast('Exportador não disponível', 'error');
      return;
    }

    const config = {
      format: document.getElementById('exp-format')?.value || 'mp4',
      resolution: document.getElementById('exp-resolution')?.value || '1080p',
      fps: parseFloat(document.getElementById('exp-fps')?.value || '24'),
      bitrate: document.getElementById('exp-bitrate')?.value || 'high',
      audio: document.getElementById('exp-audio')?.value || 'aac-192',
      filename: document.getElementById('exp-filename')?.value || 'output.mp4',
    };

    Exporter.start(config);
  }

  function addToRenderQueue() {
    showToast('Adicionado à fila de renderização', 'info');
  }

  // ─── Slider Value Sync ───
  function setupSliderSyncValues() {
    // Quick color sliders
    document.querySelectorAll('[data-cq]').forEach(slider => {
      const key = slider.dataset.cq;
      const svEl = document.getElementById(`sv-${key}`);

      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (svEl) svEl.textContent = Number.isInteger(val) ? val : val.toFixed(1);
        applyQuickColor();
      });
    });

    function applyQuickColor() {
      if (!window.VideoRenderer && !window.ColorGrading) return;
      const params = {};
      document.querySelectorAll('[data-cq]').forEach(s => {
        params[s.dataset.cq] = parseFloat(s.value);
      });
      if (window.ColorGrading) ColorGrading.applyQuickColor(params);
    }

    // Inspector transform sync
    const transformPairs = [
      ['p-rotation', 'p-rotation-num'],
      ['p-opacity', 'p-opacity-num']
    ];
    transformPairs.forEach(([sliderId, numId]) => {
      const slider = document.getElementById(sliderId);
      const num = document.getElementById(numId);
      if (!slider || !num) return;
      slider.addEventListener('input', (e) => { num.value = e.target.value; applyTransform(); });
      num.addEventListener('input', (e) => { slider.value = e.target.value; applyTransform(); });
    });

    function applyTransform() {
      const clipId = window.Project?.state?.selectedClipId;
      if (!clipId) return;
      const props = {
        x: parseFloat(document.getElementById('p-pos-x')?.value || 0),
        y: parseFloat(document.getElementById('p-pos-y')?.value || 0),
        scaleX: parseFloat(document.getElementById('p-scale-x')?.value || 100),
        scaleY: parseFloat(document.getElementById('p-scale-y')?.value || 100),
        rotation: parseFloat(document.getElementById('p-rotation')?.value || 0),
        opacity: parseFloat(document.getElementById('p-opacity')?.value || 100) / 100,
        blendMode: document.getElementById('p-blend-mode')?.value || 'Normal',
      };
      if (window.Project) Project.updateClip(clipId, props);
      if (window.VideoRenderer) VideoRenderer.applyTransform(props);
    }
  }

  // ─── Keyboard Shortcuts ───
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;

      switch (key) {
        case ' ':
          e.preventDefault();
          togglePlayback();
          break;
        case 'v': currentTool = 'select'; break;
        case 'c': if (!ctrl) currentTool = 'razor'; break;
        case 'h': currentTool = 'hand'; break;
        case 's': if (!ctrl) currentTool = 'slip'; break;
        case 'r': if (!ctrl) currentTool = 'ripple'; break;
        case 'f': document.getElementById('btn-fullscreen')?.click(); break;
        case 'z':
          if (ctrl && e.shiftKey) { window.Timeline?.redo(); e.preventDefault(); }
          else if (ctrl) { window.Timeline?.undo(); e.preventDefault(); }
          break;
        case 'y': if (ctrl) { window.Timeline?.redo(); e.preventDefault(); } break;
        case 'delete':
        case 'backspace':
          const clipId = window.Project?.state?.selectedClipId;
          if (clipId) {
            window.Timeline?.removeClip(clipId);
            e.preventDefault();
          }
          break;
        case 'home': setPlayhead(0); break;
        case 'end':
          setPlayhead(window.Project?.getDuration() || 0);
          break;
        case 'arrowleft':
          e.preventDefault();
          if (window.Timeline) {
            const fps = window.Project?.state?.fps || 24;
            const t = Timeline.state.playheadTime;
            setPlayhead(Math.max(0, t - (e.shiftKey ? 1 : 1/fps)));
          }
          break;
        case 'arrowright':
          e.preventDefault();
          if (window.Timeline) {
            const fps = window.Project?.state?.fps || 24;
            const t = Timeline.state.playheadTime;
            const dur = window.Project?.getDuration() || 0;
            setPlayhead(Math.min(dur, t + (e.shiftKey ? 1 : 1/fps)));
          }
          break;
      }
    });
  }

  // ─── Context Menu ───
  function setupContextMenu() {
    const menu = document.getElementById('context-menu');
    if (!menu) return;

    document.addEventListener('contextmenu', (e) => {
      // Only show on timeline or preview
      if (e.target.closest('#tl-canvas') || e.target.closest('#preview-canvas-wrap')) {
        e.preventDefault();
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.classList.remove('hidden');
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.context-menu')) menu.classList.add('hidden');
    });

    menu.querySelectorAll('.ctx-item').forEach(item => {
      item.addEventListener('click', () => {
        handleContextAction(item.dataset.ctx);
        menu.classList.add('hidden');
      });
    });
  }

  function handleContextAction(action) {
    const clipId = window.Project?.state?.selectedClipId;
    switch (action) {
      case 'delete':
        if (clipId) window.Timeline?.removeClip(clipId);
        break;
      case 'cut':
        window.Timeline?.cutSelectedClip();
        break;
      case 'speed':
        const speed = prompt('Velocidade (%):', '100');
        if (speed && clipId) window.Project?.updateClip(clipId, { speed: parseFloat(speed) / 100 });
        break;
      case 'color-grade':
        switchPage('color');
        break;
    }
  }

  // ─── Event Handlers ───
  function onClipSelected(data) {
    const { clipId } = data;
    const body = document.getElementById('inspector-body');
    const noMsg = document.getElementById('no-clip-msg');
    if (body) body.classList.remove('hidden');
    if (noMsg) noMsg.classList.add('hidden');

    // Update status bar
    const statusClip = document.getElementById('status-clip');
    if (statusClip && window.Project) {
      const clip = Project.getClip(clipId);
      if (clip) statusClip.textContent = `Clipe: ${clip.name} | ${formatDuration(clip.duration)}`;
    }
  }

  function onClipDeselected() {
    const body = document.getElementById('inspector-body');
    const noMsg = document.getElementById('no-clip-msg');
    if (body) body.classList.add('hidden');
    if (noMsg) noMsg.classList.remove('hidden');
    const statusClip = document.getElementById('status-clip');
    if (statusClip) statusClip.textContent = 'Nenhum clipe selecionado';
  }

  function onPlayheadMoved(data) {
    updateTimecodeDisplay(data.time);
  }

  function onProjectChanged(data) {
    if (data?.duration !== undefined) updateDurationDisplay(data.duration);
  }

  function onExportProgress(data) {
    const { progress, eta, status } = data;
    const area = document.getElementById('render-progress-area');
    if (!area) return;

    if (status === 'complete') {
      area.innerHTML = `
        <div class="render-idle">
          <div style="font-size:48px">✅</div>
          <p style="color:var(--green)">Exportação concluída!</p>
        </div>`;
      showToast('Vídeo exportado com sucesso!', 'success');
    } else if (status === 'error') {
      area.innerHTML = `<div class="render-idle"><div style="font-size:48px">❌</div><p style="color:var(--red)">Erro na exportação</p></div>`;
      showToast('Erro durante exportação', 'error');
    } else {
      area.innerHTML = `
        <div class="render-progress-block">
          <div class="rp-title">Renderizando...</div>
          <div class="rp-bar-bg"><div class="rp-bar" style="width:${progress}%"></div></div>
          <div class="rp-info">
            <span>${progress.toFixed(1)}%</span>
            <span>ETA: ${eta || '--:--'}</span>
          </div>
        </div>`;
    }
  }

  // ─── Resize Handles ───
  function setupResizeHandles() {
    // Timeline resize
    const tlPanel = document.getElementById('timeline-panel');
    const editLayout = document.getElementById('edit-layout');
    if (!tlPanel || !editLayout) return;

    let resizing = false;
    let startY = 0;
    let startH = 0;

    // Create handle
    const handle = document.createElement('div');
    handle.className = 'resize-handle-h';
    tlPanel.parentElement?.insertBefore(handle, tlPanel);

    handle.addEventListener('mousedown', (e) => {
      resizing = true;
      startY = e.clientY;
      startH = tlPanel.offsetHeight;
      document.body.style.cursor = 'ns-resize';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      const delta = startY - e.clientY;
      const newH = Math.max(120, Math.min(500, startH + delta));
      tlPanel.style.height = newH + 'px';
      const style = getComputedStyle(document.documentElement);
      document.documentElement.style.setProperty('--timeline-h', newH + 'px');
      if (window.Timeline) Timeline.resize();
    });

    document.addEventListener('mouseup', () => {
      if (resizing) {
        resizing = false;
        document.body.style.cursor = '';
      }
    });
  }

  // ─── PWA Install ───
  function setupPWAInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;

      const banner = document.createElement('div');
      banner.className = 'install-banner';
      banner.innerHTML = `
        <p>Instalar CineForge Pro para acesso offline e melhor desempenho</p>
        <button class="btn-primary btn-sm" id="install-btn">Instalar</button>
        <button class="btn-xs" id="install-dismiss">Não</button>
      `;
      document.body.appendChild(banner);

      document.getElementById('install-btn')?.addEventListener('click', async () => {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          const result = await deferredInstallPrompt.userChoice;
          deferredInstallPrompt = null;
          banner.remove();
        }
      });

      document.getElementById('install-dismiss')?.addEventListener('click', () => banner.remove());
    });

    // Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(() => console.log('SW registered'))
        .catch(e => console.warn('SW failed:', e));
    }
  }

  // ─── Toast Notifications ───
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(30px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Expose globally
  window.showToast = showToast;

  // ─── Start on DOM ready ───
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Small delay to let modules load
    setTimeout(init, 100);
  }

  return { init, switchPage, setPlayhead, showToast, togglePlayback, isPlaying: () => isPlaying };
})();
