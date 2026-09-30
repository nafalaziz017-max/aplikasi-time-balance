/* TimeBalance PWA — Work–Reward Mechanism */
"use strict";
/* ========== KONFIGURASI (edit di sini) ========== */
const SITE = "https://timebalanceruang-rasamyid.biz.id/";
/* Kode aktivasi Premium. Buat kode Anda sendiri, kirim ke pembeli setelah bayar QRIS.
   HAPUS 'TB-DEMO-2026' sebelum dipublikasikan. */
const CODES = {
  "TB-DEMO-2026":       { plan: "Demo 3 Hari",       days: 3 },
  "GANTI-KODE-BULANAN": { plan: "Premium Bulanan",   days: 31 },
  "GANTI-KODE-TAHUNAN": { plan: "Premium Tahunan",   days: 366 }
};
/* ================================================ */
const K = "tb-app-v1", DAY = 864e5;
const $ = (s, e = document) => e.querySelector(s);
const P = n => String(n).padStart(2, "0");
const uid = () => Math.random().toString(36).slice(2, 9);
const dkey = t => { const d = new Date(t); return d.getFullYear() + "-" + P(d.getMonth() + 1) + "-" + P(d.getDate()); };
const mmss = s => { s = Math.max(0, Math.ceil(s)); return P(Math.floor(s / 60)) + ":" + P(s % 60); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const r1 = n => Math.round(n * 10) / 10;

const DEF = { tasks: [], sched: [], log: [], wallet: 0, xp: 0, cyc: 0, streak: { last: "", n: 0 }, badges: {}, run: null,
  leisure: null, fired: {}, premium: null, dark: false, notif: false, tab: "tasks", seg: "todo", range: 7,
  rules: { focus: 25, brk: 5, long: 15, ratio: 25, strict: false, lock: false } };
let S;
try { S = Object.assign({}, DEF, JSON.parse(localStorage.getItem(K) || "{}")); S.rules = Object.assign({}, DEF.rules, S.rules); }
catch (e) { S = JSON.parse(JSON.stringify(DEF)); }
const save = () => { try { localStorage.setItem(K, JSON.stringify(S)); } catch (e) {} };

const prem = () => !!(S.premium && S.premium.until > Date.now());
const R = () => prem() ? S.rules : Object.assign({}, S.rules, { focus: 25, brk: 5, long: 15, ratio: 25, strict: false, lock: false });
/* Dynamic Time Quota (Premium): rasio naik 2% per hari streak (maks +10%) */
const ratio = () => R().ratio + (prem() ? Math.min(10, S.streak.n * 2) : 0);
const level = () => Math.floor(S.xp / 100) + 1;

/* ---------- util UI ---------- */
let tt;
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 2800); }
let reg = null;
function notify(title, body) {
  toast(title + (body ? " — " + body : ""));
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
  try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(); o.connect(a.destination); o.frequency.value = 880; o.start(); setTimeout(() => o.stop(), 250); } catch (e) {}
  if (S.notif && "Notification" in window && Notification.permission === "granted") {
    try { reg ? reg.showNotification(title, { body, icon: "icons/icon-192.png", badge: "icons/icon-192.png" }) : new Notification(title, { body }); } catch (e) {}
  }
}
function addLog(type, min, extra) { S.log.push(Object.assign({ ts: Date.now(), type, min }, extra || {})); }
function gate(t) { return `<div class="card lock"><h3>🔒 ${t}</h3><p class="mu" style="margin:6px 0 12px">Fitur ini khusus Premium.</p><button class="b gold" data-act="tab" data-v="me">Aktifkan Premium</button></div>`; }

