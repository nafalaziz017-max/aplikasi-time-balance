# Panduan Deploy TimeBalance (PWA + Server) — Cloudflare

Hasil akhir: **satu alamat** (mis. `https://timebalance-api.xxx.workers.dev`) yang melayani aplikasi PWA, login, langganan, dan panel admin.
Semua lewat browser + GitHub. Tidak perlu memasang apa pun di komputer.

```
Pengguna ─► Aplikasi PWA (www/) ─ login/langganan ─► Worker (worker/src/index.js) ─► D1 (akun, pesanan)
Admin    ─► /admin.html ─ setujui pembayaran ────────┘
```

## A. Setup sekali (±20 menit)

1. **Cloudflare**: daftar gratis di dash.cloudflare.com.
2. **Buat database**: *Storage & Databases → D1 SQL database → Create* → nama `timebalance` → buka database-nya → salin **Database ID**.
3. **GitHub**: buat repo baru, unggah **seluruh isi** folder `apk-source` (pastikan folder `.github` ikut — kadang tersembunyi).
4. Edit `worker/wrangler.toml` di GitHub (ikon pensil): ganti `GANTI-ID-DATABASE-D1` dengan Database ID tadi → Commit.
5. **API Token Cloudflare**: *My Profile → API Tokens → Create Token → template “Edit Cloudflare Workers”*. Pastikan token punya izin **Workers Scripts: Edit** dan **D1: Edit** (tambahkan bila belum ada). Salin tokennya.
6. Di GitHub: *Settings → Secrets and variables → Actions → New repository secret*, buat 3 secret:
   | Nama | Isi |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | token langkah 5 |
   | `CLOUDFLARE_ACCOUNT_ID` | Account ID (Cloudflare → Workers & Pages, kolom kanan) |
   | `ADMIN_SECRET` | sandi panel admin buatanmu sendiri, **panjang & acak** (≥ 16 karakter) |
7. Tab **Actions → Deploy TimeBalance → Run workflow**. Tunggu ✅ (workflow menjalankan semua uji, membuat tabel database, lalu deploy).
8. Buka alamat Worker kamu (lihat di *Workers & Pages → timebalance-api*). Aplikasi tampil dengan layar **Masuk/Daftar**. Panel admin: `…/admin.html`.

> Untuk APK Android: isi `NATIVE_API_BASE` di `www/tb-config.js` dengan alamat Worker kamu, lalu lihat `PANDUAN-APK.md`.

## B. Memasang sebagai aplikasi (PWA)
- **Android (Chrome)**: buka alamat aplikasi → tombol **Pasang Aplikasi** (di layar masuk / Profil) atau menu ⋮ → *Pasang aplikasi*.
- **iPhone (Safari)**: Bagikan → *Tambah ke Layar Utama*.
- Setelah terpasang: layar penuh, ikon di layar utama, tetap bisa dibuka offline. Update otomatis (tidak ditimpa saat sesi fokus berjalan).

## C. Alur pengguna & admin (tanpa token)
1. Pengguna **daftar/masuk** (wajib). Tanpa langganan, aplikasi terkunci di layar paket.
2. Pilih **Bulanan Rp19.000** atau **Tahunan Rp50.000** → aplikasi menampilkan **QRIS + nominal unik** (mis. Rp19.037) → bayar → tekan **Saya sudah bayar**.
3. Admin buka `/admin.html` → tab **Pembayaran** → cocokkan nominal persis dengan mutasi e-wallet/rekening → **Setujui**.
4. Aplikasi pengguna **terbuka sendiri** (otomatis dicek tiap 5 detik). Langganan menempel di akun, jadi ganti HP tinggal masuk lagi.
- **Akun demo untuk dosen/penguji**: pengguna mendaftar dulu, lalu admin → tab **Alat → Beri akses manual** (mis. 30 hari).
- **Lupa kata sandi**: pengguna meminta lewat email; admin → **Alat → Reset kata sandi** → kirim sandi sementara; pengguna menggantinya di Profil → *Ganti Kata Sandi*.
- Tab **Pengguna** menampilkan siapa saja yang mendaftar, status langganan, dan kapan terakhir masuk (untuk “pengetahuan pengguna”).

## D. (Opsional) Pembayaran otomatis penuh dengan Midtrans QRIS
Bila ingin langganan aktif tanpa admin menyetujui:
1. Daftar merchant di midtrans.com (verifikasi bisnis dari pihak Midtrans, bisa beberapa hari). Mulai di **Sandbox**.
2. Cloudflare → *Workers & Pages → timebalance-api → Settings → Variables and Secrets → Add* → secret `MIDTRANS_SERVER_KEY`.
3. Di dashboard Midtrans, **Payment Notification URL** = `https://<alamat-worker>/api/webhook`.
4. Go-live: ubah `MIDTRANS_ENV = "production"` di `wrangler.toml`, ganti Server Key production, set ulang Notification URL production.
Begitu secret terisi, aplikasi otomatis memakai mode ini (harga persis tanpa kode unik) dan QRIS manual tidak dipakai.

## E. Hal yang sering diubah
- **Harga**: hanya di `worker/src/index.js` → `PLANS` (aplikasi membacanya dari server). Ubah juga teks harga di `website/payment.html` dan fallback di `www/app.js` bila perlu.
- **Gambar QRIS**: ganti `www/qris.jpeg`.
- **Domain sendiri**: Workers → timebalance-api → *Settings → Domains & Routes → Add → Custom domain*. Lalu ganti link “Buka Aplikasi” di `website/payment.html`.
- **Panel admin**: jangan bagikan alamat + Admin Secret. Percobaan salah dibatasi otomatis.

## F. Yang sudah diuji dan yang belum (jujur)
Sudah diuji otomatis: 66 uji server & klien (daftar, login, batas percobaan, langganan bulanan/tahunan, perpanjangan, kedaluwarsa, admin, hapus akun, CORS), serta uji penuh di browser sungguhan dengan runtime Cloudflare lokal (daftar → bayar → admin setujui → aplikasi terbuka → reload → offline → keluar/masuk).
**Belum bisa diuji dari sini** — cek sendiri saat go-live:
- Deploy sungguhan ke akun Cloudflare-mu (khususnya izin API token D1, langkah A5).
- Mode Midtrans (opsional): rumus tanda tangan webhook ditulis dari dokumentasi standar Midtrans dan diuji dengan simulasi, bukan layanan aslinya. Gagal dengan aman (webhook ditolak, tidak memberi langganan gratis).
- APK di perangkat Android nyata dan pemasangan PWA di iPhone.
- Email otomatis (verifikasi/reset sandi) **tidak ada** — reset sandi lewat admin.
