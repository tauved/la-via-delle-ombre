// Un server minimo per provare dist/ in locale e nelle prove automatiche: pagine (cartella → index.html),
// 404.html per quello che non c'è e le richieste parziali (Range) che servono all'audio.
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";

const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
};

export function servi(cartella, porta = 0) {
  const radice = path.resolve(cartella);
  const server = createServer((req, res) => {
    let percorso = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.join(radice, percorso);
    if (!file.startsWith(radice)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
    let stato = 200;
    if (!existsSync(file)) {
      file = path.join(radice, "404.html");
      stato = 404;
    }
    const peso = statSync(file).size;
    const tipo = TIPI[path.extname(file).toLowerCase()] || "application/octet-stream";
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
    if (range && stato === 200) {
      const inizio = range[1] ? Number(range[1]) : 0;
      const fine = range[2] ? Number(range[2]) : peso - 1;
      res.writeHead(206, { "Content-Type": tipo, "Content-Length": fine - inizio + 1, "Content-Range": `bytes ${inizio}-${fine}/${peso}`, "Accept-Ranges": "bytes" });
      createReadStream(file, { start: inizio, end: fine }).pipe(res);
      return;
    }
    res.writeHead(stato, { "Content-Type": tipo, "Content-Length": peso, "Accept-Ranges": "bytes" });
    if (req.method === "HEAD") res.end();
    else createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(porta, "127.0.0.1", () => ok(server)));
}

// node prove/servi.mjs [porta]: serve dist/ finché non lo fermi
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = await servi(path.join(path.dirname(new URL(import.meta.url).pathname), "..", "dist"), Number(process.argv[2]) || 8080);
  console.log(`dist/ su http://127.0.0.1:${server.address().port}/`);
}
