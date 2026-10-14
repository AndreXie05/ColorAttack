import * as THREE from "three";
import { addHeldItems } from "./character-model.js";

/* ============================================================
   COSMÉTICA (loja e inventário): só muda o aspeto, nunca as regras do jogo
   - Skins: o acabamento do boneco (brilho, metálico, néon...) ou um padrão (riscas, bolinhas, camuflado...).
     A COR continua a ser a do jogo (é a que os adversários têm de acertar): os padrões só a escurecem ou clareiam.
     Os bonecos não têm coordenadas de textura, por isso os padrões são desenhados no próprio material a partir
     da posição de cada ponto do boneco (ver patternShader).
   - Acessórios (cabeça) e Costas: presos ao tronco (a cabeça faz parte dele), por isso acompanham as animações.
     Alguns mexem-se (hélice, asas, capa, chamas): tickCosmetics(modelo, t) a cada frame.
   - Armas: o formato da arma na mão. As partes coloridas usam o material da munição (mudam com a tinta na mão).
   - Celebrações (emotes.js) e Rastos (trails.js): só a lista e os preços estão aqui.
   price: em moedas (coins) ou joias (gems); level: nível mínimo para comprar.
   ============================================================ */
export const CATEGORIES = [
  { id: "skin",   name: "Skins",       icon: "✨" },
  { id: "acc",    name: "Cabeça",      icon: "🎩" },
  { id: "costas", name: "Costas",      icon: "🎒" },
  { id: "arma",   name: "Armas",       icon: "🔫" },
  { id: "emote",  name: "Celebrações", icon: "🕺" },
  { id: "rasto",  name: "Rastos",      icon: "🌠" },
];
const I = (id, cat, name, icon, price, cur, level, desc) => ({ id, cat, name, icon, price, cur, level, desc });
export const ITEMS = [
  // skins: acabamentos
  I("skin_classico", "skin", "Clássico", "🎨", 0, "coins", 1, "O acabamento de sempre"),
  I("skin_mate", "skin", "Mate", "🧱", 150, "coins", 1, "Sem brilho nenhum, como giz"),
  I("skin_brilho", "skin", "Brilhante", "💧", 150, "coins", 1, "Tinta fresca e brilhante"),
  I("skin_metal", "skin", "Metálico", "🔩", 300, "coins", 2, "Reflexos de metal"),
  I("skin_perola", "skin", "Perolado", "🦪", 400, "coins", 3, "Brilho suave de pérola"),
  I("skin_neon", "skin", "Néon", "💡", 500, "coins", 4, "Brilha com a tua cor"),
  I("skin_cromado", "skin", "Cromado", "🪞", 800, "coins", 7, "Como um espelho"),
  // skins: padrões
  I("skin_riscas", "skin", "Riscas", "🦓", 350, "coins", 2, "Riscas aos andares"),
  I("skin_bolinhas", "skin", "Bolinhas", "⚪", 350, "coins", 2, "Bolinhas claras por todo o lado"),
  I("skin_xadrez", "skin", "Xadrez", "🏁", 450, "coins", 3, "Quadrados como um tabuleiro"),
  I("skin_zebra", "skin", "Zebra", "🦓", 500, "coins", 4, "Riscas onduladas e escuras"),
  I("skin_camuflado", "skin", "Camuflado", "🪖", 600, "coins", 5, "Manchas de camuflagem"),
  I("skin_purpurina", "skin", "Purpurina", "✨", 10, "gems", 6, "Cheio de pontinhos a brilhar"),
  // cabeça
  I("acc_nada", "acc", "Nenhum", "🚫", 0, "coins", 1, "Sem acessório"),
  I("acc_bone", "acc", "Boné", "🧢", 200, "coins", 1, "Um boné virado para a frente"),
  I("acc_gorro", "acc", "Gorro", "🧶", 250, "coins", 1, "Gorro de lã com pompom"),
  I("acc_flor", "acc", "Flor no cabelo", "🌺", 250, "coins", 1, "Uma flor grande ao lado"),
  I("acc_festa", "acc", "Chapéu de festa", "🥳", 250, "coins", 1, "Para celebrar cada vitória"),
  I("acc_cone", "acc", "Cone de trânsito", "🚧", 200, "coins", 1, "Cuidado: obras na cabeça"),
  I("acc_oculos", "acc", "Óculos de sol", "🕶️", 300, "coins", 2, "Estilo acima de tudo"),
  I("acc_oculos3d", "acc", "Óculos 3D", "👓", 350, "coins", 2, "Uma lente vermelha e outra azul"),
  I("acc_cowboy", "acc", "Chapéu de cowboy", "🤠", 300, "coins", 2, "Yee-haw!"),
  I("acc_cartola", "acc", "Cartola", "🎩", 350, "coins", 2, "Elegância de mágico"),
  I("acc_gato", "acc", "Orelhas de gato", "🐱", 300, "coins", 2, "Miau!"),
  I("acc_chef", "acc", "Chapéu de chef", "👨‍🍳", 300, "coins", 2, "Mestre da tinta"),
  I("acc_coroaflores", "acc", "Coroa de flores", "🌸", 300, "coins", 2, "Flores de todas as cores"),
  I("acc_antenas", "acc", "Antenas", "👽", 350, "coins", 3, "Vens de outro planeta?"),
  I("acc_auscultadores", "acc", "Auscultadores", "🎧", 400, "coins", 3, "A ouvir a tua música"),
  I("acc_helice", "acc", "Boné com hélice", "🚁", 450, "coins", 3, "A hélice gira sem parar"),
  I("acc_aureola", "acc", "Auréola", "😇", 8, "gems", 3, "Um anel dourado a flutuar"),
  I("acc_viking", "acc", "Capacete viking", "🪓", 500, "coins", 4, "Com dois chifres"),
  I("acc_bruxa", "acc", "Chapéu de bruxa", "🧙", 450, "coins", 4, "Bico torto e tudo"),
  I("acc_coroa", "acc", "Coroa", "👑", 15, "gems", 5, "Só para campeões"),
  I("acc_unicornio", "acc", "Corno de unicórnio", "🦄", 10, "gems", 5, "Mágico e dourado"),
  I("acc_astronauta", "acc", "Capacete de astronauta", "👨‍🚀", 12, "gems", 6, "Uma bolha de vidro à volta da cabeça"),
  // costas
  I("costas_nada", "costas", "Nenhum", "🚫", 0, "coins", 1, "Nada nas costas"),
  I("costas_capa", "costas", "Capa de herói", "🦸", 400, "coins", 2, "Abana quando te mexes"),
  I("costas_mochila", "costas", "Mochila de tinta", "🎒", 450, "coins", 3, "Um depósito com a cor da tua munição"),
  I("costas_morcego", "costas", "Asas de morcego", "🦇", 600, "coins", 4, "Para os mais sombrios"),
  I("costas_anjo", "costas", "Asas de anjo", "🪽", 12, "gems", 5, "Batem devagar"),
  I("costas_jetpack", "costas", "Jetpack", "🚀", 15, "gems", 7, "Com chamas a sair"),
  // armas
  I("arma_pistola", "arma", "Pistola", "🔫", 0, "coins", 1, "A pistola de tinta original"),
  I("arma_ketchup", "arma", "Bisnaga de ketchup", "🥫", 250, "coins", 1, "Tinta… ou molho?"),
  I("arma_agua", "arma", "Pistola de água", "💦", 300, "coins", 1, "Depósito grande e redondo"),
  I("arma_lapis", "arma", "Lápis gigante", "✏️", 300, "coins", 2, "Para desenhar à pistolada"),
  I("arma_spray", "arma", "Lata de spray", "🎨", 350, "coins", 2, "Arte urbana"),
  I("arma_pincel", "arma", "Pincel gigante", "🖌️", 400, "coins", 3, "Pinta como um artista"),
  I("arma_rolo", "arma", "Rolo de pintar", "🧻", 500, "coins", 4, "Para pintar paredes inteiras"),
  I("arma_laser", "arma", "Pistola laser", "🔆", 600, "coins", 5, "Do futuro, com anéis a brilhar"),
  I("arma_bisnaga", "arma", "Bisnaga", "🧴", 12, "gems", 6, "Uma bisnaga de tinta enorme"),
  I("arma_dourada", "arma", "Pistola dourada", "🏆", 20, "gems", 8, "Ouro puro, para lendas"),
  // celebrações (tecla Z; animações em emotes.js)
  I("emote_aceno", "emote", "Aceno", "👋", 0, "coins", 1, "Um olá simpático (tecla Z)"),
  I("emote_palmas", "emote", "Palmas", "👏", 200, "coins", 1, "Bate palmas"),
  I("emote_venia", "emote", "Vénia", "🙇", 250, "coins", 1, "Uma vénia educada"),
  I("emote_danca", "emote", "Dança", "🕺", 250, "coins", 1, "Uns passos de dança"),
  I("emote_heroi", "emote", "Pose de herói", "💪", 300, "coins", 2, "Punho no ar, como um campeão"),
  I("emote_saltos", "emote", "Polichinelos", "🤾", 300, "coins", 2, "Saltos com braços e pernas abertos"),
  I("emote_mortal", "emote", "Mortal", "🤸", 400, "coins", 3, "Um mortal para trás"),
  I("emote_robo", "emote", "Dança do robô", "🤖", 450, "coins", 4, "Movimentos aos solavancos"),
  I("emote_guitarra", "emote", "Guitarra no ar", "🎸", 500, "coins", 5, "Um solo épico"),
  I("emote_piao", "emote", "Pião", "🌀", 8, "gems", 4, "Gira como um pião"),
  // rastos (ao correr; trails.js)
  I("rasto_nada", "rasto", "Nenhum", "🚫", 0, "coins", 1, "Sem rasto"),
  I("rasto_estrelas", "rasto", "Estrelas", "⭐", 300, "coins", 2, "Deixas estrelas por onde passas"),
  I("rasto_coracoes", "rasto", "Corações", "💖", 300, "coins", 2, "Muito amor pelo caminho"),
  I("rasto_notas", "rasto", "Notas musicais", "🎵", 350, "coins", 3, "Corres a cantar"),
  I("rasto_bolhas", "rasto", "Bolhas", "🫧", 350, "coins", 3, "Bolhas de sabão"),
  I("rasto_fogo", "rasto", "Fogo", "🔥", 500, "coins", 4, "Tão rápido que queima o chão"),
  I("rasto_arcoiris", "rasto", "Arco-íris", "🌈", 12, "gems", 6, "Pingos de tinta de todas as cores"),
];
export const DEFAULT_EQUIP = { skin: "skin_classico", acc: "acc_nada", costas: "costas_nada", arma: "arma_pistola", emote: "emote_aceno", rasto: "rasto_nada" };
export const FREE = ITEMS.filter((i) => i.price === 0).map((i) => i.id);
export const itemById = (id) => ITEMS.find((i) => i.id === id);

