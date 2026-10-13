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

// Medidas da perna do modelo (unidades do Blender, antes da escala): anca a 0,78; coxa 0,36; canela até à sola 0,42
const HIP = 0.78, THIGH = 0.36, SHIN = 0.42, TOE = 0.3;
// Altura a que fica a anca com a coxa a um ângulo `hip` e o joelho dobrado `knee` (rad): o ponto mais baixo do pé toca no chão
const legReach = (hip, knee) => {
  const a = hip + knee;                                                   // ângulo da canela (positivo = para trás)
  return THIGH * Math.cos(hip) + SHIN * Math.cos(a) + Math.max(0, TOE * Math.sin(a));   // com a canela para trás, a ponta do pé desce
};

// ctx = { speed (m/s no chão), maxSpeed, onGround, vy, landed, impact, climbing, crouching }
export function animateCharacter(dummy, ctx, dt, t) {
  const u = dummy.userData;
  if (!u.legL) return;
  const a = u.anim || (u.anim = { phase: 0, amp: 0, air: 0, squash: 0, lean: 0 });
  a.wasGround = ctx.onGround;
  const kf = (rate) => 1 - Math.exp(-dt * rate);
  const S = CONFIG.player.scale, knees = !!(u.shinL && u.shinR);

  // --- passada: cadência ligada à velocidade (passos mais rápidos a correr), amplitude maior a correr do que a andar
  const run = clamp01(ctx.speed / ctx.maxSpeed);
  const moving = clamp01(ctx.speed / 1.5);                                    // 0 parado -> 1 a andar
  a.crouch = lerp(a.crouch || 0, ctx.crouching ? 1 : 0, kf(12));
  const cadence = 1.0 + ctx.speed * 0.17;                                     // passos/s por perna: andar ~2,2 Hz, correr ~2,9 Hz
  a.phase += dt * Math.PI * 2 * cadence * (moving > 0.05 ? 1 : 0.4);
  const stride = lerp(0.45, 0.85, run) * lerp(1, 0.35, a.crouch);            // abertura das pernas (rad)
  a.amp = lerp(a.amp, ctx.onGround ? moving * stride : 0, kf(12));
  a.air = lerp(a.air, ctx.onGround ? 0 : 1, kf(16));
  a.lean = lerp(a.lean, ctx.onGround ? 0.03 + run * run * 0.18 : 0.1 + (ctx.vy < 0 ? 0 : 0.06), kf(8));
  if (ctx.landed) a.squash = Math.min(1, ctx.impact / 16);
  a.squash *= Math.exp(-dt * 9);

  const s = Math.sin(a.phase), c = Math.cos(a.phase), breathe = Math.sin(t * 2.3);
  const idle = 1 - clamp01(a.amp * 3);
  // ancas: a perna da frente estica mais do que a de trás; joelhos: dobram na perna que está a avançar (no ar)
  const swing = (v) => (v < 0 ? v * 1.15 : v * 0.8);
  let hipL = swing(s) * a.amp, hipR = swing(-s) * a.amp;
  const kneeK = lerp(1.3, 1.9, run) * a.amp;
  let kneeL = 0.06 + kneeK * Math.max(0, -c), kneeR = 0.06 + kneeK * Math.max(0, c);
  let armL = -s * a.amp * lerp(0.75, 1.0, run) + breathe * 0.05 * idle;
  let armR = -0.55 + s * a.amp * 0.18 + breathe * 0.03 * idle;                // braço direito segura a arma (balança pouco)
  // agachar: parado = um joelho no chão (o direito, canela deitada para trás) e a perna esquerda à frente, com o pé no chão;
  // a andar agachado = joelhos bem dobrados (não se anda de joelho no chão)
  const cr = knees ? a.crouch : 0;
  a.kneel = lerp(a.kneel || 0, ctx.crouching && moving < 0.15 ? 1 : 0, kf(10));
  const kn = a.kneel * cr;
  const cHipL = lerp(-1.55 + s * a.amp * 0.6, -1.5, a.kneel), cHipR = lerp(-1.35 - s * a.amp * 0.6, 0.12, a.kneel);
  const cKneeL = lerp(2.7 + Math.max(0, -c) * a.amp, 1.5, a.kneel), cKneeR = lerp(2.5 + Math.max(0, c) * a.amp, 1.88, a.kneel);   // (canela de trás um pouco levantada: pé em bicos)
  hipL = lerp(hipL, cHipL, cr); hipR = lerp(hipR, cHipR, cr);
  kneeL = lerp(kneeL, cKneeL, cr); kneeR = lerp(kneeR, cKneeR, cr);
  // no ar: pernas encolhidas, braços para cima
  const rising = ctx.vy > 0;
  hipL = lerp(hipL, -0.6, a.air); hipR = lerp(hipR, 0.35, a.air);
  kneeL = lerp(kneeL, 1.0, a.air); kneeR = lerp(kneeR, 0.6, a.air);
  armL = lerp(armL, rising ? -2.3 : -1.2, a.air); armR = lerp(armR, rising ? -1.9 : -1.0, a.air);

  // escada de mão: virado para a escada, braços acima da cabeça e pernas alternadas (mão esquerda com pé direito)
  a.climb = lerp(a.climb || 0, ctx.climbing ? 1 : 0, kf(14));
  if (a.climb > 0.01) {
    a.cphase = (a.cphase || 0) + dt * (ctx.vy > 0 ? 9 : ctx.vy < 0 ? 4 : 0);
    const k = Math.sin(a.cphase);
    hipL = lerp(hipL, -0.75 - k * 0.55, a.climb); hipR = lerp(hipR, -0.75 + k * 0.55, a.climb);
    kneeL = lerp(kneeL, 1.1 + k * 0.5, a.climb); kneeR = lerp(kneeR, 1.1 - k * 0.5, a.climb);
    armL = lerp(armL, -2.75 + k * 0.45, a.climb); armR = lerp(armR, -2.75 - k * 0.45, a.climb);
  }
  // agarrar a borda: um instante com os braços para a frente e um joelho a subir
  a.mantle = (a.mantle || 0) * Math.exp(-dt * 7);
  if (a.mantle > 0.02) {
    armL = lerp(armL, -1.6, a.mantle); armR = lerp(armR, -1.6, a.mantle);
    hipL = lerp(hipL, -1.2, a.mantle); kneeL = lerp(kneeL, 1.6, a.mantle); hipR = lerp(hipR, 0.2, a.mantle);
  }

  // tronco: inclina-se um pouco a partir da anca ao agachar (os ombros vão com ele); os braços ficam com a arma apontada em frente
  const bend = cr * lerp(0.38, 0.12, a.kneel);                               // de joelho no chão o tronco fica quase direito
  armL = lerp(armL, -0.75, cr); armR = lerp(armR, -0.5, cr);
  if (u.body && u.rest && u.rest.body) {
    const tilt = (o, rest) => {                                            // roda à volta da anca (0, HIP, 0)
      const y = rest.y - HIP, z = rest.z, cb = Math.cos(bend), sb = Math.sin(bend);
      o.position.set(rest.x, HIP + y * cb - z * sb, y * sb + z * cb);
    };
    tilt(u.body, u.rest.body); u.body.rotation.x = bend;
    if (u.rest.armL) tilt(u.armL, u.rest.armL);
    if (u.rest.armR) tilt(u.armR, u.rest.armR);
  }
  u.legL.rotation.x = hipL; u.legR.rotation.x = hipR;
  u.armL.rotation.x = armL; u.armR.rotation.x = armR;
  if (knees) { u.shinL.rotation.x = kneeL; u.shinR.rotation.x = kneeR; }

  // corpo: a anca desce o que as pernas dobradas mandam (no chão), o peso passa de uma perna para a outra e a anca roda com a passada
  const ground = (1 - a.air) * (1 - a.climb);
  const legDrop = HIP - Math.max(legReach(hipL, kneeL), legReach(hipR, kneeR));
  const drop = knees ? lerp(legDrop, HIP - (THIGH + 0.08), kn) * ground : 0;   // de joelho: a anca fica à altura da coxa + o joelho (no chão)
  dummy.rotation.order = "YXZ";
  dummy.rotation.x = lerp(lerp(a.lean * (1 - cr), 0.02, a.climb), 0.3, a.mantle || 0);
  dummy.rotation.z = s * 0.045 * a.amp * ground;
  dummy.rotation.y += s * 0.07 * a.amp * ground;
  dummy.position.y -= drop * S;

  // esticar a subir, esmagar ao aterrar, respirar parado; sem joelhos (boneco simples) agachar = encolher
  const squat = knees ? 0 : a.crouch;
  const stretch = ctx.onGround || ctx.climbing ? 0 : clamp01(Math.abs(ctx.vy) / 14) * 0.07;
  const sy = (1 + stretch - a.squash * 0.22 + breathe * 0.012 * idle) * lerp(1, 0.66, squat);
  const sxz = (1 - stretch * 0.5 + a.squash * 0.14) * lerp(1, 1.06, squat);
  dummy.scale.set(sxz * S, sy * S, sxz * S);
}
