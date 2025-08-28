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

### Configurare i secret per Supabase

Per permettere al client di connettersi a Supabase durante il deploy, è
necessario definire alcuni secret in GitHub:

- `SUPABASE_URL` – l'URL del progetto Supabase.
- `SUPABASE_ANON_KEY` – la chiave anon del progetto.

Questi secret vengono usati durante la build (`VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY`) e devono essere presenti nell'ambiente
`github-pages`. Se si desidera distribuire anche le Edge Function, è
necessario configurare inoltre `SUPABASE_PROJECT_REF` e `SUPABASE_ACCESS_TOKEN`
per il workflow `supabase-deploy.yml`.

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
   const { WS_URL } = await import("./src/config.js");
   const { default: createWebSocketMultiplayer } = await import("./src/plugins/websocket-multiplayer-plugin.js");
   game.use(createWebSocketMultiplayer(WS_URL));
   ```

Once the snippet runs in each browser, any action taken by one player will
propagate to all connected clients in real time.

### Lobby server API

`multiplayer-server.js` also provides a simple lobby system used to create
matches and keep players synchronized. Clients exchange JSON messages over a
WebSocket connection. The most important message types are:

- `createLobby` – `{ type, player, maxPlayers, map? }` creates a new lobby and
  returns a `lobby` message containing the lobby `code`, `host`, current
  `players`, `maxPlayers` and the selected `map` if any.
- `joinLobby` – `{ type, code, player }` joins an existing lobby.
- `leaveLobby` – `{ type, code, id }` removes a player from a lobby.
- `selectMap` – `{ type, code, id, map }` can be sent by the host to choose the
  board; all clients receive an updated `lobby` message with the `map` field.
- `ready` – `{ type, code, id, ready }` toggles a player's ready state.
- `start` – `{ type, code, id, state }` starts the match once everyone is
  ready and at least two players have joined.
- `state` – `{ type, code, id, state }` updates the authoritative game state
  during play.
- `chat` – `{ type, code, id, text }` broadcasts a chat message.
- `reconnect` – `{ type, code, id }` lets a disconnected player rejoin and
  receive the latest state.
- `heartbeat` – `{ type, code, id }` keeps a connection alive; absence of
  heartbeats or a closed socket marks players offline.

Every `lobby` broadcast includes the lobby `code`, host id, list of players with
their readiness and connection status, the selected `map` and the configured
`maxPlayers`. Disconnected players stay visible as offline for a few minutes to
allow reconnection.

If a lobby fills up (max 6 players) a `joinLobby` request will return an
`error` message with `error: "lobbyFull"`. Joining a lobby that has started or
was closed results in `error: "lobbyNotOpen"`.

All lobby information is persisted in Supabase and relayed by the server so
that peers never communicate directly with one another.

## Supabase

Per un backend server authoritativo è disponibile una integrazione con [Supabase](https://supabase.com/).
Per configurarla:

1. **Installa e autentica la CLI**

   ```bash
   npm install -g supabase
   supabase login
   ```

2. **Collega la CLI al progetto**

   ```bash
   supabase link --project-ref <project-ref>
   ```

3. **Applica le migrazioni**

   ```bash
   supabase db push
   ```

   Questo crea le tabelle definite in `supabase/migrations`.

4. **Distribuisci la funzione Edge**

   ```bash
   supabase functions deploy netrisk
   ```

5. **Imposta la chiave anon**

   Prima di avviare il client fornisci la chiave anon del progetto
   (Dashboard → Settings → API):

   ```bash
   export SUPABASE_KEY=<anon-key>
   npm run dev
   ```

Facoltativamente puoi avviare tutto in locale con `supabase start` e
`supabase functions serve netrisk`.

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
