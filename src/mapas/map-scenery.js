import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ARENA, PAL, PAINTS } from "../base/game-config.js";

/* ============================================================
   CENÁRIO À VOLTA DOS MAPAS
   A área jogável é fixa (100 x 70 m, não se expande); fora das muralhas
   há um cenário decorativo, sem colisões, para o mapa não parecer
   estar "no meio do nada". Cada tema tem a sua envolvente.
   ============================================================ */

function rng(seed) {                                    // aleatório com semente: o cenário é sempre igual
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEEP_X = ARENA.halfX + 4, KEEP_Z = ARENA.halfZ + 4;          // zona jogável + muralhas + folga
const hits = (list, x, z, m = 0) => list.some(([cx, cz, hw, hd]) => Math.abs(x - cx) < hw + m && Math.abs(z - cz) < hd + m);
const pick = (r, list) => list[Math.floor(r() * list.length)];

// Põe n objetos em posições aleatórias fora da arena e fora das zonas "avoid" ([cx, cz, meiaLargura, meiaProfundidade])
function scatter(r, n, spanX, spanZ, avoid, fn) {
  let placed = 0, tries = 0;
  while (placed < n && tries++ < n * 30) {
    const x = (r() * 2 - 1) * spanX, z = (r() * 2 - 1) * spanZ;
    if (Math.abs(x) < KEEP_X + 2 && Math.abs(z) < KEEP_Z + 2) continue;
    if (hits(avoid, x, z, 3)) continue;
    fn(x, z); placed++;
  }
}

/* ---------- peças ---------- */
function scenicTree(b, x, z, s, c) {
  b.cyl(x, 0, z, 0.5 * s, 3 * s, 0x8a5a2b, 0.35 * s);
  b.sphere(x, 4.2 * s, z, 2.3 * s, c);
  b.sphere(x + 1.2 * s, 3.5 * s, z + 0.5 * s, 1.5 * s, 0x2fb34e);
}

// janelas na face indicada ("+z", "-z", "+x", "-x") de um edifício
function windows(b, cx, cz, w, h, d, face, color, rows) {
  const onZ = face[1] === "z", len = onZ ? w : d, sgn = face[0] === "+" ? 1 : -1;
  const nx = Math.max(1, Math.floor(len / 5)), ny = rows ?? Math.max(1, Math.floor((h - 2) / 4));
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const u = -len / 2 + (i + 0.5) * len / nx, y = 2 + j * 4;
    if (onZ) b.box(cx + u, y, cz + sgn * (d / 2 + 0.06), 2.2, 2.4, 0.12, color);
    else b.box(cx + sgn * (w / 2 + 0.06), y, cz + u, 0.12, 2.4, 2.2, color);
  }
}

function house(b, x, z, w, d, h, wall, roof, face) {
  b.box(x, 0, z, w, h, d, wall);
  b.pyramid(x, h, z, w + 1.4, d + 1.4, h * 0.6, roof);
  windows(b, x, z, w, h, d, face, 0x9be7ff, 1);
}

function car(b, x, z, ry, color) {
  b.begin(x, z, ry);
  b.box(0, 0.4, 0, 4.2, 1.1, 2, color);
  b.box(-0.2, 1.5, 0, 2.2, 0.9, 1.8, 0xcfefff);
  for (const wx of [-1.4, 1.4]) for (const wz of [-1.0, 1.0]) b.cylAxis("z", wx, 0.45, wz, 0.45, 0.3, 0x222222);
  b.end();
}

function bus(b, x, z, ry) {
  b.begin(x, z, ry);
  b.box(0, 0.6, 0, 10, 2.6, 3, PAL.yellow);
  for (const sz of [-1.52, 1.52]) b.box(0, 2.0, sz, 9, 0.9, 0.1, 0x9be7ff);
  b.box(0, 0.9, 0, 10.1, 0.25, 3.05, 0x333333);
  for (const wx of [-3, 3]) for (const wz of [-1.4, 1.4]) b.cylAxis("z", wx, 0.6, wz, 0.6, 0.4, 0x222222);
  b.end();
}

