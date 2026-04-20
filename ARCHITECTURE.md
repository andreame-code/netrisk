# NetRisk Architecture

## Principio guida

NetRisk separa in modo netto presentazione, orchestrazione e regole. Il browser non decide mai le regole della partita: il backend valida ogni azione e il motore di gioco contiene la logica pura.

## Stato attuale (aprile 2026)

L'applicazione include già:

- autenticazione (register/login/logout), profilo utente e preferenze tema
- validazione runtime condivisa dei payload auth/profile, lobby e gameplay tra backend e frontend
- layer client API frontend tipizzato per auth, profile, lobby, setup e gameplay
- shell React + Vite che serve le route canoniche utente, con `/react/*` mantenuto come alias supportato e `/legacy/*` come rollback-only
- convenzioni React shell con TanStack Query per route/server state remoto e Zustand limitato a shell/session UI
- route React protette per login, lobby, new game, profile e gameplay core-playable sulle URL canoniche e sugli alias `/react/*`
- osservabilita minima della React shell con Sentry lato browser, release tagging e correlazione request-id verso il backend
- lobby, creazione partita, join player umani e bot AI
- setup partita 2-4 giocatori con mappe supportate
- ciclo turno completo (`reinforcement` -> `attack` -> `fortify` -> `finished`)
- rinforzi, attacco con selezione dadi, conquista, movimento post-conquista, fortifica
- carte territorio con reward a fine turno e scambio carte con bonus progressivo
- trade obbligatorio oltre soglia mano
- eliminazione giocatore, vittoria e resa
- sincronizzazione stato/eventi e controlli di autorizzazione lato route
- gestione conflitti di versione in azioni concorrenti
- runtime moduli con catalogo admin, enable/disable, content pack, preset e defaults server-side

Mappe correnti: `classic-mini`, `middle-earth`, `world-classic`.

## Cartelle principali

`/frontend/src`  
Sorgente TypeScript (`.mts`) della UI web, della shell condivisa, dell'i18n e della manifest static site.

`/frontend/react-shell`  
Shell React + Vite, con alias verso `frontend/src/core` e `shared`, usata sia per le route canoniche sia per il namespace supportato `/react/*`.
Usa TanStack Query per snapshot/mutazioni remote e Zustand solo per stato locale di shell/sessione.

`/frontend/src/core/api`  
Boundary HTTP frontend framework-agnostic: request helpers tipizzati, parsing/validazione condivisa ed error translation per auth, profile, lobby, setup e gameplay.

`/frontend/assets`  
Asset sorgente frontend (mappe e media) sincronizzati nella build pubblica.

`/public`  
Output statico generato della UI (`.html`, `.css`, `.mjs`) effettivamente servito dal runtime applicativo.

`/public/react`  
Output build della shell React, servito dal backend statico come bundle condiviso per le route canoniche e per `/react/*`.

`/backend`  
Server HTTP, autenticazione, autorizzazione, datastore, sessioni di gioco e route API.

`/backend/engine`  
Motore di gioco puro: setup, turn flow, rinforzi, attacchi, combattimento, conquista, carte, fortifica, vittoria, AI.

`/backend/routes`  
Handler route specializzati (auth/account, setup partita, azioni turno/attacco/carte, lettura stato/eventi, overview e management).

`/shared`  
Tipi, modelli dominio, contratti API, mappe e regole condivise tra frontend e backend.

`/modules`  
Moduli NetRisk caricati a runtime per estendere contenuti, preset, profili setup e slot UI.

`/api`  
Entrypoint deploy/serverless che delega al backend compilato.

`/scripts`  
Build pipeline, generatori e check di coerenza/guardrail del repository.

`/tests/gameplay`  
Suite test di regressione e unit/integration per logica di gioco lato engine.

`/e2e`  
Suite Playwright per flussi end-to-end UI + API.

## Moduli engine attuali

- `game-engine.cts`: flusso partita e azioni ad alto livello (incluso trade carte)
- `game-setup.cts`: creazione stato iniziale da mappa e configurazione player
- `reinforcement-calculator.cts`: calcolo rinforzi base + bonus continenti
- `reinforcement-placement.cts`: applicazione rinforzi su territori validi
- `attack-validation.cts`: vincoli di attacco e adiacenza
- `combat-dice.cts`: tiro dadi e confronto risultati
- `combat-resolution.cts`: perdite eserciti da esito dadi
- `conquest-resolution.cts`: gestione conquista e movimento obbligatorio
- `fortify-movement.cts`: validazione/esecuzione fortifica
- `victory-detection.cts`: eliminazione player e determinazione vincitore
- `ai-player.cts`: strategia turno automatica bot
- `banzai-attack.cts`: variante/utility specifica per attacchi ripetuti

## Moduli shared rilevanti