/* ---------- statistik & badge ---------- */
function stats() {
  const f = S.log.filter(l => l.type === "focus"), td = S.tasks.filter(t => t.done);
  return { sess: f.length, fmin: f.reduce((a, l) => a + l.min, 0), tdone: td.length, earned: S.log.reduce((a, l) => a + (l.earn || 0), 0), used: S.log.filter(l => l.type === "leisure").reduce((a, l) => a + l.min, 0) };
}
const BADGES = [
  ["first_task", "🌱", "Tugas Pertama", s => s.tdone >= 1], ["ten_tasks", "🏅", "10 Tugas", s => s.tdone >= 10],
  ["first_focus", "🍅", "Fokus Pertama", s => s.sess >= 1], ["five_focus", "🔥", "5 Sesi Fokus", s => s.sess >= 5],
  ["f100", "⏱️", "100 Menit Fokus", s => s.fmin >= 100], ["f500", "🚀", "500 Menit Fokus", s => s.fmin >= 500],
  ["st3", "📅", "Streak 3 Hari", () => S.streak.n >= 3], ["st7", "👑", "Streak 7 Hari", () => S.streak.n >= 7],
  ["lv5", "⭐", "Level 5", () => level() >= 5], ["reward60", "🎁", "60 Menit Reward", s => s.earned >= 60]
];
function checkBadges() {
  if (!prem()) return; const s = stats();
  BADGES.forEach(b => { if (!S.badges[b[0]] && b[3](s)) { S.badges[b[0]] = Date.now(); notify("🏆 Achievement!", b[2]); } });
}

/* ---------- tugas ---------- */
const PR = { 1: "Rendah", 2: "Sedang", 3: "Tinggi" }, BONUS = { 1: 3, 2: 5, 3: 8 };
function sortedTasks() {
  return S.tasks.slice().sort((a, b) => (a.done - b.done) || (b.prio - a.prio) || ((a.due || "9") > (b.due || "9") ? 1 : -1));
}
function completeTask(id) {
  const t = S.tasks.find(x => x.id === id); if (!t) return;
  t.done = !t.done;
  if (t.done) {
    t.doneAt = Date.now();
    const b = BONUS[t.prio] * (prem() && S.streak.n >= 3 ? 1.25 : 1);
    S.wallet += b; S.xp += t.prio * 10; addLog("task", 0, { earn: b, prio: t.prio });
    bumpStreak(); notify("✅ Tugas selesai", `+${r1(b)} menit waktu santai`); checkBadges();
  } else { t.doneAt = 0; }
  save(); render();
}
function bumpStreak() {
  const today = dkey(Date.now());
  if (S.streak.last === today) return;
  S.streak.n = S.streak.last === dkey(Date.now() - DAY) ? S.streak.n + 1 : 1; S.streak.last = today;
}
function viewTasks() {
  const seg = `<div class="seg"><button data-act="seg" data-v="todo" class="${S.seg === "todo" ? "on" : ""}">Tugas</button><button data-act="seg" data-v="sched" class="${S.seg === "sched" ? "on" : ""}">Jadwal Harian</button></div>`;
  if (S.seg === "sched") {
    const list = S.sched.slice().sort((a, b) => a.time > b.time ? 1 : -1).map(s => `<div class="task"><div style="flex:1"><div class="tt">⏰ ${s.time} — ${esc(s.title)}</div><div class="mu">Pengingat setiap hari</div></div><button class="b sm red" data-act="delSched" data-id="${s.id}">Hapus</button></div>`).join("") || `<p class="mu">Belum ada jadwal.</p>`;
    return seg + `<div class="card"><h3>Tambah Jadwal & Reminder</h3><form data-form="sched"><label>Jam</label><input type="time" name="time" required/><label>Kegiatan</label><input name="title" placeholder="Contoh: Belajar Matematika" required maxlength="60"/><button class="b full">Simpan Jadwal</button></form></div><div class="card"><h3>Jadwal Hari Ini</h3>${list}</div>`;
  }
  const now = Date.now();
  const list = sortedTasks().map(t => {
    const late = !t.done && t.due && new Date(t.due).getTime() < now;
    const subs = (t.subs || []).map((s, i) => `<div class="sub"><input type="checkbox" ${s.d ? "checked" : ""} data-act="sub" data-id="${t.id}" data-i="${i}"/><span style="${s.d ? "text-decoration:line-through;opacity:.5" : ""}">${esc(s.t)}</span></div>`).join("");
    return `<div class="task ${t.done ? "done" : ""}"><input type="checkbox" ${t.done ? "checked" : ""} data-act="done" data-id="${t.id}"/><div style="flex:1"><div class="tt">${esc(t.title)}</div><div><span class="tag p${t.prio}">${PR[t.prio]}</span>${t.est ? `<span class="tag">⏱ ${t.est}m</span>` : ""}${t.due ? `<span class="tag ${late ? "late" : ""}">📅 ${t.due.replace("T", " ")}</span>` : ""}</div>${subs}
      ${t.done ? "" : `<div class="row wrap" style="margin-top:8px"><button class="b sm" data-act="focusTask" data-id="${t.id}">▶ Fokus</button><button class="b sm o" data-act="addSub" data-id="${t.id}">+ Checklist</button><button class="b sm red" data-act="delTask" data-id="${t.id}">🗑</button></div>`}</div></div>`;
  }).join("") || `<p class="mu">Belum ada tugas. Tambahkan tugas pertama Anda 👇</p>`;
  return seg + `<div class="card"><h3>Tambah Tugas</h3><form data-form="task"><input name="title" placeholder="Apa yang harus diselesaikan?" required maxlength="80"/><div class="grid"><div><label>Prioritas</label><select name="prio"><option value="3">Tinggi (+8m)</option><option value="2" selected>Sedang (+5m)</option><option value="1">Rendah (+3m)</option></select></div><div><label>Estimasi (menit)</label><input name="est" type="number" min="0" max="600" placeholder="60"/></div></div><label>Tenggat waktu</label><input name="due" type="datetime-local"/><button class="b full">Tambah Tugas</button></form></div><div class="card"><h3>Daftar Tugas</h3>${list}</div>`;
}

