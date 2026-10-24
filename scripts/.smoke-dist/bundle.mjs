import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/http.ts
function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}
function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed.join(", "));
  return sendJson(res, 405, { error: "Method not allowed" });
}
async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body, "utf8");
  if (req.body && typeof req.body === "object") return Buffer.from(JSON.stringify(req.body), "utf8");
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
async function readJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  const raw = await readRawBody(req);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    return {};
  }
}
function parseCookies(req) {
  const header = req.headers?.cookie || req.headers?.Cookie || "";
  const out = {};
  for (const part of String(header).split(";")) {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function wrap(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error("[api]", req.url, err);
      if (!res.headersSent) sendJson(res, 500, { error: "Internal error", detail: String(err?.message || err) });
    }
  };
}

// scripts/mock-db.mjs
import { newDb, DataType } from "pg-mem";
var mem = newDb();
var { Pool } = mem.adapters.createPg();
var pool = new Pool();
for (const argc of [3, 4]) {
  mem.public.registerFunction({
    name: "regexp_replace",
    args: Array(argc).fill(DataType.text),
    returns: DataType.text,
    implementation: (src, pattern, replacement, flags = "") => {
      if (src == null) return null;
      const jsFlags = String(flags || "").includes("g") ? "g" : "";
      return String(src).replace(new RegExp(String(pattern), jsFlags + (String(flags || "").includes("i") ? "i" : "")), String(replacement));
    }
  });
}
function isDbConfigured() {
  return true;
}
async function dbQuery(text, params = []) {
  const r = await pool.query(text, params);
  return r.rows;
}
async function dbPing() {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

// server/paystack.ts
var paystack_exports = {};
__export(paystack_exports, {
  applyPaymentEffect: () => applyPaymentEffect,
  genReference: () => genReference,
  initializeTransaction: () => initializeTransaction,
  paystackEnabled: () => paystackEnabled,
  verifyPaystackSignature: () => verifyPaystackSignature,
  verifyTransaction: () => verifyTransaction
});
import crypto2 from "node:crypto";
function paystackEnabled() {
  return !!(process.env.PAYSTACK_SECRET_KEY || "");
}
function secretKey() {
  return process.env.PAYSTACK_SECRET_KEY || "";
}
var API = "https://api.paystack.co";
function genReference(prefix = "OKX") {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto2.randomBytes(4).toString("hex").toUpperCase()}`;
}
function verifyPaystackSignature(rawBody, signature, secret2) {
  const key = secret2 ?? secretKey();
  if (!key || !signature) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), "utf8");
  const expected = crypto2.createHmac("sha512", key).update(body).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(signature), "utf8");
  return a.length === b.length && crypto2.timingSafeEqual(a, b);
}
async function initializeTransaction(input) {
  const res = await fetch(`${API}/transaction/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amountKobo),
      reference: input.reference,
      currency: "NGN",
      callback_url: input.callbackUrl,
      metadata: input.metadata || {}
    })
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.status) throw new Error(data?.message || `Paystack initialize failed (${res.status})`);
  return data.data;
}
async function verifyTransaction(reference) {
  const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` }
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.status) throw new Error(data?.message || `Paystack verify failed (${res.status})`);
  return data.data;
}
async function applyPaymentEffect(reference) {
  const rows = await dbQuery(`SELECT * FROM payments WHERE reference = $1`, [reference]);
  const pay = rows[0];
  if (!pay) return null;
  if (pay.status === "paid") return pay;
  await dbQuery(`UPDATE payments SET status = 'paid', paid_at = now() WHERE reference = $1`, [reference]);
  const refId = pay.ref_id;
  if (refId) {
    if (pay.purpose === "partner_verification") {
      await dbQuery(`UPDATE partners SET verified = true WHERE code = $1`, [refId]);
    } else if (pay.purpose === "partner_featured") {
      await dbQuery(`UPDATE partners SET featured = true, featured_until = now() + interval '30 days' WHERE code = $1`, [refId]);
    } else if (pay.purpose === "order") {
      await dbQuery(`UPDATE orders SET paid = true WHERE code = $1`, [refId]);
    } else if (pay.purpose === "booking_deposit") {
      await dbQuery(`UPDATE bookings SET deposit_paid = true WHERE code = $1`, [refId]);
    }
  }
  return { ...pay, status: "paid" };
}

// server/auth.ts
var auth_exports = {};
__export(auth_exports, {
  SESSION_COOKIE: () => SESSION_COOKIE,
  adminBootstrapUser: () => adminBootstrapUser,
  authConfigured: () => authConfigured,
  clearCookieHeader: () => clearCookieHeader,
  findUserByEmail: () => findUserByEmail,
  getSessionUser: () => getSessionUser,
  hashPassword: () => hashPassword,
  isAdmin: () => isAdmin,
  isAdminBootstrap: () => isAdminBootstrap,
  publicUser: () => publicUser,
  sessionCookieHeader: () => sessionCookieHeader,
  signSession: () => signSession,
  verifyPassword: () => verifyPassword,
  verifySessionToken: () => verifySessionToken
});

// node_modules/bcryptjs/index.js
import nodeCrypto from "crypto";
var randomFallback = null;
function randomBytes(len) {
  try {
    return crypto.getRandomValues(new Uint8Array(len));
  } catch {
  }
  try {
    return nodeCrypto.randomBytes(len);
  } catch {
  }
  if (!randomFallback) {
    throw Error(
      "Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative"
    );
  }
  return randomFallback(len);
}
function setRandomFallback(random) {
  randomFallback = random;
}
function genSaltSync(rounds, seed_length) {
  rounds = rounds || GENSALT_DEFAULT_LOG2_ROUNDS;
  if (typeof rounds !== "number")
    throw Error(
      "Illegal arguments: " + typeof rounds + ", " + typeof seed_length
    );
  if (rounds < 4) rounds = 4;
  else if (rounds > 31) rounds = 31;
  var salt = [];
  salt.push("$2b$");
  if (rounds < 10) salt.push("0");
  salt.push(rounds.toString());
  salt.push("$");
  salt.push(base64_encode(randomBytes(BCRYPT_SALT_LEN), BCRYPT_SALT_LEN));
  return salt.join("");
}
function genSalt(rounds, seed_length, callback) {
  if (typeof seed_length === "function")
    callback = seed_length, seed_length = void 0;
  if (typeof rounds === "function") callback = rounds, rounds = void 0;
  if (typeof rounds === "undefined") rounds = GENSALT_DEFAULT_LOG2_ROUNDS;
  else if (typeof rounds !== "number")
    throw Error("illegal arguments: " + typeof rounds);
  function _async(callback2) {
    nextTick(function() {
      try {
        callback2(null, genSaltSync(rounds));
      } catch (err) {
        callback2(err);
      }
    });
  }
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
function hashSync(password, salt) {
  if (typeof salt === "undefined") salt = GENSALT_DEFAULT_LOG2_ROUNDS;
  if (typeof salt === "number") salt = genSaltSync(salt);
  if (typeof password !== "string" || typeof salt !== "string")
    throw Error("Illegal arguments: " + typeof password + ", " + typeof salt);
  return _hash(password, salt);
}
function hash(password, salt, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password === "string" && typeof salt === "number")
      genSalt(salt, function(err, salt2) {
        _hash(password, salt2, callback2, progressCallback);
      });
    else if (typeof password === "string" && typeof salt === "string")
      _hash(password, salt, callback2, progressCallback);
    else
      nextTick(
        callback2.bind(
          this,
          Error("Illegal arguments: " + typeof password + ", " + typeof salt)
        )
      );
  }
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
function safeStringCompare(known, unknown) {
  var diff = known.length ^ unknown.length;
  for (var i = 0; i < known.length; ++i) {
    diff |= known.charCodeAt(i) ^ unknown.charCodeAt(i);
  }
  return diff === 0;
}
function compareSync(password, hash2) {
  if (typeof password !== "string" || typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof password + ", " + typeof hash2);
  if (hash2.length !== 60) return false;
  return safeStringCompare(
    hashSync(password, hash2.substring(0, hash2.length - 31)),
    hash2
  );
}
function compare(password, hashValue, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password !== "string" || typeof hashValue !== "string") {
      nextTick(
        callback2.bind(
          this,
          Error(
            "Illegal arguments: " + typeof password + ", " + typeof hashValue
          )
        )
      );
      return;
    }
    if (hashValue.length !== 60) {
      nextTick(callback2.bind(this, null, false));
      return;
    }
    hash(
      password,
      hashValue.substring(0, 29),
      function(err, comp) {
        if (err) callback2(err);
        else callback2(null, safeStringCompare(comp, hashValue));
      },
      progressCallback
    );
  }
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
function getRounds(hash2) {
  if (typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof hash2);
  return parseInt(hash2.split("$")[2], 10);
}
function getSalt(hash2) {
  if (typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof hash2);
  if (hash2.length !== 60)
    throw Error("Illegal hash length: " + hash2.length + " != 60");
  return hash2.substring(0, 29);
}
function truncates(password) {
  if (typeof password !== "string")
    throw Error("Illegal arguments: " + typeof password);
  return utf8Length(password) > 72;
}
var nextTick = typeof setImmediate === "function" ? setImmediate : typeof scheduler === "object" && typeof scheduler.postTask === "function" ? scheduler.postTask.bind(scheduler) : setTimeout;
function utf8Length(string) {
  var len = 0, c = 0;
  for (var i = 0; i < string.length; ++i) {
    c = string.charCodeAt(i);
    if (c < 128) len += 1;
    else if (c < 2048) len += 2;
    else if ((c & 64512) === 55296 && (string.charCodeAt(i + 1) & 64512) === 56320) {
      ++i;
      len += 4;
    } else len += 3;
  }
  return len;
}
function utf8Array(string) {
  var offset = 0, c1, c2;
  var buffer = new Array(utf8Length(string));
  for (var i = 0, k = string.length; i < k; ++i) {
    c1 = string.charCodeAt(i);
    if (c1 < 128) {
      buffer[offset++] = c1;
    } else if (c1 < 2048) {
      buffer[offset++] = c1 >> 6 | 192;
      buffer[offset++] = c1 & 63 | 128;
    } else if ((c1 & 64512) === 55296 && ((c2 = string.charCodeAt(i + 1)) & 64512) === 56320) {
      c1 = 65536 + ((c1 & 1023) << 10) + (c2 & 1023);
      ++i;
      buffer[offset++] = c1 >> 18 | 240;
      buffer[offset++] = c1 >> 12 & 63 | 128;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    } else {
      buffer[offset++] = c1 >> 12 | 224;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    }
  }
  return buffer;
}
var BASE64_CODE = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
var BASE64_INDEX = [
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  0,
  1,
  54,
  55,
  56,
  57,
  58,
  59,
  60,
  61,
  62,
  63,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  28,
  29,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  45,
  46,
  47,
  48,
  49,
  50,
  51,
  52,
  53,
  -1,
  -1,
  -1,
  -1,
  -1
];
function base64_encode(b, len) {
  var off = 0, rs = [], c1, c2;
  if (len <= 0 || len > b.length) throw Error("Illegal len: " + len);
  while (off < len) {
    c1 = b[off++] & 255;
    rs.push(BASE64_CODE[c1 >> 2 & 63]);
    c1 = (c1 & 3) << 4;
    if (off >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off++] & 255;
    c1 |= c2 >> 4 & 15;
    rs.push(BASE64_CODE[c1 & 63]);
    c1 = (c2 & 15) << 2;
    if (off >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off++] & 255;
    c1 |= c2 >> 6 & 3;
    rs.push(BASE64_CODE[c1 & 63]);
    rs.push(BASE64_CODE[c2 & 63]);
  }
  return rs.join("");
}
function base64_decode(s, len) {
  var off = 0, slen = s.length, olen = 0, rs = [], c1, c2, c3, c4, o, code;
  if (len <= 0) throw Error("Illegal len: " + len);
  while (off < slen - 1 && olen < len) {
    code = s.charCodeAt(off++);
    c1 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    code = s.charCodeAt(off++);
    c2 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c1 == -1 || c2 == -1) break;
    o = c1 << 2 >>> 0;
    o |= (c2 & 48) >> 4;
    rs.push(String.fromCharCode(o));
    if (++olen >= len || off >= slen) break;
    code = s.charCodeAt(off++);
    c3 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c3 == -1) break;
    o = (c2 & 15) << 4 >>> 0;
    o |= (c3 & 60) >> 2;
    rs.push(String.fromCharCode(o));
    if (++olen >= len || off >= slen) break;
    code = s.charCodeAt(off++);
    c4 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    o = (c3 & 3) << 6 >>> 0;
    o |= c4;
    rs.push(String.fromCharCode(o));
    ++olen;
  }
  var res = [];
  for (off = 0; off < olen; off++) res.push(rs[off].charCodeAt(0));
  return res;
}
var BCRYPT_SALT_LEN = 16;
var GENSALT_DEFAULT_LOG2_ROUNDS = 10;
var BLOWFISH_NUM_ROUNDS = 16;
var MAX_EXECUTION_TIME = 100;
var P_ORIG = [
  608135816,
  2242054355,
  320440878,
  57701188,
  2752067618,
  698298832,
  137296536,
  3964562569,
  1160258022,
  953160567,
  3193202383,
  887688300,
  3232508343,
  3380367581,
  1065670069,
  3041331479,
  2450970073,
  2306472731
];
var S_ORIG = [
  3509652390,
  2564797868,
  805139163,
  3491422135,
  3101798381,
  1780907670,
  3128725573,
  4046225305,
  614570311,
  3012652279,
  134345442,
  2240740374,
  1667834072,
  1901547113,
  2757295779,
  4103290238,
  227898511,
  1921955416,
  1904987480,
  2182433518,
  2069144605,
  3260701109,
  2620446009,
  720527379,
  3318853667,
  677414384,
  3393288472,
  3101374703,
  2390351024,
  1614419982,
  1822297739,
  2954791486,
  3608508353,
  3174124327,
  2024746970,
  1432378464,
  3864339955,
  2857741204,
  1464375394,
  1676153920,
  1439316330,
  715854006,
  3033291828,
  289532110,
  2706671279,
  2087905683,
  3018724369,
  1668267050,
  732546397,
  1947742710,
  3462151702,
  2609353502,
  2950085171,
  1814351708,
  2050118529,
  680887927,
  999245976,
  1800124847,
  3300911131,
  1713906067,
  1641548236,
  4213287313,
  1216130144,
  1575780402,
  4018429277,
  3917837745,
  3693486850,
  3949271944,
  596196993,
  3549867205,
  258830323,
  2213823033,
  772490370,
  2760122372,
  1774776394,
  2652871518,
  566650946,
  4142492826,
  1728879713,
  2882767088,
  1783734482,
  3629395816,
  2517608232,
  2874225571,
  1861159788,
  326777828,
  3124490320,
  2130389656,
  2716951837,
  967770486,
  1724537150,
  2185432712,
  2364442137,
  1164943284,
  2105845187,
  998989502,
  3765401048,
  2244026483,
  1075463327,
  1455516326,
  1322494562,
  910128902,
  469688178,
  1117454909,
  936433444,
  3490320968,
  3675253459,
  1240580251,
  122909385,
  2157517691,
  634681816,
  4142456567,
  3825094682,
  3061402683,
  2540495037,
  79693498,
  3249098678,
  1084186820,
  1583128258,
  426386531,
  1761308591,
  1047286709,
  322548459,
  995290223,
  1845252383,
  2603652396,
  3431023940,
  2942221577,
  3202600964,
  3727903485,
  1712269319,
  422464435,
  3234572375,
  1170764815,
  3523960633,
  3117677531,
  1434042557,
  442511882,
  3600875718,
  1076654713,
  1738483198,
  4213154764,
  2393238008,
  3677496056,
  1014306527,
  4251020053,
  793779912,
  2902807211,
  842905082,
  4246964064,
  1395751752,
  1040244610,
  2656851899,
  3396308128,
  445077038,
  3742853595,
  3577915638,
  679411651,
  2892444358,
  2354009459,
  1767581616,
  3150600392,
  3791627101,
  3102740896,
  284835224,
  4246832056,
  1258075500,
  768725851,
  2589189241,
  3069724005,
  3532540348,
  1274779536,
  3789419226,
  2764799539,
  1660621633,
  3471099624,
  4011903706,
  913787905,
  3497959166,
  737222580,
  2514213453,
  2928710040,
  3937242737,
  1804850592,
  3499020752,
  2949064160,
  2386320175,
  2390070455,
  2415321851,
  4061277028,
  2290661394,
  2416832540,
  1336762016,
  1754252060,
  3520065937,
  3014181293,
  791618072,
  3188594551,
  3933548030,
  2332172193,
  3852520463,
  3043980520,
  413987798,
  3465142937,
  3030929376,
  4245938359,
  2093235073,
  3534596313,
  375366246,
  2157278981,
  2479649556,
  555357303,
  3870105701,
  2008414854,
  3344188149,
  4221384143,
  3956125452,
  2067696032,
  3594591187,
  2921233993,
  2428461,
  544322398,
  577241275,
  1471733935,
  610547355,
  4027169054,
  1432588573,
  1507829418,
  2025931657,
  3646575487,
  545086370,
  48609733,
  2200306550,
  1653985193,
  298326376,
  1316178497,
  3007786442,
  2064951626,
  458293330,
  2589141269,
  3591329599,
  3164325604,
  727753846,
  2179363840,
  146436021,
  1461446943,
  4069977195,
  705550613,
  3059967265,
  3887724982,
  4281599278,
  3313849956,
  1404054877,
  2845806497,
  146425753,
  1854211946,
  1266315497,
  3048417604,
  3681880366,
  3289982499,
  290971e4,
  1235738493,
  2632868024,
  2414719590,
  3970600049,
  1771706367,
  1449415276,
  3266420449,
  422970021,
  1963543593,
  2690192192,
  3826793022,
  1062508698,
  1531092325,
  1804592342,
  2583117782,
  2714934279,
  4024971509,
  1294809318,
  4028980673,
  1289560198,
  2221992742,
  1669523910,
  35572830,
  157838143,
  1052438473,
  1016535060,
  1802137761,
  1753167236,
  1386275462,
  3080475397,
  2857371447,
  1040679964,
  2145300060,
  2390574316,
  1461121720,
  2956646967,
  4031777805,
  4028374788,
  33600511,
  2920084762,
  1018524850,
  629373528,
  3691585981,
  3515945977,
  2091462646,
  2486323059,
  586499841,
  988145025,
  935516892,
  3367335476,
  2599673255,
  2839830854,
  265290510,
  3972581182,
  2759138881,
  3795373465,
  1005194799,
  847297441,
  406762289,
  1314163512,
  1332590856,
  1866599683,
  4127851711,
  750260880,
  613907577,
  1450815602,
  3165620655,
  3734664991,
  3650291728,
  3012275730,
  3704569646,
  1427272223,
  778793252,
  1343938022,
  2676280711,
  2052605720,
  1946737175,
  3164576444,
  3914038668,
  3967478842,
  3682934266,
  1661551462,
  3294938066,
  4011595847,
  840292616,
  3712170807,
  616741398,
  312560963,
  711312465,
  1351876610,
  322626781,
  1910503582,
  271666773,
  2175563734,
  1594956187,
  70604529,
  3617834859,
  1007753275,
  1495573769,
  4069517037,
  2549218298,
  2663038764,
  504708206,
  2263041392,
  3941167025,
  2249088522,
  1514023603,
  1998579484,
  1312622330,
  694541497,
  2582060303,
  2151582166,
  1382467621,
  776784248,
  2618340202,
  3323268794,
  2497899128,
  2784771155,
  503983604,
  4076293799,
  907881277,
  423175695,
  432175456,
  1378068232,
  4145222326,
  3954048622,
  3938656102,
  3820766613,
  2793130115,
  2977904593,
  26017576,
  3274890735,
  3194772133,
  1700274565,
  1756076034,
  4006520079,
  3677328699,
  720338349,
  1533947780,
  354530856,
  688349552,
  3973924725,
  1637815568,
  332179504,
  3949051286,
  53804574,
  2852348879,
  3044236432,
  1282449977,
  3583942155,
  3416972820,
  4006381244,
  1617046695,
  2628476075,
  3002303598,
  1686838959,
  431878346,
  2686675385,
  1700445008,
  1080580658,
  1009431731,
  832498133,
  3223435511,
  2605976345,
  2271191193,
  2516031870,
  1648197032,
  4164389018,
  2548247927,
  300782431,
  375919233,
  238389289,
  3353747414,
  2531188641,
  2019080857,
  1475708069,
  455242339,
  2609103871,
  448939670,
  3451063019,
  1395535956,
  2413381860,
  1841049896,
  1491858159,
  885456874,
  4264095073,
  4001119347,
  1565136089,
  3898914787,
  1108368660,
  540939232,
  1173283510,
  2745871338,
  3681308437,
  4207628240,
  3343053890,
  4016749493,
  1699691293,
  1103962373,
  3625875870,
  2256883143,
  3830138730,
  1031889488,
  3479347698,
  1535977030,
  4236805024,
  3251091107,
  2132092099,
  1774941330,
  1199868427,
  1452454533,
  157007616,
  2904115357,
  342012276,
  595725824,
  1480756522,
  206960106,
  497939518,
  591360097,
  863170706,
  2375253569,
  3596610801,
  1814182875,
  2094937945,
  3421402208,
  1082520231,
  3463918190,
  2785509508,
  435703966,
  3908032597,
  1641649973,
  2842273706,
  3305899714,
  1510255612,
  2148256476,
  2655287854,
  3276092548,
  4258621189,
  236887753,
  3681803219,
  274041037,
  1734335097,
  3815195456,
  3317970021,
  1899903192,
  1026095262,
  4050517792,
  356393447,
  2410691914,
  3873677099,
  3682840055,
  3913112168,
  2491498743,
  4132185628,
  2489919796,
  1091903735,
  1979897079,
  3170134830,
  3567386728,
  3557303409,
  857797738,
  1136121015,
  1342202287,
  507115054,
  2535736646,
  337727348,
  3213592640,
  1301675037,
  2528481711,
  1895095763,
  1721773893,
  3216771564,
  62756741,
  2142006736,
  835421444,
  2531993523,
  1442658625,
  3659876326,
  2882144922,
  676362277,
  1392781812,
  170690266,
  3921047035,
  1759253602,
  3611846912,
  1745797284,
  664899054,
  1329594018,
  3901205900,
  3045908486,
  2062866102,
  2865634940,
  3543621612,
  3464012697,
  1080764994,
  553557557,
  3656615353,
  3996768171,
  991055499,
  499776247,
  1265440854,
  648242737,
  3940784050,
  980351604,
  3713745714,
  1749149687,
  3396870395,
  4211799374,
  3640570775,
  1161844396,
  3125318951,
  1431517754,
  545492359,
  4268468663,
  3499529547,
  1437099964,
  2702547544,
  3433638243,
  2581715763,
  2787789398,
  1060185593,
  1593081372,
  2418618748,
  4260947970,
  69676912,
  2159744348,
  86519011,
  2512459080,
  3838209314,
  1220612927,
  3339683548,
  133810670,
  1090789135,
  1078426020,
  1569222167,
  845107691,
  3583754449,
  4072456591,
  1091646820,
  628848692,
  1613405280,
  3757631651,
  526609435,
  236106946,
  48312990,
  2942717905,
  3402727701,
  1797494240,
  859738849,
  992217954,
  4005476642,
  2243076622,
  3870952857,
  3732016268,
  765654824,
  3490871365,
  2511836413,
  1685915746,
  3888969200,
  1414112111,
  2273134842,
  3281911079,
  4080962846,
  172450625,
  2569994100,
  980381355,
  4109958455,
  2819808352,
  2716589560,
  2568741196,
  3681446669,
  3329971472,
  1835478071,
  660984891,
  3704678404,
  4045999559,
  3422617507,
  3040415634,
  1762651403,
  1719377915,
  3470491036,
  2693910283,
  3642056355,
  3138596744,
  1364962596,
  2073328063,
  1983633131,
  926494387,
  3423689081,
  2150032023,
  4096667949,
  1749200295,
  3328846651,
  309677260,
  2016342300,
  1779581495,
  3079819751,
  111262694,
  1274766160,
  443224088,
  298511866,
  1025883608,
  3806446537,
  1145181785,
  168956806,
  3641502830,
  3584813610,
  1689216846,
  3666258015,
  3200248200,
  1692713982,
  2646376535,
  4042768518,
  1618508792,
  1610833997,
  3523052358,
  4130873264,
  2001055236,
  3610705100,
  2202168115,
  4028541809,
  2961195399,
  1006657119,
  2006996926,
  3186142756,
  1430667929,
  3210227297,
  1314452623,
  4074634658,
  4101304120,
  2273951170,
  1399257539,
  3367210612,
  3027628629,
  1190975929,
  2062231137,
  2333990788,
  2221543033,
  2438960610,
  1181637006,
  548689776,
  2362791313,
  3372408396,
  3104550113,
  3145860560,
  296247880,
  1970579870,
  3078560182,
  3769228297,
  1714227617,
  3291629107,
  3898220290,
  166772364,
  1251581989,
  493813264,
  448347421,
  195405023,
  2709975567,
  677966185,
  3703036547,
  1463355134,
  2715995803,
  1338867538,
  1343315457,
  2802222074,
  2684532164,
  233230375,
  2599980071,
  2000651841,
  3277868038,
  1638401717,
  4028070440,
  3237316320,
  6314154,
  819756386,
  300326615,
  590932579,
  1405279636,
  3267499572,
  3150704214,
  2428286686,
  3959192993,
  3461946742,
  1862657033,
  1266418056,
  963775037,
  2089974820,
  2263052895,
  1917689273,
  448879540,
  3550394620,
  3981727096,
  150775221,
  3627908307,
  1303187396,
  508620638,
  2975983352,
  2726630617,
  1817252668,
  1876281319,
  1457606340,
  908771278,
  3720792119,
  3617206836,
  2455994898,
  1729034894,
  1080033504,
  976866871,
  3556439503,
  2881648439,
  1522871579,
  1555064734,
  1336096578,
  3548522304,
  2579274686,
  3574697629,
  3205460757,
  3593280638,
  3338716283,
  3079412587,
  564236357,
  2993598910,
  1781952180,
  1464380207,
  3163844217,
  3332601554,
  1699332808,
  1393555694,
  1183702653,
  3581086237,
  1288719814,
  691649499,
  2847557200,
  2895455976,
  3193889540,
  2717570544,
  1781354906,
  1676643554,
  2592534050,
  3230253752,
  1126444790,
  2770207658,
  2633158820,
  2210423226,
  2615765581,
  2414155088,
  3127139286,
  673620729,
  2805611233,
  1269405062,
  4015350505,
  3341807571,
  4149409754,
  1057255273,
  2012875353,
  2162469141,
  2276492801,
  2601117357,
  993977747,
  3918593370,
  2654263191,
  753973209,
  36408145,
  2530585658,
  25011837,
  3520020182,
  2088578344,
  530523599,
  2918365339,
  1524020338,
  1518925132,
  3760827505,
  3759777254,
  1202760957,
  3985898139,
  3906192525,
  674977740,
  4174734889,
  2031300136,
  2019492241,
  3983892565,
  4153806404,
  3822280332,
  352677332,
  2297720250,
  60907813,
  90501309,
  3286998549,
  1016092578,
  2535922412,
  2839152426,
  457141659,
  509813237,
  4120667899,
  652014361,
  1966332200,
  2975202805,
  55981186,
  2327461051,
  676427537,
  3255491064,
  2882294119,
  3433927263,
  1307055953,
  942726286,
  933058658,
  2468411793,
  3933900994,
  4215176142,
  1361170020,
  2001714738,
  2830558078,
  3274259782,
  1222529897,
  1679025792,
  2729314320,
  3714953764,
  1770335741,
  151462246,
  3013232138,
  1682292957,
  1483529935,
  471910574,
  1539241949,
  458788160,
  3436315007,
  1807016891,
  3718408830,
  978976581,
  1043663428,
  3165965781,
  1927990952,
  4200891579,
  2372276910,
  3208408903,
  3533431907,
  1412390302,
  2931980059,
  4132332400,
  1947078029,
  3881505623,
  4168226417,
  2941484381,
  1077988104,
  1320477388,
  886195818,
  18198404,
  3786409e3,
  2509781533,
  112762804,
  3463356488,
  1866414978,
  891333506,
  18488651,
  661792760,
  1628790961,
  3885187036,
  3141171499,
  876946877,
  2693282273,
  1372485963,
  791857591,
  2686433993,
  3759982718,
  3167212022,
  3472953795,
  2716379847,
  445679433,
  3561995674,
  3504004811,
  3574258232,
  54117162,
  3331405415,
  2381918588,
  3769707343,
  4154350007,
  1140177722,
  4074052095,
  668550556,
  3214352940,
  367459370,
  261225585,
  2610173221,
  4209349473,
  3468074219,
  3265815641,
  314222801,
  3066103646,
  3808782860,
  282218597,
  3406013506,
  3773591054,
  379116347,
  1285071038,
  846784868,
  2669647154,
  3771962079,
  3550491691,
  2305946142,
  453669953,
  1268987020,
  3317592352,
  3279303384,
  3744833421,
  2610507566,
  3859509063,
  266596637,
  3847019092,
  517658769,
  3462560207,
  3443424879,
  370717030,
  4247526661,
  2224018117,
  4143653529,
  4112773975,
  2788324899,
  2477274417,
  1456262402,
  2901442914,
  1517677493,
  1846949527,
  2295493580,
  3734397586,
  2176403920,
  1280348187,
  1908823572,
  3871786941,
  846861322,
  1172426758,
  3287448474,
  3383383037,
  1655181056,
  3139813346,
  901632758,
  1897031941,
  2986607138,
  3066810236,
  3447102507,
  1393639104,
  373351379,
  950779232,
  625454576,
  3124240540,
  4148612726,
  2007998917,
  544563296,
  2244738638,
  2330496472,
  2058025392,
  1291430526,
  424198748,
  50039436,
  29584100,
  3605783033,
  2429876329,
  2791104160,
  1057563949,
  3255363231,
  3075367218,
  3463963227,
  1469046755,
  985887462
];
var C_ORIG = [
  1332899944,
  1700884034,
  1701343084,
  1684370003,
  1668446532,
  1869963892
];
function _encipher(lr, off, P, S) {
  var n, l = lr[off], r = lr[off + 1];
  l ^= P[0];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[1];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[2];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[3];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[4];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[5];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[6];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[7];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[8];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[9];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[10];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[11];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[12];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[13];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[14];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[15];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[16];
  lr[off] = r ^ P[BLOWFISH_NUM_ROUNDS + 1];
  lr[off + 1] = l;
  return lr;
}
function _streamtoword(data, offp) {
  for (var i = 0, word = 0; i < 4; ++i)
    word = word << 8 | data[offp] & 255, offp = (offp + 1) % data.length;
  return { key: word, offp };
}
function _key(key, P, S) {
  var offset = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i = 0; i < plen; i++)
    sw = _streamtoword(key, offset), offset = sw.offp, P[i] = P[i] ^ sw.key;
  for (i = 0; i < plen; i += 2)
    lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
  for (i = 0; i < slen; i += 2)
    lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
function _ekskey(data, key, P, S) {
  var offp = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i = 0; i < plen; i++)
    sw = _streamtoword(key, offp), offp = sw.offp, P[i] = P[i] ^ sw.key;
  offp = 0;
  for (i = 0; i < plen; i += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
  for (i = 0; i < slen; i += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
function _crypt(b, salt, rounds, callback, progressCallback) {
  var cdata = C_ORIG.slice(), clen = cdata.length, err;
  if (rounds < 4 || rounds > 31) {
    err = Error("Illegal number of rounds (4-31): " + rounds);
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  if (salt.length !== BCRYPT_SALT_LEN) {
    err = Error(
      "Illegal salt length: " + salt.length + " != " + BCRYPT_SALT_LEN
    );
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  rounds = 1 << rounds >>> 0;
  var P, S, i = 0, j;
  if (typeof Int32Array === "function") {
    P = new Int32Array(P_ORIG);
    S = new Int32Array(S_ORIG);
  } else {
    P = P_ORIG.slice();
    S = S_ORIG.slice();
  }
  _ekskey(salt, b, P, S);
  function next() {
    if (progressCallback) progressCallback(i / rounds);
    if (i < rounds) {
      var start = Date.now();
      for (; i < rounds; ) {
        i = i + 1;
        _key(b, P, S);
        _key(salt, P, S);
        if (Date.now() - start > MAX_EXECUTION_TIME) break;
      }
    } else {
      for (i = 0; i < 64; i++)
        for (j = 0; j < clen >> 1; j++) _encipher(cdata, j << 1, P, S);
      var ret = [];
      for (i = 0; i < clen; i++)
        ret.push((cdata[i] >> 24 & 255) >>> 0), ret.push((cdata[i] >> 16 & 255) >>> 0), ret.push((cdata[i] >> 8 & 255) >>> 0), ret.push((cdata[i] & 255) >>> 0);
      if (callback) {
        callback(null, ret);
        return;
      } else return ret;
    }
    if (callback) nextTick(next);
  }
  if (typeof callback !== "undefined") {
    next();
  } else {
    var res;
    while (true) if (typeof (res = next()) !== "undefined") return res || [];
  }
}
function _hash(password, salt, callback, progressCallback) {
  var err;
  if (typeof password !== "string" || typeof salt !== "string") {
    err = Error("Invalid string / salt: Not a string");
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  var minor, offset;
  if (salt.charAt(0) !== "$" || salt.charAt(1) !== "2") {
    err = Error("Invalid salt version: " + salt.substring(0, 2));
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  if (salt.charAt(2) === "$") minor = String.fromCharCode(0), offset = 3;
  else {
    minor = salt.charAt(2);
    if (minor !== "a" && minor !== "b" && minor !== "y" || salt.charAt(3) !== "$") {
      err = Error("Invalid salt revision: " + salt.substring(2, 4));
      if (callback) {
        nextTick(callback.bind(this, err));
        return;
      } else throw err;
    }
    offset = 4;
  }
  if (salt.charAt(offset + 2) > "$") {
    err = Error("Missing salt rounds");
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  var r1 = parseInt(salt.substring(offset, offset + 1), 10) * 10, r2 = parseInt(salt.substring(offset + 1, offset + 2), 10), rounds = r1 + r2, real_salt = salt.substring(offset + 3, offset + 25);
  password += minor >= "a" ? "\0" : "";
  var passwordb = utf8Array(password), saltb = base64_decode(real_salt, BCRYPT_SALT_LEN);
  function finish(bytes) {
    var res = [];
    res.push("$2");
    if (minor >= "a") res.push(minor);
    res.push("$");
    if (rounds < 10) res.push("0");
    res.push(rounds.toString());
    res.push("$");
    res.push(base64_encode(saltb, saltb.length));
    res.push(base64_encode(bytes, C_ORIG.length * 4 - 1));
    return res.join("");
  }
  if (typeof callback == "undefined")
    return finish(_crypt(passwordb, saltb, rounds));
  else {
    _crypt(
      passwordb,
      saltb,
      rounds,
      function(err2, bytes) {
        if (err2) callback(err2, null);
        else callback(null, finish(bytes));
      },
      progressCallback
    );
  }
}
function encodeBase64(bytes, length) {
  return base64_encode(bytes, length);
}
function decodeBase64(string, length) {
  return base64_decode(string, length);
}
var bcryptjs_default = {
  setRandomFallback,
  genSaltSync,
  genSalt,
  hashSync,
  hash,
  compareSync,
  compare,
  getRounds,
  getSalt,
  truncates,
  encodeBase64,
  decodeBase64
};

// node_modules/jose/dist/webapi/lib/buffer_utils.js
var encoder = new TextEncoder();
var decoder = new TextDecoder();
var strictDecoder = new TextDecoder("utf-8", { fatal: true });
var UINT32_RANGE = 2 ** 32;
function concat(...buffers) {
  const size = buffers.reduce((acc, { length }) => acc + length, 0), buf = new Uint8Array(size);
  let i = 0;
  for (const buffer of buffers)
    buf.set(buffer, i), i += buffer.length;
  return buf;
}
var NON_ASCII = /[^\x00-\x7f]/;
function encode(string) {
  if (typeof string == "string" && string.length >= 128) {
    if (NON_ASCII.test(string))
      throw new TypeError("non-ASCII string encountered in encode()");
    return encoder.encode(string);
  }
  const bytes = new Uint8Array(string.length);
  for (let i = 0; i < string.length; i++) {
    const code = string.charCodeAt(i);
    if (code > 127)
      throw new TypeError("non-ASCII string encountered in encode()");
    bytes[i] = code;
  }
  return bytes;
}
function encodeBase642(input, url = false) {
  if (Uint8Array.prototype.toBase64)
    return input.toBase64({ alphabet: url ? "base64url" : "base64", omitPadding: url });
  const CHUNK_SIZE = 32768, arr = [];
  for (let i = 0; i < input.length; i += CHUNK_SIZE)
    arr.push(String.fromCharCode.apply(null, input.subarray(i, i + CHUNK_SIZE)));
  const encoded = btoa(arr.join(""));
  return url ? encoded.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_") : encoded;
}
function decodeBase642(encoded, url = false) {
  if (Uint8Array.fromBase64)
    return Uint8Array.fromBase64(encoded, { alphabet: url ? "base64url" : "base64" });
  if (url) {
    if (encoded.includes("+") || encoded.includes("/"))
      throw new TypeError("Invalid base64url");
    encoded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  }
  const binary = atob(encoded), bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// node_modules/jose/dist/webapi/util/errors.js
var JOSEError = class extends Error {
  static code = "ERR_JOSE_GENERIC";
  code = "ERR_JOSE_GENERIC";
  constructor(message2, options) {
    super(message2, options), this.name = this.constructor.name, Error.captureStackTrace?.(this, this.constructor);
  }
};
var JWTClaimValidationFailed = class extends JOSEError {
  static code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
  code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
  claim;
  reason;
  payload;
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } }), this.claim = claim, this.reason = reason, this.payload = payload;
  }
};
var JWTExpired = class extends JOSEError {
  static code = "ERR_JWT_EXPIRED";
  code = "ERR_JWT_EXPIRED";
  claim;
  reason;
  payload;
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } }), this.claim = claim, this.reason = reason, this.payload = payload;
  }
};
var JOSEAlgNotAllowed = class extends JOSEError {
  static code = "ERR_JOSE_ALG_NOT_ALLOWED";
  code = "ERR_JOSE_ALG_NOT_ALLOWED";
};
var JOSENotSupported = class extends JOSEError {
  static code = "ERR_JOSE_NOT_SUPPORTED";
  code = "ERR_JOSE_NOT_SUPPORTED";
};
var JWSInvalid = class extends JOSEError {
  static code = "ERR_JWS_INVALID";
  code = "ERR_JWS_INVALID";
};
var JWTInvalid = class extends JOSEError {
  static code = "ERR_JWT_INVALID";
  code = "ERR_JWT_INVALID";
};
var JWSSignatureVerificationFailed = class extends JOSEError {
  static code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  constructor(message2 = "signature verification failed", options) {
    super(message2, options);
  }
};

// node_modules/jose/dist/webapi/util/base64url.js
var invalid = "The input to be decoded is not correctly encoded.";
function decode(input) {
  try {
    return decodeBase642(typeof input == "string" ? input : decoder.decode(input), true);
  } catch (cause) {
    throw new TypeError(invalid, { cause });
  }
}
function encode2(input) {
  return encodeBase642(typeof input == "string" ? encoder.encode(input) : input, true);
}

// node_modules/jose/dist/webapi/lib/validate.js
function isObject(input) {
  if (typeof input != "object" || input === null || Object.prototype.toString.call(input) !== "[object Object]")
    return false;
  const prototype = Object.getPrototypeOf(input);
  return prototype === null || Object.getPrototypeOf(prototype) === null;
}
function isDisjoint(...headers) {
  const parameters = /* @__PURE__ */ new Set();
  for (const header of headers)
    if (header)
      for (const parameter of Object.keys(header)) {
        if (parameters.has(parameter))
          return false;
        parameters.add(parameter);
      }
  return true;
}
function assertNotSet(value, name) {
  if (value !== void 0)
    throw new TypeError(`${name} can only be called once`);
}
function decodeBase64url(value, label, ErrorClass) {
  try {
    return decode(value);
  } catch (cause) {
    throw new ErrorClass(`Failed to base64url decode the ${label}`, { cause });
  }
}
function encodeAsciiMember(value, label, ErrorClass) {
  try {
    return encode(value);
  } catch (cause) {
    throw new ErrorClass(`The ${label} is not a valid base64url string`, { cause });
  }
}
function parseJoseHeader(encodedProtectedHeader, ErrorClass, message2) {
  let parsed;
  try {
    parsed = JSON.parse(strictDecoder.decode(decode(encodedProtectedHeader)));
  } catch (cause) {
    throw new ErrorClass(message2, { cause });
  }
  if (!isObject(parsed))
    throw new ErrorClass(message2);
  return parsed;
}
var JWS_RECOGNIZED = { __proto__: null, b64: true };
function validateAlgorithms(option, algorithms) {
  if (algorithms !== void 0 && (!Array.isArray(algorithms) || algorithms.some((s) => typeof s != "string")))
    throw new TypeError(`"${option}" option must be an array of strings`);
  return algorithms === void 0 ? void 0 : new Set(algorithms);
}
function validateCritDuplicates(Err, protectedHeader) {
  const { crit } = protectedHeader ?? {};
  if (Array.isArray(crit) && new Set(crit).size !== crit.length)
    throw new Err('"crit" (Critical) Header Parameter MUST NOT contain duplicate values');
}
function validateCrit(Err, recognizedDefault, recognizedOption, protectedHeader, joseHeader) {
  if (joseHeader.crit !== void 0 && protectedHeader?.crit === void 0)
    throw new Err('"crit" (Critical) Header Parameter MUST be integrity protected');
  if (!protectedHeader || protectedHeader.crit === void 0)
    return [];
  if (!Array.isArray(protectedHeader.crit) || protectedHeader.crit.length === 0 || protectedHeader.crit.some((input) => typeof input != "string" || input.length === 0))
    throw new Err('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
  const recognized = recognizedOption === void 0 ? recognizedDefault : { __proto__: null, ...recognizedOption, ...recognizedDefault };
  for (const parameter of protectedHeader.crit) {
    if (!(parameter in recognized))
      throw new JOSENotSupported(`Extension Header Parameter "${parameter}" is not recognized`);
    if (!Object.hasOwn(joseHeader, parameter) || joseHeader[parameter] === void 0)
      throw new Err(`Extension Header Parameter "${parameter}" is missing`);
    if (recognized[parameter] && (!Object.hasOwn(protectedHeader, parameter) || protectedHeader[parameter] === void 0))
      throw new Err(`Extension Header Parameter "${parameter}" MUST be integrity protected`);
  }
  return protectedHeader.crit;
}
function validateB64(protectedHeader, extensions) {
  if (extensions.includes("b64")) {
    const b64 = protectedHeader.b64;
    if (typeof b64 != "boolean")
      throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
    return b64;
  }
  return true;
}
function serializeJoseHeader(Err, header) {
  let serialized, parsed;
  try {
    serialized = JSON.stringify(header), parsed = JSON.parse(serialized);
  } catch (cause) {
    throw new Err("JOSE Header is not valid JSON", { cause });
  }
  if (!isObject(parsed))
    throw new Err("JOSE Header is not a JSON object");
  return [parsed, serialized];
}

// node_modules/jose/dist/webapi/lib/key.js
var tag = (key) => key[Symbol.toStringTag];
var jwkMatchesOp = (entry, key, usage) => {
  const { alg } = entry;
  if (key.use !== void 0) {
    const expected = usage === "sign" || usage === "verify" ? "sig" : "enc";
    if (key.use !== expected)
      throw new TypeError(`Invalid key for this operation, its "use" must be "${expected}" when present`);
  }
  if (key.alg !== void 0 && key.alg !== alg)
    throw new TypeError(`Invalid key for this operation, its "alg" must be "${alg}" when present`);
  if (Array.isArray(key.key_ops)) {
    const expectedKeyOp = usage === "encrypt" || usage === "decrypt" ? entry.ops?.[usage === "encrypt" ? 0 : 1] : usage;
    if (expectedKeyOp && !key.key_ops.includes(expectedKeyOp))
      throw new TypeError(`Invalid key for this operation, its "key_ops" must include "${expectedKeyOp}" when present`);
  }
};
async function prepareKey(entry, key, usage) {
  const { alg, secret: secret2 } = entry, requiresPrivateKey = usage === "decrypt" || usage === "sign";
  if (secret2 && key instanceof Uint8Array)
    return key;
  let normalized, keyObject;
  if (isObject(key)) {
    if (normalized = normalizeJwk(key), typeof normalized.kty != "string")
      throw invalidKeyType(alg, key, secret2);
    if (!(secret2 ? normalized.kty === "oct" && typeof normalized.k == "string" : normalized.kty !== "oct" && (requiresPrivateKey ? normalized.kty === "AKP" && typeof normalized.priv == "string" || typeof normalized.d == "string" : normalized.d === void 0 && normalized.priv === void 0)))
      throw new TypeError(secret2 ? 'JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present' : `JSON Web Key for this operation must be a ${requiresPrivateKey ? "private" : "public"} JWK`);
    if (jwkMatchesOp(entry, normalized, usage), normalized.kty === "oct")
      return decode(normalized.k);
    if (!Object.isFrozen(key)) {
      const { key_ops } = key;
      Array.isArray(key_ops) && Object.freeze(key_ops), Object.freeze(key);
    }
  } else {
    if (!isKeyLike(key))
      throw invalidKeyType(alg, key, secret2);
    const expectedType = secret2 ? "secret" : requiresPrivateKey ? "private" : "public";
    if (key.type !== expectedType && (secret2 || ["secret", "public", "private"].includes(key.type)))
      throw new TypeError(`${tag(key)} instances must be of type "${expectedType}" for the ${alg} algorithm`);
    if (isCryptoKey(key))
      return key;
    if (keyObject = key, keyObject.type === "secret")
      return keyObject.export();
  }
  cache ||= /* @__PURE__ */ new WeakMap();
  const cacheKey = key;
  let cached = cache.get(cacheKey);
  if (cached?.[alg])
    return cached[alg];
  if (cached || cache.set(cacheKey, cached = {}), keyObject && typeof keyObject.toCryptoKey == "function") {
    const isPublic = keyObject.type === "public", crv = nist[keyObject.asymmetricKeyDetails?.namedCurve], params = entry.resolve?.({ crv, asymmetricKeyType: keyObject.asymmetricKeyType }) ?? entry.subtle;
    return cached[alg] = keyObject.toCryptoKey(params, isPublic, entry.usages[isPublic ? 0 : 1]);
  }
  return normalized ??= keyObject.export({ format: "jwk" }), normalized.alg = alg, cached[alg] = await jwkToKey(entry, normalized);
}
var cache;
var nist = {
  __proto__: null,
  prime256v1: "P-256",
  secp384r1: "P-384",
  secp521r1: "P-521"
};
var isCryptoKey = (key) => {
  if (key?.[Symbol.toStringTag] === "CryptoKey")
    return true;
  try {
    return key instanceof CryptoKey;
  } catch {
    return false;
  }
};
var isKeyObject = (key) => key?.[Symbol.toStringTag] === "KeyObject";
var isKeyLike = (key) => isCryptoKey(key) || isKeyObject(key);
function message(msg, actual, ...types) {
  if (types.length > 2) {
    const last = types.pop();
    msg += `one of type ${types.join(", ")}, or ${last}.`;
  } else types.length === 2 ? msg += `one of type ${types[0]} or ${types[1]}.` : msg += `of type ${types[0]}.`;
  return actual == null ? msg += ` Received ${actual}` : typeof actual == "function" && actual.name ? msg += ` Received function ${actual.name}` : typeof actual == "object" && actual != null && actual.constructor?.name && (msg += ` Received an instance of ${actual.constructor.name}`), msg;
}
function invalidKeyType(alg, actual, secret2) {
  const types = ["CryptoKey", "KeyObject", "JSON Web Key"];
  return secret2 && types.push("Uint8Array"), new TypeError(message(`Key for the ${alg} algorithm must be `, actual, ...types));
}
var unusable = (name, prop = "algorithm.name") => new TypeError(`CryptoKey does not support this operation, its ${prop} must be ${name}`);
function checkUsage(key, usage) {
  if (usage && !key.usages.includes(usage))
    throw new TypeError(`CryptoKey does not support this operation, its usages must include ${usage}.`);
}
function checkModulusLength(alg, key) {
  const { modulusLength } = key.algorithm;
  if (typeof modulusLength != "number" || modulusLength < 2048)
    throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
}
function checkCryptoKey(key, expected, usage) {
  const algorithm = key.algorithm;
  if (algorithm.name !== expected.name)
    throw unusable(expected.name);
  if (expected.hash && algorithm.hash?.name !== expected.hash)
    throw unusable(expected.hash, "algorithm.hash");
  if (expected.namedCurve && algorithm.namedCurve !== expected.namedCurve)
    throw unusable(expected.namedCurve, "algorithm.namedCurve");
  if (expected.length !== void 0 && algorithm.length !== expected.length)
    throw unusable(expected.length, "algorithm.length");
  checkUsage(key, usage);
}
function snapshotJwk(jwk) {
  return { __proto__: null, ...jwk };
}
function normalizeJwk(jwk) {
  const normalized = snapshotJwk(jwk);
  if (normalized.ext !== void 0 && typeof normalized.ext != "boolean")
    throw new TypeError('"ext" (Extractable) Parameter must be a boolean');
  if (normalized.key_ops !== void 0) {
    const value = normalized.key_ops, keyOps = Array.isArray(value) ? [...value] : void 0;
    if (!keyOps || keyOps.some((operation) => typeof operation != "string") || new Set(keyOps).size !== keyOps.length)
      throw new TypeError('"key_ops" (Key Operations) Parameter must be an array of unique strings');
    normalized.key_ops = keyOps;
  }
  return normalized;
}
async function jwkToKey(entry, jwk, extractable) {
  if (!entry.kty.includes(jwk.kty))
    throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
  const algorithm = entry.resolve?.({ kty: jwk.kty, crv: jwk.crv }) ?? entry.subtle, isPrivate = !!(jwk.d || jwk.priv), keyData = { ...jwk, ext: extractable ?? jwk.ext };
  return keyData.kty !== "AKP" && delete keyData.alg, delete keyData.use, crypto.subtle.importKey("jwk", keyData, algorithm, keyData.ext ?? !isPrivate, jwk.key_ops ?? entry.usages[isPrivate ? 1 : 0]);
}
async function rawKey(key, expected, usage, extractable = false) {
  return key instanceof Uint8Array && (key = await crypto.subtle.importKey("raw", key, expected, extractable, [usage])), checkCryptoKey(key, expected, usage), key;
}

// node_modules/jose/dist/webapi/lib/key_descriptor.js
function table(entries) {
  const out = { __proto__: null };
  for (const alg in entries)
    out[alg] = { ...entries[alg], alg };
  return out;
}

// node_modules/jose/dist/webapi/lib/jws_algorithms.js
var sig = [["verify"], ["sign"]];
function hmac(bits) {
  const subtle = { name: "HMAC", hash: `SHA-${bits}` };
  return { kty: ["oct"], secret: true, subtle, signing: subtle, usages: sig };
}
function rsa(bits, saltLength) {
  const subtle = { name: saltLength ? "RSA-PSS" : "RSASSA-PKCS1-v1_5", hash: `SHA-${bits}` };
  return {
    kty: ["RSA"],
    subtle,
    signing: saltLength ? { ...subtle, saltLength } : subtle,
    usages: sig,
    minRsaBits: 2048
  };
}
function ecdsa(crv, bits) {
  return {
    kty: ["EC"],
    crv,
    subtle: { name: "ECDSA", namedCurve: crv },
    signing: { name: "ECDSA", hash: `SHA-${bits}` },
    usages: sig
  };
}
function eddsa() {
  const subtle = { name: "Ed25519" };
  return {
    kty: ["OKP"],
    crv: "Ed25519",
    subtle,
    signing: subtle,
    usages: sig
  };
}
function mldsa(parameterSet) {
  const subtle = { name: `ML-DSA-${parameterSet}` };
  return {
    kty: ["AKP"],
    subtle,
    signing: subtle,
    usages: sig
  };
}
var JWS = table({
  HS256: hmac(256),
  HS384: hmac(384),
  HS512: hmac(512),
  RS256: rsa(256),
  RS384: rsa(384),
  RS512: rsa(512),
  PS256: rsa(256, 32),
  PS384: rsa(384, 48),
  PS512: rsa(512, 64),
  ES256: ecdsa("P-256", 256),
  ES384: ecdsa("P-384", 384),
  ES512: ecdsa("P-521", 512),
  EdDSA: eddsa(),
  Ed25519: eddsa(),
  "ML-DSA-44": mldsa(44),
  "ML-DSA-65": mldsa(65),
  "ML-DSA-87": mldsa(87)
});
function jwsAlgorithm(alg) {
  const entry = typeof alg == "string" ? JWS[alg] : void 0;
  if (!entry)
    throw new JOSENotSupported(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
  return entry;
}

// node_modules/jose/dist/webapi/lib/jws_verify.js
function prepareVerify(options) {
  return [options && validateAlgorithms("algorithms", options.algorithms), options?.crit];
}
function parseProtectedHeader(encodedProtectedHeader) {
  return encodedProtectedHeader === void 0 ? {} : parseJoseHeader(encodedProtectedHeader, JWSInvalid, "JWS Protected Header is invalid");
}
function encodeCompactUnencodedPayload(payload) {
  try {
    return encode(payload);
  } catch (cause) {
    throw new JWSInvalid("JWS Compact Serialization payload must use only ASCII characters", {
      cause
    });
  }
}
async function verifySignature(jws, shared, key, encodeUnencodedPayload, parsedProtected) {
  const { protected: encodedProtectedHeader, header, payload: inputPayload } = jws, protectedHeader = parsedProtected ?? parseProtectedHeader(encodedProtectedHeader);
  if (!isDisjoint(protectedHeader, header))
    throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  const joseHeader = { ...protectedHeader, ...header }, b64 = validateB64(protectedHeader, validateCrit(JWSInvalid, JWS_RECOGNIZED, shared[1], protectedHeader, joseHeader)), { alg } = joseHeader;
  if (typeof alg != "string" || !alg)
    throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  if (shared[0] && !shared[0].has(alg))
    throw new JOSEAlgNotAllowed('"alg" (Algorithm) Header Parameter value not allowed');
  if (b64) {
    if (typeof inputPayload != "string")
      throw new JWSInvalid("JWS Payload must be a string");
  } else if (typeof inputPayload != "string" && !(inputPayload instanceof Uint8Array))
    throw new JWSInvalid("JWS Payload must be a string or an Uint8Array instance");
  const signingPayload = b64 || typeof inputPayload != "string" ? inputPayload : encodeUnencodedPayload(inputPayload);
  let resolvedKey = false;
  typeof key == "function" && (key = await key(protectedHeader, jws), resolvedKey = true);
  const entry = jwsAlgorithm(alg), signingInput = concat(encodedProtectedHeader !== void 0 ? encode(encodedProtectedHeader) : new Uint8Array(), encode("."), typeof signingPayload == "string" ? shared[2] ??= encodeAsciiMember(signingPayload, "payload", JWSInvalid) : signingPayload), signature = decodeBase64url(jws.signature, "signature", JWSInvalid), verificationKey = await prepareKey(entry, key, "verify"), cryptoKey = await rawKey(verificationKey, entry.subtle, "verify");
  entry.minRsaBits && checkModulusLength(entry.alg, cryptoKey);
  let verified = false;
  try {
    verified = await crypto.subtle.verify(entry.signing, cryptoKey, signature, signingInput);
  } catch (cause) {
    throw new JWSSignatureVerificationFailed(void 0, { cause });
  }
  if (!verified)
    throw new JWSSignatureVerificationFailed();
  const result = { payload: typeof signingPayload == "string" ? decodeBase64url(signingPayload, "payload", JWSInvalid) : signingPayload };
  return encodedProtectedHeader !== void 0 && (result.protectedHeader = protectedHeader), header !== void 0 && (result.unprotectedHeader = header), resolvedKey ? [{ ...result, key: verificationKey }, b64] : [result, b64];
}
async function verifyCompact(jws, shared, key) {
  if (jws instanceof Uint8Array && (jws = decoder.decode(jws)), typeof jws != "string")
    throw new JWSInvalid("Compact JWS must be a string or Uint8Array");
  const { 0: protectedHeader, 1: payload, 2: signature, length } = jws.split(".");
  if (length !== 3)
    throw new JWSInvalid("Invalid Compact JWS");
  return verifySignature({ payload, protected: protectedHeader, signature }, shared, key, encodeCompactUnencodedPayload);
}

// node_modules/jose/dist/webapi/lib/jwt_claims_set.js
var epoch = (date) => Math.floor(date.getTime() / 1e3);
var multipliers = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
  y: 31557600
};
var REGEX = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
var checkFailed = "check_failed";
function invalidDuration() {
  throw new TypeError("Invalid time period format");
}
function secs(str) {
  typeof str != "string" && invalidDuration();
  const matched = REGEX.exec(str);
  (!matched || matched[4] && matched[1]) && invalidDuration();
  const value = parseFloat(matched[2]), durationSeconds = Math.round(value * multipliers[matched[3][0].toLowerCase()]);
  return Number.isFinite(durationSeconds) || invalidDuration(), matched[1] === "-" || matched[4] === "ago" ? -durationSeconds : durationSeconds;
}
function validateInput(label, input) {
  if (!Number.isFinite(input))
    throw new TypeError(`Invalid ${label} input`);
  return input;
}
function validateStringClaim(claim, value) {
  if (typeof value != "string")
    throw new TypeError(`"${claim}" claim must be a string`);
}
function validateAudienceClaim(value) {
  if (typeof value != "string" && (!Array.isArray(value) || Array.from(value).some((member) => typeof member != "string")))
    throw new TypeError('"aud" claim must be a string or an array of strings');
}
function numericDate(value, label) {
  return typeof value == "number" ? validateInput(label, value) : value instanceof Date ? validateInput(label, epoch(value)) : epoch(/* @__PURE__ */ new Date()) + secs(value);
}
var normalizeTyp = (value) => {
  const normalized = value.toLowerCase();
  return value.includes("/") ? normalized : `application/${normalized}`;
};
var checkAudiencePresence = (audPayload, audOption) => typeof audPayload == "string" ? audOption.includes(audPayload) : Array.isArray(audPayload) ? audOption.some((aud) => audPayload.includes(aud)) : false;
function validateNumericDate(claimsSet, claim, required = false) {
  const value = claimsSet[claim];
  if (!(value === void 0 && !required)) {
    if (typeof value != "number")
      throw new JWTClaimValidationFailed(`"${claim}" claim must be a number`, claimsSet, claim, "invalid");
    return value;
  }
}
function unexpectedClaim(claimsSet, claim) {
  throw new JWTClaimValidationFailed(`unexpected "${claim}" claim value`, claimsSet, claim, checkFailed);
}
function validateClaimsSet(protectedHeader, claimsSetBytes, options = {}) {
  let claimsSet;
  try {
    claimsSet = JSON.parse(strictDecoder.decode(claimsSetBytes));
  } catch (cause) {
    throw new JWTInvalid("JWT Claims Set must be a top-level JSON object", { cause });
  }
  if (!isObject(claimsSet))
    throw new JWTInvalid("JWT Claims Set must be a top-level JSON object");
  const { typ } = options;
  if (typ !== void 0 && (typeof protectedHeader.typ != "string" || normalizeTyp(protectedHeader.typ) !== normalizeTyp(typ)))
    throw new JWTClaimValidationFailed('unexpected "typ" JWT header value', claimsSet, "typ", checkFailed);
  const { requiredClaims = [], issuer, subject, audience, maxTokenAge } = options, presenceCheck = [...requiredClaims];
  maxTokenAge !== void 0 && presenceCheck.push("iat"), audience !== void 0 && presenceCheck.push("aud"), subject !== void 0 && presenceCheck.push("sub"), issuer !== void 0 && presenceCheck.push("iss");
  for (const claim of new Set(presenceCheck.reverse()))
    if (!Object.hasOwn(claimsSet, claim))
      throw new JWTClaimValidationFailed(`missing required "${claim}" claim`, claimsSet, claim, "missing");
  issuer !== void 0 && !(Array.isArray(issuer) ? issuer : [issuer]).includes(claimsSet.iss) && unexpectedClaim(claimsSet, "iss"), subject !== void 0 && claimsSet.sub !== subject && unexpectedClaim(claimsSet, "sub"), audience !== void 0 && !checkAudiencePresence(claimsSet.aud, typeof audience == "string" ? [audience] : audience) && unexpectedClaim(claimsSet, "aud");
  const { clockTolerance } = options;
  let tolerance = 0;
  if (typeof clockTolerance == "string")
    tolerance = secs(clockTolerance);
  else if (clockTolerance !== void 0) {
    if (typeof clockTolerance != "number")
      throw new TypeError("Invalid clockTolerance option type");
    tolerance = clockTolerance;
  }
  validateInput("clockTolerance option", tolerance);
  const { currentDate } = options, now = validateInput("currentDate option", epoch(currentDate === void 0 ? /* @__PURE__ */ new Date() : currentDate)), iat = validateNumericDate(claimsSet, "iat", maxTokenAge !== void 0), nbf = validateNumericDate(claimsSet, "nbf");
  if (nbf !== void 0 && nbf > now + tolerance)
    throw new JWTClaimValidationFailed('"nbf" claim timestamp check failed', claimsSet, "nbf", checkFailed);
  const exp = validateNumericDate(claimsSet, "exp");
  if (exp !== void 0 && exp <= now - tolerance)
    throw new JWTExpired('"exp" claim timestamp check failed', claimsSet, "exp", checkFailed);
  if (maxTokenAge !== void 0) {
    const age = now - iat, max = validateInput("maxTokenAge option", typeof maxTokenAge == "number" ? maxTokenAge : secs(maxTokenAge));
    if (age - tolerance > max)
      throw new JWTExpired('"iat" claim timestamp check failed (too far in the past)', claimsSet, "iat", checkFailed);
    if (age < -tolerance)
      throw new JWTClaimValidationFailed('"iat" claim timestamp check failed (it should be in the past)', claimsSet, "iat", checkFailed);
  }
  return claimsSet;
}
var producerClaimsSets;
function producerClaimsSet(producer) {
  return producerClaimsSets.get(producer);
}
function jwtClaimsSetBytes(producer) {
  const claimsSet = producerClaimsSet(producer);
  for (const claim of ["iat", "nbf", "exp"]) {
    const value = claimsSet[claim];
    if (typeof value == "number" && !Number.isFinite(value))
      throw new TypeError(`"${claim}" claim must be a finite number`);
  }
  return encoder.encode(JSON.stringify(claimsSet));
}
var JWTClaimsBuilder = class {
  constructor(claimsSet = {}) {
    if (!isObject(claimsSet))
      throw new TypeError("JWT Claims Set MUST be an object");
    (producerClaimsSets ||= /* @__PURE__ */ new WeakMap()).set(this, structuredClone(claimsSet));
  }
  setIssuer(value) {
    return validateStringClaim("iss", value), producerClaimsSet(this).iss = value, this;
  }
  setSubject(value) {
    return validateStringClaim("sub", value), producerClaimsSet(this).sub = value, this;
  }
  setAudience(value) {
    return validateAudienceClaim(value), producerClaimsSet(this).aud = value, this;
  }
  setJti(value) {
    return validateStringClaim("jti", value), producerClaimsSet(this).jti = value, this;
  }
  setNotBefore(value) {
    return producerClaimsSet(this).nbf = numericDate(value, "setNotBefore"), this;
  }
  setExpirationTime(value) {
    return producerClaimsSet(this).exp = numericDate(value, "setExpirationTime"), this;
  }
  setIssuedAt(value) {
    const claimsSet = producerClaimsSet(this);
    return value === void 0 ? claimsSet.iat = epoch(/* @__PURE__ */ new Date()) : typeof value == "string" ? claimsSet.iat = validateInput("setIssuedAt", epoch(/* @__PURE__ */ new Date()) + secs(value)) : claimsSet.iat = numericDate(value, "setIssuedAt"), this;
  }
};

// node_modules/jose/dist/webapi/jwt/verify.js
async function jwtVerify(jwt, key, options) {
  const [verified, b64] = await verifyCompact(jwt, prepareVerify(options), key);
  if (!b64)
    throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
  const payload = validateClaimsSet(verified.protectedHeader, verified.payload, options);
  return { ...verified, payload };
}

// node_modules/jose/dist/webapi/lib/jws_sign.js
async function createSignature(input, key, rejectUnencoded) {
  let [payload, protectedHeader, unprotectedHeader, crit] = input, encodedProtectedHeader = "";
  if (protectedHeader !== void 0) {
    const normalized = serializeJoseHeader(JWSInvalid, protectedHeader);
    protectedHeader = normalized[0], encodedProtectedHeader = encode2(normalized[1]);
  }
  if (unprotectedHeader !== void 0 && (unprotectedHeader = serializeJoseHeader(JWSInvalid, unprotectedHeader)[0]), !protectedHeader && !unprotectedHeader)
    throw new JWSInvalid("either setProtectedHeader or setUnprotectedHeader must be called before #sign()");
  if (!isDisjoint(protectedHeader, unprotectedHeader))
    throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  const joseHeader = { ...protectedHeader, ...unprotectedHeader };
  validateCritDuplicates(JWSInvalid, protectedHeader);
  const b64 = validateB64(protectedHeader, validateCrit(JWSInvalid, JWS_RECOGNIZED, crit, protectedHeader, joseHeader));
  b64 || rejectUnencoded?.();
  const { alg } = joseHeader;
  if (typeof alg != "string" || !alg)
    throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  const entry = jwsAlgorithm(alg);
  let encodedPayload = "", signingPayload = payload, signingInput;
  if (b64) {
    const encodedPayloadCache = input[4];
    encodedPayloadCache ? (encodedPayload = encodedPayloadCache[0] ??= encode2(payload), signingPayload = encodedPayloadCache[1] ??= encode(encodedPayload)) : (encodedPayload = encode2(payload), signingInput = encoder.encode(`${encodedProtectedHeader}.${encodedPayload}`));
  }
  signingInput ??= concat(encode(encodedProtectedHeader), encode("."), signingPayload);
  const signingKey = await rawKey(await prepareKey(entry, key, "sign"), entry.subtle, "sign");
  entry.minRsaBits && checkModulusLength(entry.alg, signingKey);
  const jws = {
    signature: encode2(new Uint8Array(await crypto.subtle.sign(entry.signing, signingKey, signingInput))),
    payload: encodedPayload
  };
  return protectedHeader && (jws.protected = encodedProtectedHeader), unprotectedHeader && (jws.header = unprotectedHeader), [jws, b64];
}
async function createCompactSignature(payload, protectedHeader, crit, key, rejectUnencoded) {
  const [jws] = await createSignature([payload, protectedHeader, void 0, crit], key, rejectUnencoded);
  return `${jws.protected}.${jws.payload}.${jws.signature}`;
}

// node_modules/jose/dist/webapi/jwt/sign.js
var SignJWT_base = JWTClaimsBuilder;
var SignJWT = class extends SignJWT_base {
  #protectedHeader;
  setProtectedHeader(protectedHeader) {
    return assertNotSet(this.#protectedHeader, "setProtectedHeader"), this.#protectedHeader = protectedHeader, this;
  }
  async sign(key, options) {
    return createCompactSignature(jwtClaimsSetBytes(this), this.#protectedHeader, options?.crit, key, () => {
      throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
    });
  }
};

// server/auth.ts
var SESSION_COOKIE = "oketex_session";
var SESSION_DAYS = 7;
function secret() {
  const s = process.env.AUTH_SECRET || "";
  if (s.length < 16) throw new Error("AUTH_SECRET is not set (min 16 chars)");
  return new TextEncoder().encode(s);
}
function authConfigured() {
  return (process.env.AUTH_SECRET || "").length >= 16;
}
async function hashPassword(pw) {
  return bcryptjs_default.hash(pw, 10);
}
async function verifyPassword(pw, hash2) {
  try {
    return await bcryptjs_default.compare(pw, hash2);
  } catch {
    return false;
  }
}
async function signSession(user) {
  return new SignJWT({ name: user.name, email: user.email, phone: user.phone || "", role: user.role, partnerCode: user.partnerCode ?? null }).setProtectedHeader({ alg: "HS256" }).setSubject(String(user.id)).setIssuedAt().setExpirationTime(`${SESSION_DAYS}d`).sign(secret());
}
async function verifySessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: payload.sub,
      name: String(payload.name || ""),
      email: String(payload.email || ""),
      phone: String(payload.phone || ""),
      role: payload.role || "customer",
      partnerCode: payload.partnerCode ?? null
    };
  } catch {
    return null;
  }
}
function sessionCookieHeader(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 3600}${secure}`;
}
function clearCookieHeader() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
function isAdminBootstrap(email, password) {
  const e = process.env.ADMIN_EMAIL || "";
  const p = process.env.ADMIN_PASSWORD || "";
  return !!e && !!p && !!email && !!password && email.toLowerCase() === e.toLowerCase() && password === p;
}
function adminBootstrapUser() {
  return { id: "admin-env", name: "Oketex Admin", email: (process.env.ADMIN_EMAIL || "").toLowerCase(), role: "admin", partnerCode: null };
}
async function getSessionUser(req) {
  if (!authConfigured()) return null;
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  return verifySessionToken(token);
}
async function isAdmin(req) {
  const u = await getSessionUser(req);
  return !!u && u.role === "admin";
}
async function findUserByEmail(email) {
  const rows = await dbQuery(`SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1`, [email]);
  return rows[0] || null;
}
function publicUser(row) {
  return {
    id: row.id,
    name: row.name || "",
    email: row.email,
    phone: row.phone || "",
    role: row.role || "customer",
    partnerCode: row.partner_code ?? null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : void 0
  };
}

