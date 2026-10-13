import * as THREE from "three";
import { topAt, floorAt } from "./surfaces.js";
import { CONFIG, ARENA, bodyHeight, aimY } from "./game-config.js";
import { COLORS, PRIMARIES, resolveHit, hitDamage } from "./colors.js";

/* ============================================================
   COMBATE (regras do jogo; os meshes são opcionais, por isso dá para testar em Node)
   - Projéteis de tinta com a cor da munição.
   - Cor certa (igual à cor do alvo) = eliminação direta. Cor errada = tira vida (4, ou 8 se o alvo for de cor
     misturada e o tiro for de uma das cores que a formam) e, se o alvo for primário, a cor dele muda pela tabela.
   - Sem fogo amigo. Quem é eliminado deixa uma poça da sua cor e reaparece 5 s depois, com 2 s de proteção.
   Cada combatente: { id, team, index, isPlayer, pos{x,y,z}, hp, maxHp, colorId, alive, protectUntil, respawnAt, radius, height }
   ============================================================ */
function grenadeMesh(m1, m2) {
  if (!m2) return new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), m1);
  const grp = new THREE.Group(); grp.rotation.y = Math.PI / 2;
  grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 10, 0, Math.PI), m1), new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 10, Math.PI, Math.PI), m2));
  return grp;
}
function disposeMesh(o) { o.traverse((c) => { if (c.geometry) c.geometry.dispose(); }); }
const PROJ = { radius: 0.3, life: 1.6, max: 90 };
const PART_MAX = 70;

export const isProtected = (c, t) => t < c.protectUntil;

export class CombatWorld {
  constructor({ scene = null, map, paint = null, callbacks = {} }) {
    this.scene = scene; this.map = map; this.paint = paint; this.cb = callbacks;
    this.combatants = []; this.t = 0; this.lastSplat = -1;
    this.projectiles = []; this.particles = []; this.grenades = []; this.effects = []; this.puddles = [];
    this.mats = new Map();
    if (scene) {
      this.group = new THREE.Group(); scene.add(this.group);
      this.geo = new THREE.SphereGeometry(PROJ.radius, 10, 8);
      this.pgeo = new THREE.SphereGeometry(0.16, 6, 5);
      for (let i = 0; i < PROJ.max; i++) { const m = new THREE.Mesh(this.geo, this.mat("vermelho")); m.visible = false; this.group.add(m); this.projectiles.push({ mesh: m, active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, owner: null, colorId: "vermelho" }); }
      for (let i = 0; i < PART_MAX; i++) { const m = new THREE.Mesh(this.pgeo, this.mat("vermelho")); m.visible = false; this.group.add(m); this.particles.push({ mesh: m, active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 }); }
    } else {
      for (let i = 0; i < PROJ.max; i++) this.projectiles.push({ mesh: null, active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, owner: null, colorId: "vermelho" });
    }
  }

