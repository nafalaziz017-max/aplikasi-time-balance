# Cara Mendapatkan APK TimeBalance (otomatis lewat GitHub)

Anda **tidak perlu Android Studio**. GitHub akan membangun file `.apk` untuk Anda, gratis.

## 1. Unggah proyek ke GitHub
1. Ekstrak `timebalance-apk.zip`.
2. github.com → **New repository** → nama `timebalance-apk` → Create.
3. **uploading an existing file** → seret **isi** folder (folder `www`, `scripts`, `.github`, `package.json`, `capacitor.config.json`, `.gitignore`, `PANDUAN-APK.md`) → **Commit changes**.

> ⚠️ Folder `.github` kadang tersembunyi di komputer dan tidak ikut terseret. Pastikan di GitHub ada folder
> `.github/workflows/build-apk.yml`. Jika tidak ada: **Add file → Create new file**, ketik nama
> `.github/workflows/build-apk.yml`, lalu tempel isi file tersebut.

## 2. Tunggu GitHub membangun APK
1. Buka tab **Actions** di repo → workflow **Build APK TimeBalance** berjalan otomatis (±5–8 menit).
   Jika belum jalan: pilih workflow itu → **Run workflow**.
2. Tunggu tanda ✅ hijau. Jika ❌ merah, buka run-nya → salin pesan error ke saya.
3. Klik run yang ✅ → turun ke bagian **Artifacts** → unduh **TimeBalance-APK** (berupa zip berisi `app-debug.apk`).

## 3. Pasang di HP Android
1. Kirim `app-debug.apk` ke HP (WhatsApp/Drive/kabel).
2. Buka file → izinkan **"Instal dari sumber tidak dikenal"** jika diminta → Pasang.
3. Buka **TimeBalance** dari layar utama. Izinkan notifikasi saat diminta.

## 4. Yang berbeda dari versi web (khusus aplikasi)
- Tampil layar penuh sebagai aplikasi sungguhan, ikon di layar utama.
- **Notifikasi terjadwal tetap bunyi walau aplikasi ditutup**: akhir sesi fokus, akhir istirahat, waktu santai habis, jadwal harian, deadline < 1 jam.
- Tombol **Kembali** Android bekerja (tutup panel → ke Beranda → keluar).
- Backup dan Laporan dibagikan lewat menu Bagikan Android (simpan ke Drive/WhatsApp).
  Laporan berupa file HTML; buka di Chrome lalu Cetak → Simpan sebagai PDF.

## 5. Update aplikasi
Ubah file di folder `www/` (di GitHub: buka file → ikon pensil → Commit). GitHub membangun APK baru otomatis.
Setiap build menghasilkan APK baru; pasang di atas yang lama (data tetap).

## 6. Mengganti nama / ID aplikasi
`capacitor.config.json`: `appName` (nama di HP) dan `appId` (ID unik, mis. `com.namaanda.timebalance`).
**Tentukan `appId` sebelum rilis ke Play Store, karena tidak bisa diganti setelahnya.**

## 7. Rilis ke Google Play Store
APK di atas adalah versi **debug** (untuk dipasang langsung / dibagikan). Play Store butuh **AAB yang ditandatangani**:
1. Buat keystore sekali saja (di komputer dengan Java): 
   `keytool -genkey -v -keystore timebalance.jks -alias timebalance -keyalg RSA -keysize 2048 -validity 10000`
   **Simpan file & kata sandinya baik-baik. Jika hilang, aplikasi tidak bisa diperbarui.**
2. Beri tahu saya, dan saya tambahkan job release (menyimpan keystore sebagai GitHub Secret) agar GitHub menghasilkan `.aab` bertanda tangan.
3. Daftar akun Google Play Console (biaya sekali bayar ±US$25), siapkan ikon, screenshot, deskripsi, dan kebijakan privasi.

## 8. Sebelum rilis
Di `www/app.js` bagian atas: `DEMO_TOGGLE = false`, ganti kode di `CODES`, dan isi `SITE` dengan alamat website Anda.

## 9. Batasan jujur
- **Focus Lock** di versi ini mendeteksi saat Anda keluar dari aplikasi, tetapi belum bisa memblokir aplikasi lain secara paksa. Itu butuh fitur Android khusus (Accessibility Service) yang dikerjakan sebagai tahap lanjutan.
- APK ini belum saya jalankan di perangkat nyata. Build-nya berjalan di server GitHub, jadi jika ada error, kirim pesannya dan saya perbaiki.
