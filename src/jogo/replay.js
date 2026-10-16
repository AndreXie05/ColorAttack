// ---------- REPETIÇÃO DA MELHOR JOGADA ----------
// Grava, 15 vezes por segundo, só números (posição, rotação, cor e vida de cada boneco + as bolas de tinta no ar) num buffer circular
// de 8 s com tamanho fixo (Float32Array: nada novo é criado durante o jogo). Quando eliminas alguém, a jogada recebe pontos
// (mais eliminações seguidas, cor certa, granada...); a melhor do round é copiada e, no fim do round, é reproduzida
// com os próprios bonecos do mapa e a tua câmara (vês a jogada como a viste a jogar; sem cópias da cena, sem modelos novos).
import { animateCharacter } from "../personagens/character-animator.js";
import { setCharacterPaint } from "../personagens/character-model.js";
import { COLORS } from "../base/colors.js";
import { MOTION } from "../movimento/player-motion.js";

const HZ = 15, STEP = 1 / HZ, SECONDS = 8, FRAMES = SECONDS * HZ;
const CH = 6;                    // por boneco: x, y, z, rotação, tempo eliminado (0 = vivo), cor
const CV = 7;                    // câmara: posição (x, y, z), ponto para onde olha (x, y, z) e campo de visão
const PMAX = 24, PF = 6;         // bolas de tinta por frame (no máximo) e números por bola: x, y, z, cor, tamanho, número (para as seguir entre frames)
const BEFORE = 2.5, AFTER = 1.2, CHAIN = 4, MIN_DMG = 60;   // segundos antes da 1.ª eliminação, depois da última, e intervalo máximo entre eliminações seguidas
const COLOR_IDS = Object.keys(COLORS), COLOR_IX = Object.fromEntries(COLOR_IDS.map((c, i) => [c, i]));

// Um bloco de frames (o buffer circular e o clipe guardado usam o mesmo formato)
class FrameStore {
  constructor(frames, chars) {
    this.frames = frames; this.chars = chars;
    this.t = new Float32Array(frames);                      // tempo de jogo de cada frame
    this.c = new Float32Array(frames * chars * CH);
    this.pn = new Uint8Array(frames);                       // quantas bolas de tinta há em cada frame
    this.p = new Float32Array(frames * PMAX * PF);
    this.v = new Float32Array(frames * CV);
  }
  copyFrame(dst, i, j) {                                    // frame i deste → frame j de dst
    dst.t[j] = this.t[i]; dst.pn[j] = this.pn[i];
    dst.c.set(this.c.subarray(i * this.chars * CH, (i + 1) * this.chars * CH), j * this.chars * CH);
    dst.p.set(this.p.subarray(i * PMAX * PF, i * PMAX * PF + this.pn[i] * PF), j * PMAX * PF);
    dst.v.set(this.v.subarray(i * CV, (i + 1) * CV), j * CV);
  }
}

