// La via delle ombre — interazioni del sito. Nessuna libreria esterna.
//
// Il lettore della musica e la navigazione restano attivi per tutta la visita:
// mentre la musica suona, i link interni cambiano solo il contenuto della pagina,
// così il brano non si interrompe. Le parti di ogni pagina (menu, caroselli,
// ricerca, gioco, artwork, elenco dei brani) si avviano in avviaPagina() e si
// spengono quando la pagina cambia.

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const riduci = window.matchMedia("(prefers-reduced-motion: reduce)");

const minuti = (secondi) => {
  const s = Number.isFinite(secondi) && secondi > 0 ? Math.floor(secondi) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Cambia l'indirizzo senza aggiungere voci alla cronologia e senza perdere lo stato della voce.
const sostituisciIndirizzo = (url) => {
  try {
    history.replaceState(history.state, "", url);
  } catch {
    /* alcune viste incorporate non permettono di cambiare l'indirizzo */
  }
};

// ---------------------------------------------------------------- movimento fisico
// Dai talk di Apple sulle interfacce fluide (WWDC 2018, «Designing Fluid Interfaces»):
// le cose che si toccano si muovono con una molla, che parte dal punto in cui si trovano
// adesso e dalla velocità del dito, quindi si può riprendere e invertire in ogni momento.
// Smorzamento 1 = si ferma senza rimbalzo; risposta = quanto ci mette, in secondi.

// Tutte le molle in corsa avanzano nello stesso fotogramma; chi ne muove più d'una insieme
// (posizione, scala e velo dell'immagine in grande) chiede con aFineGiro un solo ridisegno,
// a giro finito, invece di ridisegnare a ogni molla.
const molleInCorsa = new Set();
const dopoIlGiro = new Set();
let giroMolle = 0;
let nelGiro = false;

function giraMolle(ora) {
  giroMolle = 0;
  nelGiro = true;
  for (const avanza of [...molleInCorsa]) avanza(ora);
  nelGiro = false;
  const daFare = [...dopoIlGiro];
  dopoIlGiro.clear();
  for (const f of daFare) f();
  if (molleInCorsa.size && !giroMolle) giroMolle = requestAnimationFrame(giraMolle);
}

// f una volta sola alla fine del fotogramma in corso; subito, se nessuna molla sta girando
const aFineGiro = (f) => {
  if (nelGiro) dopoIlGiro.add(f);
  else f();
};

function molla({ da, a, velocita = 0, smorzamento = 1, risposta = 0.35, passo, fine, soglia = 0.5 }) {
  const w = (2 * Math.PI) / risposta;
  const k = w * w;
  const c = 2 * smorzamento * w;
  let x = da;
  let v = velocita;
  let prima = performance.now();
  let corre = true;
  const smetti = () => {
    corre = false;
    molleInCorsa.delete(avanza);
  };
  function avanza(ora) {
    if (!corre) return; // fermata da un'altra molla in questo stesso giro
    const dt = Math.min(0.064, Math.max(0, (ora - prima) / 1000));
    prima = ora;
    // passi piccoli: stabile anche quando un fotogramma arriva in ritardo
    const n = Math.max(1, Math.ceil(dt / 0.004));
    const h = dt / n;
    for (let i = 0; i < n; i += 1) {
      v += (-k * (x - a) - c * v) * h;
      x += v * h;
    }
    if (Math.abs(x - a) < soglia && Math.abs(v) < soglia * 10) {
      x = a;
      v = 0;
      smetti();
      passo(x);
      fine?.();
      return;
    }
    passo(x);
  }
  molleInCorsa.add(avanza);
  if (!giroMolle) giroMolle = requestAnimationFrame(giraMolle);
  return {
    ferma: smetti,
    get valore() {
      return x;
    },
    get velocita() {
      return v;
    },
    get corre() {
      return corre;
    },
  };
}

// Dove andrebbe a fermarsi un lancio, come lo scorrimento di iOS (px/s → px).
const proietta = (velocita, rallentamento = 0.998) => ((velocita / 1000) * rallentamento) / (1 - rallentamento);

// Oltre il bordo si va avanti sempre meno, invece di fermarsi di colpo.
const elastico = (oltre, misura, costante = 0.55) => (oltre * misura * costante) / (misura + costante * Math.abs(oltre));

// Velocità del dito dagli ultimi movimenti (px/s), non solo dall'ultimo punto.
function tracciaVelocita() {
  let punti = [];
  return {
    azzera() {
      punti = [];
    },
    aggiungi(x, y) {
      const t = performance.now();
      punti.push({ x, y, t });
      while (punti.length > 2 && t - punti[0].t > 100) punti.shift();
    },
    velocita() {
      if (punti.length < 2) return { x: 0, y: 0 };
      const a = punti[0];
      const b = punti[punti.length - 1];
      // se il dito si è fermato prima di staccarsi, non c'è lancio
      if (performance.now() - b.t > 80) return { x: 0, y: 0 };
      const dt = Math.max(0.008, (b.t - a.t) / 1000);
      return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
    },
  };
}

// ---------------------------------------------------------------- brani col lucchetto
// Un brano con "bloccata_fino_al" in musica.json si ascolta solo dopo aver finito il
// primo livello del gioco: la pagina del gioco lo segna nel browser con questa chiave
// (lo script lo aggiunge build.mjs). Un brano con "in_arrivo" non si ascolta e basta.
// In tutti e due i casi, dal giorno indicato il brano è libero per tutti.

const CHIAVE_GIOCO = "tauh-incubo-livello-1";

const giornoArrivato = (iso) => {
  if (iso === "sempre") return false; // lucchetto senza scadenza
  const [anno, mese, giorno] = String(iso || "").split("-").map(Number);
  if (!anno || !mese || !giorno) return true;
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  return new Date(anno, mese - 1, giorno) <= oggi;
};

const giocoFinito = () => {
  try {
    return Boolean(localStorage.getItem(CHIAVE_GIOCO));
  } catch {
    return false;
  }
};

// I brani col lucchetto del gioco si sbloccano anche con il codice che TAUH manda a chi dona
// (riquadro Sostienimi). Ogni brano ha i suoi codici e il browser ricorda lo sblocco brano per
// brano, con «tauh-sblocco:<nome del file>». Quelli «in arrivo» no.
const chiaveDonazione = (codice) => `tauh-sblocco:${codice}`;

// Il primo giorno la chiave era una sola, e i codici valevano solo per «Incubo».
try {
  if (localStorage.getItem("tauh-sblocco-donazione")) {
    localStorage.setItem(chiaveDonazione("incubo"), "1");
    localStorage.removeItem("tauh-sblocco-donazione");
  }
} catch {
  /* il browser non permette di ricordarlo */
}

const donazioneFatta = (codice) => {
  if (!codice) return false;
  try {
    return Boolean(localStorage.getItem(chiaveDonazione(codice)));
  } catch {
    return false;
  }
};

const libero = (bloccata, colGioco = false, codice = "") =>
  !bloccata || giornoArrivato(bloccata) || (colGioco && giocoFinito()) || donazioneFatta(codice);

// ================================================================ lettore della musica

const lettore = (() => {
  const barra = $("[data-lettore]");
  const dati = $("#brani-dati");
  if (!barra || !dati) return null;
  let brani;
  try {
    brani = JSON.parse(dati.textContent).map((b) => ({
      ...b,
      file: new URL(b.file, location.href).href,
      copertina: b.copertina ? new URL(b.copertina, location.href).href : "",
      mini: b.mini ? new URL(b.mini, location.href).href : "",
    }));
  } catch {
    return null;
  }
  if (!brani.length) return null;

  const bottone = $("[data-lettore-suona]", barra);
  const avanti = $("[data-lettore-prossimo]", barra);
  const titolo = $("[data-lettore-titolo]", barra);
  const tempo = $("[data-lettore-tempo]", barra);
  const via = $("[data-lettore-via]", barra);
  const copertina = $("[data-lettore-copertina]", barra);
  const sessione = "mediaSession" in navigator ? navigator.mediaSession : null;
  const CHIAVE = "tauh-lettore";
  const audio = new Audio();
  audio.preload = "none";

  let indice = 0;
  let attivo = false; // la barra è aperta: un brano è stato scelto
  let riprendiDa = 0; // posizione da recuperare quando il brano si carica
  let errori = 0;
  let trascinando = false;
  let ultimoSalvataggio = 0;
  let pronto = false; // dopo il primo disegno: al caricamento la barra compare già com'era, senza muoversi
  let movimento = null; // l'animazione della barra che si apre o si chiude
  const ripieghi = new Map();
  const ascoltatori = new Set();

  const chiuso = (i) => !libero(brani[i]?.bloccata, brani[i]?.gioco, brani[i]?.codice);

  // Shuffle: i brani suonano in un ordine casuale, nuovo a ogni visita. La scheda lo ricorda
  // (sessionStorage) mentre si gira per il sito; finito il giro se ne mescola un altro.
  const n = brani.length;
  const mescola = (evita = -1) => {
    const o = brani.map((_, k) => k);
    for (let k = n - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [o[k], o[j]] = [o[j], o[k]];
    }
    // tra un giro e l'altro non ripete subito l'ultimo brano
    if (n > 1 && o[0] === evita) [o[0], o[1]] = [o[1], o[0]];
    return o;
  };
  const ordineValido = (o) =>
    Array.isArray(o) && o.length === n && new Set(o).size === n && o.every((k) => Number.isInteger(k) && k >= 0 && k < n);
  let ordine = mescola();

  // il brano ascoltabile che viene dopo «da» nell'ordine casuale; finito il giro rimescola. -1 se sono tutti chiusi
  const seguente = (da) => {
    let p = ordine.indexOf(da);
    for (let k = 0; k < 2 * n; k++) {
      if (p + 1 >= n) {
        ordine = mescola(da);
        p = -1;
      }
      p += 1;
      if (!chiuso(ordine[p])) return ordine[p];
    }
    return -1;
  };
  // quello che viene prima, nello stesso giro
  const precedenteIn = (da) => {
    const p = ordine.indexOf(da);
    for (let k = 1; k <= n; k++) {
      const i = ordine[(((p - k) % n) + n) % n];
      if (!chiuso(i)) return i;
    }
    return -1;
  };

  const caricato = () => audio.readyState > 0;
  const durata = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : brani[indice].durata || 0);
  const posizione = () => (caricato() ? audio.currentTime : riprendiDa);
  const stato = () => ({ indice, suona: !audio.paused, attivo });

  // Ricorda brano e posizione per la scheda aperta, così un ricaricamento riparte da lì.
  function salva(subito = true) {
    const ora = Date.now();
    if (!subito && ora - ultimoSalvataggio < 2000) return;
    ultimoSalvataggio = ora;
    try {
      sessionStorage.setItem(CHIAVE, JSON.stringify({ i: indice, t: Math.round(posizione() * 10) / 10, a: attivo, o: ordine }));
    } catch {
      /* il browser non permette di ricordarlo */
    }
  }

  function disegnaVia(secondi) {
    const d = durata();
    const p = Math.max(0, d ? Math.min(secondi, d) : secondi);
    const percento = d ? (p / d) * 100 : 0;
    via.style.setProperty("--avanzamento", `${percento.toFixed(2)}%`);
    via.setAttribute("aria-valuenow", String(Math.round(percento)));
    via.setAttribute("aria-valuetext", `${minuti(p)} di ${minuti(d)}`);
    tempo.textContent = minuti(p);
  }

  function aggiorna() {
    const b = brani[indice];
    const suona = !audio.paused;
    // La barra si allarga dal suo tondo (e ci torna) con la molla del sito. Parte da dove si trova
    // adesso, anche a metà di un movimento, e il bordo destro resta fermo: sul telefono, dove da
    // aperta tocca i due bordi, prima saltava a sinistra e cresceva dalla parte sbagliata.
    const cambia = barra.classList.contains("attivo") !== attivo;
    const prima = cambia && pronto && !riduci.matches && barra.animate ? barra.getBoundingClientRect() : null;
    if (cambia) {
      movimento?.cancel();
      movimento = null;
      // la classe del movimento va messa prima di aprire: è lei che fa comparire in dissolvenza
      // copertina, titolo e comandi (stile.css), e deve già esserci quando nascono
      barra.classList.toggle("in-moto", Boolean(prima?.width));
    }
    barra.classList.toggle("attivo", attivo);
    if (prima?.width) {
      const dopo = barra.getBoundingClientRect();
      const curva = getComputedStyle(document.documentElement).getPropertyValue("--molla").trim() || "ease-out";
      const fotogrammi = { left: [`${prima.left}px`, `${dopo.left}px`], width: [`${prima.width}px`, `${dopo.width}px`] };
      let questo = null;
      try {
        questo = barra.animate(fotogrammi, { duration: 500, easing: curva });
      } catch {
        /* curva non capita dal browser: niente movimento */
      }
      if (questo) {
        movimento = questo;
        const finito = () => {
          if (movimento !== questo) return;
          movimento = null;
          barra.classList.remove("in-moto");
        };
        questo.addEventListener("finish", finito);
        questo.addEventListener("cancel", finito);
      }
    }
    if (cambia && !movimento) barra.classList.remove("in-moto");
    pronto = true;
    barra.classList.toggle("in-ascolto", suona);
    document.documentElement.classList.toggle("musica-accesa", suona);
    titolo.textContent = b.titolo;
    // nella barra la copertina piccola; quella grande resta per la schermata di blocco
    const piccola = b.mini || b.copertina;
    if (copertina && piccola && copertina.src !== piccola) copertina.src = piccola;
    bottone.setAttribute("aria-label", `${suona ? "Metti in pausa" : "Ascolta"} ${b.titolo} di TAUH`);
    if (!trascinando) disegnaVia(posizione());
    if (sessione) sessione.playbackState = suona ? "playing" : "paused";
    const s = stato();
    for (const f of ascoltatori) f(s);
  }

  // Titolo e copertina nella schermata di blocco e nei comandi multimediali del telefono.
  function metadati() {
    if (!sessione || typeof MediaMetadata === "undefined") return;
    const b = brani[indice];
    const percorso = b.copertina ? new URL(b.copertina).pathname : "";
    const tipo = /\.png$/i.test(percorso) ? "image/png" : /\.jpe?g$/i.test(percorso) ? "image/jpeg" : "image/webp";
    try {
      sessione.metadata = new MediaMetadata({
        title: b.titolo,
        artist: "TAUH",
        album: "La via delle ombre",
        artwork: b.copertina ? [{ src: b.copertina, sizes: "512x512", type: tipo }] : [],
      });
    } catch {
      /* metadati non supportati */
    }
  }

  function posizioneSessione() {
    if (!sessione?.setPositionState || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    try {
      sessione.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate || 1, position: Math.min(audio.currentTime, audio.duration) });
    } catch {
      /* posizione non supportata */
    }
  }

  function carica(i, da = 0) {
    indice = ((i % brani.length) + brani.length) % brani.length;
    riprendiDa = da;
    audio.src = ripieghi.get(indice) || brani[indice].file;
    metadati();
  }

  function avvia(i = indice) {
    i = ((i % brani.length) + brani.length) % brani.length;
    if (chiuso(i)) i = seguente(i);
    if (i < 0) return;
    // Safari su iPhone (iOS 17 e dopo): è musica, deve continuare anche a schermo spento
    try {
      if (navigator.audioSession && navigator.audioSession.type !== "playback") navigator.audioSession.type = "playback";
    } catch {
      /* non supportato */
    }
    if (i !== indice || !audio.getAttribute("src")) carica(i);
    attivo = true;
    const promessa = audio.play();
    aggiorna();
    salva();
    promessa?.catch((errore) => {
      // AbortError: nel frattempo è stato scelto un altro brano.
      if (errore?.name !== "AbortError") aggiorna();
    });
  }

  const pausa = () => audio.pause();
  // si ferma e torna al bottone «Ascolta TAUH»
  function chiudi() {
    audio.pause();
    attivo = false;
    aggiorna();
    salva();
  }
  const prossimo = () => {
    const i = seguente(indice);
    if (i >= 0) avvia(i);
  };
  const precedente = () => {
    const i = precedenteIn(indice);
    if (i >= 0) avvia(i);
  };

  function vaiA(secondi) {
    const d = durata();
    const t = Math.max(0, d ? Math.min(secondi, d - 0.5) : secondi);
    if (caricato()) audio.currentTime = t;
    else riprendiDa = t;
    disegnaVia(t);
    posizioneSessione();
    salva();
  }

  function salta() {
    errori += 1;
    if (errori < brani.length) {
      prossimo();
    } else {
      errori = 0;
      audio.pause();
      aggiorna();
    }
  }

  audio.addEventListener("play", aggiorna);
  audio.addEventListener("playing", () => {
    errori = 0;
    aggiorna();
    posizioneSessione();
  });
  audio.addEventListener("pause", () => {
    aggiorna();
    salva();
  });
  audio.addEventListener("ended", prossimo);
  audio.addEventListener("loadedmetadata", () => {
    if (riprendiDa > 0 && riprendiDa < audio.duration - 1) audio.currentTime = riprendiDa;
    riprendiDa = 0;
    aggiorna();
    posizioneSessione();
  });
  audio.addEventListener("timeupdate", () => {
    if (!trascinando) disegnaVia(audio.currentTime);
    salva(false);
  });
  audio.addEventListener("seeked", posizioneSessione);
  audio.addEventListener("error", () => {
    if (!audio.getAttribute("src")) return;
    const i = indice;
    const codice = audio.error?.code;
    // Ultimo tentativo: scaricare il brano intero. Serve con i browser che non
    // riescono a leggere il file a pezzi dal server.
    if ((codice === 2 || codice === 4) && !ripieghi.has(i) && !audio.src.startsWith("blob:")) {
      fetch(brani[i].file)
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.blob();
        })
        .then((blob) => {
          ripieghi.set(i, URL.createObjectURL(blob));
          if (indice !== i) return;
          carica(i, riprendiDa);
          audio.play().catch(() => aggiorna());
        })
        .catch(salta);
      return;
    }
    salta();
  });

  bottone.addEventListener("click", () => (audio.paused ? avvia() : pausa()));
  avanti?.addEventListener("click", prossimo);
  // × : la musica si ferma e la barra torna al bottone «Ascolta TAUH»
  $("[data-lettore-chiudi]", barra)?.addEventListener("click", () => {
    chiudi();
    bottone.focus();
  });

  // la linea del brano: si tocca o si trascina per spostarsi, con la tastiera vanno le frecce
  const frazione = (e) => {
    const r = via.getBoundingClientRect();
    return r.width ? Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) : 0;
  };
  via.addEventListener("pointerdown", (e) => {
    // la barra si ingrossa sotto il dito, come nella Musica dell'iPhone
    via.classList.add("trascina");
    if (e.button !== 0) return;
    trascinando = true;
    via.setPointerCapture?.(e.pointerId);
    disegnaVia(frazione(e) * durata());
    e.preventDefault();
  });
  via.addEventListener("pointermove", (e) => {
    if (trascinando) disegnaVia(frazione(e) * durata());
  });
  via.addEventListener("pointerup", (e) => {
    via.classList.remove("trascina");
    if (!trascinando) return;
    trascinando = false;
    vaiA(frazione(e) * durata());
  });
  via.addEventListener("pointercancel", () => {
    via.classList.remove("trascina");
    trascinando = false;
    disegnaVia(posizione());
  });
  via.addEventListener("keydown", (e) => {
    const passo = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 30, PageDown: -30 }[e.key];
    if (passo) vaiA(posizione() + passo);
    else if (e.key === "Home") vaiA(0);
    else if (e.key === "End") vaiA(durata());
    else return;
    e.preventDefault();
  });

  if (sessione) {
    const azioni = {
      play: () => avvia(),
      pause: pausa,
      nexttrack: prossimo,
      previoustrack: () => (posizione() > 3 ? vaiA(0) : precedente()),
      seekto: (d) => vaiA(d.seekTime),
    };
    for (const [azione, f] of Object.entries(azioni)) {
      try {
        sessione.setActionHandler(azione, f);
      } catch {
        /* azione non supportata da questo browser */
      }
    }
  }

  // All'avvio: se la scheda ha già un ordine e un brano (stessa visita) riparte da lì,
  // altrimenti il primo brano è il primo ascoltabile del nuovo ordine casuale.
  let daRiprendere = false;
  try {
    const s = JSON.parse(sessionStorage.getItem(CHIAVE) || "null");
    if (ordineValido(s?.o)) ordine = s.o;
    if (Number.isInteger(s?.i) && brani[s.i] && !chiuso(s.i)) {
      daRiprendere = true;
      if (s.a) {
        attivo = true;
        carica(s.i, Math.max(0, Number(s.t) || 0));
      } else {
        indice = s.i;
      }
    }
  } catch {
    /* niente da recuperare */
  }
  if (!daRiprendere) indice = ordine.find((i) => !chiuso(i)) ?? 0;
  window.addEventListener("pagehide", () => salva());
  window.addEventListener("pageshow", aggiorna);
  aggiorna();

  return {
    avvia,
    pausa,
    chiudi,
    stato,
    inAscolto: () => !audio.paused,
    ascolta(f, signal) {
      ascoltatori.add(f);
      signal?.addEventListener("abort", () => ascoltatori.delete(f), { once: true });
      f(stato());
    },
    // Vero se la pagina nuova ha gli stessi brani di quella aperta.
    stessiBrani(doc, base) {
      try {
        const altri = JSON.parse($("#brani-dati", doc)?.textContent || "[]");
        return altri.length === brani.length && altri.every((b, k) => new URL(b.file, base).href === brani[k].file);
      } catch {
        return false;
      }
    },
  };
})();

