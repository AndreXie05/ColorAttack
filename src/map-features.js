import * as THREE from "three";
import { COLORS, paletteColors, PRIMARIES } from "./colors.js";
import { mat } from "./materials-and-geometry.js";
import { isProtected } from "./combat.js";
import { CONFIG, ARENA, TEAM, aimY, muzzleY } from "./game-config.js";
import { floorAt } from "./surfaces.js";

/* ============================================================
   COISAS ESPECIAIS DE ALGUNS MAPAS (só existem nos mapas indicados em FEATURES)
   - Fonte de tinta (Parque, Fábrica): de 20 em 20 s avisa (anel no chão com a cor) e depois lança tinta:
     quem estiver na praça à volta fica dessa cor (colegas e adversários; quem está protegido não).
   - Pontes com interruptor (Castelo): ao lado do rio há placas com uma cor. Acertar na placa com essa cor
     faz a ponte subir do fundo do rio durante uns segundos. No fim treme, avisa e afunda-se outra vez:
     quem ainda estiver em cima vai ao fundo com ela e é eliminado (caiu ao rio).
   - Canhão de tinta (Castelo, Restaurante): só dispara quando alguém está lá. Quem sobe (E) tem 5 s para lançar bolas
     enormes da cor da mão (sem gastar munição); depois o canhão recarrega 20 s. As bolas só pintam adversários.
     Os bots também o usam. Fica num sítio livre perto do ponto indicado (procura sozinho).
   - Estúdio de Tinta (mapa novo): 4 poças grandes no chão mudam a cor de quem as pisa. A meio do round há a VIRAGEM:
     metade do chão ganha uma cor (quente = mais rápido, fria = mais lento), as poças começam a andar e, de 15 em 15 s,
     a metade pintada troca de lado e as poças mudam de cor.
   Modos de jogo que funcionam em qualquer mapa:
   - Rouba-Latas (modo "latas"): cada base tem uma lata. Apanha a dos adversários (passa por cima) e leva-a
     até à tua base: +2 pontos. Quem a leva anda mais devagar e aparece no minimapa; se for eliminado, a lata cai.
     Um adversário que lhe toque devolve-a à base (e ao fim de 20 s no chão volta sozinha).
   - Pinta e Conquista (modo "zonas"): 3 zonas no chão. A equipa com mais tinta (dos seus tiros e granadas, de qualquer cor) dentro
     de uma zona conquista-a e fica com ela até os adversários pintarem mais. A tinta seca em 10 s. De 15 em 15 s cada zona dá +1 ponto.
   Tudo é leve: poucas malhas simples, criadas uma vez por mapa, e sem trabalho quando nada está a acontecer.
   Com amigos (ctx.online) funciona tudo como contra bots. O PC do anfitrião decide
   tudo e envia o estado (net) e os avisos (ctx.emit); no PC de um convidado (ctx.mirror) só se mostra o que chega (apply, onEvent).
   ctx.flip: o convidado está na equipa B do anfitrião (vê as equipas trocadas); ctx.T(equipa) e ctx.byId(id) convertem o que chega.
   ============================================================ */
export const FEATURES = {
  parque:  { fountains: [{ x: 0, z: 0, y: 1.2, top: 3.4, r: 7.5 }] },
  fabrica: { fountains: [{ x: 0, z: 0, y: 1.2, top: 3.9, r: 7 }] },
  castelo: { bridges: [{ z: 20 }, { z: -20 }], cannons: [{ x: -15, z: 8 }, { x: 15, z: -8 }] },
  restaurante: { cannons: [{ x: -16, z: 0 }, { x: 16, z: 0 }] },
  estudio: { studio: true },
};
const FOUNTAIN = { every: 20, warn: 3 };                     // s entre jatos; aviso antes do jato
const BRIDGE = { open: 25, warn: 4, halfX: 3.6, halfZ: 1.4, top: 0.85, sunk: -1.4, ramp: 3, rise: 1.4, sink: 2.2 };   // s aberta, aviso antes de afundar, medidas e altura no fundo do rio (m), s a subir / a afundar

// ctx = { scene, world, map, colliders, onColor(c, colorId), toast(text, color), playerPos() }
export function setupMapFeatures(mapId, mode, ctx) {
  const def = { ...(FEATURES[mapId] || {}), cans: mode === "latas", territory: mode === "zonas" };
  if (!Object.values(def).some(Boolean)) return null;
  const group = new THREE.Group(); ctx.scene.add(group);
  const disposables = [];
  const fountains = (def.fountains || []).map((f, i) => makeFountain(f, i, group, disposables, ctx));
  const bridges = (def.bridges || []).map((b, i) => makeBridge(b, i, group, disposables, ctx));
  const cannons = (def.cannons || []).map((c, i) => makeCannon(c, i, group, disposables, ctx));
  ctx.world.cannons = cannons;
  const studio = def.studio ? makeStudio(group, disposables, ctx) : null;
  const cans = def.cans ? makeCans(group, disposables, ctx) : null;
  const terr = def.territory ? makeTerritory(group, disposables, ctx) : null;
  const goals = [cans, terr].filter(Boolean);
  ctx.world.objective = goals.length ? (b) => { for (const g of goals) { const o = g.objective(b); if (o) return o; } return null; } : null;   // para onde os bots vão (bots.js)
  return {
    cannons, cans, terr,
    paintLife: terr ? TERR.dry : 0,                                                       // Escola: a tinta seca em 10 s (s)
    carrying: (c) => cans?.carrying(c) || false,
    update(dt, now) { for (const f of fountains) f.update(dt, now); for (const b of bridges) b.update(dt, now); for (const c of cannons) c.update(dt, now); studio?.update(dt, now); for (const g of goals) g.update(dt, now); },
    nearCannon(pos) { return cannons.find((c) => Math.hypot(pos.x - c.x, pos.z - c.z) < 2.6 && Math.abs(pos.y - c.top) < 1.2) || null; },
    minimap(g, X, Y, now) { studio?.minimap(g, X, Y, now); for (const q of goals) q.minimap(g, X, Y, now); for (const c of cannons) { g.beginPath(); g.arc(X(c.z), Y(c.x), 8, 0, Math.PI * 2); g.fillStyle = c.ready() ? "#ff8a1f" : "#777"; g.fill(); g.lineWidth = 2.5; g.strokeStyle = "#1a1033"; g.stroke(); } },
    net: () => ({ f: fountains.map((f) => f.net()), b: bridges.map((b) => b.net()), k: cannons.map((c) => c.net()), s: studio?.net(), c: cans?.net(), z: terr?.net() }),  // anfitrião → convidados
    apply(st) {
      st.f?.forEach((v, i) => fountains[i]?.apply(v)); st.b?.forEach((v, i) => bridges[i]?.apply(v)); st.k?.forEach((v, i) => cannons[i]?.apply(v));
      if (st.s) studio?.apply(st.s); if (st.c) cans?.apply(st.c); if (st.z) terr?.apply(st.z);
    },
    onEvent(ev) { if (ev.k === "fo") fountains[ev.i]?.jet(ev.c); else if (ev.k === "br") bridges[ev.i]?.onEvent(ev); else if (ev.k === "can") cans?.onEvent(ev); else if (ev.k === "terr") terr?.onEvent(ev); },
    dispose() { for (const c of cannons) c.leave(); ctx.scene.remove(group); for (const d of disposables) d.dispose(); ctx.world.targets.length = 0; ctx.world.cannons = []; ctx.world.objective = null; for (const c of ctx.world.combatants) c.carryMul = 1; },
  };
}

