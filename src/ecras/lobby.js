import * as THREE from "three";
import { cloneCharacter, setCharacterPaint } from "../personagens/character-model.js";
import { animateCharacter } from "../personagens/character-animator.js";
import { MOTION } from "../movimento/player-motion.js";
import { CATEGORIES, ITEMS, applyCosmetics, itemById } from "../loja/cosmetics.js";
import { createTrails } from "../loja/trails.js";
import * as Progress from "../progresso/progress.js";
import * as Emotes from "../personagens/emotes.js";
import * as Stats from "../progresso/stats.js";
import * as Ach from "../progresso/achievements.js";
import * as Missions from "../progresso/missions.js";
import { Sfx } from "../som/sfx.js";
import { playerName, setPlayerName, NAME_MAX } from "../progresso/player-name.js";
import { portraitUrl, fullBodyUrl } from "../personagens/portraits.js";
import * as ShopArt from "../loja/shop-art.js";
import { CHARACTERS } from "../personagens/characters.js";
import { TEAM, MODES, BOT_PRESETS } from "../base/game-config.js";
import { MAPS } from "../mapas/map-definitions.js";
import { chipHTML } from "../base/colors.js";
import { COLORS, PRIMARIES, SECONDARIES } from "../base/colors.js";

/* ============================================================
   LOBBY: o ecrã principal. Palco 3D com o teu boneco (a rodar devagar; arrasta com o rato para o rodar),
   nível, moedas e joias em cima e um painel à direita com a Loja e o Inventário (separadores Skins,
   Acessórios e Armas). O que equipas aparece logo no boneco do lobby e depois no jogo.
   Só é desenhado enquanto o lobby está aberto (a 30 fps), por isso não pesa durante as partidas.
   ============================================================ */
// o boneco do lobby vai trocando entre as 6 cores do jogo, de 5 em 5 s (com uma passagem suave)
const SHOW = [...PRIMARIES, ...SECONDARIES].map((id) => COLORS[id].hex), EVERY = 5, FADE = 0.6;
let colorIdx = 0, colorT = 0, PAINT = SHOW[0];
const _a = new THREE.Color(), _b = new THREE.Color();