// server/handlers/ai/assist.ts
function aiConfigured() {
  return !!(process.env.AI_VISION_URL || "").trim() && !!(process.env.AI_VISION_KEY || "").trim();
}
var assist_default = wrap(async (req, res) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!aiConfigured()) return sendJson(res, 200, { enabled: false });
  const b = await readJson(req);
  const image = String(b.imageDataUrl || b.image || "");
  if (!image) return sendJson(res, 400, { enabled: true, error: "Missing imageDataUrl" });
  try {
    const r = await fetch(String(process.env.AI_VISION_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_VISION_KEY}` },
      body: JSON.stringify({
        image,
        context: b.context || "building measurement",
        prompt: b.prompt || "Identify measurable building elements in this photo and estimate their dimensions in metres. Return JSON."
      })
    });
    const text = await r.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
    }
    if (!r.ok) return sendJson(res, 502, { enabled: true, error: `AI service responded ${r.status}`, raw: text.slice(0, 500) });
    return sendJson(res, 200, { enabled: true, result: parsed ?? text });
  } catch (e) {
    return sendJson(res, 502, { enabled: true, error: `AI service request failed: ${String(e?.message || e).slice(0, 200)}` });
  }
});

// server/handlers/health.ts
var health_default = wrap(async (_req, res) => {
  const db = isDbConfigured() ? await dbPing() : false;
  return sendJson(res, 200, { ok: true, db, auth: authConfigured(), payments: paystackEnabled(), ai: aiConfigured(), ts: (/* @__PURE__ */ new Date()).toISOString() });
});

// server/schema.sql.ts
var SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    email TEXT UNIQUE NOT NULL,
    phone TEXT DEFAULT '',
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer',
    partner_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS partners (
    code TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'pro',
    business_name TEXT NOT NULL DEFAULT '',
    contact_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT,
    location TEXT NOT NULL DEFAULT '',
    areas TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    verified BOOLEAN NOT NULL DEFAULT false,
    featured BOOLEAN NOT NULL DEFAULT false,
    featured_until TIMESTAMPTZ,
    sample BOOLEAN NOT NULL DEFAULT false,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS partners_status_idx ON partners (status)`,
  `CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    partner_code TEXT NOT NULL,
    partner_name TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'job',
    customer_name TEXT NOT NULL DEFAULT '',
    customer_phone TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    est_value_ngn INTEGER NOT NULL DEFAULT 0,
    commission_pct NUMERIC NOT NULL DEFAULT 5,
    commission_ngn INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS leads_partner_idx ON leads (partner_code)`,
  `CREATE TABLE IF NOT EXISTS bookings (
    code TEXT PRIMARY KEY,
    service TEXT NOT NULL DEFAULT '',
    service_label TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL DEFAULT '',
    slot TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    lga_state TEXT NOT NULL DEFAULT '',
    building_type TEXT NOT NULL DEFAULT '',
    stage TEXT NOT NULL DEFAULT '',
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    deposit_paid BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS bookings_phone_idx ON bookings (phone)`,
  `CREATE TABLE IF NOT EXISTS orders (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT,
    address TEXT NOT NULL DEFAULT '',
    note TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_ngn INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    paid BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS orders_phone_idx ON orders (phone)`,
  `CREATE TABLE IF NOT EXISTS quotes (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT,
    note TEXT,
    roof_type TEXT NOT NULL DEFAULT '',
    colour TEXT,
    area_m2 NUMERIC NOT NULL DEFAULT 0,
    estimate_ngn INTEGER NOT NULL DEFAULT 0,
    boq_summary TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    reference TEXT PRIMARY KEY,
    purpose TEXT NOT NULL DEFAULT '',
    ref_id TEXT,
    email TEXT,
    amount_kobo BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY,
    product_name TEXT NOT NULL DEFAULT '',
    price_ngn INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    audience TEXT NOT NULL DEFAULT 'all',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  // ---- Phase 6: jobs board + bidding (frontend shapes in src/lib/jobs.ts) ----
  `CREATE TABLE IF NOT EXISTS jobs (
    code TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    trade TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    budget_low BIGINT NOT NULL DEFAULT 0,
    budget_high BIGINT NOT NULL DEFAULT 0,
    customer_name TEXT NOT NULL DEFAULT '',
    customer_phone TEXT NOT NULL DEFAULT '',
    source_quote_code TEXT,
    status TEXT NOT NULL DEFAULT 'Open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status)`,
  `CREATE TABLE IF NOT EXISTS bids (
    id TEXT PRIMARY KEY,
    job_code TEXT NOT NULL,
    partner_code TEXT NOT NULL,
    partner_name TEXT NOT NULL DEFAULT '',
    amount BIGINT NOT NULL DEFAULT 0,
    days INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS bids_job_idx ON bids (job_code)`,
  `CREATE INDEX IF NOT EXISTS bids_partner_idx ON bids (partner_code)`,
  // ---- Phase 6: partner reviews (src/lib/reviews.ts) ----
  `CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    partner_code TEXT NOT NULL,
    customer_name TEXT NOT NULL DEFAULT '',
    rating INTEGER NOT NULL DEFAULT 5,
    text TEXT NOT NULL DEFAULT '',
    ref_code TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Published',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS reviews_partner_idx ON reviews (partner_code)`,
  // ---- Phase 6: notifications log (src/lib/notify.ts) ----
  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    audience TEXT NOT NULL DEFAULT 'admin',
    ref_code TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL DEFAULT 'inapp',
    template_key TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'logged',
    phone TEXT,
    email TEXT,
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS notifications_created_idx ON notifications (created_at DESC)`
];
var SCHEMA_SQL = SCHEMA_STATEMENTS.join(";\n") + ";";

// server/handlers/setup.ts
var setup_default = wrap(async (req, res) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const expected = process.env.SETUP_SECRET || "";
  const given = req.headers["x-setup-secret"] || "";
  if (!expected || given !== expected) return sendJson(res, 401, { error: "Invalid or missing x-setup-secret" });
  if (!isDbConfigured()) return sendJson(res, 503, { error: "DATABASE_URL is not set" });
  const done = [];
  for (const stmt of SCHEMA_STATEMENTS) {
    await dbQuery(stmt);
    done.push(stmt.replace(/\s+/g, " ").slice(0, 60));
  }
  return sendJson(res, 200, { ok: true, statementsApplied: done.length, tables: ["users", "partners", "leads", "bookings", "orders", "quotes", "payments", "settings", "offers", "jobs", "bids", "reviews", "notifications"] });
});

// server/handlers/auth/register.ts
var register_default = wrap(async (req, res) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured" });
  const b = await readJson(req);
  const name = String(b.name || "").trim();
  const email = String(b.email || "").trim().toLowerCase();
  const phone = String(b.phone || "").trim();
  const password = String(b.password || "");
  const partnerCode = b.partnerCode ? String(b.partnerCode).trim().toUpperCase() : null;
  if (name.length < 2) return sendJson(res, 400, { error: "Enter your full name" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { error: "Enter a valid email" });
  if (password.length < 8) return sendJson(res, 400, { error: "Password must be at least 8 characters" });
  if (await findUserByEmail(email)) return sendJson(res, 409, { error: "An account with this email already exists \u2014 sign in instead" });
  const role = partnerCode ? "partner" : "customer";
  const hash2 = await hashPassword(password);
  const rows = await dbQuery(
    `INSERT INTO users (name, email, phone, password_hash, role, partner_code) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [name, email, phone, hash2, role, partnerCode]
  );
  const user = publicUser(rows[0]);
  const token = await signSession(user);
  res.setHeader("Set-Cookie", sessionCookieHeader(token));
  return sendJson(res, 201, { user });
});