// ---------- fonte de tinta ----------
function makeFountain(f, i, group, disposables, ctx) {
  const ringGeo = new THREE.RingGeometry(f.r - 0.5, f.r, 48), ringMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = -Math.PI / 2; ring.position.set(f.x, f.y + 0.06, f.z); group.add(ring);
  const ballGeo = new THREE.SphereGeometry(0.9, 16, 12), ball = new THREE.Mesh(ballGeo, mat(0xffffff, { emissive: 0x444444 }));
  ball.position.set(f.x, f.top + 0.9, f.z); group.add(ball);
  disposables.push(ringGeo, ringMat, ballGeo);
  let t = FOUNTAIN.every * 0.5 + i * 3, color = pick(null), warned = false;
  const paintBall = () => { ball.material = mat(COLORS[color].hex, { emissive: COLORS[color].hex }); ringMat.color.setHex(COLORS[color].hex); };
  paintBall();
  return {
    update(dt, now) {
      t -= dt;
      const warn = t <= FOUNTAIN.warn;
      ringMat.opacity = warn ? 0.35 + 0.35 * Math.sin(now / 90) : 0;                // anel a piscar = vai lançar tinta
      ring.visible = warn;
      ball.scale.setScalar(warn ? 1 + 0.25 * Math.sin(now / 70) : 1);
      if (warn && !warned) {
        warned = true;
        const p = ctx.playerPos();
        if (Math.hypot(p.x - f.x, p.z - f.z) < f.r + 6) ctx.toast(`⛲ A fonte vai lançar tinta ${COLORS[color].name}! Sai da praça (ou fica, se quiseres essa cor)`, css(color));
      }
      if (t > 0) return;
      if (ctx.mirror) { t = 0; return; }                                              // convidado: o jato chega do anfitrião
      // jato: partículas para o ar, manchas no chão (só visuais) e quem está na praça fica desta cor
      const w = ctx.world;
      jet(color);
      ctx.emit?.({ k: "fo", i, c: color });
      for (const c of w.combatants) {
        if (!c.alive || isProtected(c, w.t) || c.colorId === color) continue;
        if (Math.hypot(c.pos.x - f.x, c.pos.z - f.z) > f.r || Math.abs(c.pos.y - f.y) > 2.5) continue;
        c.colorId = color; ctx.onColor(c, color);
      }
      t = FOUNTAIN.every; warned = false; color = pick(color); paintBall();
    },
    net: () => [Math.round(t * 10) / 10, color],
    apply([nt, c]) { t = nt; if (t > FOUNTAIN.warn) warned = false; if (c !== color) { color = c; paintBall(); } },
    jet,
  };
  function jet(c) {
    const w = ctx.world;
    w.burst(f.x, f.top + 1, f.z, c, 24);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.random(); w.splat(f.x + Math.cos(a) * f.r * 0.6, f.z + Math.sin(a) * f.r * 0.6, c, 1.6, true); }
  }
}