// ---------- cenário do lobby: um estúdio de tinta gigante (tudo formas simples, criadas uma vez) ----------
const PAL6 = [0xff3b4a, 0xffd21f, 0x2f7bff, 0x47e06a, 0xa447ff, 0xff8a1f];
function gradientTexture(stops) {
  const c = document.createElement("canvas"); c.width = 4; c.height = 256;
  const g = c.getContext("2d"), grd = g.createLinearGradient(0, 0, 0, 256);
  stops.forEach((col, i) => grd.addColorStop(i / (stops.length - 1), col));
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// mancha com borda irregular (círculo com os pontos mexidos)
function blobGeometry(r, seed) {
  const geo = new THREE.CircleGeometry(r, 28), pos = geo.attributes.position;
  let a = seed * 9301 + 49297;
  const rnd = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
  for (let i = 1; i < pos.count; i++) { const k = 0.86 + rnd() * 0.24; pos.setXY(i, pos.getX(i) * k, pos.getY(i) * k); }
  return geo;
}
// sombreado "cartoon" (3 tons) e contorno preto (uma cópia ligeiramente maior virada do avesso)
let _toonGrad = null;
function toon(color, o = {}) {
  if (!_toonGrad) { _toonGrad = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat); _toonGrad.minFilter = _toonGrad.magFilter = THREE.NearestFilter; _toonGrad.needsUpdate = true; }
  return new THREE.MeshToonMaterial({ color, gradientMap: _toonGrad, ...o });
}
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x1a1033, side: THREE.BackSide });
function outlined(geo, mat, k = 1.06) {
  const g = new THREE.Group(), m = new THREE.Mesh(geo, mat), o = new THREE.Mesh(geo, OUTLINE);
  o.scale.setScalar(k); m.castShadow = true; g.add(o, m); g.userData.main = m;
  return g;
}
const _sv = new THREE.Vector3();
const CSS6 = ["#ff3b4a", "#ffd21f", "#2f7bff", "#47e06a", "#a447ff", "#ff8a1f"];
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// mancha de tinta com contorno, gotas à volta e um brilho (estilo cartoon)
function splat2d(g, x, y, r, color, rnd) {
  const pts = [];
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, rr = r * (0.75 + rnd() * 0.45); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  const path = () => { g.beginPath(); g.moveTo((pts[0][0] + pts[13][0]) / 2, (pts[0][1] + pts[13][1]) / 2); for (let i = 0; i < 14; i++) { const p = pts[i], q = pts[(i + 1) % 14]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); } };
  g.lineWidth = r * 0.12; g.strokeStyle = "#1a1033"; path(); g.stroke();
  g.fillStyle = color; path(); g.fill();
  for (let i = 0; i < 6; i++) { const a = rnd() * Math.PI * 2, d = r * (1.15 + rnd() * 0.6), s = r * (0.06 + rnd() * 0.12); g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, s, 0, Math.PI * 2); g.fill(); g.lineWidth = s * 0.35; g.stroke(); }
  g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.25, r * 0.28, r * 0.14, -0.6, 0, Math.PI * 2); g.fill();
}
const seeded = (seed) => () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
// chão: 60 x 60 m numa imagem de 1024 (≈ 17 px por metro)
function floorTexture(tiles = ["#3a2878", "#2e2063"]) {                               // tiles = as duas cores dos azulejos (muda com o tema)
  return canvasTex(1024, 1024, (g, w) => {
    const rnd = seeded(7), px = w / 60, X = (x) => (x + 30) * px, Z = (z) => (z + 30) * px;
    for (let i = 0; i < 30; i++) for (let j = 0; j < 30; j++) { g.fillStyle = (i + j) % 2 ? tiles[0] : tiles[1]; g.fillRect(i * 2 * px, j * 2 * px, 2 * px + 1, 2 * px + 1); }   // azulejos de 2 m
    g.strokeStyle = "rgba(255,255,255,0.05)"; g.lineWidth = 2;
    for (let i = 0; i <= 30; i++) { g.beginPath(); g.moveTo(i * 2 * px, 0); g.lineTo(i * 2 * px, w); g.stroke(); g.beginPath(); g.moveTo(0, i * 2 * px); g.lineTo(w, i * 2 * px); g.stroke(); }
    [[-5, -4, 1.8], [5.2, -3.5, 1.6], [-8, 1, 2.2], [8.2, 0.5, 2], [-2.5, -9, 2.6], [3, -9.5, 2.8], [-11, -8, 2.8], [11, -8, 3], [-13, -2, 1.6], [13, -1, 1.8], [0, -13, 2.4], [-7, -13, 2], [7, -14, 2.2], [-4, 3, 0.9], [4.5, 3.5, 1]]
      .forEach(([x, z, r], i) => splat2d(g, X(x), Z(z), r * px, CSS6[i % 6], rnd));
    for (let k = 0; k < 2; k++) {                                                     // pegadas de tinta a atravessar o chão
      const c = CSS6[k * 3 + 1]; g.fillStyle = c;
      for (let s = 0; s < 9; s++) { const x = X(-10 + s * 2.3 + k * 2), z = Z(-5 - k * 5 + Math.sin(s) * 0.8) + (s % 2 ? 10 : -10); g.beginPath(); g.ellipse(x, z, 7, 11, 1.4, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(x + 13, z, 4, 0, Math.PI * 2); g.fill(); }
    }
  });
}
// parede: fundo roxo com bolinhas, quadros pintados e salpicos (a imagem dá a volta ao arco)
function wallTexture(grad = ["#5a3aa8", "#3b2580"]) {                                 // grad = cor da parede em cima e em baixo (muda com o tema)
  return canvasTex(2048, 256, (g, w, h) => {
    const rnd = seeded(3), grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, grad[0]); grd.addColorStop(1, grad[1]); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.08)";
    for (let x = 12; x < w; x += 34) for (let y = 70; y < h; y += 34) { g.beginPath(); g.arc(x + ((y / 34) % 2) * 17, y, 5, 0, Math.PI * 2); g.fill(); }   // bolinhas
    for (let i = 0; i < 9; i++) {                                                     // quadros com desenhos abstratos
      const x = 80 + i * 225 + rnd() * 30, y = 95 + rnd() * 20, fw = 110 + rnd() * 40, fh = 80 + rnd() * 30;
      g.fillStyle = "#1a1033"; g.fillRect(x - 6, y - 6, fw + 12, fh + 12);
      g.fillStyle = ["#ffd21f", "#ff8a1f", "#ffffff"][i % 3]; g.fillRect(x - 3, y - 3, fw + 6, fh + 6);
      g.fillStyle = "#fff8ec"; g.fillRect(x, y, fw, fh);
      for (let k = 0; k < 4; k++) { g.fillStyle = CSS6[(i + k) % 6]; g.beginPath(); g.arc(x + fw * (0.2 + rnd() * 0.6), y + fh * (0.25 + rnd() * 0.5), 10 + rnd() * 18, 0, Math.PI * 2); g.fill(); }
    }
    for (let i = 0; i < 14; i++) splat2d(g, rnd() * w, 150 + rnd() * 100, 14 + rnd() * 18, CSS6[i % 6], rnd);
  });
}
// telas dos cavaletes
function artTexture(n) {
  return canvasTex(256, 200, (g, w, h) => {
    g.fillStyle = "#fff8ec"; g.fillRect(0, 0, w, h);
    const rnd = seeded(n + 21);
    if (n === 0) {                                                                    // sol e montanhas
      g.fillStyle = "#9be7ff"; g.fillRect(0, 0, w, h * 0.6);
      g.fillStyle = "#ffd21f"; g.beginPath(); g.arc(w * 0.75, h * 0.25, 28, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#47e06a"; g.beginPath(); g.moveTo(0, h); g.lineTo(w * 0.3, h * 0.35); g.lineTo(w * 0.6, h); g.fill();
      g.fillStyle = "#2fb34e"; g.beginPath(); g.moveTo(w * 0.35, h); g.lineTo(w * 0.7, h * 0.45); g.lineTo(w, h); g.fill();
    } else for (let i = 0; i < 7; i++) splat2d(g, rnd() * w, rnd() * h, 18 + rnd() * 26, CSS6[i % 6], rnd);   // pintura abstrata
  });
}
// Temas do fundo do lobby (escolhidos nas Configurações). bg = céu em degradé; tint = cor por cima do chão e da parede;
// lights = força das duas luzes coloridas; colors = cores fixas dessas luzes (sem colors vão mudando de cor)
const THEME_KEY = "colorattack.lobbyTheme";
export const LOBBY_THEMES = {
  estudio: { name: "Estúdio", icon: "🎨", bg: ["#3b1f78", "#22164f", "#0d0b1f"], fog: 0x2a1a5c, hemi: [0xffffff, 0x4a3a7a, 1.3], sun: 1.6, tint: 0xffffff, cloud: 0xfdf6ff, stars: true, lights: 30,
             tiles: ["#3a2878", "#2e2063"], wall: ["#5a3aa8", "#3b2580"] },
  neon:    { name: "Noite Neon", icon: "🌃", bg: ["#170b45", "#0b0626", "#03020b"], fog: 0x0e0828, hemi: [0xb8c2ff, 0x2a1a55, 1.0], sun: 0.9, tint: 0xffffff, cloud: 0x3a2f70, stars: true, lights: 14, colors: [0xff3fd8, 0x2bf0ff],
             tiles: ["#1c1446", "#120c33"], wall: ["#24164f", "#0f0a2a"] },
  dia:     { name: "Dia de Sol", icon: "☀️", bg: ["#4fb6ff", "#a9e2ff", "#fff1cf"], fog: 0xbfe6ff, hemi: [0xffffff, 0xffe3b0, 1.5], sun: 1.8, tint: 0xffffff, cloud: 0xffffff, stars: false, lights: 6,
             tiles: ["#f3dfb4", "#e8cf9c"], wall: ["#8fd6ff", "#5fb3f0"] },
};
function buildBackdrop(scene, lights) {
  const root = new THREE.Group(); scene.add(root);
  const T = PAL6;
  // chão do estúdio: uma só imagem (desenhada uma vez) com azulejos em dois tons, manchas, salpicos e pegadas de tinta
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), toon(0xffffff, { map: floorTexture() }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.31; floor.receiveShadow = true; root.add(floor);
  // parede curva à volta, com uma faixa de tinta no topo e escorridos de todas as cores (uma só malha para os escorridos)
  const R = 17, H = 5.2, ARC = Math.PI * 1.25, A0 = Math.PI - ARC / 2;               // arco centrado atrás do palco (θ = π fica em -z) e pelos lados
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 64, 1, true, A0, ARC), toon(0xffffff, { side: THREE.BackSide, map: wallTexture() }));   // bolinhas, quadros e salpicos
  wall.position.y = H / 2 - 0.3; root.add(wall);
  const SEG = 12;
  for (let i = 0; i < SEG; i++) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.05, R - 0.05, 0.9, 8, 1, true, A0 + (i / SEG) * ARC, ARC / SEG + 0.01), toon(T[i % 6], { side: THREE.BackSide }));
    band.position.y = H - 0.3 - 0.45; root.add(band);
  }
  const NDR = 48, drips = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.28, 1, 4, 10), toon(0xffffff), NDR), m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < NDR; i++) {
    const a = A0 + ((i + 0.5) / NDR) * ARC, len = 0.6 + ((i * 37) % 11) / 11 * 2.2, seg = Math.floor(((a - A0) / ARC) * SEG);
    m4.makeScale(1, len, 1).setPosition(Math.sin(a) * (R - 0.25), H - 1.2 - len * 0.55, Math.cos(a) * (R - 0.25));
    drips.setMatrixAt(i, m4); drips.setColorAt(i, col.setHex(T[seg % 6]));
  }
  root.add(drips);
  // arco-íris atrás da roda (meio anel de 6 cores)
  const rainbow = new THREE.Group(); rainbow.position.set(0, 0.2, -14.5); root.add(rainbow);
  T.forEach((c, i) => { const r = 7.2 - i * 0.55, arc = new THREE.Mesh(new THREE.TorusGeometry(r, 0.3, 8, 48, Math.PI), toon(c)); rainbow.add(arc); });
  // roda das cores (com contorno), a girar devagar
  const wheel = new THREE.Group(); wheel.position.set(0, 2.9, -12); wheel.scale.setScalar(0.85); root.add(wheel);
  T.forEach((c, i) => wheel.add(new THREE.Mesh(new THREE.CircleGeometry(3.4, 24, (i / 6) * Math.PI * 2, Math.PI / 3), new THREE.MeshBasicMaterial({ color: c }))));
  const back = new THREE.Mesh(new THREE.CircleGeometry(3.75, 48), new THREE.MeshBasicMaterial({ color: 0x1a1033 })); back.position.z = -0.02; wheel.add(back);
  const hub = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32), new THREE.MeshBasicMaterial({ color: 0xffffff })); hub.position.z = 0.02; wheel.add(hub);
  const hubRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 32), new THREE.MeshBasicMaterial({ color: 0x1a1033 })); hubRing.position.z = 0.03; wheel.add(hubRing);
  // nuvens fofas no céu (bolas brancas com contorno)
  const clouds = [], cloudMat = toon(0xfdf6ff);
  [[-9, 7.2, -18, 1.2], [6, 7.8, -19, 1.4], [14, 6.6, -14, 1.0], [-15, 6.4, -12, 1.1], [0, 8.6, -21, 1.3]].forEach(([x, y, z, k]) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(k); root.add(g);
    [[0, 0, 1.2], [1.2, -0.2, 0.9], [-1.2, -0.25, 0.85], [0.5, 0.55, 0.8], [-0.6, 0.45, 0.7]].forEach(([px, py, r]) => { const b = outlined(new THREE.SphereGeometry(r, 16, 12), cloudMat, 1.07); b.position.set(px, py, 0); g.add(b); });
    clouds.push({ g, x, v: 0.15 + Math.random() * 0.15 });
  });
  // latas de tinta gigantes (cartoon, com contorno), com tinta a escorrer; duas tombadas a derramar
  const can = (x, z, c, s = 1, tipped = false) => {
    const g = new THREE.Group(); g.position.set(x, -0.3, z); g.scale.setScalar(s); root.add(g);
    const parts = new THREE.Group();
    const body = outlined(new THREE.CylinderGeometry(0.9, 0.9, 1.8, 24), toon(0xd9dee6)); body.position.y = 0.9;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.93, 0.93, 0.75, 24), toon(c)); band.position.y = 0.95;
    const label = new THREE.Mesh(new THREE.CircleGeometry(0.28, 5), toon(0xffffff)); label.position.set(0, 0.95, 0.94);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.08, 24), toon(c)); top.position.y = 1.82;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 6, 24, Math.PI), toon(0x9aa3ad)); handle.position.y = 1.85; handle.rotation.y = 0.4;
    parts.add(body, band, label, top, handle);
    for (let k = 0; k < 4; k++) {
      const a = k * 1.6 + x, d = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.25 + k * 0.18, 4, 8), toon(c));
      d.position.set(Math.cos(a) * 0.9, 1.6 - k * 0.12, Math.sin(a) * 0.9); parts.add(d);
    }
    if (tipped) {
      parts.rotation.z = Math.PI / 2; parts.position.set(0.9, 0.9, 0); g.add(parts);
      const pool = new THREE.Mesh(blobGeometry(1.7, 11), toon(c)); pool.rotation.x = -Math.PI / 2; pool.position.set(2.7, 0.02, 0); g.add(pool);
    } else g.add(parts);
  };
  can(-7.5, -7, T[0], 1.1); can(7.8, -7.5, T[2], 1.2); can(-9.5, -2.5, T[1], 0.8, true); can(9.5, -3, T[3], 0.85, true); can(-4.6, -12, T[4], 1.3); can(5, -12.5, T[5], 1.15);
  // pincéis gigantes cruzados (com contorno)
  const brush = (x, rot, c) => {
    const g = new THREE.Group(); g.position.set(x, 3.4, -13.5); g.rotation.z = rot; root.add(g);
    const handle = outlined(new THREE.CylinderGeometry(0.18, 0.24, 5, 12), toon(0xb07a45)); handle.position.y = -1;
    const ferrule = outlined(new THREE.CylinderGeometry(0.42, 0.3, 0.7, 16), toon(0xc0c6cf)); ferrule.position.y = 1.8;
    const tip = outlined(new THREE.ConeGeometry(0.45, 1.3, 16), toon(c)); tip.position.y = 2.8;
    g.add(handle, ferrule, tip);
  };
  brush(-3.2, 0.5, T[4]); brush(3.2, -0.5, T[1]);
  // dois cavaletes com telas pintadas (desenhos simples, com contorno)
  const easel = (x, z, ry, art) => {
    const g = new THREE.Group(); g.position.set(x, -0.3, z); g.rotation.y = ry; root.add(g);
    const wood = toon(0xb07a45);
    for (const [lx, rz] of [[-0.7, 0.12], [0.7, -0.12]]) { const leg = outlined(new THREE.BoxGeometry(0.14, 3.6, 0.14), wood); leg.position.set(lx, 1.7, 0); leg.rotation.z = rz; g.add(leg); }
    const back = outlined(new THREE.BoxGeometry(0.14, 3.2, 0.14), wood); back.position.set(0, 1.5, -0.7); back.rotation.x = -0.35; g.add(back);
    const shelf = outlined(new THREE.BoxGeometry(1.8, 0.12, 0.3), wood); shelf.position.set(0, 1.2, 0.12); g.add(shelf);
    const canvas = outlined(new THREE.BoxGeometry(1.9, 1.5, 0.08), toon(0xffffff, { map: art }), 1.03); canvas.position.set(0, 2.05, 0.1); g.add(canvas);
  };
  easel(-6, -9.5, 0.45, artTexture(0)); easel(6.4, -9.8, -0.45, artTexture(1));
  // estrelinhas a brilhar no céu (uma só malha)
  const NST = 26, stars = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0xffffff }), NST), S = [];
  for (let i = 0; i < NST; i++) { S.push({ x: (Math.random() - 0.5) * 34, y: 5.6 + Math.random() * 5, z: -15 - Math.random() * 8, ph: Math.random() * 6 }); stars.setColorAt(i, col.setHex(i % 3 ? 0xfff7c2 : T[i % 6])); }
  root.add(stars);
  // gotas de tinta a flutuar e a subir (sempre atrás e aos lados do palco)
  const N = 50, drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 10, 8), toon(0xffffff), N), D = [];
  for (let i = 0; i < N; i++) {
    const side = i % 2 ? 1 : -1;
    D.push({ x: side * (2.5 + Math.random() * 8), z: -2.5 - Math.random() * 10, y: Math.random() * 9, v: 0.25 + Math.random() * 0.5, s: 0.6 + Math.random() * 1.6, ph: Math.random() * 6 });
    drops.setColorAt(i, col.setHex(T[i % 6]));
  }
  root.add(drops);
  let hue = 0;
  return {
    mats: { floor: floor.material, wall: wall.material, cloud: cloudMat }, stars,       // (os temas do lobby mudam estas cores)
    fixedColors: null,                                                                  // [cor1, cor2] = luzes coloridas paradas; null = vão mudando de cor
    update(dt, t) {
      wheel.rotation.z -= dt * 0.15;
      for (const c of clouds) { c.g.position.x += c.v * dt; if (c.g.position.x > 22) c.g.position.x = -22; }
      for (let i = 0; i < N; i++) {
        const d = D[i];
        d.y += d.v * dt; if (d.y > 10) d.y = -0.3;
        const sx = d.s * (1 + 0.15 * Math.sin(t * 3 + d.ph));
        m4.makeScale(sx, d.s * 1.25, sx).setPosition(d.x + Math.sin(t * 0.8 + d.ph) * 0.3, d.y, d.z);
        drops.setMatrixAt(i, m4);
      }
      drops.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < NST; i++) { const st = S[i], k = 0.4 + 0.8 * Math.abs(Math.sin(t * 2 + st.ph)); m4.makeRotationY(t + st.ph).scale(_sv.set(k, k * 1.6, k)).setPosition(st.x, st.y, st.z); stars.setMatrixAt(i, m4); }
      stars.instanceMatrix.needsUpdate = true;
      hue = (hue + dt * 0.05) % 1;
      if (this.fixedColors) { lights[0].color.setHex(this.fixedColors[0]); lights[1].color.setHex(this.fixedColors[1]); }
      else { lights[0].color.setHSL(hue, 0.9, 0.6); lights[1].color.setHSL((hue + 0.5) % 1, 0.9, 0.6); }
    },
  };
}

