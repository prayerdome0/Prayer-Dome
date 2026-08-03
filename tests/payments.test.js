/* ============================================================================
 * Prayer Dome — Payments tests
 * ----------------------------------------------------------------------------
 * Unit-tests the pure logic in functions/payments.js: request validation,
 * transaction references, and webhook signature verification for Flutterwave
 * and Paystack. No network, no Firebase SDKs.
 * ========================================================================== */
'use strict';
const path = require('path');
const crypto = require('crypto');
const payments = require(path.join(__dirname, '..', 'functions', 'payments.js'));

let passed = 0, failed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('PASS  ' + name); }
  else { failed++; console.error('FAIL  ' + name + (extra ? ' — ' + extra : '')); }
}

/* --------------------------------------------------------- validateRequest */
const good = payments.validateRequest({ provider: 'flutterwave', amount: 50, currency: 'zmw', name: 'John Doe', email: 'john@example.com' });
ok('valid flutterwave request passes', good.ok && good.currency === 'ZMW');
const good2 = payments.validateRequest({ provider: 'paystack', amount: 120.5, currency: 'SZL', name: 'Jane', email: 'jane@x.org', phone: '+260970000000' });
ok('valid paystack request passes', good2.ok && good2.amount === 120.5 && good2.recurring === false);

const bad1 = payments.validateRequest({ provider: 'bitcoin', amount: 50, currency: 'ZMW', name: 'A', email: 'x@y.z' });
ok('unknown provider rejected', !bad1.ok && bad1.errors.some(e => e.includes('provider')));
const bad2 = payments.validateRequest({ provider: 'paystack', amount: -5, currency: 'ZMW', name: 'John Doe', email: 'john@example.com' });
ok('negative amount rejected', !bad2.ok);
const bad3 = payments.validateRequest({ provider: 'paystack', amount: 0, currency: 'ZMW', name: 'John Doe', email: 'john@example.com' });
ok('zero amount rejected', !bad3.ok);
const bad4 = payments.validateRequest({ provider: 'paystack', amount: 999999999, currency: 'ZMW', name: 'John Doe', email: 'john@example.com' });
ok('absurd amount rejected', !bad4.ok);
const bad5 = payments.validateRequest({ provider: 'paystack', amount: 10, currency: 'BTC', name: 'John Doe', email: 'john@example.com' });
ok('unsupported currency rejected', !bad5.ok);
const bad6 = payments.validateRequest({ provider: 'paystack', amount: 10, currency: 'ZMW', name: 'John Doe', email: 'not-an-email' });
ok('invalid email rejected', !bad6.ok);
const bad7 = payments.validateRequest({ provider: 'paystack', amount: 10, currency: 'ZMW', name: 'J', email: 'john@example.com' });
ok('short name rejected', !bad7.ok);

ok('recurring flag is honoured', payments.validateRequest({ provider: 'paystack', amount: 10, currency: 'ZMW', name: 'John Doe', email: 'john@example.com', recurring: true }).recurring === true);

/* -------------------------------------------------------------- buildTxRef */
const ref = payments.buildTxRef('flutterwave');
ok('tx_ref matches PD-PROVIDER-TIME-RAND pattern', /^PD-(FLU|PAY)-[A-Z0-9]+-[A-Z0-9]+$/.test(ref), ref);
ok('tx_refs are unique', new Set([payments.buildTxRef('paystack'), payments.buildTxRef('paystack'), payments.buildTxRef('paystack')]).size === 3);

/* ----------------------------------------------- Flutterwave webhook hash */
const fwSecret = 'FLWSECK_TEST-abcdef123456';
ok('flutterwave signature accepts the secret hash', payments.verifyFlutterwaveSignature({ 'verif-hash': fwSecret }, fwSecret, ''));
ok('flutterwave signature rejects a wrong hash', !payments.verifyFlutterwaveSignature({ 'verif-hash': 'wrong' }, fwSecret, ''));
ok('flutterwave signature rejects a missing hash', !payments.verifyFlutterwaveSignature({}, fwSecret, ''));

/* -------------------------------------------------- Paystack webhook HMAC */
const psSecret = 'sk_test_0123456789abcdef';
const body = JSON.stringify({ event: 'charge.success', data: { reference: 'PD-PSK-TEST-1', status: 'success' } });
const goodHmac = crypto.createHmac('sha512', psSecret).update(body, 'utf8').digest('hex');
ok('paystack signature accepts the correct HMAC', payments.verifyPaystackSignature({ 'x-paystack-signature': goodHmac }, psSecret, body));
ok('paystack signature rejects a tampered body',
  !payments.verifyPaystackSignature({ 'x-paystack-signature': goodHmac }, psSecret, body + ' '));
ok('paystack signature rejects a wrong secret',
  !payments.verifyPaystackSignature({ 'x-paystack-signature': goodHmac }, 'sk_test_wrong', body));
ok('paystack signature rejects a missing header',
  !payments.verifyPaystackSignature({}, psSecret, body));

/* ---------------------------------------------------------- exports sanity */
ok('function factories exported', ['createPaymentHandler', 'verifyPaymentHandler', 'paymentWebhookHandler']
  .every(k => typeof payments[k] === 'function'));
ok('supported currencies include ZMW and SZL', payments.CURRENCIES.includes('ZMW') && payments.CURRENCIES.includes('SZL'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
