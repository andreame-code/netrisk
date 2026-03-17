# Gameplay Tests

Questa suite copre il comportamento del backend engine e delle regole di gioco, separatamente dai test E2E Playwright.

## Comando

`npm run test:gameplay`

## Struttura

- `helpers`: builder e random deterministico
- `setup`: inizializzazione partita
- `turn-flow`: transizioni di fase e turno
- `reinforcement`: calcolo e piazzamento rinforzi
- `combat`: validazione attacco e risoluzione dadi
- `conquest`: conquista e trasferimento armate
- `fortify`: movimento di fortifica
- `victory`: eliminazione e vittoria
- `regression`: flow rappresentativi multi-modulo
