/* navigation.js — navbar scroll, menu mobile, link aktif, tombol back-to-top */
function openMobileMenu(){
  document.getElementById('mob-menu')?.classList.add('open');
  document.getElementById('mob-overlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeMobileMenu(){
  document.getElementById('mob-menu')?.classList.remove('open');
  document.getElementById('mob-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('DOMContentLoaded', () => {
  const nav = document.getElementById('navbar'), btt = document.getElementById('btt');
  const onScroll = () => {
    const y = window.scrollY;
    if (nav) nav.classList.toggle('scrolled', y > 40);
    if (btt) btt.classList.toggle('show', y > 400);
  };
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === page) a.classList.add('active');
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobileMenu(); });
});