/* ---------- fokus / pomodoro ---------- */
let wake = null, leftAt = 0;
async function lockOn() {
  try { if ("wakeLock" in navigator) wake = await navigator.wakeLock.request("screen"); } catch (e) {}
  if (R().lock) { try { await document.documentElement.requestFullscreen(); } catch (e) {} }
}
function lockOff() { try { wake && wake.release(); } catch (e) {} wake = null; try { document.fullscreenElement && document.exitFullscreen(); } catch (e) {} }
async function askNotif() {
  if (S.notif || !("Notification" in window) || Notification.permission === "denied") return;
  try { S.notif = (await Notification.requestPermission()) === "granted"; save(); } catch (e) {}
}
function startRun(phase, taskId) {
  const m = phase === "focus" ? R().focus : phase === "long" ? R().long : R().brk;
  S.run = { phase, total: m * 60, end: Date.now() + m * 60000, taskId: taskId || (S.run && S.run.taskId) || "", viol: 0, paused: false, remain: 0 };
  save(); if (phase === "focus") lockOn(); render();
}
function finishRun() {
  const r = S.run; if (!r) return;
  if (r.phase === "focus") {
    const mins = r.total / 60, ok = !(R().strict && r.viol >= 3);
    if (ok) {
      const earn = mins * ratio() / 100; S.wallet += earn; S.xp += mins; S.cyc++; bumpStreak();
      addLog("focus", mins, { earn, task: r.taskId });
      notify("🍅 Sesi fokus selesai!", `+${r1(earn)} menit waktu santai (rasio ${ratio()}%)`); checkBadges();
    } else notify("❌ Sesi gagal", "Terlalu sering keluar dari mode fokus — reward hangus");
    lockOff(); startRun(S.cyc % 4 === 0 ? "long" : "brk");
  } else { S.run = null; lockOff(); save(); notify("☕ Istirahat selesai", "Siap fokus lagi?"); render(); }
}
function viewFocus() {
  const r = S.run, R_ = R();
  if (!r) {
    const opts = S.tasks.filter(t => !t.done).map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join("");
    const today = S.log.filter(l => l.type === "focus" && dkey(l.ts) === dkey(Date.now()));
    return `<div class="card center"><h2>🍅 Pomodoro Timer</h2><div class="big">${R_.focus}:00</div><p class="mu">Fokus ${R_.focus} menit · istirahat ${R_.brk} menit · istirahat panjang ${R_.long} menit tiap 4 sesi</p><br/><label style="text-align:left">Tugas yang dikerjakan (opsional)</label><select id="ftask"><option value="">— Tanpa tugas —</option>${opts}</select>
      <p class="mu" style="margin:8px 0">Reward: <b>${ratio()}%</b> dari menit fokus jadi waktu santai. ${prem() ? "Dynamic Quota aktif ⚡" : ""}</p>
      <p class="mu">${R_.lock ? "🔒 Focus Lock ON" : "🔓 Focus Lock OFF"} · ${R_.strict ? "🛡️ Strict Mode ON" : "Strict Mode OFF"}</p><br/><button class="b full" data-act="start">▶ Mulai Fokus</button></div>
      <div class="card"><h3>Hari ini</h3><div class="grid"><div class="stat"><b>${today.length}</b>Sesi fokus</div><div class="stat"><b>${today.reduce((a, l) => a + l.min, 0)}</b>Menit fokus</div></div></div>`;
  }
  const t = S.tasks.find(x => x.id === r.taskId), C = 2 * Math.PI * 100;
  const strictNow = R_.strict && r.phase === "focus";
  const label = r.phase === "focus" ? "FOKUS" : r.phase === "long" ? "ISTIRAHAT PANJANG" : "ISTIRAHAT";
  return `<div class="card center"><div class="ringw"><svg width="240" height="240"><circle cx="120" cy="120" r="100" fill="none" stroke="var(--bd)" stroke-width="12"/><circle id="arc" cx="120" cy="120" r="100" fill="none" stroke="${r.phase === "focus" ? "var(--g)" : "var(--gold)"}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg><div class="ringt"><b id="tm">--:--</b><span class="mu">${label}</span></div></div>
    <p class="tt">${t ? esc(t.title) : "Tanpa tugas"}</p>${r.phase === "focus" && R_.lock ? `<p class="mu">🔒 Focus Lock aktif · keluar aplikasi: <b>${r.viol}</b>${R_.strict ? "/3" : ""}</p>` : ""}<br/>
    ${strictNow ? `<p class="mu">🛡️ Strict Mode: tidak bisa jeda / lewati.</p>` : `<div class="row wrap" style="justify-content:center"><button class="b sm o" data-act="pause">${r.paused ? "▶ Lanjut" : "⏸ Jeda"}</button><button class="b sm o" data-act="skip">⏭ Lewati</button><button class="b sm red" data-act="stop">⏹ Berhenti</button></div>`}</div>`;
}