// ---------- ponte com interruptor ----------
function makeBridge(b, i, group, disposables, ctx) {
  const B = BRIDGE, z = b.z;
  // rampas fixas nas duas margens (sobem do chão até ao tabuleiro)
  ctx.colliders.push({ minX: -B.halfX - B.ramp, maxX: -B.halfX, minZ: z - B.halfZ, maxZ: z + B.halfZ, top: B.top, ramp: { axis: "x", y0: 0, y1: B.top } });
  ctx.colliders.push({ minX: B.halfX, maxX: B.halfX + B.ramp, minZ: z - B.halfZ, maxZ: z + B.halfZ, top: B.top, ramp: { axis: "x", y0: B.top, y1: 0 } });
  const wood = mat(0x9a6a3a);
  // rampa em cunha: a face de cima coincide com a rampa por onde se anda (do chão até à altura da ponte), sem degraus nas pontas
  const wedge = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(B.ramp, 0), new THREE.Vector2(0, B.top)]);
  const rampGeo = new THREE.ExtrudeGeometry(wedge, { depth: B.halfZ * 2, bevelEnabled: false }), deckGeo = new THREE.BoxGeometry(B.halfX * 2, 0.25, B.halfZ * 2);
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(rampGeo, wood); r.position.set(s * B.halfX, 0, z - B.halfZ); r.scale.x = s; r.receiveShadow = true; r.castShadow = true; group.add(r);   // lado esquerdo: espelhada
  }
  // tabuleiro: fica no fundo do rio (escondido) e sobe quando se abre. Para os bots são duas metades, cada uma com a saída para a sua margem
  const deckMesh = new THREE.Mesh(deckGeo, wood); deckMesh.receiveShadow = true; deckMesh.visible = false; group.add(deckMesh);
  const halves = [-1, 1].map((s) => {
    const col = { minX: s < 0 ? -B.halfX : 0, maxX: s < 0 ? 0 : B.halfX, minZ: z - B.halfZ, maxZ: z + B.halfZ, top: -10, gate: true, safe: true, exit: { x: s, z: 0 } };   // gate/safe/exit: os bots fogem para a margem quando vai afundar
    ctx.colliders.push(col);
    return col;
  });
  // placas: uma em cada margem, com a cor que é preciso acertar
  const boardGeo = new THREE.BoxGeometry(0.15, 1.3, 1.3), postGeo = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
  disposables.push(rampGeo, deckGeo, boardGeo, postGeo);
  let color = PRIMARIES[Math.floor(Math.random() * PRIMARIES.length)], open = 0, up = 0, wasDry = false;   // up: 0 = no fundo, 1 = à superfície
  const boards = [-1, 1].map((s) => {
    const x = s * (B.halfX + B.ramp + 0.8), zz = z + Math.sign(z) * (B.halfZ + 0.6);
    const post = new THREE.Mesh(postGeo, mat(0x555555)); post.position.set(x, 1, zz); group.add(post);
    const board = new THREE.Mesh(boardGeo, mat(COLORS[color].hex, { emissive: COLORS[color].hex })); board.position.set(x, 1.7, zz); group.add(board);
    ctx.world.targets.push({ x, y: 1.7, z: zz, r: 0.9, onHit: (shot, owner) => hit(shot, owner) });
    return board;
  });
  const setBoards = (hex) => { for (const bd of boards) bd.material = mat(hex, { emissive: hex }); };
  function hit(shot, owner) {                                                       // (só no anfitrião / sozinho: no convidado o tiro não acerta nas placas)
    if (open > 0) return;
    if (shot !== color) { ctx.emit?.({ k: "br", i, e: "wrong", q: owner?.id || null }); if (owner?.isPlayer) ctx.toast(`🎯 A placa só abre com ${COLORS[color].name}`, css(color)); return; }
    open = B.open; setBoards(0xffffff);
    ctx.emit?.({ k: "br", i, e: "open", q: owner?.id || null });
    tellOpen(owner);
  }
  const tellOpen = (owner) => { if (owner?.isPlayer || Math.abs(ctx.playerPos().z - z) < 12) ctx.toast(`🌉 ${owner?.isPlayer ? "Abriste" : "Abriram"} a ponte sobre o rio durante ${B.open} s!`, "#ffd21f"); };
  const onDeck = (c) => c.alive && Math.abs(c.pos.x) < B.halfX && Math.abs(c.pos.z - z) < B.halfZ && c.pos.y > 0.3;
  let warned = false;
  const splash = () => { for (const x of [-2.4, 0, 2.4]) ctx.world.burst(x, 0.2, z, "azul", 8); };
  return {
    net: () => [Math.round(open * 10) / 10, Math.round(up * 100) / 100, color],
    apply([o, u, c]) {                                                               // convidado: o estado do anfitrião (entre mensagens continua a mexer-se sozinho)
      if (o > 0 && open === 0) setBoards(0xffffff);
      open = o; up = u;
      if (c !== color) { color = c; if (open === 0) setBoards(COLORS[color].hex); }
    },
    onEvent(ev) {
      const q = ctx.byId(ev.q);
      if (ev.e === "open") tellOpen(q);
      else if (ev.e === "wrong" && q?.isPlayer) ctx.toast(`🎯 A placa só abre com ${COLORS[color].name}`, css(color));
    },
    update(dt, now) {
      if (open > 0) {
        open = Math.max(open - dt, 0);
        up = Math.min(1, up + dt / B.rise);
      } else if (up > 0) up = Math.max(0, up - dt / B.sink);
      else return;                                                                 // no fundo e parada: nada a fazer
      const warning = open > 0 && open < B.warn, closing = open === 0;
      if (warning && !warned) {
        warned = true;
        if (ctx.world.combatants.some((c) => c.isPlayer && onDeck(c))) ctx.toast("⚠️ A ponte vai afundar! Sai já ou vais ao fundo!", "#ff3b4a");
      }
      const shake = warning ? Math.sin(now / 35) * 0.06 * (1 - open / B.warn) : 0;   // treme cada vez mais
      const k = up * up * (3 - 2 * up), top = up >= 1 ? B.top : B.sunk + (B.top - B.sunk) * k;   // sobe/desce suave
      deckMesh.visible = up > 0;
      deckMesh.position.set(0, top - 0.12 + shake, z);
      deckMesh.rotation.x = closing ? (1 - up) * 0.12 : shake;                    // a afundar, inclina um pouco
      for (const col of halves) { col.top = up > 0 ? top : -10; col.safe = !(warning || closing); }   // segura quem está em cima até chegar à água: aí é eliminado
      const dry = top > 0;
      if (dry !== wasDry) { wasDry = dry; splash(); }                              // salpicos quando sai ou entra na água
      if (warning) setBoards(Math.floor(now / 200) % 2 ? 0xffffff : 0xff3b4a);   // a piscar: vai afundar
      if (closing && up === 0) {                                                   // no fundo: placa com uma cor nova
        warned = false;
        if (!ctx.mirror) color = PRIMARIES[Math.floor(Math.random() * PRIMARIES.length)];   // (convidado: a cor nova chega do anfitrião)
        setBoards(COLORS[color].hex);
      }
    },
  };
}

