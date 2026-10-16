/* ============================================================
   CONQUISTAS 🏅: objetivos que se cumprem uma só vez. As mais fáceis dão 🪙 moedas e as mais difíceis 💎 joias (quanto mais
   difícil, mais dá). Estas moedas não contam para o máximo de moedas por dia.
   Os contadores ficam guardados à parte das Classificações (apagar as classificações não apaga as conquistas).
   O jogo avisa (track) o que vai acontecendo; no fim de cada partida (endMatch) verifica tudo e devolve as novas.
   Algumas dão também um título (title), que se escolhe no Perfil.
   ============================================================ */
import * as Progress from "./progress.js";
import * as Stats from "./stats.js";
import { WEATHER_IDS } from "../visual/weather.js";

const KEY = "colorattack.achievements";
const MAP_IDS = ["parque", "escola", "restaurante", "diversoes", "fabrica", "castelo", "estudio"];
const MODE_IDS = ["normal", "secreto", "paleta", "relampago", "latas", "zonas"];

// Cada conquista: cat (grupo no ecrã), n (número a chegar), v(c) = quanto já tens (c = contadores de sempre) e o prémio (coins ou gems)
const L = () => Progress.levelInfo().level;
const W = (c, d) => c.diffWins[d] || 0;                                             // partidas ganhas nessa dificuldade
const M = (c, m) => c.modeWins[m] || 0;                                             // partidas ganhas nesse modo
const X = (c, w) => c.wxRounds[w] || 0;                                             // rounds ganhos com esse clima
const XD = (c, d, w) => c.wxDiff[d + ":" + w] || 0;                                 // rounds ganhos com esse clima nessa dificuldade
export const CATEGORIES = [
  { id: "inicio", name: "🎮 A começar" }, { id: "elim", name: "💥 Eliminações" }, { id: "vit", name: "🏆 Vitórias" }, { id: "dif", name: "🤖 Dificuldade" },
  { id: "modo", name: "🎨 Modos de jogo" }, { id: "clima", name: "🌦️ Climas" }, { id: "mapa", name: "🗺️ Mapas e baús" }, { id: "amigos", name: "👥 Amigos" }, { id: "nivel", name: "⭐ Níveis" },
];
export const ACHIEVEMENTS = [
  // a começar
  { cat: "inicio", id: "vitoria1",   icon: "🥇", name: "Primeira vitória",      desc: "Ganha uma partida",                                coins: 100, title: "Vencedor", n: 1,    v: (c) => c.wins },
  { cat: "inicio", id: "jogos10",    icon: "🎮", name: "Aquecimento",           desc: "Joga 10 partidas",                                 coins: 150, n: 10,   v: (c) => c.games },
  { cat: "inicio", id: "jogos50",    icon: "🕹️", name: "Viciado em tinta",      desc: "Joga 50 partidas",                                 coins: 500, n: 50,   v: (c) => c.games },
  { cat: "inicio", id: "jogos100",   icon: "📅", name: "Veterano",              desc: "Joga 100 partidas",                                gems: 2,    n: 100,  v: (c) => c.games },
  { cat: "inicio", id: "jogos250",   icon: "🏛️", name: "Parte da mobília",      desc: "Joga 250 partidas",                                gems: 5, title: "Parte da mobília",    n: 250,  v: (c) => c.games },
  // eliminações
  { cat: "elim", id: "elim100",      icon: "💥", name: "Pintor de bairro",      desc: "Faz 100 eliminações",                              coins: 300, n: 100,  v: (c) => c.kills },
  { cat: "elim", id: "elim500",      icon: "☄️", name: "Tempestade de tinta",   desc: "Faz 500 eliminações",                              gems: 3, title: "Tempestade de tinta",    n: 500,  v: (c) => c.kills },
  { cat: "elim", id: "elim1000",     icon: "🌋", name: "Vulcão de tinta",       desc: "Faz 1000 eliminações",                             gems: 5,    n: 1000, v: (c) => c.kills },
  { cat: "elim", id: "elim2500",     icon: "🌌", name: "Lenda da tinta",        desc: "Faz 2500 eliminações",                             gems: 8, title: "Lenda da tinta",    n: 2500, v: (c) => c.kills },
  { cat: "elim", id: "cor50",        icon: "🎯", name: "Olho de artista",       desc: "Faz 50 eliminações com a cor certa",               coins: 300, n: 50,   v: (c) => c.killsSame },
  { cat: "elim", id: "cor250",       icon: "🏹", name: "Mestre das cores",      desc: "Faz 250 eliminações com a cor certa",              gems: 4, title: "Mestre das cores",    n: 250,  v: (c) => c.killsSame },
  { cat: "elim", id: "cor1000",      icon: "🌈", name: "Arco-íris perfeito",    desc: "Faz 1000 eliminações com a cor certa",             gems: 7, title: "Arco-íris",    n: 1000, v: (c) => c.killsSame },
  { cat: "elim", id: "jogo15",       icon: "🔥", name: "Imparável",             desc: "Faz 15 eliminações numa só partida",               gems: 2,    n: 15,   v: (c) => c.bestKills },
  { cat: "elim", id: "jogo25",       icon: "🌪️", name: "Furacão",               desc: "Faz 25 eliminações numa só partida",               gems: 4, title: "Furacão",    n: 25,   v: (c) => c.bestKills },
  { cat: "elim", id: "granada10",    icon: "💣", name: "Bombardeiro",           desc: "Elimina 10 vezes com granadas, armadilhas ou canhão", coins: 250, n: 10, v: (c) => c.blastKills },
  { cat: "elim", id: "granada50",    icon: "🧨", name: "Especialista em explosões", desc: "Elimina 50 vezes com granadas, armadilhas ou canhão", gems: 3, title: "Bombardeiro", n: 50, v: (c) => c.blastKills },
  // vitórias
  { cat: "vit", id: "vitorias25",    icon: "🏆", name: "Campeão",               desc: "Ganha 25 partidas",                                coins: 600, n: 25,   v: (c) => c.wins },
  { cat: "vit", id: "vitorias50",    icon: "🏅", name: "Colecionador de taças", desc: "Ganha 50 partidas",                                gems: 3,    n: 50,   v: (c) => c.wins },
  { cat: "vit", id: "vitorias100",   icon: "👑", name: "Rei da tinta",          desc: "Ganha 100 partidas",                               gems: 6, title: "Rei da tinta",    n: 100,  v: (c) => c.wins },
  { cat: "vit", id: "semMorrer",     icon: "🛡️", name: "Intocável",             desc: "Ganha uma partida sem seres eliminado",            gems: 3, title: "Intocável",    n: 1,    v: (c) => c.flawless },
  { cat: "vit", id: "limpa",         icon: "🧹", name: "Limpeza total",         desc: "Ganha uma partida sem perder nenhum round",        coins: 400, n: 1,    v: (c) => c.cleanWins },
  { cat: "vit", id: "serie3",        icon: "✨", name: "Boa onda",              desc: "Ganha 3 partidas seguidas",                        coins: 200, n: 3,    v: (c) => c.bestStreak },
  { cat: "vit", id: "serie5",        icon: "⚡", name: "Em série",              desc: "Ganha 5 partidas seguidas",                        gems: 2,    n: 5,    v: (c) => c.bestStreak },
  { cat: "vit", id: "serie10",       icon: "🌟", name: "Lenda",                 desc: "Ganha 10 partidas seguidas",                       gems: 5, title: "Lenda",    n: 10,   v: (c) => c.bestStreak },
  { cat: "vit", id: "serie20",       icon: "💫", name: "Ninguém te para",       desc: "Ganha 20 partidas seguidas",                       gems: 10, title: "Imparável",   n: 20,   v: (c) => c.bestStreak },
  // dificuldade
  { cat: "dif", id: "facil",         icon: "🙂", name: "Primeiros passos",      desc: "Ganha uma partida no Fácil",                       coins: 50,  n: 1,    v: (c) => W(c, "facil") },
  { cat: "dif", id: "media",         icon: "😐", name: "Nem fácil nem difícil", desc: "Ganha 5 partidas no Médio",                        coins: 250, n: 5,    v: (c) => W(c, "media") },
  { cat: "dif", id: "dificil",       icon: "😠", name: "Sem medo",              desc: "Ganha uma partida no Difícil",                     coins: 500, n: 1,    v: (c) => c.winsHard },
  { cat: "dif", id: "dificil10",     icon: "😤", name: "Duro de roer",          desc: "Ganha 10 partidas no Difícil",                     gems: 3,    n: 10,   v: (c) => W(c, "dificil") },
  { cat: "dif", id: "impossivel",    icon: "💀", name: "Impossível? Nada disso", desc: "Ganha uma partida no Impossível",                 gems: 5, title: "Impossível",    n: 1,    v: (c) => c.winsImpossible },
  { cat: "dif", id: "impossivel10",  icon: "☠️", name: "O impossível é contigo", desc: "Ganha 10 partidas no Impossível",                 gems: 10, title: "Terror dos bots",   n: 10,   v: (c) => W(c, "impossivel") },
  { cat: "dif", id: "impSemMorrer",  icon: "😇", name: "Perfeição",             desc: "Ganha uma partida no Impossível sem seres eliminado", gems: 10, title: "Perfeição", n: 1,   v: (c) => c.flawlessImp },
  // modos
  { cat: "modo", id: "modoSecreto",  icon: "🕵️", name: "Detetive",              desc: "Ganha uma partida em Cores Secretas",              coins: 300, n: 1,    v: (c) => M(c, "secreto") },
  { cat: "modo", id: "modoPaleta",   icon: "🟤", name: "Paleta completa",       desc: "Ganha uma partida em Paleta Completa",             coins: 300, n: 1,    v: (c) => M(c, "paleta") },
  { cat: "modo", id: "modoRelampago", icon: "⚡", name: "Mistura rápida",       desc: "Ganha uma partida em Mistura Relâmpago",           coins: 300, n: 1,    v: (c) => M(c, "relampago") },
  { cat: "modo", id: "modoLatas",    icon: "🥫", name: "Gatuno",                desc: "Ganha uma partida em Rouba-Latas",                 coins: 300, n: 1,    v: (c) => M(c, "latas") },
  { cat: "modo", id: "modoZonas",    icon: "🖌️", name: "Dono do bairro",        desc: "Ganha uma partida em Pinta e Conquista",           coins: 300, n: 1,    v: (c) => M(c, "zonas") },
  { cat: "modo", id: "modos",        icon: "🎨", name: "Faz-tudo",              desc: "Ganha uma partida em cada modo de jogo",           gems: 3,    n: MODE_IDS.length, v: (c) => MODE_IDS.filter((id) => M(c, id) || c.modes[id]).length },
  { cat: "modo", id: "secreto10",    icon: "🔎", name: "Sherlock",              desc: "Ganha 10 partidas em Cores Secretas",              gems: 3, title: "Sherlock",    n: 10,   v: (c) => M(c, "secreto") },
  { cat: "modo", id: "relampago10",  icon: "🌩️", name: "Cabeça rápida",         desc: "Ganha 10 partidas em Mistura Relâmpago",           gems: 3, title: "Cabeça rápida",    n: 10,   v: (c) => M(c, "relampago") },
  { cat: "modo", id: "latas10",      icon: "🥫", name: "Ladrão de latas",       desc: "Entrega 10 latas no Rouba-Latas",                  coins: 400, n: 10,   v: (c) => c.cans },
  { cat: "modo", id: "latas50",      icon: "🏴‍☠️", name: "Pirata das latas",     desc: "Entrega 50 latas no Rouba-Latas",                  gems: 4, title: "Pirata das latas",    n: 50,   v: (c) => c.cans },
  // climas (rounds ganhos com esse clima; os difíceis valem mais)
  { cat: "clima", id: "sol10",       icon: "☀️", name: "Dia de praia",          desc: "Ganha 10 rounds com sol",                          coins: 100, n: 10,   v: (c) => X(c, "sol") },
  { cat: "clima", id: "chuva10",     icon: "🌧️", name: "Guarda-chuva",          desc: "Ganha 10 rounds à chuva",                          coins: 200, n: 10,   v: (c) => X(c, "chuva") },
  { cat: "clima", id: "trovoada1",   icon: "⛈️", name: "Caçador de trovões",    desc: "Ganha um round com trovoada",                      coins: 200, n: 1,    v: (c) => X(c, "trovoada") },
  { cat: "clima", id: "nevoeiro1",   icon: "🌫️", name: "Às cegas",              desc: "Ganha um round com nevoeiro",                      coins: 200, n: 1,    v: (c) => X(c, "nevoeiro") },
  { cat: "clima", id: "trovoada10",  icon: "🌩️", name: "Senhor da tempestade",  desc: "Ganha 10 rounds com trovoada",                     gems: 2, title: "Senhor da tempestade",    n: 10,   v: (c) => X(c, "trovoada") },
  { cat: "clima", id: "nevoeiro10",  icon: "👻", name: "Fantasma do nevoeiro",  desc: "Ganha 10 rounds com nevoeiro",                     gems: 2, title: "Fantasma do nevoeiro",    n: 10,   v: (c) => X(c, "nevoeiro") },
  { cat: "clima", id: "difNevoeiro", icon: "🌁", name: "Nevoeiro cerrado",      desc: "Ganha um round no Difícil com nevoeiro",           coins: 500, n: 1,    v: (c) => XD(c, "dificil", "nevoeiro") },
  { cat: "clima", id: "impTrovoada", icon: "⚡", name: "Raio impossível",       desc: "Ganha um round no Impossível com trovoada",        gems: 4,    n: 1,    v: (c) => XD(c, "impossivel", "trovoada") },
  { cat: "clima", id: "impNevoeiro", icon: "🕶️", name: "Visão de raio-x",       desc: "Ganha um round no Impossível com nevoeiro",        gems: 5,    n: 1,    v: (c) => XD(c, "impossivel", "nevoeiro") },
  { cat: "clima", id: "impTodos",    icon: "🌍", name: "Faça chuva ou faça sol", desc: "Ganha um round no Impossível com cada clima",     gems: 8, title: "Faça chuva ou faça sol",    n: WEATHER_IDS.length, v: (c) => WEATHER_IDS.filter((w) => XD(c, "impossivel", w)).length },
  // mapas e baús
  { cat: "mapa", id: "mapas",        icon: "🗺️", name: "Turista",               desc: "Ganha um round em cada mapa",                      gems: 3, title: "Turista",    n: MAP_IDS.length, v: (c) => MAP_IDS.filter((id) => c.maps[id]).length },
  { cat: "mapa", id: "baus50",       icon: "🧰", name: "Caça-tesouros",         desc: "Abre 50 baús",                                     coins: 300, n: 50,   v: (c) => c.chests },
  { cat: "mapa", id: "baus250",      icon: "🗝️", name: "Arrombador",            desc: "Abre 250 baús",                                    gems: 2,    n: 250,  v: (c) => c.chests },
  { cat: "mapa", id: "dourado",      icon: "🌟", name: "Ouro!",                 desc: "Abre um baú dourado",                              coins: 200, n: 1,    v: (c) => c.golden },
  { cat: "mapa", id: "dourado10",    icon: "💰", name: "Mãos de ouro",          desc: "Abre 10 baús dourados",                            gems: 3, title: "Mãos de ouro",    n: 10,   v: (c) => c.golden },
  // amigos
  { cat: "amigos", id: "amigos1",    icon: "👥", name: "Em equipa",             desc: "Joga uma partida com amigos",                      coins: 100, n: 1,    v: (c) => c.onlineGames },
  { cat: "amigos", id: "amigosJogos25", icon: "🎉", name: "Noite de jogos",     desc: "Joga 25 partidas com amigos",                      coins: 500, n: 25,   v: (c) => c.onlineGames },
  { cat: "amigos", id: "amigos10",   icon: "🤝", name: "A melhor equipa",       desc: "Ganha 10 partidas com amigos",                     gems: 2,    n: 10,   v: (c) => c.onlineWins },
  { cat: "amigos", id: "amigos50",   icon: "🫂", name: "Inseparáveis",          desc: "Ganha 50 partidas com amigos",                     gems: 5, title: "Inseparável",    n: 50,   v: (c) => c.onlineWins },
  // níveis
  { cat: "nivel", id: "nivel5",      icon: "⭐", name: "Nível 5",               desc: "Chega ao nível 5",                                 coins: 200, n: 5,    v: L },
  { cat: "nivel", id: "nivel10",     icon: "⭐", name: "Nível 10",              desc: "Chega ao nível 10",                                gems: 2,    n: 10,   v: L },
  { cat: "nivel", id: "nivel20",     icon: "🌠", name: "Nível 20",              desc: "Chega ao nível 20",                                gems: 4, title: "Experiente",    n: 20,   v: L },
  { cat: "nivel", id: "nivel30",     icon: "🌠", name: "Nível 30",              desc: "Chega ao nível 30",                                gems: 5,    n: 30,   v: L },
  { cat: "nivel", id: "nivel50",     icon: "🌟", name: "Nível 50",              desc: "Chega ao nível 50",                                gems: 8, title: "Veterano",    n: 50,   v: L },
  { cat: "nivel", id: "nivel75",     icon: "💫", name: "Nível 75",              desc: "Chega ao nível 75",                                gems: 10,   n: 75,   v: L },
  { cat: "nivel", id: "nivel100",    icon: "👑", name: "Nível 100",             desc: "Chega ao nível 100",                               gems: 15, title: "Lenda viva",   n: 100,  v: L },
];

