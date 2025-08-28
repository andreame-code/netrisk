import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'public',
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'public/index.html'),
        about: resolve(__dirname, 'public/about.html'),
        game: resolve(__dirname, 'public/game.html'),
        lobby: resolve(__dirname, 'public/lobby.html'),
        setup: resolve(__dirname, 'public/setup.html'),
        howToPlay: resolve(__dirname, 'public/how-to-play.html'),
        howto: resolve(__dirname, 'public/howto.html')
      }
    }
  },
  resolve: {
    extensions: ['.js', '.ts']
  }
});
