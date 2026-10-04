// Uji tb-auth.js dengan fetch & localStorage tiruan. Jalankan: node test/auth.test.mjs
import fs from "node:fs";
const store = new Map();
globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.TB_CONFIG = { FIREBASE_API_KEY: "KEY123", API_BASE: "https://api.test/", REQUIRE_LOGIN: false };

let calls = [], nextIdExpiry = "3600", meStatus = [200], refreshFail = null, users = {};
globalThis.fetch = async (url, init = {}) => {
  url = String(url); calls.push({ url, init });
  const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s });
  if (url.includes("identitytoolkit") && url.includes("accounts:signUp")) {
    const b = JSON.parse(init.body);
    if (users[b.email]) return J({ error: { message: "EMAIL_EXISTS" } }, 400);
    users[b.email] = b.password; return J({ localId: "u1", email: b.email, idToken: "ID1", refreshToken: "RT1", expiresIn: nextIdExpiry });
  }
  if (url.includes("accounts:signInWithPassword")) {
    const b = JSON.parse(init.body);
    if (users[b.email] !== b.password) return J({ error: { message: "INVALID_LOGIN_CREDENTIALS" } }, 400);
    return J({ localId: "u1", email: b.email, idToken: "ID2", refreshToken: "RT2", expiresIn: nextIdExpiry });
  }
  if (url.includes("accounts:sendOobCode")) return J({ email: "x" });
  if (url.includes("securetoken.googleapis.com")) {
    if (refreshFail) return J({ error: { message: refreshFail } }, 400);
    if (!/refresh_token=RT/.test(init.body) || init.headers["Content-Type"] !== "application/x-www-form-urlencoded") return J({ error: { message: "BAD" } }, 400);
    return J({ id_token: "ID3", refresh_token: "RT3", expires_in: "3600", user_id: "u1" });
  }
  if (url === "https://api.test/me") { const s = meStatus.length > 1 ? meStatus.shift() : meStatus[0]; return s === 200 ? J({ premium: { plan: "Premium Bulanan", until: 123 } }) : J({ error: "x" }, s); }
  if (url === "https://api.test/order") return J({ orderId: "TB-1", redirectUrl: "https://pay" });
  return J({}, 404);
};
fs.readFileSync(new URL("../../www/tb-auth.js", import.meta.url), "utf8") && (0, eval)(fs.readFileSync(new URL("../../www/tb-auth.js", import.meta.url), "utf8"));
const A = globalThis.TBAuth;
let fail = 0; const t = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) fail++; };
const rej = async (p) => { try { await p; return null; } catch (e) { return e; } };

t("configured() true saat terisi", A.configured() === true);
t("belum login -> user null", A.user() === null);
t("email tidak valid ditolak", (await rej(A.signUp("bukan-email", "password123"))).code === "INVALID_EMAIL");
t("password < 8 ditolak tanpa memanggil Firebase", (calls.length = 0, (await rej(A.signUp("a@b.co", "1234567"))).code === "WEAK_PASSWORD" && calls.length === 0));
let changed = 0; A.onChange(() => changed++);
const u = await A.signUp("  Budi@X.com ", "rahasia123");
t("daftar sukses (email dinormalkan huruf kecil)", u.email === "budi@x.com" && A.user().uid === "u1" && changed === 1);
t("email verifikasi dikirim", calls.some(c => c.url.includes("sendOobCode") && JSON.parse(c.init.body).requestType === "VERIFY_EMAIL"));
t("API key ikut di URL Firebase", calls[0].url.includes("key=KEY123"));
t("daftar email yang sama -> EMAIL_EXISTS", (await rej(A.signUp("budi@x.com", "rahasia123"))).code === "EMAIL_EXISTS");
A.signOut(); t("keluar -> user null + onChange", A.user() === null && changed === 2);
t("login password salah -> pesan ramah", (await rej(A.signIn("budi@x.com", "salah"))).message === "Email atau kata sandi salah.");
await A.signIn("budi@x.com", "rahasia123"); t("login sukses", A.user().email === "budi@x.com");
t("reset password mengirim PASSWORD_RESET", (calls.length = 0, await A.resetPassword("budi@x.com"), JSON.parse(calls[0].init.body).requestType === "PASSWORD_RESET"));

calls.length = 0; const p = await A.fetchPremium();
t("fetchPremium memakai Bearer token", p.plan === "Premium Bulanan" && calls[0].init.headers.Authorization === "Bearer ID2" && calls[0].url === "https://api.test/me");
const o = await A.createOrder("annual");
t("createOrder POST body paket", o.orderId === "TB-1" && JSON.parse(calls.at(-1).init.body).plan === "annual");

// token hampir habis -> refresh otomatis
const s = JSON.parse(store.get("tb-auth-v1")); s.exp = Date.now() + 1000; store.set("tb-auth-v1", JSON.stringify(s));
calls.length = 0; await A.fetchPremium();
t("token hampir habis -> di-refresh lalu dipakai (ID3)", calls[0].url.includes("securetoken") && calls.at(-1).init.headers.Authorization === "Bearer ID3");
t("refresh token baru tersimpan", JSON.parse(store.get("tb-auth-v1")).refreshToken === "RT3");
// refresh paralel hanya sekali
const s2 = JSON.parse(store.get("tb-auth-v1")); s2.exp = 0; store.set("tb-auth-v1", JSON.stringify(s2));
calls.length = 0; await Promise.all([A.getToken(), A.getToken(), A.getToken()]);
t("3 permintaan bersamaan -> 1x refresh", calls.filter(c => c.url.includes("securetoken")).length === 1);

// 401 sekali -> coba ulang dengan token baru
meStatus = [401, 200]; calls.length = 0;
t("401 lalu 200 -> otomatis coba ulang", (await A.fetchPremium()).until === 123 && calls.filter(c => c.url.endsWith("/me")).length === 2);
// 401 terus -> keluar
meStatus = [401];
const e401 = await rej(A.fetchPremium());
t("401 terus-menerus -> AUTH + logout", e401.code === "AUTH" && A.user() === null);
// refresh token dicabut -> logout otomatis
await A.signIn("budi@x.com", "rahasia123");
const s3 = JSON.parse(store.get("tb-auth-v1")); s3.exp = 0; store.set("tb-auth-v1", JSON.stringify(s3)); refreshFail = "TOKEN_EXPIRED";
t("refresh token kedaluwarsa -> logout otomatis", (await rej(A.fetchPremium())).code === "AUTH" && A.user() === null);
refreshFail = null;
// offline: sesi tidak dihapus
await A.signIn("budi@x.com", "rahasia123");
const s4 = JSON.parse(store.get("tb-auth-v1")); s4.exp = 0; store.set("tb-auth-v1", JSON.stringify(s4));
const real = globalThis.fetch; globalThis.fetch = async () => { throw new TypeError("offline"); };
const eoff = await rej(A.fetchPremium());
t("offline -> NETWORK, sesi tetap ada", eoff.code === "NETWORK" && A.user() !== null);
globalThis.fetch = real;
// belum dikonfigurasi
globalThis.TB_CONFIG = { FIREBASE_API_KEY: "GANTI-API-KEY-FIREBASE", API_BASE: "https://x" };
t("placeholder GANTI -> belum dikonfigurasi", A.configured() === false && (await rej(A.signIn("a@b.co", "x"))).code === "NOT_CONFIGURED");
console.log(fail ? `\n${fail} GAGAL` : "\nSemua lolos"); process.exit(fail ? 1 : 0);
