import { MOTION, createMotionState, stepMotion, collisionFeedback } from "./player-motion.js";
import { resolveCollisions } from "./collisions.js";
import { animateCharacter } from "./character-animator.js";
import { CONFIG, BOT_PRESETS } from "./game-config.js";
import { COLORS, PRIMARIES, SECONDARIES, ingredients } from "./colors.js";

/* ============================================================
   BOTS
   Patrulham o mapa (defensores na metade da sua base, atacantes por todo o lado). Quando veem um adversário
   (linha de visão livre) depois do tempo de reação viram-se para ele, mantêm a distância, andam de lado e
   disparam com imprecisão. Escolhem a cor certa para o alvo (às vezes enganam-se, conforme a dificuldade em
   o preset da dificuldade em BOT_PRESETS). Desviam-se uns dos outros e destravam sozinhos se ficarem presos.
   Também apanham itens e usam cura, granadas e invisibilidade conforme a dificuldade (ver BOT_PRESETS).
   Cada bot é também um "combatente" (hp, cor, vivo/morto...) para o CombatWorld.
   ============================================================ */
const rand = (a, b) => a + Math.random() * (b - a);

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
    this.items = { health: 0, grenade: 0, invisible: 0 }; this.invisibleT = 0; this.itemCd = rand(0.5, 1.5); this.grenadeCd = 0;
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
    const k = this.speedMul || 1;
    if (k === 1) return MOTION;
    this._sc = this._sc || { ...MOTION };
    this._sc.walk = MOTION.walk * k; this._sc.run = MOTION.run * k;
    return this._sc;
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
    this.invisibleT = 0;
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
      if (d >= cfg.sight) continue;
      if (e.hidden && d > 4) continue;                          // invisível: só o veem de muito perto
      if (!world.los(p.x, p.z, e.pos.x, e.pos.z)) continue;
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
    const ed = e ? Math.hypot(e.pos.x - p.x, e.pos.z - p.z) : 1e9, seen = e && world.los(p.x, p.z, e.pos.x, e.pos.z);
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
  }
  _allyNear(world, e) {
    const r = CONFIG.grenade.radius;
    return world.combatants.some((c) => c.team === this.team && c !== this && c.alive && Math.hypot(c.pos.x - e.pos.x, c.pos.z - e.pos.z) < r);
  }
  _throwGrenade(world, e, mode) {
    const p = this.pos, all = [...PRIMARIES, ...SECONDARIES], T = CONFIG.grenade.flight;
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
    const o = { x: p.x + Math.sin(this.facing) * 0.8, y: 1.25, z: p.z + Math.cos(this.facing) * 0.8 };
    if (this.shotFor !== e.colorId || !this.shotColor) {         // escolhe a cor: certa com a probabilidade da dificuldade
      this.shotFor = e.colorId;
      const chance = PRIMARIES.includes(e.colorId) ? cfg.correctColorChance : cfg.correctSecondaryChance;      // cor misturada é mais difícil de adivinhar
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
    const vy0 = e.pos.y + 1.3 - o.y, dist = Math.hypot(vx, vz);
    const err = ((cfg.aimErrorDeg * Math.PI) / 180) * (Math.random() * 2 - 1), c = Math.cos(err), s = Math.sin(err);
    [vx, vz] = [vx * c - vz * s, vx * s + vz * c];
    const vy = vy0 + (Math.random() - 0.5) * 0.05 * dist;
    world.fire(this, o, { x: vx, y: vy, z: vz }, this.shotColor);
  }

  // agents = lista de { pos } (jogador e bots) para manter distância; world = CombatWorld (opcional)
  update(dt, t, map, agents, world) {
    if (!this.alive) return;
    const p = this.pos, cfg = this.cfg;
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
        else if (ed > cfg.range + 4) { dx = nx; dz = nz; } else if (ed < cfg.range - 5) { dx = -nx; dz = -nz; }
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = cfg.smart >= 3 ? rand(0.3, 1.0) : cfg.smart >= 2 ? rand(0.5, 1.4) : rand(0.8, 2.0); }
        dx += -nz * this.strafe * 0.8 * cfg.strafeMul; dz += nx * this.strafe * 0.8 * cfg.strafeMul;
        if (cfg.smart >= 3 && p.y === 0 && Math.random() < dt * 0.7) this.jump = true;   // salta para ser difícil de acertar
        this.running = false;
        faceYaw = Math.atan2(ex, ez);
        const canFire = !stealth || ed <= 8;
        if (canFire && this.seen >= cfg.reaction && this.fireCd <= 0 && world.los(p.x, p.z, e.pos.x, e.pos.z)) {
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
      if (world && this.lowAmmo && this._resupply(map, world)) this.wait = Math.min(this.wait, 0);   // pouca munição: vai buscar mais
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
    // afasta-se dos outros
    for (const a of agents) {
      if (a.pos === p) continue;
      const ox = p.x - a.pos.x, oz = p.z - a.pos.z, d = Math.hypot(ox, oz);
      if (d > 0.01 && d < 1.8) { dx += (ox / d) * (1.8 - d) * 0.9; dz += (oz / d) * (1.8 - d) * 0.9; }
    }
    const dl = Math.hypot(dx, dz);
    if (dl > 1) { dx /= dl; dz /= dl; }
    const wantsMove = dl > 0.05;

    if (wantsMove && this.stuck > 0.4 && p.y === 0 && Math.random() < 0.05) this.jump = true;
    const before = { x: p.x, z: p.z };
    const ev = stepMotion(this.motion, p, { x: dx, z: dz }, { run: this.running, jumpPressed: this.jump, jumpHeld: this.jump }, dt, this._speedCfg());
    this.jump = false;
    resolveCollisions(p, CONFIG.player.radius, map.colliders);
    collisionFeedback(this.motion, before, p, dt);

    const speed = Math.hypot(this.motion.vx, this.motion.vz);
    this.stuck = wantsMove && speed < 1.2 ? this.stuck + dt : Math.max(0, this.stuck - dt * 2);
    const want = faceYaw !== null ? faceYaw : speed > 0.6 ? Math.atan2(this.motion.vx, this.motion.vz) : null;
    if (want !== null) {
      const d = Math.atan2(Math.sin(want - this.facing), Math.cos(want - this.facing));
      this.facing += d * Math.min(1, dt * (faceYaw !== null ? 16 : 12));
    }
    if (this.model) {
      this.model.position.set(p.x, p.y, p.z);
      this.model.rotation.y = this.facing;
      animateCharacter(this.model, { speed, maxSpeed: MOTION.run, onGround: this.motion.onGround, vy: this.motion.vy, landed: ev.landed, impact: ev.impact }, dt, t);
    }
  }
}
