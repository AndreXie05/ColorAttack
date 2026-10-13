/* ============================================================
   ANIMAÇÃO DO BONECO (só visual): andar/correr proporcional à velocidade, inclinação ao correr,
   respirar parado, pose de salto (braços para cima, pernas encolhidas), "esmagar" ao aterrar,
   trepar escadas de mão (braços e pernas alternados), agarrar a borda ao subir para cima de um objeto e agachar.
   A passada é realista: cadência que acompanha a velocidade, a perna da frente estica mais, o corpo sobe e desce em
   cada passo, o peso passa de uma perna para a outra e a anca roda um pouco. O tamanho vem de CONFIG.player.scale.
   Funciona com o boneco simples e com os modelos do Blender (partes legL, legR, armL, armR em userData).
   ============================================================ */
import { CONFIG } from "./game-config.js";

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Altura visual do boneco: ao subir um degrau a andar (ou agarrar uma borda) sobe depressa mas sem "teletransporte".
// Devolve a altura a usar no modelo (a posição real do jogo não muda). Também marca u.anim.mantle ao agarrar uma borda.
export function visualY(dummy, y, onGround, dt) {
  const u = dummy.userData, a = u.anim || (u.anim = { phase: 0, amp: 0, air: 0, squash: 0, lean: 0 });
  const was = a.wasGround; a.wasGround = onGround;
  if (a.visY === undefined || !onGround || y <= a.visY || y - a.visY > 1.2) { a.visY = y; return y; }   // no ar, a descer ou subidas grandes: segue logo
  if (!was && y - a.visY > 0.12) a.mantle = 1;                                                     // vinha no ar e pousou numa borda mais alta: agarrou-a
  a.visY += (y - a.visY) * (1 - Math.exp(-dt * 16));
  if (y - a.visY < 0.01) a.visY = y;
  return a.visY;
}

