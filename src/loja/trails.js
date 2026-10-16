import * as THREE from "three";
import { emojiTexture } from "../personagens/emotes.js";

/* ============================================================
   RASTOS (loja): ao correr saem estrelas, corações, notas... pelos pés, que sobem e desaparecem.
   Um conjunto fixo de sprites reaproveitados (nunca cria mais do que MAX), por isso é leve.
   update(dt, pos, speed, id, on): no jogo (só deixa rasto a correr e quando "on" — por ex. não com invisibilidade).
   preview(dt, id, center): no lobby, uns quantos à volta dos pés mesmo parado.
   ============================================================ */
export const TRAILS = {
  rasto_estrelas: ["⭐", "✨"], rasto_coracoes: ["💖", "💕"], rasto_notas: ["🎵", "🎶"],
  rasto_bolhas: ["🫧"], rasto_fogo: ["🔥"], rasto_arcoiris: "rainbow",
  rasto_folhas: ["🍃", "🍂"], rasto_flocos: ["❄️"], rasto_flores: ["🌸", "🌼", "🌷"], rasto_pegadas: ["👣"],
  rasto_doces: ["🍬", "🍭"], rasto_borboletas: ["🦋"], rasto_relampagos: ["⚡"], rasto_moedas: ["🪙"],
  rasto_fantasmas: ["👻"], rasto_caveiras: ["💀"], rasto_pizza: ["🍕"], rasto_confetis: "confetti",
  rasto_trevos: ["🍀"], rasto_patinhas: ["🐾"], rasto_nuvens: ["☁️"], rasto_morangos: ["🍓"], rasto_luas: ["🌙", "⭐"], rasto_baloes: ["🎈"],
  rasto_bolas: ["⚽"], rasto_donuts: ["🍩"], rasto_aboboras: ["🎃"], rasto_planetas: ["🪐", "🌍", "🌕"], rasto_unicornios: ["🦄", "🌈"], rasto_diamantes: ["💎"],
};
const MAX = 40, LIFE = 0.9, RAINBOW = [0xff3b4a, 0xffd21f, 0x2f7bff, 0x47e06a, 0xa447ff, 0xff8a1f];
let _dot = null;
function dotTexture() {                                                           // pingo redondo branco (o arco-íris tinge-o)
  if (_dot) return _dot;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), grd = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  grd.addColorStop(0, "#fff"); grd.addColorStop(0.7, "#fff"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
  _dot = new THREE.CanvasTexture(c); _dot.colorSpace = THREE.SRGBColorSpace;
  return _dot;
}

let _sq = null;
function squareTexture() {                                                        // papelinho quadrado branco (os confetis tingem-no)
  if (_sq) return _sq;
  const c = document.createElement("canvas"); c.width = c.height = 32;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(4, 8, 24, 16);
  _sq = new THREE.CanvasTexture(c); _sq.colorSpace = THREE.SRGBColorSpace;
  return _sq;
}

export function createTrails(scene) {
  const group = new THREE.Group(); scene.add(group);
  const P = [];
  for (let i = 0; i < MAX; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
    s.visible = false; s.renderOrder = 6; group.add(s);
    P.push({ s, t: 0, vx: 0, vz: 0 });
  }
  let acc = 0, next = 0;
  function emit(x, y, z, id) {
    const def = TRAILS[id];
    if (!def) return;
    const p = P[next]; next = (next + 1) % MAX;
    const m = p.s.material, hadMap = !!m.map;
    if (def === "rainbow" || def === "confetti") { m.map = def === "rainbow" ? dotTexture() : squareTexture(); m.color.setHex(RAINBOW[Math.floor(Math.random() * 6)]); m.rotation = Math.random() * Math.PI; }
    else { m.map = emojiTexture(def[Math.floor(Math.random() * def.length)]); m.color.setHex(0xffffff); m.rotation = 0; }
    if (!hadMap) m.needsUpdate = true;                                                 // (só a 1.ª vez: trocar uma imagem por outra não obriga a refazer o material — refazê-lo em cada partícula gastava processador e memória)
    p.s.position.set(x + (Math.random() - 0.5) * 0.4, y + 0.2 + Math.random() * 0.2, z + (Math.random() - 0.5) * 0.4);
    p.vx = (Math.random() - 0.5) * 0.4; p.vz = (Math.random() - 0.5) * 0.4; p.t = LIFE; p.big = def === "rainbow" ? 0.28 : def === "confetti" ? 0.22 : 0.45;
    p.s.visible = true;
  }
  function step(dt) {
    for (const p of P) {
      if (p.t <= 0) continue;
      p.t -= dt;
      if (p.t <= 0) { p.s.visible = false; continue; }
      const k = 1 - p.t / LIFE;
      p.s.position.x += p.vx * dt; p.s.position.z += p.vz * dt; p.s.position.y += 0.7 * dt;
      const sc = p.big * (0.6 + Math.min(1, k * 4) * 0.5);
      p.s.scale.set(sc, sc, 1); p.s.material.opacity = k > 0.6 ? (1 - k) / 0.4 : 1;
    }
  }
  return {
    update(dt, pos, speed, id, on) {
      step(dt);
      if (!on || !TRAILS[id] || speed < 3.5) { acc = 0; return; }
      acc += dt;
      while (acc > 0.07) { acc -= 0.07; emit(pos.x, pos.y, pos.z, id); }
    },
    preview(dt, id, c) {
      step(dt);
      if (!TRAILS[id]) return;
      acc += dt;
      while (acc > 0.18) { acc -= 0.18; const a = Math.random() * Math.PI * 2; emit(c.x + Math.cos(a) * 0.7, c.y, c.z + Math.sin(a) * 0.7, id); }
    },
    clear() { for (const p of P) { p.t = 0; p.s.visible = false; } },
    dispose() { scene.remove(group); for (const p of P) p.s.material.dispose(); },
  };
}
