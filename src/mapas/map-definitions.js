import { PAL, PAINTS } from "../base/game-config.js";
import { MapBuilder, shell, baseSetup, wallSegs, DOOR_SEGS } from "./map-builder.js";
import { Props } from "./map-props.js";
import { addSurroundings, addDecor } from "./map-scenery.js";
import { loadGlbMap } from "./glb-map.js";

/* ============================================================
   6. MAPAS (cada um é uma função que devolve o mapa completo)
   ============================================================ */

// ---------- MAPA 1: PARQUE ----------
export function buildPark() {
  const b = new MapBuilder("parque", "Parque");
  b.background = 0x8fd3ff; b.outerColor = 0x4cae3e;
  b.lighting({ ground: 0xb7e08a });
  b.ground(0x74d95c, 0x69cf52, 5);
  b.flat(0, 0, 100, 6, 0xf4dca0);
  b.flat(0, 0, 6, 70, 0xf4dca0);
  b.disc(0, 0, 10.5, 0xffe9b8, 0.04);
  shell(b, 0x2fa84a);
  baseSetup(b);

  // fonte central
  b.begin(0, 0, 0, 0, 1.4);
  b.cyl(0, 0, 0, 4, 0.7, 0xcfd8dc);
  b.cyl(0, 0.5, 0, 3.5, 0.3, 0x4fc3f7);
  b.cyl(0, 0, 0, 0.7, 3.2, 0xcfd8dc);
  b.sphere(0, 3.6, 0, 0.9, 0x4fc3f7);
  b.solidCircle(0, 0, 4.2, 2);
  b.end();
  for (let i = 0; i < 6; i++) {                       // canteiros de flores à volta da fonte
    const a = i * Math.PI / 3 + 0.5;
    b.disc(Math.cos(a) * 7.6, Math.sin(a) * 7.6, 1.4, PAINTS[i], 0.07);
  }

  b.mirror(s => {
    for (const [x, z] of [[12, -27], [12, 27], [26, -30], [26, 30], [22, -14], [22, 14], [34, -22], [34, 22]]) {
      Props.tree(b, s * x, z, 1, (x + z) % 2 ? 0x35c75a : 0x3fd065);
    }
    Props.bench(b, s * 15, -5, 0);
    Props.bench(b, s * 15, 5, Math.PI);
    Props.swing(b, s * 28, -22, 0);
    Props.slide(b, s * 28, 22, 0);
    Props.picnic(b, s * 32, 9, 0);
    Props.picnic(b, s * 32, -9, 0);
    Props.hedge(b, s * 18, -12, 2.4, 9);
    Props.hedge(b, s * 18, 12, 2.4, 9);
    Props.hedge(b, s * 30, 0, 9, 2.4);
    Props.ball(b, s * 8, -15, 2.0, PAL.red);
    Props.ball(b, s * 8, 15, 2.0, PAL.blue);
  });
  Props.tree(b, 0, -28, 1.2);
  Props.tree(b, 0, 28, 1.2);
  Props.ball(b, 0, -16, 2.0, PAL.yellow);
  Props.ball(b, 0, 16, 2.0, PAL.yellow);

  b.scatterChests();
  b.patrolPairs([[10, -20], [10, 20], [26, -8], [26, 8], [0, -24], [0, 24], [18, 0], [38, -16], [38, 16]]);
  addDecor(b, "park");
  addSurroundings(b, "park");
  return b.finish();
}

