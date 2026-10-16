import * as THREE from "three";
import { mat, G } from "../visual/materials-and-geometry.js";
import { COLORS } from "../base/colors.js";
import { symbolMaterial } from "../visual/symbol-sprites.js";
import { CONFIG } from "../base/game-config.js";

/* ============================================================
   BONECO (personagem simples): magro, cabeça grande e arredondada, cabelo em "tentáculos",
   t-shirt e cabeça na cor atual, calções escuros e ténis brancos.
   ============================================================ */
const SKIN = 0xffe0c2, SHORTS = 0x2b2b3d, SHOE = 0xffffff;

export function createDummy() {
  const g = new THREE.Group();
  const paint = [];                                                   // partes que mudam com a cor atual
  const add = (geo, color, x, y, z, parent = g, scale) => {
    const m = new THREE.Mesh(geo, mat(color, { vivid: true }));
    m.position.set(x, y, z); m.castShadow = true;
    if (scale) m.scale.set(...scale);
    parent.add(m);
    return m;
  };

  // cabeça grande e redonda + olhos
  paint.push(add(G.sphere(0.5), 0xff3b4a, 0, 2.0, 0));
  for (const sx of [-1, 1]) {
    add(G.sphere(0.15), 0xffffff, sx * 0.19, 2.03, 0.4, g, [0.9, 1.25, 0.55]);
    add(G.sphere(0.075), 0x1a1033, sx * 0.19, 2.02, 0.465, g, [0.9, 1.2, 0.5]);
  }
  add(G.sphere(0.05), 0xff8a9a, 0, 1.86, 0.48, g, [1.6, 0.55, 0.5]);      // bochecha/boca
  for (const sx of [-1, 1]) {
    const brow = add(G.sphere(0.05), 0x1a1033, sx * 0.2, 2.28, 0.41, g, [2.4, 0.7, 0.6]);   // sobrancelhas grossas
    brow.rotation.z = sx * -0.25;
    const ear = add(G.cyl(0.01, 0.13, 0.36), 0xff3b4a, sx * 0.55, 2.1, 0, g);              // orelhas pontiagudas
    ear.rotation.z = -sx * Math.PI / 2.4;
    paint.push(ear);
  }

  // cabelo em tentáculos (dois rabos para trás, a afinar)
  for (const sx of [-1, 1]) {
    [[0.16, 2.38, -0.28, 0.23], [0.24, 2.17, -0.6, 0.19], [0.3, 1.84, -0.75, 0.15], [0.33, 1.52, -0.77, 0.115], [0.34, 1.26, -0.76, 0.08]]
      .forEach(([x, y, z, r]) => paint.push(add(G.sphere(r), 0xff3b4a, sx * x, y, z)));
    const tip = add(G.cyl(0.01, 0.08, 0.3), 0xff3b4a, sx * 0.34, 1.0, -0.76, g);            // ponta afiada
    tip.rotation.x = Math.PI; paint.push(tip);
  }

  // corpo magro: t-shirt (cor) + calções escuros
  paint.push(add(G.cyl(0.24, 0.3, 0.72), 0xff3b4a, 0, 0.98, 0, g));
  add(G.cyl(0.26, 0.25, 0.3), SHORTS, 0, 0.72, 0);

  // pernas finas e ténis
  const mkLimb = (x, y, r, len, color) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0); g.add(pivot);
    add(G.cyl(r, r * 0.92, len), color, 0, -len, 0, pivot).position.y = -len / 2;
    return pivot;
  };
  const legL = mkLimb(-0.13, 0.78, 0.085, 0.66, SKIN);
  const legR = mkLimb( 0.13, 0.78, 0.085, 0.66, SKIN);
  for (const leg of [legL, legR]) {
    add(G.sphere(0.14), 0x2b2b3d, 0, -0.64, 0.07, leg, [1, 0.8, 1.55]);                     // ténis escuro
    add(G.sphere(0.14), SHOE, 0, -0.74, 0.07, leg, [1.02, 0.35, 1.6]);                       // sola branca
  }

  // braços finos com manga na cor e mãos redondas
  const armL = mkLimb(-0.37, 1.6, 0.065, 0.6, SKIN);
  const armR = mkLimb( 0.37, 1.6, 0.065, 0.6, SKIN);
  for (const arm of [armL, armR]) {
    paint.push(add(G.cyl(0.1, 0.09, 0.22), 0xff3b4a, 0, -0.11, 0, arm));
    add(G.sphere(0.09), SKIN, 0, -0.62, 0, arm);
  }

  // arma de tinta na mão direita: o depósito mostra a cor da MUNIÇÃO escolhida (não é a cor do boneco)
  const gunMat = new THREE.MeshStandardMaterial({ color: 0xff3b4a, roughness: 0.35, emissive: 0x222222 });
  const gun = new THREE.Group(); gun.position.set(0, -0.62, 0.05); armR.add(gun);
  add(G.cyl(0.065, 0.065, 0.7), 0xf2f2f6, 0, 0, 0.3, gun).rotation.x = Math.PI / 2;              // cano
  add(G.box(0.1, 0.2, 0.16), 0xf2f2f6, 0, -0.08, -0.02, gun);                                      // punho
  const tank = new THREE.Mesh(G.sphere(0.2), gunMat); tank.position.set(0, 0.17, 0.02); tank.castShadow = true; gun.add(tank);

  // símbolo da cor acima da cabeça
  const sym = new THREE.Sprite(symbolMaterial("vermelho") || undefined);
  sym.position.set(0, 3.05, 0); sym.scale.set(1.1, 1.1, 1); sym.renderOrder = 5;
  sym.visible = CONFIG.ui.symbolAboveHead;
  g.add(sym);

  g.userData = { legL, legR, armL, armR, sym, paint, gunMat };
  return g;
}

// Pinta o boneco com a cor atual (cabeça, cabelo, t-shirt) e troca o símbolo por cima da cabeça
export function setDummyColor(dummy, colorId) {
  const m = mat(COLORS[colorId].hex, { vivid: true });
  for (const part of dummy.userData.paint) part.material = m;
  const sm = symbolMaterial(colorId);
  if (sm) dummy.userData.sym.material = sm;
}

// Cor da munição na arma (e a mistura a decorrer: o depósito passa gradualmente para a cor resultante)
const _c = new THREE.Color(), _c2 = new THREE.Color();
export function setDummyAmmo(dummy, colorId, mixResultId = null, progress = 0) {
  _c.setHex(COLORS[colorId].hex);
  if (mixResultId) _c.lerp(_c2.setHex(COLORS[mixResultId].hex), progress);
  dummy.userData.gunMat.color.copy(_c);
  dummy.userData.gunMat.emissive.copy(_c).multiplyScalar(0.25);
}

// Invisibilidade: o boneco passa a um fantasma translúcido (para os adversários desaparece por completo)
let _ghost = null;
export function setDummyGhost(dummy, on) {
  _ghost = _ghost || new THREE.MeshStandardMaterial({ color: 0xcfe0ff, emissive: 0x7088ff, emissiveIntensity: 0.4, transparent: true, opacity: 0.28, roughness: 0.4, depthWrite: false });
  dummy.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.orig === undefined) { o.userData.orig = o.material; o.userData.shadow = o.castShadow; }
    o.material = on ? _ghost : o.userData.orig;
    o.castShadow = !on && o.userData.shadow;                   // (repõe a sombra como era: os pormenores pequenos não fazem sombra)
  });
}