// ================================================================ parti delle pagine

// ---------------------------------------------------------------- menu su telefono

function menu(signal) {
  const testata = $("[data-testata]");
  const bottone = testata && $("[data-menu]", testata);
  const nav = testata && $(".testata-nav", testata);
  if (!bottone || !nav) return;
  const etichetta = $(".testata-menu-testo", bottone);
  const apri = (si) => {
    testata.classList.toggle("aperta", si);
    document.documentElement.classList.toggle("menu-aperto", si);
    bottone.setAttribute("aria-expanded", String(si));
    if (etichetta) etichetta.textContent = si ? "Chiudi" : "Menu";
  };
  const aperto = () => testata.classList.contains("aperta");
  bottone.addEventListener("click", () => apri(!aperto()), { signal });
  nav.addEventListener("click", (e) => e.target.closest("a") && apri(false), { signal });
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape" || !aperto()) return;
      apri(false);
      bottone.focus();
    },
    { signal },
  );
  // un tocco fuori dal menu, o sul velo scuro sotto di lui (è parte della testata), lo chiude
  document.addEventListener("click", (e) => aperto() && (!testata.contains(e.target) || e.target === testata) && apri(false), { signal });
  // lo stesso punto del CSS (@media max-width: 69.9375em)
  window.matchMedia("(min-width: 70em)").addEventListener("change", (e) => e.matches && apri(false), { signal });
  signal.addEventListener("abort", () => document.documentElement.classList.remove("menu-aperto"), { once: true });
}

// ---------------------------------------------------------------- player esterni
// Spotify e YouTube si caricano solo quando la persona preme il bottone.

// Un player alla volta: aprendo Spotify (o YouTube) il lettore del sito si ferma e si
// chiude; se poi riparte la musica del sito, il player esterno torna al suo bottone.
// collegaIncorporato serve anche ai player che compaiono dopo, come il video sbloccato con un codice.
let collegaIncorporato = () => {};

function incorporati(signal) {
  const aperti = new Map();
  collegaIncorporato = (box) => {
    const bottone = $("button", box);
    if (!bottone) return;
    const originale = [...box.childNodes];
    bottone.addEventListener(
      "click",
      () => {
        lettore?.chiudi();
        aperti.set(box, originale);
        const frame = document.createElement("iframe");
        frame.src = box.dataset.incorpora;
        frame.title = box.dataset.titolo || "Player";
        frame.height = box.dataset.altezza || "352";
        frame.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        box.replaceChildren(frame);
        box.classList.add("caricato");
        // il bottone premuto non c'è più: il focus passa al player invece di finire sulla pagina
        frame.focus();
      },
      { signal },
    );
  };
  for (const box of $$("[data-incorpora]")) collegaIncorporato(box);
  lettore?.ascolta(({ suona }) => {
    if (!suona || !aperti.size) return;
    for (const [box, originale] of aperti) {
      box.replaceChildren(...originale);
      box.classList.remove("caricato");
    }
    aperti.clear();
  }, signal);
}

// ---------------------------------------------------------------- binario delle copertine

function binari(signal) {
  for (const sezione of $$("[data-binario]")) {
    const fila = $(".binario", sezione);
    const indietro = $("[data-binario-indietro]", sezione);
    const avanti = $("[data-binario-avanti]", sezione);
    if (!fila || !indietro || !avanti) continue;
    // nella home le copertine salgono sulla giostra, se il browser la sa disegnare e non si è chiesto meno movimento
    if (sezione.hasAttribute("data-giostra") && giostra(fila, indietro, avanti, signal)) continue;
    const passo = () => Math.max(fila.clientWidth * 0.8, 200);
    const aggiorna = () => {
      indietro.disabled = fila.scrollLeft < 4;
      avanti.disabled = fila.scrollLeft + fila.clientWidth > fila.scrollWidth - 4;
    };
    // (lo scorrimento chiesto da qui non segue da solo l'impostazione «riduci movimento»)
    const scorri = (di) => fila.scrollBy({ left: di, behavior: riduci.matches ? "auto" : "smooth" });
    indietro.addEventListener("click", () => scorri(-passo()), { signal });
    avanti.addEventListener("click", () => scorri(passo()), { signal });
    fila.addEventListener("scroll", aggiorna, { passive: true, signal });
    window.addEventListener("resize", aggiorna, { signal });
    aggiorna();
  }
}

