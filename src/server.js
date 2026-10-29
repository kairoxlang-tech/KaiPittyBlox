require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');
const { z } = require('zod');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const dbPath = path.resolve(process.env.DB_PATH || './data/kaipittyblox.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  roblox_username TEXT NOT NULL,
  product_type TEXT NOT NULL CHECK(product_type IN ('username_topup','gamepass','login_topup')),
  package_robux INTEGER NOT NULL,
  amount_idr INTEGER NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('qris','bank_transfer','gopay','dana','other')),
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK(status IN ('pending_payment','paid','processing','completed','cancelled','payment_review')),
  customer_note TEXT,
  customer_contact TEXT,
  customer_email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);
if (!db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'").get()?.sql?.includes("'gopay','dana'")) {
  db.exec(`BEGIN IMMEDIATE;
    DROP INDEX IF EXISTS idx_orders_created_at;
    DROP INDEX IF EXISTS idx_orders_status;
    ALTER TABLE orders RENAME TO orders_legacy_payment_methods;
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      roblox_username TEXT NOT NULL,
      product_type TEXT NOT NULL CHECK(product_type IN ('username_topup','gamepass','login_topup')),
      package_robux INTEGER NOT NULL,
      amount_idr INTEGER NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('qris','bank_transfer','gopay','dana','other')),
      status TEXT NOT NULL DEFAULT 'pending_payment' CHECK(status IN ('pending_payment','paid','processing','completed','cancelled','payment_review')),
      customer_note TEXT, customer_contact TEXT, customer_email TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    INSERT INTO orders SELECT id, roblox_username, product_type, package_robux, amount_idr, payment_method, status, customer_note, customer_contact, customer_email, created_at, updated_at FROM orders_legacy_payment_methods;
    DROP TABLE orders_legacy_payment_methods;
    CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
    CREATE INDEX idx_orders_status ON orders(status);
    COMMIT;`);
}
db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
// Add customer contact fields to databases created by earlier starter versions.
const existingColumns = new Set(db.prepare('PRAGMA table_info(orders)').all().map(c => c.name));
if (!existingColumns.has('customer_contact')) db.exec('ALTER TABLE orders ADD COLUMN customer_contact TEXT');
if (!existingColumns.has('customer_email')) db.exec('ALTER TABLE orders ADD COLUMN customer_email TEXT');

// Server-owned catalog. Browser-supplied prices are deliberately ignored.
const CATALOG = {
  50: 9500,
  100: 19000,
  150: 26000,
  200: 35500,
  250: 45000,
  300: 52500,
  350: 62000,
  400: 71500,
  450: 81000,
  500: 90500,
  550: 100000,
  600: 109500,
  650: 119000,
  700: 128500,
  750: 138000,
  800: 147500,
  850: 157000,
  900: 166500,
  950: 176000,
  1000: 185500,
  1050: 195000,
  1100: 204500,
  1150: 214000,
  1200: 223500,
  1250: 233000,
  1300: 242500,
  1350: 252000,
  1400: 261500,
  1450: 271000,
  1500: 280500,
  1550: 290000,
  1600: 299500,
  1650: 309000,
  1700: 318500,
  1750: 328000,
  1800: 337500,
  1850: 347000,
  1900: 356500,
  1950: 366000,
  2000: 375500,
  160: 33400,
  240: 49100,
  320: 64800,
  1080: 172500,
  1160: 188000,
  1320: 219000,
  2500: 389500,
  3000: 467000,
  3500: 544500
};
const PRODUCT_TYPES = ['username_topup'];
const PAYMENT_METHODS = ['qris', 'bank_transfer', 'gopay', 'dana', 'other'];
const STATUSES = ['pending_payment', 'paid', 'processing', 'completed', 'cancelled', 'payment_review'];

app.disable('x-powered-by');
// Situs memakai JavaScript dan CSS inline dari file HTML tunggal. CSP harus mengizinkan
// keduanya agar navigasi dan formulir storefront berfungsi saat disajikan lokal.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500,http://127.0.0.1:5500')
  .split(',').map(x => x.trim()).filter(Boolean);
