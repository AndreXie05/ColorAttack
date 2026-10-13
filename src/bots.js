import { MOTION, createMotionState, stepMotion, collisionFeedback } from "./player-motion.js";
import { resolveCollisions } from "./collisions.js";
import { floorAt, ceilingAt, jumpableAhead, ladderState, ladderAt, hugLadder, surfaceEffects, inside, topAt, standingOn, inWater } from "./surfaces.js";
import { animateCharacter, visualY } from "./character-animator.js";
import { CONFIG, BOT_PRESETS, aimY, eyeY, muzzleY, BODY_H } from "./game-config.js";
import { COLORS, PRIMARIES, ingredients, paletteColors } from "./colors.js";

/* ============================================================
   BOTS
   Patrulham o mapa (defensores na metade da sua base, atacantes por todo o lado). Quando veem um adversário
   (linha de visão livre) depois do tempo de reação viram-se para ele, mantêm a distância, andam de lado e
   disparam com imprecisão. Escolhem a cor certa para o alvo (às vezes enganam-se, conforme a dificuldade em
   o preset da dificuldade em BOT_PRESETS). Desviam-se uns dos outros e destravam sozinhos se ficarem presos.
   Também apanham itens e usam cura, granadas, invisibilidade e armadilhas conforme a dificuldade (ver BOT_PRESETS),
   correm para o baú dourado quando aparece, usam os canhões de tinta e seguem os objetivos do mapa (lata, zonas; map-features.js).
   Cada bot é também um "combatente" (hp, cor, vivo/morto...) para o CombatWorld.
   ============================================================ */
const rand = (a, b) => a + Math.random() * (b - a);
const lad0 = (b) => b.motion.climbing;
const STEP_SAFE = 1.2;                                                   // desnível que um bot aceita ao procurar a descida

export class Bot {
  constructor({ team, index, characterId, model, pos, facing, role, colorId, difficulty = "media", passive = false }) {
    this.cfg = BOT_PRESETS[difficulty] || BOT_PRESETS.media; this.difficulty = difficulty;
    this.passive = passive; this.home = { x: pos.x, z: pos.z };                  // passivo = alvo parado (tutorial)
    this.team = team; this.index = index; this.characterId = characterId; this.model = model;
    this.id = team + index; this.isPlayer = false;
    this.role = role; this.colorId = colorId;
    this.pos = { x: pos.x, y: 0, z: pos.z };
    this.motion = createMotionState();
    this.facing = facing;
    this.target = { x: pos.x, z: pos.z };
    this.wait = rand(0.3, 1.5);
    this.stuck = 0; this.running = false; this.jump = false;
    // combate
    this.enemy = null; this.thinkCd = rand(0, 0.2); this.seen = 0; this.fireCd = rand(0.2, 0.8);
    this.strafe = Math.random() < 0.5 ? 1 : -1; this.strafeT = rand(0.5, 1.5);
    this.shotColor = null; this.shotFor = null;
    // munição própria: tanques por cor primária, que recarregam devagar e se enchem com as caixas que apanham
    this.ammo = { vermelho: CONFIG.ammo.start, azul: CONFIG.ammo.start, amarelo: CONFIG.ammo.start };
    this.openCd = 0;
    this.items = { health: 0, grenade: 0, invisible: 0, trap: 0 };
    this.mounted = null; this.cannonGoal = null; this.cannonGoalT = 0;            // canhão em que está / para onde vai this.invisibleT = 0; this.itemCd = rand(0.5, 1.5); this.grenadeCd = 0;
    this._ePrev = null; this._vel = { x: 0, z: 0 };
  }

  get hidden() { return this.invisibleT > 0; }

  // melhorias dos bots (as mesmas do jogador que fazem sentido para eles): cadência, velocidade, vida, tiro que atravessa e dano duplo
  applyUpgrades(lv) {
    this.upg = lv;
    this.fireMul = Math.pow(0.8, lv.rate || 0);
    this.speedMul = Math.pow(1.1, lv.speed || 0);
    this.maxHp = 100 + 25 * (lv.hp || 0);
    this.pierce = lv.pierce || 0;
    this.damageMul = lv.damage ? 2 : 1;
  }
  _speedCfg() {
    const k = (this.speedMul || 1) * (this.puddleMul || 1) * (this.carryMul || 1);   // poça pisada: mais rápido ou mais lento; com a lata às costas: mais lento
    if (k === 1 && !this.crouching) return MOTION;
    this._sc = this._sc || { ...MOTION };
    this._sc.walk = (this.crouching ? CONFIG.player.crouchWalk : MOTION.walk) * k; this._sc.run = (this.crouching ? CONFIG.player.crouchWalk : MOTION.run) * k;
    return this._sc;
  }

