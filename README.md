# NetRisk

NetRisk e un gioco strategico a turni ispirato a Risk/Risiko. Il progetto e costruito per crescere in modo incrementale, mantenendo separate l'interfaccia utente, la logica di gioco e lo stato autorevole della partita.

## Obiettivo del progetto

Il repository non contiene solo una demo grafica: contiene una base applicativa completa per sviluppare una versione estendibile di NetRisk con:

- lobby e creazione partite
- giocatori umani e AI
- flusso di turno strutturato
- rinforzi, attacco, conquista e fortifica
- validazione centralizzata sul backend
- test automatici sia di gameplay sia end-to-end

## Stato attuale del gioco

Oggi il progetto supporta queste capacita:

- registrazione, login, logout e profilo utente
- lobby iniziale e riapertura di partite salvate
- creazione di una nuova partita con mappa supportata
- ingresso di giocatori umani e aggiunta di bot AI
- avvio partita e assegnazione iniziale dei territori
- turno diviso in fasi: `reinforcement`, `attack`, `fortify`, `finished`
- piazzamento rinforzi con controllo proprieta del territorio
- attacco tra territori confinanti con risoluzione del combattimento
- gestione della conquista e dello spostamento armate obbligatorio
- fortificazione a fine turno
- rilevamento eliminazione giocatori e vittoria
- eventi e sincronizzazione dello stato dal server al frontend

La mappa supportata al momento e `classic-mini`.

## Architettura

L'architettura segue un principio semplice: il frontend presenta e invia azioni, il backend decide cosa e valido, i moduli condivisi definiscono il dominio comune.

- `frontend/public`
  Interfaccia web statica: schermate principali, lobby, nuova partita, profilo, pagina di gioco, stile e logica client-side.
- `backend`
  Server HTTP, autenticazione, autorizzazione, salvataggio sessioni di gioco, configurazione nuove partite.
- `backend/engine`
  Regole pure del gioco: setup, rinforzi, validazione attacco, combattimento, conquista, fortifica, vittoria, AI.
- `shared`
  Modelli e primitive condivise tra livelli applicativi.
- `tests/gameplay`
  Test focalizzati sulla logica del motore di gioco.
- `e2e`
  Test Playwright sui flussi utente principali.
- `scripts`
  Script di esecuzione locale e test.

## Flusso di gioco

Una partita tipica segue questo percorso:

1. L'utente crea o apre una partita.
2. I giocatori umani entrano nella lobby e opzionalmente vengono aggiunti bot AI.
3. Il backend avvia la partita, distribuisce i territori e inizializza il turno corrente.
4. Il giocatore attivo riceve i rinforzi e li piazza sui propri territori.
5. Il giocatore puo eseguire attacchi validi contro territori adiacenti nemici.
6. Se conquista un territorio, deve spostare armate dal territorio attaccante a quello conquistato.
7. Il turno passa alla fase di fortifica.
8. Il turno termina e il backend calcola il nuovo giocatore attivo.
9. Quando resta un solo giocatore con territori, la partita viene chiusa con vincitore.

## Modelli condivisi

I costrutti condivisi esposti da `shared/models.cjs` sono:

- `TurnPhase`
- `GameAction`
- `createPlayer`
- `createTerritory`
- `createContinent`
- `createGameState`

Lo stato di gioco contiene in particolare:

- fase globale della partita
- fase del turno corrente
- elenco giocatori
- stato dei territori
- continenti e bonus
- indice del giocatore attivo
- pool di rinforzi
- eventuale vincitore
- log delle azioni
- eventuale conquista in attesa di completamento

## Pagine e interfaccia

Le principali schermate disponibili nel frontend sono:

- `index.html`: ingresso applicazione
- `lobby.html`: ingresso giocatori e gestione lobby
- `new-game.html`: configurazione nuova partita
- `game.html`: partita attiva
- `profile.html`: profilo utente

La UI e pensata per restare sottile: mostra lo stato ricevuto dal server e invia azioni tramite API.

## API principali

Il server espone endpoint per:

- sessione autenticata
- profilo utente
- elenco partite e apertura partita attiva
- opzioni per la creazione partita
- creazione nuova partita
- join umano e join AI
- avvio partita
- invio azioni di gioco
- lettura stato corrente ed eventi

In ambiente E2E esistono anche endpoint di supporto ai test.

## Avvio locale

Prerequisiti:

- Node.js
- npm

Installazione dipendenze:

```bash
npm install
```

Avvio server:

```bash
npm start
```

Applicazione disponibile su `http://localhost:3000`.

## Comandi utili

```bash
npm start
npm test
npm run test:gameplay
npm run test:e2e
npm run test:all
npm run test:all:e2e
```

- `npm test`: suite standard del repository
- `npm run test:gameplay`: verifica del motore di gioco
- `npm run test:e2e`: test Playwright sui flussi utente
- `npm run test:all`: test repository + gameplay
- `npm run test:all:e2e`: test repository + gameplay + e2e

## Copertura test

La suite `tests/gameplay` copre aree come:

- setup partita
- turn flow
- rinforzi
- validazione attacco e risoluzione combattimento
- conquista
- fortifica
- vittoria ed eliminazione
- flussi regressivi multi-modulo

La suite `e2e` copre oggi:

- caricamento applicazione
- layout principale
- navigazione auth tra pagine
- configurazione nuova partita
- flussi gameplay principali
- una baseline visuale della schermata principale

## Persistenza e dati locali

Il backend salva dati runtime locali, come sessioni di gioco e dati utente, in file usati durante l'esecuzione. Questa scelta e adatta allo sviluppo locale e rende semplice sostituire in futuro il layer di persistenza.

## Principi di sviluppo

Il progetto segue queste regole:

- frontend limitato a rendering, input e stato locale di presentazione
- backend come source of truth della partita
- logica di gioco centralizzata in `backend/engine`
- modelli condivisi in `shared`
- modifiche piccole, incrementali e facili da rivedere

## Roadmap naturale del progetto

L'evoluzione prevista del gioco e:

1. architettura e modelli
2. mappa e territori
3. turn flow
4. reinforcement rules
5. combat rules
6. movement rules
7. victory conditions
8. AI
9. multiplayer
10. map editor e regole custom

## Documenti correlati

- `ARCHITECTURE.md`: sintesi dell'organizzazione tecnica
- `tests/gameplay/README.md`: panoramica dei test di gameplay
- `e2e/README.md`: panoramica dei test end-to-end
