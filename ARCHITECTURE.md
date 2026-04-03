# NetRisk Architecture

## Principio guida

NetRisk separa in modo netto presentazione, orchestrazione e regole. Il browser non decide mai le regole della partita: il backend valida ogni azione e il motore di gioco contiene la logica pura.

## Cartelle principali

`/frontend/public`
UI web, pagine HTML, script client-side, rendering stato e input utente.

`/backend`
Server HTTP, autenticazione, autorizzazione, sessioni di gioco, configurazione partite e persistenza locale.

`/backend/engine`
Motore di gioco puro. Qui vivono setup, turni, rinforzi, dadi di combattimento, attacchi, conquista, carte, fortifica, vittoria e comportamento AI.

`/shared`
Tipi, modelli, carte e ruleset dadi riutilizzati tra frontend e backend.

## Moduli engine attuali

- `game-engine.cjs`: flusso principale della partita e azioni ad alto livello
- `game-setup.cjs`: creazione stato iniziale a partire da mappa e giocatori
- `reinforcement-calculator.cjs`: calcolo rinforzi e bonus continenti
- `reinforcement-placement.cjs`: applicazione rinforzi
- `combat-dice.cjs`: tiro e confronto puro dei dadi di combattimento
- `attack-validation.cjs`: validazione attacchi
- `combat-resolution.cjs`: risoluzione dadi e perdite
- `conquest-resolution.cjs`: trasferimento armate dopo una conquista
- `fortify-movement.cjs`: movimento di fortifica
- `victory-detection.cjs`: eliminazione e vittoria
- `ai-player.cjs`: scelte automatiche del bot

## Moduli shared rilevanti

- `core-domain.cjs`: stato di gioco, giocatore, territorio e continente
- `dice.cjs`: registry dei ruleset dadi
- `cards.cjs`: tipi carta, validazione set e progressione bonus
- `models.cjs`: punto di export condiviso

## Regole architetturali

- Il frontend gestisce solo rendering, navigazione e input.
- Il backend e la source of truth dello stato partita.
- Le regole non devono essere duplicate tra client e server.
- I modelli condivisi devono restare in `shared`.
- I moduli engine devono essere testabili in isolamento.
- Il frontend puo mostrare risultati dadi e stato carte, ma non puo risolvere localmente i combattimenti o validare gli scambi.

## Obiettivo

Rendere il progetto facile da estendere senza dover riscrivere il codice esistente quando si aggiungono nuove mappe, modalita, AI, multiplayer o regole opzionali.
