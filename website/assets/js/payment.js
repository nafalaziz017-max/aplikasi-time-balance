/* =========================================================
   TIMEBALANCE - PAYMENT.JS
   Pilih paket + Upload bukti ke Google Drive + Notifikasi EmailJS
   ========================================================= */

const DRIVE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwl4mMuFCbTuXg6CZDC_7ZH701K9UUkwSJ_0Osu1M9ikLGjOwC9qR8OwDbV3NbQRSvK/exec";
const EMAILJS_SERVICE_ID  = "service_68x3qfg";
const EMAILJS_TEMPLATE_ID = "timebalance_payment";
const EMAILJS_PUBLIC_KEY  = "0VSyjWsh1sFGcDHrO";
const MAX_FILE_MB = 10;

if (typeof emailjs !== "undefined") {
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

const BTN_DEFAULT_HTML = '<i class="fas fa-paper-plane"></i> Saya Sudah Membayar — Konfirmasi';


/* =========================
   DATA PAKET
   ========================= */

const planData = {
  free: {
    name: "Free",
    price: "Rp 0",
    period: "Selamanya",
    confirm: "Free — Rp 0"
  },
  monthly: {
    name: "Premium Bulanan",
    price: "Rp 19.000",
    period: "per bulan",
    confirm: "Premium Bulanan — Rp 19.000"
  },
  annual: {
    name: "Premium Tahunan",
    price: "Rp 50.000",
    period: "per tahun",
    confirm: "Premium Tahunan — Rp 50.000"
  }
};


/* =========================
   PILIH PAKET
   ========================= */

function selectPlan(key) {
  const d = planData[key];
  if (!d) return;

  document.querySelectorAll(".plan-btn").forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.plan === key);
  });

  const planName     = document.getElementById("pay-plan-name");
  const planPrice    = document.getElementById("pay-plan-price");
  const planPeriod   = document.getElementById("pay-plan-period");
  const paketConfirm = document.getElementById("pay-paket-confirm");

  if (planName)     planName.textContent = d.name;
  if (planPrice)    planPrice.textContent = d.price;
  if (planPeriod)   planPeriod.textContent = d.period;
  if (paketConfirm) paketConfirm.value = d.confirm;
}

document.addEventListener("DOMContentLoaded", function () {
  const params = new URLSearchParams(window.location.search);
  const selectedPlan = params.get("plan") || "monthly";
  if (planData[selectedPlan]) selectPlan(selectedPlan);

  if (typeof AOS !== "undefined") {
    AOS.init({ duration: 700, once: true, offset: 80 });
  }
});


/* =========================
   PESAN STATUS
   ========================= */

function showPaymentMessage(type, text) {
  const message = document.getElementById("pay-msg");
  if (!message) return;

  message.style.display = "block";
  message.textContent = text;

  if (type === "success")      message.className = "pay-msg success";
  else if (type === "error")   message.className = "pay-msg error";
  else                         message.className = "pay-msg";
}


/* =========================
   UPLOAD BUKTI PEMBAYARAN
   ========================= */

let proofDataUrl = null;

const proofInput = document.getElementById("pay-proof");
const uploadBox  = document.getElementById("upload-box");

if (proofInput) {
  proofInput.addEventListener("change", function (e) {
    handleFile(e.target.files[0]);
  });
}