// server/handlers/auth/login.ts
var login_default = wrap(async (req, res) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const b = await readJson(req);
  const email = String(b.email || "").trim().toLowerCase();
  const password = String(b.password || "");
  if (isAdminBootstrap(email, password)) {
    const user2 = adminBootstrapUser();
    const token2 = await signSession(user2);
    res.setHeader("Set-Cookie", sessionCookieHeader(token2));
    return sendJson(res, 200, { user: user2 });
  }
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured" });
  const row = await findUserByEmail(email);
  if (!row || !await verifyPassword(password, row.password_hash)) {
    return sendJson(res, 401, { error: "Email or password is incorrect" });
  }
  const user = publicUser(row);
  const token = await signSession(user);
  res.setHeader("Set-Cookie", sessionCookieHeader(token));
  return sendJson(res, 200, { user });
});

// server/handlers/auth/logout.ts
var logout_default = wrap(async (_req, res) => {
  res.setHeader("Set-Cookie", clearCookieHeader());
  return sendJson(res, 200, { ok: true });
});

// server/handlers/auth/me.ts
var me_default = wrap(async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) return sendJson(res, 401, { user: null });
  return sendJson(res, 200, { user });
});

// server/records.ts
function partnerFromRow(r) {
  const d = typeof r.data === "string" ? JSON.parse(r.data || "{}") : r.data || {};
  return {
    ...d,
    code: r.code,
    role: r.role,
    businessName: r.business_name,
    contactName: r.contact_name,
    phone: r.phone,
    email: r.email ?? d.email,
    location: r.location,
    areas: r.areas,
    status: r.status,
    verified: !!r.verified,
    featured: !!r.featured,
    featuredUntil: r.featured_until ? new Date(r.featured_until).toISOString() : d.featuredUntil,
    sample: !!r.sample || d.sample || false,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : d.createdAt
  };
}
function leadFromRow(r) {
  return {
    id: r.id,
    partnerCode: r.partner_code,
    partnerName: r.partner_name,
    type: r.type,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    description: r.description,
    estValueNgn: Number(r.est_value_ngn) || 0,
    commissionPct: Number(r.commission_pct) || 0,
    commissionNgn: Number(r.commission_ngn) || 0,
    status: r.status,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : r.createdAt
  };
}
function bookingFromRow(r) {
  return {
    code: r.code,
    service: r.service,
    serviceLabel: r.service_label,
    date: r.date,
    slot: r.slot,
    name: r.name,
    phone: r.phone,
    address: r.address,
    lgaState: r.lga_state,
    buildingType: r.building_type,
    stage: r.stage,
    notes: r.notes ?? void 0,
    status: r.status,
    depositPaid: !!r.deposit_paid,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : r.createdAt
  };
}
function orderFromRow(r) {
  const items = typeof r.items === "string" ? JSON.parse(r.items || "[]") : r.items || [];
  return {
    code: r.code,
    name: r.name,
    phone: r.phone,
    email: r.email ?? void 0,
    address: r.address,
    note: r.note ?? void 0,
    items,
    totalNgn: Number(r.total_ngn) || 0,
    status: r.status,
    paid: !!r.paid,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : r.createdAt
  };
}
function quoteFromRow(r) {
  return {
    code: r.code,
    name: r.name,
    phone: r.phone,
    email: r.email ?? void 0,
    note: r.note ?? void 0,
    roofType: r.roof_type,
    colour: r.colour ?? void 0,
    areaM2: Number(r.area_m2) || 0,
    estimateNgn: Number(r.estimate_ngn) || 0,
    boqSummary: r.boq_summary ?? void 0,
    status: r.status,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : r.createdAt
  };
}
function jobFromRow(r, opts = {}) {
  return {
    code: r.code,
    title: r.title,
    trade: r.trade,
    description: r.description,
    location: r.location,
    budgetLow: Number(r.budget_low) || 0,
    budgetHigh: Number(r.budget_high) || 0,
    customerName: r.customer_name,
    customerPhone: opts.publicSafe ? "" : r.customer_phone,
    sourceQuoteCode: r.source_quote_code ?? void 0,
    status: r.status,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : r.createdAt
  };
}
function bidFromRow(r) {
  return {
    id: r.id,
    jobCode: r.job_code,
    partnerCode: r.partner_code,
    partnerName: r.partner_name,
    amount: Number(r.amount) || 0,
    days: Number(r.days) || 0,
    note: r.note,
    status: r.status,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : r.createdAt
  };
}
function reviewFromRow(r) {
  return {
    id: r.id,
    partnerCode: r.partner_code,
    customerName: r.customer_name,
    rating: Number(r.rating) || 0,
    text: r.text,
    refCode: r.ref_code,
    status: r.status,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : r.createdAt
  };
}
function notificationFromRow(r) {
  return {
    id: r.id,
    ts: r.created_at ? new Date(r.created_at).toISOString() : r.createdAt,
    audience: r.audience,
    refCode: r.ref_code,
    channel: r.channel,
    templateKey: r.template_key,
    message: r.message,
    status: r.status,
    phone: r.phone ?? void 0,
    email: r.email ?? void 0,
    detail: r.detail ?? void 0
  };
}
function offerFromRow(r) {
  return {
    id: r.id,
    productName: r.product_name,
    priceNgn: Number(r.price_ngn) || 0,
    unit: r.unit,
    note: r.note,
    audience: r.audience,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : r.createdAt
  };
}

