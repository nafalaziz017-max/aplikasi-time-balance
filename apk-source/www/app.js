/* TimeBalance PWA v2 — Work–Reward Mechanism */
"use strict";
/* ===================== KONFIGURASI ===================== */
const SITE = (window.TB_CONFIG && window.TB_CONFIG.SITE_URL && !/GANTI/.test(window.TB_CONFIG.SITE_URL)) ? window.TB_CONFIG.SITE_URL : "";
const EMAIL = "nafalaziz016@gmail.com";
const DEMO_TOGGLE = false;   // true = tampilkan sakelar "Mode Demo Premium" di Profil. Ubah ke false saat rilis.
/* Token Premium: dibuat pemilik lewat tools/buat-token.html, diverifikasi di sini dengan KUNCI PUBLIK (aman dibaca siapa pun).
   Isi PUBLIC_KEY dengan baris yang muncul di alat pembuat token. Selama masih null, aplikasi menolak semua token. */
const PUBLIC_KEY = (window.TB_CONFIG && window.TB_CONFIG.TOKEN_PUBLIC_KEY) ? window.TB_CONFIG.TOKEN_PUBLIC_KEY : {"kty":"EC","crv":"P-256","x":"AT0Z8kHRr0VzlN6ijRZ_pvRj8gp3TJn71i3C9uTl3xs","y":"7IgJnqrQFa8W-WNoIcFZWdk_ndrrUhFWTWVyNFY9lLA"};
const PLANS = { monthly: "Premium Bulanan", annual: "Premium Tahunan", demo: "Demo 3 Hari" };
const b64d = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), c => c.charCodeAt(0));
function derToP1363(bytes, size) {
  try {
    if (bytes[0] !== 0x30) return null;
    let p = 2;
    if (bytes[1] & 0x80) p += (bytes[1] & 0x7f);
    if (bytes[p++] !== 0x02) return null;
    let lr = bytes[p++]; if (lr & 0x80) { const n = lr & 0x7f; lr = 0; for (let i=0;i<n;i++) lr = (lr<<8)|bytes[p++]; }
    const r = bytes.slice(p, p+lr); p += lr;
    if (bytes[p++] !== 0x02) return null;
    let ls = bytes[p++]; if (ls & 0x80) { const n = ls & 0x7f; ls = 0; for (let i=0;i<n;i++) ls = (ls<<8)|bytes[p++]; }
    const ss = bytes.slice(p, p+ls);
    const out = new Uint8Array(size*2);
    const rr = r[0]===0 ? r.slice(1) : r; const ss2 = ss[0]===0 ? ss.slice(1) : ss;
    out.set(rr.slice(-size), size- Math.min(size,rr.length)); out.set(ss2.slice(-size), size*2-Math.min(size,ss2.length));
    return out;
  } catch { return null; }
}
async function verifyToken(raw) {
  const m = /^TB1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(raw).replace(/\s+/g, ""));
  if (!m) return { err: "Format token tidak dikenal" };
  if (!PUBLIC_KEY) return { err: "Aplikasi belum diatur untuk token" };
  if (!(window.crypto && crypto.subtle)) return { err: "Perangkat tidak mendukung verifikasi token" };
  try {
    const key = await crypto.subtle.importKey("jwk", PUBLIC_KEY, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const message = new TextEncoder().encode("TB1." + m[1]);
    const sig = b64d(m[2]);
    let ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, sig, message);
    // Kompatibilitas tambahan: beberapa implementasi lama dapat membawa ECDSA P-256 sebagai DER.
    if (!ok) {
      const raw = derToP1363(sig, 32);
      if (raw) ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, raw, message);
    }
    if (!ok) return { err: "Signature token tidak cocok dengan kunci produksi" };
    const t = JSON.parse(new TextDecoder().decode(b64d(m[1])));
    if (t.v !== 1 || t.iss !== "TimeBalance" || typeof t.i !== "string" || !PLANS[t.p] || !Number.isInteger(t.d) || t.d < 1 || t.d > 400 || typeof t.n !== "string" || !t.n.trim()) return { err: "Token tidak valid" };
     if (t.p === "monthly" && t.d !== 31) return { err: "Token bulanan tidak valid" };
     if (t.p === "annual" && t.d !== 366) return { err: "Token tahunan tidak valid" };
    if (t.x && Date.now() > t.x) return { err: "Token kedaluwarsa, hubungi admin" };
    return { id: t.i, plan: t.p, days: t.d, email: t.n.trim().toLowerCase() };
  } catch (e) { return { err: "Token tidak valid" }; }
}
/* ======================================================= */
const K = "tb-app-v2", DAY = 864e5;
const $ = (s, e = document) => e.querySelector(s);
const P = n => String(n).padStart(2, "0");
const uid = () => Math.random().toString(36).slice(2, 9);
const dkey = t => { const d = new Date(t); return d.getFullYear() + "-" + P(d.getMonth() + 1) + "-" + P(d.getDate()); };
const mmss = s => { s = Math.max(0, Math.ceil(s)); return P(Math.floor(s / 60)) + ":" + P(s % 60); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const r1 = n => Math.round(n * 10) / 10;
const rp = n => "Rp " + n.toLocaleString("id-ID");

const IC = { home: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z", check: "M5 13l4 4L19 7", timer: "M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9v4l2.5 2M9 2h6", wallet: "M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2zM17 14.5h.01", chart: "M4 20V10M10 20V4M16 20v-7M22 20H2", plus: "M12 5v14M5 12h14", lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4", star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z", fire: "M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z", bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4", moon: "M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z", trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13", play: "M7 4l13 8-13 8z", pause: "M7 4h4v16H7zM13 4h4v16h-4z", skip: "M5 4l10 8-10 8zM19 4v16", stop: "M6 6h12v12H6z", search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5", close: "M6 6l12 12M18 6L6 18", crown: "M3 8l4 4 5-7 5 7 4-4-2 11H5z", shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", download: "M12 4v12M7 11l5 5 5-5M5 20h14", cal: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4", sliders: "M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6", info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 8h.01", bolt: "M13 2L4 14h7l-1 8 9-12h-7z", gift: "M4 10h16v10H4zM3 7h18v3H3zM12 7v13", file: "M6 3h9l4 4v14H6zM14 3v5h5", cloud: "M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z", target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5", mail: "M3 5h18v14H3zM3 6l9 7 9-7", user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" };
const ic = (n, c = "") => `<svg class="i ${c}" viewBox="0 0 24 24"><path d="${IC[n]}"/></svg>`;

/* ---------- Jembatan Android (Capacitor/APK). Di web biasa semua fungsi ini tidak berefek ---------- */
const CAP = () => window.Capacitor;
const isNative = () => !!(CAP() && CAP().isNativePlatform && CAP().isNativePlatform());
const NL = () => isNative() && CAP().Plugins && CAP().Plugins.LocalNotifications;
let nTimer;
const nid = s => 10000 + (Array.from(String(s)).reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) >>> 0) % 900000;
async function nPerm() { const n = NL(); if (!n) return false; try { let p = await n.checkPermissions(); if (p.display !== "granted") p = await n.requestPermissions(); return p.display === "granted"; } catch (e) { return false; } }
function nCancel(ids) { const n = NL(); if (n && ids.length) n.cancel({ notifications: ids.map(id => ({ id })) }).catch(() => {}); }
function nSched(id, title, body, at, daily) {
  const n = NL(); if (!n || !S.notif) return;
  const schedule = daily ? { on: { hour: daily[0], minute: daily[1] }, allowWhileIdle: true } : { at: new Date(at), allowWhileIdle: true };
  n.schedule({ notifications: [{ id, title, body, schedule }] }).catch(() => {});
}
function nRun(r) { nCancel([1]); if (r && !r.paused) nSched(1, r.phase === "focus" ? "🍅 Sesi fokus selesai!" : "☕ Istirahat selesai", r.phase === "focus" ? "Buka TimeBalance untuk mengambil reward waktu santai." : "Siap fokus lagi?", r.end); }
function nQueue() { if (!NL()) return; clearTimeout(nTimer); nTimer = setTimeout(nSync, 1200); }
function nSync() {
  if (!NL() || !S.notif) return; nCancel(S.nids || []); const ids = [];
  S.sched.forEach(s => { const id = nid("s" + s.id), hm = s.time.split(":").map(Number); nSched(id, "⏰ Jadwal", s.title, 0, hm); ids.push(id); });
  S.tasks.forEach(t => { if (!t.done && t.due) { const at = new Date(t.due).getTime() - 36e5; if (at > Date.now()) { const id = nid("d" + t.id); nSched(id, "⚠️ Deadline < 1 jam", t.title, at); ids.push(id); } } });
  S.nids = ids; try { localStorage.setItem(K, JSON.stringify(S)); } catch (e) {}
}
async function nativeInit() {
  if (!isNative()) return;
  if (await nPerm()) { S.notif = true; save(); nSync(); nRun(S.run); if (S.leisure) nSched(2, "⏰ Waktu santai habis", "Kembali produktif!", S.leisure.end); }
  const app = CAP().Plugins.App, br = CAP().Plugins.Browser;
  if (br) br.addListener("browserFinished", () => syncPremium(true));
  if (app) app.addListener("appStateChange", st => { if (st.isActive) syncPremium(false); });
  if (app) app.addListener("backButton", () => { if (!$("#sheet").hidden) { if (!S.onb || authLock) return; closeSheet(); } else if (S.tab !== "home") { S.tab = "home"; render(); } else app.exitApp(); });
}
async function nShareFile(name, data, title) { const P = CAP().Plugins, f = await P.Filesystem.writeFile({ path: name, data, directory: "CACHE", encoding: "utf8" }); await P.Share.share({ title, files: [f.uri] }); }

/* ---------- Akun & Premium dari server ---------- */
let authLock = false, authMode = "in", authIntent = "", authBusy = false, sheetKind = "", lastSync = 0;
const AUTHOK = () => !!(window.TBAuth && TBAuth.configured());
const REQUIRE_LOGIN = !!(window.TB_CONFIG && window.TB_CONFIG.REQUIRE_LOGIN === true);
function gate() { if (REQUIRE_LOGIN && AUTHOK() && !TBAuth.user()) { authLock = true; authSheet("in", ""); } }
async function syncPremium(manual) {
  if (!window.TBAuth || !TBAuth.user()) return;
  if (!manual && !S.pendingOrder && Date.now() - lastSync < 15000) return;
  lastSync = Date.now();
  try {
    if (S.pendingOrder) { try { const st = await TBAuth.orderStatus(S.pendingOrder); if (st.status !== "pending") S.pendingOrder = ""; } catch (e) { if (e.code !== "NETWORK") S.pendingOrder = ""; } }
    const p = await TBAuth.fetchPremium(), had = prem();
    if (p) { if (!S.premium || S.premium.src !== "token" || p.until >= S.premium.until) S.premium = { plan: p.plan, until: p.until, src: "acct" }; }
    else if (S.premium && S.premium.src === "acct") S.premium = null;
    save(); render();
    if (sheetKind === "profile") profile(); else if (sheetKind === "paywall") { if (prem()) closeSheet(); else paywall(); }
    if (p && !had) toast("Premium aktif 🎉"); else if (manual) toast(p ? "Premium aktif s/d " + new Date(p.until).toLocaleDateString("id-ID") : "Belum ada Premium di akun ini");
  } catch (e) { if (manual) toast(e.message); }
}
function authSheet(mode, intent) {
  authMode = mode || "in"; if (intent !== undefined) authIntent = intent; sheetKind = "auth";
  const up = authMode === "up", rs = authMode === "reset";
  const sub = rs ? "Masukkan email akun Anda. Kami kirim tautan untuk membuat kata sandi baru." : up ? "Akun menyimpan Premium Anda agar bisa dipulihkan di HP lain." : authIntent === "buy" ? "Masuk dulu agar Premium tersimpan di akunmu." : "Masuk ke akun TimeBalance Anda.";
  const lnk = (m, t) => `<a class="lnk" data-act="authmode" data-v="${m}">${t}</a>`;
  sheet(`<div class="row sp"><h2 style="margin:0">${rs ? "Lupa Kata Sandi" : up ? "Buat Akun" : "Masuk"}</h2>${authLock ? "" : `<button class="b sm o" data-act="close">${ic("close")}</button>`}</div>
  <p class="mu" style="margin:8px 0 14px">${sub}</p>
  <form data-form="auth"><label class="l">Email</label><input name="email" type="email" autocomplete="email" autocapitalize="off" required/>
  ${rs ? "" : `<label class="l">Kata sandi${up ? " (minimal 8 karakter)" : ""}</label><input name="password" type="password" autocomplete="${up ? "new-password" : "current-password"}" minlength="${up ? 8 : 1}" required/>`}
  <button class="b full">${rs ? "Kirim Tautan Reset" : up ? "Daftar" : "Masuk"}</button></form>
  <p class="mu center" style="margin-top:14px">${rs ? lnk("in", "Kembali ke Masuk") : up ? "Sudah punya akun? " + lnk("in", "Masuk") : lnk("up", "Belum punya akun? Daftar") + " · " + lnk("reset", "Lupa kata sandi?")}</p>`);
}
async function doAuth(d) {
  if (authBusy) return; authBusy = true;
  const email = String(d.get("email") || "").trim(), pw = d.get("password") || "", mode = authMode;
  const btn = document.querySelector('form[data-form="auth"] button'); if (btn) btn.disabled = true;
  try {
    if (mode === "reset") { await TBAuth.resetPassword(email); toast("Tautan reset dikirim. Cek email Anda."); authSheet("in"); return; }
    if (mode === "up") await TBAuth.signUp(email, pw); else await TBAuth.signIn(email, pw);
    authLock = false; sheetKind = ""; closeSheet(); render();
    toast(mode === "up" ? "Akun dibuat 🎉" : "Berhasil masuk ✅");
    await syncPremium(true);
    const it = authIntent; authIntent = ""; if (it === "buy" && !prem()) buy();
  } catch (e) { toast(e.message); if (btn) btn.disabled = false; }
  finally { authBusy = false; }
}
function openUrl(u) {
  const B = isNative() && CAP().Plugins && CAP().Plugins.Browser;
  if (B) B.open({ url: u }); else if (!window.open(u, "_blank", "noopener")) location.href = u;
}
function buy() {
  const base = SITE || "https://timebalanceruang-rasamyid.biz.id/";
  const u = base.replace(/\/$/, "") + "/payment.html?plan=" + encodeURIComponent(S.plan);
  openUrl(u);
}
function accountCard() {
  if (!AUTHOK()) return "";
  const u = TBAuth.user();
  return u ? `<div class="card"><div class="row sp"><div><b>Akun</b><div class="mu">${esc(u.email)}</div></div><button class="b sm o" data-act="syncprem">Sinkronkan</button></div><button class="b sm red" data-act="logout" style="margin-top:10px">Keluar</button></div>`
    : `<div class="card"><b>Akun</b><p class="mu" style="margin:4px 0 10px">Masuk agar Premium tersimpan di akun dan bisa dipulihkan di HP lain.</p><div class="row"><button class="b sm" data-act="login">Masuk</button><button class="b sm o" data-act="signup">Daftar</button></div></div>`;
}
if (window.TBAuth) TBAuth.onChange(u => { if (!u) { if (S.premium && S.premium.src === "acct") { S.premium = null; save(); } render(); gate(); } });

const DEF = { name: "", onb: 0, tasks: [], sched: [], log: [], wallet: 0, xp: 0, cyc: 0, streak: { last: "", n: 0 }, badges: {}, run: null, leisure: null, fired: {},
  premium: null, pendingOrder: "", demo: false, theme: "auto", snd: true, vib: true, notif: false, goal: 120, tab: "home", seg: "todo", flt: "all", sseg: "an", range: 7, plan: "monthly",
  rules: { focus: 25, brk: 5, long: 15, ratio: 25, strict: false, lock: false } };
let S, q = "", dp = null, ovOpen = false;
try { S = Object.assign({}, DEF, JSON.parse(localStorage.getItem(K) || "{}")); S.rules = Object.assign({}, DEF.rules, S.rules); } catch (e) { S = JSON.parse(JSON.stringify(DEF)); }
const save = () => { try { localStorage.setItem(K, JSON.stringify(S)); } catch (e) {} nQueue(); };
const prem = () => (DEMO_TOGGLE && S.demo) || !!(S.premium && S.premium.until > Date.now());
const R = () => prem() ? S.rules : Object.assign({}, S.rules, { focus: 25, brk: 5, long: 15, ratio: 25, strict: false, lock: false });
const ratio = () => R().ratio + (prem() ? Math.min(10, S.streak.n * 2) : 0);   // Dynamic Time Quota
const level = () => Math.floor(S.xp / 100) + 1;
const planName = () => DEMO_TOGGLE && S.demo ? "Premium (Demo)" : S.premium && S.premium.until > Date.now() ? S.premium.plan : "Gratis";

/* ---------- UI util ---------- */
let tt, reg = null;
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 2800); }
function notify(title, body) {
  toast(title + (body ? " — " + body : ""));
  if (S.vib) try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
  if (S.snd) try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(); o.connect(a.destination); o.frequency.value = 880; o.start(); setTimeout(() => o.stop(), 250); } catch (e) {}
  if (!isNative() && S.notif && "Notification" in window && Notification.permission === "granted") try { reg ? reg.showNotification(title, { body, icon: "icons/icon-192.png", badge: "icons/icon-192.png" }) : new Notification(title, { body }); } catch (e) {}
}
const addLog = (type, min, x) => S.log.push(Object.assign({ ts: Date.now(), type, min }, x || {}));
function sheet(html, cls = "") { const s = $("#sheet"); s.innerHTML = `<div class="bk" data-act="close"></div><div class="pn ${cls}">${cls === "full" ? "" : '<div class="grab"></div>'}${html}</div>`; s.hidden = false; ovOpen = true; }
function closeSheet() { sheetKind = ""; $("#sheet").hidden = true; $("#sheet").innerHTML = ""; ovOpen = false; }
const switchRow = (icon, t, d, k, on, locked) => `<div class="li"><div class="ico ${locked ? "gold" : ""}">${ic(icon)}</div><div>${t}${locked ? " 🔒" : ""}<small>${d}</small></div><label class="sw"><input type="checkbox" data-act="tg" data-k="${k}" ${on ? "checked" : ""}/><i></i></label></div>`;

