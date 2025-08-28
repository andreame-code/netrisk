const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
}

module.exports = { hashContent };

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const dist = path.join(root, 'dist');

  if (fs.existsSync(dist)) {
    fs.rmSync(dist, { recursive: true, force: true });
  }
  fs.mkdirSync(dist);

  const assets = ['css/base.css', 'css/layout.css', 'css/components.css', 'css/theme.css', 'css/game.css', 'src/logger.js', 'src/main.js'];
  const plainAssets = [
    'maps/map.svg',
    'maps/map2.svg',
    'maps/map3.svg',
    'maps/map-roman.svg',
    'maps/map-manifest.json',
    'src/game.js',
    'src/territory-selection.js',
    'src/audio.js',
    'src/ui.js',
  ];
  const hashed = {};

  for (const asset of assets) {
    const filePath = asset.startsWith('src')
      ? path.join(root, asset)
      : path.join(root, 'public', asset);
    const content = fs.readFileSync(filePath, 'utf8');

    const hash = hashContent(content);
    const ext = path.extname(asset);
    const base = path.basename(asset, ext);
    const newName = `${base}.${hash}${ext}`;
    fs.writeFileSync(path.join(dist, newName), content);
    hashed[asset] = newName;
  }

  for (const asset of plainAssets) {
    const srcPath = asset.startsWith('src')
      ? path.join(root, asset)
      : path.join(root, 'public', asset);
    const destPath = path.join(dist, asset);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
  }
  // Copy additional data files (e.g., map.json)
  fs.cpSync(path.join(root, 'src'), path.join(dist, 'src'), { recursive: true });

  // Copy all HTML files, replacing references to hashed assets
  const pagesDir = path.join(root, 'pages');
  const htmlFiles = fs
    .readdirSync(pagesDir)
    .filter((file) => file.endsWith('.html'));

  for (const file of htmlFiles) {
    let html = fs.readFileSync(path.join(pagesDir, file), 'utf8');
    for (const [orig, hashedName] of Object.entries(hashed)) {
      html = html.replace(new RegExp(orig, 'g'), hashedName);
    }
    const dest = path.join(dist, 'pages', file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, html);
  }
}

