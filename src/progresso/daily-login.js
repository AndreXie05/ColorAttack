/* ============================================================
   PRÉMIO DIÁRIO 🎁: entra no jogo em dias seguidos e recebe um prémio por dia (ciclo de 7 dias).
   O 7.º dia dá joias. Se falhares um dia, a série volta ao dia 1. Depois do dia 7 começa outra vez no dia 1.
   As moedas daqui não contam para o máximo de moedas por dia (como as missões e as conquistas).
   Guardado em localStorage "colorattack.login": { last: dia do último prémio, day: 1..7 (dia do ciclo recebido), total }.
   ============================================================ */
import * as Progress from "./progress.js";

const KEY = "colorattack.login";
export const REWARDS = [{ coins: 50 }, { coins: 75 }, { coins: 100 }, { coins: 150 }, { coins: 200 }, { coins: 250 }, { coins: 300, gems: 2 }];

const dayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;   // (dia local)
const today = () => dayStr(new Date());
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayStr(d); };

function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && typeof d.day === "number") return d; } catch { /* ignora */ }
  return { last: "", day: 0, total: 0 };
}
const save = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignora */ } };

/** Como está hoje: claimed = já recebeste hoje; day = dia do ciclo de hoje (1..7); lost = a série tinha-se partido. */
export function status() {
  const d = load(), t = today();
  if (d.last === t) return { claimed: true, day: d.day, lost: false, total: d.total };
  const going = d.last === yesterday() && d.day > 0;
  return { claimed: false, day: going ? (d.day % 7) + 1 : 1, lost: !going && d.day > 0, total: d.total };
}

/** Recebe o prémio de hoje (uma vez por dia). Devolve o prémio ({ coins, gems, day }) ou null se já foi recebido. */
export function claim() {
  const s = status();
  if (s.claimed) return null;
  const r = REWARDS[s.day - 1];
  Progress.addCoins(r.coins);
  if (r.gems) Progress.addGems(r.gems);
  save({ last: today(), day: s.day, total: s.total + 1 });
  return { ...r, day: s.day };
}

export const prizeText = (r) => `🪙 ${r.coins}` + (r.gems ? ` + 💎 ${r.gems}` : "");
