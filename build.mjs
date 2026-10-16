#!/usr/bin/env node
// Genera il sito «La via delle ombre» in dist/ partendo da contenuti/.
//
//   node build.mjs              sito per Cloudflare (cartella dist/)
//   node build.mjs --anteprima  copia con link relativi da aprire senza server (cartella anteprima/)
//
// Non servono pacchetti npm: basta Node 20 o più recente.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = path.dirname(fileURLToPath(import.meta.url));
const ANTEPRIMA = process.argv.includes("--anteprima");
const USCITA = path.join(RADICE, ANTEPRIMA ? "anteprima" : "dist");
const CONTENUTI = path.join(RADICE, "contenuti");
const IMMAGINI_TAVOLA = /\.(webp|jpe?g|png|avif)$/i;
const ESCLUSE = new Set(["copertina-540.webp", "og.jpg"]);
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

class ErroreContenuti extends Error {}

// ---------------------------------------------------------------- utilità

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Tiene solo <strong>, <em> e <br> nel testo delle tavole.
const htmlSicuro = (html = "") =>
  String(html)
    .replace(/<(?!\/?(strong|em|b|i|br)\b)[^>]*>/gi, "")
    .replace(/<(\/?)(strong|em|b|i|br)\b[^>]*>/gi, "<$1$2>")
    .replace(/<(\/?)b>/gi, "<$1strong>")
    .replace(/<(\/?)i>/gi, "<$1em>");

const testoPiano = (html = "") =>
  String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const perRicerca = (testo) => {
  const parole = testo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 1);
  return [...new Set(parole)].join(" ");
};

const dataEstesa = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return "";
  return `${Number(m[3])} ${MESI[Number(m[2]) - 1]} ${m[1]}`;
};

const impronta = (dati) => createHash("sha256").update(dati).digest("hex").slice(0, 10);

const ordinaNaturale = (a, b) => a.localeCompare(b, "it", { numeric: true, sensitivity: "base" });

// Indirizzo di una risorsa. Nel sito vero è assoluto ("/caroselli/"),
// nell'anteprima diventa relativo alla pagina e punta a index.html.
const indirizzo = (percorso, pagina) => {
  if (!ANTEPRIMA || /^[a-z]+:/i.test(percorso)) return percorso;
  const [base, frammento] = percorso.split("#");
  const destinazione = base.endsWith("/") ? `${base}index.html` : base;
  const cartella = pagina.endsWith("/") ? pagina : `${path.posix.dirname(pagina)}/`;
  const relativo = path.posix.relative(cartella, destinazione) || "index.html";
  return frammento ? `${relativo}#${frammento}` : relativo;
};

const assoluto = (percorso) => {
  if (/^[a-z]+:/i.test(percorso)) return percorso;
  return sito.url ? `${sito.url.replace(/\/$/, "")}${percorso}` : percorso;
};

async function leggiJson(file) {
  const testo = await readFile(file, "utf8");
  try {
    return JSON.parse(testo);
  } catch (errore) {
    throw new ErroreContenuti(`Il file ${path.relative(RADICE, file)} non è un JSON valido: ${errore.message}`);
  }
}

// ---------------------------------------------------------------- icone (forme generiche)

