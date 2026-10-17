import * as THREE from "three";

/* ============================================================
   BRILHO DO NÉON (mapa Cidade Neon; serve para qualquer mapa do Blender)
   - Halo: cada malha com material "Tube…" (tubos de néon) ganha uma "casca" um pouco maior, desenhada por cima com mistura
     aditiva: forte de frente e a desvanecer nas bordas. Parece luz a espalhar-se à volta do tubo, sem pós-processamento
     (o "bloom" a sério desenha o ecrã inteiro várias vezes; isto é só uma chamada de desenho a mais por cor de néon).
   - Manchas de luz no chão (marcadores Glow_n do .glb): discos com a cor do néon, mais fortes ao centro. Juntos numa só
     malha; ficam por cima da tinta e só a iluminam (aditivos), nunca a tapam.
   Os dois desvanecem com o nevoeiro do clima, como o resto do mapa.
   ============================================================ */
const FOG_VERT_HEAD = "#include <fog_pars_vertex>\n";
const FOG_FRAG = `
  #ifdef USE_FOG
    a *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
  #endif
`;

function glowMaterial(vertexShader, fragmentShader, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, uniforms]),
    vertexShader, fragmentShader, fog: true,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

const HALO_VERT = FOG_VERT_HEAD + `
varying vec3 vN; varying vec3 vV;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const HALO_FRAG = `#include <fog_pars_fragment>
uniform vec3 color; uniform float strength;
varying vec3 vN; varying vec3 vV;
void main() {
  float f = abs(dot(normalize(vN), normalize(vV)));
  float a = f * f * strength;
  ${FOG_FRAG}
  gl_FragColor = vec4(color, a);
  #include <colorspace_fragment>
}`;

const POOL_VERT = FOG_VERT_HEAD + `
attribute float rr; attribute vec3 color;
varying float vR; varying vec3 vC;
void main() {
  vR = rr; vC = color;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const POOL_FRAG = `#include <fog_pars_fragment>
uniform float strength;
varying float vR; varying vec3 vC;
void main() {
  float k = 1.0 - clamp(vR, 0.0, 1.0);
  float a = k * k * strength;
  ${FOG_FRAG}
  gl_FragColor = vec4(vC, a);
  #include <colorspace_fragment>
}`;

// casca à volta da geometria: cada vértice anda ao longo da normal (mais longe do centro do mapa = halo maior, para se ver ao longe)
function shellGeometry(geo, mesh) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  if (!nor) return null;
  const out = new THREE.BufferGeometry(), p = new Float32Array(pos.count * 3), v = new THREE.Vector3(), w = new THREE.Vector3();
  mesh.updateMatrixWorld(true);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    w.copy(v).applyMatrix4(mesh.matrixWorld);
    const k = 0.2 + Math.min(Math.hypot(w.x, w.z), 300) * 0.004;
    p[i * 3] = v.x + nor.getX(i) * k; p[i * 3 + 1] = v.y + nor.getY(i) * k; p[i * 3 + 2] = v.z + nor.getZ(i) * k;
  }
  out.setAttribute("position", new THREE.BufferAttribute(p, 3));
  out.setAttribute("normal", nor.clone());
  if (geo.index) out.setIndex(geo.index.clone());
  out.computeBoundingSphere();
  return out;
}

/** Junta halos aos tubos de néon e desenha as manchas de luz. pools = [{ x, z, r, c }]. Devolve o que tem de ser libertado no fim. */
export function addNeonGlow(root, pools = []) {
  const disposables = [], tubes = [];
  root.traverse((o) => { if (o.isMesh && !Array.isArray(o.material) && o.material.name.startsWith("Tube")) tubes.push(o); });
  for (const m of tubes) {
    const geo = shellGeometry(m.geometry, m);
    if (!geo) continue;
    const mat = glowMaterial(HALO_VERT, HALO_FRAG, { color: { value: m.material.emissive.clone() }, strength: { value: 0.55 } });
    const halo = new THREE.Mesh(geo, mat);
    halo.name = "NeonHalo"; halo.renderOrder = 2;
    m.add(halo);                                                     // filho do tubo: acompanha as animações (holograma, letreiros a rodar)
    disposables.push(geo, mat);
  }
  if (pools.length) {
    const SEG = 24, n = pools.length, pos = new Float32Array(n * (SEG + 1) * 3), col = new Float32Array(n * (SEG + 1) * 3), rr = new Float32Array(n * (SEG + 1)), idx = [];
    const c = new THREE.Color();
    pools.forEach((g, k) => {
      c.setHex(g.c);
      const o = k * (SEG + 1);
      for (let i = 0; i <= SEG; i++) {
        const a = (i / SEG) * Math.PI * 2, r = i === SEG ? 0 : g.r;           // o último vértice é o centro
        pos.set([g.x + Math.cos(a) * r, 0.055, g.z + Math.sin(a) * r], (o + i) * 3);
        col.set([c.r, c.g, c.b], (o + i) * 3);
        rr[o + i] = i === SEG ? 0 : 1;
      }
      for (let i = 0; i < SEG; i++) idx.push(o + SEG, o + (i + 1) % SEG, o + i);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("rr", new THREE.BufferAttribute(rr, 1));
    geo.setIndex(idx); geo.computeBoundingSphere();
    const mat = glowMaterial(POOL_VERT, POOL_FRAG, { strength: { value: 0.32 } });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = "NeonPools"; mesh.renderOrder = 1;
    root.add(mesh);
    disposables.push(geo, mat);
  }
  return disposables;
}
