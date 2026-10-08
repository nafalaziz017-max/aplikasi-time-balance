// Uji Worker (akun, langganan, admin, Midtrans) dengan D1 tiruan. Jalankan: node worker/test/worker.test.mjs  (Node 22+)
import worker from "../src/index.js";
import { makeD1 } from "./d1-shim.mjs";

const ADMIN = "rahasia-admin-123";
const base = { ADMIN_SECRET: ADMIN, ALLOWED_ORIGINS: "https://localhost,capacitor://localhost", QRIS_IMAGE: "/qris.jpeg", ASSETS: { fetch: async () => new Response("ASSET") } };
let env = { ...base, DB: makeD1() };
let fail = 0; const t = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) fail++; };
const call = async (method, path, { body, token, admin, headers = {}, e = env } = {}) => {
  const h = { ...headers }; if (token) h.Authorization = "Bearer " + token; if (admin) h["X-Admin-Secret"] = admin; if (body) h["Content-Type"] = "application/json";
  const r = await worker.fetch(new Request("https://app.test" + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined }), e);
  let j = {}; try { j = await r.clone().json(); } catch (_) {}
  return { s: r.status, j, r };
};
const DAY = 864e5;

// ---------- Akun ----------
t("file aplikasi diteruskan ke ASSETS", await (await worker.fetch(new Request("https://app.test/index.html"), env)).text() === "ASSET");
t("nama terlalu pendek ditolak", (await call("POST", "/api/register", { body: { name: "A", email: "a@b.co", password: "12345678" } })).s === 400);
t("email tidak valid ditolak", (await call("POST", "/api/register", { body: { name: "Budi", email: "bukan-email", password: "12345678" } })).s === 400);
t("kata sandi < 8 ditolak", (await call("POST", "/api/register", { body: { name: "Budi", email: "b@x.com", password: "1234567" } })).s === 400);
const reg = await call("POST", "/api/register", { body: { name: "Budi Santoso", email: "  Budi@X.com ", password: "rahasia123" } });
t("daftar sukses, email dinormalkan, token tersedia", reg.s === 200 && reg.j.user.email === "budi@x.com" && reg.j.user.name === "Budi Santoso" && /^tb_/.test(reg.j.token) && reg.j.premium === null);
const tok = reg.j.token;
t("password tidak tersimpan polos", JSON.stringify(env.DB.raw.prepare("SELECT * FROM users").all()).includes("rahasia123") === false);
t("token tidak tersimpan polos", env.DB.raw.prepare("SELECT token_hash FROM sessions").all().every(r => r.token_hash !== tok));
t("email dobel -> 409", (await call("POST", "/api/register", { body: { name: "Budi", email: "budi@x.com", password: "rahasia123" } })).s === 409);
t("login salah -> 401", (await call("POST", "/api/login", { body: { email: "budi@x.com", password: "salah-salah" } })).s === 401);
const lg = await call("POST", "/api/login", { body: { email: "BUDI@x.com", password: "rahasia123" } });
t("login benar", lg.s === 200 && lg.j.user.id === reg.j.user.id);
t("/api/me tanpa token -> 401", (await call("GET", "/api/me")).s === 401);
t("/api/me token ngawur -> 401", (await call("GET", "/api/me", { token: "tb_ngawur" })).s === 401);
const me = await call("GET", "/api/me", { token: tok });
t("/api/me: belum premium", me.s === 200 && me.j.premium === null && me.j.pending === null);

