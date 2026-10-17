import * as THREE from "three";
import { TEAM, ARENA } from "../base/game-config.js";
import { portraitUrl } from "../personagens/portraits.js";
import { state, $, renderer, scene, hex6 } from "../jogo/game-state.js";

/* ============================================================
   MINIMAPA (canto do ecrã, tecla Tab para o aumentar)
   - bakeMinimap: tira uma fotografia do mapa visto de cima, uma vez por mapa (sem o céu, a tinta, os itens e o que está no ar).
   - updateMinimap: 10 vezes por segundo desenha por cima a tinta, os colegas (com a cara), o baú dourado e o que o radar mostra.
   MM guarda o canvas e as imagens (o mapa de calor do fim do round também o usa).
   ============================================================ */

// ---------- MINIMAPA: vista de cima do mapa (desenhada uma vez) + tinta + os teus colegas com a cara; os adversários não aparecem ----------
export const MM = { w: 644, h: 920, base: null, imgs: new Map(), last: 0, canvas: $("minimap") };
export function bakeMinimap(map, hideAlso = []) {                               // hideAlso: o que também não entra na fotografia (o teu boneco)
  const rt = new THREE.WebGLRenderTarget(MM.w, MM.h);
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const cam = new THREE.OrthographicCamera(-ARENA.halfZ, ARENA.halfZ, ARENA.halfX, -ARENA.halfX, 1, 400);   // na vertical: a tua base em baixo, a dos adversários em cima
  cam.up.set(1, 0, 0); cam.position.set(0, 200, 0); cam.lookAt(0, 0, 0);
  const hide = [state.weather && state.weather.group, ...hideAlso, state.paint && state.paint.mesh, state.paint && state.paint.tops, state.pickups && state.pickups.group].filter(Boolean);
  map.group.traverse((o) => { if (o.name.startsWith("Anim_Sky")) hide.push(o); });   // arco-íris, papagaios, etc. no ar: de cima tapavam o mapa
  const was = hide.map((o) => o.visible), fog = scene.fog;
  hide.forEach((o) => { o.visible = false; }); scene.fog = null;
  const prevTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(prevTarget);
  hide.forEach((o, i) => { o.visible = was[i]; }); scene.fog = fog;
  const px = new Uint8Array(MM.w * MM.h * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, MM.w, MM.h, px);
  rt.dispose();
  const flipped = new Uint8ClampedArray(px.length);                                  // a leitura vem de cabeça para baixo
  for (let y = 0; y < MM.h; y++) flipped.set(px.subarray((MM.h - 1 - y) * MM.w * 4, (MM.h - y) * MM.w * 4), y * MM.w * 4);
  MM.base = document.createElement("canvas"); MM.base.width = MM.w; MM.base.height = MM.h; MM.layer = null;                                   // (o fundo com tinta é refeito para o mapa novo)
  MM.base.getContext("2d").putImageData(new ImageData(flipped, MM.w, MM.h), 0, 0);
}
export function mmImage(url) {
  if (!url) return null;
  let im = MM.imgs.get(url);
  if (!im) { im = new Image(); im.src = url; MM.imgs.set(url, im); }
  return im.complete && im.naturalWidth ? im : null;
}
export function updateMinimap(now) {
  if (!MM.base || now - MM.last < 100) return;                                       // 10 vezes por segundo chega
  MM.last = now;
  // fundo = mapa + tinta, numa imagem à parte que só é refeita quando a tinta muda (no máximo ~3 vezes por segundo):
  // rodar e encolher a textura grande da tinta em cada atualização era o que mais custava no minimapa
  const paintAt = state.paint?.sentAt || 0;
  if (!MM.layer || (paintAt !== MM.layerPaint && now - MM.layerAt > 300)) {
    const L = MM.layer || (MM.layer = Object.assign(document.createElement("canvas"), { width: MM.w, height: MM.h })), lg = L.getContext("2d");
    lg.setTransform(1, 0, 0, 1, 0, 0); lg.clearRect(0, 0, MM.w, MM.h); lg.drawImage(MM.base, 0, 0, MM.w, MM.h);
    if (state.paint) {                                                               // a tinta é rodada 90° para acompanhar o mapa
      const pc = state.paint.canvas;
      lg.globalAlpha = 0.92; lg.setTransform(0, -MM.h / pc.width, MM.w / pc.height, 0, 0, MM.h); lg.drawImage(pc, 0, 0); lg.globalAlpha = 1;
    }
    MM.layerPaint = paintAt; MM.layerAt = now;
  }
  const g = MM.canvas.getContext("2d"), X = (z) => ((z + ARENA.halfZ) / (ARENA.halfZ * 2)) * 322, Y = (x) => ((ARENA.halfX - x) / (ARENA.halfX * 2)) * 460;       // recebem (z) e (x) do jogo
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, MM.w, MM.h); g.drawImage(MM.layer, 0, 0);
  g.setTransform(MM.w / 322, 0, 0, MM.h / 460, 0, 0);                                   // desenha em coordenadas 322x460 (o canvas tem o dobro da resolução)
  for (const c of state.world.combatants) {                                          // só os colegas de equipa
    if (c.team !== "A" || c.isPlayer || !c.alive) continue;
    const x = X(c.pos.z), y = Y(c.pos.x), r = 17, im = mmImage(portraitUrl(state.rosters.A[c.index], TEAM.A.color));
    g.save(); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.closePath();
    g.fillStyle = hex6(TEAM.A.color); g.fill(); g.clip();
    if (im) g.drawImage(im, x - r, y - r, r * 2, r * 2);
    g.restore();
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = "#fff"; g.stroke();
  }
  if (state.radarT > 0) {                                                            // bónus: os adversários aparecem no minimapa
    const pulse = 1 + 0.18 * Math.sin(now / 90);
    for (const c of state.world.combatants) {
      if (c.team === "A" || !c.alive || c.hidden) continue;
      const x = X(c.pos.z), y = Y(c.pos.x), r = 16 * pulse, im = mmImage(portraitUrl(state.rosters.B[c.index], TEAM.B.color));
      g.save(); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.closePath();
      g.fillStyle = hex6(TEAM.B.color); g.fill(); g.clip();
      if (im) g.drawImage(im, x - r, y - r, r * 2, r * 2);
      g.restore();
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.lineWidth = 3.5; g.strokeStyle = "#ff3b4a"; g.stroke();
    }
  }
  if (state.tracked.length) {                                                        // melhoria: adversários rastreados (sempre visíveis)
    for (const i of state.tracked) {
      const c = state.world.combatants.find((u) => u.team === "B" && u.index === i);
      if (!c || !c.alive || c.hidden) continue;
      const x = X(c.pos.z), y = Y(c.pos.x), r = 16, im = mmImage(portraitUrl(state.rosters.B[i], TEAM.B.color));
      g.save(); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.closePath(); g.fillStyle = hex6(TEAM.B.color); g.fill(); g.clip();
      if (im) g.drawImage(im, x - r, y - r, r * 2, r * 2);
      g.restore();
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.lineWidth = 3.5; g.strokeStyle = "#ff8a1f"; g.stroke();
      g.beginPath(); g.arc(x, y, r + 6, 0, Math.PI * 2); g.lineWidth = 2; g.setLineDash([4, 4]); g.strokeStyle = "#ffd21f"; g.stroke(); g.setLineDash([]);
    }
  }
  state.features?.minimap?.(g, X, Y, now);                                           // poças do Estúdio, canhões...
  if (state.tutorial && !state.tutorial.finished) {                                  // tutorial: os baús aparecem no minimapa
    for (const c of state.map.chests) {
      if (c.state !== "ready") continue;
      const x = X(c.z), y = Y(c.x);
      g.fillStyle = "#ffd21f"; g.strokeStyle = "#1a1033"; g.lineWidth = 3; g.beginPath(); g.rect(x - 7, y - 7, 14, 14); g.fill(); g.stroke();
    }
  }
  for (const c of state.map.chests) {                                               // baú dourado: estrela a pulsar
    if (!c.golden) continue;
    const x = X(c.z), y = Y(c.x), r = 13 * (1 + 0.2 * Math.sin(now / 120));
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = "#ffd21f"; g.fill(); g.lineWidth = 3; g.strokeStyle = "#1a1033"; g.stroke();
  }
  const p = state.player, f = p.facing, x = X(p.pos.z), y = Y(p.pos.x);              // tu: seta amarela a apontar para onde olhas
  g.save(); g.translate(x, y); g.rotate(Math.PI / 2 - f);
  g.beginPath(); g.moveTo(0, -17); g.lineTo(12, 12); g.lineTo(0, 6); g.lineTo(-12, 12); g.closePath();
  g.fillStyle = "#ffd21f"; g.fill(); g.lineWidth = 3; g.strokeStyle = "#1a1033"; g.stroke(); g.restore();
}
