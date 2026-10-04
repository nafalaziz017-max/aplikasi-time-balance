/* Pengaturan TimeBalance. Isi 2 nilai di bawah. File ini AMAN dipublikasikan (bukan rahasia).
   Salinan yang sama dipakai di aplikasi (www/tb-config.js) dan website (assets/js/tb-config.js). */
window.TB_CONFIG = {
  // Firebase Console → Project settings → General → "Web API Key"
  FIREBASE_API_KEY: "GANTI-API-KEY-FIREBASE",
  // Alamat server pembayaran (Cloudflare Worker), tanpa garis miring di akhir
  API_BASE: "https://timebalance-api.GANTI-SUBDOMAIN.workers.dev",
  // Alamat website Anda (untuk tombol "Website" di aplikasi), contoh "https://timebalance.com/"
  SITE_URL: "https://GANTI-DOMAIN-WEBSITE/",
  // Khusus aplikasi: true = wajib login sebelum memakai aplikasi, false = login hanya untuk membeli/memulihkan Premium
  REQUIRE_LOGIN: false
};
