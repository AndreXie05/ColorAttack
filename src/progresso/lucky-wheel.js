/* ============================================================
   RODA DA SORTE 🎡: uma vez por dia rodas a roda e ganhas o que calhar (moedas, XP, uma joia ou um item da loja).
   As fatias têm pesos: as moedas pequenas saem muitas vezes, a joia e o item raramente.
   As moedas daqui não contam para o máximo do dia. O item é um da loja (de moedas) que ainda não tens e que o teu nível
   já deixa comprar (como na caixa-surpresa); se não houver nenhum, dá 🪙 300.
   Guardado em localStorage "colorattack.wheel" = dia da última volta.
   ============================================================ */
import * as Progress from "./progress.js";

const KEY = "colorattack.wheel";
// por esta ordem na roda (a 1.ª fatia começa em cima e as outras seguem no sentido dos ponteiros do relógio)
export const SLICES = [
  { kind: "coins", n: 50,  icon: "🪙", label: "50",     color: "#ffd21f", w: 22 },
  { kind: "xp",    n: 100, icon: "⭐", label: "100 XP", color: "#2f7bff", w: 18 },
  { kind: "coins", n: 100, icon: "🪙", label: "100",    color: "#ff8a1f", w: 20 },
  { kind: "gems",  n: 1,   icon: "💎", label: "1",      color: "#9be7ff", w: 7 },
  { kind: "coins", n: 200, icon: "🪙", label: "200",    color: "#47e06a", w: 12 },
  { kind: "xp",    n: 300, icon: "⭐", label: "300 XP", color: "#a447ff", w: 10 },
  { kind: "coins", n: 500, icon: "💰", label: "500",    color: "#ff3b4a", w: 4 },
  { kind: "item",  n: 1,   icon: "🎁", label: "Item",   color: "#ff8ad8", w: 7 },
];

const dayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export function canSpin() { try { return localStorage.getItem(KEY) !== dayStr(); } catch { return true; } }

/** Roda: escolhe a fatia (pelos pesos), dá o prémio e guarda o dia. Devolve { index, slice, text, item } ou null se já rodaste hoje. */
export function spin() {
  if (!canSpin()) return null;
  const total = SLICES.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total, index = 0;
  while (r >= SLICES[index].w) { r -= SLICES[index].w; index++; }
  const slice = SLICES[index];
  let text = "", item = null;
  if (slice.kind === "coins") { Progress.addCoins(slice.n); text = `🪙 ${slice.n} moedas`; }
  else if (slice.kind === "gems") { Progress.addGems(slice.n); text = `💎 ${slice.n} joia`; }
  else if (slice.kind === "xp") { Progress.addXP(slice.n); text = `⭐ ${slice.n} XP`; }
  else {
    const pool = Progress.mysteryPool();
    if (pool.length) { item = pool[Math.floor(Math.random() * pool.length)]; Progress.giveItem(item.id); text = `${item.icon} ${item.name}`; }
    else { Progress.addCoins(300); text = "🪙 300 moedas (já tens todos os itens que podes ganhar)"; }
  }
  try { localStorage.setItem(KEY, dayStr()); } catch { /* ignora */ }
  return { index, slice, text, item };
}

// tempo até poderes rodar outra vez (meia-noite)
export function untilNext() {
  const n = new Date(), mid = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1), s = Math.max(0, (mid - n) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}