/* ---------- statistik & badge ---------- */
function stats() {
  const f = S.log.filter(l => l.type === "focus");
  return { sess: f.length, fmin: f.reduce((a, l) => a + l.min, 0), tdone: S.tasks.filter(t => t.done).length, earned: S.log.reduce((a, l) => a + (l.earn || 0), 0), used: S.log.filter(l => l.type === "leisure").reduce((a, l) => a + l.min, 0) };
}
const BADGES = [
  ["first_task", "🌱", "Tugas Pertama", "Selesaikan 1 tugas", s => s.tdone >= 1], ["ten_tasks", "🏅", "10 Tugas", "Selesaikan 10 tugas", s => s.tdone >= 10],
  ["first_focus", "🍅", "Fokus Pertama", "1 sesi fokus", s => s.sess >= 1], ["five_focus", "🔥", "5 Sesi Fokus", "5 sesi fokus", s => s.sess >= 5],
  ["f100", "⏱️", "100 Menit", "100 menit fokus", s => s.fmin >= 100], ["f500", "🚀", "500 Menit", "500 menit fokus", s => s.fmin >= 500],
  ["st3", "📅", "Streak 3", "3 hari beruntun", () => S.streak.n >= 3], ["st7", "👑", "Streak 7", "7 hari beruntun", () => S.streak.n >= 7],
  ["lv5", "⭐", "Level 5", "Capai level 5", () => level() >= 5], ["reward60", "🎁", "60 Menit Reward", "Dapat 60 menit santai", s => s.earned >= 60]
];
function checkBadges() { if (!prem()) return; const s = stats(); BADGES.forEach(b => { if (!S.badges[b[0]] && b[4](s)) { S.badges[b[0]] = Date.now(); notify("🏆 Achievement!", b[2]); } }); }
function bumpStreak() { const t = dkey(Date.now()); if (S.streak.last === t) return; S.streak.n = S.streak.last === dkey(Date.now() - DAY) ? S.streak.n + 1 : 1; S.streak.last = t; }
const todayFocus = () => S.log.filter(l => l.type === "focus" && dkey(l.ts) === dkey(Date.now())).reduce((a, l) => a + l.min, 0);
function ring(pct, size, w, color, inner) {
  const r = (size - w) / 2, C = 2 * Math.PI * r;
  return `<div class="ringw" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(128,150,120,.25)" stroke-width="${w}"/><circle id="arc" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.min(1, pct))}"/></svg><div class="ringt">${inner}</div></div>`;
}

