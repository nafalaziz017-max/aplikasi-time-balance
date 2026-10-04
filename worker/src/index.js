// TimeBalance — server pembayaran & status Premium (Cloudflare Worker)
//
// Alur:
//  1. Pengguna login (Firebase Auth) di aplikasi/website, lalu klik "Bayar".
//  2. POST /order  → server membuat transaksi Midtrans Snap (harga ditetapkan DI SERVER) dan mengembalikan redirectUrl.
//  3. Pengguna membayar QRIS. Midtrans memanggil POST /webhook → server memverifikasi signature,
//     lalu menambah masa Premium untuk akun tersebut.
//  4. Aplikasi memanggil GET /me untuk membaca status Premium akun.
//
// Penyimpanan: KV namespace "PREMIUM" (user:<uid> = status Premium, order:<id> = pesanan).

const DAY = 864e5;
const PLANS = {
  monthly: { price: 19000, days: 31, name: "Premium Bulanan" },
  annual: { price: 50000, days: 366, name: "Premium Tahunan" },
};
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const ORDER_TTL = 60 * 86400;

const enc = new TextEncoder();
const b64uToBytes = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), c => c.charCodeAt(0));
const b64uToJson = s => JSON.parse(new TextDecoder().decode(b64uToBytes(s)));
const randHex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, "0")).join("");

/* ---------- Verifikasi ID token Firebase ---------- */
let jwksCache = { keys: null, at: 0 };
async function getJwks(force) {
  if (!force && jwksCache.keys && Date.now() - jwksCache.at < 3600e3) return jwksCache.keys;
  const r = await fetch(JWKS_URL);
  if (!r.ok) throw new Error("jwks");
  const j = await r.json();
  jwksCache = { keys: j.keys, at: Date.now() };
  return j.keys;
}

export async function verifyFirebaseToken(token, projectId) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("format");
  const header = b64uToJson(parts[0]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("alg");
  let jwk = (await getJwks(false)).find(k => k.kid === header.kid);
  if (!jwk) jwk = (await getJwks(true)).find(k => k.kid === header.kid);
  if (!jwk) throw new Error("kid");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64uToBytes(parts[2]), enc.encode(parts[0] + "." + parts[1]));
  if (!ok) throw new Error("sig");
  const p = b64uToJson(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  if (p.aud !== projectId || p.iss !== "https://securetoken.google.com/" + projectId) throw new Error("claims");
  if (!p.sub || typeof p.sub !== "string") throw new Error("sub");
  if (!(p.exp > now) || !(p.iat <= now + 300) || !(p.auth_time <= now + 300)) throw new Error("time");
  return { uid: p.sub, email: p.email || "" };
}

/* ---------- Helper HTTP ---------- */
function corsHeaders(req, env) {
  const origin = req.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const h = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}
const respond = (data, status, cors) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors } });

/* ---------- Midtrans ---------- */
const mtUrls = env => env.MIDTRANS_ENV === "production"
  ? { snap: "https://app.midtrans.com/snap/v1/transactions", api: "https://api.midtrans.com" }
  : { snap: "https://app.sandbox.midtrans.com/snap/v1/transactions", api: "https://api.sandbox.midtrans.com" };
const mtAuth = env => "Basic " + btoa(env.MIDTRANS_SERVER_KEY + ":");