const EMPTY = () => ({ games: 0, wins: 0, kills: 0, killsSame: 0, bestKills: 0, blastKills: 0, flawless: 0, flawlessImp: 0, cleanWins: 0, streak: 0, bestStreak: 0,
  winsHard: 0, winsImpossible: 0, diffWins: {}, modeWins: {}, wxRounds: {}, wxDiff: {}, maps: {}, modes: {}, cans: 0, chests: 0, golden: 0, onlineGames: 0, onlineWins: 0 });
let data = { c: EMPTY(), done: {}, title: "" };                                    // title: id da conquista do título escolhido ("" = Novato)
let saved = null;
try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { /* começa vazio */ }
if (saved) data = { c: { ...EMPTY(), ...saved.c }, done: saved.done || {}, title: saved.title || "" };
else {                                                                               // 1.ª vez: o que já tinhas feito (Classificações) também conta
  const p = Stats.profile();
  Object.assign(data.c, { games: p.games, wins: p.wins, kills: p.kills, killsSame: p.killsSame, bestKills: p.bestKills, streak: p.winStreak, bestStreak: p.bestWinStreak });
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignora */ } };

// Durante a partida: kill(corCerta, via) · can() (entregaste uma lata) · chest() · golden() · roundWon({ map, weather, diff })
export function track(what, a, b) {
  const c = data.c;
  if (what === "kill") { c.kills++; if (a) c.killsSame++; if (b === "grenade" || b === "trap" || b === "cannon") c.blastKills++; }
  else if (what === "can") c.cans++;
  else if (what === "chest") c.chests++;
  else if (what === "golden") c.golden++;
  else if (what === "roundWon" && a) {
    if (a.map) c.maps[a.map] = true;
    if (a.weather) { c.wxRounds[a.weather] = (c.wxRounds[a.weather] || 0) + 1; const k = a.diff + ":" + a.weather; c.wxDiff[k] = (c.wxDiff[k] || 0) + 1; }
  }
  save();
}

