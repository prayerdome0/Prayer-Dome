// ============================================================================
// Prayer Dome — Online giving (Flutterwave + Paystack)
// ----------------------------------------------------------------------------
// Server-side payment creation & verification. Secret keys live in Cloud
// Functions environment variables (NEVER in the client bundle):
//   FLUTTERWAVE_SECRET_KEY   — https://dashboard.flutterwave.com → Settings
//   PAYSTACK_SECRET_KEY      — https://dashboard.paystack.com → Settings
//   FLUTTERWAVE_PLAN_ID      — optional, for recurring giving
//   PAYSTACK_PLAN_ID         — optional, for recurring giving
//
// Flow: client calls createGivingPayment → user completes checkout on the
// provider's page → provider webhook calls paymentWebhook → giving/{id} is
// marked successful and the finance team is notified.
// ============================================================================
'use strict';

const https = require('https');

/* ------------------------------------------------------------ pure helpers */

const CURRENCIES = ['ZMW', 'SZL', 'USD', 'ZAR', 'NGN', 'KES', 'GBP', 'EUR'];
const MIN_AMOUNT = 1;

function validateRequest(req) {
  const errors = [];
  const provider = String(req.provider || '').toLowerCase();
  if (!['flutterwave', 'paystack'].includes(provider)) errors.push('provider must be flutterwave or paystack');
  const amount = Number(req.amount);
  if (!Number.isFinite(amount) || amount < MIN_AMOUNT) errors.push('amount must be a positive number');
  if (amount > 1000000) errors.push('amount too large');
  const currency = String(req.currency || '').toUpperCase();
  if (!CURRENCIES.includes(currency)) errors.push('unsupported currency');
  if (!req.name || String(req.name).trim().length < 2) errors.push('name is required');
  const email = String(req.email || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('a valid email is required');
  if (req.phone && !/^[+0-9 ()-]{6,20}$/.test(String(req.phone))) errors.push('phone looks invalid');
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    provider,
    amount: Math.round(amount * 100) / 100,
    currency,
    name: String(req.name).trim().slice(0, 120),
    email: email.slice(0, 160),
    phone: req.phone ? String(req.phone).slice(0, 24) : '',
    recurring: !!req.recurring,
    meta: req.meta || {}
  };
}

function buildTxRef(provider) {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return 'PD-' + provider.toUpperCase().slice(0, 3) + '-' + Date.now().toString(36).toUpperCase() + '-' + rand;
}

// Flutterwave webhook: header Verif-Hash must equal the secret key hash.
function verifyFlutterwaveSignature(headers, secret, bodyHash) {
  const hash = headers['verif-hash'] || headers['Verif-Hash'] || '';
  return hash.length > 0 && hash === secret;
}

// Paystack webhook: HMAC-SHA512 of the raw body with the secret key.
function verifyPaystackSignature(headers, secret, rawBody) {
  const crypto = require('crypto');
  const sig = headers['x-paystack-signature'] || '';
  const hmac = crypto.createHmac('sha512', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(hmac), b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* -------------------------------------------------------------- HTTP utils */

function postJson(url, payload, secret, authHeader) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    };
    if (authHeader === 'bearer') headers.Authorization = 'Bearer ' + secret;
    else if (authHeader === 'flutterwave') headers.Authorization = 'Bearer ' + secret;
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST', headers }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (e) {}
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(url, secret) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'GET', headers: { Authorization: 'Bearer ' + secret } }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (e) {}
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/* ------------------------------------------------------------ integrations */