function streetLamp(b, x, z) {
  b.cyl(x, 0, z, 0.2, 7, 0x444444);
  b.sphere(x, 7.3, z, 0.7, 0xfff3b0, { emissive: 0xffe066 });
}

function container(b, x, y, z, ry, color) {
  b.begin(x, z, ry, y);
  b.box(0, 0, 0, 12, 3, 3, color);
  for (let i = -5; i <= 5; i += 2.5) b.box(i, 0, 0, 0.25, 3.05, 3.05, 0x00000033 ? 0x2b2b2b : 0);
  b.end();
}

function road(b, cx, cz, w, d, marks = true) {
  b.flat(cx, cz, w, d, 0x4a4f5a, 0.02);
  if (marks && w > d) for (let x = cx - w / 2 + 4; x < cx + w / 2 - 4; x += 9) b.flat(x, cz, 4.5, 0.35, 0xffffff, 0.04);
}

// pavimento nos 4 lados da arena (nunca por baixo dela)
function pavement(b, color) {
  const hx = ARENA.halfX + 1.5, hz = ARENA.halfZ + 1.5;
  b.flat(0, -(hz + 30), 280, 60, color, -0.02);
  b.flat(0,  (hz + 30), 280, 60, color, -0.02);
  b.flat(-(hx + 40), 0, 80, hz * 2, color, -0.02);
  b.flat( (hx + 40), 0, 80, hz * 2, color, -0.02);
}

