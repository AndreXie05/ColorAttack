/* ============================================================
   ALTURAS DO MAPA (plataformas, degraus, rampas, pontes, escadas de mão, tapetes, trampolins, carrosséis)
   Cada obstáculo (collider) tem um topo onde se pode pousar:
     caixa   { minX, maxX, minZ, maxZ, top }
     cilindro{ x, z, r, top }
     rampa   { minX, maxX, minZ, maxZ, top, ramp: { axis: "x" | "z", y0, y1 } }   (altura y0 em min -> y1 em max)
   Extras opcionais:
     bottom  altura de baixo (pontes e passadiços: passa-se por baixo; por defeito 0)
     push    { x, z }  tapete rolante: quem está em cima é empurrado (m/s)
     spin    rad/s     plataforma redonda que roda (carrossel): quem está em cima roda com ela
     bounce  m/s       trampolim: quem pousa em cima é atirado ao ar com esta velocidade
   Escadas de mão (map.ladders: { minX, maxX, minZ, maxZ, top }): zonas onde se sobe ao andar contra a escada.
   Como na realidade:
     - degraus até STEP sobem-se a andar (e no ar agarras a borda se o topo estiver a menos de STEP dos pés);
     - o que for mais baixo do que o alcance do salto (~2,1 m) dá para saltar para cima;
     - cair de CONFIG.fallDeath metros ou mais (contado desde o ponto mais alto) elimina logo.
   ============================================================ */
export const STEP = 0.45;              // m: sobe sem saltar
export const FOOT = 0.3;               // m: os pés pousam numa borda a esta distância do centro
export const REACH = 2.1;              // m: o mais alto onde um salto chega (salto ~1,69 m + agarrar a borda)
export const HEAD = 2.0;               // m: altura do boneco de pé (bate com a cabeça em pontes baixas; ver CONFIG.player.scale)

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function inside(c, x, z, pad = 0) {
  return c.r !== undefined ? Math.hypot(x - c.x, z - c.z) < c.r + pad
    : x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad;
}

// Altura do topo do obstáculo no ponto (x, z) (nas rampas varia; fora da caixa usa o ponto mais próximo)
export function topAt(c, x, z) {
  const r = c.ramp;
  if (!r) return c.top;
  const t = r.axis === "x" ? (x - c.minX) / (c.maxX - c.minX) : (z - c.minZ) / (c.maxZ - c.minZ);
  return r.y0 + (r.y1 - r.y0) * clamp01(t);
}

// Obstáculo onde os pés pousam em (x, z), para quem está à altura y (o topo mais alto que não esteja acima de y + STEP), ou null
export function standingOn(colliders, x, z, y) {
  let best = null, bh = 0;
  for (const c of colliders) {
    if (!inside(c, x, z, FOOT)) continue;
    const h = topAt(c, x, z);
    if (h > bh && h <= y + STEP && (c.bottom || 0) <= y + STEP) { bh = h; best = c; }
  }
  return best;
}

// Altura do chão onde os pés pousam
export function floorAt(colliders, x, z, y) {
  const c = standingOn(colliders, x, z, y);
  return c ? topAt(c, x, z) : 0;
}

// Teto por cima de quem está à altura y (o fundo mais baixo de uma ponte por cima da cabeça), ou Infinity
export function ceilingAt(colliders, x, z, y) {
  let best = Infinity;
  for (const c of colliders) {
    const b = c.bottom || 0;
    if (b > y + 0.5 && b < best && inside(c, x, z, 0)) best = b;
  }
  return best;
}

// Ponto (x, y, z) dentro de um obstáculo sólido?
export function solidAt(colliders, x, y, z, pad = 0) {
  for (const c of colliders) if (y < topAt(c, x, z) && y >= (c.bottom || 0) && inside(c, x, z, pad)) return c;
  return null;
}

// Obstáculo à frente (a `dist` m na direção dx, dz) que dá para subir a saltar (mais alto do que um degrau, mas ao alcance do salto)
export function jumpableAhead(colliders, x, z, y, dx, dz, dist = 0.9) {
  const px = x + dx * dist, pz = z + dz * dist;
  let top = 0;
  for (const c of colliders) {
    if (!inside(c, px, pz, 0) || (c.bottom || 0) > y + HEAD) continue;
    top = Math.max(top, topAt(c, px, pz));
  }
  return top > y + STEP && top <= y + REACH;
}

// Escada de mão: 1 = sobe (a andar contra a escada), -1 = escorrega (no ar, sem a empurrar), 0 = não está numa escada.
// Cada escada { minX, maxX, minZ, maxZ, top, nx, nz }: (nx, nz) aponta da parede para fora.
export function ladderState(ladders, pos, dir, onGround) {
  if (!ladders) return 0;
  for (const l of ladders) {
    if (!(pos.x > l.minX && pos.x < l.maxX && pos.z > l.minZ && pos.z < l.maxZ && pos.y < l.top + 0.1)) continue;
    if (-(dir.x * l.nx + dir.z * l.nz) > 0.3) return 1;
    return onGround ? 0 : -1;
  }
  return 0;
}

// Escada de mão onde está (ou null): para o boneco se virar para ela
export function ladderAt(ladders, pos) {
  if (!ladders) return null;
  for (const l of ladders) if (pos.x > l.minX && pos.x < l.maxX && pos.z > l.minZ && pos.z < l.maxZ && pos.y < l.top + 0.1) return l;
  return null;
}

// Na escada: o boneco fica encostado ao meio da escada (sem deslizar para os lados nem se afastar dela)
export function hugLadder(l, pos, m, dt) {
  const cx = (l.minX + l.maxX) / 2, cz = (l.minZ + l.maxZ) / 2, tx = -l.nz, tz = l.nx;     // (tx, tz) = ao longo da parede
  const off = (pos.x - cx) * tx + (pos.z - cz) * tz, k = Math.min(1, dt * 12);
  pos.x -= tx * off * k; pos.z -= tz * off * k;
  const vt = m.vx * tx + m.vz * tz;                                                       // tira a velocidade de lado
  m.vx -= vt * tx; m.vz -= vt * tz;
  const vn = m.vx * l.nx + m.vz * l.nz;                                                   // e a de se afastar da parede
  if (vn > 0) { m.vx -= vn * l.nx; m.vz -= vn * l.nz; }
}

// Depois do movimento: tapetes rolantes empurram, carrosséis rodam quem está em cima, trampolins atiram ao ar.
// Devolve "bounce" se o trampolim disparou.
export function surfaceEffects(colliders, pos, m, dt) {
  if (!m.onGround) return null;
  const c = standingOn(colliders, pos.x, pos.z, pos.y + 0.01);
  if (!c || Math.abs(topAt(c, pos.x, pos.z) - pos.y) > 0.05) return null;
  if (c.push) { pos.x += c.push.x * dt; pos.z += c.push.z * dt; }
  if (c.spin) {
    const a = c.spin * dt, dx = pos.x - c.x, dz = pos.z - c.z, ca = Math.cos(a), sa = Math.sin(a);
    pos.x = c.x + dx * ca - dz * sa; pos.z = c.z + dx * sa + dz * ca;
  }
  if (c.bounce) {
    m.vy = c.bounce; m.onGround = false; m.jumping = false; m.bounced = true; m.peakY = pos.y;
    return "bounce";
  }
  return null;
}
