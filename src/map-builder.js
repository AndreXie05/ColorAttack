import * as THREE from "three";
import { ARENA, PAL, TEAM } from "./game-config.js";
import { mat, G, checkerTexture, soften } from "./materials-and-geometry.js";

/* ============================================================
   3. CONSTRUTOR DE MAPAS
   Cada mapa é uma função que devolve: grupo (cena), spawns das equipas,
   pontos de patrulha, luzes, obstáculos (colliders) e baús.
   ============================================================ */
export class MapBuilder {
  constructor(id, name) {
    this.id = id; this.name = name;
    this.root = new THREE.Group();
    this.cur = this.root; this.stack = [];
    this.colliders = []; this.chests = []; this.updaters = []; this.disposables = [];
    this.spawns = { A: [], B: [] }; this.patrol = []; this.lights = [];
    this.background = 0x8fd3ff; this.outerColor = 0x7fbf7f; this.skyTop = 0x2f8cff;
    this.vivid = false;
    this.shadows = true;                         // desligar para o cenário distante (poupa o mapa de sombras)
  }

  // --- hierarquia (grupos locais para rodar/posicionar adereços) ---
  begin(x, z, ry = 0, y = 0, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(scale);
    this.cur.add(g); this.stack.push(this.cur); this.cur = g;
    return g;
  }
  enter(g) { this.stack.push(this.cur); this.cur = g; return g; }
  end() { this.cur = this.stack.pop(); }
  mirror(fn) { fn(1); fn(-1); }                 // simetria esquerda/direita (eixo x)

  // material do cenário: pastel por defeito, vivo quando this.vivid está ligado
  m(color, opts) { return this.vivid ? mat(color, { ...opts, vivid: true }) : mat(color, opts); }

