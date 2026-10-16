import * as THREE from "three";
import { topAt, floorAt, near } from "../movimento/surfaces.js";
import { CONFIG, ARENA, bodyHeight, aimY } from "../base/game-config.js";
import { COLORS, PRIMARIES, resolveHit, hitDamage } from "../base/colors.js";

/* ============================================================
   COMBATE (regras do jogo; os meshes são opcionais, por isso dá para testar em Node)
   - Projéteis de tinta com a cor da munição.
   - Cor certa (igual à cor do alvo) = eliminação direta. Cor errada = tira vida (4, ou 8 se o alvo for de cor
     misturada e o tiro for de uma das cores que a formam) e, se o alvo for primário, a cor dele muda pela tabela.
   - Sem fogo amigo. Quem é eliminado deixa uma poça da sua cor e reaparece 5 s depois, com 2 s de proteção.
   - Pisar uma poça muda a velocidade durante uns segundos: cores quentes dão velocidade, cores frias abrandam.
   - Cada combatente conta, no round, eliminações, mortes, tiros, acertos e tiros por cor (para o ecrã de fim de round).
   - Assistências: quem acertou (ou pintou com granada/armadilha) num adversário nos 6 s antes de um colega o eliminar.
   - Ao reaparecer fica branco (cor neutra, escondida) enquanto tem proteção; só depois se vê a cor.
   - Armadilhas de tinta: pousadas no chão, um adversário a menos de 2 m aciona-as e explodem 0,5 s depois (como uma granada pequena) e deixam uma poça da sua cor.
   - Clima: rangeMul (alcance dos tiros), sightMul (visão dos bots) e paintLifeMul (duração das poças).
   - Canhão de tinta: as bolas são granadas grandes (throwGrenade com opts), que só pintam adversários.
   Cada combatente: { id, team, index, isPlayer, pos{x,y,z}, hp, maxHp, colorId, alive, protectUntil, respawnAt, radius, height }
   Espelho (mirror = true, no PC de um convidado numa partida com amigos): os tiros e as granadas voam e pintam, mas não tiram
   vida nem mudam cores; eliminações, reaparecimentos, poças e armadilhas chegam do PC do anfitrião (ver net-game.js).
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
    this.projectiles = []; this.particles = []; this.grenades = []; this.effects = []; this.puddles = []; this.traps = [];
    this.cannons = [];                                                        // canhões de tinta do mapa (map-features.js), para os bots os encontrarem
    this.targets = [];                                                        // alvos do mapa (ex.: placas das pontes): { x, y, z, r, onHit(cor, quem) }
    this.rangeMul = 1; this.sightMul = 1; this.paintLifeMul = 1;
    this.mirror = false; this.trapSeq = 0;
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
    Object.assign(c, { maxHp: c.maxHp ?? CONFIG.health.max, protectUntil: c.protectUntil ?? 0, respawnAt: 0, radius: c.radius ?? 0.62 * CONFIG.player.scale, height: bodyHeight(c), kills: 0, deaths: 0, streak: 0, puddleMul: 1, puddleUntil: 0, carryMul: 1, assists: 0 });
    this.resetRoundStats(c);
    if (c.hp === undefined) c.hp = c.maxHp;
    if (c.alive === undefined) c.alive = true;
    this.combatants.push(c);
    return c;
  }

  resetRoundStats(c) { c.rs = { kills: 0, deaths: 0, assists: 0, shots: 0, hits: 0, colors: {}, killsSame: 0, grenadeKills: 0, grenades: 0, traps: 0, bestStreak: 0, dist: 0 }; c.streak = 0; }
  // regista quem tocou no alvo (para as assistências)
  _touch(target, by) { if (by && by.team !== target.team) (target.touchedBy ||= new Map()).set(by, this.t); }

  enemiesOf(c) { return this.combatants.filter((q) => q.alive && q.team !== c.team); }

  // Linha de visão: dos olhos de quem vê (ay + h) até ao alvo (by + hb). ay, by = altura dos pés: em cima de plataformas vê-se por cima dos muros
  los(ax, az, bx, bz, h = 1.3, ay = 0, by = 0, hb = h) {
    const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(d / 0.9));
    for (let i = 1; i < n; i++) {
      const x = ax + (dx * i) / n, z = az + (dz * i) / n, y = ay + h + ((by + hb - ay - h) * i) / n;
      for (const c of near(this.map.colliders, x, z)) if (y < topAt(c, x, z) && y >= (c.bottom || 0) && this._inside(c, x, z, 0.05)) return false;
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
      for (const c of near(this.map.colliders, x, z)) if (y < topAt(c, x, z) && y >= (c.bottom || 0) && this._inside(c, x, z, 0)) return { x, y, z, dist: k, kind: "obstacle" };
      for (const q of this.combatants) {
        if (!q.alive || q.team === ignoreTeam) continue;
        if (Math.hypot(x - q.pos.x, z - q.pos.z) < q.radius && y >= q.pos.y && y <= q.pos.y + q.height) return { x, y, z, dist: k, kind: "enemy", target: q };
      }
      for (const g of this.targets) if (Math.hypot(x - g.x, y - g.y, z - g.z) < g.r) return { x: g.x, y: g.y, z: g.z, dist: k, kind: "target" };
    }
    return { x: o.x + d.x * maxDist, y: o.y + d.y * maxDist, z: o.z + d.z * maxDist, dist: maxDist, kind: "none" };
  }

  fire(owner, origin, dir, colorId) {
    const p = this.projectiles.find((q) => !q.active);
    if (!p) return null;
    const l = Math.hypot(dir.x, dir.y, dir.z) || 1, sp = CONFIG.weapon.projectileSpeed;
    Object.assign(p, { active: true, x: origin.x, y: origin.y, z: origin.z, vx: (dir.x / l) * sp, vy: (dir.y / l) * sp, vz: (dir.z / l) * sp, life: (CONFIG.weapon.range * this.rangeMul) / sp, owner, colorId, pierce: owner.pierce || 0, hitIds: null });
    if (p.mesh) { p.mesh.material = this.mat(colorId); p.mesh.position.set(p.x, p.y, p.z); p.mesh.visible = true; }
    if (owner.rs) { owner.rs.shots++; owner.rs.colors[colorId] = (owner.rs.colors[colorId] || 0) + 1; }
    this.cb.onSound?.("shot", origin.x, origin.z, owner);
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

  splat(x, z, colorId, r, force = false, team = null) {                      // team: quem pintou (conta para as zonas de território)
    if (!this.paint || (!force && this.t - this.lastSplat < 0.07)) return;
    if ((this.map.waters || []).some((w) => x > w.minX && x < w.maxX && z > w.minZ && z < w.maxZ)) return;   // a tinta não fica a boiar no rio
    this.lastSplat = this.t;
    this.paint.splat(x, z, colorId, r, team);
  }

  // O tiro (da cor `shot`) acerta em `target`
  hit(owner, target, shot) {
    const r = resolveHit(shot, target.colorId);
    if (owner?.rs) owner.rs.hits++;
    this._touch(target, owner);
    this.burst(target.pos.x, aimY(target), target.pos.z, shot, 10);
    this.cb.onSound?.("hit", target.pos.x, target.pos.z, owner, target);
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
    target.rs.deaths++; target.streak = 0; target.puddleMul = 1; target.puddleUntil = 0;
    if (killer && killer.team !== target.team) {
      const r = killer.rs;
      killer.kills++; r.kills++; killer.streak++; r.bestStreak = Math.max(r.bestStreak, killer.streak);
      if (byColor) r.killsSame++;
      if (via === "grenade" || via === "trap" || via === "cannon") r.grenadeKills++;
      for (const [a, at] of target.touchedBy || []) {                                // assistências: colegas do eliminador que lhe acertaram nos últimos 6 s
        if (a === killer || a.team !== killer.team || this.t - at > 6) continue;
        a.assists++; a.rs.assists++;
        this.cb.onAssist?.(a, target, killer);
      }
    }
    target.touchedBy?.clear();
    this.splat(target.pos.x, target.pos.z, target.colorId, 2.2);                    // poça da cor do eliminado
    if (!this.mirror) this._addPuddle({ x: target.pos.x, y: target.pos.y, z: target.pos.z, r: 1.8, colorId: target.colorId, t: this.t });   // só estas poças (e as das armadilhas) mudam a cor de quem as pisa
    this.burst(target.pos.x, aimY(target), target.pos.z, target.colorId, 16);
    this.cb.onSound?.("elim", target.pos.x, target.pos.z, killer, target);
    this.cb.onKill?.(killer, target, shot, byColor, via);
  }

  // Poça que muda a cor de quem a pisa: leva um anel branco a pulsar, para não se confundir com a tinta dos tiros (que não faz nada)
  _addPuddle(q) {
    this.puddles.push(q);
    if (!this.scene) return;
    this.ringGeo ||= new THREE.RingGeometry(0.8, 1, 40);
    this.ringMat ||= new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    q.ring = new THREE.Mesh(this.ringGeo, this.ringMat);
    q.ring.rotation.x = -Math.PI / 2; q.ring.position.set(q.x, (q.y || 0) + 0.07, q.z); q.ring.scale.setScalar(q.r); q.ring.renderOrder = 2;   // por cima da camada de tinta
    this.group.add(q.ring);
  }

  // Granada de tinta: voa em arco até ao ponto (limitado ao alcance) e, ao cair, pinta todos os que estiverem na área da cor escolhida (adversários dessa cor são eliminados)
  // opts (canhão): { range, radius, via, size, enemiesOnly } — o tempo de voo cresce com a distância
  throwGrenade(owner, o, target, colorId, colorId2 = null, opts = null) {
    const G = CONFIG.grenade, range = opts?.range ?? G.range;
    let tx = target.x, tz = target.z;
    const dx = tx - owner.pos.x, dz = tz - owner.pos.z, d = Math.hypot(dx, dz);
    if (d > range) { tx = owner.pos.x + (dx / d) * range; tz = owner.pos.z + (dz / d) * range; }   // alcance máximo
    const T = opts ? 0.45 + Math.min(d, range) / 45 : G.flight;
    const gr = { x: o.x, y: o.y, z: o.z, vx: (tx - o.x) / T, vz: (tz - o.z) / T, vy: (0.2 - o.y + 0.5 * G.gravity * T * T) / T, t: 0, T, owner, colorId, colors: colorId2 && colorId2 !== colorId ? [colorId, colorId2] : [colorId], mesh: null,
                 radius: opts?.radius, via: opts?.via, enemiesOnly: !!opts?.enemiesOnly };
    if (this.scene) {
      gr.mesh = grenadeMesh(this.mat(colorId), gr.colors.length > 1 ? this.mat(gr.colors[1]) : null);          // 2 cores: metade de cada
      if (opts?.size) gr.mesh.scale.setScalar(opts.size);
      gr.mesh.position.set(gr.x, gr.y, gr.z); this.group.add(gr.mesh);
    }
    this.grenades.push(gr);
    this.cb.onSound?.(opts?.via === "cannon" ? "cannon" : "throw", o.x, o.z, owner);
    if (owner.rs && !opts) owner.rs.grenades++;
    return { x: tx, z: tz };
  }

  // opts.radius: área (as armadilhas são mais pequenas); opts.enemiesOnly: não pinta os colegas de quem a pôs
  explodeGrenade(g, opts = {}) {
    const R = opts.radius ?? g.radius ?? CONFIG.grenade.radius * (g.owner?.grenadeMul || 1) * (g.mul || 1), hit = [], via = g.via || "grenade";
    if (g.enemiesOnly) opts = { ...opts, enemiesOnly: true };
    this.burst(g.x, g.y + 0.8, g.z, g.colorId, 30);
    this.cb.onSound?.(g.via === "cannon" ? "bigBoom" : g.via === "trap" ? "trap" : "boom", g.x, g.z, g.owner);
    if (g.colors.length > 1) {                                                // 2 cores: duas manchas lado a lado
      this.burst(g.x, g.y + 0.8, g.z, g.colors[1], 30);
      this.splat(g.x - R * 0.32, g.z, g.colors[0], R * 0.62, true, g.owner?.team); this.splat(g.x + R * 0.32, g.z, g.colors[1], R * 0.62, true, g.owner?.team);
    } else this.splat(g.x, g.z, g.colorId, R * 0.92, true, g.owner?.team);
    if (this.scene) {                                                       // onda de choque
      const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: COLORS[g.colorId].hex, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(g.x, g.y + 0.08, g.z); this.group.add(m);
      this.effects.push({ mesh: m, life: 0.55, max: 0.55, R });
    }
    if (this.mirror) return hit;                                              // espelho: só se vê; quem é apanhado decide o anfitrião
    for (const c of this.combatants) {
      if (!c.alive || isProtected(c, this.t)) continue;
      if (Math.hypot(c.pos.x - g.x, c.pos.z - g.z) > R + c.radius * 0.5 || Math.abs(c.pos.y - g.y) > 2.6) continue;   // noutro nível (muito acima/abaixo): não apanha
      if (opts.enemiesOnly && g.owner && c.team === g.owner.team) continue;
      hit.push(c);
      this._touch(c, g.owner);
      if (g.colors.includes(c.colorId) && g.owner && c.team !== g.owner.team) { this.eliminate(c, g.owner, c.colorId, true, via); continue; }   // adversário já de uma das cores: eliminado
      const dmg = !g.owner || c.team === g.owner.team ? 0 : via === "cannon" ? CONFIG.cannon.wrongDamage : via === "grenade" ? CONFIG.grenade.wrongDamage : 0;
      if (dmg) {                                                              // adversário de outra cor: tira vida (e muda de cor, a seguir)
        c.hp = Math.max(0, c.hp - dmg);
        this.cb.onDamage?.(c, dmg, g.owner, g.colorId);
        if (c.hp <= 0) { this.eliminate(c, g.owner, g.colorId, false, via); continue; }
      }
      const nc = g.colors[Math.floor(Math.random() * g.colors.length)];
      if (c.colorId !== nc) { c.colorId = nc; this.cb.onColorChange?.(c, nc); }
    }
    this.cb.onGrenade?.(g.owner, g.x, g.z, g.colorId, hit, via);
    return hit;
  }

  // Armadilha de tinta: fica no chão (ativa ao fim de `arm` s); cada jogador só pode ter `maxPerOwner` (a mais antiga sai)
  placeTrap(owner, x, y, z, colorId) {
    const T = CONFIG.trap, mine = this.traps.filter((q) => q.owner === owner);
    if (mine.length >= T.maxPerOwner) this._removeTrap(mine[0]);
    const tr = { id: owner.id + ":" + ++this.trapSeq, x, y, z, colorId, owner, t: this.t, mesh: null };
    if (this.scene) {
      this.trapGeo ||= new THREE.CylinderGeometry(0.6, 0.7, 0.12, 20);
      tr.mesh = new THREE.Mesh(this.trapGeo, this.mat(colorId)); tr.mesh.position.set(x, y + 0.07, z); this.group.add(tr.mesh);
    }
    this.traps.push(tr);
    if (owner.rs) owner.rs.traps++;
    return tr;
  }
  _removeTrap(tr) {
    if (tr.mesh) this.group.remove(tr.mesh);
    this.traps = this.traps.filter((q) => q !== tr);
  }
  _updateTraps(t) {
    const T = CONFIG.trap;
    for (const tr of [...this.traps]) {
      if (t - tr.t > T.life) { this._removeTrap(tr); continue; }
      if (t - tr.t < T.arm) continue;
      if (tr.fuseAt) {                                                         // acionada: explode ao fim do aviso, apanhe quem apanhar
        if (t < tr.fuseAt) continue;
        this._removeTrap(tr);
        this._addPuddle({ x: tr.x, y: tr.y, z: tr.z, r: T.radius * 0.6, colorId: tr.colorId, t });   // poça da armadilha: muda a cor (e a velocidade) de quem a pisa, como a dos eliminados
        this.explodeGrenade({ x: tr.x, y: tr.y, z: tr.z, colorId: tr.colorId, colors: [tr.colorId], owner: tr.owner, via: "trap" }, { radius: T.radius, enemiesOnly: true });
        continue;
      }
      const victim = this.combatants.find((c) => c.alive && c.team !== tr.owner.team && !isProtected(c, t) &&
        Math.hypot(c.pos.x - tr.x, c.pos.z - tr.z) < T.trigger && Math.abs(c.pos.y - tr.y) < 1.5);
      if (!victim) continue;
      tr.fuseAt = t + T.fuse;                                                  // aviso: fica visível a piscar e dá tempo (pouco) para fugir
      this.cb.onTrapTriggered?.(tr, victim);
    }
  }

  heal(c, amount) {
    if (!c.alive || c.hp >= c.maxHp) return 0;
    const before = c.hp;
    c.hp = Math.min(c.maxHp, c.hp + amount);
    return c.hp - before;
  }

  respawn(c, s = null, colorId = null) {                                         // (s e colorId: vindos do anfitrião, numa partida com amigos)
    const list = this.map.spawns[c.team];
    s ||= list[Math.floor(Math.random() * list.length)];                     // reaparece num dos 5 lugares da base
    c.alive = true; c.deadT = 0; c.hp = c.maxHp; c.colorId = colorId || PRIMARIES[Math.floor(Math.random() * PRIMARIES.length)];
    c.pos.x = s.x; c.pos.z = s.z; c.pos.y = 0; c._lp = null;
    c.protectUntil = this.t + CONFIG.respawn.protection;
    c.neutral = c.protectUntil > this.t;                                       // branco enquanto está protegido: os adversários não sabem a cor
    this.cb.onRespawn?.(c, s);
  }

  resetAll() {                                                                 // novo round: todos voltam às bases, com vida cheia
    for (const p of this.projectiles) { p.active = false; if (p.mesh) p.mesh.visible = false; }
    for (const g of this.grenades) if (g.mesh) { this.group.remove(g.mesh); disposeMesh(g.mesh); }
    for (const tr of [...this.traps]) this._removeTrap(tr);
    for (const q of this.puddles) if (q.ring) this.group.remove(q.ring);
    this.grenades = []; this.puddles = [];
    for (const c of this.combatants) { if (!this.mirror) this.respawn(c); this.resetRoundStats(c); c.puddleMul = 1; c.puddleUntil = 0; }
  }

  update(dt, t) {
    this.t = t;
    for (const c of this.combatants) {
      if (!c.alive && t >= c.respawnAt && !this.mirror) this.respawn(c);
      c.height = bodyHeight(c);                                                 // agachado: mais baixo (mais difícil de acertar)
      if (c.neutral && t >= c.protectUntil) { c.neutral = false; this.cb.onReveal?.(c); }   // acabou a proteção: a cor aparece
      if (c.alive) {                                                            // distância percorrida (para os destaques do fim do jogo)
        if (c._lp) { const d = Math.hypot(c.pos.x - c._lp.x, c.pos.z - c._lp.z); if (d < 3) c.rs.dist += d; }
        if (c._lp) { c._lp.x = c.pos.x; c._lp.z = c.pos.z; } else c._lp = { x: c.pos.x, z: c.pos.z };
      }
    }
    if (!this.mirror) this._updateTraps(t);
    // poças deixadas por jogadores eliminados e por armadilhas: quem as pisa fica da cor da poça (as manchas normais dos tiros e granadas não fazem nada)
    this.puddles = this.puddles.filter((q) => {
      if (q.life === Infinity || t - q.t < CONFIG.paint.lifeSeconds * this.paintLifeMul) return true;   // (as poças que andam no Estúdio não acabam)
      if (q.ring) this.group.remove(q.ring);
      return false;
    });
    if (this.ringMat) this.ringMat.opacity = 0.7 + 0.3 * Math.sin(t * 5);                    // os anéis pulsam
    const PF = CONFIG.puddleFx;
    for (const c of this.combatants) {
      if (!c.alive || this.mirror) continue;
      if (c.puddleUntil && t >= c.puddleUntil) { c.puddleMul = 1; c.puddleUntil = 0; }
      const on = (u) => Math.abs(c.pos.y - (u.y || 0)) < 0.2 && Math.hypot(c.pos.x - u.x, c.pos.z - u.z) < u.r;   // só se a pisar (ao mesmo nível, sem saltar)
      const fx = this.puddles.find(on);
      if (fx) {                                                                   // velocidade da poça: dura uns segundos depois de sair dela
        const mul = PF.speed[fx.colorId] ?? 1, fresh = c.puddleMul !== mul;
        c.puddleMul = mul; c.puddleUntil = t + PF.seconds;
        if (fresh && mul !== 1) this.cb.onPuddleFx?.(c, fx.colorId, mul);
      }
      c.puddleCd = (c.puddleCd || 0) - dt;
      if (c.puddleCd > 0) continue;
      const q = this.puddles.find((u) => u.colorId !== c.colorId && on(u));
      if (q) { c.colorId = q.colorId; c.puddleCd = 1.0; this.cb.onColorChange?.(c, q.colorId, "puddle"); }
    }
    for (const p of this.projectiles) {
      if (!p.active) continue;
      const steps = Math.max(1, Math.ceil((CONFIG.weapon.projectileSpeed * dt) / 0.5)), h = dt / steps;
      for (let s = 0; s < steps && p.active; s++) {
        p.x += p.vx * h; p.y += p.vy * h; p.z += p.vz * h; p.life -= h;
        if (p.life <= 0 && Math.abs(p.x) < ARENA.halfX && Math.abs(p.z) < ARENA.halfZ) {   // fim do alcance: a tinta cai no chão (ou no topo da plataforma por baixo)
          this.splat(p.x, p.z, p.colorId, 0.55 + Math.random() * 0.35, false, p.owner.team); p.active = false; break;
        }
        if (p.life <= 0 || Math.abs(p.x) > ARENA.halfX + 2 || Math.abs(p.z) > ARENA.halfZ + 2) { p.active = false; break; }
        if (p.y <= 0.1) {                                                       // chão: mancha de tinta
          this.splat(p.x, p.z, p.colorId, 0.7 + Math.random() * 0.6, false, p.owner.team);
          this.burst(p.x, 0.2, p.z, p.colorId, 6); p.active = false; break;
        }
        for (const c of near(this.map.colliders, p.x, p.z)) {
          if (!this._inside(c, p.x, p.z, 0)) continue;
          const top = topAt(c, p.x, p.z);
          if (p.y >= top || p.y < (c.bottom || 0)) continue;
          if (p.y - p.vy * h >= top - 0.05) this.splat(p.x, p.z, p.colorId, 0.7 + Math.random() * 0.6, false, p.owner.team);   // caiu em cima de uma plataforma: pinta o topo
          this.burst(p.x, Math.max(p.y, top + 0.1), p.z, p.colorId, 7); p.active = false; break;
        }
        if (!p.active) break;
        for (const g of this.targets) if (Math.hypot(p.x - g.x, p.y - g.y, p.z - g.z) < g.r + PROJ.radius) { this.burst(p.x, p.y, p.z, p.colorId, 6); if (!this.mirror) g.onHit(p.colorId, p.owner); p.active = false; break; }
        if (!p.active) break;
        for (const q of this.combatants) {
          if (!q.alive || q.team === p.owner.team || isProtected(q, t)) continue;
          if (Math.hypot(p.x - q.pos.x, p.z - q.pos.z) < q.radius + PROJ.radius && p.y >= q.pos.y && p.y <= q.pos.y + q.height) {
            if (p.hitIds && p.hitIds.has(q.id)) continue;
            if (this.mirror) { this.burst(p.x, p.y, p.z, p.colorId, 6); this.cb.onSound?.("hit", q.pos.x, q.pos.z, p.owner, q); p.active = false; break; }   // espelho: o salpico vê-se, o dano vem do anfitrião
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
      let boom = g.y <= fl + 0.2 || g.t > (g.T || G.flight) + 1;
      if (!boom) for (const c of near(this.map.colliders, g.x, g.z)) if (g.y < topAt(c, g.x, g.z) && g.y >= (c.bottom || 0) && this._inside(c, g.x, g.z, 0)) { boom = true; break; }
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
    this.updateParticles(dt);
  }

  // Salpicos (também usado pela repetição da melhor jogada, que não corre o resto do combate)
  updateParticles(dt) {
    for (const q of this.particles) {
      if (!q.active) continue;
      q.life -= dt; q.vy -= 18 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.life <= 0 || q.y < 0) { q.active = false; q.mesh.visible = false; continue; }
      q.mesh.position.set(q.x, q.y, q.z);
    }
  }

  dispose() {
    if (this.group && this.group.parent) this.group.parent.remove(this.group);
    if (this.geo) { this.geo.dispose(); this.pgeo.dispose(); this.trapGeo?.dispose(); this.ringGeo?.dispose(); this.ringMat?.dispose(); for (const m of this.mats.values()) m.dispose(); }
  }
}
