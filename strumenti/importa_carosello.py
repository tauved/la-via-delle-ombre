#!/usr/bin/env python3
"""Converte un carosello esportato dal canvas Design in immagini e testi per il sito.

Uso:
    python3 strumenti/importa_carosello.py <cartella-import> [<cartella-import> ...]

Ogni <cartella-import> contiene canvas.json, i file *.dc.html delle tavole e la
cartella assets/ con le immagini (<id>.jpg / <id>.png). Per ogni carosello crea
contenuti/caroselli/<slug>/ con:
    01.webp ... NN.webp   tavole 1080x1350
    copertina-540.webp    copertina piccola per le schede
    og.jpg                anteprima per i link condivisi
    carosello.json        titolo, data e testi delle tavole

Serve Python 3 con Pillow, BeautifulSoup (bs4 + lxml) e Playwright con Chromium.
"""
from __future__ import annotations

import io
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag
from PIL import Image
from playwright.sync_api import sync_playwright

RADICE = Path(__file__).resolve().parent.parent
USCITA = RADICE / "contenuti" / "caroselli"
FONT = RADICE / "src" / "font"
W, H = 1080, 1350

CSS_BASE = """
@font-face{{font-family:'Cinzel';src:url('{cinzel}') format('woff');font-weight:400 900;font-style:normal;font-display:block}}
@font-face{{font-family:'Montserrat';src:url('{mont}') format('woff');font-weight:100 900;font-style:normal;font-display:block}}
@font-face{{font-family:'Montserrat';src:url('{monti}') format('woff');font-weight:100 900;font-style:italic;font-display:block}}
html,body{{margin:0;padding:0;background:#000;width:{w}px;height:{h}px;overflow:hidden}}
x-dc{{display:block}}
"""

CONTATORE = re.compile(r"^\s*\d+\s*/\s*\d+\s*$")
SALTA = {"scorri", "salva il post", "[@tuoprofilo]", "tauh"}
PRIMA_DATA = {}  # slug -> "AAAA-MM-GG" di riserva, se canvas.json non ha una data


def slugify(testo: str) -> str:
    t = unicodedata.normalize("NFKD", testo).encode("ascii", "ignore").decode()
    t = re.sub(r"[^a-zA-Z0-9]+", "-", t).strip("-").lower()
    return t or "carosello"


def pulisci_titolo(titolo: str) -> str:
    titolo = re.sub(r"^\s*carosello\s+", "", titolo, flags=re.I)
    return titolo.replace("’", "'").strip()


def trova_asset(cartella: Path, ident: str) -> Path | None:
    for f in (cartella / "assets").glob(ident + ".*"):
        return f
    return None


def logo_di_riserva() -> Path | None:
    """Il logo TAUH preso da un altro carosello, per le tavole che non lo hanno."""
    for f in sorted((RADICE / "strumenti").glob("logo-tauh.png")):
        return f
    return None


def html_da_renderizzare(cartella: Path, file_tavola: Path) -> str:
    zuppa = BeautifulSoup(file_tavola.read_text(encoding="utf-8"), "lxml")
    radice = zuppa.find("x-dc")
    if radice is None:
        raise ValueError(f"{file_tavola.name}: manca <x-dc>")
    stili = []
    elmetto = radice.find("helmet")
    if elmetto is not None:
        stili = [s.get_text() for s in elmetto.find_all("style")]
        elmetto.decompose()
    for s in radice.find_all(["script", "link", "iframe", "object", "embed"]):
        s.decompose()
    for img in radice.find_all("img"):
        m = re.search(r"_blob/([0-9a-f]{32})", img.get("src", ""))
        if m:
            f = trova_asset(cartella, m.group(1))
            if f is None:
                raise FileNotFoundError(f"{file_tavola.name}: manca l'immagine {m.group(1)}")
            img["src"] = f.resolve().as_uri()
        elif img.get("src", "").startswith(("http:", "https:")):
            img.decompose()
    # Segnaposto rimasto in alcuni caroselli: al suo posto il logo TAUH.
    logo = logo_di_riserva()
    for span in radice.find_all("span"):
        if span.get_text(strip=True).lower() == "[@tuoprofilo]" and logo is not None:
            nuovo = zuppa.new_tag("img", src=logo.resolve().as_uri(), alt="TAUH")
            nuovo["style"] = "display:block;width:146px;height:100px;margin:-38px 0"
            span.replace_with(nuovo)
    css = CSS_BASE.format(
        cinzel=(FONT / "cinzel-var.woff").resolve().as_uri(),
        mont=(FONT / "montserrat-var.woff").resolve().as_uri(),
        monti=(FONT / "montserrat-italic-var.woff").resolve().as_uri(),
        w=W,
        h=H,
    )
    corpo = "".join(str(c) for c in radice.contents)
    return (
        "<!doctype html><html lang='it'><head><meta charset='utf-8'>"
        f"<style>{css}</style><style>{''.join(stili)}</style></head>"
        f"<body><x-dc>{corpo}</x-dc></body></html>"
    )


