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
    barra.classList.toggle("attivo", attivo);
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
    if (!trascinando) return;
    trascinando = false;
    vaiA(frazione(e) * durata());
  });
  via.addEventListener("pointercancel", () => {
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
  document.addEventListener("click", (e) => aperto() && !testata.contains(e.target) && apri(false), { signal });
  // lo stesso punto del CSS (@media max-width: 69.9375em)
  window.matchMedia("(min-width: 70em)").addEventListener("change", (e) => e.matches && apri(false), { signal });
}

// ---------------------------------------------------------------- player esterni
// Spotify e YouTube si caricano solo quando la persona preme il bottone.

// Un player alla volta: aprendo Spotify (o YouTube) il lettore del sito si ferma e si
// chiude; se poi riparte la musica del sito, il player esterno torna al suo bottone.
function incorporati(signal) {
  const aperti = new Map();
  for (const box of $$("[data-incorpora]")) {
    const bottone = $("button", box);
    if (!bottone) continue;
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
  }
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
    const passo = () => Math.max(fila.clientWidth * 0.8, 200);
    const aggiorna = () => {
      indietro.disabled = fila.scrollLeft < 4;
      avanti.disabled = fila.scrollLeft + fila.clientWidth > fila.scrollWidth - 4;
    };
    indietro.addEventListener("click", () => fila.scrollBy({ left: -passo(), behavior: "smooth" }), { signal });
    avanti.addEventListener("click", () => fila.scrollBy({ left: passo(), behavior: "smooth" }), { signal });
    fila.addEventListener("scroll", aggiorna, { passive: true, signal });
    window.addEventListener("resize", aggiorna, { signal });
    aggiorna();
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

  const mostra = (i) => {
    if (i === attuale) return;
    const primaVolta = attuale === -1;
    attuale = i;
    contatore.textContent = `${i + 1}/${totale}`;
    avanzamento.style.setProperty("--pos", totale > 1 ? `${(i / (totale - 1)) * 100}%` : "0%");
    indietro.disabled = i === 0;
    avanti.disabled = i === totale - 1;
    tavole.forEach((t, k) => t.setAttribute("aria-hidden", k === i ? "false" : "true"));
    testi.forEach((t, k) => t.classList.toggle("attuale", k === i));
    if (!primaVolta && largo.matches && testi[i] && !document.fullscreenElement) {
      testi[i].scrollIntoView({ block: "nearest", behavior: riduci.matches ? "auto" : "smooth" });
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
    mostra(n);
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

  const tasti = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowRight") vai(attuale + 1);
    else if (e.key === "ArrowLeft") vai(attuale - 1);
    else if (e.key === "Home") vai(0);
    else if (e.key === "End") vai(totale - 1);
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

function galleria(signal) {
  const finestra = $("[data-lightbox]");
  const voci = $$("[data-opera]");
  if (!finestra || !voci.length || typeof finestra.showModal !== "function") return;
  const img = $("[data-lightbox-img]", finestra);
  const quadro = img.closest("figure") || img;
  const didascalia = $("[data-lightbox-titolo]", finestra);
  const scarica = $("[data-lightbox-scarica]", finestra);
  const indietro = $("[data-lightbox-indietro]", finestra);
  const avanti = $("[data-lightbox-avanti]", finestra);
  const chiudi = $("[data-lightbox-chiudi]", finestra);
  const unica = voci.length < 2;
  let attuale = 0;

  indietro.hidden = unica;
  avanti.hidden = unica;

  const mostra = (i) => {
    attuale = (i + voci.length) % voci.length;
    const v = voci[attuale].dataset;
    img.src = v.grande;
    img.alt = v.titolo;
    didascalia.textContent = v.titolo;
    scarica.href = v.file;
    scarica.setAttribute("download", v.nome);
    for (const k of [attuale - 1, attuale + 1]) {
      const vicina = new Image();
      vicina.src = voci[(k + voci.length) % voci.length].dataset.grande;
    }
  };

  voci.forEach((v, i) =>
    v.addEventListener(
      "click",
      () => {
        mostra(i);
        finestra.showModal();
        chiudi.focus();
      },
      { signal },
    ),
  );
  indietro.addEventListener("click", () => mostra(attuale - 1), { signal });
  avanti.addEventListener("click", () => mostra(attuale + 1), { signal });
  chiudi.addEventListener("click", () => finestra.close(), { signal });
  finestra.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "ArrowRight" && !unica) mostra(attuale + 1);
      else if (e.key === "ArrowLeft" && !unica) mostra(attuale - 1);
      else return;
      e.preventDefault();
    },
    { signal },
  );
  // un tocco fuori dal riquadro chiude
  finestra.addEventListener(
    "click",
    (e) => {
      if (e.target !== finestra) return;
      const r = finestra.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) finestra.close();
    },
    { signal },
  );
  // sul telefono si scorre col dito
  let x0 = null;
  let y0 = 0;
  quadro.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "mouse") return;
      x0 = e.clientX;
      y0 = e.clientY;
    },
    { signal },
  );
  quadro.addEventListener(
    "pointerup",
    (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;
      x0 = null;
      if (!unica && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) mostra(attuale + (dx < 0 ? 1 : -1));
    },
    { signal },
  );
  quadro.addEventListener("pointercancel", () => (x0 = null), { signal });
  signal.addEventListener("abort", () => finestra.open && finestra.close(), { once: true });
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
// è piena, il resto è spento (--via-fatto).

function via(signal) {
  const percorso = $("[data-via]");
  if (!percorso) return;
  const tappe = $$("[data-tappa]", percorso);
  let attesa = 0;
  const aggiorna = () => {
    attesa = 0;
    const r = percorso.getBoundingClientRect();
    const meta = window.innerHeight * 0.5;
    percorso.style.setProperty("--via-fatto", `${Math.round(Math.max(0, Math.min(r.height, meta - r.top)))}px`);
    for (const t of tappe) t.classList.toggle("accesa", t.getBoundingClientRect().top < meta);
  };
  const chiedi = () => {
    if (!attesa) attesa = requestAnimationFrame(aggiorna);
  };
  window.addEventListener("scroll", chiedi, { passive: true, signal });
  window.addEventListener("resize", chiedi, { signal });
  signal.addEventListener("abort", () => cancelAnimationFrame(attesa), { once: true });
  percorso.classList.add("in-cammino");
  aggiorna();
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

let spegniPagina = null;

function avviaPagina() {
  spegniPagina?.abort();
  spegniPagina = new AbortController();
  for (const parte of [menu, incorporati, binari, visore, ricerca, gioco, galleria, elencoBrani, uscita, avvisoApp, manifesto, sblocco, striscia, sigilli3d, via, ascoltaSubito, clip]) {
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
      if (nodo.nodeType === 1 && (nodo.matches("[data-lettore]") || nodo.id === "brani-dati")) continue;
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
    const segnale = setTimeout(() => document.documentElement.classList.add("in-viaggio"), 150);
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
