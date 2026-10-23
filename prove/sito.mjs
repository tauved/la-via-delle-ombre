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
  // il lettore: play apre la barra e suona
  await pg.evaluate(() => window.scrollTo(0, 0));
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
console.log(`Tutto a posto: ${pagine.length} pagine provate su telefono e computer, più home, menu, pillola e biblioteca.`);