const icona = {
  sinistra: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  destra: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  intero: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  condividi: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M7.5 7.5L12 3l4.5 4.5M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cerca: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  esterno: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// ---------------------------------------------------------------- contenuti

const sito = await leggiJson(path.join(CONTENUTI, "sito.json"));
const link = sito.link || {};

async function caricaCaroselli() {
  const cartella = path.join(CONTENUTI, "caroselli");
  const voci = (await readdir(cartella, { withFileTypes: true })).filter((v) => v.isDirectory());
  const elenco = [];
  for (const voce of voci) {
    const slug = voce.name;
    const dir = path.join(cartella, slug);
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new ErroreContenuti(`La cartella «${slug}» ha un nome non valido: usa solo lettere minuscole, numeri e trattini.`);
    }
    const file = path.join(dir, "carosello.json");
    if (!existsSync(file)) {
      console.warn(`Salto la cartella ${slug}: manca carosello.json`);
      continue;
    }
    const c = await leggiJson(file);
    if (!c.titolo) throw new ErroreContenuti(`Nel carosello «${slug}» manca il titolo.`);
    const file_immagini = (await readdir(dir)).filter((f) => IMMAGINI_TAVOLA.test(f) && !ESCLUSE.has(f)).sort(ordinaNaturale);
    let tavole = Array.isArray(c.tavole) && c.tavole.length ? c.tavole : file_immagini.map((immagine) => ({ immagine }));
    if (!tavole.length) throw new ErroreContenuti(`Nel carosello «${slug}» non ci sono immagini.`);
    tavole = tavole.map((t, i) => {
      if (!t.immagine || !existsSync(path.join(dir, t.immagine))) {
        throw new ErroreContenuti(`Nel carosello «${slug}» manca l'immagine ${t.immagine || `della tavola ${i + 1}`}.`);
      }
      return { ...t, titolo: (i === 0 ? t.titolo || c.titolo : t.titolo) || `Tavola ${i + 1}`, blocchi: t.blocchi || [] };
    });
    if (c.data && !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(c.data)) {
      console.warn(`Nel carosello «${slug}» la data «${c.data}» non è nel formato AAAA-MM-GG (o AAAA-MM-GGTHH:MM): la ignoro.`);
      c.data = "";
    }
    const copertina = existsSync(path.join(dir, "copertina-540.webp")) ? "copertina-540.webp" : tavole[0].immagine;
    const og = existsSync(path.join(dir, "og.jpg")) ? "og.jpg" : tavole[0].immagine;
    const testi = [c.titolo, c.sottotitolo, c.descrizione, ...tavole.flatMap((t) => [t.titolo, ...t.blocchi.map((b) => testoPiano(b.html ?? esc(b.testo ?? "")))])];
    elenco.push({ ...c, slug, dir, tavole, copertina, og, ricerca: perRicerca(testi.filter(Boolean).join(" ")) });
  }
  elenco.sort((a, b) => (b.data || "").localeCompare(a.data || "") || ordinaNaturale(a.titolo, b.titolo));
  return elenco;
}

// ---------------------------------------------------------------- impaginazione comune

function testata(pagina, attiva) {
  const voce = (href, nome, chiave) =>
    `<a href="${indirizzo(href, pagina)}"${attiva === chiave ? ' aria-current="page"' : ""}>${nome}</a>`;
  return `<a class="salta" href="#contenuto">Vai al contenuto</a>
<header class="testata">
  <a class="testata-logo" href="${indirizzo("/", pagina)}" aria-label="${esc(sito.nome)}, pagina iniziale"><img src="${indirizzo(media.logoPiccolo, pagina)}" width="160" height="110" alt=""></a>
  <nav aria-label="Principale">${voce("/caroselli/", "Caroselli", "caroselli")}${voce("/#musica", "Musica", "musica")}${voce("/gioco/", "Gioco", "gioco")}</nav>
</header>`;
}

function piede(pagina) {
  const canali = [
    ["Instagram", link.instagram],
    ["YouTube", link.youtube],
    ["Spotify", link.spotify],
    ["Telegram", link.telegram],
  ].filter(([, url]) => url);
  return `<footer class="piede">
  <div class="via via-fine" style="--pos: 90%" aria-hidden="true"></div>
  <div class="colonna piede-corpo">
    <img src="${indirizzo(media.logoPiccolo, pagina)}" width="160" height="110" alt="TAUH" loading="lazy">
    <nav aria-label="Canali di TAUH">${canali.map(([nome, url]) => `<a href="${esc(url)}" rel="me noopener">${nome}</a>`).join("")}</nav>
    <p class="firma">TAUH · la via delle ombre</p>
  </div>
</footer>`;
}

