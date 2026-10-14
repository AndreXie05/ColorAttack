import * as THREE from "three";

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
  emote_robo:   { icon: "🤖", dur: 2.0 },
  emote_guitarra: { icon: "🎸", dur: 2.0 },
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
  if (!em || now >= em.end) return;
  const t = (now - em.start) / 1000, k = Math.min(1, t / EMOTES[em.id].dur), ease = Math.sin(Math.min(1, k * 4, (1 - k) * 4) * Math.PI / 2);   // entra e sai suave
  switch (em.id) {
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
      u.armL.rotation.z = (0.15 + c * 0.45) * ease; u.armR.rotation.z = -(0.15 + c * 0.45) * ease;
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
    case "emote_robo": {                                                          // dança do robô: poses aos solavancos
      const step = Math.floor(t * 4) % 4, poses = [[-1.5, 0, 0.25], [0, -1.5, -0.25], [-1.5, -1.5, 0], [0, 0, 0.25]], [ax, bx, ry] = poses[step];
      u.armL.rotation.x = ax * ease; u.armR.rotation.x = bx * ease; model.rotation.y += ry * ease;
      u.armL.rotation.z = -0.15 * ease; u.armR.rotation.z = 0.15 * ease;
      break;
    }
    case "emote_guitarra":                                                        // guitarra no ar: uma mão no braço da guitarra, a outra a tocar, a abanar a cabeça
      u.armL.rotation.x = -1.1 * ease; u.armL.rotation.z = 0.35 * ease;
      u.armR.rotation.x = (-0.6 + Math.sin(t * 22) * 0.3) * ease; u.armR.rotation.z = -0.25 * ease;
      model.rotation.x -= (0.12 + Math.abs(Math.sin(t * 6)) * 0.1) * ease;
      break;
  }
}
