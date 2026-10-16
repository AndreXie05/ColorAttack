/* ============================================================
   PARTIDA COM AMIGOS: o que passa de um PC para o outro durante o jogo (as salas estão em online.js).
   O PC do anfitrião manda: corre os bots, decide os acertos, as eliminações, os pontos, os rounds, os baús e quem apanha as caixas.
   Os convidados mexem o seu boneco no próprio PC (sem atraso), enviam o que fazem (posição, tiros, granadas, armadilhas, cura,
   quedas, baús) e mostram o que o anfitrião diz. No PC do convidado o combate está em "espelho" (combat.js: mirror):
   os tiros dos outros voam e pintam, mas o dano vem do anfitrião.
   Os outros jogadores (bots e amigos) são "marionetas" (Puppet): bonecos movidos pelas mensagens, que entram na lista
   dos bots, por isso o minimapa, os nomes, a morte e o resto do jogo tratam-nos como bots.
   Equipas: cada PC vê a sua equipa como "A" (azul, à esquerda). Quem está na equipa B do anfitrião vê tudo trocado:
   os ids (A2 ↔ B2), as equipas e as bases (map.spawns) — as posições no mapa são as mesmas.
   Mensagens do anfitrião (ids e equipas como o anfitrião as vê):
     sn  estado de todos (15×/s): tempo, pontos, rounds e, por combatente, posição, animação, cor, vida...; baús de vez em quando
     f / g / tp / tx / pd   tiro, granada, armadilha pousada / tirada (ou explodiu), poça que muda a cor
     k / cc / dm / as / gh / tt / rs / pf   eliminação, mudança de cor, dano, assistência, granada caiu, armadilha acionada,
                            reapareceu, efeito de poça (chamam no convidado as mesmas funções que no anfitrião)
     pk / pkx / got         caixas que saltaram de um baú / alguém apanhou uma / foste tu que a apanhaste
   Mensagens do convidado: s (o meu boneco, 15×/s), f, g, tp, h (curei-me), die (caí), chest, upg (melhorias), ready.
   ============================================================ */
import { setHeld } from "../personagens/character-model.js";
import { animateCharacter, visualY } from "../personagens/character-animator.js";
import { MOTION } from "../movimento/player-motion.js";
import { CONFIG } from "../base/game-config.js";

const SEND_MS = 66;                                                                     // ~15 mensagens por segundo
const HELD = ["gun", "grenade", "medkit"];
const CHEST_STATES = ["ready", "cooldown", "exhausted"];
const r2 = (v) => Math.round(v * 100) / 100;
const flipTeam = (t) => (t === "A" ? "B" : "A");

// ---------- marioneta: um combatente comandado pela rede (um amigo no PC do anfitrião; bots e amigos no PC do convidado) ----------
export class Puppet {
  constructor({ team, index, characterId, model, pos, facing, colorId, peer = null }) {
    this.team = team; this.index = index; this.id = team + index; this.isPlayer = false; this.puppet = true; this.peer = peer;
    this.characterId = characterId; this.model = model; this.colorId = colorId;
    this.pos = { x: pos.x, y: 0, z: pos.z }; this.facing = facing;
    this.view = { x: pos.x, y: 0, z: pos.z, facing };                                // onde o boneco se desenha (aproxima-se de pos com suavidade)
    this.anim = { speed: 0, ground: true, vy: 0, climb: false, held: "gun" };
    this.hiddenFlag = false; this.crouching = false; this.ignoreUntil = 0;
    this.items = { health: 0, grenade: 0, invisible: 0, trap: 0 }; this.ammo = { vermelho: 0, azul: 0, amarelo: 0 };
  }
  get hidden() { return this.hiddenFlag; }
  applyUpgrades() {}                                                                  // (as melhorias de um amigo chegam do PC dele)
  onRespawn() { this.view.x = this.pos.x; this.view.y = this.pos.y; this.view.z = this.pos.z; }
  // d = [x, y, z, facing, velocidade, noChão, vy, escada, agachado, mão, escondido]
  setNet(d) {
    if (performance.now() < this.ignoreUntil) return;                                // acabou de reaparecer: ignora posições antigas que ainda vinham a caminho
    this.pos.x = d[0]; this.pos.y = d[1]; this.pos.z = d[2]; this.facing = d[3];
    const a = this.anim; a.speed = d[4]; a.ground = !!d[5]; a.vy = d[6]; a.climb = !!d[7]; a.held = HELD[d[9]] || "gun";
    this.crouching = !!d[8]; this.hiddenFlag = !!d[10];
  }
  update(dt, t) {
    const v = this.view, p = this.pos, k = 1 - Math.exp(-dt * 14);
    if (Math.hypot(p.x - v.x, p.z - v.z) > 6) { v.x = p.x; v.y = p.y; v.z = p.z; }   // teletransporte: sem deslizar pelo mapa
    else { v.x += (p.x - v.x) * k; v.y += (p.y - v.y) * k; v.z += (p.z - v.z) * k; }
    let df = this.facing - v.facing; df = Math.atan2(Math.sin(df), Math.cos(df)); v.facing += df * k;
    if (!this.model || !this.alive) return;                                          // eliminado: a queda é animada pelo jogo (deathFx)
    const a = this.anim;
    setHeld(this.model, a.held);
    this.model.position.set(v.x, visualY(this.model, v.y, a.ground, dt), v.z);
    this.model.rotation.y = v.facing;
    animateCharacter(this.model, { speed: a.climb ? 0 : a.speed, maxSpeed: MOTION.run, onGround: a.ground, vy: a.vy, landed: false, impact: 0, climbing: a.climb, crouching: this.crouching }, dt, t);
  }
}

