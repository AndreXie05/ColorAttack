import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/* ============================================================
   BONECOS LEVES (feitos em código, sem Blender)
   Estilo "chibi": cabeça grande, olhos grandes com brilho, bochechas, sorriso, t-shirt na cor da tinta.
   Têm o esqueleto que o jogo espera (Body, ArmL/ArmR, LegL/LegR com ShinL/ShinR, nas posições de sempre), por isso
   funcionam com as animações, celebrações, chapéus, mochilas e armas da loja.
   Para pesar pouco, cada parte do corpo tem no máximo 2 peças: a roupa ("Paint", muda com a cor) e o resto
   ("Baked": pele, cabelo, olhos, calções, sapatos) numa peça só, com a cor de cada pormenor guardada nos vértices.
   Resultado: 11 peças por boneco (os antigos bonecos do Blender tinham ~29) e ~6 000 triângulos (tinham ~12 000).
   ============================================================ */

// Aspeto de cada skin: cores de pele, cabelo, calções e sapatos, penteado e extras (orelhas, capacetes, barbas, caudas...)
// cap: false = sem cabelo por cima (careca, capacete...); eyes: "none" (tapados) ou "alien"; mouth: "none" ou "line"
// body: corpo próprio (ver BODIES): redondo, robo, armadura, fato, vestido, manto, dino; sem body = corpo normal (só a cabeça muda)
export const LIGHT_LOOKS = {
  iniciante:  { skin: 0xffd9b8, hair: 0x5a3a22, shorts: 0x2f4a7a, shoe: 0xffffff, sole: 0x9aa3b0 },
  gota:       { skin: 0xc98f62, hair: 0x7a4dff, shorts: 0x203050, shoe: 0xffd21f, sole: 0x1a1033, style: "franja" },
  gato:       { skin: 0xffa64d, hair: 0xffa64d, shorts: 0x3a2a20, shoe: 0xffffff, sole: 0xff9fc0, cap: false, hand: 0xffffff, skinKeep: 0.45, mouth: "cat", extras: ["gato"] },
  urso:       { body: "redondo", skin: 0xc58b5a, hair: 0x8a5a33, shorts: 0x4a3020, shoe: 0x6b4423, sole: 0xffffff, extras: ["urso"] },
  coelho:     { skin: 0xfff1f4, hair: 0xf2f2f2, shorts: 0x6b7a99, shoe: 0xff8fc0, sole: 0xffffff, extras: ["coelho"] },
  pinguim:    { body: "pinguim", skin: 0xffffff, hair: 0x1d1d2b, shorts: 0x1d1d2b, shoe: 0xff9a1f, sole: 0xff9a1f, cap: false, mouth: "none", extras: ["pinguim"] },
  palhaco:    { body: "redondo", skin: 0xfff4ea, hair: 0x2fd15a, shorts: 0x2f7bff, shoe: 0xff3b4a, sole: 0xffd21f, cap: false, extras: ["palhaco"] },
  pirata:     { skin: 0xe8b48a, hair: 0x3a2414, shorts: 0x2b2b3d, shoe: 0x3a2414, sole: 0xffd21f, cap: false, extras: ["pirata"] },
  ninja:      { skin: 0xf0c8a0, hair: 0x15151f, shorts: 0x15151f, shoe: 0x15151f, sole: 0x3a3a4a, cap: false, mouth: "none", extras: ["ninja"] },
  bombeiro:   { skin: 0xf5c9a2, hair: 0x5a3820, shorts: 0x2b2b2b, shoe: 0x1d1d22, sole: 0xffd21f, cap: false, mouth: "none", extras: ["bombeiro"] },
  zombie:     { skin: 0x8fd17a, hair: 0x3d3a2a, shorts: 0x4a4a5a, shoe: 0x5a4a3a, sole: 0x2b2b2b, cap: false, skinKeep: 0.5, eyes: "zombie", mouth: "line", extras: ["zombie"] },
  vampiro:    { skin: 0xe8e2f6, hair: 0x15151f, shorts: 0x15151f, shoe: 0x15151f, sole: 0x8a1020, cap: false, skinKeep: 0.55, pupil: 0xd8102a, extras: ["vampiro"] },
  abelha:     { body: "redondo", skin: 0xffd9b8, hair: 0xffc61a, shorts: 0x15151f, shoe: 0x15151f, sole: 0xffc61a, cap: false, extras: ["abelha"] },
  cavaleiro:  { body: "armadura", skin: 0xf0c8a0, hair: 0x6a6f7a, shorts: 0x5a5f6a, shoe: 0x8a8f9a, sole: 0x3a3f4a, cap: false, eyes: "none", mouth: "none", extras: ["cavaleiro"] },
  mago:       { body: "manto", skin: 0xf5d2b0, hair: 0xffffff, shorts: 0x3a2a6a, shoe: 0x5a3a8a, sole: 0xffd21f, cap: false, mouth: "none", extras: ["mago"] },
  robo:       { body: "robo", skin: 0x9aa3b0, hair: 0x5a6270, shorts: 0x5a6270, shoe: 0x5a6270, sole: 0x2b2f3a, cap: false, eyes: "none", mouth: "none", extras: ["robo"] },
  alien:      { skin: 0x7fe08a, hair: 0x7fe08a, shorts: 0x3a2a6a, shoe: 0xa0a8b8, sole: 0xffffff, cap: false, eyes: "alien", extras: ["alien"] },
  astronauta: { body: "fato", skin: 0xf2c49b, hair: 0x6b3a1e, shorts: 0xe8e8ee, shoe: 0xffffff, sole: 0x9aa3b0, cap: false, extras: ["astronauta"] },
  dino:       { body: "dino", skin: 0x5fcf6a, hair: 0x3a9a4a, shorts: 0x2b6a3a, shoe: 0x5fcf6a, sole: 0xffffff, cap: false, skinKeep: 0.45, mouth: "none", extras: ["dino"] },
  princesa:   { body: "vestido", skin: 0xffe0c8, hair: 0xffc61a, shorts: 0xff8fc0, shoe: 0xff8fc0, sole: 0xffffff, cap: false, lashes: true, extras: ["princesa"] },
};

const EYE_WHITE = 0xffffff, PUPIL = 0x1a1033, CHEEK = 0xff8fa8, MOUTH = 0x7a2236;
const SEG = 14;                                                     // segmentos das esferas: redondas o suficiente, sem triângulos a mais

// Junta peças numa malha só, com a cor de cada uma nos vértices
// keep(k): as peças seguintes só são tingidas k (0 = guardam a cor delas: riscas da abelha, capacete do bombeiro...; 1 = normal)
class Baker {
  constructor() { this.parts = []; this.k = 1; }
  keep(k = 1) { this.k = k; return this; }
  add(geo, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
    const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("tintk", new THREE.BufferAttribute(new Float32Array(n).fill(this.k), 1));
    this.parts.push(g);
    geo.dispose?.();
    return this;
  }
  mesh(material, name) {
    if (!this.parts.length) return null;
    const geo = mergeGeometries(this.parts, false);
    this.parts.forEach((g) => g.dispose());
    const m = new THREE.Mesh(geo, material); m.name = name;
    return m;
  }
}

