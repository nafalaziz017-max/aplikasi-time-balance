/* TimeBalance Auth — Cloudflare Worker + D1 */
(function(g){
  "use strict";
  var C=function(){return g.TB_CONFIG||{};};
  var KEY="tb-auth-v2";
  var subs=[];
  var MSG={
    INVALID_EMAIL:"Format email tidak valid.",
    WEAK_PASSWORD:"Kata sandi terlalu lemah (minimal 8 karakter).",
    MISSING_PASSWORD:"Kata sandi belum diisi.",
    INVALID_LOGIN_CREDENTIALS:"Email atau kata sandi salah.",
    NETWORK:"Tidak bisa terhubung ke server. Periksa koneksi Anda.",
    NOT_CONFIGURED:"Aplikasi belum dikonfigurasi (alamat Cloudflare Worker).",
    AUTH:"Sesi login berakhir, silakan masuk lagi."
  };
  function fail(code,extra){var e=new Error(MSG[code]||extra||"Terjadi kesalahan, coba lagi.");e.code=code;return e;}
  function read(){try{return JSON.parse(g.localStorage.getItem(KEY)||"null");}catch(e){return null;}}
  function write(v){try{if(v)g.localStorage.setItem(KEY,JSON.stringify(v));else g.localStorage.removeItem(KEY);}catch(e){}}
  function user(){var s=read();return s?{uid:s.uid,email:s.email}:null;}
  function emit(){var u=user();subs.forEach(function(f){try{f(u);}catch(e){}});}
  function configured(){var c=C();return !!(c.API_BASE&&!/GANTI/.test(c.API_BASE));}
  function checkEmail(email){email=String(email||"").trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail("INVALID_EMAIL");return email;}
  async function request(path,opt){
    if(!configured())throw fail("NOT_CONFIGURED");
    opt=opt||{};var s=read();var headers=Object.assign({},opt.headers||{});
    if(s&&s.token)headers.Authorization="Bearer "+s.token;
    if(opt.body!==undefined)headers["Content-Type"]="application/json";
    var r;try{r=await g.fetch(String(C().API_BASE).replace(/\/$/,"")+path,{method:opt.method||"GET",headers:headers,body:opt.body===undefined?undefined:JSON.stringify(opt.body)});}catch(e){throw fail("NETWORK");}
    var j={};try{j=await r.json();}catch(e){}
    if(r.status===401){write(null);emit();throw fail("AUTH");}
    if(!r.ok)throw fail("OTHER",j.message||j.error||"Server bermasalah, coba lagi.");
    return j;
  }
  function saveSession(j){write({uid:String(j.user.id),email:j.user.email,token:j.token});emit();return user();}
  async function signUp(email,password){email=checkEmail(email);if(String(password||"").length<6)throw fail("WEAK_PASSWORD");return saveSession(await request("/api/register",{method:"POST",body:{email:email,password:String(password)}}));}
  async function signIn(email,password){email=checkEmail(email);if(!password)throw fail("MISSING_PASSWORD");return saveSession(await request("/api/login",{method:"POST",body:{email:email,password:String(password)}}));}
  async function resetPassword(){throw fail("OTHER","Fitur lupa kata sandi belum diaktifkan pada Cloudflare-only. Hubungi admin.");}
  async function getToken(){var s=read();return s?s.token:null;}
  function signOut(){var s=read();write(null);emit();if(s&&s.token)g.fetch(String(C().API_BASE).replace(/\/$/,"")+"/api/logout",{method:"POST",headers:{Authorization:"Bearer "+s.token}}).catch(function(){});}
  async function api(path,opt){return request(path,opt);}
  g.TBAuth={configured:configured,user:user,signUp:signUp,signIn:signIn,signOut:signOut,resetPassword:resetPassword,getToken:getToken,api:api,
    fetchPremium:function(){return api("/api/me").then(function(j){return j.premium||null;});},
    activateToken:function(token){return api("/activate-token",{method:"POST",body:{token:token}});},
    createOrder:function(plan){return api("/order",{method:"POST",body:{plan:plan}});},
    orderStatus:function(id){return api("/order?id="+encodeURIComponent(id));},
    onChange:function(f){subs.push(f);}
  };
})(typeof window!=="undefined"?window:globalThis);
