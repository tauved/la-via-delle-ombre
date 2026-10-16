// =============================================================
//  engine/renderer.js — il "cel shading" del gioco
//
//  Pipeline per ogni fotogramma:
//   1. Passata geometrica (MRT): colore a bande + normali/id in due texture,
//      più la profondità.
//   2. Composizione: un filtro trova i bordi (salti di profondità, pieghe
//      delle normali, oggetti diversi) e ci disegna sopra l'inchiostro.
//      Scrive anche la profondità sullo schermo.
//   3. Effetti (particelle, bagliori) sopra, senza contorni, ma nascosti
//      correttamente dietro i muri grazie alla profondità del passo 2.
// =============================================================
import { mat4, mul4, invert, normalMat3, perspective } from './math.js';

const TOON_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUv;
layout(location=3) in vec3 aColor;
uniform mat4 uProj;
uniform mat4 uModelView;
uniform mat3 uNormalMat;
uniform vec2 uUvScale;
out vec3 vPosV;
out vec3 vNormalV;
out vec2 vUv;
out vec3 vColor;
void main() {
  vec4 pv = uModelView * vec4(aPos, 1.0);
  vPosV = pv.xyz;
  vNormalV = normalize(uNormalMat * aNormal);
  vUv = aUv * uUvScale;
  vColor = aColor;
  gl_Position = uProj * pv;
}`;

const TOON_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
in vec3 vPosV;
in vec3 vNormalV;
in vec2 vUv;
in vec3 vColor;
uniform vec3 uColor;
uniform vec3 uEmissive;
uniform sampler2D uMap;
uniform sampler2D uEmMap;
uniform float uUseMap;
uniform float uUseEm;
uniform float uLit;
uniform float uFogOn;
uniform float uAlphaTest;
uniform float uInkId;
uniform float uFlash;
uniform vec3 uAmbSky;
uniform vec3 uAmbGround;
uniform vec3 uUpV;
uniform vec3 uDirV;
uniform vec3 uDirColor;
uniform int uNumPoints;
uniform vec3 uPointPos[8];
uniform vec3 uPointColor[8];
uniform float uPointRange[8];
uniform vec3 uFogColor;
uniform vec2 uFog;
layout(location=0) out vec4 oColor;
layout(location=1) out vec4 oNormal;

// rampa a tre gradini: ombra, mezzatinta, luce
float band(float x) { return x < 0.2 ? 0.0 : (x < 0.6 ? 0.55 : 1.0); }

void main() {
  vec4 tex = uUseMap > 0.5 ? texture(uMap, vUv) : vec4(1.0);
  if (uAlphaTest > 0.0 && tex.a < uAlphaTest) discard;
  vec3 N = normalize(vNormalV);
  if (!gl_FrontFacing) N = -N;
  vec3 base = uColor * vColor * tex.rgb;
  vec3 light = vec3(1.0);
  if (uLit > 0.5) {
    float h = dot(N, uUpV) * 0.5 + 0.5;
    light = mix(uAmbGround, uAmbSky, h);
    light += uDirColor * band(max(dot(N, uDirV), 0.0));
    for (int i = 0; i < 8; i++) {
      if (i >= uNumPoints) break;
      vec3 L = uPointPos[i] - vPosV;
      float d = length(L);
      float att = clamp(1.0 - d / uPointRange[i], 0.0, 1.0);
      att *= att;
      float nl = max(dot(N, L / max(d, 0.0001)), 0.0);
      float v = att * (0.35 + 0.65 * nl);
      v = floor(v * 4.0 + 0.35) / 4.0;   // anelli di luce a gradini
      light += uPointColor[i] * v;
    }
  }
  vec3 col = base * light;
  float em = uUseEm > 0.5 ? texture(uEmMap, vUv).r : 1.0;
  col += uEmissive * em;
  col = mix(col, vec3(1.0, 0.97, 0.9), uFlash);
  if (uFogOn > 0.5) {
    float fog = smoothstep(uFog.x, uFog.y, length(vPosV));
    col = mix(col, uFogColor, fog);
  }
  oColor = vec4(col, 1.0);
  oNormal = vec4(N * 0.5 + 0.5, uInkId);
}`;