// ---------- MAPA 2: ESCOLA ----------
export function buildSchool() {
  const b = new MapBuilder("escola", "Escola");
  b.background = 0xbfe6ff; b.outerColor = 0x9ad0a0;
  b.lighting({ ground: 0xffe0b0, hemi: 1.5 });
  b.ground(0xf7e9cf, 0xeedcb8, 5);
  b.ground(0x58b4f0, 0x4aa6e4, 5, 34, 70, 0, 0, 0.02);          // pátio (campo)
  b.flat(0, 0, 0.5, 66, 0xffffff, 0.04);
  b.disc(0, 0, 5, 0xffffff, 0.05);
  b.disc(0, 0, 4.5, 0x58b4f0, 0.06);
  shell(b, 0xffc28a);
  baseSetup(b);

  wallSegs(b, 18, DOOR_SEGS, 0xffb3c6, PAL.red);
  wallSegs(b, -18, DOOR_SEGS, 0xffb3c6, PAL.red);
  const DOOR2 = [[-35, -18], [-10, 10], [18, 35]];
  wallSegs(b, 34, DOOR2, 0xa8e6cf, PAL.green);
  wallSegs(b, -34, DOOR2, 0xa8e6cf, PAL.green);

  Props.flagPole(b, 0, 0);
  b.mirror(s => {
    // salas de aula
    for (const z of [-14, -8, 8, 14]) { Props.desk(b, s * 22, z); Props.desk(b, s * 27.5, z); }
    for (const sz of [-1, 1]) {
      b.box(s * 33.2, 1.0, sz * 26, 0.2, 2.8, 6, 0x2e5e4e);                // quadro
      b.box(s * 33.0, 0.9, sz * 26, 0.4, 0.15, 6.2, 0xffffff);
      b.box(s * 33.0, 1.05, sz * 26 + 1.2, 0.1, 0.1, 0.5, PAL.yellow);
      b.begin(s * 29.5, sz * 26);                                          // secretária do professor
      b.box(0, 0, 0, 1.6, 1.1, 3.2, 0x8d5a2b);
      b.box(0, 1.1, 0, 1.8, 0.15, 3.4, 0xd7a86e);
      b.solid(0, 0, 1.8, 3.4, 1.2);
      b.end();
      b.begin(s * 19.4, sz * 12);                                          // estante
      b.box(0, 0, 0, 0.8, 2.8, 6, 0x8d5a2b);
      [PAL.red, PAL.blue, PAL.yellow].forEach((c, i) => b.box(s * -0.42, 0.3 + i * 0.85, 0, 0.05, 0.5, 5.6, c));
      b.solid(0, 0, 0.8, 6, 2.8);
      b.end();
      // cacifos pintados virados para a base (parede x=34) e junto à parede do fundo
      Props.lockers(b, s, s * 35.2, [0, 1, 2, 3, 4, 5].map(i => sz * (20 + i * 2.4)).sort((p, q) => p - q));
      Props.lockers(b, -s, s * 48.6, [0, 1, 2, 3, 4, 5].map(i => sz * (16 + i * 2.4)).sort((p, q) => p - q));
    }
    // pátio
    Props.bench(b, s * 6, -12, 0);
    Props.bench(b, s * 6, 12, Math.PI);
    Props.hoop(b, s * 13, -12, -s * Math.PI / 2);
    Props.hoop(b, s * 13, 12, -s * Math.PI / 2);
    Props.planter(b, s * 10, -26);
    Props.planter(b, s * 10, 26);
  });
  Props.planter(b, 0, -26);
  Props.planter(b, 0, 26);

  b.scatterChests();
  b.patrolPairs([[10, -10], [10, 10], [26, -24], [26, 24], [26, 0], [40, -14], [40, 14], [0, -20], [0, 20]]);
  addDecor(b, "school");
  addSurroundings(b, "school");
  return b.finish();
}

// ---------- MAPA 3: RESTAURANTE ----------
export function buildRestaurant() {
  const b = new MapBuilder("restaurante", "Restaurante");
  b.background = 0xffe0b8; b.outerColor = 0xc9a07a; b.skyTop = 0xff9a6a;
  b.lighting({ ground: 0xffd7a8, hemi: 1.5, sun: 0xfff0d0, sunI: 1.4 });
  b.ground(0xff7a7a, 0xfff1e0, 5);
  b.ground(0x7fd8d1, 0xf5fffe, 3.5, 28, 70, 0, 0, 0.02);        // cozinha
  shell(b, 0xd64541);
  baseSetup(b);
  wallSegs(b, 14, DOOR_SEGS, 0xffe0b3, PAL.red);
  wallSegs(b, -14, DOOR_SEGS, 0xffe0b3, PAL.red);

  b.mirror(s => {
    // sala de jantar
    Props.table(b, s * 24, -12, PAL.yellow);
    Props.table(b, s * 24, 12, PAL.blue);
    Props.table(b, s * 24, -28, PAL.green);
    Props.table(b, s * 24, 28, PAL.orange);
    Props.table(b, s * 32, -20, PAL.purple);
    Props.table(b, s * 32, 20, PAL.red);
    Props.table(b, s * 32, 0, PAL.yellow);
    Props.booth(b, s * 22, -33.5, 0, 12);
    Props.booth(b, s * 22, 33.5, Math.PI, 12);
    // cozinha
    Props.counter(b, s * 5, -12, 2.4, 10);
    Props.counter(b, s * 5, 12, 2.4, 10);
    Props.stove(b, s * 12.2, -8);
    Props.stove(b, s * 12.2, 8);
    Props.fridge(b, s * 12.2, -31);
    Props.fridge(b, s * 12.2, 31, 0xb3e5fc);
    Props.pot(b, s * 8, 0, PAL.yellow);
    Props.mixer(b, s * 5, -30, PAL.red);
    Props.mixer(b, s * 5, 30, PAL.blue);
  });
  Props.pot(b, 0, -13, PAL.red);
  Props.pot(b, 0, 13, PAL.blue);

  b.scatterChests();
  b.patrolPairs([[11, -27], [11, 27], [20, -22], [20, 22], [28, -8], [28, 8], [40, -16], [40, 16], [0, -24], [0, 24]]);
  addDecor(b, "restaurant");
  addSurroundings(b, "restaurant");
  return b.finish();
}

