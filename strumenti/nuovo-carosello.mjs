#!/usr/bin/env node
// Aggiunge un carosello al sito partendo da una cartella di immagini.
//
//   npm run nuovo-carosello -- "Titolo del carosello" "percorso/della/cartella" [AAAA-MM-GG]
//
// Le immagini vengono prese in ordine di nome (1.jpg, 2.jpg, … oppure 01.png, 02.png, …).
// Se hai installato «sharp» (npm install --no-save sharp) le converte anche in WebP
// 1080×1350 e crea la copertina piccola: le pagine si caricano più in fretta.
// Senza sharp le copia così come sono.

import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [titolo, sorgente, data] = process.argv.slice(2);

const esci = (messaggio) => {
  console.error(`\n${messaggio}\n`);
  process.exit(1);
};

if (!titolo || !sorgente) {
  esci('Uso: npm run nuovo-carosello -- "Titolo del carosello" "cartella/con/le/immagini" [AAAA-MM-GG]');
}
if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) esci(`La data «${data}» deve essere nel formato AAAA-MM-GG, per esempio 2026-10-20.`);
if (!existsSync(sorgente)) esci(`Non trovo la cartella «${sorgente}».`);

const slug = titolo
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");
if (!slug) esci("Il titolo deve contenere almeno una lettera o un numero.");

const destinazione = path.join(RADICE, "contenuti", "caroselli", slug);
if (existsSync(destinazione)) esci(`Esiste già un carosello in contenuti/caroselli/${slug}. Scegli un altro titolo o cancella quella cartella.`);

const immagini = (await readdir(sorgente))
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, "it", { numeric: true, sensitivity: "base" }));
if (!immagini.length) esci(`Nella cartella «${sorgente}» non ci sono immagini JPG, PNG o WebP.`);

let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  /* sharp non installato: copio le immagini senza convertirle */
}

await mkdir(destinazione, { recursive: true });
const tavole = [];
for (const [i, nome] of immagini.entries()) {
  const origine = path.join(sorgente, nome);
  const numero = String(i + 1).padStart(2, "0");
  let finale;
  if (sharp) {
    finale = `${numero}.webp`;
    await sharp(origine).resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(destinazione, finale));
    if (i === 0) {
      await sharp(origine).resize({ width: 540 }).webp({ quality: 80 }).toFile(path.join(destinazione, "copertina-540.webp"));
      await sharp(origine).resize({ width: 1080, withoutEnlargement: true }).flatten({ background: "#000000" }).jpeg({ quality: 80, progressive: true }).toFile(path.join(destinazione, "og.jpg"));
    }
  } else {
    const estensione = path.extname(nome).toLowerCase().replace(".jpeg", ".jpg");
    finale = `${numero}${estensione}`;
    await copyFile(origine, path.join(destinazione, finale));
  }
  tavole.push({ immagine: finale, titolo: i === 0 ? titolo : "", blocchi: [] });
}

const oggi = new Date();
const carosello = {
  titolo,
  sottotitolo: "",
  descrizione: "",
  data: data || `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}-${String(oggi.getDate()).padStart(2, "0")}`,
  instagram: "",
  tavole,
};
await writeFile(path.join(destinazione, "carosello.json"), `${JSON.stringify(carosello, null, 2)}\n`);

console.log(`
Carosello aggiunto: contenuti/caroselli/${slug}/ (${tavole.length} tavole${sharp ? ", convertite in WebP" : ""}).

Facoltativo: apri carosello.json in quella cartella e scrivi il sottotitolo,
il link al post Instagram e i titoli delle tavole.

Poi prova il sito con «npm run dev» e pubblicalo con commit e push su GitHub.
`);