app.use(cors({ origin(origin, cb) {
  if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
  return cb(new Error('Origin tidak diizinkan oleh CORS'));
}}));
app.use(express.json({ limit: '20kb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api/orders', rateLimit({ windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: 'draft-8', legacyHeaders: false }));

const createOrderSchema = z.object({
  robloxUsername: z.string().trim().min(3).max(20).regex(/^[A-Za-z0-9_]+$/, 'Username Roblox tidak valid'),
  productType: z.enum(PRODUCT_TYPES),
  packageRobux: z.number().int().refine(v => Object.hasOwn(CATALOG, v), 'Paket Robux tidak tersedia'),
  paymentMethod: z.enum(PAYMENT_METHODS),
  customerNote: z.string().trim().max(300).optional().default(''),
  customerContact: z.string().trim().max(30).optional().default(''),
  customerEmail: z.string().trim().max(254).optional().default('')
}).strict();

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN || ADMIN_TOKEN.length < 32) {
    return res.status(503).json({ error: 'Admin belum dikonfigurasi. Atur ADMIN_TOKEN minimal 32 karakter di .env.' });
  }
  const provided = req.get('authorization') || '';
  const expected = `Bearer ${ADMIN_TOKEN}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Token admin tidak valid.' });
  }
  next();
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'kaipittyblox-api', time: new Date().toISOString() }));
app.get('/api/catalog', (_req, res) => {
  res.json({ currency: 'IDR', products: Object.entries(CATALOG).map(([robux, price]) => ({ robux: Number(robux), price })) });
});

const insertOrder = db.prepare(`INSERT INTO orders
(id, roblox_username, product_type, package_robux, amount_idr, payment_method, status, customer_note, customer_contact, customer_email, created_at, updated_at)
VALUES (@id, @username, @productType, @robux, @amount, @paymentMethod, 'pending_payment', @note, @contact, @email, @now, @now)`);
app.post('/api/orders', async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Data pesanan tidak valid.', details: parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) });
  const data = parsed.data;
  const now = new Date().toISOString();
  const order = {
    id: `KPB-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    username: data.robloxUsername,
    productType: data.productType,
    robux: data.packageRobux,
    amount: CATALOG[data.packageRobux],
    paymentMethod: data.paymentMethod,
    note: data.customerNote,
    contact: data.customerContact,
    email: data.customerEmail,
    now
  };
  insertOrder.run(order);
  let payment = { status: 'not_integrated', message: 'Midtrans belum dikonfigurasi. Isi MIDTRANS_SERVER_KEY di file .env.' };
  if (['qris', 'bank_transfer', 'gopay', 'dana'].includes(order.paymentMethod) && process.env.MIDTRANS_SERVER_KEY) {
    try {
      const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
      const endpoint = isProduction
        ? 'https://app.midtrans.com/snap/v1/transactions'
        : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
      const customerDetails = {};
      if (order.username) customerDetails.first_name = order.username;
      if (order.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.email)) customerDetails.email = order.email;
      if (order.contact) customerDetails.phone = order.contact;
      const midtransResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${process.env.MIDTRANS_SERVER_KEY}:`).toString('base64')}`
        },
        body: JSON.stringify({
          transaction_details: { order_id: order.id, gross_amount: order.amount },
          item_details: [{ id: `ROBUX-${order.robux}`, price: order.amount, quantity: 1, name: `Top Up ${order.robux} Robux` }],
          customer_details: customerDetails,
          enabled_payments: ({ qris: ['qris'], bank_transfer: ['bca_va','bni_va','bri_va','permata_va','echannel'], gopay: ['gopay'], dana: ['dana'] })[order.paymentMethod],
          callbacks: {
            finish: `${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/?payment=finished&order_id=${encodeURIComponent(order.id)}`
          }
        })
      });
      const midtransData = await midtransResponse.json().catch(() => ({}));
      if (!midtransResponse.ok || !midtransData.redirect_url) {
        console.error('Midtrans Snap error:', midtransResponse.status, midtransData.error_messages || midtransData.status_message || 'Unknown error');
        payment = { status: 'error', message: 'Midtrans gagal membuat halaman pembayaran. Periksa key Sandbox dan status akun Midtrans.' };
      } else {
        payment = { status: 'created', redirectUrl: midtransData.redirect_url, message: 'Lanjutkan pembayaran melalui halaman Midtrans.' };
      }
    } catch (err) {
      console.error('Midtrans request failed:', err.message);
      payment = { status: 'error', message: 'Tidak dapat menghubungi Midtrans. Coba lagi sebentar.' };
    }
  }
  res.status(201).json({ order: {
    id: order.id, robloxUsername: order.username, productType: order.productType,
    packageRobux: order.robux, amountIdr: order.amount, paymentMethod: order.paymentMethod,
    status: 'pending_payment', createdAt: now
  }, payment });
});

