/* ============================================================
   MOVIMENTO DO JOGADOR (lógica pura, sem DOM: fácil de testar e de reutilizar nos bots)
   - Inércia: a velocidade aproxima-se da pretendida (arranque e travagem suaves).
   - Controlo no ar: muda de direção devagar, mas não perde logo o balanço.
   - Salto: altura variável (solta o espaço cedo = salto curto), tolerância ao sair de uma plataforma
     ("coyote time") e salto antecipado ("jump buffer": carregar um pouco antes de aterrar).
   - Quedas mais rápidas do que as subidas, para o salto ter peso.
   ============================================================ */
export const MOTION = {
  walk: 7, run: 11,
  groundAccel: 62, groundDecel: 48,      // m/s² no chão (com / sem direção pressionada)
  airAccel: 24, airDecel: 4,             // m/s² no ar
  jump: 9, gravityUp: 24, gravityDown: 36, jumpCutGravity: 2.4,
  coyote: 0.1, buffer: 0.12,
  runJumpBoost: 1.1,                     // saltar a correr leva um pouco mais longe
  climb: 4.5, slide: 2.5,                // escadas de mão: sobe a 4,5 m/s (a andar contra a escada), escorrega a 2,5 m/s se largares
};

export function createMotionState() {
  return { vx: 0, vz: 0, vy: 0, onGround: true, coyote: 0, buffer: 0, jumping: false, peakY: 0, bounced: false, climbing: false };
}

// dir = {x, z} (já normalizado ou zero); input = { run, jumpPressed, jumpHeld, floor(x,z,y), ceil(x,z,y), ladder (1 = sobe, -1 = escorrega, 0 = não) }.
// pos é um THREE.Vector3 (ou {x,y,z}). Devolve eventos: { jumped, landed, impact, fall } (fall = metros caídos ao aterrar).
export function stepMotion(m, pos, dir, input, dt, cfg = MOTION) {
  const out = { jumped: false, landed: false, impact: 0, fall: 0 };
  if (!(dt > 0)) return out;                              // dt inválido (0, negativo ou NaN): não faz nada
  const hasInput = dir.x !== 0 || dir.z !== 0;
  const speed = input.run ? cfg.run : cfg.walk;
  const tx = dir.x * speed, tz = dir.z * speed;

  // 1) velocidade horizontal aproxima-se da pretendida
  const accel = m.onGround ? (hasInput ? cfg.groundAccel : cfg.groundDecel) : (hasInput ? cfg.airAccel : cfg.airDecel);
  const dx = tx - m.vx, dz = tz - m.vz, dl = Math.hypot(dx, dz), maxd = accel * dt;
  if (dl <= maxd || dl === 0) { m.vx = tx; m.vz = tz; } else { m.vx += (dx / dl) * maxd; m.vz += (dz / dl) * maxd; }

  // 2) salto com tolerâncias
  m.buffer = input.jumpPressed ? cfg.buffer : Math.max(0, m.buffer - dt);
  m.coyote = m.onGround ? cfg.coyote : Math.max(0, m.coyote - dt);
  if (m.buffer > 0 && (m.onGround || m.coyote > 0)) {
    m.vy = cfg.jump; m.onGround = false; m.coyote = 0; m.buffer = 0; m.jumping = true; out.jumped = true;
    if (input.run) { m.vx *= cfg.runJumpBoost || 1; m.vz *= cfg.runJumpBoost || 1; }
  }

  // 3) gravidade (solta o espaço a subir = cai mais depressa = salto mais curto); na escada de mão sobe ou escorrega devagar
  m.climbing = !!input.ladder && !out.jumped;
  if (m.climbing) {
    m.vy = input.ladder > 0 ? cfg.climb || 4.5 : -(cfg.slide || 2.5); m.jumping = false; m.peakY = pos.y;
  } else {
    let g = m.vy > 0 ? cfg.gravityUp : cfg.gravityDown;
    if (m.vy > 0 && m.jumping && !input.jumpHeld) g *= cfg.jumpCutGravity;
    m.vy -= g * dt;
  }
  // chão: 0, ou o topo de uma plataforma baixa (input.floor(x, z, y) devolve a altura onde o jogador pode pousar)
  const nx = pos.x + m.vx * dt, nz = pos.z + m.vz * dt;
  const floor = input.floor ? input.floor(nx, nz, pos.y) : 0;
  if (m.onGround && m.vy <= 0 && pos.y > floor && pos.y - floor < 0.46) pos.y = floor;   // a descer uma rampa / degrau (até 0,45 m): fica colado ao chão
  if (m.onGround && pos.y > floor + 0.02) { m.onGround = false; m.peakY = pos.y; }   // saiu da borda: cai
  if (m.onGround) m.peakY = pos.y;
  pos.y += m.vy * dt;
  if (!m.onGround) m.peakY = Math.max(m.peakY ?? pos.y, pos.y);
  const ceil = input.ceil ? input.ceil(nx, nz, pos.y) : Infinity;                // ponte por cima: bate com a cabeça
  if (pos.y + 2.0 > ceil && pos.y < ceil) { pos.y = Math.max(floor, ceil - 2.0); if (m.vy > 0) m.vy = 0; }
  if (pos.y <= floor) {
    if (!m.onGround) {
      out.landed = true; out.impact = Math.max(0, -m.vy);
      if (!m.bounced) out.fall = Math.max(0, (m.peakY ?? floor) - floor);           // os saltos de trampolim não contam como queda
    }
    pos.y = floor; m.vy = 0; m.onGround = true; m.jumping = false; m.bounced = false; m.peakY = floor;
  }

  // 4) deslocamento horizontal
  pos.x += m.vx * dt; pos.z += m.vz * dt;
  return out;
}

// Depois de resolver as colisões: se uma parede travou o movimento, a velocidade passa a ser a real
// (assim o jogador desliza ao longo da parede em vez de "colar" nela).
export function collisionFeedback(m, before, pos, dt) {
  if (!(dt > 0)) return;
  // a colisão empurrou o jogador (correção = onde ficou - onde iria ficar): tira à velocidade só a parte que ia contra a parede
  const cx = pos.x - (before.x + m.vx * dt), cz = pos.z - (before.z + m.vz * dt), cl = Math.hypot(cx, cz);
  if (cl < 1e-4) return;
  const nx = cx / cl, nz = cz / cl, vn = m.vx * nx + m.vz * nz;
  if (vn < 0) { m.vx -= vn * nx; m.vz -= vn * nz; }
}