// ---------- aplicar ao boneco (o do jogador no jogo e o do lobby) ----------
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, ...o });
const SKIN = {
  skin_classico:  { roughness: 0.5,  metalness: 0 },
  skin_mate:      { roughness: 1,    metalness: 0 },
  skin_brilho:    { roughness: 0.12, metalness: 0.05 },
  skin_metal:     { roughness: 0.28, metalness: 0.6 },
  skin_perola:    { roughness: 0.18, metalness: 0.25, glow: 0.12 },
  skin_neon:      { roughness: 0.4,  metalness: 0, glow: 0.45 },
  skin_cromado:   { roughness: 0.08, metalness: 0.78 },
  skin_riscas:    { roughness: 0.45, metalness: 0, pattern: "riscas" },
  skin_bolinhas:  { roughness: 0.45, metalness: 0, pattern: "bolinhas" },
  skin_xadrez:    { roughness: 0.45, metalness: 0, pattern: "xadrez" },
  skin_zebra:     { roughness: 0.45, metalness: 0, pattern: "zebra" },
  skin_camuflado: { roughness: 0.7,  metalness: 0, pattern: "camuflado" },
  skin_purpurina: { roughness: 0.25, metalness: 0.2, pattern: "purpurina" },
};
// Padrões no shader (p = posição do ponto no boneco): só multiplicam a cor (ficam mais claros/escuros), nunca a trocam
const PATTERNS = {
  riscas:    "diffuseColor.rgb *= mix(0.58, 1.0, step(0.5, fract(vPatPos.y * 5.0)));",
  bolinhas:  "{ vec3 q = fract(vPatPos * 6.0) - 0.5; diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, vec3(1.0), 0.55), 1.0 - step(0.28, length(q))); }",
  xadrez:    "diffuseColor.rgb *= mix(0.6, 1.0, mod(floor(vPatPos.x * 5.0) + floor(vPatPos.y * 5.0) + floor(vPatPos.z * 5.0), 2.0));",
  zebra:     "{ float w = fract((vPatPos.y + sin(vPatPos.x * 7.0) * 0.08 + sin(vPatPos.z * 6.0) * 0.06) * 6.0); diffuseColor.rgb *= w < 0.42 ? 0.4 : 1.0; }",
  camuflado: "{ float n = sin(vPatPos.x * 7.1 + sin(vPatPos.y * 5.3)) * sin(vPatPos.y * 6.7 + sin(vPatPos.z * 4.9)) + sin(vPatPos.z * 7.7 + vPatPos.x * 3.1) * 0.6; diffuseColor.rgb *= n > 0.5 ? 0.6 : (n > -0.2 ? 0.8 : 1.0); }",
  purpurina: "{ float h = fract(sin(dot(floor(vPatPos * 40.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), step(0.92, h) * 0.85); }",
};
const SKIN_KEEP = /skin|hair|cheek|mouth|eye|pupil|mask/i;                          // materiais que ficam sem padrão
function setPattern(mat, id) {
  if ((mat.userData.pattern || null) === (id || null)) return;
  mat.userData.pattern = id || null;
  if (!id) { mat.onBeforeCompile = () => {}; mat.customProgramCacheKey = () => "pat:none"; mat.needsUpdate = true; return; }
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vPatPos;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvPatPos = position;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vPatPos;").replace("#include <color_fragment>", "#include <color_fragment>\n" + PATTERNS[id]);
  };
  mat.customProgramCacheKey = () => "pat:" + id;
  mat.needsUpdate = true;
}

