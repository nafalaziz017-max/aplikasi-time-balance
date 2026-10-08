// TimeBalance — server akun & langganan (Cloudflare Worker + D1)
//
// - Satu Worker melayani aplikasi PWA (folder www lewat "assets") dan API (/api/*).
// - Semua fitur berbayar: pengguna WAJIB login, lalu punya langganan aktif (bulanan / tahunan).
// - Tidak ada token yang diketik pengguna. Pembayaran → langganan aktif otomatis di AKUN pengguna.
//     Mode "manual"   : bayar QRIS statis + kode unik, admin menekan "Setujui" di /admin.html.
//     Mode "midtrans" : aktif otomatis lewat webhook, bila secret MIDTRANS_SERVER_KEY diisi.

const DAY = 864e5;
const PLANS = {
  monthly: { price: 19000, days: 31, name: "Premium Bulanan" },
  annual: { price: 50000, days: 366, name: "Premium Tahunan" },
};
const SESSION_MS = 90 * DAY;
const MANUAL_TTL = 24 * 3600e3;      // batas menunggu pembayaran manual
const PBKDF2_ITER = 100000;          // batas maksimum PBKDF2 di Cloudflare Workers

const enc = new TextEncoder();
const hex = u8 => Array.from(u8, b => b.toString(16).padStart(2, "0")).join("");
const randHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const b64 = u8 => btoa(String.fromCharCode(...u8));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function sha256hex(s) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)))); }
async function sha512hex(s) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-512", enc.encode(s)))); }
function safeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* ---------- Kata sandi ---------- */
async function hashPassword(password, saltB64) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITER }, key, 256);
  return { hash: b64(new Uint8Array(bits)), salt: b64(salt) };
}

/* ---------- HTTP ---------- */
function corsHeaders(req, env) {
  const origin = req.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const h = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Admin-Secret",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}
const json = (data, status, cors) => new Response(JSON.stringify(data), { status: status || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...cors } });
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const bad = (status, msg) => { throw new HttpError(status, msg); };
const ip = req => req.headers.get("CF-Connecting-IP") || "0.0.0.0";

async function readBody(req) {
  try { const b = await req.json(); return b && typeof b === "object" ? b : {}; } catch (e) { return {}; }
}

/* ---------- Pembatas percobaan ---------- */
async function tooMany(db, key, limit) {
  const r = await db.prepare("SELECT n, reset_at FROM attempts WHERE key=?").bind(key).first();
  return !!(r && r.reset_at > Date.now() && r.n >= limit);
}
async function bump(db, key, windowMs) {
  const now = Date.now();
  await db.prepare("INSERT INTO attempts(key,n,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET n = CASE WHEN reset_at <= ? THEN 1 ELSE n+1 END, reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END")
    .bind(key, now + windowMs, now, now, now + windowMs).run();
}
const clearAttempts = (db, key) => db.prepare("DELETE FROM attempts WHERE key=?").bind(key).run();

/* ---------- Sesi & pengguna ---------- */
const normEmail = e => String(e || "").trim().toLowerCase();
const validEmail = e => e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const publicUser = u => ({ id: String(u.id), email: u.email, name: u.name });
const premiumOf = u => (u && u.premium_until > Date.now() ? { plan: u.premium_plan, until: u.premium_until } : null);

async function newSession(db, userId) {
  const token = "tb_" + randHex(32), now = Date.now();
  await db.prepare("INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)").bind(await sha256hex(token), userId, now, now + SESSION_MS).run();
  return token;
}
async function authUser(req, env) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) bad(401, "Sesi login tidak valid, silakan masuk lagi");
  const row = await env.DB.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash=? AND s.expires_at>?").bind(await sha256hex(token), Date.now()).first();
  if (!row) bad(401, "Sesi login tidak valid, silakan masuk lagi");
  return { user: row, tokenHash: await sha256hex(token) };
}
async function extendPremium(db, userId, days, planName) {
  await db.prepare("UPDATE users SET premium_until = MAX(premium_until, ?1) + ?2, premium_plan = ?3 WHERE id = ?4").bind(Date.now(), days * DAY, planName, userId).run();
}