/* ---------- temas ---------- */
const THEMES = {

  // Parque: colinas, lago, muita árvore e casinhas ao longe
  park(b) {
    const r = rng(11), avoid = [[0, -72, 20, 16]];
    pavement(b, 0x62c24e);
    for (let i = 0; i < 12; i++) {                                    // colinas
      const a = (i / 12) * Math.PI * 2 + 0.2, rx = 150 + r() * 25, rz = 112 + r() * 20;
      const m = b.sphere(Math.cos(a) * rx, 0, Math.sin(a) * rz, 28 + r() * 16, pick(r, [0x3fae4c, 0x4cbf56, 0x35a047]));
      m.scale.y = 0.38;
    }
    b.disc(0, -72, 17, 0x4fc3f7, 0.03);                               // lago
    b.disc(0, -72, 19, 0xf4dca0, 0.025);
    b.flat(78, 0, 50, 6, 0xf4dca0, 0.03); b.flat(-78, 0, 50, 6, 0xf4dca0, 0.03);
    scatter(r, 95, 140, 100, avoid, (x, z) => scenicTree(b, x, z, 0.8 + r() * 0.9, pick(r, [0x35c75a, 0x3fd065, 0x2fb34e])));
    for (let i = 0; i < 9; i++) {                                     // casinhas
      const x = -100 + i * 25 + r() * 6, z = (i % 2 ? 1 : -1) * (84 + r() * 10);
      house(b, x, z, 10, 9, 7, pick(r, [0xffe0b2, 0xffccbc, 0xc5e1a5, 0xb3e5fc]), pick(r, [PAL.red, 0xd84315, 0x6d4c41]), z < 0 ? "+z" : "-z");
    }
  },

  // Escola: edifício principal com torre do relógio, ginásio, rua com autocarro e casas
  school(b) {
    const r = rng(23);
    const avoid = [[0, -64, 56, 14], [0, 49, 140, 7], [80, -30, 18, 24], [-80, -30, 18, 24]];
    pavement(b, 0x8fcf8f);
    b.box(0, 0, -64, 100, 14, 18, 0xffd89b);                          // edifício principal
    b.box(0, 14, -64, 102, 1, 20, PAL.red);
    windows(b, 0, -64, 100, 14, 18, "+z", 0x7fd0ff);
    b.box(0, 0, -53, 14, 6, 4, 0xffffff);                             // entrada
    for (const px of [-5, 5]) b.cyl(px, 0, -50.5, 0.6, 6, 0xffffff);
    b.box(0, 0, -50.9, 4, 4, 0.2, 0x8d5a2b);
    b.box(0, 15, -64, 11, 14, 11, 0xffd89b);                          // torre do relógio
    b.pyramid(0, 29, -64, 13, 13, 8, PAL.red);
    b.cylAxis("z", 0, 25, -58.3, 3, 0.4, 0xffffff);
    b.box(0, 24.8, -58.55, 0.3, 2.2, 0.15, 0x222222);
    b.box(0.6, 25.9, -58.55, 1.4, 0.3, 0.15, 0x222222);
    b.box(80, 0, -30, 30, 12, 40, 0x9ad4ff);  windows(b, 80, -30, 30, 12, 40, "-x", 0xffffff, 2);   // ginásio
    b.box(-80, 0, -30, 30, 12, 40, 0xffb3c6); windows(b, -80, -30, 30, 12, 40, "+x", 0xffffff, 2);  // biblioteca
    b.box(80, 12, -30, 31, 1, 41, PAL.blue); b.box(-80, 12, -30, 31, 1, 41, PAL.purple);
    road(b, 0, 49, 280, 9);                                            // rua
    b.flat(0, 42.5, 280, 3, 0xcfcfcf, 0.03);
    bus(b, -30, 51, 0); bus(b, 55, 47, Math.PI);
    [[-70, 47], [-10, 51], [20, 47], [80, 51], [100, 47]].forEach(([x, z], i) => car(b, x, z, z > 49 ? 0 : Math.PI, PAINTS[i % 6]));
    for (let i = 0; i < 11; i++) {                                     // casas atrás da rua
      const x = -120 + i * 24 + r() * 5;
      house(b, x, 68 + r() * 4, 11, 10, 8, pick(r, [0xffe0b2, 0xf8bbd0, 0xc5e1a5, 0xb3e5fc]), pick(r, [PAL.red, 0xd84315, 0x6d4c41]), "-z");
    }
    scatter(r, 45, 140, 95, avoid, (x, z) => scenicTree(b, x, z, 0.8 + r() * 0.8, pick(r, [0x35c75a, 0x3fd065, 0x2fb34e])));
  },

  // Restaurante: rua de cidade com prédios coloridos, candeeiros, carros e um letreiro gigante
  restaurant(b) {
    const r = rng(37);
    pavement(b, 0xcfc7c0);
    for (const sz of [-1, 1]) {
      road(b, 0, sz * 47, 280, 9);
      b.flat(0, sz * 41.5, 280, 3, 0xe0d9d2, 0.03);
      b.flat(0, sz * 53, 280, 3, 0xe0d9d2, 0.03);
      let x = -130;
      while (x < 130) {                                                // fila de prédios
        const w = 14 + Math.floor(r() * 9), h = 12 + Math.floor(r() * 20), cx = x + w / 2;
        if (!(Math.abs(cx) < 0)) {
          b.box(cx, 0, sz * 66, w, h, 16, pick(r, [0xffcdd2, 0xffe0b2, 0xfff9c4, 0xc8e6c9, 0xb3e5fc, 0xd1c4e9]));
          b.box(cx, h, sz * 66, w + 0.6, 0.8, 16.6, pick(r, [PAL.red, 0x455a64, 0x6d4c41]));
          windows(b, cx, sz * 66, w, h, 16, sz < 0 ? "+z" : "-z", 0xfff3b0, undefined);
          b.box(cx, 3.2, sz * 57.4, w * 0.8, 0.5, 2.6, pick(r, PAINTS));    // toldo
        }
        x += w + 1.5;
      }
      for (let lx = -120; lx <= 120; lx += 20) streetLamp(b, lx, sz * 43);
    }
    [[-90, 46], [-40, 48], [10, 46], [60, 48], [100, 46], [-20, -46], [35, -48], [80, -46], [-80, -48]].forEach(([x, z], i) => car(b, x, z, z > 0 ? 0 : Math.PI, PAINTS[i % 6]));
    for (const sx of [-1, 1]) {                                        // parques de estacionamento + letreiro
      b.flat(sx * 78, 0, 40, 60, 0x555a64, 0.025);
      for (let i = 0; i < 5; i++) { car(b, sx * 70, -22 + i * 11, Math.PI / 2, PAINTS[(i + 1) % 6]); car(b, sx * 86, -16 + i * 11, Math.PI / 2, PAINTS[(i + 3) % 6]); }
      b.cyl(sx * 62, 0, -34, 0.5, 14, 0x555555);
      b.cylAxis("z", sx * 62, 15, -34, 5, 0.8, PAL.yellow);
      for (const [dx, dy] of [[-2, 1], [2, 1.5], [0, -2.5], [-2.5, -1.5]]) b.cylAxis("z", sx * 62 + dx, 15 + dy, -33.5, 0.9, 0.9, PAL.red);
    }
  },

  // Parque de diversões: montanha-russa gigante, postes de luzes e tendas ao longe
  funfair(b) {
    const r = rng(53);
    pavement(b, 0xd9ccff);
    for (const sz of [-1, 1]) {                                        // montanha-russa
      let x = -135;
      while (x < 135) {
        const R = 8 + Math.floor(r() * 9), cx = x + R, z = sz * 64;
        for (const dz of [-1.3, 1.3]) b.torus(cx, 0, z + dz, R, 0.5, PAL.red);
        b.box(cx, R - 0.2, z, 0.5, 0.5, 3.0, PAL.yellow);
        b.box(cx, 0, z, 0.6, R * 0.8, 0.6, 0xeeeeee);
        x += R * 2 - 1.5;
      }
    }
    for (const sz of [-1, 1]) for (let x = -120; x <= 120; x += 14) {           // postes de luzes coloridas
      b.cyl(x, 0, sz * 43, 0.2, 9, 0xeeeeee);
      b.sphere(x, 9.4, sz * 43, 0.9, PAINTS[Math.abs(Math.round(x / 14)) % 6], { emissive: 0x555555 });
    }
    for (const sx of [-1, 1]) for (let z = -30; z <= 30; z += 14) {
      b.cyl(sx * 57, 0, z, 0.2, 9, 0xeeeeee);
      b.sphere(sx * 57, 9.4, z, 0.9, PAINTS[Math.abs(Math.round(z / 14)) % 6], { emissive: 0x555555 });
    }
    [[78, 0], [-78, 0], [90, 26], [-90, 26], [90, -26], [-90, -26], [70, 44], [-70, 44], [70, -44], [-70, -44]].forEach(([x, z], i) => {
      b.cyl(x, 0, z, 6, 2.2, PAINTS[i % 6]);
      b.cyl(x, 2.2, z, 6, 2.2, 0xffffff);
      b.cyl(x, 4.4, z, 6.8, 4.5, PAINTS[(i + 2) % 6], 0.2);
      b.sphere(x, 9.3, z, 0.6, PAL.yellow);
    });
    scatter(r, 35, 130, 95, [[0, -64, 140, 14], [0, 64, 140, 14]], (x, z) => scenicTree(b, x, z, 0.8 + r() * 0.7, pick(r, [0x35c75a, 0x3fd065])));
  },

  // Fábrica: contentores empilhados, chaminés, silos, armazéns, grua e linha de comboio
  factory(b) {
    const r = rng(71);
    pavement(b, 0x9aa5b1);
    for (let i = 0; i < 14; i++) {                                     // contentores
      const x = -120 + i * 18 + r() * 3;
      for (const sz of [-1, 1]) {
        container(b, x, 0, sz * (58 + r() * 3), Math.PI / 2 * (r() > 0.5 ? 1 : 0), pick(r, PAINTS));
        if (r() > 0.4) container(b, x, 3, sz * 58, 0, pick(r, PAINTS));
      }
    }
    [[-70, -80], [70, -80], [-70, 80], [70, 80], [-110, 0], [110, 0]].forEach(([x, z]) => {   // chaminés
      for (let k = 0; k < 6; k++) b.cyl(x, k * 6, z, 3.2 - k * 0.12, 6, k % 2 ? 0xffffff : PAL.red);
      for (let k = 0; k < 3; k++) b.sphere(x + k * 2.5, 38 + k * 3, z, 3 + k, 0xc9cdd3);
    });
    for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) {            // silos
      const x = sx * (78 + (i % 2) * 14), z = -36 + i * 14;
      b.cyl(x, 0, z, 5.5, 18, pick(r, [PAL.blue, PAL.yellow, 0xeceff1]));
      b.sphere(x, 18, z, 5.5, 0x90a4ae);
    }
    for (const sx of [-1, 1]) {                                        // armazéns
      b.box(sx * 38, 0, -78, 56, 14, 18, 0x607d8b);
      b.box(sx * 38, 14, -78, 58, 1.2, 20, PAL.red);
      for (let k = -2; k <= 2; k++) b.box(sx * 38 + k * 10, 0, -68.9, 7, 8, 0.2, 0x37474f);
    }
    b.flat(0, 49, 280, 12, 0x6d5d4f, 0.02);                            // linha de comboio
    for (const dz of [-2, 2]) b.flat(0, 49 + dz, 280, 0.4, 0xb0b0b0, 0.04);
    b.box(-30, 0.6, 49, 14, 5, 4, PAL.blue); b.box(-26, 5.6, 49, 4, 2, 4, PAL.yellow);
    for (let k = 0; k < 3; k++) b.box(-14 + k * 14, 0.6, 49, 12, 4, 4, PAINTS[(k + 2) % 6]);
    for (const sx of [-1, 1]) {                                        // grua
      b.box(sx * 40 - 12, 0, 80, 1.2, 36, 1.2, PAL.yellow); b.box(sx * 40 + 12, 0, 80, 1.2, 36, 1.2, PAL.yellow);
      b.box(sx * 40, 34, 80, 28, 2, 2, PAL.yellow);
      b.box(sx * 40 + 6, 20, 80, 0.3, 14, 0.3, 0x333333);
    }
  },
};