// server/handlers/partners.ts
var partners_default = wrap(async (req, res) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "GET") {
    const rows = await dbQuery(`SELECT * FROM partners WHERE status = 'approved' ORDER BY featured DESC, verified DESC, created_at DESC`);
    return sendJson(res, 200, { partners: rows.map(partnerFromRow) });
  }
  if (req.method === "POST") {
    const p = await readJson(req);
    const code = String(p.code || "").trim().toUpperCase();
    if (!code || String(p.businessName || "").trim().length < 2) return sendJson(res, 400, { error: "Missing partner code or business name" });
    if (String(p.phone || "").replace(/\D/g, "").length < 10) return sendJson(res, 400, { error: "Enter a valid phone number" });
    const existing = await dbQuery(`SELECT code FROM partners WHERE code = $1`, [code]);
    if (existing.length) return sendJson(res, 409, { error: "Partner code already exists" });
    const data = { ...p };
    delete data.code;
    const rows = await dbQuery(
      `INSERT INTO partners (code, role, business_name, contact_name, phone, email, location, areas, status, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9::jsonb) RETURNING *`,
      [code, p.role === "seller" ? "seller" : "pro", p.businessName, p.contactName || "", p.phone, p.email || null, p.location || "", p.areas || "", JSON.stringify(data)]
    );
    return sendJson(res, 201, { partner: partnerFromRow(rows[0]) });
  }
  return methodNotAllowed(res, ["GET", "POST"]);
});

