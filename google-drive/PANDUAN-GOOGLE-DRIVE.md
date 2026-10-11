# Bukti bayar otomatis masuk Google Drive

Alur: pengguna unggah foto bukti di aplikasi → server TimeBalance meneruskannya ke skrip Google
milikmu → foto tersimpan di folder Drive → tautannya muncul di panel admin (kolom "Bukti").

## 1. Buat folder di Drive
Buat folder, misalnya `Bukti Bayar TimeBalance`. Buka foldernya, lalu salin **ID folder**
(bagian terakhir alamat: drive.google.com/drive/folders/**INI-ID-NYA**).

## 2. Pasang skrip
1. Buka https://script.google.com → **Proyek baru**.
2. Hapus isinya, tempel seluruh isi file `Code.gs`, simpan.
3. **Project Settings (ikon gerigi) → Script properties → Add script property**, isi dua:
   - `FOLDER_ID` = ID folder dari langkah 1
   - `SECRET` = sandi acak buatanmu (20+ karakter). Catat, dipakai lagi di langkah 4.
4. **Deploy → New deployment → jenis: Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik Deploy, izinkan akses Drive saat diminta, lalu salin **Web app URL**
     (berakhiran `/exec`).

## 3. Cek cepat
Buka Web app URL di browser. Muncul tulisan JSON `{"ok":false,...}` atau halaman kosong = normal
(skrip hidup; ia hanya menerima kiriman POST dari server).

## 4. Dua secret di GitHub
Repo → Settings → Secrets and variables → Actions → New repository secret:
- `PROOF_WEBHOOK_URL` = Web app URL dari langkah 2
- `PROOF_SECRET` = sandi yang sama dengan `SECRET` di Script properties

Lalu jalankan ulang Actions → Deploy TimeBalance → Run workflow.
Di log langkah "Simpan secret server" harus muncul: `Bukti bayar -> Google Drive: AKTIF`.

## Catatan
- Selama dua secret itu kosong, unggah bukti tidak diwajibkan (alur lama tetap jalan).
- Setelah aktif, tombol "Saya sudah bayar" butuh foto bukti.
- Foto dikecilkan di HP (maks. 1280 px) sebelum dikirim, jadi hemat kuota.
- Bila kamu mengubah kode `Code.gs`, buat **New deployment** lagi atau pakai **Manage deployments →
  Edit → Version: New version**, supaya perubahan berlaku.
