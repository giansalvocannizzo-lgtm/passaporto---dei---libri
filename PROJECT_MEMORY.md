# PROJECT MEMORY — Il Passaporto dei Libri

## Stato del progetto
- Progetto: Il Passaporto dei Libri
- Repository GitHub: `giansalvocannizzo-lgtm/passaporto---dei---libri`
- Branch stabile: `main`
- Branch di sviluppo corrente: `v6-backend-shared-archive`
- Deploy Render V5: **LIVE**
- URL Render V5: `https://passaporto-dei-libri.onrender.com`
- Versione online stabile: V5
- V6: backend verificato sul branch di sviluppo, non pubblicato su `main`

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

## V6 — backend condiviso verificato
Branch: `v6-backend-shared-archive`

Implementato e verificato:
- `server.js`: API Node.js per archivio condiviso PostgreSQL;
- `package.json`: dipendenza PostgreSQL `pg` e script `check` / `test:backend`;
- `.env.example`: `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_PASSWORD`, `DB_SSL`;
- `render-v6.yaml`: servizio Render API separato dalla V5;
- `backend-test.mjs`: test di integrazione reali HTTP/database, sicurezza e concorrenza;
- `.github/workflows/v6-backend-test.yml`: PostgreSQL 16 service + CI reale;
- schema PostgreSQL automatico per `members`, `books`, `book_events`;
- autenticazione admin e socio con token HMAC e scadenza;
- prestito transazionale atomico;
- restituzione transazionale vincolata al custode;
- aggiornamento posizione/traccia vincolato al custode;
- eventi del libro;
- gestione esplicita dell'assenza di `DATABASE_URL`;
- CORS API coerente con una UI separata, con `CORS_ORIGIN` opzionale e `*` come default;
- JSON malformato restituito come HTTP 400;
- token malformati/scaduti rifiutati come HTTP 401;
- API testate per non restituire `pin_hash`, password o segreti.

## PR V6
- Pull Request: #1
- Titolo: `V6: backend condiviso e archivio multiutente`
- Stato: **DRAFT**, non mergiata
- Base: `main`
- Head: `v6-backend-shared-archive`
- Obiettivo: verificare il backend prima di collegarlo all'interfaccia V5.

## Test V6 — esito reale
Workflow GitHub Actions: `V6 backend test`, run **#12**, concluso **SUCCESS**.

Eseguiti realmente in GitHub Actions con PostgreSQL 16 isolato di test:
- `npm install`: **PASS** — 14 pacchetti installati, 0 vulnerabilità riportate da npm;
- `npm run check`: **PASS** — `node --check server.js`;
- `npm run test:backend`: **PASS**.

Il test backend reale ha verificato via HTTP e PostgreSQL:
- `/api/health`;
- autenticazione admin;
- autenticazione socio per due soci;
- creazione socio;
- creazione libro;
- lettura libro;
- ricerca libri;
- prestito;
- restituzione;
- aggiornamento posizione;
- aggiornamento traccia;
- eventi del libro;
- autorizzazioni admin/member;
- token HMAC malformato e token scaduto;
- JSON malformato;
- assenza di `pin_hash`, password e segreti nelle risposte;
- assenza di `DATABASE_URL` con comportamento HTTP 503 per gli endpoint che richiedono il database;
- due soci che tentano contemporaneamente lo stesso libro: esattamente **1 HTTP 200 + 1 HTTP 409**, un solo `holder_id`, un solo evento `prestito`;
- restituzione da parte di un socio diverso dal custode: **HTTP 409**;
- due soci che prendono contemporaneamente due libri differenti: **entrambi HTTP 200**.

Dopo la verifica funzionale è stato rimosso dal workflow un input obsoleto di `setup-node` che generava un warning. La successiva run **#14** è stata avviata sul branch e al momento dell'ultimo controllo risultava ancora **queued**; la run #12 resta la verifica completa riuscita delle modifiche funzionali.

## Sicurezza V6 verificata
- HMAC SHA-256 con confronto constant-time;
- scadenza token controllata;
- ruoli admin/member controllati sulle operazioni protette;
- query PostgreSQL con parametri;
- whitelist per i nomi colonna dinamici del PATCH libro;
- nessuna password/PIN restituita dalle API;
- nessun segreto hardcoded nel codice applicativo;
- input JSON malformato gestito con HTTP 400;
- CORS applicato anche alle risposte API, non soltanto a OPTIONS.

## Render V6
`render-v6.yaml` definisce un servizio web separato denominato `passaporto-dei-libri-api-v6`, con health check `/api/health`, senza modificare il servizio V5.

Variabili necessarie su Render:
- `DATABASE_URL` — obbligatoria: URL PostgreSQL del database V6;
- `AUTH_SECRET` — obbligatoria: segreto HMAC lungo e casuale;
- `ADMIN_PASSWORD` — obbligatoria: password iniziale dell'amministratore;
- `DB_SSL` — configurazione SSL PostgreSQL, attualmente `true` nel blueprint Render.

`CORS_ORIGIN` è opzionale: se non impostata, l'API usa `*` perché l'autenticazione avviene tramite Bearer token e non tramite cookie.

## Cosa manca prima di collegare V5
1. Deploy reale del servizio API V6 su Render, senza modificare/distruggere il servizio V5.
2. Configurazione sicura delle quattro variabili Render sopra indicate.
3. Smoke test online del servizio V6 su Render, separato dai test CI.
4. Test E2E browser/Playwright.
5. Eventuale test di contesa con almeno 5 utenti, se richiesto come stress test ulteriore.
6. Strategia controllata di migrazione dei dati V5/localStorage verso PostgreSQL.
7. Strategia definitiva per immagini/copertine: non usare base64 nel database per archivi grandi.
8. Test QR cross-device.
9. Test OCR reale e ricerca bibliografica reale.
10. Solo dopo questi passaggi, valutare il collegamento di `index.html` e successivamente il merge della PR V6 in `main`.

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
- V6: backend condiviso PostgreSQL, API, autenticazione e prestiti transazionali — **backend verificato, integrazione UI non ancora iniziata**

## Vincolo importante
Non considerare la previsione di restituzione come una scadenza obbligatoria del prestito. Il libro deve poter continuare a viaggiare oltre la data prevista.
