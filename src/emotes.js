import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/* ============================================================
   CELEBRAÇÕES (tecla Z no jogo; compram-se na loja)
   Cada celebração mexe nos braços / corpo DEPOIS da animação normal (character-animator.js), por isso não precisa
   de animações novas no modelo. Por cima da cabeça sobe um emoji (sprite) enquanto dura.
   play(entidade, id, agora) começa; apply(modelo, entidade, agora) aplica (chamar a cada frame, depois de animar).
   ============================================================ */
export const EMOTES = {
  emote_aceno:  { icon: "👋", dur: 1.6 },
  emote_danca:  { icon: "🕺", dur: 2.0 },
  emote_heroi:  { icon: "💪", dur: 1.8 },
  emote_mortal: { icon: "🤸", dur: 1.0, noBubble: true },                        // (no mortal a bolha andaria às voltas com o boneco)
  emote_piao:   { icon: "🌀", dur: 1.4 },
  emote_palmas: { icon: "👏", dur: 1.6 },
  emote_venia:  { icon: "🙇", dur: 1.6 },
  emote_saltos: { icon: "🤾", dur: 1.8 },
  emote_robo:   { icon: "🤖", dur: 3.2 },
  emote_guitarra: { icon: "🎸", dur: 2.6 },
  emote_floss:    { icon: "🕺", dur: 2.4 },
  emote_dab:      { icon: "😎", dur: 1.8 },
  emote_karate:   { icon: "🥋", dur: 2.4 },
  emote_meditar:  { icon: "🧘", dur: 3.0 },
  emote_cavalinho:{ icon: "🐴", dur: 2.6 },
  emote_flexoes:  { icon: "💪", dur: 2.8, noBubble: true },
  emote_coracao:  { icon: "💖", dur: 2.2 },
  emote_sono:     { icon: "😴", dur: 3.0 },
  emote_continencia: { icon: "🫡", dur: 1.6 },
  emote_riso:     { icon: "😂", dur: 2.2 },
  emote_beijo:    { icon: "😘", dur: 1.8 },
  emote_choro:    { icon: "😭", dur: 2.4 },
  emote_vitoria:  { icon: "✌️", dur: 2.0 },
  emote_galinha:  { icon: "🐔", dur: 2.6 },
  emote_pinguim:  { icon: "🐧", dur: 2.4 },
  emote_zangado:  { icon: "😤", dur: 2.2 },
  emote_onda:     { icon: "🙌", dur: 2.2 },
  emote_desmaio:  { icon: "😵", dur: 2.8 },
  emote_helicoptero: { icon: "🚁", dur: 2.4 },
};

// emoji como textura (uma por emoji, feita uma vez; também usada pelos rastos em trails.js)
const _tex = new Map();
export function emojiTexture(icon) {
  if (!_tex.has(icon)) {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"); g.font = "96px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(icon, 64, 72);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    _tex.set(icon, t);
  }
  return _tex.get(icon);
}
const emojiMaterial = (icon) => new THREE.SpriteMaterial({ map: emojiTexture(icon), transparent: true, depthWrite: false });   // cada bolha tem a sua opacidade

// e = quem celebra (precisa de e.model ou do modelo passado em apply). Devolve false se já estiver a celebrar.
export function play(e, id, now) {
  if (!EMOTES[id] || (e.emote && now < e.emote.end)) return false;
  e.emote = { id, start: now, end: now + EMOTES[id].dur * 1000 };
  return true;
}
export const stop = (e) => { if (e.emote) e.emote.end = 0; };
export const playing = (e, now) => !!e.emote && now < e.emote.end;

// peças da arma no braço direito (bots sem itens na mão): as que usam o material da munição ou o cinto
function gunParts(u) {
  const out = [];
  u.armR?.traverse((o) => { if (o.isMesh && (o.material === u.gunMat || o.material.name === "Belt")) out.push(o); });
  return out;
}

