# Wiki giocatore e admin

Questa guida spiega come usare il gioco come giocatore o amministratore. Non descrive codice, API o flussi di sviluppo.

Nel sito il gioco puo apparire con il titolo visibile `Frontline Dominion`, mentre la documentazione tecnica puo usare il nome interno del progetto.

## Printscreen rapidi

Questi printscreen mostrano i passaggi principali dell'esperienza giocatore e admin.

### Accesso

![Schermata di accesso](assets/player-admin-wiki-login.png)

### Lobby

![Lobby con partite e azioni principali](assets/player-admin-wiki-lobby.png)

### Creazione partita

![Creazione di una nuova partita](assets/player-admin-wiki-new-game.png)

### Plancia di gioco

![Plancia durante una partita](assets/player-admin-wiki-gameplay.png)

### Console admin

![Console admin](assets/player-admin-wiki-admin.png)

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

## Regole complete

Questa sezione riepiloga le regole operative che un giocatore o un admin devono conoscere per usare correttamente il gioco.

### Setup partita

- Una nuova partita richiede da 2 a 4 giocatori.
- Il primo slot deve essere occupato da un giocatore umano.
- Gli altri slot possono essere occupati da giocatori umani o bot, se la configurazione lo consente.
- La partita puo iniziare solo quando la configurazione e valida.
- All'avvio, i territori vengono assegnati ai giocatori e ogni territorio parte con una armata.
- Il primo giocatore attivo inizia in fase di rinforzo.
- Le mappe definiscono territori, collegamenti, continenti e bonus continente.
- I limiti di tempo turno disponibili sono 24, 48 o 72 ore, quando abilitati.

### Preset e opzioni

- `Classic` usa dadi standard, obiettivo conquista, tema tavolo di guerra e pedine classiche.
- `Classic Defense 3` usa le stesse basi di `Classic`, ma permette al difensore fino a 3 dadi.
- `Conquest` termina la partita quando resta un solo giocatore attivo con territori.
- `Majority Control` termina la partita quando un giocatore controlla almeno il 70% dei territori.
- Gli admin possono pubblicare obiettivi configurabili; quando una partita ne usa uno, l'obiettivo resta quello per tutta la partita.

### Rinforzi

- A inizio turno ricevi rinforzi in base ai territori controllati.
- Il calcolo standard e `territori controllati / 3`, arrotondato per difetto.
- Il minimo standard e sempre 3 rinforzi.
- I bonus continente si aggiungono quando controlli tutti i territori di un continente.
- I rinforzi devono essere piazzati su territori che controlli.
- Non puoi passare all'attacco finche hai rinforzi obbligatori ancora da piazzare.
- Se hai troppe carte in mano, devi risolvere lo scambio obbligatorio prima di proseguire.

### Carte

- Puoi ricevere al massimo una carta a fine turno, solo se hai conquistato almeno un territorio durante quel turno.
- Le carte possono essere di tipo fanteria, cavalleria, artiglieria o jolly.
- Un set valido contiene esattamente 3 carte.
- Sono validi tre simboli uguali, oppure un set con un simbolo per tipo.
- I jolly possono completare un set valido.
- I bonus standard degli scambi sono 4, 6, 8, 10, 12 e 15 rinforzi.
- Dopo il sesto scambio, ogni scambio successivo aumenta di 5 rinforzi.
- Se hai piu di 5 carte, lo scambio diventa obbligatorio.

### Attacchi

- Puoi attaccare solo durante la fase di attacco.
- Puoi attaccare solo dal tuo turno.
- Il territorio attaccante deve essere tuo.
- Il territorio difensore deve appartenere a un avversario.
- I due territori devono essere collegati dalla mappa.
- Il territorio attaccante deve avere almeno 2 armate, perche una armata deve restare indietro.
- Devi avere piazzato tutti i rinforzi obbligatori prima di attaccare.
- Il set standard permette all'attaccante fino a 3 dadi.
- Il set standard permette al difensore fino a 2 dadi.
- Il set `Defense 3 Dice` permette al difensore fino a 3 dadi.
- Il difensore non puo tirare piu dadi delle armate presenti nel territorio difeso.
- I dadi vengono ordinati dal valore piu alto al piu basso e confrontati in coppie.
- Ogni confronto fa perdere una armata al lato con il risultato piu basso.
- In caso di pareggio, vince il difensore.
- Alcune configurazioni possono imporre un numero minimo o massimo di attacchi nel turno; l'interfaccia mostra solo le azioni disponibili.

### Attacco rapido

- L'attacco rapido ripete automaticamente lo stesso attacco finche e ancora valido.
- Si ferma se il territorio viene conquistato.
- Si ferma se l'attaccante non ha piu abbastanza armate.
- Si ferma se il bersaglio non e piu un territorio avversario.
- Si ferma se serve risolvere uno spostamento dopo conquista.

### Conquista e spostamento

- Quando un territorio difeso arriva a 0 armate, passa al giocatore attaccante.
- Dopo una conquista devi spostare armate nel territorio appena conquistato.
- Devi spostare almeno il minimo richiesto dalla partita.
- Devi sempre lasciare almeno una armata nel territorio di partenza.
- Finche lo spostamento di conquista non e risolto, non puoi continuare con altre azioni di turno.

### Fortificazione

- La fortificazione avviene dopo la fase di attacco.
- Puoi spostare armate solo tra territori che controlli.
- Con le regole standard, i territori devono essere adiacenti.
- Con le regole standard, puoi fare una sola fortificazione per turno.
- Devi spostare un numero intero positivo di armate.
- Devi lasciare almeno una armata nel territorio di partenza.
- Dopo la fortificazione, o dopo averla saltata quando permesso, il turno passa al giocatore successivo.

### Fine turno, resa e vittoria

- Se conquisti almeno un territorio durante il turno, puoi ricevere una carta quando il turno si chiude.
- Un giocatore senza territori attivi e eliminato dalla contesa.
- Un giocatore puo arrendersi quando l'azione e disponibile.
- La resa scarta le carte del giocatore e lo rimuove dalla contesa.
- Se non resta nessun giocatore umano attivo, la partita puo chiudersi senza vincitore umano.
- Il gioco controlla automaticamente la vittoria dopo azioni importanti come conquista, resa e avanzamento turno.
- In caso di turno scaduto o recupero automatico, il gioco puo risolvere lo stato pendente e passare avanti in modo sicuro.

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
