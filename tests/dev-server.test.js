'use strict';
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const server = spawn(process.execPath, ['scripts/dev-server.mjs'], {
  env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit']
});
(async () => {
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Preview did not start')), 10000);
    server.once('error', reject);
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Preview exited: ${code}`)); });
    server.stdout.on('data', data => {
      const match = String(data).match(/port (\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  const base = `http://127.0.0.1:${port}`;
  const request = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
  for (const [path, status] of [['/', 200], ['/lessons', 200], ['/api/health', 200],
    ['/api/news', 200], ['/package.json', 404], ['/functions/index.js', 404],
    ['/firestore.rules', 404], ['/%E0%A4%A', 400], ['/%2e%2e%2fpackage.json', 404]]) {
    const response = await request(base + path);
    assert.equal(response.status, status, path);
    await response.text();
  }
  const head = await request(base + '/', { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  assert.equal((await request(base + '/', { method: 'POST' })).status, 405);
  assert.equal((await request(base + '/api/translate', { method: 'POST', body: '{' })).status, 400);
  const translate = await request(base + '/api/translate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lang: 'invalid', texts: ['hello'] })
  });
  assert.equal(translate.status, 400);
  assert.equal((await translate.json()).ok, false);
  console.log('Preview HTTP and private-file isolation checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  const exited = once(server, 'exit'); server.kill(); await exited;
});