export class Replay {
  // world: o CombatWorld; actors: [{ c: combatente, model }]; hooks: { camera } (a câmara do jogo, que é gravada)
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.buf = null; this.clip = null; this.playing = false;
  }

  // Novo mapa / novo round: começa a gravar do zero
  reset(world, actors) {
    this.world = world; this.actors = actors;
    if (!this.buf || this.buf.chars !== actors.length) { this.buf = new FrameStore(FRAMES, actors.length); this.clip = new FrameStore(FRAMES, actors.length); }
    this.head = 0; this.count = 0; this.acc = 0; this.gid = 0;
    this.best = null; this.chain = null; this.events = [];
  }

  // Chamado em cada frame do jogo (fora da contagem): só grava 15 vezes por segundo
  record(dt, gameTime) {
    if (!this.buf || this.playing) return;
    this.acc += dt;
    if (this.acc >= STEP) { this.acc %= STEP; this._snap(gameTime); }
    if (this.chain && gameTime >= this.chain.due) this._finish(gameTime);
  }
  _snap(time) {
    const b = this.buf, i = this.head;
    b.t[i] = time;
    let o = i * b.chars * CH;
    for (const { c, model } of this.actors) {
      const m = model || {};
      b.c[o] = c.pos.x; b.c[o + 1] = c.pos.y; b.c[o + 2] = c.pos.z; b.c[o + 3] = m.rotation ? m.rotation.y : 0;
      b.c[o + 4] = c.alive ? 0 : (c.deadT || 0.01);
      b.c[o + 5] = m.userData?.hex ?? 0xffffff;
      o += CH;
    }
    let n = 0, q = i * PMAX * PF;
    const P = this.world.projectiles;
    for (let k = 0; k < P.length && n < PMAX; k++) {
      const p = P[k]; if (!p.active) continue;
      b.p[q] = p.x; b.p[q + 1] = p.y; b.p[q + 2] = p.z; b.p[q + 3] = COLOR_IX[p.colorId] ?? 0; b.p[q + 4] = 1; b.p[q + 5] = k;
      q += PF; n++;
    }
    for (const g of this.world.grenades) {                                         // granadas e bolas do canhão: bolas maiores
      if (n >= PMAX) break;
      b.p[q] = g.x; b.p[q + 1] = g.y; b.p[q + 2] = g.z; b.p[q + 3] = COLOR_IX[g.colorId] ?? 0; b.p[q + 4] = 2.6; b.p[q + 5] = 1000 + (g._rid ||= ++this.gid % 1e5);
      q += PF; n++;
    }
    b.pn[i] = n;
    const cam = this.hooks.camera;                                                 // a câmara: posição e para onde olha (coluna "z" da matriz = para trás)
    if (cam) {
      const e = cam.matrixWorld.elements, v = i * CV;
      b.v[v] = e[12]; b.v[v + 1] = e[13]; b.v[v + 2] = e[14];
      b.v[v + 3] = e[12] - e[8] * 10; b.v[v + 4] = e[13] - e[9] * 10; b.v[v + 5] = e[14] - e[10] * 10; b.v[v + 6] = cam.fov;
    }
    this.head = (i + 1) % FRAMES; this.count = Math.min(FRAMES, this.count + 1);
  }

  // Alguém foi eliminado (para o salpico na repetição); se foste tu a eliminar, a jogada ganha pontos
  kill(killer, victim, gameTime, byColor, via) {
    if (!this.buf || this.playing) return;
    this.events.push({ t: gameTime, x: victim.pos.x, y: victim.pos.y + 1, z: victim.pos.z, color: victim.colorId });
    if (this.events.length > 40) this.events.shift();
    if (!killer?.isPlayer || killer.team === victim.team) return;
    const pts = 10 + (byColor ? 3 : 0) + (via !== "shot" ? 4 : 0);
    const ch = this._chain(gameTime);
    ch.kills++; ch.score += pts + (ch.kills > 1 ? 6 : 0); ch.last = gameTime; ch.due = gameTime + AFTER; ch.slow.push(gameTime); ch.done = false;
  }

  // Acertaste num adversário: o dano também conta (25 de dano = 1 ponto; uma eliminação vale 10 ou mais)
  hit(dmg, gameTime) {
    if (!this.buf || this.playing || !(dmg > 0)) return;
    const ch = this._chain(gameTime);
    ch.dmg += dmg; ch.score += dmg / 25; ch.last = gameTime; ch.due = gameTime + AFTER; ch.done = false;
  }
  _chain(t) { return this.chain && t - this.chain.last <= CHAIN ? this.chain : (this.chain = { start: t, kills: 0, dmg: 0, score: 0, slow: [] }); }

  // Fecha a jogada (1,2 s depois da última eliminação, ou já, se o round acabou) e guarda-a se for a melhor
  _finish(now) {
    const ch = this.chain;
    if (!ch || ch.done) return;
    ch.done = true;
    if (now - ch.last > CHAIN) this.chain = null;
    if (!ch.kills && ch.dmg < MIN_DMG) return;                                     // sem eliminações, só conta se tirou muito dano
    if (this.best && this.best.score >= ch.score) return;
    const from = Math.max(ch.start - BEFORE, now - SECONDS + STEP);
    const b = this.buf, oldest = (this.head - this.count + FRAMES) % FRAMES;
    let n = 0;
    for (let k = 0; k < this.count; k++) {
      const i = (oldest + k) % FRAMES;
      if (b.t[i] >= from - 1e-4 && b.t[i] <= now + 1e-4) b.copyFrame(this.clip, i, n++);
    }
    if (n < 4) return;
    this.best = { score: ch.score, kills: ch.kills, dmg: Math.round(ch.dmg), frames: n, slow: ch.slow.slice(), events: this.events.filter((e) => e.t >= this.clip.t[0] && e.t <= this.clip.t[n - 1]) };
  }

  // Há repetição para mostrar? (fecha a jogada que estiver a meio)
  has(gameTime) {
    if (this.chain && !this.chain.done) { this._snap(gameTime); this._finish(gameTime); }
    return !!this.best;
  }
  get kills() { return this.best?.kills || 0; }
  get damage() { return this.best?.dmg || 0; }

  // ---------- reprodução ----------
  play(camera, onDone) {
    if (!this.best) { onDone?.(); return; }
    this.playing = true; this.onDone = onDone; this.camera = camera;
    this.time = this.clip.t[0]; this.ev = 0; this.fov = 0;
    // guarda o estado dos bonecos e das bolas de tinta, para os repor no fim
    this.saved = this.actors.map(({ model }) => model && { x: model.position.x, y: model.position.y, z: model.position.z, ry: model.rotation.y, rx: model.rotation.x, hex: model.userData.hex, vis: model.visible });
    this.savedFov = camera.fov;
  }
  skip() { if (this.playing) this._stop(); }

  update(dt, t) {
    if (!this.playing) return;
    const B = this.best, clip = this.clip, end = clip.t[B.frames - 1];
    // câmara lenta perto das tuas eliminações
    const near = B.slow.some((k) => this.time > k - 0.45 && this.time < k + 0.35);
    this.time += dt * (near ? 0.35 : 1);
    if (this.time >= end) { this._stop(); return; }
    let i = 0;
    while (i < B.frames - 2 && clip.t[i + 1] <= this.time) i++;
    const f = Math.max(0, Math.min(1, (this.time - clip.t[i]) / Math.max(1e-4, clip.t[i + 1] - clip.t[i])));
    const C = clip.chars, a = i * C * CH, b = (i + 1) * C * CH;
    let me = null;
    this.actors.forEach(({ c, model }, k) => {
      if (!model) return;
      const o = a + k * CH, o2 = b + k * CH, d = clip.c;
      const x = d[o] + (d[o2] - d[o]) * f, y = d[o + 1] + (d[o2 + 1] - d[o + 1]) * f, z = d[o + 2] + (d[o2 + 2] - d[o + 2]) * f;
      let dr = d[o2 + 3] - d[o + 3]; dr -= Math.round(dr / (Math.PI * 2)) * Math.PI * 2;
      const dead = d[o + 4] > 0 ? d[o + 4] + (d[o2 + 4] > 0 ? (d[o2 + 4] - d[o + 4]) * f : 0) : 0;
      if (d[o + 5] !== model.userData.hex) setCharacterPaint(model, d[o + 5]);
      model.visible = true;
      model.position.set(x, y, z); model.rotation.y = d[o + 3] + dr * f;
      const speed = Math.hypot(d[o2] - d[o], d[o2 + 2] - d[o + 2]) * HZ;
      if (dead > 0) { model.rotation.order = "YXZ"; model.rotation.x = -Math.PI / 2 * Math.min(1, dead / 0.5); model.position.y = y + 0.4 * Math.min(1, dead / 0.5); }
      else {
        model.rotation.x = 0;
        animateCharacter(model, { speed, maxSpeed: MOTION.run, onGround: Math.abs(d[o2 + 1] - d[o + 1]) < 0.05, vy: (d[o2 + 1] - d[o + 1]) * HZ, landed: false, impact: 0, climbing: false, crouching: false }, dt, t);
      }
      if (c.isPlayer) me = model;
    });
    // bolas de tinta (usa as bolas do próprio combate: escondidas as que não estão no ar)
    const P = this.world.projectiles, pn = clip.pn[i], pp = i * PMAX * PF, pn2 = clip.pn[i + 1], pp2 = (i + 1) * PMAX * PF, D = clip.p;
    for (let k = 0; k < P.length; k++) {
      const m = P[k].mesh; if (!m) continue;
      if (k >= pn) { m.visible = false; continue; }
      const q = pp + k * PF;
      let q2 = -1;                                                                   // a mesma bola no frame seguinte (para a mover suavemente)
      for (let j = 0; j < pn2; j++) if (D[pp2 + j * PF + 5] === D[q + 5]) { q2 = pp2 + j * PF; break; }
      m.visible = true;
      if (q2 >= 0) m.position.set(D[q] + (D[q2] - D[q]) * f, D[q + 1] + (D[q2 + 1] - D[q + 1]) * f, D[q + 2] + (D[q2 + 2] - D[q + 2]) * f);
      else m.position.set(D[q], D[q + 1], D[q + 2]);
      m.material = this.world.mat(COLOR_IDS[clip.p[q + 3]] || "vermelho"); m.scale.setScalar(clip.p[q + 4]);
    }
    // salpicos das eliminações
    while (this.ev < B.events.length && B.events[this.ev].t <= this.time) { const e = B.events[this.ev++]; this.world.burst(e.x, e.y, e.z, e.color, 16); }
    this.world.updateParticles(dt);
    this._camera(i, f, near, me);
  }

  // A tua câmara, como estava durante o jogo (de costas para ti); na câmara lenta aproxima um pouco (zoom)
  _camera(i, f, near, me) {
    const cam = this.camera, V = this.clip.v, a = i * CV, b = (i + 1) * CV, L = (k) => V[a + k] + (V[b + k] - V[a + k]) * f;
    cam.position.set(L(0), L(1), L(2));
    cam.lookAt(L(3), L(4), L(5));
    const fov = L(6) * (near ? 0.8 : 1), k = 0.12;
    this.fov = this.fov ? this.fov + (fov - this.fov) * k : fov;
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    if (me && Math.hypot(cam.position.x - me.position.x, cam.position.z - me.position.z) < 0.8) me.visible = false;   // a mirar (1.ª pessoa): o teu boneco não tapa a vista
  }

  _stop() {
    this.playing = false;
    this.actors.forEach(({ model }, k) => {                                          // repõe os bonecos como estavam
      const s = this.saved[k]; if (!model || !s) return;
      model.position.set(s.x, s.y, s.z); model.rotation.y = s.ry; model.rotation.x = s.rx; model.visible = s.vis;
      if (s.hex !== undefined && s.hex !== model.userData.hex) setCharacterPaint(model, s.hex);
    });
    for (const p of this.world.projectiles) if (p.mesh) { p.mesh.visible = p.active; p.mesh.scale.setScalar(1); if (p.active) { p.mesh.position.set(p.x, p.y, p.z); p.mesh.material = this.world.mat(p.colorId); } }
    this.camera.fov = this.savedFov; this.camera.updateProjectionMatrix();
    this.best = null; this.chain = null;
    const cb = this.onDone; this.onDone = null; cb?.();
  }
}
