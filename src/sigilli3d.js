// I sigilli di «I miei social» in 3D: un medaglione col segno in rilievo, che gira piano
// e si inclina sotto il dito o il mouse. WebGL senza librerie.
//
// Ogni sigillo ha due file preparati da strumenti/sigilli_3d.py: la forma del segno come
// campo di distanza (una texture in grigio, per la faccia del rilievo con i bordi netti e
// per l'alone) e i suoi contorni (per alzare le pareti). Si carica solo quando la sezione
// sta per comparire; se qualcosa non va restano le immagini di sempre.

const LIME = [0.812, 0.996, 0.494];
const CAMPO = 24; // texel di distanza codificati nella texture (vedi sigilli_3d.py)
const LATO_TEX = 512;
const SPESSORE = 0.1; // il disco, dietro
const BORDO = 0.04; // l'anello viola, sopra il disco
const RILIEVO = 0.085; // quanto sporge il segno
const R_DENTRO = 0.915;
const R_FUORI = 0.97;
const DISTANZA = 4.05;
const FOV = (30 * Math.PI) / 180;

const VERTICI = `
attribute vec3 a_pos;
attribute vec3 a_nrm;
attribute float a_mat;
uniform mat4 u_proj;
uniform mat4 u_model;
uniform mediump vec3 u_cam; // stessa precisione nei due shader
varying vec3 v_nrm;
varying vec3 v_pos;
varying vec3 v_mondo;
varying float v_mat;
void main() {
  vec4 m = u_model * vec4(a_pos, 1.0);
  v_mondo = m.xyz;
  v_nrm = (u_model * vec4(a_nrm, 0.0)).xyz;
  v_pos = a_pos;
  v_mat = a_mat;
  gl_Position = u_proj * vec4(m.xyz - u_cam, 1.0);
}`;

const FRAMMENTI = `
precision mediump float;
uniform sampler2D u_tex;
uniform mediump vec3 u_cam;
uniform float u_aa;
varying vec3 v_nrm;
varying vec3 v_pos;
varying vec3 v_mondo;
varying float v_mat;
const vec3 LIME = vec3(${LIME.join(", ")});
const vec3 VIOLA = vec3(0.404, 0.298, 0.753);
float distanza() {
  // texel dal bordo del segno: positivo dentro, negativo fuori
  return (texture2D(u_tex, v_pos.xy * 0.5 + 0.5).r - 0.5) * 2.0 * ${CAMPO.toFixed(1)};
}
void main() {
  vec3 n = normalize(v_nrm);
  vec3 vista = normalize(u_cam - v_mondo);
  vec3 luce = normalize(vec3(-0.45, 0.65, 0.75));
  vec3 controluce = normalize(vec3(0.7, -0.35, 0.45));
  float dif = max(dot(n, luce), 0.0);
  float dif2 = max(dot(n, controluce), 0.0);
  float spec = pow(max(dot(n, normalize(luce + vista)), 0.0), 36.0);
  float bordo = pow(1.0 - max(dot(n, vista), 0.0), 3.0);
  vec3 c;
  float a = 1.0;
  if (v_mat < 0.5) {
    // faccia del disco: scura, un po' più viola al centro, con l'alone lime attorno al segno
    float r = length(v_pos.xy);
    vec3 base = mix(vec3(0.11, 0.075, 0.22), vec3(0.03, 0.018, 0.06), smoothstep(0.0, 0.9, r));
    c = base * (0.55 + 0.6 * dif) + vec3(0.35, 0.3, 0.6) * spec * 0.15;
    float d = distanza();
    c += LIME * exp(min(d, 0.0) / 9.0) * 0.32;
  } else if (v_mat < 1.5) {
    // anello e fianco del disco: viola metallico
    vec3 base = VIOLA * 0.6;
    c = base * (0.3 + 0.95 * dif) + VIOLA * dif2 * 0.35 + vec3(0.92, 0.88, 1.0) * spec * 0.55 + VIOLA * bordo * 0.45;
  } else if (v_mat < 2.5) {
    // pareti del segno: lime più scuro, così si vede lo spessore
    vec3 base = LIME * 0.5;
    c = base * (0.35 + 0.85 * dif) + LIME * dif2 * 0.12 + LIME * spec * 0.45 + LIME * 0.1;
  } else {
    // faccia del segno: lime acceso, bordi netti dal campo di distanza
    float d = distanza();
    a = clamp(d / u_aa + 0.5, 0.0, 1.0);
    if (a < 0.01) discard;
    float cresta = 0.9 + 0.1 * clamp(d / 5.0, 0.0, 1.0);
    c = LIME * (0.78 + 0.28 * dif) * cresta + vec3(1.0) * spec * 0.5;
  }
  gl_FragColor = vec4(c * a, a);
}`;