// ---------- MAPA 4: PARQUE DE DIVERSÕES ----------
export function buildFunfair() {
  const b = new MapBuilder("diversoes", "Parque de Diversões");
  b.background = 0xffc48a; b.outerColor = 0x8f7fd8; b.skyTop = 0x7a5cf0;
  b.lighting({ sky: 0xfff0e0, ground: 0xc8b0ff, hemi: 1.45, sun: 0xffe6c0, sunI: 1.45, pos: [-40, 55, 30] });
  b.ground(0xcdbfff, 0xbfaeff, 5);
  b.flat(0, 0, 100, 5, 0xffe9b0);
  b.flat(0, 0, 5, 70, 0xffe9b0);
  b.disc(0, 0, 13, 0xffe9b0, 0.04);
  for (let i = 0; i < 8; i++) b.disc(Math.cos(i * Math.PI / 4) * 11.5, Math.sin(i * Math.PI / 4) * 11.5, 0.9, PAINTS[i % 6], 0.06);
  shell(b, 0xff5fa8);
  baseSetup(b);

  Props.ferrisWheel(b, 0, 0);
  Props.dropTower(b, 0, -27);
  Props.dropTower(b, 0, 27);
  b.mirror(s => {
    Props.carousel(b, s * 21, 0);
    Props.stall(b, s * 16, -22, 0, PAL.red, 0xffb74d);
    Props.stall(b, s * 16, 22, Math.PI, PAL.blue, 0x81d4fa);
    Props.stall(b, s * 30, -20, 0, PAL.green, 0xc5e1a5);
    Props.stall(b, s * 30, 20, Math.PI, PAL.purple, 0xce93d8);
    Props.tent(b, s * 42, -26, PAL.red, PAL.yellow);
    Props.tent(b, s * 42, 26, PAL.blue, PAL.orange);
    Props.balloons(b, s * 10, -9);
    Props.balloons(b, s * 10, 9);
    Props.balloons(b, s * 32, -9);
    Props.balloons(b, s * 32, 9);
    Props.bench(b, s * 12, 4, Math.PI);
    Props.bench(b, s * 12, -4, 0);
  });

  b.scatterChests();
  b.patrolPairs([[10, -12], [10, 12], [22, -12], [22, 12], [22, -26], [22, 26], [34, -12], [34, 12], [0, -14], [0, 14]]);
  addDecor(b, "funfair");
  addSurroundings(b, "funfair");
  return b.finish();
}

// ---------- MAPA 5: FÁBRICA DE TINTAS ----------
export function buildFactory() {
  const b = new MapBuilder("fabrica", "Fábrica de Tintas");
  b.background = 0x9fb4c8; b.outerColor = 0x6d7f8f; b.skyTop = 0x5f86b8;
  b.lighting({ sky: 0xe8f1ff, ground: 0xb0a090, hemi: 1.5, sun: 0xffffff, sunI: 1.4, pos: [30, 70, -20] });
  b.ground(0xb8c4cf, 0xaab7c4, 5);
  for (const z of [-11, 11]) b.flat(0, z, 70, 0.6, PAL.yellow, 0.03);
  shell(b, 0x78909c, 4);
  baseSetup(b);

  // canos por cima (só decoração)
  b.cylAxis("x", 0, 7.5, -11, 0.5, 100, PAL.red);
  b.cylAxis("x", 0, 7.5, 11, 0.5, 100, PAL.blue);
  b.cylAxis("x", 0, 9, 0, 0.5, 100, PAL.yellow);

  Props.vat(b, 0, -14, PAL.green);
  Props.vat(b, 0, 14, PAL.purple);
  Props.vat(b, 0, 0, PAL.orange);
  b.mirror(s => {
    Props.tank(b, s * 14, -22, PAL.red);
    Props.tank(b, s * 14, 0, PAL.blue);
    Props.tank(b, s * 14, 22, PAL.yellow);
    Props.conveyor(b, s * 26, -14, 12);
    Props.conveyor(b, s * 26, 14, 12);
    Props.crate(b, s * 24, -30, PAL.red);
    Props.crate(b, s * 24, 30, PAL.blue);
    Props.crate(b, s * 8, -30, PAL.yellow);
    Props.crate(b, s * 8, 30, PAL.yellow);
    Props.machine(b, s * 38, -22, 0);
    Props.machine(b, s * 38, 22, 0);
    b.disc(s * 20, -6, 1.6, PAL.red, 0.05);
    b.disc(s * 20, 6, 1.6, PAL.blue, 0.05);
    b.disc(s * 30, 0, 2.0, PAL.green, 0.05);
  });

  b.scatterChests();
  b.patrolPairs([[8, -8], [8, 8], [20, -8], [20, 8], [32, -6], [32, 6], [0, -22], [0, 22], [40, -12], [40, 12]]);
  addDecor(b, "factory");
  addSurroundings(b, "factory");
  return b.finish();
}

