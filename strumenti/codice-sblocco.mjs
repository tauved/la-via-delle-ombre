// Codici per sbloccare con una donazione i brani col lucchetto del gioco e i video del Satanismo del Chaos.
//
// Il repository è pubblico, quindi nei file del sito non va mai un codice vero. I codici li tiene
// TAUH e ne dà uno a ogni persona che dona.
//
// Brani (contenuti/sito.json, "sostieni" → "codici_sblocco"): nel sito vanno solo le impronte,
// e dall'impronta non si risale al codice.
//   node strumenti/codice-sblocco.mjs IL-TUO-CODICE   → l'impronta di un codice scelto da te
//   node strumenti/codice-sblocco.mjs --genera 30     → 30 codici nuovi a caso, ognuno con la sua impronta
//
// Video del Satanismo del Chaos (contenuti/satanismo/satanismo.json): i codici dei video di YouTube non
// sono scritti da nessuna parte. La pagina ha una chiave segreta: ogni video ha il suo codice YouTube
// chiuso con quella chiave ("chiuso" nel video), e per ogni codice di sblocco c'è una «serratura» con
// dentro la chiave ("sblocco" della pagina). Chi scrive un codice giusto apre la sua serratura, prende
// la chiave e con quella apre tutti i video: un codice vale per tutti. (PBKDF2 e AES-GCM, come src/app.js.)
//   node strumenti/codice-sblocco.mjs --sezione 30 --video introduzione=CODICE-YOUTUBE --video …
//     → chiave nuova, 30 codici nuovi, il blocco "sblocco" e il "chiuso" di ogni video
//   node strumenti/codice-sblocco.mjs --sezione --codici-file codici.txt --video …
//     → lo stesso coi codici che hai già (nel file, scritti come AAAAA-BBBBB): continuano a valere
//   node strumenti/codice-sblocco.mjs --aggiungi-video nome=CODICE-YOUTUBE --codice UNO-DEI-TUOI-CODICI
//     → il "chiuso" di un video nuovo: la chiave si ricava da uno qualsiasi dei codici
//   node strumenti/codice-sblocco.mjs --aggiungi-codici 20 --codice UNO-DEI-TUOI-CODICI
//     → 20 codici nuovi e le serrature da aggiungere in fondo a "serrature"
// Al posto del codice YouTube va bene anche il link (youtu.be/… o youtube.com/watch?v=…).
//
// Maiuscole, spazi e trattini non contano: «ab12-cd34» e «AB12CD34» sono lo stesso codice.
import { createCipheriv, createDecipheriv, createHash, pbkdf2Sync, randomBytes, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";

const pulisci = (codice) => {
  const pulito = codice.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (pulito.length < 8) throw new Error("Il codice deve avere almeno 8 tra lettere e cifre.");
  return pulito;
};
const impronta = (codice) => createHash("sha256").update(`la-via-delle-ombre:${pulisci(codice)}`).digest("hex");

// lettere e cifre senza quelle che si confondono (0 e O, 1 e I)
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const nuovoCodice = () => {
  const s = Array.from({ length: 10 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
  return `${s.slice(0, 5)}-${s.slice(5)}`;
};
const nuoviCodici = (quanti, gia = []) => {
  if (!Number.isInteger(quanti) || quanti < 1 || quanti > 500) throw new Error("Quanti codici? Un numero da 1 a 500.");
  const vecchi = new Set(gia.map(pulisci));
  const codici = new Set();
  while (codici.size < quanti) {
    const c = nuovoCodice();
    if (!vecchi.has(pulisci(c))) codici.add(c);
  }
  return [...codici];
};

// la chiave della pagina, chiusa con ogni codice; i codici dei video, chiusi con la chiave della pagina
const SALE = "la-via-delle-ombre:satanismo";
const GIRI = 250000;
const chiaveDaCodice = (codice, sale, giri) => pbkdf2Sync(pulisci(codice), sale, giri, 32, "sha256");
const chiudi = (chiave, chiaro) => {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chiave, iv);
  const dati = Buffer.concat([c.update(chiaro), c.final(), c.getAuthTag()]);
  return { iv: iv.toString("base64"), dati: dati.toString("base64") };
};
const apri = (chiave, { iv, dati }) => {
  const d = Buffer.from(dati, "base64");
  const c = createDecipheriv("aes-256-gcm", chiave, Buffer.from(iv, "base64"));
  c.setAuthTag(d.subarray(-16));
  return Buffer.concat([c.update(d.subarray(0, -16)), c.final()]);
};
const serratura = (codice, segreto) => chiudi(chiaveDaCodice(codice, SALE, GIRI), segreto);

const idDaLink = (s) => {
  const t = String(s || "").trim();
  if (/^[A-Za-z0-9_-]{6,20}$/.test(t)) return t;
  const m = t.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{6,20})/);
  if (m) return m[1];
  throw new Error(`«${t}» non sembra il codice o il link di un video di YouTube.`);
};
const video = (voce) => {
  const i = String(voce || "").indexOf("=");
  const nome = i > 0 ? voce.slice(0, i) : "";
  if (!/^[a-z0-9-]+$/.test(nome)) throw new Error("Scrivi il video come nome=CODICE-YOUTUBE, col nome come in satanismo.json (lettere minuscole, numeri e trattini).");
  return { nome, id: idDaLink(voce.slice(i + 1)) };
};

