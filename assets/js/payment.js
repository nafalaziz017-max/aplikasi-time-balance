/* payment.js — script khusus halaman payment */
  try { if (window.emailjs) emailjs.init({ publicKey: "0VSyjWsh1sFGcDHrO" }); } catch (e) {}

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


  function selectPlan(key) {

    const d = planData[key];

    if (!d) return;


    document.querySelectorAll(".plan-btn").forEach(function(btn) {

      btn.classList.toggle(
        "active",
        btn.dataset.plan === key
      );

    });


    document.getElementById("pay-plan-name").textContent = d.name;

    document.getElementById("pay-plan-price").textContent = d.price;

    document.getElementById("pay-plan-period").textContent = d.period;

    document.getElementById("pay-paket-confirm").value = d.confirm;

  }


  document.addEventListener(
    "DOMContentLoaded",
    function() {

      const p =
        new URLSearchParams(location.search).get("plan")
        || "monthly";


      if (planData[p]) {

        selectPlan(p);

      }


      if (typeof AOS !== "undefined") {

        AOS.init({
          duration: 700,
          once: true,
          offset: 80
        });

      }

    }
  );

/* ===== Konfirmasi pembayaran (EmailJS) =====
   Isi 2 nilai di bawah dari dashboard emailjs.com:
   Email Services -> Service ID, Email Templates -> Template ID.
   Variabel template yang dikirim: nama, email, paket, catatan */
const EMAILJS_SERVICE_ID  = "YOUR_SERVICE_ID";
const EMAILJS_TEMPLATE_ID = "YOUR_TEMPLATE_ID";

function showPayMsg(type, text){
  const box = document.getElementById("pay-msg");
  if (!box) return;
  box.className = "pay-msg " + type;
  box.textContent = text;
}

function confirmPayment(){
  const name  = (document.getElementById("pay-name")?.value || "").trim();
  const email = (document.getElementById("pay-email")?.value || "").trim();
  const note  = (document.getElementById("pay-note")?.value || "").trim();
  const paket = document.getElementById("pay-paket-confirm")?.value || "";

  if (!name || !email){
    showPayMsg("error", "Mohon isi Nama Lengkap dan Email Aktif terlebih dahulu.");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    showPayMsg("error", "Format email tidak valid.");
    return;
  }
  if (EMAILJS_SERVICE_ID === "YOUR_SERVICE_ID" || typeof emailjs === "undefined"){
    showPayMsg("error", "Sistem konfirmasi belum aktif. Silakan hubungi kami lewat Instagram @timebalance_ dengan bukti pembayaran.");
    return;
  }
  showPayMsg("success", "Mengirim konfirmasi...");
  emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    nama: name, email: email, paket: paket, catatan: note || "-"
  }).then(function(){
    showPayMsg("success", "✅ Konfirmasi terkirim! Kami akan memverifikasi dan mengaktifkan Premium Anda segera.");
  }, function(){
    showPayMsg("error", "Gagal mengirim konfirmasi. Coba lagi atau hubungi kami di Instagram @timebalance_.");
  });
}

