# TimeBalance Website

Website resmi aplikasi TimeBalance — Pomodoro Timer & Manajemen Waktu dengan Work–Reward Mechanism.

---

## Struktur Folder

```
project/
│
├── index.html          → Home
├── about.html          → About / Tentang
├── info.html           → Informasi, Cara Kerja & FAQ
├── content.html        → Fitur Lengkap
├── pricing.html        → Harga Paket
├── payment.html        → Pembayaran (QRIS)
├── download.html       → Download APK
│
├── assets/
│   ├── images/
│   │   ├── logo.jpeg      ← Logo utama (salin dari images/logobaru1.jpeg milik Anda)
│   │   └── qris.png       ← TODO: Simpan gambar QRIS di sini
│   │
│   ├── apk/
│   │   └── app.apk        ← TODO: Simpan file APK di sini (opsional, bisa link eksternal)
│   │
│   ├── css/
│   │   ├── style.css       → Variabel, reset, layout dasar
│   │   ├── components.css  → Navbar, footer, tombol, card, form
│   │   └── responsive.css  → Media queries mobile
│   │
│   └── js/
│       ├── main.js         → Dark mode, loading, back-to-top, counter, FAQ
│       ├── navigation.js   → Navbar scroll, mobile menu, active link
│       ├── payment.js      → Payment UI, konfirmasi (TODO: sambungkan ke backend)
│       └── pricing.js      → (opsional: sudah inline di payment.html)
│
└── README.md
```

---

## Navigasi Antar Halaman

| Halaman        | Link CTA Utama                    |
|----------------|-----------------------------------|
| Home           | → Download APK, Lihat Paket       |
| About          | → Lihat Fitur, Download           |
| Info/FAQ       | → Download, Harga                 |
| Content/Fitur  | → Lihat Harga, Download           |
| Pricing        | → payment.html?plan=monthly/annual|
| Payment        | → (konfirmasi via form)           |
| Download       | → APK download                    |

---

## ✅ TODO — Isi Sebelum Deploy

### 1. Email Aktif
Cari semua teks `YOUR_ACTIVE_EMAIL` di seluruh file HTML dan ganti dengan email asli Anda.

File yang perlu diubah:
- `index.html`
- `about.html`
- `info.html`
- `content.html`
- `pricing.html`
- `payment.html`
- `download.html`

### 2. Link APK
Di file `assets/js/main.js`, ganti baris:
```js
const APK_DOWNLOAD_URL = "TODO_LINK_APK_SEBENARNYA";
```
Dengan link APK Anda. Contoh:
- Jika file lokal : `"assets/apk/app.apk"`
- Jika link Drive : `"https://drive.google.com/..."`
- Jika link langsung: `"https://..."` 

### 3. QRIS
Simpan gambar QRIS Anda di:
```
assets/images/qris.png
```
Gambar akan otomatis muncul di `payment.html`. Jika file belum ada, placeholder akan tampil.

### 4. Logo
Salin file logo Anda ke:
```
assets/images/logo.jpeg
```
(Sesuaikan ekstensi jika berbeda: .png, .jpg, dsb, lalu update semua tag `<img>`)

### 5. Payment Gateway (Opsional)
Di `assets/js/payment.js`, fungsi `confirmPayment()` saat ini hanya menampilkan pesan UI.
Sambungkan ke backend/API Anda untuk:
- Validasi pembayaran
- Kirim email aktivasi
- Update status premium di database

### 6. Versi & Ukuran APK
Di `download.html`, update informasi:
- Versi: `Versi 1.0.0`
- Ukuran: `~25 MB`

---

## Cara Menjalankan

Buka langsung `index.html` di browser (tidak perlu server lokal untuk fitur dasar). Untuk fitur payment backend, gunakan server lokal atau deploy ke hosting.

---

## Teknologi

- HTML5 Semantik
- CSS3 (modular, variabel, responsive)
- Vanilla JavaScript (ES6+)
- Google Fonts (Poppins)
- Font Awesome 6.5 (ikon)
- AOS 2.3.4 (animasi scroll)

---

## Kontak & Sosial Media

- Instagram: [@timebalance_](https://www.instagram.com/timebalance_)
- TikTok: [@timebalance1](https://www.tiktok.com/@timebalance1)
- Facebook: [TimeBalance](https://www.facebook.com/share/1AvatuDTF9/)
- Website: [timebalanceruang-rasamyid.biz.id](https://timebalanceruang-rasamyid.biz.id/)

---

© 2026 TimeBalance. Made with 💚 in Indonesia
