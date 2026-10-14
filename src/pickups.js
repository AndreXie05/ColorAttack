import * as THREE from "three";
import { CONFIG, PAL } from "./game-config.js";
import { mat, G } from "./materials-and-geometry.js";
import { COLORS } from "./colors.js";
import { resolveCollisions } from "./collisions.js";
import { floorAt } from "./surfaces.js";

/* ============================================================
   ITENS QUE SAEM DOS BAÚS
   Saltam do baú, caem ao lado e são apanhados ao passar por cima.
   ============================================================ */

// Cada tipo de item é um pequeno modelo feito com formas simples (tamanho grande para se ver bem)
function buildItemModel(type, color) {
  const g = new THREE.Group();
  const add = (geo, color, x, y, z, opts) => {
    const m = new THREE.Mesh(geo, mat(color, { vivid: true, ...(opts && opts.emissive !== undefined ? opts : {}) })); m.position.set(x, y, z); m.castShadow = true; g.add(m);
    if (Array.isArray(opts)) m.scale.set(...opts);
    return m;
  };
  if (type === "ammo") {                                   // caixa de munição, da cor da tinta lá dentro
    add(G.box(0.95, 0.75, 0.95), COLORS[color].hex, 0, 0, 0);
    add(G.box(1.0, 0.16, 1.0), 0xffffff, 0, 0.05, 0);
    add(G.box(0.4, 0.12, 0.4), 0xffffff, 0, 0.42, 0);
  } else if (type === "health") {                          // cruz de cura
    add(G.box(1.0, 0.34, 0.34), PAL.red, 0, 0, 0, { emissive: 0x660000 });
    add(G.box(0.34, 1.0, 0.34), PAL.red, 0, 0, 0, { emissive: 0x660000 });
  } else if (type === "invisible") {                       // fantasma translúcido
    const gm = new THREE.MeshStandardMaterial({ color: 0xdfe8ff, emissive: 0x8aa0ff, emissiveIntensity: 0.55, transparent: true, opacity: 0.7, roughness: 0.3 });
    const body = new THREE.Mesh(G.sphere(0.5), gm); body.scale.y = 1.15; g.add(body);
    for (const sx of [-1, 1]) add(G.sphere(0.09), 0x1a1033, sx * 0.17, 0.12, 0.44, [1, 1.3, 0.6]);
  } else if (type === "trap") {                            // armadilha: disco achatado com tinta e um botão branco
    add(G.cyl(0.55, 0.6, 0.18), PAL.purple, 0, 0, 0, { emissive: 0x3a1166 });
    add(G.cyl(0.2, 0.2, 0.16), 0xffffff, 0, 0.14, 0);
  } else {                                                 // granada de tinta
    add(G.sphere(0.5), PAL.green, 0, 0, 0, { emissive: 0x0a4d1c });
    add(G.cyl(0.18, 0.18, 0.3), 0x333333, 0, 0.55, 0);
    add(G.torus(0.2, 0.05), 0xdddddd, 0.15, 0.78, 0);
  }
  g.scale.setScalar(1.4);
  return g;
}

