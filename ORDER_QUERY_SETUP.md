# 订单查询系统部署说明

这个功能不需要 VPS，使用当前 Cloudflare Pages 项目的 Functions + D1 数据库即可。

## 页面地址

- 订单服务页：`https://sim.885397.xyz/order/`
- 客户查询页：`https://sim.885397.xyz/query/`
- 客户填写地址页：`https://sim.885397.xyz/address/`
- 管理页面：`https://sim.885397.xyz/order-admin/`

管理页面不会显示在博客菜单里，但知道地址的人可以打开页面；真正的保护是 Cloudflare 环境变量 `ADMIN_TOKEN`。

## Cloudflare 设置

### 1. 创建 D1 数据库

进入 Cloudflare 后台：

`Workers & Pages` -> `D1 SQL Database` -> `Create database`

数据库名字可以填：

```text
orders-db
```

### 2. 创建数据表

进入刚创建的 D1 数据库，打开 `Console`，复制并运行：

```sql
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL,
  order_no_key TEXT NOT NULL UNIQUE,
  tracking_no TEXT NOT NULL,
  carrier TEXT NOT NULL DEFAULT 'sto',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_order_no_key ON orders(order_no_key);

CREATE TABLE IF NOT EXISTS query_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  success INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_query_logs_ip_created_at ON query_logs(ip, created_at);
```

同样的建表脚本也保存在项目里的 `migrations/0001_create_orders.sql`。

### 3. 给 Pages 项目绑定 D1

进入你的 Pages 项目：

`Workers & Pages` -> `my-blog` -> `Settings` -> `Functions` -> `D1 database bindings`

添加绑定：

```text
Variable name: DB
D1 database: orders-db
```

### 4. 设置管理密码

还是在 Pages 项目设置里，找到环境变量：

`Settings` -> `Environment variables`

添加：

```text
Variable name: ADMIN_TOKEN
Value: 你自己设置一个长一点的密码
```

建议密码至少 16 位，不要用常见密码。

### 5. 重新部署

保存 D1 绑定和环境变量后，在 Cloudflare Pages 里重新部署一次最新版本。

## 使用方法

打开管理页面：

```text
https://sim.885397.xyz/order-admin/
```

输入 `ADMIN_TOKEN` 管理密码，然后添加：

```text
订单号
快递单号
快递公司
备注
```

客户打开：

```text
https://sim.885397.xyz/query/
```

输入订单号后，就能看到对应的申通快递单号。

客户也可以先打开：

```text
https://sim.885397.xyz/address/
```

提交订单号、收件人、手机号和收货地址。后台发货后补快递单号，客户再用订单号查询。
