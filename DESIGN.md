---
name: La via delle ombre
description: Il sito di TAUH, nero pieno con la linea lime e il nodo viola dei caroselli.
colors:
  nero: "#000000"
  viola: "#674cc0"
  viola-acceso: "#7d63d4"
  viola-notte: "#110b20"
  lime: "#cffe7e"
  lime-chiaro: "#e0ffab"
  grigio: "#b3b3b3"
  bianco: "#ffffff"
  testo: "rgba(255, 255, 255, 0.88)"
  filo: "rgba(207, 254, 126, 0.16)"
typography:
  grande:
    fontFamily: "Cinzel, Georgia, 'Times New Roman', serif"
    fontSize: "clamp(2.5rem, 1.6rem + 4.4vw, 4.75rem)"
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: "0.01em"
  titolo:
    fontFamily: "Cinzel, Georgia, 'Times New Roman', serif"
    fontSize: "clamp(1.75rem, 1.25rem + 2.2vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.1
  sotto:
    fontFamily: "Cinzel, Georgia, 'Times New Roman', serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
  corpo:
    fontFamily: "Montserrat, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
  piccolo:
    fontFamily: "Montserrat, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.4
  meta:
    fontFamily: "Montserrat, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  miniatura: "6px"
  copertina: "8px"
  cornice: "12px"
  box: "14px"
  contenitore: "18px"
  riquadro: "20px"
  pillola: "999px"
  tondo: "50%"
spacing:
  margine: "clamp(1rem, 4.5vw, 2.75rem)"
  colonna: "76rem"
  alt-testata: "4rem"
  rientro: "1.15rem"
  rientro-largo: "3rem"
  sezione: "clamp(4rem, 10vw, 6.5rem)"
  testa-sezione: "clamp(1.5rem, 4vw, 2.25rem)"
  azioni: "0.75rem"
components:
  bottone:
    backgroundColor: "{colors.viola}"
    textColor: "{colors.bianco}"
    typography: "{typography.corpo}"
    rounded: "{rounded.pillola}"
    padding: "0.7em 1.35em"
    height: "48px"
  bottone-hover:
    backgroundColor: "{colors.viola-acceso}"
  bottone-primario:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.nero}"
    typography: "{typography.corpo}"
    rounded: "{rounded.pillola}"
    padding: "0.7em 1.35em"
    height: "48px"
  bottone-primario-hover:
    backgroundColor: "{colors.lime-chiaro}"
  bottone-filo:
    backgroundColor: "transparent"
    textColor: "{colors.lime}"
    rounded: "{rounded.pillola}"
    padding: "0.7em 1.35em"
    height: "48px"
  bottone-stretto:
    typography: "{typography.piccolo}"
    rounded: "{rounded.pillola}"
    padding: "0.5em 1.05em"
    height: "44px"
  riquadro-telegram:
    backgroundColor: "{colors.viola}"
    textColor: "{colors.bianco}"
    rounded: "{rounded.riquadro}"
    padding: "clamp(1.5rem, 5vw, 3rem)"
  box-tavola:
    backgroundColor: "{colors.viola}"
    textColor: "{colors.bianco}"
    rounded: "{rounded.box}"
    padding: "0.85rem 1.05rem"
  domanda-tavola:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.nero}"
    rounded: "{rounded.box}"
    padding: "0.85rem 1.05rem"
  brano:
    backgroundColor: "transparent"
    textColor: "{colors.bianco}"
    rounded: "0"
    padding: "0.5rem 0.4rem 0.5rem 0.25rem"
    height: "4.25rem"
  brano-attuale:
    backgroundColor: "rgba(103, 76, 192, 0.26)"
  lettore-fisso:
    backgroundColor: "rgba(17, 11, 32, 0.94)"
    textColor: "{colors.bianco}"
    rounded: "{rounded.pillola}"
    padding: "0.45rem 1.1rem 0.45rem 0.45rem"
  lettore-fisso-attivo:
    rounded: "{rounded.riquadro}"
    width: "min(26rem, calc(100vw - 2 * var(--margine)))"
  indice-voce:
    textColor: "{colors.bianco}"
    typography: "{typography.piccolo}"
    rounded: "{rounded.pillola}"
    padding: "0.4rem 0.95rem"
    height: "44px"
  contatore:
    backgroundColor: "rgba(103, 76, 192, 0.25)"
    textColor: "{colors.lime}"
    typography: "{typography.piccolo}"
    rounded: "{rounded.pillola}"
    padding: "0.3rem 0.8rem"