function documento({ pagina, titolo, descrizione, immagine, larghezzaImmagine, altezzaImmagine, tipo = "website", attiva = "", corpo, extraTesta = "" }) {
  if (ANTEPRIMA && pagina === "/") {
    // Nell'anteprima pubblicata come artifact la pagina iniziale riceve già doctype e <head>.
    return `<title>${esc(sito.nome)}</title>
<link rel="stylesheet" href="${indirizzo(risorse.css, pagina)}">
<script type="module" src="${indirizzo(risorse.js, pagina)}"></script>
${testata(pagina, attiva)}
${corpo}
${piede(pagina)}
`;
  }
  const titoloCompleto = titolo ? `${titolo} – ${sito.nome}` : `${sito.nome} – ${sito.artista}`;
  const canonico = sito.url && !ANTEPRIMA ? `<link rel="canonical" href="${esc(assoluto(pagina))}">\n` : "";
  const og = immagine
    ? `<meta property="og:image" content="${esc(assoluto(immagine))}">\n${larghezzaImmagine ? `<meta property="og:image:width" content="${larghezzaImmagine}">\n<meta property="og:image:height" content="${altezzaImmagine}">\n` : ""}`
    : "";
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titoloCompleto)}</title>
<meta name="description" content="${esc(descrizione)}">
${canonico}<meta name="theme-color" content="#000000">
<meta property="og:type" content="${tipo}">
<meta property="og:site_name" content="${esc(sito.nome)}">
<meta property="og:locale" content="it_IT">
<meta property="og:title" content="${esc(titolo || sito.nome)}">
<meta property="og:description" content="${esc(descrizione)}">
${sito.url && !ANTEPRIMA ? `<meta property="og:url" content="${esc(assoluto(pagina))}">\n` : ""}${og}<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${indirizzo("/favicon.ico", pagina)}" sizes="48x48">
<link rel="icon" type="image/png" sizes="32x32" href="${indirizzo("/img/favicon-32.png", pagina)}">
<link rel="apple-touch-icon" href="${indirizzo("/img/apple-touch-icon.png", pagina)}">
<link rel="preload" href="${indirizzo("/assets/font/cinzel-var.woff", pagina)}" as="font" type="font/woff" crossorigin>
<link rel="preload" href="${indirizzo("/assets/font/montserrat-var.woff", pagina)}" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="${indirizzo(risorse.css, pagina)}">
<script type="module" src="${indirizzo(risorse.js, pagina)}"></script>
${extraTesta}</head>
<body>
${testata(pagina, attiva)}
${corpo}
${piede(pagina)}
</body>
</html>
`;
}

// ---------------------------------------------------------------- pezzi riutilizzabili

const scheda = (c, pagina, { lazy = true } = {}) => `<a class="scheda" href="${indirizzo(`/caroselli/${c.slug}/`, pagina)}">
  <img src="${indirizzo(fileMedia(c, c.copertina), pagina)}" width="540" height="675" alt="" ${lazy ? 'loading="lazy" ' : ""}decoding="async">
  <span class="scheda-titolo">${esc(c.titolo)}</span>
  <span class="scheda-meta">${c.tavole.length} tavole${c.data ? `, ${dataEstesa(c.data)}` : ""}</span>
</a>`;

const sigillo = (pagina) => `<div class="sigillo">
  <svg class="sigillo-anello" viewBox="0 0 400 400" aria-hidden="true">
    <defs><path id="giro-sigillo" d="M 200 200 m -161 0 a 161 161 0 1 1 322 0 a 161 161 0 1 1 -322 0"/></defs>
    <circle cx="200" cy="200" r="196" fill="rgba(0,0,0,0.38)" stroke="#CFFE7E" stroke-width="2.6"/>
    <circle cx="200" cy="200" r="144" fill="none" stroke="#CFFE7E" stroke-width="2.6"/>
    <text font-size="25" fill="#CFFE7E"><textPath href="#giro-sigillo" textLength="1006" lengthAdjust="spacing">NON SERVIAM · LUX IN TENEBRIS · LUCIFER ·</textPath></text>
  </svg>
  <img class="sigillo-logo" src="${indirizzo(media.logoGrande, pagina)}" width="612" height="420" alt="TAUH">
