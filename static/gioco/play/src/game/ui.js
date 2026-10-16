// =============================================================
//  game/ui.js — HUD e schermate (DOM sopra il canvas)
// =============================================================
import { ANGEL_DEFS } from './angels.js';

export const LORE = {
  ofano: { name: 'OFANO', title: 'La ruota che guarda', text: 'Ruote dentro ruote, coperte d\'occhi. Gli Ofanim non pensano: registrano. Ogni peccato, ogni preghiera, ogni anima che passa viene contata e spedita in alto. Tieniti in movimento: sparano luce dritta e non sbagliano mai la mira, solo il tempo.', weak: 'Lento a girare. Attaccalo di lato, o con gli Artigli da vicino.' },
  serafino: { name: 'SERAFINO', title: 'Il volto coperto', text: 'Sei ali. Con due si copre il volto, con due i piedi, con due vola. Non lo fa per pudore: sotto le ali del volto non c\'è un viso, ma una bocca. Il "Santo, Santo, Santo" che cantano è il suono della masticazione.', weak: 'Quando apre le ali del volto sta per mordere: arretra e colpisci la bocca.' },
  cherubino: { name: 'CHERUBINO', title: 'I quattro volti', text: 'Uomo, leone, bue, aquila: i guardiani messi alla porta dell\'Eden perché nessuno tornasse a mangiare dall\'Albero. Non sono custodi. Sono carcerieri. Spara a ventaglio e non arretra mai.', weak: 'Grosso e lento. Il Thanateros da vicino lo apre come un libro.' },
  esattore: { name: 'L\'ESATTORE DI ANIME', title: 'Il carceriere del Chiostro', text: 'Il Parassita non scende mai di persona. Manda esattori. Nel petto dell\'Esattore una gabbia d\'oro trattiene le anime riscosse, in attesa di essere consumate. L\'aureola è fatta di occhi perché il suo padrone veda attraverso di lui.', weak: 'Spezza la gabbia nel petto. Quando chiama i Serafini, non inseguirli: resta su di lui.' },
};

const AMMO_NAMES = { fiamma: 'FIAMMA', ossa: 'OSSA', sigilli: 'SIGILLI' };

export class UI {
  constructor(root, game) {
    this.root = root; this.g = null; this.hud = {}; this._lastHud = {};
    this.areaT = null; this.hintT = null;
    this.build();
    void game;
  }

  $(sel) { return this.root.querySelector(sel); }

