# Product

<!-- impeccable:product-schema 1 -->

Scritto il 23 ottobre 2026 dalle note del progetto e dalle scelte già confermate da TAUH nelle sessioni di lavoro, senza un'intervista dedicata. Vale per chiunque lavori su questo repository (persone o sessioni di Claude).

## Platform

web

## Users

- Chi segue TAUH su Instagram, TikTok, YouTube e Telegram e arriva dal link nella bio: quasi sempre dal telefono, spesso dentro il browser interno di Instagram, con pochi secondi di attenzione.
- Chi vuole leggere con calma le «pillole di conoscenza» (le tavole dei caroselli di TAUH su esoterismo, magia, filosofia) con il testo accanto.
- Chi viene per ascoltare i brani, giocare a «Incubo», scaricare gli artwork o i programmi gratuiti, comprare una maglietta o fare una donazione.

## Product Purpose

«La via delle ombre» è il sito di TAUH: mette in un posto solo musica, pillole di conoscenza, il gioco «Incubo», artwork, biblioteca, tools per artisti, merch, donazioni e i social. Funziona quando chi arriva dai social pre-salva o ascolta l'ultima uscita, entra nel canale Telegram, legge una pillola o gioca, e poi torna.

## Positioning

Un solo artista che fa musica, divulgazione esoterica e un videogioco con la stessa estetica: le pillole sono le tavole dei suoi caroselli, il gioco suona la sua musica, i social sono i suoi sigilli. Nessun altro sito ha questi materiali.

## Operating Context

- Sito statico generato da `build.mjs` (Node 20+, zero dipendenze) a partire da `contenuti/`, `src/` e `static/`; Cloudflare lo ripubblica a ogni push su `main`.
- Più sessioni di lavoro scrivono nello stesso repository: prima di lavorare `git pull`, prima del push `git fetch`.
- La musica del sito continua cambiando pagina (navigazione morbida), con il lettore fisso in basso.

## Capabilities and Constraints

- Il repository è pubblico: niente brani inediti, niente codici delle donazioni (nel sito solo le impronte), niente riferimenti a uscite non ancora annunciate, titoli compresi, nei testi, nel README e nei messaggi di commit.
- Il nome e il cognome di TAUH non compaiono da nessuna parte.
- Niente loghi dei social: al loro posto ci sono i sigilli di TAUH.
- Niente PDF di libri di altri autori: la Biblioteca porta solo a fonti legali. I testi scritti da TAUH si possono scaricare.
- Nessun servizio esterno si carica senza un gesto di chi visita (i player di Spotify e YouTube partono al clic); i caratteri sono ospitati sul sito.
- I testi scritti da TAUH (Sostienimi, Ringraziamenti, Manifesto, sezioni in arrivo) si correggono solo nei refusi e nella punteggiatura.
- Sul sito i caroselli si chiamano «Pillole di conoscenza»; negli indirizzi e nel codice restano «caroselli».
- I lucchetti dei brani (gioco, codici delle donazioni) vivono solo nel browser: non sono una protezione vera.

## Brand Commitments

- Palette dei caroselli, fissa: nero #000000, viola #674CC0, lime #CFFE7E, grigio #B3B3B3.
- Caratteri fissi: Cinzel per i titoli, Montserrat per il testo (licenza OFL, ospitati in `src/font`).
- Segni di TAUH da tenere: il sigillo con l'anello «NON SERVIAM · LUX IN TENEBRIS · LUCIFER» attorno al logo, la linea lime con il nodo viola dei caroselli, i sigilli dei social, il box viola in corsivo dei caroselli, il ritratto con la maschera.
- Voce: italiano diretto, in seconda persona, oscuro ma chiaro. Nessuna promessa o numero inventato.

## Evidence on Hand

- `contenuti/`: le pillole con tutte le tavole e i testi, i brani, gli artwork, la Biblioteca, i tools, il merch, i sigilli, i testi del sito (`sito.json`).
- `src/img/ritratto-*.webp`: il ritratto di TAUH con la maschera.
- `static/gioco/play/`: il gioco «Incubo».
- Non esistono recensioni, citazioni della stampa o numeri di ascolti da mostrare: non vanno inventati.

## Product Principles

1. L'ultima uscita viene prima: chi arriva dai social pre-salva o ascolta dalla prima schermata.
2. La home è una via da percorrere, con tappe, non una pila di riquadri uguali.
3. Le parole di TAUH restano sue.
4. Leggero e rispettoso: niente tracciamento, niente servizi esterni senza un gesto, poco peso sul telefono.
5. Tutto deve funzionare dal telefono, anche nel browser di Instagram.

## Accessibility & Inclusion

WCAG 2.1 AA: contrasto, uso completo da tastiera e con lettore di schermo, «riduci movimento» rispettato, zoom al 400% senza scorrimento orizzontale, bersagli da almeno 44 px.