async function sha512hex(s) {
  const d = await crypto.subtle.digest("SHA-512", enc.encode(s));
  return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
// signature_key = SHA512(order_id + status_code + gross_amount + ServerKey)
async function signatureOk(n, env) {
  if (["order_id", "status_code", "gross_amount", "signature_key"].some(k => typeof n[k] !== "string")) return false;
  return safeEqual(await sha512hex(n.order_id + n.status_code + n.gross_amount + env.MIDTRANS_SERVER_KEY), n.signature_key.toLowerCase());
}
const isPaid = n => n.transaction_status === "settlement" || (n.transaction_status === "capture" && n.fraud_status === "accept");
const isFailed = n => ["deny", "cancel", "expire", "failure"].includes(n.transaction_status);

/* ---------- Data Premium ---------- */
async function getPremium(env, uid) {
  const u = await env.PREMIUM.get("user:" + uid, "json");
  return u && u.until > Date.now() ? { plan: u.plan, until: u.until } : null;
}

// Idempotent: order yang sama tidak pernah menambah masa Premium dua kali.
async function applyStatus(env, order, n) {
  if (isPaid(n) && order.status !== "paid") {
    const plan = PLANS[order.plan];
    const u = (await env.PREMIUM.get("user:" + order.uid, "json")) || {};
    if (!(u.orders || []).includes(order.id)) {
      const base = Math.max(Date.now(), u.until || 0);
      await env.PREMIUM.put("user:" + order.uid, JSON.stringify({
        until: base + plan.days * DAY,
        plan: plan.name,
        orders: [...(u.orders || []), order.id].slice(-30),
      }));
    }
    order = { ...order, status: "paid", paidAt: Date.now() };
    await env.PREMIUM.put("order:" + order.id, JSON.stringify(order), { expirationTtl: ORDER_TTL });
  } else if (order.status === "pending" && isFailed(n)) {
    order = { ...order, status: n.transaction_status === "expire" ? "expired" : "failed" };
    await env.PREMIUM.put("order:" + order.id, JSON.stringify(order), { expirationTtl: ORDER_TTL });
  }
  return order;
}

/* ---------- Endpoint ---------- */
async function createOrder(req, env, auth, cors) {
  let body = {};
  try { body = await req.json(); } catch (e) { /* kosong */ }
  const plan = PLANS[body.plan];
  if (!plan) return respond({ error: "Paket tidak dikenal" }, 400, cors);

  const id = "TB-" + Date.now().toString(36) + "-" + randHex(6);
  const order = { id, uid: auth.uid, plan: body.plan, amount: plan.price, status: "pending", created: Date.now() };
  await env.PREMIUM.put("order:" + id, JSON.stringify(order), { expirationTtl: ORDER_TTL });

  const payload = {
    transaction_details: { order_id: id, gross_amount: plan.price },
    item_details: [{ id: body.plan, price: plan.price, quantity: 1, name: "TimeBalance " + plan.name }],
    callbacks: { finish: `${String(env.SITE_URL).replace(/\/$/, "")}/sukses.html?order=${id}` },
    expiry: { unit: "minutes", duration: 60 },
  };
  if (auth.email) payload.customer_details = { email: auth.email };
  const only = String(env.ENABLED_PAYMENTS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (only.length) payload.enabled_payments = only;

  const r = await fetch(mtUrls(env).snap, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: mtAuth(env) },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.redirect_url) {
    console.log("midtrans snap error", r.status, JSON.stringify(j).slice(0, 300));
    return respond({ error: "Gagal membuat pembayaran, coba lagi sebentar lagi" }, 502, cors);
  }
  return respond({ orderId: id, redirectUrl: j.redirect_url }, 200, cors);
}

async function webhook(req, env) {
  let n;
  try { n = await req.json(); } catch (e) { return new Response("bad json", { status: 400 }); }
  if (!(await signatureOk(n, env))) return new Response("forbidden", { status: 403 });
  const order = await env.PREMIUM.get("order:" + n.order_id, "json");
  if (!order) return new Response("unknown order", { status: 200 }); // 200 agar Midtrans berhenti mengulang
  if (Math.round(Number(n.gross_amount)) !== order.amount) return new Response("amount mismatch", { status: 400 });
  await applyStatus(env, order, n);
  return new Response("ok", { status: 200 });
}

// Dipakai halaman sukses: cek status pesanan. Jika masih pending, tanya Midtrans langsung (cadangan jika webhook terlambat).
async function orderStatus(env, auth, id, cors) {
  let order = id ? await env.PREMIUM.get("order:" + id, "json") : null;
  if (!order || order.uid !== auth.uid) return respond({ error: "Pesanan tidak ditemukan" }, 404, cors);
  if (order.status === "pending") {
    try {
      const r = await fetch(`${mtUrls(env).api}/v2/${encodeURIComponent(id)}/status`, { headers: { Accept: "application/json", Authorization: mtAuth(env) } });
      const n = await r.json();
      if (r.ok && n.order_id === id && (await signatureOk(n, env)) && Math.round(Number(n.gross_amount)) === order.amount) {
        order = await applyStatus(env, order, n);
      }
    } catch (e) { /* abaikan, tunggu webhook */ }
  }
  return respond({ status: order.status, plan: order.plan, premium: await getPremium(env, auth.uid) }, 200, cors);
}

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (path === "/") return respond({ ok: true, service: "timebalance-api" }, 200, cors);
    if (!env.MIDTRANS_SERVER_KEY || !env.FIREBASE_PROJECT_ID || !env.PREMIUM) return respond({ error: "Server belum dikonfigurasi" }, 500, cors);

    if (path === "/webhook" && req.method === "POST") return webhook(req, env);

    if ((path === "/order" && ["POST", "GET"].includes(req.method)) || (path === "/me" && req.method === "GET")) {
      let auth;
      try { auth = await verifyFirebaseToken((req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""), env.FIREBASE_PROJECT_ID); }
      catch (e) { return respond({ error: "Sesi login tidak valid, silakan masuk lagi" }, 401, cors); }
      if (path === "/me") return respond({ premium: await getPremium(env, auth.uid), serverTime: Date.now() }, 200, cors);
      if (req.method === "POST") return createOrder(req, env, auth, cors);
      return orderStatus(env, auth, url.searchParams.get("id"), cors);
    }
    return respond({ error: "Tidak ditemukan" }, 404, cors);
  },
};