/* ---------- Pesanan ---------- */
const ttlOf = o => (o.method === "midtrans" ? 3600e3 : MANUAL_TTL);
function effStatus(o) { return o.status === "pending" && Date.now() > o.created_at + ttlOf(o) ? "expired" : o.status; }
function publicOrder(o, env) {
  const out = { id: o.id, plan: o.plan, planName: (PLANS[o.plan] || {}).name || o.plan, amount: o.amount, baseAmount: o.base_amount, method: o.method, status: effStatus(o), createdAt: o.created_at, expiresAt: o.created_at + ttlOf(o) };
  if (o.method === "manual") out.qris = env.QRIS_IMAGE || "/qris.jpeg";
  if (o.method === "midtrans" && o.note && /^https:/.test(o.note)) out.redirectUrl = o.note;
  return out;
}
// Idempotent: pesanan yang sama tidak pernah menambah masa langganan dua kali.
async function markPaid(db, order) {
  const plan = PLANS[order.plan]; if (!plan) return false;
  const now = Date.now();
  const res = await db.batch([
    db.prepare("UPDATE users SET premium_until = MAX(premium_until, ?1) + ?2, premium_plan = ?3 WHERE id = ?4 AND EXISTS (SELECT 1 FROM orders WHERE id = ?5 AND status != 'paid')").bind(now, plan.days * DAY, plan.name, order.user_id, order.id),
    db.prepare("UPDATE orders SET status='paid', paid_at=?1, updated_at=?1 WHERE id=?2 AND status != 'paid'").bind(now, order.id),
  ]);
  return (res[1].meta.changes || 0) === 1;
}