  // --- formas básicas (y = base, exceto onde indicado) ---
  _mesh(geo, material, x, y, z, shadow = true) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z); m.castShadow = shadow && this.shadows; m.receiveShadow = true;
    this.cur.add(m);
    return m;
  }
  box(x, y, z, w, h, d, color, opts)   { return this._mesh(G.box(w, h, d), this.m(color, opts), x, y + h / 2, z); }
  boxR(x, y, z, w, h, d, color, rx = 0, ry = 0, rz = 0) {   // y = centro
    const m = this._mesh(G.box(w, h, d), this.m(color), x, y, z); m.rotation.set(rx, ry, rz); return m;
  }
  cyl(x, y, z, r, h, color, rTop = r)  { return this._mesh(G.cyl(rTop, r, h), this.m(color), x, y + h / 2, z); }
  cylAxis(axis, x, y, z, r, len, color) {                    // y = centro
    const m = this._mesh(G.cyl(r, r, len), this.m(color), x, y, z);
    if (axis === "x") m.rotation.z = Math.PI / 2; else if (axis === "z") m.rotation.x = Math.PI / 2;
    return m;
  }
  sphere(x, y, z, r, color, opts)      { return this._mesh(G.sphere(r), this.m(color, opts), x, y, z); }   // y = centro
  torus(x, y, z, r, tube, color, rx = 0, ry = 0, rz = 0) {
    const m = this._mesh(G.torus(r, tube), this.m(color), x, y, z); m.rotation.set(rx, ry, rz); return m;
  }
  pyramid(x, y, z, w, d, h, color) {                         // telhado de 4 águas (y = base)
    const m = this._mesh(G.pyramid(h), this.m(color), x, y + h / 2, z); m.scale.set(w, 1, d); return m;
  }
  flat(x, z, w, d, color, y = 0.03) {                        // faixa/mancha no chão
    const m = this._mesh(G.plane(w, d), this.m(color), x, y, z, false); m.rotation.x = -Math.PI / 2; return m;
  }
  disc(x, z, r, color, y = 0.04) {
    const m = this._mesh(G.circle(r), this.m(color), x, y, z, false); m.rotation.x = -Math.PI / 2; return m;
  }

  // --- chão xadrez (pode ser um remendo noutra zona) ---
  ground(c1, c2, tile = 5, w = ARENA.halfX * 2, d = ARENA.halfZ * 2, x = 0, z = 0, y = 0) {
    const tex = checkerTexture(this.vivid ? c1 : soften(c1), this.vivid ? c2 : soften(c2), w / (2 * tile), d / (2 * tile));
    const material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0 });
    this.disposables.push(tex, material);
    const m = new THREE.Mesh(G.plane(w, d), material);
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true;
    this.cur.add(m);
    return m;
  }

  // --- obstáculos (coordenadas locais ao grupo atual) ---
  _world(lx, lz) {
    this.cur.updateWorldMatrix(true, false);
    const p = new THREE.Vector3(lx, 0, lz).applyMatrix4(this.cur.matrixWorld);
    const q = new THREE.Quaternion(); this.cur.getWorldQuaternion(q);
    return { x: p.x, z: p.z, yaw: 2 * Math.atan2(q.y, q.w), k: this.cur.getWorldScale(new THREE.Vector3()).x };
  }
  solid(lx, lz, w, d, top) {                                  // caixa (a rotação do grupo conta)
    const { x, z, yaw, k } = this._world(lx, lz);
    const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
    const hw = k * (c * w + s * d) / 2, hd = k * (s * w + c * d) / 2;
    this.colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, top: top * k });
  }
  solidCircle(lx, lz, r, top) {
    const { x, z, k } = this._world(lx, lz);
    this.colliders.push({ x, z, r: r * k, top: top * k });
  }

  // --- pontos de patrulha simétricos ---
  patrolPairs(list) {
    for (const [x, z] of list) {
      this.patrol.push({ x, z });
      if (x !== 0) this.patrol.push({ x: -x, z });
    }
  }

  // --- luzes: ambiente forte + sol com sombras suaves ---
  lighting({ sky = 0xffffff, ground = 0xffe3b0, hemi = 1.45, sun = 0xffffff, sunI = 1.5, pos = [35, 70, 25] } = {}) {
    const h = new THREE.HemisphereLight(sky, ground, hemi);
    const d = new THREE.DirectionalLight(sun, sunI);
    d.position.set(...pos);
    d.castShadow = true;
    d.shadow.mapSize.set(2048, 2048);
    const sc = d.shadow.camera;
    sc.left = -78; sc.right = 78; sc.top = 58; sc.bottom = -58; sc.near = 1; sc.far = 220;
    d.shadow.bias = -0.0006; d.shadow.radius = 3;
    this.root.add(h, d);
    this.lights.push(h, d);
  }

  // --- baú (abre com E, 80% prémio / 20% vazio, volta ao fim de 60 s, 3 aberturas por round) ---
  chest(x, z, ry = 0) {
    const prevVivid = this.vivid; this.vivid = true;           // baús sempre vivos
    const g = this.begin(x, z, ry, 0, 0.9);
    const body = this.box(0, 0, 0, 1.9, 1.0, 1.3, 0x9a5b2e);
    this.box(-0.6, 0, 0, 0.18, 1.02, 1.32, 0xffc61a);
    this.box( 0.6, 0, 0, 0.18, 1.02, 1.32, 0xffc61a);
    this.box(0, 0.5, 0.67, 0.34, 0.34, 0.1, 0xffc61a);
    const pivot = new THREE.Group();
    pivot.position.set(0, 1.0, -0.65);
    g.add(pivot);
    this.enter(pivot);
    this.box(0, 0, 0.65, 1.9, 0.45, 1.3, 0xb8723a);
    this.box(-0.6, 0, 0.65, 0.18, 0.47, 1.32, 0xffc61a);
    this.box( 0.6, 0, 0.65, 0.18, 0.47, 1.32, 0xffc61a);
    this.end();
    const gem = this._mesh(G.octa(0.38), mat(PAL.yellow, { emissive: 0xb08a00 }), 0, 2.4, 0);
    this.solidCircle(0, 0, 1.1, 1.0);
    const w = this._world(0, 0);                                // posição do baú no mundo
    this.end();
    this.vivid = prevVivid;
    this.chests.push({
      id: this.chests.length, x: w.x, z: w.z, group: g, pivot, gem, body, bodyMat: body.material,
      opens: 0, state: "ready", cooldown: 0, openTimer: 0, lid: 0, lidTarget: 0,
    });
  }

  // Muitos baús pequenos, encostados a objetos ou às paredes, mas espalhados (distância mínima entre eles).
  // Escolhe sempre pares simétricos (x e -x); a sequência é determinística para cada mapa.
  scatterChests({ pairs = 9, maxWallPairs = 3, minGap = 14 } = {}) {
    const hx = ARENA.halfX, hz = ARENA.halfZ, R = 0.99;
    let seed = 0; for (const ch of this.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const isShell = (c) => c.r === undefined &&
      (c.minZ >= hz - 0.01 || c.maxZ <= -hz + 0.01 || c.minX >= hx - 0.01 || c.maxX <= -hx + 0.01);
    const objs = this.colliders.filter((c) => !isShell(c));
    const dist = (x, z, c) => {
      if (c.r !== undefined) return Math.hypot(x - c.x, z - c.z) - c.r;
      const nx = Math.max(c.minX, Math.min(x, c.maxX)), nz = Math.max(c.minZ, Math.min(z, c.maxZ));
      return Math.hypot(x - nx, z - nz);
    };
    const roomy = (x, z) => {                                          // não pode ficar entalado: precisa de acesso
      let open = 0;
      for (let a = 0; a < 8; a++) {
        const px = x + Math.cos(a * Math.PI / 4) * 2.2, pz = z + Math.sin(a * Math.PI / 4) * 2.2;
        if (Math.abs(px) < hx - 1 && Math.abs(pz) < hz - 1 && objs.every((c) => dist(px, pz, c) > 0.6)) open++;
      }
      return open >= 3;
    };
    const ok = (x, z) => objs.every((c) => dist(x, z, c) >= R + 0.25) && roomy(x, z) &&
      !(Math.abs(x) > 36 && Math.abs(z) < 10.5);                       // não em cima dos pontos de reaparecimento
    const cand = [];                                                   // {x, z, ry, wall}
    const off = R + 0.35;
    for (const c of objs) {
      if (c.top < 1.4 || c.ramp || c.bottom || c.spin || c.bounce || c.push) continue;                             // baixos demais para servirem de encosto (e as rampas ficam livres)
      const spots = [];
      if (c.r !== undefined) {
        for (let a = 0; a < 6; a++) spots.push([c.x + Math.cos(a * Math.PI / 3) * (c.r + off), c.z + Math.sin(a * Math.PI / 3) * (c.r + off), Math.cos(a * Math.PI / 3), Math.sin(a * Math.PI / 3)]);
      } else {
        const stepX = Math.max(1, Math.ceil((c.maxX - c.minX) / 5)), stepZ = Math.max(1, Math.ceil((c.maxZ - c.minZ) / 5));
        for (let i = 0; i < stepX; i++) {
          const x = c.minX + (i + 0.5) * (c.maxX - c.minX) / stepX;
          spots.push([x, c.minZ - off, 0, -1], [x, c.maxZ + off, 0, 1]);
        }
        for (let i = 0; i < stepZ; i++) {
          const z = c.minZ + (i + 0.5) * (c.maxZ - c.minZ) / stepZ;
          spots.push([c.minX - off, z, -1, 0], [c.maxX + off, z, 1, 0]);
        }
      }
      for (const [x, z, dx, dz] of spots) cand.push({ x, z, ry: Math.atan2(dx, dz), wall: false });
    }
    for (const x of [8, 16, 24, 32, 40, 46]) for (const sz of [-1, 1]) cand.push({ x, z: sz * (hz - 1.1), ry: sz < 0 ? 0 : Math.PI, wall: true });
    for (const sz of [-1, 1]) cand.push({ x: hx - 1.1, z: sz * 26, ry: -Math.PI / 2, wall: true }, { x: 43, z: sz * 13.5, ry: -Math.PI / 2, wall: true });
    const valid = cand.filter((c) => c.x >= 6.5 && Math.abs(c.x) < hx - 0.9 && Math.abs(c.z) < hz && ok(c.x, c.z));
    for (let i = valid.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [valid[i], valid[j]] = [valid[j], valid[i]]; }
    const chosen = []; let wallPairs = 0;
    const far = (c) => chosen.every((o) => Math.hypot(c.x - o.x, c.z - o.z) >= minGap && Math.hypot(c.x + o.x, c.z - o.z) >= minGap);
    for (const c of valid) {
      if (chosen.length >= pairs) break;
      if (c.wall && wallPairs >= maxWallPairs) continue;
      if (!far(c)) continue;
      chosen.push(c); if (c.wall) wallPairs++;
    }
    for (const c of chosen) { this.chest(c.x, c.z, c.ry); this.chest(-c.x, c.z, -c.ry); }
  }

  finish() {
    // chão exterior grande para a vista aérea não mostrar o vazio
    if (this.outerColor !== null) {                      // (null = o próprio mapa traz o chão exterior)
      const outer = new THREE.Mesh(G.plane(600, 600), mat(this.outerColor));
      outer.rotation.x = -Math.PI / 2; outer.position.y = -0.06; outer.receiveShadow = true;
      this.root.add(outer);
    }
    return {
      id: this.id, name: this.name, group: this.root, background: this.background, skyTop: this.skyTop,
      colliders: this.colliders, ladders: this.ladders || [], chests: this.chests, updaters: this.updaters,
      spawns: this.spawns, patrol: this.patrol, lights: this.lights, disposables: this.disposables,
    };
  }
}

