import * as THREE from "three";
import { addHeldItems } from "../personagens/character-model.js";
import { CHARACTERS } from "../personagens/characters.js";

/* ============================================================
   COSMÉTICA (loja e inventário): só muda o aspeto, nunca as regras do jogo
   - Skins: o personagem (gato, pirata, astronauta...); a lista e os preços estão em characters.js.
   - Armas: o formato da arma na mão. As partes coloridas usam o material da munição (mudam com a tinta na mão).
   - Celebrações (emotes.js) e Rastos (trails.js): só a lista e os preços estão aqui.
   price: em moedas (coins) ou joias (gems); level: nível mínimo para comprar.
   ============================================================ */
export const CATEGORIES = [
  { id: "boneco", name: "Skins",       icon: "🧍" },
  { id: "arma",   name: "Armas",       icon: "🔫" },
  { id: "emote",  name: "Celebrações", icon: "🕺" },
  { id: "rasto",  name: "Rastos",      icon: "🌠" },
  { id: "autocolante", name: "Autocolantes", icon: "🏷️" },
];
const I = (id, cat, name, icon, price, cur, level, desc) => ({ id, cat, name, icon, price, cur, level, desc });
export const ITEMS = [
  // skins: os personagens (equipar muda o teu boneco)
  ...CHARACTERS.map((c) => I("boneco_" + c.id, "boneco", c.name, c.icon, c.price, c.cur, c.level, c.desc)),
  // armas
  I("arma_pistola", "arma", "Pistola", "🔫", 0, "coins", 1, "A pistola de tinta original"),
  I("arma_ketchup", "arma", "Bisnaga de ketchup", "🥫", 1000, "coins", 2, "Tinta… ou molho?"),
  I("arma_agua", "arma", "Pistola de água", "💦", 1200, "coins", 3, "Depósito grande e redondo"),
  I("arma_lapis", "arma", "Lápis gigante", "✏️", 1200, "coins", 3, "Para desenhar à pistolada"),
  I("arma_spray", "arma", "Lata de spray", "🎨", 1400, "coins", 4, "Arte urbana"),
  I("arma_pincel", "arma", "Pincel gigante", "🖌️", 1600, "coins", 5, "Pinta como um artista"),
  I("arma_rolo", "arma", "Rolo de pintar", "🧻", 2000, "coins", 7, "Para pintar paredes inteiras"),
  I("arma_laser", "arma", "Pistola laser", "🔆", 2400, "coins", 9, "Do futuro, com anéis a brilhar"),
  I("arma_bisnaga", "arma", "Bisnaga", "🧴", 55, "gems", 11, "Uma bisnaga de tinta enorme"),
  I("arma_banana", "arma", "Banana", "🍌", 1000, "coins", 2, "A tinta sai pela ponta"),
  I("arma_cenoura", "arma", "Cenoura gigante", "🥕", 1200, "coins", 3, "Com folhas e tudo"),
  I("arma_chupa", "arma", "Chupa-chupa", "🍭", 1200, "coins", 3, "Doce e perigoso"),
  I("arma_guarda", "arma", "Guarda-chuva", "☂️", 1400, "coins", 4, "Fechado, pronto a pintar"),
  I("arma_peixe", "arma", "Peixe", "🐟", 1600, "coins", 5, "Dispara pela boca"),
  I("arma_mangueira", "arma", "Mangueira", "🌿", 1600, "coins", 5, "Enrolada, com agulheta de metal"),
  I("arma_trompete", "arma", "Trompete", "🎺", 2000, "coins", 7, "A tinta sai pela campânula"),
  I("arma_extintor", "arma", "Extintor", "🧯", 2200, "coins", 8, "Espuma de tinta"),
  I("arma_espacial", "arma", "Pistola espacial", "🛸", 2600, "coins", 10, "Retro, com barbatanas"),
  I("arma_baguete", "arma", "Baguete", "🥖", 1000, "coins", 2, "Pão fresquinho… com tinta"),
  I("arma_flor", "arma", "Girassol", "🌻", 1200, "coins", 3, "A tinta sai do meio da flor"),
  I("arma_garrafa", "arma", "Garrafa", "🍾", 1400, "coins", 4, "Abana bem antes de disparar"),
  I("arma_martelo", "arma", "Martelo de brincar", "🔨", 1600, "coins", 5, "Bate e pinta"),
  I("arma_microfone", "arma", "Microfone", "🎤", 1800, "coins", 6, "Para cantar vitórias"),
  I("arma_vassoura", "arma", "Vassoura", "🧹", 2000, "coins", 7, "Varre os adversários do mapa"),
  I("arma_tridente", "arma", "Tridente", "🔱", 2600, "coins", 10, "Três pontas douradas"),
  I("arma_varinha", "arma", "Varinha mágica", "🪄", 3000, "coins", 11, "Com uma estrela de tinta na ponta"),
  I("arma_arcoiris", "arma", "Canhão arco-íris", "🌈", 75, "gems", 14, "Um tubo com anéis de todas as cores"),
  I("arma_bazuca", "arma", "Bazuca de tinta", "🎯", 70, "gems", 13, "Um tubo enorme ao ombro"),
  I("arma_diamante", "arma", "Pistola de cristal", "💎", 80, "gems", 14, "Transparente, com um diamante de tinta"),
  I("arma_dourada", "arma", "Pistola dourada", "🏆", 90, "gems", 15, "Ouro puro, para lendas"),
  // celebrações (tecla Z; animações em emotes.js)
  I("emote_aceno", "emote", "Aceno", "👋", 0, "coins", 1, "Um olá simpático (tecla Z)"),
  I("emote_palmas", "emote", "Palmas", "👏", 800, "coins", 1, "Bate palmas"),
  I("emote_venia", "emote", "Vénia", "🙇", 1000, "coins", 2, "Uma vénia educada"),
  I("emote_danca", "emote", "Dança", "🕺", 1000, "coins", 2, "Uns passos de dança"),
  I("emote_heroi", "emote", "Pose de herói", "💪", 1200, "coins", 3, "Punho no ar, como um campeão"),
  I("emote_saltos", "emote", "Polichinelos", "🤾", 1200, "coins", 3, "Saltos com braços e pernas abertos"),
  I("emote_mortal", "emote", "Mortal", "🤸", 1600, "coins", 5, "Um mortal para trás"),
  I("emote_robo", "emote", "Dança do robô", "🤖", 1800, "coins", 6, "8 poses aos solavancos e, no fim, desliga-se"),
  I("emote_guitarra", "emote", "Guitarra no ar", "🎸", 2000, "coins", 7, "Guitarra elétrica a sério e um solo épico"),
  I("emote_piao", "emote", "Pião", "🌀", 35, "gems", 9, "Gira como um pião"),
  I("emote_coracao", "emote", "Coração", "💖", 1000, "coins", 2, "Um coração com as mãos, a bater"),
  I("emote_sono", "emote", "A dormir", "😴", 1000, "coins", 2, "Adormece de pé… e acorda num salto"),
  I("emote_floss", "emote", "Floss", "🕺", 1400, "coins", 4, "Braços de um lado para o outro, sem parar"),
  I("emote_dab", "emote", "Dab", "😎", 1400, "coins", 4, "Dois dabs, um para cada lado"),
  I("emote_cavalinho", "emote", "Cavalinho", "🐴", 1800, "coins", 6, "Braços cruzados e saltinhos de lado"),
  I("emote_karate", "emote", "Karaté", "🥋", 2000, "coins", 7, "Golpe de mão, pontapé alto e soco"),
  I("emote_flexoes", "emote", "Flexões", "💪", 2200, "coins", 8, "Deita-se e faz flexões"),
  I("emote_continencia", "emote", "Continência", "🫡", 800, "coins", 1, "Às ordens, capitão!"),
  I("emote_riso", "emote", "Rir à gargalhada", "😂", 1000, "coins", 2, "Não aguenta de tanto rir"),
  I("emote_beijo", "emote", "Beijinho", "😘", 1200, "coins", 3, "Manda um beijinho"),
  I("emote_choro", "emote", "Chorar", "😭", 1200, "coins", 3, "Mãos na cara… e muitas lágrimas"),
  I("emote_vitoria", "emote", "Vitória!", "✌️", 1400, "coins", 4, "Saltos com os braços no ar"),
  I("emote_galinha", "emote", "Dança da galinha", "🐔", 1600, "coins", 5, "Có-có-ró-có!"),
  I("emote_pinguim", "emote", "Andar de pinguim", "🐧", 1600, "coins", 5, "Braços colados e a abanar"),
  I("emote_zangado", "emote", "Birra", "😤", 1800, "coins", 6, "Braços cruzados e pé a bater"),
  I("emote_onda", "emote", "A onda", "🙌", 2000, "coins", 7, "Os dois braços a abanar no ar"),
  I("emote_desmaio", "emote", "Desmaio", "😵", 2600, "coins", 10, "Cai para trás… e levanta-se"),
  I("emote_helicoptero", "emote", "Helicóptero", "🚁", 65, "gems", 12, "Gira, gira… e levanta voo"),
  I("emote_meditar", "emote", "Meditar", "🧘", 45, "gems", 10, "Pernas cruzadas… e a flutuar"),
  // rastos (ao correr; trails.js)
  I("rasto_nada", "rasto", "Nenhum", "🚫", 0, "coins", 1, "Sem rasto"),
  I("rasto_estrelas", "rasto", "Estrelas", "⭐", 1200, "coins", 3, "Deixas estrelas por onde passas"),
  I("rasto_coracoes", "rasto", "Corações", "💖", 1200, "coins", 3, "Muito amor pelo caminho"),
  I("rasto_notas", "rasto", "Notas musicais", "🎵", 1400, "coins", 4, "Corres a cantar"),
  I("rasto_bolhas", "rasto", "Bolhas", "🫧", 1400, "coins", 4, "Bolhas de sabão"),
  I("rasto_fogo", "rasto", "Fogo", "🔥", 2000, "coins", 7, "Tão rápido que queima o chão"),
  I("rasto_arcoiris", "rasto", "Arco-íris", "🌈", 55, "gems", 11, "Pingos de tinta de todas as cores"),
  I("rasto_folhas", "rasto", "Folhas", "🍃", 1000, "coins", 2, "Folhas a voar como no outono"),
  I("rasto_pegadas", "rasto", "Pegadas", "👣", 1000, "coins", 2, "Deixas pegadas por todo o lado"),
  I("rasto_flores", "rasto", "Flores", "🌸", 1200, "coins", 3, "Um jardim por onde passas"),
  I("rasto_flocos", "rasto", "Flocos de neve", "❄️", 1400, "coins", 4, "Inverno a cada passo"),
  I("rasto_doces", "rasto", "Doces", "🍬", 1400, "coins", 4, "Rebuçados e chupa-chupas"),
  I("rasto_pizza", "rasto", "Pizza", "🍕", 1600, "coins", 5, "Fatias de pizza a voar"),
  I("rasto_borboletas", "rasto", "Borboletas", "🦋", 1800, "coins", 6, "Borboletas a levantar voo"),
  I("rasto_confetis", "rasto", "Confetis", "🎉", 1800, "coins", 6, "Uma festa a cada passo"),
  I("rasto_relampagos", "rasto", "Relâmpagos", "⚡", 2000, "coins", 7, "Mais rápido que um raio"),
  I("rasto_fantasmas", "rasto", "Fantasmas", "👻", 2200, "coins", 8, "Buuu!"),
  I("rasto_trevos", "rasto", "Trevos", "🍀", 1000, "coins", 2, "Sorte a cada passo"),
  I("rasto_patinhas", "rasto", "Patinhas", "🐾", 1000, "coins", 2, "Como um gatinho"),
  I("rasto_nuvens", "rasto", "Nuvens", "☁️", 1200, "coins", 3, "Andas nas nuvens"),
  I("rasto_morangos", "rasto", "Morangos", "🍓", 1200, "coins", 3, "Doce como fruta"),
  I("rasto_luas", "rasto", "Luas", "🌙", 1400, "coins", 4, "Para jogar à noite"),
  I("rasto_baloes", "rasto", "Balões", "🎈", 1400, "coins", 4, "Uma festa a correr"),
  I("rasto_bolas", "rasto", "Bolas de futebol", "⚽", 1600, "coins", 5, "Golo!"),
  I("rasto_donuts", "rasto", "Donuts", "🍩", 1600, "coins", 5, "Com cobertura e tudo"),
  I("rasto_aboboras", "rasto", "Abóboras", "🎃", 1800, "coins", 6, "Halloween o ano inteiro"),
  I("rasto_planetas", "rasto", "Planetas", "🪐", 2400, "coins", 9, "Um sistema solar atrás de ti"),
  I("rasto_unicornios", "rasto", "Unicórnios", "🦄", 60, "gems", 12, "Mágico e cheio de cor"),
  I("rasto_diamantes", "rasto", "Diamantes", "💎", 85, "gems", 14, "Só para os mais ricos"),
  I("rasto_caveiras", "rasto", "Caveiras", "💀", 45, "gems", 10, "Para os mais assustadores"),
  I("rasto_moedas", "rasto", "Moedas", "🪙", 70, "gems", 13, "Corres a deitar dinheiro fora"),
  // autocolantes: um desenho colado dos dois lados da arma (qualquer arma)
  I("autocolante_nada", "autocolante", "Sem autocolante", "🚫", 0, "coins", 1, "A arma limpinha"),
  I("autocolante_estrela", "autocolante", "Estrela", "⭐", 600, "coins", 1, "Para as estrelas da equipa"),
  I("autocolante_coracao", "autocolante", "Coração", "❤️", 600, "coins", 1, "Pinta com amor"),
  I("autocolante_oculos", "autocolante", "Óculos de sol", "😎", 800, "coins", 1, "Sempre na maior"),
  I("autocolante_flor", "autocolante", "Flor", "🌸", 800, "coins", 1, "Primavera na arma"),
  I("autocolante_raio", "autocolante", "Raio", "⚡", 1000, "coins", 2, "Rápido como um relâmpago"),
  I("autocolante_fogo", "autocolante", "Fogo", "🔥", 1000, "coins", 2, "Arma a escaldar"),
  I("autocolante_alien", "autocolante", "Extraterrestre", "👽", 1200, "coins", 3, "Vindo de outro planeta"),
  I("autocolante_caveira", "autocolante", "Caveira", "💀", 1200, "coins", 3, "Para meter medo"),
  I("autocolante_arcoiris", "autocolante", "Arco-íris", "🌈", 1400, "coins", 4, "Todas as cores numa só"),
  I("autocolante_coroa", "autocolante", "Coroa", "👑", 35, "gems", 9, "Para a realeza da tinta"),
  I("autocolante_diamante", "autocolante", "Diamante", "💎", 45, "gems", 10, "Brilha mais do que tudo"),
];
export const DEFAULT_EQUIP = { boneco: "boneco_iniciante", arma: "arma_pistola", emote: "emote_aceno", rasto: "rasto_nada", autocolante: "autocolante_nada" };
export const FREE = ITEMS.filter((i) => i.price === 0).map((i) => i.id);
export const itemById = (id) => ITEMS.find((i) => i.id === id);

