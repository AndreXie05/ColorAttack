import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MapBuilder, baseSetup } from "./map-builder.js";
import { gateAngle } from "../movimento/surfaces.js";
import { applyMapLook, loadGroundAo, KIND_OF } from "../visual/map-look.js";
import { addNeonGlow } from "../visual/neon-glow.js";

/* ============================================================
   MAPAS FEITOS NO BLENDER (assets/maps/*.glb)
   O ficheiro traz a geometria visível e marcadores com nome:
     Col_Box_n  (extras w, d, top)  caixa de colisão     Col_Cyl_n (extras r, top)  cilindro de colisão
     Col_Ramp_n (extras w, d, axis, y0, y1)  rampa: a altura vai de y0 (lado mínimo do eixo x/z do jogo) a y1 (lado máximo)
     Col_Ladder_n (extras w, d, top, nx, nz)  escada de mão (zona onde se sobe; nx, nz apontam da parede para fora)
     Col_Water_n  (extras w, d, top)  água: quem pousa os pés dentro é eliminado
     Col_Gate_n   (extras gid, w, len, dx, dz, y, period, open, move, phase)  ponte-levadiça: dobradiça no marcador, desce no
                  sentido (dx, dz) com comprimento len e largura w, a y m; o objeto visual é Anim_Gate<gid> (anim = "gate")
     extras opcionais: paint = 1 (topo plano que mostra a tinta), bottom (pontes: passa-se por baixo),
       push_x/push_z (tapete rolante, m/s), spin (carrossel: mesma velocidade da animação), bounce (trampolim, m/s)
     Patrol_n                       ponto de patrulha dos bots
     Glow_n (extras r, c)           mancha de luz de néon no chão (cor c); os materiais "Tube…" ganham halo (ver neon-glow.js)
   As bases, os pontos de reaparecimento e os baús são criados aqui, como nos mapas feitos em código.
   Devolve o mesmo objeto que as funções buildX() de map-definitions.js.
   ============================================================ */