/* ---------- dompet santai ---------- */
function startLeisure(m) {
  m = Math.floor(m);
  if (S.run && S.run.phase === "focus") return toast("Selesaikan sesi fokus dulu");
  if (!(m > 0) || m > S.wallet) return toast("Waktu santai tidak cukup — selesaikan tugas dulu!");
  S.wallet -= m; S.leisure = { end: Date.now() + m * 60000, total: m }; save(); render();
}
function stopLeisure(auto) {
  const l = S.leisure; if (!l) return;
  const rem = auto ? 0 : Math.max(0, (l.end - Date.now()) / 60000);
  S.wallet += rem; addLog("leisure", r1(l.total - rem)); S.leisure = null; save();
  if (auto) notify("⏰ Waktu santai habis", "Kembali produktif!"); render();
}
function viewWallet() {
  const w = Math.floor(S.wallet), l = S.leisure;
  const box = l ? `<div class="center"><div class="big" id="ltm">--:--</div><p class="mu">Waktu santai berjalan… nikmati!</p><br/><button class="b red" data-act="stopLeisure">Selesai lebih awal (sisa dikembalikan)</button></div>`
    : `<div class="row wrap" style="justify-content:center">${[5, 10, 15, 30].map(m => `<button class="b sm o" data-act="leisure" data-m="${m}">${m}m</button>`).join("")}<button class="b sm" data-act="leisure" data-m="${w}">Semua (${w}m)</button></div>`;
  return `<div class="card center"><p class="mu">Leisure Time Wallet</p><div class="big">${w}<small style="font-size:1rem"> menit</small></div><p class="mu">Saldo pasti: ${r1(S.wallet)} menit</p><br/>${box}</div>
  <div class="card"><h3>Cara kerja</h3><p class="mu" style="line-height:1.7">Kerja dulu, santai belakangan. Setiap menit fokus menambah <b>${ratio()}%</b> ke dompet (contoh: 2 jam belajar = 30 menit santai). Menyelesaikan tugas memberi bonus 3–8 menit. Buka YouTube, TikTok, atau game hanya saat dompet terisi — tanpa rasa bersalah!</p></div>`;
}