// ---------- MAPA: ESTÚDIO DE TINTA (feito em código) ----------
// Chão de tela, paleta gigante com um pincel ao centro, cavaletes, bisnagas e latas de tinta.
// As 4 poças grandes e a "viragem" a meio do round estão em map-features.js (FEATURES.estudio).
export function buildStudio() {
  const b = new MapBuilder("estudio", "Estúdio de Tinta");
  b.background = 0xf6efe4; b.outerColor = 0xd9cbb5; b.skyTop = 0x7cb6ff;
  b.lighting({ ground: 0xf3e6d0, hemi: 1.4, sunI: 1.35 });
  b.ground(0xfbf7ef, 0xeee6d6, 5);
  shell(b, 0xb98a5a);
  baseSetup(b);

  // paleta gigante (estrado baixo) com um pincel espetado ao meio
  b.cyl(0, 0, 0, 5.5, 0.4, 0xd7a86e);
  b.solidCircle(0, 0, 5.5, 0.4);
  [[2.8, 1.5, PAL.red], [1.2, 3.4, PAL.yellow], [-1.8, 3.0, PAL.blue], [-3.4, 0.2, PAL.green], [-2.0, -2.8, PAL.purple], [1.4, -3.4, PAL.orange]]
    .forEach(([x, z, c]) => b.disc(x, z, 1.0, c, 0.42));
  b.cyl(0, 0.4, 0, 0.45, 5.2, 0xc0392b);
  b.cyl(0, 5.6, 0, 0.55, 0.7, 0xb0b0b0);
  b.cyl(0, 6.3, 0, 0.75, 1.3, 0x2f7bff, 0.15);
  b.solidCircle(0, 0, 0.7, 7.6);

  b.mirror(s => {
    // cavaletes com telas pintadas (paredes de cobertura)
    for (const [x, z] of [[26, 0], [10, -22], [10, 22]]) {
      b.begin(s * x, z, x === 26 ? 0 : Math.PI / 2);
      b.box(0, 0, 0, 0.5, 4.2, 6, 0xfdfbf6);
      b.box(s * 0.27, 1.2, -1.2, 0.05, 1.6, 2.2, PAINTS[(x + Math.abs(z)) % 6]);
      b.box(s * 0.27, 2.4, 1.4, 0.05, 1.4, 1.8, PAINTS[(x + 2) % 6]);
      for (const lz of [-2.6, 2.6]) b.box(0, 0, lz, 0.3, 4.6, 0.3, 0x8a5a2b);
      b.solid(0, 0, 0.5, 6, 4.2);
      b.end();
    }
    // bisnagas de tinta gigantes deitadas
    for (const [x, z, c] of [[22, -28, PAL.red], [22, 28, PAL.blue]]) {
      b.cylAxis("x", s * x, 1.1, z, 1.1, 7, 0xeeeeee);
      b.cylAxis("x", s * (x - 3.4), 1.1, z, 1.12, 1.2, c);
      b.cylAxis("x", s * (x + 4.0), 1.1, z, 0.5, 1.0, 0x444444);
      b.solid(s * x, z, 8, 2.2, 2.2);
    }
    // latas de tinta (cobertura redonda) e caixotes
    for (const [x, z, c] of [[30, -16, PAL.yellow], [30, 16, PAL.purple], [5, -12, PAL.green], [5, 12, PAL.orange]]) {
      b.cyl(s * x, 0, z, 1.4, 2.2, 0xcfd6dc);
      b.cyl(s * x, 2.2, z, 1.42, 0.12, c);
      b.solidCircle(s * x, z, 1.4, 2.3);
    }
    b.box(s * 18, 0, 0, 3, 1.1, 3, 0x9a6a3a);                         // banco baixo para saltar
    b.solid(s * 18, 0, 3, 3, 1.1);
    Props.crate(b, s * 36, -26, PAL.red);
    Props.crate(b, s * 36, 26, PAL.blue);
  });

  b.scatterChests();
  b.patrolPairs([[8, -6], [8, 6], [16, -8], [16, 8], [22, -14], [22, 14], [30, -6], [30, 6], [0, -18], [0, 18], [16, -24], [16, 24], [38, -16], [38, 16]]);
  addDecor(b, "studio");
  addSurroundings(b, "park");
  return b.finish();
}