/* ---------- tugas ---------- */
const PR = { 1: "Rendah", 2: "Sedang", 3: "Tinggi" }, BONUS = { 1: 3, 2: 5, 3: 8 };
function completeTask(id) {
  const t = S.tasks.find(x => x.id === id); if (!t) return; t.done = !t.done;
  if (t.done) { t.doneAt = Date.now(); const b = BONUS[t.prio] * (prem() && S.streak.n >= 3 ? 1.25 : 1); S.wallet += b; S.xp += t.prio * 10; addLog("task", 0, { earn: b }); bumpStreak(); notify("✅ Tugas selesai", `+${r1(b)} menit waktu santai`); checkBadges(); }
  else t.doneAt = 0; save(); render();
}
function taskRows(list) {
  const now = Date.now();
  return list.map(t => {
    const late = !t.done && t.due && new Date(t.due).getTime() < now;
    const subs = (t.subs || []).map((s, i) => `<div class="sub"><button class="ck ${s.d ? "on" : ""}" data-act="sub" data-id="${t.id}" data-i="${i}">${s.d ? ic("check") : ""}</button><span style="${s.d ? "text-decoration:line-through;opacity:.5" : ""}">${esc(s.t)}</span></div>`).join("");
    return `<div class="task ${t.done ? "done" : ""}"><button class="ck ${t.done ? "on" : ""}" data-act="done" data-id="${t.id}" aria-label="Selesai">${t.done ? ic("check") : ""}</button><div style="flex:1" data-act="editTask" data-id="${t.id}"><div class="tt">${esc(t.title)}</div><div class="tg"><span class="tag p${t.prio}">${PR[t.prio]}</span>${t.est ? `<span class="tag">⏱ ${t.est}m</span>` : ""}${t.due ? `<span class="tag ${late ? "late" : ""}">📅 ${t.due.replace("T", " ")}</span>` : ""}</div>${subs}</div>${t.done ? "" : `<button class="b sm o" data-act="focusTask" data-id="${t.id}" style="padding:8px 10px">${ic("play")}</button>`}</div>`;
  }).join("");
}
function filtered() {
  const today = dkey(Date.now()); let L = S.tasks.slice();
  if (S.flt === "done") L = L.filter(t => t.done); else { L = L.filter(t => !t.done); if (S.flt === "today") L = L.filter(t => t.due && t.due.slice(0, 10) <= today); if (S.flt === "up") L = L.filter(t => t.due && t.due.slice(0, 10) > today); }
  if (q) L = L.filter(t => t.title.toLowerCase().includes(q.toLowerCase()));
  return L.sort((a, b) => (b.prio - a.prio) || ((a.due || "9") > (b.due || "9") ? 1 : -1));
}
function tasksList() { const L = filtered(); return L.length ? taskRows(L) : `<div class="center mu" style="padding:30px 0">${ic("check")}<br/>${S.flt === "done" ? "Belum ada tugas selesai" : "Tidak ada tugas di sini. Ketuk + untuk menambah."}</div>`; }
function taskSheet(id) {
  const t = S.tasks.find(x => x.id === id) || { prio: 2, subs: [] };
  sheet(`<div class="row sp"><h2 style="margin:0">${id ? "Edit Tugas" : "Tugas Baru"}</h2><button class="b sm o" data-act="close">${ic("close")}</button></div><br/>
  <form data-form="task"><input type="hidden" name="id" value="${id || ""}"/><label class="l">Judul tugas</label><input name="title" required maxlength="80" value="${esc(t.title || "")}" placeholder="Apa yang harus diselesaikan?"/>
  <div class="g2"><div><label class="l">Prioritas (bonus waktu santai)</label><select name="prio"><option value="3" ${t.prio == 3 ? "selected" : ""}>Tinggi · +8m</option><option value="2" ${t.prio == 2 ? "selected" : ""}>Sedang · +5m</option><option value="1" ${t.prio == 1 ? "selected" : ""}>Rendah · +3m</option></select></div><div><label class="l">Estimasi (menit)</label><input name="est" type="number" min="0" max="600" value="${t.est || ""}" placeholder="60"/></div></div>
  <label class="l">Tenggat waktu</label><input name="due" type="datetime-local" value="${t.due || ""}"/>
  <label class="l">Checklist (satu item per baris)</label><textarea name="subs" rows="3" placeholder="Baca bab 1&#10;Kerjakan latihan">${esc((t.subs || []).map(s => s.t).join("\n"))}</textarea>
  <button class="b full">${id ? "Simpan Perubahan" : "Tambah Tugas"}</button>${id ? `<br/><br/><button type="button" class="b full red" data-act="delTask" data-id="${id}">${ic("trash")} Hapus Tugas</button>` : ""}</form>`);
}
function viewTasks() {
  if (S.seg === "sched") {
    const list = S.sched.slice().sort((a, b) => a.time > b.time ? 1 : -1).map(s => `<div class="li"><div class="ico">${ic("bell")}</div><div>${s.time} — ${esc(s.title)}<small>Pengingat setiap hari</small></div><button class="b sm red" data-act="delSched" data-id="${s.id}">${ic("trash")}</button></div>`).join("") || `<p class="mu center" style="padding:20px">Belum ada jadwal harian.</p>`;
    return segTasks() + `<div class="card"><h3>Tambah Jadwal & Reminder</h3><form data-form="sched"><div class="g2"><div><label class="l">Jam</label><input type="time" name="time" required/></div><div><label class="l">Kegiatan</label><input name="title" placeholder="Belajar" required maxlength="60"/></div></div><button class="b full">Simpan Jadwal</button></form></div><div class="card"><h3>Jadwal Harian</h3>${list}</div>`;
  }
  const f = [["all", "Semua"], ["today", "Hari ini"], ["up", "Mendatang"], ["done", "Selesai"]];
  return segTasks() + `<div style="position:relative"><input id="q" placeholder="Cari tugas…" value="${esc(q)}" style="padding-left:14px"/></div><div class="chips">${f.map(x => `<button class="chip ${S.flt === x[0] ? "on" : ""}" data-act="flt" data-v="${x[0]}">${x[1]}</button>`).join("")}</div><div class="card" id="tlist" style="padding:6px 14px">${tasksList()}</div><button class="fab" data-act="newTask" aria-label="Tambah tugas">${ic("plus")}</button>`;
}
const segTasks = () => `<div class="seg"><button data-act="seg" data-v="todo" class="${S.seg === "todo" ? "on" : ""}">Daftar Tugas</button><button data-act="seg" data-v="sched" class="${S.seg === "sched" ? "on" : ""}">Jadwal Harian</button></div>`;