/* ---------- statistik ---------- */
function byDay(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) { const k = dkey(Date.now() - i * DAY); const L = S.log.filter(l => dkey(l.ts) === k); out.push({ k, f: L.filter(l => l.type === "focus").reduce((a, l) => a + l.min, 0), t: L.filter(l => l.type === "task").length }); }
  return out;
}
function chart(d) {
  const W = 320, H = 150, m = Math.max(30, ...d.map(x => x.f)), bw = W / d.length;
  return `<svg viewBox="0 0 ${W} ${H + 20}" width="100%">${d.map((x, i) => { const h = x.f / m * H; return `<rect x="${i * bw + 2}" y="${H - h}" width="${Math.max(2, bw - 4)}" height="${h}" rx="3" fill="var(--g)"/>${d.length <= 7 ? `<text x="${i * bw + bw / 2}" y="${H + 14}" font-size="9" text-anchor="middle" fill="var(--mu)">${x.k.slice(8)}</text>` : ""}`; }).join("")}<text x="2" y="10" font-size="9" fill="var(--mu)">maks ${m} mnt</text></svg>`;
}
function viewStats() {
  const s = stats();
  const top = `<div class="card"><div class="grid"><div class="stat"><b>${s.sess}</b>Sesi fokus</div><div class="stat"><b>${s.fmin}</b>Menit fokus</div><div class="stat"><b>${s.tdone}</b>Tugas selesai</div><div class="stat"><b>${S.streak.n}🔥</b>Streak hari</div></div></div>`;
  if (!prem()) return top + gate("Productivity Analytics, Achievement & Export PDF");
  const d = byDay(S.range), mo = {};
  S.log.filter(l => l.type === "focus").forEach(l => { const k = dkey(l.ts).slice(0, 7); mo[k] = (mo[k] || 0) + l.min; });
  const moL = Object.keys(mo).sort().slice(-6).map(k => `<div class="row sp"><span>${k}</span><b>${mo[k]} menit</b></div>`).join("") || `<p class="mu">Belum ada data.</p>`;
  const lv = `<div class="card"><div class="row sp"><h3>Level ${level()}</h3><span class="mu">${S.xp % 100}/100 XP</span></div><div class="bar"><i style="width:${S.xp % 100}%"></i></div></div>`;
  return top + `<div class="card"><div class="row sp"><h3>Menit Fokus</h3><div class="row"><button class="b sm ${S.range === 7 ? "" : "o"}" data-act="range" data-v="7">7 hari</button><button class="b sm ${S.range === 30 ? "" : "o"}" data-act="range" data-v="30">30 hari</button></div></div>${chart(d)}</div>
  <div class="card"><h3>Bulanan</h3>${moL}</div>${lv}
  <div class="card"><h3>Achievement</h3><div class="badges">${BADGES.map(b => `<div class="bd ${S.badges[b[0]] ? "" : "off"}"><i>${b[1]}</i>${b[2]}</div>`).join("")}</div></div>
  <button class="b full" data-act="report">📄 Export Laporan PDF</button>`;
}
function report() {
  const s = stats(), d = byDay(30).filter(x => x.f || x.t);
  const done = S.tasks.filter(t => t.done).slice(-20).map(t => `<tr><td>${esc(t.title)}</td><td>${PR[t.prio]}</td><td>${t.doneAt ? dkey(t.doneAt) : "-"}</td></tr>`).join("");
  $("#report").innerHTML = `<h1>Laporan Produktivitas TimeBalance</h1><p>Dibuat: ${new Date().toLocaleString("id-ID")} · Level ${level()} · Streak ${S.streak.n} hari</p>
  <h3>Ringkasan</h3><p>Sesi fokus: ${s.sess} · Menit fokus: ${s.fmin} · Tugas selesai: ${s.tdone} · Waktu santai didapat: ${r1(s.earned)} menit · dipakai: ${r1(s.used)} menit</p>
  <h3>30 Hari Terakhir</h3><table><tr><th>Tanggal</th><th>Menit fokus</th><th>Tugas selesai</th></tr>${d.map(x => `<tr><td>${x.k}</td><td>${x.f}</td><td>${x.t}</td></tr>`).join("") || "<tr><td colspan=3>Belum ada data</td></tr>"}</table>
  <h3>Tugas Selesai (20 terbaru)</h3><table><tr><th>Tugas</th><th>Prioritas</th><th>Tanggal</th></tr>${done || "<tr><td colspan=3>-</td></tr>"}</table>
  <h3>Achievement</h3><p>${BADGES.filter(b => S.badges[b[0]]).map(b => b[1] + " " + b[2]).join(" · ") || "-"}</p>`;
  setTimeout(() => window.print(), 200);
}