// ---------------------------------------------------------------- matematica minima

function prospettiva(fov, aspetto, vicino, lontano) {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (vicino - lontano);
  return new Float32Array([f / aspetto, 0, 0, 0, 0, f, 0, 0, 0, 0, (lontano + vicino) * nf, -1, 0, 0, 2 * lontano * vicino * nf, 0]);
}

// rotazione attorno a X e poi a Y (colonne, come vuole WebGL)
function rotazione(rx, ry) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
  return new Float32Array([cy, 0, -sy, 0, sx * sy, cx, sx * cy, 0, cx * sy, -sx, cx * cy, 0, 0, 0, 0, 1]);
}

// ---------------------------------------------------------------- geometria

class Mesh {
  constructor() {
    this.dati = [];
  }
  vertice(x, y, z, nx, ny, nz, mat) {
    this.dati.push(x, y, z, nx, ny, nz, mat);
  }
  triangolo(a, b, c) {
    for (const v of [a, b, c]) this.vertice(...v);
  }
  quad(a, b, c, d) {
    this.triangolo(a, b, c);
    this.triangolo(a, c, d);
  }
}

function medaglione(m) {
  const N = 96;
  for (let i = 0; i < N; i++) {
    const t0 = (i / N) * Math.PI * 2;
    const t1 = ((i + 1) / N) * Math.PI * 2;
    const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
    // faccia del disco
    m.triangolo([0, 0, 0, 0, 0, 1, 0], [R_DENTRO * c0, R_DENTRO * s0, 0, 0, 0, 1, 0], [R_DENTRO * c1, R_DENTRO * s1, 0, 0, 0, 1, 0]);
    // parete interna dell'anello (guarda verso il centro)
    m.quad(
      [R_DENTRO * c0, R_DENTRO * s0, 0, -c0, -s0, 0, 1],
      [R_DENTRO * c0, R_DENTRO * s0, BORDO, -c0, -s0, 0.2, 1],
      [R_DENTRO * c1, R_DENTRO * s1, BORDO, -c1, -s1, 0.2, 1],
      [R_DENTRO * c1, R_DENTRO * s1, 0, -c1, -s1, 0, 1],
    );
    // cima dell'anello, un po' bombata
    m.quad(
      [R_DENTRO * c0, R_DENTRO * s0, BORDO, -0.35 * c0, -0.35 * s0, 1, 1],
      [R_FUORI * c0, R_FUORI * s0, BORDO, 0.45 * c0, 0.45 * s0, 1, 1],
      [R_FUORI * c1, R_FUORI * s1, BORDO, 0.45 * c1, 0.45 * s1, 1, 1],
      [R_DENTRO * c1, R_DENTRO * s1, BORDO, -0.35 * c1, -0.35 * s1, 1, 1],
    );
    // fianco del disco
    m.quad(
      [R_FUORI * c0, R_FUORI * s0, BORDO, c0, s0, 0, 1],
      [R_FUORI * c0, R_FUORI * s0, -SPESSORE, c0, s0, 0, 1],
      [R_FUORI * c1, R_FUORI * s1, -SPESSORE, c1, s1, 0, 1],
      [R_FUORI * c1, R_FUORI * s1, BORDO, c1, s1, 0, 1],
    );
    // retro
    m.triangolo([0, 0, -SPESSORE, 0, 0, -1, 1], [R_FUORI * c1, R_FUORI * s1, -SPESSORE, 0, 0, -1, 1], [R_FUORI * c0, R_FUORI * s0, -SPESSORE, 0, 0, -1, 1]);
  }
}

// le pareti del segno: ogni contorno ha l'esterno alla sua destra
function pareti(m, contorni) {
  for (const piatto of contorni) {
    const p = [];
    for (let i = 0; i < piatto.length; i += 2) p.push([piatto[i] / 1000, piatto[i + 1] / 1000]);
    const n = p.length;
    if (n < 3) continue;
    // normale di ogni lato, verso destra
    const normali = p.map((a, i) => {
      const b = p[(i + 1) % n];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      return [dy / l, -dx / l];
    });
    // sulle curve le normali si fondono (luce morbida), sugli spigoli restano nette
    const ai = (i, lato) => {
      const nl = normali[lato];
      const altro = normali[lato === i ? (i - 1 + n) % n : (i + 1) % n];
      if (nl[0] * altro[0] + nl[1] * altro[1] < 0.77) return nl;
      const sx = nl[0] + altro[0], sy = nl[1] + altro[1];
      const l = Math.hypot(sx, sy) || 1;
      return [sx / l, sy / l];
    };
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = p[i], b = p[j];
      const na = ai(i, i), nb = ai(j, i);
      m.quad([a[0], a[1], 0, na[0], na[1], 0, 2], [b[0], b[1], 0, nb[0], nb[1], 0, 2], [b[0], b[1], RILIEVO, nb[0], nb[1], 0, 2], [a[0], a[1], RILIEVO, na[0], na[1], 0, 2]);
    }
  }
}

