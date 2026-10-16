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

// La data di oggi in Italia (AAAA-MM-GG): serve a capire cosa è già uscito quando si genera il sito.
const oggiItalia = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// La chiave con cui il gioco segna nel browser che il primo livello è finito (la legge anche src/app.js).
const CHIAVE_GIOCO = "tauh-incubo-livello-1";

const dataEstesa = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return "";
  return `${Number(m[3])} ${MESI[Number(m[2]) - 1]} ${m[1]}`;
};

const peso = (byte) => {
  if (byte < 1024 * 1024) return `${Math.max(1, Math.round(byte / 1024))} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
};

// Larghezza e altezza di un'immagine JPG, PNG o WebP, lette dall'intestazione del file.
function dimensioniImmagine(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marcatore = buf[i + 1];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marcatore)) {
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return null;
  }
  if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const tipo = buf.toString("ascii", 12, 16);
    if (tipo === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (tipo === "VP8L") {
      const [b0, b1, b2, b3] = [buf[21], buf[22], buf[23], buf[24]];
      return { w: 1 + (((b1 & 0x3f) << 8) | b0), h: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
    }
    if (tipo === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  }
  return null;
}

// Durata in secondi di un MP3: legge l'intestazione Xing/Info scritta dagli encoder,
// altrimenti la stima dal bitrate (vale per i file a bitrate costante).
function durataMp3(buf) {
  let i = 0;
  if (buf.toString("latin1", 0, 3) === "ID3") {
    i = 10 + (((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f));
    if (buf[5] & 0x10) i += 10;
  }
  while (i + 4 < buf.length && !(buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0)) i += 1;
  if (i + 40 >= buf.length) return 0;
  const h = buf.readUInt32BE(i);
  const versione = (h >>> 19) & 3; // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
  const layer = (h >>> 17) & 3; // 1 = Layer III
  const frequenza = [44100, 48000, 32000][(h >>> 10) & 3];
  if (layer !== 1 || !frequenza || versione === 1) return 0;
  const hz = versione === 3 ? frequenza : versione === 2 ? frequenza / 2 : frequenza / 4;
  const campioni = versione === 3 ? 1152 : 576;
  const mono = ((h >>> 6) & 3) === 3;
  const x = i + 4 + (versione === 3 ? (mono ? 17 : 32) : mono ? 9 : 17);
  const etichetta = buf.toString("latin1", x, x + 4);
  if ((etichetta === "Xing" || etichetta === "Info") && buf.readUInt32BE(x + 4) & 1) {
    return (buf.readUInt32BE(x + 8) * campioni) / hz;
  }
  const kbps = (versione === 3 ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160])[(h >>> 12) & 15];
  return kbps ? ((buf.length - i) * 8) / (kbps * 1000) : 0;
}

const minuti = (secondi) => {
  const s = Math.round(secondi);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
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
  gioca: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
  pausa: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
  prossimo: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5.5v13l9-6.5zM16 5.5h2.5v13H16z" fill="currentColor"/></svg>',
  scarica: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10.5l5 5 5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lucchetto: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  menu: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  chiudi: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
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

async function caricaMusica() {
  const file = path.join(CONTENUTI, "musica", "musica.json");
  if (!existsSync(file)) return [];
  const dati = await leggiJson(file);
  return (Array.isArray(dati.brani) ? dati.brani : []).map((b, i) => {
    if (!b.titolo || !b.file) throw new ErroreContenuti(`In contenuti/musica/musica.json il brano ${i + 1} deve avere «titolo» e «file».`);
    const sorgente = path.join(CONTENUTI, "musica", b.file);
    if (!existsSync(sorgente)) throw new ErroreContenuti(`Manca il file contenuti/musica/${b.file}.`);
    if (!/\.mp3$/i.test(b.file)) console.warn(`Il brano «${b.titolo}» non è un MP3: alcuni browser potrebbero non suonarlo.`);
    let copertina = "";
    if (b.copertina) {
      if (existsSync(path.join(CONTENUTI, "musica", b.copertina))) copertina = path.join(CONTENUTI, "musica", b.copertina);
      else console.warn(`Manca la copertina contenuti/musica/${b.copertina}: per «${b.titolo}» uso quella di riserva.`);
    }
    // Col lucchetto: fino a quel giorno si ascolta solo dopo aver finito il primo livello del gioco.
    let bloccata = "";
    if (b.bloccata_fino_al) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.bloccata_fino_al)) {
        throw new ErroreContenuti(`Nel brano «${b.titolo}» la data di «bloccata_fino_al» deve essere nel formato AAAA-MM-GG.`);
      }
      if (b.bloccata_fino_al > oggiItalia()) bloccata = b.bloccata_fino_al;
    }
    return { ...b, sorgente, sorgenteCopertina: copertina, bloccata };
  });
}

async function caricaEbook() {
  const cartella = path.join(CONTENUTI, "ebook");
  if (!existsSync(cartella)) return [];
  const voci = (await readdir(cartella, { withFileTypes: true })).filter((v) => v.isDirectory());
  const elenco = [];
  for (const voce of voci) {
    const slug = voce.name;
    const dir = path.join(cartella, slug);
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new ErroreContenuti(`La cartella ebook «${slug}» ha un nome non valido: usa solo lettere minuscole, numeri e trattini.`);
    }
    const file = path.join(dir, "ebook.json");
    if (!existsSync(file)) {
      console.warn(`Salto la cartella ebook ${slug}: manca ebook.json`);
      continue;
    }
    const e = await leggiJson(file);
    if (!e.titolo) throw new ErroreContenuti(`Nell'ebook «${slug}» manca il titolo.`);
    const formati = (Array.isArray(e.file) ? e.file : [e.file]).filter(Boolean).map((f) => (typeof f === "string" ? { file: f } : { ...f }));
    if (!formati.length) throw new ErroreContenuti(`Nell'ebook «${slug}» manca il file da scaricare («file»).`);
    for (const f of formati) {
      if (!existsSync(path.join(dir, f.file))) throw new ErroreContenuti(`Nell'ebook «${slug}» manca il file ${f.file}.`);
      f.etichetta = f.etichetta || path.extname(f.file).slice(1).toUpperCase();
    }
    if (e.copertina && !existsSync(path.join(dir, e.copertina))) throw new ErroreContenuti(`Nell'ebook «${slug}» manca la copertina ${e.copertina}.`);
    elenco.push({ ...e, slug, dir, formati });
  }
  elenco.sort((a, b) => (b.data || "").localeCompare(a.data || "") || ordinaNaturale(a.titolo, b.titolo));
  return elenco;
}

