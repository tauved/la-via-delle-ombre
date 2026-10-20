# La via delle ombre

Il sito di TAUH: la musica da ascoltare mentre si gira per il sito, i caroselli da sfogliare e leggere (sul sito si chiamano «Pillole di conoscenza»), gli artwork da scaricare, la biblioteca, il merch, il canale Telegram e il gioco.
È un sito statico (HTML, CSS e JavaScript senza librerie) generato da un piccolo script e pubblicato su Cloudflare.

## Com'è fatto

```
contenuti/
  sito.json                  testi della home, link ai social, impostazioni del gioco
  caroselli/<nome>/          un carosello per cartella
    carosello.json           titolo, data, testi delle tavole
    01.webp, 02.webp, …      le tavole (1080×1350)
    copertina-540.webp       copertina piccola (facoltativa)
    og.jpg                   anteprima per i link condivisi (facoltativa)
  musica/                    i brani del lettore (MP3), le loro copertine e musica.json
  artwork/                   le immagini da scaricare e artwork.json
  merch/                     le foto e i disegni delle magliette
  ebook/<nome>/              un ebook per cartella, con ebook.json (pagina per ora nascosta)
  biblioteca/                i libri consigliati, con i link (biblioteca.json)
src/                         stile.css, app.js, immagini del sito e caratteri
static/                      file copiati così come sono (_headers, favicon, il gioco)
strumenti/                   script per aggiungere caroselli
build.mjs                    genera il sito nella cartella dist/
wrangler.jsonc               configurazione di Cloudflare
```

Per generare il sito basta Node 20 o più recente: `npm run build`. Non ci sono pacchetti da installare.

## Metterlo online la prima volta

