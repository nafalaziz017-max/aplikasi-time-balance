# Admin Panel

Buka `admin/index.html` untuk panel admin TimeBalance.

Alur: **QRIS → cek pembayaran → catat pembayaran → terbitkan token ECDSA → kirim token → pembeli aktivasi di aplikasi**.

Panel ini sengaja bersifat lokal untuk menghindari penyimpanan Private Key di server. Jika ingin multi-admin/riwayat tersentralisasi, perlu backend admin yang dilindungi autentikasi.
