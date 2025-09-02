# AGENTS.md

## Stile e convenzioni

- I nomi dei file devono essere in **kebab-case** (tutto minuscolo, parole separate da trattini).
- Usa Prettier per formattare il codice: `npx prettier --write <file>`.
- Usa ESLint per controllare lo stile: `npm run lint`.

## Verifiche da eseguire prima del commit

Esegui tutti i seguenti comandi e risolvi eventuali errori:

```bash
npm test          # unit/integration
npm run lint      # eslint + prettier
npm run type-check
npm run test:uat  # suite Playwright di UAT
```

Per modifiche che impattano il flusso end-to-end:

```bash
npm run test:e2e:smoke   # test rapidi di regressione
# oppure
npm run test:e2e:full    # suite completa con visual regression
```

## Linee guida generali

- Mantieni commit piccoli e descrittivi.
- Se aggiungi dipendenze o tocchi la build, verifica che `npm run build` funzioni.
- Segui le istruzioni in `docs/ci.md` se modifichi pipeline o workflow CI/CD.