function facciaSegno(m) {
  const z = RILIEVO;
  m.quad([-1, -1, z, 0, 0, 1, 3], [1, -1, z, 0, 0, 1, 3], [1, 1, z, 0, 0, 1, 3], [-1, 1, z, 0, 0, 1, 3]);
}

// ---------------------------------------------------------------- avvio

export async function avvia(lista, signal) {
  const voci = [...lista.querySelectorAll("[data-maschera][data-contorni]")];
  if (!voci.length || signal.aborted) return;

  const tela = document.createElement("canvas");
  const opzioni = { alpha: true, antialias: true, premultipliedAlpha: true, depth: true };
  const gl = tela.getContext("webgl", opzioni) || tela.getContext("experimental-webgl", opzioni);
  if (!gl) return;

  const shader = (tipo, testo) => {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, testo);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERTICI));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAMMENTI));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "programma");
  gl.useProgram(prog);
  const loc = {
    pos: gl.getAttribLocation(prog, "a_pos"),
    nrm: gl.getAttribLocation(prog, "a_nrm"),
    mat: gl.getAttribLocation(prog, "a_mat"),
    proj: gl.getUniformLocation(prog, "u_proj"),
    model: gl.getUniformLocation(prog, "u_model"),
    cam: gl.getUniformLocation(prog, "u_cam"),
    aa: gl.getUniformLocation(prog, "u_aa"),
    tex: gl.getUniformLocation(prog, "u_tex"),
  };

  const buffer = (mesh) => {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.dati), gl.STATIC_DRAW);
    return { b, n: mesh.dati.length / 7 };
  };

  const disco = new Mesh();
  medaglione(disco);
  const faccia = new Mesh();
  facciaSegno(faccia);
  const bufDisco = buffer(disco);
  const bufFaccia = buffer(faccia);

  const immagine = (url) =>
    new Promise((ok, ko) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => ok(im);
      im.onerror = ko;
      im.src = url;
    });

  // per ogni sigillo: texture, pareti e la tela 2D dove si copia il disegno
  const sigilli = (
    await Promise.all(
      voci.map(async (voce, k) => {
        const [im, forma] = await Promise.all([immagine(voce.dataset.maschera), fetch(voce.dataset.contorni).then((r) => r.json())]);
        return { voce, im, forma, k };
      }),
    )
  ).map(({ voce, im, forma, k }) => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, im);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const m = new Mesh();
    pareti(m, forma.contorni || []);
    const img = voce.querySelector("img");
    const tela2d = document.createElement("canvas");
    tela2d.className = "sigillo-3d";
    tela2d.setAttribute("aria-hidden", "true");
    return {
      voce,
      img,
      tela2d,
      ctx: tela2d.getContext("2d"),
      tex,
      pareti: buffer(m),
      fase: k * 1.37,
      inclina: { x: 0, y: 0, tx: 0, ty: 0, attivo: false },
    };
  });
  if (signal.aborted) return;

  const riduci = window.matchMedia("(prefers-reduced-motion: reduce)");
  let lato = 0;
  const dimensiona = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const misura = (s) => {
      const w = s.tela2d.isConnected ? s.tela2d.getBoundingClientRect().width : 0;
      return w || s.img?.getBoundingClientRect().width || 0;
    };
    const css = Math.max(...sigilli.map(misura), 96);
    const nuovo = Math.round(css * dpr);
    if (nuovo === lato) return;
    lato = nuovo;
    tela.width = tela.height = lato;
    for (const s of sigilli) s.tela2d.width = s.tela2d.height = lato;
  };

  // al posto dell'immagine; l'immagine resta nella pagina (testo alternativo, ritorno se il 3D si ferma)
  for (const s of sigilli) {
    if (s.img) s.img.before(s.tela2d);
    else s.voce.prepend(s.tela2d);
  }
  dimensiona();
  lista.classList.add("sigilli-in-3d");

  const proj = prospettiva(FOV, 1, 0.5, 20);
  const cam = new Float32Array([0, 0, DISTANZA]);
  // texel della texture per pixel di schermo, per bordi netti ma senza scalini
  const aa = () => LATO_TEX / (lato * (1 / (DISTANZA * Math.tan(FOV / 2))));

  const disegna = (s, t) => {
    const fermo = riduci.matches;
    const i = s.inclina;
    i.x += (i.tx - i.x) * 0.12;
    i.y += (i.ty - i.y) * 0.12;
    const giro = fermo ? 0.32 : 0.42 * Math.sin(t * 0.55 + s.fase);
    const beccheggio = fermo ? -0.14 : -0.1 + 0.07 * Math.sin(t * 0.4 + s.fase * 0.7);
    const peso = i.attivo ? 1 : 0;
    const ry = giro * (1 - 0.7 * peso) + i.y;
    const rx = beccheggio * (1 - 0.7 * peso) + i.x;

    gl.viewport(0, 0, lato, lato);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.uniformMatrix4fv(loc.proj, false, proj);
    gl.uniformMatrix4fv(loc.model, false, rotazione(rx, ry));
    gl.uniform3fv(loc.cam, cam);
    gl.uniform1f(loc.aa, aa());
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, s.tex);
    gl.uniform1i(loc.tex, 0);

    const usa = ({ b, n }) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.enableVertexAttribArray(loc.pos);
      gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(loc.nrm);
      gl.vertexAttribPointer(loc.nrm, 3, gl.FLOAT, false, 28, 12);
      gl.enableVertexAttribArray(loc.mat);
      gl.vertexAttribPointer(loc.mat, 1, gl.FLOAT, false, 28, 24);
      gl.drawArrays(gl.TRIANGLES, 0, n);
    };
    gl.disable(gl.BLEND);
    usa(bufDisco);
    usa(s.pareti);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    usa(bufFaccia);

    s.ctx.clearRect(0, 0, lato, lato);
    s.ctx.drawImage(tela, 0, 0);
  };

  // sotto il dito o il mouse il medaglione si inclina verso chi lo tocca
  for (const s of sigilli) {
    const segui = (e) => {
      const r = s.tela2d.getBoundingClientRect();
      if (!r.width) return;
      const x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      const y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      // orizzontale → giro attorno all'asse verticale, verticale → attorno a quello orizzontale
      s.inclina.ty = x * 0.55;
      s.inclina.tx = y * 0.45;
      s.inclina.attivo = true;
      sveglia();
    };
    const lascia = () => {
      s.inclina.tx = s.inclina.ty = 0;
      s.inclina.attivo = false;
      sveglia();
    };
    const fuoco = () => {
      s.inclina.ty = 0.35;
      s.inclina.tx = 0;
      s.inclina.attivo = true;
      sveglia();
    };
    s.voce.addEventListener("pointermove", segui, { signal, passive: true });
    s.voce.addEventListener("pointerdown", segui, { signal, passive: true });
    s.voce.addEventListener("pointerleave", lascia, { signal, passive: true });
    s.voce.addEventListener("pointercancel", lascia, { signal, passive: true });
    s.voce.addEventListener("focus", fuoco, { signal });
    s.voce.addEventListener("blur", lascia, { signal });
  }

  let visibile = true;
  let giro = 0;
  const t0 = performance.now();
  const passo = (ora) => {
    giro = 0;
    if (signal.aborted) return;
    const t = (ora - t0) / 1000;
    for (const s of sigilli) disegna(s, t);
    // con il movimento ridotto si ridisegna solo finché l'inclinazione si assesta
    const fermo = riduci.matches && sigilli.every((s) => Math.abs(s.inclina.tx - s.inclina.x) + Math.abs(s.inclina.ty - s.inclina.y) < 0.002);
    if (visibile && !document.hidden && !fermo) giro = requestAnimationFrame(passo);
  };
  const sveglia = () => {
    if (!giro && visibile && !document.hidden && !signal.aborted) giro = requestAnimationFrame(passo);
  };

  const osserva = new IntersectionObserver((voci) => {
    visibile = voci.some((v) => v.isIntersecting);
    if (visibile) sveglia();
  });
  osserva.observe(lista);
  document.addEventListener("visibilitychange", sveglia, { signal });
  window.addEventListener(
    "resize",
    () => {
      dimensiona();
      sveglia();
    },
    { signal },
  );
  riduci.addEventListener?.("change", sveglia, { signal });

  const ferma = () => {
    cancelAnimationFrame(giro);
    osserva.disconnect();
    for (const s of sigilli) s.tela2d.remove();
    lista.classList.remove("sigilli-in-3d");
  };
  tela.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    ferma();
  });
  signal.addEventListener("abort", () => {
    ferma();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  });

  sveglia();
}