export function applyCosmetics(model, equip) {
  if (!model || !model.userData.fromModel) return;
  const u = model.userData, e = { ...DEFAULT_EQUIP, ...equip };
  // skin: acabamento e padrão do material da tinta (setCharacterPaint mantém o brilho com a cor certa)
  const s = SKIN[e.skin] || SKIN.skin_classico;
  u.paintMat.roughness = s.roughness; u.paintMat.metalness = s.metalness; u.glow = s.glow || 0; u.neon = !!s.glow;
  u.paintMat.emissive.setHex(0x000000);
  if (s.glow) u.paintMat.emissive.copy(u.paintMat.color).multiplyScalar(s.glow);
  setPattern(u.paintMat, s.pattern);
  for (const t of u.tint || []) if (!SKIN_KEEP.test(t.m.name || "")) setPattern(t.m, s.pattern);   // o padrão vai para a roupa toda (não para a cara, o cabelo e os olhos)
  // cabeça e costas
  for (const [slot, key, build] of [["accMesh", "acc", buildAccessory], ["backMesh", "costas", buildBack]]) {
    if (u[slot]) { u[slot].parent?.remove(u[slot]); u[slot] = null; }
    const id = e[key];
    if (id && !id.endsWith("_nada") && u.body) { u[slot] = build(id, headTop(u.body), u.gunMat); if (u[slot]) u.body.add(u[slot]); }
  }
  // arma: troca o formato da pistola (a original fica escondida)
  addHeldItems(model);
  const h = u.held;
  if (!h) return;
  h.origGun ||= h.gunMeshes;
  if (h.custom) { h.custom.parent?.remove(h.custom); h.custom = null; }
  if (e.arma === "arma_pistola") h.gunMeshes = h.origGun;
  else {
    h.custom = buildWeapon(e.arma, u.gunMat);
    u.armR.add(h.custom);
    for (const m of h.origGun) m.visible = false;
    h.gunMeshes = [h.custom];
  }
  h.key = "";                                                                      // setHeld volta a decidir o que se vê
  for (const m of h.gunMeshes) m.visible = !h.gren.visible && !h.kit.visible;
}

