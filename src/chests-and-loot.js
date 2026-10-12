import { CONFIG } from "./game-config.js";
import { mat } from "./materials-and-geometry.js";

/* ============================================================
   8. BAÚS (lógica)
   ============================================================ */
export function rollChest(sudden = false) {
  if (sudden) {                                                         // morte súbita: 50% vazio e os 4 prémios com a mesma probabilidade (1 caixa, 1 bala)
    if (Math.random() < CONFIG.suddenDeath.emptyChance) return null;
    const r = CONFIG.rewards[Math.floor(Math.random() * CONFIG.rewards.length)];
    return { ...r, drops: [1, 1] };
  }
  if (Math.random() < CONFIG.chest.emptyChance) return null;            // 20% vazio
  const total = CONFIG.rewards.reduce((s, r) => s + r.weight, 0);
  let x = Math.random() * total;
  for (const r of CONFIG.rewards) { x -= r.weight; if (x <= 0) return r; }
  return CONFIG.rewards[0];
}
export function openChest(c, sudden = false) {
  if (c.state !== "ready") return { ok: false };
  c.opens++;
  c.openTimer = 1.8; c.lidTarget = 1;
  if (c.opens >= CONFIG.chest.maxOpensPerRound) { c.state = "exhausted"; c.cooldown = 0; }
  else { c.state = "cooldown"; c.cooldown = CONFIG.chest.reopenSeconds; }
  return { ok: true, reward: rollChest(sudden) };
}
export function updateChests(chests, dt, t) {
  for (const c of chests) {
    if (c.state === "cooldown") {
      c.cooldown -= dt;
      if (c.cooldown <= 0) { c.cooldown = 0; c.state = "ready"; }
    }
    if (c.openTimer > 0) { c.openTimer -= dt; if (c.openTimer <= 0) c.lidTarget = 0; }
    c.lid += (c.lidTarget - c.lid) * Math.min(1, dt * 8);
    c.pivot.rotation.x = -c.lid * 1.9;
    c.gem.visible = c.state === "ready";
    c.gem.rotation.y = t * 2;
    c.gem.position.y = 2.4 + Math.sin(t * 3 + c.id) * 0.2;
    c.body.material = c.state === "exhausted" ? mat(0x6b6b6b) : c.bodyMat;
  }
}
export function resetChests(chests) {
  for (const c of chests) {
    c.opens = 0; c.state = "ready"; c.cooldown = 0; c.openTimer = 0; c.lidTarget = 0; c.lid = 0;
  }
}