// ---------- canhão de tinta ----------
// Procura um sítio livre (sem obstáculos a menos de 2,4 m, fora do rio) a partir do ponto pedido, em espiral
function spotOk(ctx, x, z, maxX = ARENA.halfX - 8, gapMin = 2.4) {
  const gap = (c) => c.r !== undefined ? Math.hypot(x - c.x, z - c.z) - c.r : Math.hypot(x - Math.max(c.minX, Math.min(x, c.maxX)), z - Math.max(c.minZ, Math.min(z, c.maxZ)));
  return Math.abs(x) <= maxX && Math.abs(z) < ARENA.halfZ - 3 && ctx.colliders.every((c) => gap(c) > gapMin) &&
    !(ctx.map.waters || []).some((w) => x > w.minX - 3 && x < w.maxX + 3 && z > w.minZ - 3 && z < w.maxZ + 3);
}
function freeSpot(ctx, x0, z0, maxX = ARENA.halfX - 8, gapMin = 2.4) {           // maxX: até onde pode ir (as latas ficam dentro das bases)
  const ok = (x, z) => spotOk(ctx, x, z, maxX, gapMin);
  for (let r = 0; r < 16; r += 1) for (let a = 0; a < 16; a++) {
    const x = x0 + Math.cos((a / 16) * Math.PI * 2) * r, z = z0 + Math.sin((a / 16) * Math.PI * 2) * r;
    if (ok(x, z)) return { x, z };
    if (r === 0) break;
  }
  return { x: x0, z: z0 };
}
function makeCannon(spec, i, group, disposables, ctx) {
  const C = CONFIG.cannon, { x, z } = freeSpot(ctx, spec.x, spec.z), top = 0.4, w = ctx.world;
  ctx.colliders.push({ x, z, r: 1.3, top });                                                  // estrado redondo (sobe-se a andar)
  const baseGeo = new THREE.CylinderGeometry(1.3, 1.45, top, 24), barrelGeo = new THREE.CylinderGeometry(0.42, 0.55, 2.2, 16), wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.2, 16), ringGeo = new THREE.RingGeometry(1.5, 1.8, 32);
  disposables.push(baseGeo, barrelGeo, wheelGeo, ringGeo);
  const base = new THREE.Mesh(baseGeo, mat(0x6b4a2b)); base.position.set(x, top / 2, z); base.receiveShadow = true; group.add(base);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }); disposables.push(ringMat);
  const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.06, z); group.add(ring);   // anel laranja = pronto a usar
  const turret = new THREE.Group(); turret.position.set(x, top, z); group.add(turret);       // roda para onde se aponta
  const pitchG = new THREE.Group(); pitchG.position.set(0, 1.05, 0.55); turret.add(pitchG);
  const barrel = new THREE.Mesh(barrelGeo, mat(0x3a3f4a)); barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.9; barrel.castShadow = true; pitchG.add(barrel);
  const mouth = new THREE.Mesh(wheelGeo, mat(COLORS.vermelho.hex, { emissive: COLORS.vermelho.hex })); mouth.rotation.x = Math.PI / 2; mouth.position.z = 2.0; mouth.scale.set(0.8, 1, 0.8); pitchG.add(mouth);
  for (const sx of [-0.65, 0.65]) { const wh = new THREE.Mesh(wheelGeo, mat(0x8a5a2b)); wh.rotation.z = Math.PI / 2; wh.position.set(sx, 0.55, 0.55); turret.add(wh); }
  const cn = {
    x, z, top, yaw: 0, pitch: 0, user: null, until: 0, readyAt: 0, fireCd: 0, color: "vermelho",
    ready: () => !cn.user && w.t >= cn.readyAt,
    left: () => Math.max(0, cn.until - w.t),
    mount(c) {
      if (!cn.ready() || !c.alive) return false;
      if (ctx.mirror) { ctx.request({ i, a: "mount" }); return true; }                  // convidado: pede ao anfitrião (sobe quando ele confirmar)
      cn.user = c; cn.until = w.t + C.use; cn.fireCd = 0.3;
      if (!c.isPlayer) c.mounted = cn;
      ctx.onCannon?.(cn, c, true);
      return true;
    },
    leave() {
      const c = cn.user;
      if (!c) return;
      if (ctx.mirror) { if (c.isPlayer) ctx.request({ i, a: "leave" }); return; }
      cn.user = null; cn.readyAt = w.t + C.cooldown;
      if (!c.isPlayer) { c.mounted = null; c.pos.x = x - Math.sin(cn.yaw) * 2.2; c.pos.z = z - Math.cos(cn.yaw) * 2.2; }   // desce para trás do canhão
      ctx.onCannon?.(cn, c, false);
    },
    aim(yaw, pitch) { cn.yaw = yaw; cn.pitch = pitch; },
    // dispara uma bola para o ponto (tx, tz) com a cor `col`; devolve false se ainda estiver a recarregar a bola
    fire(tx, tz, col) {
      if (!cn.user || cn.fireCd > 0) return false;
      cn.fireCd = C.fireEvery; cn.color = col;
      cn.yaw = Math.atan2(tx - x, tz - z);
      if (ctx.mirror) { ctx.request({ i, a: "fire", x: Math.round(tx * 10) / 10, z: Math.round(tz * 10) / 10, c: col }); pitchG.position.z = 0.25; return true; }   // convidado: a bola sai do anfitrião (todos a veem)
      const o = { x: x + Math.sin(cn.yaw) * 2.6, y: top + 1.3, z: z + Math.cos(cn.yaw) * 2.6 };
      w.throwGrenade(cn.user, o, { x: tx, z: tz }, col, null, { range: C.range, radius: C.radius, via: "cannon", size: 1.9, enemiesOnly: true });
      w.burst(o.x, o.y, o.z, col, 10);
      mouth.material = mat(COLORS[col].hex, { emissive: COLORS[col].hex });
      pitchG.position.z = 0.25;                                                                // recuo
      return true;
    },
    // anfitrião → convidados: [quem está lá, tempo que falta, tempo para estar pronto, direção, inclinação, cor]
    net: () => [cn.user?.id || null, Math.round(cn.left() * 10) / 10, Math.round(Math.max(0, cn.readyAt - w.t) * 10) / 10, Math.round(cn.yaw * 100) / 100, Math.round(cn.pitch * 100) / 100, cn.color],
    apply([id, left, readyIn, yaw, pitch, col]) {
      const prev = cn.user, u = ctx.byId(id) || null;
      cn.user = u; cn.until = w.t + left; cn.readyAt = w.t + readyIn;
      if (!u?.isPlayer) { cn.yaw = yaw; cn.pitch = pitch; }                           // (quem está no canhão aponta-o no próprio PC)
      if (col !== cn.color) { cn.color = col; mouth.material = mat(COLORS[col].hex, { emissive: COLORS[col].hex }); }
      if (prev !== u) {
        if (prev?.isPlayer) ctx.onCannon?.(cn, prev, false);
        if (u) { if (u.isPlayer) cn.fireCd = 0.3; ctx.onCannon?.(cn, u, true); }
      }
    },
    update(dt) {
      const c = cn.user;
      if (c && (!c.alive || w.t >= cn.until) && !ctx.mirror) cn.leave();
      cn.fireCd -= dt;
      if (cn.user && !cn.user.isPlayer && !cn.user.puppet && !ctx.mirror) botFire(cn, cn.user);   // (um amigo no canhão dispara ele próprio)
      turret.rotation.y += Math.atan2(Math.sin(cn.yaw - turret.rotation.y), Math.cos(cn.yaw - turret.rotation.y)) * Math.min(1, dt * 12);
      pitchG.rotation.x = -Math.max(0.05, Math.min(0.6, cn.pitch));
      pitchG.position.z += (0.55 - pitchG.position.z) * Math.min(1, dt * 8);
      const rdy = cn.ready();
      ring.visible = rdy || !!cn.user;
      ringMat.color.setHex(cn.user ? COLORS[cn.color].hex : 0xff8a1f);
      ringMat.opacity = cn.user ? 0.5 + 0.3 * Math.sin(w.t * 12) : 0.7;
      if (!cn.user && rdy && !ctx.mirror) recruit(cn, dt);
    },
  };
  // bot no canhão: aponta ao adversário visível mais próximo dentro do alcance, com a cor certa (conforme a dificuldade)
  function botFire(cn, b) {
    let best = null, bd = C.range;
    for (const e of w.enemiesOf(b)) {
      const d = Math.hypot(e.pos.x - x, e.pos.z - z);
      if (d < bd && !e.hidden && !isProtected(e, w.t) && w.los(x, z, e.pos.x, e.pos.z, 1.6, top, e.pos.y, aimY(e) - e.pos.y)) { bd = d; best = e; }
    }
    if (!best) return;
    cn.yaw = Math.atan2(best.pos.x - x, best.pos.z - z); cn.pitch = 0.15 + bd / C.range * 0.4;
    if (cn.fireCd > 0) return;
    const cfg = b.cfg, all = paletteColors(), right = Math.random() < cfg.correctColorChance * (w.secret ? 0.5 : 1);
    const col = right ? best.colorId : all[Math.floor(Math.random() * all.length)], spread = 3.5 - cfg.smart;
    cn.fire(best.pos.x + (Math.random() - 0.5) * spread, best.pos.z + (Math.random() - 0.5) * spread, col);
  }
  // de vez em quando um bot (médio para cima) que esteja perto e livre vai buscar o canhão, se houver adversários ao alcance
  let recruitCd = 1 + Math.random();
  function recruit(cn, dt) {
    if ((recruitCd -= dt) > 0) return;
    recruitCd = 1.5;
    for (const b of w.combatants) {
      if (b.isPlayer || !b.alive || b.mounted || b.cannonGoal || !b.cfg || b.cfg.smart < 1 || b.passive) continue;
      if (Math.hypot(b.pos.x - x, b.pos.z - z) > 22 || (b.enemy && Math.hypot(b.enemy.pos.x - b.pos.x, b.enemy.pos.z - b.pos.z) < 12)) continue;
      if (!w.enemiesOf(b).some((e) => Math.hypot(e.pos.x - x, e.pos.z - z) < C.range * 0.8)) continue;
      if (Math.random() < 0.5) { b.cannonGoal = cn; b.cannonGoalT = 8; return; }
    }
  }
  return cn;
}

