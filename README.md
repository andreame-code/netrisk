# NetRisk

NetRisk e un gioco strategico a turni ispirato a Risk/Risiko. Il progetto e costruito per crescere in modo incrementale, mantenendo separate l'interfaccia utente, la logica di gioco e lo stato autorevole della partita.

## Obiettivo del progetto

Il repository non contiene solo una demo grafica: contiene una base applicativa completa per sviluppare una versione estendibile di NetRisk con:

- lobby e creazione partite
- giocatori umani e AI
- regole dadi configurabili
- carte territorio e scambio set
- flusso di turno strutturato
- rinforzi, attacco, conquista e fortifica
- validazione centralizzata sul backend
- profilo giocatore con statistiche base
- test automatici sia di gameplay sia end-to-end

## Stato attuale del gioco

Oggi il progetto supporta queste capacita:

- registrazione, login, logout e profilo utente
- lobby iniziale e riapertura di partite salvate
- creazione di una nuova partita con mappa supportata e regola dadi selezionabile
- ingresso di giocatori umani e aggiunta di bot AI
- configurazione partite da 2 a 4 giocatori con primo slot umano obbligatorio
- avvio partita e assegnazione iniziale dei territori
- turno diviso in fasi: `reinforcement`, `attack`, `fortify`, `finished`
- scelta del numero di dadi attacco entro i limiti consentiti
- piazzamento rinforzi con controllo proprieta del territorio
- attacco tra territori confinanti con risoluzione del combattimento
- gestione della conquista e dello spostamento armate obbligatorio
- carta territorio assegnata a fine turno se durante il turno e stata effettuata almeno una conquista
- scambio carte durante la fase rinforzi con bonus progressivo
- scambio obbligatorio oltre la soglia mano prevista dal ruleset standard
- fortificazione a fine turno
- rilevamento eliminazione giocatori e vittoria
- pannello UI per ultimo risultato dadi del combattimento
- pagina profilo con partite giocate, vittorie, sconfitte, partite in corso e win rate
- eventi e sincronizzazione dello stato dal server al frontend

La mappa supportata al momento e `classic-mini`.

## Architettura

L'architettura segue un principio semplice: il frontend presenta e invia azioni, il backend decide cosa e valido, i moduli condivisi definiscono il dominio comune.

- `frontend/public`
  Interfaccia web statica: schermate principali, lobby, nuova partita, profilo, pagina di gioco, stile e logica client-side.
- `backend`
  Server HTTP, autenticazione, autorizzazione, salvataggio sessioni di gioco, configurazione nuove partite.
- `backend/engine`
  Regole pure del gioco: setup, rinforzi, validazione attacco, dadi di combattimento, conquista, carte, fortifica, vittoria, AI.
- `shared`
  Modelli, primitive e ruleset condivisi tra livelli applicativi.
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
4. Il giocatore attivo entra nella fase rinforzi e puo anche scambiare 3 carte valide per ottenere rinforzi extra.
5. Il giocatore piazza i rinforzi sui propri territori.
6. Il giocatore puo eseguire attacchi validi contro territori adiacenti nemici, scegliendo i dadi attacco consentiti.
7. Se conquista un territorio, deve spostare armate dal territorio attaccante a quello conquistato.
8. Se durante il turno ha conquistato almeno un territorio, a fine turno riceve una carta dal mazzo, se disponibile.
9. Il turno passa alla fase di fortifica.
10. Il turno termina e il backend calcola il nuovo giocatore attivo.
11. Quando resta un solo giocatore con territori, la partita viene chiusa con vincitore.

## Modelli condivisi

I costrutti condivisi esposti da `shared/models.cjs` sono:

- `TurnPhase`
- `GameAction`
- `CardType`
- `STANDARD_DICE_RULE_SET_ID`
- `STANDARD_CARD_RULE_SET_ID`
- `createPlayer`
- `createTerritory`
- `createContinent`
- `createGameState`
- `createCard`
- `createStandardDeck`
- `getDiceRuleSet`
- `listDiceRuleSets`
- `getCardRuleSet`
- `validateStandardCardSet`

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
- ruleset dadi attivo
- mazzo carte, scarti e mani giocatore
- numero scambi effettuati
- flag di conquista nel turno per assegnazione carta

## Pagine e interfaccia

Le principali schermate disponibili nel frontend sono:

