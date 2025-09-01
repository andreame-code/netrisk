import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: resolve(__dirname, ".."),
  base: "./",
  build: {
    polyfillModulePreload: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "../index.html"),
        about: resolve(__dirname, "../about.html"),
        game: resolve(__dirname, "../game.html"),
        lobby: resolve(__dirname, "../lobby.html"),
        setup: resolve(__dirname, "../setup.html"),
        howToPlay: resolve(__dirname, "../how-to-play.html"),
        login: resolve(__dirname, "../login.html"),
        forgot: resolve(__dirname, "../forgot.html"),
        register: resolve(__dirname, "../register.html"),
        account: resolve(__dirname, "../account.html"),
      },
    },
  },
  resolve: {
    extensions: [".js", ".ts"],
    alias: {
      "@app": resolve(__dirname, "../src"),
      "@game": resolve(__dirname, "../src/game"),
      "@features": resolve(__dirname, "../src/features"),
      "@shared": resolve(__dirname, "../src/shared"),
      "@infra": resolve(__dirname, "../src/infra"),
    },
  },
});
