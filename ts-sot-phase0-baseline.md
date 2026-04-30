# Baseline Fase 0 - Source of Truth in TypeScript

Nota: questo file descrive un checkpoint storico della fase 0 sul branch `codex/ts-sot-phase0`. Non rappresenta il gate corrente del repository; per lo stato attuale fare riferimento a `README.md`, `ARCHITECTURE.md` e ai check della PR attiva.
Il gate corrente include anche `npm run check:ts-sources`, che rifiuta nuove sorgenti non TypeScript fuori allowlist.

Data: 2026-04-12

Branch: `codex/ts-sot-phase0`

Comandi eseguiti

- `npm run build:ts`
- `npm test`
- `npm run test:gameplay`

Esito

- `npm run build:ts`: **PASS**
- `npm test`: **PASS** (90 test superati)
- `npm run test:gameplay`: **PASS** (59 test superati)

Vincoli e note

- Nessuna modifica funzionale introdotta in questa fase.
- Stato file non ancora normalizzato a TS nel codice sorgente completo; sono presenti conversioni parziali in corso.
- Stato corrente del repository e risultati raccolti come checkpoint per le micro-PR successive.

Snapshot stato

- Stato git non pulito con conversioni in corso (file `.cjs/.js` con nuovi equivalenti `.cts/.ts` in più aree).
