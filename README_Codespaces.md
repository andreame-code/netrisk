# NetRisk — Avvio solo online con GitHub Codespaces

1. Apri la pagina del repository su GitHub, premi **Code** e seleziona **Create codespace on &lt;branch&gt;** per generare un ambiente cloud sul ramo desiderato.
2. Attendi che il devcontainer completi la configurazione automatica: il sistema abilita Corepack, imposta `pnpm@10.5.2` e installa tutte le dipendenze necessarie senza interventi locali.
3. Una volta avviata la shell del codespace, esegui `pnpm dev` per far partire in parallelo client Next.js e API NestJS già pronte all'uso.
4. Apri il pannello **Ports**, rendi pubbliche le porte esposte (3000 per il client, 3001 per l'API) e utilizza gli URL `*.github.dev` generati da GitHub per test e condivisione.
5. Se client e server girano su porte diverse, imposta `NEXT_PUBLIC_API_BASE`, `CLIENT_URL` e `API_URL` sugli indirizzi pubblici per mantenere attivi REST e Socket.IO con CORS correttamente configurato.

Note finali: Codespaces fornisce un ambiente completamente online; non è necessario installare Node.js o PNPM in locale. Verifica però che il tuo account GitHub disponga di minuti Codespaces sufficienti e chiudi i workspace inattivi per evitare costi indesiderati.
