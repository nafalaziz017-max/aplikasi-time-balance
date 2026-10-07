# Admin Token TimeBalance

Pembayaran dilakukan di website menggunakan QRIS. Setelah pembayaran diverifikasi, admin membuat token di `tools/buat-token.html` dan mengirim token ke email pembeli.

## Penting
- `kunci-rahasia-timebalance.json` adalah kunci rahasia. JANGAN unggah ke GitHub, website, atau APK.
- Aplikasi hanya berisi kunci publik sehingga token dapat diverifikasi tanpa internet.
- Token bulanan berlaku 31 hari. Token tahunan berlaku 366 hari.

## Alur
1. Pembeli membuka `payment.html`.
2. Pembeli memilih paket dan membayar QRIS.
3. Pembeli mengirim konfirmasi + bukti pembayaran.
4. Admin memeriksa pembayaran.
5. Admin membuka `tools/buat-token.html` di komputer admin.
6. Masukkan kunci rahasia, pilih paket, buat token.
7. Kirim token ke pembeli.
8. Pembeli membuka aplikasi → Premium → masukkan token.