// Partes que se mexem (hélice, asas, capa, chamas, auréola): chamar a cada frame
export function tickCosmetics(model, t) {
  const u = model?.userData;
  if (!u) return;
  u.accMesh?.userData.anim?.(t);
  u.backMesh?.userData.anim?.(t);
}

// Topo da cabeça (com o cabelo) no espaço do tronco
function headTop(body) {
  if (body.userData.headTop !== undefined) return body.userData.headTop;
  let top = 2.5;
  body.traverse((o) => { if (o.isMesh && o.geometry) { o.geometry.computeBoundingBox(); top = Math.max(top, o.geometry.boundingBox.max.y); } });
  return (body.userData.headTop = Math.min(top, 2.62));                            // (cabelo muito espetado: os chapéus assentam um pouco abaixo das pontas)
}

// cabeça (no espaço do tronco): centro da cabeça ≈ (0, 2.0, 0), raio ≈ 0.56, cara virada para +z, olhos a y ≈ 2.0
const CROWN = 2.28;                                                                // altura onde encaixam os bonés/gorros/capacetes
function buildAccessory(id, top) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
  const dome = (r, color, y = CROWN, sy = 0.75) => { const d = add(new THREE.SphereGeometry(r, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(color), 0, y, -0.02); d.scale.y = sy; return d; };
  switch (id) {
    case "acc_bone":                                                              // boné: copa + pala
      dome(0.6, 0x2f7bff);
      add(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 20, 1, false, -Math.PI / 2, Math.PI), M(0x1d4fb0), 0, CROWN + 0.03, 0.4);
      add(new THREE.SphereGeometry(0.07, 8, 6), M(0xffd21f), 0, CROWN + 0.46, -0.02);
      break;
    case "acc_helice": {                                                          // boné com hélice que gira
      dome(0.6, 0xff3b4a);
      add(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 20, 1, false, -Math.PI / 2, Math.PI), M(0xffd21f), 0, CROWN + 0.03, 0.4);
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), M(0x555555), 0, CROWN + 0.55, 0);
      const prop = new THREE.Group(); prop.position.set(0, CROWN + 0.67, 0); g.add(prop);
      for (const [c, r] of [[0x2f7bff, 0], [0x47e06a, Math.PI]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.12), M(c)); b.position.x = Math.cos(r) * 0.22; prop.add(b); }
      g.userData.anim = (t) => { prop.rotation.y = t * 14; };
      break;
    }
    case "acc_gorro":                                                             // gorro de lã: copa, dobra às riscas e pompom
      dome(0.62, 0xff8a1f, CROWN - 0.05, 0.9);
      add(new THREE.TorusGeometry(0.58, 0.09, 8, 28), M(0xffffff), 0, CROWN - 0.04, -0.02, Math.PI / 2);
      add(new THREE.SphereGeometry(0.17, 12, 10), M(0xffffff), 0, CROWN + 0.55, -0.02);
      break;
    case "acc_festa":                                                             // chapéu de festa: cone com pompom
      add(new THREE.ConeGeometry(0.3, 0.75, 18), M(0xff5fa8), 0, top + 0.28, 0);
      add(new THREE.TorusGeometry(0.22, 0.04, 8, 20), M(0xffd21f), 0, top + 0.1, 0, Math.PI / 2);
      add(new THREE.SphereGeometry(0.1, 10, 8), M(0xffffff), 0, top + 0.68, 0);
      break;
    case "acc_cone":                                                              // cone de trânsito
      add(new THREE.BoxGeometry(0.62, 0.06, 0.62), M(0x222222), 0, top - 0.06, 0);
      add(new THREE.ConeGeometry(0.28, 0.85, 20), M(0xff6a00), 0, top + 0.38, 0);
      add(new THREE.CylinderGeometry(0.19, 0.22, 0.13, 20), M(0xffffff), 0, top + 0.32, 0);
      break;
    case "acc_oculos": {                                                          // óculos de sol
      const lens = M(0x111122, { roughness: 0.1, metalness: 0.5 });
      for (const x of [-0.17, 0.17]) add(new THREE.BoxGeometry(0.26, 0.15, 0.04), lens, x, 2.0, 0.56);
      add(new THREE.BoxGeometry(0.12, 0.03, 0.03), lens, 0, 2.03, 0.56);
      break;
    }
    case "acc_oculos3d": {                                                        // óculos 3D: armação branca, lente vermelha e azul
      const frame = M(0xffffff);
      add(new THREE.BoxGeometry(0.6, 0.2, 0.03), frame, 0, 2.0, 0.555);
      add(new THREE.BoxGeometry(0.22, 0.13, 0.03), M(0xff3b4a, { transparent: true, opacity: 0.85, emissive: 0x440000 }), -0.15, 2.0, 0.575);
      add(new THREE.BoxGeometry(0.22, 0.13, 0.03), M(0x2f7bff, { transparent: true, opacity: 0.85, emissive: 0x001144 }), 0.15, 2.0, 0.575);
      break;
    }
    case "acc_cowboy":                                                            // chapéu de cowboy: aba larga e copa
      add(new THREE.CylinderGeometry(0.85, 0.85, 0.05, 28), M(0xa0632d), 0, top - 0.06, 0);
      add(new THREE.CylinderGeometry(0.4, 0.48, 0.42, 22), M(0xa0632d), 0, top + 0.16, 0);
      add(new THREE.CylinderGeometry(0.485, 0.485, 0.08, 22), M(0x3a2414), 0, top + 0.02, 0);
      break;
    case "acc_cartola":                                                           // cartola com fita vermelha
      add(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 26), M(0x1a1a22), 0, top - 0.05, 0);
      add(new THREE.CylinderGeometry(0.36, 0.36, 0.75, 24), M(0x1a1a22), 0, top + 0.33, 0);
      add(new THREE.CylinderGeometry(0.365, 0.365, 0.12, 24), M(0xff3b4a), 0, top + 0.05, 0);
      break;
    case "acc_gato": {                                                            // orelhas de gato
      for (const s of [-1, 1]) {
        add(new THREE.ConeGeometry(0.17, 0.36, 4), M(0x2b2b33), s * 0.3, top + 0.02, 0, 0, Math.PI / 4, -s * 0.25);
        add(new THREE.ConeGeometry(0.1, 0.24, 4), M(0xff8fc0), s * 0.3, top - 0.01, 0.06, 0, Math.PI / 4, -s * 0.25);
      }
      break;
    }
    case "acc_chef":                                                              // chapéu de chef: faixa e topo fofo
      add(new THREE.CylinderGeometry(0.45, 0.45, 0.28, 22), M(0xffffff), 0, top + 0.02, 0);
      for (const [x, z] of [[0, 0], [0.18, 0.1], [-0.18, 0.1], [0, -0.18]]) add(new THREE.SphereGeometry(0.3, 14, 10), M(0xffffff), x, top + 0.32, z);
      break;
    case "acc_coroaflores": {                                                     // coroa de flores
      add(new THREE.TorusGeometry(0.5, 0.05, 8, 28), M(0x2fb34e), 0, top - 0.12, 0, Math.PI / 2);
      const cols = [0xff3b4a, 0xffd21f, 0x2f7bff, 0xff8fc0, 0xa447ff, 0xff8a1f, 0xffffff, 0x47e06a];
      cols.forEach((c, i) => { const a = (i / cols.length) * Math.PI * 2; add(new THREE.SphereGeometry(0.1, 10, 8), M(c), Math.cos(a) * 0.5, top - 0.08, Math.sin(a) * 0.5); });
      break;
    }
    case "acc_flor": {                                                            // flor grande ao lado da cabeça
      const fx = 0.48, fy = 2.25, fz = 0.12;
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; add(new THREE.SphereGeometry(0.1, 10, 8), M(0xff5fa8), fx, fy + Math.cos(a) * 0.12, fz + Math.sin(a) * 0.12); }
      add(new THREE.SphereGeometry(0.08, 10, 8), M(0xffd21f), fx + 0.04, fy, fz);
      break;
    }
    case "acc_antenas": {                                                         // antenas com bolinhas a brilhar
      for (const s of [-1, 1]) {
        add(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8), M(0x47e06a), s * 0.2, top + 0.2, 0, 0, 0, -s * 0.35);
        add(new THREE.SphereGeometry(0.09, 12, 10), M(0x9dff9d, { emissive: 0x2f9a2f }), s * 0.3, top + 0.46, 0);
      }
      break;
    }
    case "acc_auscultadores": {                                                   // auscultadores: arco por cima e conchas nas orelhas
      add(new THREE.TorusGeometry(0.62, 0.06, 8, 24, Math.PI), M(0x2b2f3a), 0, 2.05, 0);
      for (const s of [-1, 1]) {
        add(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 18), M(0xff3b4a), s * 0.6, 2.02, 0, 0, 0, Math.PI / 2);
        add(new THREE.CylinderGeometry(0.12, 0.12, 0.13, 18), M(0x2b2f3a), s * 0.62, 2.02, 0, 0, 0, Math.PI / 2);
      }
      break;
    }
    case "acc_aureola": {                                                         // auréola dourada a flutuar (sobe e desce)
      const ring = add(new THREE.TorusGeometry(0.34, 0.05, 10, 32), M(0xffd21f, { emissive: 0x6b5200, metalness: 0.4, roughness: 0.25 }), 0, top + 0.28, 0, Math.PI / 2);
      g.userData.anim = (t) => { ring.position.y = top + 0.28 + Math.sin(t * 2.5) * 0.05; };
      break;
    }
    case "acc_viking": {                                                          // capacete viking com chifres
      dome(0.62, 0x9aa3ad, CROWN - 0.02, 0.85);
      add(new THREE.TorusGeometry(0.6, 0.06, 8, 28), M(0xc9a227), 0, CROWN - 0.02, -0.02, Math.PI / 2);
      for (const s of [-1, 1]) add(new THREE.ConeGeometry(0.11, 0.55, 12), M(0xf3ead2), s * 0.62, CROWN + 0.32, 0, 0, 0, -s * 0.85);
      break;
    }
    case "acc_bruxa":                                                             // chapéu de bruxa com bico torto
      add(new THREE.CylinderGeometry(0.82, 0.82, 0.04, 28), M(0x5b2a8c), 0, top - 0.05, 0);
      add(new THREE.ConeGeometry(0.42, 1.0, 22), M(0x5b2a8c), 0.08, top + 0.45, 0, 0, 0, -0.22);
      add(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 22), M(0x47e06a), 0, top + 0.02, 0);
      break;
    case "acc_coroa": {                                                           // coroa com pontas e uma joia
      const gold = M(0xffc61a, { metalness: 0.6, roughness: 0.25, emissive: 0x3a2a00 }), y = top - 0.1;
      add(new THREE.CylinderGeometry(0.34, 0.36, 0.2, 20, 1, true), gold, 0, y, 0);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(new THREE.ConeGeometry(0.07, 0.2, 6), gold, Math.cos(a) * 0.32, y + 0.18, Math.sin(a) * 0.32); }
      add(new THREE.OctahedronGeometry(0.08), M(0xff3b4a, { emissive: 0x550010 }), 0, y + 0.03, 0.36);
      break;
    }
    case "acc_unicornio":                                                         // corno de unicórnio dourado, inclinado para a frente
      add(new THREE.ConeGeometry(0.1, 0.62, 16), M(0xffe27a, { emissive: 0x5a4300, metalness: 0.3, roughness: 0.3 }), 0, top + 0.18, 0.28, 0.45);
      break;
    case "acc_astronauta":                                                        // capacete de astronauta: bolha de vidro e gola
      add(new THREE.SphereGeometry(0.86, 28, 20), M(0xcfe8ff, { transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.2, depthWrite: false }), 0, 2.0, 0);
      add(new THREE.TorusGeometry(0.55, 0.1, 10, 28), M(0xffffff), 0, 1.3, 0, Math.PI / 2);
      break;
    default: return null;
  }
  return g;
}

