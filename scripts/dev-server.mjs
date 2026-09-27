// Local preview of the public build and dependency-free Vercel handlers.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ROOT = fileURLToPath(new URL('../dist/', import.meta.url));
const PORT = process.env.PORT || 8000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf', '.ico': 'image/x-icon', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };

function resolveFile(pathname) {
  const path = resolve(ROOT, '.' + pathname);
  if (!path.startsWith(resolve(ROOT) + sep)) return null;
  return [path, path + '.html', join(path, 'index.html')]
    .find(candidate => existsSync(candidate) && statSync(candidate).isFile());
}

const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const url = new URL(req.url, 'http://preview');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('\0') || pathname.includes('\\')) {
      res.writeHead(400); return res.end('Bad request');
    }
    if (pathname.startsWith('/api/')) {
      const name = pathname.slice(5).replace(/\.js$/, '');
      if (!/^[a-z-]+$/.test(name) || !existsSync(new URL(`../api/${name}.js`, import.meta.url))) {
        res.writeHead(404); return res.end('Not found');
      }
      req.query = Object.fromEntries(url.searchParams);
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 128 * 1024) { res.writeHead(413); return res.end('Body too large'); }
      }
      if (body) {
        try { req.body = JSON.parse(body); }
        catch { res.writeHead(400); return res.end('Invalid JSON'); }
      }
      await require(`../api/${name}.js`)(req, res);
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end();
    }
    const file = resolveFile(pathname === '/' ? '/index.html' : pathname);
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      if (req.method === 'HEAD') return res.end();
      return createReadStream(join(ROOT, '404.html')).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  } catch (error) {
    if (!res.headersSent) res.writeHead(error instanceof URIError ? 400 : 500);
    res.end('Request failed');
    if (!(error instanceof URIError)) console.error(error);
  }
}).listen(PORT, '0.0.0.0', () => console.log(`Prayer Dome preview on port ${server.address().port}`));
