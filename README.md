# netrisk

A simple browser-based strategy game inspired by the classic game of Risk.

Use the setup interface (`setup.html` or the "Imposta giocatori" link on the
main page) to choose how many human players and AI opponents participate in
each match, making both solo and multiplayer games possible.
Reinforcements are calculated based on the number
of territories a player owns and the fortify phase allows moving troops between
adjacent friendly territories.

The interface features a simple world map background in place of the old grid,
and attack or conquest actions trigger short animations and audio cues for
better feedback.

Combat uses multiple dice rolls for both attacker and defender, with roll results displayed on screen for more strategic play.

## Development

Install dependencies and run the game locally:

```bash
npm install
npm start
```

Open `http://localhost:8080` in your browser.

## Testing

Run the test suite and lint checks to verify changes:

```bash
npm test
npm run lint
```

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

## UAT Debug

The client exposes a basic logger wrapping the browser console with `info`, `warn` and `error` levels. An error overlay appears at the top of the page when an uncaught exception or unhandled promise rejection occurs.

To test the overlay, use the **Force Error** button in the demo which throws an intentional error.