// server/handlers/partners/[code].ts
var code_default = wrap(async (req, res) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  const code = String(req.query?.code || "").trim().toUpperCase();
  const rows = await dbQuery(`SELECT * FROM partners WHERE code = $1`, [code]);
  if (!rows.length) return sendJson(res, 404, { error: "Partner not found" });
  return sendJson(res, 200, { partner: partnerFromRow(rows[0]) });
});

// server/handlers/admin/partners.ts
var partners_default2 = wrap(async (req, res) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (!await isAdmin(req)) return sendJson(res, 401, { error: "Admin session required" });
  if (req.method === "GET") {
    const rows = await dbQuery(`SELECT * FROM partners ORDER BY created_at DESC`);
    return sendJson(res, 200, { partners: rows.map(partnerFromRow) });
  }
  if (req.method === "PATCH") {
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    if (!code) return sendJson(res, 400, { error: "Missing partner code" });
    const sets = [];
    const vals = [];
    if (typeof b.status === "string" && ["pending", "approved", "rejected"].includes(b.status)) {
      vals.push(b.status);
      sets.push(`status = $${vals.length}`);
    }
    if (typeof b.verified === "boolean") {
      vals.push(b.verified);
      sets.push(`verified = $${vals.length}`);
    }
    if (typeof b.featured === "boolean") {
      vals.push(b.featured);
      sets.push(`featured = $${vals.length}`);
      if (!b.featured) sets.push(`featured_until = NULL`);
    }
    if (!sets.length) return sendJson(res, 400, { error: "Nothing to update" });
    vals.push(code);
    const rows = await dbQuery(`UPDATE partners SET ${sets.join(", ")} WHERE code = $${vals.length} RETURNING *`, vals);
    if (!rows.length) return sendJson(res, 404, { error: "Partner not found" });
    return sendJson(res, 200, { partner: partnerFromRow(rows[0]) });
  }
  return methodNotAllowed(res, ["GET", "PATCH"]);
});