// ---------- Pesanan manual ----------
const pl = await call("GET", "/api/plans");
t("daftar paket: bulanan 19000 & tahunan 50000, metode manual", pl.j.plans.monthly.price === 19000 && pl.j.plans.annual.price === 50000 && pl.j.method === "manual" && Object.keys(pl.j.plans).length === 2);
t("paket tak dikenal ditolak", (await call("POST", "/api/order", { token: tok, body: { plan: "gratis" } })).s === 400);
t("order butuh login", (await call("POST", "/api/order", { body: { plan: "monthly" } })).s === 401);
const o1 = await call("POST", "/api/order", { token: tok, body: { plan: "monthly" } });
t("order bulanan: nominal 19.001–19.099, metode manual, ada QRIS", o1.s === 200 && o1.j.order.amount > 19000 && o1.j.order.amount < 19100 && o1.j.order.method === "manual" && o1.j.order.qris === "/qris.jpeg" && o1.j.order.status === "pending");
const o1b = await call("POST", "/api/order", { token: tok, body: { plan: "monthly" } });
t("order terbuka dipakai ulang (tidak menumpuk)", o1b.j.order.id === o1.j.order.id);
const paid = await call("POST", "/api/order/paid", { token: tok, body: { id: o1.j.order.id } });
t("klik 'sudah bayar' -> waiting", paid.j.order.status === "waiting");
t("/api/me menampilkan pesanan tertunda", (await call("GET", "/api/me", { token: tok })).j.pending.id === o1.j.order.id);
t("pengguna lain tidak bisa lihat pesanan ini", await (async () => { const r2 = await call("POST", "/api/register", { body: { name: "Siti", email: "siti@x.com", password: "rahasia123" } }); return (await call("GET", "/api/order?id=" + o1.j.order.id, { token: r2.j.token })).s === 404; })());

// ---------- Admin ----------
t("admin tanpa secret -> 401", (await call("GET", "/api/admin/stats")).s === 401);
t("admin secret salah -> 401", (await call("GET", "/api/admin/stats", { admin: "salah" })).s === 401);
t("admin 503 bila ADMIN_SECRET belum diatur", (await call("GET", "/api/admin/stats", { admin: "x", e: { ...env, ADMIN_SECRET: "" } })).s === 503);
const ol = await call("GET", "/api/admin/orders", { admin: ADMIN });
t("admin melihat pesanan menunggu + email pembeli", ol.s === 200 && ol.j.orders[0].status === "waiting" && ol.j.orders[0].email === "budi@x.com" && ol.j.orders[0].amount === o1.j.order.amount);
const ap = await call("POST", "/api/admin/orders/approve", { admin: ADMIN, body: { id: o1.j.order.id } });
const me2 = await call("GET", "/api/me", { token: tok });
const until1 = me2.j.premium && me2.j.premium.until;
t("setujui -> premium otomatis aktif ±31 hari di AKUN (tanpa token)", ap.s === 200 && me2.j.premium.plan === "Premium Bulanan" && Math.abs(until1 - Date.now() - 31 * DAY) < 5000 && me2.j.pending === null);
t("setujui dua kali -> 409, masa aktif tidak bertambah", (await call("POST", "/api/admin/orders/approve", { admin: ADMIN, body: { id: o1.j.order.id } })).s === 409 && (await call("GET", "/api/me", { token: tok })).j.premium.until === until1);
const o2 = await call("POST", "/api/order", { token: tok, body: { plan: "annual" } });
await call("POST", "/api/admin/orders/approve", { admin: ADMIN, body: { id: o2.j.order.id } });
const until2 = (await call("GET", "/api/me", { token: tok })).j.premium.until;
t("tahunan memperpanjang dari sisa masa aktif (+366 hari)", Math.abs(until2 - until1 - 366 * DAY) < 5000 && (await call("GET", "/api/me", { token: tok })).j.premium.plan === "Premium Tahunan");
const st = await call("GET", "/api/admin/stats", { admin: ADMIN });
t("statistik admin", st.j.users === 2 && st.j.active === 1 && st.j.paidOrders === 2 && st.j.revenue === o1.j.order.amount + o2.j.order.amount);
t("daftar pengguna + pencarian", (await call("GET", "/api/admin/users?q=siti", { admin: ADMIN })).j.users.length === 1 && (await call("GET", "/api/admin/users", { admin: ADMIN })).j.users.find(u => u.email === "budi@x.com").active === true);
const o3 = await call("POST", "/api/order", { token: tok, body: { plan: "monthly" } });
await call("POST", "/api/admin/orders/reject", { admin: ADMIN, body: { id: o3.j.order.id } });
t("tolak pesanan", (await call("GET", "/api/order?id=" + o3.j.order.id, { token: tok })).j.order.status === "rejected");
t("grant manual by email (akun demo dosen)", (await call("POST", "/api/admin/grant", { admin: ADMIN, body: { email: "siti@x.com", days: 30 } })).s === 200 && (await call("POST", "/api/login", { body: { email: "siti@x.com", password: "rahasia123" } })).j.premium.plan === "Akses Manual");
t("grant email belum terdaftar -> 404", (await call("POST", "/api/admin/grant", { admin: ADMIN, body: { email: "tidakada@x.com", days: 30 } })).s === 404);
await call("POST", "/api/admin/revoke", { admin: ADMIN, body: { email: "siti@x.com" } });
t("cabut akses", (await call("POST", "/api/login", { body: { email: "siti@x.com", password: "rahasia123" } })).j.premium === null);

