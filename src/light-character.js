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

// Os 5 bonecos leves: cores de pele, cabelo, calções e sapatos, e o penteado
export const LIGHT_LOOKS = {
  pinta:   { skin: 0xffd9b8, hair: 0x6b3a1e, shorts: 0x2b2f4a, shoe: 0xffffff, sole: 0xff3b4a, style: "tufo" },
  salpico: { skin: 0xf2c49b, hair: 0xffc61a, shorts: 0x3a2a55, shoe: 0x2f7bff, sole: 0xffffff, style: "rabo" },
  borrao:  { skin: 0x8d5a3b, hair: 0x1d1424, shorts: 0x1f3d2e, shoe: 0xff8a1f, sole: 0xffffff, style: "carrapitos" },
  pincel:  { skin: 0xffe3cf, hair: 0xff5a3a, shorts: 0x2a2a2a, shoe: 0x47e06a, sole: 0x1a1033, style: "espetado" },
  gota:    { skin: 0xc98f62, hair: 0x7a4dff, shorts: 0x203050, shoe: 0xffd21f, sole: 0x1a1033, style: "franja" },
};

const EYE_WHITE = 0xffffff, PUPIL = 0x1a1033, CHEEK = 0xff8fa8, MOUTH = 0x7a2236;
const SEG = 14;                                                     // segmentos das esferas: redondas o suficiente, sem triângulos a mais

// Junta peças numa malha só, com a cor de cada uma nos vértices
class Baker {
  constructor() { this.parts = []; }
  add(geo, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
    const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
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

const noColor = (m) => { m.geometry.deleteAttribute("color"); return m; };   // (a roupa e a pistola têm uma cor só, a do material)
const sph = (r, ws = SEG, hs = SEG - 4) => new THREE.SphereGeometry(r, ws, hs);
const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
// tronco/calções arredondados (perfil a rodar à volta do eixo y)
const lathe = (pts, s = SEG) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), s);