// costas (no espaço do tronco): tronco por volta de y 1.0–1.6, costas a z ≈ -0.3
function buildBack(id, top, paint) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; parent.add(m); return m; };
  switch (id) {
    case "costas_capa": {                                                         // capa vermelha que abana
      const cape = new THREE.Group(); cape.position.set(0, 1.6, -0.34); g.add(cape);
      const geo = new THREE.PlaneGeometry(0.9, 1.15, 1, 4); geo.translate(0, -0.575, 0);
      add(geo, M(0xff3b4a, { side: THREE.DoubleSide }), 0, 0, 0, 0.12, 0, 0, cape);
      add(new THREE.BoxGeometry(0.95, 0.08, 0.08), M(0xffd21f), 0, 0, 0.02, 0, 0, 0, cape);
      g.userData.anim = (t) => { cape.rotation.x = 0.12 + Math.sin(t * 4) * 0.08; };
      break;
    }
    case "costas_mochila":                                                        // mochila com um depósito da cor da munição
      add(new THREE.BoxGeometry(0.5, 0.55, 0.22), M(0x3a3f4a), 0, 1.25, -0.4);
      add(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 16), paint, 0, 1.3, -0.56);
      add(new THREE.TorusGeometry(0.2, 0.03, 6, 16, Math.PI), M(0x222222), 0.25, 1.1, -0.35, 0, Math.PI / 2, 0);
      break;
    case "costas_morcego":
    case "costas_anjo": {                                                         // asas: duas, batem devagar
      const angel = id === "costas_anjo", mat = M(angel ? 0xffffff : 0x3a1a55, { side: THREE.DoubleSide, roughness: angel ? 0.6 : 0.4 });
      const wings = [];
      for (const s of [-1, 1]) {
        const w = new THREE.Group(); w.position.set(s * 0.15, 1.4, -0.36); g.add(w); wings.push([w, s]);
        if (angel) for (let i = 0; i < 4; i++) { const f = add(new THREE.SphereGeometry(0.22 - i * 0.03, 12, 8), mat, s * (0.25 + i * 0.2), 0.15 - i * 0.08, 0, 0, 0, 0, w); f.scale.set(1.3, 0.55, 0.25); }
        else {
          const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.9, 0.35); sh.quadraticCurveTo(0.75, 0.05, 0.85, -0.2); sh.quadraticCurveTo(0.6, -0.1, 0.55, -0.35); sh.quadraticCurveTo(0.35, -0.15, 0.2, -0.35); sh.lineTo(0, 0);
          const m = add(new THREE.ShapeGeometry(sh), mat, 0, 0, 0, 0, 0, 0, w); m.scale.x = s;
        }
      }
      g.userData.anim = (t) => { for (const [w, s] of wings) w.rotation.y = s * (0.35 + Math.sin(t * (angel ? 3 : 5)) * 0.25); };
      break;
    }
    case "costas_jetpack": {                                                      // jetpack: dois depósitos e chamas a tremer
      const flames = [];
      for (const s of [-1, 1]) {
        add(new THREE.CylinderGeometry(0.13, 0.13, 0.6, 16), M(0xc0c6cf, { metalness: 0.6, roughness: 0.3 }), s * 0.17, 1.3, -0.42);
        add(new THREE.ConeGeometry(0.13, 0.18, 16), M(0xff3b4a), s * 0.17, 1.68, -0.42);
        const f = add(new THREE.ConeGeometry(0.1, 0.35, 12), M(0xff8a1f, { emissive: 0xff5a00, transparent: true, opacity: 0.85 }), s * 0.17, 0.83, -0.42, Math.PI);
        flames.push(f);
      }
      g.userData.anim = (t) => { for (const [i, f] of flames.entries()) f.scale.set(1, 0.7 + Math.abs(Math.sin(t * 22 + i)) * 0.6, 1); };
      break;
    }
    default: return null;
  }
  return g;
}

