# netrisk

A simple browser-based strategy game inspired by the classic game of Risk.

The entry point is a full-screen home menu that lets you start a match,
read the tutorial, or learn more about the project before diving in.

Use the setup interface (`setup.html` or the "Set up players" link on the
main page) to choose how many human players and AI opponents participate in
each match, making both solo and multiplayer games possible.
Reinforcements are calculated based on the number
of territories a player owns and the fortify phase allows moving troops between
adjacent friendly territories.

Before starting a game you can now choose between different board layouts via
the setup screen. Available boards include the classic world map, a Roman
Empire era map, and a new grid-based layout for abstract play.

The interface features a simple world map background in place of the old grid,
and attack or conquest actions trigger short animations and audio cues for
better feedback.

Combat uses multiple dice rolls for both attacker and defender, with roll results displayed on screen for more strategic play.

## AI Profiles

During setup you can choose how computer opponents behave. Select a difficulty
level (Easy, Normal, or Hard) and a style (Aggressive, Balanced, or Defensive).
Difficulty influences how risky the AI plays and how often it uses cards, while
style adjusts reinforcement priorities and aggression. The chosen profile is
shown next to each AI's name during the game.

## Sviluppo locale

Per configurare e avviare l'ambiente di sviluppo locale:

```bash
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npm ci
npm run dev
```

Apri `http://localhost:8080` nel browser.

## Test

Esegui la suite di test e i controlli di lint per verificare le modifiche:

```bash
npm test
npm run lint
```

Per valutare l'equilibrio dell'IA, esegui una serie di partite automatizzate:

```
npm run simulate
```

## Deploy

Genera la build destinata alla produzione:

```bash
npm run build
```

Il deploy su GitHub Pages è gestito automaticamente tramite GitHub Actions.

## Multiplayer

NetRisk ships with a very small WebSocket relay and a plugin that keeps the
game state in sync across browser tabs or machines.

1. Start the regular development server:

   ```bash
   npm run dev
   ```

2. In another terminal, launch the relay server (defaults to port 8081):

   ```bash
   npm run server
   ```

3. Open `http://localhost:8080` in each player's browser.

4. In the developer console of every client, enable the multiplayer plugin:

   ```js
   const { default: createWebSocketMultiplayer } = await import("./src/plugins/websocket-multiplayer-plugin.js");
   game.use(createWebSocketMultiplayer("ws://localhost:8081"));
   ```

Once the snippet runs in each browser, any action taken by one player will
propagate to all connected clients in real time.

## Extensibility

The core `Game` class exposes a lightweight event bus and plugin system to
support game expansions. Plugins are simple functions that receive the game
instance and can register handlers for events such as `reinforce`,
`attackResolved` or `phaseChange`.

```javascript
import Game from './game.js';
import loggerPlugin from './src/plugins/logger-plugin.js';

const game = new Game();
game.use(loggerPlugin);
```

This structure keeps the engine small while making it straightforward to add
new behaviours or UI integrations without touching the core logic.

## Contributing

Contributions are welcome! Fork the repository and open a pull request with
your changes. Please run the test suite and linter before submitting:

```bash
npm test
npm run lint
```

## Wiki

More detailed documentation, including gameplay notes and development tips,
is available in the [project wiki](WIKI.md).

## UAT Debug

The client exposes a basic logger wrapping the browser console with `info`, `warn` and `error` levels. An error overlay appears at the top of the page when an uncaught exception or unhandled promise rejection occurs.

To test the overlay, use the **Force Error** button in the demo which throws an intentional error.
