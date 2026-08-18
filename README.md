# Addon Nuvio — Calcio TV Italia

Addon per Nuvio (protocollo compatibile Stremio) che, data una squadra, restituisce le prossime partite con canale/piattaforma italiana e data, combinando:

- **TheSportsDB** (free API, chiave pubblica `123`) per squadre, calendario, avversari, orari.
- **calciointv.com** (scraping best-effort, fonte NON ufficiale) per canale TV/piattaforma italiana.

## Limite importante da conoscere

TheSportsDB non fornisce dati di diffusione TV per paese — nessuna API gratuita seria lo fa, perché i diritti broadcast sono un dato commerciale che cambia stagione per stagione. Il campo canale/piattaforma qui viene da scraping di un sito guida TV pubblico: può essere assente, in ritardo, o sbagliato per singoli eventi. Quando lo scraper non trova un match, il campo torna `null` con un messaggio esplicito — l'addon non inventa mai un canale.

**Non testato end-to-end**: il mio ambiente di sviluppo non ha accesso di rete a calciointv.com (whitelist ristretta), quindi ho validato la logica di parsing HTML con un fixture che replica la struttura reale del sito (verificata manualmente), ma non ho potuto eseguire una richiesta live. Il manifest e il server sono stati testati e funzionano. Testa `/search?team=...` subito dopo il deploy e segnalami eventuali errori.

## Struttura progetto

```
src/
  sportsdb.js      # client TheSportsDB
  scraper.js       # scraping calciointv.com + parsing HTML + cache 30 min
  teamAliases.js    # alias nomi squadra (Inter/Inter Milan, Milan/AC Milan, ecc.)
  matchup.js        # combina TheSportsDB + scraper in un evento arricchito
  manifest.js        # manifest protocollo Stremio/Nuvio
  server.js          # server Express con endpoint Stremio + endpoint REST di test
test/
  fixture.html      # HTML di esempio per validare il parser senza rete
```

## Funzionalità

- **Catalogo sfogliabile** in Nuvio/Stremio: si apre direttamente con le partite in programma.
- **Filtro per competizione** (Serie A, Coppa Italia, Champions, La Liga...) dal menù a tendina.
- **Locandine generate al volo**: ogni scheda mostra squadre, data/ora e canale incisi sull'immagine, con colore della piattaforma (DAZN verde, Sky blu, Mediaset rosso...). Così le info si leggono dalla griglia senza aprire nulla.
- **Autoaggiornamento**: il palinsesto viene rinfrescato in background ogni 30 minuti (configurabile con la variabile d'ambiente `REFRESH_MINUTES`), più un caricamento immediato all'avvio.

### Endpoint utili

| Endpoint | Cosa fa |
| --- | --- |
| `/manifest.json` | Manifest da incollare in Nuvio |
| `/all` | Palinsesto completo scrapato (JSON) |
| `/search?team=Juventus` | Prossime partite di una squadra |
| `/search?teamA=X&teamB=Y` | Singola partita tra due squadre |
| `/status` | Stato autoaggiornamento (ultimo refresh, errori) |
| `/refresh` | Forza aggiornamento immediato |
| `/poster/<id>.png` | Locandina generata di un evento |

### Variabili d'ambiente

| Variabile | Default | Cosa fa |
| --- | --- | --- |
| `PORT` | `7860` | Porta di ascolto (Railway/Render la impostano da soli) |
| `REFRESH_MINUTES` | `30` | Intervallo di autoaggiornamento del palinsesto |
| `SPORTSDB_KEY` | `123` | Chiave TheSportsDB. `123` è la chiave pubblica di test: va bene per uso personale, per un servizio distribuito procurarsene una propria |
| `POSTER_REV` | versione manifest | Token anti-cache negli URL delle locandine |

### Usare il progetto come sorgente dati

Se ti interessa solo il dato (partita → emittente italiana) e non l'addon,
vedi **[INTEGRATION.md](INTEGRATION.md)**: documenta l'endpoint `/all`, il
formato JSON, l'approccio consigliato per il matching con una lista canali e
il vincolo dell'istanza singola per lo scraping.

## Requisito Node.js

Serve **Node.js 20 o superiore**. Con Node 18 il deploy crasha con l'errore `ReferenceError: File is not defined` (dipendenza `undici`, usata da `axios`, richiede l'API globale `File` disponibile solo da Node 20). Il file `.nvmrc` e il campo `engines` in `package.json` dichiarano questo vincolo — assicurati che la piattaforma di hosting lo rispetti (Railway lo legge da `.nvmrc` automaticamente).

## Deploy (gratuito, es. Render.com o Railway.app)

1. Crea un repo Git con questa cartella (o carica via dashboard Render come "Web Service" da zip/GitHub).
2. Su [render.com](https://render.com) → New → Web Service → connetti il repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Deploy. Otterrai un URL tipo `https://tuo-addon.onrender.com`.

Alternative equivalenti: Railway.app, Fly.io, Cyclic.sh — stesso procedimento (build `npm install`, start `npm start`).

## Test dopo il deploy

```
curl "https://tuo-addon.onrender.com/manifest.json"
curl "https://tuo-addon.onrender.com/search?team=Juventus"
curl "https://tuo-addon.onrender.com/search?teamA=Juventus&teamB=Napoli"
```

Se `/search?team=Juventus` restituisce eventi con `"italianChannel": null` su tutti, il selettore CSS/DOM dello scraper va rivisto contro l'HTML reale — il sito potrebbe aver cambiato struttura, oppure il sito blocca l'IP del tuo hosting (in tal caso serve uno user-agent più realistico o un proxy).

## Installazione in Nuvio

In Nuvio, aggiungi un addon custom incollando l'URL del manifest:

```
https://tuo-addon.onrender.com/manifest.json
```

L'addon comparirà come catalogo "Calcio TV Italia" di tipo `tv`, interrogabile tramite ricerca (nome squadra).

## Estendere gli alias squadra

Se una squadra non trova match, aggiungi una voce in `src/teamAliases.js` con la forma TheSportsDB e le varianti usate su calciointv.com.

## Nota legale

Lo scraping di calciointv.com è per uso personale/non commerciale. Se il sito cambia struttura o blocca le richieste, va aggiornato `src/scraper.js` di conseguenza. Non redistribuire il contenuto scrapato commercialmente.