export function createLobby({ renderer, template, onEquip, onPanel, getTemplate }) {   // getTemplate(id): modelo de uma skin (para a experimentar na loja)
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x2a1a5c, 24, 48);                                        // (céu e nevoeiro: ver applyTheme)
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x4a3a7a, 1.3); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3, 8, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512); Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
  scene.add(sun);
  const spot = new THREE.PointLight(0xff5fa8, 30, 12); spot.position.set(-3, 3, 2); scene.add(spot);
  const spot2 = new THREE.PointLight(0x14c9c0, 30, 12); spot2.position.set(3, 3, 2); scene.add(spot2);
  // palco: disco com manchas de tinta e um anel
  const stage = new THREE.Group(); scene.add(stage);
  const disc = outlined(new THREE.CylinderGeometry(1.5, 1.65, 0.3, 48), toon(0xfff8ec), 1.04);
  disc.position.y = -0.15; disc.userData.main.receiveShadow = true; stage.add(disc);
  const splats = [0xff3b4a, 0xffd21f, 0x2f7bff, 0x47e06a, 0xa447ff, 0xff8a1f];
  splats.forEach((c, i) => {
    const a = (i / splats.length) * Math.PI * 2 + 0.3, s = new THREE.Mesh(new THREE.CircleGeometry(0.35 + (i % 3) * 0.12, 16), new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 }));
    s.rotation.x = -Math.PI / 2; s.position.set(Math.cos(a) * 1.05, 0.006, Math.sin(a) * 1.05); s.scale.setScalar(0.7); s.receiveShadow = true; stage.add(s);
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.58, 0.05, 8, 64), new THREE.MeshStandardMaterial({ color: 0xffd21f, emissive: 0x7a5a00 }));
  ring.rotation.x = Math.PI / 2; stage.add(ring);

  const backdrop = buildBackdrop(scene, [spot, spot2]);                              // estúdio de tinta à volta do palco
  // tema do lobby (Configurações): muda o céu, o nevoeiro, a luz e as cores do estúdio; fica guardado
  const bgCache = {}, texCache = {};
  function applyTheme(id) {
    const th = LOBBY_THEMES[id] || LOBBY_THEMES.estudio;
    theme = LOBBY_THEMES[id] ? id : "estudio";
    scene.background = bgCache[theme] ||= gradientTexture(th.bg);
    scene.fog.color.setHex(th.fog);
    hemi.color.setHex(th.hemi[0]); hemi.groundColor.setHex(th.hemi[1]); hemi.intensity = th.hemi[2];
    sun.intensity = th.sun;
    backdrop.mats.floor.color.setHex(th.tint); backdrop.mats.wall.color.setHex(th.tint); backdrop.mats.cloud.color.setHex(th.cloud);
    const tx = texCache[theme] ||= { floor: floorTexture(th.tiles), wall: wallTexture(th.wall) };   // chão e parede de cada tema (desenhados uma vez)
    backdrop.mats.floor.map = tx.floor; backdrop.mats.wall.map = tx.wall;
    backdrop.stars.visible = th.stars;
    spot.intensity = spot2.intensity = th.lights; backdrop.fixedColors = th.colors || null;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignora */ }
  }
  let theme = "estudio";
  applyTheme((() => { try { return localStorage.getItem(THEME_KEY); } catch { return null; } })());

  let model = null, spin = 0, drag = null, shift = 0, last = 0;
  const celeb = {};                                                                 // celebração do boneco do lobby
  const trail = createTrails(scene);                                                // rasto equipado (ou o que estás a experimentar) à volta dos pés
  let tryTrail = null;
  let baseTpl = null, shownTpl = null;                                              // a skin equipada e a que está no palco (pode ser uma a experimentar)
  function setModel(tpl, trial = false) {
    if (!trial) baseTpl = tpl;
    shownTpl = tpl;
    if (model) stage.remove(model);
    model = tpl ? cloneCharacter(tpl) : null;
    if (!model) return;
    setCharacterPaint(model, PAINT);
    applyCosmetics(model, Progress.wallet.equip);
    stage.add(model);
  }
  setModel(template);

  // arrastar com o rato roda o boneco
  const canvas = renderer.domElement;
  const down = (e) => { if (lobbyOpen()) drag = e.clientX; };
  const move = (e) => { if (drag !== null) { spin += (e.clientX - drag) * 0.01; drag = e.clientX; } };
  const up = () => { drag = null; };
  window.addEventListener("pointerdown", (e) => { if (e.target.id === "lobbyStage") down(e); });
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  const lobbyOpen = () => document.getElementById("lobby").style.display === "flex";

  // ---------- painel: Loja / Inventário ----------
  const $ = (id) => document.getElementById(id);
  let tab = "shop", cat = "boneco";
  function renderTop() {
    const w = Progress.wallet, lv = Progress.levelInfo();
    $("lbLevel").innerHTML = `<span class="lvStar"><b>${lv.level}</b></span><div class="lvInfo"><div class="lvTop"><span>Nível ${lv.level}</span><span>${lv.into} / ${lv.need} XP</span></div><i><b style="width:${Math.max(4, Math.round((lv.into / lv.need) * 100))}%"></b></i></div>`;
    $("lbCoins").textContent = w.coins; $("lbGems").textContent = w.gems;
    const ws = Stats.winStreak(); $("lbStreak").style.display = ws > 0 ? "" : "none"; $("lbStreakN").textContent = ws;   // a quantas vitórias seguidas vais
    const left = Missions.list().filter((m) => !m.done).length; $("misBadge").textContent = left || "";   // missões do dia por fazer
  }
  // Perfil: nível, moedas, estatísticas de sempre, personagem e cor preferidas, melhor jogo e o que tens equipado
  function profileHTML() {
    const w = Progress.wallet, lv = Progress.levelInfo(), p = Stats.profile();
    const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) + "%" : "–"), per = (a, b) => (b > 0 ? (a / b).toFixed(1).replace(".", ",") : "–");
    const ch = p.favChar && CHARACTERS.find((c) => c.id === p.favChar[0]), url = ch && portraitUrl(ch.id, TEAM.A.color);
    const card = (v, label) => `<div class="pfCard"><b>${v}</b><span>${label}</span></div>`;
    const eq = ["boneco", "arma", "autocolante", "emote", "rasto"].map((k) => itemById(w.equip[k])).filter(Boolean);
    return `<div class="pfHead"><span class="lvStar big"><b>${lv.level}</b></span><div><b class="pfLv">Nível ${lv.level}</b> <span class="pfTitle">🏷️ ${Ach.titleName()}</span><small>${lv.total} XP no total · faltam ${lv.need - lv.into} XP para o nível ${lv.level + 1}</small>
        <div class="pfMoney"><span>🪙 ${w.coins}</span><span>💎 ${w.gems}</span><span>🎒 ${w.owned.length} itens</span></div></div></div>
      <div class="pfName"><label for="pfNameIn">✏️ O teu nome</label><input id="pfNameIn" maxlength="${NAME_MAX}" spellcheck="false" autocomplete="off" value="${playerName().replace(/[&"<>]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[c])}"><button data-savename>Guardar</button><small>Aparece no pódio e para os amigos</small></div>
      <div class="pfFavs">
        <div class="pfFav">${url ? `<img src="${url}" alt="">` : "<i>❔</i>"}<div><small>Personagem preferida</small><b>${ch ? ch.name : "Ainda nenhuma"}</b>${p.favChar ? `<small>${p.favChar[1]} ${p.favChar[1] === 1 ? "jogo" : "jogos"}</small>` : ""}</div></div>
        <div class="pfFav">${p.favColor ? chipHTML(p.favColor[0], 54) : "<i>❔</i>"}<div><small>Cor preferida</small><b>${p.favColor ? COLORS[p.favColor[0]].name : "Ainda nenhuma"}</b>${p.favColor ? `<small>${p.favColor[1]} tiros</small>` : ""}</div></div>
      </div>
      <div class="pfGrid">${card(p.games, "Jogos")}${card(pct(p.wins, p.games), "Vitórias")}${card(p.roundsWon, "Rounds ganhos")}${card(p.kills, "Eliminações")}
        ${card(per(p.kills, p.deaths), "Elim. / mortes")}${card(pct(p.killsSame, p.kills), "Com a cor certa")}${card(per(p.gameKills, p.games), "Elim. por jogo")}${card(p.bestKills, "Recorde de eliminações")}
        ${card("🔥 " + p.winStreak, "Vitórias seguidas agora")}${card(p.bestWinStreak, "Recorde de vitórias seguidas")}</div>
      ${historyHTML()}
      <div class="pfEq"><small>Equipado:</small>${eq.map((it) => `<span title="${it.name}">${it.icon} ${it.name}</span>`).join("")}</div>
      ${titlesHTML()}
      <button class="pfAchLink" data-tab="ach">🏅 Conquistas: ${Ach.list().filter((a) => a.done).length} / ${Ach.list().length} feitas · ver todas</button>`;
  }
  // Últimas partidas (Stats.history): resultado, rounds, modo, mapas, eliminações/mortes e quando foi
  function historyHTML() {
    const h = Stats.history();
    const when = (t) => { const d = new Date(t), p = (n) => String(n).padStart(2, "0"); return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`; };
    const RES = { win: ["🏆", "Vitória"], loss: ["💔", "Derrota"], draw: ["🤝", "Empate"] };
    const rows = h.map((g) => {
      const [ic, txt] = RES[g.res] || RES.loss, mode = MODES[g.mode] || MODES.normal;
      const maps = g.maps.map((id) => MAPS.find((m) => m.id === id)).filter(Boolean).map((m) => `<span title="${m.name}">${m.icon}</span>`).join("");
      return `<div class="hiRow ${g.res}"><b class="hiRes">${ic} ${txt}</b><span class="hiScore">${g.score[0]} – ${g.score[1]}</span>
        <span class="hiMode" title="${mode.name}">${mode.icon} ${mode.name}${g.online ? " · 👥" : ""}</span><span class="hiMaps">${maps}</span>
        <span class="hiKd" title="Eliminações / mortes">💥 ${g.kills} · 💀 ${g.deaths}</span><small>${when(g.t)} · ${BOT_PRESETS[g.diff]?.name || ""}</small></div>`;
    }).join("");
    return `<h4 class="pfAchT">📜 Últimas partidas <small>${h.length ? `as ${h.length} mais recentes` : ""}</small></h4>` +
      (rows ? `<div class="hiList">${rows}</div>` : `<p class="hiNone">Ainda não acabaste nenhuma partida. Joga uma e ela aparece aqui!</p>`);
  }
  // Títulos: os que já ganhaste podem ser escolhidos (aparecem por baixo do teu nome, também para os amigos); os outros mostram a conquista que os dá
  function titlesHTML() {
    const all = Ach.titles(), cur = Ach.titleName(), n = all.filter((t) => t.have).length;
    return `<h4 class="pfAchT">🏷️ Título <small>${n} / ${all.length} · ganham-se com conquistas</small></h4><div class="pfTitles">${all.map((t) =>
      `<button data-title="${t.id}" class="${t.name === cur ? "on" : ""}" ${t.have ? "" : "disabled"} title="${t.have ? "Usar este título" : "🔒 Conquista: " + t.from}">${t.have ? "" : "🔒 "}${t.name}</button>`).join("")}</div>`;
  }
  // Missões do dia: 3 por dia, mudam à meia-noite
  function missionsHTML() {
    const list = Missions.list();
    return list.map((m) => `<div class="misCard${m.done ? " done" : ""}"><span class="achIc">${m.done ? "✅" : m.icon}</span><div style="flex:1"><b>${m.desc}</b>
        ${m.done ? `<em>✔ Feita · ${Missions.prize(m)}</em>` : `<i><u style="width:${Math.round((m.have / m.n) * 100)}%"></u></i><em>${m.have} / ${m.n} · ${Missions.prize(m)}</em>`}</div></div>`).join("") +
      `<p class="misNote">📅 Missões novas daqui a ${Missions.untilNew()} · as moedas das missões não contam para o máximo do dia</p>`;
  }
  // Página das conquistas (abre ao clicar no nível): o teu nível e o XP total da conta em cima, as conquistas por baixo
  function achPageHTML() {
    const lv = Progress.levelInfo();
    return `<div class="pfHead"><span class="lvStar big"><b>${lv.level}</b></span><div><b class="pfLv">Nível ${lv.level}</b>
        <small><b class="achXp">⭐ ${lv.total.toLocaleString("pt-PT")} XP</b> no total da conta</small>
        <div class="lvBar"><i><b style="width:${Math.max(3, Math.round((lv.into / lv.need) * 100))}%"></b></i><small>${lv.into} / ${lv.need} XP · faltam ${lv.need - lv.into} para o nível ${lv.level + 1}</small></div></div></div>
      ${achievementsHTML()}`;
  }
  // Conquistas: as feitas primeiro; cada uma com a barra do progresso e as joias que dá
  function achievementsHTML() {
    const all = Ach.list(), n = all.filter((a) => a.done).length;
    const cardHTML = (a) => `<div class="achCard${a.done ? " done" : ""}"><span class="achIc">${a.done ? a.icon : "🔒"}</span><div><b>${a.name}</b><small>${a.desc}</small>
        ${a.done ? `<em>✔ Feita · ${Ach.prize(a)}</em>` : `<i><u style="width:${Math.round((a.have / a.n) * 100)}%"></u></i><em>${a.have} / ${a.n} · ${Ach.prize(a)}</em>`}</div></div>`;
    return `<h4 class="pfAchT">🏅 Conquistas <small>${n} / ${all.length} · as fáceis dão 🪙 moedas, as difíceis 💎 joias</small></h4>` +
      Ach.CATEGORIES.map((cat) => {                                                    // por grupos; dentro de cada um, as feitas primeiro
        const items = all.filter((a) => a.cat === cat.id).sort((a, b) => b.done - a.done);
        return `<h5 class="achGrp">${cat.name} <small>${items.filter((a) => a.done).length} / ${items.length}</small></h5><div class="pfAch">${items.map(cardHTML).join("")}</div>`;
      }).join("");
  }
  const rarity = (it) => (it.cur === "gems" ? "gold" : it.price >= 2000 ? "epic" : it.price === 0 ? "free" : "rare");
  const rarityRank = (it) => ({ free: 0, rare: 1, epic: 2, gold: 3 })[rarity(it)];
  function renderPanel() {
    const w = Progress.wallet, lv = Progress.levelInfo().level;
    const prof = tab === "profile" || tab === "ach" || tab === "missions";
    $("lbCats").style.display = prof ? "none" : ""; $("lbPanel").querySelector(".lbHint").style.display = prof ? "none" : "";
    $("lbItems").classList.toggle("pf", prof);
    if (prof) {
      $("lbTitle").textContent = tab === "ach" ? "🏅 Conquistas" : tab === "missions" ? "📅 Missões do dia" : "👤 Perfil";
      $("lbItems").innerHTML = tab === "ach" ? achPageHTML() : tab === "missions" ? missionsHTML() : profileHTML(); renderTop(); return;
    }
    $("lbTitle").textContent = tab === "shop" ? "🛒 Loja" : "🎒 Inventário";
    $("lbCats").innerHTML = CATEGORIES.map((c) => `<button class="chip${cat === c.id ? " on" : ""}" data-cat="${c.id}">${c.icon} ${c.name}</button>`).join("");
    const list = ITEMS.filter((it) => it.cat === cat && (tab === "inv" ? Progress.owns(it.id) : !Progress.owns(it.id)))
      .sort((a, b) => rarityRank(a) - rarityRank(b) || a.price - b.price);           // por raridade: verdes, azuis, roxos e dourados (e, dentro de cada uma, do mais barato ao mais caro)
    const mysWhy = Progress.cantMystery();                                                   // caixa-surpresa: no topo da Loja, em todas as categorias
    const box = tab === "shop" ? `<div class="mysCard"><span class="mysGift">🎁</span><div><b>Caixa-surpresa</b><small>Sai um item da loja que ainda não tens (até ao teu nível). Pode ser raro ou épico!</small></div>
      <button class="lbBtn buy" data-mystery ${mysWhy ? "disabled" : ""} title="${mysWhy}">🪙 ${Progress.MYSTERY_PRICE}</button></div>` : "";
    $("lbItems").innerHTML = box + (list.length ? list.map((it) => {
      const eq = w.equip[it.cat] === it.id, why = tab === "shop" ? Progress.cantBuy(it.id) : "", locked = tab === "shop" && lv < it.level;
      const price = `${it.cur === "gems" ? "💎" : "🪙"} ${it.price}`;
      const btn = tab === "inv" ? (eq ? `<span class="lbOn">✔ Equipado</span>` : `<button class="lbBtn" data-equip="${it.id}">Equipar</button>`)
        : `<button class="lbBtn buy" data-buy="${it.id}" ${why ? "disabled" : ""} title="${why}">${locked ? "🔒 Nível " + it.level : price}</button>`;
      const pic = it.cat === "boneco" ? fullBodyUrl(it.id.slice(7)) : ShopArt.get(it.id);   // foto do boneco / da arma / da celebração / desenho do rasto, num cartão com a cor da raridade
      const rar = rarity(it);
      const icon = pic ? `<span class="lbSkinPic ${rar}"><img src="${pic}" alt=""><i>${it.icon}</i></span>` : `<span class="lbIcon">${it.icon}</span>`;
      return `<div class="lbItem${eq ? " eq" : ""}${locked ? " locked" : ""}${pic ? " skin" : ""}" data-try="${it.id}">${icon}<b>${it.name}</b><small>${it.desc}</small>${btn}</div>`;
    }).join("") : `<p class="lbEmpty">${tab === "shop" ? "Já compraste tudo desta categoria! 🎉" : "Ainda não tens nada desta categoria: vai à Loja."}</p>`);
    renderTop();
  }
  // passar o rato por cima de um item da loja: experimenta-o no boneco
  let trying = null;
  function preview(id) {
    if (!model) return;
    const it = id && itemById(id);
    if (it && it.cat === "boneco" && getTemplate) {                                // experimentar uma skin: o boneco do palco passa a ser essa
      getTemplate(it.id.slice(7)).then((tpl) => { if (trying === id && tpl) { setModel(tpl, true); applyCosmetics(model, Progress.wallet.equip); setCharacterPaint(model, PAINT); } });
      return;
    }
    if (shownTpl !== baseTpl && baseTpl) setModel(baseTpl);                         // deixou de experimentar a skin: volta a equipada
    tryTrail = it && it.cat === "rasto" ? it.id : null;                                // experimentar um rasto
    applyCosmetics(model, it ? { ...Progress.wallet.equip, [it.cat]: it.id } : Progress.wallet.equip);
    setCharacterPaint(model, PAINT);
  }
  $("lbPanel").addEventListener("click", (e) => {
    if (e.target.closest("[data-savename]")) { saveName(); return; }
    const mb = e.target.closest("[data-mystery]");
    if (mb && !mb.disabled) { openMysteryBox(); return; }
    const tt = e.target.closest("[data-title]");
    if (tt && !tt.disabled) { Ach.setTitle(tt.dataset.title); renderPanel(); flash(`🏷️ Título: ${Ach.titleName()}`); return; }
    const card = itemById(e.target.closest("[data-try]")?.dataset.try);
    if (card?.cat === "emote") { Emotes.stop(celeb); Emotes.play(celeb, card.id, performance.now()); }   // clicar numa celebração: o boneco fá-la (só assim; parado no resto do tempo)
    const t = e.target.closest("[data-tab],[data-cat],[data-buy],[data-equip]");
    if (!t) return;
    if (t.dataset.tab) tab = t.dataset.tab;
    else if (t.dataset.cat) cat = t.dataset.cat;
    else if (t.dataset.buy) { if (Progress.buy(t.dataset.buy)) { Progress.equip(t.dataset.buy); onEquip?.(); flash(`Compraste: ${itemById(t.dataset.buy).name}!`); } }
    else if (t.dataset.equip) { Progress.equip(t.dataset.equip); onEquip?.(); }
    trying = null; preview(null); renderPanel();
  });
  $("lbPanel").addEventListener("mouseover", (e) => { const t = e.target.closest("[data-try]"); const id = t?.dataset.try || null; if (id !== trying) { trying = id; preview(id); } });
  $("lbPanel").addEventListener("mouseleave", () => { trying = null; preview(null); });
  // Caixa-surpresa: a caixa abana, abre e mostra o item (com a foto e a raridade); podes equipá-lo logo
  const RAR_NAME = { rare: "Raro", epic: "Épico", gold: "Dourado", free: "Comum" };
  function openMysteryBox() {
    const it = Progress.openMystery();
    if (!it) return;
    renderPanel();
    const el = $("mysteryBox"), pic = it.cat === "boneco" ? fullBodyUrl(it.id.slice(7)) : ShopArt.get(it.id), rar = rarity(it);
    el.innerHTML = `<div class="mysStage"><div class="mysBoxBig">🎁</div>
      <div class="mysPrize ${rar}">${pic ? `<img src="${pic}" alt="">` : `<span class="mysIcon">${it.icon}</span>`}<em>${RAR_NAME[rar] || ""}</em><b>${it.icon} ${it.name}</b><small>${it.desc}</small>
        <div class="mysBtns"><button class="lbBtn" data-mysequip="${it.id}">Equipar</button><button class="lbBtn ghostBtn" data-mysclose>Fechar</button></div></div></div>`;
    el.style.display = "flex"; el.classList.remove("open"); void el.offsetWidth; el.classList.add("open");
    Sfx.play("chest"); setTimeout(() => Sfx.play("golden"), 1250);
  }
  $("mysteryBox").addEventListener("click", (e) => {
    const eqb = e.target.closest("[data-mysequip]");
    if (eqb) { Progress.equip(eqb.dataset.mysequip); onEquip?.(); renderPanel(); flash("✔ Equipado!"); }
    if (eqb || e.target.closest("[data-mysclose]") || e.target.id === "mysteryBox") $("mysteryBox").style.display = "none";
  });
  function saveName() {                                                              // Perfil: guardar o teu nome
    const inp = $("pfNameIn"); if (!inp) return;
    const n = setPlayerName(inp.value); inp.value = n; inp.blur(); flash(`✏️ O teu nome agora é ${n}`);
  }
  $("lbPanel").addEventListener("keydown", (e) => { if (e.target.id === "pfNameIn") { e.stopPropagation(); if (e.key === "Enter") saveName(); } });
  function flash(text) { const f = $("lbFlash"); f.textContent = text; f.classList.remove("show"); void f.offsetWidth; f.classList.add("show"); }
  function openPanel(t) {
    tab = t; $("lbPanel").classList.add("open"); $("lobby").classList.add("panel"); renderPanel(); onPanel?.(t);
    ShopArt.build().then(() => { if ($("lbPanel").classList.contains("open") && tab !== "profile") renderPanel(); });   // 1.ª vez: tira as fotografias da loja e redesenha
  }
  function closePanel() { $("lbPanel").classList.remove("open"); $("lobby").classList.remove("panel"); trying = null; preview(null); onPanel?.(null); }
  $("lbClose").addEventListener("click", closePanel);
  $("lbLevel").addEventListener("click", () => openPanel("ach"));                      // clicar no nível: conquistas e XP total

  return {
    setModel, openPanel, closePanel, renderTop, flash,
    setTheme: applyTheme, get theme() { return theme; },
    get paint() { return PAINT; },
    emote(id) { Emotes.stop(celeb); Emotes.play(celeb, id, performance.now()); },   // faz já uma celebração (testes)
    face(a = 0) { spin = a; },
    get model() { return model; },                                                      // o boneco do palco (testes)                                                            // vira o boneco para a câmara (testes)                                                 // cor atual do boneco do lobby (testes)
    get panelOpen() { return $("lbPanel").classList.contains("open"); },
    // desenha o lobby (30 fps); shift: o boneco vai para a esquerda quando o painel está aberto
    render(now) {
      if (now - last < 33) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const w = window.innerWidth, h = window.innerHeight;
      if (camera.aspect !== w / h) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
      shift += ((this.panelOpen ? 1 : 0) - shift) * Math.min(1, dt * 6);
      if (drag === null && Math.abs(spin) > 0.001) spin -= spin * Math.min(1, dt * 2.5);   // parado de frente para ti; se o rodares com o rato, volta devagar à frente
      colorT += dt;                                                                 // troca de cor
      if (colorT >= EVERY) { colorT = 0; colorIdx = (colorIdx + 1) % SHOW.length; }
      const k = Math.min(1, colorT / FADE), hex = k < 1 ? _a.setHex(SHOW[(colorIdx + SHOW.length - 1) % SHOW.length]).lerp(_b.setHex(SHOW[colorIdx]), k).getHex() : SHOW[colorIdx];
      if (model && hex !== PAINT) { PAINT = hex; setCharacterPaint(model, hex); }
      stage.rotation.y = spin;
      backdrop.update(dt, now / 1000);
      stage.position.x = -1.3 * shift;
      if (model) { model.position.set(0, 0, 0); model.rotation.y = 0; animateCharacter(model, { speed: 0, maxSpeed: MOTION.run, onGround: true, vy: 0, landed: false, impact: 0, climbing: false, crouching: false }, dt, now / 1000); }   // (repõe antes de animar: a animação ajusta a altura a partir da posição)
      if (model) Emotes.apply(model, celeb, now);
      trail.preview(dt, tryTrail || Progress.wallet.equip.rasto, { x: stage.position.x, y: 0, z: 0 });
      camera.position.set(0, 1.55, 5.0); camera.lookAt(0, 1.0, 0);
      renderer.render(scene, camera);
    },
  };
}