const COMP_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const COMP_FS = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
uniform sampler2D uColorTex;
uniform sampler2D uNormalTex;
uniform sampler2D uDepthTex;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform vec3 uInk;
uniform vec2 uFog;
uniform float uThick;
uniform vec4 uFlash;
uniform float uLow;
uniform float uVignette;
uniform float uTime;
out vec4 oColor;

float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }

// un campione vicino: accumula 1/z e controlla pieghe delle normali e cambi di oggetto
void edgeSample(vec2 uv, vec3 N0, float a0, inout float edge, inout float wsum) {
  float zi = linZ(texture(uDepthTex, uv).r);
  wsum += 1.0 / zi;
  vec4 ni = texture(uNormalTex, uv);
  float nd = 1.0 - dot(N0, ni.xyz * 2.0 - 1.0);
  edge = max(edge, smoothstep(0.35, 0.6, nd));
  if (abs(a0 - ni.a) > 0.002) edge = 1.0;
}

void main() {
  float d0 = texture(uDepthTex, vUv).r;
  float z0 = linZ(d0);
  float w0 = 1.0 / z0;
  vec4 n0 = texture(uNormalTex, vUv);
  vec3 N0 = n0.xyz * 2.0 - 1.0;
  vec2 o = uTexel * uThick;
  float edge = 0.0;
  float wsum = 0.0;
  edgeSample(vUv + vec2(o.x, 0.0), N0, n0.a, edge, wsum);
  edgeSample(vUv - vec2(o.x, 0.0), N0, n0.a, edge, wsum);
  edgeSample(vUv + vec2(0.0, o.y), N0, n0.a, edge, wsum);
  edgeSample(vUv - vec2(0.0, o.y), N0, n0.a, edge, wsum);
  // laplaciano su 1/z: zero sulle superfici piane, alto sulle sagome
  float lap = abs(wsum - 4.0 * w0) / w0;
  edge = max(edge, smoothstep(0.05, 0.12, lap));
  vec3 col = texture(uColorTex, vUv).rgb;
  // id = 1.0: oggetti lontanissimi senza nebbia (l'Occhio nel cielo) mantengono l'inchiostro
  float fog = n0.a > 0.995 ? 0.0 : smoothstep(uFog.x, uFog.y, z0);
  col = mix(col, uInk, edge * (1.0 - fog) * 0.92);
  vec2 c = vUv - 0.5;
  float vig = dot(c, c);
  col *= 1.0 - uVignette * vig * 1.6;
  float edgeMask = smoothstep(0.05, 0.45, vig);
  col = mix(col, uFlash.rgb, uFlash.a * (0.35 + 0.65 * edgeMask));
  float pulse = uLow * (0.55 + 0.45 * sin(uTime * 6.0));
  col = mix(col, vec3(0.45, 0.02, 0.12), pulse * edgeMask * 0.85);
  float gr = fract(sin(dot(vUv * 913.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
  col += (gr - 0.5) * 0.025;
  oColor = vec4(col, 1.0);
  gl_FragDepth = d0;
}`;

// Composizione di riserva, senza contorni: usata solo se il driver rifiuta quella completa
const COMP_FS_SAFE = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
uniform sampler2D uColorTex;
uniform sampler2D uDepthTex;
out vec4 oColor;
void main() {
  oColor = vec4(texture(uColorTex, vUv).rgb, 1.0);
  gl_FragDepth = texture(uDepthTex, vUv).r;
}`;

const FX_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aCenter;
layout(location=1) in vec2 aCorner;
layout(location=2) in vec4 aColor;
layout(location=3) in vec2 aSizeStyle;
uniform mat4 uView;
uniform mat4 uProj;
uniform vec2 uFog;
out vec2 vCorner;
out vec4 vColor;
out float vStyle;
void main() {
  vec4 pv = uView * vec4(aCenter, 1.0);
  pv.xy += aCorner * aSizeStyle.x;
  gl_Position = uProj * pv;
  vCorner = aCorner;
  float fog = smoothstep(uFog.x, uFog.y * 1.2, length(pv.xyz));
  vColor = vec4(aColor.rgb, aColor.a * (1.0 - fog));
  vStyle = aSizeStyle.y;
}`;

const FX_FS = `#version 300 es
precision highp float;
in vec2 vCorner;
in vec4 vColor;
in float vStyle;
uniform vec3 uInk;
out vec4 oColor;
void main() {
  float d = length(vCorner);
  if (d > 1.0) discard;
  if (vStyle < 0.5) {            // bagliore morbido
    float a = pow(1.0 - d, 1.8);
    oColor = vec4(vColor.rgb, vColor.a * a);
  } else if (vStyle < 1.5) {     // sbuffo "cartoon" con bordo d'inchiostro
    if (d > 0.8) oColor = vec4(uInk, vColor.a);
    else oColor = vec4(vColor.rgb, vColor.a);
  } else if (vStyle < 2.5) {     // anello
    float a = smoothstep(0.55, 0.78, d) * (1.0 - smoothstep(0.9, 1.0, d));
    oColor = vec4(vColor.rgb, vColor.a * a);
  } else {                       // scintilla a quattro punte
    vec2 q = abs(vCorner);
    float a = max(1.0 - (q.x * 7.0 + q.y), 1.0 - (q.y * 7.0 + q.x));
    a = clamp(a, 0.0, 1.0) + pow(max(1.0 - d * 2.2, 0.0), 2.0);
    oColor = vec4(vColor.rgb, vColor.a * clamp(a, 0.0, 1.0));
  }
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    throw new Error('Errore shader: ' + log);
  }
  return s;
}

export function createProgram(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Errore link: ' + gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

// Carica una forma (Geo) sulla scheda video
export function createMesh(gl, geo) {
  const nv = geo.p.length / 3;
  const data = new Float32Array(nv * 11);
  let radius = 0;
  for (let v = 0; v < nv; v++) {
    const o = v * 11;
    data[o] = geo.p[v * 3]; data[o + 1] = geo.p[v * 3 + 1]; data[o + 2] = geo.p[v * 3 + 2];
    data[o + 3] = geo.n[v * 3]; data[o + 4] = geo.n[v * 3 + 1]; data[o + 5] = geo.n[v * 3 + 2];
    data[o + 6] = geo.uv[v * 2]; data[o + 7] = geo.uv[v * 2 + 1];
    data[o + 8] = geo.c[v * 3]; data[o + 9] = geo.c[v * 3 + 1]; data[o + 10] = geo.c[v * 3 + 2];
    radius = Math.max(radius, Math.hypot(data[o], data[o + 1], data[o + 2]));
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const stride = 44;
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 24);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, 32);
  const big = nv > 65535;
  const idx = big ? new Uint32Array(geo.i) : new Uint16Array(geo.i);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, vb, ib, count: idx.length, type: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, radius };
}

// Lotto di particelle: quadrati sempre rivolti alla camera
export class FxBatch {
  constructor(gl, max = 3000) {
    this.gl = gl; this.max = max; this.count = 0;
    this.data = new Float32Array(max * 4 * 11);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const s = 44;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, s, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, s, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, s, 20);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, s, 36);
    const idx = new Uint16Array(max * 6);
    for (let q = 0; q < max; q++) {
      const b = q * 4, o = q * 6;
      idx[o] = b; idx[o + 1] = b + 1; idx[o + 2] = b + 2; idx[o + 3] = b; idx[o + 4] = b + 2; idx[o + 5] = b + 3;
    }
    this.ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
  }

  // style: 0 bagliore, 1 sbuffo con inchiostro, 2 anello, 3 scintilla
  push(x, y, z, size, r, g, b, a, style = 0) {
    if (this.count >= this.max || a <= 0.003) return;
    const d = this.data;
    let o = this.count * 44;
    for (let k = 0; k < 4; k++) {
      d[o++] = x; d[o++] = y; d[o++] = z;
      d[o++] = k === 0 || k === 3 ? -1 : 1;
      d[o++] = k < 2 ? -1 : 1;
      d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a;
      d[o++] = size; d[o++] = style;
    }
    this.count++;
  }
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, depth: true, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('NO_WEBGL2');
    this.gl = gl;
    this.canvas = canvas;
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    this.toonP = createProgram(gl, TOON_VS, TOON_FS);
    try {
      this.compP = createProgram(gl, COMP_VS, COMP_FS);
    } catch (e) {
      console.warn('Inchiostro non supportato da questo driver, uso la versione semplice:', e.message);
      this.compP = createProgram(gl, COMP_VS, COMP_FS_SAFE);
      this.safeMode = true;
    }
    this.fxP = createProgram(gl, FX_VS, FX_FS);
    this.emptyVao = gl.createVertexArray();
    this.white = this.createTexture(Object.assign(document.createElement('canvas'), { width: 2, height: 2 }), { mips: false, white: true });
    this.view = mat4(); this.proj = mat4(); this.mv = mat4(); this.nm = new Float32Array(9);
    this.env = {
      ambSky: [0.42, 0.36, 0.55], ambGround: [0.2, 0.13, 0.25],
      dir: [0.45, 0.8, 0.35], dirColor: [0.72, 0.66, 0.55],
      fogColor: [0.11, 0.06, 0.16], fogNear: 22, fogFar: 85,
      ink: [0.07, 0.035, 0.1],
    };
    this.points = [];
    this.post = { flash: [0, 0, 0, 0], low: 0, vignette: 0.5, time: 0 };
    this.fxAlpha = new FxBatch(gl, 1500);
    this.fxAdd = new FxBatch(gl, 3000);
    this.target = null;
    this.thick = 1;
    this.stats = { draws: 0 };
    this._pp = new Float32Array(24); this._pc = new Float32Array(24); this._pr = new Float32Array(8);
  }

  createTexture(canvas, { repeat = true, mips = true, nearest = false, white = false } = {}) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (white) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      return t;
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    if (nearest) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    } else if (mips) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
    return t;
  }

  mesh(geo) { return createMesh(this.gl, geo); }

  setSize(w, h) {
    const gl = this.gl;
    w = Math.max(2, Math.floor(w)); h = Math.max(2, Math.floor(h));
    if (this.target && this.target.w === w && this.target.h === h) return;
    this.canvas.width = w; this.canvas.height = h;
    if (this.target) {
      gl.deleteFramebuffer(this.target.fb);
      gl.deleteTexture(this.target.color); gl.deleteTexture(this.target.normal); gl.deleteTexture(this.target.depth);
    }
    const mk = (internal, format, type, filter) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const color = mk(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
    const normal = mk(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
    const depth = mk(gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, normal, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Framebuffer incompleto: ' + st);
    this.target = { fb, color, normal, depth, w, h };
    this.thick = Math.max(1, h / 560);
  }

  // camera: { node (con world aggiornato), fov, near, far }
  render(scene, cam, sky = null) {
    const gl = this.gl, T = this.target, env = this.env;
    scene.updateWorld(null);
    if (sky) sky.updateWorld(null);
    invert(this.view, cam.node.world);
    const aspect = T.w / T.h;
    const fov = fovPerSchermo(cam.fov, aspect);
    perspective(this.proj, fov, aspect, cam.near, cam.far);
    this.cam = cam;
    this._ty = Math.tan(fov / 2); this._tx = this._ty * aspect;
    this._sy = Math.hypot(1, this._ty); this._sx = Math.hypot(1, this._tx);
    this.cullFar = env.fogFar + 10;

    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb);
    gl.viewport(0, 0, T.w, T.h);
    gl.clearBufferfv(gl.COLOR, 0, [env.fogColor[0], env.fogColor[1], env.fogColor[2], 1]);
    gl.clearBufferfv(gl.COLOR, 1, [0.5, 0.5, 1, 0]);
    gl.clearBufferfv(gl.DEPTH, 0, [1]);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    const P = this.toonP, u = P.u, V = this.view;
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(u.uProj, false, this.proj);
    gl.uniform3fv(u.uAmbSky, env.ambSky);
    gl.uniform3fv(u.uAmbGround, env.ambGround);
    gl.uniform3f(u.uUpV, V[4], V[5], V[6]);
    const d = env.dir, dl = Math.hypot(d[0], d[1], d[2]);
    gl.uniform3f(u.uDirV, (V[0] * d[0] + V[4] * d[1] + V[8] * d[2]) / dl, (V[1] * d[0] + V[5] * d[1] + V[9] * d[2]) / dl, (V[2] * d[0] + V[6] * d[1] + V[10] * d[2]) / dl);
    gl.uniform3fv(u.uDirColor, env.dirColor);
    const np = Math.min(8, this.points.length);
    for (let i = 0; i < np; i++) {
      const L = this.points[i], p = L.pos;
      this._pp[i * 3] = V[0] * p[0] + V[4] * p[1] + V[8] * p[2] + V[12];
      this._pp[i * 3 + 1] = V[1] * p[0] + V[5] * p[1] + V[9] * p[2] + V[13];
      this._pp[i * 3 + 2] = V[2] * p[0] + V[6] * p[1] + V[10] * p[2] + V[14];
      const k = L.intensity ?? 1;
      this._pc[i * 3] = L.color[0] * k; this._pc[i * 3 + 1] = L.color[1] * k; this._pc[i * 3 + 2] = L.color[2] * k;
      this._pr[i] = L.range;
    }
    gl.uniform1i(u.uNumPoints, np);
    gl.uniform3fv(u.uPointPos, this._pp);
    gl.uniform3fv(u.uPointColor, this._pc);
    gl.uniform1fv(u.uPointRange, this._pr);
    gl.uniform3fv(u.uFogColor, env.fogColor);
    gl.uniform2f(u.uFog, env.fogNear, env.fogFar);
    gl.uniform1i(u.uMap, 0);
    gl.uniform1i(u.uEmMap, 1);
    this.stats.draws = 0;

    if (sky) this._drawNode(sky, 0, true);
    this._drawNode(scene, 0, false);

    // ---- composizione con inchiostro ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.ALWAYS);
    gl.depthMask(true);
    const C = this.compP, cu = C.u;
    gl.useProgram(C.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.color);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.normal);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, T.depth);
    gl.uniform1i(cu.uColorTex, 0); gl.uniform1i(cu.uNormalTex, 1); gl.uniform1i(cu.uDepthTex, 2);
    gl.uniform2f(cu.uTexel, 1 / T.w, 1 / T.h);
    gl.uniform1f(cu.uNear, cam.near); gl.uniform1f(cu.uFar, cam.far);
    gl.uniform3fv(cu.uInk, env.ink);
    gl.uniform2f(cu.uFog, env.fogNear, env.fogFar);
    gl.uniform1f(cu.uThick, this.thick);
    gl.uniform4fv(cu.uFlash, this.post.flash);
    gl.uniform1f(cu.uLow, this.post.low);
    gl.uniform1f(cu.uVignette, this.post.vignette);
    gl.uniform1f(cu.uTime, this.post.time % 100);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // ---- effetti ----
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    const F = this.fxP, fu = F.u;
    gl.useProgram(F.p);
    gl.uniformMatrix4fv(fu.uView, false, this.view);
    gl.uniformMatrix4fv(fu.uProj, false, this.proj);
    gl.uniform2f(fu.uFog, env.fogNear, env.fogFar);
    gl.uniform3fv(fu.uInk, env.ink);
    for (const [batch, add] of [[this.fxAlpha, false], [this.fxAdd, true]]) {
      if (!batch.count) continue;
      if (add) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(batch.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, batch.vb);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch.data, 0, batch.count * 44);
      gl.drawElements(gl.TRIANGLES, batch.count * 6, gl.UNSIGNED_SHORT, 0);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    this.fxAlpha.count = 0;
    this.fxAdd.count = 0;
  }

  _drawNode(node, flash, isSky) {
    if (!node.visible) return;
    if (node.cullRadius !== undefined) {
      const w = node.world, V = this.view, x = w[12], y = w[13], z = w[14];
      const vx = V[0] * x + V[4] * y + V[8] * z + V[12];
      const vy = V[1] * x + V[5] * y + V[9] * z + V[13];
      const vz = V[2] * x + V[6] * y + V[10] * z + V[14];
      const r = node.cullRadius, dd = -vz;
      if (dd < -r || dd - r > this.cullFar) return;
      if (Math.abs(vx) > dd * this._tx + r * this._sx) return;
      if (Math.abs(vy) > dd * this._ty + r * this._sy) return;
    }
    const f = node.flash > flash ? node.flash : flash;
    if (node.mesh && node.material) this._drawMesh(node, f, isSky);
    const ch = node.children;
    for (let i = 0; i < ch.length; i++) this._drawNode(ch[i], f, isSky);
  }

  _drawMesh(node, flash, isSky) {
    const gl = this.gl, m = node.material, u = this.toonP.u;
    mul4(this.mv, this.view, node.world);
    normalMat3(this.nm, this.mv);
    gl.uniformMatrix4fv(u.uModelView, false, this.mv);
    gl.uniformMatrix3fv(u.uNormalMat, false, this.nm);
    gl.uniform3fv(u.uColor, m.color);
    const g = node.glow;
    if (g) gl.uniform3f(u.uEmissive, m.emissive[0] + g[0], m.emissive[1] + g[1], m.emissive[2] + g[2]);
    else gl.uniform3fv(u.uEmissive, m.emissive);
    gl.uniform2fv(u.uUvScale, m.uvScale);
    gl.uniform1f(u.uLit, m.lit ? 1 : 0);
    gl.uniform1f(u.uFogOn, m.fog ? 1 : 0);
    gl.uniform1f(u.uAlphaTest, m.alphaTest || 0);
    const ink = isSky || m.noInk ? 0 : node.inkNoFog ? 1 : (((node.inkId ?? node.id) % 251) + 1) / 255;
    gl.uniform1f(u.uInkId, ink);
    gl.uniform1f(u.uFlash, flash);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, m.map || this.white);
    gl.uniform1f(u.uUseMap, m.map ? 1 : 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, m.emMap || this.white);
    gl.uniform1f(u.uUseEm, m.emMap ? 1 : 0);
    if (m.doubleSided || isSky) gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);
    gl.depthMask(!isSky && m.depthWrite !== false);
    gl.bindVertexArray(node.mesh.vao);
    gl.drawElements(gl.TRIANGLES, node.mesh.count, node.mesh.type, 0);
    this.stats.draws++;
  }
}

// Il campo visivo del gioco è verticale e pensato per lo schermo orizzontale.
// Con il telefono in verticale la vista diventerebbe stretta come un tubo:
// lo allargo finché quello orizzontale arriva ad almeno 60°, senza superare i 100° in verticale.
const MIN_HFOV = 60 * Math.PI / 180;
const MAX_VFOV = 100 * Math.PI / 180;
export function fovPerSchermo(vfov, aspect) {
  if (aspect >= 1) return vfov;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  if (hfov >= MIN_HFOV) return vfov;
  return Math.min(MAX_VFOV, 2 * Math.atan(Math.tan(MIN_HFOV / 2) / aspect));
}
