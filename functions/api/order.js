const MAX_ORDER_LENGTH = 80;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 30;
const TRACK_CACHE_SECONDS = 30 * 60;
const KDNIAO_URL = 'https://api.kdniao.com/Ebusiness/EbusinessOrderHandle.aspx';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function normalizeOrderNo(value) {
  return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
}

function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'unknown';
}

function shipperCode(carrier) {
  const codes = {
    sto: 'STO',
    shentong: 'STO',
  };
  return codes[String(carrier || '').toLowerCase()] || 'STO';
}

function base64(value) {
  return btoa(value);
}

function md5Hex(input) {
  function add32(a, b) {
    return (a + b) & 0xffffffff;
  }

  function cmn(q, a, b, x, s, t) {
    return add32(((add32(add32(a, q), add32(x, t)) << s) | (add32(add32(a, q), add32(x, t)) >>> (32 - s))), b);
  }

  function ff(a, b, c, d, x, s, t) {
    return cmn((b & c) | ((~b) & d), a, b, x, s, t);
  }

  function gg(a, b, c, d, x, s, t) {
    return cmn((b & d) | (c & (~d)), a, b, x, s, t);
  }

  function hh(a, b, c, d, x, s, t) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }

  function ii(a, b, c, d, x, s, t) {
    return cmn(c ^ (b | (~d)), a, b, x, s, t);
  }

  function toBlocks(bytes) {
    const blockCount = (((bytes.length + 8) >> 6) + 1) * 16;
    const blocks = new Array(blockCount).fill(0);
    let i;
    for (i = 0; i < bytes.length; i += 1) {
      blocks[i >> 2] |= bytes[i] << ((i % 4) << 3);
    }
    blocks[i >> 2] |= 0x80 << ((i % 4) << 3);
    blocks[(((i + 8) >> 6) << 4) + 14] = bytes.length * 8;
    return blocks;
  }

  const bytes = new TextEncoder().encode(input);
  const x = toBlocks(bytes);
  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < x.length; i += 16) {
    const olda = a;
    const oldb = b;
    const oldc = c;
    const oldd = d;

    a = ff(a, b, c, d, x[i], 7, -680876936);
    d = ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = ff(c, d, a, b, x[i + 2], 17, 606105819);
    b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = ff(a, b, c, d, x[i + 4], 7, -176418897);
    d = ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = ff(c, d, a, b, x[i + 6], 17, -1473231341);
    b = ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = ff(a, b, c, d, x[i + 8], 7, 1770035416);
    d = ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = ff(c, d, a, b, x[i + 10], 17, -42063);
    b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = ff(a, b, c, d, x[i + 12], 7, 1804603682);
    d = ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = ff(c, d, a, b, x[i + 14], 17, -1502002290);
    b = ff(b, c, d, a, x[i + 15], 22, 1236535329);

    a = gg(a, b, c, d, x[i + 1], 5, -165796510);
    d = gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = gg(c, d, a, b, x[i + 11], 14, 643717713);
    b = gg(b, c, d, a, x[i], 20, -373897302);
    a = gg(a, b, c, d, x[i + 5], 5, -701558691);
    d = gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = gg(c, d, a, b, x[i + 15], 14, -660478335);
    b = gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = gg(a, b, c, d, x[i + 9], 5, 568446438);
    d = gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = gg(c, d, a, b, x[i + 3], 14, -187363961);
    b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = gg(a, b, c, d, x[i + 13], 5, -1444681467);
    d = gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = gg(c, d, a, b, x[i + 7], 14, 1735328473);
    b = gg(b, c, d, a, x[i + 12], 20, -1926607734);

    a = hh(a, b, c, d, x[i + 5], 4, -378558);
    d = hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = hh(c, d, a, b, x[i + 11], 16, 1839030562);
    b = hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = hh(a, b, c, d, x[i + 1], 4, -1530992060);
    d = hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = hh(c, d, a, b, x[i + 7], 16, -155497632);
    b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = hh(a, b, c, d, x[i + 13], 4, 681279174);
    d = hh(d, a, b, c, x[i], 11, -358537222);
    c = hh(c, d, a, b, x[i + 3], 16, -722521979);
    b = hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = hh(a, b, c, d, x[i + 9], 4, -640364487);
    d = hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = hh(c, d, a, b, x[i + 15], 16, 530742520);
    b = hh(b, c, d, a, x[i + 2], 23, -995338651);

    a = ii(a, b, c, d, x[i], 6, -198630844);
    d = ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = ii(c, d, a, b, x[i + 14], 15, -1416354905);
    b = ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = ii(a, b, c, d, x[i + 12], 6, 1700485571);
    d = ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = ii(c, d, a, b, x[i + 10], 15, -1051523);
    b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = ii(a, b, c, d, x[i + 8], 6, 1873313359);
    d = ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = ii(c, d, a, b, x[i + 6], 15, -1560198380);
    b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = ii(a, b, c, d, x[i + 4], 6, -145523070);
    d = ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = ii(c, d, a, b, x[i + 2], 15, 718787259);
    b = ii(b, c, d, a, x[i + 9], 21, -343485551);

    a = add32(a, olda);
    b = add32(b, oldb);
    c = add32(c, oldc);
    d = add32(d, oldd);
  }

  function rhex(n) {
    let s = '';
    for (let j = 0; j < 4; j += 1) {
      s += (`0${((n >> (j * 8)) & 0xff).toString(16)}`).slice(-2);
    }
    return s;
  }

  return rhex(a) + rhex(b) + rhex(c) + rhex(d);
}

