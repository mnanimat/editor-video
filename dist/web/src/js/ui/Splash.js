/**
 * Editor de Vídeo MNAnimat — Splash Screen & Terms Controller
 * Handles age verification, terms of use acceptance, LGPD compliance and persistence
 */

function switchSplashTab(tabId, btn) {
  document.querySelectorAll('.splash-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.splash-tab-content').forEach(c => c.classList.remove('active'));

  const targetContent = document.getElementById(`stab-${tabId}`);
  if (targetContent) targetContent.classList.add('active');

  if (btn) {
    btn.classList.add('active');
  } else {
    const tabBtn = document.querySelector(`.splash-tab[data-stab="${tabId}"]`);
    if (tabBtn) tabBtn.classList.add('active');
  }
}

let selectedAgeGroup = null;

function onAgeChange(radio) {
  selectedAgeGroup = radio.value;
  const warnMinor = document.getElementById('age-warning-minor');
  const warnTeen = document.getElementById('age-warning-teen');

  if (warnMinor) warnMinor.style.display = radio.value === 'under13' ? 'block' : 'none';
  if (warnTeen) warnTeen.style.display = radio.value === '13to17' ? 'block' : 'none';

  updateSplashBtn();
}

function updateSplashBtn() {
  const chkTerms = document.getElementById('chk-terms')?.checked;
  const chkAge = document.getElementById('chk-age')?.checked;
  const chkLicense = document.getElementById('chk-license')?.checked;
  const btn = document.getElementById('splash-enter-btn');

  if (!btn) return;

  const isValidAgeSelected = selectedAgeGroup !== null;
  const allChecked = chkTerms && chkAge && chkLicense && isValidAgeSelected;

  if (allChecked) {
    btn.classList.add('enabled');
  } else {
    btn.classList.remove('enabled');
  }
}

function enterApp() {
  const overlay = document.getElementById('splash-overlay');
  if (!overlay) return;

  // Persist acceptance in localStorage
  try {
    localStorage.setItem('mnanimat_terms_accepted', 'true');
    localStorage.setItem('mnanimat_terms_date', new Date().toISOString());
    localStorage.setItem('mnanimat_age_group', selectedAgeGroup || '18plus');
  } catch (e) {
    console.warn('Storage disabled or unavailable:', e);
  }

  overlay.classList.add('hiding');
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 700);

  if (window.showToast) {
    window.showToast('Bem-vindo ao Editor de Vídeo MNAnimat! 🎬', 'success');
  }
}

// Auto-check if terms were previously accepted
document.addEventListener('DOMContentLoaded', () => {
  try {
    const accepted = localStorage.getItem('mnanimat_terms_accepted');
    if (accepted === 'true') {
      const overlay = document.getElementById('splash-overlay');
      if (overlay) overlay.style.display = 'none';
    }
  } catch (e) {
    console.warn('Storage check failed:', e);
  }
});