// ctx = { speed (m/s no chão), maxSpeed, onGround, vy, landed, impact, climbing, crouching }
export function animateCharacter(dummy, ctx, dt, t) {
  const u = dummy.userData;
  if (!u.legL) return;
  const a = u.anim || (u.anim = { phase: 0, amp: 0, air: 0, squash: 0, lean: 0 });
  a.wasGround = ctx.onGround;
  const kf = (rate) => 1 - Math.exp(-dt * rate);
  const S = CONFIG.player.scale;

  // --- passada: cadência ligada à velocidade (passos mais rápidos a correr), amplitude maior a correr do que a andar
  const run = clamp01(ctx.speed / ctx.maxSpeed);
  const moving = clamp01(ctx.speed / 1.5);                                    // 0 parado -> 1 a andar
  a.crouch = lerp(a.crouch || 0, ctx.crouching ? 1 : 0, kf(14));
  const cadence = 1.0 + ctx.speed * 0.17;                                     // passos/s por perna: andar ~2,2 Hz, correr ~2,9 Hz
  a.phase += dt * Math.PI * 2 * cadence * (moving > 0.05 ? 1 : 0.4);
  const stride = lerp(0.42, 0.82, run) * lerp(1, 0.55, a.crouch);            // abertura das pernas (rad)
  a.amp = lerp(a.amp, ctx.onGround ? moving * stride : 0, kf(12));
  a.air = lerp(a.air, ctx.onGround ? 0 : 1, kf(16));
  a.lean = lerp(a.lean, ctx.onGround ? 0.03 + run * run * 0.2 : 0.1 + (ctx.vy < 0 ? 0 : 0.06), kf(8));
  if (ctx.landed) a.squash = Math.min(1, ctx.impact / 16);
  a.squash *= Math.exp(-dt * 9);

  const s = Math.sin(a.phase), c2 = Math.cos(a.phase * 2), breathe = Math.sin(t * 2.3);
  const idle = 1 - clamp01(a.amp * 3);
  // pernas: a que vai à frente estica mais do que a que fica atrás (passo natural); braço esquerdo balança ao contrário da perna esquerda
  const swing = (v) => (v < 0 ? v * 1.15 : v * 0.8);
  let lL = swing(s) * a.amp, lR = swing(-s) * a.amp;
  let aL = -s * a.amp * lerp(0.75, 1.0, run) + breathe * 0.05 * idle;
  let aR = -0.55 + s * a.amp * 0.18 + breathe * 0.03 * idle;                  // braço direito segura a arma (balança pouco)
  // agachado: pernas dobradas para a frente, braço esquerdo a segurar a arma
  lL = lerp(lL, lL - 0.55, a.crouch); lR = lerp(lR, lR - 0.25, a.crouch);
  aL = lerp(aL, -0.95 + s * a.amp * 0.3, a.crouch); aR = lerp(aR, -0.95, a.crouch);
  // pose no ar: braços para cima/lado, pernas encolhidas
  const rising = ctx.vy > 0;
  const airL = -0.45, airR = 0.5, airArmL = rising ? -2.3 : -1.2, airArmR = rising ? -1.9 : -1.0;
  let legL = lerp(lL, airL, a.air), legR = lerp(lR, airR, a.air);
  let armL = lerp(aL, airArmL, a.air), armR = lerp(aR, airArmR, a.air);

  // escada de mão: virado para a escada, braços bem acima da cabeça e pernas alternadas (mão esquerda com pé direito)
  a.climb = lerp(a.climb || 0, ctx.climbing ? 1 : 0, kf(14));
  if (a.climb > 0.01) {
    a.cphase = (a.cphase || 0) + dt * (ctx.vy > 0 ? 9 : ctx.vy < 0 ? 4 : 0);
    const c = Math.sin(a.cphase);
    const cArmL = -2.75 + c * 0.45, cArmR = -2.75 - c * 0.45, cLegL = -0.75 - c * 0.55, cLegR = -0.75 + c * 0.55;
    legL = lerp(legL, cLegL, a.climb); legR = lerp(legR, cLegR, a.climb);
    armL = lerp(armL, cArmL, a.climb); armR = lerp(armR, cArmR, a.climb);
  }
  // agarrar a borda: um instante com os braços para a frente e uma perna a subir
  a.mantle = (a.mantle || 0) * Math.exp(-dt * 7);
  if (a.mantle > 0.02) {
    armL = lerp(armL, -1.6, a.mantle); armR = lerp(armR, -1.6, a.mantle);
    legL = lerp(legL, -1.1, a.mantle); legR = lerp(legR, 0.2, a.mantle);
  }
  u.legL.rotation.x = legL; u.legR.rotation.x = legR;
  u.armL.rotation.x = armL; u.armR.rotation.x = armR;

  // corpo: inclinação para a frente (mais a correr e agachado), peso a passar de uma perna para a outra (rolar),
  // anca a rodar com a passada e o corpo a subir e descer em cada passo (mais alto quando as pernas se cruzam)
  const ground = (1 - a.air) * (1 - a.climb);
  dummy.rotation.order = "YXZ";
  dummy.rotation.x = lerp(lerp(a.lean + a.crouch * 0.22, 0.02, a.climb), 0.3, a.mantle || 0);
  dummy.rotation.z = s * 0.045 * a.amp * ground;
  dummy.rotation.y += s * 0.07 * a.amp * ground;
  dummy.position.y += (c2 * 0.5 + 0.5) * 0.09 * a.amp * ground * S - a.crouch * 0.02;

  // esticar a subir, esmagar ao aterrar, respirar parado, encolher agachado; tudo à escala do boneco (CONFIG.player.scale)
  const stretch = ctx.onGround || ctx.climbing ? 0 : clamp01(Math.abs(ctx.vy) / 14) * 0.07;
  const sy = (1 + stretch - a.squash * 0.22 + breathe * 0.012 * idle) * lerp(1, 0.66, a.crouch);
  const sxz = (1 - stretch * 0.5 + a.squash * 0.14) * lerp(1, 1.06, a.crouch);
  dummy.scale.set(sxz * S, sy * S, sxz * S);
}