// ---------- Kedaluwarsa ----------
env.DB.raw.prepare("UPDATE users SET premium_until=? WHERE email='budi@x.com'").run(Date.now() - 1000);
t("langganan lewat masa -> /api/me premium null (aplikasi terkunci lagi)", (await call("GET", "/api/me", { token: tok })).j.premium === null);
const oOld = await call("POST", "/api/order", { token: tok, body: { plan: "monthly" } });
env.DB.raw.prepare("UPDATE orders SET created_at=? WHERE id=?").run(Date.now() - 25 * 3600e3, oOld.j.order.id);
t("pesanan manual > 24 jam -> expired & tak bisa 'sudah bayar'", (await call("GET", "/api/order?id=" + oOld.j.order.id, { token: tok })).j.order.status === "expired" && (await call("POST", "/api/order/paid", { token: tok, body: { id: oOld.j.order.id } })).s === 410);

// ---------- Kata sandi ----------
t("ganti sandi: sandi lama salah -> 403", (await call("POST", "/api/password", { token: tok, body: { current: "salah", next: "baru-12345" } })).s === 403);
t("ganti sandi sukses, sesi lain dicabut, sesi ini tetap", await (async () => {
  const other = (await call("POST", "/api/login", { body: { email: "budi@x.com", password: "rahasia123" } })).j.token;
  const r = await call("POST", "/api/password", { token: tok, body: { current: "rahasia123", next: "baru-12345" } });
  return r.s === 200 && (await call("GET", "/api/me", { token: other })).s === 401 && (await call("GET", "/api/me", { token: tok })).s === 200 && (await call("POST", "/api/login", { body: { email: "budi@x.com", password: "baru-12345" } })).s === 200;
})());
t("admin reset sandi (lupa kata sandi) mencabut semua sesi", await (async () => {
  const r = await call("POST", "/api/admin/reset-password", { admin: ADMIN, body: { email: "budi@x.com", password: "sementara-1" } });
  return r.s === 200 && (await call("GET", "/api/me", { token: tok })).s === 401 && (await call("POST", "/api/login", { body: { email: "budi@x.com", password: "sementara-1" } })).s === 200;
})());
t("logout mencabut sesi", await (async () => { const k = (await call("POST", "/api/login", { body: { email: "budi@x.com", password: "sementara-1" } })).j.token; await call("POST", "/api/logout", { token: k }); return (await call("GET", "/api/me", { token: k })).s === 401; })());

// ---------- Pembatas percobaan ----------
let lastS = 0; for (let i = 0; i < 9; i++) lastS = (await call("POST", "/api/login", { body: { email: "siti@x.com", password: "salah-" + i } })).s;
t("8x salah -> percobaan ke-9 diblokir (429), bahkan dengan sandi benar", lastS === 429 && (await call("POST", "/api/login", { body: { email: "siti@x.com", password: "rahasia123" } })).s === 429);
let aS = 0; for (let i = 0; i < 11; i++) aS = (await call("GET", "/api/admin/stats", { admin: "tebak" + i })).s;
t("tebak Admin Secret dibatasi (429)", aS === 429);

// ---------- Hapus akun ----------
t("hapus akun butuh sandi benar", (await call("POST", "/api/account/delete", { token: (await call("POST", "/api/login", { body: { email: "budi@x.com", password: "sementara-1" } })).j.token, body: { password: "salah" } })).s === 403);
t("hapus akun sukses", await (async () => { const k = (await call("POST", "/api/login", { body: { email: "budi@x.com", password: "sementara-1" } })).j.token; const r = await call("POST", "/api/account/delete", { token: k, body: { password: "sementara-1" } }); return r.s === 200 && (await call("GET", "/api/me", { token: k })).s === 401 && env.DB.raw.prepare("SELECT COUNT(*) c FROM users WHERE email='budi@x.com'").get().c === 0; })());