export function buildLightCharacter(id) {
  const L = LIGHT_LOOKS[id] || LIGHT_LOOKS.pinta;
  const paintMat = new THREE.MeshStandardMaterial({ name: "Paint", color: 0xff3b4a, roughness: 0.5 });
  const baked = new THREE.MeshStandardMaterial({ name: "Baked", vertexColors: true, roughness: 0.55 });
  const gunMat = new THREE.MeshStandardMaterial({ name: "AmmoTank", color: 0xff3b4a, roughness: 0.35 });
  const scene = new THREE.Group();
  const part = (name, x, y, z, parent = scene) => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); return g; };
  const put = (g, ...meshes) => { for (const m of meshes) if (m) g.add(m); };

  // ---------- TRONCO E CABEÇA (origem no chão: cabeça centrada em y = 2.0, cara virada para +z) ----------
  const body = part("Body", 0, 0, 0);
  const shirt = new Baker()
    .add(lathe([[0, 0.8], [0.36, 0.82], [0.41, 0.98], [0.4, 1.3], [0.34, 1.52], [0.16, 1.62], [0, 1.63]]), 0xffffff);
  const b = new Baker();
  b.add(lathe([[0, 0.6], [0.37, 0.6], [0.42, 0.72], [0.4, 0.9], [0, 0.9]]), L.shorts)        // calções
   .add(cyl(0.14, 0.16, 0.2), L.skin, 0, 1.64, 0)                                            // pescoço
   .add(sph(0.56, 20, 16), L.skin, 0, 2.0, 0, 1, 0.94, 0.96)                                  // cabeça
   .add(sph(0.11, 10, 8), L.skin, -0.55, 1.98, 0, 0.5, 1, 0.8).add(sph(0.11, 10, 8), L.skin, 0.55, 1.98, 0, 0.5, 1, 0.8);   // orelhas
  for (const s of [-1, 1]) {
    b.add(sph(0.155, 12, 10), EYE_WHITE, s * 0.2, 2.0, 0.44, 0.85, 1.15, 0.55)                // olhos grandes
     .add(sph(0.095, 10, 8), PUPIL, s * 0.2, 1.98, 0.51, 0.85, 1.12, 0.5)                    // pupilas
     .add(sph(0.035, 6, 5), EYE_WHITE, s * 0.2 + 0.035, 2.03, 0.555)                          // brilho
     .add(sph(0.08, 10, 6), CHEEK, s * 0.34, 1.84, 0.42, 1.2, 0.6, 0.5)                       // bochechas
     .add(sph(0.045, 8, 6), L.hair, s * 0.2, 2.24, 0.47, 2.4, 0.6, 0.7, 0, 0, -s * 0.18);    // sobrancelhas
  }
  b.add(new THREE.TorusGeometry(0.075, 0.022, 6, 12, Math.PI), MOUTH, 0, 1.81, 0.515, 1, 1, 1, Math.PI, 0, 0);   // sorriso
  // cabelo: calote por cima da cabeça + o penteado de cada um
  b.add(new THREE.SphereGeometry(0.6, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), L.hair, 0, 2.06, -0.03, 1, 0.98, 1, -0.32, 0, 0);
  for (const s of [-1, 0, 1]) b.add(sph(0.16, 10, 8), L.hair, s * 0.21, 2.42, 0.38 - Math.abs(s) * 0.05, 1.2, 0.62, 0.75);   // franja
  b.add(new THREE.TorusGeometry(0.2, 0.05, 6, 16), 0xffffff, 0, 1.6, 0.02, 1, 1, 1, Math.PI / 2, 0, 0);       // gola branca
  const hair = {
    tufo: () => b.add(new THREE.ConeGeometry(0.13, 0.4, 10), L.hair, 0.05, 2.66, 0.05, 1, 1, 1, -0.5, 0, 0.3),
    rabo: () => { b.add(sph(0.2, 12, 10), L.hair, 0, 2.2, -0.62).add(sph(0.16, 10, 8), L.hair, 0, 1.92, -0.72).add(sph(0.11, 10, 8), L.hair, 0, 1.66, -0.74); },
    carrapitos: () => { for (const s of [-1, 1]) b.add(sph(0.2, 12, 10), L.hair, s * 0.42, 2.42, -0.08); },
    espetado: () => { for (const [x, z, r] of [[-0.28, 0.05, 0.5], [0, 0.12, 0], [0.28, 0.05, -0.5], [-0.15, -0.3, 0.3], [0.15, -0.3, -0.3]]) b.add(new THREE.ConeGeometry(0.15, 0.42, 8), L.hair, x, 2.62, z, 1, 1, 1, -0.25, 0, r); },
    franja: () => { b.add(sph(0.6, 16, 10), L.hair, 0, 1.9, -0.12, 1.05, 0.95, 0.9); },   // cabelo pelos ombros (atrás da cabeça)
  };
  hair[L.style]?.();
  put(body, noColor(shirt.mesh(paintMat, "Shirt")), b.mesh(baked, "BodyBaked"));

  // ---------- BRAÇOS (origem no ombro; a mão fica ~0,75 abaixo) ----------
  for (const s of [-1, 1]) {
    const arm = part(s < 0 ? "ArmL" : "ArmR", s * 0.39, 1.58, 0);
    const sleeve = new Baker().add(sph(0.155, 12, 10), 0xffffff, 0, -0.08, 0, 1, 1.15, 1);
    const a = new Baker().add(cyl(0.085, 0.08, 0.5), L.skin, 0, -0.42, 0).add(sph(0.12, 12, 10), L.skin, 0, -0.72, 0.02)   // braço e mão redonda
      .add(new THREE.TorusGeometry(0.135, 0.035, 6, 14), 0xffffff, 0, -0.2, 0, 1, 1, 1, Math.PI / 2, 0, 0);           // punho branco da manga
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
    const leg = part(s < 0 ? "LegL" : "LegR", s * 0.13, 0.78, 0);
    put(leg, new Baker().add(cyl(0.11, 0.1, 0.4), L.skin, 0, -0.2, 0).mesh(baked, "ThighBaked"));
    const shin = part(s < 0 ? "ShinL" : "ShinR", 0, -0.36, 0, leg);
    put(shin, new Baker()
      .add(cyl(0.1, 0.095, 0.26), L.skin, 0, -0.12, 0)
      .add(cyl(0.105, 0.105, 0.08), 0xffffff, 0, -0.26, 0)                                    // meia
      .add(sph(0.17, 12, 10), L.shoe, 0, -0.33, 0.07, 1, 0.62, 1.45)                          // sapato
      .add(cyl(0.16, 0.16, 0.06, 12), L.sole, 0, -0.41, 0.07, 1, 1, 1.4)                      // sola
      .mesh(baked, "ShinBaked"));
  }
  return scene;
}

// ---------- cor do boneco leve: tinge os vértices (a mesma regra que os bonecos com materiais) ----------
// Cada vértice guarda a cor original; o branco (olhos) fica igual, o escuro vai para meia cor, o resto mistura com a cor do jogador.
const _base = new THREE.Color(), _tint = new THREE.Color(), _half = new THREE.Color(), _white = new THREE.Color(1, 1, 1);
export function tintBaked(meshes, hex, k, fade = 0) {
  _tint.setHex(hex); _half.copy(_tint).multiplyScalar(0.5);
  for (const m of meshes) {
    const col = m.geometry.attributes.color, a = col.array;
    const base = m.geometry.userData.base || (m.geometry.userData.base = Float32Array.from(a));
    for (let i = 0; i < a.length; i += 3) {
      _base.setRGB(base[i], base[i + 1], base[i + 2]);
      const l = 0.2126 * _base.r + 0.7152 * _base.g + 0.0722 * _base.b;
      if (l <= 0.85 && k > 0) {
        if (l < 0.12) _base.lerp(_half, k);
        else _base.lerp(_tint, k);
      }
      if (fade > 0) _base.lerp(_white, fade);
      a[i] = _base.r; a[i + 1] = _base.g; a[i + 2] = _base.b;
    }
    col.needsUpdate = true;
  }
}
