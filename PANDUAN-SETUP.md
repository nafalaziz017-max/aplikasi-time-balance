# Panduan Setup: Akun & Pembayaran Otomatis TimeBalance

Hasil akhirnya: pengguna daftar/masuk di aplikasi → klik **Bayar** → bayar QRIS di QRIS + Token Aktivasi → Premium aktif otomatis di akunnya.
Tidak ada token yang diketik, tidak ada konfirmasi manual.

```
Aplikasi / Website ──login──▶ Firebase (akun email+password)
        │
        └──"bayar"──▶ Server (Cloudflare Worker) ──▶ QRIS + Token Aktivasi (QRIS)
                              ▲                          │
                              └──── webhook "lunas" ◀────┘
                              (server mencatat Premium untuk akun itu)
Aplikasi ──"status saya?"──▶ Server ──▶ Premium aktif
```

Anda perlu 3 akun gratis: **Firebase**, **Cloudflare**, **QRIS + Token Aktivasi**. Kerjakan berurutan. Semua langkah bisa lewat browser dan
GitHub, tanpa menginstal apa pun di komputer.

---

## A. Firebase (akun pengguna) ±10 menit
1. console.firebase.google.com → **Add project** → beri nama `timebalance` (Google Analytics boleh dimatikan).
2. Menu **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save**.
3. **Project settings** (ikon roda gigi) → tab **General**. Catat dua nilai:
   - **Project ID** → untuk `worker/wrangler.toml`
   - **Web API Key** → untuk `tb-config.js`
4. (Disarankan) **Authentication → Templates**: ubah bahasa email ke **Indonesia** dan nama pengirim ke "TimeBalance".
   Ini email "verifikasi" dan "reset kata sandi" yang diterima pengguna.

## B. Cloudflare (server pembayaran) ±15 menit
1. dash.cloudflare.com → daftar gratis.
2. **Workers & Pages → KV → Create a namespace** → nama `PREMIUM` → **Add**. Salin **ID** namespace-nya.
3. Catat **Account ID** (di halaman Workers & Pages, kolom kanan).
4. **My Profile → API Tokens → Create Token** → template **Edit Cloudflare Workers** → Continue → Create. Salin tokennya (hanya tampil sekali).
5. Di repo GitHub proyek ini: **Settings → Secrets and variables → Actions → New repository secret**. Buat 3 secret:
   - `CLOUDFLARE_API_TOKEN` = token dari langkah 4
   - `CLOUDFLARE_ACCOUNT_ID` = Account ID
   - `MIDTRANS_SERVER_KEY` = Server Key QRIS + Token Aktivasi (dari bagian C, **Sandbox** dulu)
6. Edit `worker/wrangler.toml` langsung di GitHub (ikon pensil):
   - `FIREBASE_PROJECT_ID` = Project ID dari A3
   - `SITE_URL` = alamat website Anda, mis. `https://timebalance.com` (tanpa `/` di akhir)
   - `ALLOWED_ORIGINS` = ganti `GANTI-DOMAIN-WEBSITE` dengan domain website Anda (dua tempat, biarkan `https://localhost` dan `capacitor://localhost`)
   - `id = "..."` di bawah `[[kv_namespaces]]` = ID namespace dari langkah 2
7. Commit. Buka tab **Actions → Deploy Server Pembayaran** (jalan otomatis; jika tidak, **Run workflow**). Tunggu ✅.
   Workflow ini menjalankan 31 uji dulu, baru deploy.
8. Alamat server Anda: `https://timebalance-api.<subdomain-akun-anda>.workers.dev`. Buka di browser. Jika muncul
   `{"ok":true,"service":"timebalance-api"}`, server hidup. (Subdomain terlihat di Workers & Pages → Overview.)

## C. QRIS + Token Aktivasi (pembayaran QRIS) ±beberapa hari (verifikasi)
1. Daftar di midtrans.com dan buat akun merchant. Verifikasi bisnis/identitas adalah proses mereka dan bisa memakan waktu. Cek syarat terbaru di situs QRIS + Token Aktivasi.
2. Selama menunggu, pakai mode **Sandbox**: ganti ke environment **Sandbox** di dashboard, lalu **Settings → Access Keys**. Salin **Server Key**
   sandbox (bentuknya `SB-Mid-server-...`) ke secret `MIDTRANS_SERVER_KEY`.
3. **Settings → Payment → Snap Preferences / Payment channels**: aktifkan **QRIS**.
4. **Settings → Configuration → Payment Notification URL** isi:
   `https://timebalance-api.<subdomain>.workers.dev/webhook` lalu simpan.
5. QRIS + Token Aktivasi umumnya meminta halaman **Privasi**, **Ketentuan**, dan kebijakan **refund** yang terisi di website. Di footer website Anda keduanya masih `#`. Isi sebelum go-live.

## D. Website ±10 menit
Salin dari folder `website/` ke repo website Anda (timpa file lama):
- `payment.html`
- `sukses.html`
- `assets/js/tb-auth.js`
- `assets/js/tb-config.js` ← **isi 3 nilai** (lihat bawah)

