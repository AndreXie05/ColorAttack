/* ============================================================
   1. CONFIGURAÇÕES
   ============================================================ */
export const CONFIG = {
  roundSeconds: 180,                     // 3 minutos por round
  player: { radius: 0.46, walk: 7, run: 11, scale: 0.8, crouchWalk: 3.2 },   // scale: tamanho do boneco (o modelo tem 2,5 m; 0.8 -> 2,0 m); o resto do movimento está em player-motion.js
  ui: { enemyNameDist: 30, symbolAboveHead: false, bodyTint: 0.75, crosshair: true },    // símbolo da cor por cima da cabeça de cada jogador (ajuda a saber a cor dos adversários)
  mixSeconds: 0.1,                       // tempo para misturar duas cores (0 = instantâneo, melhoria futura)
  health: { max: 100, wrongHit: 4, partialHit: 8, cure: 40 },     // vida leve: cor certa elimina de vez; cor errada tira 4; cor misturada atingida por uma das suas cores tira 8
  ammo: { start: 0, max: 200, regen: 0.12 },                  // tanques por cor primária: tiros iniciais, máximo e recarga lenta (tiros/s por cor)
  paint: { lifeSeconds: 15, fadeSeconds: 3 },                   // a tinta no chão desaparece 15 s depois de cair (esbate nos últimos 3 s)
  match: { intenseAt: 4, intenseEvery: 5,   // modo intenso: com 4 rounds ganhos por uma equipa, as cores mudam de 5 em 5 s
          toWin: 5, maxRounds: 9,  intermission: 4 },          // primeiro a 5 rounds (máx. 9); pausa entre rounds (s)
  grenade: { range: 20, radius: 4.8, flight: 0.9, gravity: 22 },   // alcance máximo (m), raio da área, tempo de voo (s)
  weapon: { fireInterval: 0.16, projectileSpeed: 60, range: 17 }, // cadência (s entre tiros) e alcance máximo da bala (m)
  respawn: { delay: 5, protection: 2 },                         // reaparece 5 s depois, com 2 s de proteção
  pickup: { lifeSeconds: 45, collectDist: 1.9 },
  chest: { reopenSeconds: 60, maxOpensPerRound: 3, emptyChance: 0.2, interactDist: 3.4 },
  suddenDeath: { emptyChance: 0.5, shots: [1, 5] },   // morte súbita: baús vazios 50%, prémios todos iguais, a caixa de munição traz de 1 a 5 balas da mesma cor
  killRefund: { primary: 3, secondaryEach: 2 },   // bónus da cor certa (tiro): balas devolvidas (primária: +3; secundária: +2 de cada ingrediente)
  fallDeath: 6,                          // m: cair desta altura ou mais (desde o ponto mais alto) elimina logo (os trampolins não contam)
  streak: { kills: 3, radarSeconds: 12, grenades: 1 },   // série: 3 eliminações seguidas sem morrer = radar mais longo + 1 granada (a cada 3)
  puddleFx: { seconds: 2.5,              // poças dos eliminados: quem as pisa fica mais rápido (cores quentes) ou mais lento (cores frias) durante uns segundos
              speed: { vermelho: 1.3, laranja: 1.3, amarelo: 1.3, azul: 0.7, roxo: 0.7, verde: 0.7, castanho: 0.85 } },
  trap: { radius: 3.5, trigger: 2, fuse: 0.5, arm: 1.0, life: 60, maxPerOwner: 2 },   // armadilha de tinta: área da explosão, distância que a aciona, tempo entre acionar e explodir (aviso), tempo até ficar ativa, duração (s), máximo por jogador
  golden: { at: 0.5, grenades: 3, invisibleSeconds: 12 },   // baú dourado: aparece a meio do round (fração do tempo); dá 3 granadas ou invisibilidade longa
  countdown: 3,                          // contagem "3, 2, 1, PINTA!" no início de cada round (s)
  cannon: { use: 5, cooldown: 20, fireEvery: 0.9, range: 34, radius: 3.6 },   // canhão de tinta: tempo a usar, recarga, s entre bolas, alcance e área de cada bola
  radarSeconds: 5,                       // bónus de eliminar com a cor certa: vês os adversários no minimapa durante estes segundos
  ammoBox: { shots: 7 },                 // uma caixa de munição = 7 tiros de UMA cor primária
  rewards: [                             // 80% dos baús dão um destes prémios; weight = % entre os prémios (soma 100)
    { id: "ammo",      icon: "📦", label: "Caixa de munição", weight: 64, drops: [1, 3] },   // 1 a 3 caixas, cada uma de uma cor à sorte
    { id: "grenade",   icon: "💣", label: "Granada de tinta", weight: 14, drops: [1, 1] },
    { id: "trap",      icon: "🪤", label: "Armadilha de tinta", weight: 7, drops: [1, 1], modes: ["secreto", "paleta"] },   // C: pousa no chão com a cor da arma; explode quando um adversário passa por cima (só nos modos em que acertar a cor é mais difícil)
    { id: "health",    icon: "💊", label: "Cura",             weight: 12, drops: [1, 1] },
    { id: "invisible", icon: "👻", label: "Invisibilidade",   weight: 3,  drops: [1, 1], duration: 5 },   // raro: 5 s invisível
  ],



};
export const ARENA = { halfX: 50, halfZ: 35 };  // todos os mapas têm 100 x 70 metros
export const PAL = { red: 0xff3b4a, blue: 0x2f7bff, yellow: 0xffd21f, purple: 0xa447ff, orange: 0xff8a1f, green: 0x2fd15a, white: 0xffffff };
export const PAINTS = [PAL.red, PAL.blue, PAL.yellow, PAL.purple, PAL.orange, PAL.green];
export const TEAM = {
  A: { name: "Equipa Turquesa", color: 0x14c9c0 },   // base à esquerda  (x negativo)
  B: { name: "Equipa Rosa",     color: 0xff5fa8 },   // base à direita   (x positivo)
};

