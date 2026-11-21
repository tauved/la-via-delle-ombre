// Prove automatiche del sito: genera dist/ con build.mjs prima di lanciarle.
//
//   node build.mjs && node prove/sito.mjs
//
// Serve il pacchetto «playwright» con Chromium (su GitHub le installa il workflow
// .github/workflows/prove.yml). Per usarne uno installato altrove: PLAYWRIGHT=/percorso/playwright/index.mjs
// Esce con codice 1 e l'elenco dei problemi se qualcosa non va.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { servi } from "./servi.mjs";

const RADICE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");

const problemi = [];
const errore = (dove, cosa) => problemi.push(`${dove}: ${cosa}`);

const server = await servi(path.join(RADICE, "dist"));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });

// le pagine sono quelle della mappa del sito, più la 404
const mappa = await readFile(path.join(RADICE, "dist", "sitemap.xml"), "utf8");
const pagine = [...mappa.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
pagine.push("/404.html");

async function contesto(larghezza, altezza, telefono = false) {
  return browser.newContext({ viewport: { width: larghezza, height: altezza }, isMobile: telefono, hasTouch: telefono });
}

// ---------------------------------------------------------------- tutte le pagine, telefono e computer
for (const [larghezza, altezza, telefono] of [
  [390, 844, true],
  [1440, 900, false],
]) {
  const ctx = await contesto(larghezza, altezza, telefono);
  const pg = await ctx.newPage();
  const errori = [];
  pg.on("pageerror", (e) => errori.push(String(e)));
  pg.on("console", (m) => m.type() === "error" && errori.push(m.text()));
  for (const indirizzo of pagine) {
    const dove = `${indirizzo} a ${larghezza}px`;
    errori.length = 0;
    const risposta = await pg.goto(BASE + indirizzo, { waitUntil: "load" });
    if (indirizzo !== "/404.html" && risposta?.status() !== 200) errore(dove, `risponde ${risposta?.status()}`);
    await pg.waitForTimeout(150);
    const r = await pg.evaluate(() => {
      const visibile = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const nome = (el) =>
        (el.getAttribute("aria-label") || "").trim() ||
        (el.getAttribute("aria-labelledby") || "")
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent || "")
          .join("")
          .trim() ||
        el.textContent.trim() ||
        [...el.querySelectorAll("img[alt]")].map((i) => i.alt).join("").trim() ||
        (el.getAttribute("title") || "").trim();
      return {
        largo: document.documentElement.scrollWidth,
        nascostiVisibili: [...document.querySelectorAll("[hidden]")].filter(visibile).map((e) => e.outerHTML.slice(0, 80)),
        senzaAlt: [...document.querySelectorAll("img:not([alt])")].map((i) => i.getAttribute("src")),
        // i link nascosti agli screen reader (aria-hidden, fuori dal Tab) sono doppioni voluti di un altro link
        senzaNome: [...document.querySelectorAll("a[href], button")].filter((e) => visibile(e) && !e.closest('[aria-hidden="true"]') && !nome(e)).map((e) => e.outerHTML.slice(0, 80)),
        h1: document.querySelectorAll("h1").length,
      };
    });
    if (r.largo > larghezza + 1) errore(dove, `scorre di lato (${r.largo}px)`);
    for (const x of r.nascostiVisibili) errore(dove, `elemento con hidden visibile: ${x}`);
    for (const x of r.senzaAlt) errore(dove, `immagine senza alt: ${x}`);
    for (const x of r.senzaNome) errore(dove, `link o bottone senza nome: ${x}`);
    if (r.h1 !== 1) errore(dove, `${r.h1} titoli h1 (ne serve uno)`);
    for (const x of errori) errore(dove, `errore nella console: ${x}`);
  }
  await ctx.close();
}

// ---------------------------------------------------------------- zoom al 400%
// 1280 px ingranditi quattro volte sono 320 px: nessuna pagina deve scorrere di lato
{
  const ctx = await contesto(320, 640, true);
  const pg = await ctx.newPage();
  for (const indirizzo of pagine) {
    await pg.goto(BASE + indirizzo, { waitUntil: "load" });
    const largo = await pg.evaluate(() => document.documentElement.scrollWidth);
    if (largo > 321) errore(`${indirizzo} a 320px`, `scorre di lato (${largo}px)`);
  }
  await ctx.close();
}