const noColor = (m) => { if (m) { m.geometry.deleteAttribute("color"); m.geometry.deleteAttribute("tintk"); } return m; };   // (a roupa e a pistola têm uma cor só, a do material)
const sph = (r, ws = SEG, hs = SEG - 4) => new THREE.SphereGeometry(r, ws, hs);
const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
// tronco/calções arredondados (perfil a rodar à volta do eixo y)
const lathe = (pts, s = SEG) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), s);

// ---------- extras de cada skin (no espaço do tronco: cabeça em (0, 2.0, 0) com raio ~0,56, cara virada para +z) ----------
const PINK = 0xff9fc0, WHITE = 0xffffff, DARK = 0x1a1033, GOLD = 0xffd21f, ORANGE = 0xff9a1f, RED = 0xe8303f, METAL = 0x8a919c;
const cone = (r, h, s = 10) => new THREE.ConeGeometry(r, h, s);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const torus = (r, t, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, 6, 18, arc);
const EXTRAS = {
  gato(b, L) {                                                                     // gato malhado: orelhas grandes, focinho branco, riscas, bigodes e cauda às riscas
    b.keep(0.45);
    for (const sx of [-1, 1]) {
      b.add(cone(0.22, 0.42, 4), L.skin, sx * 0.34, 2.58, -0.02, 1, 1, 0.5, 0, Math.PI / 4, -sx * 0.32);
      b.keep(0.1).add(cone(0.13, 0.27, 4), PINK, sx * 0.34, 2.55, 0.05, 1, 1, 0.35, 0, Math.PI / 4, -sx * 0.32).keep(0.45);
    }
    for (const [x, rz] of [[-0.14, 0.25], [0, 0], [0.14, -0.25]]) b.keep(0.3).add(box(0.05, 0.2, 0.04), 0xc8641e, x, 2.36, 0.48, 1, 1, 1, -0.5, 0, rz);   // riscas na testa
    b.keep(0).add(sph(0.16, 12, 8), WHITE, 0, 1.83, 0.42, 1.35, 0.85, 0.7);                       // focinho branco
    b.keep(0.05).add(sph(0.05, 8, 6), PINK, 0, 1.9, 0.56, 1.3, 0.9, 0.8);                         // nariz
    for (const sx of [-1, 1]) for (const k of [-1, 1]) b.keep(0.2).add(box(0.24, 0.012, 0.012), DARK, sx * 0.36, 1.85 + k * 0.03, 0.47, 1, 1, 1, 0, -sx * 0.3, sx * k * 0.12);   // bigodes
    const tail = [[0.82, -0.42, 0.09, 0], [0.96, -0.58, 0.088, 1], [1.14, -0.68, 0.085, 0], [1.33, -0.68, 0.082, 1], [1.5, -0.6, 0.08, 0], [1.6, -0.48, 0.085, 2]];
    for (const [y, z, r, c] of tail) b.keep(c === 2 ? 0 : 0.45).add(sph(r, 10, 8), c === 2 ? WHITE : c ? 0xc8641e : L.skin, 0, y, z);   // cauda às riscas com a ponta branca
    b.keep(1);
  },
  urso(b, L) {
    for (const s of [-1, 1]) b.add(sph(0.17, 12, 10), L.hair, s * 0.4, 2.42, -0.04, 1, 1, 0.6).add(sph(0.09, 10, 8), PINK, s * 0.4, 2.42, 0.03, 1, 1, 0.4);
    b.add(sph(0.17, 12, 10), 0xf3dcc0, 0, 1.86, 0.44, 1.25, 0.85, 0.7).add(sph(0.06, 8, 6), DARK, 0, 1.92, 0.57, 1.3, 0.9, 0.8);   // focinho e nariz
    b.add(sph(0.13, 10, 8), L.hair, 0, 0.8, -0.55);                                                // cauda
  },
  coelho(b, L) {
    for (const s of [-1, 1]) b.add(sph(0.2, 12, 10), L.hair, s * 0.2, 2.82, -0.06, 0.45, 1.7, 0.3, 0, 0, -s * 0.12)
      .add(sph(0.12, 10, 8), PINK, s * 0.2, 2.82, 0.0, 0.45, 1.5, 0.2, 0, 0, -s * 0.12);
    b.add(box(0.1, 0.08, 0.03), WHITE, 0, 1.74, 0.52).add(sph(0.045, 8, 6), PINK, 0, 1.88, 0.55);   // dentes e nariz
    b.add(sph(0.14, 10, 8), WHITE, 0, 0.84, -0.42);                                                // pompom
  },
  pinguim(b) {                                                                     // pinguim: capuz preto, cara branca, bico laranja grande e barriga branca
    b.keep(0.12).add(new THREE.SphereGeometry(0.6, 20, 14, Math.PI * 0.5 + 0.75, Math.PI * 2 - 1.5), 0x1d1d2b, 0, 2.0, -0.02)   // capuz (aberto à frente)
      .add(new THREE.SphereGeometry(0.605, 20, 6, 0, Math.PI * 2, 0, Math.PI * 0.3), 0x1d1d2b, 0, 2.0, -0.02);            // topo da cabeça
    b.keep(0.08).add(cone(0.12, 0.3, 10), ORANGE, 0, 1.84, 0.66, 1.3, 1, 0.75, Math.PI / 2, 0, 0); // bico
    b.keep(0).add(sph(0.4, 16, 12), WHITE, 0, 1.1, 0.4, 0.78, 1.05, 0.45);                        // barriga branca (à frente da camisola)
    b.keep(0.12).add(cone(0.3, 0.3, 4), 0x1d1d2b, 0, 0.62, -0.5, 1, 1, 0.4, -2.2, Math.PI / 4, 0);  // caudinha
    b.keep(1);
  },
  palhaco(b, L) {
    b.add(sph(0.1, 12, 10), RED, 0, 1.9, 0.57);                                                    // nariz vermelho
    for (const s of [-1, 1]) for (const [y, z] of [[2.2, -0.05], [2.0, -0.18], [2.32, -0.25]]) b.add(sph(0.17, 10, 8), L.hair, s * 0.52, y, z);   // tufos
    b.add(cone(0.18, 0.34, 10), GOLD, 0, 2.66, 0, 1, 1, 1, 0, 0, 0.15).add(sph(0.07, 8, 6), RED, -0.05, 2.84, 0);   // chapéu pequenino
    b.add(torus(0.1, 0.03, Math.PI), RED, 0, 1.79, 0.52, 1.3, 1, 1, Math.PI, 0, 0);               // boca grande
  },
  pirata(b) {
    b.add(new THREE.SphereGeometry(0.59, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), RED, 0, 2.06, -0.02, 1, 0.98, 1, -0.25, 0, 0);   // lenço
    for (const s of [-1, 1]) b.add(sph(0.09, 8, 6), RED, 0.08 * s, 2.15, -0.6).add(cone(0.08, 0.3, 6), RED, 0.12 * s, 1.95, -0.62, 1, 1, 0.4, 0, 0, s * 0.3);   // nó atrás
    b.add(sph(0.15, 12, 8), DARK, 0.2, 2.0, 0.56, 1, 1.1, 0.35).add(torus(0.585, 0.018), DARK, 0, 2.08, 0, 1, 1, 0.98, Math.PI / 2 - 0.25, 0, -0.35);   // pala no olho (por cima do olho direito)
    b.add(sph(0.3, 14, 8), 0x3a2414, 0, 1.72, 0.32, 1.25, 0.75, 0.8);                              // barba
  },
  ninja(b) {                                                                       // ninja: capuz preto que só deixa ver os olhos, fita vermelha comprida e katana nas costas
    b.keep(0.12).add(new THREE.SphereGeometry(0.6, 20, 14, Math.PI * 0.5 + 0.8, Math.PI * 2 - 1.6), 0x15151f, 0, 2.0, -0.01)   // capuz
      .add(new THREE.SphereGeometry(0.605, 20, 6, 0, Math.PI * 2, 0, Math.PI * 0.3), 0x15151f, 0, 2.0, -0.01)              // topo
      .add(new THREE.SphereGeometry(0.585, 20, 8, 0, Math.PI * 2, Math.PI * 0.56, Math.PI * 0.44), 0x15151f, 0, 2.0, 0, 1, 0.95, 0.98);   // tapa a cara (abaixo dos olhos)
    b.keep(0.1).add(torus(0.6, 0.05), 0xe8303f, 0, 2.24, 0, 1, 1, 0.98, Math.PI / 2, 0, 0)          // fita vermelha
      .add(sph(0.08, 8, 6), 0xe8303f, 0, 2.24, -0.6);
    for (const sx of [-1, 1]) b.add(box(0.09, 0.62, 0.02), 0xe8303f, sx * 0.12, 1.98, -0.66, 1, 1, 1, 0.35, 0, sx * 0.4);   // pontas da fita a esvoaçar
    b.keep(0.05).add(box(0.07, 0.95, 0.03), 0xdfe6ee, 0.18, 1.42, -0.5, 1, 1, 1, 0, 0, -0.65)       // lâmina da katana (nas costas, na diagonal)
      .keep(0.15).add(cyl(0.035, 0.035, 0.32, 6), 0x2b1a12, -0.21, 1.9, -0.5, 1, 1, 1, 0, 0, -0.65)  // cabo
      .keep(0.05).add(cyl(0.09, 0.09, 0.03, 10), GOLD, -0.1, 1.74, -0.5, 1, 1, 1, 0, 0, -0.65 + Math.PI / 2);   // guarda
    b.keep(0.15).add(torus(0.415, 0.045), 0x15151f, 0, 0.95, 0, 1, 1, 1, Math.PI / 2, 0, 0);       // faixa na cintura
    b.keep(1);
  },
  bombeiro(b) {                                                                    // bombeiro: capacete vermelho com escudo dourado, bigode, faixas refletoras e garrafa de ar
    b.keep(0.12).add(new THREE.SphereGeometry(0.63, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), 0xd8202a, 0, 2.12, -0.02, 1, 0.92, 1.05)   // capacete
      .add(cyl(0.8, 0.84, 0.05, 22), 0xd8202a, 0, 2.12, -0.12, 1, 1, 1.15)                          // aba (maior atrás)
      .add(box(0.06, 0.5, 1.15), 0xb01820, 0, 2.5, -0.04, 1, 1, 1);                                  // crista
    b.keep(0.02).add(new THREE.CylinderGeometry(0.15, 0.13, 0.04, 6), GOLD, 0, 2.38, 0.55, 1.2, 1, 1.2, -1.2, 0, 0)   // escudo dourado
      .add(sph(0.05, 6, 5), 0xd8202a, 0, 2.39, 0.6);
    for (const sx of [-1, 1]) b.keep(0.25).add(sph(0.1, 10, 8), 0x5a3820, sx * 0.09, 1.82, 0.5, 1.4, 0.55, 0.7, 0, 0, -sx * 0.25);   // bigode
    b.keep(0).add(torus(0.415, 0.045), 0xfff07a, 0, 1.05, 0, 1, 1, 1, Math.PI / 2, 0, 0).add(torus(0.4, 0.045), 0xfff07a, 0, 1.3, 0, 1, 1, 1, Math.PI / 2, 0, 0);   // faixas refletoras
    b.keep(0.08).add(new THREE.CapsuleGeometry(0.16, 0.42, 4, 10), 0xffd21f, 0, 1.25, -0.5)        // garrafa de ar
      .add(cyl(0.06, 0.06, 0.08, 8), METAL, 0, 1.62, -0.5);
    b.keep(1);
  },
  zombie(b, L) {                                                                   // zombie: pele verde, cabelo desgrenhado, cérebro à mostra, pontos e ligaduras
    b.keep(0.35);
    for (const [x, z, rz, rx] of [[-0.3, 0.1, 0.6, -0.3], [-0.1, 0.2, 0.2, -0.5], [0.3, 0.0, -0.7, -0.2], [0.15, -0.3, -0.3, 0.4], [-0.25, -0.3, 0.4, 0.4]]) b.add(cone(0.12, 0.38, 6), L.hair, x, 2.5, z, 1, 1, 1, rx, 0, rz);   // cabelo desgrenhado
    b.keep(0.15).add(sph(0.2, 12, 8), 0xff9fb0, 0.12, 2.44, 0.12, 1, 0.55, 1)                       // cérebro à mostra
      .add(box(0.012, 0.06, 0.2), 0xd06a80, 0.12, 2.5, 0.12);
    b.keep(0.05);
    for (const x of [-0.24, -0.15, -0.06]) b.add(box(0.015, 0.09, 0.02), DARK, x, 2.24, 0.5);     // pontos na testa
    b.add(box(0.24, 0.015, 0.02), DARK, -0.15, 2.24, 0.5, 1, 1, 1, 0, 0, 0.1);
    for (const x of [-0.04, 0.04]) b.add(box(0.012, 0.06, 0.02), DARK, x, 1.8, 0.53);             // pontos na boca
    b.keep(0).add(torus(0.42, 0.04), WHITE, 0, 0.98, 0, 1, 1, 1, Math.PI / 2 + 0.2, 0, 0.1);       // ligadura à volta da barriga
    b.keep(1);
  },
  vampiro(b) {                                                                     // vampiro: cabelo puxado para trás com bico, olhos vermelhos, caninos, capa preta e vermelha e medalhão
    b.keep(0.1).add(new THREE.SphereGeometry(0.595, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), 0x15151f, 0, 2.03, -0.06, 1, 1, 1, -0.2, 0, 0)   // cabelo
      .add(cone(0.13, 0.22, 4), 0x15151f, 0, 2.33, 0.48, 1, 1, 0.45, Math.PI - 0.35, Math.PI / 4, 0);   // bico na testa
    for (const sx of [-1, 1]) b.add(box(0.15, 0.03, 0.03), 0x15151f, sx * 0.2, 2.2, 0.5, 1, 1, 1, 0, 0, sx * 0.35);   // sobrancelhas zangadas
    for (const sx of [-1, 1]) b.keep(0).add(cone(0.025, 0.08, 6), WHITE, sx * 0.045, 1.76, 0.52, 1, 1, 1, Math.PI, 0, 0);   // caninos
    b.keep(0.08).add(new THREE.CylinderGeometry(0.66, 0.42, 0.55, 18, 1, true, Math.PI * 0.62, Math.PI * 0.76), 0xb01020, 0, 1.86, -0.04)   // gola alta (vermelha)
      .keep(0.1).add(new THREE.CylinderGeometry(0.44, 0.62, 1.35, 18, 1, true, Math.PI * 0.66, Math.PI * 0.68), 0x15151f, 0, 0.98, -0.06)   // capa preta até às pernas
      .keep(0.05).add(cyl(0.08, 0.08, 0.03, 12), GOLD, 0, 1.45, 0.4, 1, 1, 1, Math.PI / 2 - 0.2, 0, 0).add(sph(0.035, 6, 5), 0xd8102a, 0, 1.45, 0.42);   // medalhão
    b.keep(0.1).add(box(0.2, 0.08, 0.04), 0x15151f, 0, 1.6, 0.27).add(sph(0.04, 6, 5), 0xb01020, 0, 1.6, 0.3);   // laço
    b.keep(1);
  },
  abelha(b) {                                                                      // abelha: gorro amarelo às riscas, antenas, asas grandes, riscas pretas na barriga e ferrão
    b.keep(0.12).add(new THREE.SphereGeometry(0.61, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.48), 0xffc61a, 0, 2.05, -0.03, 1, 0.98, 1, -0.28, 0, 0)   // gorro amarelo
      .keep(0.08).add(torus(0.58, 0.045, Math.PI * 2), 0x15151f, 0, 2.33, -0.05, 1, 1, 1, Math.PI / 2 - 0.28, 0, 0)    // risca do gorro
      .add(torus(0.45, 0.045, Math.PI * 2), 0x15151f, 0, 2.5, -0.1, 1, 1, 1, Math.PI / 2 - 0.28, 0, 0);
    for (const sx of [-1, 1]) b.keep(0.1).add(torus(0.14, 0.022, Math.PI * 1.2), 0x15151f, sx * 0.22, 2.74, 0.12, 1, 1, 1, 0, Math.PI / 2, sx > 0 ? 0.2 : Math.PI - 0.2)   // antenas aos caracóis
      .add(sph(0.065, 8, 6), 0x15151f, sx * 0.3, 2.86, 0.14);
    b.keep(0.08).add(torus(0.555, 0.06), 0x15151f, 0, 1.0, 0, 1, 1, 1, Math.PI / 2, 0, 0).add(torus(0.55, 0.06), 0x15151f, 0, 1.28, 0, 1, 1, 1, Math.PI / 2, 0, 0);   // riscas
    for (const sx of [-1, 1]) for (const [y, r, sy] of [[1.55, 0.36, 0.62], [1.18, 0.26, 0.55]]) b.keep(0).add(sph(r, 14, 8), 0xf4fbff, sx * 0.36, y, -0.52, 1, sy, 0.1, 0, sx * 0.45, sx * 0.55);   // asas (2 de cada lado)
    b.keep(0.1).add(cone(0.08, 0.26, 8), 0x15151f, 0, 0.7, -0.56, 1, 1, 1, -1.9, 0, 0);            // ferrão
    b.keep(1);
  },
  cavaleiro(b) {
    b.add(sph(0.62, 20, 14), METAL, 0, 2.02, 0, 1, 1, 1);                                         // elmo
    b.add(box(0.5, 0.05, 0.06), DARK, 0, 2.02, 0.6).add(box(0.05, 0.3, 0.06), DARK, 0, 1.92, 0.6); // viseira em T
    for (const [y, z, r] of [[2.68, -0.05, 0.13], [2.7, -0.25, 0.12], [2.6, -0.42, 0.11]]) b.add(sph(r, 10, 8), RED, 0, y, z, 0.7, 1, 1);   // pluma
  },
  mago(b) {
    b.add(cone(0.3, 0.7, 12), WHITE, 0, 1.45, 0.38, 1.2, 1, 0.6, Math.PI, 0, 0);                  // barba comprida
    for (const s of [-1, 1]) b.add(sph(0.1, 10, 8), WHITE, s * 0.1, 1.8, 0.52, 1.5, 0.6, 0.7, 0, 0, s * 0.3)   // bigode
      .add(sph(0.06, 8, 6), WHITE, s * 0.2, 2.24, 0.48, 2.4, 0.8, 0.7, 0, 0, -s * 0.2)                         // sobrancelhas fartas
      .add(sph(0.18, 10, 8), WHITE, s * 0.5, 2.0, -0.12);                                                       // cabelo dos lados
    b.add(cyl(0.78, 0.78, 0.04, 20), 0x3a2a8a, 0, 2.32, 0).add(cone(0.42, 0.95, 14), 0x3a2a8a, 0, 2.8, -0.04, 1, 1, 1, -0.12, 0, 0);   // chapéu
    b.add(sph(0.07, 8, 6), GOLD, 0.15, 2.7, 0.33);                                               // estrela
  },
  robo(b) {
    b.add(box(0.7, 0.22, 0.12), DARK, 0, 2.02, 0.48);                                              // viseira
    for (const s of [-1, 1]) b.add(box(0.14, 0.06, 0.04), WHITE, s * 0.16, 2.02, 0.55)              // olhos a brilhar
      .add(cyl(0.08, 0.08, 0.1, 10), METAL, s * 0.58, 2.0, 0, 1, 1, 1, 0, 0, Math.PI / 2);          // parafusos das orelhas
    for (const x of [-0.08, 0, 0.08]) b.add(box(0.03, 0.08, 0.03), DARK, x, 1.78, 0.52);           // grelha da boca
    b.add(cyl(0.02, 0.02, 0.32, 6), METAL, 0.1, 2.68, 0).add(sph(0.06, 8, 6), RED, 0.1, 2.86, 0);   // antena
  },
  alien(b, L) {
    for (const s of [-1, 1]) b.add(cyl(0.015, 0.015, 0.42, 6), L.skin, s * 0.2, 2.68, 0, 1, 1, 1, 0, 0, -s * 0.3).add(sph(0.07, 8, 6), GOLD, s * 0.27, 2.88, 0);
  },
  astronauta(b) {
    b.add(new THREE.SphereGeometry(0.7, 20, 12, Math.PI * 0.75, Math.PI * 1.5), WHITE, 0, 2.02, 0);   // capacete (aberto à frente: a abertura fica virada para +z)
    b.add(torus(0.5, 0.07), 0xd8dde6, 0, 2.02, 0.42, 1, 1.05, 1);                                  // aro à volta da cara
    b.add(cyl(0.02, 0.02, 0.3, 6), METAL, -0.32, 2.75, -0.1).add(sph(0.05, 8, 6), RED, -0.32, 2.92, -0.1);   // antena
    b.add(box(0.56, 0.62, 0.3), WHITE, 0, 1.22, -0.58);                                            // mochila de oxigénio
  },
  dino(b, L) {                                                                     // dinossauro: focinho grande com dentes e narinas, espinhos laranja da testa até à cauda
    b.keep(0.45).add(sph(0.3, 16, 12), L.skin, 0, 1.72, 0.48, 1.3, 0.62, 1.0);                      // focinho (por baixo dos olhos)
    for (const sx of [-1, 1]) b.keep(0.1).add(sph(0.035, 6, 5), DARK, sx * 0.1, 1.82, 0.77);        // narinas
    for (let i = -3; i <= 3; i++) b.keep(0).add(cone(0.028, 0.07, 5), WHITE, i * 0.07, 1.61, 0.72 - Math.abs(i) * 0.035, 1, 1, 1, Math.PI, 0, 0);   // dentes
    b.keep(0.05).add(box(0.44, 0.02, 0.04), 0x2b6a3a, 0, 1.64, 0.72);                              // boca
    for (let i = 0; i < 6; i++) { const a = -0.15 + i * 0.36; b.keep(0.12).add(cone(0.11, 0.26, 4), 0xff8a1f, 0, 2.06 + Math.cos(a) * 0.62, Math.sin(a) * -0.62, 1, 1, 0.45, -a, 0, 0); }   // espinhos da cabeça
    for (const [y, z] of [[1.42, -0.52], [1.15, -0.6], [0.88, -0.58]]) b.add(cone(0.12, 0.26, 4), 0xff8a1f, 0, y, z, 1, 1, 0.45, -Math.PI / 2, 0, 0);   // espinhos das costas
    b.keep(0.45).add(cone(0.28, 0.95, 12), L.skin, 0, 0.6, -0.84, 1, 1, 1, -1.9, 0, 0);              // cauda
    for (const [y, z] of [[0.66, -1.05], [0.6, -1.3]]) b.keep(0.12).add(cone(0.07, 0.16, 4), 0xff8a1f, 0, y + 0.1, z, 1, 1, 0.45, -0.3, 0, 0);   // espinhos da cauda
    b.keep(1);
  },
  princesa(b) {                                                                    // princesa: cabelo dourado comprido, coroa com pedras, colar e pestanas
    const H = 0xffc61a;
    b.keep(0.4).add(new THREE.SphereGeometry(0.61, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), H, 0, 2.06, -0.03, 1, 0.98, 1, -0.3, 0, 0)   // cabelo em cima
      .add(sph(0.62, 16, 12), H, 0, 1.72, -0.2, 1.02, 1.25, 0.8);                                    // cabelo comprido pelas costas
    for (const sx of [-1, 1]) b.add(sph(0.16, 10, 8), H, sx * 0.5, 1.75, 0.1, 0.7, 1.7, 0.8)       // madeixas dos lados
      .add(sph(0.12, 10, 8), H, sx * 0.5, 1.42, 0.12, 0.8, 1.2, 0.8);
    for (const sx of [-1, 1]) b.add(sph(0.2, 10, 8), H, sx * 0.24, 2.4, 0.36, 1.3, 0.55, 0.7, 0, 0, sx * 0.4);   // franja
    b.keep(0.02).add(cyl(0.3, 0.27, 0.12, 16, 1), GOLD, 0, 2.55, 0.0, 1, 1, 1, -0.25, 0, 0);       // coroa
    for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.55; b.add(cone(0.05, 0.16, 4), GOLD, Math.sin(a) * 0.29, 2.66, Math.cos(a) * 0.29 - 0.04, 1, 1, 1, -0.25, 0, 0); }
    for (const [x, c] of [[0, 0xff3b8a], [-0.17, 0x2fc8ff], [0.17, 0x2fc8ff]]) b.keep(0).add(sph(0.04, 8, 6), c, x, 2.56, 0.29 - Math.abs(x) * 0.25);   // pedras da coroa
    for (let i = -3; i <= 3; i++) b.keep(0).add(sph(0.028, 6, 5), WHITE, i * 0.07, 1.56 + Math.abs(i) * 0.012, 0.3 - Math.abs(i) * 0.015);   // colar de pérolas
    b.keep(0).add(torus(0.6, 0.04), WHITE, 0, 0.38, 0, 1, 1, 1, Math.PI / 2, 0, 0);                  // renda no fundo do vestido
    b.keep(1);
  },
};