// ---------- aplicar ao boneco (o do jogador no jogo e o do lobby) ----------
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, ...o });
export function applyCosmetics(model, equip) {
  if (!model || !model.userData.fromModel) return;
  const u = model.userData, e = { ...DEFAULT_EQUIP, ...equip };
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
  addSticker(model, h, e.autocolante);
  h.key = "";                                                                      // setHeld volta a decidir o que se vê
  for (const m of h.gunMeshes) m.visible = !h.gren.visible && !h.kit.visible;
}

// ---------- autocolante na arma: o desenho (emoji com contorno branco, como um autocolante recortado) dos dois lados ----------
// Mede a arma (seja qual for o formato) no espaço do braço e cola o desenho no meio de cada lado. Entra na lista de peças
// da arma (gunMeshes), por isso esconde-se com ela quando tens a granada ou a cura na mão.
const stickerTex = new Map();
function stickerTexture(icon) {
  if (stickerTex.has(icon)) return stickerTex.get(icon);
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  g.font = "84px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = "#ffffff"; g.shadowBlur = 0;
  for (const [dx, dy] of [[-5, 0], [5, 0], [0, -5], [0, 5], [-4, -4], [4, 4], [-4, 4], [4, -4]]) { g.shadowOffsetX = dx; g.shadowOffsetY = dy; g.fillText(icon, 64, 68); }   // contorno branco
  g.shadowColor = "transparent"; g.fillText(icon, 64, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  stickerTex.set(icon, t);
  return t;
}
const _inv = new THREE.Matrix4(), _rel = new THREE.Matrix4(), _box = new THREE.Box3(), _b = new THREE.Box3();
function addSticker(model, h, id) {
  const u = model.userData;
  if (h.sticker) { h.sticker.parent?.remove(h.sticker); h.sticker.userData.mat.dispose(); h.sticker.userData.geo.dispose(); h.sticker = null; }
  const it = itemById(id);
  if (!it || id === "autocolante_nada") return;
  u.armR.updateWorldMatrix(true, true); _inv.copy(u.armR.matrixWorld).invert(); _box.makeEmpty();
  for (const root of h.gunMeshes) root.traverse((m) => {                          // caixa da arma no espaço do braço
    if (!m.isMesh) return;
    m.geometry.boundingBox || m.geometry.computeBoundingBox();
    _b.copy(m.geometry.boundingBox).applyMatrix4(_rel.multiplyMatrices(_inv, m.matrixWorld)); _box.union(_b);
  });
  if (_box.isEmpty()) return;
  const size = Math.min(0.2, Math.max(0.1, (_box.max.y - _box.min.y) * 0.9)), cy = (_box.min.y + _box.max.y) / 2, cz = (_box.min.z + _box.max.z) / 2;
  const geo = new THREE.PlaneGeometry(size, size), mat = new THREE.MeshBasicMaterial({ map: stickerTexture(it.icon), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
  const g = new THREE.Group(); g.userData = { geo, mat };
  for (const side of [-1, 1]) {                                                    // dos dois lados
    const p = new THREE.Mesh(geo, mat);
    p.position.set(side > 0 ? _box.max.x + 0.006 : _box.min.x - 0.006, cy, cz); p.rotation.y = side * Math.PI / 2;
    g.add(p);
  }
  u.armR.add(g);
  h.sticker = g;
  h.gunMeshes = [...h.gunMeshes, g];
}

// Formatos de arma na mão direita (no espaço do braço: a mão está em y ≈ -0.75 e a arma aponta para +z)
export function buildWeapon(id, paint) {
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
    case "arma_baguete":                                                          // baguete: pão comprido com cortes e a ponta pintada
      add(new THREE.CylinderGeometry(0.075, 0.07, 0.78, 12), M(0xd9a05b), 0, -0.74, 0.25, X);
      for (const z of [0.05, 0.25, 0.45]) add(new THREE.BoxGeometry(0.1, 0.02, 0.06), M(0xf3d29a), 0, -0.67, z, 0, 0.5);
      add(new THREE.SphereGeometry(0.075, 12, 8), paint, 0, -0.74, 0.64);
      break;
    case "arma_flor": {                                                           // girassol: caule, pétalas amarelas e o meio da cor da tinta
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), M(0x2fa84a), 0, -0.75, 0.2, X);
      add(new THREE.TorusGeometry(0.17, 0.07, 8, 16), M(0xffd21f), 0, -0.75, 0.55);
      add(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 16), paint, 0, -0.75, 0.57, X);
      break;
    }
    case "arma_garrafa":                                                          // garrafa verde com rótulo da cor da tinta
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.4, 14), M(0x2f8f4a, { roughness: 0.2 }), 0, -0.74, 0.15, X);
      add(new THREE.CylinderGeometry(0.105, 0.105, 0.14, 14), paint, 0, -0.74, 0.15, X);
      add(new THREE.CylinderGeometry(0.04, 0.07, 0.2, 10), M(0x2f8f4a, { roughness: 0.2 }), 0, -0.74, 0.45, X);
      add(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 10), M(0xffd21f), 0, -0.74, 0.57, X);
      break;
    case "arma_martelo":                                                          // martelo de brincar: cabo de madeira e cabeça grande da cor da tinta
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), wood, 0, -0.75, 0.15, X);
      add(new THREE.CylinderGeometry(0.11, 0.11, 0.34, 14), paint, 0, -0.75, 0.46, 0, X);
      for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.115, 0.115, 0.04, 14), white, s * 0.17, -0.75, 0.46, 0, X);
      break;
    case "arma_microfone":                                                        // microfone: cabo preto, grelha de metal e um anel da cor da tinta
      add(new THREE.CylinderGeometry(0.05, 0.035, 0.42, 12), dark, 0, -0.75, 0.15, X);
      add(new THREE.TorusGeometry(0.06, 0.02, 8, 16), paint, 0, -0.75, 0.37);
      add(new THREE.SphereGeometry(0.11, 14, 10), metal, 0, -0.75, 0.46);
      break;
    case "arma_vassoura":                                                         // vassoura: cabo comprido e palha que abre para a frente
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8), wood, 0, -0.75, 0.22, X);
      add(new THREE.ConeGeometry(0.17, 0.32, 12), M(0xd8b45a), 0, -0.75, 0.75, -X);
      add(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10), paint, 0, -0.75, 0.6, X);
      break;
    case "arma_tridente": {                                                       // tridente: cabo de metal e três pontas douradas
      const gold = M(0xffd21f, { metalness: 0.6, roughness: 0.3 });
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), metal, 0, -0.75, 0.28, X);
      add(new THREE.BoxGeometry(0.3, 0.05, 0.05), gold, 0, -0.75, 0.72);
      for (const x of [-0.13, 0, 0.13]) add(new THREE.ConeGeometry(0.035, 0.22, 8), gold, x, -0.75, 0.85, X);
      add(new THREE.SphereGeometry(0.06, 10, 8), paint, 0, -0.75, 0.7);
      break;
    }
    case "arma_varinha":                                                          // varinha mágica: pau escuro e uma estrela (bola) de tinta a brilhar
      add(new THREE.CylinderGeometry(0.022, 0.03, 0.58, 8), dark, 0, -0.75, 0.2, X);
      add(new THREE.CylinderGeometry(0.032, 0.032, 0.06, 8), M(0xffd21f), 0, -0.75, 0.46, X);
      add(new THREE.OctahedronGeometry(0.11), paint, 0, -0.75, 0.6);
      add(new THREE.TorusGeometry(0.15, 0.012, 6, 20), white, 0, -0.75, 0.6);
      break;
    case "arma_arcoiris": {                                                       // canhão arco-íris: tubo branco com anéis de todas as cores
      add(new THREE.CylinderGeometry(0.11, 0.12, 0.62, 16), white, 0, -0.74, 0.25, X);
      [0xff3b4a, 0xff8a1f, 0xffd21f, 0x47e06a, 0x2f7bff, 0xa447ff].forEach((c, i) => add(new THREE.TorusGeometry(0.12, 0.022, 6, 18), M(c, { emissive: c, emissiveIntensity: 0.3 }), 0, -0.74, 0.0 + i * 0.1));
      add(new THREE.SphereGeometry(0.09, 12, 8), paint, 0, -0.74, 0.58);
      add(new THREE.BoxGeometry(0.1, 0.22, 0.1), dark, 0, -0.9, 0.08);
      break;
    }
    case "arma_bazuca": {                                                         // bazuca de tinta: tubo grande ao ombro com depósito e mira
      const green = M(0x4a7a3a);
      add(new THREE.CylinderGeometry(0.13, 0.13, 0.95, 16), green, 0, -0.62, 0.3, X);
      add(new THREE.CylinderGeometry(0.16, 0.13, 0.12, 16), dark, 0, -0.62, 0.8, X);
      add(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 16), paint, 0, -0.62, 0.74, X);
      add(new THREE.SphereGeometry(0.12, 12, 10), paint, 0, -0.44, 0.1);
      add(new THREE.BoxGeometry(0.04, 0.1, 0.12), dark, 0, -0.46, 0.45);
      add(new THREE.BoxGeometry(0.1, 0.22, 0.1), dark, 0, -0.84, 0.12);
      break;
    }
    case "arma_banana": {                                                         // banana: a tinta sai da ponta
      const yel = M(0xffd93a);
      const b = add(new THREE.TorusGeometry(0.42, 0.075, 10, 20, Math.PI * 0.7), yel, 0, -0.42, 0.2, 0, 0); b.rotation.set(0, Math.PI / 2, Math.PI * 1.15);
      add(new THREE.CylinderGeometry(0.03, 0.04, 0.08, 8), M(0x6b4a2a), 0, -0.82, -0.05, X);
      add(new THREE.SphereGeometry(0.05, 8, 6), paint, 0, -0.66, 0.6);
      break;
    }
    case "arma_peixe": {                                                          // peixe: dispara pela boca
      const fish = M(0x5fb8ff);
      add(new THREE.SphereGeometry(0.17, 14, 10), fish, 0, -0.72, 0.3).scale.set(0.8, 1, 1.8);
      add(new THREE.ConeGeometry(0.14, 0.22, 4), fish, 0, -0.72, -0.08, -X);
      add(new THREE.ConeGeometry(0.06, 0.16, 4), paint, 0, -0.56, 0.3, 0, 0);
      for (const sx of [-1, 1]) { add(new THREE.SphereGeometry(0.035, 8, 6), white, sx * 0.1, -0.68, 0.52); add(new THREE.SphereGeometry(0.018, 6, 5), dark, sx * 0.115, -0.68, 0.545); }
      add(new THREE.TorusGeometry(0.05, 0.02, 6, 12), paint, 0, -0.74, 0.6);
      break;
    }
    case "arma_cenoura": {                                                        // cenoura gigante com folhas
      add(new THREE.ConeGeometry(0.12, 0.75, 12), M(0xff8a1f), 0, -0.74, 0.42, X);
      for (const r of [-0.4, 0, 0.4]) add(new THREE.ConeGeometry(0.04, 0.22, 6), M(0x3fbf4a), Math.sin(r) * 0.06, -0.74 + Math.cos(r) * 0.05, -0.05, -X + r, 0);
      for (const z of [0.25, 0.42, 0.58]) add(new THREE.TorusGeometry(0.1 - z * 0.1, 0.012, 6, 12), M(0xd86a10), 0, -0.74, z);
      add(new THREE.SphereGeometry(0.03, 8, 6), paint, 0, -0.74, 0.8);
      break;
    }
    case "arma_guarda": {                                                         // guarda-chuva fechado: o pano tem a cor da tinta
      add(new THREE.ConeGeometry(0.13, 0.7, 8), paint, 0, -0.74, 0.5, X);
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.95, 8), dark, 0, -0.74, 0.35, X);
      const hook = add(new THREE.TorusGeometry(0.08, 0.025, 8, 14, Math.PI), wood, 0, -0.82, -0.12); hook.rotation.set(0, Math.PI / 2, Math.PI);
      add(new THREE.TorusGeometry(0.05, 0.012, 6, 12), white, 0, -0.74, 0.25);
      break;
    }
    case "arma_espacial": {                                                       // pistola espacial retro: barbatanas e bola de vidro com tinta
      add(new THREE.SphereGeometry(0.15, 14, 10), white, 0, -0.72, 0.2).scale.set(1, 1, 1.5);
      add(new THREE.ConeGeometry(0.08, 0.36, 12), white, 0, -0.72, 0.55, X);
      for (const z of [0.4, 0.5, 0.6]) add(new THREE.TorusGeometry(0.065 - (z - 0.4) * 0.12, 0.018, 6, 14), metal, 0, -0.72, z);
      for (const a of [0, 2.1, 4.2]) { const f = add(new THREE.BoxGeometry(0.02, 0.14, 0.16), M(0xff3b4a), Math.cos(a) * 0.14, -0.72 + Math.sin(a) * 0.14, 0.05); f.rotation.z = a; }
      add(new THREE.SphereGeometry(0.09, 12, 10), paint, 0, -0.55, 0.15);
      add(new THREE.BoxGeometry(0.09, 0.22, 0.1), dark, 0, -0.88, 0.05);
      break;
    }
    case "arma_extintor": {                                                       // extintor vermelho com mangueira preta (a tinta é a "espuma")
      add(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 14), M(0xe8303f), 0, -0.68, 0.2);
      add(new THREE.SphereGeometry(0.12, 14, 8), M(0xe8303f), 0, -0.43, 0.2).scale.set(1, 0.5, 1);
      add(new THREE.BoxGeometry(0.06, 0.08, 0.2), dark, 0, -0.36, 0.28);
      const hose = add(new THREE.TorusGeometry(0.16, 0.025, 6, 14, Math.PI), dark, 0, -0.52, 0.42); hose.rotation.set(0, X, 0);
      add(new THREE.ConeGeometry(0.05, 0.14, 10), dark, 0, -0.68, 0.62, X);
      add(new THREE.CylinderGeometry(0.125, 0.125, 0.1, 14), paint, 0, -0.75, 0.2);
      break;
    }
    case "arma_trompete": {                                                       // trompete dourado: a tinta sai pela campânula
      const gold = M(0xffc61a, { metalness: 0.6, roughness: 0.25 });
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 10), gold, 0, -0.66, 0.3, X);
      add(new THREE.CylinderGeometry(0.17, 0.035, 0.26, 16, 1, true), gold, 0, -0.66, 0.74, X);
      for (const z of [0.15, 0.25, 0.35]) add(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8), gold, 0, -0.58, z);
      add(new THREE.TorusGeometry(0.1, 0.03, 8, 16), gold, 0, -0.76, 0.22, 0, 0).rotation.set(0, X, 0);
      add(new THREE.CircleGeometry(0.15, 16), paint, 0, -0.66, 0.86);
      break;
    }
    case "arma_chupa": {                                                          // chupa-chupa gigante: o espiral tem a cor da tinta
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 8), white, 0, -0.74, 0.2, X);
      add(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 20), paint, 0, -0.74, 0.62, X);
      for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.06 + i * 0.06, 0.018, 6, 20), white, 0, -0.74, 0.655);
      break;
    }
    case "arma_mangueira": {                                                      // mangueira enrolada com agulheta
      const green = M(0x47c04a);
      for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.14, 0.035, 8, 20), green, -0.03 + i * 0.04, -0.62, 0.05).rotation.set(0, X, 0);
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 8), green, 0, -0.76, 0.35, X);
      add(new THREE.CylinderGeometry(0.06, 0.045, 0.18, 12), metal, 0, -0.76, 0.64, X);
      add(new THREE.CylinderGeometry(0.065, 0.065, 0.04, 12), paint, 0, -0.76, 0.74, X);
      break;
    }
    case "arma_diamante": {                                                       // pistola de cristal: corpo transparente azulado e diamante com tinta
      const glass = M(0x9fe8ff, { metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.75, emissive: 0x104050 });
      add(new THREE.BoxGeometry(0.16, 0.18, 0.6), glass, 0, -0.72, 0.28);
      add(new THREE.CylinderGeometry(0.045, 0.06, 0.3, 6), glass, 0, -0.72, 0.7, X);
      add(new THREE.OctahedronGeometry(0.13), paint, 0, -0.5, 0.22);
      add(new THREE.BoxGeometry(0.1, 0.24, 0.12), glass, 0, -0.9, 0.06);
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