  // Há um murete baixo (que tapa um boneco agachado, mas não um de pé) entre mim e o adversário, mesmo à minha frente?
  _lowCoverToward(map, e) {
    const p = this.pos, dx = e.pos.x - p.x, dz = e.pos.z - p.z, d = Math.hypot(dx, dz) || 1;
    for (const k of [0.8, 1.3, 1.8]) {
      const x = p.x + (dx / d) * k, z = p.z + (dz / d) * k;
      for (const c of map.colliders) {
        if (!inside(c, x, z, 0)) continue;
        const h = topAt(c, x, z) - p.y;
        if (h > BODY_H * 0.45 && h < BODY_H * 0.75) return true;
      }
    }
    return false;
  }

  get lowAmmo() { return PRIMARIES.reduce((s, c) => s + this.ammo[c], 0) < this.cfg.lowAmmoAt; }
  affordable(color) { return ingredients(color).every((c) => this.ammo[c] >= 1); }
  spend(color) { for (const c of ingredients(color)) this.ammo[c] -= 1; }

  // Com pouca munição vai buscar caixas caídas ou abre o baú mais próximo
  _resupply(map, world) {
    const sv = world.services, p = this.pos;
    if (!sv) return false;
    const a = sv.pickups.nearestAmmo(p, 28);
    if (a) { this.target = { x: a.x, z: a.z }; return true; }
    let best = null, bd = 1e9;
    for (const c of map.chests) {
      if (c.state !== "ready") continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) return false;
    this.target = { x: best.x, z: best.z };
    if (bd < 3.0 && this.openCd <= 0) { sv.openChest(this, best); this.openCd = 2; }
    return true;
  }

  onRespawn() {                                              // chamado quando reaparece
    this.motion = createMotionState(); this.enemy = null; this.seen = 0; this.stuck = 0;
    this.wait = rand(0.3, 1.0); this.target = { x: this.pos.x, z: this.pos.z };
    this.invisibleT = 0; this.mounted = null; this.cannonGoal = null;
    if (this.passive) { this.pos.x = this.home.x; this.pos.z = this.home.z; }       // alvo do tutorial: volta ao seu lugar
  }

  // Escolhe o próximo ponto de patrulha
  pickTarget(map) {
    const pts = map.patrol;
    const side = this.team === "A" ? -1 : 1;                           // A defende x < 0, B defende x > 0
    let pool = pts;
    if (this.role === "defend") {
      const own = pts.filter((p) => p.x * side > 12);
      if (own.length) pool = own;
    } else if (Math.random() < 0.3) {
      const enemy = map.spawns[this.team === "A" ? "B" : "A"];       // de vez em quando vai à base adversária
      pool = enemy.map((s) => ({ x: s.x + side * 6, z: s.z }));
    }
    const p = pool[Math.floor(Math.random() * pool.length)];
    this.target = { x: p.x + rand(-1.5, 1.5), z: p.z + rand(-1.5, 1.5) };
    this.running = Math.random() < 0.45;
  }

  // Adversário que escolhe atacar: o mais próximo que vê; os mais espertos atacam em grupo o mesmo alvo e preferem os feridos
  _pickEnemy(world) {
    const p = this.pos, cfg = this.cfg;
    let best = null, bs = -1e9;
    for (const e of world.enemiesOf(this)) {
      const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
      if (d >= cfg.sight * (world.sightMul || 1)) continue;                 // nevoeiro: veem menos longe
      if (e.hidden && d > 4) continue;                          // invisível: só o veem de muito perto
      if (!world.los(p.x, p.z, e.pos.x, e.pos.z, BODY_H * 0.7, p.y, e.pos.y, aimY(e) - e.pos.y)) continue;
      let score = -d;
      if (cfg.smart >= 2) {
        const mates = world.combatants.filter((c) => c.team === this.team && c !== this && c.alive && c.enemy === e).length;
        score += mates * 7;                                      // ataca em grupo
        if (cfg.smart >= 3) score += (1 - e.hp / e.maxHp) * 18;  // e acaba os feridos
      }
      if (score > bs) { bs = score; best = e; }
    }
    return best;
  }