async function createOrder(req, env, user, cors) {
  const body = await readBody(req), planKey = String(body.plan || ""), plan = PLANS[planKey];
  if (!plan) bad(400, "Paket tidak dikenal");
  const db = env.DB, now = Date.now();
  const useMidtrans = !!env.MIDTRANS_SERVER_KEY;

  if (!useMidtrans) {   // pakai ulang pesanan terbuka yang sama (hindari penumpukan kode unik)
    const open = await db.prepare("SELECT * FROM orders WHERE user_id=? AND plan=? AND method='manual' AND status IN ('pending','waiting') AND created_at>? ORDER BY created_at DESC LIMIT 1").bind(user.id, planKey, now - MANUAL_TTL).first();
    if (open) return json({ order: publicOrder(open, env) }, 200, cors);
  }
  const id = "TB-" + now.toString(36).toUpperCase() + "-" + randHex(3).toUpperCase();
  let amount = plan.price, note = "";
  if (!useMidtrans) {   // kode unik 1–99 agar admin bisa mencocokkan mutasi pembayaran
    const used = new Set((await db.prepare("SELECT amount FROM orders WHERE method='manual' AND status IN ('pending','waiting') AND created_at>?").bind(now - MANUAL_TTL).all()).results.map(r => r.amount));
    let code = 0;
    for (let i = 0; i < 40 && !code; i++) { const c = 1 + (crypto.getRandomValues(new Uint8Array(1))[0] % 99); if (!used.has(plan.price + c)) code = c; }
    if (!code) for (let c = 100; c < 1000 && !code; c++) if (!used.has(plan.price + c)) code = c;
    amount = plan.price + code;
  } else {
    const midBase = () => (env.MIDTRANS_ENV === "production" ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com");
    const origin = String(env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
    const payload = {
      transaction_details: { order_id: id, gross_amount: plan.price },
      item_details: [{ id: planKey, price: plan.price, quantity: 1, name: "TimeBalance " + plan.name }],
      customer_details: { email: user.email, first_name: user.name || undefined },
      callbacks: { finish: `${origin}/?order=${id}` },
      expiry: { unit: "minutes", duration: 60 },
    };
    const only = String(env.ENABLED_PAYMENTS || "").split(",").map(s => s.trim()).filter(Boolean);
    if (only.length) payload.enabled_payments = only;
    const r = await fetch(midBase() + "/snap/v1/transactions", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: mtAuth(env) }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.redirect_url) { console.log("midtrans error", r.status, JSON.stringify(j).slice(0, 300)); bad(502, "Gagal membuat pembayaran, coba lagi sebentar lagi"); }
    note = j.redirect_url;
  }
  await db.prepare("INSERT INTO orders(id,user_id,plan,base_amount,amount,method,status,created_at,updated_at,note) VALUES(?,?,?,?,?,?,'pending',?,?,?)")
    .bind(id, user.id, planKey, plan.price, amount, useMidtrans ? "midtrans" : "manual", now, now, note).run();
  return json({ order: publicOrder(await db.prepare("SELECT * FROM orders WHERE id=?").bind(id).first(), env) }, 200, cors);
}

async function ownOrder(env, user, id) {
  const o = id ? await env.DB.prepare("SELECT * FROM orders WHERE id=? AND user_id=?").bind(String(id), user.id).first() : null;
  if (!o) bad(404, "Pesanan tidak ditemukan");
  return o;
}

/* ---------- Midtrans (opsional) ---------- */
const mtAuth = env => "Basic " + btoa(env.MIDTRANS_SERVER_KEY + ":");
const mtApi = env => (env.MIDTRANS_ENV === "production" ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com");
// signature_key = SHA512(order_id + status_code + gross_amount + ServerKey)
async function signatureOk(n, env) {
  if (!env.MIDTRANS_SERVER_KEY || ["order_id", "status_code", "gross_amount", "signature_key"].some(k => typeof n[k] !== "string")) return false;
  return safeEqual(await sha512hex(n.order_id + n.status_code + n.gross_amount + env.MIDTRANS_SERVER_KEY), n.signature_key.toLowerCase());
}
const isPaid = n => n.transaction_status === "settlement" || (n.transaction_status === "capture" && n.fraud_status === "accept");
const isFailed = n => ["deny", "cancel", "expire", "failure"].includes(n.transaction_status);
async function applyMidtrans(env, order, n) {
  if (Math.round(Number(n.gross_amount)) !== order.amount) return false;
  if (isPaid(n)) return markPaid(env.DB, order);
  if (order.status === "pending" && isFailed(n)) await env.DB.prepare("UPDATE orders SET status=?, updated_at=? WHERE id=? AND status='pending'").bind(n.transaction_status === "expire" ? "expired" : "failed", Date.now(), order.id).run();
  return false;
}
async function webhook(req, env) {
  let n; try { n = await req.json(); } catch (e) { return new Response("bad json", { status: 400 }); }
  if (!(await signatureOk(n, env))) return new Response("forbidden", { status: 403 });
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id=? AND method='midtrans'").bind(n.order_id).first();
  if (!order) return new Response("unknown order", { status: 200 });
  if (Math.round(Number(n.gross_amount)) !== order.amount) return new Response("amount mismatch", { status: 400 });
  await applyMidtrans(env, order, n);
  return new Response("ok", { status: 200 });
}

/* ---------- Endpoint pengguna ---------- */
async function register(req, env, cors) {
  const db = env.DB, b = await readBody(req);
  const name = String(b.name || "").trim().replace(/\s+/g, " "), email = normEmail(b.email), password = String(b.password || "");
  if (name.length < 2 || name.length > 40) bad(400, "Nama 2–40 karakter.");
  if (!validEmail(email)) bad(400, "Format email tidak valid.");
  if (password.length < 8 || password.length > 100) bad(400, "Kata sandi minimal 8 karakter.");
  if (await tooMany(db, "reg:" + ip(req), 10)) bad(429, "Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.");
  if (await db.prepare("SELECT 1 FROM users WHERE email=?").bind(email).first()) bad(409, "Email sudah terdaftar. Silakan masuk.");
  await bump(db, "reg:" + ip(req), 3600e3);
  const { hash, salt } = await hashPassword(password), now = Date.now();
  const r = await db.prepare("INSERT INTO users(email,name,pass_hash,pass_salt,created_at,last_login,login_count) VALUES(?,?,?,?,?,?,1)").bind(email, name, hash, salt, now, now).run();
  const user = { id: r.meta.last_row_id, email, name, premium_until: 0, premium_plan: "" };
  return json({ user: publicUser(user), token: await newSession(db, user.id), premium: null }, 200, cors);
}
async function login(req, env, cors) {
  const db = env.DB, b = await readBody(req), email = normEmail(b.email), password = String(b.password || "");
  const kE = "login:" + email, kI = "loginip:" + ip(req);
  if ((await tooMany(db, kE, 8)) || (await tooMany(db, kI, 30))) bad(429, "Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.");
  const u = validEmail(email) ? await db.prepare("SELECT * FROM users WHERE email=?").bind(email).first() : null;
  const ok = u ? safeEqual((await hashPassword(password, u.pass_salt)).hash, u.pass_hash) : (await hashPassword(password), false);   // waktu respons relatif seragam
  if (!ok) { await bump(db, kE, 15 * 60e3); await bump(db, kI, 15 * 60e3); bad(401, "Email atau kata sandi salah."); }
  await clearAttempts(db, kE);
  await db.prepare("UPDATE users SET last_login=?, login_count=login_count+1 WHERE id=?").bind(Date.now(), u.id).run();
  await db.prepare("DELETE FROM sessions WHERE user_id=? AND expires_at<?").bind(u.id, Date.now()).run();
  return json({ user: publicUser(u), token: await newSession(db, u.id), premium: premiumOf(u) }, 200, cors);
}
async function changePassword(req, env, a, cors) {
  const b = await readBody(req), cur = String(b.current || ""), next = String(b.next || "");
  if (next.length < 8 || next.length > 100) bad(400, "Kata sandi baru minimal 8 karakter.");
  if (!safeEqual((await hashPassword(cur, a.user.pass_salt)).hash, a.user.pass_hash)) bad(403, "Kata sandi saat ini salah.");
  const { hash, salt } = await hashPassword(next);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET pass_hash=?, pass_salt=? WHERE id=?").bind(hash, salt, a.user.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id=? AND token_hash!=?").bind(a.user.id, a.tokenHash),
  ]);
  return json({ ok: true }, 200, cors);
}
async function deleteAccount(req, env, a, cors) {
  const b = await readBody(req);
  if (!safeEqual((await hashPassword(String(b.password || ""), a.user.pass_salt)).hash, a.user.pass_hash)) bad(403, "Kata sandi salah.");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(a.user.id),
    env.DB.prepare("DELETE FROM orders WHERE user_id=?").bind(a.user.id),
    env.DB.prepare("DELETE FROM users WHERE id=?").bind(a.user.id),
  ]);
  return json({ ok: true }, 200, cors);
}

