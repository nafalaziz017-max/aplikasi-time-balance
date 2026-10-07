# Penyesuaian TimeBalance

Versi ini diselaraskan dengan konfigurasi terbaru:
- Premium Bulanan: Rp19.000/bulan
- Premium Tahunan: Rp50.000/tahun
- Mode Demo Premium dimatikan untuk rilis
- Paket pembayaran default di aplikasi: Bulanan
- SITE_URL website: https://timebalanceruang-rasamyid.biz.id/
- Pembayaran otomatis menggunakan Firebase + Cloudflare Worker + Midtrans tetap memerlukan kredensial asli.
- Firebase API Key dan API_BASE sengaja tetap placeholder karena merupakan konfigurasi milik pemilik aplikasi.

File utama:
- `www/` = aplikasi web/PWA + sumber APK Capacitor
- `worker/` = server pembayaran Premium
- `website/` = halaman pembayaran/status