// ---------- Estúdio de Tinta: poças grandes, viragem a meio do round e metade do chão com cor ----------
const STUDIO = { pools: [{ x: 16, z: 13 }, { x: -16, z: 13 }, { x: 16, z: -13 }, { x: -16, z: -13 }], r: 2.6, speed: 2.2, every: 15, warn: 5, at: 0.5 };
function makeStudio(group, disposables, ctx) {
  const w = ctx.world, cols = ctx.colliders;
  // poça com borda irregular (um círculo com os pontos mexidos)
  const blob = new THREE.CircleGeometry(1, 28), pos = blob.attributes.position;
  for (let i = 1; i < pos.count; i++) { const k = 0.85 + Math.random() * 0.25; pos.setXY(i, pos.getX(i) * k, pos.getY(i) * k); }
  const halfGeo = new THREE.PlaneGeometry(74, ARENA.halfZ), halfMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  disposables.push(blob, halfGeo, halfMat);
  const half = new THREE.Mesh(halfGeo, halfMat); half.rotation.x = -Math.PI / 2; half.position.y = 0.035; half.visible = false; group.add(half);
  const pools = STUDIO.pools.map((p) => {
    const colorId = pick(null), m = new THREE.MeshStandardMaterial({ color: COLORS[colorId].hex, roughness: 0.25, emissive: COLORS[colorId].hex, emissiveIntensity: 0.15, polygonOffset: true, polygonOffsetFactor: -6 });
    disposables.push(m);
    const mesh = new THREE.Mesh(blob, m); mesh.rotation.x = -Math.PI / 2; mesh.position.set(p.x, 0.06, p.z); mesh.scale.setScalar(STUDIO.r); group.add(mesh);
    const pd = { x: p.x, y: 0, z: p.z, r: STUDIO.r, colorId, t: 0, life: Infinity, heading: Math.random() * Math.PI * 2, mesh };
    w.puddles.push(pd);
    return pd;
  });
  const recolor = (pd, c, fx = true) => { pd.colorId = c; pd.mesh.material.color.setHex(COLORS[c].hex); pd.mesh.material.emissive.setHex(COLORS[c].hex); if (fx) w.burst(pd.x, 0.4, pd.z, c, 8); };
  const blocked = (x, z) => Math.abs(x) > 34 || Math.abs(z) > ARENA.halfZ - 4 || floorAt(cols, x, z, 0.2) > 0.25 ||
    cols.some((c) => (c.r !== undefined ? Math.hypot(x - c.x, z - c.z) < c.r + STUDIO.r * 0.6 : x > c.minX - 1.5 && x < c.maxX + 1.5 && z > c.minZ - 1.5 && z < c.maxZ + 1.5));
  let elapsed = 0, shifted = false, warned = false, next = 0, side = Math.random() < 0.5 ? 1 : -1, halfColor = null, grow = 0, onHalf = false;
  const state0 = () => w.combatants.find((c) => c.isPlayer);                           // o teu boneco
  const sideName = () => (side > 0 ? "direita" : "esquerda");                          // como se vê no minimapa (z > 0 = lado direito)
  const announce = () => {
    const mul = CONFIG.puddleFx.speed[halfColor] ?? 1;
    ctx.toast(`🎨 VIRAGEM! A metade da ${sideName()} do chão ficou ${COLORS[halfColor].name}: ${mul > 1 ? "⚡ mais rápido" : "🐌 mais lento"} lá dentro. As poças grandes estão a andar!`, css(halfColor));
  };
  function turn() {                                                                    // muda a metade pintada e a cor das poças
    side = -side; halfColor = pick(halfColor);
    showHalf();
    for (const pd of pools) recolor(pd, pick(pd.colorId));
    next = STUDIO.every;
  }
  function showHalf() { grow = 0; half.position.set(0, 0.035, side * ARENA.halfZ / 2); halfMat.color.setHex(COLORS[halfColor].hex); half.visible = true; }
  return {
    // anfitrião → convidados: tempo, viragem, lado e cor do chão, e cada poça [x, z, cor]
    net: () => ({ e: Math.round(elapsed * 10) / 10, sh: shifted ? 1 : 0, sd: side, hc: halfColor, p: pools.map((pd) => [Math.round(pd.x * 100) / 100, Math.round(pd.z * 100) / 100, pd.colorId]) }),
    apply(st) {
      elapsed = st.e;
      if (st.sh && (!shifted || st.sd !== side || st.hc !== halfColor)) {             // viragem (a primeira ou as seguintes)
        shifted = true; side = st.sd; halfColor = st.hc; showHalf(); announce();
      }
      st.p.forEach(([px, pz, c], k) => {
        const pd = pools[k];
        if (!pd) return;
        pd.tx = px; pd.tz = pz;
        if (c !== pd.colorId) recolor(pd, c, shifted);
      });
    },
    update(dt) {
      elapsed += dt;
      if (ctx.mirror) {                                                                // convidado: as poças vão para onde o anfitrião diz
        if (!warned && elapsed >= CONFIG.roundSeconds * STUDIO.at - STUDIO.warn && !shifted) { warned = true; ctx.toast(`🎨 Daqui a ${STUDIO.warn} s o Estúdio vai mudar de cor!`, "#ffd21f"); }
        for (const pd of pools) {
          if (pd.tx === undefined) continue;
          const k = Math.min(1, dt * 8);
          pd.x += (pd.tx - pd.x) * k; pd.z += (pd.tz - pd.z) * k;
          pd.mesh.position.set(pd.x, 0.06, pd.z); if (shifted) pd.mesh.rotation.z += dt * 0.3;
        }
        if (shifted) { grow = Math.min(1, grow + dt / 1.2); half.scale.set(grow, 1, 1); halfMat.opacity = 0.32 * grow; }
        const inside = shifted && state0().alive && state0().pos.y < 0.5 && Math.sign(state0().pos.z) === side && Math.abs(state0().pos.x) < 37;
        if (inside !== onHalf) { onHalf = inside; const mul = CONFIG.puddleFx.speed[halfColor] ?? 1; if (inside) ctx.toast(`${mul > 1 ? "⚡" : "🐌"} Chão ${COLORS[halfColor].name}: ${mul > 1 ? "mais rápido" : "mais lento"}`, css(halfColor)); }
        return;
      }
      for (const pd of pools) if (!w.puddles.includes(pd)) w.puddles.push(pd);   // (o "R" de reiniciar o round limpa as poças)
      const at = CONFIG.roundSeconds * STUDIO.at;
      if (!warned && elapsed >= at - STUDIO.warn) { warned = true; ctx.toast(`🎨 Daqui a ${STUDIO.warn} s o Estúdio vai mudar de cor!`, "#ffd21f"); }
      if (!shifted && elapsed >= at) { shifted = true; turn(); announce(); }
      if (!shifted) return;
      next -= dt;
      if (next <= 0) { turn(); announce(); }
      grow = Math.min(1, grow + dt / 1.2);                                                // a cor espalha-se do meio para fora
      half.scale.set(grow, 1, 1); halfMat.opacity = 0.32 * grow;
      for (const pd of pools) {                                                           // as poças andam devagar e desviam-se dos obstáculos
        pd.heading += (Math.random() - 0.5) * dt * 0.8;
        let nx = pd.x + Math.sin(pd.heading) * STUDIO.speed * dt, nz = pd.z + Math.cos(pd.heading) * STUDIO.speed * dt;
        if (blocked(nx + Math.sin(pd.heading) * 2, nz + Math.cos(pd.heading) * 2)) { pd.heading += Math.PI * (0.5 + Math.random()); nx = pd.x; nz = pd.z; }
        pd.x = nx; pd.z = nz;
        pd.mesh.position.set(nx, 0.06, nz); pd.mesh.rotation.z += dt * 0.3;
        pd.mesh.scale.setScalar(STUDIO.r * (1 + 0.05 * Math.sin(elapsed * 3 + pd.heading)));
      }
      const mul = CONFIG.puddleFx.speed[halfColor] ?? 1;                                    // metade pintada: velocidade de quem está lá (no chão)
      for (const c of w.combatants) {
        const inside = c.alive && c.pos.y < 0.5 && Math.sign(c.pos.z) === side && Math.abs(c.pos.x) < 37;
        if (inside) { c.puddleMul = mul; c.puddleUntil = w.t + 0.3; }
        if (c.isPlayer && inside !== onHalf) { onHalf = inside; if (inside) ctx.toast(`${mul > 1 ? "⚡" : "🐌"} Chão ${COLORS[halfColor].name}: ${mul > 1 ? "mais rápido" : "mais lento"}`, css(halfColor)); }
      }
    },
    minimap(g, X, Y) {
      if (half.visible) { g.save(); g.globalAlpha = 0.28 * grow; g.fillStyle = css(halfColor); const z0 = side > 0 ? 0 : -ARENA.halfZ; g.fillRect(X(z0), Y(37), X(z0 + ARENA.halfZ) - X(z0), Y(-37) - Y(37)); g.restore(); }
      for (const pd of pools) { g.beginPath(); g.arc(X(pd.z), Y(pd.x), 9, 0, Math.PI * 2); g.fillStyle = css(pd.colorId); g.fill(); g.lineWidth = 2; g.strokeStyle = "#fff"; g.stroke(); }
    },
  };
}

