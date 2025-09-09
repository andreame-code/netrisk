import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isDev = mode === 'development';

  return {
    // Necessario per GitHub Pages repo "netrisk"
    base: '/netrisk/',

    server: {
      port: 8080,
      host: true,
      open: isDev,
    },

    build: {
      outDir: 'dist',
      sourcemap: isDev,
      minify: !isDev,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          setup: resolve(__dirname, 'setup.html'),
        },
      },
    },

    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        // '@assets': resolve(__dirname, 'assets'), // abilita solo se esiste
        '@components': resolve(__dirname, 'src/components'),
        '@utils': resolve(__dirname, 'src/utils'),
      },
    },

    plugins: [],

    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },

    optimizeDeps: {
      include: ['@supabase/supabase-js'], // pacchetto corretto
    },
  };
});
