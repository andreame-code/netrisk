import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: 'public/index.html',
        about: 'public/about.html',
        game: 'public/game.html',
        lobby: 'public/lobby.html',
        setup: 'public/setup.html',
        howToPlay: 'public/how-to-play.html',
        howto: 'public/howto.html'
      }
    }
  },
  resolve: {
    extensions: ['.js', '.ts']
  }
});