  build() {
    this.root.innerHTML = `
    <div id="hud">
      <div id="crosshair"><i></i><i></i><i></i><i></i></div>
      <div id="hp"><div class="lbl">VITA</div><div class="val" id="hpv">100</div><div class="bar"><div id="hpb"></div></div></div>
      <div id="ammo"><div class="lbl" id="ammok">FIAMMA</div><div class="val" id="ammov">70</div><div id="wname">FIAMMA NERA</div></div>
      <div id="slots"><span data-w="1">1</span><span data-w="2">2</span><span data-w="3">3</span><span data-w="4">4</span></div>
      <div id="key" hidden>◆ SIGILLO VIOLA</div>
      <div id="bossbar" hidden><div class="lbl" id="bossname"></div><div class="bar"><div id="bossb"></div></div></div>
      <div id="area"><div class="t"></div><div class="s"></div></div>
      <div id="hintbox"></div>
      <div id="hurt"></div>
      <div id="fps"></div>
      <div id="rotate">Gira il telefono in orizzontale per giocare meglio</div>
    </div>
    <div id="touch" hidden>
      <div id="t-stick"><div id="t-knob"></div></div>
      <button id="t-fire" type="button">ATTACCA</button>
      <button id="t-use" type="button">APRI</button>
      <button id="t-weapon" type="button">ARMA</button>
      <button id="t-pause" type="button">II</button>
    </div>
    <div id="title" class="screen">
      <div class="logo">TAUH</div>
      <h1>INCUBO</h1>
      <p class="tag">Livello 1 · La Breccia</p>
      <p class="intro">Hai squarciato il velo del Cielo del Parassita. Dentro, le anime che ha rubato gridano nelle gabbie. Sei un demone: il tuo compito è restituirle alla libertà, costi quel che costi.</p>
      <button id="btn-start" class="big">ENTRA NELLA BRECCIA</button>
      <button id="btn-bestiary">BESTIARIO</button>
      <div class="controls">
        <div><b>WASD</b> muoviti · <b>MOUSE</b> guarda · <b>CLIC</b> attacca</div>
        <div><b>1-4</b> / <b>ROTELLA</b> armi · <b>E</b> apri · <b>SHIFT</b> corri · <b>ESC</b> pausa</div>
      </div>
      <p class="credits">Musica: «Incubo» di Tauh</p>
    </div>
    <div id="pause" class="screen" hidden>
      <h1>PAUSA</h1>
      <button id="btn-resume" class="big">CONTINUA</button>
      <button id="btn-bestiary2">BESTIARIO</button>
      <div class="sliders">
        <label>Musica <input id="vol-music" type="range" min="0" max="1" step="0.05" value="0.75"></label>
        <label>Effetti <input id="vol-sfx" type="range" min="0" max="1" step="0.05" value="0.8"></label>
        <label>Sensibilità <input id="sens" type="range" min="0.3" max="2.5" step="0.1" value="1"></label>
      </div>
      <button id="btn-restart">RICOMINCIA</button>
    </div>
    <div id="dead" class="screen" hidden>
      <h1>RISCOSSO</h1>
      <p class="intro">La tua anima è stata conteggiata. Ma le anime, quassù, non restano in gabbia per sempre.</p>
      <button id="btn-retry" class="big">RITORNA</button>
    </div>
    <div id="won" class="screen" hidden>
      <h1>LE ANIME SONO LIBERE</h1>
      <p class="intro">Il Varco si chiude dietro di te. Da qualche parte più in alto, qualcosa ha smesso di mangiare per un istante e ha alzato lo sguardo.</p>
      <div class="stats" id="stats"></div>
      <p class="tag">FINE DEL LIVELLO 1 · L’incubo continua.</p>
      <button id="btn-again" class="big">RIGIOCA</button>
    </div>
    <div id="bestiary" class="screen" hidden>
      <div class="best-wrap">
        <div class="best-list" id="best-list"></div>
        <div class="best-card">
          <div class="best-title" id="best-title"></div>
          <div class="best-sub" id="best-sub"></div>
          <p id="best-text"></p>
          <p class="best-weak" id="best-weak"></p>
        </div>
      </div>
      <button id="btn-best-close">INDIETRO</button>
    </div>`;
    const list = this.$('#best-list');
    for (const k of Object.keys(LORE)) {
      const b = document.createElement('button'); b.textContent = LORE[k].name; b.dataset.k = k; list.appendChild(b);
      b.addEventListener('click', () => this.showBestiary(k));
    }
    this.screens = ['title', 'pause', 'dead', 'won', 'bestiary'];
  }

  bind(g) {
    this.g = g;
    const on = (id, fn) => this.$('#' + id).addEventListener('click', fn);
    on('btn-start', () => g.start());
    on('btn-resume', () => g.resume());
    on('btn-restart', () => g.restart());
    on('btn-retry', () => g.restart());
    on('btn-again', () => g.restart());
    on('btn-bestiary', () => this.openBestiary('title'));
    on('btn-bestiary2', () => this.openBestiary('pause'));
    on('btn-best-close', () => { this.setState(this.bestFrom || 'title'); if (this.bestFrom === 'pause') g.state = 'pause'; });
    this.$('#vol-music').addEventListener('input', (e) => g.audio.setMusicVolume(+e.target.value));
    this.$('#vol-sfx').addEventListener('input', (e) => g.audio.setSfxVolume(+e.target.value));
    this.$('#sens').addEventListener('input', (e) => { g.sensitivity = +e.target.value; });
    this.$('#slots').addEventListener('click', (e) => { const w = e.target.dataset.w; if (w) g.weapons.select(+w); });
  }

