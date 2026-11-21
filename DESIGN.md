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
  superficie: "#110b20"
  superficie-2: "#1a1230"
  superficie-3: "#251a42"
  bordo: "rgba(255, 255, 255, 0.07)"
  bordo-forte: "rgba(255, 255, 255, 0.13)"
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
  scheda: "24px"
  dentro: "16px"
  campo: "14px"
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
    padding: "0.62em 1.2em"
    height: "44px"
  bottone-hover:
    backgroundColor: "{colors.viola-acceso}"
  bottone-primario:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.nero}"
    typography: "{typography.corpo}"
    rounded: "{rounded.pillola}"
    padding: "0.62em 1.2em"
    height: "44px"
  bottone-primario-hover:
    backgroundColor: "{colors.lime-chiaro}"
  bottone-filo:
    backgroundColor: "{colors.superficie-2}"
    textColor: "{colors.bianco}"
    rounded: "{rounded.pillola}"
    padding: "0.62em 1.2em"
    height: "44px"
  bottone-filo-hover:
    backgroundColor: "{colors.superficie-3}"
  scheda:
    backgroundColor: "{colors.superficie}"
    rounded: "{rounded.scheda}"
    padding: "8px"
  scheda-hover:
    backgroundColor: "{colors.superficie-2}"
  campo:
    backgroundColor: "{colors.superficie-2}"
    textColor: "{colors.bianco}"
    rounded: "{rounded.campo}"
    height: "48px"
  barra-segmenti:
    backgroundColor: "rgba(17, 11, 32, 0.78)"
    textColor: "{colors.bianco}"
    rounded: "{rounded.pillola}"
    padding: "4px"
  segmento-attuale:
    backgroundColor: "{colors.superficie-3}"
    textColor: "{colors.lime}"
  etichetta:
    backgroundColor: "rgba(207, 254, 126, 0.14)"
    textColor: "{colors.lime}"
    typography: "{typography.meta}"
    rounded: "{rounded.pillola}"
    padding: "0.1rem 0.6rem"
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
    rounded: "18px"
    padding: "0.45rem 0.55rem 0.45rem 0.45rem"
    height: "4rem"
  brano-attuale:
    backgroundColor: "{colors.superficie-3}"
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

La densità è bassa e verticale: una colonna di 76rem, molto nero tra una tappa e l'altra. Dal 20 novembre 2026 i componenti hanno la grammatica di HeroUI: le raccolte (pillole, porte, brani, magliette, social, sostegno, apribili, libri) stanno su schede di viola notte con angoli di 24px e un filo bianco appena visibile, i comandi sono pieni e morbidi invece che a filo lime; i testi delle tappe restano sul nero. La materia visiva è solo quella vera di TAUH: il ritratto con la maschera, le tavole delle pillole, le copertine, le magliette, i sigilli, la partita vera del gioco. La luce è rara e si guadagna: l'unico alone del sito è quello lime del titolo grande dell'apertura.

Il carattere è oscuro ma chiaro, come la voce di TAUH: contrasto alto, un solo colore che chiama l'azione per tappa, niente ornamento che non sia già un segno di TAUH.

