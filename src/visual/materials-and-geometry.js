import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
/* ============================================================
   2. GEOMETRIAS E MATERIAIS (reutilizados, estilo cartoon)
   ============================================================ */
// Estilo cartoon 3D "limpo": o cenário é pastel e neutro (suavizado), só a tinta, os itens e as equipas
// têm cor viva. É esse contraste que faz a tinta saltar à vista.
const _soft = new Map();
export function soften(hex) {
  let v = _soft.get(hex);
  if (v === undefined) {
    const c = new THREE.Color(hex), hsl = {};
    c.getHSL(hsl);
    const green = hsl.h > 0.2 && hsl.h < 0.46;                       // a natureza (relva, folhas) mantém mais cor
    c.setHSL(hsl.h, hsl.s * (green ? 0.8 : 0.5), Math.min(0.93, hsl.l * 0.82 + 0.19));
    v = c.getHex();
    _soft.set(hex, v);
  }
  return v;
}

export const _mats = new Map();
export function mat(color, opts = {}) {
  const emissive = opts.emissive || 0;
  const vivid = opts.vivid || emissive !== 0;                  // brilhantes e itens ficam vivos
  const key = (vivid ? "v" : "s") + color + "|" + emissive;
  let m = _mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: vivid ? color : soften(color), roughness: 0.5, metalness: 0, emissive });
    _mats.set(key, m);
  }
  return m;
}

export const _geos = new Map();
export function cached(key, make) {
  let g = _geos.get(key);
  if (!g) { g = make(); _geos.set(key, g); }
  return g;
}
export const G = {
  // caixas com cantos arredondados (as finas, como janelas e faixas, ficam simples para poupar triângulos)
  box:    (w, h, d)      => cached(`b${w},${h},${d}`,    () => {
    const m = Math.min(w, h, d);
    return m < 0.6 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 2, Math.min(0.35, m * 0.22));
  }),
  cyl:    (rt, rb, h)    => cached(`c${rt},${rb},${h}`,  () => new THREE.CylinderGeometry(rt, rb, h, 22)),
  sphere: (r)            => cached(`s${r}`,              () => new THREE.SphereGeometry(r, 22, 16)),
  torus:  (r, t)         => cached(`t${r},${t}`,         () => new THREE.TorusGeometry(r, t, 10, 36)),
  plane:  (w, d)         => cached(`p${w},${d}`,         () => new THREE.PlaneGeometry(w, d)),
  circle: (r)            => cached(`o${r}`,              () => new THREE.CircleGeometry(r, 32)),
  pyramid:(h)            => cached(`y${h}`,              () => { const g = new THREE.ConeGeometry(Math.SQRT1_2, h, 4); g.rotateY(Math.PI / 4); return g; }),   // base quadrada 1x1
  octa:   (r)            => cached(`x${r}`,              () => new THREE.OctahedronGeometry(r)),
};

// Textura xadrez 2x2 (sem canvas) que se repete pelo chão
export function checkerTexture(c1, c2, repX, repZ) {
  const px = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255, 255];
  const data = new Uint8Array([...px(c1), ...px(c2), ...px(c2), ...px(c1)]);
  const tex = new THREE.DataTexture(data, 2, 2);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repX, repZ);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