// server/siteSettings.ts
var DEFAULT_PARTNER_TERMS = { referralCommissionPct: 5, verificationFeeNgn: 15e3, featuredFeeNgn: 2e4 };
async function getSiteSettings() {
  const rows = await dbQuery(`SELECT value FROM settings WHERE key = 'site' LIMIT 1`);
  if (!rows.length) return null;
  const v = rows[0].value;
  return typeof v === "string" ? JSON.parse(v || "{}") : v;
}
async function getServerPartnerTerms() {
  try {
    const s = await getSiteSettings();
    const t = s?.partnerTerms || {};
    const num = (v, d) => typeof v === "number" && Number.isFinite(v) ? v : d;
    return {
      referralCommissionPct: num(t.referralCommissionPct, DEFAULT_PARTNER_TERMS.referralCommissionPct),
      verificationFeeNgn: num(t.verificationFeeNgn, DEFAULT_PARTNER_TERMS.verificationFeeNgn),
      featuredFeeNgn: num(t.featuredFeeNgn, DEFAULT_PARTNER_TERMS.featuredFeeNgn)
    };
  } catch {
    return { ...DEFAULT_PARTNER_TERMS };
  }
}
function commissionForValue(estValueNgn, pct) {
  return Math.round(Math.max(0, estValueNgn || 0) * pct / 100);
}