- `models.cts`: export aggregato del dominio condiviso
- `core-domain.cts`: entità core (game state, player, territory, continent)
- `game-actions.cts`: tipi azioni inviate dal client
- `api-contracts.cts`: payload/contratti API condivisi
- `runtime-validation.cts`: schemi runtime condivisi e shape uniforme degli errori di validazione, inclusi i boundary gameplay
- `module-registry.cts`: primitive comune per registry/moduli estendibili
- `cards.cts`: deck, set validi, progressione bonus trade
- `dice.cts`: registry ruleset dadi (incluso `defense-three-dice`)
- `combat-rule-sets.cts`: registry regole combattimento
- `reinforcement-rule-sets.cts`: registry regole rinforzo
- `fortify-rule-sets.cts`: registry vincoli/regole fortifica
- `victory-rule-sets.cts`: registry condizioni di vittoria
- `site-themes.cts`: registry temi supportati
- `player-piece-sets.cts`: registry palette/set pedine giocatore
- `content-packs.cts`: manifest compositi che raggruppano moduli compatibili
- `content-catalog.cts`: catalogo aggregato dei moduli contenuto registrati
- `map-loader.cts` + `continent-loader.cts`: loader/validatori CSV mantenuti per import e verifiche
- `typed-map-data.cts` + `shared/maps/*`: definizioni mappa tipizzate e registry delle mappe supportate
- `map-graph.cts`: adiacenze/supporto topologico mappa
- `messages.cts`: errori e payload localizzati condivisi tra engine, backend e frontend

## Modello di estensibilita

NetRisk deve evolvere tramite moduli registrati, non tramite condizioni sparse nel codice.

Ogni elemento estendibile deve tendere a uno di questi pattern:

- registry shared con `id` stabile e lookup tipizzato
- configurazione partita che salva solo gli `id` dei moduli scelti
- engine/backend che risolvono il modulo attivo dal registry
- frontend che legge summary/manifests e rende selettori o presentazione senza duplicare regole

Quando serve raggruppare un insieme coerente di moduli, si usa un `content pack`:

- identifica un preset o mod pack con id stabile
- definisce default compatibili per tema, mappa, dadi, vittoria, carte e pedine
- permette di aggiungere varianti future senza riscrivere il flusso di setup

Categorie modulo gia impostate:

- temi sito
- set pedine / palette giocatori
- ruleset dadi
- ruleset carte
- ruleset vittoria
- mappe

Categorie future da trattare con lo stesso modello:

- skin pedine e asset grafici
- pacchetti UI/tema avanzati
- modalità partita e setup presets
- AI profiles
- obiettivi personalizzati
- regole opzionali di movimento/combattimento/rinforzo
- regole opzionali di fortifica

## Regole architetturali

- Il frontend gestisce solo rendering, navigazione e input.
- Il backend è la source of truth dello stato partita.
- Le regole non devono essere duplicate tra client e server.
- I modelli condivisi devono restare in `shared`.
- I moduli engine devono essere testabili in isolamento.
- Il frontend può mostrare risultati dadi e stato carte, ma non può risolvere localmente i combattimenti o validare gli scambi.

## Runtime e persistenza

- Runtime backend: Node.js HTTP server (`backend/server.cts`).
- Runtime deploy: entrypoint `api/index.ts` che espone `createApp()` dal backend compilato.
- Pipeline frontend: `frontend/src` viene compilato e materializzato in `public/` tramite gli script di build.
- Pipeline React shell: `frontend/react-shell` viene buildata con Vite in `public/react/`, con `base=/react/` per l'alias namespace e proxy dev `/api` verso `VITE_BACKEND_TARGET`.
- Boundary validation frontend: `frontend/src/core/validated-json.mts` valida le risposte condivise prima del consumo UI.
- Boundary transport frontend: `frontend/src/core/api/http.mts` e `frontend/src/core/api/client.mts` centralizzano `fetch`, body JSON, validazione runtime, session handling, SSE payload parsing ed error translation per auth, profile, lobby, setup e gameplay.
- Frontend observability boundary: il transport layer puo segnalare solo errori inattesi (`network`, `5xx`, payload validi ma fuori schema) tramite il reporter registrato dalla React shell, senza trasformare il frontend legacy in source of truth del monitoraggio.
- React server-state ownership: nella shell React le query remote e le mutazioni stanno in TanStack Query; Zustand non sostituisce il backend e resta confinato a stato locale/sessione della shell.
- Datastore supportati:
  - SQLite locale (default sviluppo)
  - Supabase (quando configurato via env)
- La logica datastore è incapsulata dietro `backend/datastore.cts`.
- Event stream partita via endpoint dedicato e broadcast server-side.
- Correlazione runtime: le risposte `/api/*` espongono `X-Request-Id`; gli errori backend inattesi vengono loggati con `requestId`, route e `release` per facilitare la diagnosi dei problemi emersi dalla shell React.
- Routing statico: `backend/server.cts` risolve le route React canoniche, gli alias `/react/*` e le pagine legacy sotto `/legacy/*` senza sovrapporre frontend diversi.
- Guardrail repository/deploy: controllo env richieste, fallback senza `.git` per i check repository, `outputDirectory: public` su Vercel, `.vercelignore` per evitare upload di artefatti locali e `check-no-js-sources` per la TS-complete allowlist.

## Flusso sintetico applicativo

1. Il client invia azioni o richieste via route backend.
   Per le route React canoniche, per gli alias `/react/*` e per i fallback legacy ancora mantenuti, il client passa attraverso il layer `frontend/src/core/api` invece di fare `fetch` inline nei moduli pagina.
   La shell React riusa lo stesso boundary tipizzato invece di introdurre una seconda logica transport.
2. Il backend autentica/autorizza utente e valida versione stato.
3. Le route delegano al motore (`backend/engine`) la logica di dominio.
4. Il backend salva lo stato e notifica eventuali listener eventi.
5. Il frontend riceve stato/eventi e aggiorna solo la presentazione.

## Obiettivo

Rendere il progetto facile da estendere senza dover riscrivere il codice esistente quando si aggiungono nuove mappe, modalita, AI, multiplayer o regole opzionali.
