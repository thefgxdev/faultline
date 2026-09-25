// Fixture: the same route done right. faultline should be quiet here.
import express from 'express';
import jwt from 'jsonwebtoken';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import rateLimit from 'express-rate-limit';

const app = express();
app.use(rateLimit({ windowMs: 60_000, limit: 100 }));

app.post('/api/pay', async (req, res) => {
  const idempotencyKey = req.header('Idempotency-Key');
  if (!idempotencyKey) return res.status(400).json({ error: 'Idempotency-Key required' });
  const user = jwt.verify(req.headers.authorization, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  const r = await fetch('https://api.payments.example/charge', { method: 'POST', body: JSON.stringify(req.body), signal: AbortSignal.timeout(5000) });
  const rows = await db.query('SELECT id, total FROM orders WHERE id = $1 AND tenant_id = $2', [req.body.orderId, user.tenantId]);
  const token = randomBytes(32).toString('hex');
  res.cookie('session', token, { httpOnly: true, secure: true, sameSite: 'lax' });
  execFile('convert', [req.body.file, 'out.png']);
  try { await sendReceipt(user); } catch (e) { log.warn({ err: e, user: user.id }, 'receipt failed; queued for retry'); await queue.add('receipt', { user: user.id }); }
  res.json({ ok: true, rows });
});

export const orders = prisma.order.findMany({ where: { tenantId: 't' }, take: 50 });