// ---------------------------------------------------------------- in rilievo: cose che si toccano in 3D
// Trasformazioni 3D vere (prospettiva, facce che si girano): servono preserve-3d e le facce
// nascoste quando danno le spalle.
const supporta3d = () =>
  Boolean(window.CSS?.supports) &&
  CSS.supports("transform-style", "preserve-3d") &&
  (CSS.supports("backface-visibility", "hidden") || CSS.supports("-webkit-backface-visibility", "hidden"));

// ---------------------------------------------------------------- la giostra delle pillole
// Nella home le copertine delle pillole stanno sulle facce di un tamburo, come una giostra vista
// da fuori: si trascina col dito o col mouse, si lancia (gira per inerzia e si ferma su una
// faccia, con un piccolo rimbalzo), si gira con le frecce e con ← →. La copertina davanti si
// apre; toccandone una di lato, la giostra la porta davanti. Le facce che si voltano passano nel
// buio. Gira solo il tamburo, con una trasformazione sola: le facce stanno ferme su di lui.
// Quando la sezione compare il tamburo fa un passo e porta davanti la pillola più recente.
// Senza JS, con «riduci movimento» o con meno di 5 pillole resta il binario piatto.

function giostra(fila, indietro, avanti, signal) {
  const facce = [...fila.children];
  const n = facce.length;
  if (n < 5 || riduci.matches || !supporta3d()) return false;
  const spicchio = 360 / n; // gradi tra una faccia e la successiva
  const STACCO = 14; // px tra due facce vicine, sul tamburo

  const palco = document.createElement("div");
  palco.className = "giostra";
  fila.before(palco);
  palco.append(fila);
  const ombre = facce.map((faccia) => {
    const ombra = document.createElement("span");
    ombra.className = "faccia-ombra";
    ombra.setAttribute("aria-hidden", "true");
    faccia.append(ombra);
    return ombra;
  });
  // le copertine che aspettano di essere scaricate (loading="lazy"), faccia per faccia
  const daScaricare = facce.map((faccia) => faccia.querySelector('img[loading="lazy"]'));
  indietro.setAttribute("aria-label", "Pillola precedente");
  avanti.setAttribute("aria-label", "Pillola successiva");

  let larga = 0;
  let raggio = 0;
  let angolo = spicchio; // parte girato di una faccia (vedi sopra)
  let meta = 0;
  let moto = null;

  // la faccia che sta davanti con un certo angolo del tamburo
  const davanti = (a = angolo) => ((Math.round(-a / spicchio) % n) + n) % n;
  const pxPerGrado = () => (larga + STACCO) / spicchio;

  function disegna() {
    fila.style.transform = `translateZ(${(-raggio).toFixed(1)}px) rotateY(${angolo.toFixed(3)}deg)`;
    facce.forEach((faccia, i) => {
      // dove guarda la faccia, da -180 a 180 gradi (0 = verso chi guarda)
      const a = ((((i * spicchio + angolo) % 360) + 540) % 360) - 180;
      const luce = Math.cos((a * Math.PI) / 180);
      ombre[i].style.opacity = luce > 0 ? ((1 - luce) * 0.9).toFixed(3) : "0.9";
      // la copertina si scarica poco prima di arrivare davanti
      if (daScaricare[i] && Math.abs(a) < spicchio * 2.5) {
        daScaricare[i].loading = "eager";
        daScaricare[i] = null;
      }
    });
  }

  // il tamburo è un poligono con n lati larghi quanto una scheda (dal CSS, --faccia)
  function misura() {
    fila.style.transform = "none";
    for (const f of facce) {
      f.style.transform = "none";
      f.style.height = "";
    }
    larga = fila.offsetWidth;
    const alta = Math.max(...facce.map((f) => f.offsetHeight));
    raggio = (larga + STACCO) / 2 / Math.tan(Math.PI / n);
    fila.style.height = `${alta}px`;
    palco.style.setProperty("--prospettiva", `${Math.round(raggio * 3.2 + larga)}px`);
    facce.forEach((f, i) => {
      f.style.height = `${alta}px`;
      f.style.transform = `rotateY(${(i * spicchio).toFixed(3)}deg) translateZ(${raggio.toFixed(1)}px)`;
    });
    disegna();
  }

  function gira(verso, velocita = 0, risposta = 0.55) {
    meta = verso;
    moto?.ferma();
    moto = molla({
      da: angolo,
      a: meta,
      velocita,
      smorzamento: 0.8,
      risposta,
      soglia: 0.02,
      passo: (x) => {
        angolo = x;
        disegna();
      },
      fine: () => (moto = null),
    });
  }
  // la faccia i davanti, dalla parte più corta
  const portaDavanti = (i) => {
    const base = -i * spicchio;
    gira(base + Math.round((angolo - base) / 360) * 360);
  };
  // passi > 0: avanti (la pillola a destra viene davanti); si parte da dove la giostra sta
  // andando, così due tocchi veloci sulla freccia fanno due passi
  const scatta = (passi) => gira((moto ? meta : Math.round(angolo / spicchio) * spicchio) - passi * spicchio);

  // ---------------- il dito e il mouse
  const traccia = tracciaVelocita();
  let presa = null;
  let trascinata = false; // l'ultimo tocco è diventato un trascinamento: il clic che segue non apre
  let davantiAllaPresa = -1;
  const prendi = (e) => {
    try {
      palco.setPointerCapture(e.pointerId);
    } catch {
      /* senza la presa del puntatore si trascina lo stesso, finché si resta sulla giostra */
    }
    palco.classList.add("presa");
  };
  palco.addEventListener(
    "pointerdown",
    (e) => {
      if (presa || (e.pointerType === "mouse" && e.button !== 0)) return;
      // si prende la giostra dov'è, anche mentre gira: il tocco la ferma e non apre la pillola
      const girava = Boolean(moto);
      moto?.ferma();
      moto = null;
      trascinata = girava;
      davantiAllaPresa = davanti();
      traccia.azzera();
      traccia.aggiungi(e.clientX, e.clientY);
      presa = { id: e.pointerId, x0: e.clientX, y0: e.clientY, da: angolo, asse: girava ? "x" : null };
      if (girava) prendi(e);
    },
    { signal },
  );
  palco.addEventListener(
    "pointermove",
    (e) => {
      if (!presa || e.pointerId !== presa.id) return;
      traccia.aggiungi(e.clientX, e.clientY);
      const dx = e.clientX - presa.x0;
      const dy = e.clientY - presa.y0;
      // 8 px prima di decidere: in verticale scorre la pagina, di lato gira la giostra
      if (!presa.asse) {
        if (Math.hypot(dx, dy) < 8) return;
        if (Math.abs(dx) < Math.abs(dy)) {
          presa = null;
          return;
        }
        presa.asse = "x";
        trascinata = true;
        prendi(e);
      }
      angolo = presa.da + dx / pxPerGrado();
      disegna();
    },
    { signal },
  );
  const lascia = (e) => {
    if (!presa || e.pointerId !== presa.id) return;
    const { asse } = presa;
    presa = null;
    palco.classList.remove("presa");
    if (asse !== "x") return;
    const v = traccia.velocita().x / pxPerGrado(); // gradi al secondo
    // dove andrebbe a finire il lancio (al massimo un giro e mezzo), poi la faccia più vicina
    const lancio = Math.max(-540, Math.min(540, proietta(v)));
    gira(Math.round((angolo + lancio) / spicchio) * spicchio, v);
  };
  palco.addEventListener("pointerup", lascia, { signal });
  palco.addEventListener("pointercancel", lascia, { signal });
  // col mouse, senza questo il browser trascinerebbe via il link o l'immagine
  palco.addEventListener("dragstart", (e) => e.preventDefault(), { signal });
  palco.addEventListener(
    "click",
    (e) => {
      if (trascinata) {
        trascinata = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const faccia = e.target.closest?.(".binario > li");
      // da tastiera (Invio) il link si apre sempre: la faccia col fuoco è già davanti
      if (!faccia || e.detail === 0) return;
      const i = facce.indexOf(faccia);
      if (i !== davantiAllaPresa) {
        e.preventDefault();
        e.stopPropagation();
        portaDavanti(i);
      }
    },
    { signal, capture: true },
  );

  // ---------------- frecce e tastiera
  indietro.addEventListener("click", () => scatta(-1), { signal });
  avanti.addEventListener("click", () => scatta(1), { signal });
  palco.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const passi = e.key === "ArrowRight" ? 1 : -1;
      const prossima = (davanti(moto ? meta : angolo) + passi + n) % n;
      scatta(passi);
      facce[prossima].querySelector("a")?.focus({ preventScroll: true });
    },
    { signal },
  );
  // col Tab il fuoco passa da una pillola all'altra: quella col fuoco viene davanti
  palco.addEventListener(
    "focusin",
    (e) => {
      const faccia = e.target.closest(".binario > li");
      if (!faccia || !e.target.matches(":focus-visible")) return;
      const i = facce.indexOf(faccia);
      if (i !== davanti(moto ? meta : angolo)) portaDavanti(i);
    },
    { signal },
  );

  window.addEventListener("resize", misura, { signal });
  document.fonts?.ready?.then(() => !signal.aborted && misura());
  if ("IntersectionObserver" in window) {
    const vista = new IntersectionObserver(
      (voci) => {
        if (!voci.some((v) => v.isIntersecting)) return;
        vista.disconnect();
        if (!presa && !moto) gira(0, 0, 0.9);
      },
      { threshold: 0.45 },
    );
    vista.observe(palco);
    signal.addEventListener("abort", () => vista.disconnect(), { once: true });
  } else {
    angolo = 0;
  }
  signal.addEventListener("abort", () => moto?.ferma(), { once: true });
  misura();
  return true;
}

// ---------------------------------------------------------------- il sigillo che si gira
// Il sigillo (nel piede di ogni pagina e, sul computer, nell'apertura) è una moneta con lo
// spessore: si prende col dito o col mouse e si fa girare, si lancia e si ferma su una delle due
// facce (sono uguali), oscillando un poco. Toccato, fa un giro intero. Quello del piede, la prima
// volta che compare, si volta verso chi è arrivato in fondo alla via.
// Davanti c'è il sigillo di sempre, dietro la sua copia; lo spessore sono dischi uno sopra
// l'altro, viola e più scuri a metà, con un filo lime dove cominciano le facce.
// Con «riduci movimento» il sigillo resta com'era.

const STRATI_MONETA = 10;

function monete(signal) {
  if (riduci.matches || !supporta3d()) return;
  for (const s of $$(".sigillo")) moneta(s, signal);
}