// ---------- pormenores nos braços e nas pernas (a = braço, sl = manga; t = coxa, sh = canela) ----------
const LIMBS = {
  gato: { arm: (a) => a.keep(0).add(sph(0.05, 6, 5), PINK, 0, -0.8, 0.1).keep(1) },                       // almofadinha da pata
  zombie: {
    arm: (a, s) => { if (s < 0) a.keep(0).add(cyl(0.1, 0.1, 0.16, 10), WHITE, 0, -0.46, 0).add(cyl(0.095, 0.095, 0.1, 10), WHITE, 0, -0.6, 0).keep(1); },   // ligaduras no braço
    leg: (t, sh, s) => { if (s > 0) sh.keep(0).add(cyl(0.11, 0.11, 0.14, 10), WHITE, 0, -0.1, 0).keep(1); },
  },
  bombeiro: {
    arm: (a) => a.keep(0).add(torus(0.12, 0.03), 0xfff07a, 0, -0.32, 0, 1, 1, 1, Math.PI / 2, 0, 0).keep(0.15).add(sph(0.13, 10, 8), 0x2b2b2b, 0, -0.72, 0.02).keep(1),   // faixa refletora e luva
    leg: (t, sh) => sh.keep(0.12).add(cyl(0.12, 0.12, 0.26, 10), 0x1d1d22, 0, -0.14, 0).keep(0).add(torus(0.125, 0.025), 0xfff07a, 0, -0.12, 0, 1, 1, 1, Math.PI / 2, 0, 0).keep(1),   // botas altas
  },
  ninja: {
    arm: (a) => a.keep(0.12).add(cyl(0.095, 0.095, 0.24, 10), 0x15151f, 0, -0.5, 0).add(sph(0.125, 10, 8), 0x15151f, 0, -0.72, 0.02).keep(1),   // braçadeiras e luvas pretas
    leg: (t, sh) => sh.keep(0.12).add(cyl(0.105, 0.105, 0.26, 10), 0x15151f, 0, -0.13, 0).keep(1),
  },
  vampiro: { arm: (a) => a.keep(0).add(torus(0.1, 0.03), WHITE, 0, -0.62, 0, 1, 1, 1, Math.PI / 2, 0, 0).keep(1) },   // punhos de renda
  princesa: { arm: (a) => a.keep(0).add(cyl(0.09, 0.09, 0.3, 10), WHITE, 0, -0.55, 0).keep(1) },          // luvas brancas
  dino: { leg: (t, sh, s, L) => sh.keep(0.45).add(sph(0.2, 12, 8), L.skin, 0, -0.34, 0.08, 1, 0.6, 1.4).keep(1) },   // pés de dinossauro
};

