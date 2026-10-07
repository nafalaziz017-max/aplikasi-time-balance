/* ========================================
   TimeBalance — main.js
   Shared utilities: loading, dark mode,
   back-to-top, counters, AOS, FAQ
   ======================================== */

/* ---- Config ---- */
const APK_DOWNLOAD_URL = "TODO_LINK_APK_SEBENARNYA"; // Ganti dengan link APK asli

/* ---- Loading screen ---- */
window.addEventListener('load', () => {
  setTimeout(() => {
    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden');
    if (typeof AOS !== 'undefined') {
      AOS.init({ once: true, offset: 50, duration: 650 });
    }
    initCounters();
  }, 800);
});

/* ---- Dark mode ---- */
(function initDarkMode() {
  const stored = localStorage.getItem('tb-dark');
  if (stored === 'true') document.body.classList.add('dark');
})();

function toggleDark() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('tb-dark', isDark);
  const icons = document.querySelectorAll('.dark-icon');
  icons.forEach(i => { i.className = isDark ? 'fas fa-sun dark-icon' : 'fas fa-moon dark-icon'; });
}

/* ---- Back to top ---- */
window.addEventListener('scroll', () => {
  const btt = document.getElementById('btt');
  if (btt) btt.classList.toggle('visible', window.scrollY > 400);
});

function scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

/* ---- Animated counters ---- */
function initCounters() {
  const counters = document.querySelectorAll('[data-target]');
  if (!counters.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target  = parseInt(el.dataset.target);
      const suffix  = el.dataset.suffix || (target >= 1000 ? '+' : '');
      const duration = 1600;
      const step = target / (duration / 16);
      let current = 0;
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        const display = target >= 10000
          ? Math.floor(current).toLocaleString('id-ID')
          : Math.floor(current);
        el.textContent = display + suffix;
        if (current >= target) clearInterval(timer);
      }, 16);
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(el => obs.observe(el));
}

/* ---- FAQ accordion ---- */
function toggleFaq(btn) {
  const item   = btn.closest('.faq-item');
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(el => el.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

/* ---- Apply download URLs ---- */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-apk-link]').forEach(el => {
    el.href = APK_DOWNLOAD_URL;
  });
  // Sync dark icon state
  const isDark = document.body.classList.contains('dark');
  document.querySelectorAll('.dark-icon').forEach(i => {
    i.className = isDark ? 'fas fa-sun dark-icon' : 'fas fa-moon dark-icon';
  });
});
