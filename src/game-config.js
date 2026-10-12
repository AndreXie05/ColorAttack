/* ============================================================
   1. CONFIGURAÇÕES
   ============================================================ */
export const CONFIG = {
  roundSeconds: 180,                     // 3 minutos por round
  player: { radius: 0.55, walk: 7, run: 11 },                   // o resto do movimento está em player-motion.js (MOTION)
  ui: { enemyNameDist: 30, symbolAboveHead: false, bodyTint: 0.75, crosshair: false },    // símbolo da cor por cima da cabeça de cada jogador (ajuda a saber a cor dos adversários)
  mixSeconds: 0.1,                       // tempo para misturar duas cores (0 = instantâneo, melhoria futura)
  health: { max: 100, wrongHit: 4, partialHit: 8, cure: 40 },     // vida leve: cor certa elimina de vez; cor errada tira 4; cor misturada atingida por uma das suas cores tira 8
  ammo: { start: 0, max: 200, regen: 0.12 },                  // tanques por cor primária: tiros iniciais, máximo e recarga lenta (tiros/s por cor)
  paint: { lifeSeconds: 15, fadeSeconds: 3 },                   // a tinta no chão desaparece 15 s depois de cair (esbate nos últimos 3 s)
  match: { intenseAt: 4, intenseEvery: 5,   // modo intenso: com 4 rounds ganhos por uma equipa, as cores mudam de 5 em 5 s
          toWin: 5, maxRounds: 9,  intermission: 4 },          // primeiro a 5 rounds (máx. 9); pausa entre rounds (s)
  grenade: { range: 20, radius: 4.8, flight: 0.9, gravity: 22 },   // alcance máximo (m), raio da área, tempo de voo (s)
  weapon: { fireInterval: 0.16, projectileSpeed: 60, range: 17 }, // cadência (s entre tiros) e alcance máximo da bala (m)
  respawn: { delay: 5, protection: 2 },                         // reaparece 5 s depois, com 2 s de proteção
  bots: null,                            // preenchido abaixo com a dificuldade escolhida (BOT_PRESETS)
  pickup: { lifeSeconds: 45, collectDist: 1.9 },
  chest: { reopenSeconds: 60, maxOpensPerRound: 3, emptyChance: 0.2, interactDist: 3.4 },
  suddenDeath: { emptyChance: 0.5, shots: [1, 5] },   // morte súbita: baús vazios 50%, prémios todos iguais, a caixa de munição traz de 1 a 5 balas da mesma cor
  ammoBox: { shots: 7 },                 // uma caixa de munição = 7 tiros de UMA cor primária
  rewards: [                             // 80% dos baús dão um destes prémios; weight = % entre os prémios (soma 100)
    { id: "ammo",      icon: "📦", label: "Caixa de munição", weight: 70, drops: [1, 3] },   // 1 a 3 caixas, cada uma de uma cor à sorte
    { id: "grenade",   icon: "💣", label: "Granada de tinta", weight: 15, drops: [1, 1] },
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

// Dificuldade dos bots: tempo de reação (s), erro de pontaria (graus), segundos entre tiros e probabilidade de escolherem
// a cor certa (alvo de cor primária / alvo de cor misturada). Também: alcance de visão e distância preferida (m).
export const BOT_PRESETS = {
  facil:   { reaction: 1.1, aimErrorDeg: 14, fireInterval: 0.6,  correctColorChance: 0.12, correctSecondaryChance: 0.05, sight: 36, range: 18 },
  media:   { reaction: 0.8, aimErrorDeg: 11, fireInterval: 0.52, correctColorChance: 0.22, correctSecondaryChance: 0.1,  sight: 40, range: 17 },
  dificil: { reaction: 0.5, aimErrorDeg: 6,  fireInterval: 0.36, correctColorChance: 0.6,  correctSecondaryChance: 0.35, sight: 46, range: 16 },
};
CONFIG.botDifficulty = "media";
CONFIG.bots = BOT_PRESETS[CONFIG.botDifficulty];
