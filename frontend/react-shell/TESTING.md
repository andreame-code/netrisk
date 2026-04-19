# React Shell Testing

- Usa `npm run test:react` per la suite veloce browser-side della React shell.
- Mantieni i mock al boundary `@frontend-core/api/client.mts`; i componenti devono restare reali.
- Metti i test di integrazione route/provider in `src/__tests__/*.integration.test.tsx`.
- Se serve attesa controllata, usa `test/deferred.ts` invece di timeout arbitrari.
- Usa `test/render-react-shell.tsx` per rendere la shell con router, auth provider e `QueryClient` isolato per test.
