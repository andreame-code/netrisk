const http = require('http');
const { readFile } = require('fs/promises');
const path = require('path');

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