/* ---------- fokus ---------- */
let wake = null, leftAt = 0;
async function lockOn() { try { if ("wakeLock" in navigator) wake = await navigator.wakeLock.request("screen"); } catch (e) {} if (R().lock) try { await document.documentElement.requestFullscreen(); } catch (e) {} }
function lockOff() { try { wake && wake.release(); } catch (e) {} wake = null; try { document.fullscreenElement && document.exitFullscreen(); } catch (e) {} }
async function askNotif() { if (isNative() || S.notif || !("Notification" in window) || Notification.permission === "denied") return; try { S.notif = (await Notification.requestPermission()) === "granted"; save(); } catch (e) {} }
function startRun(phase, taskId) {
  const m = phase === "focus" ? R().focus : phase === "long" ? R().long : R().brk;
  S.run = { phase, total: m * 60, end: Date.now() + m * 60000, taskId: taskId || (S.run && S.run.taskId) || "", viol: 0, paused: false, remain: 0 };
  save(); nRun(S.run); if (phase === "focus") lockOn(); render();
}
function finishRun() {
  const r = S.run; if (!r) return;
  if (r.phase === "focus") {
    const mins = r.total / 60, ok = !(R().strict && r.viol >= 3);
    if (ok) { const earn = mins * ratio() / 100; S.wallet += earn; S.xp += mins; S.cyc++; bumpStreak(); addLog("focus", mins, { earn, task: r.taskId }); notify("🍅 Sesi fokus selesai!", `+${r1(earn)} menit waktu santai (${ratio()}%)`); checkBadges(); }
    else notify("❌ Sesi gagal", "Terlalu sering keluar — reward hangus");
    lockOff(); startRun(S.cyc % 4 === 0 ? "long" : "brk");
  } else { S.run = null; lockOff(); save(); notify("☕ Istirahat selesai", "Siap fokus lagi?"); render(); }
}
function viewFocus() {
  const r = S.run, Rr = R();
  if (!r) {
    const opts = S.tasks.filter(t => !t.done).map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join("");
    const cy = S.cyc % 4;
    return `<div class="card center">${ring(0, 220, 14, "var(--g)", `<b style="font-size:2.6rem">${Rr.focus}:00</b><span class="mu">siap fokus</span>`)}<div class="days" style="justify-content:center;gap:10px;margin:14px 0 4px">${[0, 1, 2, 3].map(i => `<div class="${i < cy ? "on" : ""}"><i style="width:14px;height:14px;margin:0"></i></div>`).join("")}</div><p class="mu">Sesi ke-${cy + 1} dari 4 · istirahat ${Rr.brk}m · panjang ${Rr.long}m</p><br/>
    <label class="l" style="text-align:left">Tugas yang dikerjakan</label><select id="ftask"><option value="">— Tanpa tugas —</option>${opts}</select>
    <button class="b full" data-act="start" style="margin-top:4px">${ic("play")} Mulai Fokus</button></div>
    <div class="card"><div class="li"><div class="ico">${ic("bolt")}</div><div>Rasio reward ${ratio()}%<small>${prem() ? "Dynamic Time Quota aktif (+" + Math.min(10, S.streak.n * 2) + "% dari streak)" : "Premium: rasio naik otomatis lewat streak"}</small></div></div>
    ${switchRow("lock", "Focus Lock", "Layar penuh & deteksi keluar aplikasi", "lock", S.rules.lock && prem(), !prem())}${switchRow("shield", "Strict Mode", "Tanpa jeda, tanpa lewati (3x keluar = gagal)", "strict", S.rules.strict && prem(), !prem())}</div>`;
  }
  const t = S.tasks.find(x => x.id === r.taskId), foc = r.phase === "focus", strictNow = Rr.strict && foc;
  return `<div class="card center" style="background:${foc ? "var(--card)" : "linear-gradient(135deg,rgba(212,169,55,.18),var(--card))"}"><p class="mu" style="font-weight:700;letter-spacing:.1em">${foc ? "FOKUS" : r.phase === "long" ? "ISTIRAHAT PANJANG" : "ISTIRAHAT"}</p><br/>${ring(1, 250, 14, foc ? "var(--g)" : "var(--gold)", `<b id="tm" style="font-size:3rem">--:--</b>`)}<br/><p class="tt">${t ? esc(t.title) : "Tanpa tugas"}</p>${foc && Rr.lock ? `<p class="mu">🔒 Focus Lock · keluar aplikasi: <b>${r.viol}</b>${Rr.strict ? "/3" : ""}</p>` : ""}<br/>
  ${strictNow ? `<p class="mu">🛡️ Strict Mode aktif: tidak bisa jeda / lewati.</p>` : `<div class="row wrap" style="justify-content:center"><button class="b sm o" data-act="pause">${ic(r.paused ? "play" : "pause")} ${r.paused ? "Lanjut" : "Jeda"}</button><button class="b sm o" data-act="skip">${ic("skip")} Lewati</button><button class="b sm red" data-act="stop">${ic("stop")} Berhenti</button></div>`}</div>`;
}

/* ---------- santai ---------- */
function startLeisure(m) {
  m = Math.floor(m); if (S.run && S.run.phase === "focus") return toast("Selesaikan sesi fokus dulu");
  if (!(m > 0) || m > S.wallet) return toast("Waktu santai belum cukup — selesaikan tugas dulu!");
  S.wallet -= m; S.leisure = { end: Date.now() + m * 60000, total: m }; nSched(2, "⏰ Waktu santai habis", "Kembali produktif!", S.leisure.end); save(); render();
}
function stopLeisure(auto) { const l = S.leisure; if (!l) return; nCancel([2]); const rem = auto ? 0 : Math.max(0, (l.end - Date.now()) / 60000); S.wallet += rem; addLog("leisure", r1(l.total - rem)); S.leisure = null; save(); if (auto) notify("⏰ Waktu santai habis", "Kembali produktif!"); render(); }
function viewWallet() {
  const w = Math.floor(S.wallet), l = S.leisure;
  const hist = S.log.filter(x => x.type !== "task" || x.earn).slice(-12).reverse().map(x => x.type === "leisure" ? `<div class="li"><div class="ico gold">${ic("play")}</div><div>Waktu santai<small>${new Date(x.ts).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</small></div><b style="color:var(--red)">−${x.min}m</b></div>` : `<div class="li"><div class="ico">${ic(x.type === "focus" ? "timer" : "check")}</div><div>${x.type === "focus" ? "Sesi fokus " + x.min + "m" : "Tugas selesai"}<small>${new Date(x.ts).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</small></div><b style="color:var(--g)">+${r1(x.earn)}m</b></div>`).join("") || `<p class="mu center" style="padding:16px">Belum ada riwayat.</p>`;
  const box = l ? `<div class="center"><div class="big" id="ltm">--:--</div><p class="mu">Waktu santai berjalan… nikmati! 🎉</p><br/><button class="b red" data-act="stopLeisure">Selesai lebih awal</button></div>` : `<div class="row wrap" style="justify-content:center">${[5, 10, 15, 30].map(m => `<button class="b sm o" data-act="leisure" data-m="${m}">${m} mnt</button>`).join("")}<button class="b sm" data-act="leisure" data-m="${w}">Semua (${w})</button></div>`;
  return `<div class="card hero center"><p class="mu">Leisure Time Wallet</p><div class="big">${w}<small style="font-size:1rem"> menit</small></div><p class="mu">Saldo tepat ${r1(S.wallet)} menit · rasio ${ratio()}%</p></div><div class="card">${box}</div>
  <div class="card"><h3>Buka hiburan tanpa rasa bersalah</h3><div class="row wrap"><a class="b sm o" href="https://www.youtube.com" target="_blank" rel="noopener">▶ YouTube</a><a class="b sm o" href="https://www.tiktok.com" target="_blank" rel="noopener">♪ TikTok</a><a class="b sm o" href="https://www.instagram.com" target="_blank" rel="noopener">◎ Instagram</a></div><p class="mu" style="margin-top:8px">Mulai hitung mundur dulu, lalu buka aplikasinya.</p></div>
  <h2>Riwayat</h2><div class="card" style="padding:4px 14px">${hist}</div>
  <div class="card"><h3>Cara kerja</h3><p class="mu">Kerja dulu, santai belakangan. Setiap menit fokus menambah ${ratio()}% ke dompet (2 jam belajar = 30 menit santai). Menyelesaikan tugas memberi bonus 3–8 menit.</p></div>`;
}

