/* TimeBalance PWA installer + service worker registration */
(() => {
  'use strict';

  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  const isHttps = location.protocol === 'https:';

  if ('serviceWorker' in navigator && (isHttps || isLocal)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(() => console.log('[TimeBalance] PWA service worker aktif.'))
        .catch(err => console.warn('[TimeBalance] Service worker gagal:', err));
    });
  }

  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const btn = document.getElementById('tb-install-app');
    if (btn) btn.remove();
  });

  function showInstallButton() {
    if (document.getElementById('tb-install-app') || window.matchMedia('(display-mode: standalone)').matches) return;

    const btn = document.createElement('button');
    btn.id = 'tb-install-app';
    btn.type = 'button';
    btn.textContent = '📲 Install TimeBalance';
    Object.assign(btn.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: '9999',
      border: '0',
      borderRadius: '999px',
      padding: '12px 16px',
      background: '#3d6b35',
      color: '#fff',
      font: '600 14px system-ui, sans-serif',
      boxShadow: '0 8px 24px rgba(0,0,0,.18)',
      cursor: 'pointer'
    });

    btn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      btn.remove();
    });

    document.body.appendChild(btn);
  }
})();