// ---------- guitarra elétrica (só aparece na celebração da guitarra): uma malha só, com as cores nos vértices ----------
// Feita ao longo do eixo y local: corpo em baixo (y = 0), braço até y ≈ 0.95, cabeça no topo
let _guitarGeo = null, _guitarMat = null;
function guitarMesh() {
  if (!_guitarGeo) {
    const parts = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const add = (geo, color, x, y, z, sx = 1, sy = 1, sz = 1, rz = 0, rx = 0) => {
      const g = geo.index ? geo.toNonIndexed() : geo; geo !== g && geo.dispose();
      for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
      g.applyMatrix4(m4.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(rx, 0, rz)), new THREE.Vector3(sx, sy, sz)));
      const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3)); parts.push(g);
    };
    const RED = 0xff3b4a, WHITE = 0xf4f4f8, WOOD = 0x8a5a2b, DARK = 0x1a1033, GOLD = 0xffd21f;
    add(new THREE.SphereGeometry(0.3, 16, 10), RED, 0, -0.05, 0, 1.05, 0.95, 0.28);               // corpo: parte de baixo
    add(new THREE.SphereGeometry(0.23, 16, 10), RED, 0, 0.27, 0, 1, 0.9, 0.28);                  // corpo: parte de cima
    add(new THREE.ConeGeometry(0.09, 0.26, 8), RED, -0.2, 0.42, 0, 1, 1, 0.6, 0.5);              // "cornos" da guitarra elétrica
    add(new THREE.ConeGeometry(0.08, 0.22, 8), RED, 0.18, 0.4, 0, 1, 1, 0.6, -0.45);
    add(new THREE.SphereGeometry(0.2, 14, 8), WHITE, 0.03, 0.02, 0.03, 1, 0.75, 0.2);            // escudo branco
    add(new THREE.BoxGeometry(0.2, 0.05, 0.03), DARK, 0, -0.1, 0.09);                            // ponte
    for (const y of [0.04, 0.16]) add(new THREE.BoxGeometry(0.18, 0.06, 0.03), DARK, 0, y, 0.09);   // captadores
    for (const x of [0.16, 0.22]) add(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8), GOLD, x, -0.2, 0.08, 1, 1, 1, 0, Math.PI / 2);   // botões
    add(new THREE.BoxGeometry(0.085, 0.72, 0.045), WOOD, 0, 0.72, 0.02);                         // braço
    for (let i = 1; i <= 6; i++) add(new THREE.BoxGeometry(0.088, 0.01, 0.05), GOLD, 0, 0.4 + i * 0.085, 0.022);   // trastes
    add(new THREE.BoxGeometry(0.14, 0.2, 0.05), DARK, 0, 1.15, 0.02);                            // cabeça
    for (const s of [-1, 1]) for (const y of [1.09, 1.15, 1.21]) add(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 6), WHITE, s * 0.085, y, 0.02, 1, 1, 1, Math.PI / 2);   // tarraxas
    for (const x of [-0.025, 0, 0.025]) add(new THREE.BoxGeometry(0.006, 1.2, 0.006), WHITE, x, 0.5, 0.05);      // cordas
    _guitarGeo = mergeGeometries(parts, false); parts.forEach((g) => g.dispose());
    _guitarMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.1 });
  }
  const m = new THREE.Mesh(_guitarGeo, _guitarMat); m.castShadow = true; m.name = "Guitar";
  // no tronco: corpo da guitarra à frente da barriga, do lado direito; o braço sobe na diagonal para a esquerda
  m.position.set(0.2, 1.04, 0.52); m.rotation.set(0.15, 0.25, 1.1);
  return m;
}

// ---------- dança do robô: 8 poses aos solavancos (chega depressa, treme um pouco e fica parado) ----------
// [braço esq. x, braço esq. z, braço dir. x, braço dir. z, rodar o tronco, perna esq., perna dir., baixar]
const ROBOT = [
  [-1.57, 0, -1.57, 0, 0, 0, 0, 0],               // braços em frente (como um robô a andar)
  [-1.57, 0, -2.6, 0.9, 0.45, -0.5, 0, 0],        // braço direito para cima (na diagonal, para não ficar atrás da cabeça), roda e levanta um pé
  [0, -1.57, 0, 1.57, -0.45, 0, -0.5, 0.12],      // braços abertos, roda para o outro lado e baixa
  [-2.6, -0.9, -1.57, 0, 0, 0, 0, 0],             // braço esquerdo para cima
  [-1.57, -0.6, -1.57, 0.6, 0.8, -0.5, 0, 0],     // vira-se de lado, "a andar"
  [-1.57, -0.6, -1.57, 0.6, 0.8, 0, -0.5, 0],
  [0, -1.57, -1.57, 0, 0, 0, 0, 0.18],            // um braço aberto, outro em frente, bem em baixo
  [0, -0.2, 0, 0.2, 0, 0, 0, 0.35],               // desliga-se (os braços caem)...
];

