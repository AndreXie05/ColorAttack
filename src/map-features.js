import * as THREE from "three";
import { COLORS, paletteColors, PRIMARIES } from "./colors.js";
import { mat } from "./materials-and-geometry.js";
import { isProtected } from "./combat.js";

/* ============================================================
   COISAS ESPECIAIS DE ALGUNS MAPAS (só existem nos mapas indicados em FEATURES)
   - Fonte de tinta (Parque, Fábrica): de 20 em 20 s avisa (anel no chão com a cor) e depois lança tinta:
     quem estiver na praça à volta fica dessa cor (colegas e adversários; quem está protegido não).
   - Pontes com interruptor (Castelo): ao lado do rio há placas com uma cor. Acertar na placa com essa cor
     faz a ponte subir do fundo do rio durante uns segundos. No fim treme, avisa e afunda-se outra vez:
     quem ainda estiver em cima vai ao fundo com ela e é eliminado (caiu ao rio).
   Tudo é leve: poucas malhas simples, criadas uma vez por mapa, e sem trabalho quando nada está a acontecer.
   ============================================================ */
export const FEATURES = {
  parque:  { fountains: [{ x: 0, z: 0, y: 1.2, top: 3.4, r: 7.5 }] },
  fabrica: { fountains: [{ x: 0, z: 0, y: 1.2, top: 3.9, r: 7 }] },
  castelo: { bridges: [{ z: 20 }, { z: -20 }] },
};
const FOUNTAIN = { every: 20, warn: 3 };                     // s entre jatos; aviso antes do jato
const BRIDGE = { open: 25, warn: 4, halfX: 3.6, halfZ: 1.4, top: 0.85, sunk: -1.4, ramp: 3, rise: 1.4, sink: 2.2 };   // s aberta, aviso antes de afundar, medidas e altura no fundo do rio (m), s a subir / a afundar

// ctx = { scene, world, map, colliders, onColor(c, colorId), toast(text, color), playerPos() }
export function setupMapFeatures(mapId, ctx) {
  const def = FEATURES[mapId];
  if (!def) return null;
  const group = new THREE.Group(); ctx.scene.add(group);
  const disposables = [];
  const fountains = (def.fountains || []).map((f, i) => makeFountain(f, i, group, disposables, ctx));
  const bridges = (def.bridges || []).map((b) => makeBridge(b, group, disposables, ctx));
  return {
    update(dt, now) { for (const f of fountains) f.update(dt, now); for (const b of bridges) b.update(dt, now); },
    dispose() { ctx.scene.remove(group); for (const d of disposables) d.dispose(); ctx.world.targets.length = 0; },
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
      // jato: partículas para o ar, manchas no chão (só visuais) e quem está na praça fica desta cor
      const w = ctx.world;
      w.burst(f.x, f.top + 1, f.z, color, 24);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.random(); w.splat(f.x + Math.cos(a) * f.r * 0.6, f.z + Math.sin(a) * f.r * 0.6, color, 1.6, true); }
      for (const c of w.combatants) {
        if (!c.alive || isProtected(c, w.t) || c.colorId === color) continue;
        if (Math.hypot(c.pos.x - f.x, c.pos.z - f.z) > f.r || Math.abs(c.pos.y - f.y) > 2.5) continue;
        c.colorId = color; ctx.onColor(c, color);
      }
      t = FOUNTAIN.every; warned = false; color = pick(color); paintBall();
    },
  };
}

// ---------- ponte com interruptor ----------
function makeBridge(b, group, disposables, ctx) {
  const B = BRIDGE, z = b.z;
  // rampas fixas nas duas margens (sobem do chão até ao tabuleiro)
  ctx.colliders.push({ minX: -B.halfX - B.ramp, maxX: -B.halfX, minZ: z - B.halfZ, maxZ: z + B.halfZ, top: B.top, ramp: { axis: "x", y0: 0, y1: B.top } });
  ctx.colliders.push({ minX: B.halfX, maxX: B.halfX + B.ramp, minZ: z - B.halfZ, maxZ: z + B.halfZ, top: B.top, ramp: { axis: "x", y0: B.top, y1: 0 } });
  const wood = mat(0x9a6a3a);
  const rampGeo = new THREE.BoxGeometry(B.ramp, 0.2, B.halfZ * 2), deckGeo = new THREE.BoxGeometry(B.halfX * 2, 0.25, B.halfZ * 2);
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(rampGeo, wood); r.position.set(s * (B.halfX + B.ramp / 2), B.top / 2, z); r.rotation.z = -s * Math.atan2(B.top, B.ramp); r.receiveShadow = true; group.add(r);
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
  function hit(shot, owner) {
    if (open > 0) return;
    if (shot !== color) { if (owner?.isPlayer) ctx.toast(`🎯 A placa só abre com ${COLORS[color].name}`, css(color)); return; }
    open = B.open; setBoards(0xffffff);
    if (owner?.isPlayer || Math.abs(ctx.playerPos().z - z) < 12) ctx.toast(`🌉 ${owner?.isPlayer ? "Abriste" : "Abriram"} a ponte sobre o rio durante ${B.open} s!`, "#ffd21f");
  }
  const onDeck = (c) => c.alive && Math.abs(c.pos.x) < B.halfX && Math.abs(c.pos.z - z) < B.halfZ && c.pos.y > 0.3;
  let warned = false;
  const splash = () => { for (const x of [-2.4, 0, 2.4]) ctx.world.burst(x, 0.2, z, "azul", 8); };
  return {
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
        color = PRIMARIES[Math.floor(Math.random() * PRIMARIES.length)]; setBoards(COLORS[color].hex);
      }
    },
  };
}

const css = (id) => "#" + COLORS[id].hex.toString(16).padStart(6, "0");
function pick(prev) { const all = paletteColors().filter((c) => c !== prev); return all[Math.floor(Math.random() * all.length)]; }
