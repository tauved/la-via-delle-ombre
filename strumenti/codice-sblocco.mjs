// Codici per sbloccare con una donazione i brani col lucchetto del gioco.
//
// Nel sito (contenuti/sito.json, voce "sostieni" → "codici_sblocco") vanno solo le impronte:
// il repository è pubblico, e dall'impronta non si risale al codice. I codici veri li tiene TAUH
// e ne dà uno a ogni persona che dona.
//
//   node strumenti/codice-sblocco.mjs IL-TUO-CODICE   → l'impronta di un codice scelto da te
//   node strumenti/codice-sblocco.mjs --genera 30     → 30 codici nuovi a caso, ognuno con la sua impronta
//
// Maiuscole, spazi e trattini non contano: «ab12-cd34» e «AB12CD34» sono lo stesso codice.
// Lo stesso calcolo lo fa src/app.js quando qualcuno scrive il codice sul sito.
import { createHash, randomInt } from "node:crypto";

const impronta = (codice) => {
  const pulito = codice.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (pulito.length < 8) throw new Error("Il codice deve avere almeno 8 tra lettere e cifre.");
  return createHash("sha256").update(`la-via-delle-ombre:${pulito}`).digest("hex");
};

// lettere e cifre senza quelle che si confondono (0 e O, 1 e I)
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const nuovoCodice = () => {
  const s = Array.from({ length: 10 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
  return `${s.slice(0, 5)}-${s.slice(5)}`;
};

const argomenti = process.argv.slice(2);
try {
  if (argomenti[0] === "--genera") {
    const quanti = Number(argomenti[1] || 30);
    if (!Number.isInteger(quanti) || quanti < 1 || quanti > 500) throw new Error("Quanti codici? Un numero da 1 a 500.");
    const codici = new Set();
    while (codici.size < quanti) codici.add(nuovoCodice());
    for (const c of codici) console.log(`${c}\t${impronta(c)}`);
  } else if (argomenti.length) {
    console.log(impronta(argomenti.join(" ")));
  } else {
    console.error("Uso: node strumenti/codice-sblocco.mjs IL-TUO-CODICE  oppure  node strumenti/codice-sblocco.mjs --genera 30");
    process.exit(1);
  }
} catch (errore) {
  console.error(errore.message);
  process.exit(1);
}
