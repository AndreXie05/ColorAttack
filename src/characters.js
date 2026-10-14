/* ============================================================
   PERSONAGENS E EQUIPAS
   Os 5 bonecos leves (feitos em código, ver light-character.js). Cada equipa tem os 5, sem repetir dentro da equipa:
   se escolheres um deles, os teus 4 aliados são os outros quatro; a equipa adversária tem os cinco.
   ============================================================ */
export const CHARACTERS = [
  { id: "pinta",    name: "Pinta",     icon: "🎨", url: "light:pinta" },
  { id: "salpico",  name: "Salpico",   icon: "💦", url: "light:salpico" },
  { id: "borrao",   name: "Borrão",    icon: "🌀", url: "light:borrao" },
  { id: "pincel",   name: "Pincel",    icon: "🖌️", url: "light:pincel" },
  { id: "gota",     name: "Gota",      icon: "💧", url: "light:gota" },
];
export const PLAYABLE = CHARACTERS.map((c) => c.id);        // os que se podem escolher no lobby

// Equipas: A é a do jogador (jogador primeiro), B é a adversária. Cada uma tem 5 personagens diferentes.
export function buildRosters(playerId) {
  const pool = PLAYABLE;
  const mine = pool.includes(playerId) ? [playerId, ...pool.filter((t) => t !== playerId)] : [playerId, ...pool.slice(0, 4)];
  return { A: mine, B: [...pool] };
}
