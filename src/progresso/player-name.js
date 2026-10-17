/* ============================================================
   O TEU NOME: escolhido no Perfil (ou na janela dos Amigos); aparece no pódio do fim do jogo e para os amigos nas salas.
   Até 14 letras. Guardado em localStorage "colorattack.name" (por defeito "Jogador").
   ============================================================ */
const KEY = "colorattack.name";
export const NAME_MAX = 14;
export function playerName() { try { return localStorage.getItem(KEY) || "Jogador"; } catch { return "Jogador"; } }
export function setPlayerName(n) {
  const clean = String(n || "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX) || "Jogador";
  try { localStorage.setItem(KEY, clean); } catch { /* ignora */ }
  return clean;
}
