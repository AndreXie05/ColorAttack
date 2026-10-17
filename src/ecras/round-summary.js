import { TEAM, ARENA, BOT_PRESETS } from "../base/game-config.js";
import { chipHTML } from "../base/colors.js";
import { portraitUrl } from "../personagens/portraits.js";
import { UPGRADES } from "../jogo/upgrades.js";
import * as Stats from "../progresso/stats.js";
import * as Progress from "../progresso/progress.js";
import * as Ach from "../progresso/achievements.js";
import * as Missions from "../progresso/missions.js";
import { MM } from "../visual/minimap.js";
import { state, $, hex6, nameOf } from "../jogo/game-state.js";

/* ============================================================
   RESUMOS DO FIM DO ROUND E DO FIM DO JOGO (só texto e imagens: o HTML das caixas)
   - roundStatsHTML: as duas equipas com o MVP; heatmapURL/heatHTML: mapa de calor das eliminações do round.
   - addRoundToGameStats + awardsHTML: soma cada round de cada jogador e dá os destaques do jogo (Mestre das cores, ...).
   - summaryHTML: o resumo do jogo (rounds, itens, melhorias, XP, moedas, conquistas e missões feitas).
   O map-viewer.js decide quando os mostrar.
   ============================================================ */

// ---------- ESTATÍSTICAS DO ROUND (cada equipa, com o MVP) ----------
// MVP = mais eliminações; empate: menos mortes, depois melhor precisão
export const mvpScore = (c) => c.rs.kills * 1000 + c.rs.assists * 100 - c.rs.deaths * 10 + (c.rs.shots ? c.rs.hits / c.rs.shots : 0);
export function roundStatsHTML() {
  if (!state.world) return "";
  const team = (t) => {
    const list = state.world.combatants.filter((c) => c.team === t).sort((a, b) => mvpScore(b) - mvpScore(a));
    const mvp = list[0] && list[0].rs.kills > 0 ? list[0] : null;                  // sem eliminações não há MVP
    const rows = list.map((c) => {
      const r = c.rs, fav = Object.entries(r.colors).sort((a, b) => b[1] - a[1])[0];
      return `<tr class="${c.isPlayer ? "me" : ""}${c === mvp ? " mvp" : ""}"><td>${c === mvp ? "⭐ " : ""}${c.isPlayer ? "Tu" : nameOf(c)}</td><td>${r.kills}</td><td>${r.assists}</td><td>${r.deaths}</td>
        <td>${r.shots ? Math.round((r.hits / r.shots) * 100) + "%" : "–"}</td><td>${fav ? chipHTML(fav[0], 20) : "–"}</td></tr>`;
    }).join("");
    return `<table class="rsTable" style="--c:${hex6(TEAM[t].color)}"><tr><th>${TEAM[t].name}</th><th>Elim.</th><th>Assist.</th><th>Mortes</th><th>Precisão</th><th>Cor</th></tr>${rows}</table>`;
  };
  return team("A") + team("B");
}
// ---------- MAPA DE CALOR: onde houve mais eliminações no round (por cima do minimapa), com ✔ onde eliminaste e ✖ onde foste eliminado ----------
export const HEAT_PAL = [[0, 0, 0, 0], [47, 123, 255, 150], [71, 224, 106, 190], [255, 210, 31, 220], [255, 59, 74, 240]];   // frio → quente
export function heatmapURL() {
  if (!MM.base || !state.heat) return "";
  const W = 322, H = 460, X = (z) => ((z + ARENA.halfZ) / (ARENA.halfZ * 2)) * W, Y = (x) => ((ARENA.halfX - x) / (ARENA.halfX * 2)) * H;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.drawImage(MM.base, 0, 0, W, H); g.fillStyle = "rgba(13,11,31,0.45)"; g.fillRect(0, 0, W, H);   // o mapa um pouco escurecido
  // calor: soma de manchas suaves numa camada à parte e depois cor por intensidade
  const hc = document.createElement("canvas"); hc.width = W; hc.height = H;
  const hg = hc.getContext("2d"); hg.globalCompositeOperation = "lighter";
  for (const e of state.heat) {
    const x = X(e.z), y = Y(e.x), grd = hg.createRadialGradient(x, y, 0, x, y, 30);
    grd.addColorStop(0, "rgba(255,255,255,0.58)"); grd.addColorStop(1, "rgba(255,255,255,0)");   // 1 eliminação = verde; várias juntas = amarelo/vermelho
    hg.fillStyle = grd; hg.fillRect(x - 30, y - 30, 60, 60);
  }
  const img = hg.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.min(1, d[i + 3] / 255) * (HEAT_PAL.length - 1), a = Math.floor(v), b = Math.min(HEAT_PAL.length - 1, a + 1), f = v - a;
    for (let k = 0; k < 4; k++) d[i + k] = HEAT_PAL[a][k] + (HEAT_PAL[b][k] - HEAT_PAL[a][k]) * f;
  }
  hg.putImageData(img, 0, 0); g.drawImage(hc, 0, 0);
  g.font = "bold 18px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 4; g.strokeStyle = "#1a1033";
  for (const e of state.heat) {                                                       // as tuas eliminações e onde foste eliminado
    if (!e.mine && !e.me) continue;
    const x = X(e.z), y = Y(e.x), t = e.me ? "✖" : "✔";
    g.strokeText(t, x, y); g.fillStyle = e.me ? "#ff3b4a" : "#47e06a"; g.fillText(t, x, y);
  }
  return c.toDataURL("image/png");
}
export function heatHTML(url, small = false) {
  if (!url) return "";
  return `<div class="heatBox${small ? " small" : ""}"><b>🔥 Mapa de calor</b><img src="${url}" alt=""><small><span style="color:#47e06a">✔</span> eliminaste · <span style="color:#ff3b4a">✖</span> foste eliminado</small></div>`;
}
// ---------- DESTAQUES DO JOGO: soma o round de cada jogador e, no fim, dá prémios aos melhores ----------
export function addRoundToGameStats() {
  if (!state.world || state.tutorial) return;
  for (const c of state.world.combatants) {
    const g = state.gameStats[c.id] ||= { team: c.team, index: c.index, isPlayer: c.isPlayer, kills: 0, deaths: 0, assists: 0, killsSame: 0, grenadeKills: 0, grenades: 0, traps: 0, shots: 0, hits: 0, dist: 0, bestStreak: 0 };
    for (const k of ["kills", "deaths", "assists", "killsSame", "grenadeKills", "grenades", "traps", "shots", "hits", "dist"]) g[k] += c.rs[k];
    g.bestStreak = Math.max(g.bestStreak, c.rs.bestStreak);
  }
}
export const AWARDS = [
  { icon: "🎯", title: "Mestre das cores", desc: "mais eliminações com a cor certa", val: (g) => g.killsSame, fmt: (v) => `${v} com a cor certa` },
  { icon: "💣", title: "Rei das granadas", desc: "mais eliminações com granadas e armadilhas", val: (g) => g.grenadeKills * 100 + g.grenades + g.traps, fmt: (v, g) => `${g.grenadeKills} eliminações · ${g.grenades} granadas` },
  { icon: "🤝", title: "Bom colega", desc: "mais assistências", val: (g) => g.assists, fmt: (v) => `${v} ${v === 1 ? "assistência" : "assistências"}` },
  { icon: "🔥", title: "Imparável", desc: "maior série sem morrer", val: (g) => g.bestStreak, fmt: (v) => `série de ${v}` },
  { icon: "🏹", title: "Pontaria afinada", desc: "melhor precisão (mín. 20 tiros)", val: (g) => (g.shots >= 20 ? g.hits / g.shots : 0), fmt: (v) => `${Math.round(v * 100)}% de acertos` },
  { icon: "🏃", title: "Maratonista", desc: "mais distância percorrida", val: (g) => g.dist, fmt: (v) => `${Math.round(v)} m` },
  { icon: "🛡️", title: "Sobrevivente", desc: "menos mortes (com pelo menos 1 eliminação)", val: (g) => (g.kills > 0 ? 1000 - g.deaths : 0), fmt: (v, g) => `${g.deaths} ${g.deaths === 1 ? "morte" : "mortes"}` },
];
export function awardsHTML() {
  const all = Object.values(state.gameStats);
  if (!all.length) return "";
  const cards = AWARDS.map((a) => {
    const best = all.reduce((b, g) => (a.val(g) > a.val(b) ? g : b), all[0]), v = a.val(best);
    if (!(v > 0)) return "";
    const url = portraitUrl(state.rosters[best.team][best.index], TEAM[best.team].color);
    return `<div class="awCard${best.isPlayer ? " me" : ""}" style="--c:${hex6(TEAM[best.team].color)}" title="${a.desc}">
      <span class="awIcon">${a.icon}</span><b>${a.title}</b>
      <span class="awWho">${url ? `<img src="${url}" alt="">` : ""}${best.isPlayer ? "Tu" : nameOf(best)}</span><small>${a.fmt(v, best)}</small></div>`;
  }).join("");
  return cards ? `<h4>Destaques</h4><div class="awGrid">${cards}</div>` : "";
}
// ---------- RESUMO DO JOGO ----------
export function showSummary() {
  $("goStage1").style.display = "none"; $("goStage2").style.display = "flex";
}
export function summaryHTML(final) {
  const c = Stats.current, r = state.round, f1 = (v) => (Math.round(v * 10) / 10).toString().replace(".", ",");
  const card = (label, value, sub = "", cls = "") => `<div class="stCard ${cls}"><b>${value}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ""}</div>`;
  const rows = c.rows.map((x) => `<tr class="${x.won ? "won" : "lost"}"><td>Round ${x.n}</td><td>${x.won ? "🏆 Ganhaste" : "💔 Perdeste"}</td><td>${x.kills}</td><td>${x.assists ?? 0}</td><td>${x.deaths}</td></tr>`).join("");
  const ups = Object.entries(state.upg).map(([id, n]) => { const u = UPGRADES.find((x) => x.id === id); return `<span class="sumUp">${u.icon} ${u.name}${n > 1 ? " ×" + n : ""}</span>`; }).join("") || "<span class=\"sumUp none\">nenhuma</span>";
  const itemRow = (icon, name, got, used) => `<tr><td>${icon} ${name}</td><td>${got}</td><td>${used}</td></tr>`;
  const dmgPerKill = c.kills > 0 ? f1(c.damage / c.kills) : "–";
  return `
    <h4>Resultado</h4>
    <div class="stGrid">${card(final === "A" ? "Vitória" : "Derrota", `${r.wins.A} – ${r.wins.B}`, `${c.rounds} ${c.rounds === 1 ? "round" : "rounds"} · ${BOT_PRESETS[c.diff].name}`, final === "A" ? "good" : "bad")}</div>
    ${xpHTML(state.lastXP && state.xpDone ? state.lastXP : null)}
    ${awardsHTML()}
    <h4>Último round</h4>
    <div class="rsWrap">${roundStatsHTML()}${heatHTML(state.lastHeat || heatmapURL())}</div>
    <h4>Eliminações</h4>
    <div class="stGrid">
      ${card("Eliminações no jogo", c.kills)}
      ${card("Com a cor certa", c.killsSame, c.kills ? Math.round((c.killsSame / c.kills) * 100) + "%" : "", "good")}
      ${card("Sem a cor certa", c.killsOther, c.kills ? Math.round((c.killsOther / c.kills) * 100) + "%" : "")}
      ${card("Assistências no jogo", c.assists)}
      ${card("Mortes no jogo", c.deaths)}
      ${card("Eliminações/mortes", c.deaths > 0 ? f1(c.kills / c.deaths) : c.kills ? "∞" : "–")}
    </div>
    <h4>Por round</h4>
    <table class="sumTable"><tr><th>Round</th><th>Resultado</th><th>Eliminações</th><th>Assistências</th><th>Mortes</th></tr>${rows || "<tr><td colspan=5>–</td></tr>"}</table>
    <h4>Dano</h4>
    <div class="stGrid">${card("Dano total", Math.round(c.damage))}${card("Dano médio por eliminação", dmgPerKill)}${card("Tiros disparados", c.shots)}</div>
    <h4>Melhorias escolhidas</h4>
    <div class="sumUps">${ups}</div>
    <h4>Percurso e baús</h4>
    <div class="stGrid">${card("Distância percorrida", f1(c.distance) + " m")}${card("Baús abertos", c.chests)}</div>
    <h4>Itens</h4>
    <table class="sumTable"><tr><th>Item</th><th>Recolhidos</th><th>Usados</th></tr>
      ${itemRow("📦", "Munição (caixas / balas disparadas)", `${c.got.ammo} caixas · ${c.got.bullets} balas`, `${c.shots} balas`)}
      ${itemRow("💣", "Granadas", c.got.grenade, c.used.grenade)}
      ${itemRow("💊", "Curas", c.got.health, c.used.health)}
      ${itemRow("👻", "Invisibilidade", c.got.invisible, c.used.invisible)}
      ${itemRow("🪤", "Armadilhas", c.got.trap, c.used.trap)}
    </table>`;
}
export function xpBarHTML(info, cls = "") {
  return `<div class="xpBar ${cls}"><span class="xpLv">⭐ Nível ${info.level}</span><i><b style="width:${Math.round((info.into / info.need) * 100)}%"></b></i><small>${info.into} / ${info.need} XP</small></div>`;
}
export function xpHTML(x) {
  if (!x) return "";
  const up = x.after.level > x.before.level;
  return `<h4>Experiência</h4><div class="xpBox">
    <div class="xpRows">${x.rows.map(([t, v]) => `<div><span>${t}</span><b>+${v}</b></div>`).join("")}${x.mult !== 1 ? `<div><span>🤖 Dificuldade ${BOT_PRESETS[Stats.current.diff].name}</span><b>×${String(x.mult).replace(".", ",")}</b></div>` : ""}<div class="xpTot"><span>Total</span><b>+${x.total} XP</b></div></div>
    ${x.match ? `<div class="xpRows coinRows">${x.match.rows.map(([t, v]) => `<div><span>${t}</span><b>+${v}</b></div>`).join("")}<div class="xpTot"><span>Moedas</span><b>🪙 +${x.match.total}</b></div>${x.match.capped ? `<small class="coinCap">Chegaste ao máximo de ${Progress.COIN_RULES.dayMax} moedas de hoje: amanhã há mais!</small>` : ""}</div>` : ""}
    ${up ? `<div class="xpUp">🎉 Subiste para o nível ${x.after.level}! 💎 +${x.gems} joias · 🪙 +${x.coins} moedas</div>` : ""}
    ${x.ach?.length ? `<div class="achNew">${x.ach.map((a) => `<span>${a.icon} <b>${a.name}</b> · ${Ach.prize(a).replace(" ", " +")}${a.title ? ` · 🏷️ título "${a.title}"` : ""}</span>`).join("")}</div>` : ""}
    ${x.mis?.length ? `<div class="achNew mis">${x.mis.map((m) => `<span>📅 ${m.desc} · ${Missions.prize(m).replace(" ", " +")}</span>`).join("")}</div>` : ""}${xpBarHTML(x.after)}</div>`;
}
