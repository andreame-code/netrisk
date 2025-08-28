import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        about: 'about.html',
        game: 'game.html',
        lobby: 'lobby.html',
        setup: 'setup.html',
        howToPlay: 'how-to-play.html',
        howto: 'howto.html'
      }
    }
  }
});