export class PickupManager {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.items = [];
    this.seq = 0;
    // partida com amigos: onSpawn(lista) e onTake(item) avisam os outros PCs; noCollect = convidado (quem apanha decide o anfitrião)
    this.onSpawn = null; this.onTake = null; this.noCollect = false;
  }

  // Cria n itens que saltam do baú (x, z) em direções diferentes. `colors[i]` = cor da i-ésima caixa de munição
  spawn(type, n, x, z, colors = [], shots = []) {
    const made = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 1.2, speed = 3 + Math.random() * 2;
      made.push({ id: ++this.seq, type, color: colors[i], shots: shots[i], x, z, vx: Math.cos(a) * speed, vz: Math.sin(a) * speed, vy: 8 + Math.random() * 2, phase: Math.random() * 6 });
    }
    this.spawnExact(made);
    this.onSpawn?.(made);
  }
  // Cria itens com tudo já decidido (o convidado recebe-os assim do anfitrião: caem exatamente no mesmo sítio)
  spawnExact(list) {
    for (const d of list) {
      const model = buildItemModel(d.type, d.color);
      model.position.set(d.x, 1.6, d.z);
      this.group.add(model);
      this.items.push({
        id: d.id, type: d.type, color: d.color, shots: d.shots, model, pos: model.position, vx: d.vx, vz: d.vz, vy: d.vy,
        landed: false, age: 0, life: CONFIG.pickup.lifeSeconds, phase: d.phase,
      });
    }
  }
  remove(id) {                                                                        // alguém (noutro PC) apanhou-o
    const i = this.items.findIndex((it) => it.id === id);
    if (i < 0) return;
    this.group.remove(this.items[i].model); this.items.splice(i, 1);
  }

  // Atualiza voo, rotação e recolha; devolve a lista de itens apanhados neste frame ({ type, color })
  update(dt, t, playerPos, colliders) {
    const got = [];
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i], p = it.pos;
      it.age += dt;
      if (!it.landed) {
        it.vy -= 26 * dt;
        p.x += it.vx * dt; p.z += it.vz * dt; p.y += it.vy * dt;
        const fl = it.vy < 0 ? floorAt(colliders, p.x, p.z, p.y - 0.9) : 0;   // pode cair no chão ou em cima de uma plataforma
        if (it.vy < 0 && p.y <= fl + 0.9) {
          it.landed = true; it.floor = fl;
          const probe = new THREE.Vector3(p.x, fl, p.z);       // não ficar dentro de obstáculos
          resolveCollisions(probe, 0.9, colliders);
          p.x = probe.x; p.z = probe.z; p.y = fl + 0.9;
        }
      } else {
        p.y = (it.floor || 0) + 1.3 + Math.sin(t * 3 + it.phase) * 0.25;
      }
      it.model.rotation.y = t * 2 + it.phase;
      if (it.life - it.age < 6) it.model.visible = Math.floor(it.age * 6) % 2 === 0;   // pisca antes de desaparecer

      const near = !this.noCollect && Math.hypot(p.x - playerPos.x, p.z - playerPos.z) < CONFIG.pickup.collectDist && Math.abs((it.floor || 0) - playerPos.y) < 1.2 && it.age > 0.5;
      if (near || it.age >= it.life) {
        this.group.remove(it.model);
        this.items.splice(i, 1);
        if (near) { got.push({ type: it.type, color: it.color, shots: it.shots }); this.onTake?.(it); }
      }
    }
    return got;
  }

  // Caixa de munição já caída mais próxima de `pos` (para os bots irem buscá-la), ou null
  nearestAmmo(pos, maxDist) {
    let best = null, bd = maxDist;
    for (const it of this.items) {
      if (it.type !== "ammo" || !it.landed) continue;
      const d = Math.hypot(it.pos.x - pos.x, it.pos.z - pos.z);
      if (d < bd) { bd = d; best = it.pos; }
    }
    return best;
  }

  // Item caído (qualquer tipo) mais próximo de `pos`, ou null (os bots vão buscá-lo)
  nearestItem(pos, maxDist) {
    let best = null, bd = maxDist;
    for (const it of this.items) {
      if (!it.landed) continue;
      const d = Math.hypot(it.pos.x - pos.x, it.pos.z - pos.z);
      if (d < bd) { bd = d; best = it.pos; }
    }
    return best;
  }

  // Apanha os itens (munição, cura, granada, invisibilidade) ao alcance de um bot; devolve [{ type, color, shots }]
  collectNear(pos) {
    const got = [];
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (!it.landed || it.age < 0.5) continue;
      if (Math.hypot(it.pos.x - pos.x, it.pos.z - pos.z) < CONFIG.pickup.collectDist && Math.abs((it.floor || 0) - pos.y) < 1.2) {
        this.group.remove(it.model); this.items.splice(i, 1); got.push({ type: it.type, color: it.color, shots: it.shots }); this.onTake?.(it);
      }
    }
    return got;
  }

  clear() {
    for (const it of this.items) this.group.remove(it.model);
    this.items.length = 0;
  }

  dispose() { this.clear(); this.group.parent?.remove(this.group); }
}
