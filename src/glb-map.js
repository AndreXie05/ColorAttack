import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MapBuilder, baseSetup } from "./map-builder.js";

/* ============================================================
   MAPAS FEITOS NO BLENDER (assets/maps/*.glb)
   O ficheiro traz a geometria visível e marcadores com nome:
     Col_Box_n  (extras w, d, top)  caixa de colisão     Col_Cyl_n (extras r, top)  cilindro de colisão
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
      o.position[u.axis] = base[u.axis] + ((t * u.speed + u.phase) % u.span) - u.span / 2;
    });
    else if (u.anim === "counter") b.updaters.push(() => { o.rotation[u.axis] = -o.parent.rotation[u.axis]; });   // cabinas ficam direitas
  }

  const p = new THREE.Vector3();
  for (const o of markers) {
    o.getWorldPosition(p);
    if (o.name.startsWith("Col_Box")) {
      const { w, d, top } = o.userData;
      b.colliders.push({ minX: p.x - w / 2, maxX: p.x + w / 2, minZ: p.z - d / 2, maxZ: p.z + d / 2, top });
    } else if (o.name.startsWith("Col_Cyl")) {
      b.colliders.push({ x: p.x, z: p.z, r: o.userData.r, top: o.userData.top });
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
