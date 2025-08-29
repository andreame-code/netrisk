const http = require('http');
const { readFile } = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const distDir = path.join(__dirname, 'dist');

const routes = {
  '/': 'index.html',
  '/setup': 'setup.html',
  '/how-to-play': 'how-to-play.html',
  '/game': 'game.html'
};

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  if (req.method === 'POST' && (urlPath === '/api/register' || urlPath === '/api/login')) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const { username, password } = JSON.parse(body || '{}');
        if (!username || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Username and password required' }));
          return;
        }
        if (urlPath === '/api/register') {
          const hash = await bcrypt.hash(password, 10);
          const response = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_SERVICE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ username, password_hash: hash }),
          });
          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message || 'Registration failed' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/users?select=password_hash&username=eq.${encodeURIComponent(username)}`,
          {
            headers: {
              apikey: SUPABASE_SERVICE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            },
          }
        );
        const rows = await response.json();
        const valid = rows.length > 0 && (await bcrypt.compare(password, rows[0].password_hash));
        if (!valid) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid username or password' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server error' }));
      }
    });
    return;
  }

  let fileName = routes[urlPath] || urlPath;
  fileName = fileName.replace(/^\/+/, '');
  const filePath = path.resolve(distDir, fileName);
  if (!filePath.startsWith(distDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