async function userRoutes(req, env, path, cors) {
  if (path === "/api/register" && req.method === "POST") return register(req, env, cors);
  if (path === "/api/login" && req.method === "POST") return login(req, env, cors);
  if (path === "/api/plans" && req.method === "GET") {
    return json({ plans: Object.fromEntries(Object.entries(PLANS).map(([k, p]) => [k, { price: p.price, days: p.days, name: p.name }])), method: env.MIDTRANS_SERVER_KEY ? "midtrans" : "manual", qris: env.QRIS_IMAGE || "/qris.jpeg" }, 200, cors);
  }
  if (path === "/api/webhook" && req.method === "POST") return webhook(req, env);

  const a = await authUser(req, env), u = a.user, url = new URL(req.url);
  if (path === "/api/logout" && req.method === "POST") { await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(a.tokenHash).run(); return json({ ok: true }, 200, cors); }
  if (path === "/api/me" && req.method === "GET") {
    const latest = await env.DB.prepare("SELECT * FROM orders WHERE user_id=? AND status IN ('pending','waiting') ORDER BY created_at DESC LIMIT 1").bind(u.id).first();
    const pending = latest && effStatus(latest) !== "expired" ? publicOrder(latest, env) : null;
    return json({ user: publicUser(u), premium: premiumOf(u), pending, serverTime: Date.now() }, 200, cors);
  }
  if (path === "/api/password" && req.method === "POST") return changePassword(req, env, a, cors);
  if (path === "/api/account/delete" && req.method === "POST") return deleteAccount(req, env, a, cors);
  if (path === "/api/order" && req.method === "POST") return createOrder(req, env, u, cors);
  if (path === "/api/order" && req.method === "GET") {
    let o = await ownOrder(env, u, url.searchParams.get("id"));
    if (o.method === "midtrans" && o.status === "pending") {   // cadangan bila webhook terlambat
      try {
        const r = await fetch(`${mtApi(env)}/v2/${encodeURIComponent(o.id)}/status`, { headers: { Accept: "application/json", Authorization: mtAuth(env) } });
        const n = await r.json();
        if (r.ok && n.order_id === o.id && (await signatureOk(n, env))) { await applyMidtrans(env, o, n); o = await ownOrder(env, u, o.id); }
      } catch (e) { /* tunggu webhook */ }
    }
    const fresh = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(u.id).first();
    return json({ order: publicOrder(o, env), premium: premiumOf(fresh) }, 200, cors);
  }
  if (path === "/api/order/paid" && req.method === "POST") {     // pengguna: "Saya sudah bayar"
    const o = await ownOrder(env, u, (await readBody(req)).id);
    if (o.method !== "manual") bad(400, "Pesanan ini diproses otomatis.");
    if (effStatus(o) === "expired") bad(410, "Pesanan sudah kedaluwarsa. Buat pesanan baru.");
    if (o.status === "pending") await env.DB.prepare("UPDATE orders SET status='waiting', updated_at=? WHERE id=? AND status='pending'").bind(Date.now(), o.id).run();
    return json({ order: publicOrder(await ownOrder(env, u, o.id), env) }, 200, cors);
  }
  if (path === "/api/order/cancel" && req.method === "POST") {
    const o = await ownOrder(env, u, (await readBody(req)).id);
    if (o.status === "pending" || o.status === "waiting") await env.DB.prepare("UPDATE orders SET status='cancelled', updated_at=? WHERE id=?").bind(Date.now(), o.id).run();
    return json({ ok: true }, 200, cors);
  }
  bad(404, "Tidak ditemukan");
}