function moneta(sigillo, signal) {
  const anello = $(".sigillo-anello", sigillo);
  const logo = $(".sigillo-logo", sigillo);
  if (!anello || !logo || sigillo.classList.contains("moneta")) return;
  const corpo = document.createElement("div");
  corpo.className = "moneta-corpo";
  const fronte = document.createElement("div");
  fronte.className = "moneta-faccia";
  fronte.append(anello, logo);
  const retro = fronte.cloneNode(true);
  retro.classList.add("moneta-retro");
  retro.setAttribute("aria-hidden", "true");
  // la copia non ripete l'id del cerchio su cui corre la scritta
  for (const el of $$("[id]", retro)) {
    const nuovo = `${el.id}-retro`;
    for (const rif of $$(`[href="#${el.id}"]`, retro)) rif.setAttribute("href", `#${nuovo}`);
    el.id = nuovo;
  }
  const logoRetro = $("img", retro);
  if (logoRetro) logoRetro.alt = "";
  // facce piene: dietro ci sono i dischi dello spessore, che non devono trasparire
  for (const f of [fronte, retro]) $("circle", f)?.setAttribute("fill", "#000");
  const strati = [];
  for (let k = 0; k < STRATI_MONETA; k += 1) {
    const s = document.createElement("span");
    s.className = "moneta-strato";
    const scuro = 1 - 0.45 * Math.sin((Math.PI * k) / (STRATI_MONETA - 1));
    s.style.background = k === 0 || k === STRATI_MONETA - 1 ? "#CFFE7E" : `rgb(${Math.round(103 * scuro)}, ${Math.round(76 * scuro)}, ${Math.round(192 * scuro)})`;
    strati.push(s);
  }
  corpo.append(...strati, fronte, retro);
  sigillo.append(corpo);
  sigillo.classList.add("moneta");

  const misura = () => {
    const spessore = Math.max(5, sigillo.offsetWidth * 0.06);
    fronte.style.transform = `translateZ(${(spessore / 2).toFixed(2)}px)`;
    retro.style.transform = `rotateY(180deg) translateZ(${(spessore / 2).toFixed(2)}px)`;
    // i dischi stanno tra le due facce, mai alla stessa altezza di una faccia
    strati.forEach((s, k) => (s.style.transform = `translateZ(${(-spessore / 2 + (spessore * (k + 0.5)) / STRATI_MONETA).toFixed(2)}px)`));
  };

  let angolo = 0;
  let moto = null;
  const disegna = () => (corpo.style.transform = `rotateY(${angolo.toFixed(2)}deg)`);
  const gira = (meta, velocita = 0, smorzamento = 0.6, risposta = 0.8) => {
    moto?.ferma();
    moto = molla({
      da: angolo,
      a: meta,
      velocita,
      smorzamento,
      risposta,
      soglia: 0.05,
      passo: (x) => {
        angolo = x;
        disegna();
      },
      fine: () => {
        moto = null;
        angolo = ((angolo % 360) + 360) % 360;
        disegna();
      },
    });
  };
  const posa = () => gira(Math.round(angolo / 180) * 180);
  const larga = () => Math.max(60, sigillo.offsetWidth);

  const traccia = tracciaVelocita();
  let presa = null;
  sigillo.addEventListener(
    "pointerdown",
    (e) => {
      if (presa || (e.pointerType === "mouse" && e.button !== 0)) return;
      moto?.ferma();
      moto = null;
      traccia.azzera();
      traccia.aggiungi(e.clientX, e.clientY);
      presa = { id: e.pointerId, x0: e.clientX, y0: e.clientY, da: angolo, asse: null, quando: performance.now() };
    },
    { signal },
  );
  sigillo.addEventListener(
    "pointermove",
    (e) => {
      if (!presa || e.pointerId !== presa.id) return;
      traccia.aggiungi(e.clientX, e.clientY);
      const dx = e.clientX - presa.x0;
      const dy = e.clientY - presa.y0;
      if (!presa.asse) {
        if (Math.hypot(dx, dy) < 6) return;
        if (Math.abs(dx) < Math.abs(dy)) {
          // in verticale scorre la pagina: la moneta torna su una faccia
          presa = null;
          posa();
          return;
        }
        presa.asse = "x";
        try {
          sigillo.setPointerCapture(e.pointerId);
        } catch {
          /* si gira lo stesso, finché si resta sul sigillo */
        }
        sigillo.classList.add("presa");
      }
      // trascinare per tutta la larghezza del sigillo = mezzo giro
      angolo = presa.da + (dx * 180) / larga();
      disegna();
    },
    { signal },
  );
  const lascia = (e) => {
    if (!presa || e.pointerId !== presa.id) return;
    const { asse, quando } = presa;
    presa = null;
    sigillo.classList.remove("presa");
    if (asse === "x") {
      const v = (traccia.velocita().x * 180) / larga();
      const lancio = Math.max(-1080, Math.min(1080, proietta(v)));
      gira(Math.round((angolo + lancio) / 180) * 180, v);
    } else if (e.type === "pointerup" && performance.now() - quando < 500) {
      gira(Math.round(angolo / 180) * 180 + 360, 0, 0.7); // un tocco: un giro intero
    } else {
      posa();
    }
  };
  sigillo.addEventListener("pointerup", lascia, { signal });
  sigillo.addEventListener("pointercancel", lascia, { signal });
  sigillo.addEventListener("dragstart", (e) => e.preventDefault(), { signal });

  if (sigillo.closest(".piede") && "IntersectionObserver" in window) {
    angolo = -150;
    const vista = new IntersectionObserver(
      (voci) => {
        if (!voci.some((v) => v.isIntersecting)) return;
        vista.disconnect();
        // si volta piano, in circa un secondo, e oscilla un poco prima di fermarsi
        if (!presa && !moto) gira(0, 0, 0.6, 1.3);
      },
      { threshold: 0.6 },
    );
    vista.observe(sigillo);
    signal.addEventListener("abort", () => vista.disconnect(), { once: true });
  }
  signal.addEventListener("abort", () => moto?.ferma(), { once: true });
  window.addEventListener("resize", misura, { signal });
  misura();
  disegna();
}

// ---------------------------------------------------------------- schede in rilievo
// Col mouse le schede con un'immagine (porte, magliette, anteprima del gioco, pillole
// dell'archivio, artwork) si inclinano un poco sotto il puntatore, come una tavola che si preme
// dove la si tocca, e un riflesso le attraversa seguendolo. Sul telefono no: lì le schede si
// toccano per aprirle e la pagina scorre sotto il dito. Ferme, tornano piatte e nitide.

const IN_RILIEVO = ".porta, .maglia, .gioco-schermo, .griglia .scheda, .opera";

function rilievo(signal) {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches || riduci.matches || !supporta3d()) return;
  for (const el of $$(IN_RILIEVO)) {
    // l'anteprima del gioco è larga quanto la colonna: si inclina molto meno
    const MASSIMO = el.matches(".gioco-schermo") ? 3 : 6;
    const riflesso = document.createElement("span");
    riflesso.className = "riflesso";
    riflesso.setAttribute("aria-hidden", "true");
    el.append(riflesso);
    let prospettiva = 900;
    let vx = 0; // rotateX e rotateY voluti…
    let vy = 0;
    let x = 0; // …e quelli di adesso, che li inseguono
    let y = 0;
    let giro = 0;
    const disegna = () => {
      giro = 0;
      x += (vx - x) * 0.18;
      y += (vy - y) * 0.18;
      const arrivato = Math.abs(vx - x) < 0.01 && Math.abs(vy - y) < 0.01;
      if (arrivato) {
        x = vx;
        y = vy;
      }
      if (arrivato && !x && !y) {
        el.style.transform = "";
        return;
      }
      el.style.transform = `perspective(${prospettiva}px) rotateX(${x.toFixed(2)}deg) rotateY(${y.toFixed(2)}deg)`;
      if (!arrivato) giro = requestAnimationFrame(disegna);
    };
    const chiedi = () => {
      if (!giro) giro = requestAnimationFrame(disegna);
    };
    el.addEventListener(
      "pointerenter",
      (e) => {
        if (e.pointerType === "mouse") prospettiva = Math.max(700, el.offsetWidth * 2.4);
      },
      { signal, passive: true },
    );
    el.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType !== "mouse") return;
        const r = el.getBoundingClientRect();
        const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
        // il punto sotto il puntatore va giù, il lato opposto si alza
        vx = -(py - 0.5) * 2 * MASSIMO;
        vy = (px - 0.5) * 2 * MASSIMO;
        el.style.setProperty("--luce", `${(px * 100).toFixed(1)}%`);
        el.classList.add("in-rilievo");
        chiedi();
      },
      { signal, passive: true },
    );
    el.addEventListener(
      "pointerleave",
      () => {
        vx = 0;
        vy = 0;
        el.classList.remove("in-rilievo");
        chiedi();
      },
      { signal, passive: true },
    );
    signal.addEventListener("abort", () => cancelAnimationFrame(giro), { once: true });
  }
}

// ---------------------------------------------------------------- visore dei caroselli

function visore(signal) {
  const visore = $("[data-visore]");
  if (!visore) return;
  const pista = $(".visore-pista", visore);
  const tavole = $$(".tavola", pista);
  const totale = tavole.length;
  const contatore = $("[data-contatore]", visore);
  const avanzamento = $("[data-avanzamento]", visore);
  const indietro = $("[data-indietro]", visore);
  const avanti = $("[data-avanti]", visore);
  const testi = $$("[data-testo-tavola]");
  const largo = window.matchMedia("(min-width: 1000px)");
  let attuale = -1;

  // quando la tavola cambia di colpo (tastiera, schermo ridimensionato) anche il nodo sulla linea
  // va al suo posto senza scivolare
  let nodoFermo = 0;
  const mostra = (i, liscio = true) => {
    if (i === attuale) return;
    const primaVolta = attuale === -1;
    attuale = i;
    contatore.textContent = `${i + 1}/${totale}`;
    if (!liscio) {
      avanzamento.classList.add("di-colpo");
      cancelAnimationFrame(nodoFermo);
      nodoFermo = requestAnimationFrame(() => (nodoFermo = requestAnimationFrame(() => avanzamento.classList.remove("di-colpo"))));
    }
    avanzamento.style.setProperty("--pos", totale > 1 ? `${(i / (totale - 1)) * 100}%` : "0%");
    indietro.disabled = i === 0;
    avanti.disabled = i === totale - 1;
    tavole.forEach((t, k) => t.setAttribute("aria-hidden", k === i ? "false" : "true"));
    testi.forEach((t, k) => t.classList.toggle("attuale", k === i));
    if (!primaVolta && largo.matches && testi[i] && !document.fullscreenElement) {
      testi[i].scrollIntoView({ block: "nearest", behavior: riduci.matches || !liscio ? "auto" : "smooth" });
    }
    sostituisciIndirizzo(i === 0 ? location.pathname + location.search : `#tavola-${i + 1}`);
  };

  // Mentre la pista scorre da sola verso una tavola (frecce, tasti, titoli), le posizioni
  // intermedie non contano: il contatore non annuncia 2, 1, 2… e una seconda freccia premuta
  // subito parte dalla tavola di arrivo, non da quella che sta passando.
  let destinazione = -1;
  let scadenza = 0;
  const arrivata = () => {
    destinazione = -1;
    clearTimeout(scadenza);
  };
  const tavolaInVista = () => Math.max(0, Math.min(totale - 1, Math.round(pista.scrollLeft / pista.clientWidth)));

  const vai = (i, liscio = true) => {
    const n = Math.max(0, Math.min(totale - 1, i));
    const anima = liscio && !riduci.matches;
    arrivata();
    if (anima) {
      destinazione = n;
      // se il browser non avvisa della fine dello scorrimento
      scadenza = setTimeout(arrivata, 1500);
    }
    pista.scrollTo({ left: tavole[n].offsetLeft, behavior: anima ? "smooth" : "auto" });
    mostra(n, anima);
  };

  let inAttesa = false;
  pista.addEventListener(
    "scroll",
    () => {
      if (inAttesa) return;
      inAttesa = true;
      requestAnimationFrame(() => {
        inAttesa = false;
        if (destinazione >= 0) {
          if (Math.abs(pista.scrollLeft - tavole[destinazione].offsetLeft) < 2) arrivata();
          return;
        }
        mostra(tavolaInVista());
      });
    },
    { passive: true, signal },
  );
  pista.addEventListener(
    "scrollend",
    () => {
      arrivata();
      mostra(tavolaInVista());
    },
    { signal },
  );

  indietro.addEventListener("click", () => vai(attuale - 1), { signal });
  avanti.addEventListener("click", () => vai(attuale + 1), { signal });

  // Con la tastiera la tavola cambia subito, senza scorrere: sono tasti che si premono in fila,
  // e ogni scorrimento sarebbe un'attesa. Col dito e con le frecce sullo schermo scorre.
  const tasti = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowRight") vai(attuale + 1, false);
    else if (e.key === "ArrowLeft") vai(attuale - 1, false);
    else if (e.key === "Home") vai(0, false);
    else if (e.key === "End") vai(totale - 1, false);
    else return;
    e.preventDefault();
  };
  pista.addEventListener("keydown", tasti, { signal });

  for (const b of $$("[data-vai]")) {
    b.addEventListener(
      "click",
      () => {
        vai(Number(b.dataset.vai) - 1);
        if (!largo.matches) visore.scrollIntoView({ behavior: riduci.matches ? "auto" : "smooth", block: "start" });
      },
      { signal },
    );
  }

  // Schermo intero, dove il browser lo permette.
  const schermo = $("[data-schermo-intero]", visore);
  if (schermo) {
    if (!visore.requestFullscreen) {
      schermo.hidden = true;
    } else {
      const etichetta = $("span", schermo);
      schermo.addEventListener(
        "click",
        () => {
          if (document.fullscreenElement) document.exitFullscreen();
          else visore.requestFullscreen().catch(() => {});
        },
        { signal },
      );
      document.addEventListener(
        "fullscreenchange",
        () => {
          const dentro = document.fullscreenElement === visore;
          etichetta.textContent = dentro ? "Esci dallo schermo intero" : "Schermo intero";
          if (dentro) document.addEventListener("keydown", tasti, { signal });
          else document.removeEventListener("keydown", tasti);
          requestAnimationFrame(() => vai(attuale, false));
        },
        { signal },
      );
    }
  }

  // Condividi: menu del telefono, oppure copia del link.
  const condividi = $("[data-condividi]", visore);
  if (condividi) {
    const etichetta = $("span", condividi);
    const testoBase = etichetta.textContent;
    condividi.addEventListener(
      "click",
      async () => {
        const dati = { title: document.title, url: location.href };
        if (navigator.share) {
          try {
            await navigator.share(dati);
          } catch {
            /* condivisione annullata */
          }
          return;
        }
        try {
          await navigator.clipboard.writeText(location.href);
          etichetta.textContent = "Link copiato";
        } catch {
          etichetta.textContent = "Copia il link dalla barra degli indirizzi";
        }
        setTimeout(() => (etichetta.textContent = testoBase), 2200);
      },
      { signal },
    );
  }

  window.addEventListener("resize", () => vai(attuale, false), { signal });
  signal.addEventListener("abort", () => cancelAnimationFrame(nodoFermo), { once: true });

  const iniziale = /^#tavola-(\d+)$/.exec(location.hash);
  if (iniziale) requestAnimationFrame(() => vai(Number(iniziale[1]) - 1, false));
  else mostra(0);
}