/* ---------- beranda ---------- */
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
function viewHome() {
  const h = new Date().getHours(), gr = h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 19 ? "Selamat sore" : "Selamat malam";
  const Q = ["Kerja dulu, santai kemudian.", "Satu sesi fokus lebih baik dari seribu rencana.", "Disiplin hari ini, bebas besok.", "Mulai kecil, selesaikan, nikmati reward-mu.", "Fokus 25 menit — kamu pasti bisa!"], quote = Q[new Date().getDate() % Q.length];
  const tf = todayFocus(), pct = tf / S.goal, next = S.tasks.filter(t => !t.done).sort((a, b) => b.prio - a.prio).slice(0, 3);
  const wk = [6, 5, 4, 3, 2, 1, 0].map(i => { const k = dkey(Date.now() - i * DAY), a = S.log.some(l => dkey(l.ts) === k && l.type !== "leisure"); return `<div class="${a ? "on" : ""}"><i>${a ? ic("check") : ""}</i>${["M", "S", "S", "R", "K", "J", "S"][new Date(Date.now() - i * DAY).getDay()]}</div>`; }).join("");
  const inst = !standalone() && !dp && !S.hideInst ? `<div class="card promo"><b>📲 Pasang sebagai aplikasi</b><div class="mu">Chrome Android: menu ⋮ → <b>Pasang aplikasi</b>.<br/>iPhone (Safari): Bagikan → <b>Tambah ke Layar Utama</b>.</div><button class="b sm" data-act="hideInst" style="margin-top:8px">Mengerti</button></div>` : "";
  return `${inst}${dp ? `<div class="card promo row sp"><div><b>Pasang TimeBalance</b><div class="mu">Akses cepat dari layar utama, tetap jalan offline.</div></div><button class="b sm" data-act="install">Pasang</button></div>` : ""}
  <div class="card hero"><h3 style="font-size:1.1rem">${gr}${S.name ? ", " + esc(S.name) : ""} 👋</h3><p class="mu">${quote}</p><br/><button class="b w full" data-act="tab" data-v="focus">${ic("play")} Mulai Fokus</button></div>
  <div class="g2"><div class="card center" style="margin:0">${ring(pct, 112, 10, "var(--g)", `<b style="font-size:1.3rem">${tf}</b><span class="mu" style="font-size:.62rem">/ ${S.goal} mnt</span>`)}<p class="mu" style="margin-top:6px">Target harian</p></div>
  <div class="card center" style="margin:0" data-act="tab" data-v="wallet"><div class="ico gold" style="margin:6px auto">${ic("wallet")}</div><div class="big" style="font-size:2rem;color:var(--g)">${Math.floor(S.wallet)}</div><p class="mu">menit santai</p></div></div><br/>
  <div class="card"><div class="row sp"><h3>Streak ${S.streak.n} hari 🔥</h3><span class="pill">Level ${level()}</span></div><div class="days">${wk}</div><br/><div class="bar"><i style="width:${S.xp % 100}%"></i></div><p class="mu" style="margin-top:6px">${S.xp % 100}/100 XP menuju level ${level() + 1}</p></div>
  <div class="row sp"><h2 style="margin:6px 2px">Tugas berikutnya</h2><a class="mu" data-act="tab" data-v="tasks" style="color:var(--g);font-weight:700">Semua</a></div>
  <div class="card" style="padding:4px 14px">${next.length ? taskRows(next) : `<p class="mu center" style="padding:18px">Belum ada tugas. <a data-act="newTask" style="color:var(--g);font-weight:700">Tambah sekarang</a></p>`}</div>
  ${prem() ? "" : `<div class="card promo"><div class="row"><div class="ico gold">${ic("crown")}</div><div><b>Buka semua fitur Premium</b><div class="mu">Focus Lock, Analytics, Achievement & bebas iklan.</div></div></div><br/><button class="b full" data-act="paywall">Lihat Paket</button></div>`}`;
}

/* ---------- statistik ---------- */
function byDay(n) { const o = []; for (let i = n - 1; i >= 0; i--) { const k = dkey(Date.now() - i * DAY), L = S.log.filter(l => dkey(l.ts) === k); o.push({ k, f: L.filter(l => l.type === "focus").reduce((a, l) => a + l.min, 0), t: L.filter(l => l.type === "task").length }); } return o; }
function chart(d) { const W = 320, H = 140, m = Math.max(30, ...d.map(x => x.f)), bw = W / d.length; return `<svg viewBox="0 0 ${W} ${H + 20}" width="100%">${d.map((x, i) => { const h = x.f / m * H; return `<rect x="${i * bw + 2}" y="${H - h}" width="${Math.max(2, bw - 4)}" height="${Math.max(2, h)}" rx="4" fill="var(--g)" opacity="${x.f ? 1 : .2}"/>${d.length <= 7 ? `<text x="${i * bw + bw / 2}" y="${H + 14}" font-size="9" text-anchor="middle" fill="var(--mu)">${x.k.slice(8)}</text>` : ""}`; }).join("")}<text x="2" y="10" font-size="9" fill="var(--mu)">maks ${m} mnt</text></svg>`; }
function analytics() {
  const s = stats(), d = byDay(S.range), mo = {}; S.log.filter(l => l.type === "focus").forEach(l => { const k = dkey(l.ts).slice(0, 7); mo[k] = (mo[k] || 0) + l.min; });
  const moL = Object.keys(mo).sort().slice(-6).map(k => `<div class="li"><div>${k}</div><b>${mo[k]} menit</b></div>`).join("") || `<p class="mu">Belum ada data.</p>`;
  return `<div class="g2" style="margin-bottom:14px"><div class="stat"><b>${s.sess}</b>Sesi fokus</div><div class="stat"><b>${s.fmin}</b>Menit fokus</div><div class="stat"><b>${s.tdone}</b>Tugas selesai</div><div class="stat"><b>${r1(s.earned)}</b>Menit reward</div></div>
  <div class="card"><div class="row sp"><h3>Menit Fokus</h3><div class="row"><button class="chip ${S.range === 7 ? "on" : ""}" data-act="range" data-v="7">7 hari</button><button class="chip ${S.range === 30 ? "on" : ""}" data-act="range" data-v="30">30 hari</button></div></div>${chart(d)}</div><div class="card"><h3>Ringkasan Bulanan</h3>${moL}</div><button class="b full" data-act="report">${ic("file")} Export Laporan PDF</button>`;
}
function achievements() {
  return `<div class="card"><div class="row sp"><h3>Level ${level()}</h3><span class="mu">${S.xp % 100}/100 XP</span></div><div class="bar"><i style="width:${S.xp % 100}%"></i></div></div><div class="badges">${BADGES.map(b => `<div class="bd ${S.badges[b[0]] ? "" : "off"}"><i>${b[1]}</i>${b[2]}<small>${b[3]}</small></div>`).join("")}</div>`;
}
function viewStats() {
  const seg = `<div class="seg"><button data-act="sseg" data-v="an" class="${S.sseg === "an" ? "on" : ""}">Analitik</button><button data-act="sseg" data-v="ac" class="${S.sseg === "ac" ? "on" : ""}">Prestasi</button></div>`;
  const body = S.sseg === "an" ? analytics() : achievements();
  if (prem()) return seg + body;
  return seg + `<div class="blurw"><div class="blur">${body}</div><div class="ovl"><div class="card center" style="margin:0"><div class="ico gold" style="margin:0 auto 8px">${ic("lock")}</div><h3>${S.sseg === "an" ? "Productivity Analytics" : "Achievement System"}</h3><p class="mu" style="margin-bottom:12px">Fitur Premium. Pantau grafik harian, mingguan, bulanan & kumpulkan badge.</p><button class="b gold" data-act="paywall">Buka Premium</button></div></div></div>`;
}

