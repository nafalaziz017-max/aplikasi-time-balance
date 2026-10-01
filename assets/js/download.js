/* download.js — script khusus halaman download */
  /* Apply APK URL from config to all download buttons on this page */
  document.addEventListener('DOMContentLoaded', () => {

    const APK =
      typeof APK_DOWNLOAD_URL !== 'undefined'
        ? APK_DOWNLOAD_URL
        : 'TODO_LINK_APK_SEBENARNYA';

    document
      .querySelectorAll('[href="TODO_LINK_APK_SEBENARNYA"]')
      .forEach(a => {
        a.href = APK;
      });

  });