// la chiave della pagina, presa con uno dei codici dal blocco "sblocco" di satanismo.json
const chiaveDellaPagina = (codice, file) => {
  const s = JSON.parse(readFileSync(file, "utf8"));
  const b = s.sblocco;
  if (!b?.serrature?.length) throw new Error(`In ${file} non c'è il blocco "sblocco" della pagina.`);
  const k = chiaveDaCodice(codice, b.sale, b.giri);
  for (const x of b.serrature) {
    try {
      const chiave = apri(k, x);
      if (chiave.length === 32) return chiave;
    } catch {
      /* non è la sua serratura */
    }
  }
  throw new Error("Questo codice non apre la pagina: controlla di averlo scritto bene.");
};

const argomenti = process.argv.slice(2);
const valori = (nome) => argomenti.flatMap((a, i) => (a === nome && argomenti[i + 1] && !argomenti[i + 1].startsWith("--") ? [argomenti[i + 1]] : []));
const uno = (nome) => valori(nome)[0];
const numeroDopo = (nome) => {
  const i = argomenti.indexOf(nome);
  const v = argomenti[i + 1];
  return v && /^\d+$/.test(v) ? Number(v) : null;
};
const FILE = new URL("../contenuti/satanismo/satanismo.json", import.meta.url);
const stampa = (titolo, x) => {
  console.log(`\n${titolo}\n`);
  console.log(JSON.stringify(x, null, 2));
};
const stampaCodici = (codici) => {
  console.log("Codici da tenere (uno per ogni persona che dona; non vanno nei file del sito):\n");
  codici.forEach((c, i) => console.log(`${String(i + 1).padStart(3)}. ${c}`));
};

try {
  if (argomenti[0] === "--sezione") {
    const elenco = valori("--video").map(video);
    if (!elenco.length) throw new Error("Scrivi almeno un video: --video nome=CODICE-YOUTUBE.");
    const daFile = uno("--codici-file");
    const scelti = uno("--codici");
    const codici = daFile
      ? (readFileSync(daFile, "utf8").match(/\b[A-Za-z2-9]{5}-[A-Za-z2-9]{5}\b/g) || []).map((c) => c.toUpperCase())
      : scelti
        ? scelti.split(",").map((c) => c.trim()).filter(Boolean)
        : nuoviCodici(numeroDopo("--sezione") || 30);
    codici.forEach(pulisci);
    const chiave = randomBytes(32);
    if (!daFile) stampaCodici(codici);
    else console.log(`${codici.length} codici letti da ${daFile}: continuano a valere tutti.`);
    stampa(`Il blocco "sblocco" della pagina, in satanismo.json:`, { sale: SALE, giri: GIRI, serrature: codici.map((c) => serratura(c, chiave)) });
    for (const v of elenco) stampa(`Il "chiuso" del video «${v.nome}»:`, chiudi(chiave, Buffer.from(v.id, "utf8")));
  } else if (argomenti[0] === "--aggiungi-video") {
    const v = video(argomenti[1]);
    const codice = uno("--codice");
    if (!codice) throw new Error("Serve uno dei codici che hai già: --codice AAAAA-BBBBB.");
    const chiave = chiaveDellaPagina(codice, uno("--file") || FILE);
    stampa(`Il "chiuso" del video «${v.nome}», da mettere nel video in satanismo.json:`, chiudi(chiave, Buffer.from(v.id, "utf8")));
  } else if (argomenti[0] === "--aggiungi-codici") {
    const codice = uno("--codice");
    if (!codice) throw new Error("Serve uno dei codici che hai già: --codice AAAAA-BBBBB.");
    const chiave = chiaveDellaPagina(codice, uno("--file") || FILE);
    const codici = nuoviCodici(numeroDopo("--aggiungi-codici") || 30, [codice]);
    stampaCodici(codici);
    stampa(`Le serrature da aggiungere in fondo a "serrature", nel blocco "sblocco" di satanismo.json:`, codici.map((c) => serratura(c, chiave)));
  } else if (argomenti[0] === "--genera") {
    for (const c of nuoviCodici(Number(argomenti[1] || 30))) console.log(`${c}\t${impronta(c)}`);
  } else if (argomenti.length && !argomenti[0].startsWith("--")) {
    console.log(impronta(argomenti.join(" ")));
  } else {
    console.error("Uso: node strumenti/codice-sblocco.mjs IL-TUO-CODICE  ·  --genera 30  ·  --sezione 30 --video nome=CODICE-YOUTUBE  ·  --aggiungi-video nome=CODICE-YOUTUBE --codice C  ·  --aggiungi-codici 20 --codice C");
    process.exit(1);
  }
} catch (errore) {
  console.error(errore.message);
  process.exit(1);
}