</div>`;

function blocchiTavola(t, indice) {
  return t.blocchi
    .filter((b) => b.tipo !== "titolo")
    .map((b) => {
      const html = b.html != null ? htmlSicuro(b.html) : esc(b.testo || "");
      if (!testoPiano(html)) return "";
      const classe = { box: "box", domanda: "domanda", nota: "nota" }[b.tipo] || "";
      return `<p${classe ? ` class="${classe}"` : ""}>${html}</p>`;
    })
    .join("\n      ");
}

// ---------------------------------------------------------------- pagine

function paginaHome(caroselli) {
  const pagina = "/";
  const quanti = Math.max(1, Number(sito.caroselli?.in_home) || 8);
  const recenti = caroselli.slice(0, quanti);
  const totaleTavole = caroselli.reduce((s, c) => s + c.tavole.length, 0);
  const musica = sito.musica || {};
  const gioco = sito.gioco || {};
  const tg = sito.telegram || {};
  const lettoreSpotify = ANTEPRIMA && musica.spotify_artista && link.spotify
    ? `<div class="lettore">
        <h3>TAUH su Spotify</h3>
        <p>In questa anteprima il player di Spotify non si può caricare. Sul sito online compare qui, dopo aver premuto il bottone.</p>
        <a class="bottone primario" href="${esc(link.spotify)}">Apri Spotify</a>
      </div>`
    : musica.spotify_artista
    ? `<div class="lettore" data-incorpora="https://open.spotify.com/embed/artist/${esc(musica.spotify_artista)}?utm_source=generator&amp;theme=0" data-altezza="352" data-titolo="TAUH su Spotify">
        <h3>TAUH su Spotify</h3>
        <p>Il player arriva dai server di Spotify e si carica solo quando lo attivi: da quel momento Spotify può usare i suoi cookie.</p>
        <button type="button" class="bottone primario">Carica il player</button>
      </div>`
    : "";
  const lettoreYoutube = musica.youtube_video
    ? `<div class="lettore" data-incorpora="https://www.youtube-nocookie.com/embed/${esc(musica.youtube_video)}" data-altezza="360" data-titolo="Video di TAUH su YouTube">
        <h3>Il video</h3>
        <p>Il video arriva da YouTube e si carica solo quando lo attivi.</p>
        <button type="button" class="bottone primario">Carica il video</button>
      </div>`
    : "";
  const canaliMusica = [
    link.spotify && `<li><a href="${esc(link.spotify)}" rel="me noopener">Spotify <small>Ascolta i brani</small></a></li>`,
    link.youtube && `<li><a href="${esc(link.youtube)}" rel="me noopener">YouTube <small>Guarda i video</small></a></li>`,
  ].filter(Boolean);
  const giocoTesto = gioco.disponibile
    ? `<a class="bottone primario" href="${indirizzo("/gioco/", pagina)}">Gioca ora</a>`
    : `<a class="bottone" href="${indirizzo("/gioco/", pagina)}">Scopri il gioco</a>`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    name: sito.artista,
    ...(sito.url ? { url: sito.url } : {}),
    sameAs: Object.values(link).filter(Boolean),
  };

  const corpo = `<main id="contenuto">
  <section class="apertura" aria-labelledby="titolo-apertura">
    <picture class="apertura-tavola">
      <source type="image/webp" srcset="${indirizzo(media.apertura900, pagina)} 900w, ${indirizzo(media.apertura1620, pagina)} 1620w" sizes="(min-width: 900px) 50rem, 100vw">
      <img src="${indirizzo(media.apertura900, pagina)}" width="900" height="1125" alt="" fetchpriority="high">
    </picture>
    ${sigillo(pagina)}
    <h1 id="titolo-apertura">${esc(sito.apertura?.titolo || sito.nome)}</h1>
    ${sito.apertura?.motto ? `<p class="motto">${esc(sito.apertura.motto)}</p>` : ""}
    ${sito.apertura?.testo ? `<p class="apertura-testo">${esc(sito.apertura.testo)}</p>` : ""}
    <div class="azioni">
      <a class="bottone primario" href="${indirizzo("/caroselli/", pagina)}">Sfoglia i caroselli</a>
      <a class="bottone" href="${indirizzo("/#musica", pagina)}">Ascolta</a>
    </div>
  </section>

  <section class="sezione" id="caroselli" aria-labelledby="titolo-caroselli" data-binario>
    <div class="via" style="--pos: 12%" aria-hidden="true"></div>
    <div class="colonna sezione-testa">
      <div>
        <h2 id="titolo-caroselli">Caroselli</h2>
        <p>${esc(sito.caroselli?.testo || "")}</p>
      </div>
      <div class="frecce">
        <button class="freccia" type="button" data-binario-indietro aria-label="Copertine precedenti">${icona.sinistra}</button>
        <button class="freccia" type="button" data-binario-avanti aria-label="Altre copertine">${icona.destra}</button>
      </div>
    </div>
    <ul class="binario" role="list">
      ${recenti.map((c, i) => `<li>${scheda(c, pagina, { lazy: i > 2 })}</li>`).join("\n      ")}
    </ul>
    <div class="colonna sezione-piede">
      <a class="bottone filo" href="${indirizzo("/caroselli/", pagina)}">Tutti i ${caroselli.length} caroselli, ${totaleTavole} tavole</a>
    </div>
  </section>

  <section class="sezione" id="musica" aria-labelledby="titolo-musica">
    <div class="via" style="--pos: 38%" aria-hidden="true"></div>
    <div class="colonna musica">
      <div>
        <h2 id="titolo-musica">Ascolta</h2>
        <p>${esc(musica.testo || "")}</p>
        <ul class="canali" role="list">
          ${canaliMusica.join("\n          ")}
        </ul>
      </div>
      <div>
      ${lettoreSpotify}
      ${lettoreYoutube}
      </div>
    </div>
  </section>

  <section class="sezione" id="gioco" aria-labelledby="titolo-gioco">
    <div class="via" style="--pos: 64%" aria-hidden="true"></div>
    <div class="colonna">
      <div class="gioco-invito">
        <picture>
          <source type="image/webp" srcset="${indirizzo(media.gioco600, pagina)} 600w, ${indirizzo(media.gioco1080, pagina)} 1080w" sizes="(min-width: 800px) 36rem, 100vw">
          <img src="${indirizzo(media.gioco600, pagina)}" width="600" height="750" alt="" loading="lazy" decoding="async">
        </picture>
        <div class="gioco-invito-testo">
          ${gioco.disponibile ? "" : '<span class="stato">In arrivo</span>'}
          <h2 id="titolo-gioco">${esc(gioco.titolo || "Il gioco")}</h2>
          <p>${esc(gioco.testo || "")}</p>
          ${giocoTesto}
        </div>
      </div>
    </div>
  </section>

  ${link.telegram ? `<section class="sezione" id="telegram" aria-labelledby="titolo-telegram">
    <div class="via" style="--pos: 88%" aria-hidden="true"></div>
    <div class="colonna">
      <div class="riquadro">
        <h2 id="titolo-telegram">${esc(tg.titolo || "Il canale Telegram")}</h2>
        <p>${esc(tg.testo || "")}</p>
        <div class="azioni">
          <a class="bottone primario" href="${esc(link.telegram)}" rel="me noopener">Entra nel canale</a>
          ${link.instagram ? `<a class="bottone filo" href="${esc(link.instagram)}" rel="me noopener">Segui TAUH su Instagram</a>` : ""}
        </div>
      </div>
    </div>
  </section>` : ""}
