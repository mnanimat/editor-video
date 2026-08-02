/**
 * CineForge Pro — Inspector Panel
 * Handles clip property display and editing
 */
window.Inspector = (() => {
  'use strict';

  let currentClipId = null;
  let scaleLinked = true;

  function init() {
    if (window.EventBus) {
      EventBus.on('clip:selected', ({ clipId }) => loadClip(clipId));
      EventBus.on('clip:deselected', () => clearInspector());
      EventBus.on('clip:updated', ({ clipId }) => { if (clipId === currentClipId) refreshValues(); });
    }

    // Scale link toggle
    document.getElementById('scale-link')?.addEventListener('click', (e) => {
      scaleLinked = !scaleLinked;
      e.target.textContent = scaleLinked ? '🔗' : '🔓';
    });

    // Position inputs
    ['p-pos-x', 'p-pos-y'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => commitTransform());
    });

    // Scale inputs (with link)
    const scaleX = document.getElementById('p-scale-x');
    const scaleY = document.getElementById('p-scale-y');
    scaleX?.addEventListener('input', (e) => {
      if (scaleLinked && scaleY) scaleY.value = e.target.value;
      commitTransform();
    });
    scaleY?.addEventListener('input', (e) => {
      if (scaleLinked && scaleX) scaleX.value = e.target.value;
      commitTransform();
    });

    // Blend mode
    document.getElementById('p-blend-mode')?.addEventListener('change', () => commitTransform());

    // Crop inputs
    ['p-crop-top', 'p-crop-bottom', 'p-crop-left', 'p-crop-right'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => commitTransform());
    });
  }

  function loadClip(clipId) {
    currentClipId = clipId;
    const clip = window.Project?.getClip(clipId);
    if (!clip) return;

    // Transform values
    setValue('p-pos-x', clip.x || 0);
    setValue('p-pos-y', clip.y || 0);
    setValue('p-scale-x', clip.scaleX || 100);
    setValue('p-scale-y', clip.scaleY || 100);
    setValue('p-rotation', clip.rotation || 0);
    setValue('p-rotation-num', clip.rotation || 0);
    setValue('p-opacity', (clip.opacity || 1) * 100);
    setValue('p-opacity-num', Math.round((clip.opacity || 1) * 100));
    setValue('p-blend-mode', clip.blendMode || 'Normal');
    setValue('p-anchor-x', clip.anchorX || 50);
    setValue('p-anchor-y', clip.anchorY || 50);
    setValue('p-crop-top', clip.cropTop || 0);
    setValue('p-crop-bottom', clip.cropBottom || 0);
    setValue('p-crop-left', clip.cropLeft || 0);
    setValue('p-crop-right', clip.cropRight || 0);

    // Show effects stack
    refreshEffectsStack(clip);
  }

  function clearInspector() {
    currentClipId = null;
  }

  function refreshValues() {
    if (currentClipId) loadClip(currentClipId);
  }

  function setValue(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') el.value = val;
    else el.value = val;
  }

  function commitTransform() {
    if (!currentClipId || !window.Project) return;
    const props = {
      x: parseFloat(document.getElementById('p-pos-x')?.value || 0),
      y: parseFloat(document.getElementById('p-pos-y')?.value || 0),
      scaleX: parseFloat(document.getElementById('p-scale-x')?.value || 100),
      scaleY: parseFloat(document.getElementById('p-scale-y')?.value || 100),
      rotation: parseFloat(document.getElementById('p-rotation')?.value || 0),
      opacity: parseFloat(document.getElementById('p-opacity')?.value || 100) / 100,
      blendMode: document.getElementById('p-blend-mode')?.value || 'Normal',
      anchorX: parseFloat(document.getElementById('p-anchor-x')?.value || 50),
      anchorY: parseFloat(document.getElementById('p-anchor-y')?.value || 50),
      cropTop: parseFloat(document.getElementById('p-crop-top')?.value || 0),
      cropBottom: parseFloat(document.getElementById('p-crop-bottom')?.value || 0),
      cropLeft: parseFloat(document.getElementById('p-crop-left')?.value || 0),
      cropRight: parseFloat(document.getElementById('p-crop-right')?.value || 0),
    };
    Project.updateClip(currentClipId, props);
    if (window.VideoRenderer) VideoRenderer.applyTransform(props);
  }

  function refreshEffectsStack(clip) {
    const stack = document.getElementById('fx-stack');
    if (!stack) return;
    stack.innerHTML = '';

    const effects = clip.effects || [];
    if (effects.length === 0) {
      stack.innerHTML = '<div class="fx-stack-empty">Arraste efeitos da biblioteca aqui</div>';
      return;
    }

    effects.forEach(effect => {
      const def = window.EffectsEngine?.getEffectDef(effect.name);
      const label = def?.label || effect.name;

      const item = document.createElement('div');
      item.className = 'fx-stack-item' + (effect.enabled !== false ? '' : ' disabled');
      item.innerHTML = `
        <span class="fx-stack-item-toggle">${effect.enabled !== false ? '👁' : '🚫'}</span>
        <span class="fx-stack-item-name">${label}</span>
        <button class="icon-btn fx-del" title="Remover">✕</button>
      `;

      item.addEventListener('click', () => {
        document.querySelectorAll('.fx-stack-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        if (window.EffectsEngine) EffectsEngine.renderEffectParams(
          document.getElementById('vfx-params-body'),
          effect.name,
          effect.params || {},
          (params) => {
            effect.params = params;
            Project.updateClip(currentClipId, { effects: clip.effects });
          }
        );
      });

      item.querySelector('.fx-del')?.addEventListener('click', (e) => {
        e.stopPropagation();
        Project.removeEffect(currentClipId, effect.name);
        item.remove();
      });

      item.querySelector('.fx-stack-item-toggle')?.addEventListener('click', (e) => {
        e.stopPropagation();
        effect.enabled = !effect.enabled;
        e.target.textContent = effect.enabled ? '👁' : '🚫';
        item.classList.toggle('disabled', !effect.enabled);
        Project.updateClip(currentClipId, { effects: clip.effects });
      });

      stack.appendChild(item);
    });
  }

  return { init, loadClip, clearInspector };
})();