1. Crea un repository su GitHub (può essere privato) e caricaci questa cartella, per esempio con SourceTree: inizializza, fai il commit di tutto e il push.
2. Su Cloudflare apri **Workers & Pages**, premi **Create application** e scegli **GitHub**. Autorizza l'accesso e seleziona il repository.
3. Chiama il progetto `la-via-delle-ombre` (lo stesso nome scritto in `wrangler.jsonc`) e nelle impostazioni scrivi:
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy` (è già quello predefinito)
4. Premi **Save and Deploy**. Dopo un minuto il sito è online su un indirizzo `….workers.dev`.
5. I domini sono scritti in `wrangler.jsonc`, alla voce `routes` (ognuno con `"custom_domain": true`): adesso `laviadelleombre.com` e `www.laviadelleombre.com`. A ogni pubblicazione Cloudflare li collega al Worker e crea da solo i record DNS e i certificati. Per aggiungere un dominio (deve essere su Cloudflare) scrivilo lì e fai il push. Non aggiungerli dal pannello di Cloudflare: a ogni pubblicazione restano collegati solo i domini scritti nel file. Con la voce `routes` l'indirizzo `….workers.dev` del punto 4 si spegne.
6. Quando conosci l'indirizzo definitivo, scrivilo in `contenuti/sito.json` alla voce `"url"` (per esempio `"https://tauh616.com"`) e fai il push: servono per la mappa del sito e per le anteprime dei link su Telegram e Instagram.

Da lì in poi ogni push su GitHub ripubblica il sito da solo.

## Aggiornare il sito

Ogni modifica segue lo stesso giro: cambi i file, fai commit e push, Cloudflare ripubblica.

### Aggiungere un carosello

Sul sito i caroselli si chiamano «Pillole di conoscenza» (nel menu, nella home e nella pagina che li raccoglie); gli indirizzi restano /caroselli/, così i link già condivisi continuano a funzionare.

**Con Claude.** Nel progetto «Sito Tauh» chiedi di aggiungere al sito un carosello: Claude prende le tavole dal canvas, le converte, scrive i testi e fa il push sul repository.

**Da solo.**

1. Esporta le tavole del carosello come immagini (1080×1350, JPG o PNG) in una cartella, con i nomi in ordine: `1.jpg`, `2.jpg`, …
2. Lancia:
   ```
   npm run nuovo-carosello -- "Titolo del carosello" "percorso/della/cartella" 2026-10-20
   ```
   La data è facoltativa: se manca usa quella di oggi. Se prima installi `sharp` (`npm install --no-save sharp`) le immagini vengono anche convertite in WebP e pesano meno.
3. Se vuoi, apri `contenuti/caroselli/<nome>/carosello.json` e completa sottotitolo, link al post Instagram (`"instagram"`) e titoli delle tavole.
4. Commit e push.

I caroselli si ordinano per data, dal più recente. La data può avere anche l'ora (`2026-10-20T21:30`) per decidere l'ordine di due caroselli dello stesso giorno.

Per togliere un carosello cancella la sua cartella.

### Cambiare testi e link

Tutto sta in `contenuti/sito.json`: titolo e motto della home, testi delle sezioni, link a Instagram, YouTube, Spotify, Apple Music (`"apple_music"`), TIDAL (`"tidal"`), TikTok e Telegram (alla voce `"link"`; quelli che lasci vuoti spariscono dal sito). Spotify, Apple Music, TIDAL e YouTube compaiono nella sezione Ascolta. La frase in fondo a ogni pagina è alla voce `"piede"`.

### I miei social

Verso il fondo della home, dopo i Ringraziamenti, c'è la sezione «I miei social»: al posto dei loghi dei social ci sono i sigilli, e toccando il sigillo o il nome si apre il social. Si cambia in `contenuti/sito.json`, alla voce `"social"`:

```json
"social": {
  "titolo": "I miei social",
  "testo": "Tocca un sigillo e seguimi.",
  "voci": [
    { "canale": "instagram", "nome": "Instagram", "dettaglio": "@tauh616", "sigillo": "occhio.webp" },
    { "canale": "telegram", "nome": "Telegram", "dettaglio": "Il canale", "sigillo": "mercurio.webp" }
  ]
}
```

`canale` prende l'indirizzo dalla voce `"link"` (in alternativa si scrive `"link"` direttamente nella voce). I sigilli stanno in `contenuti/social/`: ci sono anche `pentacolo.webp` e `pietra-filosofale.webp`, liberi per un social in più.
Per mettere un video in evidenza nella sezione musica scrivi in `"youtube_video"` il codice del video (la parte dopo `v=` nell'indirizzo).

### Un'uscita in arrivo (pre-save)

In cima alla home, sotto l'apertura, c'è il riquadro della prossima uscita con il bottone per il pre-save. Si cambia in `contenuti/sito.json`, alla voce `"uscita"`:

```json
"uscita": {
  "titolo": "Come Dio",
  "tipo": "Nuovo singolo",
  "data": "2026-10-28",
  "testo": "Pre-salvalo su Spotify: il giorno dell'uscita lo trovi già nella tua libreria.",
  "link": "https://distrokid.com/hyperfollow/tauh/come-dio/",
  "bottone": "Pre-salvalo su Spotify",
  "tipo_dopo": "Ultima uscita",
  "testo_dopo": "È fuori su Spotify e su tutte le piattaforme.",
  "bottone_dopo": "Ascolta l'ultima uscita",
  "link_dopo": "",
  "copertina": ""
}
```

Prima della data il sito mostra quanti giorni mancano. Dal giorno dell'uscita (a mezzanotte, senza fare niente) il pre-save diventa «Ascolta l'ultima uscita»: al posto di `"tipo"`, `"testo"` e `"bottone"` compaiono `"tipo_dopo"`, `"testo_dopo"` e `"bottone_dopo"`, e sotto il titolo c'è «Uscito oggi», poi «Uscito il …». Il bottone resta sul link di HyperFollow, che dopo l'uscita porta al brano su Spotify e sulle altre piattaforme; se vuoi mandarlo altrove (per esempio dritto al brano su Spotify) scrivi l'indirizzo in `"link_dopo"`. Il riquadro resta così finché non lo cambi con la prossima uscita. Per mettere la copertina salvala in `contenuti/uscita/` (quadrata, per esempio 1000×1000) e scrivi il nome del file in `"copertina"`; senza copertina compare un disco con il logo, che gira mentre suona la musica del sito. Per togliere il riquadro cancella la voce `"uscita"`.

### La musica in sottofondo

In basso a destra c'è il lettore «Ascolta TAUH». La musica parte solo quando chi visita preme play e continua mentre si passa da una pagina all'altra. Sul telefono compare anche nella schermata di blocco, con titolo e copertina. Nella home, alla voce Ascolta, c'è l'elenco dei brani.

- **A schermo spento**: in Safari e Chrome la musica continua anche col telefono bloccato o mentre si usa un'altra app. Nel browser interno di Instagram, Facebook e TikTok invece si ferma quando si esce dall'app (lo decide l'app, il sito non può farci niente): lì, sotto l'elenco dei brani, compare un avviso che spiega di aprire il sito nel browser.
- **Un player alla volta**: se chi visita carica il player di Spotify, il lettore del sito si ferma e si chiude; se poi fa ripartire la musica del sito, il player di Spotify torna al bottone «Carica il player» (così si ferma anche lui).
- **In ordine casuale (shuffle)**: a ogni visita il lettore mescola i brani, quindi «Ascolta TAUH» parte ogni volta da un pezzo diverso e il tasto avanti segue quell'ordine. Mentre si gira per il sito, o ricaricando la pagina, l'ordine resta lo stesso; finito il giro ne mescola un altro, senza ripetere subito l'ultimo brano. Se chi visita sceglie un brano dall'elenco, si continua da lì. I brani chiusi vengono saltati.

I brani stanno in `contenuti/musica/`, elencati in `musica.json` nell'ordine in cui compaiono nell'elenco della home (il lettore poi li suona in ordine casuale):

```json
{
  "brani": [
    { "titolo": "Non ho un cuore", "file": "non-ho-un-cuore.mp3", "copertina": "non-ho-un-cuore.webp" },
    { "titolo": "Incubo", "file": "incubo.mp3", "copertina": "incubo.webp", "nota": "La traccia del gioco", "bloccata_fino_al": "2026-10-28" }
  ]
}
```

Per aggiungere un brano:

1. Esporta l'MP3 (a 192 kbps basta e avanza; ogni file deve stare sotto i 25 MB) e mettilo in `contenuti/musica/`.
2. Se vuoi la copertina, mettila nella stessa cartella: un'immagine quadrata JPG o WebP da 512×512. Senza copertina il brano usa la foto in bianco e nero del caprone (`src/img/copertina-riserva-512.webp`).
3. Aggiungi una riga a `musica.json`. `"nota"` è facoltativa e compare sotto il titolo, accanto alla durata (per esempio «con …» per una collaborazione).
4. Commit e push.

I brani di adesso hanno tutti lo stesso volume (circa −10 LUFS), così passando da uno all'altro non ci sono salti. Se ne aggiungi uno molto più forte o più piano, chiedi a Claude di allinearlo.

Per togliere un brano cancella la sua riga e il file.

#### Brani in arrivo

Con `"in_arrivo": "AAAA-MM-GG"` il brano compare nell'elenco con il lucchetto e «In arrivo» sotto il titolo, non si può ascoltare e il lettore lo salta. Dal giorno indicato (a mezzanotte) si sblocca da solo per tutti; dopo quella data la riga si può anche togliere. Il gioco non lo sblocca.

Adesso ce l'ha «Edgar Allan Poe», fino al 15 novembre 2026.

Con `"in_arrivo": true`, senza data, il brano resta chiuso finché non togli la riga. In questo caso l'MP3 non serve e, anche se c'è, non viene pubblicato: chi guarda il codice del sito non lo trova. Il repository su GitHub è pubblico, quindi l'MP3 di un brano ancora inedito non va messo in `contenuti/musica/` finché non lo sblocchi: il giorno in cui lo sblocchi aggiungi il file e togli `"in_arrivo"`. Adesso ce l'ha «Brivido e Panico», con la copertina di Incubo.

#### Brani col lucchetto

Con `"bloccata_fino_al": "AAAA-MM-GG"` il brano ha il lucchetto: nell'elenco compare con «Finisci il primo livello del gioco per ascoltarla» e porta alla pagina del gioco, e il lettore lo salta. Chi finisce il primo livello lo sblocca: il browser se lo ricorda e il brano si ascolta come gli altri. Dal giorno indicato (a mezzanotte) il brano è libero per tutti, senza fare niente; dopo quella data la riga si può anche togliere.

Adesso ce l'ha «Incubo», la traccia del gioco, fino al 28 ottobre 2026, il giorno in cui finisce il conto alla rovescia del pre-save.

Lo sblocco funziona perché, durante la generazione, alla pagina del gioco si aggiunge un piccolo script: quando compare la schermata di vittoria («Le anime sono libere») segna il livello finito e mostra «Hai sbloccato…» con il link alla musica del sito. Il codice del gioco non cambia, quindi resta così anche quando si aggiorna il gioco, purché la schermata di vittoria si chiami ancora `won`.

### Artwork

Le immagini da scaricare stanno in `contenuti/artwork/`, elencate in `artwork.json` nell'ordine della pagina:

```json
{
  "opere": [
    { "titolo": "Demoni", "file": "demoni.jpg", "anteprima": "demoni-600.webp", "grande": "demoni-1600.webp" },
    { "titolo": "Per levarti il sorriso", "versione": "Variant", "file": "per-levarti-il-sorriso-viola.jpg", "anteprima": "per-levarti-il-sorriso-viola-600.webp", "grande": "per-levarti-il-sorriso-viola-1600.webp" }
  ]
}
```

- `file` è l'immagine in alta risoluzione che si scarica (JPG o PNG).
- `anteprima` (600 px) e `grande` (1600 px, quella che si apre toccando l'immagine) sono facoltative ma rendono la pagina molto più leggera: se mancano il sito usa il file grande. Claude le prepara da solo.
- `versione` compare sotto il titolo e nel nome del file scaricato: per le versioni con colori diversi si usa «Variant». Si può aggiungere anche `"descrizione"`.

Chi scarica riceve il file con un nome chiaro, per esempio «TAUH - Demoni.jpg».

### Ebook

Per ora la pagina Ebook è nascosta: in `contenuti/sito.json`, alla voce `"ebook"`, c'è `"pubblica": false`. Per riaccenderla metti `true`.

Ogni ebook ha una cartella in `contenuti/ebook/`, per esempio `contenuti/ebook/la-via-della-mano-sinistra/`, con dentro il PDF (o anche l'EPUB), la copertina e un file `ebook.json`:

```json
{
  "titolo": "La via della mano sinistra",
  "sottotitolo": "Breve guida",
  "descrizione": "Di cosa parla, in due righe.",
  "data": "2026-11-01",
  "copertina": "copertina.webp",
  "file": [
    { "file": "la-via-della-mano-sinistra.pdf", "etichetta": "PDF" },
    { "file": "la-via-della-mano-sinistra.epub", "etichetta": "EPUB" }
  ]
}
```

Se c'è un solo formato basta `"file": "nome.pdf"`. Gli ebook si ordinano per data, dal più recente. Finché la cartella è vuota la pagina Ebook mostra «In arrivo».

Tutto quello che sta sotto `/scarica/` (artwork ed ebook) il browser lo scarica invece di aprirlo.

Negli ebook vanno solo testi tuoi, o di autori che ti hanno dato il permesso: i libri di altri, anche se in rete girano gratis, vanno nella Biblioteca con un link.

### Merch

Verso il fondo della home c'è la sezione Merch con le magliette; nel menu la voce Merch porta lì. Le immagini stanno in `contenuti/merch/` e il resto in `contenuti/sito.json`, alla voce `"merch"`:

```json
"merch": {
  "titolo": "Merch",
  "testo": "Le magliette di TAUH…",
  "link": "https://ig.me/m/tauh616",
  "bottone": "Chiedi in DM su IG",
  "articoli": [
    {
      "titolo": "Xenomorfo",
      "dettagli": "T-shirt nera, serigrafia a 4 colori.",
      "immagini": [
        { "file": "xenomorfo-maglietta.webp", "alt": "Descrizione della foto" },
        { "file": "xenomorfo-disegno.webp", "alt": "Descrizione del disegno" }
      ]
    }
  ]
}
```

Il bottone apre una chat con TAUH su Instagram (`ig.me/m/tauh616`). Le immagini vanno bene in verticale (4:5), per esempio 800×1000. Per togliere la sezione cancella la voce `"merch"`.

### Sostienimi (donazioni)

Dopo il Merch c'è il riquadro «Sostienimi», con il sigillo della pietra filosofale e il link per donare con PayPal. Si cambia in `contenuti/sito.json`, alla voce `"sostieni"`:

```json
"sostieni": {
  "titolo": "Sostienimi",
  "testo": "Puoi donare alla Via delle Ombre…",
  "link": "https://paypal.me/Tauved",
  "bottone": "Dona con PayPal",
  "sigillo": "pietra-filosofale.webp",
  "qr": "paypal-qr.svg",
  "qr_testo": "Oppure inquadra il codice col telefono."
}
```

Il sigillo si prende da `contenuti/social/`. Il bottone apre la pagina PayPal.me di TAUH in un'altra scheda. Su computer, accanto al bottone, c'è anche il codice QR (`contenuti/sostieni/paypal-qr.svg`, nei colori del sito) per donare dal telefono; sul telefono il codice non compare. Se il link cambia, il codice QR va rifatto con il link nuovo (lo fa Claude), oppure si toglie la riga `"qr"`. Per togliere il riquadro cancella la voce `"sostieni"`.

### Ringraziamenti

Dopo «Sostienimi» c'è la sezione Ringraziamenti, alla voce `"ringraziamenti"` di `contenuti/sito.json`. Ogni voce ha `"chi"` (in verde) e `"per"` (sotto):

```json
"ringraziamenti": {
  "titolo": "Ringraziamenti",
  "intro": "Ringrazio",
  "voci": [
    { "chi": "Perry Watt", "per": "per avermi tirato fuori dal mio Loculo" }
  ],
  "sostenitori_titolo": "Sostenitori",
  "sostenitori": [
    { "nome": "Nome Cognome", "nota": "Primo sostenitore" },
    { "nome": "@profilo", "link": "https://www.instagram.com/profilo/" }
  ]
}
```

In `"sostenitori"` vanno le persone che hanno donato e hanno lasciato il loro profilo nella causale: compaiono sotto i ringraziamenti, ognuna in una pastiglia col suo nome. Il link è facoltativo (basta anche solo `"@profilo"`); `"nota"` è una scritta piccola in verde accanto al nome, anche questa facoltativa. Finché l'elenco è vuoto, quella parte non si vede.

### Manifesto

Proprio in fondo alla home c'è il Manifesto: è chiuso e si apre toccandolo; la voce Manifesto del menu lo apre e ci porta. Si cambia in `contenuti/sito.json`, alla voce `"manifesto"`:

```json
"manifesto": {
  "titolo": "Manifesto",
  "invito": "Tocca per aprirlo",
  "punti": [
    { "titolo": "La vita è dannazione", "testo": "Quello che vediamo come dono…" }
  ]
}
```

I punti si numerano da soli, con i numeri romani, nell'ordine in cui sono scritti. Per togliere il Manifesto (e la voce del menu) cancella la voce `"manifesto"`.

L'ordine della home è: apertura, pre-save, Gioco, Pillole di conoscenza, In arrivo, Ascolta, Da leggere e da scaricare, Telegram, Merch, Sostienimi, Ringraziamenti, I miei social, Manifesto.

### Sezioni in arrivo

Dopo le Pillole di conoscenza c'è «In arrivo», con le sezioni che verranno: per ora «Impara la Chaos Magick» e «Impara a fare i sigilli», col lucchetto. Si cambia in `contenuti/sito.json`, alla voce `"sezioni_in_arrivo"`:

```json
"sezioni_in_arrivo": {
  "titolo": "In arrivo",
  "testo": "Le prossime sezioni della Via delle Ombre.",
  "voci": [
    { "titolo": "Impara a fare i sigilli" },
    { "titolo": "Impara la Chaos Magick", "link": "/chaos-magick/", "testo": "…" }
  ]
}
```

Una voce senza `"link"` compare col lucchetto e «In arrivo»; quando la sezione è pronta si aggiunge il `"link"` (e, se vuoi, un `"testo"`) e il riquadro diventa cliccabile. Per togliere tutta la parte cancella la voce `"sezioni_in_arrivo"`.

### Biblioteca

La pagina Biblioteca consiglia libri e articoli di altri autori senza ospitarli: ogni scheda ha un link a dove trovarli in modo legale (gratis dall'autore o dall'editore, in libreria o in biblioteca). Sta tutto in `contenuti/biblioteca/biblioteca.json`, diviso in sezioni:

```json
{
  "sezioni": [
    {
      "titolo": "Magia e satanismo",
      "testo": "Una riga sotto il titolo della sezione (facoltativa).",
      "voci": [
        {
          "titolo": "Il libro di Thoth",
          "autore": "Aleister Crowley",
          "tipo": "Libro",
          "editore": "Nome dell'editore",
          "anno": "2004",
          "descrizione": "Due righe su perché leggerlo.",
          "link": "https://…",
          "dove": "editore"
        }
      ]
    }
  ]
}
```

`dove` decide la scritta del bottone: `gratis` («Leggilo gratis»), `editore` («Dall'editore»), `libreria` («In libreria») o `biblioteca` («In biblioteca»). Per una scritta diversa usa `"etichetta"`. I link si aprono in un'altra scheda. L'intro della pagina è in `contenuti/sito.json`, alla voce `"biblioteca"`; lì `"pubblica": false` nasconde la pagina e la voce del menu.

### Il gioco

Il gioco è Incubo e sta in `static/gioco/play/`: `index.html`, la cartella `src` con il codice e la cartella `assets` con la musica (va bene anche la versione in un unico file per itch.io).
Su computer si apre dentro la pagina /gioco/, con il bottone per lo schermo intero; su telefono e tablet si apre a tutta pagina con i comandi touch.
Quando si preme «Entra nella breccia» su Android il gioco passa a schermo intero e si gira in orizzontale; dove non si può (iPhone, browser dentro le app) resta in verticale con l'inquadratura allargata.

Per aggiornarlo:

1. Metti al posto del contenuto di `static/gioco/play/` quello della nuova versione del gioco.
2. Controlla che nei testi del gioco non ci siano riferimenti all'EP.
3. Commit e push.

I caratteri che il gioco chiede a Google vengono sostituiti da soli con quelli del sito durante la generazione. Sempre durante la generazione si aggiunge lo script che, a fine livello, sblocca i brani col lucchetto (vedi «Brani col lucchetto»).
I testi della pagina (storia, comandi, immagine di copertina in `src/img/incubo-1280.webp`) sono in `contenuti/sito.json`, alla voce `"gioco"`.
Con `"disponibile": false` la pagina torna a mostrare «In arrivo».

## Provarlo sul computer

```
npm run dev
```

Genera il sito e lo apre su http://localhost:8787 con le stesse regole di Cloudflare (la prima volta scarica `wrangler`).

`strumenti/importa_carosello.py` converte i canvas dei caroselli in tavole e testi: lo usa Claude, e serve Python con Playwright.

## Note

- I caratteri sono Cinzel e Montserrat, con licenza SIL Open Font License (i file sono in `src/font`). Il font Who asks Satan non è usato nel sito perché è gratuito solo per uso non commerciale.
- Il sito non usa cookie propri. I player di Spotify e YouTube si caricano solo quando chi visita preme il bottone.
- Per ricordare il brano e il punto in cui era, il lettore usa la memoria della scheda del browser (si cancella quando la scheda si chiude).
- Che il primo livello del gioco è finito, invece, il browser lo ricorda nella memoria del sito (la stessa dove il gioco salva volume e sensibilità): serve solo a sbloccare i brani col lucchetto e non esce dal browser.
- Sul sito non c'è nessun riferimento all'EP.
