import * as THREE from "three";
import { CONFIG } from "../base/game-config.js";
import { mat } from "../visual/materials-and-geometry.js";

/* ============================================================
   8. BAÚS (lógica)
   ============================================================ */
// mode: os prémios com `modes` só saem nesses modos de jogo (ex.: a armadilha)
export function rollChest(sudden = false, mode = "normal") {
  const rewards = CONFIG.rewards.filter((r) => !r.modes || r.modes.includes(mode));
  if (sudden) {                                                         // morte súbita: 50% vazio e os 4 prémios com a mesma probabilidade (1 caixa, 1 bala)
    if (Math.random() < CONFIG.suddenDeath.emptyChance) return null;
    const r = rewards[Math.floor(Math.random() * rewards.length)];
    return { ...r, drops: [1, 1] };
  }
  if (Math.random() < CONFIG.chest.emptyChance) return null;            // vazio (agora 0%: os baús dão sempre um prémio)
  const total = rewards.reduce((s, r) => s + r.weight, 0);
  let x = Math.random() * total;
  for (const r of rewards) { x -= r.weight; if (x <= 0) return r; }
  return rewards[0];
}
const GOLDEN = { id: "golden", icon: "🌟", label: "Baú dourado" };
export function openChest(c, sudden = false, mode = "normal") {
  if (c.golden) {                                                       // baú dourado: abre sempre e dá o prémio forte
    c.golden = false; c.openTimer = 1.8; c.lidTarget = 1;
    if (c.state === "ready") { c.state = "cooldown"; c.cooldown = CONFIG.chest.reopenSeconds; }
    return { ok: true, reward: GOLDEN };
  }
  if (c.state !== "ready") return { ok: false };
  c.opens++;
  c.openTimer = 1.8; c.lidTarget = 1;
  if (c.opens >= CONFIG.chest.maxOpensPerRound) { c.state = "exhausted"; c.cooldown = 0; }
  else { c.state = "cooldown"; c.cooldown = CONFIG.chest.reopenSeconds; }
  return { ok: true, reward: rollChest(sudden, mode) };
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
    c.gemOn = c.state === "ready" || !!c.golden;
    c.gem.scale.setScalar(c.golden ? 2 + Math.sin(t * 6) * 0.25 : 1);
    c.gem.rotation.y = t * (c.golden ? 5 : 2);
    c.gem.position.y = 2.4 + Math.sin(t * 3 + c.id) * 0.2;
    c.look = c.golden ? "gold" : c.state === "exhausted" ? "grey" : "body";
    if (!chests.inst) { c.gem.visible = c.gemOn; c.body.material = c.look === "gold" ? mat(0xffc61a, { emissive: 0x7a5200 }) : c.look === "grey" ? mat(0x6b6b6b) : c.bodyMat; }
  }
  if (chests.inst) drawInstances(chests);
}

// ---------- TODOS OS BAÚS DE UMA VEZ (instâncias) ----------
// Cada baú tinha 3 peças (corpo, tampa, joia): 12 baús = 36 chamadas de desenho. Agora a placa gráfica desenha cada peça
// em todos os baús de uma vez: corpo (normal / esgotado cinzento / dourado), tampa e joia = 5 chamadas. As peças antigas
// ficam invisíveis e servem só de "esqueleto" (a tampa roda, a joia flutua) para saber onde desenhar cada um.
const _zero = new THREE.Matrix4().makeScale(0, 0, 0), _m = new THREE.Matrix4(), _inv = new THREE.Matrix4();
export function instanceChests(chests, parent, disposables = []) {
  if (chests.length < 2 || chests.inst) return;
  const c0 = chests[0], lid0 = c0.pivot.children.find((o) => o.isMesh);
  if (!lid0) return;
  const make = (geo, material) => {
    const m = new THREE.InstancedMesh(geo, material, chests.length);
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;      // (estão espalhados pelo mapa: um só volume não serve)
    parent.add(m); disposables.push(m); return m;
  };
  chests.inst = {
    parent, lid: make(lid0.geometry, lid0.material), gem: make(c0.gem.geometry, c0.gem.material),
    body: make(c0.body.geometry, c0.bodyMat), grey: make(c0.body.geometry, mat(0x6b6b6b)), gold: make(c0.body.geometry, mat(0xffc61a, { emissive: 0x7a5200 })),
  };
  for (const c of chests) { c.lidMesh = c.pivot.children.find((o) => o.isMesh); c.body.visible = false; c.gem.visible = false; c.lidMesh.visible = false; c.look ||= "body"; c.gemOn ??= true; }
  drawInstances(chests);
}
function drawInstances(chests) {
  const I = chests.inst;
  I.parent.updateMatrixWorld(); _inv.copy(I.parent.matrixWorld).invert();
  chests.forEach((c, i) => {
    c.group.updateMatrixWorld(true);
    const at = (o) => _m.multiplyMatrices(_inv, o.matrixWorld);
    for (const k of ["body", "grey", "gold"]) I[k].setMatrixAt(i, c.look === k ? at(c.body) : _zero);
    I.lid.setMatrixAt(i, at(c.lidMesh));
    I.gem.setMatrixAt(i, c.gemOn ? at(c.gem) : _zero);
  });
  for (const k of ["body", "grey", "gold", "lid", "gem"]) I[k].instanceMatrix.needsUpdate = true;
}
// Baú dourado: um dos baús (à sorte) fica dourado; pode ser aberto mesmo que esteja a reabastecer ou esgotado
export function makeGolden(chests) {
  if (!chests.length || chests.some((c) => c.golden)) return null;
  const c = chests[Math.floor(Math.random() * chests.length)];
  c.golden = true;
  return c;
}
export function resetChests(chests) {
  for (const c of chests) {
    c.opens = 0; c.state = "ready"; c.cooldown = 0; c.openTimer = 0; c.lidTarget = 0; c.lid = 0; c.golden = false;
  }
}

