/* ============================================================
   MISSÕES DIÁRIAS 📅: todos os dias há 3 missões novas (iguais para quem jogar nesse dia), sorteadas de uma lista.
   Dão moedas (que não contam para o máximo do dia) e, de vez em quando, uma missão difícil dá joias.
   O jogo avisa o que vai acontecendo (track, endMatch: as mesmas coisas que as conquistas); o prémio é dado logo ao acabar.
   ============================================================ */
import * as Progress from "./progress.js";

const KEY = "colorattack.missions";
const MODE_NAMES = { normal: "Normal", secreto: "Cores Secretas", paleta: "Paleta Completa", relampago: "Mistura Relâmpago", latas: "Rouba-Latas", zonas: "Pinta e Conquista" };
const WX_NAMES = { trovoada: "com trovoada", nevoeiro: "com nevoeiro", chuva: "à chuva" };
// k = o que conta; x = pormenor (modo, clima, dificuldade); n = quantas; coins/gems = prémio
const POOL = [
  { k: "kill", n: 10, coins: 80, icon: "💥", desc: (n) => `Faz ${n} eliminações` },
  { k: "kill", n: 25, coins: 160, icon: "💥", desc: (n) => `Faz ${n} eliminações` },
  { k: "same", n: 5, coins: 90, icon: "🎯", desc: (n) => `Faz ${n} eliminações com a cor certa` },
  { k: "same", n: 12, coins: 170, icon: "🎯", desc: (n) => `Faz ${n} eliminações com a cor certa` },
  { k: "win", n: 1, coins: 80, icon: "🏆", desc: () => "Ganha uma partida" },
  { k: "win", n: 3, coins: 220, icon: "🏆", desc: (n) => `Ganha ${n} partidas` },
  { k: "game", n: 3, coins: 70, icon: "🎮", desc: (n) => `Joga ${n} partidas` },
  { k: "round", n: 5, coins: 110, icon: "🏁", desc: (n) => `Ganha ${n} rounds` },
  { k: "chest", n: 6, coins: 90, icon: "🧰", desc: (n) => `Abre ${n} baús` },
  { k: "blast", n: 3, coins: 130, icon: "💣", desc: (n) => `Elimina ${n} vezes com granadas, armadilhas ou canhão` },
  { k: "golden", n: 1, coins: 150, icon: "🌟", desc: () => "Abre um baú dourado" },
  { k: "can", n: 2, coins: 160, icon: "🥫", desc: (n) => `Entrega ${n} latas no Rouba-Latas` },
  { k: "friends", n: 1, coins: 100, icon: "👥", desc: () => "Joga uma partida com amigos" },
  ...["secreto", "paleta", "relampago", "latas", "zonas"].map((m) => ({ k: "winMode", x: m, n: 1, coins: 160, icon: "🎨", desc: () => `Ganha uma partida em ${MODE_NAMES[m]}` })),
  ...["trovoada", "nevoeiro", "chuva"].map((w) => ({ k: "roundWx", x: w, n: 2, coins: 140, icon: "🌦️", desc: (n) => `Ganha ${n} rounds ${WX_NAMES[w]}` })),
  { k: "winDiff", x: "dificil", n: 1, coins: 220, icon: "😠", desc: () => "Ganha uma partida no Difícil" },
  // difíceis: dão joias (no máximo uma por dia)
  { k: "winDiff", x: "impossivel", n: 1, gems: 2, icon: "💀", desc: () => "Ganha uma partida no Impossível", hard: true },
  { k: "flawless", n: 1, gems: 2, icon: "🛡️", desc: () => "Ganha uma partida sem seres eliminado", hard: true },
  { k: "bestKills", n: 15, gems: 1, icon: "🔥", desc: (n) => `Faz ${n} eliminações numa só partida`, hard: true },
];

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };   // (dia local)
// sorteio do dia: sempre o mesmo para a mesma data (a semente é a data)
function pickFor(day) {
  let seed = [...day].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const out = [], used = new Set(), hardOk = rnd() < 0.5;                               // em metade dos dias há uma missão de joias
  while (out.length < 3) {
    const i = Math.floor(rnd() * POOL.length), m = POOL[i];
    if (used.has(m.k + (m.x || "")) || (m.hard && (!hardOk || out.some((o) => POOL[o].hard)))) continue;
    used.add(m.k + (m.x || "")); out.push(i);
  }
  return out;
}

let data = null;
function load() {
  const day = today();
  if (data?.day === day) return data;
  try { data = JSON.parse(localStorage.getItem(KEY)); } catch { data = null; }
  if (!data || data.day !== day) data = { day, list: pickFor(day).map((i) => ({ i, have: 0, done: false })) };
  return data;
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignora */ } };

// soma `add` às missões do tipo k (e pormenor x); value = em vez de somar, põe o máximo (para "numa só partida"). Devolve as acabadas agora
function bump(k, x, add, value = null) {
  const d = load(), got = [];
  for (const m of d.list) {
    const p = POOL[m.i];
    if (m.done || p.k !== k || (p.x && p.x !== x)) continue;
    m.have = value !== null ? Math.max(m.have, value) : m.have + add;
    if (m.have >= p.n) {
      m.have = p.n; m.done = true;
      if (p.gems) Progress.addGems(p.gems); else Progress.addCoins(p.coins);
      got.push(info(m));
    }
  }
  save();
  return got;
}

// durante a partida (os mesmos avisos das conquistas): kill(corCerta, via) · chest · golden · can · roundWon({ weather })
export function track(what, a, b) {
  if (what === "kill") return [...bump("kill", null, 1), ...(a ? bump("same", null, 1) : []), ...(b === "grenade" || b === "trap" || b === "cannon" ? bump("blast", null, 1) : [])];
  if (what === "chest" || what === "golden" || what === "can") return bump(what, null, 1);
  if (what === "roundWon") return [...bump("round", null, 1), ...bump("roundWx", a?.weather, 1)];
  return [];
}
// fim da partida: m = { won, deaths, kills, diff, mode, online }
export function endMatch(m) {
  const got = [...bump("game", null, 1), ...bump("bestKills", null, 0, m.kills || 0)];
  if (m.online) got.push(...bump("friends", null, 1));
  if (m.won) got.push(...bump("win", null, 1), ...bump("winMode", m.mode, 1), ...bump("winDiff", m.diff, 1), ...(!m.deaths ? bump("flawless", null, 1) : []));
  return got;
}

const info = (m) => { const p = POOL[m.i]; return { icon: p.icon, desc: p.desc(p.n), n: p.n, have: m.have, done: m.done, coins: p.coins, gems: p.gems }; };
export const list = () => load().list.map(info);
export const prize = (m) => (m.gems ? `💎 ${m.gems}` : `🪙 ${m.coins}`);
// tempo até às missões novas (meia-noite)
export function untilNew() {
  const n = new Date(), mid = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1), s = Math.max(0, (mid - n) / 1000);
  const h = Math.floor(s / 3600), min = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${min} min` : `${min} min`;
}