**Key Characteristics:**
- Fondo nero pieno (#000) su ogni pagina; il colore entra come linea, testo o bottone, mai come atmosfera.
- La via: linea lime da 2px con il nodo viola (anello viola 3px, punto lime al centro), nella home verticale, nelle pillole orizzontale come avanzamento.
- Cinzel per titoli e nomi (lime), Montserrat per il testo; sei grandezze in tutto.
- Bottoni a pillola; un solo bottone lime pieno per sezione, gli altri pieni e morbidi su viola notte.
- Profondità a strati: tre superfici di viola notte (a riposo, al passaggio, premuta o attuale) chiuse da un filo bianco al 7%; ombre solo sotto ciò che galleggia.
- Nomi piccoli (schede, brani, porte, social, tavole) in Montserrat 600 bianco; Cinzel lime ai titoli di pagina e di tappa.

## Colors

Una palette fissa a tre voci su nero, presa dai caroselli: il lime parla, il viola segna, il grigio sussurra.

### Primary
- **Lime dei caroselli** (lime): la linea della via, tutti i titoli Cinzel, i link, il bottone pieno di ogni tappa, il contorno di focus (3px), la selezione del testo. È anche il punto al centro del nodo.
- **Lime chiaro** (lime-chiaro): solo stato di passaggio del mouse su link e bottoni lime; mai come colore a riposo.

### Secondary
- **Viola del nodo** (viola): l'anello del nodo e del sigillo-tappa, il riquadro in corsivo (Telegram) e il box delle tavole, il tondo del lettore fermo, il bottone di base. Le sue trasparenze (rgba(103, 76, 192, 0.14 / 0.16 / 0.25 / 0.26)) fanno da evidenziatore: tavola attuale, riga di brano al passaggio e in ascolto, contatore.
- **Viola acceso** (viola-acceso): il passaggio del mouse sul viola e i numeri del Manifesto.
- **Viola notte** (viola-notte = superficie): la prima delle tre superfici: schede, liste, fondo delle immagini che caricano. **Superficie 2** (#1a1230): passaggio del mouse, bottoni morbidi, campi, tondi di comando. **Superficie 3** (#251a42): pressione, voce attuale (brano in ascolto, pagina attuale nella barra a segmenti).

### Neutral
- **Nero pieno** (nero): il fondo di tutto, il testo sopra il lime, il velo che sale dal basso sul ritratto.
- **Grigio cenere** (grigio): testi secondari, date, metadati, il «Tocca per aprirli».
- **Bianco** (bianco): voci di menu, nomi nelle righe, testo dentro il viola.
- **Testo** (testo, bianco all'88%): il corpo di lettura.
- **Filo** (filo, lime al 16%): la via spenta delle tavole, i separatori dei comandi e del Manifesto.
- **Bordo** (bordo, bianco al 7%; bordo-forte al 13%): chiude schede, bottoni morbidi, campi e tondi sul nero; separa le righe dei libri.

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
- **Corpo** (Montserrat 400, --t-corpo, 1.65, paragrafi fino a 62ch): lettura. In Montserrat 600 bianco è il nome di una porta, di un social, di una tavola nel testo, i titoli piccoli dentro le schede (lettore di Spotify, apribili, in arrivo, magliette, artwork).
- **Piccolo** (Montserrat 600/400, --t-piccolo): voci della testata, testo dei bottoni, nome di una pillola, di un brano e del brano in ascolto, indice della Biblioteca, contatore delle tavole, autore di un libro, testi di servizio grigi.
- **Meta** (Montserrat 400/600, --t-meta): numero e durata dei brani, tempo del lettore, numeri delle tavole, edizione di un libro, formato e peso dei file.

### Named Rules
**La Regola delle Sei Grandezze.** Il testo usa solo --t-meta, --t-piccolo, --t-corpo, --t-sotto, --t-titolo, --t-grande. Una misura nuova non si inventa: si sceglie il ruolo.

**La Regola delle Etichette Piane.** Le etichette dell'interfaccia (menu, bottoni, stati, metadati) sono in Montserrat con lettere a spaziatura normale e in maiuscolo/minuscolo. Il maiuscoletto di Cinzel è il carattere stesso dei titoli e l'anello del sigillo è un segno di TAUH: nessuno dei due è un'etichetta.

## Layout

Una colonna centrale di larghezza --colonna (76rem) con margini --margine; sul telefono tutto è una colonna sola. La testata è fissa in alto (--alt-testata, 4rem) su nero al 72% con sfocatura di 16px; da 70em le voci stanno in una barra a segmenti, sotto i 69.9375em diventano un menu a tendina che si apre come una scheda dal bottone.

**La home** si apre con il ritratto a tutta altezza (telefono: dietro il testo, con il buio che sale dal basso; da 56.25em: a destra al 56% della larghezza, testo a sinistra largo al massimo 36rem). Sotto comincia la via: una linea verticale lime da 2px a --via-x (bordo sinistro della colonna più --via-scarto), con il testo rientrato di --rientro (1.15rem, 3rem da 56.25em). Ogni sezione è una tappa: titolo con il cerchio sulla linea, contenuto, poi --sezione di vuoto prima della tappa successiva. Le copertine delle pillole scorrono di lato in un binario a scatto; la clip del gioco sta nella colonna, a destra della via come tutto il resto (16:9, angoli 12px con il filo, al massimo 78svh). Niente passa sopra la linea.

**Una pillola** sul computer (da 1000px) è una griglia a due colonne: a sinistra il visore fisso (sticky) largo al massimo 36rem, a destra testata e testo tavola per tavola; sul telefono le due parti si impilano.

**La Biblioteca**: l'indice a pillole in cima, poi gli scaffali, ognuno aperto da un filo lime pieno da 2px; i libri sono righe separate da un filo, in due colonne da 900px.

Il ritmo verticale è a gradini clamp(): circa 1–1.5rem dentro un blocco, 2.25–3.5rem tra un blocco e il successivo, 4–6.5rem tra le sezioni. Le azioni stanno in fila con 0.75rem di spazio e vanno a capo. Ogni bersaglio tocca almeno 44px.

## Elevation & Depth

Il sito è quasi piatto, con tre eccezioni in 3D vero che si toccano (la giostra delle pillole, il sigillo-moneta, il rilievo delle schede col mouse: vedi Componenti). Per il resto la profondità viene da tre superfici di viola notte una sopra l'altra (a riposo, al passaggio, premuta), chiuse sul nero da un filo bianco interno, e dai veli scuri sulle foto. Le ombre vere sono poche e solo scure, per staccare dal fondo ciò che galleggia sopra il contenuto: il lettore fisso, il menu a tendina e la finestra degli artwork.

### Shadow Vocabulary
- **Filo bianco** (`box-shadow: inset 0 0 0 1px var(--bordo)`; al passaggio `var(--bordo-forte)`): schede, bottoni morbidi, frecce e tondi, campi, voci dell'indice.
- **Galleggiante** (`box-shadow: inset 0 0 0 1px var(--bordo-forte), 0 12px 32px rgba(0, 0, 0, 0.65)`): il lettore fisso in basso; il menu a tendina ha la stessa ricetta con 0 18px 48px.
- **Vetro scuro** (viola notte al 60% con `backdrop-filter: blur(18px) saturate(140%)`): solo la scheda dell'uscita, perché sul telefono sta sopra il ritratto e deve restare leggibile; con «riduci trasparenza» è piena.
- **Alone del titolo** (`text-shadow: 0 0 28px rgba(207, 254, 126, 0.28), 0 2px 14px rgba(0, 0, 0, 0.9)`): solo il titolo grande dell'apertura.

### Named Rules
**La Regola dell'Unico Alone.** Nessun alone su riquadri, bottoni o immagini. L'alone lime esiste una volta sola: sul titolo grande dell'apertura.

## Shapes

Due famiglie di forme: la pillola e il tondo per ciò che si tocca (bottoni, indice, contatore, lettore fermo, frecce, nodo, tappe, etichette), angoli morbidi per ciò che contiene o si guarda. Le schede hanno 24px (--r-scheda) con 8px di margine interno, e ciò che sta dentro (copertine, tavole, foto delle magliette, artwork) 16px (--r-dentro), così le curve sono concentriche; le righe dei brani 18px, i campi 14px (--r-campo), la copertina dell'uscita e le miniature dei brani 12px, il riquadro Telegram 24px, il lettore aperto 20px. Il sigillo e i sigilli dei social sono cerchi. Le righe (brani, libri, comandi, Manifesto) non hanno angoli: sono separate da un filo. Le proporzioni delle immagini sono fisse: 4:5 per tavole e copertine delle pillole, 1:1 per copertine e artwork, 16:9 per il gioco.

## Components

### Bottoni
Pillole piene e decise, sempre con un'icona SVG a sinistra quando l'azione è suonare, scaricare o uscire dal sito.
- **Forma:** pillola (999px), altezza minima 44px, Montserrat 600 --t-piccolo, spazio interno 0.62em 1.2em.
- **Base (viola):** viola su bianco; al passaggio viola acceso.
- **Primario (lime):** lime con testo nero; al passaggio lime chiaro. Uno solo per sezione.
- **Morbido** (nel codice resta la classe `filo`): pieno di superficie 2 con il filo bianco, testo bianco, icona lime; al passaggio superficie 3 e filo al 13%.
- **Stretto:** variante di uno dei tre per le righe e le barre (44px, --t-piccolo, 0.5em 1.05em).
- **Tondi di comando** (frecce, pausa della clip, play dei brani): 44px (40px nei brani), pieni di superficie 2 con il filo bianco.
- **Focus:** contorno lime 3px staccato di 3px, uguale in tutto il sito.

### La via, il nodo e le tappe
La firma del sito.
- **Linea:** lime 2px. Nella home è verticale: la parte già percorsa è lime pieno, il resto lime al 22% (--via-fatto, aggiornato a ogni scorrimento).
- **Nodo:** tondo da 24px con anello viola 3px e punto lime da 5px su nero; nella home è sticky a metà schermo e appare solo quando la via è cominciata.
- **Tappa:** cerchio lime da 16px sulla linea, all'altezza del titolo della sezione, staccato dal nero da un anello di 4px; spento (nero con contorno lime al 45%, scala 0.75) finché il nodo non lo raggiunge, e nascosto mentre il nodo ci passa sopra.
- **Nelle pillole:** la stessa via orizzontale tra le frecce del visore, con il nodo che scorre all'avanzare delle tavole; nel testo, una via verticale sottile (filo) unisce i nodi delle tavole, quello della tavola visibile è acceso.

### L'uscita nell'apertura
Una scheda di vetro scuro (angoli 24px, 0.85rem di margine): copertina 1:1 (5.5rem, 7rem sul computer, angoli 12px, in alto), titolo Cinzel --t-titolo, lo stato («Nuovo singolo», «Ultima uscita») come etichetta lime su lime al 14%, la data in grigio, una riga di spiegazione grigia e un solo bottone lime pieno. Sul telefono è l'unica azione della prima schermata; sugli schermi bassi perde la spiegazione.

### Righe dei brani
Una scaletta su una scheda (6px di margine): righe alte almeno 4rem con angoli 18px e 2px di spazio tra l'una e l'altra, miniatura 48px (angoli 12px), titolo Montserrat 600 bianco --t-piccolo, nota grigia --t-meta in cifre tabellari, tondo da 40px a destra pieno di superficie 2 con il triangolo lime. Al passaggio la riga prende superficie 2 e il tondo si riempie di lime; quella in ascolto resta su superficie 3. I brani chiusi hanno la miniatura al 60% e il lucchetto, e non reagiscono al passaggio se non portano da nessuna parte. Se ne vedono sei; gli altri si aprono con un bottone a filo.

### Le porte
Ingressi alle pagine da scaricare, su schede: immagine (1:1 sul telefono accanto al testo, 4:3 sopra il testo da 48em) con angoli 16px, nome Montserrat 600 bianco --t-corpo, una riga grigia. Al passaggio la scheda prende superficie 2.

### Il riquadro viola in corsivo
Il box dei caroselli, riservato al canale Telegram: viola pieno, angoli 20px, spazio interno clamp(1.5rem, 5vw, 3rem), titolo Cinzel bianco --t-titolo, testo Montserrat corsivo 500 --t-sotto, un bottone lime pieno. Dentro le tavole lo stesso box vive in piccolo (angoli 14px, corsivo 500), accanto alla domanda su lime con testo nero.

### Apribile
Ringraziamenti e Manifesto chiusi su una scheda: titolo a sinistra (Ringraziamenti in Montserrat 600 bianco, Manifesto in Cinzel lime), a destra «Tocca per aprirli» in grigio --t-piccolo e il più lime in un tondo di superficie 2, che ruota di 45° all'apertura; sul telefono la scritta resta solo per i lettori di schermo. Il contenuto si apre misurato da app.js.

### Il sigillo
Il logo di TAUH dentro due cerchi lime con l'anello «NON SERVIAM · LUX IN TENEBRIS · LUCIFER» in Cinzel 700. Chiude la via nel piede (clamp(9.5rem, 34vw, 12.5rem)); sul computer apre anche l'apertura. L'anello ruota solo mentre si scorre la pagina.
- **Moneta:** il sigillo ha uno spessore (il 6% del lato: dieci dischi viola, più scuri a metà, con un filo lime vicino alle facce) e due facce uguali, piene di nero. Si prende col dito o col mouse e gira attorno all'asse verticale (trascinare per tutta la sua larghezza = mezzo giro); lanciato, gira per inerzia e si ferma su una faccia oscillando; un tocco gli fa fare un giro intero. Quello del piede, la prima volta che compare, si volta verso chi è arrivato in fondo alla via.

### La giostra delle pillole
Nella home le otto pillole più recenti stanno sulle facce di un tamburo visto da fuori, una copertina per faccia (le schede di sempre, larghe clamp(12.5rem, 56vw, 19rem), alte tutte uguali con il titolo su due righe). Davanti c'è la più recente; le facce di lato si voltano, scuriscono con il coseno dell'angolo (nero fino al 90%) e sfumano nel buio ai bordi; a sinistra il buio comincia prima della via, così linea e nodo non passano mai sopra una copertina. Si gira trascinando di lato (in verticale scorre la pagina), lanciando, con le frecce e con ← →; col Tab la pillola che prende il fuoco viene davanti. La copertina davanti si apre; toccandone una di lato la giostra la porta davanti. Quando la sezione compare il tamburo fa un passo e presenta la più recente. Senza JS, con «riduci movimento» o con meno di cinque pillole resta il binario piatto che scorre di lato.

### Schede in rilievo
Solo dove c'è un mouse: porte, magliette, anteprima del gioco, schede dell'archivio e artwork si inclinano sotto il puntatore (il punto sotto il puntatore va giù, fino a 6°; 3° per l'anteprima del gioco, che è larga quanto la colonna) e un riflesso bianco al 7%, una banda lineare, le attraversa seguendolo. Uscendo tornano piatte e nitide. Sul telefono no: lì le schede si toccano per aprirle e la pagina scorre sotto il dito.

### Il lettore fisso
In basso a destra, sopra ogni pagina. Da fermo è una pillola viola notte al 94% con sfocatura, tondo viola 46px con il triangolo lime e «Ascolta TAUH» (sul telefono solo il tondo). Finché l'uscita dell'apertura è sullo schermo, il lettore fermo si fa da parte (dissolvenza di 0.25s), così il pre-save resta l'unico bottone pieno. In ascolto diventa una barra di 26rem con angoli 20px: copertina 44px, titolo Cinzel lime, tempo, via di avanzamento con un nodo da 14px, tondo lime per la pausa, prossimo e chiudi. Si apre crescendo dal suo tondo verso sinistra (il bordo destro resta fermo) e ci torna chiudendosi; il contenuto compare in dissolvenza a barra quasi aperta. La musica continua cambiando pagina, e una barra aperta in pausa si ritrova uguale nella pagina dopo.

### Il visore delle pillole
Le tavole 4:5 in una pista a scatto con angoli 12px su viola notte; sotto: freccia, via con nodo, contatore a pillola (viola al 25%, cifre lime tabellari), freccia; poi tre bottoni a filo da 44px (Schermo intero, Condividi, Su Instagram). Sul computer resta fisso accanto al testo.

### Indice e righe della Biblioteca
L'indice è una fila di pillole piene (superficie 2 con il filo bianco, 44px, --t-piccolo bianco) con il numero delle letture in grigio. Ogni scaffale ha il suo titolo e la sua scheda; ogni libro è una riga separata dalla successiva da un filo bianco al 7%: titolo Montserrat 600 --t-sotto bianco, autore lime --t-piccolo, edizione grigia --t-meta, descrizione, poi i bottoni stretti.

### Navigazione
Testata: logo a sinistra; da 70em le voci (Montserrat 600 --t-piccolo, bianco all'80%) stanno in una barra a segmenti: una pillola di viola notte al 78% con il filo bianco e 4px di margine, ogni voce è un segmento a pillola che al passaggio prende superficie 2; la pagina attuale è un segmento di superficie 3 con il testo lime. Sotto i 69.9375em un bottone «Menu» pieno (superficie 2) apre una scheda a tendina larga al massimo 21rem, allineata a destra, con le voci a righe arrotondate (14px) e la pagina attuale su superficie 3.

### Movimento
- **Due curve sole.** La molla (`--molla` con `--molla-durata`: smorzamento 1, risposta 0,35 s, il 97% del percorso in 0,3 s) per ciò che si sposta o cambia forma: il menu che si apre, il lettore che si allarga, il nodo del visore, l'immagine in grande sotto il dito (lì è una molla vera, in app.js). La frenata (`--frenata`, cubic-bezier(0.23, 1, 0.32, 1)) per ciò che entra, esce o risponde a un tocco, sempre sotto i 0,3 s. `ease` solo per colori e opacità, `linear` solo per ciò che segue lo scorrimento.
- **Risposta al tocco.** Quando il dito appoggia: scale 0.96 per i comandi e 0.97 per le immagini, giù in 100 ms e su in 160 ms. Il passaggio del mouse cambia colori e contorni, e vale solo dove c'è un mouse (`@media (hover: hover)`).
- **Chi apre ha il tempo, chi chiude fa presto.** Il menu nasce dal bottone con la molla e si chiude in 0,16 s; le righe in più dei brani arrivano a scalare (0, 40, 70, 90 ms e poi insieme) e spariscono subito.
- **La tastiera non aspetta.** Con le frecce le tavole e gli artwork cambiano di colpo, con Invio i riquadri si aprono subito: lo scorrimento resta al dito e ai bottoni sullo schermo.
- **Solo transform e opacity.** Due eccezioni volute: l'altezza dei riquadri apribili (Ringraziamenti, Manifesto: da 0,2 a 0,32 s secondo la strada, misurata e animata da app.js in tutti i browser) e bordo sinistro e larghezza del lettore (è fuori dal flusso e ha sei figli).
- La via e il nodo seguono lo scorrimento (sticky più una trasformazione sul tratto percorso, `.via-fatta`), non un'animazione a tempo. Scorrendo non si misura niente e non si cambia nessuna variabile sul contenitore: le posizioni delle tappe si leggono solo quando la pagina cambia altezza.
- Tutto ciò che si muove si può riprendere a metà: riparte da dove si trova (immagine in grande, menu, lettore, riquadri).
- L'anello del sigillo ruota legato allo scorrimento (animation-timeline: scroll), solo senza «riduci movimento».
- **Profondità vera, in tre punti soli:** la giostra delle pillole, il sigillo-moneta e il rilievo delle schede col mouse. Usano le molle di app.js (giostra: smorzamento 0.8, risposta 0,55 s, 0,9 s all'entrata; moneta: 0.6 e 0,8 s, 1,3 s quando si volta nel piede), si prendono anche mentre girano e si fermano sempre su una faccia. Muovono solo transform (il tamburo con una trasformazione sola) e l'opacità del buio sulle facce; con «riduci movimento» non si accendono.
- La clip del gioco è muta, gira solo quando è sullo schermo e ha un tondo in basso a sinistra per fermarla; con «riduci movimento» resta sul primo fotogramma.
- Navigazione morbida (view transition 0.2s) e scorrimento dolce solo senza «riduci movimento»; tra una pagina e l'altra una linea lime corre in cima solo se l'attesa supera 0,3 s (ferma e piena con «riduci movimento»).
- Con «riduci movimento» restano i cambi di colore e le dissolvenze brevi; con «riduci trasparenza» e «aumenta contrasto» testata e lettore diventano pieni.

## Do's and Don'ts

### Do:
- **Do** tieni il fondo nero #000 e usa solo i colori del frontmatter; lime per ciò che chiama, viola per ciò che segna, grigio per ciò che accompagna.
- **Do** metti un solo bottone lime pieno per sezione; le altre azioni a filo o viola.
- **Do** scegli la grandezza del testo tra le sei variabili (--t-meta … --t-grande) in base al ruolo.
- **Do** usa la via (linea lime 2px, nodo viola e lime) per dire dove si è: tappe, tavole, avanzamento del brano.
- **Do** metti le raccolte (pillole, brani, porte, magliette, social, libri, sostegno, apribili) su schede di viola notte con il filo bianco; i testi delle tappe restano sul nero.
- **Do** usa i tre gradini di superficie per lo stato: a riposo superficie, al passaggio superficie 2, premuto o attuale superficie 3.
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
- **Don't** tornare alla pila di riquadri arrotondati tutti uguali (titolo lime, paragrafo grigio, bottone lime): le schede servono alle raccolte, non a ogni tappa.
- **Don't** disegnare i comandi con un contorno lime: il lime resta alla via, ai titoli, al bottone pieno, alle etichette e al fuoco.
