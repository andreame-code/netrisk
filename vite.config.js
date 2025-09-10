import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';

  return {
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
          about: resolve(__dirname, 'about.html'),
          game: resolve(__dirname, 'game.html'),
          lobby: resolve(__dirname, 'lobby.html'),
          setup: resolve(__dirname, 'setup.html'),
          howToPlay: resolve(__dirname, 'how-to-play.html'),
          login: resolve(__dirname, 'login.html'),
          forgot: resolve(__dirname, 'forgot.html'),
          register: resolve(__dirname, 'register.html'),
          account: resolve(__dirname, 'account.html'),
        },
      },
    },

    resolve: {
      alias: {
        '@app': resolve(__dirname, 'src'),
        '@game': resolve(__dirname, 'src/game'),
        '@features': resolve(__dirname, 'src/features'),
        '@shared': resolve(__dirname, 'src/shared'),
        '@infra': resolve(__dirname, 'src/infra'),
      },
    },

    plugins: [],

    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },

    optimizeDeps: {
      include: ['@supabase/supabase-js'],
    },
  };
});
