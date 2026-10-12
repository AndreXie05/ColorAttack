/* ============================================================
   ANIMAÇÃO DO BONECO (só visual): andar/correr proporcional à velocidade, inclinação ao correr,
   respirar parado, pose de salto (braços para cima, pernas encolhidas) e "esmagar" ao aterrar.
   Funciona com o boneco simples e com os modelos do Blender (partes legL, legR, armL, armR em userData).
   ============================================================ */
const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// ctx = { speed (m/s no chão), maxSpeed, onGround, vy, landed, impact }
export function animateCharacter(dummy, ctx, dt, t) {
  const u = dummy.userData;
  if (!u.legL) return;
  const a = u.anim || (u.anim = { phase: 0, amp: 0, air: 0, squash: 0, lean: 0 });
  const kf = (rate) => 1 - Math.exp(-dt * rate);

  const run = clamp01(ctx.speed / ctx.maxSpeed);
  a.phase += dt * (5 + ctx.speed * 0.95);
  a.amp = lerp(a.amp, ctx.onGround ? run * 0.9 : 0, kf(14));
  a.air = lerp(a.air, ctx.onGround ? 0 : 1, kf(16));
  a.lean = lerp(a.lean, ctx.onGround ? run * 0.2 : 0.1 + (ctx.vy < 0 ? 0 : 0.06), kf(10));
  if (ctx.landed) a.squash = Math.min(1, ctx.impact / 16);
  a.squash *= Math.exp(-dt * 9);

  const s = Math.sin(a.phase), breathe = Math.sin(t * 2.3);
  const idle = 1 - clamp01(a.amp * 3);
  // pose no chão
  let lL = s * a.amp, lR = -s * a.amp;
  let aL = -s * a.amp * 0.9 + breathe * 0.05 * idle, aR = -0.55 + s * a.amp * 0.25 + breathe * 0.03 * idle;   // braço direito segura a arma
  // pose no ar: braços para cima/lado, pernas encolhidas
  const rising = ctx.vy > 0;
  const airL = -0.45, airR = 0.5, airArmL = rising ? -2.3 : -1.2, airArmR = rising ? -1.9 : -1.0;
  u.legL.rotation.x = lerp(lL, airL, a.air); u.legR.rotation.x = lerp(lR, airR, a.air);
  u.armL.rotation.x = lerp(aL, airArmL, a.air); u.armR.rotation.x = lerp(aR, airArmR, a.air);

  // inclinação do corpo (a rotação em y é a direção do boneco; a inclinação é em torno do eixo x local)
  dummy.rotation.order = "YXZ";
  dummy.rotation.x = a.lean;

  // esticar a subir, esmagar ao aterrar, respirar parado
  const stretch = ctx.onGround ? 0 : clamp01(Math.abs(ctx.vy) / 14) * 0.07;
  const sy = 1 + stretch - a.squash * 0.22 + breathe * 0.012 * idle;
  const sxz = 1 - stretch * 0.5 + a.squash * 0.14;
  dummy.scale.set(sxz, sy, sxz);
}