// ---------- corpos: a roupa (cor da tinta), o resto do tronco, os braços e as pernas de cada tipo ----------
// sx: distância dos ombros ao centro (os corpos mais largos têm os braços mais afastados)
const TORSO = [[0, 0.8], [0.36, 0.82], [0.41, 0.98], [0.4, 1.3], [0.34, 1.52], [0.16, 1.62], [0, 1.63]];
const CHUBBY = [[0, 0.72], [0.44, 0.74], [0.55, 0.95], [0.56, 1.2], [0.46, 1.47], [0.2, 1.61], [0, 1.63]];
const SHORTS = [[0, 0.6], [0.37, 0.6], [0.42, 0.72], [0.4, 0.9], [0, 0.9]];
const D_ARM = 0.085;                                                               // grossura normal do braço
const BODIES = {
  normal: { sx: 0.39, shirt: (p) => p.add(lathe(TORSO), WHITE), base: (b, L) => b.add(lathe(SHORTS), L.shorts) },
  redondo: {                                                                       // barriga redonda, braços e pernas mais grossos
    sx: 0.5, arm: 0.1, hand: 0.135, thigh: 0.135, shin: 0.12, shoe: 1.15,
    shirt: (p) => p.add(lathe(CHUBBY), WHITE),
    base: (b, L) => b.add(lathe([[0, 0.56], [0.45, 0.56], [0.52, 0.7], [0.5, 0.86], [0, 0.86]]), L.shorts),
  },
  robo: {                                                                          // tudo aos quadrados, de metal, com luzes no peito
    sx: 0.47, neck: METAL,
    shirt: (p) => p.add(box(0.8, 0.78, 0.58), WHITE, 0, 1.24, 0),
    base: (b, L) => {
      b.add(box(0.66, 0.24, 0.5), L.shorts, 0, 0.78, 0).add(box(0.34, 0.24, 0.06), DARK, 0, 1.3, 0.3);
      for (const [x, c] of [[-0.08, RED], [0.02, GOLD], [0.12, 0x47e06a]]) b.add(sph(0.035, 8, 6), c, x, 1.3, 0.34);
    },
    armPart: (a, L) => a.add(box(0.22, 0.22, 0.22), METAL, 0, -0.06, 0).add(cyl(0.07, 0.07, 0.56, 8), METAL, 0, -0.38, 0).add(sph(0.09, 8, 6), DARK, 0, -0.38, 0)
      .add(box(0.17, 0.16, 0.16), METAL, 0, -0.72, 0.02),                         // ombro, braço com cotovelo e pinça
    legPart: (t, sh, L) => { t.add(cyl(0.08, 0.08, 0.4, 8), METAL, 0, -0.2, 0); sh.add(sph(0.1, 8, 6), DARK, 0, 0, 0).add(cyl(0.08, 0.08, 0.28, 8), METAL, 0, -0.14, 0).add(box(0.24, 0.12, 0.34), L.shorts, 0, -0.36, 0.06); },
  },
  armadura: {                                                                      // túnica com ombreiras, cinto e botas de metal
    sx: 0.42,
    shirt: (p) => p.add(lathe(TORSO), WHITE),
    base: (b, L) => {
      b.add(lathe(SHORTS), L.shorts).add(torus(0.42, 0.05), METAL, 0, 0.9, 0, 1, 1, 1, Math.PI / 2, 0, 0).add(box(0.14, 0.12, 0.05), GOLD, 0, 0.9, 0.43);
      for (const s of [-1, 1]) b.add(sph(0.2, 12, 8), METAL, s * 0.42, 1.55, 0, 1.1, 0.65, 1.1);
    },
    armPart: (a, L) => a.add(cyl(0.085, 0.08, 0.3), L.skin, 0, -0.3, 0).add(cyl(0.11, 0.1, 0.3, 10), METAL, 0, -0.52, 0).add(sph(0.13, 10, 8), METAL, 0, -0.73, 0.02),
    legPart: (t, sh, L) => { t.add(cyl(0.11, 0.1, 0.4), L.shorts, 0, -0.2, 0); sh.add(sph(0.11, 8, 6), METAL, 0, 0, 0.03).add(cyl(0.12, 0.11, 0.3, 10), METAL, 0, -0.15, 0).add(sph(0.18, 12, 8), METAL, 0, -0.34, 0.07, 1, 0.6, 1.5); },
  },
  fato: {                                                                          // fato espacial fofo, branco, com anéis
    sx: 0.47, arm: 0.12, hand: 0.15, thigh: 0.14, shin: 0.135, shoe: 1.25, limb: WHITE,
    shirt: (p) => p.add(lathe([[0, 0.74], [0.42, 0.76], [0.5, 0.95], [0.5, 1.28], [0.42, 1.5], [0.2, 1.62], [0, 1.63]]), WHITE),
    base: (b) => {
      b.add(lathe([[0, 0.56], [0.44, 0.56], [0.5, 0.7], [0.49, 0.86], [0, 0.86]]), WHITE).add(torus(0.5, 0.05), 0xd8dde6, 0, 0.88, 0, 1, 1, 1, Math.PI / 2, 0, 0);
      b.add(box(0.3, 0.2, 0.08), WHITE, 0, 1.22, 0.46).add(sph(0.03, 6, 5), RED, -0.07, 1.24, 0.5).add(sph(0.03, 6, 5), 0x2f7bff, 0.05, 1.24, 0.5);   // painel no peito
    },
  },
  vestido: {                                                                       // vestido comprido (até aos joelhos) com cinto dourado
    sx: 0.39, sleeve: 1.25,
    shirt: (p) => p.add(lathe([[0, 0.36], [0.64, 0.34], [0.58, 0.52], [0.45, 0.78], [0.37, 0.98], [0.4, 1.3], [0.34, 1.52], [0.16, 1.62], [0, 1.63]]), WHITE),
    base: (b) => b.add(torus(0.38, 0.04), GOLD, 0, 0.98, 0, 1, 1, 1, Math.PI / 2, 0, 0),
  },
  manto: {                                                                         // manto até aos pés, mangas largas e cinto de corda
    sx: 0.4,
    shirt: (p) => p.add(lathe([[0, 0.1], [0.56, 0.08], [0.52, 0.4], [0.45, 0.8], [0.42, 1.0], [0.42, 1.3], [0.36, 1.52], [0.16, 1.62], [0, 1.63]]), WHITE),
    base: (b) => b.add(torus(0.43, 0.035), GOLD, 0, 0.98, 0, 1, 1, 1, Math.PI / 2, 0, 0).add(sph(0.05, 8, 6), GOLD, 0.15, 0.93, 0.4),
    sleevePart: (p) => p.add(cyl(0.13, 0.22, 0.5, 12), WHITE, 0, -0.32, 0),         // manga larga (na cor da tinta)
  },
  pinguim: {                                                                       // pinguim: corpo redondo e preto, barbatanas em vez de braços, pés laranja grandes
    sx: 0.5, thigh: 0.12, shin: 0.11,
    shirt: (p) => p.add(lathe(CHUBBY), WHITE),
    base: (b) => b.keep(0.12).add(lathe([[0, 0.56], [0.45, 0.56], [0.52, 0.7], [0.5, 0.86], [0, 0.86]]), 0x1d1d2b).keep(1),
    sleevePart: () => {},
    armPart: (a) => a.keep(0.12).add(sph(0.3, 12, 10), 0x1d1d2b, 0, -0.32, 0, 0.32, 1.25, 0.65, 0, 0, 0.15).keep(1),   // barbatana
    legPart: (t, sh) => { t.keep(0.12).add(cyl(0.12, 0.11, 0.4), 0x1d1d2b, 0, -0.2, 0); sh.keep(0.12).add(cyl(0.11, 0.1, 0.26), 0x1d1d2b, 0, -0.12, 0).keep(0.06).add(sph(0.2, 12, 8), ORANGE, 0, -0.38, 0.12, 1.1, 0.35, 1.6).keep(1); },
  },
  dino: {                                                                          // corpo grosso com barriga clara, cauda e garras
    sx: 0.48, arm: 0.105, hand: 0.13, thigh: 0.15, shin: 0.13, shoe: 1.2, claws: true,
    shirt: (p) => p.add(lathe(CHUBBY), WHITE),
    base: (b, L) => b.add(lathe([[0, 0.56], [0.45, 0.56], [0.52, 0.7], [0.5, 0.86], [0, 0.86]]), L.shorts).add(sph(0.36, 14, 10), 0xe8f2b0, 0, 1.12, 0.3, 0.9, 1.15, 0.6),
  },
};