// Dificuldade dos bots (aplica-se aos adversários; os aliados são sempre "médio").
//  reaction: tempo de reação (s) · aimErrorDeg: erro de pontaria (°) · fireInterval: segundos entre tiros
//  correctColorChance / correctSecondaryChance: probabilidade de escolherem logo a cor certa (alvo primário / misturado)
//  sight: alcance de visão (m) · range: distância preferida (m) · strafeMul: quanto se desviam de lado · lowAmmoAt: vão buscar munição abaixo disto
//  itemSeek: distância a que vão buscar itens caídos · items: como usam cura/granada/invisibilidade (random | some | smart | perfect)
//  smart: 0 nada · 1 básico · 2 foge das poças e ataca em grupo · 3 pontaria com antecipação, granadas de 2 cores, tudo ao máximo
//  lead: antecipação do movimento do alvo (0..1) · upgradeEvery: recebem melhoria de X em X rounds
export const BOT_PRESETS = {
  facil:      { name: "Fácil",     reaction: 1.2,  aimErrorDeg: 16,  fireInterval: 0.7,  correctColorChance: 0.12, correctSecondaryChance: 0.05, sight: 32, range: 15, strafeMul: 0.2, lowAmmoAt: 3,  itemSeek: 8,  items: "random",  smart: 0, lead: 0,   upgradeEvery: 2 },
  media:      { name: "Médio",     reaction: 0.8,  aimErrorDeg: 11,  fireInterval: 0.52, correctColorChance: 0.22, correctSecondaryChance: 0.1,  sight: 40, range: 17, strafeMul: 0.8, lowAmmoAt: 8,  itemSeek: 14, items: "some",    smart: 1, lead: 0,   upgradeEvery: 1 },
  dificil:    { name: "Difícil",   reaction: 0.45, aimErrorDeg: 5,   fireInterval: 0.36, correctColorChance: 0.55, correctSecondaryChance: 0.3,  sight: 46, range: 17, strafeMul: 1.0, lowAmmoAt: 14, itemSeek: 22, items: "smart",   smart: 2, lead: 0.5, upgradeEvery: 1 },
  impossivel: { name: "Impossível", reaction: 0.18, aimErrorDeg: 1.5, fireInterval: 0.26, correctColorChance: 0.96, correctSecondaryChance: 0.9,  sight: 54, range: 17, strafeMul: 1.3, lowAmmoAt: 20, itemSeek: 32, items: "perfect", smart: 3, lead: 1,   upgradeEvery: 1 },
};
// Opções da partida (menu dos mapas): rounds para ganhar (3, 5 ou 7) e duração do round (2, 3 ou 5 min); ficam guardadas
export const MATCH_TO_WIN = [3, 5, 7], ROUND_MINUTES = [2, 3, 5];
export function setMatchOptions({ toWin = CONFIG.match.toWin, minutes = Math.round(CONFIG.roundSeconds / 60) } = {}) {
  if (!MATCH_TO_WIN.includes(toWin) || !ROUND_MINUTES.includes(minutes)) return;
  CONFIG.match.toWin = toWin; CONFIG.match.maxRounds = 2 * toWin - 1; CONFIG.match.intenseAt = Math.max(2, toWin - 1);   // modo intenso: quando uma equipa está a um round de ganhar
  CONFIG.roundSeconds = minutes * 60;
  try { localStorage.setItem("colorattack.match", JSON.stringify({ toWin, minutes })); } catch { /* ignora */ }
}
try { setMatchOptions(JSON.parse(localStorage.getItem("colorattack.match")) || {}); } catch { /* usa os valores por defeito */ }
// Modos de jogo (menu dos mapas); ficam guardados
export const MODES = {
  normal:  { id: "normal",  icon: "🎨", name: "Normal",          desc: "As regras de sempre" },
  secreto: { id: "secreto", icon: "🕵️", name: "Cores Secretas",  desc: "Os adversários ficam cinzentos: descobre a cor deles pelo efeito dos teus tiros" },
  paleta:  { id: "paleta",  icon: "🟤", name: "Paleta Completa", desc: "Há uma 7.ª cor, o castanho (1 + 2 + 3), e quase tudo pode acabar castanho" },
};
CONFIG.mode = (() => { try { const m = localStorage.getItem("colorattack.mode"); return MODES[m] ? m : "normal"; } catch { return "normal"; } })();
export function setGameMode(id) {
  if (!MODES[id]) return;
  CONFIG.mode = id;
  try { localStorage.setItem("colorattack.mode", id); } catch { /* ignora */ }
}
export const DIFFICULTIES = ["facil", "media", "dificil", "impossivel"];
CONFIG.botDifficulty = (() => { try { const d = localStorage.getItem("colorattack.difficulty"); return BOT_PRESETS[d] ? d : "media"; } catch { return "media"; } })();
export function setDifficulty(id) {
  if (!BOT_PRESETS[id]) return;
  CONFIG.botDifficulty = id;
  try { localStorage.setItem("colorattack.difficulty", id); } catch { /* ignora */ }
}

/* ============================================================
   ALTURAS DO BONECO (dependem do tamanho e de estar agachado)
   ============================================================ */
export const BODY_H = 2.5 * CONFIG.player.scale;                 // altura de pé (m)
export const CROUCH_K = 0.85;                                    // agachado (joelho no chão / joelhos dobrados) fica com ~85% da altura (medido no modelo: a cabeça é grande)
export const bodyHeight = (c) => BODY_H * (c && c.crouching ? CROUCH_K : 1);
export const aimY = (c) => c.pos.y + bodyHeight(c) * 0.52;      // centro do corpo (onde se aponta)
export const eyeY = (c) => c.pos.y + bodyHeight(c) * 0.7;       // altura dos olhos / da câmara
export const muzzleY = (c) => c.pos.y + bodyHeight(c) * 0.5;    // altura da arma