  // ---- itens: cura, invisibilidade e granada (o quão bem depende da dificuldade) ----
  _useItems(world) {
    const cfg = this.cfg, mode = cfg.items, e = this.enemy, p = this.pos, hpF = this.hp / this.maxHp;
    const ed = e ? Math.hypot(e.pos.x - p.x, e.pos.z - p.z) : 1e9, seen = e && world.los(p.x, p.z, e.pos.x, e.pos.z, BODY_H * 0.7, p.y, e.pos.y, aimY(e) - e.pos.y);
    if (this.items.health > 0 && this.hp < this.maxHp) {
      const use = mode === "random" ? Math.random() < 0.12
        : mode === "some" ? hpF < 0.6 && Math.random() < 0.6
        : mode === "smart" ? hpF < 0.5 || (!e && hpF < 0.8)
        : (hpF <= 0.6 && !seen) || hpF <= 0.45;
      if (use) { world.heal(this, CONFIG.health.cure); this.items.health--; }
    }
    if (this.items.invisible > 0 && this.invisibleT <= 0) {
      const use = mode === "random" ? Math.random() < 0.04
        : mode === "some" ? !!e && hpF < 0.5 && Math.random() < 0.4
        : mode === "smart" ? (!!e && hpF < 0.5) || (!!e && ed > 10 && Math.random() < 0.15)
        : (!!e && ed > 9) || (!!e && hpF < 0.4);
      if (use) { this.invisibleT = CONFIG.rewards.find((r) => r.id === "invisible").duration; this.items.invisible--; }
    }
    if (this.items.grenade > 0 && this.grenadeCd <= 0 && e) {
      const R = CONFIG.grenade.range, okRange = ed < R * 0.95 && ed > 3.5;
      const use = mode === "random" ? ed < R && Math.random() < 0.1
        : mode === "some" ? okRange && ed < 16 && !!seen && Math.random() < 0.25
        : okRange && !!seen && !this._allyNear(world, e);
      if (use) this._throwGrenade(world, e, mode);
    }
    if (this.items.trap > 0 && !e) {                              // armadilha: pousa-a enquanto patrulha (os espertos com a cor mais comum dos adversários)
      const use = mode === "random" ? Math.random() < 0.05 : mode === "some" ? Math.random() < 0.1 : Math.random() < 0.2;
      if (use) {
        let col = PRIMARIES[Math.floor(Math.random() * PRIMARIES.length)];
        if (mode === "smart" || mode === "perfect") {
          const n = {}; for (const q of world.enemiesOf(this)) n[q.colorId] = (n[q.colorId] || 0) + 1;
          const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0]; if (top) col = top[0];
        }
        world.placeTrap(this, p.x, p.y, p.z, col); this.items.trap--;
      }
    }
  }
  _allyNear(world, e) {
    const r = CONFIG.grenade.radius;
    return world.combatants.some((c) => c.team === this.team && c !== this && c.alive && Math.hypot(c.pos.x - e.pos.x, c.pos.z - e.pos.z) < r);
  }
  _throwGrenade(world, e, mode) {
    const p = this.pos, all = paletteColors(), T = CONFIG.grenade.flight;
    let col = e.colorId, col2 = null, spread = 1.2, lead = 0;
    if (mode === "random") { col = all[Math.floor(Math.random() * all.length)]; spread = 6; }
    else if (mode === "some") { if (Math.random() > 0.4) col = all[Math.floor(Math.random() * all.length)]; spread = 3; }
    else if (mode === "perfect") {
      spread = 0.3; lead = 1;
      const other = world.enemiesOf(this).find((f) => f !== e && f.colorId !== e.colorId && Math.hypot(f.pos.x - e.pos.x, f.pos.z - e.pos.z) < CONFIG.grenade.radius * 0.9);
      if (other) col2 = other.colorId;                           // duas cores na mesma granada: apanha os dois
    }
    const tx = e.pos.x + this._vel.x * T * lead + rand(-spread, spread), tz = e.pos.z + this._vel.z * T * lead + rand(-spread, spread);
    const yaw = Math.atan2(tx - p.x, tz - p.z);
    world.throwGrenade(this, { x: p.x + Math.sin(yaw) * 0.8, y: 1.5, z: p.z + Math.cos(yaw) * 0.8 }, { x: tx, z: tz }, col, col2);
    this.items.grenade--; this.grenadeCd = mode === "perfect" ? 2 : 4;
    if (this.invisibleT > 0) this.invisibleT = 0;
  }

  _shoot(world) {
    const p = this.pos, e = this.enemy, cfg = this.cfg;
    if (this.invisibleT > 0) this.invisibleT = 0;                 // disparar revela
    this.crouching = false;                                       // levanta-se para disparar (espreitar por cima da cobertura)
    const o = { x: p.x + Math.sin(this.facing) * 0.75, y: muzzleY(this), z: p.z + Math.cos(this.facing) * 0.75 };
    if (this.shotFor !== e.colorId || !this.shotColor) {         // escolhe a cor: certa com a probabilidade da dificuldade
      this.shotFor = e.colorId;
      const chance = (PRIMARIES.includes(e.colorId) ? cfg.correctColorChance : cfg.correctSecondaryChance) * (world.secret ? 0.5 : 1);   // cor misturada é mais difícil de adivinhar; Cores Secretas: metade
      const wrong = PRIMARIES.filter((c) => c !== e.colorId);                                          // um palpite errado nunca é, sem querer, a cor certa
      this.shotColor = Math.random() < chance ? e.colorId : wrong[Math.floor(Math.random() * wrong.length)];
    }
    if (!this.affordable(this.shotColor)) {                       // sem tinta dessa cor: usa uma que tenha
      const have = PRIMARIES.filter((c) => this.ammo[c] >= 1);
      if (!have.length) { this.fireCd = 0.8; return; }
      this.shotColor = have[Math.floor(Math.random() * have.length)]; this.shotFor = null;
    }
    this.spend(this.shotColor);
    const gm = this.model && this.model.userData && this.model.userData.gunMat;   // a pistola toma a cor do tiro
    if (gm) { gm.color.setHex(COLORS[this.shotColor].hex); gm.emissive.setHex(COLORS[this.shotColor].hex).multiplyScalar(0.25); }
    const lead = (Math.hypot(e.pos.x - o.x, e.pos.z - o.z) / CONFIG.weapon.projectileSpeed) * (cfg.lead || 0);   // antecipa o movimento do alvo
    let vx = e.pos.x + this._vel.x * lead - o.x, vz = e.pos.z + this._vel.z * lead - o.z;
    const vy0 = aimY(e) - o.y, dist = Math.hypot(vx, vz);
    const err = ((cfg.aimErrorDeg * Math.PI) / 180) * (Math.random() * 2 - 1), c = Math.cos(err), s = Math.sin(err);
    [vx, vz] = [vx * c - vz * s, vx * s + vz * c];
    const vy = vy0 + (Math.random() - 0.5) * 0.05 * dist;
    world.fire(this, o, { x: vx, y: vy, z: vz }, this.shotColor);
  }

  // agents = lista de { pos } (jogador e bots) para manter distância; world = CombatWorld (opcional)
  update(dt, t, map, agents, world) {
    if (!this.alive) return;
    const p = this.pos, cfg = this.cfg;
    this._t = world ? world.t : t;
    if (this.mounted) {                                                         // no canhão: fica parado no assento, virado para onde o canhão aponta (é o canhão que dispara)
      const m = this.mounted;
      p.x = m.x; p.z = m.z; p.y = m.top; Object.assign(this.motion, { vx: 0, vz: 0, vy: 0, onGround: true });
      this.facing = m.yaw; this.crouching = false;
      if (this.model) {
        this.model.position.set(p.x, visualY(this.model, p.y, true, dt), p.z); this.model.rotation.y = this.facing;
        animateCharacter(this.model, { speed: 0, maxSpeed: MOTION.run, onGround: true, vy: 0, landed: false, impact: 0, climbing: false, crouching: false }, dt, t);
      }
      return;
    }
    let dx = 0, dz = 0, engaged = false, faceYaw = null;
    this.openCd -= dt; this.grenadeCd -= dt;
    if (this.invisibleT > 0) this.invisibleT -= dt;
    for (const c of PRIMARIES) this.ammo[c] = Math.min(CONFIG.ammo.max, this.ammo[c] + CONFIG.ammo.regen * dt);

    // --- combate: procurar e atacar ---
    if (world && !this.passive) {
      this.fireCd -= dt; this.thinkCd -= dt; this.itemCd -= dt;
      if (this.itemCd <= 0) { this.itemCd = cfg.items === "random" ? 0.9 : 0.4; this._useItems(world); }
      if (this.thinkCd <= 0) {
        this.thinkCd = 0.2;
        const e = this._pickEnemy(world);
        if (e !== this.enemy) { this.seen = 0; this._ePrev = null; }
        this.enemy = e;
        if (e) {                                                  // velocidade do alvo (para antecipar)
          if (this._ePrev) { const k = 1 / 0.2; this._vel = { x: (e.pos.x - this._ePrev.x) * k, z: (e.pos.z - this._ePrev.z) * k }; }
          this._ePrev = { x: e.pos.x, z: e.pos.z };
        }
      }
      if (this.enemy && !this.enemy.alive) this.enemy = null;
      if (this.enemy) {
        engaged = true;
        const e = this.enemy, ex = e.pos.x - p.x, ez = e.pos.z - p.z, ed = Math.max(Math.hypot(ex, ez), 1e-6), nx = ex / ed, nz = ez / ed;
        this.seen += dt;
        const stealth = this.invisibleT > 0 && cfg.smart >= 2;       // invisível: aproxima-se para surpreender
        if (stealth && ed > 6) { dx = nx; dz = nz; }
        const range = Math.min(cfg.range, CONFIG.weapon.range * (world.rangeMul || 1) - 1.5);   // nevoeiro: o alcance é menor, aproximam-se mais
        if (stealth && ed > 6) { /* já vai em frente */ } else if (ed > range + 4) { dx = nx; dz = nz; } else if (ed < range - 5) { dx = -nx; dz = -nz; }
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = cfg.smart >= 3 ? rand(0.3, 1.0) : cfg.smart >= 2 ? rand(0.5, 1.4) : rand(0.8, 2.0); }
        dx += -nz * this.strafe * 0.8 * cfg.strafeMul; dz += nx * this.strafe * 0.8 * cfg.strafeMul;
        const go = world.objective ? world.objective(this) : null;                     // lata de tinta: continua a avançar para o objetivo enquanto dispara
        if (go && go.push) {
          const ox = go.x - p.x, oz = go.z - p.z, od = Math.hypot(ox, oz) || 1;
          dx = dx * 0.35 + (ox / od) * 1.2; dz = dz * 0.35 + (oz / od) * 1.2; this.running = true;
        }
        if (cfg.smart >= 3 && this.motion.onGround && Math.random() < dt * 0.7) this.jump = true;   // salta para ser difícil de acertar
        this.running = false;
        faceYaw = Math.atan2(ex, ez);
        const canFire = !stealth || ed <= 8;
        if (canFire && this.seen >= cfg.reaction && this.fireCd <= 0 && world.los(p.x, p.z, e.pos.x, e.pos.z, BODY_H * 0.7, p.y, e.pos.y, aimY(e) - e.pos.y)) {
          this._shoot(world);
          this.fireCd = cfg.fireInterval * rand(0.8, 1.35) * (this.fireMul || 1);
        }
      }
    }

    // --- patrulha ---
    if (!engaged && !this.passive) {
      let tx = this.target.x - p.x, tz = this.target.z - p.z, dist = Math.hypot(tx, tz);
      if (dist < 2.2 || this.stuck > 0.8) {
        const arrived = dist < 2.2;
        this.pickTarget(map);
        this.stuck = 0;
        if (arrived) this.wait = rand(0.2, 1.4);
      }
      const gold = world && world.services && cfg.smart >= 1 ? map.chests.find((c) => c.golden && Math.hypot(c.x - p.x, c.z - p.z) < 45) : null;
      const cg = this.cannonGoal;
      if (cg && (!cg.ready() || (this.cannonGoalT -= dt) <= 0)) this.cannonGoal = null;      // alguém chegou primeiro (ou demorou demais)
      const obj = world && !gold && !this.cannonGoal && world.objective ? world.objective(this) : null;   // objetivo do mapa (lata de tinta, zonas de território)
      if (this.cannonGoal) {                                                            // vai para o canhão e sobe para ele
        this.target = { x: cg.x, z: cg.z }; this.wait = 0; this.running = true;
        if (Math.hypot(cg.x - p.x, cg.z - p.z) < 1.6) { cg.mount(this); this.cannonGoal = null; }
      } else if (obj) {
        this.target = { x: obj.x, z: obj.z }; this.wait = 0; this.running = obj.run !== false;
      } else if (gold) {                                                                     // baú dourado: corre para lá e abre-o
        this.target = { x: gold.x, z: gold.z }; this.wait = 0; this.running = true;
        if (Math.hypot(gold.x - p.x, gold.z - p.z) < 3 && this.openCd <= 0) { world.services.openChest(this, gold); this.openCd = 2; }
      } else if (world && this.lowAmmo && this._resupply(map, world)) this.wait = Math.min(this.wait, 0);   // pouca munição: vai buscar mais
      else if (world && world.services) {                                   // itens caídos por perto
        const it = world.services.pickups.nearestItem?.(p, cfg.itemSeek);
        if (it) { this.target = { x: it.x, z: it.z }; this.wait = Math.min(this.wait, 0); }
      }
      tx = this.target.x - p.x; tz = this.target.z - p.z; dist = Math.hypot(tx, tz);
      this.wait -= dt;
      if (this.wait <= 0) { dx = tx / Math.max(dist, 1e-6); dz = tz / Math.max(dist, 1e-6); }
    }
    if (world && !this.passive && cfg.smart >= 2 && world.puddles) {          // foge das poças que mudariam a sua cor
      for (const q of world.puddles) {
        if (q.colorId === this.colorId) continue;
        const ox = p.x - q.x, oz = p.z - q.z, d = Math.hypot(ox, oz);
        if (d < q.r + 1.6 && d > 0.01) { dx += (ox / d) * 1.4; dz += (oz / d) * 1.4; }
      }
    }
    if (world && !this.passive && world.traps) {                               // armadilha acionada perto: foge dela
      for (const tr of world.traps) {
        if (!tr.fuseAt || tr.owner.team === this.team) continue;
        const ox = p.x - tr.x, oz = p.z - tr.z, d = Math.hypot(ox, oz);
        if (d < CONFIG.trap.radius + 1 && d > 0.01) { dx += (ox / d) * 3; dz += (oz / d) * 3; this.running = true; }
      }
    }
    // afasta-se dos outros
    for (const a of agents) {
      if (a.pos === p) continue;
      const ox = p.x - a.pos.x, oz = p.z - a.pos.z, d = Math.hypot(ox, oz);
      if (d > 0.01 && d < 1.8) { dx += (ox / d) * (1.8 - d) * 0.9; dz += (oz / d) * (1.8 - d) * 0.9; }
    }
    const dl = Math.hypot(dx, dz);
    if (dl > 1) { dx /= dl; dz /= dl; }
    const wantsMove = dl > 0.05;
    // lá em cima e preso (ex.: varanda de uma torre rodeada de quedas): procura a descida a andar (rampa / degraus) e segue-a
    if (this.escapeT > 0) { this.escapeT -= dt; dx = this.escape.x; dz = this.escape.z; }
    else if (p.y > 2.5 && this.stuck > 0.6 && this.motion.onGround) {
      let best = null, bestH = p.y;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4, ex = Math.cos(a), ez = Math.sin(a);
        const f1 = floorAt(map.colliders, p.x + ex * 0.9, p.z + ez * 0.9, p.y), f2 = floorAt(map.colliders, p.x + ex * 1.8, p.z + ez * 1.8, f1);
        if (p.y - f1 > STEP_SAFE || f1 - f2 > STEP_SAFE) continue;                   // sem quedas pelo caminho
        if (f2 < bestH - 0.1) { bestH = f2; best = { x: ex, z: ez }; }
      }
      if (best) { this.escape = best; this.escapeT = 1.2; this.stuck = 0; dx = best.x; dz = best.z; }
    }
    // preso contra uma parede: contorna-a de lado durante um bocado (em vez de ficar a empurrar)
    if (this.escapeT > 0) { /* a descer: sem desvios */ } else if (this.detourT > 0) {
      this.detourT -= dt;
      const sg = this.detourSign, ndx = -dz * sg, ndz = dx * sg;
      dx = dx * 0.25 + ndx; dz = dz * 0.25 + ndz;
      const l2 = Math.hypot(dx, dz) || 1; dx /= l2; dz /= l2;
    } else if (wantsMove && this.stuck > 0.35 && this.motion.onGround && !lad0(this)) {
      this.detourT = 0.8; this.detourSign = this.detourSign ? -this.detourSign : (Math.random() < 0.5 ? 1 : -1);
    }

    if (wantsMove && this.stuck > 0.4 && this.motion.onGround && !(this.atEdge > 0) && Math.random() < 0.05) this.jump = true;
    if (this.ladderExit > 0) {                                                        // acabou de subir uma escada de mão: primeiro entra na plataforma
      this.ladderExit -= dt; dx = -this.lastLadder.nx; dz = -this.lastLadder.nz;
    } else if (this.motion.onGround && p.y > 3) {                                     // parado mesmo na borda (com o centro já fora): recua para dentro
      const c = standingOn(map.colliders, p.x, p.z, p.y);
      if (c && !inside(c, p.x, p.z, -0.2)) {
        const cx = c.r !== undefined ? c.x : (c.minX + c.maxX) / 2, cz = c.r !== undefined ? c.z : (c.minZ + c.maxZ) / 2, d = Math.hypot(cx - p.x, cz - p.z) || 1;
        dx = (cx - p.x) / d; dz = (cz - p.z) / d;
      }
    }
    const onGate = this.motion.onGround ? standingOn(map.colliders, p.x, p.z, p.y) : null;
    if (onGate && onGate.gate && !onGate.safe) { dx = onGate.exit.x; dz = onGate.exit.z; this.running = true; }   // a ponte-levadiça vai subir: sai para a margem
    if (wantsMove && this.motion.onGround && map.waters && map.waters.length) {       // não entra no rio (nem salta para lá), nem numa ponte-levadiça que vai subir
      const ux = dx / Math.max(dl, 1e-6), uz = dz / Math.max(dl, 1e-6), ah = { x: p.x + ux * 1.3, y: 0, z: p.z + uz * 1.3 };
      const ahc = standingOn(map.colliders, ah.x, ah.z, p.y);
      ah.y = ahc ? topAt(ahc, ah.x, ah.z) : 0;
      if (inWater(map.waters, ah, true) || (ahc && ahc.gate && !ahc.safe && !(onGate && onGate.gate))) { dx = 0; dz = 0; this.motion.vx *= 0.2; this.motion.vz *= 0.2; this.atEdge = 0.4; if (!this.enemy) { this.pickTarget(map); this.wait = 0.2; } }
    }
    if (wantsMove && this.motion.onGround && p.y > 1) {                                // lá em cima: não se atira de uma borda alta (queda mortal)
      const ux = dx / Math.max(dl, 1e-6), uz = dz / Math.max(dl, 1e-6);
      if (p.y - floorAt(map.colliders, p.x + ux * 1.4, p.z + uz * 1.4, p.y) >= CONFIG.fallDeath * 0.7) {   // trava, muda de destino e não salta
        dx = 0; dz = 0; this.motion.vx *= 0.2; this.motion.vz *= 0.2; this.atEdge = 0.6;
        if (!this.enemy) { this.pickTarget(map); this.wait = 0.3; }
      }
    }
    if (this.atEdge > 0) { this.atEdge -= dt; this.jump = false; }
    if (wantsMove && this.motion.onGround && jumpableAhead(map.colliders, p.x, p.z, p.y, dx / Math.max(dl, 1e-6), dz / Math.max(dl, 1e-6))) this.jump = true;   // caixote / plataforma ao alcance à frente: salta para cima
    if (this.jump && map.waters && map.waters.length && wantsMove) {                 // não salta se houver água logo à frente (murete da margem)
      const ux = dx / (Math.hypot(dx, dz) || 1), uz = dz / (Math.hypot(dx, dz) || 1);
      for (const k of [1.0, 1.8, 2.6]) if (inWater(map.waters, { x: p.x + ux * k, y: 0, z: p.z + uz * k }, true)) { this.jump = false; break; }
    }
    if (this.jump && p.y > 3) {                                                       // num sítio alto não salta se houver uma queda perigosa por perto
      for (let k = 0; k < 8 && this.jump; k++) {
        const ang = (k * Math.PI) / 4;
        if (p.y - floorAt(map.colliders, p.x + Math.cos(ang) * 1.5, p.z + Math.sin(ang) * 1.5, p.y) >= CONFIG.fallDeath * 0.7) this.jump = false;
      }
    }
    if (this.jump) this.holdJump = true; else if (this.motion.vy <= 0) this.holdJump = false;   // segura o salto enquanto sobe (salto completo)
    const before = { x: p.x, z: p.z };
    const ladder = ladderState(map.ladders, p, { x: dx, z: dz }, this.motion.onGround);
    const ev = stepMotion(this.motion, p, { x: dx, z: dz }, { run: this.running, jumpPressed: this.jump, jumpHeld: this.holdJump, ladder,
      floor: (x, z, y) => floorAt(map.colliders, x, z, y), ceil: (x, z, y) => ceilingAt(map.colliders, x, z, y) }, dt, this._speedCfg());
    this.jump = false;
    resolveCollisions(p, CONFIG.player.radius, map.colliders);
    collisionFeedback(this.motion, before, p, dt);
    surfaceEffects(map.colliders, p, this.motion, dt);                                  // tapetes, carrosséis e trampolins
    if (ev.fall >= CONFIG.fallDeath && this.alive && world) world.eliminate(this, null, this.colorId, false, "fall");   // queda de muito alto
    if (this.alive && world && inWater(map.waters, p, this.motion.onGround)) world.eliminate(this, null, this.colorId, false, "water");   // caiu ao rio

    const speed = Math.hypot(this.motion.vx, this.motion.vz);
    this.stuck = wantsMove && speed < 1.2 ? this.stuck + dt : Math.max(0, this.stuck - dt * 2);
    const lad = this.motion.climbing ? ladderAt(map.ladders, p) : null;
    if (lad) { hugLadder(lad, p, this.motion, dt); this.lastLadder = lad; if (this.motion.vy > 0 && p.y > lad.top - 0.6) this.ladderExit = 0.45; }   // centrado na escada
    // agachar: atrás de um murete, os bots (a partir do Médio) baixam-se enquanto a arma recarrega e levantam-se para disparar
    if (this.enemy && cfg.smart >= 1 && this.motion.onGround && !lad && this.fireCd > 0.25 && this._lowCoverToward(map, this.enemy)) this.crouching = true;
    else if (!this.enemy || this.fireCd <= 0.25 || !this.motion.onGround) this.crouching = false;
    const want = lad ? Math.atan2(-lad.nx, -lad.nz) : faceYaw !== null ? faceYaw : speed > 0.6 ? Math.atan2(this.motion.vx, this.motion.vz) : null;   // na escada: virado para ela
    if (want !== null) {
      const d = Math.atan2(Math.sin(want - this.facing), Math.cos(want - this.facing));
      this.facing += d * Math.min(1, dt * (faceYaw !== null ? 16 : 12));
    }
    if (this.model) {
      this.model.position.set(p.x, visualY(this.model, p.y, this.motion.onGround, dt), p.z);
      this.model.rotation.y = this.facing;
      animateCharacter(this.model, { speed: lad ? 0 : speed, maxSpeed: MOTION.run, onGround: this.motion.onGround, vy: this.motion.vy, landed: ev.landed, impact: ev.impact, climbing: !!lad, crouching: !!this.crouching }, dt, t);
    }
  }
}
