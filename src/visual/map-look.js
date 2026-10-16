import * as THREE from "three";
import { ARENA } from "../base/game-config.js";

/* ============================================================
   ASPETO DOS MAPAS DO BLENDER (luz cozida + texturas de detalhe)
   - Luz ambiente cozida (src/tools/blender/bake_lighting.py): cada vértice traz _OCC (quanto está tapado) e o chão tem
     uma textura vista de cima (<mapa>_ao.jpg). Escurecem a luz ambiente (e um pouco a do sol) nos cantos e à volta das coisas.
   - Texturas de detalhe: relva, folhas, madeira, pedra, betão, tijolo, metal, palha e tecido, desenhadas aqui (canvas, uma
     vez só) e postas por projeção "triplanar" (pela posição no mundo: os modelos não precisam de UV). Só mudam um pouco o
     tom da cor de cada material, para manter o estilo de desenho animado.
   Custo: 3 leituras de textura a mais por píxel nos materiais com detalhe; nada a mais por frame no processador.
   ============================================================ */
const KINDS = {
  grass:    { scale: 2.2, strength: 0.18, names: ["Lawn", "LawnDark", "GrassDark", "Hill", "Land"] },
  leaf:     { scale: 1.6, strength: 0.18, names: ["Leaf1", "Leaf2", "Frond", "Hedge", "HedgeTop", "Pine", "PineDark", "Blossom1", "Blossom2"] },
  wood:     { scale: 1.8, strength: 0.2, names: ["Wood", "WoodDark", "Trunk", "PalmTrunk", "Crate", "CrateDark", "Desk", "Fence", "PencilWood", "Ladder", "BoothBack", "Hull", "Cabin"] },
  stone:    { scale: 3.0, strength: 0.17, names: ["Stone", "StoneDark", "StoneLight", "Cobble", "Path", "RiverBed", "Wall", "WallCap", "OvenDark"] },
  concrete: { scale: 4.0, strength: 0.09, names: ["Concrete", "Plaza", "Sidewalk", "Road", "FactFloor", "FloorCream", "SchoolWall", "PlatSide", "PlatTop", "Silo", "Court", "RampTop"] },
  brick:    { scale: 2.0, strength: 0.22, names: ["Brick", "OvenBrick"] },
  metal:    { scale: 2.0, strength: 0.1, names: ["Steel", "SteelDark", "SteelTop", "Metal", "Iron", "IronLight", "Machine", "Container1", "Container2", "Container3", "Container4", "Container5", "Vat", "VatRim", "Pipe", "Crane", "Rail", "Rail2", "TankWhite"] },
  hay:      { scale: 1.0, strength: 0.22, names: ["Hay"] },
  fabric:   { scale: 0.6, strength: 0.1, names: ["Awning1", "Parasol1", "Parasol2", "Parasol3", "Cushion", "BannerA", "BannerB", "StripeA", "StripeB", "FairA", "FairB", "Tramp"] },
};
export const KIND_OF = new Map();                                                    // nome do material → tipo de detalhe (glb-map.js também usa, para juntar peças)
for (const [k, v] of Object.entries(KINDS)) for (const n of v.names) KIND_OF.set(n, k);