# ---------------------------------------------------------------- testi

BLOCCHI = {"div", "p", "h1", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "figure", "section", "svg", "img"}


def html_in_linea(el: Tag) -> str:
    """Testo dell'elemento con solo <strong>, <em> e <br>."""
    parti = []
    for nodo in el.descendants:
        if isinstance(nodo, NavigableString):
            if nodo.find_parent("svg") is not None:
                continue
            testo = str(nodo)
            genitore = nodo.parent
            testo = testo.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            if genitore is not None and genitore.name in ("strong", "b"):
                testo = f"<strong>{testo}</strong>"
            elif genitore is not None and genitore.name in ("em", "i"):
                testo = f"<em>{testo}</em>"
            parti.append(testo)
        elif isinstance(nodo, Tag) and nodo.name == "br":
            parti.append(" ")
        elif isinstance(nodo, Tag) and nodo.name == "span" and nodo.previous_sibling is not None:
            parti.append(" ")
    testo = re.sub(r"\s+", " ", "".join(parti)).strip()
    return testo.replace("</strong><strong>", "")


def testo_semplice(html: str) -> str:
    return re.sub(r"<[^>]+>", "", html).replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").strip()


def e_foglia(el: Tag) -> bool:
    return el.find(lambda t: isinstance(t, Tag) and t.name in BLOCCHI) is None


def tipo_blocco(el: Tag) -> str:
    stile = (el.get("style") or "").lower().replace(" ", "")
    if el.name in ("h1", "h2", "h3", "h4"):
        return "titolo"
    if "background:#cffe7e" in stile or "rgba(207,254,126" in stile:
        return "domanda"
    if "background:#674cc0" in stile or "rgba(103,76,192" in stile:
        return "box"
    if el.name == "p":
        return "paragrafo"
    return "nota"


def estrai_blocchi(file_tavola: Path) -> list[dict]:
    zuppa = BeautifulSoup(file_tavola.read_text(encoding="utf-8"), "lxml")
    radice = zuppa.find("x-dc")
    for t in radice.find_all(["helmet", "script", "svg", "style"]):
        t.decompose()
    blocchi: list[dict] = []
    visti: set[int] = set()
    for el in radice.find_all(["h1", "h2", "h3", "h4", "p", "div", "li", "blockquote"]):
        if not e_foglia(el):
            continue
        if any(id(a) in visti for a in el.parents):
            continue
        html = html_in_linea(el)
        semplice = testo_semplice(html)
        if not semplice:
            continue
        basso = semplice.lower()
        if CONTATORE.match(semplice) or basso in SALTA:
            continue
        if re.search(r"\b\d+\s*/\s*\d+\s*$", semplice) and len(semplice) < 80:
            continue  # riga di testata «Serie 3/10»
        # Righe a due colonne (nome + descrizione): separale con un trattino.
        figli = [c for c in el.children if isinstance(c, Tag)]
        if el.name == "div" and len(figli) >= 2 and all(c.name == "span" for c in figli):
            pezzi = [html_in_linea(c) for c in figli]
            pezzi = [p for p in pezzi if testo_semplice(p).lower() not in SALTA and not CONTATORE.match(testo_semplice(p))]
            if not pezzi:
                continue
            html = " — ".join(pezzi)
        visti.add(id(el))
        blocchi.append({"tipo": tipo_blocco(el), "html": html})
    return blocchi


def titolo_tavola(info: dict, indice: int, blocchi: list[dict], titolo_carosello: str) -> str:
    if indice == 0:
        return titolo_carosello
    grezzo = (info or {}).get("title") or ""
    grezzo = re.sub(r"^\s*\d+\s*[–—-]\s*", "", grezzo).strip()
    if grezzo and grezzo.lower() not in ("copertina", "cover", "chiusura"):
        return grezzo
    for b in blocchi:
        if b["tipo"] == "titolo":
            return testo_semplice(b["html"])
    return f"Tavola {indice + 1}"