Isi `tb-config.js`:
```js
FIREBASE_API_KEY: "<Web API Key dari A3>",
API_BASE: "https://timebalance-api.<subdomain>.workers.dev",
SITE_URL: "https://domain-anda/"
```
Lalu:
- Pastikan tombol paket di `pricing.html` mengarah ke `payment.html?plan=monthly` atau `payment.html?plan=annual`.
- File lama yang tidak dipakai lagi (boleh dihapus): `assets/js/payment-v2.js`, `assets/images/qris.png`. EmailJS tidak dipakai lagi.
- Perbarui teks di website yang menyebut "tidak ada data dikirim ke server" (halaman Info/FAQ/Privasi). Sekarang email akun disimpan di Firebase dan status Premium di server.

## E. Aplikasi ±5 menit
1. Edit `www/tb-config.js` di GitHub: isi `FIREBASE_API_KEY`, `API_BASE`, `SITE_URL` (nilai yang sama dengan website).
2. Commit. GitHub membangun APK baru (lihat PANDUAN-APK.md). Pasang di HP.
3. Pilihan `REQUIRE_LOGIN`: `false` = login hanya saat beli/pulihkan Premium (bawaan); `true` = wajib login sejak awal.

---

## Uji coba end-to-end (Sandbox)
1. Di aplikasi: Profil → **Daftar** dengan email Anda → Premium → **Lanjut Bayar via QRIS** (halaman QRIS + Token Aktivasi terbuka).
2. Selesaikan pembayaran dengan **simulator pembayaran QRIS + Token Aktivasi Sandbox** (QRIS tersedia di sana; cari "QRIS + Token Aktivasi payment simulator").
3. Kembali ke aplikasi. Premium harus aktif sendiri (jika belum, Profil → **Sinkronkan**).
4. Uji juga: dari website `payment.html` → masuk dengan akun yang sama → bayar → halaman `sukses.html` menampilkan "Pembayaran berhasil".
5. Keluar akun di aplikasi → masuk lagi → Premium harus pulih.
6. Cek di QRIS + Token Aktivasi dashboard → **Transactions** bahwa transaksi tercatat, dan di Cloudflare → Workers → timebalance-api → **Logs** bila ada yang gagal.

## Go-live
1. Ubah `MIDTRANS_ENV = "production"` di `worker/wrangler.toml`.
2. Ganti secret `MIDTRANS_SERVER_KEY` dengan Server Key **production**, lalu Run workflow Deploy.
3. Di dashboard QRIS + Token Aktivasi **production**, isi lagi Payment Notification URL (pengaturan sandbox dan production terpisah) dan aktifkan QRIS.
4. `DEMO_TOGGLE = false` di `www/app.js`.
5. Bayar 1x dengan nominal asli, lalu refund bila perlu.

## Harga
Harga ditetapkan di server (`worker/src/index.js`, bagian `PLANS`), **bukan** dari aplikasi/website, supaya tidak bisa diakali.
Untuk mengubah harga: edit `PLANS` di server **dan** teks harga di `payment.html`, `www/app.js` (`rp(19000)`, `rp(50000)`), lalu deploy.

---

## Hal yang perlu Anda cek sendiri (jujur)
Server dan alur sudah saya uji dengan Firebase dan QRIS + Token Aktivasi **tiruan**, bukan layanan aslinya. Pengujian asli hanya bisa dilakukan Anda di Sandbox:
- **Rumus tanda tangan webhook QRIS + Token Aktivasi** (SHA-512 dari `order_id + status_code + gross_amount + Server Key`) saya tulis dari pengetahuan, bukan dari halaman dokumentasi yang terbaca utuh. Jika salah, webhook ditolak (HTTP 403) dan Premium tidak aktif. Jadi gagal dengan aman, tidak memberi Premium gratis. Tanda gejalanya: bayar di Sandbox berhasil tapi Premium tidak aktif, dan QRIS + Token Aktivasi menampilkan notifikasi gagal.
- **Endpoint dan pesan error Firebase REST** juga dari pengetahuan. Jika ada pesan error aneh saat daftar/masuk, kirim ke saya.
- **Cadangan cek status ke QRIS + Token Aktivasi** (saat webhook telat) mengandalkan balasan QRIS + Token Aktivasi memuat `signature_key`. Jika tidak, cadangan itu diabaikan dan webhook tetap jalan.
- **Aplikasi Android belum dijalankan di perangkat nyata.** Termasuk pembukaan halaman pembayaran lewat plugin Capacitor Browser.
- **QRIS dari HP yang sama** merepotkan: QR harus discan aplikasi lain. Di halaman QRIS + Token Aktivasi, pengguna bisa memilih e-wallet (mis. GoPay/ShopeePay) jika Anda aktifkan, yang membuka aplikasi e-wallet langsung. Aktifkan lewat dashboard QRIS + Token Aktivasi.
- Cloudflare KV bersifat *eventually consistent*: setelah bayar, Premium kadang baru terbaca sampai ±1 menit. Tombol **Sinkronkan** di Profil menyegarkannya.
- Satu akun = satu Premium yang bisa dipakai di banyak HP (login yang sama). Ini wajar untuk model akun, tapi berarti akun bisa dibagikan.