// ---------- texturas de detalhe (cinzento à volta de 0.5; repetem-se sem costuras) ----------
const N = 256;
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, y, period, seed) {                    // ruído suave que se repete a cada "period" células
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const g = (i, j) => hash(((i % period) + period) % period, ((j % period) + period) % period, seed);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = g(xi, yi) + (g(xi + 1, yi) - g(xi, yi)) * sx, b = g(xi, yi + 1) + (g(xi + 1, yi + 1) - g(xi, yi + 1)) * sx;
  return a + (b - a) * sy;
}
const fbm = (u, v, base, seed, oct = 4) => { let s = 0, a = 0.5, f = base; for (let i = 0; i < oct; i++) { s += a * vnoise(u * f, v * f, f, seed + i); a *= 0.5; f *= 2; } return s / (1 - Math.pow(0.5, oct)); };
function worley(u, v, cells, seed) {                       // distância à "pedra" mais próxima (0 = centro) e à segunda (bordas)
  let d1 = 9, d2 = 9;
  const x = u * cells, y = v * cells, xi = Math.floor(x), yi = Math.floor(y);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, wx = ((cx % cells) + cells) % cells, wy = ((cy % cells) + cells) % cells;
    const px = cx + hash(wx, wy, seed), py = cy + hash(wx, wy, seed + 7), d = Math.hypot(px - x, py - y);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return [d1, d2];
}
const PATTERNS = {
  grass: (u, v) => 0.5 + (fbm(u, v, 8, 1) - 0.5) * 0.9 + (hash(Math.floor(u * 128), Math.floor(v * 128), 3) - 0.5) * 0.35,
  leaf: (u, v) => { const [d1] = worley(u, v, 10, 5); return 0.5 + (0.35 - d1) * 0.7 + (fbm(u, v, 16, 9, 2) - 0.5) * 0.4; },
  wood: (u, v) => { const w = v * 14 + fbm(u, v, 4, 11) * 3; const ring = Math.abs(((w % 1) + 1) % 1 - 0.5) * 2; return 0.5 + (ring - 0.5) * 0.5 + (vnoise(u * 64, v * 4, 64, 13) - 0.5) * 0.45; },
  stone: (u, v) => { const [d1, d2] = worley(u, v, 6, 17); const edge = Math.min(1, (d2 - d1) * 6); return 0.25 + edge * 0.45 + (fbm(u, v, 8, 21, 3) - 0.5) * 0.35; },
  concrete: (u, v) => 0.5 + (fbm(u, v, 6, 31) - 0.5) * 0.7,
  brick: (u, v) => {                                     // 4 x 8 tijolos por quadrado, desencontrados (v é o eixo vertical nas paredes)
    const row = Math.floor(v * 8), x = u * 4 + (row % 2) * 0.5, fx = x - Math.floor(x), fy = v * 8 - row;
    const mortar = fx < 0.04 || fy < 0.08 ? -0.4 : 0;
    return 0.55 + mortar + (hash(Math.floor(x) % 4, row, 41) - 0.5) * 0.3 + (fbm(u, v, 16, 43, 2) - 0.5) * 0.2;
  },
  metal: (u, v) => 0.5 + (vnoise(u * 4, v * 96, 4, 51) - 0.5) * 0.6 + (fbm(u, v, 4, 53, 2) - 0.5) * 0.3,
  hay: (u, v) => 0.5 + (vnoise(u * 6, v * 128, 6, 61) - 0.5) * 0.9 + (vnoise(u * 3, v * 40, 3, 63) - 0.5) * 0.4,
  fabric: (u, v) => { const a = Math.sin(u * Math.PI * 2 * 48), b = Math.sin(v * Math.PI * 2 * 48); return 0.5 + (a > 0 === b > 0 ? 0.18 : -0.18) * 0.8 + (fbm(u, v, 8, 71, 2) - 0.5) * 0.25; },
};
const detailCache = new Map();
function detailTexture(kind) {
  if (detailCache.has(kind)) return detailCache.get(kind);
  const c = document.createElement("canvas"); c.width = c.height = N;
  const ctx = c.getContext("2d"), img = ctx.createImageData(N, N), f = PATTERNS[kind];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const g = Math.max(0, Math.min(255, Math.round(f(x / N, y / N) * 255))), i = (y * N + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = g; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  detailCache.set(kind, t);
  return t;
}

let white = null;
const whiteTex = () => white || (white = Object.assign(new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1), { needsUpdate: true }));

