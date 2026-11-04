// Codici per sbloccare con una donazione i brani col lucchetto del gioco e i video delle sezioni.
//
// Il repository è pubblico, quindi nei file del sito non va mai un codice vero. I codici li tiene
// TAUH e ne dà uno a ogni persona che dona.
//
// Brani (contenuti/sito.json, "sostieni" → "codici_sblocco"): nel sito vanno solo le impronte,
// e dall'impronta non si risale al codice.
//   node strumenti/codice-sblocco.mjs IL-TUO-CODICE   → l'impronta di un codice scelto da te
//   node strumenti/codice-sblocco.mjs --genera 30     → 30 codici nuovi a caso, ognuno con la sua impronta
//
// Video non in elenco (contenuti/satanismo/satanismo.json, "sblocco" del video): il codice del video
// di YouTube non è scritto da nessuna parte. Per ogni codice di sblocco il sito ha una «serratura»:
// il codice del video cifrato con quel codice (PBKDF2 e AES-GCM, come src/app.js). Chi scrive un
// codice giusto apre la sua serratura e il browser legge il video; senza codice resta illeggibile.
//   node strumenti/codice-sblocco.mjs --video NOME CODICE-YOUTUBE 30
//     → 30 codici nuovi (da tenere) e il blocco "sblocco" da mettere nel video NOME
//   node strumenti/codice-sblocco.mjs --video NOME CODICE-YOUTUBE --codici AAAAA-BBBBB,CCCCC-DDDDD
//     → le serrature per codici che hai già (per esempio per aggiungerne uno)
//
// Maiuscole, spazi e trattini non contano: «ab12-cd34» e «AB12CD34» sono lo stesso codice.
import { createCipheriv, createHash, pbkdf2Sync, randomBytes, randomInt } from "node:crypto";

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
const nuoviCodici = (quanti) => {
  if (!Number.isInteger(quanti) || quanti < 1 || quanti > 500) throw new Error("Quanti codici? Un numero da 1 a 500.");
  const codici = new Set();
  while (codici.size < quanti) codici.add(nuovoCodice());
  return [...codici];
};

// la serratura di un codice: il codice del video cifrato con una chiave che si ricava solo dal codice
const GIRI = 250000;
const serratura = (codice, sale, segreto) => {
  const chiave = pbkdf2Sync(pulisci(codice), sale, GIRI, 32, "sha256");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chiave, iv);
  const dati = Buffer.concat([c.update(segreto, "utf8"), c.final(), c.getAuthTag()]);
  return { iv: iv.toString("base64"), dati: dati.toString("base64") };
};

const argomenti = process.argv.slice(2);
try {
  if (argomenti[0] === "--video") {
    const [, nome, video, ...resto] = argomenti;
    if (!nome || !/^[a-z0-9-]+$/.test(nome)) throw new Error("Scrivi il nome del video (lettere minuscole, numeri e trattini), come in satanismo.json.");
    if (!video || !/^[A-Za-z0-9_-]{6,20}$/.test(video)) throw new Error("Scrivi il codice del video di YouTube (la parte dopo youtu.be/).");
    const i = resto.indexOf("--codici");
    const codici = i >= 0 ? (resto[i + 1] || "").split(",").map((c) => c.trim()).filter(Boolean) : nuoviCodici(Number(resto[0] || 30));
    if (!codici.length) throw new Error("Nessun codice.");
    const sale = `la-via-delle-ombre:video:${nome}`;
    const blocco = { sale, giri: GIRI, serrature: codici.map((c) => serratura(c, sale, video)) };
    console.log("Codici da tenere (uno per ogni persona che dona; non vanno nei file del sito):\n");
    for (const c of codici) console.log(c);
    console.log(`\nIl blocco da mettere in satanismo.json, nel video «${nome}», alla voce "sblocco":\n`);
    console.log(JSON.stringify(blocco, null, 2));
  } else if (argomenti[0] === "--genera") {
    for (const c of nuoviCodici(Number(argomenti[1] || 30))) console.log(`${c}\t${impronta(c)}`);
  } else if (argomenti.length) {
    console.log(impronta(argomenti.join(" ")));
  } else {
    console.error("Uso: node strumenti/codice-sblocco.mjs IL-TUO-CODICE  ·  --genera 30  ·  --video NOME CODICE-YOUTUBE 30");
    process.exit(1);
  }
} catch (errore) {
  console.error(errore.message);
  process.exit(1);
}
