import * as THREE from "three";
import { addHeldItems } from "./character-model.js";
import { CHARACTERS } from "./characters.js";

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
];
const I = (id, cat, name, icon, price, cur, level, desc) => ({ id, cat, name, icon, price, cur, level, desc });
export const ITEMS = [
  // skins: os personagens (equipar muda o teu boneco)
  ...CHARACTERS.map((c) => I("boneco_" + c.id, "boneco", c.name, c.icon, c.price, c.cur, c.level, c.desc)),
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
  I("arma_banana", "arma", "Banana", "🍌", 250, "coins", 1, "A tinta sai pela ponta"),
  I("arma_cenoura", "arma", "Cenoura gigante", "🥕", 300, "coins", 2, "Com folhas e tudo"),
  I("arma_chupa", "arma", "Chupa-chupa", "🍭", 300, "coins", 2, "Doce e perigoso"),
  I("arma_guarda", "arma", "Guarda-chuva", "☂️", 350, "coins", 3, "Fechado, pronto a pintar"),
  I("arma_peixe", "arma", "Peixe", "🐟", 400, "coins", 3, "Dispara pela boca"),
  I("arma_mangueira", "arma", "Mangueira", "🌿", 400, "coins", 3, "Enrolada, com agulheta de metal"),
  I("arma_trompete", "arma", "Trompete", "🎺", 500, "coins", 4, "A tinta sai pela campânula"),
  I("arma_extintor", "arma", "Extintor", "🧯", 550, "coins", 5, "Espuma de tinta"),
  I("arma_espacial", "arma", "Pistola espacial", "🛸", 650, "coins", 6, "Retro, com barbatanas"),
  I("arma_bazuca", "arma", "Bazuca de tinta", "🎯", 15, "gems", 7, "Um tubo enorme ao ombro"),
  I("arma_diamante", "arma", "Pistola de cristal", "💎", 18, "gems", 8, "Transparente, com um diamante de tinta"),
  I("arma_dourada", "arma", "Pistola dourada", "🏆", 20, "gems", 8, "Ouro puro, para lendas"),
  // celebrações (tecla Z; animações em emotes.js)
  I("emote_aceno", "emote", "Aceno", "👋", 0, "coins", 1, "Um olá simpático (tecla Z)"),
  I("emote_palmas", "emote", "Palmas", "👏", 200, "coins", 1, "Bate palmas"),
  I("emote_venia", "emote", "Vénia", "🙇", 250, "coins", 1, "Uma vénia educada"),
  I("emote_danca", "emote", "Dança", "🕺", 250, "coins", 1, "Uns passos de dança"),
  I("emote_heroi", "emote", "Pose de herói", "💪", 300, "coins", 2, "Punho no ar, como um campeão"),
  I("emote_saltos", "emote", "Polichinelos", "🤾", 300, "coins", 2, "Saltos com braços e pernas abertos"),
  I("emote_mortal", "emote", "Mortal", "🤸", 400, "coins", 3, "Um mortal para trás"),
  I("emote_robo", "emote", "Dança do robô", "🤖", 450, "coins", 4, "8 poses aos solavancos e, no fim, desliga-se"),
  I("emote_guitarra", "emote", "Guitarra no ar", "🎸", 500, "coins", 5, "Guitarra elétrica a sério e um solo épico"),
  I("emote_piao", "emote", "Pião", "🌀", 8, "gems", 4, "Gira como um pião"),
  I("emote_coracao", "emote", "Coração", "💖", 250, "coins", 1, "Um coração com as mãos, a bater"),
  I("emote_sono", "emote", "A dormir", "😴", 250, "coins", 1, "Adormece de pé… e acorda num salto"),
  I("emote_floss", "emote", "Floss", "🕺", 350, "coins", 2, "Braços de um lado para o outro, sem parar"),
  I("emote_dab", "emote", "Dab", "😎", 350, "coins", 2, "Dois dabs, um para cada lado"),
  I("emote_cavalinho", "emote", "Cavalinho", "🐴", 450, "coins", 3, "Braços cruzados e saltinhos de lado"),
  I("emote_karate", "emote", "Karaté", "🥋", 500, "coins", 4, "Golpe de mão, pontapé alto e soco"),
  I("emote_flexoes", "emote", "Flexões", "💪", 550, "coins", 5, "Deita-se e faz flexões"),
  I("emote_meditar", "emote", "Meditar", "🧘", 10, "gems", 6, "Pernas cruzadas… e a flutuar"),
  // rastos (ao correr; trails.js)
  I("rasto_nada", "rasto", "Nenhum", "🚫", 0, "coins", 1, "Sem rasto"),
  I("rasto_estrelas", "rasto", "Estrelas", "⭐", 300, "coins", 2, "Deixas estrelas por onde passas"),
  I("rasto_coracoes", "rasto", "Corações", "💖", 300, "coins", 2, "Muito amor pelo caminho"),
  I("rasto_notas", "rasto", "Notas musicais", "🎵", 350, "coins", 3, "Corres a cantar"),
  I("rasto_bolhas", "rasto", "Bolhas", "🫧", 350, "coins", 3, "Bolhas de sabão"),
  I("rasto_fogo", "rasto", "Fogo", "🔥", 500, "coins", 4, "Tão rápido que queima o chão"),
  I("rasto_arcoiris", "rasto", "Arco-íris", "🌈", 12, "gems", 6, "Pingos de tinta de todas as cores"),
  I("rasto_folhas", "rasto", "Folhas", "🍃", 250, "coins", 1, "Folhas a voar como no outono"),
  I("rasto_pegadas", "rasto", "Pegadas", "👣", 250, "coins", 1, "Deixas pegadas por todo o lado"),
  I("rasto_flores", "rasto", "Flores", "🌸", 300, "coins", 2, "Um jardim por onde passas"),
  I("rasto_flocos", "rasto", "Flocos de neve", "❄️", 350, "coins", 2, "Inverno a cada passo"),
  I("rasto_doces", "rasto", "Doces", "🍬", 350, "coins", 3, "Rebuçados e chupa-chupas"),
  I("rasto_pizza", "rasto", "Pizza", "🍕", 400, "coins", 3, "Fatias de pizza a voar"),
  I("rasto_borboletas", "rasto", "Borboletas", "🦋", 450, "coins", 4, "Borboletas a levantar voo"),
  I("rasto_confetis", "rasto", "Confetis", "🎉", 450, "coins", 4, "Uma festa a cada passo"),
  I("rasto_relampagos", "rasto", "Relâmpagos", "⚡", 500, "coins", 5, "Mais rápido que um raio"),
  I("rasto_fantasmas", "rasto", "Fantasmas", "👻", 550, "coins", 5, "Buuu!"),
  I("rasto_caveiras", "rasto", "Caveiras", "💀", 10, "gems", 6, "Para os mais assustadores"),
  I("rasto_moedas", "rasto", "Moedas", "🪙", 15, "gems", 8, "Corres a deitar dinheiro fora"),
];
export const DEFAULT_EQUIP = { boneco: "boneco_iniciante", arma: "arma_pistola", emote: "emote_aceno", rasto: "rasto_nada" };
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
  h.key = "";                                                                      // setHeld volta a decidir o que se vê
  for (const m of h.gunMeshes) m.visible = !h.gren.visible && !h.kit.visible;
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