// ---------- o shader ----------
const VERT_HEAD = "attribute float _occ;\nvarying vec3 vCaWorld;\nvarying vec3 vCaNormal;\nvarying float vCaOcc;\n";
const VERT_BODY = "\n  vCaWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vCaNormal = normalize(mat3(modelMatrix) * objectNormal);\n  vCaOcc = _occ;\n";
const FRAG_HEAD = `varying vec3 vCaWorld;
varying vec3 vCaNormal;
varying float vCaOcc;
uniform sampler2D caGround;
uniform float caGroundW;
uniform float caOccK;
#ifdef CA_DETAIL
uniform sampler2D caDetail;
uniform float caScale;
uniform float caStrength;
#endif
`;
const FRAG_DETAIL = `
#ifdef CA_DETAIL
  {
    vec3 bw = pow(abs(normalize(vCaNormal)), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
    vec3 p = vCaWorld / caScale;
    float d = texture2D(caDetail, p.zy).r * bw.x + texture2D(caDetail, p.xz).r * bw.y + texture2D(caDetail, p.xy).r * bw.z;
    diffuseColor.rgb *= 1.0 + (d - 0.5) * 2.0 * caStrength;
  }
#endif
`;
const FRAG_AO = `
  {
    float caAo = 1.0 - clamp(vCaOcc, 0.0, 1.0) * caOccK;
    vec2 gUv = vec2((vCaWorld.x + ${ARENA.halfX.toFixed(1)}) / ${(ARENA.halfX * 2).toFixed(1)}, 1.0 - (vCaWorld.z + ${ARENA.halfZ.toFixed(1)}) / ${(ARENA.halfZ * 2).toFixed(1)});
    float onFloor = smoothstep(0.09, 0.05, vCaWorld.y) * step(0.5, normalize(vCaNormal).y) * step(abs(gUv.x - 0.5), 0.5) * step(abs(gUv.y - 0.5), 0.5);
    caAo *= mix(1.0, texture2D(caGround, gUv).r, caGroundW * onFloor);
    reflectedLight.indirectDiffuse *= caAo;
    reflectedLight.indirectSpecular *= caAo;
    reflectedLight.directDiffuse *= mix(1.0, caAo, 0.3);
  }
`;

/** Põe a luz cozida (e, se o nome do material tiver tipo, o detalhe) num material standard. ground = { tex, w } partilhado. */
function patchMaterial(m, ground, kind) {
  if (!m || m.userData.caLook || !(m.isMeshStandardMaterial)) return;
  m.userData.caLook = true;
  if (kind) m.defines = { ...(m.defines || {}), CA_DETAIL: "" };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.caGround = ground.uniform; sh.uniforms.caGroundW = ground.weight; sh.uniforms.caOccK = { value: 0.65 };
    if (kind) {
      sh.uniforms.caDetail = { value: detailTexture(kind) };
      sh.uniforms.caScale = { value: KINDS[kind].scale }; sh.uniforms.caStrength = { value: KINDS[kind].strength };
    }
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace("#include <fog_vertex>", "#include <fog_vertex>" + VERT_BODY);
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader
      .replace("#include <map_fragment>", "#include <map_fragment>" + FRAG_DETAIL)
      .replace("#include <aomap_fragment>", "#include <aomap_fragment>" + FRAG_AO);
  };
  m.customProgramCacheKey = () => "caLook" + (kind ? 1 : 0);
  m.needsUpdate = true;
}

/** Aplica o aspeto a todas as malhas de um mapa do Blender. aoTex = textura do chão (ou null). Devolve o "ground" partilhado. */
export function applyMapLook(root, aoTex) {
  const ground = { uniform: { value: aoTex || whiteTex() }, weight: { value: aoTex ? 1 : 0 } };
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) patchMaterial(m, ground, m.transparent ? null : KIND_OF.get(m.name));
  });
  return ground;
}

/** A tinta no chão também fica mais escura nos cantos (só a do chão; a dos topos das plataformas fica igual). */
export function patchPaintMaterial(material, ground) {
  if (ground) patchMaterial(material, ground, null);
}

export async function loadGroundAo(url) {
  try {
    const t = await new THREE.TextureLoader().loadAsync(url);
    t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
    return t;
  } catch { return null; }                                // mapa ainda sem luz cozida: fica igual ao que era
}