</main>`;

  return documento({
    pagina,
    titolo: "",
    descrizione: sito.descrizione,
    immagine: media.ogHome,
    larghezzaImmagine: 1200,
    altezzaImmagine: 630,
    attiva: "home",
    corpo,
    extraTesta: `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n`,
  });
}

function paginaArchivio(caroselli) {
  const pagina = "/caroselli/";
  const totaleTavole = caroselli.reduce((s, c) => s + c.tavole.length, 0);
  const esito = `${caroselli.length} caroselli, dal più recente`;
  const corpo = `<main id="contenuto" class="colonna">
  <header class="archivio-testa">
    <h1>Caroselli</h1>
    <p>${caroselli.length} caroselli e ${totaleTavole} tavole. Si sfogliano come su Instagram e accanto c'è il testo di ogni tavola.</p>
    <div class="cerca">
      <label class="nascosto" for="cerca">Cerca nei caroselli</label>
      ${icona.cerca}
      <input id="cerca" type="search" placeholder="Cerca: Samael, golem, dogma…" autocomplete="off" data-cerca>
    </div>
    <p class="esito" data-esito aria-live="polite">${esito}</p>
  </header>
  <ul class="griglia" role="list">
    ${caroselli.map((c, i) => `<li data-testo="${esc(c.ricerca)}">${scheda(c, pagina, { lazy: i > 3 })}</li>`).join("\n    ")}
  </ul>
  <p class="vuoto" data-vuoto hidden>Nessun carosello parla di «<span data-parola></span>». Prova con un'altra parola.</p>
