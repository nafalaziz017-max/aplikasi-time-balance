# TimeBalance — Paket Sinkron Produksi

Website Admin Panel dan APK source memakai Public Key produksi yang sama.

Format token: TB1.<payload-base64url>.<signature-base64url>
Algoritma: ECDSA P-256 + SHA-256
Issuer: TimeBalance
Paket: monthly=31 hari, annual=366 hari

PENTING: APK yang terpasang di HP harus dibuild dari folder `apk-source/` pada paket ini. APK lama yang masih membawa kunci/validator versi sebelumnya tidak otomatis berubah.

Private Key produksi tidak disertakan dalam paket ini.