// ---------------------------------------------------------------- ricerca nell'archivio

function ricerca(signal) {
  const campo = $("[data-cerca]");
  if (!campo) return;
  const schede = $$("[data-testo]");
  const esito = $("[data-esito]");
  const vuoto = $("[data-vuoto]");
  const parolaVuota = $("[data-parola]", vuoto);
  const normale = (s) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[’']/g, " ")
      .trim();
  const testoEsito = esito.textContent;

  const filtra = () => {
    const parole = normale(campo.value).split(/\s+/).filter(Boolean);
    let visibili = 0;
    for (const s of schede) {
      const ok = parole.every((p) => s.dataset.testo.includes(p));
      s.hidden = !ok;
      if (ok) visibili += 1;
    }
    if (!parole.length) esito.textContent = testoEsito;
    else if (visibili === 1) esito.textContent = `1 pillola su ${schede.length}`;
    else esito.textContent = `${visibili} pillole su ${schede.length}`;
    vuoto.hidden = visibili > 0;
    parolaVuota.textContent = campo.value.trim();
    const url = new URL(location.href);
    if (campo.value.trim()) url.searchParams.set("cerca", campo.value.trim());
    else url.searchParams.delete("cerca");
    sostituisciIndirizzo(url);
  };

  campo.addEventListener("input", filtra, { signal });
  const iniziale = new URLSearchParams(location.search).get("cerca");
  if (iniziale) {
    campo.value = iniziale;
    filtra();
  }
}

// ---------------------------------------------------------------- gioco
// Su computer il gioco si apre dentro la pagina; su telefono e tablet il link
// porta al gioco a tutta pagina, dove funzionano i comandi touch.

function gioco(signal) {
  const avvia = $("[data-avvia]");
  if (!avvia) return;
  const schermo = avvia.closest("[data-schermo-gioco]");
  const intero = $("[data-gioco-intero]");
  const dentroPagina = window.matchMedia("(pointer: fine) and (min-width: 900px)");
  avvia.addEventListener(
    "click",
    (evento) => {
      if (!dentroPagina.matches || !schermo) return;
      evento.preventDefault();
      // il gioco ha la sua musica: quella del sito si ferma e la barra si nasconde
      lettore?.pausa();
      document.documentElement.classList.add("gioco-in-corso");
      const cornice = document.createElement("div");
      cornice.className = "cornice";
      const frame = document.createElement("iframe");
      frame.src = avvia.href;
      frame.title = avvia.dataset.titolo || "Gioco";
      frame.allow = "fullscreen; autoplay; gamepad";
      cornice.append(frame);
      schermo.replaceChildren(cornice);
      frame.addEventListener("load", () => frame.focus(), { once: true });
      if (intero && cornice.requestFullscreen) {
        intero.hidden = false;
        intero.addEventListener("click", () => {
          cornice.requestFullscreen().then(() => frame.focus()).catch(() => {});
        });
      }
    },
    { signal },
  );
  signal.addEventListener("abort", () => document.documentElement.classList.remove("gioco-in-corso"), { once: true });
}

// ---------------------------------------------------------------- artwork in grande
// Come le Foto dell'iPhone: l'immagine si apre crescendo dalla sua miniatura e ci torna
// quando si chiude; col dito si trascina 1:1 di lato (la successiva arriva attaccata) e
// verso il basso per chiudere; al rilascio conta la velocità del lancio, e una molla porta
// l'immagine dove stava andando. Ai bordi (prima e ultima) l'immagine resiste invece di
// fermarsi. Ogni movimento si può riprendere col dito a metà.

function galleria(signal) {
  const finestra = $("[data-lightbox]");
  const voci = $$("[data-opera]");
  if (!finestra || !voci.length || typeof finestra.showModal !== "function") return;
  const pista = $("[data-lightbox-pista]", finestra);
  const velo = $("[data-lightbox-velo]", finestra);
  const piede = $("[data-lightbox-piede]", finestra);
  const didascalia = $("[data-lightbox-titolo]", finestra);
  const scarica = $("[data-lightbox-scarica]", finestra);
  const indietro = $("[data-lightbox-indietro]", finestra);
  const avanti = $("[data-lightbox-avanti]", finestra);
  const chiudi = $("[data-lightbox-chiudi]", finestra);
  const unica = voci.length < 2;
  const SPAZIO = 24; // tra un'immagine e l'altra mentre scorrono
  const radice = document.documentElement;

  // tre lastre: precedente, attuale, successiva; cambiando immagine si spostano, non si ricaricano
  const prima = $("[data-lightbox-img]", finestra);
  const lastre = [prima.cloneNode(), prima, prima.cloneNode()];
  pista.prepend(lastre[0]);
  pista.append(lastre[2]);
  for (const l of lastre) l.removeAttribute("data-lightbox-img");

  let indice = 0;
  let aperta = false;
  let presa = null; // il dito che tiene l'immagine: { id, x0, y0, asse, partenzaX, partenzaY }
  // valori di presentazione: quello che si vede adesso (le molle partono sempre da qui)
  const vista = { x: 0, y: 0, s: 1, sx: 0, sy: 0, velo: 0 };
  const molle = {};
  const ferma = (...chiavi) => {
    for (const c of chiavi) {
      molle[c]?.ferma();
      molle[c] = null;
    }
  };
  let bersaglioX = 0;

  // quanto dista un'immagine dall'altra: si misura aprendo e quando cambia lo schermo, non a ogni
  // fotogramma (leggere una misura in mezzo ai ridisegni costringe il browser a rifare i conti)
  let passoLastre = 0;
  const misura = () => {
    passoLastre = pista.clientWidth + SPAZIO;
  };
  const larghezza = () => passoLastre;
  const esiste = (i) => i >= 0 && i < voci.length;
  const sorgente = (i) => (esiste(i) ? voci[i].dataset.grande : "");

  const disegna = () => {
    const L = larghezza();
    const [p, c, n] = lastre;
    // trascinando in basso l'immagine si rimpicciolisce e le altre spariscono
    c.style.transform = `translate3d(${vista.x + vista.sx}px, ${vista.y + vista.sy}px, 0) scale(${vista.s})`;
    p.style.transform = `translate3d(${vista.x - L}px, 0, 0)`;
    n.style.transform = `translate3d(${vista.x + L}px, 0, 0)`;
    const laterali = vista.y === 0 && vista.sy === 0 && vista.s === 1 ? 1 : 0;
    p.style.opacity = n.style.opacity = String(laterali);
    velo.style.opacity = String(vista.velo);
    piede.style.opacity = chiudi.style.opacity = String(Math.max(0, Math.min(1, (vista.velo - 0.5) * 2)));
  };

  const scrivi = () => {
    const v = voci[indice].dataset;
    lastre.forEach((l, k) => {
      l.alt = k === 1 ? v.titolo : "";
      l.setAttribute("aria-hidden", k === 1 ? "false" : "true");
    });
    didascalia.textContent = v.titolo;
    scarica.href = v.file;
    scarica.setAttribute("download", v.nome);
    indietro.disabled = !esiste(indice - 1);
    avanti.disabled = !esiste(indice + 1);
  };

  const carica = (lastra, i) => {
    const src = sorgente(i);
    if (src && lastra.getAttribute("src") !== src) lastra.src = src;
    else if (!src) lastra.removeAttribute("src");
  };

  // passa all'immagine accanto senza salti: la lastra che arriva prende il posto di quella al centro
  const cambia = (d) => {
    indice += d;
    if (d > 0) {
      lastre.push(lastre.shift());
      carica(lastre[2], indice + 1);
    } else {
      lastre.unshift(lastre.pop());
      carica(lastre[0], indice - 1);
    }
    vista.x += d * larghezza();
    bersaglioX += d * larghezza();
    scrivi();
  };

  const muoviX = (a, velocita = 0) => {
    const da = vista.x;
    ferma("x");
    bersaglioX = a;
    if (riduci.matches) {
      vista.x = a;
      disegna();
      arrivoX();
      return;
    }
    molle.x = molla({
      da,
      a,
      velocita,
      risposta: 0.38,
      passo: (x) => {
        vista.x = x;
        aFineGiro(disegna);
      },
      fine: arrivoX,
    });
  };
  // arrivata di lato: l'immagine accanto diventa quella al centro
  const arrivoX = () => {
    molle.x = null;
    const L = larghezza();
    if (Math.abs(bersaglioX) >= L / 2) {
      cambia(bersaglioX < 0 ? 1 : -1);
      vista.x = 0;
      bersaglioX = 0;
      disegna();
    }
  };

  const vai = (d) => {
    if (!aperta) return;
    const velocita = molle.x?.velocita || 0;
    // se sta già andando da quella parte, l'immagine di arrivo diventa subito l'attuale
    if (bersaglioX !== 0) {
      ferma("x");
      cambia(bersaglioX < 0 ? 1 : -1);
    }
    muoviX(esiste(indice + d) ? -d * larghezza() : 0, velocita);
  };

  // Con le frecce della tastiera il cambio è immediato, come nelle Foto del Mac: è un gesto che
  // si ripete in fretta, e un movimento lo farebbe solo aspettare. Lo scorrimento resta al dito
  // e ai bottoni.
  const salta = (d) => {
    if (!aperta) return;
    ferma("x");
    // se un'immagine stava già arrivando, prima diventa lei l'attuale
    if (bersaglioX !== 0) cambia(bersaglioX < 0 ? 1 : -1);
    if (esiste(indice + d)) cambia(d);
    vista.x = 0;
    bersaglioX = 0;
    disegna();
  };

  // ---------------- apertura e chiusura dalla miniatura
  const miniatura = (i) => $("img", voci[i]) || voci[i];
  // il rettangolo dell'immagine com'è disegnata nella pista (object-fit: contain)
  const rettangoloPieno = (riferimento) => {
    const box = pista.getBoundingClientRect();
    const w0 = riferimento.naturalWidth || box.width;
    const h0 = riferimento.naturalHeight || box.height;
    const s = Math.min(box.width / w0, box.height / h0);
    const w = w0 * s;
    const h = h0 * s;
    return { x: box.left + (box.width - w) / 2, y: box.top + (box.height - h) / 2, w, h };
  };
  // trasformazione che porta l'immagine piena sopra la miniatura
  const versoMiniatura = (i) => {
    const m = miniatura(i);
    const r = m.getBoundingClientRect();
    const dentro = r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    if (!dentro) return null;
    const p = rettangoloPieno(m);
    const s = r.width / p.w;
    return { sx: r.left + r.width / 2 - (p.x + p.w / 2), sy: r.top + r.height / 2 - (p.y + p.h / 2), s };
  };

  // muove posizione, scala e velo insieme, ognuno con la sua molla (X e Y separate)
  const vola = ({ sx, sy, s, velo: v }, velocita = {}, fine) => {
    ferma("sx", "sy", "s", "velo");
    if (riduci.matches) {
      Object.assign(vista, { sx: 0, sy: 0, s: 1, velo: v });
      lastre[1].style.opacity = v > 0 ? "1" : "0";
      disegna();
      setTimeout(() => fine?.(), 160);
      return;
    }
    let restano = 4;
    const finito = () => {
      restano -= 1;
      if (restano === 0) fine?.();
    };
    const parti = (chiave, a, vel = 0, extra = {}) => {
      molle[chiave] = molla({
        da: vista[chiave],
        a,
        velocita: vel,
        risposta: 0.42,
        soglia: chiave === "s" || chiave === "velo" ? 0.002 : 0.5,
        ...extra,
        passo: (x) => {
          vista[chiave] = x;
          aFineGiro(disegna);
        },
        fine: finito,
      });
    };
    parti("sx", sx, velocita.x || 0);
    parti("sy", sy, velocita.y || 0);
    parti("s", s);
    parti("velo", v);
  };

  const apri = (i) => {
    indice = i;
    const m = miniatura(i);
    // subito la miniatura già scaricata, poi l'immagine grande quando è pronta
    const centro = lastre[1];
    centro.src = m.currentSrc || m.src || sorgente(i);
    const grande = new Image();
    grande.src = sorgente(i);
    grande.decode?.().then(() => {
      if (aperta && indice === i) centro.src = grande.src;
    }).catch(() => {});
    carica(lastre[0], i - 1);
    carica(lastre[2], i + 1);
    scrivi();
    finestra.showModal();
    radice.classList.add("lightbox-aperta");
    aperta = true;
    misura();
    chiudi.focus();
    Object.assign(vista, { x: 0, y: 0, s: 1, sx: 0, sy: 0, velo: 0 });
    bersaglioX = 0;
    const da = versoMiniatura(i);
    if (da) Object.assign(vista, da);
    else Object.assign(vista, { s: 0.92 });
    centro.style.opacity = "1";
    if (riduci.matches) {
      Object.assign(vista, { sx: 0, sy: 0, s: 1, velo: 0 });
      finestra.classList.add("dissolve");
    }
    disegna();
    requestAnimationFrame(() => vola({ sx: 0, sy: 0, s: 1, velo: 1 }));
  };

  const finisci = () => {
    ferma("x", "sx", "sy", "s", "velo");
    presa = null;
    aperta = false;
    finestra.classList.remove("dissolve");
    if (finestra.open) finestra.close();
    radice.classList.remove("lightbox-aperta");
  };

  const richiudi = (velocita = {}) => {
    if (!aperta) return;
    ferma("x");
    // se stava passando all'immagine accanto, si chiude su quella
    if (Math.abs(vista.x) > larghezza() / 2) cambia(vista.x < 0 ? 1 : -1);
    vista.sx += vista.x;
    vista.x = 0;
    bersaglioX = 0;
    const verso = versoMiniatura(indice);
    if (verso) vola({ ...verso, velo: 0 }, velocita, finisci);
    else vola({ sx: vista.sx, sy: vista.sy + Math.sign(vista.sy || 1) * innerHeight * 0.6, s: 0.8, velo: 0 }, velocita, finisci);
  };

  voci.forEach((v, i) => v.addEventListener("click", () => apri(i), { signal }));
  indietro.addEventListener("click", () => vai(-1), { signal });
  avanti.addEventListener("click", () => vai(1), { signal });
  chiudi.addEventListener("click", () => richiudi(), { signal });
  // Esc chiude con lo stesso movimento del bottone
  finestra.addEventListener(
    "cancel",
    (e) => {
      e.preventDefault();
      richiudi();
    },
    { signal },
  );
  finestra.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "ArrowRight" && !unica) salta(1);
      else if (e.key === "ArrowLeft" && !unica) salta(-1);
      else return;
      e.preventDefault();
    },
    { signal },
  );
  // un tocco sul fondo, fuori dall'immagine, chiude
  velo.addEventListener("click", () => richiudi(), { signal });

  // ---------------- il dito
  const traccia = tracciaVelocita();
  pista.addEventListener(
    "pointerdown",
    (e) => {
      if (!aperta || (e.pointerType === "mouse" && e.button !== 0)) return;
      // un dito solo: un secondo dito appoggiato non ruba l'immagine al primo (prima la faceva saltare)
      if (presa) return;
      try {
        pista.setPointerCapture(e.pointerId);
      } catch {
        /* senza la presa del puntatore il trascinamento funziona lo stesso, finché il dito resta sull'immagine */
      }
      // si prende l'immagine dov'è adesso, anche se si sta muovendo
      const correvaX = molle.x?.corre;
      const correvaY = molle.sy?.corre && vista.s > 0.6 && vista.velo < 1;
      ferma("x", "sx", "sy", "s", "velo");
      traccia.azzera();
      traccia.aggiungi(e.clientX, e.clientY);
      presa = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        asse: correvaX ? "x" : correvaY ? "y" : null,
        partenzaX: vista.x,
        partenzaY: vista.sy,
      };
    },
    { signal },
  );
  pista.addEventListener(
    "pointermove",
    (e) => {
      if (!presa || e.pointerId !== presa.id) return;
      traccia.aggiungi(e.clientX, e.clientY);
      const dx = e.clientX - presa.x0;
      const dy = e.clientY - presa.y0;
      // 10 px prima di decidere la direzione, poi il movimento segue il dito 1:1
      if (!presa.asse) {
        if (Math.hypot(dx, dy) < 10) return;
        presa.asse = Math.abs(dx) > Math.abs(dy) && !unica ? "x" : "y";
      }
      if (presa.asse === "x") {
        let x = presa.partenzaX + dx;
        const L = larghezza();
        // prima e ultima immagine: resistenza elastica
        if (!esiste(indice - 1) && x > 0) x = elastico(x, L);
        if (!esiste(indice + 1) && x < 0) x = -elastico(-x, L);
        vista.x = x;
      } else {
        const y = presa.partenzaY + dy;
        vista.sy = y;
        vista.sx = dx * 0.4;
        vista.s = Math.max(0.6, 1 - Math.abs(y) / 1400);
        vista.velo = Math.max(0.15, 1 - Math.abs(y) / 420);
      }
      disegna();
    },
    { signal },
  );
  const lascia = (e) => {
    if (!presa || e.pointerId !== presa.id) return;
    const { asse } = presa;
    presa = null;
    const v = traccia.velocita();
    if (asse === "x") {
      const L = larghezza();
      const arrivo = vista.x + proietta(v.x);
      let d = 0;
      if (arrivo < -L / 2 && esiste(indice + 1)) d = 1;
      else if (arrivo > L / 2 && esiste(indice - 1)) d = -1;
      muoviX(-d * L, v.x);
    } else if (asse === "y") {
      const arrivo = vista.sy + proietta(v.y);
      if (Math.abs(arrivo) > 160) richiudi(v);
      else vola({ sx: 0, sy: 0, s: 1, velo: 1 }, v);
    } else {
      // un tocco fuori dall'immagine (nelle bande vuote) chiude
      const r = rettangoloPieno(lastre[1]);
      if (e.clientX < r.x || e.clientX > r.x + r.w || e.clientY < r.y || e.clientY > r.y + r.h) richiudi();
    }
  };
  pista.addEventListener("pointerup", lascia, { signal });
  pista.addEventListener("pointercancel", lascia, { signal });
  window.addEventListener(
    "resize",
    () => {
      if (!aperta) return;
      misura();
      disegna();
    },
    { signal },
  );

  signal.addEventListener("abort", () => aperta && finisci(), { once: true });
}