export function buildLightCharacter(id) {
  const L = LIGHT_LOOKS[id] || LIGHT_LOOKS.pinta;
  const paintMat = new THREE.MeshStandardMaterial({ name: "Paint", color: 0xff3b4a, roughness: 0.5 });
  const baked = new THREE.MeshStandardMaterial({ name: "Baked", vertexColors: true, roughness: 0.55 });
  const gunMat = new THREE.MeshStandardMaterial({ name: "AmmoTank", color: 0xff3b4a, roughness: 0.35 });
  const scene = new THREE.Group();
  const part = (name, x, y, z, parent = scene) => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); return g; };
  const put = (g, ...meshes) => { for (const m of meshes) if (m) g.add(m); };

  // ---------- TRONCO E CABEÇA (origem no chão: cabeça centrada em y = 2.0, cara virada para +z) ----------
  const B = BODIES[L.body] || BODIES.normal, D = BODIES.normal;
  const body = part("Body", 0, 0, 0);
  const shirt = new Baker(); B.shirt(shirt);                                       // a roupa (cor da tinta)
  const b = new Baker();
  B.base(b, L);                                                                    // calções, cinto, ombreiras...
  b.keep(L.skinKeep ?? 1);                                                         // skins com pele de cor própria (verde, laranja...) são menos tingidas
  b.add(cyl(0.14, 0.16, 0.2), B.neck || L.skin, 0, 1.64, 0)                         // pescoço
   .add(sph(0.56, 20, 16), L.skin, 0, 2.0, 0, 1, 0.94, 0.96)                                  // cabeça
   .add(sph(0.11, 10, 8), L.skin, -0.55, 1.98, 0, 0.5, 1, 0.8).add(sph(0.11, 10, 8), L.skin, 0.55, 1.98, 0, 0.5, 1, 0.8);   // orelhas
  b.keep(1);
  for (const s of [-1, 1]) {
    if (L.eyes === "alien") b.add(sph(0.17, 12, 10), PUPIL, s * 0.22, 2.0, 0.45, 0.8, 1.35, 0.5, 0, 0, s * 0.45)   // olhos grandes e pretos, inclinados
      .add(sph(0.04, 6, 5), EYE_WHITE, s * 0.2 + 0.04, 2.08, 0.53);
    else if (L.eyes !== "none") {
      const big = L.eyes === "zombie" && s > 0 ? 1.18 : 1, pr = L.eyes === "zombie" && s > 0 ? 0.045 : 0.095;   // zombie: um olho maior e esbugalhado
      b.add(sph(0.155 * big, 12, 10), EYE_WHITE, s * 0.2, 2.0, 0.44, 0.85, 1.15, 0.55)        // olhos grandes
       .keep(L.pupil ? 0.15 : 1).add(sph(pr, 10, 8), L.pupil || PUPIL, s * 0.2, 1.98, 0.51, 0.85, 1.12, 0.5).keep(1)   // pupilas
       .add(sph(0.035, 6, 5), EYE_WHITE, s * 0.2 + 0.035, 2.03, 0.555);                       // brilho
      if (L.lashes) for (const k of [0, 1]) b.add(box(0.07, 0.022, 0.02), DARK, s * (0.31 + k * 0.03), 2.13 - k * 0.05, 0.48, 1, 1, 1, 0, 0, s * (0.5 + k * 0.3));   // pestanas
    }
    if (L.eyes !== "none") b.add(sph(0.08, 10, 6), CHEEK, s * 0.34, 1.84, 0.42, 1.2, 0.6, 0.5);   // bochechas
    if (L.cap !== false) b.add(sph(0.045, 8, 6), L.hair, s * 0.2, 2.24, 0.47, 2.4, 0.6, 0.7, 0, 0, -s * 0.18);   // sobrancelhas
  }
  if (!L.mouth) b.add(new THREE.TorusGeometry(0.075, 0.022, 6, 12, Math.PI), MOUTH, 0, 1.81, 0.515, 1, 1, 1, Math.PI, 0, 0);   // sorriso
  else if (L.mouth === "line") b.add(new THREE.BoxGeometry(0.14, 0.025, 0.03), MOUTH, 0, 1.8, 0.52);
  else if (L.mouth === "cat") for (const sx of [-1, 1]) b.add(new THREE.TorusGeometry(0.045, 0.016, 6, 10, Math.PI), MOUTH, sx * 0.045, 1.8, 0.55, 1, 1, 1, Math.PI, 0, 0);   // boca de gato ("w")
  // cabelo: calote por cima da cabeça + o penteado de cada um
  if (L.cap !== false) {
    b.add(new THREE.SphereGeometry(0.6, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), L.hair, 0, 2.06, -0.03, 1, 0.98, 1, -0.32, 0, 0);
    for (const s of [-1, 0, 1]) b.add(sph(0.16, 10, 8), L.hair, s * 0.21, 2.42, 0.38 - Math.abs(s) * 0.05, 1.2, 0.62, 0.75);   // franja
  }
  if (!L.body || L.body === "redondo" || L.body === "dino") b.add(new THREE.TorusGeometry(0.2, 0.05, 6, 16), 0xffffff, 0, 1.6, 0.02, 1, 1, 1, Math.PI / 2, 0, 0);   // gola branca
  const hair = {
    franja: () => { b.add(sph(0.6, 16, 10), L.hair, 0, 1.9, -0.12, 1.05, 0.95, 0.9); },   // cabelo pelos ombros (atrás da cabeça)
  };
  hair[L.style]?.();
  for (const x of L.extras || []) EXTRAS[x]?.(b, L);
  put(body, noColor(shirt.mesh(paintMat, "Shirt")), b.mesh(baked, "BodyBaked"));

  // ---------- BRAÇOS (origem no ombro; a mão fica ~0,75 abaixo) ----------
  for (const s of [-1, 1]) {
    const arm = part(s < 0 ? "ArmL" : "ArmR", s * B.sx, 1.58, 0);
    const sleeve = new Baker(), a = new Baker(), ar = B.arm || D_ARM, hr = B.hand || 0.12, limb = B.limb || L.skin;
    if (B.sleevePart) B.sleevePart(sleeve);
    else if (L.body !== "robo") sleeve.add(sph(0.155 * (ar / D_ARM) * (B.sleeve || 1), 12, 10), WHITE, 0, -0.08, 0, 1, 1.15, 1);   // manga curta
    else sleeve.add(box(0.26, 0.2, 0.26), WHITE, 0, 0.06, 0);                       // robô: tampa do ombro
    if (B.armPart) B.armPart(a, L);
    else {
      a.keep(L.skinKeep ?? 1).add(cyl(ar, ar * 0.94, 0.5), limb, 0, -0.42, 0).keep(L.hand ? 0 : L.skinKeep ?? 1).add(sph(hr, 12, 10), L.hand || limb, 0, -0.72, 0.02).keep(1);   // braço e mão redonda
      if (!B.sleevePart) a.add(new THREE.TorusGeometry(ar + 0.05, 0.035, 6, 14), WHITE, 0, -0.2, 0, 1, 1, 1, Math.PI / 2, 0, 0);   // punho branco da manga
      if (B.claws) for (const k of [-1, 0, 1]) a.add(cone(0.025, 0.08, 5), WHITE, k * 0.06, -0.84, 0.06, 1, 1, 1, Math.PI, 0, 0);   // garras
    }
    for (const x of L.extras || []) LIMBS[x]?.arm?.(a, s, L, sleeve);
    put(arm, noColor(sleeve.mesh(paintMat, "Sleeve")), a.mesh(baked, "ArmBaked"));
    if (s > 0) {                                                       // pistola de tinta na mão direita (toda na cor da munição)
      const gun = new Baker()
        .add(new THREE.CapsuleGeometry(0.085, 0.3, 4, 10), 0xffffff, 0, -0.72, 0.24, 1, 1.1, 1, Math.PI / 2, 0, 0)   // corpo
        .add(cyl(0.045, 0.045, 0.28, 8), 0xffffff, 0, -0.7, 0.56, 1, 1, 1, Math.PI / 2, 0, 0)                      // cano
        .add(cyl(0.075, 0.06, 0.07, 10), 0xffffff, 0, -0.7, 0.72, 1, 1, 1, Math.PI / 2, 0, 0)                      // bocal
        .add(sph(0.11, 12, 8), 0xffffff, 0, -0.57, 0.16)                                                             // depósito de tinta
        .add(new THREE.BoxGeometry(0.09, 0.2, 0.11), 0xffffff, 0, -0.84, 0.08, 1, 1, 1, 0.25, 0, 0);                // punho
      arm.add(noColor(gun.mesh(gunMat, "Gun")));
    }
  }

  // ---------- PERNAS (anca a y = 0.78; joelho 0,36 abaixo; o pé chega ao chão) ----------
  for (const s of [-1, 1]) {
    const wide = B.thigh ? 0.16 : 0.13;                                            // pernas mais afastadas nos corpos largos
    const leg = part(s < 0 ? "LegL" : "LegR", s * wide, 0.78, 0);
    const shin = part(s < 0 ? "ShinL" : "ShinR", 0, -0.36, 0, leg);
    const t = new Baker(), sh = new Baker(), th = B.thigh || 0.11, sr = B.shin || 0.1, k = B.shoe || 1, limb = B.limb || L.skin;
    if (B.legPart) B.legPart(t, sh, L);
    else {
      t.keep(L.skinKeep ?? 1).add(cyl(th, th * 0.92, 0.4), limb, 0, -0.2, 0).keep(1);
      sh.keep(L.skinKeep ?? 1).add(cyl(sr, sr * 0.95, 0.26), limb, 0, -0.12, 0).keep(1)
        .add(cyl(sr + 0.005, sr + 0.005, 0.08), WHITE, 0, -0.26, 0)                 // meia
        .add(sph(0.17 * k, 12, 10), L.shoe, 0, -0.42 + 0.09 * k, 0.07, 1, 0.62, 1.45)   // sapato
        .add(cyl(0.16 * k, 0.16 * k, 0.06, 12), L.sole, 0, -0.41, 0.07, 1, 1, 1.4);     // sola
      if (B.claws) for (const x of [-0.07, 0, 0.07]) sh.add(cone(0.03, 0.09, 5), WHITE, x, -0.38, 0.32, 1, 1, 1, Math.PI / 2, 0, 0);   // garras dos pés
    }
    for (const x of L.extras || []) LIMBS[x]?.leg?.(t, sh, s, L);
    put(leg, t.mesh(baked, "ThighBaked")); put(shin, sh.mesh(baked, "ShinBaked"));
  }
  return scene;
}

