import { MOTION, createMotionState, stepMotion, collisionFeedback } from "./player-motion.js";
import { resolveCollisions } from "./collisions.js";
import { animateCharacter } from "./character-animator.js";
import { CONFIG } from "./game-config.js";
import { PRIMARIES, ingredients } from "./colors.js";

/* ============================================================
   BOTS
   Patrulham o mapa (defensores na metade da sua base, atacantes por todo o lado). Quando veem um adversário
   (linha de visão livre) depois do tempo de reação viram-se para ele, mantêm a distância, andam de lado e
   disparam com imprecisão. Escolhem a cor certa para o alvo (às vezes enganam-se, conforme a dificuldade em
   CONFIG.bots). Desviam-se uns dos outros e destravam sozinhos se ficarem presos.
   Cada bot é também um "combatente" (hp, cor, vivo/morto...) para o CombatWorld.
   ============================================================ */
const rand = (a, b) => a + Math.random() * (b - a);

export class Bot {
  constructor({ team, index, characterId, model, pos, facing, role, colorId }) {
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
  }

  get lowAmmo() { return PRIMARIES.reduce((s, c) => s + this.ammo[c], 0) < 8; }
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

  // Adversário mais próximo que consegue ver
  _pickEnemy(world) {
    const p = this.pos, cfg = CONFIG.bots;
    let best = null, bd = cfg.sight;
    for (const e of world.enemiesOf(this)) {
      const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
      if (d >= bd) continue;
      if (e.hidden && d > 4) continue;                          // invisível: só o veem de muito perto
      if (!world.los(p.x, p.z, e.pos.x, e.pos.z)) continue;
      best = e; bd = d;
    }
    return best;
  }

  _shoot(world) {
    const p = this.pos, e = this.enemy, cfg = CONFIG.bots;
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
    let vx = e.pos.x - o.x, vz = e.pos.z - o.z;
    const vy0 = e.pos.y + 1.3 - o.y, dist = Math.hypot(vx, vz);
    const err = ((cfg.aimErrorDeg * Math.PI) / 180) * (Math.random() * 2 - 1), c = Math.cos(err), s = Math.sin(err);
    [vx, vz] = [vx * c - vz * s, vx * s + vz * c];
    const vy = vy0 + (Math.random() - 0.5) * 0.05 * dist;
    world.fire(this, o, { x: vx, y: vy, z: vz }, this.shotColor);
  }

  // agents = lista de { pos } (jogador e bots) para manter distância; world = CombatWorld (opcional)
  update(dt, t, map, agents, world) {
    if (!this.alive) return;
    const p = this.pos, cfg = CONFIG.bots;
    let dx = 0, dz = 0, engaged = false, faceYaw = null;
    this.openCd -= dt;
    for (const c of PRIMARIES) this.ammo[c] = Math.min(CONFIG.ammo.max, this.ammo[c] + CONFIG.ammo.regen * dt);

    // --- combate: procurar e atacar ---
    if (world) {
      this.fireCd -= dt; this.thinkCd -= dt;
      if (this.thinkCd <= 0) {
        this.thinkCd = 0.2;
        const e = this._pickEnemy(world);
        if (e !== this.enemy) this.seen = 0;
        this.enemy = e;
      }
      if (this.enemy && !this.enemy.alive) this.enemy = null;
      if (this.enemy) {
        engaged = true;
        const e = this.enemy, ex = e.pos.x - p.x, ez = e.pos.z - p.z, ed = Math.max(Math.hypot(ex, ez), 1e-6), nx = ex / ed, nz = ez / ed;
        this.seen += dt;
        if (ed > cfg.range + 4) { dx = nx; dz = nz; } else if (ed < cfg.range - 5) { dx = -nx; dz = -nz; }
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = rand(0.8, 2.0); }
        dx += -nz * this.strafe * 0.8; dz += nx * this.strafe * 0.8;
        this.running = false;
        faceYaw = Math.atan2(ex, ez);
        if (this.seen >= cfg.reaction && this.fireCd <= 0 && world.los(p.x, p.z, e.pos.x, e.pos.z)) {
          this._shoot(world);
          this.fireCd = cfg.fireInterval * rand(0.8, 1.35);
        }
      }
    }

    // --- patrulha ---
    if (!engaged) {
      let tx = this.target.x - p.x, tz = this.target.z - p.z, dist = Math.hypot(tx, tz);
      if (dist < 2.2 || this.stuck > 0.8) {
        const arrived = dist < 2.2;
        this.pickTarget(map);
        this.stuck = 0;
        if (arrived) this.wait = rand(0.2, 1.4);
      }
      if (world && this.lowAmmo && this._resupply(map, world)) this.wait = Math.min(this.wait, 0);   // pouca munição: vai buscar mais
      tx = this.target.x - p.x; tz = this.target.z - p.z; dist = Math.hypot(tx, tz);
      this.wait -= dt;
      if (this.wait <= 0) { dx = tx / Math.max(dist, 1e-6); dz = tz / Math.max(dist, 1e-6); }
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
    const ev = stepMotion(this.motion, p, { x: dx, z: dz }, { run: this.running, jumpPressed: this.jump, jumpHeld: this.jump }, dt);
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
