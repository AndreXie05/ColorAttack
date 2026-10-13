import { ARENA } from "./game-config.js";
import { STEP, HEAD, topAt } from "./surfaces.js";

/* ============================================================
   7. COLISÕES
   ============================================================ */
export function resolveCollisions(pos, r, colliders) {
  for (let it = 0; it < 3; it++) {
    for (const c of colliders) {
      if (c.bottom && pos.y + HEAD <= c.bottom) continue;  // ponte/passadiço por cima da cabeça: passa-se por baixo
      if (c.r !== undefined) {
        if (pos.y >= c.top - (c.solid ? -0.05 : STEP)) continue;   // degrau baixo (ou já por cima): sobe-se, não empurra
        let dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz);
        const min = c.r + r;
        if (d < min) {
          if (d < 1e-5) { dx = 1; dz = 0; d = 1; }
          pos.x = c.x + dx / d * min; pos.z = c.z + dz / d * min;
        }
      } else {
        const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
        const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
        if (pos.y >= topAt(c, nx, nz) - (c.solid ? -0.05 : STEP)) continue;    // degrau baixo / rampa: sobe-se, não empurra (os "solid" empurram sempre, a não ser que se passe por cima a saltar)
        const dx = pos.x - nx, dz = pos.z - nz, d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            pos.x = nx + dx / d * r; pos.z = nz + dz / d * r;
          } else {                                         // centro dentro da caixa: empurra pela face mais próxima
            const l = pos.x - c.minX, rt = c.maxX - pos.x, t = pos.z - c.minZ, bt = c.maxZ - pos.z;
            const m = Math.min(l, rt, t, bt);
            if (m === l) pos.x = c.minX - r; else if (m === rt) pos.x = c.maxX + r;
            else if (m === t) pos.z = c.minZ - r; else pos.z = c.maxZ + r;
          }
        }
      }
    }
  }
  pos.x = Math.max(-ARENA.halfX + r, Math.min(ARENA.halfX - r, pos.x));
  pos.z = Math.max(-ARENA.halfZ + r, Math.min(ARENA.halfZ - r, pos.z));
}

