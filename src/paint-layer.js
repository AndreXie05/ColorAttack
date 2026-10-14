import * as THREE from "three";
import { ARENA, CONFIG } from "./game-config.js";
import { css } from "./colors.js";
import { topAt } from "./surfaces.js";

/* ============================================================
   TINTA NO CHÃO
   Uma textura transparente por cima do chão onde se "carimbam" manchas com bordas irregulares, gotas e escorridos.
   Cada mancha tem vida: ao fim de CONFIG.paint.lifeSeconds (15 s) desaparece, esbatendo-se nos últimos segundos.
   Cada mancha é desenhada com uma semente, por isso pode ser redesenhada igual quando outras desaparecem.
   A tinta é só visual: só as poças dos eliminados e das armadilhas (em combat.js) mudam a cor de quem as pisa.
   Os topos das plataformas (obstáculos com `paint` e as rampas) mostram a mesma textura, por isso a tinta que cai
   em cima de uma plataforma aparece lá em cima (a textura é a vista de cima do mapa: cada ponto x, z só tem uma cor).
   ============================================================ */
const RES = 14;                                           // pixels por metro (a textura tem 1400 x 980)
const MAX = 260;                                          // máximo de manchas ao mesmo tempo
const mulberry = (a) => () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export class PaintLayer {
  constructor(parent, colliders = []) {
    this.parent = parent;
    this.w = ARENA.halfX * 2 * RES; this.h = ARENA.halfZ * 2 * RES;
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.w; this.canvas.height = this.h;
    this.ctx = this.canvas.getContext("2d");
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.material = new THREE.MeshStandardMaterial({
      map: this.tex, transparent: true, roughness: 0.3, metalness: 0, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.halfX * 2, ARENA.halfZ * 2), this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.045;
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 1;
    parent.add(this.mesh);
    this.tops = this._buildTops(colliders);
    if (this.tops) parent.add(this.tops);
    this.records = [];                                    // { x, z, colorId, radius, seed, t0 }
    this.t = 0; this.dirty = false; this.lastRedraw = 0; this.seedCounter = 1;
    this.uploadMs = 160;                                  // de quanto em quanto tempo a textura vai para a placa gráfica (a qualidade muda isto)
  }

  get count() { return this.records.length; }

  // Uma só malha com o topo de cada plataforma, com as coordenadas da textura iguais às do chão (u = x, v = z)
  _buildTops(colliders) {
    const pos = [], uv = [], idx = [], hx = ARENA.halfX, hz = ARENA.halfZ, lift = 0.03;
    const vert = (x, y, z) => { pos.push(x, y + lift, z); uv.push((x + hx) / (2 * hx), 1 - (z + hz) / (2 * hz)); return pos.length / 3 - 1; };
    for (const c of colliders) {
      if ((!c.paint && !c.ramp) || c.spin) continue;                   // (os carrosséis rodam: a tinta não ficaria no sítio)
      if (c.r !== undefined) {                                          // disco
        const n = 20, o = vert(c.x, c.top, c.z);
        for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; vert(c.x + Math.cos(a) * c.r, c.top, c.z + Math.sin(a) * c.r); }
        for (let i = 0; i < n; i++) idx.push(o, o + 2 + i, o + 1 + i);
      } else {
        const y = (x, z) => topAt(c, x, z);
        const a = vert(c.minX, y(c.minX, c.minZ), c.minZ), b = vert(c.maxX, y(c.maxX, c.minZ), c.minZ);
        const d = vert(c.maxX, y(c.maxX, c.maxZ), c.maxZ), e = vert(c.minX, y(c.minX, c.maxZ), c.maxZ);
        idx.push(a, e, d, a, d, b);
      }
    }
    if (!idx.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, this.material);
    m.receiveShadow = true; m.renderOrder = 1;
    return m;
  }

  _px(x, z) { return [(x + ARENA.halfX) * RES, (z + ARENA.halfZ) * RES]; }

  // Desenha uma mancha (forma determinada pela semente); alpha < 1 enquanto se esbate
  _draw(rec, alpha = 1) {
    const ctx = this.ctx, rnd = mulberry(rec.seed), [cx, cy] = this._px(rec.x, rec.z), r = rec.radius * RES;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = css(rec.colorId);
    ctx.beginPath();
    const n = 14, pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, rr = r * (0.7 + rnd() * 0.5);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.fill();
    const drops = 5 + Math.floor(rnd() * 6);
    for (let i = 0; i < drops; i++) {
      const a = rnd() * Math.PI * 2, d = r * (1.0 + rnd() * 1.1), s = r * (0.07 + rnd() * 0.2);
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s * (1 + rnd() * 1.6), s, a, 0, Math.PI * 2);
      ctx.fill();
      if (rnd() < 0.5) {
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * d * 0.72, cy + Math.sin(a) * d * 0.72, d * 0.3, s * 0.55, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath(); ctx.ellipse(cx - r * 0.2, cy - r * 0.22, r * 0.3, r * 0.17, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  splat(x, z, colorId, radius = 1.6, team = null) {                        // team: equipa que pintou (para as zonas de território)
    const rec = { x, z, colorId, radius, team, seed: (this.seedCounter++ * 2654435761) >>> 0, t0: this.t };
    this.records.push(rec);
    if (this.records.length > MAX) this.records.shift();
    this._draw(rec);
    this.dirty = true;
  }

  // Avança o relógio da tinta; redesenha quando alguma mancha desaparece ou está a esbater-se
  update(dt) {
    this.t += dt;
    const life = CONFIG.paint.lifeSeconds * (this.lifeMul ?? 1), fade = Math.min(CONFIG.paint.fadeSeconds, life * 0.3);   // lifeMul: a chuva lava a tinta mais depressa
    // as manchas estão por ordem de criação: as que acabam e as que se esbatem são sempre as primeiras (sem criar listas novas em cada frame)
    const before = this.records.length;
    let gone = 0;
    while (gone < this.records.length && this.t - this.records[gone].t0 >= life) gone++;
    if (gone) this.records.splice(0, gone);
    const fading = this.records.length > 0 && this.t - this.records[0].t0 > life - fade;
    // redesenhar tudo custa: a esbater, 4 vezes por segundo chega (os olhos não notam a diferença)
    if ((this.records.length !== before || fading) && this.t - this.lastRedraw > 0.25) {
      this.lastRedraw = this.t;
      this.ctx.clearRect(0, 0, this.w, this.h);
      for (const r of this.records) {
        const age = this.t - r.t0;
        this._draw(r, age > life - fade ? Math.max(0, (life - age) / fade) : 1);
      }
      this.dirty = true;
    }
  }

  // Envia a textura para a placa gráfica no máximo de uploadMs em uploadMs (é grande, 1400 x 980: enviá-la muitas vezes aquece a placa)
  flush() {
    const now = performance.now();
    if (this.dirty && now - (this.sentAt || 0) > this.uploadMs) { this.tex.needsUpdate = true; this.dirty = false; this.sentAt = now; }
  }

  clear() { this.records = []; this.ctx.clearRect(0, 0, this.w, this.h); this.dirty = true; }

  dispose() {
    this.parent.remove(this.mesh);
    if (this.tops) { this.parent.remove(this.tops); this.tops.geometry.dispose(); }
    this.mesh.geometry.dispose(); this.material.dispose(); this.tex.dispose();
  }
}
