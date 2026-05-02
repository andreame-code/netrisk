# Wiki giocatore e admin

Questa guida spiega come usare il gioco come giocatore o amministratore. Non descrive codice, API o flussi di sviluppo.

Nel sito il gioco puo apparire con il titolo visibile `Frontline Dominion`, mentre la documentazione tecnica puo usare il nome interno del progetto.

## Primi passi

1. Apri l'applicazione.
2. Registra un account o accedi con un account esistente.
3. Dopo l'accesso, entra nella lobby per creare una partita, unirti a una partita aperta o riaprire una partita salvata.
4. Usa il profilo per controllare statistiche personali come partite giocate, vittorie, sconfitte e partite in corso.

## Lobby

La lobby e il punto di partenza delle partite.

Puoi:

- creare una nuova partita
- scegliere tra le mappe disponibili
- selezionare il set di regole consentito dal server
- impostare un limite di tempo per turno, se disponibile
- unirti a una partita gia creata
- aggiungere bot gestiti dal gioco quando la configurazione lo permette
- riaprire partite salvate o in corso

Una partita puo iniziare solo quando la configurazione e valida. Il primo slot deve essere occupato da un giocatore umano.

## Creare una partita

Quando crei una partita:

1. Scegli la mappa.
2. Scegli le opzioni di regole disponibili.
3. Imposta eventuali limiti di turno.
4. Conferma la creazione.
5. Attendi che gli altri giocatori entrino o aggiungi bot, se ammessi.
6. Avvia la partita quando tutti gli slot richiesti sono pronti.

All'avvio, il gioco assegna i territori iniziali e passa al primo turno.

## Obiettivo della partita

L'obiettivo standard e controllare la plancia eliminando gli avversari o completando l'obiettivo di vittoria attivo nella partita.

Il gioco determina automaticamente eliminazioni, vittoria e fine partita. Se una partita usa obiettivi speciali creati dagli admin, l'obiettivo attivo viene scelto alla creazione della partita e resta stabile per tutta la sessione.

## Turno di gioco

Ogni turno segue tre fasi principali:

- rinforzo
- attacco
- fortificazione

Il gioco mostra solo le azioni valide per la fase corrente. Se un'azione non e consentita, il server la rifiuta e la schermata si riallinea allo stato corretto della partita.

## Rinforzo

Durante il rinforzo ricevi armate da piazzare sui territori che controlli.

In questa fase puoi:

- piazzare rinforzi sui tuoi territori
- scambiare carte valide per ottenere rinforzi extra
- completare la fase quando tutti i rinforzi obbligatori sono stati piazzati

Se hai troppe carte in mano, il gioco puo richiedere uno scambio obbligatorio prima di procedere.

## Attacco

Durante l'attacco puoi scegliere un tuo territorio con abbastanza armate e attaccare un territorio avversario collegato.

In questa fase puoi:

- scegliere il territorio attaccante
- scegliere il territorio difensore
- selezionare il numero di dadi o l'opzione di attacco disponibile
- risolvere il combattimento
- continuare ad attaccare, se hai ancora attacchi validi
- terminare la fase di attacco

Se conquisti un territorio, il gioco puo chiederti di spostare armate nel territorio appena conquistato prima di permettere altre azioni.

## Fortificazione

Durante la fortificazione puoi spostare armate tra territori che controlli, quando il collegamento e valido per le regole della partita.

Puoi:

- scegliere un territorio di partenza
- scegliere un territorio di destinazione valido
- indicare quante armate spostare
- confermare lo spostamento
- saltare la fortificazione quando non e obbligatoria

Dopo la fortificazione, il turno passa al giocatore successivo.

## Carte

Le carte rappresentano bonus di rinforzo.

Puoi ottenere carte quando conquisti almeno un territorio durante il tuo turno. Durante la fase di rinforzo puoi selezionare un set valido e scambiarlo per ricevere rinforzi aggiuntivi. Il valore dei bonus puo aumentare nel corso della partita, in base alle regole attive.

## Resa e fine partita

In una partita attiva puoi arrenderti se l'interfaccia mostra l'azione disponibile. La resa rimuove il giocatore dalla contesa secondo le regole del gioco.

La partita termina quando il gioco rileva un vincitore. Al termine, lo stato passa a concluso e il profilo dei giocatori viene aggiornato.

## Sincronizzazione e conflitti

