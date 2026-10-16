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
      sessionStorage.setItem(CHIAVE, JSON.stringify({ i: indice, t: Math.round(posizione() * 10) / 10, a: attivo }));
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
    titolo.textContent = b.titolo;
    if (copertina && b.copertina && copertina.src !== b.copertina) copertina.src = b.copertina;
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
  const prossimo = () => avvia(indice + 1);

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
      previoustrack: () => (posizione() > 3 ? vaiA(0) : avvia(indice - 1)),
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

  try {
    const s = JSON.parse(sessionStorage.getItem(CHIAVE) || "null");
    if (s?.a && Number.isInteger(s.i) && brani[s.i]) {
      attivo = true;
      carica(s.i, Math.max(0, Number(s.t) || 0));
    }
  } catch {
    /* niente da recuperare */
  }
  window.addEventListener("pagehide", () => salva());
  window.addEventListener("pageshow", aggiorna);
  aggiorna();

  return {
    avvia,
    pausa,
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
  window.matchMedia("(min-width: 860px)").addEventListener("change", (e) => e.matches && apri(false), { signal });
}

// ---------------------------------------------------------------- player esterni
// Spotify e YouTube si caricano solo quando la persona preme il bottone.

function incorporati(signal) {
  for (const box of $$("[data-incorpora]")) {
    const bottone = $("button", box);
    if (!bottone) continue;
    bottone.addEventListener(
      "click",
      () => {
        lettore?.pausa();
        const frame = document.createElement("iframe");
        frame.src = box.dataset.incorpora;
        frame.title = box.dataset.titolo || "Player";
        frame.height = box.dataset.altezza || "352";
        frame.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        box.replaceChildren(frame);
        box.classList.add("caricato");
      },
      { signal },
    );
  }
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

  const vai = (i, liscio = true) => {
    const n = Math.max(0, Math.min(totale - 1, i));
    pista.scrollTo({ left: tavole[n].offsetLeft, behavior: liscio && !riduci.matches ? "smooth" : "auto" });
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
        const i = Math.round(pista.scrollLeft / pista.clientWidth);
        mostra(Math.max(0, Math.min(totale - 1, i)));
      });
    },
    { passive: true, signal },
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
    else if (visibili === 1) esito.textContent = `1 carosello su ${schede.length}`;
    else esito.textContent = `${visibili} caroselli su ${schede.length}`;
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

// ---------------------------------------------------------------- elenco dei brani nella home

function elencoBrani(signal) {
  const bottoni = $$("[data-brano]");
  if (!bottoni.length || !lettore) return;
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

// ---------------------------------------------------------------- avvio delle parti

let spegniPagina = null;

function avviaPagina() {
  spegniPagina?.abort();
  spegniPagina = new AbortController();
  for (const parte of [menu, incorporati, binari, visore, ricerca, gioco, galleria, elencoBrani]) {
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
