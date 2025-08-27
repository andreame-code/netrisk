const fs = require('fs');
const path = require('path');

function generateEnv(targetDir) {
  const envContent = `window.__ENV = window.__ENV || {\n  SUPABASE_URL: '${process.env.SUPABASE_URL || ''}',\n  SUPABASE_ANON_KEY: '${process.env.SUPABASE_ANON_KEY || ''}',\n  WS_URL: '${process.env.WS_URL || ''}'\n};\n`;
  fs.writeFileSync(path.join(targetDir, 'env.js'), envContent);
}

if (require.main === module) {
  const dir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..');
  generateEnv(dir);
}

module.exports = generateEnv;
