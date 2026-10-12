/* ============================================================
   CLASSIFICAÇÕES: estatísticas do jogador guardadas no navegador (localStorage), separadas por dificuldade dos bots
   ============================================================ */
import { DIFFICULTIES, BOT_PRESETS } from "./game-config.js";

const KEY = "colorattack.stats.v2", OLD_KEY = "colorattack.stats.v1";
const EMPTY = () => ({ games: 0, wins: 0, losses: 0, rounds: 0, roundsWon: 0, kills: 0, killsSame: 0, killsOther: 0, deaths: 0, gameKills: 0 });

let data = {};
try {
  data = JSON.parse(localStorage.getItem(KEY)) || {};
  if (!Object.keys(data).length) {                                  // dados da versão anterior (sem dificuldades) contam como "Médio"
    const old = JSON.parse(localStorage.getItem(OLD_KEY));
    if (old) data = { media: { ...EMPTY(), ...old } };
  }
} catch { /* sem localStorage: fica só em memória */ }
for (const d of DIFFICULTIES) data[d] = { ...EMPTY(), ...(data[d] || {}) };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignora */ } };

// Contadores do jogo em curso (para o ecrã final e para a pausa)
export const current = {};
export function startMatch(diff) {
  Object.assign(current, {
    diff: DIFFICULTIES.includes(diff) ? diff : "media",
    kills: 0, deaths: 0, rounds: 0, killsSame: 0, killsOther: 0, damage: 0, distance: 0, chests: 0, shots: 0,
    got: { ammo: 0, bullets: 0, grenade: 0, health: 0, invisible: 0 }, used: { grenade: 0, health: 0, invisible: 0 },
    rows: [], rk: 0, rd: 0,                                       // rows = resumo por round; rk/rd = eliminações/mortes do round em curso
  });
}
startMatch("media");
const S = () => data[current.diff];

export function recordKill(sameColor) {
  const s = S(); s.kills++; current.kills++; current.rk++;
  if (sameColor) { s.killsSame++; current.killsSame++; } else { s.killsOther++; current.killsOther++; }
  save();
}
export function recordDeath() { S().deaths++; current.deaths++; current.rd++; save(); }
export function recordRound(won, n) {
  const s = S(); s.rounds++; current.rounds++; if (won) s.roundsWon++; save();
  current.rows.push({ n, won, kills: current.rk, deaths: current.rd }); current.rk = 0; current.rd = 0;
}
// final: "A" (ganhaste) ou "B" (perdeste)
export function recordGame(final) {
  const s = S(); s.games++; s.gameKills += current.kills;
  if (final === "A") s.wins++; else s.losses++;
  save();
}
export function resetStats() { for (const d of DIFFICULTIES) data[d] = EMPTY(); save(); }

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) + "%" : "–");
const per = (a, b) => (b > 0 ? (a / b).toFixed(1).replace(".", ",") : "–");

// tab: "facil" | "media" | "dificil" | "impossivel" | "total"
export function statsHTML(tab = "media") {
  const s = tab === "total" ? DIFFICULTIES.reduce((acc, d) => { for (const k in acc) acc[k] += data[d][k]; return acc; }, EMPTY()) : data[tab];
  const card = (label, value, sub = "", cls = "") => `<div class="stCard ${cls}"><b>${value}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ""}</div>`;
  const tabs = [...DIFFICULTIES.map((d) => [d, BOT_PRESETS[d].name]), ["total", "Total"]]
    .map(([id, name]) => `<button class="stTab${id === tab ? " on" : ""}" data-tab="${id}">${name}</button>`).join("");
  return `
    <div class="stTabs">${tabs}</div>
    <h4>Jogos</h4>
    <div class="stGrid">
      ${card("Jogos", s.games)}
      ${card("Vitórias", s.wins, "", "good")}
      ${card("Derrotas", s.losses, "", "bad")}
      ${card("% de vitórias", pct(s.wins, s.games), "", "big")}
    </div>
    <h4>Rounds</h4>
    <div class="stGrid">
      ${card("Rounds jogados", s.rounds)}
      ${card("Rounds ganhos", s.roundsWon, "", "good")}
      ${card("% de rounds ganhos", pct(s.roundsWon, s.rounds), "", "big")}
    </div>
    <h4>Eliminações</h4>
    <div class="stGrid">
      ${card("Eliminações", s.kills)}
      ${card("Por jogo", per(s.gameKills, s.games))}
      ${card("Por round", per(s.kills, s.rounds))}
      ${card("Com a mesma cor", s.killsSame, pct(s.killsSame, s.kills), "good")}
      ${card("Com outra cor", s.killsOther, pct(s.killsOther, s.kills))}
      ${card("Mortes", s.deaths)}
      ${card("Eliminações/mortes", per(s.kills, s.deaths))}
    </div>`;
}