// O cenário é estático: junta todas as malhas com o mesmo material numa só (centenas de objetos -> ~20 chamadas de desenho)
function mergeStatic(root, b) {
  root.updateMatrixWorld(true);
  const byMat = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(o);
  });
  for (const [material, meshes] of byMat) {
    // formas arredondadas e simples nem sempre têm o mesmo formato interno: uniformiza antes de juntar
    const geos = meshes.map((m) => {
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      return g;
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    for (const m of meshes) m.parent.remove(m);
    const mesh = new THREE.Mesh(merged, material);
    mesh.receiveShadow = true; mesh.castShadow = false;
    root.add(mesh);
    b.disposables.push(merged);
  }
}

export function addSurroundings(b, theme) {
  const root = b.begin(0, 0);                  // grupo próprio para o cenário
  b.shadows = false;                           // cenário distante não gasta sombras
  THEMES[theme]?.(b);
  b.shadows = true;
  b.end();
  mergeStatic(root, b);
  return root;
}


/* ============================================================
   DECORAÇÃO DENTRO DA ARENA (sem colisões, simétrica, junta numa malha por material)
   Dá vida ao chão: flores, arbustos, pedras e, em todos os mapas, manchas de tinta.
   ============================================================ */
const SPLAT_COLORS = [PAL.red, PAL.blue, PAL.yellow, PAL.purple, PAL.orange, PAL.green];

export function addDecor(b, theme) {
  const r = rng(101 + theme.length * 7);
  const hx = ARENA.halfX - 3, hz = ARENA.halfZ - 3;
  const objs = b.colliders.filter((c) => c.r !== undefined || (c.minZ < ARENA.halfZ - 0.01 && c.maxZ > -ARENA.halfZ + 0.01 && c.minX < ARENA.halfX - 0.01 && c.maxX > -ARENA.halfX + 0.01));
  const dist = (x, z, c) => {
    if (c.r !== undefined) return Math.hypot(x - c.x, z - c.z) - c.r;
    const nx = Math.max(c.minX, Math.min(x, c.maxX)), nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    return Math.hypot(x - nx, z - nz);
  };
  const free = (x, z, m) => Math.abs(x) <= hx && Math.abs(z) <= hz && !(Math.abs(x) > 35 && Math.abs(z) < 11) && objs.every((c) => dist(x, z, c) > m);
  // n pares simétricos (x e -x) com o mesmo desenho
  const pairs = (n, m, fn) => {
    let k = 0, t = 0;
    while (k < n && t++ < n * 40) {
      const x = 4 + r() * (hx - 4), z = (r() * 2 - 1) * hz;
      if (!free(x, z, m) || !free(-x, z, m)) continue;
      const seed = Math.floor(r() * 1e9);
      fn(x, z, rng(seed)); fn(-x, z, rng(seed));
      k++;
    }
  };

  const root = b.begin(0, 0);
  b.shadows = false;
  let layer = 0.045;
  const nextY = () => (layer += 0.004);   // camadas ligeiramente acima umas das outras (evita sobreposição de planos)

  if (theme === "park") {
    pairs(16, 2.2, (x, z, rr) => {                                   // arbustos redondos
      const c = [0x3fd065, 0x2fb34e, 0x4be07a][Math.floor(rr() * 3)], s = 0.8 + rr() * 0.5;
      b.sphere(x, 0.7 * s, z, 1.0 * s, c); b.sphere(x + 0.9 * s, 0.5 * s, z + 0.3 * s, 0.7 * s, c);
    });
    b.vivid = true;
    pairs(20, 1.5, (x, z, rr) => {                                   // canteiros de flores
      for (let i = 0; i < 6; i++) {
        const fx = x + (rr() - 0.5) * 2.6, fz = z + (rr() - 0.5) * 2.6, c = SPLAT_COLORS[Math.floor(rr() * 6)];
        b.cyl(fx, 0, fz, 0.05, 0.55, 0x2fb34e);
        b.sphere(fx, 0.62, fz, 0.26, c);
        b.sphere(fx, 0.62, fz, 0.1, 0xffffff);
      }
    });
    b.vivid = false;
    pairs(8, 1.8, (x, z, rr) => { const m = b.sphere(x, 0.3, z, 0.6 + rr() * 0.5, 0xb0bec5); m.scale.y = 0.65; });
  } else {
    if (theme === "funfair") b.vivid = true;
    if (theme === "funfair") pairs(40, 1.2, (x, z, rr) => {          // confettis no chão
      for (let i = 0; i < 5; i++) b.flat(x + (rr() - 0.5) * 3, z + (rr() - 0.5) * 3, 0.35, 0.2, SPLAT_COLORS[Math.floor(rr() * 6)], nextY());
    });
    b.vivid = false;
    if (theme === "school") pairs(10, 2, (x, z, rr) => {             // vasos com plantas
      b.cyl(x, 0, z, 0.55, 0.8, 0xff7043, 0.45); b.sphere(x, 1.2, z, 0.75, 0x3fd065); b.sphere(x + 0.35, 1.0, z, 0.5, 0x2fb34e);
      rr();
    });
  }
  b.shadows = true;
  b.end();
  mergeStatic(root, b);
  return root;
}