</main>`;
  return documento({
    pagina,
    titolo: "Caroselli",
    descrizione: `Tutti i ${caroselli.length} caroselli di TAUH, da sfogliare tavola per tavola e da leggere.`,
    immagine: caroselli[0] ? fileMedia(caroselli[0], caroselli[0].og) : media.ogHome,
    attiva: "caroselli",
    corpo,
  });
}

function paginaCarosello(c, indice, caroselli) {
  const pagina = `/caroselli/${c.slug}/`;
  const n = c.tavole.length;
  const precedente = caroselli[indice + 1];
  const successivo = caroselli[indice - 1];
  const haTesto = c.tavole.some((t) => t.blocchi.length);
  const vicino = (altro, etichetta) =>
    altro
      ? `<a class="vicino" href="${indirizzo(`/caroselli/${altro.slug}/`, pagina)}">
      <img src="${indirizzo(fileMedia(altro, altro.copertina), pagina)}" width="540" height="675" alt="" loading="lazy" decoding="async">
      <span><small>${etichetta}</small><strong>${esc(altro.titolo)}</strong></span>
    </a>`
      : "";
  const corpo = `<main id="contenuto" class="colonna carosello">
  <a class="indietro" href="${indirizzo("/caroselli/", pagina)}">${icona.sinistra}Tutti i caroselli</a>
  <header class="carosello-testa">
    <h1>${esc(c.titolo)}</h1>
    ${c.sottotitolo ? `<p class="sottotitolo">${esc(c.sottotitolo)}</p>` : ""}
    <p class="data">${n} tavole${c.data ? `, ${dataEstesa(c.data)}` : ""}</p>
  </header>

  <div class="visore" data-visore>
    <div class="visore-pista" tabindex="0" role="region" aria-roledescription="carosello" aria-label="Tavole di ${esc(c.titolo)}: scorri o usa le frecce">
      ${c.tavole
        .map(
          (t, i) => `<figure class="tavola" id="tavola-${i + 1}" aria-label="Tavola ${i + 1} di ${n}">
        <img src="${indirizzo(fileMedia(c, t.immagine), pagina)}" width="1080" height="1350" alt="Tavola ${i + 1} di ${n}: ${esc(t.titolo)}"${i === 0 ? ' fetchpriority="high"' : i > 1 ? ' loading="lazy"' : ""} decoding="async">
      </figure>`,
        )
        .join("\n      ")}
    </div>
    <div class="visore-comandi">
      <button class="freccia" type="button" data-indietro aria-label="Tavola precedente">${icona.sinistra}</button>
      <div class="via" data-avanzamento style="--pos: 0%" aria-hidden="true"></div>
      <span class="contatore" data-contatore aria-live="polite">1/${n}</span>
      <button class="freccia" type="button" data-avanti aria-label="Tavola successiva">${icona.destra}</button>
    </div>
    <div class="visore-azioni">
      <button class="bottone filo" type="button" data-schermo-intero>${icona.intero}<span>Schermo intero</span></button>
      <button class="bottone filo" type="button" data-condividi>${icona.condividi}<span>Condividi</span></button>
      ${c.instagram ? `<a class="bottone filo" href="${esc(c.instagram)}" rel="noopener">${icona.esterno}<span>Su Instagram</span></a>` : ""}
    </div>
  </div>

  ${haTesto ? `<section class="testo-tavole" data-pannello aria-labelledby="titolo-testo">
    <h2 id="titolo-testo">Il testo, tavola per tavola</h2>
    ${c.tavole
      .map(
        (t, i) => `<article class="testo-tavola" data-testo-tavola id="testo-${i + 1}">
      <h3><button type="button" data-vai="${i + 1}" aria-label="Mostra la tavola ${i + 1}: ${esc(t.titolo)}"><span class="numero">${i + 1}</span><span>${esc(t.titolo)}</span></button></h3>
      ${blocchiTavola(t, i)}
    </article>`,
      )
      .join("\n    ")}
  </section>` : ""}

  ${precedente || successivo ? `<nav class="vicini" aria-label="Altri caroselli">
    ${vicino(precedente, "Carosello precedente")}
    ${vicino(successivo, "Carosello successivo")}
  </nav>` : ""}