// ---------- cor do boneco leve: tinge os vértices (a mesma regra que os bonecos com materiais) ----------
// Cada vértice guarda a cor original; o branco (olhos) fica igual, o escuro vai para meia cor, o resto mistura com a cor do jogador.
const _base = new THREE.Color(), _tint = new THREE.Color(), _half = new THREE.Color(), _white = new THREE.Color(1, 1, 1);
export function tintBaked(meshes, hex, k, fade = 0) {
  _tint.setHex(hex); _half.copy(_tint).multiplyScalar(0.5);
  for (const m of meshes) {
    const col = m.geometry.attributes.color, a = col.array, tk = m.geometry.attributes.tintk?.array;
    const base = m.geometry.userData.base || (m.geometry.userData.base = Float32Array.from(a));
    for (let i = 0; i < a.length; i += 3) {
      _base.setRGB(base[i], base[i + 1], base[i + 2]);
      const l = 0.2126 * _base.r + 0.7152 * _base.g + 0.0722 * _base.b;
      const kk = k * (tk ? tk[i / 3] : 1);                                         // pormenores com cor própria são menos tingidos
      if (l <= 0.85 && kk > 0) {
        if (l < 0.12) _base.lerp(_half, kk);
        else _base.lerp(_tint, kk);
      }
      if (fade > 0) _base.lerp(_white, fade);
      a[i] = _base.r; a[i + 1] = _base.g; a[i + 2] = _base.b;
    }
    col.needsUpdate = true;
  }
}
