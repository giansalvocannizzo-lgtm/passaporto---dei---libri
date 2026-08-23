# PROJECT MEMORY — Il Passaporto dei Libri

## Stato del progetto
- Progetto: Il Passaporto dei Libri
- Repository GitHub: `giansalvocannizzo-lgtm/passaporto---dei---libri`
- Branch: `main`
- Deploy Render: **LIVE**
- URL Render: `https://passaporto-dei-libri.onrender.com`
- Versione online: V5
- Stato: collaudo online in corso

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
- Scansione QR da immagine prevista
- Etichetta stampabile del libro
- Dashboard e statistiche
- Sezione Viaggi
- Controllo integrità archivio
- Backup JSON
- OCR della copertina
- Ricerca automatica di dati bibliografici
- Campo descrizione del libro
- Ricerca Google Books e Open Library
- OCR lazy e riutilizzo del worker
- Estrazione ISBN dall'OCR
- Fallback `localStorage` per ambienti statici privi di `window.storage`
- Controlli di concorrenza lato browser per il singolo libro

## Test eseguiti
- Controllo sintattico JavaScript: OK
- Controlli statici HTML/DOM: OK
- Verifica apertura reale su smartphone da Render: OK
- Renderizzazione V5 su Render: OK
- Test logico del flusso gestore: OK
- Test simulato di caricamento massivo: OK
- Test simulato di 5 utenti: OK
- Test simulato di contesa sullo stesso libro: OK quando il lock browser è disponibile
- Test simulato di operazioni parallele su libri differenti: OK
- Controllo integrità archivio: integrato
- Test automatico online Playwright: configurato in `.github/workflows/online-smoke-test.yml`; verifica apertura Render, header, tab principali e assenza di errori console/pageerror

## Test ancora da completare
- Esecuzione confermata del workflow Playwright sul commit online
- Inserimento di un libro reale dal Gestore
- OCR con fotografia reale di copertina su smartphone
- Ricerca bibliografica reale e generazione descrizione
- Generazione/lettura QR reale
- Prestito e restituzione reali
- Caricamento massivo reale dal Gestore
- Test con 5 dispositivi fisicamente separati
- Verifica della persistenza e della condivisione dei dati tra dispositivi

## Limite tecnico noto
Il lock lato browser (`navigator.locks`) non garantisce una transazione atomica tra dispositivi fisicamente differenti. Inoltre il fallback `localStorage` è locale al browser. Per un archivio realmente condiviso tra più smartphone servirà backend + database con transazione atomica del prestito.

## OCR
Problema rilevato: prima lettura OCR relativamente lenta.
Soluzioni introdotte:
- caricamento del motore OCR solo quando richiesto;
- riutilizzo del worker;
- preparazione/ridimensionamento dell'immagine;
- estrazione ISBN;
- verifica manuale dei dati prima del salvataggio.

Da verificare con fotografie reali di copertine.

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
- V5: fallback storage, ISBN/OCR migliorato, ricerca bibliografica, QR deep-link, self-test e deploy Render
- Prossima fase: collaudo reale multi-dispositivo e, se necessario, backend/database condiviso

## Test trigger
- Commit di trigger: aggiornamento memoria per avviare il workflow online smoke test
- Data: 2026-08-23
- Obiettivo: verificare l'esecuzione reale di GitHub Actions contro il sito Render LIVE
