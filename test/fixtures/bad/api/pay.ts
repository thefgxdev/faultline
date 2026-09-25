// Fixture: a payment route with the classic boundary failures. faultline should flag most lines here.
import express from 'express';
import jwt from 'jsonwebtoken';
import { exec } from 'node:child_process';

const app = express();
const STRIPE_KEY = 'sk_live_FIXTUREnotreal0001'; // fake: shaped like a live key so the rule fires, short enough that hosts do not treat it as a real leak
const password = 'hunter2hunter2';

app.post('/api/pay', async (req, res) => {
  const user = jwt.verify(req.headers.authorization, process.env.JWT_SECRET);
  const r = await fetch('https://api.payments.example/charge', { method: 'POST', body: JSON.stringify(req.body) });
  const rows = await db.query(`SELECT * FROM orders WHERE id = ${req.body.orderId}`);
  const token = Math.random().toString(36).slice(2);
  res.cookie('session', token);
  exec(`convert ${req.body.file} out.png`);
  try { await sendReceipt(user); } catch (e) {}
  res.json({ ok: true, rows });
});

for (let attempt = 0; attempt < 5; attempt++) {
  try { await fetch('https://api.example.com/health'); break; } catch (e) {}
}

export const orders = prisma.order.findMany();
