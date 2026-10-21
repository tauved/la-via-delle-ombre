// Calcola l'impronta di un codice di sblocco, da mettere in contenuti/sito.json alla voce
// "sostieni" → "codici_sblocco". Il codice vero non va mai scritto nei file del sito:
// il repository è pubblico, l'impronta invece non permette di risalire al codice.
//
// Uso: node strumenti/codice-sblocco.mjs IL-TUO-CODICE
//
// Maiuscole, spazi e trattini non contano: «ab12-cd34» e «AB12CD34» sono lo stesso codice.
// Lo stesso calcolo lo fa src/app.js quando qualcuno scrive il codice sul sito.
import { createHash } from "node:crypto";

const codice = process.argv.slice(2).join(" ");
if (!codice) {
  console.error("Uso: node strumenti/codice-sblocco.mjs IL-TUO-CODICE");
  process.exit(1);
}
const pulito = codice.toUpperCase().replace(/[^A-Z0-9]/g, "");
if (pulito.length < 8) {
  console.error("Il codice deve avere almeno 8 tra lettere e cifre.");
  process.exit(1);
}
console.log(createHash("sha256").update(`la-via-delle-ombre:${pulito}`).digest("hex"));