// ---------------------------------------------------------------- nuova uscita: conto alla rovescia
// Prima del giorno d'uscita dice quanti giorni mancano; dopo, il bottone porta ad ascoltarla.

function uscita() {
  const box = $("[data-uscita]");
  const [anno, mese, giorno] = (box?.dataset.uscita || "").split("-").map(Number);
  if (!anno || !mese || !giorno) return;
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const mancano = Math.round((new Date(anno, mese - 1, giorno) - oggi) / 86400000);
  const quando = $("[data-uscita-quando]", box);
  if (mancano > 0) {
    if (quando) quando.textContent = `${box.dataset.prima} · ${mancano === 1 ? "manca un giorno" : `mancano ${mancano} giorni`}`;
    return;
  }
  // dal giorno dell'uscita il pre-save diventa «Ascolta l'ultima uscita»: etichetta, testo e bottone
  // prendono i testi di dopo che la build ha messo negli attributi data-dopo-testo
  if (quando) quando.textContent = mancano === 0 ? "Uscito oggi" : box.dataset.dopo;
  for (const el of $$("[data-dopo-testo]", box)) el.textContent = el.dataset.dopoTesto;
  const bottone = $("[data-uscita-link]", box);
  if (bottone?.dataset.dopoLink) bottone.href = bottone.dataset.dopoLink;
}

// ---------------------------------------------------------------- codice della donazione
// Nel riquadro Sostienimi chi ha donato scrive il codice che gli ha mandato TAUH. Il sito ne
// conosce solo l'impronta (SHA-256, come strumenti/codice-sblocco.mjs): se combacia, il browser
// ricorda lo sblocco e i brani col lucchetto del gioco si aprono, nell'elenco e nel lettore.

function sblocco(signal) {
  const form = $("[data-sblocco]");
  if (!form) return;
  // per ogni brano coi codici: { titolo, codici: [impronte], fino, gioco }, sotto il nome della sua chiave
  let voci = [];
  try {
    voci = Object.entries(JSON.parse(form.dataset.brani || "{}"));
  } catch {
    return;
  }
  const campo = $("input", form);
  const riga = $(".sblocco-riga", form);
  const esito = $("[data-sblocco-esito]", form);
  const ancoraChiusi = () => voci.filter(([codice, b]) => !libero(b.fino, b.gioco, codice));
  // si vede solo se in questo browser c'è ancora un brano da sbloccare col codice
  form.hidden = !ancoraChiusi().length;
  const di = (testo, classe = "") => {
    esito.textContent = testo;
    form.classList.toggle("sbagliato", classe === "sbagliato");
    form.classList.toggle("fatto", classe === "fatto");
    campo.setAttribute("aria-invalid", String(classe === "sbagliato"));
  };
  form.addEventListener(
    "submit",
    async (e) => {
      e.preventDefault();
      const pulito = campo.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!pulito) return;
      let impronta = "";
      try {
        const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`la-via-delle-ombre:${pulito}`));
        impronta = [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, "0")).join("");
      } catch {
        di("Questo browser non riesce a controllare il codice: prova ad aprire il sito con Safari o Chrome.", "sbagliato");
        return;
      }
      // ogni codice vale solo per il suo brano
      const trovato = voci.find(([, b]) => b.codici.includes(impronta));
      if (!trovato) {
        di("Il codice non è giusto: controlla di averlo scritto bene.", "sbagliato");
        campo.select();
        return;
      }
      const [codice, b] = trovato;
      try {
        localStorage.setItem(chiaveDonazione(codice), "1");
      } catch {
        di("Il browser non permette di ricordare lo sblocco: se sei in navigazione privata, riprova in una finestra normale.", "sbagliato");
        return;
      }
      campo.value = "";
      // se ci sono altri brani da sbloccare il campo resta, per un altro codice
      riga.hidden = !ancoraChiusi().length;
      di(`Fatto, grazie del sostegno! «${b.titolo}» ora la ascolti anche qui, nell'elenco dei brani.`, "fatto");
      window.dispatchEvent(new Event("tauh-sbloccati"));
    },
    { signal },
  );
}

// ---------------------------------------------------------------- video sbloccati con una donazione
// Satanismo del Chaos: i video non in elenco su YouTube, e un codice di donazione li apre tutti. I codici
// dei video non sono nella pagina: ognuno è chiuso con la chiave della pagina («chiuso» del video), e la
// chiave è chiusa una volta per ogni codice di sblocco («serrature», PBKDF2 e AES-GCM, come
// strumenti/codice-sblocco.mjs). Chi scrive un codice giusto apre la sua serratura, prende la chiave e
// apre tutti i video; il browser ricorda la chiave e la volta dopo i video sono già aperti, anche quelli
// aggiunti nel frattempo. Il player di YouTube si carica solo quando la persona lo avvia.

const CHIAVE_PAGINA_VIDEO = "tauh-satanismo";
const chiaveVideo = (nome) => `tauh-video:${nome}`; // i video sbloccati prima della chiave unica
const codiceVideoValido = (id) => typeof id === "string" && /^[A-Za-z0-9_-]{6,20}$/.test(id);
const da64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const in64 = (b) => btoa(String.fromCharCode(...b));

// dal codice di sblocco alla chiave della pagina (32 byte), o null se il codice non apre nessuna serratura
async function chiaveDaCodice(codice, blocco) {
  const testo = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", testo.encode(codice), "PBKDF2", false, ["deriveKey"]);
  const chiave = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: testo.encode(blocco.sale), iterations: blocco.giri, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  for (const s of blocco.serrature) {
    try {
      const chiaro = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: da64(s.iv) }, chiave, da64(s.dati)));
      if (chiaro.length === 32) return chiaro;
    } catch {
      /* non è la sua serratura */
    }
  }
  return null;
}

async function apriVideo(chiavePagina, chiuso) {
  try {
    const chiave = await crypto.subtle.importKey("raw", chiavePagina, "AES-GCM", false, ["decrypt"]);
    const id = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: da64(chiuso.iv) }, chiave, da64(chiuso.dati)));
    return codiceVideoValido(id) ? id : null;
  } catch {
    return null;
  }
}