  mat(colorId) {
    let m = this.mats.get(colorId);
    if (!m) {
      const hex = COLORS[colorId].hex;
      m = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.55, roughness: 0.3 });
      this.mats.set(colorId, m);
    }
    return m;
  }

  add(c) {
    Object.assign(c, { maxHp: c.maxHp ?? CONFIG.health.max, protectUntil: c.protectUntil ?? 0, respawnAt: 0, radius: c.radius ?? 0.62 * CONFIG.player.scale, height: bodyHeight(c), kills: 0, deaths: 0 });
    if (c.hp === undefined) c.hp = c.maxHp;
    if (c.alive === undefined) c.alive = true;
    this.combatants.push(c);
    return c;
  }

  enemiesOf(c) { return this.combatants.filter((q) => q.alive && q.team !== c.team); }

  // Linha de visão: dos olhos de quem vê (ay + h) até ao alvo (by + hb). ay, by = altura dos pés: em cima de plataformas vê-se por cima dos muros
  los(ax, az, bx, bz, h = 1.3, ay = 0, by = 0, hb = h) {
    const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(d / 0.9));
    for (let i = 1; i < n; i++) {
      const x = ax + (dx * i) / n, z = az + (dz * i) / n, y = ay + h + ((by + hb - ay - h) * i) / n;
      for (const c of this.map.colliders) if (y < topAt(c, x, z) && y >= (c.bottom || 0) && this._inside(c, x, z, 0.05)) return false;
    }
    return true;
  }

  _inside(c, x, z, pad) {
    return c.r !== undefined ? Math.hypot(x - c.x, z - c.z) < c.r + pad : x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad;
  }

  // Primeiro objeto atingido por um raio (chão, obstáculo ou inimigo); usado para apontar
  raycast(o, d, maxDist, ignoreTeam) {
    for (let k = 0.5; k <= maxDist; k += 0.5) {
      const x = o.x + d.x * k, y = o.y + d.y * k, z = o.z + d.z * k;
      if (y <= 0) return { x, y: 0, z, dist: k, kind: "ground" };
      if (Math.abs(x) > ARENA.halfX || Math.abs(z) > ARENA.halfZ) return { x, y, z, dist: k, kind: "edge" };
      for (const c of this.map.colliders) if (y < topAt(c, x, z) && y >= (c.bottom || 0) && this._inside(c, x, z, 0)) return { x, y, z, dist: k, kind: "obstacle" };
      for (const q of this.combatants) {
        if (!q.alive || q.team === ignoreTeam) continue;
        if (Math.hypot(x - q.pos.x, z - q.pos.z) < q.radius && y >= q.pos.y && y <= q.pos.y + q.height) return { x, y, z, dist: k, kind: "enemy", target: q };
      }
    }
    return { x: o.x + d.x * maxDist, y: o.y + d.y * maxDist, z: o.z + d.z * maxDist, dist: maxDist, kind: "none" };
  }

  fire(owner, origin, dir, colorId) {
    const p = this.projectiles.find((q) => !q.active);
    if (!p) return null;
    const l = Math.hypot(dir.x, dir.y, dir.z) || 1, sp = CONFIG.weapon.projectileSpeed;
    Object.assign(p, { active: true, x: origin.x, y: origin.y, z: origin.z, vx: (dir.x / l) * sp, vy: (dir.y / l) * sp, vz: (dir.z / l) * sp, life: CONFIG.weapon.range / sp, owner, colorId, pierce: owner.pierce || 0, hitIds: null });
    if (p.mesh) { p.mesh.material = this.mat(colorId); p.mesh.position.set(p.x, p.y, p.z); p.mesh.visible = true; }
    return p;
  }

  burst(x, y, z, colorId, n = 8) {
    if (!this.scene) return;
    for (let i = 0; i < n; i++) {
      const q = this.particles.find((r) => !r.active);
      if (!q) return;
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4;
      Object.assign(q, { active: true, x, y, z, vx: Math.cos(a) * s, vy: 2 + Math.random() * 4, vz: Math.sin(a) * s, life: 0.45 + Math.random() * 0.25 });
      q.mesh.material = this.mat(colorId); q.mesh.position.set(x, y, z); q.mesh.visible = true;
    }
  }

  splat(x, z, colorId, r, force = false) {
    if (!this.paint || (!force && this.t - this.lastSplat < 0.07)) return;
    if ((this.map.waters || []).some((w) => x > w.minX && x < w.maxX && z > w.minZ && z < w.maxZ)) return;   // a tinta não fica a boiar no rio
    this.lastSplat = this.t;
    this.paint.splat(x, z, colorId, r);
  }

  // O tiro (da cor `shot`) acerta em `target`
  hit(owner, target, shot) {
    const r = resolveHit(shot, target.colorId);
    this.burst(target.pos.x, aimY(target), target.pos.z, shot, 10);
    if (r.result === "kill") { this.eliminate(target, owner, shot, true); return; }
    const dmg = hitDamage(shot, target.colorId, { wrong: CONFIG.health.wrongHit, partial: CONFIG.health.partialHit }) * (owner?.damageMul || 1);
    target.hp = Math.max(0, target.hp - dmg);
    this.cb.onDamage?.(target, dmg, owner, shot);
    if (r.result === "change") { target.colorId = r.newColor; this.cb.onColorChange?.(target, r.newColor); }
    if (target.hp <= 0) this.eliminate(target, owner, shot, false);
  }

  eliminate(target, killer, shot, byColor, via = "shot") {
    if (!target.alive) return;
    target.alive = false; target.deadT = 0; target.deaths++; target.respawnAt = this.t + CONFIG.respawn.delay;
    if (killer) killer.kills++;
    this.splat(target.pos.x, target.pos.z, target.colorId, 2.2);                    // poça da cor do eliminado
    this.puddles.push({ x: target.pos.x, y: target.pos.y, z: target.pos.z, r: 1.8, colorId: target.colorId, t: this.t });   // só estas poças mudam a cor de quem as pisa
    this.burst(target.pos.x, aimY(target), target.pos.z, target.colorId, 16);
    this.cb.onKill?.(killer, target, shot, byColor, via);
  }

  // Granada de tinta: voa em arco até ao ponto (limitado ao alcance) e, ao cair, pinta todos os que estiverem na área da cor escolhida (adversários dessa cor são eliminados)
  throwGrenade(owner, o, target, colorId, colorId2 = null) {
    const G = CONFIG.grenade, T = G.flight;
    let tx = target.x, tz = target.z;
    const dx = tx - owner.pos.x, dz = tz - owner.pos.z, d = Math.hypot(dx, dz);
    if (d > G.range) { tx = owner.pos.x + (dx / d) * G.range; tz = owner.pos.z + (dz / d) * G.range; }   // alcance máximo
    const gr = { x: o.x, y: o.y, z: o.z, vx: (tx - o.x) / T, vz: (tz - o.z) / T, vy: (0.2 - o.y + 0.5 * G.gravity * T * T) / T, t: 0, owner, colorId, colors: colorId2 && colorId2 !== colorId ? [colorId, colorId2] : [colorId], mesh: null };
    if (this.scene) {
      gr.mesh = grenadeMesh(this.mat(colorId), gr.colors.length > 1 ? this.mat(gr.colors[1]) : null);          // 2 cores: metade de cada
      gr.mesh.position.set(gr.x, gr.y, gr.z); this.group.add(gr.mesh);
    }
    this.grenades.push(gr);
    return { x: tx, z: tz };
  }

  explodeGrenade(g) {
    const R = CONFIG.grenade.radius * (g.owner?.grenadeMul || 1), hit = [];
    this.burst(g.x, g.y + 0.8, g.z, g.colorId, 30);
    if (g.colors.length > 1) {                                                // 2 cores: duas manchas lado a lado
      this.burst(g.x, g.y + 0.8, g.z, g.colors[1], 30);
      this.splat(g.x - R * 0.32, g.z, g.colors[0], R * 0.62, true); this.splat(g.x + R * 0.32, g.z, g.colors[1], R * 0.62, true);
    } else this.splat(g.x, g.z, g.colorId, R * 0.92, true);
    if (this.scene) {                                                       // onda de choque
      const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: COLORS[g.colorId].hex, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(g.x, g.y + 0.08, g.z); this.group.add(m);
      this.effects.push({ mesh: m, life: 0.55, max: 0.55, R });
    }
    for (const c of this.combatants) {
      if (!c.alive || isProtected(c, this.t)) continue;
      if (Math.hypot(c.pos.x - g.x, c.pos.z - g.z) > R + c.radius * 0.5 || Math.abs(c.pos.y - g.y) > 2.6) continue;   // noutro nível (muito acima/abaixo): não apanha
      hit.push(c);
      if (g.colors.includes(c.colorId) && g.owner && c.team !== g.owner.team) { this.eliminate(c, g.owner, c.colorId, true, "grenade"); continue; }   // adversário já de uma das cores: eliminado
      const nc = g.colors[Math.floor(Math.random() * g.colors.length)];
      if (c.colorId !== nc) { c.colorId = nc; this.cb.onColorChange?.(c, nc); }
    }
    this.cb.onGrenade?.(g.owner, g.x, g.z, g.colorId, hit);
    return hit;
  }

  heal(c, amount) {
    if (!c.alive || c.hp >= c.maxHp) return 0;
    const before = c.hp;
    c.hp = Math.min(c.maxHp, c.hp + amount);
    return c.hp - before;
  }

  respawn(c) {
    const list = this.map.spawns[c.team];
    const s = list[Math.floor(Math.random() * list.length)];                 // reaparece num dos 5 lugares da base
    c.alive = true; c.deadT = 0; c.hp = c.maxHp; c.colorId = PRIMARIES[Math.floor(Math.random() * PRIMARIES.length)];
    c.pos.x = s.x; c.pos.z = s.z; c.pos.y = 0;
    c.protectUntil = this.t + CONFIG.respawn.protection;
    this.cb.onRespawn?.(c, s);
  }

  resetAll() {                                                                 // novo round: todos voltam às bases, com vida cheia
    for (const p of this.projectiles) { p.active = false; if (p.mesh) p.mesh.visible = false; }
    for (const g of this.grenades) if (g.mesh) { this.group.remove(g.mesh); disposeMesh(g.mesh); }
    this.grenades = []; this.puddles = [];
    for (const c of this.combatants) this.respawn(c);
  }

  update(dt, t) {
    this.t = t;
    for (const c of this.combatants) {
      if (!c.alive && t >= c.respawnAt) this.respawn(c);
      c.height = bodyHeight(c);                                                 // agachado: mais baixo (mais difícil de acertar)
    }
    // poças deixadas por jogadores eliminados: quem as pisa fica da cor da poça (as manchas normais dos tiros e granadas não fazem nada)
    this.puddles = this.puddles.filter((q) => t - q.t < CONFIG.paint.lifeSeconds);
    for (const c of this.combatants) {
      if (!c.alive) continue;
      c.puddleCd = (c.puddleCd || 0) - dt;
      if (c.puddleCd > 0) continue;
      const q = this.puddles.find((u) => u.colorId !== c.colorId && Math.abs(c.pos.y - (u.y || 0)) < 0.2 && Math.hypot(c.pos.x - u.x, c.pos.z - u.z) < u.r);   // só se a pisar (ao mesmo nível, sem saltar)
      if (q) { c.colorId = q.colorId; c.puddleCd = 1.0; this.cb.onColorChange?.(c, q.colorId, "puddle"); }
    }
    for (const p of this.projectiles) {
      if (!p.active) continue;
      const steps = Math.max(1, Math.ceil((CONFIG.weapon.projectileSpeed * dt) / 0.5)), h = dt / steps;
      for (let s = 0; s < steps && p.active; s++) {
        p.x += p.vx * h; p.y += p.vy * h; p.z += p.vz * h; p.life -= h;
        if (p.life <= 0 || Math.abs(p.x) > ARENA.halfX + 2 || Math.abs(p.z) > ARENA.halfZ + 2) { p.active = false; break; }
        if (p.y <= 0.1) {                                                       // chão: mancha de tinta
          this.splat(p.x, p.z, p.colorId, 0.7 + Math.random() * 0.6);
          this.burst(p.x, 0.2, p.z, p.colorId, 6); p.active = false; break;
        }
        for (const c of this.map.colliders) {
          if (!this._inside(c, p.x, p.z, 0)) continue;
          const top = topAt(c, p.x, p.z);
          if (p.y >= top || p.y < (c.bottom || 0)) continue;
          if (p.y - p.vy * h >= top - 0.05) this.splat(p.x, p.z, p.colorId, 0.7 + Math.random() * 0.6);   // caiu em cima de uma plataforma: pinta o topo
          this.burst(p.x, Math.max(p.y, top + 0.1), p.z, p.colorId, 7); p.active = false; break;
        }
        if (!p.active) break;
        for (const q of this.combatants) {
          if (!q.alive || q.team === p.owner.team || isProtected(q, t)) continue;
          if (Math.hypot(p.x - q.pos.x, p.z - q.pos.z) < q.radius + PROJ.radius && p.y >= q.pos.y && p.y <= q.pos.y + q.height) {
            if (p.hitIds && p.hitIds.has(q.id)) continue;
            this.hit(p.owner, q, p.colorId);
            if (p.pierce > 0) { p.pierce--; (p.hitIds ||= new Set()).add(q.id); continue; }       // melhoria: atravessa
            p.active = false; break;
          }
        }
      }
      if (p.mesh) { p.mesh.visible = p.active; if (p.active) p.mesh.position.set(p.x, p.y, p.z); }
    }
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i], G = CONFIG.grenade;
      g.t += dt; g.vy -= G.gravity * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
      const fl = floorAt(this.map.colliders, g.x, g.z, g.y);                // chão ou topo de uma plataforma por baixo da granada
      let boom = g.y <= fl + 0.2 || g.t > G.flight + 1;
      if (!boom) for (const c of this.map.colliders) if (g.y < topAt(c, g.x, g.z) && g.y >= (c.bottom || 0) && this._inside(c, g.x, g.z, 0)) { boom = true; break; }
      if (g.mesh) g.mesh.position.set(g.x, Math.max(g.y, fl + 0.2), g.z);
      if (boom) {
        g.y = floorAt(this.map.colliders, g.x, g.z, Math.max(g.y, 0) + 0.5); this.explodeGrenade(g);
        if (g.mesh) { this.group.remove(g.mesh); disposeMesh(g.mesh); }
        this.grenades.splice(i, 1);
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]; e.life -= dt;
      const k = 1 - e.life / e.max;
      e.mesh.scale.setScalar(Math.max(0.01, e.R * k)); e.mesh.material.opacity = Math.max(0, 0.8 * (1 - k));
      if (e.life <= 0) { this.group.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh.material.dispose(); this.effects.splice(i, 1); }
    }
    for (const q of this.particles) {
      if (!q.active) continue;
      q.life -= dt; q.vy -= 18 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.life <= 0 || q.y < 0) { q.active = false; q.mesh.visible = false; continue; }
      q.mesh.position.set(q.x, q.y, q.z);
    }
  }

  dispose() {
    if (this.group && this.group.parent) this.group.parent.remove(this.group);
    if (this.geo) { this.geo.dispose(); this.pgeo.dispose(); for (const m of this.mats.values()) m.dispose(); }
  }
}
