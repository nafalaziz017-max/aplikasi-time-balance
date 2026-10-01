/* main.js — dark mode, loading, back-to-top, counter, FAQ, AOS, link APK */
const APK_DOWNLOAD_URL = "TODO_LINK_APK_SEBENARNYA"; // ganti dengan link APK Anda

/* Dark mode */
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  document.querySelectorAll('.dark-icon').forEach(i => {
    i.className = 'fas ' + (t === 'dark' ? 'fa-sun' : 'fa-moon') + ' dark-icon';
  });
}
function toggleDark(){
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(t);
  try { localStorage.setItem('tb-theme', t); } catch(e){}
}
function scrollTop(){ window.scrollTo({top:0, behavior:'smooth'}); }
function toggleFaq(btn){ btn.closest('.faq-item').classList.toggle('open'); }

/* Loading */
function hideLoading(){
  const l = document.getElementById('loading');
  if (l) l.classList.add('hide');
}

/* Counter */
function runCounters(){
  const els = document.querySelectorAll('.counter-num[data-target]');
  if (!els.length) return;
  const run = el => {
    const target = +el.dataset.target, suffix = el.dataset.suffix || '';
    const start = performance.now(), dur = 1600;
    const step = now => {
      const p = Math.min((now - start) / dur, 1);
      el.textContent = Math.floor(target * p).toLocaleString('id-ID') + (p === 1 ? suffix : '');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting){ run(e.target); io.unobserve(e.target); }
  }), {threshold:.4});
  els.forEach(el => io.observe(el));
}

/* Link APK */
function applyApkLinks(){
  document.querySelectorAll('[href="TODO_LINK_APK_SEBENARNYA"]').forEach(a => a.href = APK_DOWNLOAD_URL);
}

/* Init */
(function(){
  let saved = null;
  try { saved = localStorage.getItem('tb-theme'); } catch(e){}
  applyTheme(saved || 'light');
})();

document.addEventListener('DOMContentLoaded', () => {
  try { if (window.AOS) AOS.init({duration:700, once:true, offset:60}); } catch(e){}
  runCounters();
  applyApkLinks();
  setTimeout(hideLoading, 600);
});
window.addEventListener('load', hideLoading);