/* ---------- Admin (X-Admin-Secret) ---------- */
async function adminAuth(req, env) {
  if (!env.ADMIN_SECRET) bad(503, "ADMIN_SECRET belum diatur di server.");
  const k = "admin:" + ip(req);
  if (await tooMany(env.DB, k, 10)) bad(429, "Terlalu banyak percobaan. Coba lagi nanti.");
  const given = req.headers.get("X-Admin-Secret") || "";
  if (!safeEqual(await sha256hex(given), await sha256hex(env.ADMIN_SECRET))) { await bump(env.DB, k, 15 * 60e3); bad(401, "Admin Secret salah."); }
}
async function adminRoutes(req, env, path, cors) {
  await adminAuth(req, env);
  const db = env.DB, url = new URL(req.url), now = Date.now();
  if (path === "/api/admin/stats") {
    const one = async (sql, ...p) => (await db.prepare(sql).bind(...p).first()).c;
    const revenue = (await db.prepare("SELECT COALESCE(SUM(amount),0) c FROM orders WHERE status='paid'").first()).c;
    return json({
      users: await one("SELECT COUNT(*) c FROM users"),
      newUsers7d: await one("SELECT COUNT(*) c FROM users WHERE created_at>?", now - 7 * DAY),
      active: await one("SELECT COUNT(*) c FROM users WHERE premium_until>?", now),
      waiting: await one("SELECT COUNT(*) c FROM orders WHERE status='waiting'"),
      paidOrders: await one("SELECT COUNT(*) c FROM orders WHERE status='paid'"),
      revenue,
    }, 200, cors);
  }
  if (path === "/api/admin/orders" && req.method === "GET") {
    const st = url.searchParams.get("status") || "open";
    const where = st === "all" ? "1=1" : st === "open" ? "o.status IN ('pending','waiting')" : "o.status = ?";
    const stmt = db.prepare(`SELECT o.*, u.email, u.name FROM orders o JOIN users u ON u.id=o.user_id WHERE ${where} ORDER BY (o.status='waiting') DESC, o.created_at DESC LIMIT 200`);
    const rows = (st === "all" || st === "open" ? await stmt.all() : await stmt.bind(st).all()).results;
    return json({ orders: rows.map(o => ({ ...publicOrder(o, env), email: o.email, name: o.name, note: undefined })) }, 200, cors);
  }
  if (path === "/api/admin/orders/approve" && req.method === "POST") {
    const o = await db.prepare("SELECT * FROM orders WHERE id=?").bind(String((await readBody(req)).id || "")).first();
    if (!o) bad(404, "Pesanan tidak ditemukan");
    if (o.status === "paid") bad(409, "Pesanan sudah disetujui sebelumnya.");
    await markPaid(db, o);
    return json({ ok: true }, 200, cors);
  }
  if (path === "/api/admin/orders/reject" && req.method === "POST") {
    const id = String((await readBody(req)).id || "");
    await db.prepare("UPDATE orders SET status='rejected', updated_at=? WHERE id=? AND status!='paid'").bind(now, id).run();
    return json({ ok: true }, 200, cors);
  }
  if (path === "/api/admin/users" && req.method === "GET") {
    const q = "%" + String(url.searchParams.get("q") || "").trim().toLowerCase().replace(/[%_]/g, "") + "%";
    const rows = (await db.prepare("SELECT id,email,name,premium_until,premium_plan,created_at,last_login,login_count FROM users WHERE lower(email) LIKE ?1 OR lower(name) LIKE ?1 ORDER BY created_at DESC LIMIT 200").bind(q).all()).results;
    return json({ users: rows.map(u => ({ id: u.id, email: u.email, name: u.name, plan: u.premium_plan, until: u.premium_until, active: u.premium_until > now, createdAt: u.created_at, lastLogin: u.last_login, logins: u.login_count })) }, 200, cors);
  }
  if (path === "/api/admin/grant" && req.method === "POST") {   // beri akses manual (mis. akun demo untuk dosen)
    const b = await readBody(req), email = normEmail(b.email), u = await db.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
    if (!u) bad(404, "Pengguna dengan email itu belum mendaftar.");
    const plan = PLANS[b.plan], days = plan ? plan.days : Math.floor(Number(b.days));
    if (!(days >= 1 && days <= 3660)) bad(400, "Pilih paket atau isi jumlah hari (1–3660).");
    await extendPremium(db, u.id, days, plan ? plan.name : "Akses Manual");
    return json({ ok: true }, 200, cors);
  }
  if (path === "/api/admin/revoke" && req.method === "POST") {
    const email = normEmail((await readBody(req)).email);
    await db.prepare("UPDATE users SET premium_until=0, premium_plan='' WHERE email=?").bind(email).run();
    return json({ ok: true }, 200, cors);
  }
  if (path === "/api/admin/reset-password" && req.method === "POST") {   // untuk pengguna yang lupa kata sandi
    const b = await readBody(req), email = normEmail(b.email), pw = String(b.password || "");
    if (pw.length < 8) bad(400, "Kata sandi sementara minimal 8 karakter.");
    const u = await db.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
    if (!u) bad(404, "Pengguna tidak ditemukan.");
    const { hash, salt } = await hashPassword(pw);
    await db.batch([db.prepare("UPDATE users SET pass_hash=?, pass_salt=? WHERE id=?").bind(hash, salt, u.id), db.prepare("DELETE FROM sessions WHERE user_id=?").bind(u.id), db.prepare("DELETE FROM attempts WHERE key=?").bind("login:" + email)]);
    return json({ ok: true }, 200, cors);
  }
  bad(404, "Tidak ditemukan");
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname.replace(/\/+$/, "") || "/";
    if (!path.startsWith("/api/")) return env.ASSETS ? env.ASSETS.fetch(req) : new Response("TimeBalance API", { status: 200 });
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (path === "/api") return json({ ok: true, service: "timebalance-api" }, 200, cors);
    if (!env.DB) return json({ error: "Database D1 belum terhubung (binding DB)." }, 500, cors);
    try {
      return path.startsWith("/api/admin/") ? await adminRoutes(req, env, path, cors) : await userRoutes(req, env, path, cors);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status, cors);
      console.log("error", e && e.stack || e);
      return json({ error: "Terjadi kesalahan di server, coba lagi." }, 500, cors);
    }
  },
};
