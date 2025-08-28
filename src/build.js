const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
}

module.exports = { hashContent };

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const publicDir = path.join(root, 'public');
  const dist = path.join(root, 'dist');

  if (fs.existsSync(dist)) {
    fs.rmSync(dist, { recursive: true, force: true });
  }
  fs.mkdirSync(dist);

  const assets = ['css/base.css', 'css/layout.css', 'css/components.css', 'css/theme.css', 'css/game.css', 'src/logger.js', 'main.js'];
  const plainAssets = ['map.svg', 'map2.svg', 'map3.svg', 'map-roman.svg', 'src/game.js', 'src/territory-selection.js', 'src/audio.js', 'src/ui.js'];
  const hashed = {};

  for (const asset of assets) {
    let filePath = path.join(root, asset);
    let content = fs.readFileSync(filePath, 'utf8');

    const hash = hashContent(content);
    const ext = path.extname(asset);
    const base = path.basename(asset, ext);
    const newName = `${base}.${hash}${ext}`;
    fs.writeFileSync(path.join(dist, newName), content);
    hashed[asset] = newName;
    hashed[`../${asset}`] = newName;
  }

  for (const asset of plainAssets) {
    const srcPath = path.join(root, asset);
    const destPath = path.join(dist, asset);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
  }
  // Copy additional data files (e.g., map.json)
  fs.cpSync(path.join(root, 'src'), path.join(dist, 'src'), { recursive: true });

  // Copy all HTML files from public/, replacing references to hashed assets
  const htmlFiles = fs
    .readdirSync(publicDir)
    .filter((file) => file.endsWith('.html'));

  for (const file of htmlFiles) {
    let html = fs.readFileSync(path.join(publicDir, file), 'utf8');
    for (const [orig, hashedName] of Object.entries(hashed)) {
      html = html.replace(new RegExp(orig, 'g'), hashedName);
    }
    fs.writeFileSync(path.join(dist, file), html);
  }
}