/* ---------- paywall ---------- */
const FEATS = [["check", "Smart To-Do List", "Kelola tugas dan pantau tugas yang sudah selesai"], ["timer", "Pomodoro Timer", "Fokus dengan sesi kerja dan istirahat teratur"], ["wallet", "Leisure Time Wallet", "Dapatkan waktu santai sebagai reward produktivitas"], ["chart", "Productivity Analytics", "Pantau perkembangan produktivitas secara terukur"]];
function paywall() {
  sheetKind = "paywall";
  const an = S.plan === "annual";
  sheet(`<div class="pw"><button class="b sm" data-act="close" style="position:absolute;right:16px;top:calc(14px + env(safe-area-inset-top));background:rgba(255,255,255,.2)">${ic("close")}</button><div class="crown">${ic("crown")}</div><h1 style="font-size:1.5rem">TimeBalance Premium</h1><p style="opacity:.85;font-size:.85rem;margin-top:4px">Produktif tanpa batas, santai tanpa rasa bersalah.</p></div>
  <div class="card">${FEATS.map(f => `<div class="li"><div class="ico gold">${ic(f[0])}</div><div>${f[1]}<small>${f[2]}</small></div><span class="ok">✓</span></div>`).join("")}</div>
  <div class="g2" style="margin:18px 0 8px"><button class="plan ${an ? "" : "on"}" data-act="plan" data-v="monthly"><span class="mu">Bulanan</span><b>${rp(19000)}</b><span class="mu">per bulan</span></button><button class="plan ${an ? "on" : ""}" data-act="plan" data-v="annual"><em>Hemat 78%</em><span class="mu">Tahunan</span><b>${rp(50000)}</b><span class="mu">≈ ${rp(4200)}/bulan</span></button></div>
  <p class="mu center" style="margin-bottom:12px">${an ? "+ Early Access, Premium Badge & prioritas support" : "Batalkan kapan saja"} · Garansi 7 hari</p>
  <button class="b gold full" data-act="buy">Bayar di Website</button>
  <p class="mu center" style="margin-top:8px">QRIS hanya ditampilkan di website. Setelah pembayaran diverifikasi oleh admin, token Premium dikirim ke email pembeli.</p>
  ${PUBLIC_KEY ? `<div class="card" style="margin-top:16px"><h3>Sudah bayar? Masukkan token aktivasi</h3><form data-form="code"><p class="mu" style="margin:4px 0 10px">Token terhubung ke email akun yang digunakan saat pembayaran. Masuk ke akun TimeBalance dengan email yang sama.</p><input name="code" placeholder="Tempel token di sini (TB1.… )" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" required/><button class="b full">Aktifkan Premium</button></form><p class="mu">Token aktivasi dipakai langsung di aplikasi ini. QRIS tidak disimpan di aplikasi.</p></div>` : ""}`, "full");
}

/* ---------- onboarding ---------- */
const OB = [["⚖️", "Kerja dulu, santai kemudian", "Selesaikan tugas atau sesi fokus untuk mengisi dompet waktu santai. Hiburan jadi hadiah, bukan jebakan."], ["🍅", "Fokus dengan Pomodoro", "25 menit fokus, 5 menit istirahat. Tambahkan Focus Lock & Strict Mode dengan Premium."], ["🎮", "Nikmati tanpa rasa bersalah", "2 jam belajar = 30 menit hiburan. Pantau progres, streak, dan raih achievement."]];
let obI = 0;
function onboarding() {
  const last = obI === OB.length;
  sheet(last ? `<div class="ob"><div class="em">👋</div><h1>Siapa namamu?</h1><p class="mu">Agar sapaan terasa personal. Bisa diubah nanti.</p><form data-form="onb" style="width:100%"><input name="name" placeholder="Nama panggilan" maxlength="20" required/><button class="b full">Mulai Sekarang</button></form></div>` : `<div class="ob"><div class="em">${OB[obI][0]}</div><h1>${OB[obI][1]}</h1><p class="mu">${OB[obI][2]}</p><div class="dots">${OB.map((_, i) => `<i class="${i === obI ? "on" : ""}"></i>`).join("")}</div><button class="b full" data-act="obNext">Lanjut</button></div>`, "full");
  $("#sheet .bk").removeAttribute("data-act");
}

/* ---------- profil ---------- */
function profile() {
  sheetKind = "profile";
  const p = prem(), rr = S.rules, dis = p ? "" : "disabled", ini = (S.name || "T")[0].toUpperCase();
  const tbl = [["Smart To-Do & Checklist", 1, 1], ["Pomodoro Timer", 1, 1], ["Leisure Time Wallet", 1, 1], ["Jadwal & Reminder", 1, 1], ["Focus Lock & Strict Mode", 0, 1], ["Dynamic Time Quota", 0, 1], ["Analytics & Achievement", 0, 1], ["Custom Rule System", 0, 1], ["Export PDF & Backup", 0, 1], ["Bebas Iklan", 0, 1]];
  sheet(`<div class="row sp"><h2 style="margin:0">Profil & Pengaturan</h2><button class="b sm o" data-act="close">${ic("close")}</button></div><br/>
  <div class="card row"><div class="av" style="width:56px;height:56px;font-size:1.4rem;display:flex;align-items:center;justify-content:center">${ini}</div><div style="flex:1"><b>${esc(S.name || "Pengguna")}</b><div class="mu">Level ${level()} · Streak ${S.streak.n} hari</div><span class="pill ${p ? "p" : ""}" style="margin-top:4px;display:inline-block">${planName()}</span>${p && S.premium ? `<span class="mu"> s/d ${new Date(S.premium.until).toLocaleDateString("id-ID")}</span>` : ""}</div></div>
  ${accountCard()}
  ${p ? "" : `<div class="card promo row sp"><div><b>Upgrade ke Premium</b><div class="mu">Mulai Rp 19.000 / bulan</div></div><button class="b sm" data-act="paywall">Lihat</button></div>`}
  ${DEMO_TOGGLE ? `<div class="card"><h3>🧪 Mode Uji Coba</h3>${switchRow("crown", "Aktifkan Premium (Demo)", "Nyalakan/matikan semua fitur Premium untuk mencoba. Matikan untuk melihat versi Gratis.", "demo", S.demo, false)}</div>` : ""}
  <h2>Aturan Fokus ${p ? "" : "🔒"}</h2><div class="card"><form data-form="rules"><div class="g2"><div><label class="l">Fokus (menit)</label><input name="focus" type="number" min="5" max="120" value="${rr.focus}" ${dis}/></div><div><label class="l">Istirahat</label><input name="brk" type="number" min="1" max="30" value="${rr.brk}" ${dis}/></div><div><label class="l">Istirahat panjang</label><input name="long" type="number" min="5" max="60" value="${rr.long}" ${dis}/></div><div><label class="l">Rasio reward (%)</label><input name="ratio" type="number" min="5" max="100" value="${rr.ratio}" ${dis}/></div></div><button class="b full" ${dis}>Simpan Aturan</button>${p ? "" : `<p class="mu center" style="margin-top:8px">Gratis: 25/5 menit, rasio 25%.</p>`}</form></div>
  <h2>Umum</h2><div class="card"><form data-form="goal" class="row"><div style="flex:1"><label class="l">Target fokus harian (menit)</label><input name="goal" type="number" min="10" max="600" value="${S.goal}" style="margin:0"/></div><button class="b sm" style="margin-top:18px">Simpan</button></form><br/>
  <label class="l">Tema</label><div class="seg"><button data-act="theme" data-v="auto" class="${S.theme === "auto" ? "on" : ""}">Otomatis</button><button data-act="theme" data-v="light" class="${S.theme === "light" ? "on" : ""}">Terang</button><button data-act="theme" data-v="dark" class="${S.theme === "dark" ? "on" : ""}">Gelap</button></div>
  ${switchRow("bell", "Notifikasi", "Pengingat jadwal & deadline", "notif", S.notif)}${switchRow("bolt", "Suara", "Bunyi saat sesi selesai", "snd", S.snd)}${switchRow("timer", "Getar", "Getar saat sesi selesai", "vib", S.vib)}
  <form data-form="name" class="row" style="margin-top:12px"><input name="name" value="${esc(S.name)}" placeholder="Nama panggilan" style="margin:0"/><button class="b sm">Ubah</button></form></div>
  ${dp ? `<div class="card"><button class="b full" data-act="install">${ic("download")} Pasang Aplikasi ke Layar Utama</button></div>` : ""}
  <h2>Data ${p ? "" : "🔒"}</h2><div class="card"><p class="mu" style="margin-bottom:10px">Backup berupa file JSON — simpan di Drive/penyimpanan Anda.</p><div class="row wrap"><button class="b sm" data-act="export" ${dis}>${ic("cloud")} Backup</button><label class="b sm o" style="margin:0;${p ? "" : "opacity:.45"}">Pulihkan<input type="file" accept=".json" id="imp" hidden ${dis}/></label><button class="b sm red" data-act="reset">Hapus Data</button></div></div>
  <h2>Gratis vs Premium</h2><div class="card"><table class="c"><tr><th>Fitur</th><th>Gratis</th><th>Premium</th></tr>${tbl.map(r => `<tr><td>${r[0]}</td><td class="${r[1] ? "ok" : "no"}">${r[1] ? "✓" : "—"}</td><td class="ok">✓</td></tr>`).join("")}</table></div>
  <h2>Bantuan</h2><div class="card" style="padding:4px 14px"><details><summary>Apa itu Work–Reward Mechanism?</summary><p class="mu">Kerja dulu, hiburan belakangan. Menit fokus dan tugas selesai mengisi dompet waktu santai yang bisa Anda pakai tanpa rasa bersalah.</p></details><details><summary>Bagaimana cara kerja Focus Lock?</summary><p class="mu">Versi web/PWA memakai layar penuh dan mendeteksi saat Anda meninggalkan aplikasi. Pemblokiran aplikasi lain secara paksa hanya bisa pada aplikasi Android native.</p></details><details><summary>Apakah data saya aman?</summary><p class="mu">Tugas, riwayat, dan dompet waktu tersimpan di perangkat Anda, tidak dikirim ke server. Jika Anda membuat akun, hanya email dan status Premium yang disimpan di server. Gunakan Backup untuk cadangan data.</p></details><details><summary>Bagaimana cara upgrade Premium?</summary><p class="mu">Pilih paket di website, bayar melalui QRIS, lalu masukkan token aktivasi yang dikirim setelah pembayaran diverifikasi.</p></details><details><summary>Notifikasi tidak muncul?</summary><p class="mu">Aktifkan izin notifikasi di Profil. Pengingat berjalan saat aplikasi terbuka/di latar belakang.</p></details></div>
  <div class="card" style="padding:4px 14px"><details><summary>Tentang TimeBalance</summary><p class="mu">TimeBalance membantu mengurangi prokrastinasi dan menyeimbangkan kerja dengan hiburan lewat Work–Reward Mechanism. © 2026 · Made with 💚 in Indonesia.</p></details><details><summary>Kebijakan Privasi</summary><p class="mu">Kami tidak mengumpulkan, menjual, atau membagikan data pribadi Anda. Data tugas & progres disimpan lokal di perangkat.</p></details></div>
  <div class="row wrap" style="justify-content:center"><a class="b sm o" href="mailto:${EMAIL}">${ic("mail")} Email</a><a class="b sm o" href="https://www.instagram.com/timebalance_" target="_blank" rel="noopener">Instagram</a>${SITE ? `<a class="b sm o" href="${SITE}" target="_blank" rel="noopener">Website</a>` : ""}</div><p class="mu center" style="margin-top:14px">TimeBalance v2.0</p>`);
  const imp = $("#imp"); if (imp) imp.onchange = doImport;
}

/* ---------- render ---------- */
const TABS = [["home", "Beranda", "home", "Beranda"], ["tasks", "Tugas", "check", "Tugas"], ["focus", "Fokus", "timer", "Pomodoro"], ["wallet", "Santai", "wallet", "Dompet Santai"], ["stats", "Statistik", "chart", "Statistik"]];
const VIEWS = { home: viewHome, tasks: viewTasks, focus: viewFocus, wallet: viewWallet, stats: viewStats };
function applyTheme() { const dk = S.theme === "dark" || (S.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches); document.documentElement.dataset.theme = dk ? "dark" : ""; }
function render() {
  applyTheme(); const T = TABS.find(t => t[0] === S.tab);
  $("#ttl").textContent = T[3]; $("#sub").textContent = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
  $("#av").textContent = (S.name || "T")[0].toUpperCase();
  $("#view").innerHTML = (prem() ? "" : `<div class="ad">📢 Iklan ringan · <a data-act="paywall">Bebas iklan dengan Premium</a></div>`) + VIEWS[S.tab]();
  $("#nav").innerHTML = TABS.map(t => `<button data-tab="${t[0]}" class="${t[0] === S.tab ? "on" : ""}"><span>${ic(t[2])}</span>${t[1]}</button>`).join("");
  const bd = $("#badge"); bd.textContent = prem() ? "⭐ Premium" : "Gratis"; bd.className = "pill" + (prem() ? " p" : "");
  tick();
}
const gotoPaywall = () => { paywall(); };
const A = {
  tab: e => { S.tab = e.dataset.v; closeSheet(); save(); render(); scrollTo(0, 0); },
  close: () => { if ((obI < OB.length + 1 && !S.onb) || authLock) return; closeSheet(); }, profile: () => profile(), paywall: gotoPaywall, newTask: () => taskSheet(), editTask: e => taskSheet(e.dataset.id),
  seg: e => { S.seg = e.dataset.v; save(); render(); }, sseg: e => { S.sseg = e.dataset.v; save(); render(); }, flt: e => { S.flt = e.dataset.v; save(); render(); },
  plan: e => { S.plan = e.dataset.v; save(); paywall(); },
  buy: () => buy(), login: () => authSheet("in", ""), signup: () => authSheet("up", ""), authmode: e => authSheet(e.dataset.v), syncprem: () => syncPremium(true),
  logout: () => { if (confirm("Keluar dari akun ini?")) { TBAuth.signOut(); closeSheet(); toast("Anda sudah keluar"); } },
  done: e => completeTask(e.dataset.id),
  sub: e => { const t = S.tasks.find(x => x.id === e.dataset.id), s = t.subs[+e.dataset.i]; s.d = !s.d; save(); render(); },
  delTask: e => { if (confirm("Hapus tugas ini?")) { S.tasks = S.tasks.filter(t => t.id !== e.dataset.id); save(); closeSheet(); render(); } },
  delSched: e => { S.sched = S.sched.filter(t => t.id !== e.dataset.id); save(); render(); },
  focusTask: e => { S.tab = "focus"; render(); const s = $("#ftask"); if (s) s.value = e.dataset.id; scrollTo(0, 0); },
  start: () => { if (S.leisure) return toast("Akhiri waktu santai dulu"); askNotif(); startRun("focus", ($("#ftask") || {}).value); },
  pause: () => { const r = S.run; if (r.paused) { r.end = Date.now() + r.remain * 1000; r.paused = false; } else { r.remain = (r.end - Date.now()) / 1000; r.paused = true; } nRun(r); save(); render(); },
  skip: () => { if (confirm("Lewati sesi ini? Sesi fokus yang dilewati tidak memberi reward.")) { const p = S.run.phase; lockOff(); if (p === "focus") startRun("brk"); else { S.run = null; nRun(null); save(); render(); } } },
  stop: () => { if (confirm("Berhenti? Reward sesi ini hangus.")) { S.run = null; nRun(null); lockOff(); save(); render(); } },
  leisure: e => startLeisure(+e.dataset.m), stopLeisure: () => stopLeisure(false), range: e => { S.range = +e.dataset.v; save(); render(); },
  report: () => report(), theme: e => { S.theme = e.dataset.v; save(); render(); profile(); },
  install: async () => { if (dp) { dp.prompt(); await dp.userChoice; dp = null; render(); } },
  hideInst: () => { S.hideInst = true; save(); render(); },
  obNext: () => { obI++; onboarding(); },
  export: async () => { if (isNative()) { try { await nShareFile("timebalance-backup-" + dkey(Date.now()) + ".json", JSON.stringify(S), "Backup TimeBalance"); } catch (e) { toast("Gagal membagikan backup"); } return; } const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: "application/json" })); a.download = "timebalance-backup-" + dkey(Date.now()) + ".json"; a.click(); },
  reset: () => { if (confirm("Hapus SEMUA data? Tidak bisa dibatalkan.")) { localStorage.removeItem(K); location.reload(); } },
  tg: async e => {
    const k = e.dataset.k, on = e.checked;
    if (["lock", "strict"].includes(k)) { if (!prem()) { e.checked = false; return paywall(); } S.rules[k] = on; }
    else if (k === "demo") { S.demo = on; }
    else if (k === "notif") { if (on) { const ok = isNative() ? await nPerm() : ("Notification" in window && (await Notification.requestPermission()) === "granted"); S.notif = ok; if (!ok) { e.checked = false; toast("Izin notifikasi ditolak"); } } else S.notif = false; }
    else S[k] = on;
    save(); render(); if (!$("#sheet").hidden && k !== "lock" && k !== "strict") profile(); else if (!$("#sheet").hidden) { /* biarkan */ }
  }
};
function doImport(ev) { const f = ev.target.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => { try { const d = JSON.parse(fr.result); if (!Array.isArray(d.tasks)) throw 0; S = Object.assign({}, DEF, d, { premium: S.premium, demo: S.demo, used: S.used, pendingOrder: S.pendingOrder }); save(); closeSheet(); render(); toast("Data dipulihkan ✅"); } catch (e) { toast("File backup tidak valid"); } }; fr.readAsText(f); }
document.addEventListener("click", e => { const b = e.target.closest("[data-act]"); if (b && A[b.dataset.act] && b.dataset.act !== "tg") A[b.dataset.act](b); });
document.addEventListener("change", e => { const b = e.target; if (b.dataset && b.dataset.act === "tg") A.tg(b); });
$("#nav").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { S.tab = b.dataset.tab; closeSheet(); save(); render(); scrollTo(0, 0); } });
document.addEventListener("input", e => { if (e.target.id === "q") { q = e.target.value; const l = $("#tlist"); if (l) l.innerHTML = tasksList(); } });
async function redeem(raw) {
  const r = await verifyToken(raw);
  if (r.err) return toast(r.err);
  const account = window.TBAuth && TBAuth.user ? TBAuth.user() : null;
  if (!account || !account.email) return toast("Masuk ke akun TimeBalance terlebih dahulu");
  if (String(account.email).trim().toLowerCase() !== r.email) return toast("Token ini terdaftar untuk email akun yang berbeda");
  S.used = S.used || [];
  if (S.used.includes(r.id)) return toast("Token ini sudah dipakai di perangkat ini");
  const base = S.premium && S.premium.until > Date.now() ? S.premium.until : Date.now();
  S.premium = { plan: PLANS[r.plan], until: base + r.days * DAY, src: "token", tokenId: r.id, email: r.email };
  S.used.push(r.id); save(); closeSheet(); render(); toast("Premium aktif 🎉");
}
document.addEventListener("submit", e => {
  const f = e.target.dataset.form; if (!f) return; e.preventDefault(); const d = new FormData(e.target);
  if (f === "auth") { doAuth(d); return; }
  if (f === "task") {
    const subsTxt = (d.get("subs") || "").split("\n").map(x => x.trim()).filter(Boolean), id = d.get("id"), old = S.tasks.find(x => x.id === id);
    const subs = subsTxt.map(t => ({ t, d: !!(old && (old.subs || []).find(s => s.t === t && s.d)) }));
    const o = { title: d.get("title").trim(), prio: +d.get("prio"), est: +d.get("est") || 0, due: d.get("due") || "", subs };
    if (old) Object.assign(old, o); else S.tasks.push(Object.assign({ id: uid(), done: false }, o)); closeSheet(); toast(old ? "Tugas diperbarui" : "Tugas ditambahkan ✅");
  }
  if (f === "sched") S.sched.push({ id: uid(), time: d.get("time"), title: d.get("title").trim() });
  if (f === "rules") { const c = (n, lo, hi) => Math.min(hi, Math.max(lo, +d.get(n) || lo)); Object.assign(S.rules, { focus: c("focus", 5, 120), brk: c("brk", 1, 30), long: c("long", 5, 60), ratio: c("ratio", 5, 100) }); toast("Aturan disimpan ✅"); }
  if (f === "goal") { S.goal = Math.min(600, Math.max(10, +d.get("goal") || 120)); toast("Target disimpan ✅"); }
  if (f === "name") { S.name = d.get("name").trim().slice(0, 20); toast("Nama diperbarui"); }
  if (f === "onb") { S.name = d.get("name").trim().slice(0, 20); S.onb = 1; closeSheet(); setTimeout(gate, 50); }
  if (f === "code") { redeem(d.get("code")); return; }
  save(); render(); if (["rules", "goal", "name"].includes(f)) profile();
});
function report() {
  const s = stats(), d = byDay(30).filter(x => x.f || x.t), done = S.tasks.filter(t => t.done).slice(-20).map(t => `<tr><td>${esc(t.title)}</td><td>${PR[t.prio]}</td><td>${t.doneAt ? dkey(t.doneAt) : "-"}</td></tr>`).join("");
  $("#report").innerHTML = `<h1>Laporan Produktivitas TimeBalance</h1><p>${esc(S.name || "Pengguna")} · ${new Date().toLocaleString("id-ID")} · Level ${level()} · Streak ${S.streak.n} hari</p><h3>Ringkasan</h3><p>Sesi fokus: ${s.sess} · Menit fokus: ${s.fmin} · Tugas selesai: ${s.tdone} · Waktu santai didapat: ${r1(s.earned)} menit · dipakai: ${r1(s.used)} menit</p><h3>30 Hari Terakhir</h3><table><tr><th>Tanggal</th><th>Menit fokus</th><th>Tugas selesai</th></tr>${d.map(x => `<tr><td>${x.k}</td><td>${x.f}</td><td>${x.t}</td></tr>`).join("") || "<tr><td colspan=3>Belum ada data</td></tr>"}</table><h3>Tugas Selesai (20 terbaru)</h3><table><tr><th>Tugas</th><th>Prioritas</th><th>Tanggal</th></tr>${done || "<tr><td colspan=3>-</td></tr>"}</table><h3>Achievement</h3><p>${BADGES.filter(b => S.badges[b[0]]).map(b => b[1] + " " + b[2]).join(" · ") || "-"}</p>`;
  if (isNative()) { const h = "<!doctype html><meta charset=utf-8><meta name=viewport content=\"width=device-width\"><title>Laporan TimeBalance</title>" + $("#report").innerHTML; nShareFile("laporan-timebalance-" + dkey(Date.now()) + ".html", h, "Laporan TimeBalance").catch(() => toast("Gagal membagikan laporan")); return; }
  setTimeout(() => window.print(), 200);
}

