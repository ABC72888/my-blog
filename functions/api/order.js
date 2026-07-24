const MAX_ORDER_LENGTH = 80;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 30;

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

  const limit = await checkRateLimit(env, request);
  if (!limit.allowed) {
    return json({ ok: false, message: '查询太频繁，请稍后再试。' }, 429);
  }

  const order = await env.DB.prepare(
    'SELECT order_no, tracking_no, carrier, updated_at FROM orders WHERE order_no_key = ? LIMIT 1'
  ).bind(orderKey).first();

  await env.DB.prepare(
    'INSERT INTO query_logs (ip, created_at, success) VALUES (?, ?, ?)'
  ).bind(limit.ip, limit.now, order ? 1 : 0).run();

  if (!order) {
    return json({ ok: false, message: '没有查到这个订单号，请检查是否输入正确。' }, 404);
  }

  const trackingNo = String(order.tracking_no || '').trim();

  return json({
    ok: true,
    data: {
      orderNo: order.order_no,
      trackingNo,
      carrier: order.carrier || 'sto',
      status: trackingNo ? 'shipped' : 'pending',
      message: trackingNo ? '已发货。' : '地址已提交，等待发货。',
      updatedAt: order.updated_at,
    },
  });
}
