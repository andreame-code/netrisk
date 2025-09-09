#!/usr/bin/env node
// scripts/setup-env.js - Script per configurare l'ambiente di sviluppo

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function setupEnvironment() {
  console.log('🚀 Setup ambiente di sviluppo NetRisk\n');

  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const overwrite = await askQuestion('⚠️  .env.local esiste già. Sovrascrivere? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('✅ Setup annullato');
      rl.close();
      return;
    }
  }

  try {
    console.log('\n📡 Configurazione Supabase:');
    console.log('Puoi trovare questi valori su https://supabase.com/dashboard');
    console.log('Project Settings → API\n');

    const supabaseUrl = await askQuestion('Supabase URL: ');
    const supabaseKey = await askQuestion('Supabase Anon Key: ');

    console.log('\n🔌 Configurazione WebSocket (opzionale):');
    const wsUrl =
      (await askQuestion('WebSocket URL [ws://localhost:8081]: ')) || 'ws://localhost:8081';

    console.log('\n📝 Configurazione logging:');
    const logLevel = (await askQuestion('Log Level [debug/info/warn/error] (debug): ')) || 'debug';

    const envContent =
      `# NetRisk Environment Configuration\n` +
      `# Auto-generated on ${new Date().toISOString()}\n\n` +
      `# Supabase Configuration\n` +
      `VITE_SUPABASE_URL=${supabaseUrl}\n` +
      `VITE_SUPABASE_ANON_KEY=${supabaseKey}\n\n` +
      `# WebSocket Configuration\n` +
      `VITE_WS_URL=${wsUrl}\n\n` +
      `# Development Configuration\n` +
      `VITE_LOG_LEVEL=${logLevel}\n` +
      `VITE_ENABLE_DEBUG=true\n`;

    fs.writeFileSync(envPath, envContent);

    console.log('\n✅ Configurazione completata!');
    console.log(`📄 File creato: ${envPath}`);
    console.log('\n🎮 Comandi disponibili:');
    console.log('  npm run dev     - Avvia il server di sviluppo');
    console.log('  npm run server  - Avvia il WebSocket relay');
    console.log('  npm test        - Esegue i test');
    console.log('  npm run build   - Crea la build di produzione');

    console.log('\n🔍 Verifica configurazione...');
    if (supabaseUrl && supabaseKey) {
      console.log('✅ Supabase: Configurato');
    } else {
      console.log('⚠️  Supabase: Configurazione incompleta - multiplayer disabilitato');
    }
  } catch (error) {
    console.error('❌ Errore durante il setup:', error.message);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  setupEnvironment();
}

module.exports = { setupEnvironment };