async function caricaArtwork() {
  const dir = path.join(CONTENUTI, "artwork");
  const file = path.join(dir, "artwork.json");
  if (!existsSync(file)) return [];
  const dati = await leggiJson(file);
  return (Array.isArray(dati.opere) ? dati.opere : []).map((o, i) => {
    if (!o.titolo || !o.file) throw new ErroreContenuti(`In contenuti/artwork/artwork.json l'opera ${i + 1} deve avere «titolo» e «file».`);
    if (!existsSync(path.join(dir, o.file))) throw new ErroreContenuti(`Manca il file contenuti/artwork/${o.file}.`);
    const anteprima = o.anteprima && existsSync(path.join(dir, o.anteprima)) ? o.anteprima : o.file;
    const grande = o.grande && existsSync(path.join(dir, o.grande)) ? o.grande : o.file;
    return { ...o, dir, anteprima, grande };
  });
}

async function caricaBiblioteca() {
  const file = path.join(CONTENUTI, "biblioteca", "biblioteca.json");
  if (!existsSync(file)) return [];
  const dati = await leggiJson(file);
  return (Array.isArray(dati.sezioni) ? dati.sezioni : [])
    .map((s, i) => {
      if (!s.titolo) throw new ErroreContenuti(`In contenuti/biblioteca/biblioteca.json la sezione ${i + 1} deve avere «titolo».`);
      const voci = (Array.isArray(s.voci) ? s.voci : []).map((v, k) => {
        if (!v.titolo || !v.link) throw new ErroreContenuti(`Nella biblioteca la voce ${k + 1} di «${s.titolo}» deve avere «titolo» e «link».`);
        if (!/^https?:\/\//.test(v.link)) throw new ErroreContenuti(`Nella biblioteca il link di «${v.titolo}» deve iniziare con https://`);
        return v;
      });
      return { ...s, voci };
    })
    .filter((s) => s.voci.length);
}

function caricaMerch() {
  const m = sito.merch;
  if (!m || !Array.isArray(m.articoli) || !m.articoli.length) return [];
  const dir = path.join(CONTENUTI, "merch");
  return m.articoli.map((a, i) => {
    if (!a.titolo) throw new ErroreContenuti(`In sito.json, alla voce "merch", l'articolo ${i + 1} deve avere «titolo».`);
    const immagini = (Array.isArray(a.immagini) ? a.immagini : []).map((im) => (typeof im === "string" ? { file: im } : im));
    for (const im of immagini) {
      if (!im.file || !existsSync(path.join(dir, im.file))) throw new ErroreContenuti(`Manca l'immagine contenuti/merch/${im.file || "?"} per «${a.titolo}».`);
    }
    return { ...a, immagini, dir };
  });
}

const ebookAttivi = () => sito.ebook?.pubblica !== false;

// I social della sezione in fondo alla home: ognuno con il suo sigillo al posto del logo.
function caricaSocial() {
  const s = sito.social;
  if (!s || !Array.isArray(s.voci)) return [];
  const dir = path.join(CONTENUTI, "social");
  return s.voci
    .map((v) => ({ ...v, link: v.link || link[v.canale] || "" }))
    .filter((v) => v.link)
    .map((v) => {
      if (v.sigillo && !existsSync(path.join(dir, v.sigillo))) throw new ErroreContenuti(`Manca il sigillo contenuti/social/${v.sigillo} per ${v.nome || v.canale}.`);
      return { ...v, dir };
    });
}

// ---------------------------------------------------------------- impaginazione comune

function testata(pagina, attiva) {
  const voce = (href, nome, chiave) =>
    `<a href="${indirizzo(href, pagina)}"${attiva === chiave ? ' aria-current="page"' : ""}>${nome}</a>`;
  const voci = [
    voce("/caroselli/", "Caroselli", "caroselli"),
    voce("/#musica", "Musica", "musica"),
    voce("/gioco/", "Gioco", "gioco"),
    raccolte.opere.length ? voce("/artwork/", "Artwork", "artwork") : "",
    ebookAttivi() ? voce("/ebook/", "Ebook", "ebook") : "",
    raccolte.biblioteca.length ? voce("/biblioteca/", "Biblioteca", "biblioteca") : "",
    raccolte.merch.length ? voce("/#merch", "Merch", "merch") : "",
  ].join("");
  return `<a class="salta" href="#contenuto">Vai al contenuto</a>
<header class="testata" data-testata>
  <a class="testata-logo" href="${indirizzo("/", pagina)}" aria-label="${esc(sito.nome)}, pagina iniziale"><img src="${indirizzo(media.logoPiccolo, pagina)}" width="160" height="110" alt=""></a>
  <button class="testata-menu" type="button" data-menu aria-expanded="false" aria-controls="menu-principale"><span class="se-chiuso">${icona.menu}</span><span class="se-aperto">${icona.chiudi}</span><span class="testata-menu-testo">Menu</span></button>
  <nav class="testata-nav" id="menu-principale" aria-label="Principale">${voci}</nav>
</header>`;
}

function piede(pagina) {
  return `<footer class="piede">
  <div class="via via-fine" style="--pos: 90%" aria-hidden="true"></div>
  <div class="colonna piede-corpo">
    <img src="${indirizzo(media.logoPiccolo, pagina)}" width="160" height="110" alt="TAUH" loading="lazy">
    ${sito.piede?.motto ? `<p class="piede-motto">${esc(sito.piede.motto)}</p>` : ""}
    <p class="firma">TAUH · la via delle ombre</p>
  </div>
</footer>`;
}

function barraAscolto(pagina) {
  if (!raccolte.brani.length) return "";
  const elenco = raccolte.brani.map((b) => ({
    titolo: b.titolo,
    file: indirizzo(b.url, pagina),
    copertina: indirizzo(b.urlCopertina, pagina),
    durata: Math.round(b.durata * 10) / 10,
    ...(b.bloccata ? { bloccata: b.bloccata } : {}),
  }));
  const primo = raccolte.brani.find((b) => !b.bloccata) || raccolte.brani[0];
  return `<div class="ascolto" data-lettore>
  <button class="ascolto-suona" type="button" data-lettore-suona aria-label="Ascolta ${esc(primo.titolo)} di TAUH"><span class="se-fermo">${icona.gioca}</span><span class="se-suona">${icona.pausa}</span></button>
  <img class="ascolto-copertina" data-lettore-copertina src="${indirizzo(primo.urlCopertina, pagina)}" width="512" height="512" alt="" loading="lazy" decoding="async">
  <div class="ascolto-info">
    <span class="ascolto-invito">Ascolta TAUH</span>
    <span class="ascolto-riga"><span class="ascolto-titolo" data-lettore-titolo>${esc(primo.titolo)}</span><span class="ascolto-tempo" data-lettore-tempo>0:00</span></span>
    <span class="ascolto-via" data-lettore-via role="slider" tabindex="0" aria-label="Posizione nel brano" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="0:00 di ${minuti(primo.durata)}"><span></span></span>
  </div>
  <button class="ascolto-prossimo" type="button" data-lettore-prossimo aria-label="Brano successivo"${raccolte.brani.length < 2 ? " hidden" : ""}>${icona.prossimo}</button>
</div>
<script type="application/json" id="brani-dati">${JSON.stringify(elenco).replace(/</g, "\\u003c")}</script>`;
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
${barraAscolto(pagina)}
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
<script>document.documentElement.classList.add("js")</script>
<script type="module" src="${indirizzo(risorse.js, pagina)}"></script>
${extraTesta}</head>
<body>
${testata(pagina, attiva)}
${corpo}
${piede(pagina)}
${barraAscolto(pagina)}
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

function immagineGioco(pagina, dimensioni, lazy, alt = "") {
  const g = sito.gioco || {};
  const pigro = lazy ? ' loading="lazy"' : "";
  if (g.disponibile && media.giocoCopertina) {
    return `<picture>
          <source type="image/webp" srcset="${indirizzo(media.giocoCopertina640, pagina)} 640w, ${indirizzo(media.giocoCopertina, pagina)} 1280w" sizes="${dimensioni}">
          <img src="${indirizzo(media.giocoCopertina, pagina)}" width="1280" height="720" alt="${esc(alt)}"${pigro} decoding="async">
        </picture>`;
  }
  return `<picture>
          <source type="image/webp" srcset="${indirizzo(media.gioco600, pagina)} 600w, ${indirizzo(media.gioco1080, pagina)} 1080w" sizes="${dimensioni}">
          <img src="${indirizzo(media.gioco600, pagina)}" width="600" height="750" alt="${esc(alt)}"${pigro} decoding="async">
        </picture>`;
}

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
    ? `<a class="bottone primario" href="${indirizzo("/gioco/", pagina)}">Gioca a ${esc(gioco.titolo || "il gioco")}</a>`
    : `<a class="bottone" href="${indirizzo("/gioco/", pagina)}">Scopri il gioco</a>`;
  const uscita = sito.uscita?.titolo && sito.uscita?.link ? sito.uscita : null;
  const quanteSezioni = 4 + (uscita ? 1 : 0) + (link.telegram ? 1 : 0) + (raccolte.merch.length ? 1 : 0) + (raccolte.social.length ? 1 : 0);
  let nodo = 0;
  const via = () => {
    const pos = Math.round(10 + (nodo * 80) / Math.max(1, quanteSezioni - 1));
    nodo += 1;
    return `<div class="via" style="--pos: ${pos}%" aria-hidden="true"></div>`;
  };
  const sezioneUscita = uscita
    ? `<section class="sezione" id="uscita" aria-labelledby="titolo-uscita">
    ${via()}
    <div class="colonna">
      <div class="uscita" data-uscita="${esc(uscita.data || "")}"${uscita.data ? ` data-prima="Esce il ${dataEstesa(uscita.data)}" data-dopo="Uscito il ${dataEstesa(uscita.data)}"` : ""}>
        ${media.uscitaCopertina
          ? `<img class="uscita-copertina" src="${indirizzo(media.uscitaCopertina, pagina)}" width="${media.uscitaCopertinaW || 600}" height="${media.uscitaCopertinaH || 600}" alt="La copertina di ${esc(uscita.titolo)}" loading="lazy" decoding="async">`
          : `<div class="uscita-disco" aria-hidden="true"><span class="uscita-etichetta"><img src="${indirizzo(media.logoPiccolo, pagina)}" width="160" height="110" alt="" loading="lazy" decoding="async"></span></div>`}
        <div class="uscita-testo">
          <span class="stato" data-uscita-stato>${esc(uscita.tipo || "Nuova uscita")}</span>
          <h2 id="titolo-uscita">${esc(uscita.titolo)}</h2>
          ${uscita.data ? `<p class="uscita-data" data-uscita-quando>Esce il ${dataEstesa(uscita.data)}</p>` : ""}
          ${uscita.testo ? `<p>${esc(uscita.testo)}</p>` : ""}
          <a class="bottone primario" href="${esc(uscita.link)}" target="_blank" rel="noopener" data-uscita-link data-dopo="${esc(uscita.bottone_dopo || "Ascoltalo su Spotify")}">${icona.gioca}<span>${esc(uscita.bottone || "Pre-salvalo su Spotify")}</span></a>
        </div>
      </div>
    </div>
  </section>`
    : "";
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

  ${sezioneUscita}

  <section class="sezione" id="caroselli" aria-labelledby="titolo-caroselli" data-binario>
    ${via()}
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
    ${via()}
    <div class="colonna musica">
      <div class="musica-testa">
        <h2 id="titolo-musica">Ascolta</h2>
        <p>${esc(musica.testo || "")}</p>
      </div>
      ${raccolte.brani.length ? `<div class="musica-brani">
        <ol class="brani" role="list">
          ${raccolte.brani
            .map((b, i) => {
              const nota = [b.nota, b.durata ? minuti(b.durata) : ""].filter(Boolean).join(" · ");
              const interno = (testo, simbolo) => `
            <img class="brano-copertina" src="${indirizzo(b.urlCopertina, pagina)}" width="512" height="512" alt="" loading="lazy" decoding="async">
            <span class="brano-testo"><span class="brano-titolo">${esc(b.titolo)}</span>${testo ? `<span class="brano-nota">${esc(testo)}</span>` : ""}</span>
            <span class="brano-icona">${simbolo}</span>`;
              const bottone = `<button class="brano" type="button" data-brano="${i}" aria-pressed="false"${b.bloccata ? " hidden" : ""}>${interno(nota, `<span class="se-fermo">${icona.gioca}</span><span class="se-suona">${icona.pausa}</span>`)}
          </button>`;
              if (!b.bloccata) return `<li>${bottone}</li>`;
              // col lucchetto: finché non si sblocca, al posto del bottone c'è il link al gioco (app.js li scambia)
              return `<li data-bloccata="${b.bloccata}">${bottone}
          <a class="brano brano-chiuso" href="${indirizzo("/gioco/", pagina)}" data-sblocca>${interno("Finisci il primo livello del gioco per ascoltarla", icona.lucchetto)}
          </a></li>`;
            })
            .join("\n          ")}
        </ol>
        <p class="brani-aiuto">La musica continua mentre giri per il sito.${link.telegram ? ` I pezzi li scarichi gratis dal <a href="${esc(link.telegram)}" rel="me noopener">canale Telegram</a>.` : ""}</p>
      </div>` : ""}
      <ul class="canali musica-canali" role="list">
        ${canaliMusica.join("\n        ")}
      </ul>
      <div class="musica-fuori">
      ${lettoreSpotify}
      ${lettoreYoutube}
      </div>
    </div>
  </section>

  <section class="sezione" id="gioco" aria-labelledby="titolo-gioco">
    ${via()}
    <div class="colonna">
      <div class="gioco-invito">
        ${immagineGioco(pagina, "(min-width: 800px) 36rem, 100vw", true)}
        <div class="gioco-invito-testo">
          ${gioco.disponibile ? "" : '<span class="stato">In arrivo</span>'}
          <h2 id="titolo-gioco">${esc(gioco.titolo || "Il gioco")}</h2>
          <p>${esc(gioco.testo || "")}</p>
          ${giocoTesto}
        </div>
      </div>
    </div>
  </section>

  ${`<section class="sezione" id="scarica" aria-labelledby="titolo-scarica">
    ${via()}
    <div class="colonna">
      <div class="sezione-testa">
        <div>
          <h2 id="titolo-scarica">${raccolte.biblioteca.length ? "Da leggere e da scaricare" : "Da scaricare"}</h2>
          <p>${esc(sito.scarica?.testo || "")}</p>
        </div>
      </div>
      <div class="porte">
        ${raccolte.opere.length ? `<a class="porta" href="${indirizzo("/artwork/", pagina)}">
          <img src="${indirizzo(raccolte.opere[0].urlAnteprima, pagina)}" width="${raccolte.opere[0].anteprimaW || 540}" height="${raccolte.opere[0].anteprimaH || 675}" alt="" loading="lazy" decoding="async">
          <span class="porta-testo"><strong>Artwork</strong><span>${raccolte.opere.length === 1 ? "1 immagine" : `${raccolte.opere.length} immagini`} in alta risoluzione</span></span>
        </a>` : ""}
        ${ebookAttivi() ? `<a class="porta" href="${indirizzo("/ebook/", pagina)}">
          ${raccolte.ebook[0]?.urlCopertina ? `<img src="${indirizzo(raccolte.ebook[0].urlCopertina, pagina)}" width="${raccolte.ebook[0].copertinaW || 540}" height="${raccolte.ebook[0].copertinaH || 760}" alt="" loading="lazy" decoding="async">` : `<img src="${indirizzo(media.soglia, pagina)}" width="900" height="1125" alt="" loading="lazy" decoding="async">`}
          <span class="porta-testo"><strong>Ebook</strong><span>${raccolte.ebook.length ? (raccolte.ebook.length === 1 ? "1 ebook gratuito" : `${raccolte.ebook.length} ebook gratuiti`) : "In arrivo"}</span></span>
        </a>` : ""}
        ${raccolte.biblioteca.length ? `<a class="porta" href="${indirizzo("/biblioteca/", pagina)}">
          <img src="${indirizzo(media.gioco600, pagina)}" width="600" height="750" alt="" loading="lazy" decoding="async">
          <span class="porta-testo"><strong>Biblioteca</strong><span>${voceBiblioteca(raccolte.biblioteca)}</span></span>
        </a>` : ""}
      </div>
    </div>
  </section>`}

  ${link.telegram ? `<section class="sezione" id="telegram" aria-labelledby="titolo-telegram">
    ${via()}
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

  ${raccolte.merch.length ? `<section class="sezione" id="merch" aria-labelledby="titolo-merch">
    ${via()}
    <div class="colonna">
      <div class="sezione-testa">
        <div>
          <h2 id="titolo-merch">${esc(sito.merch.titolo || "Merch")}</h2>
          ${sito.merch.testo ? `<p>${esc(sito.merch.testo)}</p>` : ""}
        </div>
      </div>
      <ul class="merch" role="list">
        ${raccolte.merch
          .map(
            (a) => `<li class="maglia">
          <div class="maglia-foto">
            ${a.immagini.map((im) => `<img src="${indirizzo(im.url, pagina)}" width="${im.larghezza || 800}" height="${im.altezza || 1000}" alt="${esc(im.alt || "")}" loading="lazy" decoding="async">`).join("\n            ")}
          </div>
          <div class="maglia-testo">
            <h3>${esc(a.titolo)}</h3>
            ${a.dettagli ? `<p>${esc(a.dettagli)}</p>` : ""}
            ${sito.merch.link ? `<a class="bottone primario" href="${esc(sito.merch.link)}" target="_blank" rel="noopener">${icona.esterno}${esc(sito.merch.bottone || "Chiedi in DM su Instagram")}</a>` : ""}
          </div>
        </li>`,
          )
          .join("\n        ")}
      </ul>
    </div>
  </section>` : ""}

  ${raccolte.social.length ? `<section class="sezione" id="social" aria-labelledby="titolo-social">
    ${via()}
    <div class="colonna">
      <div class="sezione-testa">
        <div>
          <h2 id="titolo-social">${esc(sito.social.titolo || "I miei social")}</h2>
          ${sito.social.testo ? `<p>${esc(sito.social.testo)}</p>` : ""}
        </div>
      </div>
      <ul class="social" role="list">
        ${raccolte.social
          .map(
            (v) => `<li><a class="social-voce" href="${esc(v.link)}" target="_blank" rel="me noopener">
          ${v.url ? `<img src="${indirizzo(v.url, pagina)}" width="360" height="360" alt="" loading="lazy" decoding="async">` : ""}
          <span class="social-nome">${esc(v.nome || v.canale)}</span>
          ${v.dettaglio ? `<span class="social-dettaglio">${esc(v.dettaglio)}</span>` : ""}
        </a></li>`,
          )
          .join("\n        ")}
      </ul>
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
  const percorso = indirizzo(g.percorso || "/gioco/play/", pagina);
  const comandi = Array.isArray(g.comandi) ? g.comandi : [];
  const touch = Array.isArray(g.comandi_touch) ? g.comandi_touch : [];
  const corpo = g.disponibile
    ? `<main id="contenuto" class="colonna gioco">
  <header class="carosello-testa">
    <h1>${esc(titolo)}</h1>
    ${g.sottotitolo ? `<p class="sottotitolo">${esc(g.sottotitolo)}</p>` : ""}
  </header>
  <div class="schermo-gioco" data-schermo-gioco style="--proporzioni: ${esc(g.proporzioni || "16 / 9")}">
    <a class="avvia" href="${percorso}" data-avvia data-titolo="${esc(titolo)}">
      ${immagineGioco(pagina, "(min-width: 76rem) 76rem, 100vw", false, g.descrizione_immagine || "")}
      <span class="avvia-bottone">${icona.gioca}Gioca</span>
    </a>
  </div>
  <div class="azioni gioco-azioni">
    <button class="bottone filo" type="button" data-gioco-intero hidden>${icona.intero}Schermo intero</button>
    <a class="bottone filo" href="${percorso}">Apri il gioco a tutta pagina</a>
  </div>
  <div class="gioco-info">
    <div class="gioco-storia">
      ${g.testo ? `<p>${esc(g.testo)}</p>` : ""}
      ${g.dettagli ? `<p>${esc(g.dettagli)}</p>` : ""}
    </div>
    ${comandi.length || touch.length ? `<section class="comandi" aria-labelledby="titolo-comandi">
      <h2 id="titolo-comandi">Comandi</h2>
      ${comandi.length ? `<dl>${comandi.map(([tasto, azione]) => `<div><dt>${esc(tasto)}</dt><dd>${esc(azione)}</dd></div>`).join("")}</dl>` : ""}
      ${touch.length ? `<h3>Su telefono e tablet</h3>\n      <ul>${touch.map((voce) => `<li>${esc(voce)}</li>`).join("")}</ul>` : ""}
    </section>` : ""}
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
    immagine: (g.disponibile && media.ogGioco) || media.ogHome,
    larghezzaImmagine: 1200,
    altezzaImmagine: 630,
    attiva: "gioco",
    corpo,
  });
}

function paginaArtwork() {
  const pagina = "/artwork/";
  const a = sito.artwork || {};
  const opere = raccolte.opere;
  const corpo = `<main id="contenuto" class="colonna">
  <header class="archivio-testa">
    <h1>Artwork</h1>
    ${a.testo ? `<p>${esc(a.testo)}</p>` : ""}
    ${a.licenza ? `<p class="licenza">${esc(a.licenza)}</p>` : ""}
  </header>
  <ul class="opere" role="list">
    ${opere
      .map((o, i) => {
        const formato = path.extname(o.file).slice(1).toUpperCase().replace("JPEG", "JPG");
        const misure = o.larghezza ? `, ${o.larghezza} × ${o.altezza}` : "";
        const completo = o.versione ? `${o.titolo} (${o.versione})` : o.titolo;
        const nome = `TAUH - ${completo}${path.extname(o.file).toLowerCase()}`;
        return `<li class="opera">
      <button class="opera-apri" type="button" data-opera="${i}" data-grande="${indirizzo(o.urlGrande, pagina)}" data-file="${indirizzo(o.urlFile, pagina)}" data-titolo="${esc(completo)}" data-nome="${esc(nome)}" aria-label="Apri in grande: ${esc(completo)}">
        <img src="${indirizzo(o.urlAnteprima, pagina)}" width="${o.anteprimaW || 600}" height="${o.anteprimaH || 600}" alt=""${i > 5 ? ' loading="lazy"' : ""} decoding="async">
      </button>
      <div class="opera-testo">
        <h2 class="opera-titolo">${esc(o.titolo)}</h2>
        ${o.versione ? `<p class="opera-versione">${esc(o.versione)}</p>` : ""}
        ${o.carosello && raccolte.slugCaroselli.has(o.carosello) ? `<a class="opera-fonte" href="${indirizzo(`/caroselli/${o.carosello}/`, pagina)}">Dal carosello</a>` : ""}
        ${o.descrizione ? `<p>${esc(o.descrizione)}</p>` : ""}
        <a class="bottone primario stretto" href="${indirizzo(o.urlFile, pagina)}" download="${esc(nome)}">${icona.scarica}Scarica</a>
        <span class="opera-meta">${formato}${misure}, ${peso(o.peso)}</span>
      </div>
    </li>`;
      })
      .join("\n    ")}
  </ul>
  <dialog class="lightbox" data-lightbox aria-label="Artwork in grande">
    <figure class="lightbox-quadro">
      <img data-lightbox-img alt="">
      <figcaption data-lightbox-titolo></figcaption>
    </figure>
    <div class="lightbox-comandi">
      <button class="freccia" type="button" data-lightbox-indietro aria-label="Immagine precedente">${icona.sinistra}</button>
      <a class="bottone primario stretto" data-lightbox-scarica href="#" download>${icona.scarica}Scarica</a>
      <button class="freccia" type="button" data-lightbox-avanti aria-label="Immagine successiva">${icona.destra}</button>
      <button class="freccia" type="button" data-lightbox-chiudi aria-label="Chiudi">${icona.chiudi}</button>
    </div>
  </dialog>
</main>`;
  return documento({
    pagina,
    titolo: "Artwork",
    descrizione: a.testo || "Gli artwork di TAUH, da scaricare gratis.",
    immagine: media.ogHome,
    larghezzaImmagine: 1200,
    altezzaImmagine: 630,
    attiva: "artwork",
    corpo,
  });
}

function paginaEbook() {
  const pagina = "/ebook/";
  const e = sito.ebook || {};
  const ebook = raccolte.ebook;
  const elenco = ebook.length
    ? `<ul class="ebook-elenco" role="list">
    ${ebook
      .map(
        (x) => `<li class="ebook" id="${esc(x.slug)}">
      ${x.urlCopertina ? `<img class="ebook-copertina" src="${indirizzo(x.urlCopertina, pagina)}" width="${x.copertinaW || 540}" height="${x.copertinaH || 760}" alt="Copertina di ${esc(x.titolo)}" loading="lazy" decoding="async">` : ""}
      <div class="ebook-testo">
        <h2>${esc(x.titolo)}</h2>
        ${x.sottotitolo ? `<p class="sottotitolo">${esc(x.sottotitolo)}</p>` : ""}
        ${x.descrizione ? `<p>${esc(x.descrizione)}</p>` : ""}
        <div class="azioni">
          ${x.formati.map((f) => `<a class="bottone primario" href="${indirizzo(f.url, pagina)}" download="${esc(`TAUH - ${x.titolo}${path.extname(f.file).toLowerCase()}`)}">${icona.scarica}Scarica ${esc(f.etichetta)}</a>`).join("\n          ")}
        </div>
        <span class="ebook-meta">${x.formati.map((f) => `${esc(f.etichetta)}, ${peso(f.peso)}`).join("; ")}${x.data ? `. Uscito il ${dataEstesa(x.data)}` : ""}</span>
      </div>
    </li>`,
      )
      .join("\n    ")}
  </ul>`
    : `<div class="riquadro ebook-attesa">
    <span class="stato stato-chiaro">In arrivo</span>
    <h2>I primi ebook stanno arrivando</h2>
    <p>${esc(e.in_arrivo || "")}</p>
    <div class="azioni">
      ${link.telegram ? `<a class="bottone primario" href="${esc(link.telegram)}" rel="me noopener">Entra nel canale Telegram</a>` : ""}
      ${raccolte.biblioteca.length
        ? `<a class="bottone filo" href="${indirizzo("/biblioteca/", pagina)}">Intanto sfoglia la biblioteca</a>`
        : `<a class="bottone filo" href="${indirizzo("/caroselli/", pagina)}">Intanto sfoglia i caroselli</a>`}
    </div>
  </div>`;
  const corpo = `<main id="contenuto" class="colonna">
  <header class="archivio-testa">
    <h1>Ebook</h1>
    ${e.testo ? `<p>${esc(e.testo)}</p>` : ""}
  </header>
  ${elenco}
</main>`;
  return documento({
    pagina,
    titolo: "Ebook",
    descrizione: e.testo || "Gli ebook di TAUH, da scaricare gratis.",
    immagine: ebook[0]?.urlCopertina || media.ogHome,
    attiva: "ebook",
    corpo,
  });
}

const voceBiblioteca = (sezioni) => {
  const n = sezioni.reduce((s, x) => s + x.voci.length, 0);
  return n === 1 ? "1 lettura consigliata" : `${n} letture consigliate`;
};

// Prima lettera del titolo, per il segno in cima a ogni scheda della biblioteca.
const iniziale = (titolo) =>
  String(titolo)
    .normalize("NFD")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .charAt(0)
    .toUpperCase();

function paginaBiblioteca() {
  const pagina = "/biblioteca/";
  const b = sito.biblioteca || {};
  const etichette = { gratis: "Leggilo gratis", editore: "Dall'editore", libreria: "In libreria", biblioteca: "In biblioteca" };
  const schedaLibro = (v) => {
    const edizione = [v.editore, v.anno].filter(Boolean).join(", ");
    return `<li class="libro">
        <span class="libro-segno" aria-hidden="true">${esc(iniziale(v.titolo))}</span>
        <div class="libro-testo">
          ${v.tipo ? `<span class="libro-tipo">${esc(v.tipo)}</span>` : ""}
          <h3 class="libro-titolo">${esc(v.titolo)}</h3>
          ${v.autore ? `<p class="libro-autore">${esc(v.autore)}</p>` : ""}
          ${edizione ? `<p class="libro-edizione">${esc(edizione)}</p>` : ""}
          ${v.descrizione ? `<p class="libro-descrizione">${esc(v.descrizione)}</p>` : ""}
          <a class="bottone filo stretto" href="${esc(v.link)}" target="_blank" rel="noopener">${icona.esterno}${esc(v.etichetta || etichette[v.dove] || "Dove trovarlo")}<span class="nascosto"> (si apre in un'altra scheda)</span></a>
        </div>
      </li>`;
  };
  const corpo = `<main id="contenuto" class="colonna">
  <header class="archivio-testa">
    <h1>Biblioteca</h1>
    ${b.testo ? `<p>${esc(b.testo)}</p>` : ""}
    ${b.nota ? `<p class="licenza">${esc(b.nota)}</p>` : ""}
  </header>
  ${raccolte.biblioteca
    .map(
      (s, i) => `<section class="scaffale" aria-labelledby="scaffale-${i + 1}">
    <div class="scaffale-testa">
      <h2 id="scaffale-${i + 1}">${esc(s.titolo)}</h2>
      ${s.testo ? `<p>${esc(s.testo)}</p>` : ""}
    </div>
    <ul class="libri" role="list">
      ${s.voci.map(schedaLibro).join("\n      ")}
    </ul>
  </section>`,
    )
    .join("\n  ")}
</main>`;
  return documento({
    pagina,
    titolo: "Biblioteca",
    descrizione: b.testo || "I libri e gli articoli consigliati da TAUH.",
    immagine: media.ogHome,
    larghezzaImmagine: 1200,
    altezzaImmagine: 630,
    attiva: "biblioteca",
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
const raccolte = { brani: [], ebook: [], opere: [], biblioteca: [], merch: [], social: [], slugCaroselli: new Set() };
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

// Il gioco esportato per itch.io carica i caratteri da Google: qui li sostituisco
// con quelli del sito, così nessuna pagina chiama server esterni.
// Quando il giocatore vede la schermata di vittoria del primo livello, il browser se lo ricorda:
// così i brani col lucchetto si sbloccano nella musica del sito. Lo script osserva solo lo
// schermo #won del gioco, senza toccarne il codice.
function scriptSblocco(bloccati, pagina) {
  const dati = {
    chiave: CHIAVE_GIOCO,
    brani: bloccati.map((b) => ({ titolo: b.titolo, fino: b.bloccata })),
    musica: indirizzo("/#musica", pagina),
  };
  return `<style>.sblocco-sito{max-width:560px;margin:4px 0 0;font-size:15px;line-height:1.5;color:#CFFE7E}.sblocco-sito-link{font-family:Cinzel,serif;font-weight:800;font-size:14px;letter-spacing:.2em;color:#CFFE7E;border:2px solid #CFFE7E;padding:10px 22px;text-decoration:none;pointer-events:auto}.sblocco-sito-link:hover,.sblocco-sito-link:focus-visible{background:#CFFE7E;color:#140b1c;outline:none}</style>
<script>
(() => {
  const d = ${JSON.stringify(dati).replace(/</g, "\\u003c")};
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const ancoraChiusi = d.brani.filter((b) => {
    const [a, m, g] = b.fino.split("-").map(Number);
    return new Date(a, m - 1, g) > oggi;
  });
  let fatto = false;
  new MutationObserver(() => {
    const vinto = document.getElementById("won");
    if (fatto || !vinto || vinto.hidden) return;
    fatto = true;
    try { localStorage.setItem(d.chiave, String(Date.now())); } catch (e) { return; }
    if (!ancoraChiusi.length) return;
    const titoli = ancoraChiusi.map((b) => "«" + b.titolo + "»");
    const testo = document.createElement("p");
    testo.className = "sblocco-sito";
    testo.textContent = "Hai sbloccato " + titoli.join(" e ") + ": ora " + (titoli.length > 1 ? "le" : "la") + " ascolti anche sul sito.";
    const link = document.createElement("a");
    link.className = "sblocco-sito-link";
    link.href = d.musica;
    link.target = "_top";
    link.textContent = titoli.length > 1 ? "ASCOLTALE SUL SITO" : "ASCOLTALA SUL SITO";
    const prima = vinto.querySelector("button");
    vinto.insertBefore(testo, prima);
    vinto.insertBefore(link, prima);
  }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["hidden"] });
})();
</script>`;
}

async function adattaGioco(brani) {
  const file = path.join(USCITA, "gioco", "play", "index.html");
  if (!existsSync(file)) return;
  const pagina = "/gioco/play/";
  let html = await readFile(file, "utf8");
  const aggiunte = [];
  // i caratteri del sito al posto di quelli di Google Fonts
  const senzaGoogle = html.replace(/<link[^>]+fonts\.(?:googleapis|gstatic)\.com[^>]*>\s*/gi, "");
  if (senzaGoogle !== html) {
    html = senzaGoogle;
    aggiunte.push(`<style>@font-face{font-family:"Cinzel";src:url("${indirizzo("/assets/font/cinzel-var.woff", pagina)}") format("woff");font-weight:400 900;font-display:swap}@font-face{font-family:"Montserrat";src:url("${indirizzo("/assets/font/montserrat-var.woff", pagina)}") format("woff");font-weight:100 900;font-display:swap}</style>`);
  }
  const bloccati = brani.filter((b) => b.bloccata);
  if (bloccati.length) aggiunte.push(scriptSblocco(bloccati, pagina));
  if (!aggiunte.length) return;
  const testa = aggiunte.join("\n");
  html = html.includes("</head>") ? html.replace("</head>", () => `${testa}\n</head>`) : `${testa}\n${html}`;
  await writeFile(file, html);
}

async function copiaConImpronta(sorgente, cartella, nome) {
  const dati = await readFile(sorgente);
  const destinazione = path.join(USCITA, cartella, nome);
  await mkdir(path.dirname(destinazione), { recursive: true });
  await writeFile(destinazione, dati);
  return { url: `/${cartella}/${nome}?v=${impronta(dati)}`, dati };
}

async function principale() {
  const caroselli = await caricaCaroselli();
  const brani = await caricaMusica();
  const ebook = ebookAttivi() ? await caricaEbook() : [];
  const merch = caricaMerch();
  const social = caricaSocial();
  const opere = await caricaArtwork();
  raccolte.biblioteca = sito.biblioteca?.pubblica === false ? [] : await caricaBiblioteca();

  await rm(USCITA, { recursive: true, force: true });
  await mkdir(path.join(USCITA, "assets"), { recursive: true });

  // file statici, immagini del sito e caratteri
  await cp(path.join(RADICE, "static"), USCITA, { recursive: true });
  await adattaGioco(brani);
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
    copertinaBrano: await versioneImg("copertina-riserva-512.webp"),
  });
  const copertinaGioco = sito.gioco?.immagine;
  if (copertinaGioco && existsSync(path.join(RADICE, "src", "img", `${copertinaGioco}-1280.webp`))) {
    media.giocoCopertina = await versioneImg(`${copertinaGioco}-1280.webp`);
    media.giocoCopertina640 = await versioneImg(`${copertinaGioco}-640.webp`);
  }
  if (existsSync(path.join(RADICE, "src", "img", "og-gioco.jpg"))) media.ogGioco = await versioneImg("og-gioco.jpg");
  if (sito.uscita?.copertina) {
    const sorgente = path.join(CONTENUTI, "uscita", sito.uscita.copertina);
    if (existsSync(sorgente)) {
      const { url, dati } = await copiaConImpronta(sorgente, "media/uscita", sito.uscita.copertina);
      const dim = dimensioniImmagine(dati);
      Object.assign(media, { uscitaCopertina: url, uscitaCopertinaW: dim?.w, uscitaCopertinaH: dim?.h });
    } else {
      console.warn(`Manca la copertina dell'uscita: contenuti/uscita/${sito.uscita.copertina}`);
    }
  }

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

  // musica, ebook e artwork
  raccolte.slugCaroselli = new Set(caroselli.map((c) => c.slug));
  for (const b of brani) {
    const { url, dati } = await copiaConImpronta(b.sorgente, "media/musica", b.file);
    const urlCopertina = b.sorgenteCopertina ? (await copiaConImpronta(b.sorgenteCopertina, "media/musica", b.copertina)).url : media.copertinaBrano;
    raccolte.brani.push({ ...b, url, urlCopertina, durata: durataMp3(dati) });
  }
  for (const x of ebook) {
    for (const f of x.formati) {
      const { url, dati: contenuto } = await copiaConImpronta(path.join(x.dir, f.file), `scarica/ebook/${x.slug}`, f.file);
      f.url = url;
      f.peso = contenuto.length;
    }
    if (x.copertina) {
      const { url, dati: contenuto } = await copiaConImpronta(path.join(x.dir, x.copertina), `media/ebook/${x.slug}`, x.copertina);
      const dim = dimensioniImmagine(contenuto);
      Object.assign(x, { urlCopertina: url, copertinaW: dim?.w, copertinaH: dim?.h });
    }
    raccolte.ebook.push(x);
  }
  for (const o of opere) {
    const originale = await copiaConImpronta(path.join(o.dir, o.file), "scarica/artwork", o.file);
    const dim = dimensioniImmagine(originale.dati);
    const piccola = o.anteprima === o.file ? originale : await copiaConImpronta(path.join(o.dir, o.anteprima), "media/artwork", o.anteprima);
    const grande = o.grande === o.file ? originale : await copiaConImpronta(path.join(o.dir, o.grande), "media/artwork", o.grande);
    const dimP = o.anteprima === o.file ? dim : dimensioniImmagine(piccola.dati);
    raccolte.opere.push({
      ...o,
      urlFile: originale.url,
      urlAnteprima: piccola.url,
      urlGrande: grande.url,
      peso: originale.dati.length,
      larghezza: dim?.w,
      altezza: dim?.h,
      anteprimaW: dimP?.w,
      anteprimaH: dimP?.h,
    });
  }

  for (const a of merch) {
    for (const im of a.immagini) {
      const { url, dati } = await copiaConImpronta(path.join(a.dir, im.file), "media/merch", im.file);
      const dim = dimensioniImmagine(dati);
      Object.assign(im, { url, larghezza: dim?.w, altezza: dim?.h });
    }
    raccolte.merch.push(a);
  }
  for (const v of social) {
    if (v.sigillo) v.url = (await copiaConImpronta(path.join(v.dir, v.sigillo), "media/social", v.sigillo)).url;
    raccolte.social.push(v);
  }

  const pagine = [
    ["/", paginaHome(caroselli)],
    ["/caroselli/", paginaArchivio(caroselli)],
    ...caroselli.map((c, i) => [`/caroselli/${c.slug}/`, paginaCarosello(c, i, caroselli)]),
    ["/gioco/", paginaGioco()],
    ...(raccolte.opere.length ? [["/artwork/", paginaArtwork()]] : []),
    ...(ebookAttivi() ? [["/ebook/", paginaEbook()]] : []),
    ...(raccolte.biblioteca.length ? [["/biblioteca/", paginaBiblioteca()]] : []),
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
  console.log(`Sito generato in ${path.relative(RADICE, USCITA)}/: ${pagine.length} pagine, ${caroselli.length} caroselli, ${tavole} tavole, ${raccolte.brani.length} brani, ${raccolte.opere.length} artwork, ${raccolte.ebook.length} ebook.`);
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