/* ---------- profil ---------- */
function viewMe() {
  const p = prem(), rr = S.rules, dis = p ? "" : "disabled";
  const status = p ? `<span class="pill p">${esc(S.premium.plan)}</span> <span class="mu">s/d ${new Date(S.premium.until).toLocaleDateString("id-ID")}</span>` : `<span class="mu">Paket Gratis</span>`;
  return `<div class="card"><h3>⭐ Premium</h3><p style="margin-bottom:10px">${status}</p>
    <p class="mu" style="margin-bottom:10px;line-height:1.6">Bulanan Rp 19.000 · Tahunan Rp 50.000. Bayar via QRIS, lalu masukkan kode aktivasi yang dikirim ke email Anda.</p>
    <div class="row wrap" style="margin-bottom:10px"><a class="b sm gold" href="${SITE}pricing.html" target="_blank" rel="noopener">Lihat Harga</a><a class="b sm o" href="${SITE}payment.html" target="_blank" rel="noopener">Bayar (QRIS)</a></div>
    <form data-form="code"><label>Kode aktivasi</label><input name="code" placeholder="TB-XXXX" autocapitalize="characters" required/><button class="b full">Aktifkan</button></form></div>
  <div class="card"><h3>🧩 Custom Rule System ${p ? "" : "🔒"}</h3><form data-form="rules">
    <div class="grid"><div><label>Fokus (menit)</label><input name="focus" type="number" min="5" max="120" value="${rr.focus}" ${dis}/></div><div><label>Istirahat</label><input name="brk" type="number" min="1" max="30" value="${rr.brk}" ${dis}/></div><div><label>Istirahat panjang</label><input name="long" type="number" min="5" max="60" value="${rr.long}" ${dis}/></div><div><label>Rasio reward (%)</label><input name="ratio" type="number" min="5" max="100" value="${rr.ratio}" ${dis}/></div></div>
    <label class="row"><input style="width:auto;margin:0" type="checkbox" name="lock" ${rr.lock ? "checked" : ""} ${dis}/> Focus Lock (layar penuh & deteksi keluar aplikasi)</label>
    <label class="row"><input style="width:auto;margin:0" type="checkbox" name="strict" ${rr.strict ? "checked" : ""} ${dis}/> Strict Mode (tanpa jeda/lewati)</label><br/>
    <button class="b full" ${dis}>Simpan Aturan</button></form></div>
  <div class="card"><h3>⚙️ Umum</h3><div class="row wrap"><button class="b sm o" data-act="dark">${S.dark ? "☀️ Mode Terang" : "🌙 Mode Gelap"}</button><button class="b sm o" data-act="notif">🔔 ${S.notif ? "Notifikasi aktif" : "Aktifkan notifikasi"}</button></div></div>
  <div class="card"><h3>💾 Backup Data ${p ? "" : "🔒"}</h3><p class="mu" style="margin-bottom:10px">Simpan file cadangan (JSON) ke Drive/penyimpanan Anda, pulihkan kapan saja.</p><div class="row wrap"><button class="b sm" data-act="export" ${dis}>Unduh Backup</button><label class="b sm o" style="margin:0;${p ? "" : "opacity:.4"}">Pulihkan<input type="file" accept=".json" id="imp" hidden ${dis}/></label><button class="b sm red" data-act="reset">Hapus Semua Data</button></div></div>
  <p class="mu center">TimeBalance · Made with 💚 in Indonesia<br/><a href="${SITE}" style="color:var(--g)">Website</a> · IG @timebalance_</p>`;
}

