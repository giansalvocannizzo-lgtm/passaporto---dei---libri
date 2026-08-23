# PROJECT MEMORY — Il Passaporto dei Libri

## Stato del progetto
- Progetto: Il Passaporto dei Libri
- Repository GitHub: `giansalvocannizzo-lgtm/passaporto---dei---libri`
- Branch stabile: `main`
- Branch di sviluppo corrente: `v6-backend-shared-archive`
- Deploy Render V5: **LIVE**
- URL Render V5: `https://passaporto-dei-libri.onrender.com`
- Versione online stabile: V5
- V6: in sviluppo, non ancora pubblicata su main

## Obiettivo
Creare una piattaforma digitale in cui ogni libro abbia un proprio "passaporto" e possa viaggiare attraverso una comunità di lettori. Il sistema deve registrare identità del libro, proprietario, custode attuale, posizione e storia dei passaggi.

La logica NON deve imporre una scadenza rigida del prestito. È ammessa una previsione orientativa di restituzione.

## Funzionalità V5 sviluppate
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

## Diagnosi architetturale V5
La V5 è una SPA statica. In assenza di `window.storage`, l'archivio ricade su `localStorage`, quindi è locale al browser/dispositivo. `navigator.locks` non costituisce una transazione atomica tra dispositivi differenti.

Conseguenze:
- dispositivi diversi possono avere archivi differenti;
- prestiti/restituzioni non sono centralizzati;
- QR deep-link non garantisce il recupero del libro su un altro dispositivo;
- PIN gestore e dati locali non costituiscono autenticazione server-side;
- export JSON è locale al browser corrente.

## V6 — fase backend condiviso avviata
Branch: `v6-backend-shared-archive`

Implementato nella prima fase:
- `server.js`: API Node.js per archivio condiviso PostgreSQL;
- `package.json`: runtime Node 20 e dipendenza PostgreSQL `pg`;
- `.env.example`: variabili `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_PASSWORD`, `DB_SSL`;
- `render-v6.yaml`: blueprint Render per un servizio web API separato;
- `backend-test.mjs`: test strutturali del backend;
- `.github/workflows/v6-backend-test.yml`: CI per sintassi e test backend;
- schema PostgreSQL automatico per `members`, `books`, `book_events`;
- autenticazione gestore e socio tramite token HMAC;
- prestito transazionale con condizione atomica `status='disponibile'`;
- restituzione transazionale vincolata al socio che possiede il libro;
- aggiornamento posizione/traccia vincolato al custode;
- endpoint `/api/health`;
- ricerca libri via API e recupero eventi.

## PR V6
- Pull Request: #1
- Titolo: `V6: backend condiviso e archivio multiutente`
- Stato: **DRAFT**, non mergiata
- Base: `main`
- Head: `v6-backend-shared-archive`
- Obiettivo della PR: verificare il backend prima di collegarlo all'interfaccia V5.

## Test V6 eseguiti
- `node --check server.js`: OK
- test strutturale backend locale: OK
- verifica presenza delle route principali: OK
- verifica prestito atomico lato database: OK a livello strutturale
- verifica guardia restituzione per `holder_id`: OK a livello strutturale
- workflow GitHub Actions V6 configurato

## V6 ancora da completare
1. Collegare `index.html` alle API V6 senza rompere l'interfaccia V5.
2. Implementare login socio/gestore nell'interfaccia.
3. Implementare migrazione controllata dei dati V5/localStorage verso PostgreSQL.
4. Definire la strategia definitiva per immagini/copertine: non usare base64 nel database per archivi grandi.
5. Configurare `DATABASE_URL`, `AUTH_SECRET` e `ADMIN_PASSWORD` su Render.
6. Creare il servizio API su Render senza modificare/distruggere il servizio V5 finché V6 non è verificata.
7. Testare API e UI con Playwright.
8. Simulare almeno 5 utenti contemporanei con contesa sullo stesso libro.
9. Testare prestiti paralleli su libri differenti.
10. Testare QR cross-device.
11. Testare OCR reale e ricerca bibliografica reale.
12. Solo dopo i test, valutare il merge della PR V6 in `main`.

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
- V6: backend condiviso PostgreSQL, API, autenticazione e prestiti transazionali — **in sviluppo**

## Vincolo importante
Non considerare la previsione di restituzione come una scadenza obbligatoria del prestito. Il libro deve poter continuare a viaggiare oltre la data prevista.
