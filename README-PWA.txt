TIMEBALANCE — PWA APLIKASI SIAP SALIN

1. Salin SELURUH folder apk-source ke project TimeBalance kamu.
2. Jika sudah ada folder apk-source lama, backup dulu lalu replace dengan folder ini.
3. Untuk menjalankan PWA, deploy folder www ke hosting HTTPS.
4. PWA tidak membutuhkan Android Studio untuk dipasang sebagai aplikasi web.
5. Jangan menaruh private key admin di folder www.
6. Sistem token tetap menggunakan file tb-auth.js/tb-config.js yang ada di source; konfigurasi backend/API harus diisi sesuai layanan yang digunakan.

File PWA tambahan:
- www/manifest.json
- www/sw.js
- www/pwa.js
- www/icons/*

Index sudah memuat pwa.js.
