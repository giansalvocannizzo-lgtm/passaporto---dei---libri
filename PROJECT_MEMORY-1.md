# PROJECT MEMORY — Il Passaporto dei Libri

## Stato del progetto
- Progetto: Il Passaporto dei Libri
- Repository GitHub: `giansalvocannizzo-lgtm/passaporto---dei---libri`
- Branch: `main`
- Deploy Render: non ancora effettuato
- Stato attuale: V5 preparata e testata localmente; pronta per caricamento GitHub/Render

## Obiettivo
Creare una piattaforma digitale in cui ogni libro abbia un proprio "passaporto" e possa viaggiare attraverso una comunità di lettori. Il sistema deve registrare identità del libro, proprietario, custode attuale, posizione e storia dei passaggi.

La logica NON deve imporre una scadenza rigida del prestito. È ammessa una previsione orientativa di restituzione.

## Funzionalità sviluppate
- Catalogo libri
- Ricerca libri
- Soci e identificazione del socio
- Area gestore protetta da PIN
- Codice libro leggibile `PB-000001`, ecc.
- Scheda/passaporto individuale del libro
- Stato disponibile / in viaggio
- Distinzione proprietario / custode attuale
- Prestito
- Restituzione
- Aggiornamento posizione
- Tracce/commenti del viaggio
- Timeline dello storico
- QR code del libro
- Scansione QR tramite fotocamera
- Prevista scansione QR da immagine
- Etichetta stampabile del libro
- Dashboard e statistiche
- Sezione Viaggi
- Controllo integrità archivio
- Backup JSON
- OCR della copertina
- Ricerca automatica di dati bibliografici
- Campo descrizione del libro
- Ricerca tramite Google Books e Open Library, con priorità ISBN quando disponibile
- Ottimizzazione OCR: caricamento lazy del motore e riutilizzo del worker
- Controlli di concorrenza per operazioni sul singolo libro
- Fallback di storage per ambienti statici senza `window.storage`
- Self-test archivio
- Riconoscimento ISBN da OCR e ricerca per ISBN
- QR con deep-link tramite hash anche senza APP_URL

## Test V5 eseguiti
- Controllo sintattico JavaScript: OK
- Parsing HTML: OK
- Verifica ID statici duplicati: nessuno
- Verifica presenza fallback storage/ISBN/self-test/deep-link: OK
- Test logico del flusso gestore: OK
- Test di più libri: simulazione di caricamento massivo
- Test di 5 utenti: simulazione di prestiti/restituzioni
- Test di contesa sullo stesso libro: logica progettata per consentire un solo prestito quando il lock è disponibile
- Test su libri differenti: operazioni parallele simulate
- Controllo integrità archivio: previsto e integrato

## Limite tecnico noto
Il lock lato browser (`navigator.locks`) non garantisce una transazione atomica tra dispositivi fisicamente differenti. Per il vero ambiente multiutente il progetto dovrà passare a backend + database con controllo atomico del prestito.

## OCR
Problema rilevato: prima lettura OCR relativamente lenta.
Soluzioni già introdotte:
- caricamento del motore OCR solo quando richiesto;
- riutilizzo del worker;
- ridimensionamento/preparazione dell'immagine;
- verifica manuale dei dati prima del salvataggio.

Da verificare con fotografie reali di copertine su smartphone.

## Prossimo obiettivo immediato
1. Caricare la versione corrente come `index.html` nel repository GitHub.
2. Aggiungere questo `PROJECT_MEMORY.md`.
3. Verificare il repository.
4. Collegare il repository a Render come Static Site.
5. Effettuare il primo test reale online.
6. Testare il caricamento di molti libri da parte del gestore.
7. Testare 5 utenti reali collegati contemporaneamente da dispositivi diversi.
8. Testare QR, OCR, persistenza, prestiti, restituzioni, posizione e archivio.
9. Solo dopo il test reale decidere il passaggio a backend/database.

## Regola di sviluppo
Non riscrivere il progetto da zero senza motivo. Conservare l'interfaccia e il linguaggio visivo "passaporto/timbri/carta" e modificare il codice incrementando le versioni.

Ogni nuova versione deve:
- avere un numero di versione;
- indicare cosa è cambiato;
- mantenere le funzionalità già funzionanti;
- essere testata prima di sostituire la precedente;
- aggiornare questo file.

## Versioni
- V1: prototipo iniziale
- V2: catalogo, soci, QR e prestiti
- V3: passaporto, statistiche, OCR, ricerca bibliografica, descrizione, backup e controllo archivio
- V4: miglioramenti OCR e gestione della concorrenza lato browser
- V5: preparazione deploy Render, fallback storage, ISBN/OCR migliorato e diagnostica
- Prossima fase: upload come `index.html`, deploy Render e test multi-dispositivo
