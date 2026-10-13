import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MapBuilder, baseSetup } from "./map-builder.js";

/* ============================================================
   MAPAS FEITOS NO BLENDER (assets/maps/*.glb)
   O ficheiro traz a geometria visível e marcadores com nome:
     Col_Box_n  (extras w, d, top)  caixa de colisão     Col_Cyl_n (extras r, top)  cilindro de colisão
     Col_Ramp_n (extras w, d, axis, y0, y1)  rampa: a altura vai de y0 (lado mínimo do eixo x/z do jogo) a y1 (lado máximo)
     Col_Ladder_n (extras w, d, top, nx, nz)  escada de mão (zona onde se sobe; nx, nz apontam da parede para fora)
     extras opcionais: paint = 1 (topo plano que mostra a tinta), bottom (pontes: passa-se por baixo),
       push_x/push_z (tapete rolante, m/s), spin (carrossel: mesma velocidade da animação), bounce (trampolim, m/s)
     Patrol_n                       ponto de patrulha dos bots
   As bases, os pontos de reaparecimento e os baús são criados aqui, como nos mapas feitos em código.
   Devolve o mesmo objeto que as funções buildX() de map-definitions.js.
   ============================================================ */
export function mapFromGltf(gltf, { id, name, background, skyTop, lighting }) {
  const b = new MapBuilder(id, name);
  b.background = background; b.skyTop = skyTop;
  b.outerColor = null;                                   // o chão exterior (mar, etc.) vem no próprio modelo
  b.lighting(lighting);

  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const markers = [];
  root.traverse((o) => {
    if (o.name.startsWith("Col_") || o.name.startsWith("Patrol_")) markers.push(o);
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
  }

  const p = new THREE.Vector3();
  b.ladders = [];
  const extra = (c, u) => {                                // pontes, tapetes rolantes, carrosséis e trampolins
    if (u.bottom) c.bottom = u.bottom;
    if (u.push_x || u.push_z) c.push = { x: u.push_x || 0, z: u.push_z || 0 };
    if (u.spin) c.spin = -u.spin;                          // a animação roda em +y (do Three); no plano x-z isso é o sentido contrário
    if (u.bounce) c.bounce = u.bounce;
    return c;
  };
  for (const o of markers) {
    o.getWorldPosition(p);
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
  b.root.add(root);
  baseSetup(b);                                          // placas das equipas, bandeiras e reaparecimentos
  b.scatterChests();                                     // baús junto a objetos/paredes, espalhados
  return b.finish();
}

export async function loadGlbMap(url, options) {
  const gltf = await new GLTFLoader().loadAsync(url);
  return mapFromGltf(gltf, options);
}
