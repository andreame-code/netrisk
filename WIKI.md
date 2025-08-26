# NetRisk Wiki

This wiki provides extended documentation for the NetRisk project. It covers gameplay, development tips and ways to extend the game.

## Overview
NetRisk is a simple browser-based strategy game inspired by the classic Risk board game. The core gameplay revolves around conquering territories and managing reinforcements.

## Getting Started
1. Install dependencies with `npm install`.
2. Run the development server using `npm start`.
3. Open `http://localhost:8080` to launch the game in your browser.

## Multiplayer
NetRisk includes an experimental WebSocket-based multiplayer mode.

1. Launch the relay server in a separate terminal:

   ```bash
   npm run server
   ```

   This starts a WebSocket server on port 8081.

2. Start the development server with `npm start` if it's not already running.

3. Open `http://localhost:8080` in each player's browser.

4. In the console of every browser tab, enable the multiplayer plugin:

   ```js
   const { default: createWebSocketMultiplayer } = await import("./src/plugins/websocket-multiplayer-plugin.js");
   game.use(createWebSocketMultiplayer("ws://localhost:8081"));
   ```

After all clients execute the snippet, game actions are broadcast to every
connected player, allowing shared matches.

## Gameplay
- Use the setup screen to select human and AI players and to choose the board layout.
  Options include the world map, a Roman Empire-themed map, and a grid-based layout.
- Players receive reinforcements based on the number of territories they control.
- Attack adjacent territories to expand your empire.
- Fortify your position by moving troops between friendly territories at the end of each turn.

## Development
The project is built with modular JavaScript. The `Game` class exposes a plugin system and event bus to allow new features without modifying the core engine.

## Further Resources
Refer to the [README](README.md) for testing instructions and additional details.
