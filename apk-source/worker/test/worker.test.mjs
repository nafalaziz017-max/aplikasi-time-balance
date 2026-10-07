// Uji lokal Worker dengan Firebase & Midtrans tiruan. Jalankan: node worker/test/worker.test.mjs
import { webcrypto } from "node:crypto";
import worker from "../src/index.js";

const subtle = webcrypto.subtle;
const b64u = b => Buffer.from(b).toString("base64url");
const PROJECT = "tb-test";
const SERVER_KEY = "SB-Mid-server-TESTKEY";

// --- KV tiruan ---
const store = new Map();
const KV = {
  async get(k, t) { const v = store.get(k); if (v == null) return null; return t === "json" ? JSON.parse(v) : v; },
  async put(k, v) { store.set(k, v); },
};
const env = { MIDTRANS_SERVER_KEY: SERVER_KEY, FIREBASE_PROJECT_ID: PROJECT, MIDTRANS_ENV: "sandbox", SITE_URL: "https://situs.test", ALLOWED_ORIGINS: "https://situs.test,https://localhost", PREMIUM: KV };

// --- kunci Firebase tiruan ---
const kp = await subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const pubJwk = { ...(await subtle.exportKey("jwk", kp.publicKey)), kid: "kid1", alg: "RS256", use: "sig" };
async function fbToken(over = {}, kid = "kid1", key = kp.privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const p = { aud: PROJECT, iss: "https://securetoken.google.com/" + PROJECT, sub: "uid-budi", email: "budi@x.com", iat: now - 10, auth_time: now - 10, exp: now + 3000, ...over };
  const h = b64u(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })), b = b64u(JSON.stringify(p));
  const sig = await subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(h + "." + b));
  return h + "." + b + "." + b64u(sig);
}
const sha512 = async s => Buffer.from(await subtle.digest("SHA-512", new TextEncoder().encode(s))).toString("hex");

// --- fetch tiruan (JWKS, Midtrans Snap, Midtrans status) ---
const mtStatus = {}; let snapBody = null;
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
  if (url.includes("securetoken@system.gserviceaccount.com")) return json({ keys: [pubJwk] });
  if (url.endsWith("/snap/v1/transactions")) {
    if (init.headers.Authorization !== "Basic " + Buffer.from(SERVER_KEY + ":").toString("base64")) return json({ error: "auth" }, 401);
    snapBody = JSON.parse(init.body);
    return json({ token: "snaptok", redirect_url: "https://app.sandbox.midtrans.com/snap/v4/redirection/snaptok" }, 201);
  }
  const m = url.match(/\/v2\/(.+)\/status$/);
  if (m) { const s = mtStatus[decodeURIComponent(m[1])]; return s ? json(s) : json({ status_code: "404" }, 404); }
  return json({}, 404);
};