export function apply(model, e, now) {
  const em = e.emote, u = model?.userData;
  if (!u || !u.armL) return;
  // bolha com o emoji
  if (em && now < em.end && !EMOTES[em.id].noBubble) {
    if (!u.bubble) { u.bubble = new THREE.Sprite(emojiMaterial(EMOTES[em.id].icon)); u.bubble.renderOrder = 7; model.add(u.bubble); u.bubbleId = em.id; }
    else if (u.bubbleId !== em.id) { u.bubble.material.dispose(); u.bubble.material = emojiMaterial(EMOTES[em.id].icon); u.bubbleId = em.id; }
  }
  if (u.bubble) {
    const live = em && now < em.end && !EMOTES[em.id].noBubble, k = live ? (now - em.start) / (em.end - em.start) : 1;
    u.bubble.visible = live;
    if (live) { const s = 0.9 + Math.min(1, k * 6) * 0.4; u.bubble.scale.set(s, s, 1); u.bubble.position.set(0, 3.6 + k * 0.8, 0); u.bubble.material.opacity = k > 0.8 ? (1 - k) * 5 : 1; }
  }
  u.armL.rotation.z = 0; u.armR.rotation.z = 0; u.legL.rotation.z = 0; u.legR.rotation.z = 0;   // (a animação normal não mexe neste eixo: volta ao normal quando a celebração acaba)
  // a arma sai da mão durante a celebração e volta logo a seguir
  const h = u.held, guns = h ? h.gunMeshes : (u._guns ||= gunParts(u));
  if (em && now < em.end) { for (const m of guns) m.visible = false; u._gunHidden = true; }
  else if (u._gunHidden) {
    u._gunHidden = false;
    const show = h ? !h.gren.visible && !h.kit.visible : true;                      // (com a granada ou a cura na mão, a arma continua escondida)
    for (const m of guns) m.visible = show;
    if (h) h.key = "";                                                               // o setHeld volta a decidir o que se vê
  }
  if (u.guitar && (!em || now >= em.end || em.id !== "emote_guitarra")) u.guitar.visible = false;
  if (!em || now >= em.end) return;
  const t = (now - em.start) / 1000, k = Math.min(1, t / EMOTES[em.id].dur), ease = Math.sin(Math.min(1, k * 4, (1 - k) * 4) * Math.PI / 2);   // entra e sai suave
  switch (em.id) {
    case "emote_continencia":                                                     // continência: mão direita à testa, corpo direito
      u.armR.rotation.x = u.armR.rotation.x * (1 - ease) - 2.6 * ease; u.armR.rotation.z = 0.35 * ease;
      model.rotation.x -= 0.06 * ease;
      break;
    case "emote_riso": {                                                          // rir: inclina-se para trás aos solavancos, mãos na barriga
      const j = Math.abs(Math.sin(t * 16));
      model.rotation.x -= (0.15 + j * 0.1) * ease; model.position.y += j * 0.06 * ease;
      u.armL.rotation.x = -0.55 * ease; u.armR.rotation.x = -0.55 * ease; u.armL.rotation.z = 0.3 * ease; u.armR.rotation.z = -0.3 * ease;
      break;
    }
    case "emote_beijo": {                                                         // beijinho: mão à boca e depois atira-o
      const th = Math.min(1, Math.max(0, (k - 0.45) / 0.25));
      u.armR.rotation.x = u.armR.rotation.x * (1 - ease) - (2.1 - th * 0.9) * ease; u.armR.rotation.z = (-0.4 + th * 1.5) * ease;
      model.rotation.x += (0.05 - th * 0.1) * ease;
      break;
    }
    case "emote_choro":                                                           // chorar: mãos na cara, cabeça em baixo e o corpo a tremer
      u.armL.rotation.x = -2.3 * ease; u.armR.rotation.x = -2.3 * ease; u.armL.rotation.z = 0.35 * ease; u.armR.rotation.z = -0.35 * ease;
      model.rotation.x += 0.22 * ease; model.rotation.z += Math.sin(t * 22) * 0.035 * ease;
      break;
    case "emote_vitoria":                                                         // vitória: saltos com os dois braços no ar em V
      u.armL.rotation.z = -2.6 * ease; u.armR.rotation.z = 2.6 * ease; u.armL.rotation.x *= 1 - ease; u.armR.rotation.x *= 1 - ease;
      model.position.y += Math.abs(Math.sin(t * 6.5)) * 0.5 * ease;
      break;
    case "emote_galinha": {                                                       // dança da galinha: cotovelos a bater como asas, corpo para a frente e saltinhos
      const f = Math.abs(Math.sin(t * 12));
      u.armL.rotation.z = -(0.25 + f * 0.75) * ease; u.armR.rotation.z = (0.25 + f * 0.75) * ease;
      model.rotation.x += 0.22 * ease; model.position.y += Math.abs(Math.sin(t * 6)) * 0.12 * ease;
      u.legL.rotation.x += Math.sin(t * 12) * 0.3 * ease; u.legR.rotation.x -= Math.sin(t * 12) * 0.3 * ease;
      break;
    }
    case "emote_pinguim":                                                         // andar de pinguim: braços colados ao corpo e a abanar de um lado para o outro
      u.armL.rotation.z = -0.3 * ease; u.armR.rotation.z = 0.3 * ease; u.armL.rotation.x *= 1 - ease; u.armR.rotation.x *= 1 - ease;
      model.rotation.z += Math.sin(t * 9) * 0.17 * ease; model.position.y += Math.abs(Math.sin(t * 9)) * 0.05 * ease;
      break;
    case "emote_zangado":                                                         // birra: braços cruzados e um pé a bater no chão
      u.armL.rotation.x = -1.35 * ease; u.armR.rotation.x = -1.35 * ease; u.armL.rotation.z = 0.55 * ease; u.armR.rotation.z = -0.55 * ease;
      u.legR.rotation.x -= Math.max(0, Math.sin(t * 14)) * 0.45 * ease;
      model.rotation.z += Math.sin(t * 28) * 0.02 * ease;
      break;
    case "emote_onda":                                                            // a onda: os dois braços no ar a abanar, o corpo a baloiçar
      u.armL.rotation.z = (-2.4 + Math.sin(t * 9) * 0.45) * ease; u.armR.rotation.z = (2.4 + Math.sin(t * 9 + Math.PI) * 0.45) * ease;
      u.armL.rotation.x *= 1 - ease; u.armR.rotation.x *= 1 - ease;
      model.rotation.z += Math.sin(t * 4.5) * 0.12 * ease;
      break;
    case "emote_desmaio": {                                                       // desmaio: cai para trás, fica no chão um bocado e levanta-se
      const down = Math.min(1, k / 0.25), up = k > 0.72 ? Math.min(1, (k - 0.72) / 0.22) : 0, f0 = down * down * (3 - 2 * down), f = f0 * (1 - up * up * (3 - 2 * up));
      model.rotation.x -= 1.45 * f; model.position.y += 0.3 * f;
      u.armL.rotation.z = -1.2 * f; u.armR.rotation.z = 1.2 * f;
      break;
    }
    case "emote_helicoptero":                                                     // helicóptero: um braço no ar, gira cada vez mais depressa e levanta voo
      u.armR.rotation.z = 2.9 * ease; u.armR.rotation.x *= 1 - ease; u.armL.rotation.z = -1.4 * ease;
      model.rotation.y += k * k * Math.PI * 10; model.position.y += Math.sin(k * Math.PI) * 1.3;
      break;
    case "emote_aceno":                                                           // acena com o braço esquerdo (o direito tem a arma)
      u.armL.rotation.z = -2.5 * ease + Math.sin(t * 14) * 0.35 * ease; u.armL.rotation.x *= 1 - ease;
      break;
    case "emote_danca":                                                           // dança: anca de um lado para o outro, braços alternados e saltinhos
      model.rotation.z += Math.sin(t * 9) * 0.18 * ease;
      u.armL.rotation.z = (-1.2 - Math.sin(t * 9) * 0.9) * ease; u.armR.rotation.z = (1.2 - Math.sin(t * 9) * 0.9) * ease;
      model.position.y += Math.abs(Math.sin(t * 9)) * 0.18 * ease;
      break;
    case "emote_heroi":                                                           // pose de herói: punho no ar na diagonal (por fora da cabeça), a outra mão na anca, peito para fora
      u.armR.rotation.z = 2.5 * ease; u.armR.rotation.x *= 1 - ease;
      u.armL.rotation.z = -0.75 * ease; u.armL.rotation.x = u.armL.rotation.x * (1 - ease) + 0.45 * ease;
      model.rotation.x -= 0.1 * ease;
      break;
    case "emote_mortal": {                                                        // mortal para trás: salta, encolhe as pernas e dá uma volta completa à volta da anca
      const air = Math.sin(k * Math.PI), spinK = Math.min(1, Math.max(0, (k - 0.15) / 0.7)), a = -spinK * spinK * (3 - 2 * spinK) * Math.PI * 2;   // a volta acontece no ar
      const h = 1.0, yaw = model.rotation.y;                                       // h: altura da anca (o eixo da volta)
      model.rotation.x += a;
      model.position.y += air * 1.1 + h - h * Math.cos(a);                         // roda à volta da anca, não dos pés
      model.position.x += -h * Math.sin(a) * Math.sin(yaw); model.position.z += -h * Math.sin(a) * Math.cos(yaw);
      const tuck = Math.sin(spinK * Math.PI);                                      // pernas encolhidas a meio do mortal
      u.legL.rotation.x = u.legL.rotation.x * (1 - tuck) - 1.5 * tuck; u.legR.rotation.x = u.legR.rotation.x * (1 - tuck) - 1.5 * tuck;
      if (u.shinL) { u.shinL.rotation.x = 2.0 * tuck; u.shinR.rotation.x = 2.0 * tuck; }
      u.armL.rotation.x = -1.2 * tuck; u.armR.rotation.x = u.armR.rotation.x * (1 - tuck) - 1.2 * tuck;
      break;
    }
    case "emote_piao":                                                            // pião: braços abertos a rodar muito depressa
      model.rotation.y += k * Math.PI * 6;
      u.armL.rotation.z = -1.5 * ease; u.armR.rotation.z = 1.5 * ease;
      break;
    case "emote_palmas": {                                                        // palmas: braços à frente, as mãos juntam-se e afastam-se
      const c = (Math.sin(t * 18) + 1) / 2;
      u.armL.rotation.x = -1.3 * ease; u.armR.rotation.x = -1.3 * ease;
      u.armL.rotation.z = (0.1 + c * 0.34) * ease; u.armR.rotation.z = -(0.1 + c * 0.34) * ease;   // (as mãos tocam-se a meio, sem se cruzarem)
      break;
    }
    case "emote_venia":                                                           // vénia: dobra-se para a frente com a mão no peito
      model.rotation.x += 0.55 * ease;
      u.armR.rotation.x = -1.1 * ease; u.armR.rotation.z = -0.5 * ease; u.armL.rotation.x = 0.35 * ease;
      break;
    case "emote_saltos": {                                                        // polichinelos: salta abrindo braços e pernas
      const o = (1 - Math.cos(t * 10)) / 2;
      u.armL.rotation.z = -(0.2 + o * 2.4) * ease; u.armR.rotation.z = (0.2 + o * 2.4) * ease;
      u.legL.rotation.z = -o * 0.35 * ease; u.legR.rotation.z = o * 0.35 * ease;
      model.position.y += Math.abs(Math.sin(t * 5)) * 0.25 * ease;
      break;
    }
    case "emote_robo": {                                                          // dança do robô: 8 poses aos solavancos e, no fim, desliga-se e volta a ligar
      const rate = 2.6, f = t * rate, i = Math.min(ROBOT.length - 1, Math.floor(f)), prev = ROBOT[(i + ROBOT.length - 1) % ROBOT.length], cur = ROBOT[i];
      const p = Math.min(1, (f - i) / 0.22), snap = p * p * (3 - 2 * p) + Math.sin(p * Math.PI) * 0.12;   // chega depressa e passa um bocadinho (solavanco)
      const buzz = p >= 1 ? Math.sin(t * 90) * 0.015 : 0;                       // tremido de motor quando está parado
      const P = (j) => (prev[j] + (cur[j] - prev[j]) * snap) * ease;
      u.armL.rotation.x = P(0) + buzz; u.armL.rotation.z = P(1); u.armR.rotation.x = P(2) - buzz; u.armR.rotation.z = P(3);
      model.rotation.y += P(4);
      u.legL.rotation.x += P(5); u.legR.rotation.x += P(6);
      if (u.shinL) { u.shinL.rotation.x += -P(5) * 1.4; u.shinR.rotation.x += -P(6) * 1.4; }   // o joelho dobra quando levanta o pé
      model.position.y -= P(7) * 0.5;
      if (i === ROBOT.length - 1) model.rotation.x += 0.35 * snap * ease;     // desligado: cabeça e tronco caem para a frente
      break;
    }
    case "emote_floss": {                                                         // floss: os dois braços esticados vão juntos de um lado para o outro (um à frente do corpo, o outro atrás) e a anca vai ao contrário
      const w = Math.sin(t * 9), f = Math.sign(Math.sin(t * 4.5)) || 1;            // w: para que lado vão os braços; f: troca quem fica à frente
      const inL = Math.max(0, w), inR = Math.max(0, -w);                          // o braço que está a passar para o lado de dentro afasta-se mais do corpo (não o atravessa)
      u.armL.rotation.z = 0.5 * w * ease; u.armR.rotation.z = 0.5 * w * ease;
      u.armL.rotation.x = -f * (0.3 + 0.8 * inL) * ease; u.armR.rotation.x = f * (0.3 + 0.8 * inR) * ease;
      model.rotation.z -= w * 0.1 * ease; model.position.y += Math.abs(w) * 0.04 * ease;
      break;
    }
    case "emote_dab": {                                                           // dab: um braço esticado na diagonal para cima e o outro esticado à frente da cara, com a cabeça a baixar para ele (dois dabs, um para cada lado)
      const side = k < 0.5 ? 1 : -1, p = Math.min(1, ((k % 0.5) / 0.5) * 5) * ease;
      const [out, across] = side > 0 ? [u.armL, u.armR] : [u.armR, u.armL];
      out.rotation.z = -side * 2.25 * p; out.rotation.x *= 1 - p;                   // para cima e para fora
      across.rotation.x = -1.9 * p; across.rotation.z = -side * 0.62 * p;          // à frente da cara, a apontar para o mesmo lado
      model.rotation.x += 0.16 * p; model.rotation.z += side * 0.1 * p; model.rotation.y += side * 0.15 * p;
      break;
    }
    case "emote_karate": {                                                        // karaté: golpe de mão, pontapé alto e soco, com o corpo a rodar
      const step = Math.min(2, Math.floor(k * 3)), p = Math.sin(Math.min(1, (k * 3 - step) * 2) * Math.PI / 2) * ease;
      if (step === 0) { u.armR.rotation.x = (-1.6 + p * 0.3) * ease; u.armR.rotation.z = -0.9 * p; u.armL.rotation.x = -1.2 * p; model.rotation.y += 0.4 * p; }
      else if (step === 1) { u.legL.rotation.x = -1.5 * p; if (u.shinL) u.shinL.rotation.x = 0.1; u.armL.rotation.z = -1.2 * p; u.armR.rotation.z = 1.2 * p; model.rotation.x -= 0.15 * p; }
      else { u.armL.rotation.x = -1.57 * p; u.armR.rotation.x = -0.6 * p; model.rotation.y -= 0.5 * p; }
      break;
    }
    case "emote_meditar": {                                                       // meditar: pernas cruzadas e a flutuar
      const float = 0.45 + Math.sin(t * 2.4) * 0.08;
      u.legL.rotation.x = -1.45 * ease; u.legR.rotation.x = -1.45 * ease;
      u.legL.rotation.z = -0.55 * ease; u.legR.rotation.z = 0.55 * ease;
      if (u.shinL) { u.shinL.rotation.x = 2.2 * ease; u.shinR.rotation.x = 2.2 * ease; }
      u.armL.rotation.z = -0.55 * ease; u.armR.rotation.z = 0.55 * ease; u.armL.rotation.x = -0.6 * ease; u.armR.rotation.x = -0.6 * ease;
      model.position.y += float * ease;
      break;
    }
    case "emote_cavalinho": {                                                     // dança do cavalinho: braços cruzados à frente, saltinhos de um pé para o outro e de lado
      const h = Math.sin(t * 10), side = Math.sin(t * 2.5);
      u.armL.rotation.x = -1.25 * ease; u.armR.rotation.x = -1.25 * ease; u.armL.rotation.z = 0.55 * ease; u.armR.rotation.z = -0.55 * ease;
      u.legL.rotation.x -= Math.max(0, h) * 0.8 * ease; u.legR.rotation.x -= Math.max(0, -h) * 0.8 * ease;
      if (u.shinL) { u.shinL.rotation.x += Math.max(0, h) * 1.2 * ease; u.shinR.rotation.x += Math.max(0, -h) * 1.2 * ease; }
      model.position.y += Math.abs(h) * 0.15 * ease;
      model.position.x += Math.cos(model.rotation.y) * side * 0.35 * ease; model.position.z -= Math.sin(model.rotation.y) * side * 0.35 * ease;
      break;
    }
    case "emote_flexoes": {                                                       // flexões: deita-se de barriga para baixo e sobe e desce nos braços
      const down = (1 - Math.cos(t * 6)) / 2;
      model.rotation.x += 1.38 * ease;
      model.position.y += (0.32 + 0.3 * (1 - down)) * ease;
      model.position.x -= Math.sin(model.rotation.y) * 0.95 * ease; model.position.z -= Math.cos(model.rotation.y) * 0.95 * ease;   // recua: fica deitado em cima do sítio onde estava (não "cai" para a frente)
      u.armL.rotation.x = (-1.35 - down * 0.35) * ease; u.armR.rotation.x = (-1.35 - down * 0.35) * ease;
      u.armL.rotation.z = -0.25 * ease; u.armR.rotation.z = 0.25 * ease;
      u.legL.rotation.x *= 1 - ease; u.legR.rotation.x *= 1 - ease;
      break;
    }
    case "emote_coracao": {                                                       // coração: as mãos fazem um coração à frente do peito (a bater) e o corpo baloiça
      const beat = 1 + Math.max(0, Math.sin(t * 9)) * 0.08;                         // o coração "bate"
      u.armL.rotation.x = -1.25 * ease; u.armR.rotation.x = -1.25 * ease; u.armL.rotation.z = 0.44 * beat * ease; u.armR.rotation.z = -0.44 * beat * ease;   // mãos juntas à frente do peito, em forma de coração
      model.rotation.z += Math.sin(t * 4) * 0.1 * ease;
      break;
    }
    case "emote_sono": {                                                          // a dormir de pé: a cabeça vai caindo, abana e acorda num salto no fim
      const nod = Math.min(1, t / 1.2), wake = k > 0.85 ? Math.sin((k - 0.85) / 0.15 * Math.PI) : 0;
      model.rotation.x += (0.28 * nod + Math.sin(t * 3) * 0.04) * ease * (1 - wake);
      model.rotation.z += 0.12 * nod * ease * (1 - wake);
      u.armL.rotation.x = 0.15 * ease; u.armR.rotation.x = 0.15 * ease;
      model.position.y += wake * 0.4;
      if (wake) { u.armL.rotation.z = -1.4 * wake; u.armR.rotation.z = 1.4 * wake; }
      break;
    }
    case "emote_guitarra": {                                                      // guitarra elétrica: mão esquerda no braço, a direita a tocar, a abanar a cabeça e um salto no fim
      if (!u.guitar) { u.guitar = guitarMesh(); (u.body || model).add(u.guitar); }
      u.guitar.visible = true; u.guitar.scale.setScalar(Math.max(0.01, ease));
      const solo = k > 0.72;                                                      // no fim: salto com a guitarra no ar
      u.armL.rotation.x = -1.05 * ease; u.armL.rotation.z = -0.12 * ease;
      u.armR.rotation.x = (-0.72 + Math.sin(t * (solo ? 34 : 22)) * 0.22) * ease; u.armR.rotation.z = -0.22 * ease;
      model.rotation.x -= (0.08 + Math.abs(Math.sin(t * 7)) * 0.14) * ease;    // a abanar a cabeça ao ritmo
      model.position.y += Math.abs(Math.sin(t * 7)) * 0.06 * ease + (solo ? Math.sin((k - 0.72) / 0.28 * Math.PI) * 0.6 : 0);
      if (solo) { const j = Math.sin((k - 0.72) / 0.28 * Math.PI); u.legL.rotation.x -= 0.6 * j; u.shinL && (u.shinL.rotation.x += 1.1 * j); model.rotation.x += 0.25 * j; }
      break;
    }
  }
}
