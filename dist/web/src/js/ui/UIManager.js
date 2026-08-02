/**
 * CineForge Pro — UI Manager
 * Handles all UI state, panels, and interactions
 */
window.UIManager = (() => {
  'use strict';

  function init() {
    setupPanelTabs();
    initEffectsListInteractions();
    initTitlePresets();
    initScopeCanvas();
    initColorGallery();
    setupModalClose();
    initTextEditor();
    setupFXStack();
  }

  function setupPanelTabs() {
    // Left/Right panel tab switching
    document.querySelectorAll('.panel-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const panel = tab.closest('.panel');
        if (!panel) return;
        panel.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
        panel.querySelectorAll('.ptab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const content = panel.querySelector(`#ptab-${tab.dataset.ptab}`);
        content && content.classList.add('active');
      });
    });
  }

  function initEffectsListInteractions() {
    // FX items in left panel: click to preview, drag to timeline
    document.querySelectorAll('.fx-item').forEach(item => {
      item.addEventListener('click', () => {
        const effectName = item.dataset.effect;
        // Highlight
        document.querySelectorAll('.fx-item').forEach(i => i.style.color = '');
        item.style.color = 'var(--accent)';
        // Preview on current clip
        if (window.EffectsEngine) EffectsEngine.previewEffect(effectName);
      });

      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('effectName', item.dataset.effect);
        e.dataTransfer.setData('dragType', 'effect');
      });
    });

    // Effects search filter
    document.getElementById('fx-search')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.fx-item').forEach(item => {
        const name = item.textContent.toLowerCase();
        item.style.display = q === '' || name.includes(q) ? '' : 'none';
      });
    });

    // Media search filter
    document.getElementById('media-search')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.media-thumb').forEach(thumb => {
        const name = thumb.querySelector('.media-thumb-name')?.textContent.toLowerCase() || '';
        thumb.style.display = q === '' || name.includes(q) ? '' : 'none';
      });
    });
  }

  function initTitlePresets() {
    document.querySelectorAll('.title-preset').forEach(preset => {
      preset.addEventListener('click', () => {
        showTextEditor(preset.dataset.title);
      });
    });
  }

  function showTextEditor(preset) {
    const backdrop = document.getElementById('modal-backdrop');
    const modal = document.getElementById('modal-text-editor');
    if (backdrop && modal) {
      backdrop.classList.remove('hidden');
      modal.classList.remove('hidden');

      // Set defaults based on preset
      const input = document.getElementById('text-input');
      if (input) {
        const defaults = {
          'lower-third': 'Nome do Personagem\nCargo / Empresa',
          'title-card': 'TÍTULO PRINCIPAL',
          'subtitle': 'Texto da legenda aqui.',
          'kinetic': 'TEXTO DINÂMICO',
          'credits': 'Direção: Nome\nProdução: Nome',
          'broadcast': 'TV TITLE'
        };
        input.value = defaults[preset] || '';
      }
    }
  }

  function initScopeCanvas() {
    // Scope tabs
    document.querySelectorAll('.scope-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.scope-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (window.ColorGrading) {
          ColorGrading.drawScope(btn.dataset.scope);
        }
      });
    });
  }

  function initColorGallery() {
    // Color page gallery — populated by Timeline events
    if (window.EventBus) {
      EventBus.on('timeline:changed', updateColorGallery);
    }
  }

  function updateColorGallery() {
    const gallery = document.getElementById('color-gallery');
    if (!gallery || !window.Timeline) return;

    gallery.innerHTML = '';
    const allClips = Timeline.getAllVideoClips();

    if (allClips.length === 0) {
      gallery.innerHTML = '<div class="gallery-empty">Nenhum clipe na timeline</div>';
      return;
    }

    allClips.forEach((clip, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'gallery-clip-thumb' + (i === 0 ? ' active' : '');
      thumb.innerHTML = `
        <div style="width:100%;height:60%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-size:18px">🎬</div>
        <span>${clip.name}</span>
      `;
      thumb.addEventListener('click', () => {
        document.querySelectorAll('.gallery-clip-thumb').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
        if (window.Project) Project.selectClip(clip.id);
        if (window.ColorGrading) ColorGrading.loadClipGrade(clip.id);
      });
      gallery.appendChild(thumb);
    });
  }

  function setupModalClose() {
    document.getElementById('modal-close')?.addEventListener('click', closeModal);
    document.getElementById('text-modal-close')?.addEventListener('click', closeModal);
    document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') closeModal();
    });
  }

  function closeModal() {
    const backdrop = document.getElementById('modal-backdrop');
    backdrop && backdrop.classList.add('hidden');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  }

  function initTextEditor() {
    document.getElementById('text-add-btn')?.addEventListener('click', () => {
      const text = document.getElementById('text-input')?.value;
      if (!text || !text.trim()) return;

      const font = document.getElementById('text-font')?.value || 'Inter';
      const size = parseInt(document.getElementById('text-size')?.value || '48');
      const color = document.getElementById('text-color')?.value || '#ffffff';
      const bold = document.getElementById('text-bold')?.classList.contains('active');
      const italic = document.getElementById('text-italic')?.classList.contains('active');
      const align = document.getElementById('text-align')?.value || 'Centro';
      const animation = document.getElementById('text-animation')?.value || 'Nenhuma';

      const textClip = {
        id: 'text_' + Date.now(),
        type: 'text',
        name: text.split('\n')[0].slice(0, 20),
        text, font, size, color, bold, italic, align, animation,
        duration: 5,
        start: window.Timeline?.state?.playheadTime || 0,
      };

      if (window.Timeline) {
        let textTrack = Timeline.state.tracks.find(t => t.type === 'text');
        if (!textTrack) {
          const id = Timeline.addTrack('text', 'Títulos');
          textTrack = Timeline.state.tracks.find(t => t.id === id);
        }
        if (textTrack) Timeline.addClip(textTrack.id, textClip);
      }

      closeModal();
      window.showToast?.('Título adicionado à timeline', 'success');
    });

    // Bold/Italic toggle
    document.getElementById('text-bold')?.addEventListener('click', (e) => e.target.classList.toggle('active'));
    document.getElementById('text-italic')?.addEventListener('click', (e) => e.target.classList.toggle('active'));
  }

  function setupFXStack() {
    // FX stack — drop zone for effects
    const stack = document.getElementById('fx-stack');
    if (!stack) return;

    stack.addEventListener('dragover', (e) => { e.preventDefault(); stack.style.background = 'var(--accent-dim)'; });
    stack.addEventListener('dragleave', () => { stack.style.background = ''; });
    stack.addEventListener('drop', (e) => {
      e.preventDefault();
      stack.style.background = '';
      const effectName = e.dataTransfer.getData('effectName');
      if (!effectName) return;
      const clipId = window.Project?.state?.selectedClipId;
      if (!clipId) {
        window.showToast?.('Selecione um clipe primeiro', 'warning');
        return;
      }
      addEffectToStack(clipId, effectName);
    });
  }

  function addEffectToStack(clipId, effectName) {
    if (!window.Project || !window.EffectsEngine) return;
    const def = EffectsEngine.getEffectDef(effectName);
    const label = def?.label || effectName;

    Project.addEffect(clipId, { name: effectName, params: { ...def?.defaultParams } });

    const stack = document.getElementById('fx-stack');
    if (!stack) return;

    const emptyEl = stack.querySelector('.fx-stack-empty');
    emptyEl?.remove();

    const item = document.createElement('div');
    item.className = 'fx-stack-item';
    item.innerHTML = `
      <span class="fx-stack-item-toggle">👁</span>
      <span class="fx-stack-item-name">${label}</span>
      <button class="icon-btn fx-del" title="Remover">✕</button>
    `;
    item.querySelector('.fx-del')?.addEventListener('click', () => {
      Project.removeEffect(clipId, effectName);
      item.remove();
    });
    item.querySelector('.fx-stack-item-toggle')?.addEventListener('click', (e) => {
      const toggle = e.target;
      const isEnabled = toggle.textContent === '👁';
      toggle.textContent = isEnabled ? '🚫' : '👁';
      Project.toggleEffect(clipId, effectName, !isEnabled);
    });
    stack.appendChild(item);
    window.showToast?.(`Efeito "${label}" adicionado`, 'success');
  }

  return { init, showTextEditor, updateColorGallery, addEffectToStack };
})();
