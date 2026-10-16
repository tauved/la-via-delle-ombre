# La via delle ombre

Il sito di TAUH: i caroselli da sfogliare e leggere, la musica, il canale Telegram e il gioco.
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
5. Per usare un tuo dominio: apri il Worker, poi **Settings** e la sezione dei domini, e aggiungi un *custom domain*.
6. Quando conosci l'indirizzo definitivo, scrivilo in `contenuti/sito.json` alla voce `"url"` (per esempio `"https://tauh616.com"`) e fai il push: servono per la mappa del sito e per le anteprime dei link su Telegram e Instagram.

Da lì in poi ogni push su GitHub ripubblica il sito da solo.

## Aggiornare il sito

Ogni modifica segue lo stesso giro: cambi i file, fai commit e push, Cloudflare ripubblica.

### Aggiungere un carosello

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

Tutto sta in `contenuti/sito.json`: titolo e motto della home, testi delle sezioni, link a Instagram, YouTube, Spotify e Telegram.
Per mettere un video in evidenza nella sezione musica scrivi in `"youtube_video"` il codice del video (la parte dopo `v=` nell'indirizzo).

### Il gioco

Il gioco è Incubo e sta in `static/gioco/play/`: è la versione per itch.io (`index.html` e la cartella `assets` con la musica).
Su computer si apre dentro la pagina /gioco/, con il bottone per lo schermo intero; su telefono e tablet si apre a tutta pagina con i comandi touch.

Per aggiornarlo:

1. Metti al posto del contenuto di `static/gioco/play/` quello della nuova build per itch.io.
2. Controlla che nei testi del gioco non ci siano riferimenti all'EP.
3. Commit e push.

I caratteri che il gioco chiede a Google vengono sostituiti da soli con quelli del sito durante la generazione.
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
- Sul sito non c'è nessun riferimento all'EP.