export function mapFromGltf(gltf, { id, name, background, skyTop, lighting, night = false }, groundAo = null) {
  const b = new MapBuilder(id, name);
  b.background = background; b.skyTop = skyTop;
  b.outerColor = null;                                   // o chão exterior (mar, etc.) vem no próprio modelo
  b.lighting(lighting);

  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const markers = [];
  root.traverse((o) => {
    if (o.name.startsWith("Col_") || o.name.startsWith("Patrol_") || o.name.startsWith("Glow_")) markers.push(o);
    else if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      b.disposables.push(o.geometry);
      for (const m of [].concat(o.material)) b.disposables.push(m);
    }
  });
  // Objetos animados (extras: anim = spin | bob | loop | counter, axis em eixos do jogo)
  const animated = [];
  root.traverse((o) => { if (o.userData && o.userData.anim) animated.push(o); });
  for (const o of animated) {
    const u = o.userData, base = o.position.clone();
    if (u.anim === "spin") b.updaters.push((dt) => { o.rotation[u.axis] += u.speed * dt; });
    else if (u.anim === "bob") b.updaters.push((dt, t) => { o.position.y = base.y + Math.sin(t * u.speed + u.phase) * u.amp; });
    else if (u.anim === "loop") b.updaters.push((dt, t) => {
      o.position[u.axis] = base[u.axis] + ((((t * u.speed + u.phase) % u.span) + u.span) % u.span) - u.span / 2;   // (velocidade negativa = anda ao contrário)
    });
    else if (u.anim === "counter") b.updaters.push(() => { o.rotation[u.axis] = -o.parent.rotation[u.axis]; });   // cabinas ficam direitas
    else if (u.anim === "blink") b.updaters.push((dt, t) => { o.visible = ((((t * u.speed + u.phase) % 1) + 1) % 1) < u.amp; });   // luzes a piscar
    else if (u.anim === "gate") b.updaters.push((dt, t) => { o.rotation[u.axis] = u.gsign * gateAngle(u, t); });   // ponte-levadiça (sobe e desce)
  }

  const p = new THREE.Vector3();
  b.ladders = []; b.waters = [];
  const pools = [];
  const extra = (c, u) => {                                // pontes, tapetes rolantes, carrosséis e trampolins
    if (u.bottom) c.bottom = u.bottom;
    if (u.push_x || u.push_z) c.push = { x: u.push_x || 0, z: u.push_z || 0 };
    if (u.spin) c.spin = -u.spin;                          // a animação roda em +y (do Three); no plano x-z isso é o sentido contrário
    if (u.bounce) c.bounce = u.bounce;
    if (u.solid) c.solid = true;
    return c;
  };
  for (const o of markers) {
    o.getWorldPosition(p);
    if (o.name.startsWith("Glow_")) {
      pools.push({ x: p.x, z: p.z, r: o.userData.r, c: o.userData.c });
      o.parent.remove(o);
      continue;
    }
    if (o.name.startsWith("Col_Water")) {
      const { w, d, top } = o.userData;
      b.waters.push({ minX: p.x - w / 2, maxX: p.x + w / 2, minZ: p.z - d / 2, maxZ: p.z + d / 2, top: top || 0 });
      o.parent.remove(o);
      continue;
    }
    if (o.name.startsWith("Col_Gate")) {                    // ponte-levadiça: o obstáculo muda com o ângulo (ponte em baixo / parede em cima)
      const g = { ...o.userData }, hx = p.x, hz = p.z, c = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, top: -10, gate: true };
      b.colliders.push(c);
      const set = (x0, x1, z0, z1, top, bottom = 0) => { c.minX = Math.min(x0, x1); c.maxX = Math.max(x0, x1); c.minZ = Math.min(z0, z1); c.maxZ = Math.max(z0, z1); c.top = top; c.bottom = bottom; };
      c.exit = { x: -g.dx, z: -g.dz };                      // para sair da ponte: em direção à dobradiça (margem)
      const upd = (dt, t) => {
        const a = gateAngle(g, t), ex = hx + g.dx * g.len, ez = hz + g.dz * g.len, hw = g.w / 2;
        const cyc = (((t + g.phase) % g.period) + g.period) % g.period;
        c.safe = a < 0.15 && g.open - cyc > 3;                // em baixo e ainda falta para subir (os bots só entram assim)
        if (a < 0.15) {                                     // em baixo: ponte por onde se passa
          if (g.dx) set(hx, ex, hz - hw, hz + hw, g.y); else set(hx - hw, hx + hw, hz, ez, g.y);
        } else if (a > 1.3) {                               // levantada: tapa a passagem
          const tx = hx + g.dx * 0.3, tz = hz + g.dz * 0.3;
          if (g.dx) set(hx, tx, hz - hw, hz + hw, g.y + g.len); else set(hx - hw, hx + hw, hz, tz, g.y + g.len);
        } else c.top = -10;                                 // a mexer-se: não segura ninguém
      };
      upd(0, 0); b.updaters.push(upd);
      o.parent.remove(o);
      continue;
    }
    if (o.name.startsWith("Col_Ladder")) {
      const { w, d, top, nx, nz } = o.userData;
      b.ladders.push({ minX: p.x - w / 2, maxX: p.x + w / 2, minZ: p.z - d / 2, maxZ: p.z + d / 2, top, nx, nz });
      o.parent.remove(o);
      continue;
    }
    if (o.name.startsWith("Col_Box")) {
      const { w, d, top, paint } = o.userData;
      b.colliders.push(extra({ minX: p.x - w / 2, maxX: p.x + w / 2, minZ: p.z - d / 2, maxZ: p.z + d / 2, top, paint: !!paint }, o.userData));
    } else if (o.name.startsWith("Col_Ramp")) {
      const { w, d, axis, y0, y1 } = o.userData;
      b.colliders.push({ minX: p.x - w / 2, maxX: p.x + w / 2, minZ: p.z - d / 2, maxZ: p.z + d / 2, top: Math.max(y0, y1), ramp: { axis, y0, y1 } });
    } else if (o.name.startsWith("Col_Cyl")) {
      b.colliders.push(extra({ x: p.x, z: p.z, r: o.userData.r, top: o.userData.top, paint: !!o.userData.paint }, o.userData));
    } else {
      b.patrol.push({ x: p.x, z: p.z });
    }
    o.parent.remove(o);
  }
  mergeStatic(root, b);                                  // (antes do aspeto: os materiais juntos recebem-no como os outros)
  const look = applyMapLook(root, groundAo);             // luz cozida + texturas de detalhe (ver map-look.js)
  if (groundAo) b.disposables.push(groundAo);
  b.disposables.push(...addNeonGlow(root, pools));        // (depois do aspeto: os halos têm o seu próprio material)
  b.root.add(root);
  baseSetup(b);                                          // placas das equipas, bandeiras e reaparecimentos
  b.scatterChests();                                     // baús junto a objetos/paredes, espalhados
  return Object.assign(b.finish(), { look, night });
}

