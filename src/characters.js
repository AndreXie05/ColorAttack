/* ============================================================
   PERSONAGENS E EQUIPAS
   Cada equipa tem os 5 Titãs, sem repetir dentro da equipa: se escolheres o Robin, os teus 4 aliados são os
   outros quatro; a equipa adversária tem os cinco. (Modelos feitos no Blender, só para uso pessoal.)
   ============================================================ */
export const CHARACTERS = [
  { id: "robin",    name: "Robin",     icon: "🦇", url: "assets/characters/robin.glb",    titan: true },
  { id: "starfire", name: "Starfire",  icon: "🌟", url: "assets/characters/starfire.glb", titan: true },
  { id: "cyborg",   name: "Cyborg",    icon: "🤖", url: "assets/characters/cyborg.glb",   titan: true },
  { id: "raven",    name: "Raven",     icon: "🔮", url: "assets/characters/raven.glb",    titan: true },
  { id: "beastboy", name: "Beast Boy", icon: "🦎", url: "assets/characters/beastboy.glb", titan: true },
  { id: "original", name: "Original",  icon: "🧢", url: "assets/character.glb",           titan: false },   // boneco do estilo da foto (teste)
];
export const TITANS = CHARACTERS.filter((c) => c.titan).map((c) => c.id);

// Equipas: A é a do jogador (jogador primeiro), B é a adversária. Cada uma tem 5 personagens diferentes.
export function buildRosters(playerId) {
  const mine = TITANS.includes(playerId) ? [playerId, ...TITANS.filter((t) => t !== playerId)] : [playerId, ...TITANS.slice(0, 4)];
  return { A: mine, B: [...TITANS] };
}
