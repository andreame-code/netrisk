# netrisk

A simple browser-based strategy game inspired by the classic game of Risk.

The setup interface allows choosing how many human players and AI opponents
participate in each match, making both solo and multiplayer games possible.
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

## UAT Debug

The client exposes a basic logger wrapping the browser console with `info`, `warn` and `error` levels. An error overlay appears at the top of the page when an uncaught exception or unhandled promise rejection occurs.

To test the overlay, use the **Force Error** button in the demo which throws an intentional error.