// server/handlers/leads.ts
var leads_default = wrap(async (req, res) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "POST") {
    const b = await readJson(req);
    const partnerCode = String(b.partnerCode || "").trim().toUpperCase();
    if (!partnerCode || String(b.customerName || "").trim().length < 2) return sendJson(res, 400, { error: "Missing partner or customer name" });
    const prow = await dbQuery(`SELECT business_name FROM partners WHERE code = $1`, [partnerCode]);
    if (!prow.length) return sendJson(res, 404, { error: "Partner not found" });
    const est = Math.max(0, Math.round(Number(b.estValueNgn) || 0));
    const terms = await getServerPartnerTerms();
    const id = `LED-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const rows = await dbQuery(
      `INSERT INTO leads (id, partner_code, partner_name, type, customer_name, customer_phone, description, est_value_ngn, commission_pct, commission_ngn, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'new') RETURNING *`,
      [id, partnerCode, prow[0].business_name, b.type === "supply" ? "supply" : "job", b.customerName, b.customerPhone || "", b.description || "", est, terms.referralCommissionPct, commissionForValue(est, terms.referralCommissionPct)]
    );
    return sendJson(res, 201, { lead: leadFromRow(rows[0]) });
  }
  if (req.method === "GET") {
    const partnerCode = String(req.query?.partnerCode || "").trim().toUpperCase();
    if (partnerCode) {
      const rows2 = await dbQuery(`SELECT * FROM leads WHERE partner_code = $1 ORDER BY created_at DESC`, [partnerCode]);
      return sendJson(res, 200, { leads: rows2.map(leadFromRow) });
    }
    if (!await isAdmin(req)) return sendJson(res, 401, { error: "Admin session required" });
    const rows = await dbQuery(`SELECT * FROM leads ORDER BY created_at DESC LIMIT 500`);
    return sendJson(res, 200, { leads: rows.map(leadFromRow) });
  }
  if (req.method === "PATCH" || req.method === "DELETE") {
    if (!await isAdmin(req)) return sendJson(res, 401, { error: "Admin session required" });
    if (req.method === "DELETE") {
      const id = String(req.query?.id || "");
      if (!id) return sendJson(res, 400, { error: "Missing lead id" });
      await dbQuery(`DELETE FROM leads WHERE id = $1`, [id]);
      return sendJson(res, 200, { ok: true });
    }
    const b = await readJson(req);
    if (!b.id || !["new", "contacted", "won", "paid", "lost"].includes(b.status)) return sendJson(res, 400, { error: "Missing id or bad status" });
    const rows = await dbQuery(`UPDATE leads SET status = $1 WHERE id = $2 RETURNING *`, [b.status, b.id]);
    if (!rows.length) return sendJson(res, 404, { error: "Lead not found" });
    return sendJson(res, 200, { lead: leadFromRow(rows[0]) });
  }
  return methodNotAllowed(res, ["GET", "POST", "PATCH", "DELETE"]);
});

// server/handlers/bookings.ts
var bookings_default = wrap(async (req, res) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "POST") {
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    if (!code || String(b.name || "").trim().length < 2) return sendJson(res, 400, { error: "Missing booking code or name" });
    const rows = await dbQuery(
      `INSERT INTO bookings (code, service, service_label, date, slot, name, phone, address, lga_state, building_type, stage, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending') RETURNING *`,
      [code, b.service || "", b.serviceLabel || "", b.date || "", b.slot || "", b.name, b.phone || "", b.address || "", b.lgaState || "", b.buildingType || "", b.stage || "", b.notes || null]
    );
    return sendJson(res, 201, { booking: bookingFromRow(rows[0]) });
  }
  if (req.method === "GET") {
    const code = String(req.query?.code || "").trim().toUpperCase();
    const phone = String(req.query?.phone || "").replace(/\D/g, "");
    if (code) {
      const rows2 = await dbQuery(`SELECT * FROM bookings WHERE code = $1`, [code]);
      return sendJson(res, 200, { bookings: rows2.map(bookingFromRow) });
    }
    if (phone) {
      const rows2 = await dbQuery(`SELECT * FROM bookings WHERE regexp_replace(phone, '[^0-9]', '', 'g') LIKE '%' || $1 ORDER BY created_at DESC`, [phone.slice(-10)]);
      return sendJson(res, 200, { bookings: rows2.map(bookingFromRow) });
    }
    if (!await isAdmin(req)) return sendJson(res, 401, { error: "Admin session required" });
    const rows = await dbQuery(`SELECT * FROM bookings ORDER BY created_at DESC LIMIT 500`);
    return sendJson(res, 200, { bookings: rows.map(bookingFromRow) });
  }
  if (req.method === "PATCH") {
    if (!await isAdmin(req)) return sendJson(res, 401, { error: "Admin session required" });
    const b = await readJson(req);
    if (!b.code || !["pending", "confirmed", "scheduled", "completed", "cancelled"].includes(b.status)) return sendJson(res, 400, { error: "Missing code or bad status" });
    const rows = await dbQuery(`UPDATE bookings SET status = $1 WHERE code = $2 RETURNING *`, [b.status, String(b.code).toUpperCase()]);
    if (!rows.length) return sendJson(res, 404, { error: "Booking not found" });
    return sendJson(res, 200, { booking: bookingFromRow(rows[0]) });
  }
  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
});

// server/handlers/orders.ts
var orders_default = wrap(async (req, res) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "POST") {
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    if (!code || String(b.name || "").trim().length < 2) return sendJson(res, 400, { error: "Missing order code or name" });
    const items = Array.isArray(b.items) ? b.items : [];
    const total = Math.round(Number(b.totalNgn) || items.reduce((s, i) => s + (Number(i.lineTotalNgn) || 0), 0));
    const rows = await dbQuery(
      `INSERT INTO orders (code, name, phone, email, address, note, items, total_ngn, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'pending') RETURNING *`,
      [code, b.name, b.phone || "", b.email || null, b.address || "", b.note || null, JSON.stringify(items), total]
    );
    return sendJson(res, 201, { order: orderFromRow(rows[0]) });
  }
  if (req.method === "GET") {
    const code = String(req.query?.code || "").trim().toUpperCase();
    const phone = String(req.query?.phone || "").replace(/\D/g, "");
    if (code) {
      const rows2 = await dbQuery(`SELECT * FROM orders WHERE code = $1`, [code]);
      return sendJson(res, 200, { orders: rows2.map(orderFromRow) });
    }
    if (phone) {
      const rows2 = await dbQuery(`SELECT * FROM orders WHERE regexp_replace(phone, '[^0-9]', '', 'g') LIKE '%' || $1 ORDER BY created_at DESC`, [phone.slice(-10)]);
      return sendJson(res, 200, { orders: rows2.map(orderFromRow) });
    }
    if (!await isAdmin(req)) return sendJson(res, 401, { error: "Admin session required" });
    const rows = await dbQuery(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 500`);
    return sendJson(res, 200, { orders: rows.map(orderFromRow) });
  }
  if (req.method === "PATCH") {
    if (!await isAdmin(req)) return sendJson(res, 401, { error: "Admin session required" });
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    if (!code) return sendJson(res, 400, { error: "Missing order code" });
    const sets = [];
    const vals = [];
    if (typeof b.status === "string" && ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"].includes(b.status)) {
      vals.push(b.status);
      sets.push(`status = $${vals.length}`);
    }
    if (typeof b.paid === "boolean") {
      vals.push(b.paid);
      sets.push(`paid = $${vals.length}`);
    }
    if (!sets.length) return sendJson(res, 400, { error: "Nothing to update" });
    vals.push(code);
    const rows = await dbQuery(`UPDATE orders SET ${sets.join(", ")} WHERE code = $${vals.length} RETURNING *`, vals);
    if (!rows.length) return sendJson(res, 404, { error: "Order not found" });
    return sendJson(res, 200, { order: orderFromRow(rows[0]) });
  }
  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
});

// server/handlers/quotes.ts
var quotes_default = wrap(async (req, res) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "POST") {
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    if (!code || String(b.name || "").trim().length < 2) return sendJson(res, 400, { error: "Missing quote code or name" });
    const rows = await dbQuery(
      `INSERT INTO quotes (code, name, phone, email, note, roof_type, colour, area_m2, estimate_ngn, boq_summary, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'new') RETURNING *`,
      [code, b.name, b.phone || "", b.email || null, b.note || null, b.roofType || "", b.colour || null, Number(b.areaM2) || 0, Math.round(Number(b.estimateNgn) || 0), b.boqSummary || null]
    );
    return sendJson(res, 201, { quote: quoteFromRow(rows[0]) });
  }
  if (req.method === "GET") {
    if (!await isAdmin(req)) return sendJson(res, 401, { error: "Admin session required" });
    const rows = await dbQuery(`SELECT * FROM quotes ORDER BY created_at DESC LIMIT 500`);
    return sendJson(res, 200, { quotes: rows.map(quoteFromRow) });
  }
  return methodNotAllowed(res, ["GET", "POST"]);
});

// server/handlers/settings.ts
var settings_default = wrap(async (req, res) => {
  if (req.method === "GET") {
    if (!isDbConfigured()) return sendJson(res, 200, { live: false, settings: null });
    const settings = await getSiteSettings();
    return sendJson(res, 200, { live: true, settings });
  }
  if (req.method === "PUT") {
    if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
    if (!await isAdmin(req)) return sendJson(res, 401, { error: "Admin session required" });
    const b = await readJson(req);
    const value = {
      partnerTerms: b.partnerTerms || void 0,
      rates: b.rates || void 0,
      business: b.business || void 0,
      plans: b.plans || void 0,
      coupons: b.coupons || void 0,
      promoBanner: b.promoBanner || void 0,
      priceWatch: b.priceWatch || void 0
    };
    await dbQuery(
      `INSERT INTO settings (key, value, updated_at) VALUES ('site', $1::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [JSON.stringify(value)]
    );
    return sendJson(res, 200, { ok: true, settings: value });
  }
  return methodNotAllowed(res, ["GET", "PUT"]);
});

// server/handlers/offers.ts
var offers_default = wrap(async (req, res) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "GET") {
    const rows = await dbQuery(`SELECT * FROM offers ORDER BY created_at DESC LIMIT 200`);
    return sendJson(res, 200, { offers: rows.map(offerFromRow) });
  }
  if (!await isAdmin(req)) return sendJson(res, 401, { error: "Admin session required" });
  if (req.method === "POST") {
    const b = await readJson(req);
    if (String(b.productName || "").trim().length < 2) return sendJson(res, 400, { error: "Missing product name" });
    const id = `OFF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const rows = await dbQuery(
      `INSERT INTO offers (id, product_name, price_ngn, unit, note, audience) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, b.productName, Math.round(Number(b.priceNgn) || 0), b.unit || "per piece", b.note || "", ["all", "pros", "sellers"].includes(b.audience) ? b.audience : "all"]
    );
    return sendJson(res, 201, { offer: offerFromRow(rows[0]) });
  }
  if (req.method === "DELETE") {
    const id = String(req.query?.id || "");
    if (!id) return sendJson(res, 400, { error: "Missing offer id" });
    await dbQuery(`DELETE FROM offers WHERE id = $1`, [id]);
    return sendJson(res, 200, { ok: true });
  }
  return methodNotAllowed(res, ["GET", "POST", "DELETE"]);
});

// server/handlers/payments/initialize.ts
var PURPOSES = ["partner_verification", "partner_featured", "order", "booking_deposit", "generic"];
var initialize_default = wrap(async (req, res) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!paystackEnabled()) return sendJson(res, 200, { enabled: false, reason: "PAYSTACK_SECRET_KEY is not set" });
  if (!isDbConfigured()) return sendJson(res, 503, { enabled: true, error: "Database not configured" });
  const b = await readJson(req);
  const email = String(b.email || "").trim();
  const amountNgn = Number(b.amountNgn) || 0;
  const purpose = PURPOSES.includes(b.purpose) ? b.purpose : "generic";
  const refId = b.refId ? String(b.refId) : null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { error: "A valid email is required for Paystack receipts" });
  if (amountNgn < 50) return sendJson(res, 400, { error: "Amount must be at least \u20A650" });
  const reference = genReference("OKX");
  const amountKobo = Math.round(amountNgn * 100);
  const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : "");
  const callbackUrl = b.callbackUrl || (origin ? `${origin}/payment/return?reference=${reference}` : void 0);
  await dbQuery(
    `INSERT INTO payments (reference, purpose, ref_id, email, amount_kobo, status) VALUES ($1,$2,$3,$4,$5,'pending')`,
    [reference, purpose, refId, email, amountKobo]
  );
  try {
    const data = await initializeTransaction({ email, amountKobo, reference, callbackUrl, metadata: { purpose, refId } });
    return sendJson(res, 200, { enabled: true, authorizationUrl: data.authorization_url, reference });
  } catch (err) {
    await dbQuery(`UPDATE payments SET status = 'failed' WHERE reference = $1`, [reference]);
    return sendJson(res, 502, { enabled: true, error: String(err?.message || err) });
  }
});

// server/handlers/payments/webhook.ts
var webhook_default = wrap(async (req, res) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!paystackEnabled() || !isDbConfigured()) return sendJson(res, 200, { received: true, ignored: "payments not configured" });
  const raw = await readRawBody(req);
  const signature = req.headers["x-paystack-signature"];
  if (!verifyPaystackSignature(raw, signature)) return sendJson(res, 401, { error: "Invalid signature" });
  let event = {};
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    return sendJson(res, 400, { error: "Bad JSON" });
  }
  if (event.event === "charge.success") {
    const ref = event.data?.reference;
    if (ref) {
      const rows = await dbQuery(`SELECT amount_kobo, status FROM payments WHERE reference = $1`, [ref]);
      if (rows.length && Number(event.data.amount) === Number(rows[0].amount_kobo)) {
        await applyPaymentEffect(ref);
      }
    }
  }
  return sendJson(res, 200, { received: true });
});

// server/handlers/jobs.ts
var JOB_STATUSES = ["Open", "Awarded", "In Progress", "Completed", "Closed"];
var jobs_default = wrap(async (req, res) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "POST") {
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    if (!code || String(b.title || "").trim().length < 3) return sendJson(res, 400, { error: "Missing job code or title" });
    if (String(b.customerName || "").trim().length < 2) return sendJson(res, 400, { error: "Missing customer name" });
    if (String(b.customerPhone || "").replace(/\D/g, "").length < 10) return sendJson(res, 400, { error: "Missing customer phone" });
    const rows = await dbQuery(
      `INSERT INTO jobs (code, title, trade, description, location, budget_low, budget_high, customer_name, customer_phone, source_quote_code, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Open') RETURNING *`,
      [
        code,
        b.title,
        b.trade || "General",
        b.description || "",
        b.location || "",
        Math.max(0, Math.round(Number(b.budgetLow) || 0)),
        Math.max(0, Math.round(Number(b.budgetHigh) || 0)),
        b.customerName,
        b.customerPhone,
        b.sourceQuoteCode || null
      ]
    );
    return sendJson(res, 201, { job: jobFromRow(rows[0]) });
  }
  if (req.method === "GET") {
    const code = String(req.query?.code || "").trim().toUpperCase();
    const phone = String(req.query?.phone || "").replace(/\D/g, "");
    if (code) {
      const rows2 = await dbQuery(`SELECT * FROM jobs WHERE code = $1`, [code]);
      if (!rows2.length) return sendJson(res, 404, { error: "Job not found" });
      const ownPhone = phone && rows2[0].customer_phone.replace(/\D/g, "").endsWith(phone.slice(-10));
      const full = ownPhone || await isAdmin(req);
      const bids = await dbQuery(`SELECT * FROM bids WHERE job_code = $1 ORDER BY created_at ASC`, [code]);
      return sendJson(res, 200, { job: jobFromRow(rows2[0], { publicSafe: !full }), bids: bids.map(bidFromRow) });
    }
    if (phone) {
      const rows2 = await dbQuery(`SELECT * FROM jobs WHERE regexp_replace(customer_phone, '[^0-9]', '', 'g') LIKE '%' || $1 ORDER BY created_at DESC`, [phone.slice(-10)]);
      return sendJson(res, 200, { jobs: rows2.map((r) => jobFromRow(r)) });
    }
    if (await isAdmin(req) && String(req.query?.all || "") === "1") {
      const rows2 = await dbQuery(`SELECT * FROM jobs ORDER BY created_at DESC LIMIT 500`);
      return sendJson(res, 200, { jobs: rows2.map((r) => jobFromRow(r)) });
    }
    const rows = await dbQuery(`SELECT * FROM jobs WHERE status = 'Open' ORDER BY created_at DESC LIMIT 200`);
    const counts = await dbQuery(`SELECT job_code, COUNT(*)::int AS n FROM bids GROUP BY job_code`);
    const countMap = new Map(counts.map((c) => [c.job_code, Number(c.n)]));
    return sendJson(res, 200, { jobs: rows.map((r) => ({ ...jobFromRow(r, { publicSafe: true }), bidsCount: countMap.get(r.code) || 0 })) });
  }
  if (req.method === "PATCH") {
    if (!await isAdmin(req)) return sendJson(res, 401, { error: "Admin session required" });
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    if (!code || !JOB_STATUSES.includes(b.status)) return sendJson(res, 400, { error: "Missing code or bad status" });
    const rows = await dbQuery(`UPDATE jobs SET status = $1 WHERE code = $2 RETURNING *`, [b.status, code]);
    if (!rows.length) return sendJson(res, 404, { error: "Job not found" });
    return sendJson(res, 200, { job: jobFromRow(rows[0]) });
  }
  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
});

