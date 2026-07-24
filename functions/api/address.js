const MAX_ORDER_LENGTH = 80;
const MAX_NAME_LENGTH = 50;
const MAX_PHONE_LENGTH = 30;
const MAX_ADDRESS_LENGTH = 500;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 12;

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

async function ensureCustomerColumns(env) {
  try {
    await env.DB.prepare('SELECT recipient_name, recipient_phone, recipient_address FROM orders LIMIT 1').first();
    return;
  } catch {
    // Databases created before address collection do not have these columns yet.
  }

  for (const sql of [
    'ALTER TABLE orders ADD COLUMN recipient_name TEXT',
    'ALTER TABLE orders ADD COLUMN recipient_phone TEXT',
    'ALTER TABLE orders ADD COLUMN recipient_address TEXT',
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
  ).bind(`address:${ip}`, windowStart).first();

  if ((row?.count || 0) >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, ip, now };
  }

  await env.DB.prepare(
    'INSERT INTO query_logs (ip, created_at, success) VALUES (?, ?, 1)'
  ).bind(`address:${ip}`, now).run();

  return { allowed: true };
}

function validate(input) {
  const orderNo = String(input.orderNo || '').trim();
  const orderKey = normalizeOrderNo(orderNo);
  const recipientName = String(input.recipientName || '').trim();
  const recipientPhone = String(input.recipientPhone || '').trim();
  const recipientAddress = String(input.recipientAddress || '').trim();

  if (!orderKey) return { ok: false, message: '请输入订单号。' };
  if (!recipientName) return { ok: false, message: '请输入收件人。' };
  if (!recipientPhone) return { ok: false, message: '请输入手机号。' };
  if (!recipientAddress) return { ok: false, message: '请输入收货地址。' };
  if (orderKey.length > MAX_ORDER_LENGTH) return { ok: false, message: '订单号太长。' };
  if (recipientName.length > MAX_NAME_LENGTH) return { ok: false, message: '收件人太长。' };
  if (recipientPhone.length > MAX_PHONE_LENGTH) return { ok: false, message: '手机号太长。' };
  if (recipientAddress.length > MAX_ADDRESS_LENGTH) return { ok: false, message: '收货地址太长。' };

  return {
    ok: true,
    orderNo,
    orderKey,
    recipientName,
    recipientPhone,
    recipientAddress,
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, message: '数据库还没有绑定。' }, 500);

  const limit = await checkRateLimit(env, request);
  if (!limit.allowed) {
    return json({ ok: false, message: '提交太频繁，请稍后再试。' }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, message: '提交内容格式不正确。' }, 400);
  }

  const item = validate(body);
  if (!item.ok) return json({ ok: false, message: item.message }, 400);

  await ensureCustomerColumns(env);

  await env.DB.prepare(
    `INSERT INTO orders (
       order_no, order_no_key, tracking_no, carrier,
       recipient_name, recipient_phone, recipient_address, updated_at
     )
     VALUES (?, ?, '', 'sto', ?, ?, ?, datetime('now'))
     ON CONFLICT(order_no_key) DO UPDATE SET
       order_no = excluded.order_no,
       recipient_name = excluded.recipient_name,
       recipient_phone = excluded.recipient_phone,
       recipient_address = excluded.recipient_address,
       updated_at = datetime('now')`
  ).bind(
    item.orderNo,
    item.orderKey,
    item.recipientName,
    item.recipientPhone,
    item.recipientAddress
  ).run();

  return json({ ok: true, message: '提交成功，请等待发货。' });
}
