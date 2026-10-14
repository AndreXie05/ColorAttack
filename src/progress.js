import { ITEMS, FREE, DEFAULT_EQUIP, itemById } from "./cosmetics.js";

/* ============================================================
   NÍVEIS, XP, MOEDAS E JOIAS DO JOGADOR (guardados no navegador)
   Moedas 🪙: metade do XP de cada partida. Joias 💎: +5 por cada nível que sobes.
   Também guarda o que compraste na loja (owned) e o que tens equipado (equip).
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

// Soma o XP (e as moedas e joias que vêm com ele) e guarda; devolve o nível antes e depois e o que ganhaste
export const COINS_PER_XP = 0.5, GEMS_PER_LEVEL = 5;
export function addXP(amount) {
  const before = levelInfo(total);
  total += Math.max(0, Math.round(amount));
  try { localStorage.setItem(KEY, String(total)); } catch { /* ignora */ }
  const after = levelInfo(total), coins = Math.round(amount * COINS_PER_XP), gems = (after.level - before.level) * GEMS_PER_LEVEL;
  wallet.coins += coins; wallet.gems += gems; saveWallet();
  return { before, after, coins, gems };
}

// ---------- carteira e inventário ----------
const WKEY = "colorattack.wallet";
export const wallet = { coins: 0, gems: 0, owned: [...FREE], equip: { ...DEFAULT_EQUIP } };
try {
  const w = JSON.parse(localStorage.getItem(WKEY));
  if (w) Object.assign(wallet, { coins: w.coins || 0, gems: w.gems || 0, owned: [...new Set([...FREE, ...(w.owned || [])])], equip: { ...DEFAULT_EQUIP, ...(w.equip || {}) } });
} catch { /* começa vazio */ }
// Categorias que saíram da loja (Roupa, Cabeça, Costas): o que compraste é devolvido em moedas/joias
const REFUND = { skin_mate: [150, "coins"], skin_brilho: [150, "coins"], skin_metal: [300, "coins"], skin_perola: [400, "coins"], skin_neon: [500, "coins"], skin_cromado: [800, "coins"], skin_riscas: [350, "coins"], skin_bolinhas: [350, "coins"], skin_xadrez: [450, "coins"], skin_zebra: [500, "coins"], skin_camuflado: [600, "coins"], skin_purpurina: [10, "gems"], acc_bone: [200, "coins"], acc_gorro: [250, "coins"], acc_flor: [250, "coins"], acc_festa: [250, "coins"], acc_cone: [200, "coins"], acc_oculos: [300, "coins"], acc_oculos3d: [350, "coins"], acc_cowboy: [300, "coins"], acc_cartola: [350, "coins"], acc_gato: [300, "coins"], acc_chef: [300, "coins"], acc_coroaflores: [300, "coins"], acc_antenas: [350, "coins"], acc_auscultadores: [400, "coins"], acc_helice: [450, "coins"], acc_aureola: [8, "gems"], acc_viking: [500, "coins"], acc_bruxa: [450, "coins"], acc_coroa: [15, "gems"], acc_unicornio: [10, "gems"], acc_astronauta: [12, "gems"], costas_capa: [400, "coins"], costas_mochila: [450, "coins"], costas_morcego: [600, "coins"], costas_anjo: [12, "gems"], costas_jetpack: [15, "gems"] };
let refunded = 0;
for (const id of wallet.owned) { const r = REFUND[id]; if (r) { wallet[r[1]] += r[0]; refunded++; } }
export const refundedItems = refunded;                                              // (o lobby avisa quantos itens foram devolvidos)
// itens que já não existem (ex.: skins apagadas) saem do inventário; se estavam equipados, volta o de origem
wallet.owned = wallet.owned.filter((id) => itemById(id));
for (const k of Object.keys(wallet.equip)) if (!(k in DEFAULT_EQUIP)) delete wallet.equip[k];

for (const cat of Object.keys(DEFAULT_EQUIP)) if (!itemById(wallet.equip[cat])) wallet.equip[cat] = DEFAULT_EQUIP[cat];
function saveWallet() { try { localStorage.setItem(WKEY, JSON.stringify(wallet)); } catch { /* ignora */ } }
if (refunded) saveWallet();
export const owns = (id) => wallet.owned.includes(id);
// Pode comprar? devolve "" (sim) ou o motivo
export function cantBuy(id) {
  const it = itemById(id);
  if (!it) return "Não existe";
  if (owns(id)) return "Já é teu";
  if (levelInfo().level < it.level) return `Precisas do nível ${it.level}`;
  if (wallet[it.cur] < it.price) return it.cur === "gems" ? "Joias insuficientes" : "Moedas insuficientes";
  return "";
}
export function buy(id) {
  if (cantBuy(id)) return false;
  const it = itemById(id);
  wallet[it.cur] -= it.price; wallet.owned.push(id); saveWallet();
  return true;
}
export function equip(id) {
  const it = itemById(id);
  if (!it || !owns(id)) return false;
  wallet.equip[it.cat] = id; saveWallet();
  return true;
}
export const allItems = () => ITEMS;