</main>`;
  return documento({
    pagina,
    titolo: c.titolo,
    descrizione: c.descrizione || c.sottotitolo || `Il carosello «${c.titolo}» di TAUH, in ${n} tavole.`,
    immagine: fileMedia(c, c.og),
    tipo: "article",
    attiva: "caroselli",
    corpo,
  });
}

function paginaGioco() {
  const pagina = "/gioco/";
  const g = sito.gioco || {};
  const titolo = g.titolo || "Il gioco";
  const corpo = g.disponibile
    ? `<main id="contenuto" class="colonna gioco">
  <header class="carosello-testa">
    <h1>${esc(titolo)}</h1>
    ${g.testo ? `<p>${esc(g.testo)}</p>` : ""}
  </header>
  <div class="cornice" data-cornice style="--proporzioni: ${esc(g.proporzioni || "16 / 9")}">
    <iframe src="${indirizzo(g.percorso || "/gioco/play/", pagina)}" title="${esc(titolo)}" allow="fullscreen; autoplay; gamepad" allowfullscreen></iframe>
  </div>
  <div class="azioni">
    <button class="bottone primario" type="button" data-gioco-intero>${icona.intero}Gioca a schermo intero</button>
    <a class="bottone filo" href="${indirizzo(g.percorso || "/gioco/play/", pagina)}">Apri il gioco da solo</a>
  </div>
</main>`
    : `<main id="contenuto" class="scena">
  <picture>
    <source type="image/webp" srcset="${indirizzo(media.gioco600, pagina)} 600w, ${indirizzo(media.gioco1080, pagina)} 1080w" sizes="100vw">
    <img src="${indirizzo(media.gioco1080, pagina)}" width="1080" height="1350" alt="" fetchpriority="high">
  </picture>
  <div class="scena-testo">
    <span class="stato">In arrivo</span>
    <h1>${esc(titolo)}</h1>
    ${g.testo ? `<p>${esc(g.testo)}</p>` : ""}
    ${g.in_arrivo ? `<p>${esc(g.in_arrivo)}</p>` : ""}
    <div class="azioni">
      ${link.telegram ? `<a class="bottone primario" href="${esc(link.telegram)}" rel="me noopener">Entra nel canale Telegram</a>` : ""}
      <a class="bottone filo" href="${indirizzo("/caroselli/", pagina)}">Intanto sfoglia i caroselli</a>
    </div>
  </div>
</main>`;
  return documento({
    pagina,
    titolo,
    descrizione: g.testo || `${titolo} di TAUH, da giocare nel browser.`,
    immagine: media.ogHome,
    larghezzaImmagine: 1200,
    altezzaImmagine: 630,
    attiva: "gioco",
    corpo,
  });
}

function pagina404() {
  const pagina = "/404.html";
  const corpo = `<main id="contenuto" class="scena">
  <picture>
    <img src="${indirizzo(media.soglia, pagina)}" width="900" height="1125" alt="">
  </picture>
  <div class="scena-testo">
    <h1>Questa via non porta da nessuna parte</h1>
    <p>La pagina che cerchi non c'è, oppure ha cambiato indirizzo.</p>
    <div class="azioni">
      <a class="bottone primario" href="${indirizzo("/", pagina)}">Torna all'inizio</a>
      <a class="bottone filo" href="${indirizzo("/caroselli/", pagina)}">Vai ai caroselli</a>
    </div>
  </div>
