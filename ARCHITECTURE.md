# NetRisk Architecture

## Principio guida

NetRisk separa in modo netto presentazione, orchestrazione e regole. Il browser non decide mai le regole della partita: il backend valida ogni azione e il motore di gioco contiene la logica pura.

## Stato attuale (aprile 2026)

L'applicazione include già:

- autenticazione (register/login/logout), profilo utente e preferenze tema
- validazione runtime condivisa dei payload auth/profile tra backend e frontend
- layer client API frontend tipizzato per i flussi migrati `profile` e `lobby`
- lobby, creazione partita, join player umani e bot AI
- setup partita 2-4 giocatori con mappe supportate
- ciclo turno completo (`reinforcement` -> `attack` -> `fortify` -> `finished`)
- rinforzi, attacco con selezione dadi, conquista, movimento post-conquista, fortifica
- carte territorio con reward a fine turno e scambio carte con bonus progressivo
- trade obbligatorio oltre soglia mano
- eliminazione giocatore, vittoria e resa
- sincronizzazione stato/eventi e controlli di autorizzazione lato route
- gestione conflitti di versione in azioni concorrenti

Mappe correnti: `classic-mini`, `middle-earth`, `world-classic`.

## Cartelle principali

`/frontend/src`  
Sorgente TypeScript (`.mts`) della UI web, della shell condivisa, dell'i18n e della manifest static site.

`/frontend/src/core/api`  
Boundary HTTP frontend framework-agnostic: request helpers tipizzati, parsing/validazione condivisa ed error translation per i flussi UI migrati.

`/frontend/assets`  
Asset sorgente frontend (mappe e media) sincronizzati nella build pubblica.

`/public`  
Output statico generato della UI (`.html`, `.css`, `.mjs`) effettivamente servito dal runtime applicativo.

`/backend`  
Server HTTP, autenticazione, autorizzazione, datastore, sessioni di gioco e route API.

`/backend/engine`  
Motore di gioco puro: setup, turn flow, rinforzi, attacchi, combattimento, conquista, carte, fortifica, vittoria, AI.

`/backend/routes`  
Handler route specializzati (auth/account, setup partita, azioni turno/attacco/carte, lettura stato/eventi, overview e management).

`/shared`  
Tipi, modelli dominio, contratti API, mappe e regole condivise tra frontend e backend.

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
- `runtime-validation.cts`: schemi runtime condivisi e shape uniforme degli errori di validazione
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
- Boundary validation frontend: `frontend/src/core/validated-json.mts` valida le risposte condivise prima del consumo UI.
- Boundary transport frontend: `frontend/src/core/api/http.mts` e `frontend/src/core/api/client.mts` centralizzano `fetch`, body JSON, validazione runtime, session handling ed error translation per i flussi `profile` e `lobby`.
- Datastore supportati:
  - SQLite locale (default sviluppo)
  - Supabase (quando configurato via env)
- La logica datastore è incapsulata dietro `backend/datastore.cts`.
- Event stream partita via endpoint dedicato e broadcast server-side.
- Guardrail deploy Vercel: controllo env richieste, fallback senza `.git` per i check repository e `.vercelignore` per evitare upload di artefatti locali.

## Flusso sintetico applicativo

1. Il client invia azioni o richieste via route backend.
   Per i flussi UI gia migrati (`profile` e `lobby`), il client passa attraverso il layer `frontend/src/core/api` invece di fare `fetch` inline nei moduli pagina.
2. Il backend autentica/autorizza utente e valida versione stato.
3. Le route delegano al motore (`backend/engine`) la logica di dominio.
4. Il backend salva lo stato e notifica eventuali listener eventi.
5. Il frontend riceve stato/eventi e aggiorna solo la presentazione.

## Obiettivo

Rendere il progetto facile da estendere senza dover riscrivere il codice esistente quando si aggiungono nuove mappe, modalita, AI, multiplayer o regole opzionali.
