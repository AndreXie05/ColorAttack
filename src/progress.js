/* ============================================================
   NÍVEIS E XP DO JOGADOR (guardados no navegador)
   No fim de cada partida ganhas XP: eliminações, cor certa, rounds ganhos, vitória e só por jogares.
   Tudo vezes a dificuldade dos bots (mais difícil = mais XP). Cada nível pede um pouco mais de XP do que o anterior.
   ============================================================ */
const KEY = "colorattack.xp";
export const XP_RULES = { kill: 10, killSame: 5, round: 25, win: 100, played: 20 };
export const XP_DIFF = { facil: 0.75, media: 1, dificil: 1.25, impossivel: 1.5 };

let total = 0;
try { total = Number(localStorage.getItem(KEY)) || 0; } catch { /* sem localStorage: só em memória */ }

// XP para passar do nível n ao n + 1
export const needFor = (n) => 100 + 50 * (n - 1);

// { level, into (XP já feito neste nível), need (XP para o próximo), total }
export function levelInfo(xp = total) {
  let level = 1, left = xp;
  while (left >= needFor(level)) { left -= needFor(level); level++; }
  return { level, into: left, need: needFor(level), total: xp };
}
export const getXP = () => total;

// XP ganho numa partida: devolve as linhas (para o ecrã final) e o total
export function matchXP({ kills = 0, killsSame = 0, roundsWon = 0, won = false, diff = "media" }) {
  const k = XP_DIFF[diff] ?? 1, R = XP_RULES;
  const rows = [
    ["🎮 Partida jogada", R.played],
    [`💥 ${kills} ${kills === 1 ? "eliminação" : "eliminações"}`, kills * R.kill],
    [`🎯 ${killsSame} com a cor certa`, killsSame * R.killSame],
    [`🏁 ${roundsWon} ${roundsWon === 1 ? "round ganho" : "rounds ganhos"}`, roundsWon * R.round],
    ...(won ? [["🏆 Vitória", R.win]] : []),
  ].filter((r) => r[1] > 0);
  const base = rows.reduce((s, r) => s + r[1], 0);
  return { rows, mult: k, total: Math.round(base * k) };
}

// Soma o XP e guarda; devolve o nível antes e depois
export function addXP(amount) {
  const before = levelInfo(total);
  total += Math.max(0, Math.round(amount));
  try { localStorage.setItem(KEY, String(total)); } catch { /* ignora */ }
  return { before, after: levelInfo(total) };
}
