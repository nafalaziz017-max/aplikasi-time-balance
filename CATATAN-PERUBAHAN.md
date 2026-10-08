# Catatan Perubahan — menjawab masukan dosen

| Masukan | Yang dilakukan |
|---|---|
| **Diberi login supaya ada pengetahuan pengguna** | Login/daftar **wajib** sebelum aplikasi terbuka (nama, email, kata sandi di-hash PBKDF2). Panel admin menampilkan jumlah pengguna, pengguna baru, status langganan, login terakhir. |
| **Semua berbayar, hanya bulanan & tahunan** | Tidak ada lagi versi Gratis/iklan/mode demo. Hanya 2 paket: **Bulanan Rp19.000 (31 hari)** dan **Tahunan Rp50.000 (366 hari)**. Tanpa langganan aktif, aplikasi terkunci di layar paket. Langganan berakhir → terkunci lagi, data di perangkat tetap aman. |
| **Tidak perlu token untuk upgrade premium** | Sistem token dihapus total (kode, alat pembuat token, kunci publik). Bayar QRIS di dalam aplikasi → admin menekan **Setujui** (atau otomatis via Midtrans) → langganan **menempel di akun** dan aplikasi terbuka sendiri. |
| **Sebagus mungkin untuk deploy di PWA** | PWA lengkap: bisa dipasang, layar penuh, offline, update aman, shortcut (Fokus/Tugas/Santai), header keamanan, satu alamat untuk aplikasi + server. |
| **Kalau bisa langsung jadi aplikasi** | PWA bisa dipasang dari browser (Android & iPhone), dan jalur APK Capacitor (GitHub Actions) tetap tersedia. |

## Temuan penting pada zip sebelumnya
`tb-auth.js` memanggil API login berbasis **Cloudflare D1** (`/api/register`, `/api/login`, …), sedangkan `worker/` di zip masih versi **Firebase + Midtrans lama** — keduanya tidak nyambung, jadi login tidak akan jalan jika di-deploy. Server (`worker/`) ditulis ulang sesuai kebutuhan di atas.

## Perubahan utama
- `worker/` — server baru (Cloudflare Worker + D1): akun, sesi, pesanan, admin, Midtrans opsional. `schema.sql`, 66 uji otomatis.
- `www/app.js` — gerbang login + langganan, layar paket, halaman bayar QRIS (nominal unik + unduh QRIS), pantau status otomatis, Profil (akun, ganti sandi, hapus akun). Kode token/demo/gratis dibuang.
- `www/admin.html` — panel admin (setujui pembayaran, pengguna, beri akses manual, reset sandi).
- `www/sw.js`, `pwa.js`, `manifest.json`, `index.html`, `_headers` — PWA yang lebih matang.
- `website/payment.html`, `index.html`, `content.html` — teks “Gratis” diganti; halaman pembayaran kini mengarah ke aplikasi.
- `.github/workflows/` — deploy otomatis (uji → siapkan database → deploy); APK tidak menyertakan panel admin.
- Dihapus: `tools/buat-token.html`, `ADMIN-TOKEN.md`, `PANDUAN-SETUP.md` (Firebase), `PENYESUAIAN-TIMEBALANCE.md`, `website/sukses.html`.

## Keputusan yang saya ambil (bisa diubah)
- **Pembayaran default = QRIS manual dengan kode unik + persetujuan admin**, karena Midtrans butuh verifikasi bisnis. Midtrans sudah disiapkan sebagai opsi (Panduan bagian D).
- Teks “Garansi 7 hari” dan “Batalkan kapan saja” dari paywall lama dihapus karena tidak ada mekanismenya (tidak ada perpanjangan otomatis, tidak ada alur refund). Tambahkan kembali bila memang berlaku.
- Tidak ada masa percobaan gratis. Untuk penguji, pakai **Beri akses manual** di panel admin.
- `website/pricing.html` dan `download.html` tidak ada di zip — periksa teks “gratis” di sana secara manual.
