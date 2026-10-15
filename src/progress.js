import { ITEMS, FREE, DEFAULT_EQUIP, itemById } from "./cosmetics.js";

/* ============================================================
   NÍVEIS, XP, MOEDAS E JOIAS DO JOGADOR (guardados no navegador)
   Moedas 🪙: por partida (jogar, eliminações, vitória conforme a dificuldade, séries de vitórias, 1.ª vitória do dia),
   no máximo 500 por dia. Subir de nível dá 💎 +5 joias e 🪙 +100 moedas (estas não contam para o máximo do dia).
   Também guarda o que compraste na loja (owned) e o que tens equipado (equip).
   No fim de cada partida ganhas XP: eliminações, cor certa, rounds ganhos, vitória e só por jogares.
   Tudo vezes a dificuldade dos bots (mais difícil = mais XP). Cada nível pede um pouco mais de XP do que o anterior.
   ============================================================ */
const KEY = "colorattack.xp";
export const XP_RULES = { kill: 10, killSame: 5, round: 25, win: 100, played: 20 };
export const XP_DIFF = { facil: 0.75, media: 1, dificil: 1.25, impossivel: 1.5 };

let total = 0;
try { total = Number(localStorage.getItem(KEY)) || 0; } catch { /* sem localStorage: só em memória */ }

// XP para passar do nível n ao n + 1: 200, 300, 500, 750, 1000 nos primeiros; depois 1500 e mais 300 em cada nível (1800, 2100...)
const FIRST = [200, 300, 500, 750, 1000];
export const needFor = (n) => (n <= FIRST.length ? FIRST[n - 1] : 1500 + 300 * (n - FIRST.length - 1));

// { level, into (XP já feito neste nível), need (XP para o próximo), total }
function levelWith(need, xp) {
  let level = 1, left = xp;
  while (left >= need(level)) { left -= need(level); level++; }
  return { level, into: left, need: need(level), total: xp };
}
export const levelInfo = (xp = total) => levelWith(needFor, xp);
// Tabela antiga (100, 150, 200...): quem já jogava fica no mesmo nível (e com a mesma parte da barra) na tabela nova
try {
  if (localStorage.getItem(KEY + ".v") !== "2") {
    if (total > 0) {
      const old = levelWith((n) => 100 + 50 * (n - 1), total);
      let t = 0; for (let n = 1; n < old.level; n++) t += needFor(n);
      total = t + Math.round((old.into / old.need) * needFor(old.level));
      localStorage.setItem(KEY, String(total));
    }
    localStorage.setItem(KEY + ".v", "2");
  }
} catch { /* ignora */ }
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

// Soma o XP e guarda; cada nível que sobes dá joias e moedas. Devolve o nível antes e depois e o que ganhaste por subir
export const GEMS_PER_LEVEL = 5, COINS_PER_LEVEL = 100;
export function addXP(amount) {
  const before = levelInfo(total);
  total += Math.max(0, Math.round(amount));
  try { localStorage.setItem(KEY, String(total)); } catch { /* ignora */ }
  const after = levelInfo(total), ups = after.level - before.level, coins = ups * COINS_PER_LEVEL, gems = ups * GEMS_PER_LEVEL;
  wallet.coins += coins; wallet.gems += gems; saveWallet();
  return { before, after, coins, gems };
}

export function addGems(n) { wallet.gems += n; saveWallet(); }                       // (conquistas)
export function addCoins(n) { wallet.coins += n; saveWallet(); }                     // (conquistas: não contam para o máximo do dia)

// ---------- moedas de cada partida (no máximo 500 por dia) ----------
export const COIN_RULES = { played: 5, kill: 5, killSame: 2, win: { facil: 10, media: 20, dificil: 30, impossivel: 50 }, streakEvery: 3, streak: 20, firstWin: 50, dayMax: 500 };
const DKEY = "colorattack.day";
const today = () => new Date().toISOString().slice(0, 10);
function dayData() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(DKEY)); } catch { /* novo */ }
  return d && d.date === today() ? d : { date: today(), coins: 0, firstWin: false };
}
export const coinsLeftToday = () => Math.max(0, COIN_RULES.dayMax - dayData().coins);
// streak: vitórias seguidas já contando com esta partida. Devolve as linhas (para o ecrã final), o total ganho e se bateu no máximo do dia
export function matchCoins({ kills = 0, killsSame = 0, won = false, diff = "media", streak = 0 }) {
  const R = COIN_RULES, d = dayData();
  const rows = [
    ["🎮 Partida jogada", R.played],
    [`💥 ${kills} ${kills === 1 ? "eliminação" : "eliminações"}`, kills * R.kill],
    [`🎯 ${killsSame} com a cor certa`, killsSame * R.killSame],
    ...(won ? [[`🏆 Vitória (${{ facil: "Fácil", media: "Média", dificil: "Difícil", impossivel: "Impossível" }[diff] || "Média"})`, R.win[diff] ?? R.win.media]] : []),
    ...(won && streak > 0 && streak % R.streakEvery === 0 ? [[`🔥 ${streak} vitórias seguidas`, R.streak]] : []),
    ...(won && !d.firstWin ? [["☀️ Primeira vitória do dia", R.firstWin]] : []),
  ].filter((r) => r[1] > 0);
  const raw = rows.reduce((s, r) => s + r[1], 0), got = Math.min(raw, Math.max(0, R.dayMax - d.coins));
  d.coins += got; if (won) d.firstWin = true;
  try { localStorage.setItem(DKEY, JSON.stringify(d)); } catch { /* ignora */ }
  wallet.coins += got; saveWallet();
  return { rows, raw, total: got, capped: got < raw, left: R.dayMax - d.coins };
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