// Fim da partida: m = { won, deaths, kills, roundsLost, diff, mode, online }. Devolve as conquistas novas (o prémio já foi dado)
export function endMatch(m) {
  const c = data.c;
  c.games++;
  c.bestKills = Math.max(c.bestKills, m.kills || 0);
  if (m.online) c.onlineGames++;
  if (m.won) {
    c.wins++; c.streak++; c.bestStreak = Math.max(c.bestStreak, c.streak);
    if (!m.deaths) c.flawless++;
    if (!m.deaths && m.diff === "impossivel") c.flawlessImp++;
    if (!m.roundsLost) c.cleanWins++;
    if (m.diff === "dificil" || m.diff === "impossivel") c.winsHard++;
    if (m.diff === "impossivel") c.winsImpossible++;
    if (m.diff) c.diffWins[m.diff] = (c.diffWins[m.diff] || 0) + 1;
    if (m.mode) { c.modes[m.mode] = true; c.modeWins[m.mode] = (c.modeWins[m.mode] || 0) + 1; }
    if (m.online) c.onlineWins++;
  } else c.streak = 0;
  save();
  return check();
}
// Verifica tudo (também depois de subir de nível); as que ficaram feitas agora dão o prémio
export function check() {
  const got = [];
  for (const a of ACHIEVEMENTS) {
    if (data.done[a.id] || a.v(data.c) < a.n) continue;
    data.done[a.id] = Date.now();
    if (a.gems) Progress.addGems(a.gems); else Progress.addCoins(a.coins);
    got.push(a);
  }
  if (got.length) save();
  return got;
}

// ---------- TÍTULOS 🏷️: algumas conquistas dão um título, que se escolhe no Perfil (aparece por baixo do nome; os amigos também o veem) ----------
export const titles = () => [{ id: "", name: "Novato", have: true, from: "Começa contigo" },
  ...ACHIEVEMENTS.filter((a) => a.title).map((a) => ({ id: a.id, name: a.title, have: !!data.done[a.id], from: a.name }))];
export const titleName = () => { const a = ACHIEVEMENTS.find((x) => x.id === data.title && data.done[x.id]); return a ? a.title : "Novato"; };
export function setTitle(id) { if (id === "" || data.done[id]) { data.title = id; save(); } }

// Para o ecrã das conquistas: cada uma com o progresso (0..n) e se está feita
export const prize = (a) => (a.gems ? `💎 ${a.gems}` : `🪙 ${a.coins}`);               // o prémio, para mostrar
export const list = () => ACHIEVEMENTS.map((a) => ({ ...a, have: Math.min(a.n, a.v(data.c)), done: !!data.done[a.id] }));