function videoSbloccabili(signal) {
  const pagina = $("[data-satanismo-sblocco]");
  if (!pagina) return;
  let blocco;
  try {
    blocco = JSON.parse(pagina.dataset.satanismoSblocco);
  } catch {
    return;
  }
  const schede = [];
  for (const el of $$("[data-video]", pagina)) {
    let dati;
    try {
      dati = JSON.parse(el.dataset.video);
    } catch {
      continue;
    }
    const schermo = $("[data-video-schermo]", el);
    const chiuso = $("[data-video-chiuso]", el);
    const aperto = $("[data-video-aperto]", el);
    const form = $("[data-sblocco-video]", el);
    const scheda = { el, dati, form, aperta: false };
    // il video sbloccato: la copertina diventa il bottone che carica il player, più il link a YouTube
    scheda.mostra = (id) => {
      if (scheda.aperta) return;
      scheda.aperta = true;
      const copertina = $("img", schermo).cloneNode();
      const bottone = document.createElement("button");
      bottone.type = "button";
      bottone.className = "video-avvia";
      bottone.setAttribute("aria-label", `Guarda «${dati.titolo}» qui sul sito (il video arriva da YouTube)`);
      const etichetta = document.createElement("span");
      etichetta.className = "video-play";
      etichetta.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>Guarda il video';
      bottone.append(copertina, etichetta);
      schermo.replaceChildren(bottone);
      schermo.dataset.incorpora = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      schermo.dataset.titolo = `${dati.titolo} – TAUH su YouTube`;
      schermo.dataset.altezza = "360";
      collegaIncorporato(schermo);
      $("[data-video-link]", aperto).href = `https://youtu.be/${id}`;
      chiuso.hidden = true;
      aperto.hidden = false;
      el.classList.add("sbloccato");
    };
    schede.push(scheda);
  }
  if (!schede.length) return;

  const apriTutti = async (chiavePagina) => {
    for (const s of schede) {
      if (s.aperta) continue;
      const id = await apriVideo(chiavePagina, s.dati.chiuso);
      if (signal.aborted) return;
      if (id) s.mostra(id);
    }
  };
  const leggi = (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  // video aperti prima della chiave unica: restano aperti
  for (const s of schede) {
    const id = leggi(chiaveVideo(s.dati.nome));
    if (codiceVideoValido(id)) s.mostra(id);
  }
  let salvata = null;
  try {
    const v = leggi(CHIAVE_PAGINA_VIDEO);
    if (v) salvata = da64(v);
  } catch {
    /* chiave rovinata: si riscrive il codice */
  }
  const pronto = salvata?.length === 32 ? apriTutti(salvata).catch(() => {}) : Promise.resolve();

  pronto.then(() => {
    if (signal.aborted) return;
    for (const s of schede) {
      if (s.aperta) continue;
      const form = s.form;
      const campo = $("input", form);
      const invia = $("button[type=submit]", form);
      const esito = $("[data-sblocco-esito]", form);
      const di = (testo, classe = "") => {
        esito.textContent = testo;
        form.classList.toggle("sbagliato", classe === "sbagliato");
        form.classList.toggle("fatto", classe === "fatto");
        campo.setAttribute("aria-invalid", String(classe === "sbagliato"));
      };
      // senza JavaScript il codice non si può controllare: il modulo compare solo qui
      form.hidden = false;
      form.addEventListener(
        "submit",
        async (e) => {
          e.preventDefault();
          const pulito = campo.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
          if (!pulito) return;
          invia.disabled = true;
          di("Controllo il codice…");
          let chiavePagina = null;
          try {
            chiavePagina = await chiaveDaCodice(pulito, blocco);
          } catch {
            invia.disabled = false;
            di("Questo browser non riesce a controllare il codice: prova ad aprire il sito con Safari o Chrome.", "sbagliato");
            return;
          }
          if (signal.aborted) return;
          invia.disabled = false;
          if (!chiavePagina) {
            di("Il codice non è giusto: controlla di averlo scritto bene.", "sbagliato");
            campo.select();
            return;
          }
          let ricordato = true;
          try {
            localStorage.setItem(CHIAVE_PAGINA_VIDEO, in64(chiavePagina));
          } catch {
            ricordato = false;
          }
          campo.value = "";
          await apriTutti(chiavePagina);
          if (signal.aborted) return;
          const quanti = schede.filter((x) => x.aperta).length;
          const nota = $(".video-nota", s.el);
          nota.textContent = ricordato
            ? `Fatto, grazie del sostegno! ${quanti > 1 ? "I video sono sbloccati" : "Il video è sbloccato"} in questo browser. Arriva${quanti > 1 ? "no" : ""} da YouTube e si caric${quanti > 1 ? "ano" : "a"} solo quando l${quanti > 1 ? "i" : "o"} avvii.`
            : "Fatto, grazie del sostegno! Il browser non permette di ricordare lo sblocco: la prossima volta riscrivi il codice.";
          if (s.aperta) $("button", $("[data-video-schermo]", s.el))?.focus();
          else di("Il codice è giusto, ma questo video non si apre: scrivimi e lo sistemo.", "sbagliato");
        },
        { signal },
      );
    }
  });
}

// ---------------------------------------------------------------- elenco dei brani nella home

function elencoBrani(signal) {
  // all'inizio se ne vedono pochi; «Tutti i brani» apre il resto (senza JS si vedono tutti)
  const elenco = $("[data-brani-in-vista]");
  const tutti = $("[data-tutti-brani]");
  if (elenco && tutti) {
    elenco.classList.add("raccolti");
    tutti.hidden = false;
    tutti.addEventListener(
      "click",
      () => {
        const apri = elenco.classList.contains("raccolti");
        elenco.classList.toggle("raccolti", !apri);
        tutti.setAttribute("aria-expanded", String(apri));
        tutti.textContent = apri ? "Meno brani" : tutti.dataset.testo;
        // richiudendo, si torna all'inizio dell'elenco invece di restare in fondo alla pagina
        if (!apri) elenco.scrollIntoView({ block: "nearest", behavior: riduci.matches ? "auto" : "smooth" });
      },
      { signal },
    );
    tutti.dataset.testo = tutti.textContent;
  }
  const bottoni = $$("[data-brano]");
  if (!bottoni.length || !lettore) return;
  // brani col lucchetto: finché sono chiusi, al posto del bottone c'è il link al gioco o «In arrivo»
  const chiusi = $$("[data-bloccata]");
  const controlla = () => {
    for (const voce of chiusi) {
      const aperto = libero(voce.dataset.bloccata, "colGioco" in voce.dataset, voce.dataset.codice);
      const bottone = $("[data-brano]", voce);
      const verso = $("[data-sblocca]", voce);
      if (bottone) bottone.hidden = !aperto;
      if (verso) verso.hidden = aperto;
    }
    // «oppure ascoltala su Spotify»: compare dal giorno in cui il pezzo esce
    for (const el of $$("[data-dal]")) el.hidden = !giornoArrivato(el.dataset.dal);
  };
  if (chiusi.length) {
    controlla();
    // il gioco finito o il codice scritto in un'altra scheda, o tornando indietro dal gioco
    const chiave = (k) => k === null || k === CHIAVE_GIOCO || k.startsWith("tauh-sblocco:");
    window.addEventListener("storage", (e) => chiave(e.key) && controlla(), { signal });
    window.addEventListener("pageshow", controlla, { signal });
    // il codice della donazione appena scritto in questa pagina
    window.addEventListener("tauh-sbloccati", controlla, { signal });
  }
  for (const b of bottoni) {
    b.addEventListener(
      "click",
      () => {
        const i = Number(b.dataset.brano);
        const s = lettore.stato();
        if (s.indice === i && s.suona) lettore.pausa();
        else lettore.avvia(i);
      },
      { signal },
    );
  }
  lettore.ascolta(({ indice, suona, attivo }) => {
    bottoni.forEach((b, k) => {
      const qui = attivo && k === indice;
      b.classList.toggle("attuale", qui);
      b.setAttribute("aria-pressed", String(qui && suona));
    });
  }, signal);
}

// ---------------------------------------------------------------- manifesto
// Il manifesto in fondo alla home è chiuso; si apre toccandolo o arrivando da un link a #manifesto
// (per esempio la voce del menu).

function manifesto(signal) {
  const box = $("[data-manifesto]");
  if (box && !box.id) box.id = "manifesto-testo";
  // il manifesto risponde a #manifesto (l'id è della sezione); i ringraziamenti al loro id
  const voci = [...(box ? [["manifesto", box]] : []), ...$$("details[data-ancora][id]").map((d) => [d.id, d])];
  if (!voci.length) return;
  const apri = (hash) => {
    for (const [nome, d] of voci) if (hash === `#${nome}`) d.open = true;
  };
  apri(location.hash);
  window.addEventListener("hashchange", () => apri(location.hash), { signal });
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest('a[href*="#"]');
      if (!a) return;
      const url = new URL(a.href, location.href);
      if (url.pathname === location.pathname) apri(url.hash);
    },
    { signal },
  );
}

// ---------------------------------------------------------------- browser dentro le app
// Nel browser interno di Instagram, Facebook e TikTok la musica si ferma quando si esce
// dall'app o si spegne lo schermo (lo decide l'app): sotto i brani compare come evitarlo.

const appOspite = (() => {
  const ua = navigator.userAgent || "";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return "Facebook";
  if (/musical_ly|TikTok|BytedanceWebview|ByteLocale/i.test(ua)) return "TikTok";
  return "";
})();

function avvisoApp() {
  if (!appOspite) return;
  for (const avviso of $$("[data-avviso-app]")) {
    const nome = $("[data-nome-app]", avviso);
    if (nome) nome.textContent = appOspite;
    avviso.hidden = false;
  }
}

// ---------------------------------------------------------------- striscia della nuova uscita
// Compare solo a chi arriva da Instagram: lo script nella <head> (build.mjs, scriptStriscia)
// mette su <html> la classe ig-prima (prima dell'uscita) o ig-dopo (nei giorni dopo).
// Chiudendola, o toccando il bottone, non torna più per quella fase dell'uscita.

function striscia(segnale) {
  const s = $("[data-striscia]");
  if (!s) return;
  s.addEventListener(
    "click",
    (e) => {
      if (!e.target.closest("[data-striscia-chiudi], [data-striscia-azione]")) return;
      const radice = document.documentElement;
      const fase = radice.classList.contains("ig-dopo") ? "dopo" : "prima";
      try {
        localStorage.setItem(`tauh-striscia:${s.dataset.striscia}:${fase}`, "1");
      } catch {
        /* senza memoria del browser si chiude solo per questa pagina */
      }
      radice.classList.remove("ig-prima", "ig-dopo");
      // chiusa col ×, il focus non resta su un bottone sparito: va all'inizio del contenuto
      if (e.target.closest("[data-striscia-chiudi]")) {
        const principale = $("main");
        if (principale) {
          if (!principale.hasAttribute("tabindex")) principale.setAttribute("tabindex", "-1");
          principale.focus({ preventScroll: true });
        }
      }
    },
    { signal: segnale },
  );
}

// ---------------------------------------------------------------- sigilli in 3D
// I sigilli di «I miei social» diventano medaglioni in rilievo (src/sigilli3d.js). Il modulo
// si scarica solo quando la sezione sta per comparire; senza WebGL restano le immagini.

function sigilli3d(signal) {
  const lista = $("[data-sigilli-3d]");
  if (!lista || !("IntersectionObserver" in window)) return;
  const vicino = new IntersectionObserver(
    (voci) => {
      if (!voci.some((v) => v.isIntersecting)) return;
      vicino.disconnect();
      import(lista.getAttribute("data-sigilli-3d"))
        .then((m) => m.avvia(lista, signal))
        .catch((errore) => console.warn("Sigilli in 3D non disponibili:", errore));
    },
    { rootMargin: "600px 0px" },
  );
  vicino.observe(lista);
  signal.addEventListener("abort", () => vicino.disconnect(), { once: true });
}

// ---------------------------------------------------------------- la via della home
// Una linea lime scende lungo la home; il nodo viola la percorre (CSS, position: sticky) e
// accende i titoli delle sezioni (data-tappa) quando ci passa. La parte di linea già fatta
// è piena (.via-fatta, allungata con una trasformazione), il resto è spento.
//
// Scorrendo non si misura niente: le posizioni delle tappe si leggono una volta e di nuovo solo
// quando la pagina cambia altezza (un riquadro che si apre, i brani in più, le immagini che
// arrivano). Prima, a ogni fotogramma, una variabile sul contenitore faceva ricalcolare gli stili
// di tutta la home e ogni tappa veniva rimisurata.

function via(signal) {
  const percorso = $("[data-via]");
  if (!percorso) return;
  const fatta = $("[data-via-fatta]", percorso);
  const tappe = $$("[data-tappa]", percorso);
  let cima = 0; // dove comincia la via, dall'inizio della pagina
  let alta = 0;
  let cime = []; // per ogni tappa: l'alto del titolo…
  let centri = []; // …e il centro del suo cerchio (a 0,62em dall'alto del titolo)
  let attesa = 0;

  const aggiorna = () => {
    attesa = 0;
    // prima si legge, poi si scrive: così il browser non rifà i conti a metà
    const meta = window.scrollY + window.innerHeight * 0.5;
    const fatto = Math.max(0, Math.min(alta, meta - cima));
    if (fatta) fatta.style.transform = `scaleY(${alta ? (fatto / alta).toFixed(5) : 0})`;
    // il nodo compare solo quando la via è cominciata (prima sarebbe un mezzo cerchio sotto l'apertura)
    percorso.classList.toggle("partita", cima < meta);
    tappe.forEach((t, k) => {
      t.classList.toggle("accesa", cime[k] < meta);
      // quando il nodo (24 px) tocca il cerchio della tappa (16 px), il cerchio si spegne: niente due nodi uno sull'altro
      t.classList.toggle("sotto-il-nodo", Math.abs(centri[k] - meta) < 30);
    });
  };
  const misura = () => {
    const y = window.scrollY;
    const r = percorso.getBoundingClientRect();
    cima = r.top + y;
    alta = r.height;
    cime = [];
    centri = [];
    for (const t of tappe) {
      const alto = t.getBoundingClientRect().top + y;
      cime.push(alto);
      centri.push(alto + parseFloat(getComputedStyle(t).fontSize) * 0.62);
    }
    aggiorna();
  };
  const chiedi = () => {
    if (!attesa) attesa = requestAnimationFrame(aggiorna);
  };
  window.addEventListener("scroll", chiedi, { passive: true, signal });
  window.addEventListener("resize", misura, { signal });
  // quando la via cambia altezza, le tappe più in basso si sono spostate
  let guarda = null;
  if ("ResizeObserver" in window) {
    guarda = new ResizeObserver(misura);
    guarda.observe(percorso);
  } else {
    window.addEventListener("load", misura, { signal });
  }
  signal.addEventListener(
    "abort",
    () => {
      cancelAnimationFrame(attesa);
      guarda?.disconnect();
    },
    { once: true },
  );
  percorso.classList.add("in-cammino");
  misura();
}