/* ---------- ticker ---------- */
let lastMin = "";
function tick() {
  const now = Date.now(), r = S.run;
  if (r && S.tab === "focus") { const rem = r.paused ? r.remain : (r.end - now) / 1000, tm = $("#tm"), arc = $("#arc"); if (tm) tm.textContent = mmss(rem); if (arc) { const C = 2 * Math.PI * ((250 - 14) / 2); arc.style.strokeDashoffset = C * (1 - rem / r.total); } document.title = mmss(rem) + " · TimeBalance"; } else document.title = "TimeBalance — Kerja Dulu, Santai Kemudian";
  if (r && !r.paused && r.end <= now) finishRun();
  const l = S.leisure; if (l) { const lt = $("#ltm"); if (lt) lt.textContent = mmss((l.end - now) / 1000); if (l.end <= now) stopLeisure(true); }
  const hm = P(new Date().getHours()) + ":" + P(new Date().getMinutes());
  if (hm !== lastMin) { lastMin = hm; const today = dkey(now);
    S.sched.forEach(s => { const k = s.id + today; if (s.time === hm && !S.fired[k]) { S.fired[k] = 1; notify("⏰ Jadwal", s.title); } });
    S.tasks.forEach(t => { if (!t.done && t.due) { const dl = new Date(t.due).getTime() - now, k = "d" + t.id; if (dl > 0 && dl < 36e5 && !S.fired[k]) { S.fired[k] = 1; notify("⚠️ Deadline < 1 jam", t.title); } } });
    if (Object.keys(S.fired).length > 300) S.fired = {}; save(); }
}
setInterval(tick, 500);
document.addEventListener("visibilitychange", () => {
  const r = S.run; if (!r || r.phase !== "focus") return;
  if (document.hidden) { leftAt = Date.now(); return; }
  if (R().lock && leftAt) { r.viol++; leftAt = 0; save(); const a = $("#alert"); a.hidden = false; a.innerHTML = `<h1>🔒 Kembali fokus!</h1><p>Anda meninggalkan sesi fokus (${r.viol}${R().strict ? "/3" : ""}).${R().strict && r.viol >= 3 ? "<br/>Sesi gagal, reward hangus." : ""}</p><button class="b gold" onclick="document.getElementById('alert').hidden=true">Lanjut fokus</button>`; try { document.documentElement.requestFullscreen(); } catch (e) {} render(); }
});
window.addEventListener("beforeunload", e => { if (S.run && S.run.phase === "focus" && R().lock) { e.preventDefault(); e.returnValue = ""; } });
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); dp = e; render(); });
window.addEventListener("appinstalled", () => { dp = null; render(); toast("Aplikasi terpasang 🎉"); });
if ("serviceWorker" in navigator && !isNative()) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").then(r => reg = r).catch(() => {}));
render();
nativeInit();
setTimeout(() => { $("#splash").classList.add("off"); if (!S.onb) onboarding(); else gate(); syncPremium(false); }, 900);
document.addEventListener("visibilitychange", () => { if (!document.hidden) syncPremium(false); });