async function ensureCacheColumns(env) {
  try {
    await env.DB.prepare('SELECT track_cache_json, track_cache_at FROM orders LIMIT 1').first();
    return;
  } catch {
    // Continue and add missing columns for databases created before track lookup.
  }

  for (const sql of [
    'ALTER TABLE orders ADD COLUMN track_cache_json TEXT',
    'ALTER TABLE orders ADD COLUMN track_cache_at INTEGER',
  ]) {
    try {
      await env.DB.prepare(sql).run();
    } catch (error) {
      if (!String(error?.message || '').toLowerCase().includes('duplicate column')) {
        throw error;
      }
    }
  }
}

async function checkRateLimit(env, request) {
  const ip = getClientIp(request).slice(0, 80);
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - RATE_LIMIT_WINDOW_SECONDS;

  await env.DB.prepare('DELETE FROM query_logs WHERE created_at < ?').bind(now - 86400).run();

  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM query_logs WHERE ip = ? AND created_at >= ?'
  ).bind(ip, windowStart).first();

  if ((row?.count || 0) >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, ip, now };
  }

  return { allowed: true, ip, now };
}

function formatTrack(payload) {
  const traces = Array.isArray(payload?.Traces) ? payload.Traces : [];
  return {
    success: Boolean(payload?.Success),
    reason: payload?.Reason || '',
    state: String(payload?.State || ''),
    stateText: payload?.StateEx || '',
    traces: traces
      .map((item) => ({
        time: item.AcceptTime || '',
        text: item.AcceptStation || '',
        location: item.Location || '',
      }))
      .filter((item) => item.time || item.text),
  };
}

async function fetchKdniaoTrack(env, order) {
  if (!env.KDNIAO_EBUSINESS_ID || !env.KDNIAO_API_KEY) {
    return { available: false, message: '快递鸟密钥还没有设置。', traces: [] };
  }

  const requestData = JSON.stringify({
    OrderCode: '',
    ShipperCode: shipperCode(order.carrier),
    LogisticCode: order.tracking_no,
  });
  const params = new URLSearchParams();
  params.set('RequestType', '1002');
  params.set('EBusinessID', env.KDNIAO_EBUSINESS_ID);
  params.set('RequestData', requestData);
  params.set('DataSign', base64(md5Hex(requestData + env.KDNIAO_API_KEY)));
  params.set('DataType', '2');

  const response = await fetch(KDNIAO_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body: params.toString(),
  });

  const payload = await response.json();
  const track = formatTrack(payload);
  return {
    available: track.success,
    message: track.success ? '' : (track.reason || '暂时没有查到物流轨迹。'),
    state: track.state,
    stateText: track.stateText,
    traces: track.traces,
  };
}

async function getTrack(env, order) {
  const now = Math.floor(Date.now() / 1000);

  if (order.track_cache_json && order.track_cache_at && now - Number(order.track_cache_at) < TRACK_CACHE_SECONDS) {
    try {
      return JSON.parse(order.track_cache_json);
    } catch {
      // Ignore broken cache and fetch again.
    }
  }

  try {
    const track = await fetchKdniaoTrack(env, order);
    if (track.available) {
      await env.DB.prepare(
        'UPDATE orders SET track_cache_json = ?, track_cache_at = ? WHERE order_no_key = ?'
      ).bind(JSON.stringify(track), now, order.order_no_key).run();
    }
    return track;
  } catch (error) {
    return {
      available: false,
      message: '物流轨迹查询失败，请稍后再试。',
      traces: [],
    };
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.DB) {
    return json({ ok: false, message: '数据库还没有绑定，请在 Cloudflare Pages 里绑定 D1。' }, 500);
  }

  const url = new URL(request.url);
  const orderNo = String(url.searchParams.get('orderNo') || '').trim();
  const orderKey = normalizeOrderNo(orderNo);

  if (!orderKey) {
    return json({ ok: false, message: '请输入订单号。' }, 400);
  }

  if (orderKey.length > MAX_ORDER_LENGTH) {
    return json({ ok: false, message: '订单号太长，请检查后重新输入。' }, 400);
  }

  await ensureCacheColumns(env);

  const limit = await checkRateLimit(env, request);
  if (!limit.allowed) {
    return json({ ok: false, message: '查询太频繁，请稍后再试。' }, 429);
  }

  const order = await env.DB.prepare(
    `SELECT order_no, order_no_key, tracking_no, carrier, updated_at, track_cache_json, track_cache_at
     FROM orders
     WHERE order_no_key = ?
     LIMIT 1`
  ).bind(orderKey).first();

  await env.DB.prepare(
    'INSERT INTO query_logs (ip, created_at, success) VALUES (?, ?, ?)'
  ).bind(limit.ip, Math.floor(Date.now() / 1000), order ? 1 : 0).run();

  if (!order) {
    return json({ ok: false, message: '没有查到这个订单号，请检查是否输入正确。' }, 404);
  }

  const track = await getTrack(env, order);

  return json({
    ok: true,
    data: {
      orderNo: order.order_no,
      trackingNo: order.tracking_no,
      carrier: order.carrier || 'sto',
      updatedAt: order.updated_at,
      track,
    },
  });
}