La partita e sincronizzata dal server. Se due aggiornamenti arrivano quasi nello stesso momento, il gioco puo mostrare una versione piu recente dello stato e annullare l'azione locale non piu valida.

In pratica:

- se la schermata si aggiorna dopo una tua azione, controlla lo stato corrente prima di riprovare
- se un'azione non appare piu disponibile, significa che la partita e avanzata o che la fase e cambiata
- non serve ricaricare manualmente nella maggior parte dei casi

## Profilo giocatore

La pagina profilo riepiloga la tua attivita.

Puoi consultare:

- partite giocate
- vittorie
- sconfitte
- partite ancora in corso
- percentuale di vittorie

## Guida admin

Gli admin possono accedere alla console da `/admin`. La voce admin e visibile solo agli utenti autorizzati.

La console serve a gestire l'esperienza di gioco, non a modificare codice.

## Sezioni admin

La console include:

- `Overview`: riepilogo operativo, partite recenti, configurazioni attive e possibili problemi
- `Users`: ricerca utenti, controllo ruoli, promozione o rimozione del ruolo admin
- `Games`: elenco partite, stato, giocatori, configurazione e azioni di gestione
- `Configurations`: impostazioni globali, moduli abilitati, profili e default runtime
- `Runtime / Modules`: catalogo dei moduli disponibili e relativo stato
- `Content Studio`: creazione controllata di contenuti di gameplay supportati
- `Maintenance`: controlli, pulizia e riparazioni guidate
- `System Health`: diagnostica su partite, moduli e configurazioni
- `Audit Log`: cronologia delle azioni admin rilevanti

## Gestire utenti

Nella sezione `Users`, un admin puo:

- cercare account
- verificare il ruolo assegnato
- promuovere un utente ad admin
- rimuovere il ruolo admin quando non serve piu

Le modifiche ai ruoli possono richiedere un nuovo accesso o un refresh della sessione per diventare visibili nell'interfaccia.

## Gestire partite

Nella sezione `Games`, un admin puo controllare partite e lobby.

Le azioni disponibili dipendono dallo stato della partita. Le azioni delicate richiedono conferma esplicita e vengono registrate nell'audit log.

Usa questa sezione per:

- controllare partite bloccate o obsolete
- chiudere o terminare partite quando previsto
- verificare configurazioni e giocatori
- consultare dettagli utili per assistenza agli utenti

## Configurazioni e moduli

Le configurazioni admin influenzano le opzioni disponibili quando i giocatori creano nuove partite.

Gli admin possono gestire:

- mappe disponibili
- set di regole selezionabili
- profili e preset
- moduli abilitati
- impostazioni di manutenzione

Le partite gia create mantengono la configurazione con cui sono nate. Cambiare un default admin non deve essere interpretato come modifica retroattiva delle partite in corso.

## Content Studio

Il `Content Studio` permette agli admin di creare contenuti di gameplay supportati dall'app, come obiettivi di vittoria configurabili.

Il flusso tipico e:

1. creare una bozza
2. completare i campi richiesti
3. validare la bozza
4. pubblicarla
5. abilitarla per renderla disponibile nelle nuove partite

I contenuti creati in questa area sono dati validati dall'applicazione. Non sono script liberi e non eseguono codice personalizzato.

## Manutenzione e sicurezza

Le sezioni di manutenzione aiutano gli admin a mantenere ordinato il sistema.

Prima di confermare azioni distruttive o di riparazione:

- controlla quale partita, modulo o configurazione verra modificata
- verifica che l'azione riguardi davvero il problema segnalato
- preferisci azioni mirate rispetto a interventi generici
- controlla l'audit log dopo operazioni importanti

Il gioco applica controlli server-side anche quando un'azione e avviata dall'interfaccia admin.

## Buone pratiche per giocatori

- Completa il turno quando hai finito, cosi la partita resta fluida.
- Controlla sempre la fase corrente prima di scegliere un'azione.
- Usa la resa solo quando vuoi davvero uscire dalla contesa.
- Se il gioco aggiorna la schermata, fidati dello stato piu recente mostrato.

## Buone pratiche per admin

- Cambia i default con parsimonia, soprattutto durante partite attive.
- Usa l'audit log per ricostruire chi ha fatto cosa.
- Pubblica nuovi contenuti solo dopo averli validati.
- Evita di disabilitare moduli che potrebbero essere ancora usati da configurazioni attive.
- Comunica ai giocatori quando cambi opzioni disponibili per le nuove partite.