let fail = 0;
const t = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) fail++; };
const call = (path, { method = "GET", token, body, origin } = {}) => worker.fetch(new Request("https://api.test" + path, {
  method, headers: { ...(token ? { Authorization: "Bearer " + token } : {}), ...(origin ? { Origin: origin } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
  body: body ? JSON.stringify(body) : undefined,
}), env);
async function notif(orderId, amount, status, extra = {}, key = SERVER_KEY) {
  const n = { order_id: orderId, status_code: "200", gross_amount: amount + ".00", transaction_status: status, fraud_status: "accept", payment_type: "qris", ...extra };
  n.signature_key = await sha512(n.order_id + n.status_code + n.gross_amount + key);
  return n;
}

const good = await fbToken();

// 1. otentikasi
t("/me tanpa token -> 401", (await call("/me")).status === 401);
t("/me token kedaluwarsa -> 401", (await call("/me", { token: await fbToken({ exp: 1 }) })).status === 401);
t("/me proyek lain (aud) -> 401", (await call("/me", { token: await fbToken({ aud: "lain" }) })).status === 401);
t("/me issuer salah -> 401", (await call("/me", { token: await fbToken({ iss: "https://evil" }) })).status === 401);
const other = await subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign"]);
t("/me tanda tangan kunci lain -> 401", (await call("/me", { token: await fbToken({}, "kid1", other.privateKey) })).status === 401);
t("/me kid tidak dikenal -> 401", (await call("/me", { token: await fbToken({}, "nokid") })).status === 401);
let r = await call("/me", { token: good }); let j = await r.json();
t("/me token sah, belum Premium -> premium null", r.status === 200 && j.premium === null);

// 2. CORS
r = await call("/me", { token: good, origin: "https://situs.test" });
t("CORS: asal diizinkan", r.headers.get("Access-Control-Allow-Origin") === "https://situs.test");
r = await call("/me", { token: good, origin: "https://evil.test" });
t("CORS: asal asing tidak diizinkan", !r.headers.get("Access-Control-Allow-Origin"));

// 3. pesanan
r = await call("/order", { method: "POST", token: good, body: { plan: "gratis" } });
t("/order paket tak dikenal -> 400", r.status === 400);
r = await call("/order", { method: "POST", token: good, body: { plan: "monthly", price: 1 } });
j = await r.json();
t("/order sukses -> redirectUrl + orderId", r.status === 200 && j.redirectUrl.includes("midtrans") && /^TB-/.test(j.orderId));
t("harga ditetapkan server (19000), bukan dari klien", snapBody.transaction_details.gross_amount === 19000 && snapBody.transaction_details.order_id === j.orderId);
t("order_id <= 50 karakter", j.orderId.length <= 50);
t("callback finish mengarah ke website", snapBody.callbacks.finish === `https://situs.test/sukses.html?order=${j.orderId}`);
const ord1 = j.orderId;

// 4. webhook
r = await call("/webhook", { method: "POST", body: { ...(await notif(ord1, 19000, "settlement")), signature_key: "x".repeat(128) } });
t("webhook signature palsu -> 403", r.status === 403);
r = await call("/webhook", { method: "POST", body: await notif(ord1, 19000, "settlement", {}, "KUNCI-LAIN") });
t("webhook ditandatangani kunci lain -> 403", r.status === 403);
r = await call("/webhook", { method: "POST", body: await notif(ord1, 1000, "settlement") });
t("webhook nominal tidak cocok -> 400", r.status === 400);
r = await call("/webhook", { method: "POST", body: await notif(ord1, 19000, "pending") });
j = await (await call("/me", { token: good })).json();
t("webhook pending -> belum Premium", r.status === 200 && j.premium === null);
r = await call("/webhook", { method: "POST", body: await notif("TB-tidak-ada", 19000, "settlement") });
t("webhook order tak dikenal -> 200 (tidak diulang)", r.status === 200);
r = await call("/webhook", { method: "POST", body: await notif(ord1, 19000, "capture", { fraud_status: "challenge" }) });
j = await (await call("/me", { token: good })).json();
t("capture + fraud challenge -> tidak Premium", j.premium === null);

r = await call("/webhook", { method: "POST", body: await notif(ord1, 19000, "settlement") });
j = await (await call("/me", { token: good })).json();
const until1 = j.premium && j.premium.until;
t("webhook settlement -> Premium aktif ±31 hari", r.status === 200 && j.premium && j.premium.plan === "Premium Bulanan" && Math.abs(until1 - Date.now() - 31 * 864e5) < 5000);
await call("/webhook", { method: "POST", body: await notif(ord1, 19000, "settlement") });
j = await (await call("/me", { token: good })).json();
t("webhook dikirim ulang -> masa Premium TIDAK bertambah", j.premium.until === until1);

// 5. akun lain tidak ikut Premium & tidak bisa baca pesanan
const tokenB = await fbToken({ sub: "uid-lain", email: "lain@x.com" });
j = await (await call("/me", { token: tokenB })).json();
t("akun lain tidak ikut Premium", j.premium === null);
t("akun lain tidak bisa baca status pesanan orang -> 404", (await call("/order?id=" + ord1, { token: tokenB })).status === 404);

// 6. perpanjangan menumpuk
r = await call("/order", { method: "POST", token: good, body: { plan: "annual" } }); j = await r.json();
t("harga tahunan 50000", snapBody.transaction_details.gross_amount === 50000);
await call("/webhook", { method: "POST", body: await notif(j.orderId, 50000, "settlement") });
const me2 = await (await call("/me", { token: good })).json();
t("perpanjangan menumpuk dari sisa masa", Math.abs(me2.premium.until - (until1 + 366 * 864e5)) < 1000);

// 7. cadangan: webhook telat -> status ditanya langsung ke Midtrans
r = await call("/order", { method: "POST", token: tokenB, body: { plan: "monthly" } }); j = await r.json();
let st = await (await call("/order?id=" + j.orderId, { token: tokenB })).json();
t("status pending sebelum dibayar", st.status === "pending" && st.premium === null);
mtStatus[j.orderId] = await notif(j.orderId, 19000, "settlement");
st = await (await call("/order?id=" + j.orderId, { token: tokenB })).json();
t("status dicek ke Midtrans -> paid + Premium aktif", st.status === "paid" && st.premium && st.premium.plan === "Premium Bulanan");
// status palsu dari 'Midtrans' (signature salah) harus ditolak
r = await call("/order", { method: "POST", token: good, body: { plan: "monthly" } }); j = await r.json();
mtStatus[j.orderId] = await notif(j.orderId, 19000, "settlement", {}, "KUNCI-LAIN");
st = await (await call("/order?id=" + j.orderId, { token: good })).json();
t("balasan status dengan signature salah diabaikan", st.status === "pending");

// 8. kedaluwarsa
await call("/webhook", { method: "POST", body: await notif(j.orderId, 19000, "expire") });
st = await (await call("/order?id=" + j.orderId, { token: good })).json();
t("expire -> status expired", st.status === "expired");

// 9. konfigurasi
const bare = await worker.fetch(new Request("https://api.test/me"), { PREMIUM: KV });
t("tanpa konfigurasi -> 500", bare.status === 500);
console.log(fail ? `\n${fail} GAGAL` : "\nSemua lolos");
process.exit(fail ? 1 : 0);
