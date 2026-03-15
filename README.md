# Frontline Dominion

MVP multiplayer via browser ispirato a Risk, pensato come base di partenza.

## Cosa include

- lobby condivisa con fino a 4 giocatori
- aggiornamenti live via Server-Sent Events
- mappa semplificata con 9 territori
- turni, rinforzi, attacchi e condizione di vittoria
- nessuna dipendenza esterna

## Avvio

```bash
npm start
```

Poi apri `http://localhost:3000` in piu browser o tab.

## Regole MVP

- in lobby, almeno 2 giocatori possono entrare e uno puo avviare la partita
- a inizio partita i territori vengono distribuiti casualmente
- all'inizio del turno ricevi almeno 3 rinforzi
- devi spendere tutti i rinforzi prima di poter attaccare
- per attaccare serve un territorio confinante e almeno 2 armate sul territorio d'origine
- il turno termina manualmente dopo gli attacchi

## Prossimi step consigliati

- autenticazione reale e partite multiple
- matchmaking o lobby con codice invito
- spostamento truppe a fine turno
- carte, obiettivi e continenti
- persistenza database
- WebSocket e deploy online