// ---------- lata de tinta (captura): uma em cada base ----------
const CAN = { points: 2, carryMul: 0.85, grab: 1.7, back: 20, score: 3.2 };
const teamCss = (t) => "#" + TEAM[t].color.toString(16).padStart(6, "0");
const who = (t) => (t === "A" ? "A tua equipa" : "Os adversários");
const did = (t, one, many) => `${who(t)} ${t === "A" ? one : many}`;              // concordância: "A tua equipa entregou" / "Os adversários entregaram"
function makeCans(group, disposables, ctx) {
  const w = ctx.world, geo = new THREE.CylinderGeometry(0.55, 0.55, 1.1, 18), lidGeo = new THREE.CylinderGeometry(0.58, 0.58, 0.18, 18), padGeo = new THREE.RingGeometry(1.6, 2.1, 32);
  disposables.push(geo, lidGeo, padGeo);
  const cans = ["A", "B"].map((team) => {
    const side = (team === "A") !== !!ctx.flip ? -1 : 1, home = freeSpot(ctx, side * 46, 0, 47, 1.6), col = TEAM[team].color;
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(geo, mat(0xd8dde4)); body.castShadow = true; mesh.add(body);
    const lid = new THREE.Mesh(lidGeo, mat(col, { emissive: col })); lid.position.y = 0.6; mesh.add(lid);
    const band = new THREE.Mesh(geo, mat(col, { emissive: col })); band.scale.set(1.02, 0.35, 1.02); mesh.add(band);
    group.add(mesh);
    const padMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }); disposables.push(padMat);
    const pad = new THREE.Mesh(padGeo, padMat); pad.rotation.x = -Math.PI / 2; pad.position.set(home.x, 0.06, home.z); group.add(pad);   // base da lata (é aqui que se entregam as latas roubadas)
    return { team, home, x: home.x, y: 0, z: home.z, state: "home", carrier: null, droppedT: 0, mesh };
  });
  const other = (t) => cans.find((c) => c.team !== t);
  const reset = (can) => { if (can.carrier) can.carrier.carryMul = 1; Object.assign(can, { state: "home", carrier: null, x: can.home.x, y: 0, z: can.home.z }); };
  const STATES = ["home", "carried", "dropped"];
  // mensagens (iguais no anfitrião e nos convidados, cada um do seu ponto de vista); e: drop | back | grab | ret | score
  const text = (e, can, q) => {
    if (e === "drop") return `🥫 A lata ${can.team === "A" ? "da tua equipa" : "dos adversários"} caiu no chão!`;
    if (e === "back") return `🥫 A lata ${can.team === "A" ? "da tua equipa" : "dos adversários"} voltou à base`;
    if (e === "grab") return q.isPlayer ? "🥫 Apanhaste a lata! Leva-a até à tua base (+2 pontos)" : q.team === "B" ? "🥫 Roubaram a lata da tua equipa! Elimina quem a leva" : "🥫 Um colega apanhou a lata dos adversários!";
    if (e === "ret") return `🥫 ${q.isPlayer ? "Devolveste" : did(q.team, "devolveu", "devolveram")} a lata à base`;
    return `🥫 ${q.isPlayer ? "Entregaste" : did(q.team, "entregou", "entregaram")} a lata ${q.team === "A" ? "dos adversários" : "da tua equipa"}! +${CAN.points} pontos`;
  };
  const tell = (e, can, q = null) => {                                                // mostra aqui e avisa os convidados
    ctx.emit?.({ k: "can", e, can: can.team, q: q?.id || null });
    if (e === "score" && q?.isPlayer) ctx.mine?.("can");
    if (e !== "score") ctx.toast(text(e, can, q), teamCss(q ? q.team : can.team));
  };
  return {
    list: cans,
    carrying: (c) => cans.some((k) => k.carrier === c),
    net: () => cans.map((c) => [c.team, STATES.indexOf(c.state), c.carrier?.id || null, Math.round(c.x * 10) / 10, Math.round(c.y * 10) / 10, Math.round(c.z * 10) / 10]),
    apply(list) {
      for (const c of w.combatants) c.carryMul = 1;
      for (const [team, st, carrier, x, y, z] of list) {
        const can = cans.find((k) => k.team === ctx.T(team));
        if (!can) continue;
        Object.assign(can, { state: STATES[st] || "home", carrier: ctx.byId(carrier) || null, x, y, z });
        if (can.carrier) can.carrier.carryMul = CAN.carryMul;                         // quem leva a lata anda mais devagar (também tu)
      }
    },
    onEvent(ev) {
      const can = cans.find((k) => k.team === ctx.T(ev.can)), q = ctx.byId(ev.q);
      if (can && (q || !ev.q)) ctx.toast(text(ev.e, can, q), teamCss(q ? q.team : can.team));
      if (ev.e === "score" && q?.isPlayer) ctx.mine?.("can");
    },
    update(dt) {
      if (ctx.mirror) {                                                                // convidado: só mostra (a lata acompanha quem a leva)
        for (const can of cans) {
          if (can.state === "carried" && can.carrier?.alive) { can.x = can.carrier.pos.x; can.y = can.carrier.pos.y + 2.7; can.z = can.carrier.pos.z; }
          can.mesh.position.set(can.x, can.y + 0.55 + (can.state === "carried" ? 0 : 0.15 + Math.sin(w.t * 3) * 0.12), can.z);
          can.mesh.rotation.y = w.t * 1.5;
        }
        return;
      }
      for (const can of cans) {
        const c = can.carrier;
        if (can.state === "carried") {
          if (!c.alive) {                                                                 // eliminado: a lata cai onde ele estava
            Object.assign(can, { state: "dropped", carrier: null, x: c.pos.x, y: Math.max(0, c.pos.y), z: c.pos.z, droppedT: 0 }); c.carryMul = 1;
            tell("drop", can);
          } else {
            c.carryMul = CAN.carryMul; can.x = c.pos.x; can.y = c.pos.y + 2.7; can.z = c.pos.z;
            const base = other(can.team).home;                                            // a base de quem a leva
            if (Math.hypot(c.pos.x - base.x, c.pos.z - base.z) < CAN.score) {
              reset(can);
              tell("score", can, c);
              ctx.onScore(c.team, CAN.points, text("score", can, c));
            }
          }
        } else {
          if (can.state === "dropped" && (can.droppedT += dt) > CAN.back) { reset(can); tell("back", can); }
          for (const q of w.combatants) {
            if (!q.alive || isProtected(q, w.t) || Math.hypot(q.pos.x - can.x, q.pos.z - can.z) > CAN.grab || Math.abs(q.pos.y - can.y) > 1.6) continue;
            if (q.team !== can.team && !cans.some((k) => k.carrier === q)) {                // adversário: apanha-a
              Object.assign(can, { state: "carried", carrier: q });
              tell("grab", can, q);
              break;
            }
            if (q.team === can.team && can.state === "dropped") {                            // da mesma equipa: devolve-a à base
              reset(can); tell("ret", can, q);
              break;
            }
          }
        }
        const t = w.t;
        can.mesh.position.set(can.x, can.y + 0.55 + (can.state === "carried" ? 0 : 0.15 + Math.sin(t * 3) * 0.12), can.z);
        can.mesh.rotation.y = t * 1.5;
      }
    },
    // bots: quem leva a lata vai para a base; atacantes vão buscar a dos adversários; defensores perseguem quem roubou a sua (ou devolvem-na)
    objective(b) {
      const mine = cans.find((k) => k.team === b.team), theirs = other(b.team);
      if (theirs.carrier === b) return { x: mine.home.x, z: mine.home.z, push: true };          // push: avança mesmo a lutar
      if (b.role === "defend" && mine.state !== "home") return { x: mine.x, z: mine.z, push: true };
      if (b.role === "attack" && theirs.state !== "carried") return { x: theirs.x, z: theirs.z, push: b.index % 2 === 1 };   // metade dos atacantes vai mesmo à lata
      return null;
    },
    minimap(g, X, Y, now) {
      for (const can of cans) {
        const x = X(can.z), y = Y(can.x), r = can.state === "home" ? 9 : 11 * (1 + 0.15 * Math.sin(now / 100));
        g.fillStyle = teamCss(can.team); g.strokeStyle = "#fff"; g.lineWidth = 3;
        g.beginPath(); g.rect(x - r * 0.7, y - r, r * 1.4, r * 2); g.fill(); g.stroke();       // latinha
        if (can.state === "carried") { g.beginPath(); g.arc(x, y, r + 7, 0, Math.PI * 2); g.setLineDash([4, 4]); g.stroke(); g.setLineDash([]); }
      }
    },
  };
}