// As peças são juntadas numa malha por TIPO de material: a cor de cada peça passa para os vértices (o desenho fica igual:
// cor do material × cor do vértice), por isso peças de cores diferentes com o mesmo tipo (detalhe, rugosidade, metal,
// brilho próprio) são desenhadas de uma vez. O que não mexe junta-se no mapa; as peças de um objeto animado (balão,
// papagaio, carrossel, cabina...) juntam-se dentro desse objeto, que continua a mexer-se igual (sem atravessar animações
// dentro de animações). Ex.: Parque 159 peças → ~30 chamadas de desenho. Ficam soltos: transparentes e com textura.
function mergeStatic(root, b) {
  root.updateMatrixWorld(true);
  // objeto animado = grupo "Anim_…" (ou com animação); as peças de várias cores lá dentro chamam-se "Anim_…_1", "_2"... e juntam-se nele
  const isAnim = (o) => o !== root && !o.isMesh && (o.userData?.anim || o.name.startsWith("Anim_"));
  const scopeOf = (o) => { for (let p = o.parent; p && p !== root; p = p.parent) if (isAnim(p)) return p; return root; };   // o objeto animado mais próximo (ou o mapa)
  const loose = (o) => o.userData?.anim || (o.name.startsWith("Anim_") && !isAnim(o.parent));   // peça que se mexe sozinha, ou "Anim_Sky…" solta (o minimapa procura-a pelo nome)
  const groups = new Map(), _m = new THREE.Matrix4();
  const kindOf = (m) => [m.type, KIND_OF.get(m.name) || "", m.roughness?.toFixed(3), m.metalness?.toFixed(3), m.emissive?.getHexString(), m.emissiveIntensity, m.side, m.flatShading, m.vertexColors].join("/");
  root.traverse((o) => {
    if (!o.isMesh || loose(o) || Array.isArray(o.material) || o.material.transparent || o.material.map || o.isSkinnedMesh || o.morphTargetInfluences) return;
    const g = o.geometry, scope = scopeOf(o), key = scope.uuid + "|" + kindOf(o.material) + "|" + Object.keys(g.attributes).sort().join(",") + "|" + !!g.index + "|" + o.castShadow;
    if (!groups.has(key)) groups.set(key, { scope, meshes: [] });
    groups.get(key).meshes.push(o);
  });
  for (const { scope, meshes } of groups.values()) {
    if (meshes.length < 2) continue;
    const inv = scope.matrixWorld.clone().invert();
    const geos = meshes.map((m) => {
      const g = m.geometry.clone(); g.applyMatrix4(_m.multiplyMatrices(inv, m.matrixWorld));
      const n = g.attributes.position.count, col = new Float32Array(n * 3), c = m.material.color;   // a cor do material vai para cada vértice
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      return g;
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    for (const m of meshes) m.parent.remove(m);
    const mat = meshes[0].material.clone();                                           // mesmo tipo, cor branca: a cor vem dos vértices
    mat.color.setRGB(1, 1, 1); mat.vertexColors = true;
    b.disposables.push(mat);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = meshes[0].castShadow; mesh.receiveShadow = true;
    scope.add(mesh);
    b.disposables.push(merged);
  }
  // os grupos que ficaram vazios saem da cena (menos objetos para percorrer em cada frame)
  const empty = [];
  root.traverse((o) => { if (o !== root && !o.isMesh && !isAnim(o) && o.children.length === 0) empty.push(o); });
  for (const o of empty) o.parent?.remove(o);
}

export async function loadGlbMap(url, options) {
  const [gltf, groundAo] = await Promise.all([new GLTFLoader().loadAsync(url), loadGroundAo(url.replace(/\.glb$/, "_ao.jpg"))]);
  return mapFromGltf(gltf, options, groundAo);
}