// server/handlers/jobs/bid.ts
var bid_default = wrap(async (req, res) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "GET") {
    const jobCode = String(req.query?.jobCode || "").trim().toUpperCase();
    const partnerCode = String(req.query?.partnerCode || "").trim().toUpperCase();
    if (jobCode) {
      const rows = await dbQuery(`SELECT * FROM bids WHERE job_code = $1 ORDER BY created_at ASC`, [jobCode]);
      return sendJson(res, 200, { bids: rows.map(bidFromRow) });
    }
    if (partnerCode) {
      const rows = await dbQuery(`SELECT * FROM bids WHERE partner_code = $1 ORDER BY created_at DESC`, [partnerCode]);
      return sendJson(res, 200, { bids: rows.map(bidFromRow) });
    }
    return sendJson(res, 400, { error: "Pass jobCode or partnerCode" });
  }
  if (req.method === "POST") {
    const b = await readJson(req);
    const jobCode = String(b.jobCode || "").trim().toUpperCase();
    const partnerCode = String(b.partnerCode || "").trim().toUpperCase();
    const amount = Math.round(Number(b.amount) || 0);
    if (!jobCode || !partnerCode || amount <= 0) return sendJson(res, 400, { error: "Missing job, partner or bid amount" });
    const jrows = await dbQuery(`SELECT status FROM jobs WHERE code = $1`, [jobCode]);
    if (!jrows.length) return sendJson(res, 404, { error: "Job not found" });
    if (jrows[0].status !== "Open") return sendJson(res, 409, { error: "Job is not open for bids" });
    const prow = await dbQuery(`SELECT business_name, status FROM partners WHERE code = $1`, [partnerCode]);
    if (!prow.length) return sendJson(res, 404, { error: "Partner not found" });
    if (prow[0].status !== "approved") return sendJson(res, 403, { error: "Only approved partners can bid" });
    const days = Math.max(0, Math.round(Number(b.days) || 0));
    const existing = await dbQuery(`SELECT * FROM bids WHERE job_code = $1 AND partner_code = $2 AND status = 'Pending'`, [jobCode, partnerCode]);
    if (existing.length) {
      const rows2 = await dbQuery(
        `UPDATE bids SET amount = $1, days = $2, note = $3 WHERE id = $4 RETURNING *`,
        [amount, days, b.note || "", existing[0].id]
      );
      return sendJson(res, 200, { bid: bidFromRow(rows2[0]), updated: true });
    }
    const id = `BID-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const rows = await dbQuery(
      `INSERT INTO bids (id, job_code, partner_code, partner_name, amount, days, note, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Pending') RETURNING *`,
      [id, jobCode, partnerCode, prow[0].business_name, amount, days, b.note || ""]
    );
    return sendJson(res, 201, { bid: bidFromRow(rows[0]) });
  }
  return methodNotAllowed(res, ["GET", "POST"]);
});

// server/handlers/jobs/award.ts
var award_default = wrap(async (req, res) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const b = await readJson(req);
  const jobCode = String(b.jobCode || "").trim().toUpperCase();
  const bidId = String(b.bidId || "").trim();
  if (!jobCode || !bidId) return sendJson(res, 400, { error: "Missing jobCode or bidId" });
  const jrows = await dbQuery(`SELECT * FROM jobs WHERE code = $1`, [jobCode]);
  if (!jrows.length) return sendJson(res, 404, { error: "Job not found" });
  const job = jrows[0];
  if (job.status !== "Open") return sendJson(res, 409, { error: "Job is not open" });
  const brows = await dbQuery(`SELECT * FROM bids WHERE id = $1 AND job_code = $2`, [bidId, jobCode]);
  if (!brows.length) return sendJson(res, 404, { error: "Bid not found for this job" });
  const bid = brows[0];
  if (bid.status !== "Pending") return sendJson(res, 409, { error: "Bid is not pending" });
  await dbQuery(`UPDATE bids SET status = 'Rejected' WHERE job_code = $1 AND status = 'Pending' AND id <> $2`, [jobCode, bidId]);
  const winRows = await dbQuery(`UPDATE bids SET status = 'Accepted' WHERE id = $1 RETURNING *`, [bidId]);
  const jobRows = await dbQuery(`UPDATE jobs SET status = 'Awarded' WHERE code = $1 RETURNING *`, [jobCode]);
  const terms = await getServerPartnerTerms();
  const est = Math.max(0, Math.round(Number(bid.amount) || 0));
  const leadId = `LED-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const leadRows = await dbQuery(
    `INSERT INTO leads (id, partner_code, partner_name, type, customer_name, customer_phone, description, est_value_ngn, commission_pct, commission_ngn, status)
     VALUES ($1,$2,$3,'job',$4,$5,$6,$7,$8,$9,'new') RETURNING *`,
    [
      leadId,
      bid.partner_code,
      bid.partner_name,
      job.customer_name,
      job.customer_phone,
      `Won bid on job ${jobCode} \u2014 ${job.title}`,
      est,
      terms.referralCommissionPct,
      commissionForValue(est, terms.referralCommissionPct)
    ]
  );
  const allBids = await dbQuery(`SELECT * FROM bids WHERE job_code = $1 ORDER BY created_at ASC`, [jobCode]);
  return sendJson(res, 200, { job: jobFromRow(jobRows[0]), bids: allBids.map(bidFromRow), bid: bidFromRow(winRows[0]), lead: leadFromRow(leadRows[0]) });
});

// server/handlers/reviews.ts
var reviews_default = wrap(async (req, res) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "POST") {
    const b = await readJson(req);
    const partnerCode = String(b.partnerCode || "").trim().toUpperCase();
    const rating = Math.round(Number(b.rating) || 0);
    if (!partnerCode) return sendJson(res, 400, { error: "Missing partner code" });
    if (String(b.customerName || "").trim().length < 2) return sendJson(res, 400, { error: "Missing your name" });
    if (rating < 1 || rating > 5) return sendJson(res, 400, { error: "Rating must be 1\u20135" });
    if (String(b.refCode || "").trim().length < 3) return sendJson(res, 400, { error: "A reference code (lead, order or job) is required" });
    const prow = await dbQuery(`SELECT code FROM partners WHERE code = $1`, [partnerCode]);
    if (!prow.length) return sendJson(res, 404, { error: "Partner not found" });
    const id = `REV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const rows = await dbQuery(
      `INSERT INTO reviews (id, partner_code, customer_name, rating, text, ref_code, status)
       VALUES ($1,$2,$3,$4,$5,$6,'Published') RETURNING *`,
      [id, partnerCode, b.customerName, rating, b.text || "", String(b.refCode).trim().toUpperCase()]
    );
    return sendJson(res, 201, { review: reviewFromRow(rows[0]) });
  }
  if (req.method === "GET") {
    const partnerCode = String(req.query?.partnerCode || "").trim().toUpperCase();
    if (partnerCode) {
      const rows2 = await dbQuery(`SELECT * FROM reviews WHERE partner_code = $1 AND status = 'Published' ORDER BY created_at DESC LIMIT 200`, [partnerCode]);
      const reviews = rows2.map(reviewFromRow);
      const count = reviews.length;
      const avg = count ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / count * 10) / 10 : 0;
      return sendJson(res, 200, { reviews, summary: { avg, count } });
    }
    if (String(req.query?.all || "") === "published") {
      const rows2 = await dbQuery(`SELECT * FROM reviews WHERE status = 'Published' ORDER BY created_at DESC LIMIT 1000`);
      return sendJson(res, 200, { reviews: rows2.map(reviewFromRow) });
    }
    if (!await isAdmin(req)) return sendJson(res, 401, { error: "Admin session required" });
    const rows = await dbQuery(`SELECT * FROM reviews ORDER BY created_at DESC LIMIT 500`);
    return sendJson(res, 200, { reviews: rows.map(reviewFromRow) });
  }
  if (req.method === "PATCH" || req.method === "DELETE") {
    if (!await isAdmin(req)) return sendJson(res, 401, { error: "Admin session required" });
    if (req.method === "DELETE") {
      const id = String(req.query?.id || "");
      if (!id) return sendJson(res, 400, { error: "Missing review id" });
      await dbQuery(`DELETE FROM reviews WHERE id = $1`, [id]);
      return sendJson(res, 200, { ok: true });
    }
    const b = await readJson(req);
    if (!b.id || !["Published", "Hidden"].includes(b.status)) return sendJson(res, 400, { error: "Missing id or bad status" });
    const rows = await dbQuery(`UPDATE reviews SET status = $1 WHERE id = $2 RETURNING *`, [b.status, b.id]);
    if (!rows.length) return sendJson(res, 404, { error: "Review not found" });
    return sendJson(res, 200, { review: reviewFromRow(rows[0]) });
  }
  return methodNotAllowed(res, ["GET", "POST", "PATCH", "DELETE"]);
});

// server/handlers/notifications.ts
var AUDIENCES = ["admin", "customer", "partner"];
var CHANNELS = ["whatsapp", "sms", "email", "inapp"];
var STATUSES = ["queued", "sent", "logged"];
var notifications_default = wrap(async (req, res) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "POST") {
    const b = await readJson(req);
    if (String(b.message || "").trim().length < 3) return sendJson(res, 400, { error: "Missing message" });
    const id = /^NTF-[A-Z0-9-]{4,}$/i.test(String(b.id || "")) ? String(b.id).toUpperCase() : `NTF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const status = STATUSES.includes(b.status) ? b.status : "logged";
    const rows = await dbQuery(
      `INSERT INTO notifications (id, audience, ref_code, channel, template_key, message, status, phone, email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
       RETURNING *`,
      [
        id,
        AUDIENCES.includes(b.audience) ? b.audience : "admin",
        b.refCode || "",
        CHANNELS.includes(b.channel) ? b.channel : "inapp",
        b.templateKey || "",
        b.message,
        status,
        b.phone || null,
        b.email || null
      ]
    );
    return sendJson(res, 201, { notification: notificationFromRow(rows[0]) });
  }
  if (req.method === "GET") {
    if (!await isAdmin(req)) return sendJson(res, 401, { error: "Admin session required" });
    const rows = await dbQuery(`SELECT * FROM notifications ORDER BY created_at DESC LIMIT 500`);
    return sendJson(res, 200, { notifications: rows.map(notificationFromRow) });
  }
  if (req.method === "PATCH") {
    if (!await isAdmin(req)) return sendJson(res, 401, { error: "Admin session required" });
    const b = await readJson(req);
    if (!b.id || !STATUSES.includes(b.status)) return sendJson(res, 400, { error: "Missing id or bad status" });
    const rows = await dbQuery(`UPDATE notifications SET status = $1 WHERE id = $2 RETURNING *`, [b.status, b.id]);
    if (!rows.length) return sendJson(res, 404, { error: "Notification not found" });
    return sendJson(res, 200, { notification: notificationFromRow(rows[0]) });
  }
  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
});

// server/handlers/notifications/dispatch.ts
function smsConfigured() {
  return !!(process.env.TERMII_API_KEY || "").trim();
}
function emailConfigured() {
  return !!(process.env.RESEND_API_KEY || "").trim();
}
async function sendSms(rec) {
  const to = String(rec.phone || "").replace(/\D/g, "");
  if (!to) return { ok: false, detail: "No phone number on the record" };
  try {
    const r = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        from: process.env.TERMII_SENDER_ID || "Oketex",
        sms: rec.message,
        type: "plain",
        channel: "generic",
        api_key: process.env.TERMII_API_KEY
      })
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && (j.code === "ok" || j.message_id || j.messageId)) return { ok: true, detail: `Termii accepted (${j.message_id || j.messageId || "ok"})` };
    return { ok: false, detail: `Termii responded ${r.status}: ${String(j.message || j.detail || "").slice(0, 160)}` };
  } catch (e) {
    return { ok: false, detail: `Termii request failed: ${String(e?.message || e).slice(0, 160)}` };
  }
}
async function sendEmail(rec) {
  const to = String(rec.email || "").trim();
  if (!to) return { ok: false, detail: "No email address on the record" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Oketex <onboarding@resend.dev>",
        to,
        subject: `Oketex & Sons \u2014 update on ${rec.ref_code || "your request"}`,
        text: rec.message
      })
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.id) return { ok: true, detail: `Resend accepted (${j.id})` };
    return { ok: false, detail: `Resend responded ${r.status}: ${String(j.message || "").slice(0, 160)}` };
  } catch (e) {
    return { ok: false, detail: `Resend request failed: ${String(e?.message || e).slice(0, 160)}` };
  }
}
var dispatch_default = wrap(async (req, res) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!await isAdmin(req)) return sendJson(res, 401, { error: "Admin session required" });
  const sms = smsConfigured(), email = emailConfigured();
  if (!sms && !email) {
    return sendJson(res, 200, { enabled: false, sms, email, attempted: 0, sent: 0, results: [], note: "No provider keys configured (TERMII_API_KEY / RESEND_API_KEY) \u2014 records stay logged." });
  }
  const b = await readJson(req);
  const ids = Array.isArray(b.ids) ? b.ids.map((x) => String(x)) : [];
  const rows = ids.length ? await dbQuery(`SELECT * FROM notifications WHERE id = ANY($1) AND channel IN ('sms','email') AND status <> 'sent'`, [ids]) : await dbQuery(`SELECT * FROM notifications WHERE channel IN ('sms','email') AND status <> 'sent' ORDER BY created_at ASC LIMIT 100`);
  const results = [];
  let sent = 0;
  for (const rec of rows) {
    const can = rec.channel === "sms" ? sms : email;
    if (!can) {
      results.push({ id: rec.id, skipped: true, detail: `No ${rec.channel} provider configured` });
      continue;
    }
    const out = rec.channel === "sms" ? await sendSms(rec) : await sendEmail(rec);
    const next = out.ok ? "sent" : rec.status;
    if (out.ok) sent++;
    const upd = await dbQuery(`UPDATE notifications SET status = $1, detail = $2 WHERE id = $3 RETURNING *`, [next, out.detail, rec.id]);
    results.push({ id: rec.id, sent: out.ok, detail: out.detail, notification: notificationFromRow(upd[0]) });
  }
  return sendJson(res, 200, { enabled: true, sms, email, attempted: rows.length, sent, results });
});
export {
  SCHEMA_SQL,
  SCHEMA_STATEMENTS,
  partners_default2 as adminPartners,
  assist_default as aiAssist,
  auth_exports as authLib,
  bookings_default as bookings,
  dbQuery,
  health_default as health,
  jobs_default as jobs,
  award_default as jobsAward,
  bid_default as jobsBid,
  leads_default as leads,
  login_default as login,
  logout_default as logout,
  me_default as me,
  notifications_default as notifications,
  dispatch_default as notificationsDispatch,
  offers_default as offers,
  orders_default as orders,
  code_default as partnerByCode,
  partners_default as partners,
  initialize_default as payInit,
  paystack_exports as paystackLib,
  quotes_default as quotes,
  register_default as register,
  reviews_default as reviews,
  settings_default as settings,
  setup_default as setup,
  webhook_default as webhook
};
