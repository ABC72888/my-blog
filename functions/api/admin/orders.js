const ORDER_PATTERN = /^LD[A-Z0-9]{12}$/;
const MAX_TRACKING_LENGTH = 80;

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

function getAdminToken(request) {
  const auth = request.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return '';
}

function assertAdmin(request, env) {
  if (!env.ADMIN_TOKEN) {
    return { ok: false, response: json({ ok: false, message: '还没有设置 ADMIN_TOKEN 管理密码。' }, 500) };
  }

  const token = getAdminToken(request);
  if (!token || token !== env.ADMIN_TOKEN) {
    return { ok: false, response: json({ ok: false, message: '管理密码不正确。' }, 401) };
  }

  return { ok: true };
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

function validateOrder(input) {
  const orderNo = String(input.orderNo || '').trim();
  const trackingNo = String(input.trackingNo || '').trim();
  const carrier = String(input.carrier || 'sto').trim() || 'sto';
  const recipientName = String(input.recipientName || '').trim();
  const recipientPhone = String(input.recipientPhone || '').trim();
  const recipientAddress = String(input.recipientAddress || '').trim();
  const note = String(input.note || '').trim();
  const orderKey = normalizeOrderNo(orderNo);

  if (!orderKey) return { ok: false, message: '订单号不能为空。' };
  if (!ORDER_PATTERN.test(orderKey)) return { ok: false, message: '订单号格式不正确，必须是 LD 开头的 14 位订单号。' };
  if (trackingNo.length > MAX_TRACKING_LENGTH) return { ok: false, message: '快递单号太长。' };

  return {
    ok: true,
    orderNo,
    orderKey,
    trackingNo,
    carrier,
    recipientName,
    recipientPhone,
    recipientAddress,
    note,
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, message: '数据库还没有绑定。' }, 500);

  const admin = assertAdmin(request, env);
  if (!admin.ok) return admin.response;

  await ensureCustomerColumns(env);

  const url = new URL(request.url);
  const q = normalizeOrderNo(url.searchParams.get('q') || '');
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100);

  const stmt = q
    ? env.DB.prepare(
        `SELECT order_no, tracking_no, carrier, recipient_name, recipient_phone, recipient_address, note, updated_at
         FROM orders
         WHERE order_no_key LIKE ?
         ORDER BY updated_at DESC
         LIMIT ?`
      ).bind(`%${q}%`, limit)
    : env.DB.prepare(
        `SELECT order_no, tracking_no, carrier, recipient_name, recipient_phone, recipient_address, note, updated_at
         FROM orders
         ORDER BY updated_at DESC
         LIMIT ?`
      ).bind(limit);

  const result = await stmt.all();
  return json({ ok: true, data: result.results || [] });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, message: '数据库还没有绑定。' }, 500);

  const admin = assertAdmin(request, env);
  if (!admin.ok) return admin.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, message: '提交内容格式不正确。' }, 400);
  }

  const item = validateOrder(body);
  if (!item.ok) return json({ ok: false, message: item.message }, 400);

  await ensureCustomerColumns(env);

  await env.DB.prepare(
    `INSERT INTO orders (
       order_no, order_no_key, tracking_no, carrier,
       recipient_name, recipient_phone, recipient_address, note, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(order_no_key) DO UPDATE SET
       order_no = excluded.order_no,
       tracking_no = excluded.tracking_no,
       carrier = excluded.carrier,
       recipient_name = excluded.recipient_name,
       recipient_phone = excluded.recipient_phone,
       recipient_address = excluded.recipient_address,
       note = excluded.note,
       updated_at = datetime('now')`
  ).bind(
    item.orderNo,
    item.orderKey,
    item.trackingNo,
    item.carrier,
    item.recipientName,
    item.recipientPhone,
    item.recipientAddress,
    item.note
  ).run();

  return json({ ok: true, message: '保存成功。' });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, message: '数据库还没有绑定。' }, 500);

  const admin = assertAdmin(request, env);
  if (!admin.ok) return admin.response;

  const url = new URL(request.url);
  const orderKey = normalizeOrderNo(url.searchParams.get('orderNo') || '');
  if (!orderKey) return json({ ok: false, message: '订单号不能为空。' }, 400);

  await env.DB.prepare('DELETE FROM orders WHERE order_no_key = ?').bind(orderKey).run();
  return json({ ok: true, message: '删除成功。' });
}