// Mapas feitos no Blender (assets/maps/*.glb); se um ficheiro falhar, usa-se a versão feita em código (build).
// load.preload(): começa já a carregar (ex.: durante as estatísticas do round); o load() seguinte usa esse mapa (uma vez só)
const GLB = (id, name, bg, sky, lighting) => {
  const go = () => loadGlbMap(`assets/maps/${id}.glb`, { id, name, background: bg, skyTop: sky, lighting });
  let pre = null;
  const load = () => { const p = pre || go(); pre = null; return p; };
  load.preload = () => { if (!pre) { pre = go(); pre.catch(() => { pre = null; }); } };
  return load;
};

export const MAPS = [
  { id: "parque",      name: "Parque",              icon: "🌳", desc: "Palmeiras, relvados, fonte e o mar ao fundo",    c1: "#35c75a", c2: "#1e9fd8", build: buildPark,
    load: GLB("parque", "Parque", 0xa9dcf5, 0x2f8cff, { ground: 0xd9e4f0, hemi: 1.35, sunI: 1.4 }) },
  { id: "escola",      name: "Escola",              icon: "🏫", desc: "Lápis e livros gigantes, campo e cacifos",        c1: "#ff7aa8", c2: "#ffb347", build: buildSchool,
    load: GLB("escola", "Escola", 0xbfe6ff, 0x4aa3ff, { ground: 0xe8e0d0, hemi: 1.4, sunI: 1.4 }) },
  { id: "restaurante", name: "Restaurante",         icon: "🍕", desc: "Forno de pizza gigante e mesas com chapéus-de-sol", c1: "#ff5a4a", c2: "#ffb300", build: buildRestaurant,
    load: GLB("restaurante", "Restaurante", 0xffe9d6, 0x7cb6ff, { ground: 0xffe4cc, hemi: 1.4, sun: 0xfff0d8, sunI: 1.35 }) },
  { id: "diversoes",   name: "Parque de Diversões", icon: "🎡", desc: "Roda gigante, carrosséis e torres de queda",      c1: "#a447ff", c2: "#ff5fa8", build: buildFunfair,
    load: GLB("diversoes", "Parque de Diversões", 0xffc48a, 0x7a5cf0, { sky: 0xfff0e0, ground: 0xc8b0ff, hemi: 1.35, sun: 0xffe6c0, sunI: 1.4, pos: [-40, 55, 30] }) },
  { id: "fabrica",     name: "Fábrica de Tintas",   icon: "🏭", desc: "Depósitos de tinta, cubas e tapetes rolantes",    c1: "#2f7bff", c2: "#2fd15a", build: buildFactory,
    load: GLB("fabrica", "Fábrica de Tintas", 0xbcd4ea, 0x4f8fd0, { sky: 0xe8f1ff, ground: 0xc8d0dc, hemi: 1.4, sunI: 1.4, pos: [30, 70, -20] }) },
  { id: "castelo",     name: "Castelo",             icon: "🏰", desc: "Muralhas, salões, canhões e um rio com pontes-levadiças", c1: "#6f6a62", c2: "#4e3522", build: buildPark,
    load: GLB("castelo", "Castelo", 0x8a929c, 0x55606c, { sky: 0xd8dde4, ground: 0x5a5048, hemi: 1.15, sun: 0xffe2c0, sunI: 1.3, pos: [-35, 60, 25] }) },
  { id: "estudio",     name: "Estúdio de Tinta",    icon: "🎨", desc: "Poças gigantes e, a meio do round, o chão muda de cor", c1: "#ff8a1f", c2: "#a447ff", build: buildStudio },
];