// Flutterwave standard checkout (card + mobile money).
async function createFlutterwave(secret, req) {
  const txRef = buildTxRef('flutterwave');
  const payload = {
    tx_ref: txRef,
    amount: req.amount,
    currency: req.currency,
    redirect_url: 'https://prayerdome.net/give.html?status=return',
    customer: { email: req.email, name: req.name, phonenumber: req.phone || undefined },
    customizations: {
      title: 'Prayer Dome Offering',
      description: (req.recurring ? 'Recurring giving · ' : 'One-time giving · ') + req.name,
      logo: 'https://i.ibb.co/TB5Fx4tb/logo-0.png'
    },
    meta: Object.assign({ userId: req.meta.userId || '' }, req.meta)
  };
  if (process.env.FLUTTERWAVE_PLAN_ID && req.recurring) {
    payload.payment_plan = process.env.FLUTTERWAVE_PLAN_ID;
  }
  const res = await postJson('https://api.flutterwave.com/v3/payments', payload, secret, 'bearer');
  if (res.status >= 400 || !res.json || !res.json.data || !res.json.data.link) {
    throw new Error('Flutterwave: ' + (res.json && res.json.message ? res.json.message : 'HTTP ' + res.status));
  }
  return { provider: 'flutterwave', txRef, checkoutUrl: res.json.data.link };
}

// Paystack initialize (cards, mobile money via channels).
async function createPaystack(secret, req) {
  const txRef = buildTxRef('paystack');
  const payload = {
    email: req.email,
    amount: Math.round(req.amount * 100),           // Paystack uses minor units
    currency: req.currency,
    reference: txRef,
    callback_url: 'https://prayerdome.net/give.html?status=return',
    metadata: Object.assign({ userId: req.meta.userId || '', custom_fields: [{ display_name: 'Name', variable_name: 'name', value: req.name }] }, req.meta)
  };
  if (process.env.PAYSTACK_PLAN_ID && req.recurring) {
    payload.plan = process.env.PAYSTACK_PLAN_ID;
  }
  const res = await postJson('https://api.paystack.co/transaction/initialize', payload, secret, 'bearer');
  if (res.status >= 400 || !res.json || !res.json.status || !res.json.data || !res.json.data.authorization_url) {
    throw new Error('Paystack: ' + (res.json && res.json.message ? res.json.message : 'HTTP ' + res.status));
  }
  return { provider: 'paystack', txRef, checkoutUrl: res.json.data.authorization_url };
}

async function verifyFlutterwave(secret, txRef) {
  const res = await getJson('https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=' + encodeURIComponent(txRef), secret);
  if (res.status >= 400 || !res.json || !res.json.data) return { status: 'unknown' };
  const d = res.json.data;
  const map = { successful: 'successful', completed: 'successful', pending: 'pending', failed: 'failed', cancelled: 'cancelled' };
  return { status: map[d.status] || 'pending', providerRef: d.id ? String(d.id) : '', raw: d };
}

async function verifyPaystack(secret, txRef) {
  const res = await getJson('https://api.paystack.co/transaction/verify/' + encodeURIComponent(txRef), secret);
  if (res.status >= 400 || !res.json || !res.json.data) return { status: 'unknown' };
  const d = res.json.data;
  const map = { success: 'successful', abandoned: 'cancelled', failed: 'failed' };
  return { status: map[d.status] || 'pending', providerRef: d.id ? String(d.id) : '', raw: d };
}

/* ---------------------------------------------------------- cloud function */

function createPaymentHandler() {
  const functions = require('firebase-functions');
  return functions.https.onCall(async (data, context) => {
    const admin = require('firebase-admin');
    const db = admin.firestore();
    const secret = process.env.FLUTTERWAVE_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY;

    const req = validateRequest(data || {});
    if (!req.ok) throw new functions.https.HttpsError('invalid-argument', req.errors.join('; '));

    // No merchant keys configured yet → tell the client to use manual giving.
    const fwSecret = process.env.FLUTTERWAVE_SECRET_KEY;
    const psSecret = process.env.PAYSTACK_SECRET_KEY;
    const providerSecret = req.provider === 'flutterwave' ? fwSecret : psSecret;
    if (!providerSecret) {
      return { configured: false, provider: req.provider };
    }

    const created = req.provider === 'flutterwave'
      ? await createFlutterwave(fwSecret, req)
      : await createPaystack(psSecret, req);

    const givingRef = db.collection('giving').doc(created.txRef);
    await givingRef.set({
      userId: context.auth ? context.auth.uid : null,
      name: req.name,
      email: req.email,
      phone: req.phone,
      provider: req.provider,
      amount: req.amount,
      currency: req.currency,
      recurring: req.recurring,
      txRef: created.txRef,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      checkoutUrl: created.checkoutUrl
    });

    return Object.assign({ configured: true, id: created.txRef }, created);
  });
}