// ---------------------------------------------------------------- home
{
  // la nuova uscita sta nella prima schermata anche col telefono basso (browser di Instagram)
  const ctx = await contesto(390, 700, true);
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/`, { waitUntil: "load" });
  const bottone = await pg.$(".uscita-bottone");
  if (bottone) {
    const box = await bottone.boundingBox();
    if (!box || box.y + box.height > 700) errore("home a 390×700", "il bottone della nuova uscita non è nella prima schermata");
  }
  await ctx.close();
}
{
  // sul telefono: l'anteprima del gioco sta a destra della via, i riquadri si aprono e si richiudono,
  // il lettore si apre dal suo tondo senza spostarsi, e cambiando pagina resta com'era
  const ctx = await contesto(390, 844, true);
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/`, { waitUntil: "load" });
  await pg.addStyleTag({ content: "html{scroll-behavior:auto!important}" });
  const gioco = await pg.evaluate(() => {
    const schermo = document.querySelector(".gioco-schermo");
    const linea = document.querySelector(".via-viandante");
    if (!schermo || !linea) return null;
    const s = schermo.getBoundingClientRect();
    return { sinistra: s.left, destra: s.right, linea: linea.getBoundingClientRect().left, schermo: window.innerWidth };
  });
  if (gioco && (gioco.sinistra < gioco.linea + 12 || gioco.destra > gioco.schermo)) {
    errore("home sul telefono", `l'anteprima del gioco passa sopra la linea della via o esce dallo schermo (${Math.round(gioco.sinistra)}–${Math.round(gioco.destra)}, linea a ${Math.round(gioco.linea)})`);
  }
  // il tratto di via già fatto arriva al nodo
  await pg.evaluate(() => window.scrollTo(0, 2000));
  await pg.waitForTimeout(300);
  const via = await pg.evaluate(() => {
    const fatta = document.querySelector("[data-via-fatta]");
    const nodo = document.querySelector(".via-nodo");
    if (!fatta || !nodo) return null;
    const n = nodo.getBoundingClientRect();
    return { fine: fatta.getBoundingClientRect().bottom, nodo: n.top + n.height / 2 };
  });
  if (via && Math.abs(via.fine - via.nodo) > 3) errore("home sul telefono", `il tratto di via percorso finisce a ${Math.round(via.fine)}px, il nodo è a ${Math.round(via.nodo)}px`);
  // ringraziamenti: toccando il titolo si aprono, ritoccandolo si richiudono, senza restare a metà
  if (await pg.$("#ringraziamenti summary")) {
    await pg.evaluate(() => document.querySelector("#ringraziamenti").scrollIntoView({ block: "center" }));
    const stato = () =>
      pg.evaluate(() => {
        const d = document.querySelector("#ringraziamenti");
        return { aperto: d.open, alto: Math.round(d.getBoundingClientRect().height), classi: d.className };
      });
    const prima = await stato();
    await pg.tap("#ringraziamenti summary");
    await pg.waitForTimeout(700);
    const aperto = await stato();
    if (!aperto.aperto || aperto.alto < prima.alto + 50 || /in-moto|si-chiude/.test(aperto.classi)) errore("home sul telefono", `i ringraziamenti non si aprono bene (${JSON.stringify(aperto)})`);
    await pg.tap("#ringraziamenti summary");
    await pg.waitForTimeout(700);
    const chiuso = await stato();
    if (chiuso.aperto || chiuso.alto !== prima.alto || /in-moto|si-chiude/.test(chiuso.classi)) errore("home sul telefono", `i ringraziamenti non si richiudono bene (${JSON.stringify(chiuso)})`);
  }
  // lettore: dal tondo in basso a destra alla barra, col bordo destro fermo
  await pg.evaluate(() => document.querySelector("#musica").scrollIntoView());
  await pg.waitForTimeout(400);
  const bordo = () => pg.evaluate(() => Math.round(document.querySelector("[data-lettore]").getBoundingClientRect().right));
  const destra = await bordo();
  await pg.tap("[data-lettore-suona]");
  await pg.waitForTimeout(120);
  const durante = await bordo();
  await pg.waitForTimeout(900);
  const barra = await pg.evaluate(() => {
    const l = document.querySelector("[data-lettore]");
    return { classi: l.className, destra: Math.round(l.getBoundingClientRect().right), larga: Math.round(l.getBoundingClientRect().width) };
  });
  if (durante !== destra || barra.destra !== destra) errore("home sul telefono", `il lettore aprendosi sposta il bordo destro (${destra} → ${durante} → ${barra.destra})`);
  if (!/attivo/.test(barra.classi) || /in-moto/.test(barra.classi) || barra.larga < 300) errore("home sul telefono", `il lettore non resta aperto e fermo (${JSON.stringify(barra)})`);
  // in pausa e cambiando pagina la barra è già aperta al primo disegno, col brano di prima
  const titolo = await pg.textContent("[data-lettore-titolo]");
  await pg.tap("[data-lettore-suona]");
  await pg.waitForTimeout(300);
  await pg.goto(`${BASE}/artwork/`, { waitUntil: "commit" });
  await pg.waitForSelector("#lettore-pronto", { state: "attached" });
  const subito = await pg.evaluate(() => ({ classi: document.querySelector("[data-lettore]").className, titolo: document.querySelector("[data-lettore-titolo]").textContent }));
  if (!/attivo/.test(subito.classi) || subito.titolo !== titolo) errore("cambio pagina col lettore aperto", `la barra non torna com'era (${JSON.stringify(subito)}, attesa «${titolo}»)`);
  await ctx.close();
}
{
  const ctx = await contesto(1280, 800);
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/`, { waitUntil: "load" });
  await pg.addStyleTag({ content: "html{scroll-behavior:auto!important}" });
  // la via: in cima nessuna tappa accesa, in fondo tutte
  const accese = () => pg.evaluate(() => [document.querySelectorAll("[data-tappa]").length, document.querySelectorAll("[data-tappa].accesa").length]);
  const [tappe, inizio] = await accese();
  if (!tappe) errore("home", "nessuna tappa della via");
  if (inizio !== 0) errore("home", `${inizio} tappe accese prima di scorrere`);
  await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await pg.waitForTimeout(300);
  const [, fine] = await accese();
  if (fine !== tappe) errore("home", `in fondo solo ${fine} tappe accese su ${tappe}`);
  // «Tutti i brani»
  const tutti = await pg.$("[data-tutti-brani]");
  if (tutti) {
    const visibili = () => pg.evaluate(() => [...document.querySelectorAll("#elenco-brani > li")].filter((l) => l.offsetParent).length);
    const prima = await visibili();
    await tutti.click();
    const dopo = await visibili();
    const totale = await pg.evaluate(() => document.querySelectorAll("#elenco-brani > li").length);
    if (prima !== 6 || dopo !== totale) errore("home", `brani visibili ${prima} e poi ${dopo} (attesi 6 e ${totale})`);
  }
  // il lettore: si fa da parte mentre la nuova uscita è sullo schermo, poi play apre la barra e suona
  await pg.evaluate(() => window.scrollTo(0, 0));
  await pg.waitForTimeout(800);
  if (await pg.$(".uscita") && (await pg.isVisible("[data-lettore-suona]"))) errore("home", "il lettore fermo si vede accanto alla nuova uscita");
  await pg.evaluate(() => document.querySelector("#musica").scrollIntoView());
  await pg.waitForTimeout(400);
  await pg.click("[data-lettore-suona]");
  await pg.waitForTimeout(1500);
  const lettore = await pg.getAttribute("[data-lettore]", "class");
  if (!/attivo/.test(lettore) || !/in-ascolto/.test(lettore)) errore("home", `il lettore non suona (classi: ${lettore})`);
  // i ringraziamenti si aprono dall'indirizzo
  await pg.goto(`${BASE}/#ringraziamenti`, { waitUntil: "load" });
  if (!(await pg.evaluate(() => document.querySelector("#ringraziamenti")?.open))) errore("home", "/#ringraziamenti non apre i ringraziamenti");
  await ctx.close();
}