// ---------------------------------------------------------------- riquadri che si aprono
// Ringraziamenti e Manifesto (details.apribile): toccando il titolo l'altezza si apre e si richiude
// con lo stesso movimento, in tutti i browser. È il solo punto del sito dove si anima un'altezza:
// non c'è una trasformazione che faccia scendere anche quello che sta sotto. Per questo dura poco
// (da 0,2 a 0,32 s, secondo quanta strada c'è da fare). Si può ritoccare a metà: riparte da dov'è.
// Con «riduci movimento», o senza JS, si aprono e chiudono subito come sempre.

function apribili(signal) {
  for (const d of $$("details.apribile")) {
    const sommario = $("summary", d);
    if (!sommario || !d.animate) continue;
    let movimento = null;
    let versoAperto = d.open;
    const fermo = () => {
      movimento = null;
      d.classList.remove("in-moto", "si-chiude");
    };
    sommario.addEventListener(
      "click",
      (e) => {
        // Con «riduci movimento» e con la tastiera (Invio o Spazio: il clic arriva senza un dito,
        // detail 0) si apre e si chiude subito, come fa il browser da solo.
        if (riduci.matches || e.detail === 0) {
          if (movimento) {
            const apri = !versoAperto;
            movimento.cancel();
            fermo();
            // a metà di un movimento «open» è ancora vero: lo stato lo decido io, non il browser
            e.preventDefault();
            d.open = apri;
          }
          return;
        }
        e.preventDefault();
        const apri = movimento ? !versoAperto : !d.open;
        versoAperto = apri;
        // da dove si parte: l'altezza che si vede adesso, anche a metà di un movimento
        const da = d.getBoundingClientRect().height;
        movimento?.cancel();
        // dove si arriva: le due altezze vere, chiuso e aperto
        d.classList.remove("in-moto", "si-chiude");
        d.open = false;
        const chiusa = d.getBoundingClientRect().height;
        d.open = true;
        const aperta = d.getBoundingClientRect().height;
        const a = apri ? aperta : chiusa;
        const strada = Math.abs(a - da);
        if (strada < 1) {
          d.open = apri;
          fermo();
          return;
        }
        d.classList.add("in-moto");
        d.classList.toggle("si-chiude", !apri);
        const questo = d.animate(
          { height: [`${da}px`, `${a}px`] },
          { duration: Math.min(320, Math.max(200, strada / 2)), easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" },
        );
        movimento = questo;
        questo.addEventListener("finish", () => {
          if (movimento !== questo) return;
          // prima lo stato vero, poi via l'animazione: nessun fotogramma con l'altezza sbagliata
          if (!apri) d.open = false;
          questo.cancel();
          fermo();
        });
      },
      { signal },
    );
    signal.addEventListener(
      "abort",
      () => {
        movimento?.cancel();
        fermo();
      },
      { once: true },
    );
  }
}

// ---------------------------------------------------------------- lettore e nuova uscita
// Finché la nuova uscita è sullo schermo, il tondo del lettore (da fermo) si fa da parte: nella prima
// schermata l'unico bottone pieno è il pre-save. Se la musica suona, la barra resta.

function lettoreDaParte(signal) {
  const box = $("[data-uscita]");
  if (!box || !("IntersectionObserver" in window)) return;
  const radice = document.documentElement;
  const guarda = new IntersectionObserver(([voce]) => radice.classList.toggle("uscita-in-vista", voce.isIntersecting), { threshold: 0.1 });
  guarda.observe(box);
  signal.addEventListener(
    "abort",
    () => {
      guarda.disconnect();
      radice.classList.remove("uscita-in-vista");
    },
    { once: true },
  );
}

// ---------------------------------------------------------------- «Ascolta» nell'apertura
// Senza JS porta all'elenco dei brani; con il lettore fa partire la musica.

function ascoltaSubito(signal) {
  const bottone = $("[data-ascolta]");
  if (!bottone || !lettore) return;
  bottone.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      if (lettore.inAscolto()) lettore.pausa();
      else lettore.avvia();
    },
    { signal },
  );
  lettore.ascolta(({ suona }) => {
    bottone.classList.toggle("in-ascolto", suona);
    const testo = $("[data-ascolta-testo]", bottone);
    if (testo) testo.textContent = suona ? "Pausa" : "Ascolta";
  }, signal);
}

// ---------------------------------------------------------------- anteprima del gioco
// Qualche secondo di partita, muta, che gira solo quando è sullo schermo. Con «riduci movimento»
// resta ferma sul primo fotogramma; il bottone in basso la ferma o la fa ripartire.

function clip(signal) {
  const video = $("[data-clip]");
  if (!video) return;
  const bottone = $("[data-clip-pausa]");
  const etichetta = bottone && $("[data-clip-etichetta]", bottone);
  let fermata = riduci.matches;
  let inVista = false;
  const disegna = () => {
    if (!bottone) return;
    const gira = !video.paused;
    bottone.setAttribute("aria-pressed", String(!gira));
    bottone.classList.toggle("in-ascolto", gira);
    if (etichetta) etichetta.textContent = gira ? "Ferma l'anteprima del gioco" : "Fai partire l'anteprima del gioco";
  };
  const decidi = () => {
    if (inVista && !fermata && !document.hidden) video.play().catch(() => {});
    else video.pause();
  };
  video.addEventListener("play", disegna, { signal });
  video.addEventListener("pause", disegna, { signal });
  if (bottone) {
    bottone.hidden = false;
    bottone.addEventListener(
      "click",
      () => {
        fermata = !video.paused;
        if (!fermata) inVista = true;
        decidi();
      },
      { signal },
    );
  }
  if ("IntersectionObserver" in window) {
    const guarda = new IntersectionObserver(
      ([voce]) => {
        inVista = voce.isIntersecting;
        decidi();
      },
      { threshold: 0.25 },
    );
    guarda.observe(video);
    // sugli schermi larghi, quando sta per comparire, il primo fotogramma passa a quello grande
    const grande = video.dataset.posterGrande;
    const vicino = new IntersectionObserver(
      ([voce]) => {
        if (!voce.isIntersecting) return;
        vicino.disconnect();
        if (grande && window.matchMedia("(min-width: 700px)").matches) video.poster = grande;
      },
      { rootMargin: "800px 0px" },
    );
    vicino.observe(video);
    signal.addEventListener(
      "abort",
      () => {
        guarda.disconnect();
        vicino.disconnect();
      },
      { once: true },
    );
  }
  document.addEventListener("visibilitychange", decidi, { signal });
  signal.addEventListener("abort", () => video.pause(), { once: true });
  disegna();
}

// ---------------------------------------------------------------- avvio delle parti

// Safari su iPhone accende gli stati :active (la risposta al tocco, appena il dito appoggia)
// solo se la pagina ascolta i tocchi: basta un ascoltatore vuoto e passivo.
document.addEventListener("touchstart", () => {}, { passive: true });

let spegniPagina = null;

function avviaPagina() {
  spegniPagina?.abort();
  spegniPagina = new AbortController();
  for (const parte of [menu, incorporati, videoSbloccabili, binari, visore, ricerca, gioco, galleria, elencoBrani, uscita, avvisoApp, manifesto, apribili, sblocco, striscia, sigilli3d, monete, rilievo, via, ascoltaSubito, clip, lettoreDaParte]) {
    try {
      parte(spegniPagina.signal);
    } catch (errore) {
      console.error(errore);
    }
  }
}

avviaPagina();

// ================================================================ navigazione senza interrompere la musica
// Mentre un brano suona, i link interni scaricano la pagina nuova e ne sostituiscono
// il contenuto; la barra del lettore resta dov'è. Negli altri casi i link
// funzionano come sempre.

(() => {
  if (!lettore || !window.fetch || !window.DOMParser) return;
  const firma = (doc) =>
    $$('link[rel="stylesheet"], script[type="module"]', doc)
      .map((e) => e.getAttribute("href") || e.getAttribute("src"))
      .join(" ");
  const firmaAttuale = firma(document);
  let percorsoAttuale = location.pathname;
  let inCorso = null;

  const daEscludere = (url, a) =>
    a.hasAttribute("download") ||
    (a.target && a.target !== "_self") ||
    /^\/(scarica|media|img|assets|gioco\/play)\//.test(url.pathname) ||
    (/\.[a-z0-9]{2,5}$/i.test(url.pathname) && !/\.html$/i.test(url.pathname));

  function sostituisci(nuovo, url, scroll) {
    document.title = nuovo.title;
    for (const sel of ['meta[name="description"]', 'link[rel="canonical"]']) {
      const vecchio = $(sel);
      const fresco = $(sel, nuovo);
      if (vecchio && fresco) vecchio.replaceWith(document.importNode(fresco, true));
    }
    const barra = $("[data-lettore]");
    const tieni = new Set([barra, $("#brani-dati")]);
    for (const nodo of [...document.body.childNodes]) if (!tieni.has(nodo)) nodo.remove();
    for (const nodo of [...nuovo.body.childNodes]) {
      // la barra e i suoi dati restano quelli di prima; lo script che la ripristina al caricamento qui non serve
      if (nodo.nodeType === 1 && (nodo.matches("[data-lettore]") || nodo.id === "brani-dati" || nodo.id === "lettore-pronto")) continue;
      document.body.insertBefore(document.importNode(nodo, true), barra);
    }
    percorsoAttuale = url.pathname;
    avviaPagina();
    const meta = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (scroll != null) window.scrollTo(0, scroll);
    else if (meta) meta.scrollIntoView();
    else window.scrollTo(0, 0);
    const principale = $("main");
    if (principale) {
      principale.setAttribute("tabindex", "-1");
      principale.focus({ preventScroll: true });
    }
  }

  async function vai(url, { aggiungi = false, scroll = null } = {}) {
    inCorso?.abort();
    const questo = new AbortController();
    inCorso = questo;
    // la linea in cima compare solo se la pagina si fa aspettare: un lampo di 50 ms sembra un difetto
    const segnale = setTimeout(() => document.documentElement.classList.add("in-viaggio"), 300);
    let nuovo;
    let finale;
    try {
      const risposta = await fetch(url.href, { signal: questo.signal, headers: { Accept: "text/html" } });
      if (!risposta.ok || !(risposta.headers.get("content-type") || "").includes("text/html")) throw new Error("pagina non disponibile");
      nuovo = new DOMParser().parseFromString(await risposta.text(), "text/html");
      finale = new URL(risposta.url || url.href);
      finale.hash = url.hash;
    } catch {
      if (questo.signal.aborted) return;
      location.href = url.href;
      return;
    } finally {
      if (inCorso === questo) {
        clearTimeout(segnale);
        document.documentElement.classList.remove("in-viaggio");
      }
    }
    if (questo.signal.aborted) return;
    // Se nel frattempo il sito è stato aggiornato, meglio caricare la pagina per intero.
    if (firma(nuovo) !== firmaAttuale || !lettore.stessiBrani(nuovo, finale.href)) {
      location.href = finale.href;
      return;
    }
    if (aggiungi) {
      history.scrollRestoration = "manual";
      try {
        history.replaceState({ ...(history.state || {}), scroll: window.scrollY }, "");
        history.pushState({ tauh: true }, "", finale.href);
      } catch {
        location.href = finale.href;
        return;
      }
    } else if (finale.href !== location.href) {
      sostituisciIndirizzo(finale.href);
    }
    const cambia = () => sostituisci(nuovo, finale, scroll);
    if (document.startViewTransition && !riduci.matches) document.startViewTransition(cambia);
    else cambia();
  }

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest("a[href]");
    if (!a || !lettore.inAscolto()) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) {
      // Fuori dal sito: si apre in un'altra scheda, così la musica continua.
      if (/^https?:$/.test(url.protocol) && !a.hasAttribute("download")) {
        e.preventDefault();
        window.open(url.href, "_blank", "noopener");
      }
      return;
    }
    if (daEscludere(url, a)) return;
    if (url.pathname === location.pathname && url.search === location.search) {
      if (url.hash) return; // un'ancora nella stessa pagina: ci pensa il browser
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: riduci.matches ? "auto" : "smooth" });
      return;
    }
    e.preventDefault();
    vai(url, { aggiungi: true });
  });

  window.addEventListener("popstate", (e) => {
    if (location.pathname === percorsoAttuale) return; // solo un'ancora nella stessa pagina
    vai(new URL(location.href), { scroll: e.state?.scroll ?? 0 });
  });
})();