// ---------- CORS ----------
const pre = await worker.fetch(new Request("https://app.test/api/login", { method: "OPTIONS", headers: { Origin: "https://localhost" } }), env);
t("CORS: origin aplikasi Android diizinkan", pre.status === 204 && pre.headers.get("Access-Control-Allow-Origin") === "https://localhost");
const pre2 = await worker.fetch(new Request("https://app.test/api/login", { method: "OPTIONS", headers: { Origin: "https://jahat.example" } }), env);
t("CORS: origin asing tidak diizinkan", !pre2.headers.get("Access-Control-Allow-Origin"));

// ---------- Midtrans (opsional, fetch tiruan) ----------
{
  const KEY = "SB-Mid-server-TESTKEY";
  const menv = { ...base, DB: makeD1(), MIDTRANS_SERVER_KEY: KEY, MIDTRANS_ENV: "sandbox" };
  let snapBody = null, statusReply = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    if (url.includes("/snap/v1/transactions")) { snapBody = JSON.parse(init.body); return new Response(JSON.stringify({ token: "x", redirect_url: "https://app.sandbox.midtrans.com/snap/v4/redirection/abc" }), { status: 201 }); }
    if (url.includes("/status")) return new Response(JSON.stringify(statusReply), { status: 200 });
    return new Response("{}", { status: 404 });
  };
  const sig = async (n) => { const d = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(n.order_id + n.status_code + n.gross_amount + KEY)); return Buffer.from(d).toString("hex"); };
  const r = await call("POST", "/api/register", { e: menv, body: { name: "Mid User", email: "m@x.com", password: "rahasia123" } });
  const pl2 = await call("GET", "/api/plans", { e: menv });
  const o = await call("POST", "/api/order", { e: menv, token: r.j.token, body: { plan: "annual" } });
  t("Midtrans: metode midtrans, harga persis tanpa kode unik, ada redirectUrl", pl2.j.method === "midtrans" && o.j.order.amount === 50000 && o.j.order.redirectUrl.startsWith("https://app.sandbox.midtrans.com/") && snapBody.transaction_details.gross_amount === 50000 && snapBody.callbacks.finish.startsWith("https://app.test/?order=TB-"));
  const n = { order_id: o.j.order.id, status_code: "200", gross_amount: "50000.00", transaction_status: "settlement", signature_key: "" };
  t("Webhook tanda tangan salah -> 403", (await call("POST", "/api/webhook", { e: menv, body: { ...n, signature_key: "salah" } })).s === 403);
  n.signature_key = await sig(n);
  t("Webhook nominal tidak cocok -> 400", (await call("POST", "/api/webhook", { e: menv, body: { ...n, gross_amount: "1000.00", signature_key: await sig({ ...n, gross_amount: "1000.00" }) } })).s === 400);
  t("Webhook settlement -> premium tahunan aktif otomatis", (await call("POST", "/api/webhook", { e: menv, body: n })).s === 200 && (await call("GET", "/api/me", { e: menv, token: r.j.token })).j.premium.plan === "Premium Tahunan");
  const u1 = (await call("GET", "/api/me", { e: menv, token: r.j.token })).j.premium.until;
  await call("POST", "/api/webhook", { e: menv, body: n });
  t("Webhook dikirim ulang tidak menambah masa aktif (idempotent)", (await call("GET", "/api/me", { e: menv, token: r.j.token })).j.premium.until === u1);
  const o2m = await call("POST", "/api/order", { e: menv, token: r.j.token, body: { plan: "monthly" } });
  const n2 = { order_id: o2m.j.order.id, status_code: "200", gross_amount: "19000.00", transaction_status: "settlement", signature_key: "" }; n2.signature_key = await sig(n2); statusReply = n2;
  const chk = await call("GET", "/api/order?id=" + o2m.j.order.id, { e: menv, token: r.j.token });
  t("Cek status cadangan ke Midtrans (webhook telat) mengaktifkan premium", chk.j.order.status === "paid" && chk.j.premium.until > u1);
  globalThis.fetch = realFetch;
}

console.log(fail ? `\n${fail} UJI GAGAL` : "\nSEMUA UJI LOLOS");
process.exit(fail ? 1 : 0);
