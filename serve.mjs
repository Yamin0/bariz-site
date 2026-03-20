import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// Simple in-memory cache for proxied images
const imageCache = new Map();

function proxyYupooImage(urlPath, res) {
  // urlPath is like /yupoo/zzztop/HASH/medium.jpg
  const yupooUrl = 'https://photo.yupoo.com' + urlPath.replace('/yupoo', '');

  // Check cache
  if (imageCache.has(yupooUrl)) {
    const cached = imageCache.get(yupooUrl);
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' });
    res.end(cached);
    return;
  }

  https.get(yupooUrl, {
    headers: {
      'Referer': 'https://zzztop.x.yupoo.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  }, (proxyRes) => {
    if (proxyRes.statusCode !== 200) {
      res.writeHead(proxyRes.statusCode || 502);
      res.end('Proxy error');
      return;
    }
    const chunks = [];
    proxyRes.on('data', chunk => chunks.push(chunk));
    proxyRes.on('end', () => {
      const buffer = Buffer.concat(chunks);
      // Cache up to 500 images (~150MB max)
      if (imageCache.size < 500) {
        imageCache.set(yupooUrl, buffer);
      }
      res.writeHead(200, {
        'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400'
      });
      res.end(buffer);
    });
  }).on('error', () => {
    res.writeHead(502);
    res.end('Proxy error');
  });
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  // Proxy Yupoo images
  if (urlPath.startsWith('/yupoo/')) {
    proxyYupooImage(urlPath, res);
    return;
  }

  let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