---

# Design System: La via delle ombre

## Overview

**Creative North Star: "La via da percorrere"**

Il sito è il prolungamento dei caroselli di TAUH: fondo nero pieno, una linea lime che si percorre, un nodo viola che dice dove sei. Tutto il resto (titoli Cinzel in lime, testi Montserrat, il riquadro viola in corsivo, il sigillo con l'anello) viene da quei caroselli e non da un'estetica nuova. La pagina non è una pila di riquadri uguali ma un cammino a tappe: nella home una sola linea scende lungo tutte le sezioni e il nodo, fermo a metà schermo, accende il cerchio di ogni titolo quando ci passa.

La densità è bassa e verticale: una colonna di 76rem, molto nero tra una tappa e l'altra, separazioni fatte con fili sottili (lime al 16%) invece che con contenitori. La materia visiva è solo quella vera di TAUH: il ritratto con la maschera, le tavole delle pillole, le copertine, le magliette, i sigilli, la partita vera del gioco. La luce è rara e si guadagna: l'unico alone del sito è quello lime del titolo grande dell'apertura.

Il carattere è oscuro ma chiaro, come la voce di TAUH: contrasto alto, un solo colore che chiama l'azione per tappa, niente ornamento che non sia già un segno di TAUH.

**Key Characteristics:**
- Fondo nero pieno (#000) su ogni pagina; il colore entra come linea, testo o bottone, mai come atmosfera.
- La via: linea lime da 2px con il nodo viola (anello viola 3px, punto lime al centro), nella home verticale, nelle pillole orizzontale come avanzamento.
- Cinzel per titoli e nomi (lime), Montserrat per il testo; sei grandezze in tutto.
- Bottoni a pillola; un solo bottone lime pieno per sezione, gli altri a filo.
- Profondità quasi assente: fili, contorni interni e veli scuri sulle foto, non ombre.

## Colors

Una palette fissa a tre voci su nero, presa dai caroselli: il lime parla, il viola segna, il grigio sussurra.

### Primary
- **Lime dei caroselli** (lime): la linea della via, tutti i titoli Cinzel, i link, il bottone pieno di ogni tappa, il contorno di focus (3px), la selezione del testo. È anche il punto al centro del nodo.
- **Lime chiaro** (lime-chiaro): solo stato di passaggio del mouse su link e bottoni lime; mai come colore a riposo.

### Secondary
- **Viola del nodo** (viola): l'anello del nodo e del sigillo-tappa, il riquadro in corsivo (Telegram) e il box delle tavole, il tondo del lettore fermo, il bottone di base. Le sue trasparenze (rgba(103, 76, 192, 0.14 / 0.16 / 0.25 / 0.26)) fanno da evidenziatore: tavola attuale, riga di brano al passaggio e in ascolto, contatore.
- **Viola acceso** (viola-acceso): il passaggio del mouse sul viola e i numeri del Manifesto.
- **Viola notte** (viola-notte): fondo delle immagini che stanno caricando, del campo di ricerca e delle schede secondarie (pillole vicine, ebook, tools); è l'unica superficie che non è nero puro.

### Neutral
- **Nero pieno** (nero): il fondo di tutto, il testo sopra il lime, il velo che sale dal basso sul ritratto.
- **Grigio cenere** (grigio): testi secondari, date, metadati, il «Tocca per aprirli».
- **Bianco** (bianco): voci di menu, nomi nelle righe, testo dentro il viola.
- **Testo** (testo, bianco all'88%): il corpo di lettura.
- **Filo** (filo, lime al 16%): bordi della testata, separatori delle righe (brani, Biblioteca, comandi, Manifesto), la via spenta delle tavole.

### Named Rules
**La Regola del Fondo Pieno.** Il fondo è nero #000 ovunque. Niente sfumature radiali come atmosfera, niente fondali colorati: le uniche sfumature sono lineari e servono a far leggere il testo sopra una foto (il buio che sale sul ritratto, sulla scena del gioco e della soglia). Il disegno del nodo (punto lime a bordo netto dentro l'anello viola) usa un radial-gradient a stop netti: è il segno dei caroselli, non un'atmosfera, e resta.

**La Regola del Lime che Chiama.** In ogni sezione c'è un solo bottone lime pieno: l'azione della tappa. Le altre azioni sono a filo (contorno lime) o viola.

## Typography

**Display Font:** Cinzel (con Georgia, «Times New Roman», serif)
**Body Font:** Montserrat (con «Helvetica Neue», Arial, sans-serif)

**Character:** Cinzel porta le maiuscole incise dei caroselli e dà il tono rituale a titoli e nomi; Montserrat è asciutto e leggibile dal telefono. Entrambi sono ospitati sul sito (variabili, woff2).

### Hierarchy
- **Grande** (Cinzel 700, --t-grande, 1.06; 0.98 nell'apertura): il titolo della home, gli h1 delle pagine archivio (Pillole, Biblioteca, Artwork, Tools, Ebook), la scena del gioco e della soglia, il titolo del Manifesto. Solo qui, nell'apertura, il titolo porta l'alone lime.
- **Titolo** (Cinzel 600, --t-titolo, 1.1): i titoli delle tappe della home (con il cerchio della via), il titolo dell'uscita, il titolo del riquadro Telegram, l'h1 di una pillola (sta nella colonna del testo, quindi misura da titolo).
- **Sotto** (Cinzel 600, --t-sotto, 1.25–1.3): motto, sottotitoli, h3 (lettore, tavole, apribili, merch, comandi), nomi delle porte e dei social, titoli dei libri e degli artwork. In Montserrat corsivo 500 è il testo del riquadro Telegram; in Montserrat 500 è l'attacco della storia del gioco.
- **Corpo** (Montserrat 400, --t-corpo, 1.65, paragrafi fino a 62ch): lettura; in Montserrat 600 è il testo dei bottoni; in Cinzel 600 è il nome di una scheda, di un brano, del brano in ascolto, delle pillole vicine, dei ringraziati.
- **Piccolo** (Montserrat 600/400, --t-piccolo): voci della testata, bottoni stretti, indice della Biblioteca, contatore delle tavole, autore di un libro, testi di servizio grigi.
- **Meta** (Montserrat 400/600, --t-meta): numero e durata dei brani, tempo del lettore, numeri delle tavole, edizione di un libro, formato e peso dei file.

### Named Rules
**La Regola delle Sei Grandezze.** Il testo usa solo --t-meta, --t-piccolo, --t-corpo, --t-sotto, --t-titolo, --t-grande. Una misura nuova non si inventa: si sceglie il ruolo.

**La Regola delle Etichette Piane.** Le etichette dell'interfaccia (menu, bottoni, stati, metadati) sono in Montserrat con lettere a spaziatura normale e in maiuscolo/minuscolo. Il maiuscoletto di Cinzel è il carattere stesso dei titoli e l'anello del sigillo è un segno di TAUH: nessuno dei due è un'etichetta.

## Layout

Una colonna centrale di larghezza --colonna (76rem) con margini --margine; sul telefono tutto è una colonna sola. La testata è fissa in alto (--alt-testata, 4rem) su nero al 78% con sfocatura di 12px; sotto i 69.9375em le voci diventano un menu a tendina.

**La home** si apre con il ritratto a tutta altezza (telefono: dietro il testo, con il buio che sale dal basso; da 56.25em: a destra al 56% della larghezza, testo a sinistra largo al massimo 36rem). Sotto comincia la via: una linea verticale lime da 2px a --via-x (bordo sinistro della colonna più --via-scarto), con il testo rientrato di --rientro (1.15rem, 3rem da 56.25em). Ogni sezione è una tappa: titolo con il cerchio sulla linea, contenuto, poi --sezione di vuoto prima della tappa successiva. Le copertine delle pillole scorrono di lato in un binario a scatto; la clip del gioco va a tutta larghezza (16:9, al massimo 78svh).

**Una pillola** sul computer (da 1000px) è una griglia a due colonne: a sinistra il visore fisso (sticky) largo al massimo 36rem, a destra testata e testo tavola per tavola; sul telefono le due parti si impilano.

**La Biblioteca**: l'indice a pillole in cima, poi gli scaffali, ognuno aperto da un filo lime pieno da 2px; i libri sono righe separate da un filo, in due colonne da 900px.

Il ritmo verticale è a gradini clamp(): circa 1–1.5rem dentro un blocco, 2.25–3.5rem tra un blocco e il successivo, 4–6.5rem tra le sezioni. Le azioni stanno in fila con 0.75rem di spazio e vanno a capo. Ogni bersaglio tocca almeno 44px.

## Elevation & Depth

Il sito è piatto. La profondità viene dal nero e da tre mezzi: i fili (bordi da 1px lime al 16%), i contorni interni (box-shadow inset 1–1.5px in lime o viola, che disegnano bottoni a filo, frecce e schede senza alzarle) e i veli scuri sulle foto. Le ombre vere sono poche e solo scure, per staccare dal fondo ciò che galleggia sopra il contenuto: il lettore fisso e la finestra degli artwork.

### Shadow Vocabulary
- **Contorno a filo** (`box-shadow: inset 0 0 0 1.5px rgba(207, 254, 126, 0.55)`; al passaggio `var(--lime)`): bottone a filo, frecce, tondi di comando, voci dell'indice (0.4).
- **Contorno viola** (`box-shadow: inset 0 0 0 1px rgba(103, 76, 192, 0.5)`): schede su viola notte (pillole vicine, ebook, tools).
- **Galleggiante** (`box-shadow: inset 0 0 0 1px rgba(103, 76, 192, 0.75), 0 12px 32px rgba(0, 0, 0, 0.65)`): solo il lettore fisso in basso.
- **Alone del titolo** (`text-shadow: 0 0 28px rgba(207, 254, 126, 0.28), 0 2px 14px rgba(0, 0, 0, 0.9)`): solo il titolo grande dell'apertura.

### Named Rules
**La Regola dell'Unico Alone.** Nessun alone su riquadri, bottoni o immagini. L'alone lime esiste una volta sola: sul titolo grande dell'apertura.

## Shapes

Due famiglie di forme: la pillola e il tondo per tutto ciò che si tocca (bottoni, campi, indice, contatore, lettore fermo, frecce, nodo, tappe), angoli morbidi per ciò che si guarda. Le immagini piccole hanno 6–8px (miniature dei brani, copertina dell'uscita), le tavole e le copertine delle schede 10–12px, il box delle tavole e le schede secondarie 14px, i contenitori grandi 18px, il riquadro Telegram e il lettore aperto 20px. Il sigillo e i sigilli dei social sono cerchi. Le righe (brani, libri, comandi, Manifesto) non hanno angoli: sono separate da un filo. Le proporzioni delle immagini sono fisse: 4:5 per tavole e copertine delle pillole, 1:1 per copertine e artwork, 16:9 per il gioco.

## Components

### Bottoni
Pillole piene e decise, sempre con un'icona SVG a sinistra quando l'azione è suonare, scaricare o uscire dal sito.
- **Forma:** pillola (999px), altezza minima 48px, Montserrat 600 --t-corpo, spazio interno 0.7em 1.35em.
- **Base (viola):** viola su bianco; al passaggio viola acceso.
- **Primario (lime):** lime con testo nero; al passaggio lime chiaro. Uno solo per sezione.
- **Filo:** trasparente, testo lime, contorno interno lime al 55%; al passaggio contorno pieno e testo lime chiaro.
- **Stretto:** variante di uno dei tre per le righe e le barre (44px, --t-piccolo, 0.5em 1.05em).
- **Focus:** contorno lime 3px staccato di 3px, uguale in tutto il sito.

### La via, il nodo e le tappe
La firma del sito.
- **Linea:** lime 2px. Nella home è verticale: la parte già percorsa è lime pieno, il resto lime al 22% (--via-fatto, aggiornato a ogni scorrimento).
- **Nodo:** tondo da 24px con anello viola 3px e punto lime da 5px su nero; nella home è sticky a metà schermo e appare solo quando la via è cominciata.
- **Tappa:** cerchio lime da 16px sulla linea, all'altezza del titolo della sezione, staccato dal nero da un anello di 4px; spento (nero con contorno lime al 45%, scala 0.75) finché il nodo non lo raggiunge, e nascosto mentre il nodo ci passa sopra.
- **Nelle pillole:** la stessa via orizzontale tra le frecce del visore, con il nodo che scorre all'avanzare delle tavole; nel testo, una via verticale sottile (filo) unisce i nodi delle tavole, quello della tavola visibile è acceso.

### L'uscita nell'apertura
Copertina 1:1 (5.25rem, 7rem sul computer, angoli 8px), titolo Cinzel --t-titolo, stato in bianco 600 e data in grigio, una riga di spiegazione grigia e un solo bottone lime pieno. Separata dal motto da un filo lime al 30%. Sul telefono è l'unica azione della prima schermata; sugli schermi bassi perde la spiegazione.

### Righe dei brani
Una scaletta: righe alte almeno 4.25rem separate da un filo, miniatura 52px (angoli 6px), titolo Cinzel lime --t-corpo, nota grigia --t-meta in cifre tabellari, tondo da 40px a destra con contorno lime. Al passaggio la riga si colora di viola al 16% e il tondo si riempie di lime; quella in ascolto resta viola al 26%. I brani chiusi hanno la miniatura al 60% e il lucchetto, e non reagiscono al passaggio se non portano da nessuna parte. Se ne vedono sei; gli altri si aprono con un bottone a filo.

### Le porte
Ingressi alle pagine da scaricare: immagine (1:1 sul telefono accanto al testo, 4:3 sopra il testo da 48em) con angoli 10px e filo, nome Cinzel lime --t-sotto, una riga grigia. Al passaggio l'immagine prende un contorno lime da 2px.

### Il riquadro viola in corsivo
Il box dei caroselli, riservato al canale Telegram: viola pieno, angoli 20px, spazio interno clamp(1.5rem, 5vw, 3rem), titolo Cinzel bianco --t-titolo, testo Montserrat corsivo 500 --t-sotto, un bottone lime pieno. Dentro le tavole lo stesso box vive in piccolo (angoli 14px, corsivo 500), accanto alla domanda su lime con testo nero.

### Apribile
Ringraziamenti e Manifesto chiusi tra due fili: titolo a sinistra, a destra «Tocca per aprirli» in grigio --t-piccolo con il più lime che ruota di 45° all'apertura; il contenuto entra con una dissolvenza di 0.4s.

### Il sigillo
Il logo di TAUH dentro due cerchi lime con l'anello «NON SERVIAM · LUX IN TENEBRIS · LUCIFER» in Cinzel 700. Chiude la via nel piede (clamp(9.5rem, 34vw, 12.5rem)); sul computer apre anche l'apertura. L'anello ruota solo mentre si scorre la pagina.

### Il lettore fisso
In basso a destra, sopra ogni pagina. Da fermo è una pillola viola notte al 94% con sfocatura, tondo viola 46px con il triangolo lime e «Ascolta TAUH» (sul telefono solo il tondo). Finché l'uscita dell'apertura è sullo schermo, il lettore fermo si fa da parte (dissolvenza di 0.25s), così il pre-save resta l'unico bottone pieno. In ascolto diventa una barra di 26rem con angoli 20px: copertina 44px, titolo Cinzel lime, tempo, via di avanzamento con un nodo da 14px, tondo lime per la pausa, prossimo e chiudi. La musica continua cambiando pagina.

### Il visore delle pillole
Le tavole 4:5 in una pista a scatto con angoli 12px su viola notte; sotto: freccia, via con nodo, contatore a pillola (viola al 25%, cifre lime tabellari), freccia; poi tre bottoni a filo da 44px (Schermo intero, Condividi, Su Instagram). Sul computer resta fisso accanto al testo.

### Indice e righe della Biblioteca
L'indice è una fila di pillole a filo (lime al 40%, 44px, --t-piccolo bianco) con il numero delle letture in grigio. Ogni scaffale si apre con un filo lime pieno da 2px; ogni libro è una riga: titolo Montserrat 600 --t-sotto bianco, autore lime --t-piccolo, edizione grigia --t-meta, descrizione, poi i bottoni stretti.

### Navigazione
Testata: logo a sinistra, voci Montserrat 600 --t-piccolo in bianco, lime al passaggio; la pagina attuale è lime con un punto da 6px sotto. Sotto i 69.9375em un bottone «Menu» a pillola con contorno apre l'elenco a tendina su nero al 97%, voci separate da fili.

### Movimento
- La via e il nodo seguono lo scorrimento (sticky più una variabile aggiornata a ogni fotogramma), non un'animazione a tempo.
- L'anello del sigillo ruota legato allo scorrimento (animation-timeline: scroll), solo senza «riduci movimento».
- La clip del gioco è muta, gira solo quando è sullo schermo e ha un tondo per fermarla; con «riduci movimento» resta sul primo fotogramma.
- Navigazione morbida (view transition 0.2s) e scorrimento dolce solo senza «riduci movimento»; tra una pagina e l'altra una linea lime corre in cima (ferma e piena con «riduci movimento»).

## Do's and Don'ts

### Do:
- **Do** tieni il fondo nero #000 e usa solo i colori del frontmatter; lime per ciò che chiama, viola per ciò che segna, grigio per ciò che accompagna.
- **Do** metti un solo bottone lime pieno per sezione; le altre azioni a filo o viola.
- **Do** scegli la grandezza del testo tra le sei variabili (--t-meta … --t-grande) in base al ruolo.
- **Do** usa la via (linea lime 2px, nodo viola e lime) per dire dove si è: tappe, tavole, avanzamento del brano.
- **Do** separa le righe con il filo (lime al 16%) invece di chiuderle in riquadri.
- **Do** usa solo materiale vero di TAUH: ritratto, tavole, copertine, magliette, sigilli, partita del gioco.
- **Do** lascia i testi di TAUH come li ha scritti: si correggono solo refusi e punteggiatura.
- **Do** lega il movimento allo scorrimento o a un gesto, e fermalo con «riduci movimento».

### Don't:
- **Don't** usare sfumature radiali come fondo o atmosfera (il punto a bordo netto del nodo è il disegno del nodo, non un'atmosfera).
- **Don't** mettere aloni su riquadri, bottoni o immagini: l'unico alone è quello lime del titolo grande dell'apertura.
- **Don't** usare il maiuscoletto spaziato (maiuscole con letter-spacing) nelle etichette dell'interfaccia.
- **Don't** mettere occhielli o etichette sopra i titoli: la tappa si apre con il titolo.
- **Don't** usare bordi colorati a sinistra come accento di un blocco.
- **Don't** usare immagini generate, foto di repertorio o loghi dei social: al loro posto i sigilli di TAUH.
- **Don't** riformulare i testi di TAUH.
- **Don't** usare il riquadro viola in corsivo per altro che il Telegram (e, in piccolo, per il box delle tavole).
- **Don't** tornare alla pila di riquadri arrotondati tutti uguali (titolo lime, paragrafo grigio, bottone lime).