if (uploadBox) {
  ["dragenter", "dragover"].forEach(function (ev) {
    uploadBox.addEventListener(ev, function (e) {
      e.preventDefault();
      uploadBox.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach(function (ev) {
    uploadBox.addEventListener(ev, function (e) {
      e.preventDefault();
      uploadBox.classList.remove("dragover");
    });
  });

  uploadBox.addEventListener("drop", function (e) {
    handleFile(e.dataTransfer.files[0]);
  });
}

async function handleFile(file) {
  if (!file) return;

  if (!["image/png", "image/jpeg"].includes(file.type)) {
    showPaymentMessage("error", "❌ Format file harus PNG atau JPG.");
    return removeProof();
  }

  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    showPaymentMessage("error", "❌ Ukuran file maksimal " + MAX_FILE_MB + " MB.");
    return removeProof();
  }

  try {
    proofDataUrl = await compressImage(file);
    document.getElementById("proof-img").src = proofDataUrl;
    document.getElementById("proof-preview").style.display = "inline-block";
    document.getElementById("upload-text").textContent = file.name;
    document.getElementById("pay-msg").className = "pay-msg";
  } catch (err) {
    showPaymentMessage("error", "❌ Gagal membaca gambar, coba file lain.");
    removeProof();
  }
}

function removeProof() {
  proofDataUrl = null;
  if (proofInput) proofInput.value = "";
  const preview = document.getElementById("proof-preview");
  const text = document.getElementById("upload-text");
  if (preview) preview.style.display = "none";
  if (text) text.textContent = "Klik untuk pilih foto bukti bayar";
}

function compressImage(file, maxW, quality) {
  maxW = maxW || 1600;
  quality = quality || 0.85;

  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = function () {
      const img = new Image();
      img.onerror = reject;
      img.onload = function () {
        const w = Math.min(img.width, maxW);
        const h = Math.round(img.height * (w / img.width));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}


/* =========================
   KONFIRMASI PEMBAYARAN
   ========================= */

async function confirmPayment() {
  const nameInput  = document.getElementById("pay-name");
  const emailInput = document.getElementById("pay-email");
  const noteInput  = document.getElementById("pay-note");
  const paketInput = document.getElementById("pay-paket-confirm");
  const button     = document.getElementById("btn-confirm");

  const name    = nameInput  ? nameInput.value.trim()  : "";
  const email   = emailInput ? emailInput.value.trim() : "";
  const catatan = noteInput  ? noteInput.value.trim()  : "";
  const paket   = paketInput ? paketInput.value        : "";

  /* ----- Validasi ----- */
  if (!name) {
    showPaymentMessage("error", "❌ Nama lengkap wajib diisi.");
    if (nameInput) nameInput.focus();
    return;
  }

  if (!email) {
    showPaymentMessage("error", "❌ Email wajib diisi.");
    if (emailInput) emailInput.focus();
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showPaymentMessage("error", "❌ Masukkan alamat email yang valid.");
    if (emailInput) emailInput.focus();
    return;
  }

  if (!proofDataUrl) {
    showPaymentMessage("error", "❌ Silakan upload bukti pembayaran terlebih dahulu.");
    return;
  }

  /* ----- Harga & waktu ----- */
  let harga = "Rp 0";
  if (paket.includes("19.000")) harga = "Rp 19.000";
  else if (paket.includes("50.000")) harga = "Rp 50.000";

  const waktu = new Date().toLocaleString("id-ID", {
    dateStyle: "full",
    timeStyle: "short"
  });

  /* ----- Loading ----- */
  showPaymentMessage("loading", "⏳ Sedang mengirim bukti pembayaran...");

  if (button) {
    button.disabled = true;
    button.style.opacity = "0.7";
    button.style.cursor = "not-allowed";
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...';
  }

  try {
    /* 1) Upload foto ke Google Drive */
    const res = await fetch(DRIVE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        name: name,
        email: email,
        note: catatan || "-",
        paket: paket,
        image: proofDataUrl
      })
    });

    const out = await res.json();
    if (!out.ok) throw new Error(out.error || "Upload ke Drive gagal.");

    /* 2) Kirim notifikasi email ke admin (berisi link foto di Drive) */
    if (typeof emailjs !== "undefined") {
      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          name: name,
          email: email,
          paket: paket,
          harga: harga,
          catatan: catatan || "-",
          waktu: waktu,
          proof_url: out.url
        });
      } catch (mailErr) {
        console.warn("Notifikasi EmailJS gagal, tapi bukti sudah masuk Drive:", mailErr);
      }
    }

    showPaymentMessage(
      "success",
      "✅ Bukti pembayaran berhasil dikirim. Silakan tunggu verifikasi dari admin (maks. 1×24 jam)."
    );

    if (nameInput)  nameInput.value = "";
    if (emailInput) emailInput.value = "";
    if (noteInput)  noteInput.value = "";
    removeProof();

  } catch (error) {
    console.error("Payment Error:", error);
    showPaymentMessage(
      "error",
      "❌ Gagal mengirim: " + (error && error.message ? error.message : "terjadi kesalahan.")
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.style.opacity = "1";
      button.style.cursor = "pointer";
      button.innerHTML = BTN_DEFAULT_HTML;
    }
  }
}