# ---------------------------------------------------------------- immagini


def salva_webp(png: bytes, destinazione: Path, larghezza: int, qualita: int) -> None:
    im = Image.open(io.BytesIO(png)).convert("RGB")
    if im.width != larghezza:
        im = im.resize((larghezza, round(im.height * larghezza / im.width)), Image.LANCZOS)
    im.save(destinazione, "WEBP", quality=qualita, method=6)


def importa(cartella: Path, browser) -> dict:
    canvas = json.loads((cartella / "canvas.json").read_text(encoding="utf-8"))
    titolo = pulisci_titolo(canvas.get("title") or cartella.name)
    slug = cartella.name if re.fullmatch(r"[a-z0-9-]+", cartella.name) else slugify(titolo)
    ordine = canvas.get("order") or sorted(p.name for p in cartella.glob("*.dc.html"))
    schede = canvas.get("boards", {})
    dest = USCITA / slug
    dest.mkdir(parents=True, exist_ok=True)
    for vecchio in dest.glob("[0-9][0-9].webp"):
        vecchio.unlink()

    data = (canvas.get("createdOnFiles") or {}).get("at", "")[:10] or PRIMA_DATA.get(slug) or date.today().isoformat()
    pagina = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
    pagina.route("**/*", lambda r: r.continue_() if r.request.url.startswith(("file:", "data:")) else r.abort())
    tavole = []
    sottotitolo = ""
    copertina = ""
    for i, nome in enumerate(ordine):
        file_tavola = cartella / nome
        sorgente = cartella / f".render-{i:02d}.html"
        sorgente.write_text(html_da_renderizzare(cartella, file_tavola), encoding="utf-8")
        pagina.goto(sorgente.resolve().as_uri(), wait_until="load")
        pagina.evaluate("document.fonts.ready.then(() => true)")
        pagina.wait_for_timeout(120)
        png = pagina.screenshot(clip={"x": 0, "y": 0, "width": W, "height": H})
        sorgente.unlink()
        nome_img = f"{i + 1:02d}.webp"
        salva_webp(png, dest / nome_img, W, 82)
        if i == 0:
            salva_webp(png, dest / "copertina-540.webp", 540, 80)
            Image.open(io.BytesIO(png)).convert("RGB").save(dest / "og.jpg", "JPEG", quality=80, optimize=True, progressive=True)
        blocchi = estrai_blocchi(file_tavola)
        if i == 0:
            paragrafi = [testo_semplice(b["html"]) for b in blocchi if b["tipo"] == "paragrafo"]
            sottotitolo = paragrafi[0] if paragrafi else ""
            copertina = " ".join(p if p.endswith((".", "?", "!")) else p + "." for p in paragrafi)
        tavole.append({
            "immagine": nome_img,
            "titolo": titolo_tavola(schede.get(nome), i, blocchi, titolo),
            "blocchi": blocchi,
        })
    pagina.close()

    descrizione = copertina
    if len(tavole) > 1:
        primo = next((testo_semplice(b["html"]) for b in tavole[1]["blocchi"] if b["tipo"] == "paragrafo"), "")
        if primo and len(descrizione) < 40:
            descrizione = (descrizione + " " + primo).strip()
    info = {
        "titolo": titolo,
        "sottotitolo": sottotitolo,
        "descrizione": descrizione[:220],
        "data": data,
        "instagram": "",
        "tavole": tavole,
    }
    vecchio = dest / "carosello.json"
    if vecchio.exists():  # conserva i campi scritti a mano
        prima = json.loads(vecchio.read_text(encoding="utf-8"))
        for campo in ("instagram", "data", "descrizione", "sottotitolo"):
            if prima.get(campo):
                info[campo] = prima[campo]
    vecchio.write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"slug": slug, "titolo": titolo, "tavole": len(tavole)}


def main(argv: list[str]) -> int:
    cartelle = [Path(a) for a in argv if not a.startswith("--")]
    if not cartelle:
        print(__doc__)
        return 1
    for a in argv:
        if a.startswith("--data="):  # --data=slug:AAAA-MM-GG
            slug, _, giorno = a[7:].partition(":")
            PRIMA_DATA[slug] = giorno
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for c in cartelle:
            esito = importa(c, browser)
            print(f"{esito['slug']}: {esito['tavole']} tavole")
        browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