// ctx: { online, state, localNet() → [11 números] do teu boneco, paintPlayer(cor), paintBot(c), toast(texto, cor), nameOf(c), scoreUi(),
//        removeCombatant(c), onOther(msg, deQuem, marioneta) }
export function createNetGame(ctx) {
  const { online, state } = ctx;
  let role = null, world = null, flip = false, sendT = 0, snapN = 0, applying = false, dieSentAt = -9;
  const L = (id) => (flip && id ? flipTeam(id[0]) + id.slice(1) : id);              // id do anfitrião → id neste PC (e vice-versa)
  const byId = (id) => (id ? world?.combatants.find((c) => c.id === L(id)) : null);
  const byPeer = (peer) => state.bots.find((b) => b.peer === peer);
  const bc = (msg, except = null) => online.broadcast(msg, except);
  const pt = (o) => [r2(o.x), r2(o.y), r2(o.z)];
  const xyz = (a) => ({ x: a[0], y: a[1], z: a[2] });

  // ---------- anfitrião ----------
  function setupHost(w) {
    role = "host"; world = w; flip = false; sendT = 0;
    const fire0 = w.fire.bind(w), gren0 = w.throwGrenade.bind(w), trap0 = w.placeTrap.bind(w), rmTrap0 = w._removeTrap.bind(w), pud0 = w._addPuddle.bind(w);
    w.fire = (owner, o, d, c) => { const p = fire0(owner, o, d, c); if (p) bc({ t: "f", by: owner.id, o: pt(o), d: pt(d), c }, owner.peer); return p; };
    w.throwGrenade = (owner, o, tg, c, c2 = null, opts = null) => { const r = gren0(owner, o, tg, c, c2, opts); bc({ t: "g", by: owner.id, o: pt(o), tg: [r2(tg.x), r2(tg.z)], c, c2, opts }, opts?.via === "cannon" ? null : owner.peer); return r; };   // (as bolas do canhão de um amigo saem daqui: ele também as recebe)
    w.placeTrap = (owner, x, y, z, c) => { const tr = trap0(owner, x, y, z, c); bc({ t: "tp", id: tr.id, by: owner.id, p: [r2(x), r2(y), r2(z)], c }); return tr; };
    w._removeTrap = (tr) => { rmTrap0(tr); bc({ t: "tx", id: tr.id, boom: tr.fuseAt && w.t >= tr.fuseAt ? 1 : 0 }); };
    w._addPuddle = (q) => { pud0(q); if (q.life !== Infinity) bc({ t: "pd", p: [r2(q.x), r2(q.y || 0), r2(q.z)], r: q.r, c: q.colorId }); };
    const cb = w.cb, wrap = (name, msg) => { const f = cb[name]; cb[name] = (...a) => { bc(msg(...a)); return f?.(...a); }; };   // avisa primeiro (a eliminação chega antes do fim do round)
    wrap("onKill", (k, v, s, b, via) => ({ t: "k", k: k?.id || null, v: v.id, s, b: b ? 1 : 0, via }));
    wrap("onColorChange", (v, c, why) => ({ t: "cc", id: v.id, c, why: why || null }));
    wrap("onDamage", (v, n, o, s) => ({ t: "dm", v: v.id, n, o: o?.id || null, s, hp: v.hp }));
    wrap("onAssist", (a, v, k) => ({ t: "as", a: a.id, v: v.id, k: k.id }));
    wrap("onGrenade", (k, x, z, c, hit, via) => ({ t: "gh", k: k?.id || null, x: r2(x), z: r2(z), c, hit: hit.map((h) => h.id), via }));
    wrap("onTrapTriggered", (tr, v) => ({ t: "tt", id: tr.id, v: v.id }));
    wrap("onPuddleFx", (c, col, mul) => ({ t: "pf", id: c.id, c: col, m: mul }));
    const rs = cb.onRespawn;
    cb.onRespawn = (c, s) => {
      bc({ t: "rs", id: c.id, x: s.x, z: s.z, ry: s.ry, c: c.colorId });
      if (c.puppet) c.ignoreUntil = performance.now() + 600;
      return rs?.(c, s);
    };
    const pk = state.pickups;
    pk.onSpawn = (list) => bc({ t: "pk", l: list.map((d) => ({ ...d, x: r2(d.x), z: r2(d.z) })) });
    pk.onTake = (it) => bc({ t: "pkx", id: it.id });
  }
  // estado de toda a gente (o do anfitrião vem de localNet; bots e amigos do que se sabe deles)
  function snapshot() {
    const st = state, r = st.round, list = [];
    for (const c of world.combatants) {
      let d;
      if (c.isPlayer) d = ctx.localNet();
      else if (c.puppet) d = [c.pos.x, c.pos.y, c.pos.z, c.facing, c.anim.speed, c.anim.ground ? 1 : 0, c.anim.vy, c.anim.climb ? 1 : 0, c.crouching ? 1 : 0, HELD.indexOf(c.anim.held), c.hidden ? 1 : 0];
      else { const m = c.motion; d = [c.pos.x, c.pos.y, c.pos.z, c.facing, Math.hypot(m.vx, m.vz), m.onGround ? 1 : 0, m.vy, m.climbing ? 1 : 0, c.crouching ? 1 : 0, 0, c.hidden ? 1 : 0]; }
      list.push([c.id, ...d.map((v, i) => (i < 5 || i === 6 ? r2(v) : v)), c.colorId, c.neutral ? 1 : 0, Math.round(c.hp), c.maxHp, c.alive ? 1 : 0, c.puddleMul || 1]);
    }
    const msg = { t: "sn", rt: r2(st.roundTime), k: [r.kills.A, r.kills.B], w: [r.wins.A, r.wins.B], n: r.n, sd: r.sudden ? 1 : 0, it: r2(st.intenseT || 0), mt: r2(st.mixT || 0), c: list };
    if (st.features) msg.ft = st.features.net();                                       // fontes, latas e zonas
    if (++snapN % 5 === 0) msg.ch = st.map.chests.map((c) => [CHEST_STATES.indexOf(c.state), c.opens, r2(c.cooldown), c.golden ? 1 : 0, c.openTimer > 0 ? 1 : 0]);
    bc(msg);
  }
  function onGuestMsg(m, from) {
    const p = byPeer(from);
    if (m.t === "ready" || m.t === "away") { ctx.onOther(m, from); return; }
    if (!p || !world) { ctx.onOther(m, from); return; }
    if (m.t === "s") p.setNet(m.d);
    else if (m.t === "f" && p.alive) { p.pierce = m.p || 0; p.damageMul = m.m || 1; world.fire(p, xyz(m.o), xyz(m.d), m.c); }
    else if (m.t === "g" && p.alive) { p.grenadeMul = m.gm || 1; world.throwGrenade(p, xyz(m.o), { x: m.tg[0], z: m.tg[1] }, m.c, m.c2); }
    else if (m.t === "tp" && p.alive) world.placeTrap(p, m.p[0], m.p[1], m.p[2], m.c);
    else if (m.t === "h") world.heal(p, Math.min(CONFIG.health.cure, m.n || 0));
    else if (m.t === "die" && p.alive) world.eliminate(p, null, p.colorId, false, m.via === "water" ? "water" : "fall");
    else if (m.t === "upg") { p.maxHp = m.maxHp; p.pierce = m.pierce; p.damageMul = m.damageMul; p.grenadeMul = m.grenadeMul; if (m.full) p.hp = p.maxHp; else p.hp = Math.min(p.hp, p.maxHp); }
    else ctx.onOther(m, from, p);
  }
  // o amigo `p` passou por cima de uma caixa (no PC do anfitrião): o prémio vai para o PC dele
  function give(p, g) { online.sendTo(p.peer, { t: "got", ...g }); }

  // ---------- convidado ----------
  function setupGuest(w, flipTeams) {
    role = "guest"; world = w; flip = flipTeams; sendT = 0; dieSentAt = -9;
    w.mirror = true;
    state.pickups.noCollect = true;
    const me = state.me;
    const fire0 = w.fire.bind(w), gren0 = w.throwGrenade.bind(w), trap0 = w.placeTrap.bind(w), heal0 = w.heal.bind(w), elim0 = w.eliminate.bind(w);
    w.fire = (owner, o, d, c) => {
      const p = fire0(owner, o, d, c);                                                // vê-se já no teu ecrã
      if (owner === me && !applying && p) online.send({ t: "f", o: pt(o), d: pt(d), c, p: me.pierce || 0, m: me.damageMul || 1 });
      return p;
    };
    w.throwGrenade = (owner, o, tg, c, c2 = null, opts = null) => {
      const r = gren0(owner, o, tg, c, c2, opts);
      if (owner === me && !applying) online.send({ t: "g", o: pt(o), tg: [r2(tg.x), r2(tg.z)], c, c2, gm: me.grenadeMul || 1 });
      return r;
    };
    w.placeTrap = (owner, x, y, z, c) => {                                            // a tua armadilha só aparece quando o anfitrião a confirma (fica com o número dele)
      if (owner === me && !applying) { online.send({ t: "tp", p: [r2(x), r2(y), r2(z)], c }); return null; }
      return trap0(owner, x, y, z, c);
    };
    w.heal = (c, n) => { const g = heal0(c, n); if (c === me && !applying && g > 0) online.send({ t: "h", n: g }); return g; };
    w.eliminate = (target, killer, shot, byColor, via) => {
      if (applying) return elim0(target, killer, shot, byColor, via);
      if (target === me && !killer && w.t - dieSentAt > 1) { dieSentAt = w.t; online.send({ t: "die", via }); }   // caíste: quem decide é o anfitrião
      return undefined;
    };
  }
  const net = (f) => { applying = true; try { f(); } finally { applying = false; } };
  function onHostMsg(m) {
    if (!world || role !== "guest") { ctx.onOther(m, "host"); return; }
    const w = world, cb = w.cb;
    switch (m.t) {
      case "sn": applySnapshot(m); break;
      case "f": { const o = byId(m.by); if (o && o !== state.me) net(() => w.fire(o, xyz(m.o), xyz(m.d), m.c)); break; }
      case "g": { const o = byId(m.by); if (o && (o !== state.me || m.opts?.via === "cannon")) net(() => w.throwGrenade(o, xyz(m.o), { x: m.tg[0], z: m.tg[1] }, m.c, m.c2, m.opts)); break; }
      case "tp": { const o = byId(m.by); if (o) net(() => { const tr = w.placeTrap(o, m.p[0], m.p[1], m.p[2], m.c); if (tr) tr.id = m.id; }); break; }
      case "tx": {
        const tr = w.traps.find((q) => q.id === m.id);
        if (!tr) break;
        w._removeTrap(tr);
        if (m.boom) w.explodeGrenade({ x: tr.x, y: tr.y, z: tr.z, colorId: tr.colorId, colors: [tr.colorId], owner: tr.owner, via: "trap" }, { radius: CONFIG.trap.radius });   // (espelho: só o efeito)
        break;
      }
      case "pd": w._addPuddle({ x: m.p[0], y: m.p[1], z: m.p[2], r: m.r, colorId: m.c, t: w.t }); break;
      case "k": { const v = byId(m.v); if (v) net(() => w.eliminate(v, byId(m.k), m.s, !!m.b, m.via)); break; }
      case "cc": { const v = byId(m.id); if (v) { v.colorId = m.c; cb.onColorChange?.(v, m.c, m.why || undefined); } break; }
      case "dm": { const v = byId(m.v); if (v) { v.hp = m.hp; cb.onDamage?.(v, m.n, byId(m.o), m.s); } break; }
      case "as": { const a = byId(m.a), v = byId(m.v), k = byId(m.k); if (a && v && k) { a.assists++; a.rs.assists++; cb.onAssist?.(a, v, k); } break; }
      case "gh": cb.onGrenade?.(byId(m.k), m.x, m.z, m.c, m.hit.map(byId).filter(Boolean), m.via); break;
      case "tt": { const tr = w.traps.find((q) => q.id === m.id), v = byId(m.v); if (tr && v) { tr.fuseAt = w.t + CONFIG.trap.fuse; cb.onTrapTriggered?.(tr, v); } break; }
      case "rs": { const c = byId(m.id); if (c) net(() => w.respawn(c, { x: m.x, z: m.z, ry: m.ry }, m.c)); break; }
      case "pf": { const c = byId(m.id); if (c) cb.onPuddleFx?.(c, m.c, m.m); break; }
      case "pk": state.pickups?.spawnExact(m.l); break;
      case "pkx": state.pickups?.remove(m.id); break;
      default: ctx.onOther(m, "host");
    }
  }
  function applySnapshot(m) {
    const st = state, r = st.round, me = st.me;
    if (r && !st.over && st.intermission <= 0) {
      const A = flip ? 1 : 0, B = 1 - A;
      if (m.sd && !r.sudden) ctx.toast("⚡ MORTE SÚBITA: a próxima eliminação decide! Baús reabastecidos", "#ff3b4a");
      st.roundTime = m.rt; r.kills = { A: m.k[A], B: m.k[B] }; r.wins = { A: m.w[A], B: m.w[B] }; r.n = m.n; r.sudden = !!m.sd;
      st.intenseT = m.it; if (st.mode === "relampago") st.mixT = m.mt;
      ctx.scoreUi();
    }
    const seen = new Set();
    for (const e of m.c) {
      const c = byId(e[0]);
      if (!c) continue;
      seen.add(c);
      const [colorId, neutral, hp, maxHp, alive, puddle] = e.slice(12);
      c.maxHp = maxHp; c.hp = hp;
      if (c === me) {
        me.puddleMul = puddle;
        if (colorId !== me.colorId && alive && me.alive) { me.colorId = colorId; ctx.paintPlayer(colorId); }   // (as cores do modo intenso)
        continue;
      }
      c.setNet(e.slice(1, 12));
      if (alive && c.alive && (colorId !== c.colorId || !!neutral !== !!c.neutral)) { c.colorId = colorId; c.neutral = !!neutral; ctx.paintBot(c); }
    }
    for (const b of [...st.bots]) if (!seen.has(b)) ctx.removeCombatant(b);          // saiu da partida (já não está no jogo do anfitrião)
    if (m.ft) st.features?.apply(m.ft);
    if (m.ch && st.map) m.ch.forEach((h, i) => {
      const c = st.map.chests[i];
      if (!c) return;
      if (h[3] && !c.golden) ctx.toast("🌟 Apareceu um baú dourado! Procura a estrela no minimapa", "#ffd21f");
      c.state = CHEST_STATES[h[0]] || "ready"; c.opens = h[1]; c.cooldown = h[2]; c.golden = !!h[3];
      if (h[4] && !(c.openTimer > 0) && c.lidTarget === 0) { c.openTimer = 1.8; c.lidTarget = 1; }   // alguém abriu-o: a tampa abre
    });
  }

  // ---------- em cada frame ----------
  function tick(dt) {
    if (!role || !world) return;
    sendT -= dt * 1000;
    if (sendT > 0) return;
    sendT = SEND_MS;
    if (role === "host") snapshot();
    else online.send({ t: "s", d: ctx.localNet() });
  }
  function stop() { role = null; world = null; }                                       // (sair da partida avisa o anfitrião à parte: entre rounds também se para)

  return {
    setupHost, setupGuest, tick, stop, give,
    onMessage(m, from) { if (online.isHost) onGuestMsg(m, from); else onHostMsg(m); },
    get role() { return role; }, get flip() { return flip; },
  };
}
