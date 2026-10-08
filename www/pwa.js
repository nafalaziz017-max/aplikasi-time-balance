/* TimeBalance PWA — pendaftaran service worker + pembaruan otomatis yang aman. */
(() => {
  "use strict";
  if (!("serviceWorker" in navigator) || (window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform())) return;
  const ok = location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname);
  if (!ok) return;
  const busy = () => { try { const s = JSON.parse(localStorage.getItem("tb-app-v2") || "{}"); return !!(s.run || s.leisure); } catch (e) { return false; } };
  let hadController = !!navigator.serviceWorker.controller, reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) { hadController = true; return; }          // pemasangan pertama: tidak perlu muat ulang
    if (reloaded) return;
    if (busy()) { const t = document.getElementById("toast"); if (t) { t.textContent = "Versi baru siap — akan dipakai setelah sesi selesai"; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 4000); } return; }
    reloaded = true; location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { scope: "./" }).then(reg => {
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(err => console.warn("[TimeBalance] Service worker gagal:", err));
  });
})();