/* ---------- render & event ---------- */
const VIEWS = { tasks: viewTasks, focus: viewFocus, wallet: viewWallet, stats: viewStats, me: viewMe };
function render() {
  document.documentElement.dataset.theme = S.dark ? "dark" : "";
  $("#view").innerHTML = (prem() ? "" : `<div class="ad">📢 Iklan ringan · <a data-act="tab" data-v="me">Bebas iklan dengan Premium</a></div>`) + VIEWS[S.tab]();
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.tab === S.tab));
  const bd = $("#badge"); bd.textContent = prem() ? "⭐ " + S.premium.plan : "Gratis"; bd.className = "pill" + (prem() ? " p" : "");
  const imp = $("#imp"); if (imp) imp.onchange = doImport;
  tick();
}
const A = {
  tab: e => { S.tab = e.dataset.v; save(); render(); scrollTo(0, 0); },
  seg: e => { S.seg = e.dataset.v; save(); render(); },
  done: e => completeTask(e.dataset.id),
  sub: e => { const t = S.tasks.find(x => x.id === e.dataset.id); t.subs[+e.dataset.i].d = !t.subs[+e.dataset.i].d; save(); render(); },
  addSub: e => { const v = prompt("Item checklist:"); if (v && v.trim()) { const t = S.tasks.find(x => x.id === e.dataset.id); (t.subs = t.subs || []).push({ t: v.trim().slice(0, 60), d: false }); save(); render(); } },
  delTask: e => { if (confirm("Hapus tugas ini?")) { S.tasks = S.tasks.filter(t => t.id !== e.dataset.id); save(); render(); } },
  delSched: e => { S.sched = S.sched.filter(t => t.id !== e.dataset.id); save(); render(); },
  focusTask: e => { S.tab = "focus"; render(); const s = $("#ftask"); if (s) s.value = e.dataset.id; },
  start: () => { if (S.leisure) return toast("Akhiri waktu santai dulu"); askNotif(); startRun("focus", ($("#ftask") || {}).value); },
  pause: () => { const r = S.run; if (r.paused) { r.end = Date.now() + r.remain * 1000; r.paused = false; } else { r.remain = (r.end - Date.now()) / 1000; r.paused = true; } save(); render(); },
  skip: () => { if (confirm("Lewati sesi ini? Sesi fokus yang dilewati tidak memberi reward.")) { const p = S.run.phase; lockOff(); if (p === "focus") startRun("brk"); else { S.run = null; save(); render(); } } },
  stop: () => { if (confirm("Berhenti? Reward sesi ini hangus.")) { S.run = null; lockOff(); save(); render(); } },
  leisure: e => startLeisure(+e.dataset.m), stopLeisure: () => stopLeisure(false),
  range: e => { S.range = +e.dataset.v; save(); render(); },
  report, dark: () => { S.dark = !S.dark; save(); render(); },
  notif: async () => { if (!("Notification" in window)) return toast("Browser tidak mendukung notifikasi"); S.notif = (await Notification.requestPermission()) === "granted"; save(); render(); toast(S.notif ? "Notifikasi aktif" : "Izin ditolak"); },
  export: () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: "application/json" })); a.download = "timebalance-backup-" + dkey(Date.now()) + ".json"; a.click(); },
  reset: () => { if (confirm("Hapus SEMUA data? Tidak bisa dibatalkan.")) { localStorage.removeItem(K); location.reload(); } }
};
function doImport(ev) {
  const f = ev.target.files[0]; if (!f) return; const fr = new FileReader();
  fr.onload = () => { try { const d = JSON.parse(fr.result); if (!Array.isArray(d.tasks)) throw 0; S = Object.assign({}, DEF, d); save(); render(); toast("Data dipulihkan ✅"); } catch (e) { toast("File backup tidak valid"); } };
  fr.readAsText(f);
}
document.addEventListener("click", e => { const b = e.target.closest("[data-act]"); if (b && A[b.dataset.act] && b.type !== "checkbox") A[b.dataset.act](b); });
document.addEventListener("change", e => { const b = e.target; if (b.type === "checkbox" && b.dataset.act) A[b.dataset.act](b); });
$("#nav").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { S.tab = b.dataset.tab; save(); render(); scrollTo(0, 0); } });
document.addEventListener("submit", e => {
  const f = e.target.dataset.form; if (!f) return; e.preventDefault(); const d = new FormData(e.target);
  if (f === "task") S.tasks.push({ id: uid(), title: d.get("title").trim(), prio: +d.get("prio"), est: +d.get("est") || 0, due: d.get("due") || "", done: false, subs: [] });
  if (f === "sched") S.sched.push({ id: uid(), time: d.get("time"), title: d.get("title").trim() });
  if (f === "rules") { const c = (n, lo, hi) => Math.min(hi, Math.max(lo, +d.get(n) || lo)); S.rules = { focus: c("focus", 5, 120), brk: c("brk", 1, 30), long: c("long", 5, 60), ratio: c("ratio", 5, 100), lock: !!d.get("lock"), strict: !!d.get("strict") }; toast("Aturan disimpan ✅"); }
  if (f === "code") {
    const c = CODES[d.get("code").trim().toUpperCase()];
    if (!c) return toast("Kode tidak valid");
    const base = prem() ? S.premium.until : Date.now(); S.premium = { plan: c.plan, until: base + c.days * DAY }; toast("Premium aktif 🎉");
  }
  save(); render();
});