// ---------------------------------------------------------------- menu: a tendina sotto i 1120px, in riga sopra
for (const [larghezza, tendina] of [
  [1100, true],
  [1200, false],
]) {
  const ctx = await contesto(larghezza, 800);
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/`, { waitUntil: "load" });
  const r = await pg.evaluate(() => ({
    bottone: getComputedStyle(document.querySelector(".testata-menu")).display !== "none",
    alta: document.querySelector(".testata-nav").getBoundingClientRect().height,
  }));
  if (r.bottone !== tendina) errore(`menu a ${larghezza}px`, tendina ? "manca il menu a tendina" : "c'è il menu a tendina");
  if (!tendina && r.alta > 48) errore(`menu a ${larghezza}px`, "le voci vanno a capo");
  await ctx.close();
}

// ---------------------------------------------------------------- una pillola: le frecce del visore
{
  const pillola = pagine.find((p) => /^\/caroselli\/[^/]+\/$/.test(p));
  if (pillola) {
    const ctx = await contesto(390, 844, true);
    const pg = await ctx.newPage();
    await pg.goto(BASE + pillola, { waitUntil: "load" });
    await pg.click("[data-avanti]");
    await pg.waitForTimeout(1200);
    const contatore = (await pg.textContent("[data-contatore]")).trim();
    if (!contatore.startsWith("2/")) errore(pillola, `dopo «Tavola successiva» il contatore dice ${contatore}`);
    await ctx.close();
  }
}

// ---------------------------------------------------------------- artwork: l'immagine in grande
if (pagine.includes("/artwork/")) {
  const ctx = await contesto(390, 844, true);
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/artwork/`, { waitUntil: "load" });
  const voci = await pg.$$("[data-opera]");
  if (voci.length > 1) {
    await voci[0].click();
    await pg.waitForTimeout(900);
    const titolo = () => pg.textContent("[data-lightbox-titolo]");
    const primo = await titolo();
    if (!(await pg.evaluate(() => document.querySelector("[data-lightbox]").open))) errore("/artwork/", "l'immagine in grande non si apre");
    // trascinata a sinistra di 140px con un lancio: deve passare alla successiva
    const box = await (await pg.$("[data-lightbox-pista]")).boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await pg.mouse.move(x + 70, y);
    await pg.mouse.down();
    for (let k = 1; k <= 7; k += 1) {
      await pg.mouse.move(x + 70 - k * 20, y);
      await pg.waitForTimeout(16);
    }
    await pg.mouse.up();
    await pg.waitForTimeout(900);
    if ((await titolo()) === primo) errore("/artwork/", "trascinando col dito non passa all'immagine successiva");
    await pg.keyboard.press("Escape");
    await pg.waitForTimeout(900);
    if (await pg.evaluate(() => document.querySelector("[data-lightbox]").open)) errore("/artwork/", "Esc non chiude l'immagine in grande");
  }
  await ctx.close();
}

// ---------------------------------------------------------------- biblioteca: l'indice porta alle sezioni
if (pagine.includes("/biblioteca/")) {
  const ctx = await contesto(1280, 800);
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/biblioteca/`, { waitUntil: "load" });
  const rotti = await pg.evaluate(() => [...document.querySelectorAll(".indice a")].filter((a) => !document.getElementById(decodeURIComponent(a.hash.slice(1)))).map((a) => a.hash));
  for (const x of rotti) errore("/biblioteca/", `l'indice punta a ${x}, che non c'è`);
  await ctx.close();
}

await browser.close();
server.close();

if (problemi.length) {
  console.error(`${problemi.length} problemi:\n- ${problemi.join("\n- ")}`);
  process.exit(1);
}
console.log(`Tutto a posto: ${pagine.length} pagine provate su telefono e computer (e a 320 px), più home, menu, pillola, artwork e biblioteca.`);
