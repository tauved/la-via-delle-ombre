// La via delle ombre — interazioni del sito. Nessuna libreria esterna.

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// ---------------------------------------------------------------- player esterni
// Spotify e YouTube si caricano solo quando la persona preme il bottone.

for (const box of $$("[data-incorpora]")) {
  const bottone = $("button", box);
  if (!bottone) continue;
  bottone.addEventListener("click", () => {
    const frame = document.createElement("iframe");
    frame.src = box.dataset.incorpora;
    frame.title = box.dataset.titolo || "Player";
    frame.height = box.dataset.altezza || "352";
    frame.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    box.replaceChildren(frame);
    box.classList.add("caricato");
  });
}

// ---------------------------------------------------------------- binario delle copertine

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
  indietro.addEventListener("click", () => fila.scrollBy({ left: -passo(), behavior: "smooth" }));
  avanti.addEventListener("click", () => fila.scrollBy({ left: passo(), behavior: "smooth" }));
  fila.addEventListener("scroll", aggiorna, { passive: true });
  window.addEventListener("resize", aggiorna);
  aggiorna();
}

// ---------------------------------------------------------------- visore dei caroselli

const visore = $("[data-visore]");
if (visore) {
  const pista = $(".visore-pista", visore);
  const tavole = $$(".tavola", pista);
  const totale = tavole.length;
  const contatore = $("[data-contatore]", visore);
  const avanzamento = $("[data-avanzamento]", visore);
  const indietro = $("[data-indietro]", visore);
  const avanti = $("[data-avanti]", visore);
  const testi = $$("[data-testo-tavola]");
  const largo = window.matchMedia("(min-width: 1000px)");
  const riduci = window.matchMedia("(prefers-reduced-motion: reduce)");
  let attuale = -1;

  const mostra = (i) => {
    if (i === attuale) return;
    const attualePrecedente = attuale;
    attuale = i;
    contatore.textContent = `${i + 1}/${totale}`;
    avanzamento.style.setProperty("--pos", totale > 1 ? `${(i / (totale - 1)) * 100}%` : "0%");
    indietro.disabled = i === 0;
    avanti.disabled = i === totale - 1;
    tavole.forEach((t, k) => t.setAttribute("aria-hidden", k === i ? "false" : "true"));
    const primaVolta = attualePrecedente === -1;
    testi.forEach((t, k) => t.classList.toggle("attuale", k === i));
    if (!primaVolta && largo.matches && testi[i] && !document.fullscreenElement) {
      testi[i].scrollIntoView({ block: "nearest", behavior: riduci.matches ? "auto" : "smooth" });
    }
    try {
      history.replaceState(null, "", i === 0 ? location.pathname + location.search : `#tavola-${i + 1}`);
    } catch {
      /* alcune viste incorporate non permettono di cambiare l'indirizzo */
    }
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
    { passive: true },
  );

  indietro.addEventListener("click", () => vai(attuale - 1));
  avanti.addEventListener("click", () => vai(attuale + 1));

  const tasti = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowRight") vai(attuale + 1);
    else if (e.key === "ArrowLeft") vai(attuale - 1);
    else if (e.key === "Home") vai(0);
    else if (e.key === "End") vai(totale - 1);
    else return;
    e.preventDefault();
  };
  pista.addEventListener("keydown", tasti);

  for (const b of $$("[data-vai]")) {
    b.addEventListener("click", () => {
      vai(Number(b.dataset.vai) - 1);
      if (!largo.matches) visore.scrollIntoView({ behavior: riduci.matches ? "auto" : "smooth", block: "start" });
    });
  }

  // Schermo intero, dove il browser lo permette.
  const schermo = $("[data-schermo-intero]", visore);
  if (schermo) {
    if (!visore.requestFullscreen) {
      schermo.hidden = true;
    } else {
      const etichetta = $("span", schermo);
      schermo.addEventListener("click", () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else visore.requestFullscreen().catch(() => {});
      });
      document.addEventListener("fullscreenchange", () => {
        const dentro = document.fullscreenElement === visore;
        etichetta.textContent = dentro ? "Esci dallo schermo intero" : "Schermo intero";
        if (dentro) document.addEventListener("keydown", tasti);
        else document.removeEventListener("keydown", tasti);
        requestAnimationFrame(() => vai(attuale, false));
      });
    }
  }

  // Condividi: menu del telefono, oppure copia del link.
  const condividi = $("[data-condividi]", visore);
  if (condividi) {
    const etichetta = $("span", condividi);
    const testoBase = etichetta.textContent;
    condividi.addEventListener("click", async () => {
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
    });
  }

  window.addEventListener("resize", () => vai(attuale, false));

  const iniziale = /^#tavola-(\d+)$/.exec(location.hash);
  if (iniziale) requestAnimationFrame(() => vai(Number(iniziale[1]) - 1, false));
  else mostra(0);
}

// ---------------------------------------------------------------- ricerca nell'archivio

const campo = $("[data-cerca]");
if (campo) {
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
    try {
      history.replaceState(null, "", url);
    } catch {
      /* come sopra */
    }
  };

  campo.addEventListener("input", filtra);
  const iniziale = new URLSearchParams(location.search).get("cerca");
  if (iniziale) {
    campo.value = iniziale;
    filtra();
  }
}

// ---------------------------------------------------------------- gioco
// Su computer il gioco si apre dentro la pagina; su telefono e tablet il link
// porta al gioco a tutta pagina, dove funzionano i comandi touch.

const avvia = $("[data-avvia]");
if (avvia) {
  const schermo = avvia.closest("[data-schermo-gioco]");
  const intero = $("[data-gioco-intero]");
  const dentroPagina = window.matchMedia("(pointer: fine) and (min-width: 900px)");
  avvia.addEventListener("click", (evento) => {
    if (!dentroPagina.matches || !schermo) return;
    evento.preventDefault();
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
  });
}
