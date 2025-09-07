#!/usr/bin/env node

const fs = require('fs');
const { readFile, writeFile } = require('fs/promises');

async function generate() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const stamp = process.env.STAMP || 'dev';
  const sha = process.env.SHA || 'dev';

  let content;
  if (url && anonKey) {
    content = [
      'window.__env = {',
      `  SUPABASE_URL: "${url}",`,
      `  SUPABASE_ANON_KEY: "${anonKey}",`,
      `  STAMP: "${stamp}",`,
      `  SHA: "${sha}",`,
      '};',
      '',
    ].join('\n');
  } else if (fs.existsSync('env.dev.js')) {
    content = await readFile('env.dev.js', 'utf8');
  } else {
    content = 'window.__env = {}\n';
  }

  await writeFile('env.js', content, 'utf8');
}

generate().catch((err) => {
  console.error('Failed to generate env.js', err);
  process.exit(1);
});
