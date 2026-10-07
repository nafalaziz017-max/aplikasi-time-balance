# TimeBalance — Kontrak Sinkron APK ↔ Admin Panel

Versi: Production Token v1

## Public Key produksi (HARUS SAMA)
```json
{"kty":"EC","crv":"P-256","x":"AT0Z8kHRr0VzlN6ijRZ_pvRj8gp3TJn71i3C9uTl3xs","y":"7IgJnqrQFa8W-WNoIcFZWdk_ndrrUhFWTWVyNFY9lLA"}
```

- Admin Panel: `website/admin/index.html`
- APK verifier: `apk-source/www/app.js`
- APK config: `apk-source/www/tb-config.js`
- Private Key: TIDAK disertakan dalam paket website/APK.

## Format token
`TB1.<payload-base64url>.<signature-base64url>`

Payload minimal:
- `v`: 1
- `iss`: `TimeBalance`
- `i`: token id unik
- `p`: `monthly` atau `annual`
- `d`: jumlah hari Premium
- `n`: email akun
- `x`: batas waktu aktivasi (Unix milliseconds)

Signature: ECDSA P-256 + SHA-256 atas string `TB1.<payload-base64url>`.

## Alur
1. Admin buka `/admin/`.
2. Tempel Private Key produksi secara lokal di browser admin.
3. Klik **Cek Private Key**. Harus muncul bahwa key cocok dengan APK produksi.
4. Masukkan email pembeli, paket, dan masa Premium.
5. Klik **Buat Token Premium**.
6. Pembeli login di APK menggunakan email yang sama.
7. Pembeli memasukkan token.
8. APK memverifikasi signature, issuer, email, paket, masa berlaku, dan batas aktivasi.

Jangan pernah memasukkan Private Key ke APK, `tb-config.js`, website publik, GitHub, atau file ZIP yang akan diunggah ke Vercel.
