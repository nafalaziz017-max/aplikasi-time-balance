/* TimeBalance — login akun (Firebase Auth lewat REST) + klien server pembayaran.
   Dipakai bersama oleh aplikasi dan website. Butuh window.TB_CONFIG (tb-config.js). */
(function (g) {
  "use strict";
  var C = function () { return g.TB_CONFIG || {}; };
  var KEY = "tb-auth-v1";
  var IDT = "https://identitytoolkit.googleapis.com/v1/accounts:";
  var REFRESH = "https://securetoken.googleapis.com/v1/token";

  var MSG = {
    EMAIL_EXISTS: "Email ini sudah terdaftar. Silakan masuk.",
    INVALID_EMAIL: "Format email tidak valid.",
    WEAK_PASSWORD: "Kata sandi terlalu lemah (minimal 8 karakter).",
    MISSING_PASSWORD: "Kata sandi belum diisi.",
    INVALID_LOGIN_CREDENTIALS: "Email atau kata sandi salah.",
    INVALID_PASSWORD: "Email atau kata sandi salah.",
    EMAIL_NOT_FOUND: "Email atau kata sandi salah.",
    USER_DISABLED: "Akun ini dinonaktifkan. Hubungi admin.",
    TOO_MANY_ATTEMPTS_TRY_LATER: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.",
    NETWORK: "Tidak bisa terhubung ke internet. Periksa koneksi Anda.",
    NOT_CONFIGURED: "Aplikasi belum dikonfigurasi (API key / alamat server).",
    AUTH: "Sesi login berakhir, silakan masuk lagi."
  };
  function fail(code, extra) { var e = new Error(MSG[code] || extra || "Terjadi kesalahan, coba lagi."); e.code = code; return e; }

  function read() { try { return JSON.parse(g.localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function write(v) { try { if (v) g.localStorage.setItem(KEY, JSON.stringify(v)); else g.localStorage.removeItem(KEY); } catch (e) {} }
  var subs = [];
  function emit() { var u = user(); subs.forEach(function (f) { try { f(u); } catch (e) {} }); }
  function user() { var s = read(); return s ? { uid: s.uid, email: s.email } : null; }
  function configured() { var c = C(); return !!(c.FIREBASE_API_KEY && c.API_BASE && !/GANTI/.test(c.FIREBASE_API_KEY + c.API_BASE)); }

  async function post(url, init) {
    var r;
    try { r = await g.fetch(url, init); } catch (e) { throw fail("NETWORK"); }
    var j = {}; try { j = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, j: j };
  }
  function fbError(j) {
    var raw = (j && j.error && j.error.message) || "";
    var code = raw.split(" ")[0];
    return fail(MSG[code] ? code : "OTHER", MSG[code] ? "" : "Gagal (" + (code || "tidak diketahui") + ")");
  }
  async function fb(method, body) {
    if (!configured()) throw fail("NOT_CONFIGURED");
    var res = await post(IDT + method + "?key=" + encodeURIComponent(C().FIREBASE_API_KEY), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    if (!res.ok) throw fbError(res.j);
    return res.j;
  }
  function session(j) {
    var s = { uid: j.localId, email: j.email, idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + (parseInt(j.expiresIn, 10) || 3600) * 1000 };
    write(s); emit(); return user();
  }
  function checkEmail(email) { email = String(email || "").trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail("INVALID_EMAIL"); return email; }

  async function signUp(email, password) {
    email = checkEmail(email);
    if (String(password || "").length < 8) throw fail("WEAK_PASSWORD");
    var j = await fb("signUp", { email: email, password: password, returnSecureToken: true });
    var u = session(j);
    fb("sendOobCode", { requestType: "VERIFY_EMAIL", idToken: j.idToken }).catch(function () {}); // email verifikasi, tidak wajib
    return u;
  }
  async function signIn(email, password) {
    email = checkEmail(email);
    if (!password) throw fail("MISSING_PASSWORD");
    return session(await fb("signInWithPassword", { email: email, password: password, returnSecureToken: true }));
  }
  async function resetPassword(email) { await fb("sendOobCode", { requestType: "PASSWORD_RESET", email: checkEmail(email) }); return true; }
  function signOut() { write(null); emit(); }

  var inflight = null;
  async function refresh(s) {
    if (inflight) return inflight;
    inflight = (async function () {
      var res = await post(REFRESH + "?key=" + encodeURIComponent(C().FIREBASE_API_KEY), {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(s.refreshToken)
      });
      if (!res.ok) {
        var m = (res.j && res.j.error && res.j.error.message) || "";
        if (/TOKEN_EXPIRED|USER_DISABLED|USER_NOT_FOUND|INVALID_REFRESH_TOKEN|MISSING_REFRESH_TOKEN/.test(m)) { signOut(); return null; }
        throw fail("OTHER", "Gagal memperbarui sesi");
      }
      var n = { uid: res.j.user_id || s.uid, email: s.email, idToken: res.j.id_token, refreshToken: res.j.refresh_token || s.refreshToken, exp: Date.now() + (parseInt(res.j.expires_in, 10) || 3600) * 1000 };
      write(n); return n.idToken;
    })();
    try { return await inflight; } finally { inflight = null; }
  }
  async function getToken(force) {
    var s = read(); if (!s) return null;
    if (!force && s.exp - Date.now() > 60000) return s.idToken;
    return refresh(s);
  }

  async function api(path, opt, retried) {
    if (!configured()) throw fail("NOT_CONFIGURED");
    var token = await getToken(!!retried);
    if (!token) throw fail("AUTH");
    opt = opt || {};
    var res = await post(String(C().API_BASE).replace(/\/$/, "") + path, {
      method: opt.method || "GET",
      headers: Object.assign({ Authorization: "Bearer " + token }, opt.body ? { "Content-Type": "application/json" } : {}),
      body: opt.body ? JSON.stringify(opt.body) : undefined
    });
    if (res.status === 401) { if (!retried) return api(path, opt, true); signOut(); throw fail("AUTH"); }
    if (!res.ok) throw fail("OTHER", (res.j && res.j.error) || "Server bermasalah, coba lagi.");
    return res.j;
  }

  g.TBAuth = {
    configured: configured, user: user, signUp: signUp, signIn: signIn, signOut: signOut, resetPassword: resetPassword,
    getToken: getToken, api: api,
    fetchPremium: function () { return api("/me").then(function (j) { return j.premium || null; }); },
    createOrder: function (plan) { return api("/order", { method: "POST", body: { plan: plan } }); },
    orderStatus: function (id) { return api("/order?id=" + encodeURIComponent(id)); },
    onChange: function (f) { subs.push(f); }
  };
})(typeof window !== "undefined" ? window : globalThis);
