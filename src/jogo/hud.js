import { CONFIG, TEAM } from "../base/game-config.js";
import { COLORS, PRIMARIES, SECONDARIES, symbolSVG, chipHTML, mixColors, COLOR_RULES, TERTIARY } from "../base/colors.js";
import { setDummyAmmo } from "./test-dummy.js";
import { charById } from "../personagens/characters.js";
import { portraitUrl } from "../personagens/portraits.js";
import { Sfx } from "../som/sfx.js";
import { state, $, hex6, lighten, personName, hexOf } from "./game-state.js";

/* ============================================================
   HUD: o que se vê por cima do jogo enquanto se joga (só mostra; quem decide é o map-viewer.js)
   - avisos (showToast), lista de eliminações à direita (reportKill/reportFall) e as bolinhas de cada equipa em cima
   - placar e relógio (updateScoreUi, updateTimerStyle), contagem do início ("3, 2, 1, PINTA!")
   - munição e itens em baixo, mira (cor da mão, a misturar...), a mão com a arma
   - quadro das misturas (Mistura Relâmpago), quadro das zonas (Pinta e Conquista) e a dica das misturas
   ============================================================ */

export const FEED_MS = 3500;                                  // tempo que cada mensagem fica visível
// Mensagens do jogo: aparecem em fila no canto superior esquerdo (por baixo da lista de itens) e desaparecem sozinhas
export function showToast(text, color = "#fff") {
  const feed = $("feed");
  const row = document.createElement("div");
  row.className = "feedRow";
  row.style.borderColor = color;
  row.textContent = text;
  feed.appendChild(row);
  while (feed.children.length > 4) feed.firstChild.remove();
  setTimeout(() => row.classList.add("out"), FEED_MS);
  setTimeout(() => row.remove(), FEED_MS + 500);
}
export function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
// Itens apanhados (canto superior esquerdo, sem moldura): um ícone por item e a quantidade à frente.
// Munição conta tiros (cada caixa = 15; 40 no Pinta e Conquista) e há uma linha por cor; os restantes itens contam unidades.
export function lootIcon(key) {
  if (key.startsWith("ammo:")) {
    const c = COLORS[key.slice(5)];
    return `<span class="ammoIcon" style="--c:#${c.hex.toString(16).padStart(6, "0")}">${symbolSVG(c.symbol, 15)}</span>`;
  }
  return `<span class="emoji">${CONFIG.rewards.find((r) => r.id === key).icon}</span>`;
}
export const ITEM_KEYS = { health: "T", invisible: "F", grenade: "G", trap: "C" };
export function buildLootPanel() {
  const panel = $("lootRows");
  panel.innerHTML = "";
  for (const k in ammoShown) delete ammoShown[k];                                       // linhas novas: volta a escrever as munições
  state.loot = {};
  const keys = [...PRIMARIES.map((c) => "ammo:" + c), ...CONFIG.rewards.filter((r) => r.id !== "ammo" && (!r.modes || r.modes.includes(state.mode))).map((r) => r.id)];   // (a armadilha só nos modos em que existe)
  for (const key of keys) {
    state.loot[key] = 0;
    const row = document.createElement("div");
    row.className = "lootRow"; row.id = "loot-" + key.replace(":", "-");
    const hint = ITEM_KEYS[key] || (key.startsWith("ammo:") ? COLORS[key.slice(5)].key : "");
    row.innerHTML = `<kbd class="kh">${hint}</kbd><div class="lootMain">${lootIcon(key)}<span class="qty">0</span></div>`;
    panel.appendChild(row);
  }
}
export const ammoShown = {};                                                                // última quantidade mostrada de cada cor: o HTML só muda quando o número muda
export function updateAmmoUi() {
  for (const id of PRIMARIES) {
    const n = Math.floor(state.ammo[id]);
    if (ammoShown[id] === n) continue;
    const row = $("loot-ammo-" + id);
    if (!row) continue;
    ammoShown[id] = n;
    row.querySelector(".qty").textContent = n;
    row.classList.toggle("empty", n < 1);
  }
}
// Uma bolinha por jogador (5 por equipa), sem moldura. Eliminado = a mesma cor, mas muito clara.
// `colors` pode ter uma cor por jogador (a cor do personagem); por defeito é a cor da equipa.
export function buildTeamPips() {
  state.pips = { A: [], B: [] };
  for (const [team, id] of [["A", "teamA"], ["B", "teamB"]]) {
    const box = $(id);
    box.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      const el = document.createElement("span");
      el.className = "pip";
      el.appendChild(document.createElement("img"));
      el.style.setProperty("--c", hex6(TEAM[team].color));
      el.style.setProperty("--cl", lighten(TEAM[team].color, 0.82));
      box.appendChild(el);
      state.pips[team].push(el);
    }
  }
}
// Mostra o nome e a skin ao passar o rato por cima de cada bolinha
export function labelPips() {
  if (!state.rosters) return;
  for (const t of ["A", "B"]) {
    state.pips[t].forEach((el, i) => {
      el.title = personName(t, i) + " · " + charById(state.rosters[t][i]).name;
    });
  }
}
// Cada bolinha mostra a cara do personagem em campo (Pinta, Gota, ...) com a cor da equipa
export function refreshPips() {
  if (!state.rosters) return;
  for (const t of ["A", "B"]) {
    state.pips[t].forEach((el, i) => {
      const img = el.firstChild, url = portraitUrl(state.rosters[t][i], TEAM[t].color);
      if (url) { img.src = url; img.style.display = "block"; } else img.style.display = "none";
    });
  }
}
// ---------- lista de eliminações (lado direito) ----------
// killer / victim = { team: "A"|"B", index: 0..4 }; byColor = true se foi eliminado com a cor certa.
// É esta a função que o sistema de tiro vai chamar quando alguém for eliminado.
export const KILL_MS = Number(new URLSearchParams(location.search).get("killms")) || 5500;   // ?killms=60000 deixa as linhas mais tempo (testes)
// Queda de muito alto (sem ninguém a eliminar)
export function reportFall(victim, via) {
  setPlayerOut(victim.team, victim.index, true);
  const url = portraitUrl(state.rosters[victim.team][victim.index], TEAM[victim.team].color), col = hex6(TEAM[victim.team].color);
  const row = document.createElement("div");
  row.className = "killRow bad";
  row.innerHTML = `
    <div class="kfIcons"><span class="kfColor" style="font-size:26px">💥</span><span class="kfFace victim" style="--c:${col}">${url ? `<img src="${url}" alt="">` : ""}</span></div>
    <div class="kfText"><b>${victim.isPlayer ? "Tu" : personName(victim.team, victim.index)}</b> ${via === "water" ? "caiu ao rio" : "caiu de muito alto"}<small>${via === "water" ? "🌊 Cair à água elimina" : `⬇️ Queda de ${CONFIG.fallDeath} m ou mais`}</small></div>`;
  const feed = $("killfeed");
  feed.appendChild(row);
  while (feed.children.length > 5) feed.firstChild.remove();
  setTimeout(() => row.classList.add("out"), KILL_MS);
  setTimeout(() => row.remove(), KILL_MS + 500);
}
export function reportKill(killer, victim, colorId, byColor) {
  setPlayerOut(victim.team, victim.index, true);
  const info = (who) => {
    return { name: personName(who.team, who.index), url: portraitUrl(state.rosters[who.team][who.index], TEAM[who.team].color), color: hex6(TEAM[who.team].color) };
  };
  const k = info(killer), v = info(victim);
  const face = (i, extra = "") => `<span class="kfFace ${extra}" style="--c:${i.color}">${i.url ? `<img src="${i.url}" alt="">` : ""}</span>`;
  const row = document.createElement("div");
  row.className = "killRow " + (byColor ? "ok" : "bad");
  row.innerHTML = `
    <div class="kfIcons">${face(k)}<span class="kfColor">${chipHTML(colorId, 30)}</span>${face(v, "victim")}</div>
    <div class="kfText"><b>${k.name}</b> ${k.name === "Tu" ? "eliminaste" : "eliminou"} <b>${v.name === "Tu" ? "a ti" : v.name}</b>
      <small>${byColor ? "🎯 Cor certa! Eliminação direta" : "💥 Sem a cor certa: caiu aos tiros"}</small></div>`;
  const feed = $("killfeed");
  feed.appendChild(row);
  while (feed.children.length > 5) feed.firstChild.remove();
  setTimeout(() => row.classList.add("out"), KILL_MS);
  setTimeout(() => row.remove(), KILL_MS + 500);
}
export function setPlayerOut(team, index, out) { state.pips[team][index].classList.toggle("out", out); }
export function resetPips() { for (const t of ["A", "B"]) state.pips[t].forEach((el) => el.classList.remove("out")); }
// O relógio muda de cor no último minuto (amarelo) e nos últimos 30 s (vermelho), e pulsa nos últimos 10 s
// Mira ao centro: bolinha com o símbolo da cor atual e um anel que enche durante a mistura
export const XR_LEN = 2 * Math.PI * 44;
// "Na mão": mostra a cor da munição da arma (e a mistura a decorrer) e realça as linhas dos tanques dessa cor
export const HAND_LEN = 2 * Math.PI * 28;
export function updateHand(cs) {
  const aimG = state.aimingGrenade, cur = aimG ? state.grenadeColor : cs.current;      // a apontar a granada, a mão mostra a cor da granada
  const cur2 = aimG ? state.grenadeColor2 : null, sig = (aimG ? "g" : "") + cur + (cur2 || "") + state.grenadeSlot;
  if (sig !== state.shownColor) {
    state.shownColor = sig;
    const c = COLORS[cur];
    $("handChip").innerHTML = chipHTML(cur, cur2 ? 32 : 40) + (cur2 ? chipHTML(cur2, 32) : "");
    $("handName").classList.toggle("dual", !!cur2 && cur2 !== cur);
    $("handName").textContent = aimG ? `${cur2 && cur2 !== cur ? "" : "💣 "}${c.name}${cur2 && cur2 !== cur ? " + " + COLORS[cur2].name : ""}` : c.name;
    $("handHint").textContent = aimG ? (cur2 ? `roda: cor ${state.grenadeSlot + 1} · X: trocar` : "roda do rato: mudar a cor") : c.kind === "primaria" ? `tecla ${c.key}` : c.parts.map((p) => COLORS[p].name).join(" + ");
    for (const id of PRIMARIES) {
      const row = $("loot-ammo-" + id);
      if (row) row.classList.toggle("active", !aimG && (id === cur || !!(c.parts && c.parts.includes(id))));
    }
  }
  const prog = $("handProg");
  if (cs.mixing) {
    prog.style.stroke = "#" + COLORS[cs.mix.result].hex.toString(16).padStart(6, "0");
    prog.style.strokeDashoffset = String(HAND_LEN * (1 - cs.progress));
    prog.style.opacity = "1";
  } else prog.style.opacity = "0";
}
export function updateCrosshair(dummy) {                                          // dummy = o teu boneco (a arma mostra a cor da munição)
  const cs = state.colors;
  updateHand(cs);
  if (cs.current !== state.shownCrossColor) {
    state.shownCrossColor = cs.current;
    $("xChip").innerHTML = chipHTML(cs.current, 34);
  }
  setDummyAmmo(dummy, cs.current, cs.mixing ? cs.mix.result : null, cs.progress);   // arma: cor da munição (não muda a cor do boneco)
  const xh = $("crosshair"), mode = state.over || state.paused || state.upgradeChoices || state.intermission > 0 || state.healingT > 0 ? "none" : state.aimingGrenade || state.cannon ? "gren" : "col";   // cura na mão: sem mira; granada e canhão: mira de lançar
  if (xh.dataset.mode !== mode) xh.dataset.mode = mode;
  xh.style.setProperty("--xc", hex6(hexOf(state.aimingGrenade ? state.grenadeColor : cs.current)));
  if (!CONFIG.ui.crosshair) return;
  const prog = $("xProg");
  if (cs.mixing) {
    prog.style.stroke = "#" + COLORS[cs.mix.result].hex.toString(16).padStart(6, "0");
    prog.style.strokeDashoffset = String(XR_LEN * (1 - cs.progress));
    prog.style.opacity = "1";
  } else prog.style.opacity = "0";
}
export function updateTimerStyle() {
  const left = state.roundTime, badge = $("timerBadge");
  badge.classList.toggle("warn", left <= 60 && left > 30);
  badge.classList.toggle("danger", left <= 30);
  badge.classList.toggle("pulse", left <= 10);
}
export function updateScoreUi() {
  const r = state.round;
  $("scoreA").textContent = r.wins.A; $("scoreB").textContent = r.wins.B;
  $("killsA").textContent = r.kills.A; $("killsB").textContent = r.kills.B;
  const hot = isIntense();
  $("killsLabel").textContent = (r.sudden ? "MORTE SÚBITA" : `Round ${r.n}`) + (hot ? ` 🔥 ${Math.max(1, Math.ceil(state.intenseT))}s` : "");
  $("killsBar").classList.toggle("intense", hot);
  $("killsBar").classList.toggle("sudden", r.sudden);
}
// Modo intenso: quando uma equipa já tem 4 rounds, as cores de toda a gente mudam de 5 em 5 segundos (dá hipóteses de virar o jogo)
export const isIntense = () => !!state.round && !state.over && Math.max(state.round.wins.A, state.round.wins.B) >= CONFIG.match.intenseAt;
// ---------- Mistura Relâmpago: de 30 em 30 s as receitas das secundárias rodam (ver shuffleMixes em colors.js) ----------
export function renderMixTable() {
  const box = $("mixTable");
  if (!box) return;
  const on = state.mode === "relampago" && !state.tutorialMode;
  box.style.display = on ? "flex" : "none";
  if (!on) return;
  box.innerHTML = `<b>⚡ Misturas <span id="mixTimer"></span></b>` + SECONDARIES.map((id) => `<div class="mtRow">${chipHTML(COLORS[id].parts[0], 22)}<i>+</i>${chipHTML(COLORS[id].parts[1], 22)}<i>=</i>${chipHTML(id, 26)}</div>`).join("");
  state.mixTimerTxt = "";
}
// ---------- Pinta e Conquista: quadro com a % de tinta de cada equipa em cada zona (sempre "nós / eles", do ponto de vista de quem joga) ----------
export function updateZoneTable(dt) {
  const box = $("zoneTable"), terr = state.features?.terr;
  if (!terr) { if (box.style.display !== "none") box.style.display = "none"; return; }
  if ((state.zoneUiT = (state.zoneUiT || 0) - dt) > 0) return;
  state.zoneUiT = 0.25;
  const mine = state.me?.team || "A", theirs = mine === "A" ? "B" : "A", info = terr.info(), col = (t) => hex6(TEAM[t].color);
  const html = `<b>🖌️ Zonas · ponto em ${Math.ceil(info.next)} s</b>` + info.zones.map((z) =>
    `<div class="ztRow"><span class="ztDot" style="${z.owner ? `background:${col(z.owner)}` : ""}"></span><span class="ztName">${z.label}</span><span class="ztPct"><span style="color:${col(mine)}">${z.pct[mine]}%</span> / <span style="color:${col(theirs)}">${z.pct[theirs]}%</span></span>` +
    `<span class="ztBar" title="${z.pct[mine] + z.pct[theirs]}% pintado"><i style="width:${z.pct[mine]}%;background:${col(mine)}"></i><i style="width:${z.pct[theirs]}%;background:${col(theirs)}"></i></span></div>`).join("");   // barra: nós | eles | por pintar (cinzento)
  if (html !== state.zoneHtml) { state.zoneHtml = html; box.innerHTML = html; }
  box.style.display = "flex";
  box.classList.toggle("soon", info.next <= 3);
}
// Contagem no início do round: 3, 2, 1 (cada número com a cor de uma primária) e depois "PINTA!" com as 6 cores
export const CD_COLORS = ["#ffd21f", "#2f7bff", "#ff3b4a"], RAINBOW = ["#ff3b4a", "#ffd21f", "#47e06a", "#2f7bff", "#a447ff", "#ff8a1f"];
export function showCountdown(text, color) {
  const el = $("countdown");
  if (el.dataset.t === text) return;
  el.dataset.t = text;
  el.innerHTML = text ? (color ? `<b style="--c:${color}">${text}</b>` : [...text].map((ch, i) => `<b style="--c:${RAINBOW[i % 6]};--d:${i * 0.05}s">${ch}</b>`).join("")) : "";
  el.classList.remove("pop"); void el.offsetWidth; if (text) el.classList.add("pop");
  if (text === "PINTA!") Sfx.play("go"); else if (/^\d$/.test(text)) Sfx.play("beep");
}
// Últimos 5 segundos do round: o número em grande no meio do ecrã (some na morte súbita, nas pausas e no fim do round)
export function updateLastSeconds() {
  const st = state, r = st.round, s = Math.ceil(st.roundTime);
  const on = !!r && !st.tutorial && !r.sudden && st.countdown <= 0 && !st.over && !(st.intermission > 0) && st.screen === "viewer" && s >= 1 && s <= 5;
  const text = on ? String(s) : "", el = $("lastSecs");
  if (el.dataset.t === text) return;
  el.dataset.t = text;
  el.textContent = text;
  el.classList.remove("pop"); void el.offsetWidth; if (text) el.classList.add("pop");
}
export function tickCountdown(dt) {
  if (state.countdown > 0) {
    state.countdown -= dt;
    if (state.countdown <= 0) { state.countdown = 0; state.goT = 0.9; showCountdown("PINTA!"); return; }
    const n = Math.ceil(state.countdown);
    showCountdown(String(n), CD_COLORS[(n - 1) % 3]);
  } else if (state.goT > 0) { state.goT -= dt; if (state.goT <= 0) showCountdown(""); }
  else if ($("countdown").dataset.t) showCountdown("");
}
// Ao segurar duas teclas de cor aparece por baixo da mira o diagrama da mistura (ex.: vermelho + azul = roxo)
export function updateMixHint(dt) {
  const cs = state.colors, el = $("mixHint");
  const n = cs.held.length, r = n === 2 ? mixColors(cs.held[0], cs.held[1]) : n === 3 && COLOR_RULES.triple ? TERTIARY : null;
  if (r) {
    state.mixHintT = 1.2;
    const key = cs.held.join("");
    if (key !== state.mixHintKey) {
      state.mixHintKey = key;
      el.innerHTML = `${cs.held.map((h) => chipHTML(h, 26)).join("<i>+</i>")}<i>=</i>${chipHTML(r, 32)}<span>${COLORS[r].name}</span>`;
    }
  } else if (state.mixHintT > 0) state.mixHintT -= dt;
  const show = state.mixHintT > 0 && !state.paused;
  if (el.classList.contains("show") !== show) { el.classList.toggle("show", show); if (!show) state.mixHintKey = ""; }
}
