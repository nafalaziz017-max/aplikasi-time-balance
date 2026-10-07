# Admin Panel TimeBalance

Panel ini dipakai untuk alur **QRIS manual → verifikasi pembayaran → terbitkan token Premium**.

## Penting
- Panel menyimpan daftar pembayaran **secara lokal di browser** (localStorage), bukan di server.
- Private Key **tidak disimpan** oleh panel. Saat menerbitkan token, Private Key hanya dipakai di memori browser.
- Jangan memasukkan Private Key ke GitHub, website publik, APK, atau chat.
- Untuk penggunaan produksi yang lebih kuat, panel dapat dipasang di balik Cloudflare Access atau sistem admin server-side.

## Cara pakai
1. Pastikan APK memakai Public Key yang pasangan Private Key-nya kamu simpan.
2. Buka `admin/index.html` dari komputer admin atau melalui hosting HTTPS yang aman.
3. Setelah pembayaran QRIS diverifikasi di mutasi, catat pembeli pada tab **Pembayaran**.
4. Buka **Terbitkan Token**, pilih pembayaran, tempel Private Key, lalu buat token.
5. Kirim token ke email pembeli.
6. Pembeli login di aplikasi dengan email yang sama lalu memasukkan token.

## Jika belum punya pasangan kunci
Gunakan tab **Kunci** untuk membuat pasangan baru. Simpan Private Key offline. Salin Public Key ke `www/app.js`, lalu build APK baru. Jangan membuat pasangan baru setelah APK dibagikan kecuali kamu siap membangun APK baru.