/* ============================================================
   4. ELEMENTOS COMUNS DOS MAPAS (muralhas, bases)
   ============================================================ */
export function shell(b, color, h = 3.2) {
  const t = 1.5, hx = ARENA.halfX, hz = ARENA.halfZ;
  b.box(0, 0, -hz - t / 2, hx * 2 + t * 2, h, t, color);
  b.box(0, 0,  hz + t / 2, hx * 2 + t * 2, h, t, color);
  b.box(-hx - t / 2, 0, 0, t, h, hz * 2, color);
  b.box( hx + t / 2, 0, 0, t, h, hz * 2, color);
  b.solid(0, -hz - t / 2, hx * 2 + t * 2, t, h);
  b.solid(0,  hz + t / 2, hx * 2 + t * 2, t, h);
  b.solid(-hx - t / 2, 0, t, hz * 2, h);
  b.solid( hx + t / 2, 0, t, hz * 2, h);
}

// Base de cada equipa: placa colorida, bandeiras e 5 pontos de reaparecimento
// mistura uma cor com branco (t = 0..1)
const tint = (c, t) => { const m = (v) => Math.round(v + (255 - v) * t); return (m((c >> 16) & 255) << 16) | (m((c >> 8) & 255) << 8) | m(c & 255); };
export function baseSetup(b) {
  b.vivid = true;
  b.mirror(s => {
    const team = s < 0 ? "A" : "B", col = TEAM[team].color;
    b.flat(s * 43, 0, 12, 18, col, 0.02);                       // abaixo da camada de tinta (0.045) para a tinta se ver por cima
    b.flat(s * 43, 0, 9.4, 14.6, tint(col, 0.6), 0.026);
    for (let i = 0; i < 5; i++) {
      const z = -6 + i * 3;
      b.disc(s * 42.5, z, 0.9, col, 0.032);
      b.spawns[team].push({ x: s * 42.5, z, ry: -s * Math.PI / 2 });   // virados para o centro
    }
    for (const z of [-9, 9]) {
      b.begin(s * 48.5, z);
      b.cyl(0, 0, 0, 0.2, 7, 0xeeeeee);
      b.box(-s * 1.3, 4.9, 0, 2.4, 1.5, 0.1, col);
      b.sphere(0, 7.1, 0, 0.35, PAL.yellow);
      b.end();
    }
  });
  b.vivid = false;
}

// Parede com aberturas (portas): segs = lista de [z0, z1] com parede
export const DOOR_SEGS = [[-35, -28], [-20, -4], [4, 20], [28, 35]];
export function wallSegs(b, xc, segs, color, accent, h = 5) {
  for (const [z0, z1] of segs) {
    const d = z1 - z0, zc = (z0 + z1) / 2;
    b.box(xc, 0, zc, 1.2, h, d, color);
    b.box(xc, h, zc, 1.5, 0.3, d, accent);
    b.solid(xc, zc, 1.2, d, h);
  }
}