/* ---------- ticker: timer, reminder, deadline ---------- */
let lastMin = "";
function tick() {
  const now = Date.now(), r = S.run;
  if (r && S.tab === "focus") {
    const rem = r.paused ? r.remain : (r.end - now) / 1000, tm = $("#tm"), arc = $("#arc");
    if (tm) tm.textContent = mmss(rem); if (arc) arc.style.strokeDashoffset = 2 * Math.PI * 100 * (rem / r.total);
    document.title = mmss(rem) + " · TimeBalance";
  } else document.title = "TimeBalance — Kerja Dulu, Santai Kemudian";
  if (r && !r.paused && r.end <= now) finishRun();
  const l = S.leisure; if (l) { const lt = $("#ltm"); if (lt) lt.textContent = mmss((l.end - now) / 1000); if (l.end <= now) stopLeisure(true); }
  const hm = P(new Date().getHours()) + ":" + P(new Date().getMinutes());
  if (hm !== lastMin) {
    lastMin = hm; const today = dkey(now);
    S.sched.forEach(s => { const k = s.id + today; if (s.time === hm && !S.fired[k]) { S.fired[k] = 1; notify("⏰ Jadwal", s.title); } });
    S.tasks.forEach(t => { if (!t.done && t.due) { const dl = new Date(t.due).getTime() - now, k = "d" + t.id; if (dl > 0 && dl < 36e5 && !S.fired[k]) { S.fired[k] = 1; notify("⚠️ Deadline < 1 jam", t.title); } } });
    if (Object.keys(S.fired).length > 300) S.fired = {}; save();
  }
}
setInterval(tick, 500);

/* Focus Lock: deteksi meninggalkan aplikasi saat sesi fokus */
document.addEventListener("visibilitychange", () => {
  const r = S.run; if (!r || r.phase !== "focus") return;
  if (document.hidden) { leftAt = Date.now(); if (R().lock) return; }
  else if (R().lock && leftAt) {
    r.viol++; leftAt = 0; save();
    const a = $("#alert"); a.hidden = false;
    a.innerHTML = `<h1>🔒 Kembali fokus!</h1><p>Anda meninggalkan sesi fokus (${r.viol}${R().strict ? "/3" : ""}).${R().strict && r.viol >= 3 ? "<br/>Sesi gagal, reward hangus." : ""}</p><button class="b gold" onclick="document.getElementById('alert').hidden=true">Lanjut fokus</button>`;
    if (R().lock) { try { document.documentElement.requestFullscreen(); } catch (e) {} } render();
  }
});
window.addEventListener("beforeunload", e => { if (S.run && S.run.phase === "focus" && R().lock) { e.preventDefault(); e.returnValue = ""; } });

/* Service worker */
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").then(r => reg = r).catch(() => {}));
render();