- `index.html`: ingresso applicazione
- `lobby.html`: ingresso giocatori e gestione lobby
- `new-game.html`: configurazione nuova partita
- `game.html`: partita attiva
- `profile.html`: profilo utente

La UI e pensata per restare sottile: mostra lo stato ricevuto dal server e invia azioni tramite API.

Nella schermata di gioco sono presenti anche:

- selettore dadi attacco con default coerente al territorio selezionato
- pannello riepilogo ultimo combattimento con dadi e confronto
- pannello carte del giocatore corrente con selezione set e invio scambio

## API principali

Il server espone endpoint per:

- health check backend e stato datastore
- sessione autenticata
- profilo utente
- elenco partite e apertura partita attiva
- opzioni per la creazione partita
- creazione nuova partita
- join umano e join AI
- scambio carte del giocatore corrente
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
npm run backup:data
npm test
npm run test:gameplay
npm run test:e2e
npm run test:all
npm run test:all:e2e
```

- `npm test`: suite standard del repository
- `npm run backup:data`: crea uno snapshot SQLite consistente in `data/backups/`
- `npm run test:gameplay`: verifica del motore di gioco
- `npm run test:e2e`: test Playwright sui flussi utente
- `npm run test:all`: test repository + gameplay
- `npm run test:all:e2e`: test repository + gameplay + e2e

## Copertura test

La suite `tests/gameplay` copre aree come:

- setup partita
- turn flow
- rinforzi
- validazione attacco, dadi e risoluzione combattimento
- conquista
- fortifica
- vittoria ed eliminazione
- helper carte e trade bonus
- flussi regressivi multi-modulo

La suite `e2e` copre oggi:

- caricamento applicazione
- layout principale
- navigazione auth tra pagine
- stati profilo: loading, errore, empty state
- configurazione nuova partita
- flussi gameplay principali
- scelta dadi attacco e visualizzazione risultato combattimento
- pannello carte, scambio riuscito, errori inline e sincronizzazione reward
- baseline visuali della schermata principale e delle pagine secondarie

## Persistenza e dati locali

Il backend usa SQLite come source of truth locale per:

- utenti
- sessioni autenticate
- partite salvate
- metadati runtime come la partita attiva

Il file database di default e `data/netrisk.sqlite`.

All'avvio, se il database e vuoto, il backend puo importare una sola volta i dati legacy presenti nei file JSON storici (`users.json`, `games.json`, `sessions.json`). Dopo la migrazione, il database SQLite resta la fonte autorevole e i JSON legacy vanno trattati solo come compatibilita temporanea.

Per verificare rapidamente lo stato del backend e dello storage e disponibile `GET /api/health`, che restituisce:

- esito generale `ok`
- tipo storage attivo
- percorso del file SQLite in uso
- conteggi base di utenti, partite e sessioni
- presenza della partita attiva in memoria server

Questa e la sonda minima consigliata per rilevare problemi di avvio, mount errati del volume dati o datastore non disponibile.

Per creare un backup locale consistente del datastore:

```bash
npm run backup:data
```

Il comando usa il meccanismo di backup di SQLite e salva per default uno snapshot timestampato in `data/backups/`. E pensato come base per job schedulati o checkpoint manuali prima di deploy e manutenzioni.

Per limitare la crescita della cartella backup, il comando supporta anche una retention semplice:

```bash
node scripts/backup-datastore.cjs --keep 7
```

Con `--keep N`, dopo la creazione del nuovo snapshot vengono mantenuti solo gli ultimi `N` backup compatibili con lo stesso prefisso file.

## Principi di sviluppo

Il progetto segue queste regole:

- frontend limitato a rendering, input e stato locale di presentazione
- backend come source of truth della partita
- logica di gioco centralizzata in `backend/engine`
- modelli condivisi in `shared`
- modifiche piccole, incrementali e facili da rivedere

## Regole implementate oggi

- Rinforzi minimi pari a 3 armate per turno, con bonus continenti dove applicabile.
- Dadi standard di combattimento: attaccante fino a 3 dadi, difensore fino a 2, pareggio al difensore.
- Carte standard: `infantry`, `cavalry`, `artillery`, `wild`.
- Set validi per lo scambio: tris dello stesso tipo oppure uno per tipo, con jolly usabile come wildcard.
- Progressione bonus scambio standard: `4, 6, 8, 10, 12, 15`, poi incremento di `+5`.
- Scambio forzato quando una mano supera 5 carte nel ruleset standard.

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