  openBestiary(from) { this.bestFrom = from; this.setState('bestiary'); this.showBestiary('ofano'); if (this.g) this.g.bestiary(true); }

  showBestiary(k) {
    const L = LORE[k], d = ANGEL_DEFS[k];
    this.$('#best-title').textContent = L.name;
    this.$('#best-sub').textContent = L.title + ' · ' + d.hp + ' PV';
    this.$('#best-text').textContent = L.text;
    this.$('#best-weak').textContent = 'Debolezza: ' + L.weak;
    for (const b of this.$('#best-list').children) b.classList.toggle('on', b.dataset.k === k);
    if (this.g) this.g.bestiaryShow(k);
  }

  enableTouch() {
    this.touch = true;
    this.$('#title .controls').innerHTML = '<div><b>SINISTRA</b> trascina per muoverti · <b>DESTRA</b> trascina per girarti</div><div><b>ATTACCA</b> tienilo premuto e trascinalo per mirare · <b>APRI</b> porte e segreti · <b>ARMA</b> cambia</div><div>La sensibilità si regola dalla pausa (II)</div>';
  }

  setState(s, data) {
    for (const id of this.screens) this.$('#' + id).hidden = id !== s;
    this.$('#touch').hidden = !(this.touch && s === 'play');
    this.$('#hud').classList.toggle('off', s !== 'play');
    if (s !== 'bestiary' && this.g) this.g.bestiary(false);
    if (s === 'won' && data) {
      const m = Math.floor(data.time / 60), sec = Math.floor(data.time % 60);
      this.$('#stats').innerHTML = `<div><span>ANGELI</span><b>${data.kills} / ${data.total}</b></div><div><span>SEGRETI</span><b>${data.secrets} / ${data.totalSecrets}</b></div><div><span>ANIME</span><b>${data.souls}</b></div><div><span>TEMPO</span><b>${m}:${String(sec).padStart(2, '0')}</b></div>`;
    }
  }

  setHud(h) {
    const L = this._lastHud;
    if (h.hp !== L.hp) { this.$('#hpv').textContent = h.hp; this.$('#hpb').style.width = Math.min(100, h.hp / 1.5) + '%'; this.$('#hp').classList.toggle('low', h.hp < 30); this.$('#hpb').classList.toggle('over', h.hp > 100); }
    if (h.weapon !== L.weapon) { this.$('#wname').textContent = h.weapon; this.$('#ammok').textContent = h.ammoKind ? AMMO_NAMES[h.ammoKind] : 'ARTIGLI'; }
    if (h.ammo !== L.ammo) this.$('#ammov').textContent = h.ammo === null ? '∞' : h.ammo;
    for (const s of this.$('#slots').children) { const w = +s.dataset.w; s.classList.toggle('on', w === h.weaponId); s.classList.toggle('owned', !!h.owned[w]); }
    this.$('#hurt').style.opacity = Math.min(1, h.hurt * 1.5);
    if (this.showFps) this.$('#fps').textContent = Math.round(h.fps) + ' fps';
    this._lastHud = { ...h, owned: { ...h.owned } };
  }

  setKey(on) { this.$('#key').hidden = !on; }
  showBoss(on, name) { this.$('#bossbar').hidden = !on; if (name) this.$('#bossname').textContent = name.toUpperCase(); }
  setBoss(f) { this.$('#bossb').style.width = Math.max(0, f * 100) + '%'; }

  showArea(t, s) {
    const a = this.$('#area');
    a.querySelector('.t').textContent = t; a.querySelector('.s').textContent = s || '';
    a.classList.remove('show'); void a.offsetWidth; a.classList.add('show');
    clearTimeout(this.areaT); this.areaT = setTimeout(() => a.classList.remove('show'), 4200);
  }

  hint(t) {
    const h = this.$('#hintbox');
    if (h.textContent === t && h.classList.contains('show')) { clearTimeout(this.hintT); this.hintT = setTimeout(() => h.classList.remove('show'), 1500); return; }
    h.textContent = t; h.classList.add('show');
    clearTimeout(this.hintT); this.hintT = setTimeout(() => h.classList.remove('show'), 1500);
  }
}
