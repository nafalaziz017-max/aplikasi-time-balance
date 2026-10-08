// Uji klien www/tb-auth.js dengan fetch & localStorage tiruan. Jalankan: node worker/test/auth.test.mjs
import fs from "node:fs";
const store = new Map();
globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.TB_CONFIG = { API_BASE: "", NATIVE_API_BASE: "https://api.test/" };

const calls = []; let users = {}, meStatus = 200;
globalThis.fetch = async (url, init = {}) => {
  url = String(url); calls.push({ url, init });
  const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s });
  const b = init.body ? JSON.parse(init.body) : {};
  if (url.endsWith("/api/register")) { if (users[b.email]) return J({ error: "Email sudah terdaftar. Silakan masuk." }, 409); users[b.email] = b.password; return J({ user: { id: 7, email: b.email, name: b.name }, token: "tb_T1", premium: null }); }
  if (url.endsWith("/api/login")) return users[b.email] === b.password ? J({ user: { id: 7, email: b.email, name: "Budi" }, token: "tb_T2", premium: { plan: "Premium Bulanan", until: 123 } }) : J({ error: "Email atau kata sandi salah." }, 401);
  if (url.endsWith("/api/me")) return meStatus === 200 ? J({ user: { id: 7 }, premium: null, pending: null }) : J({ error: "x" }, meStatus);
  if (url.endsWith("/api/order") && init.method === "POST") return J({ order: { id: "TB-1", amount: 19012, method: "manual" } });
  if (url.endsWith("/api/logout")) return J({ ok: true });
  return J({ error: "?" }, 404);
};
(0, eval)(fs.readFileSync(new URL("../../www/tb-auth.js", import.meta.url), "utf8"));
const A = globalThis.TBAuth;
let fail = 0; const t = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) fail++; };
const rej = async p => { try { await p; return null; } catch (e) { return e; } };

t("web: configured() true tanpa API_BASE (satu domain)", A.configured() === true);
t("belum login -> user null", A.user() === null);
t("email tidak valid ditolak tanpa memanggil server", (await rej(A.signUp("Budi", "bukan-email", "password123"))).code === "INVALID_EMAIL" && calls.length === 0);
t("kata sandi < 8 ditolak", (await rej(A.signUp("Budi", "a@b.co", "1234567"))).code === "WEAK_PASSWORD" && calls.length === 0);
t("nama kosong ditolak", (await rej(A.signUp("", "a@b.co", "12345678"))).code === "INVALID_NAME");
let changed = 0; A.onChange(() => changed++);
const r = await A.signUp(" Budi ", "  Budi@X.com ", "rahasia123");
t("daftar sukses: email huruf kecil, nama tersimpan, URL relatif (same-origin)", r.user.email === "budi@x.com" && A.user().name === "Budi" && calls.at(-1).url === "/api/register" && changed === 1);
t("daftar dobel -> pesan server", (await rej(A.signUp("Budi", "budi@x.com", "rahasia123"))).message.includes("sudah terdaftar"));
A.signOut(); t("keluar -> user null + panggil /api/logout", A.user() === null && changed === 2 && calls.at(-1).url === "/api/logout");
t("login salah -> pesan server, sesi tidak terhapus karena anon", (await rej(A.signIn("budi@x.com", "salah"))).message === "Email atau kata sandi salah.");
const l = await A.signIn("budi@x.com", "rahasia123");
t("login sukses + premium ikut", l.premium.plan === "Premium Bulanan" && A.user().uid === "7");
await A.me(); t("me() memakai Bearer token", calls.at(-1).init.headers.Authorization === "Bearer tb_T2");
t("createOrder mengirim paket & mengembalikan order", (await A.createOrder("monthly")).amount === 19012 && JSON.parse(calls.at(-1).init.body).plan === "monthly");
meStatus = 401; changed = 0;
t("401 dari server -> sesi dihapus + onChange + kode AUTH", (await rej(A.me())).code === "AUTH" && A.user() === null && changed === 1);
// Android (Capacitor): wajib alamat server lengkap
globalThis.Capacitor = { isNativePlatform: () => true };
(0, eval)(fs.readFileSync(new URL("../../www/tb-auth.js", import.meta.url), "utf8"));
await globalThis.TBAuth.signIn("budi@x.com", "rahasia123");
t("APK: memakai NATIVE_API_BASE absolut", calls.at(-1).url === "https://api.test/api/login");
console.log(fail ? `\n${fail} UJI GAGAL` : "\nSEMUA UJI LOLOS"); process.exit(fail ? 1 : 0);