// Formatos de arma na mão direita (no espaço do braço: a mão está em y ≈ -0.75 e a arma aponta para +z)
function buildWeapon(id, paint) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; g.add(m); return m; };
  const dark = M(0x2b2f3a), white = M(0xf4f4f8), wood = M(0x9a6a3a), metal = M(0xb8bec8, { metalness: 0.6, roughness: 0.3 });
  const X = Math.PI / 2;
  switch (id) {
    case "arma_agua":                                                             // pistola de água: depósito redondo por cima
      add(new THREE.BoxGeometry(0.16, 0.16, 0.6), white, 0, -0.74, 0.3);
      add(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 10), white, 0, -0.74, 0.72, X);
      add(new THREE.SphereGeometry(0.17, 16, 12), paint, 0, -0.52, 0.22);
      add(new THREE.BoxGeometry(0.1, 0.24, 0.12), white, 0, -0.9, 0.06);
      break;
    case "arma_pincel":                                                           // pincel gigante
      add(new THREE.CylinderGeometry(0.045, 0.05, 0.6, 10), wood, 0, -0.75, 0.15, X);
      add(new THREE.BoxGeometry(0.2, 0.1, 0.16), metal, 0, -0.75, 0.52);
      add(new THREE.BoxGeometry(0.22, 0.12, 0.32), paint, 0, -0.75, 0.75);
      break;
    case "arma_rolo":                                                             // rolo de pintar
      add(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8), dark, 0, -0.75, 0.15, X);
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 8), metal, 0, -0.6, 0.4);
      add(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 16), paint, 0, -0.45, 0.6, 0, X);
      break;
    case "arma_bisnaga":                                                          // bisnaga de tinta
      add(new THREE.CylinderGeometry(0.14, 0.16, 0.6, 14), metal, 0, -0.72, 0.3, X);
      add(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 14), paint, 0, -0.72, 0.1, X);
      add(new THREE.ConeGeometry(0.12, 0.2, 12), metal, 0, -0.72, 0.7, X);
      add(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10), paint, 0, -0.72, 0.84, X);
      break;
    case "arma_ketchup":                                                          // bisnaga de molho (a tinta é o "molho")
      add(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 16), paint, 0, -0.74, 0.28, X);
      add(new THREE.CylinderGeometry(0.135, 0.135, 0.1, 16), white, 0, -0.74, 0.55, X);
      add(new THREE.ConeGeometry(0.06, 0.2, 12), white, 0, -0.74, 0.69, X);
      break;
    case "arma_lapis":                                                            // lápis gigante: corpo amarelo, madeira e bico com tinta
      add(new THREE.CylinderGeometry(0.09, 0.09, 0.62, 6), M(0xffd21f), 0, -0.74, 0.22, X);
      add(new THREE.CylinderGeometry(0.095, 0.095, 0.08, 6), M(0xff8fc0), 0, -0.74, -0.12, X);
      add(new THREE.ConeGeometry(0.09, 0.2, 6), M(0xe8c39a), 0, -0.74, 0.63, X);
      add(new THREE.ConeGeometry(0.035, 0.08, 6), paint, 0, -0.74, 0.74, X);
      break;
    case "arma_spray":                                                            // lata de spray com faixa da cor da tinta
      add(new THREE.CylinderGeometry(0.11, 0.11, 0.44, 16), metal, 0, -0.68, 0.18);
      add(new THREE.CylinderGeometry(0.115, 0.115, 0.18, 16), paint, 0, -0.66, 0.18);
      add(new THREE.CylinderGeometry(0.07, 0.09, 0.08, 12), white, 0, -0.42, 0.18);
      add(new THREE.BoxGeometry(0.04, 0.04, 0.08), dark, 0, -0.38, 0.24);
      break;
    case "arma_laser": {                                                          // pistola do futuro: corpo branco, anéis a brilhar com a cor da tinta
      add(new THREE.BoxGeometry(0.16, 0.18, 0.5), white, 0, -0.72, 0.25);
      add(new THREE.CylinderGeometry(0.05, 0.07, 0.35, 12), white, 0, -0.72, 0.62, X);
      for (const z of [0.5, 0.62, 0.74]) add(new THREE.TorusGeometry(0.08, 0.025, 8, 18), paint, 0, -0.72, z);
      add(new THREE.BoxGeometry(0.1, 0.24, 0.12), dark, 0, -0.9, 0.06);
      break;
    }
    case "arma_dourada": {                                                        // pistola dourada com depósito de tinta
      const gold = M(0xffc61a, { metalness: 0.7, roughness: 0.22, emissive: 0x3a2a00 });
      add(new THREE.BoxGeometry(0.16, 0.18, 0.62), gold, 0, -0.72, 0.3);
      add(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 12), gold, 0, -0.72, 0.72, X);
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 14), paint, 0, -0.52, 0.2, X);
      add(new THREE.BoxGeometry(0.1, 0.26, 0.12), gold, 0, -0.9, 0.06);
      break;
    }
  }
  return g;
}
