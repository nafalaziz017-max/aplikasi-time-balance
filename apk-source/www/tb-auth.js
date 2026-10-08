/* TimeBalance Auth — klien untuk Cloudflare Worker + D1 (login, sesi, langganan, pesanan). */
(function (g) {
  "use strict";
  var C = function () { return g.TB_CONFIG || {}; };
  var KEY = "tb-auth-v2", subs = [];
  function fail(code, msg) { var e = new Error(msg || "Terjadi kesalahan, coba lagi."); e.code = code; return e; }
  function read() { try { return JSON.parse(g.localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function write(v) { try { if (v) g.localStorage.setItem(KEY, JSON.stringify(v)); else g.localStorage.removeItem(KEY); } catch (e) {} }
  function user() { var s = read(); return s ? { uid: s.uid, email: s.email, name: s.name || "" } : null; }
  function emit() { var u = user(); subs.forEach(function (f) { try { f(u); } catch (e) {} }); }
  function isNative() { return !!(g.Capacitor && g.Capacitor.isNativePlatform && g.Capacitor.isNativePlatform()); }
  function base() { var c = C(); return String((isNative() ? c.NATIVE_API_BASE : c.API_BASE) || "").replace(/\/$/, ""); }
  function configured() { return !isNative() || !!(C().NATIVE_API_BASE && !/GANTI/.test(C().NATIVE_API_BASE)); }
  function checkEmail(email) { email = String(email || "").trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw fail("INVALID_EMAIL", "Format email tidak valid."); return email; }
  async function request(path, opt) {
    if (!configured()) throw fail("NOT_CONFIGURED", "Alamat server belum diatur (NATIVE_API_BASE).");
    opt = opt || {}; var s = read(), headers = {};
    if (s && s.token && !opt.anon) headers.Authorization = "Bearer " + s.token;
    if (opt.body !== undefined) headers["Content-Type"] = "application/json";
    var r;
    try { r = await g.fetch(base() + path, { method: opt.method || "GET", headers: headers, body: opt.body === undefined ? undefined : JSON.stringify(opt.body) }); }
    catch (e) { throw fail("NETWORK", "Tidak bisa terhubung ke server. Periksa koneksi Anda."); }
    var j = {}; try { j = await r.json(); } catch (e) {}
    if (r.status === 401 && s && s.token && !opt.anon) { write(null); emit(); throw fail("AUTH", "Sesi login berakhir, silakan masuk lagi."); }
    if (!r.ok) throw fail(r.status === 401 ? "BAD_LOGIN" : "OTHER", j.error || j.message || "Server bermasalah, coba lagi.");
    return j;
  }
  function saveSession(j) { write({ uid: String(j.user.id), email: j.user.email, name: j.user.name, token: j.token }); emit(); return { user: user(), premium: j.premium || null }; }
  g.TBAuth = {
    configured: configured, user: user, isNative: isNative,
    signUp: async function (name, email, password) {
      name = String(name || "").trim(); if (name.length < 2) throw fail("INVALID_NAME", "Nama minimal 2 karakter.");
      email = checkEmail(email); if (String(password || "").length < 8) throw fail("WEAK_PASSWORD", "Kata sandi minimal 8 karakter.");
      return saveSession(await request("/api/register", { method: "POST", anon: true, body: { name: name, email: email, password: String(password) } }));
    },
    signIn: async function (email, password) {
      email = checkEmail(email); if (!password) throw fail("MISSING_PASSWORD", "Kata sandi belum diisi.");
      return saveSession(await request("/api/login", { method: "POST", anon: true, body: { email: email, password: String(password) } }));
    },
    signOut: function () { var s = read(); write(null); emit(); if (s && s.token) g.fetch(base() + "/api/logout", { method: "POST", headers: { Authorization: "Bearer " + s.token } }).catch(function () {}); },
    me: function () { return request("/api/me"); },
    plans: function () { return request("/api/plans", { anon: true }); },
    createOrder: function (plan) { return request("/api/order", { method: "POST", body: { plan: plan } }).then(function (j) { return j.order; }); },
    orderStatus: function (id) { return request("/api/order?id=" + encodeURIComponent(id)); },
    markPaid: function (id) { return request("/api/order/paid", { method: "POST", body: { id: id } }).then(function (j) { return j.order; }); },
    cancelOrder: function (id) { return request("/api/order/cancel", { method: "POST", body: { id: id } }); },
    changePassword: function (current, next) { return request("/api/password", { method: "POST", body: { current: current, next: next } }); },
    deleteAccount: function (password) { return request("/api/account/delete", { method: "POST", body: { password: password } }).then(function () { write(null); emit(); }); },
    onChange: function (f) { subs.push(f); }
  };
})(typeof window !== "undefined" ? window : globalThis);