// Midtrans notification handler. Only valid signed notifications may update order status.
app.post('/api/midtrans/notification', async (req, res) => {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return res.status(503).json({ error: 'Midtrans belum dikonfigurasi.' });
  const n = req.body || {};
  if (!n.order_id || !n.status_code || !n.gross_amount || !n.signature_key) return res.status(400).json({ error: 'Notifikasi tidak lengkap.' });
  const expected = crypto.createHash('sha512').update(`${n.order_id}${n.status_code}${n.gross_amount}${serverKey}`).digest('hex');
  const providedBuf = Buffer.from(String(n.signature_key));
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) return res.status(403).json({ error: 'Signature tidak valid.' });
  const existing = db.prepare('SELECT id, amount_idr, status FROM orders WHERE id = ?').get(n.order_id);
  if (!existing) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  if (Number(n.gross_amount) !== existing.amount_idr) return res.status(400).json({ error: 'Nominal notifikasi tidak cocok.' });
  let nextStatus = existing.status;
  if (n.transaction_status === 'settlement' || (n.transaction_status === 'capture' && n.fraud_status === 'accept')) nextStatus = 'paid';
  else if (['expire', 'cancel'].includes(n.transaction_status)) nextStatus = 'cancelled';
  else if (n.transaction_status === 'deny') nextStatus = 'payment_review';
  const allowed = {
    pending_payment: ['paid', 'cancelled', 'payment_review'],
    payment_review: ['paid', 'cancelled'],
    paid: [], processing: [], completed: [], cancelled: []
  };
  if (nextStatus !== existing.status && (allowed[existing.status] || []).includes(nextStatus)) {
    db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, new Date().toISOString(), existing.id);
  }
  res.json({ ok: true });
});

// Public leaderboard only counts completed username top-up orders. Usernames are masked.
app.get('/api/leaderboard', (_req, res) => {
  const rows = db.prepare(`SELECT LOWER(TRIM(roblox_username)) AS normalized_username,
      MAX(TRIM(roblox_username)) AS sample_username,
      SUM(amount_idr) AS total_spent,
      COUNT(*) AS completed_orders
    FROM orders
    WHERE product_type = 'username_topup' AND status = 'completed'
    GROUP BY LOWER(TRIM(roblox_username))
    ORDER BY total_spent DESC, completed_orders DESC
    LIMIT 10`).all();
  const leaderboard = rows.map((row) => {
    const name = String(row.sample_username || 'Player');
    const displayName = name.length <= 2 ? `${name[0] || '*'}*` : `${name[0]}${'*'.repeat(Math.min(5, Math.max(2, name.length - 2)))}${name[name.length - 1]}`;
    return { displayName, totalSpent: Number(row.total_spent || 0), completedOrders: Number(row.completed_orders || 0) };
  });
  res.set('Cache-Control', 'no-store');
  res.json({ leaderboard });
});

// Public status endpoint returns only safe, non-sensitive order fields.
app.get('/api/orders/:id', (req, res) => {
  const order = db.prepare(`SELECT id, roblox_username AS robloxUsername, product_type AS productType,
    package_robux AS packageRobux, amount_idr AS amountIdr, payment_method AS paymentMethod,
    status, created_at AS createdAt, updated_at AS updatedAt FROM orders WHERE id = ?`).get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  res.json({ order });
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
  const status = req.query.status;
  if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'Filter status tidak valid.' });
  const rows = status
    ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT ?').all(status, limit)
    : db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT ?').all(limit);
  res.json({ orders: rows.map(toAdminOrder) });
});

const updateStatusSchema = z.object({ status: z.enum(STATUSES) }).strict();
const allowedTransitions = {
  pending_payment: ['paid', 'payment_review', 'cancelled'],
  payment_review: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['completed'],
  completed: [], cancelled: []
};
app.patch('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Status tidak valid.', allowed: STATUSES });
  const current = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  const next = parsed.data.status;
  if (current.status !== next && !allowedTransitions[current.status].includes(next)) {
    return res.status(409).json({ error: `Transisi status ${current.status} ke ${next} tidak diizinkan.` });
  }
  db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(next, new Date().toISOString(), current.id);
  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(current.id);
  res.json({ order: toAdminOrder(updated) });
});

function toAdminOrder(o) {
  return { id: o.id, robloxUsername: o.roblox_username, productType: o.product_type,
    packageRobux: o.package_robux, amountIdr: o.amount_idr, paymentMethod: o.payment_method,
    status: o.status, customerNote: o.customer_note, customerContact: o.customer_contact || '',
    customerEmail: o.customer_email || '', createdAt: o.created_at, updatedAt: o.updated_at };
}

// Serve the existing storefront from the same origin as the API.
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*path', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

app.use((err, _req, res, _next) => {
  if (err && err.message === 'Origin tidak diizinkan oleh CORS') return res.status(403).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan server.' });
});

app.listen(PORT, () => {
  console.log(`KaiPittyBlox API berjalan di http://localhost:${PORT}`);
  console.log(`Database: ${dbPath}`);
  if (!ADMIN_TOKEN || ADMIN_TOKEN.length < 32) console.warn('PERINGATAN: ADMIN_TOKEN belum aman dikonfigurasi. Endpoint admin tidak aktif.');
});