</main>`;
  return documento({ pagina, titolo: "Pagina non trovata", descrizione: "Questa pagina non esiste.", immagine: media.ogHome, corpo });
}

// ---------------------------------------------------------------- risorse e scrittura

const media = {};
const risorse = {};
const impronte = new Map();

const fileMedia = (c, nome) => `/media/caroselli/${c.slug}/${nome}?v=${impronte.get(path.join(c.dir, nome))}`;

async function versioneImg(nome) {
  const dati = await readFile(path.join(RADICE, "src", "img", nome));
  return `/img/${nome}?v=${impronta(dati)}`;
}

async function scrivi(percorsoPagina, html) {
  const relativo = percorsoPagina.endsWith("/") ? `${percorsoPagina}index.html` : percorsoPagina;
  const destinazione = path.join(USCITA, relativo);
  await mkdir(path.dirname(destinazione), { recursive: true });
  await writeFile(destinazione, html);
}

async function principale() {
  const caroselli = await caricaCaroselli();

  await rm(USCITA, { recursive: true, force: true });
  await mkdir(path.join(USCITA, "assets"), { recursive: true });

  // file statici, immagini del sito e caratteri
  await cp(path.join(RADICE, "static"), USCITA, { recursive: true });
  await cp(path.join(RADICE, "src", "img"), path.join(USCITA, "img"), { recursive: true });
  await cp(path.join(RADICE, "src", "font"), path.join(USCITA, "assets", "font"), { recursive: true });

  // foglio di stile e script con l'impronta nel nome, così la cache si aggiorna da sola
  for (const [chiave, nome] of [["css", "stile.css"], ["js", "app.js"]]) {
    const dati = await readFile(path.join(RADICE, "src", nome));
    const [base, est] = nome.split(".");
    const finale = `${base}-${impronta(dati)}.${est}`;
    await writeFile(path.join(USCITA, "assets", finale), dati);
    risorse[chiave] = `/assets/${finale}`;
  }

  Object.assign(media, {
    logoPiccolo: await versioneImg("logo-tauh-160.webp"),
    logoGrande: await versioneImg("logo-tauh-612.webp"),
    apertura900: await versioneImg("apertura-900.webp"),
    apertura1620: await versioneImg("apertura-1620.webp"),
    gioco600: await versioneImg("gioco-600.webp"),
    gioco1080: await versioneImg("gioco-1080.webp"),
    soglia: await versioneImg("soglia-900.webp"),
    ogHome: await versioneImg("og-home.jpg"),
  });

  // immagini dei caroselli
  for (const c of caroselli) {
    const dest = path.join(USCITA, "media", "caroselli", c.slug);
    await mkdir(dest, { recursive: true });
    const nomi = new Set([...c.tavole.map((t) => t.immagine), c.copertina, c.og]);
    for (const nome of nomi) {
      const dati = await readFile(path.join(c.dir, nome));
      impronte.set(path.join(c.dir, nome), impronta(dati));
      await writeFile(path.join(dest, nome), dati);
    }
  }

  const pagine = [
    ["/", paginaHome(caroselli)],
    ["/caroselli/", paginaArchivio(caroselli)],
    ...caroselli.map((c, i) => [`/caroselli/${c.slug}/`, paginaCarosello(c, i, caroselli)]),
    ["/gioco/", paginaGioco()],
    ["/404.html", pagina404()],
  ];
  for (const [percorso, html] of pagine) await scrivi(percorso, html);

  // sitemap e robots
  const robots = ["User-agent: *", "Allow: /"];
  if (sito.url && !ANTEPRIMA) {
    const indirizzi = pagine.map(([p]) => p).filter((p) => p !== "/404.html");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indirizzi.map((p) => `  <url><loc>${esc(assoluto(p))}</loc></url>`).join("\n")}
</urlset>
`;
    await writeFile(path.join(USCITA, "sitemap.xml"), xml);
    robots.push(`Sitemap: ${assoluto("/sitemap.xml")}`);
  }
  await writeFile(path.join(USCITA, "robots.txt"), `${robots.join("\n")}\n`);

  const tavole = caroselli.reduce((s, c) => s + c.tavole.length, 0);
  console.log(`Sito generato in ${path.relative(RADICE, USCITA)}/: ${pagine.length} pagine, ${caroselli.length} caroselli, ${tavole} tavole.`);
  if (!sito.url) console.log("Nota: in contenuti/sito.json manca «url». Inseriscilo quando il sito è online, per le anteprime dei link.");
}

try {
  await principale();
} catch (errore) {
  if (errore instanceof ErroreContenuti) {
    console.error(`\nErrore nei contenuti: ${errore.message}\n`);
    process.exit(1);
  }
  throw errore;
}