// ---------- território: 3 zonas; a tinta (de qualquer cor) conta para a equipa que a disparou ----------
// zonas: name (nas mensagens) e label (no quadro); a percentagem é a tinta que se VÊ (pintar por cima tira à outra equipa)
const TERR = { zones: [{ x: 0, z: 0, name: "do centro", label: "Centro" }, { x: 0, z: -22, name: "da esquerda", label: "Esquerda" }, { x: 0, z: 22, name: "da direita", label: "Direita" }], r: 6.5, dry: 10, every: 15, minPct: 10, step: 1.1 };
function makeTerritory(group, disposables, ctx) {
  const w = ctx.world, ringGeo = new THREE.RingGeometry(TERR.r - 0.45, TERR.r, 48), discGeo = new THREE.CircleGeometry(TERR.r - 0.45, 48);
  disposables.push(ringGeo, discGeo);
  // em qualquer mapa: cada zona procura chão livre na linha do meio (justo para as duas equipas); se não houver
  // (ex.: o rio do Castelo), passa a ser um par de zonas espelhadas, uma de cada lado
  const specs = [];
  for (const z0 of TERR.zones) {
    let mid = null;
    for (const dz of [0, 2, -2, 4, -4, 6, -6, 8, -8]) if (spotOk(ctx, 0, z0.z + dz, 30, 1.2)) { mid = { x: 0, z: z0.z + dz }; break; }
    if (mid) { specs.push({ ...z0, ...mid }); continue; }
    const p = freeSpot(ctx, 7, z0.z, 30, 1.2);
    const ours = { name: z0.name + " (lado da tua base)", label: z0.label + " (nosso lado)" }, theirs = { name: z0.name + " (lado adversário)", label: z0.label + " (lado deles)" };
    specs.push({ ...z0, x: -Math.abs(p.x), z: p.z, ...(ctx.flip ? theirs : ours) }, { ...z0, x: Math.abs(p.x), z: p.z, ...(ctx.flip ? ours : theirs) });   // (mesma ordem em todos os PCs; a tua base é a da esquerda, ou a da direita se estiveres na equipa B do anfitrião)
  }
  const zones = specs.map((z) => {
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    const discMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    disposables.push(ringMat, discMat);
    const ring = new THREE.Mesh(ringGeo, ringMat), disc = new THREE.Mesh(discGeo, discMat);
    for (const m of [ring, disc]) { m.rotation.x = -Math.PI / 2; m.position.set(z.x, 0.05, z.z); group.add(m); }
    const pts = [];                                                                       // pontos de medição (uma grelha dentro do círculo)
    for (let x = -TERR.r; x <= TERR.r; x += TERR.step) for (let q = -TERR.r; q <= TERR.r; q += TERR.step) if (Math.hypot(x, q) < TERR.r - 0.3) pts.push([z.x + x, z.z + q]);
    return { ...z, owner: null, pct: { A: 0, B: 0 }, pts, ringMat, discMat, wander: null };
  });
  let countCd = 0, scoreT = TERR.every;
  const paintCd = new Map();
  const setOwner = (z, owner) => {
    if (owner === z.owner) return;
    z.owner = owner;
    if (owner) ctx.toast(`🗺️ ${did(owner, "conquistou", "conquistaram")} a zona ${z.name}`, teamCss(owner));
    z.ringMat.color.setHex(owner ? TEAM[owner].color : 0xffffff);
    z.discMat.color.setHex(owner ? TEAM[owner].color : 0xffffff);
  };
  const scoreText = (t, n) => `🗺️ Território: +${n} ${n === 1 ? "ponto" : "pontos"} para ${t === "A" ? "a tua equipa" : "os adversários"} (${n} ${n === 1 ? "zona" : "zonas"})`;
  return {
    zones,
    info: () => ({ zones, next: Math.max(0, scoreT) }),                                    // para o quadro das zonas no ecrã
    net: () => ({ o: zones.map((z) => z.owner), s: Math.round(scoreT * 10) / 10 }),
    apply(st) { scoreT = st.s; st.o.forEach((o, i) => zones[i] && setOwner(zones[i], o ? ctx.T(o) : null)); },
    onEvent(ev) { if (ev.e === "score") ctx.toast(scoreText(ctx.T(ev.team), ev.n), teamCss(ctx.T(ev.team))); },
    update(dt) {
      if ((countCd -= dt) <= 0) {                                                         // conta a tinta fresca dentro de cada zona (2 vezes por segundo)
        countCd = 0.5;
        const P = ctx.paint();
        for (const z of zones) {
          // em cada ponto conta só a mancha de cima (a mais recente): pintar por cima tira percentagem à outra equipa
          const near = P ? P.records.filter((r) => r.team && P.t - r.t0 <= TERR.dry && Math.hypot(r.x - z.x, r.z - z.z) < TERR.r + r.radius) : [];
          const n = { A: 0, B: 0 };
          for (const [px, pz] of z.pts) {
            for (let i = near.length - 1; i >= 0; i--) { const r = near[i]; if (Math.hypot(px - r.x, pz - r.z) < r.radius * 0.9) { n[r.team]++; break; } }
          }
          z.pct.A = Math.round((n.A / z.pts.length) * 100); z.pct.B = Math.round((n.B / z.pts.length) * 100);
          const lead = z.pct.A > z.pct.B ? "A" : "B", top = z.pct[lead], next = z.pct[lead === "A" ? "B" : "A"];
          if (!ctx.mirror) setOwner(z, top >= TERR.minPct && top > next ? lead : z.owner);   // conquistada: continua tua (mesmo com a tinta seca) até os adversários pintarem mais (convidado: quem conquista diz o anfitrião)
        }
      }
      scoreT -= dt;
      for (const z of zones) { z.discMat.opacity = z.owner ? 0.22 + (scoreT < 3 ? 0.15 * Math.sin(w.t * 14) : 0) : 0; }   // a piscar antes de dar pontos
      if (ctx.mirror) { scoreT = Math.max(0, scoreT); return; }                          // convidado: pontos e bots são do anfitrião
      if (scoreT <= 0) {
        scoreT = TERR.every;
        for (const t of ["A", "B"]) {
          const n = zones.filter((z) => z.owner === t).length;
          if (n) { ctx.emit?.({ k: "terr", e: "score", team: t, n }); ctx.onScore(t, n, scoreText(t, n)); }
        }
      }
      // bots dentro de uma zona sem adversários à vista pintam o chão dela
      for (const b of w.combatants) {
        if (b.isPlayer || !b.alive || b.passive || b.mounted) continue;
        if (b.enemy && Math.hypot(b.enemy.pos.x - b.pos.x, b.enemy.pos.z - b.pos.z) < 15) continue;   // adversário perto: luta primeiro
        const z = zones.find((q) => Math.hypot(b.pos.x - q.x, b.pos.z - q.z) < TERR.r);
        if (!z || z.owner === b.team && z.pct[b.team] > 45) continue;
        const cd = (paintCd.get(b) || 0) - dt; paintCd.set(b, cd);
        if (cd > 0) continue;
        const col = PRIMARIES.filter((c) => b.ammo[c] >= 1)[0];
        if (!col) continue;
        paintCd.set(b, 0.6);
        const a = Math.random() * Math.PI * 2, d = Math.random() * (TERR.r - 1), tx = z.x + Math.cos(a) * d, tz = z.z + Math.sin(a) * d;
        const o = { x: b.pos.x, y: muzzleY(b), z: b.pos.z };
        b.spend(col); b.facing = Math.atan2(tx - o.x, tz - o.z);
        w.fire(b, o, { x: tx - o.x, y: b.pos.y - o.y, z: tz - o.z }, col);
      }
    },
    // bots: metade de cada equipa (índices pares) vai para a zona mais próxima que não é sua e passeia lá dentro
    objective(b) {
      if (b.index % 2) return null;
      let best = null, bd = 1e9;
      for (const z of zones) {
        const d = Math.hypot(b.pos.x - z.x, b.pos.z - z.z);
        if ((z.owner !== b.team || d < TERR.r) && d < bd) { bd = d; best = z; }
      }
      if (!best) return null;
      if (bd < TERR.r) {                                                                  // já lá está: anda por dentro da zona
        const wd = best.wander?.get?.(b);
        if (!wd || Math.hypot(b.pos.x - wd.x, b.pos.z - wd.z) < 1.5) { const a = Math.random() * Math.PI * 2, d = Math.random() * (TERR.r - 1.5); (best.wander ||= new Map()).set(b, { x: best.x + Math.cos(a) * d, z: best.z + Math.sin(a) * d, run: false }); }
        return best.wander.get(b);
      }
      return { x: best.x, z: best.z };
    },
    minimap(g, X, Y, now) {
      for (const z of zones) {
        g.beginPath(); g.arc(X(z.z), Y(z.x), (TERR.r / (ARENA.halfZ * 2)) * 322, 0, Math.PI * 2);
        g.fillStyle = z.owner ? teamCss(z.owner) + "66" : "#ffffff22"; g.fill();
        g.lineWidth = 3; g.strokeStyle = z.owner ? teamCss(z.owner) : "#ffffff"; g.stroke();
      }
    },
  };
}

const css = (id) => "#" + COLORS[id].hex.toString(16).padStart(6, "0");
function pick(prev) { const all = paletteColors().filter((c) => c !== prev); return all[Math.floor(Math.random() * all.length)]; }