function verifyPaymentHandler() {
  const functions = require('firebase-functions');
  return functions.https.onCall(async (data, context) => {
    const admin = require('firebase-admin');
    const db = admin.firestore();
    const txRef = String((data && data.txRef) || '');
    if (!/^PD-[A-Z]{3}-[A-Z0-9]+-[A-Z0-9]+$/.test(txRef)) {
      throw new functions.https.HttpsError('invalid-argument', 'bad reference');
    }
    const givingSnap = await db.collection('giving').doc(txRef).get();
    if (!givingSnap.exists) throw new functions.https.HttpsError('not-found', 'no such payment');
    const giving = givingSnap.data();
    const secret = giving.provider === 'flutterwave' ? process.env.FLUTTERWAVE_SECRET_KEY : process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return { status: giving.status || 'unknown' };

    const result = giving.provider === 'flutterwave'
      ? await verifyFlutterwave(secret, txRef)
      : await verifyPaystack(secret, txRef);

    if (result.status !== (giving.status || '')) {
      await givingSnap.ref.update({ status: result.status, verifiedAt: admin.firestore.FieldValue.serverTimestamp(), providerRef: result.providerRef || '' });
    }
    return { status: result.status, txRef };
  });
}

function paymentWebhookHandler(provider) {
  const functions = require('firebase-functions');
  return functions.https.onRequest(async (req, res) => {
    const admin = require('firebase-admin');
    const db = admin.firestore();
    provider = provider || (String(req.path || '').includes('paystack') ? 'paystack' : 'flutterwave');
    const body = req.body || {};
    const raw = typeof req.rawBody !== 'undefined' ? req.rawBody : JSON.stringify(body);

    let ok = false;
    if (provider === 'flutterwave') {
      const secret = process.env.FLUTTERWAVE_SECRET_KEY;
      if (secret) ok = verifyFlutterwaveSignature(req.headers, secret, '');
    } else {
      const secret = process.env.PAYSTACK_SECRET_KEY;
      if (secret) ok = verifyPaystackSignature(req.headers, secret, raw);
    }
    if (!ok) {
      res.status(401).send('bad signature');
      return;
    }

    // Flutterwave: body.data.tx_ref · Paystack: body.data.reference
    const data = (body && body.data) || {};
    const txRef = String(data.tx_ref || data.reference || '');
    const providerStatus = String(body.status || data.status || '').toLowerCase();
    const map = { successful: 'successful', success: 'successful', completed: 'successful', pending: 'pending', failed: 'failed', abandoned: 'cancelled', cancelled: 'cancelled' };
    const status = map[providerStatus] || 'pending';

    if (txRef) {
      const givingRef = db.collection('giving').doc(txRef);
      const snap = await givingRef.get();
      if (snap.exists) {
        await givingRef.update({
          status,
          webhookAt: admin.firestore.FieldValue.serverTimestamp(),
          providerRef: String(data.id || data.reference || '')
        });
        if (status === 'successful') {
          // Notify the finance team in-app and by push.
          await db.collection('notifications').add({
            type: 'giving',
            title: '💝 New offering received',
            message: `${snap.data().name} gave ${snap.data().currency} ${snap.data().amount} (${snap.data().provider})`,
            link: '/admin.html',
            status: 'sent',
            tokens: [],
            sentAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
    }
    res.status(200).send('ok');
  });
}

module.exports = {
  validateRequest, buildTxRef, verifyFlutterwaveSignature, verifyPaystackSignature,
  createPaymentHandler, verifyPaymentHandler, paymentWebhookHandler,
  CURRENCIES, MIN_AMOUNT
};
