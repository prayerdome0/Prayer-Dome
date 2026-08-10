'use strict';

/**
 * Lightweight deployment probe for Vercel and external uptime checks.
 * It deliberately has no network or package dependencies.
 */
module.exports = function health(req, res) {
  const method = (req && req.method) || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
  }

  const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'local';
  const payload = JSON.stringify({
    ok: true,
    service: 'prayer-dome',
    revision: sha === 'local' ? sha : sha.slice(0, 12),
    environment: process.env.VERCEL_ENV || 'local',
    region: process.env.VERCEL_REGION || null
  });

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (method === 'HEAD') return res.end();
  return res.end(payload);
};
