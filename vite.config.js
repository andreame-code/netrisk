import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: 'pages/index.html',
        about: 'pages/about.html',
        game: 'pages/game.html',
        lobby: 'pages/lobby.html',
        setup: 'pages/setup.html',
        howToPlay: 'pages/how-to-play.html',
        howto: 'pages/howto.html'
      }
    }
  },
  resolve: {
    extensions: ['.js', '.ts']
  }
});
