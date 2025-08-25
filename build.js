const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const dist = path.join(root, 'dist');

if (fs.existsSync(dist)) {
  fs.rmSync(dist, { recursive: true, force: true });
}
fs.mkdirSync(dist);

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
}

const assets = ['map.svg', 'style.css', 'logger.js', 'game.js', 'script.js', 'territory-selection.js'];
const hashed = {};

// First process map.svg to know its hashed name
for (const asset of assets) {
  let filePath = path.join(root, asset);
  let content = fs.readFileSync(filePath, 'utf8');

  if (asset === 'territory-selection.js') {
    // replace map.svg reference with hashed name
    content = content.replace(/map\.svg/g, hashed['map.svg']);
  }

  const hash = hashContent(content);
  const ext = path.extname(asset);
  const base = path.basename(asset, ext);
  const newName = `${base}.${hash}${ext}`;
  fs.writeFileSync(path.join(dist, newName), content);
  hashed[asset] = newName;
}

let indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

for (const [orig, hashedName] of Object.entries(hashed)) {
  indexHtml = indexHtml.replace(new RegExp(orig, 'g'), hashedName);
}

fs.writeFileSync(path.join(dist, 'index.html'), indexHtml);

