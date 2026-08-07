// Minimal static preview server for Prayer Dome.
// Serves files from the repo root and falls back to <path>.html for clean
// URLs (mirroring the Firebase/Vercel rewrites). Dev use only.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = process.env.PORT || 8000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown; charset=utf-8',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

function resolveFile(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let p = join(ROOT, clean);
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (existsSync(p) && statSync(p).isFile()) return p;
  if (!extname(p) && existsSync(p + '.html')) return p + '.html';
  if (!extname(p) && existsSync(join(p, 'index.html'))) return join(p, 'index.html');
  return null;
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const file = resolveFile(url.pathname === '/' ? '/index.html' : url.pathname);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(PORT, '0.0.0.0', () => console.log(`Prayer Dome preview on http://0.0.0.0:${PORT}`));
