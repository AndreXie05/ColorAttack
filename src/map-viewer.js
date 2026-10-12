import * as THREE from "three";
import { CONFIG, TEAM } from "./game-config.js";
import { MAPS } from "./map-definitions.js";
import { resolveCollisions } from "./collisions.js";
import { openChest, updateChests, resetChests } from "./chests-and-loot.js";
import { createDummy, setDummyAmmo, setDummyGhost, setDummyColor } from "./test-dummy.js";
import { ColorSelector } from "./color-selector.js";
import { loadCharacter, cloneCharacter, setCharacterPaint } from "./character-model.js";
import { Bot } from "./bots.js";
import { CombatWorld } from "./combat.js";
import { symbolMaterial } from "./symbol-sprites.js";
import { MOTION, createMotionState, stepMotion, collisionFeedback } from "./player-motion.js";
import { animateCharacter } from "./character-animator.js";
import { CHARACTERS, TITANS, buildRosters } from "./characters.js";
import { buildPortraits, portraitUrl } from "./portraits.js";
import { PickupManager } from "./pickups.js";
import { createInstructions } from "./instructions-screen.js";
import { WeatherSystem, WEATHERS, WEATHER_IDS } from "./weather.js";
import { PaintLayer } from "./paint-layer.js";
import { UPGRADES, offerUpgrades, fx } from "./upgrades.js";
import { COLORS, PRIMARIES, SECONDARIES, symbolSVG, chipHTML, ingredients } from "./colors.js";
// import { PointerLockControls } from "three/addons/controls/PointerLockControls.js"; // fase da câmara em 1.ª pessoa

/* ============================================================
   10. ESTADO DO VISUALIZADOR
   ============================================================ */
const state = {
  screen: "title", map: null, def: null,
  player: { pos: new THREE.Vector3(), motion: createMotionState(), facing: 0 },
  cam: { yaw: 0, pitch: 0.35, dist: 9, aerial: false, prev: null, focus: new THREE.Vector3(), curDist: 9, fov: 60, ready: false },
  quality: "media", fpsAcc: 0, fpsFrames: 0, fpsTime: 0, lowFpsTime: 0, grace: 0,
  roundTime: CONFIG.roundSeconds, opened: 0, empty: 0, lastUiTimer: "",
  invisible: 0, round: null, upg: {}, upgradeChoices: null, intermission: 0, over: false, bots: [], world: null, me: null, ammo: { vermelho: 0, azul: 0, amarelo: 0 }, playerColor: "vermelho", dead: false, deathInfo: null, firing: false, fireCd: 0, noAmmoMsg: 0, aimingGrenade: false, grenadeColor: "vermelho", grenadeColor2: null, grenadeSlot: 0, intenseT: 5, aimRing: null, gameTime: 0, targetT: 0, targetKey: "", hpShown: -1, hurtT: 0, starting: false, shownCrossColor: "", characterId: "robin", rosters: null, pickups: null, pips: { A: [], B: [] }, loot: {}, paused: false, weather: null, paint: null, colors: null, shownColor: "", weatherId: "sol", weatherChoice: "random",
};
const keys = new Set();

/* ============================================================
   11. RENDERIZAÇÃO
   ============================================================ */
const $ = (id) => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.id = "gameCanvas";
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);
let dummy = createDummy();                           // boneco simples; é trocado pelo do Blender quando o carregamento termina

const _modelCache = new Map();                        // id -> Promise do modelo (carregado uma só vez)
async function setCharacter(id) {
  const def = CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
  state.characterId = def.id;
  state.rosters = buildRosters(def.id);
  labelPips();
  refreshPips();
  if (!_modelCache.has(def.id)) _modelCache.set(def.id, loadCharacter(def.url));
  const model = await _modelCache.get(def.id);
  if (!model || state.characterId !== def.id || model === dummy) return;
  model.position.copy(dummy.position); model.rotation.copy(dummy.rotation);
  const parent = dummy.parent;
  if (parent) { parent.remove(dummy); parent.add(model); }
  dummy = model;
  setDummyGhost(dummy, state.invisible > 0);
  if (state.me) paintPlayer(state.playerColor);
}

// Qualidade gráfica: resolução, sombras e chuva. Q muda; se os FPS ficarem baixos, desce sozinha.
const QUALITY = {
  alta:  { label: "Alta",  pixelRatio: 2,   shadows: true,  shadowMap: 2048, rain: 1 },
  media: { label: "Média", pixelRatio: 1.5, shadows: true,  shadowMap: 1024, rain: 0.6 },
  baixa: { label: "Baixa", pixelRatio: 1,   shadows: false, shadowMap: 512,  rain: 0.3 },
};
const QUALITY_IDS = Object.keys(QUALITY);
function applyQuality(id) {
  const q = QUALITY[id];
  state.quality = id;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  const shadowsChanged = renderer.shadowMap.enabled !== q.shadows;
  renderer.shadowMap.enabled = q.shadows;
  if (state.map) {
    for (const l of state.map.lights) {
      if (!l.isDirectionalLight) continue;
      l.castShadow = q.shadows;
      if (l.shadow.mapSize.x !== q.shadowMap) { l.shadow.mapSize.set(q.shadowMap, q.shadowMap); l.shadow.map?.dispose(); l.shadow.map = null; }
    }
    if (shadowsChanged) scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    if (state.weather) state.weather.rainScale = q.rain;
  }
}
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

/* ============================================================
   12. MENUS E HUD
   ============================================================ */
function showScreen(name) {
  state.screen = name;
  $("titleScreen").style.display = name === "title" ? "flex" : "none";
  $("charSelect").style.display = name === "chars" ? "flex" : "none";
  $("mapSelect").style.display = name === "select" ? "flex" : "none";
  $("howTo").style.display = name === "howto" ? "flex" : "none";
  $("hud").style.display = name === "viewer" ? "block" : "none";
}

function buildMapCards() {
  const grid = $("mapGrid");
  const cards = [{ id: "random", name: "Aleatório", icon: "🎲", desc: "Surpresa! Um mapa à sorte", c1: "#ffd21f", c2: "#ff3b4a" }, ...MAPS];
  for (const m of cards) {
    const el = document.createElement("button");
    el.className = "mapCard";
    el.style.setProperty("--c1", m.c1); el.style.setProperty("--c2", m.c2);
    el.innerHTML = `<div class="icon">${m.icon}</div><div class="name">${m.name}</div><div class="desc">${m.desc}</div>`;
    el.addEventListener("click", () => {
      const def = m.id === "random" ? MAPS[Math.floor(Math.random() * MAPS.length)] : m;
      startMap(def);
    });
    grid.appendChild(el);
  }
}

const FEED_MS = 3500;                                  // tempo que cada mensagem fica visível
// Mensagens do jogo: aparecem em fila no canto superior esquerdo (por baixo da lista de itens) e desaparecem sozinhas
function showToast(text, color = "#fff") {
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

function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
// Itens apanhados (canto superior esquerdo, sem moldura): um ícone por item e a quantidade à frente.
// Munição conta tiros (cada caixa = 10) e há uma linha por cor; os restantes itens contam unidades.
function lootIcon(key) {
  if (key.startsWith("ammo:")) {
    const c = COLORS[key.slice(5)];
    return `<span class="ammoIcon" style="--c:#${c.hex.toString(16).padStart(6, "0")}">${symbolSVG(c.symbol, 15)}</span>`;
  }
  return `<span class="emoji">${CONFIG.rewards.find((r) => r.id === key).icon}</span>`;
}
function buildLootPanel() {
  const panel = $("lootRows");
  panel.innerHTML = "";
  state.loot = {};
  const keys = [...PRIMARIES.map((c) => "ammo:" + c), ...CONFIG.rewards.filter((r) => r.id !== "ammo").map((r) => r.id)];
  for (const key of keys) {
    state.loot[key] = 0;
    const row = document.createElement("div");
    row.className = "lootRow"; row.id = "loot-" + key.replace(":", "-");
    const hint = key === "health" ? "H" : key === "invisible" ? "F" : key === "grenade" ? "G" : key.startsWith("ammo:") ? COLORS[key.slice(5)].key : "";
    row.innerHTML = `<kbd class="kh">${hint}</kbd><div class="lootMain">${lootIcon(key)}<span class="qty">0</span></div>`;
    panel.appendChild(row);
  }
}
function addLoot(key, amount = 1) {
  state.loot[key] += amount;
  const row = $("loot-" + key.replace(":", "-"));
  row.querySelector(".qty").textContent = state.loot[key];
  row.classList.remove("flash"); void row.offsetWidth; row.classList.add("flash");
}
// Munição = tanques reais (um por cor primária). Cada caixa apanhada enche o tanque dessa cor.
// balas de uma caixa: normal = 7; na morte súbita é à sorte de 1 a 5
const boxShots = () => { if (!state.round?.sudden) return CONFIG.ammoBox.shots; const [lo, hi] = CONFIG.suddenDeath.shots; return lo + Math.floor(Math.random() * (hi - lo + 1)); };
function addAmmo(colorId, shots) {
  state.ammo[colorId] = Math.min(CONFIG.ammo.max, state.ammo[colorId] + shots);
  const row = $("loot-ammo-" + colorId);
  if (row) { row.classList.remove("flash"); void row.offsetWidth; row.classList.add("flash"); }
}
function updateAmmoUi() {
  for (const id of PRIMARIES) {
    const row = $("loot-ammo-" + id);
    if (!row) continue;
    const n = Math.floor(state.ammo[id]), q = row.querySelector(".qty");
    if (q.textContent !== String(n)) q.textContent = n;
    row.classList.toggle("empty", n < 1);
  }
}

// Uma bolinha por jogador (5 por equipa), sem moldura. Eliminado = a mesma cor, mas muito clara.
// `colors` pode ter uma cor por jogador (a cor do personagem); por defeito é a cor da equipa.
const hex6 = (c) => "#" + c.toString(16).padStart(6, "0");
const lighten = (c, t) => { const m = (v) => Math.round(v + (255 - v) * t); return hex6((m((c >> 16) & 255) << 16) | (m((c >> 8) & 255) << 8) | m(c & 255)); };
function buildTeamPips() {
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
// Mostra o nome do personagem ao passar o rato por cima de cada bolinha (o 1.º da equipa A é o jogador)
function labelPips() {
  if (!state.rosters) return;
  for (const t of ["A", "B"]) {
    state.pips[t].forEach((el, i) => {
      const c = CHARACTERS.find((x) => x.id === state.rosters[t][i]);
      el.title = (c ? c.name : "") + (t === "A" && i === 0 ? " (tu)" : "");
    });
  }
}
// Cada bolinha mostra a cara do personagem em campo (Robin, Raven, ...) com a cor da equipa
function refreshPips() {
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
const KILL_MS = Number(new URLSearchParams(location.search).get("killms")) || 5500;   // ?killms=60000 deixa as linhas mais tempo (testes)
function reportKill(killer, victim, colorId, byColor) {
  setPlayerOut(victim.team, victim.index, true);
  const info = (who) => {
    const c = CHARACTERS.find((x) => x.id === state.rosters[who.team][who.index]) || CHARACTERS[0];
    return { name: c.name, url: portraitUrl(c.id, TEAM[who.team].color), color: hex6(TEAM[who.team].color) };
  };
  const k = info(killer), v = info(victim);
  const face = (i, extra = "") => `<span class="kfFace ${extra}" style="--c:${i.color}">${i.url ? `<img src="${i.url}" alt="">` : ""}</span>`;
  const row = document.createElement("div");
  row.className = "killRow " + (byColor ? "ok" : "bad");
  row.innerHTML = `
    <div class="kfIcons">${face(k)}<span class="kfColor">${chipHTML(colorId, 30)}</span>${face(v, "victim")}</div>
    <div class="kfText"><b>${k.name}</b> eliminou <b>${v.name}</b>
      <small>${byColor ? "🎯 Cor certa! Eliminação direta" : "💥 Sem a cor certa: caiu aos tiros"}</small></div>`;
  const feed = $("killfeed");
  feed.appendChild(row);
  while (feed.children.length > 5) feed.firstChild.remove();
  setTimeout(() => row.classList.add("out"), KILL_MS);
  setTimeout(() => row.remove(), KILL_MS + 500);
}

function setPlayerOut(team, index, out) { state.pips[team][index].classList.toggle("out", out); }
function resetPips() { for (const t of ["A", "B"]) state.pips[t].forEach((el) => el.classList.remove("out")); }

// O relógio muda de cor no último minuto (amarelo) e nos últimos 30 s (vermelho), e pulsa nos últimos 10 s
// Mira ao centro: bolinha com o símbolo da cor atual e um anel que enche durante a mistura
const XR_LEN = 2 * Math.PI * 44;
// "Na mão": mostra a cor da munição da arma (e a mistura a decorrer) e realça as linhas dos tanques dessa cor
const HAND_LEN = 2 * Math.PI * 28;
function updateHand(cs) {
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

function updateCrosshair() {
  const cs = state.colors;
  updateHand(cs);
  if (cs.current !== state.shownCrossColor) {
    state.shownCrossColor = cs.current;
    $("xChip").innerHTML = chipHTML(cs.current, 34);
  }
  setDummyAmmo(dummy, cs.current, cs.mixing ? cs.mix.result : null, cs.progress);   // arma: cor da munição (não muda a cor do boneco)
  if (!CONFIG.ui.crosshair) return;                       // mira escondida por agora
  const prog = $("xProg");
  if (cs.mixing) {
    prog.style.stroke = "#" + COLORS[cs.mix.result].hex.toString(16).padStart(6, "0");
    prog.style.strokeDashoffset = String(XR_LEN * (1 - cs.progress));
    prog.style.opacity = "1";
  } else prog.style.opacity = "0";
}

// F: gasta uma Invisibilidade guardada e fica invisível durante `duration` segundos
function useInvisibility() {
  if (state.invisible > 0 || !state.loot.invisible) return;
  addLoot("invisible", -1);
  state.invisible = CONFIG.rewards.find((x) => x.id === "invisible").duration;
  showToast(`👻 Invisível durante ${state.invisible} s!`, "#9be7ff");
}

// Invisibilidade: durante a duração o boneco é um fantasma; fica um contador por baixo da lista de itens.
// `state.invisible` (> 0) é o que os bots vão consultar mais tarde para não verem o jogador.
function updateInvisibility(dt) {
  const fx = $("effects");
  if (state.invisible > 0) {
    state.invisible = Math.max(0, state.invisible - dt);
    setDummyGhost(dummy, state.invisible > 0);
    fx.textContent = state.invisible > 0 ? `👻 ${state.invisible.toFixed(1)} s` : "";
  } else if (fx.textContent) { fx.textContent = ""; setDummyGhost(dummy, false); }
}

function updateTimerStyle() {
  const left = state.roundTime, badge = $("timerBadge");
  badge.classList.toggle("warn", left <= 60 && left > 30);
  badge.classList.toggle("danger", left <= 30);
  badge.classList.toggle("pulse", left <= 10);
}

/* ============================================================
   13. CARREGAR / DESCARREGAR MAPAS
   ============================================================ */
function unloadMap() {
  const m = state.map;
  if (!m) return;
  if (state.pickups) { state.pickups.dispose(); state.pickups = null; }
  if (state.weather) { state.weather.dispose(); state.weather = null; }
  if (state.paint) { state.paint.dispose(); state.paint = null; }
  scene.remove(m.group);
  for (const l of m.lights) if (l.dispose) l.dispose();
  for (const d of m.disposables) d.dispose();
  scene.remove(dummy);
  clearBots();
  if (state.world) { state.world.dispose(); state.world = null; }
  if (state.aimRing) { scene.remove(state.aimRing); state.aimRing.geometry.dispose(); state.aimRing.material.dispose(); state.aimRing = null; }
  state.map = null;
}

async function startMap(def, keepMatch = false) {
  if (state.starting) return;
  state.starting = true;
  const kept = keepMatch ? { loot: { ...state.loot } } : null;         // próximo round: o jogo continua (rounds, melhorias e itens ficam)
  lockMouse();                                            // tem de ser já, dentro do clique do utilizador
  unloadMap();
  let map;
  if (def.load) {                                          // mapa feito no Blender (carregamento assíncrono)
    $("loading").style.display = "flex";
    try { map = await def.load(); }
    catch (err) { console.warn("Mapa do Blender indisponível; a usar a versão em código.", err); map = def.build(); }
    $("loading").style.display = "none";
  } else map = def.build();
  state.starting = false;
  state.map = map; state.def = def;
  scene.background = new THREE.Color(map.background);
  scene.fog = new THREE.Fog(map.background, 150, 420);
  scene.add(map.group);
  scene.add(dummy);
  state.pickups = new PickupManager(map.group);
  state.colors = new ColorSelector({ mixSeconds: CONFIG.mixSeconds });
  state.invisible = 0; setDummyGhost(dummy, false);
  $("crosshair").style.display = CONFIG.ui.crosshair ? "flex" : "none";
  state.shownColor = ""; state.shownCrossColor = "";
  $("feed").innerHTML = ""; $("killfeed").innerHTML = "";
  state.paint = new PaintLayer(map.group);
  // o mapa começa sem tinta; a tinta desaparece 15 s depois de cair (ver paint-layer.js)
  state.weather = new WeatherSystem(map, scene);
  state.weatherId = state.weatherChoice === "random" ? WEATHER_IDS[Math.floor(Math.random() * WEATHER_IDS.length)] : state.weatherChoice;
  state.weather.setMode(state.weatherId, true);
  applyQuality(state.quality);
  state.grace = 4; state.lowFpsTime = 0;
  buildLootPanel();
  if (kept) for (const [k, v] of Object.entries(kept.loot)) if (v > 0 && k in state.loot) addLoot(k, v);

  const sp = map.spawns.A[2];
  state.player.pos.set(sp.x, 0, sp.z);
  state.player.motion = createMotionState(); state.player.facing = sp.ry;
  await spawnBots(map);
  setupCombat(map);
  state.cam.ready = false;
  state.cam.yaw = -Math.PI / 2; state.cam.pitch = 0.2; state.cam.dist = 8; state.cam.aerial = false;
  state.roundTime = CONFIG.roundSeconds; state.opened = 0; state.empty = 0;
  if (kept) {
    state.intermission = 0; state.upgradeChoices = null; state.intenseT = CONFIG.match.intenseEvery;
    applyUpgrades(); resetPips();
    const s0 = CONFIG.ammo.start + FX().startBonus; state.ammo = { vermelho: s0, azul: s0, amarelo: s0 };
    if (state.upg.grenade) addLoot("grenade", FX().grenadePerRound);
    updateScoreUi();
    showToast(`🏁 Round ${state.round.n} — ${def.name}`, "#ffd21f");
  } else newMatch();
  $("prompt").style.display = "none";
  keys.clear();
  lastTime = performance.now();
  showScreen("viewer");
  setPaused(document.pointerLockElement !== canvas);       // se o rato não ficou preso, mostra a pausa com "Continuar"
}

function leaveViewer() {
  if (document.pointerLockElement) document.exitPointerLock();
  unloadMap();
  $("pause").style.display = "none";
  showScreen("select");
}

// ---------- ROUNDS E PLACAR ----------
// Cada round dura 3 min; vence o round a equipa com mais eliminações. Empate = morte súbita (a próxima eliminação decide).
// Vence o jogo a primeira equipa a ganhar 5 rounds (máx. 9 rounds).
function newMatch() {
  state.upg = {}; state.upgradeChoices = null; applyUpgrades();
  state.round = { n: 1, kills: { A: 0, B: 0 }, wins: { A: 0, B: 0 }, sudden: false };
  state.intermission = 0; state.over = false;
  $("roundBox").style.display = "none"; $("gameOver").style.display = "none";
  updateScoreUi();
}
function updateScoreUi() {
  const r = state.round;
  $("scoreA").textContent = r.wins.A; $("scoreB").textContent = r.wins.B;
  $("killsA").textContent = r.kills.A; $("killsB").textContent = r.kills.B;
  const hot = isIntense();
  $("killsLabel").textContent = (r.sudden ? "MORTE SÚBITA" : `Round ${r.n}`) + (hot ? ` 🔥 ${Math.max(1, Math.ceil(state.intenseT))}s` : "");
  $("killsBar").classList.toggle("intense", hot);
  $("killsBar").classList.toggle("sudden", r.sudden);
}
const FX = () => fx(state.upg);
function applyUpgrades() {
  const f = FX();
  if (state.me) { state.me.maxHp = f.maxHp; state.me.pierce = f.pierce; state.me.damageMul = f.damageMul; state.me.grenadeMul = f.grenadeMul; state.me.hp = Math.min(state.me.hp, f.maxHp); }
  if (state.aimRing) state.aimRing.scale.setScalar(f.grenadeMul);
  if (state.colors) state.colors.mixSeconds = f.instantMix ? 0 : CONFIG.mixSeconds;
}
function showUpgradeChoices() {
  state.upgradeChoices = offerUpgrades(state.upg);
  $("upgradeCards").innerHTML = state.upgradeChoices.map((u, i) => `<div class="upCard"><kbd>${i + 1}</kbd><span class="upIcon">${u.icon}</span><b>${u.name}</b><small>${u.desc}${state.upg[u.id] ? ` (nível ${state.upg[u.id] + 1})` : ""}</small></div>`).join("");
  $("upgradeHint").style.display = "block";
}
function pickUpgrade(i) {
  const u = state.upgradeChoices && state.upgradeChoices[i];
  if (!u) return;
  state.upg[u.id] = (state.upg[u.id] || 0) + 1;
  state.upgradeChoices = null;
  $("upgradeCards").innerHTML = ""; $("upgradeHint").style.display = "none";
  applyUpgrades();
  if (u.id === "hp" && state.me) state.me.hp = state.me.maxHp;
  if (u.id === "grenade") addLoot("grenade", 2);
  showToast(`${u.icon} Melhoria: ${u.name}`, "#ffd21f");
  state.intermission = 0.8;
}
function endRound(winner) {
  const r = state.round;
  if (state.intermission > 0 || state.over) return;
  r.wins[winner]++;
  r.sudden = false;
  updateScoreUi();
  const decided = r.wins[winner] >= CONFIG.match.toWin || r.n >= CONFIG.match.maxRounds;
  state.firing = false; cancelGrenadeAim();
  if (decided) {
    state.over = true;
    showGameOver(r.wins.A === r.wins.B ? null : r.wins.A > r.wins.B ? "A" : "B");
    return;
  }
  const box = $("roundBox");
  box.style.setProperty("--c", hex6(TEAM[winner].color));
  $("roundTitle").textContent = `${TEAM[winner].name} venceu o round ${r.n}!`;
  $("roundScore").textContent = `Eliminações: ${r.kills.A} – ${r.kills.B}   ·   Rounds: ${r.wins.A} – ${r.wins.B}`;
  box.style.display = "flex";
  state.intermission = CONFIG.match.intermission;
  showUpgradeChoices();
}
function startNextRound() {
  $("roundBox").style.display = "none";
  state.round.n++; state.round.kills = { A: 0, B: 0 }; state.round.sudden = false;
  // a cada round o mapa muda (à sorte, diferente do anterior); só o primeiro é escolhido
  const others = MAPS.filter((m) => m.id !== state.def.id);
  startMap(others[Math.floor(Math.random() * others.length)], true);
}
function showGameOver(final) {
  const r = state.round, me = state.me, won = final === "A";
  $("goTitle").textContent = final === null ? "EMPATE!" : won ? "VITÓRIA!" : "DERROTA";
  $("goTitle").className = final === null ? "draw" : won ? "win" : "lose";
  $("goSub").textContent = `${TEAM.A.name} ${r.wins.A} – ${r.wins.B} ${TEAM.B.name}`;
  $("goStats").innerHTML = `<div><b>${me.kills}</b><small>eliminações tuas</small></div><div><b>${me.deaths}</b><small>vezes eliminado</small></div><div><b>${r.n}</b><small>rounds jogados</small></div>`;
  $("gameOver").style.display = "flex";
  if (document.pointerLockElement) document.exitPointerLock();
}
function tickRound(dt) {
  const r = state.round;
  if (r.sudden) return;
  state.roundTime -= dt;
  if (state.roundTime > 0) return;
  state.roundTime = 0;
  if (r.kills.A !== r.kills.B) endRound(r.kills.A > r.kills.B ? "A" : "B");
  else { r.sudden = true; resetChests(state.map.chests); updateScoreUi(); showToast("⚡ MORTE SÚBITA: a próxima eliminação decide! Baús reabastecidos", "#ff3b4a"); }
}

// Modo intenso: quando uma equipa já tem 4 rounds, as cores de toda a gente mudam de 5 em 5 segundos (dá hipóteses de virar o jogo)
const isIntense = () => !!state.round && !state.over && Math.max(state.round.wins.A, state.round.wins.B) >= CONFIG.match.intenseAt;
function tickIntense(dt) {
  if (!isIntense()) { if (state.intenseT !== CONFIG.match.intenseEvery) { state.intenseT = CONFIG.match.intenseEvery; updateScoreUi(); } return; }
  state.intenseT -= dt;
  if (state.intenseT <= 0) {
    state.intenseT = CONFIG.match.intenseEvery;
    const all = [...PRIMARIES, ...SECONDARIES];
    for (const c of state.world.combatants) {
      if (!c.alive) continue;
      const opts = all.filter((x) => x !== c.colorId);
      c.colorId = opts[Math.floor(Math.random() * opts.length)];
      if (c.isPlayer) paintPlayer(c.colorId); else paintBot(c);
    }
    showToast("🔥 As cores mudaram!", "#ff8a1f");
  }
  updateScoreUi();
}

function newRound(announce = true) {
  state.intenseT = CONFIG.match.intenseEvery;
  resetChests(state.map.chests);
  state.pickups.clear();
  if (state.paint) state.paint.clear();
  resetPips();
  if (state.world) { const s0 = CONFIG.ammo.start + FX().startBonus; state.world.resetAll(); state.ammo = { vermelho: s0, azul: s0, amarelo: s0 }; }
  $("killfeed").innerHTML = "";
  state.roundTime = CONFIG.roundSeconds;
  if (announce) { state.round.kills = { A: 0, B: 0 }; state.round.sudden = false; updateScoreUi(); showToast("Round reiniciado! Baús reabastecidos", "#ffd21f"); }
}

/* ============================================================
   14. INPUT
   ============================================================ */
function nearestChest() {
  let best = null, bd = CONFIG.chest.interactDist + 1;
  const p = state.player.pos;
  for (const c of state.map.chests) {
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d < bd) { bd = d; best = c; }
  }
  return bd <= CONFIG.chest.interactDist + 1 ? best : null;
}

function tryOpenChest() {
  const c = nearestChest();
  if (!c) return;
  const res = openChest(c, !!state.round?.sudden);
  if (!res.ok) return;
  if (res.reward) {
    const r = res.reward, [lo, hi] = r.drops;
    const n = lo + Math.floor(Math.random() * (hi - lo + 1));
    state.opened++;
    if (r.id === "ammo") {                                          // cada caixa tem uma cor à sorte (pode repetir ou ser tudo diferente)
      const colors = Array.from({ length: n }, () => PRIMARIES[Math.floor(Math.random() * PRIMARIES.length)]);
      state.pickups.spawn("ammo", n, c.x, c.z, colors, colors.map(boxShots));
      showToast(`${r.icon} ${n} ${n === 1 ? "caixa" : "caixas"} de munição — apanha!`, "#2fd15a");
    } else {
      state.pickups.spawn(r.id, n, c.x, c.z);
      showToast(`${r.icon} ${r.label} — apanha!`, "#2fd15a");
    }
  }
  else { state.empty++; showToast("💨 O baú estava vazio!", "#ff3b4a"); }
}

window.addEventListener("keydown", (e) => {
  if (state.screen !== "viewer") return;
  keys.add(e.code);
  if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
  if (e.repeat) return;
  if (state.upgradeChoices) { const k = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code]; if (k !== undefined) pickUpgrade(k); return; }
  if (e.code === "KeyX" && state.aimingGrenade && state.grenadeColor2) { state.grenadeSlot ^= 1; return; }
  if (e.code === "KeyE") tryOpenChest();
  else if (e.code === "KeyV") state.cam.aerial = !state.cam.aerial;
  else if (e.code === "KeyR") newRound();
  else if (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3") state.colors.press(PRIMARIES[Number(e.code.slice(5)) - 1]);
  else if (e.code === "KeyF") useInvisibility();
  else if (e.code === "KeyH") useCure();
  else if (e.code === "KeyG") startGrenadeAim();
  else if (e.code === "KeyJ") {                                   // teste: simula uma eliminação (quem eliminou quem, cor e se foi com a cor certa)
    const kt = Math.random() < 0.5 ? "A" : "B", vt = kt === "A" ? "B" : "A", rnd = () => Math.floor(Math.random() * 5);
    const ids = Object.keys(COLORS);
    reportKill({ team: kt, index: rnd() }, { team: vt, index: rnd() }, ids[Math.floor(Math.random() * ids.length)], Math.random() < 0.5);
  }
  else if (e.code === "KeyK") {                                   // teste: elimina/revive uma bolinha à sorte
    const t = Math.random() < 0.5 ? "A" : "B", i = Math.floor(Math.random() * 5);
    setPlayerOut(t, i, !state.pips[t][i].classList.contains("out"));
  }
  else if (e.code === "KeyQ") {
    applyQuality(QUALITY_IDS[(QUALITY_IDS.indexOf(state.quality) + 1) % QUALITY_IDS.length]);
    showToast(`Qualidade: ${QUALITY[state.quality].label}`, "#9be7ff");
  }
  else if (e.code === "KeyC") {                                   // muda o clima (para ver os efeitos)
    state.weatherId = WEATHER_IDS[(WEATHER_IDS.indexOf(state.weatherId) + 1) % WEATHER_IDS.length];
    state.weather.setMode(state.weatherId);
    showToast(`${WEATHERS[state.weatherId].icon} ${WEATHERS[state.weatherId].name}`, "#9be7ff");
  }
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "KeyG") releaseGrenade();
  if (state.colors && (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3")) state.colors.release(PRIMARIES[Number(e.code.slice(5)) - 1]);
});
window.addEventListener("blur", () => { state.firing = false; keys.clear(); if (state.colors) state.colors.held = []; state.colors?.release(); });

// Rato: com o ponteiro preso (pointer lock) basta mexer o rato para rodar a câmara, sem clicar.
// Esc liberta o rato e abre a pausa; clicar em "Continuar" prende-o de novo.
const canvas = renderer.domElement;
const MOUSE_SENS = 0.0025;
const MIN_PITCH = -1.25;               // abaixo de 0.08 a câmara fica baixa e inclina-se para cima (ver o céu e o clima)
const LOW_PITCH = 0.08;
function lockMouse() { canvas.requestPointerLock?.(); }
function setPaused(p) {
  state.paused = p;
  if (p) { state.firing = false; cancelGrenadeAim(); keys.clear(); if (state.colors) { state.colors.held = []; state.colors.mix = null; } }
  $("pause").style.display = p && state.screen === "viewer" ? "flex" : "none";
  $("hudFps").style.display = p && state.screen === "viewer" ? "block" : "none";          // fps e chamadas só aparecem na pausa
  if (p && state.round && state.me) renderPausePanel();
}
function renderPausePanel() {
  const r = state.round, me = state.me, w = state.world;
  $("ppMap").textContent = `${state.def?.name || ""} · Round ${r.n}`;
  $("ppMode").textContent = `${Math.round(CONFIG.roundSeconds / 60)} MINUTOS · PRIMEIRO A ${CONFIG.match.toWin} ROUNDS · ${r.wins.A} – ${r.wins.B}`;
  const tt = Math.max(0, Math.ceil(state.roundTime)); $("ppTime").textContent = r.sudden ? "⚡" : `${Math.floor(tt / 60)}:${String(tt % 60).padStart(2, "0")}`;
  $("ppMine").innerHTML = `<div><b>${me.kills}</b><small>eliminações</small></div><div><b>${me.deaths}</b><small>mortes</small></div><div><b>${state.loot.grenade || 0}</b><small>granadas</small></div><div><b>${state.loot.health || 0}</b><small>curas</small></div>`;
  for (const team of ["A", "B"]) {
    const rows = w.combatants.filter((c) => c.team === team).sort((a, b) => a.index - b.index).map((c) =>
      `<div class="ppRow${c.isPlayer ? " me" : ""}${c.alive ? "" : " dead"}"><span class="dot"></span>${c.isPlayer ? "Tu" : nameOf(c)}<span class="kd">${c.kills}/${c.deaths}</span></div>`).join("");
    $("ppTeam" + team).innerHTML = `<div class="tName" style="background:${hex6(TEAM[team].color)}">${TEAM[team].name}</div>${rows}`;
  }
  const ups = Object.entries(state.upg).map(([id, n]) => `${UPGRADES.find((u) => u.id === id).icon}${n > 1 ? "×" + n : ""}`).join(" ");
  $("ppUpg").textContent = ups || "nenhuma ainda";
  $("pqVal").textContent = QUALITY[state.quality].label;
  $("pwVal").textContent = WEATHERS[state.weatherId].name;
}
document.addEventListener("pointerlockchange", () => {
  if (state.screen === "viewer") setPaused(document.pointerLockElement !== canvas);
});
document.addEventListener("pointerlockerror", () => { if (state.screen === "viewer") setPaused(true); });
document.addEventListener("mousemove", (e) => {
  if (state.screen !== "viewer" || document.pointerLockElement !== canvas) return;
  state.cam.yaw -= e.movementX * MOUSE_SENS;
  state.cam.pitch = Math.max(MIN_PITCH, Math.min(1.45, state.cam.pitch + e.movementY * MOUSE_SENS));
});
// Rato: clique esquerdo dispara (segura para disparar continuamente)
canvas.addEventListener("mousedown", (e) => { if (e.button === 0 && state.screen === "viewer" && !state.paused) state.firing = true; });
window.addEventListener("mouseup", (e) => { if (e.button === 0) state.firing = false; });
$("resumeBtn").addEventListener("click", lockMouse);
$("pauseMapsBtn").addEventListener("click", leaveViewer);
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
$("pauseFs").addEventListener("click", toggleFullscreen);
$("fsBtn")?.addEventListener("click", toggleFullscreen);
$("escBtn").addEventListener("click", () => { if (document.pointerLockElement) document.exitPointerLock(); else setPaused(true); });
$("pauseQuality").addEventListener("click", () => { applyQuality(QUALITY_IDS[(QUALITY_IDS.indexOf(state.quality) + 1) % QUALITY_IDS.length]); renderPausePanel(); });
$("pauseWeather").addEventListener("click", () => {
  state.weatherId = WEATHER_IDS[(WEATHER_IDS.indexOf(state.weatherId) + 1) % WEATHER_IDS.length];
  state.weather.setMode(state.weatherId); renderPausePanel();
});
renderer.domElement.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (state.aimingGrenade) { cycleGrenadeColor(e.deltaY > 0 ? 1 : -1); return; }   // a apontar a granada: a roda muda a cor
  state.cam.dist = Math.max(4, Math.min(110, state.cam.dist * (e.deltaY > 0 ? 1.1 : 0.9)));
}, { passive: false });

$("playBtn").addEventListener("click", () => { refreshCharScreen(); showScreen("chars"); });
$("goAgain").addEventListener("click", () => { $("gameOver").style.display = "none"; startMap(state.def); });
$("goMenu").addEventListener("click", () => { $("gameOver").style.display = "none"; leaveViewer(); });
$("charBack").addEventListener("click", () => showScreen("title"));
$("charNext").addEventListener("click", () => showScreen("select"));
$("backBtn").addEventListener("click", () => showScreen("chars"));
const instructions = createInstructions({
  content: $("howContent"), prev: $("howPrev"), next: $("howNext"), dots: $("howDots"),
  onClose: () => showScreen("title"),
});
$("howBtn").addEventListener("click", () => { instructions.reset(); showScreen("howto"); });
$("howBack").addEventListener("click", () => showScreen("title"));
window.addEventListener("keydown", (e) => {
  if (state.screen !== "howto") return;
  if (e.code === "ArrowRight") instructions.go(1);
  else if (e.code === "ArrowLeft") instructions.go(-1);
  else if (e.code === "Escape") showScreen("title");
});
$("menuBtn").addEventListener("click", leaveViewer);
function buildWeatherChips() {
  const box = $("weatherPick");
  const opts = [{ id: "random", icon: "🎲", name: "Aleatório" }, ...WEATHER_IDS.map((id) => WEATHERS[id])];
  for (const o of opts) {
    const b = document.createElement("button");
    b.className = "chip" + (o.id === state.weatherChoice ? " on" : "");
    b.textContent = `${o.icon} ${o.name}`;
    b.addEventListener("click", () => {
      state.weatherChoice = o.id;
      box.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === b));
    });
    box.appendChild(b);
  }
}
buildWeatherChips();

// ---------- bots: 4 aliados + 5 inimigos, cada um com o seu personagem (todos diferentes dentro da equipa) ----------
const _botTemplates = new Map();
function botTemplate(id) {
  if (!_botTemplates.has(id)) _botTemplates.set(id, loadCharacter(CHARACTERS.find((c) => c.id === id).url));
  return _botTemplates.get(id);
}
function clearBots() {
  for (const b of state.bots) if (b.model && b.model.parent) b.model.parent.remove(b.model);
  state.bots = [];
}
// Nome por cima da cabeça: azul para aliados, vermelho para adversários
function nameTag(text, color) {
  const cv = document.createElement("canvas"); cv.width = 256; cv.height = 64;
  const g = cv.getContext("2d");
  g.font = "44px 'Titan One', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineJoin = "round"; g.lineWidth = 9; g.strokeStyle = "#0d0b1f"; g.strokeText(text, 128, 34);
  g.fillStyle = color; g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sp.scale.set(3.4, 0.85, 1); sp.position.set(0, 3.9, 0); sp.renderOrder = 6;
  sp.name = "nameTag";
  return sp;
}
async function spawnBots(map) {
  clearBots();
  const made = [];
  for (const team of ["A", "B"]) {
    for (let i = 0; i < 5; i++) {
      if (team === "A" && i === 0) continue;                                   // o 1.º da equipa A é o jogador
      const id = state.rosters[team][i], tpl = await botTemplate(id);
      if (!tpl) continue;
      const spawn = map.spawns[team][team === "A" ? [0, 1, 3, 4][i - 1] : i];   // o jogador nasce em A[2]
      const model = cloneCharacter(tpl);
      const colorId = PRIMARIES[Math.floor(Math.random() * PRIMARIES.length)];
      setCharacterPaint(model, COLORS[colorId].hex);
      model.add(nameTag(CHARACTERS.find((c) => c.id === id).name, team === "A" ? "#4da8ff" : "#ff4455"));
      model.position.set(spawn.x, 0, spawn.z); model.rotation.y = spawn.ry;
      scene.add(model);
      made.push(new Bot({ team, index: i, characterId: id, model, pos: spawn, facing: spawn.ry, role: i <= (team === "A" ? 2 : 1) ? "defend" : "attack", colorId }));
    }
  }
  state.bots = made;
}

// ---------- COMBATE: disparo, munição, vida, cura, morte e reaparecimento ----------
const hexOf = (id) => COLORS[id].hex;
const nameOf = (c) => (CHARACTERS.find((x) => x.id === state.rosters[c.team][c.index]) || { name: "?" }).name;

// Cor do boneco do jogador (a que os adversários têm de acertar) — separada da cor da munição
function paintPlayer(colorId) {
  state.playerColor = colorId;
  if (dummy.userData.paintMat) { setCharacterPaint(dummy, hexOf(colorId)); setSymbol(dummy, colorId); } else setDummyColor(dummy, colorId);
  $("myColor").innerHTML = chipHTML(colorId, 24);
}
function setSymbol(model, colorId) {                                           // símbolo da cor por cima da cabeça
  const sym = model.userData.sym, sm = symbolMaterial(colorId);
  if (sym && sm) { sym.material = sm; sym.visible = CONFIG.ui.symbolAboveHead; }
}
function paintBot(bot) { if (bot.model) { setCharacterPaint(bot.model, hexOf(bot.colorId)); setSymbol(bot.model, bot.colorId); } }

// Um bot abre um baú: as caixas caem no chão (cores à sorte) e qualquer um pode apanhá-las
function botOpenChest(bot, c) {
  const res = openChest(c, !!state.round?.sudden);
  if (!res.ok || !res.reward) return;
  const r = res.reward, [lo, hi] = r.drops;
  const n = lo + Math.floor(Math.random() * (hi - lo + 1));
  if (r.id === "ammo") { const cols = Array.from({ length: n }, () => PRIMARIES[Math.floor(Math.random() * PRIMARIES.length)]); state.pickups.spawn("ammo", n, c.x, c.z, cols, cols.map(boxShots)); }
  else state.pickups.spawn(r.id, n, c.x, c.z);
}

function setupCombat(map) {
  if (state.world) state.world.dispose();
  state.ammo = { vermelho: CONFIG.ammo.start, azul: CONFIG.ammo.start, amarelo: CONFIG.ammo.start };
  Object.assign(state, { dead: false, deathInfo: null, gameTime: 0, firing: false, fireCd: 0, hurtT: 0, hpShown: -1 });
  const world = new CombatWorld({
    scene, map, paint: state.paint,
    callbacks: {
      onDamage: (v) => { if (v.isPlayer) state.hurtT = 0.5; },
      onColorChange: (v, c) => {
        if (v.isPlayer) { paintPlayer(c); showToast(`🎨 A tua cor mudou para ${COLORS[c].name}!`, "#" + hex6(hexOf(c)).slice(1)); }
        else paintBot(v);
      },
      onGrenade: (k, x, z, colorId, hit) => {
        if (k.isPlayer) showToast(hit.length ? `💣 ${hit.length} ${hit.length === 1 ? "jogador ficou" : "jogadores ficaram"} ${COLORS[colorId].name}` : "💣 A granada não apanhou ninguém", hit.length ? hex6(hexOf(colorId)) : "#ffd21f");
        else if (hit.includes(state.me)) showToast("💣 Uma granada mudou a tua cor!", "#ff8a1f");
      },
      onKill: (k, v, shot, byColor) => {
        reportKill({ team: k.team, index: k.index }, { team: v.team, index: v.index }, shot, byColor);
        if (k.team !== v.team && !state.over) { state.round.kills[k.team]++; updateScoreUi(); if (state.round.sudden) endRound(k.team); }
        if (v.isPlayer) { state.dead = true; state.firing = false; state.deathInfo = { by: nameOf(k), byColor }; }
        else if (k.isPlayer) showToast(byColor ? `🎯 Eliminaste ${nameOf(v)} com a cor certa!` : `💥 Eliminaste ${nameOf(v)}`, byColor ? "#2fd15a" : "#ff8a1f");
      },
      onRespawn: (c) => {
        setPlayerOut(c.team, c.index, false);
        if (c.isPlayer) {
          state.dead = false; state.player.motion = createMotionState(); state.player.facing = c.spawn.ry; state.cam.ready = false;
          paintPlayer(c.colorId);
        } else { c.onRespawn(); paintBot(c); }
      },
    },
  });
  const me = { id: "A0", team: "A", index: 0, isPlayer: true, pos: state.player.pos, colorId: PRIMARIES[Math.floor(Math.random() * PRIMARIES.length)],
               spawn: map.spawns.A[2], get hidden() { return state.invisible > 0; } };
  world.add(me);
  for (const b of state.bots) { world.add(b); paintBot(b); }
  world.services = { pickups: state.pickups, openChest: botOpenChest };
  state.world = world; state.me = me;
  applyUpgrades();
  paintPlayer(me.colorId);
  // círculo que mostra onde a granada vai cair (tamanho = área do efeito)
  const R = CONFIG.grenade.radius;
  state.aimRing = new THREE.Mesh(new THREE.RingGeometry(R - 0.3, R, 56), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  state.aimRing.rotation.x = -Math.PI / 2; state.aimRing.position.y = 0.07; state.aimRing.visible = false;
  state.aimRing2 = new THREE.Mesh(new THREE.RingGeometry(R * 0.5, R * 0.62, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  state.aimRing2.visible = false; state.aimRing.add(state.aimRing2);                // 2.ª cor (melhoria): anel interior
  scene.add(state.aimRing); state.aimingGrenade = false;
}

const _aimDir = new THREE.Vector3();
// Ajuda de pontaria: se um inimigo visível estiver quase no centro do ecrã (cone de ~3,5°), o tiro vai para o peito dele
function aimAssist(c, dir, maxAng = 0.06) {
  let best = null, bestAng = maxAng;
  const p = state.player.pos;
  for (const q of state.world.enemiesOf(state.me)) {
    if (q.hidden) continue;
    const vx = q.pos.x - c.x, vy = q.pos.y + 1.3 - c.y, vz = q.pos.z - c.z, d = Math.hypot(vx, vy, vz);
    const cos = (vx * dir.x + vy * dir.y + vz * dir.z) / d;
    if (cos <= 0 || d > CONFIG.weapon.range) continue;
    const ang = Math.acos(Math.min(1, cos));
    if (ang < bestAng && state.world.los(p.x, p.z, q.pos.x, q.pos.z)) { best = q; bestAng = ang; }
  }
  return best;
}
function tryFire() {
  const col = state.colors.current, comps = ingredients(col);
  if (!comps.every((c) => state.ammo[c] >= 1)) {                                  // sem tinta nos tanques desta cor
    if (state.gameTime - state.noAmmoMsg > 1.4) { state.noAmmoMsg = state.gameTime; showToast(`Sem munição ${COLORS[col].name}!`, "#ff8a1f"); }
    state.fireCd = 0.2; return;
  }
  for (const c of comps) state.ammo[c] -= 1;                                       // secundária gasta dos dois tanques
  camera.getWorldDirection(_aimDir);
  const cp = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
  let hit = state.world.raycast(cp, _aimDir, CONFIG.weapon.range, "A");
  const assist = aimAssist(cp, _aimDir);
  if (assist) hit = { x: assist.pos.x, y: assist.pos.y + 1.3, z: assist.pos.z };
  const p = state.player.pos, yaw = Math.atan2(hit.x - p.x, hit.z - p.z);
  state.player.facing = yaw; state.player.aimLock = 0.35;                          // o boneco vira-se para onde apontas
  const m = { x: p.x + Math.sin(yaw) * 0.9, y: p.y + 1.25, z: p.z + Math.cos(yaw) * 0.9 };
  const proj = state.world.fire(state.me, m, { x: hit.x - m.x, y: hit.y - m.y, z: hit.z - m.z }, col);
  state.lastShot = { hit, muzzle: m, fired: !!proj, assisted: !!assist };
  if (state.invisible > 0) { state.invisible = 0; showToast("👻 Disparar revela-te!", "#9be7ff"); }
  state.fireCd = CONFIG.weapon.fireInterval * FX().fireMul;
}

// ---------- granada de tinta: escolhe a cor (1/2/3), segura G para apontar (alcance limitado) e larga para lançar ----------
function grenadeTarget() {
  camera.getWorldDirection(_aimDir);
  const hit = state.world.raycast({ x: camera.position.x, y: camera.position.y, z: camera.position.z }, _aimDir, 70, "A");
  const p = state.player.pos, dx = hit.x - p.x, dz = hit.z - p.z, d = Math.hypot(dx, dz), R = CONFIG.grenade.range;
  return d > R ? { x: p.x + (dx / d) * R, z: p.z + (dz / d) * R } : { x: hit.x, z: hit.z };
}
function startGrenadeAim() {
  if (state.dead || state.cam.aerial) return;
  if (!state.loot.grenade) { showToast("💣 Não tens granadas", "#ffd21f"); return; }
  state.grenadeColor = state.colors.current;                                         // começa com a cor da mão; a roda do rato muda
  state.grenadeColor2 = FX().dualGrenade ? state.grenadeColor : null; state.grenadeSlot = 0;
  state.aimingGrenade = true; state.aimRing.visible = true;
}
const GRENADE_COLORS = [...PRIMARIES, ...SECONDARIES];
function cycleGrenadeColor(dir) {
  const key = state.grenadeSlot === 1 && state.grenadeColor2 ? "grenadeColor2" : "grenadeColor";
  const i = GRENADE_COLORS.indexOf(state[key]);
  state[key] = GRENADE_COLORS[(i + dir + GRENADE_COLORS.length) % GRENADE_COLORS.length];
}
function cancelGrenadeAim() { state.aimingGrenade = false; if (state.aimRing) state.aimRing.visible = false; }
function releaseGrenade() {
  if (!state.aimingGrenade) return;
  cancelGrenadeAim();
  if (state.dead || !state.loot.grenade) return;
  const t = grenadeTarget(), p = state.player.pos, yaw = Math.atan2(t.x - p.x, t.z - p.z), col = state.grenadeColor;
  state.player.facing = yaw; state.player.aimLock = 0.4;
  const o = { x: p.x + Math.sin(yaw) * 0.8, y: p.y + 1.5, z: p.z + Math.cos(yaw) * 0.8 };
  const col2 = state.grenadeColor2;
  state.world.throwGrenade(state.me, o, t, col, col2);
  addLoot("grenade", -1);
  showToast(`💣 Granada ${COLORS[col].name}${col2 && col2 !== col ? " + " + COLORS[col2].name : ""} lançada!`, hex6(hexOf(col)));
  if (state.invisible > 0) state.invisible = 0;
}

const _speedCfg = { ...MOTION };
function speedCfg() {                                                                // melhoria: mais velocidade
  const k = FX().speedMul;
  if (k === 1) return MOTION;
  _speedCfg.walk = MOTION.walk * k; _speedCfg.run = MOTION.run * k;
  return _speedCfg;
}

function useCure() {                                                               // tecla H
  if (state.dead || !state.loot.health) return;
  const gained = state.world.heal(state.me, CONFIG.health.cure);
  if (gained <= 0) { showToast("❤️ Já tens a vida cheia", "#ffd21f"); return; }
  addLoot("health", -1);
  showToast(`💊 +${Math.round(gained)} de vida`, "#2fd15a");
  const bar = $("hpBox"); bar.classList.remove("heal"); void bar.offsetWidth; bar.classList.add("heal");
}

function updateCombatUi(dt, t) {
  if (state.aimingGrenade) {                                                         // o círculo segue o ponto de queda, com a cor da mão
    const t = grenadeTarget();
    state.aimRing.position.set(t.x, 0.07, t.z);
    state.aimRing.material.color.setHex(hexOf(state.grenadeColor));
    state.aimRing2.visible = !!state.grenadeColor2 && state.grenadeColor2 !== state.grenadeColor;
    if (state.aimRing2.visible) state.aimRing2.material.color.setHex(hexOf(state.grenadeColor2));
    state.aimRing.visible = !state.dead;
  }
  const me = state.me, hp = Math.ceil(me.hp);
  if (hp !== state.hpShown) {
    state.hpShown = hp;
    $("hpFill").style.width = Math.max(0, (hp / me.maxHp) * 100) + "%";
    $("hpNum").textContent = hp;
    $("hpBox").classList.toggle("low", hp > 0 && hp <= me.maxHp * 0.3);
  }
  if (state.hurtT > 0) { state.hurtT -= dt; $("hurt").style.opacity = String(Math.max(0, Math.min(1, state.hurtT * 2))); }
  // painel do alvo: cor do inimigo para onde apontas e o que fazer para a acertar
  const info = $("targetInfo");
  let tgt = null;
  if (!state.dead && !state.cam.aerial) {
    camera.getWorldDirection(_aimDir);
    tgt = aimAssist({ x: camera.position.x, y: camera.position.y, z: camera.position.z }, _aimDir, 0.16);
  }
  if (tgt) {
    state.targetT = 0.4;
    const c = COLORS[tgt.colorId], match = state.colors.current === tgt.colorId;
    const key = tgt.id + tgt.colorId + match;
    if (key !== state.targetKey) {
      state.targetKey = key;
      const how = c.kind === "primaria" ? `tecla ${c.key}` : `${c.parts.map((p) => COLORS[p].name).join(" + ")} (teclas ${c.parts.map((p) => COLORS[p].key).join(" + ")})`;
      info.innerHTML = `${chipHTML(tgt.colorId, 32)}<div><b>${nameOf(tgt)}: ${c.name}</b><small>${match ? "✔ Cor certa na mão: dispara!" : "Muda a munição para " + how}</small></div>`;
      info.className = "show " + (match ? "match" : "nomatch");
    }
  } else if (state.targetT > 0) state.targetT -= dt;
  else if (info.classList.contains("show")) { info.classList.remove("show"); state.targetKey = ""; }
  const box = $("deathBox");
  if (state.dead && state.deathInfo) {
    const left = Math.max(0, Math.ceil(me.respawnAt - state.world.t));
    $("deathText").textContent = `${state.deathInfo.by} eliminou-te${state.deathInfo.byColor ? " com a cor certa" : ""}. Voltas em ${left} s`;
    box.style.display = "flex";
  } else box.style.display = "none";
  // piscar durante a proteção após reaparecer; escondido enquanto está eliminado
  const blink = Math.floor(t * 10) % 2 === 0, vis = (c) => c.alive && (state.world.t >= c.protectUntil || blink);
  dummy.visible = vis(me);
  for (const b of state.bots) if (b.model) b.model.visible = vis(b);
}

const CHAR_BLURB = {
  robin: "Líder ágil, de máscara e capa", starfire: "Cheia de energia, cabelo de fogo",
  cyborg: "Metade máquina, o mais forte", raven: "Misteriosa, de capa e capuz", beastboy: "Verde e brincalhão",
};
function buildCharCards() {
  const grid = $("charGrid");
  for (const id of TITANS) {
    const c = CHARACTERS.find((x) => x.id === id);
    const el = document.createElement("button");
    el.className = "charCard" + (id === state.characterId ? " on" : "");
    el.dataset.id = id;
    el.innerHTML = `<span class="charFace"><img alt=""><i>${c.icon}</i></span><span class="cname">${c.name}</span><span class="cdesc">${CHAR_BLURB[id]}</span>`;
    el.addEventListener("click", () => {
      grid.querySelectorAll(".charCard").forEach((x) => x.classList.toggle("on", x === el));
      setCharacter(id);
      refreshCharScreen();
    });
    grid.appendChild(el);
  }
}
// retratos nos cartões e as duas equipas pré-definidas (cada equipa tem os 5, sem repetir)
function refreshCharScreen() {
  for (const el of $("charGrid").children) {
    const url = portraitUrl(el.dataset.id, TEAM.A.color), img = el.querySelector("img");
    if (url) { img.src = url; el.classList.add("hasImg"); }
  }
  const rosters = state.rosters || buildRosters(state.characterId);
  for (const [team, box] of [["A", "previewA"], ["B", "previewB"]]) {
    $(box).innerHTML = rosters[team].map((id, i) => {
      const c = CHARACTERS.find((x) => x.id === id), url = portraitUrl(id, TEAM[team].color);
      return `<span class="pvFace${team === "A" && i === 0 ? " you" : ""}" style="--c:${hex6(TEAM[team].color)}" title="${c.name}">${url ? `<img src="${url}" alt="">` : c.icon}<small>${team === "A" && i === 0 ? "tu" : c.name}</small></span>`;
    }).join("");
  }
}
buildCharCards();
setCharacter(state.characterId);
buildPortraits({ A: TEAM.A.color, B: TEAM.B.color }).then(() => { refreshPips(); refreshCharScreen(); });
buildMapCards();
buildTeamPips();

/* ============================================================
   15. LOOP PRINCIPAL
   ============================================================ */
let lastTime = performance.now(), lastDraw = 0;

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Distância máxima a que a câmara pode ficar do alvo sem entrar num obstáculo (anda ao longo do raio em passos)
function cameraClearance(colliders, tx, ty, tz, dx, dy, dz, maxDist) {
  const pad = 0.45;
  for (let d = 1.0; d <= maxDist; d += 0.4) {
    const x = tx + dx * d, y = ty + dy * d, z = tz + dz * d;
    for (const c of colliders) {
      if (y > c.top + 0.25) continue;
      const hit = c.r !== undefined ? Math.hypot(x - c.x, z - c.z) < c.r + pad
        : x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad;
      if (hit) return Math.max(0, d - 0.5);
    }
  }
  return maxDist;
}

function lerpAngle(a, b, k) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * k;
}

function update(dt, t) {
  const st = state, p = st.player, map = st.map, cam = st.cam;
  if (st.over) return;                                                   // jogo terminado: tudo parado atrás do ecrã final
  if (st.intermission > 0) {                                              // pausa entre rounds
    if (st.upgradeChoices) return;                                        // à espera de escolheres a melhoria (1, 2 ou 3)
    st.intermission -= dt;
    if (st.intermission <= 0) startNextRound();
    return;
  }

  // movimento relativo à câmara, com inércia, controlo no ar e salto variável (ver player-motion.js)
  const ix = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  const iz = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
  const run = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  let mx = fx * iz + rx * ix, mz = fz * iz + rz * ix;
  const len = Math.hypot(mx, mz);
  if (len > 0) { mx /= len; mz /= len; }
  if (st.dead) { mx = 0; mz = 0; }                                  // eliminado: não se mexe até reaparecer
  const jumpHeld = keys.has("Space") && !st.dead, jumpPressed = jumpHeld && !p.jumpWasHeld;
  p.jumpWasHeld = jumpHeld;
  const before = { x: p.pos.x, z: p.pos.z };
  const ev = stepMotion(p.motion, p.pos, { x: mx, z: mz }, { run, jumpPressed, jumpHeld }, dt, speedCfg());
  resolveCollisions(p.pos, CONFIG.player.radius, map.colliders);
  collisionFeedback(p.motion, before, p.pos, dt);

  // o boneco olha para onde se move
  const gspeed = Math.hypot(p.motion.vx, p.motion.vz);
  if (p.aimLock > 0) p.aimLock -= dt;                               // a disparar, o boneco olha para onde apontas
  else if (gspeed > 0.6) p.facing = lerpAngle(p.facing, Math.atan2(p.motion.vx, p.motion.vz), Math.min(1, dt * 14));
  dummy.position.copy(p.pos);
  dummy.rotation.y = p.facing;
  animateCharacter(dummy, { speed: gspeed, maxSpeed: MOTION.run, onGround: p.motion.onGround, vy: p.motion.vy, landed: ev.landed, impact: ev.impact }, dt, t);

  // bots
  const agents = [{ pos: p.pos }, ...st.bots];
  for (const b of st.bots) {
    b.update(dt, t, map, agents, st.world);
    if (b.team !== "A") { const tag = b.model.getObjectByName("nameTag"); if (tag) tag.visible = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z) <= CONFIG.ui.enemyNameDist; }   // nomes dos adversários só de perto
    if (b.alive) for (const g of st.pickups.collectNear(b.pos)) b.ammo[g.color] = Math.min(CONFIG.ammo.max, b.ammo[g.color] + (g.shots ?? CONFIG.ammoBox.shots));
  }

  // tiros, munição, combate e vida
  for (const c of PRIMARIES) st.ammo[c] = Math.min(CONFIG.ammo.max, st.ammo[c] + CONFIG.ammo.regen * FX().regenMul * dt);   // os tanques recarregam devagar
  st.fireCd -= dt;
  if (st.firing && !st.dead && !cam.aerial && st.fireCd <= 0) tryFire();
  st.gameTime += dt;
  st.world.update(dt, st.gameTime);
  updateAmmoUi();
  updateCombatUi(dt, t);

  // animações do mapa e baús
  for (const u of map.updaters) u(dt, t);
  updateChests(map.chests, dt, t);
  st.colors.update(dt);
  updateInvisibility(dt);
  updateCrosshair();
  st.paint.update(dt);
  st.paint.flush();
  st.weather.cloudsVisible = !cam.aerial;
  st.weather.update(dt, t);
  for (const it of st.pickups.update(dt, t, p.pos, map.colliders)) {
    if (it.type === "ammo") {
      const sh = it.shots ?? CONFIG.ammoBox.shots;
      addAmmo(it.color, sh);
      showToast(`+${sh} ${sh === 1 ? "bala" : "balas"} ${COLORS[it.color].name}`, "#" + COLORS[it.color].hex.toString(16).padStart(6, "0"));
    } else if (it.type === "invisible") {                               // guardada na lista; F para usar
      addLoot("invisible");
      showToast("👻 Invisibilidade — carrega em F para usar", "#9be7ff");
    } else {
      const r = CONFIG.rewards.find((x) => x.id === it.type);
      addLoot(it.type);
      showToast(`+1 ${r.icon} ${r.label}`, "#ffd21f");
    }
  }

  // round
  tickRound(dt);
  tickIntense(dt);
  updateTimerStyle();
  const tl = fmtTime(st.roundTime);
  if (tl !== st.lastUiTimer) { $("hudTimer").textContent = tl; st.lastUiTimer = tl; }

  // indicação do baú mais próximo
  const pr = $("prompt"), c = nearestChest();
  if (c && Math.hypot(c.x - p.pos.x, c.z - p.pos.z) <= CONFIG.chest.interactDist) {
    const left = CONFIG.chest.maxOpensPerRound - c.opens;
    pr.textContent = c.state === "ready" ? `[E] Abrir baú (${left} abertura${left === 1 ? "" : "s"} neste round)`
      : c.state === "cooldown" ? `Baú a reabastecer… ${Math.ceil(c.cooldown)}s`
      : "Baú esgotado até ao próximo round";
    pr.style.display = "block";
  } else pr.style.display = "none";

  // câmara: segue o jogador com suavidade, não atravessa paredes/objetos e abre o campo de visão ao correr
  const aerial = cam.aerial;
  const pitch = aerial ? 1.3 : Math.max(cam.pitch, LOW_PITCH), want = aerial ? 88 : cam.dist;
  const cp = Math.cos(pitch);
  const dirx = Math.sin(cam.yaw) * cp, diry = Math.sin(pitch), dirz = Math.cos(cam.yaw) * cp;
  if (!cam.ready) { cam.focus.set(p.pos.x, p.pos.y + 1.4, p.pos.z); cam.curDist = want; cam.ready = true; }
  const kxz = 1 - Math.exp(-dt * 16), ky = 1 - Math.exp(-dt * 9);
  cam.focus.x += (p.pos.x - cam.focus.x) * kxz; cam.focus.z += (p.pos.z - cam.focus.z) * kxz;
  cam.focus.y += (p.pos.y + 1.4 - cam.focus.y) * ky;
  const tx = aerial ? 0 : cam.focus.x, ty = aerial ? 0 : cam.focus.y, tz = aerial ? 0 : cam.focus.z;
  let dist = want;
  if (!aerial) {
    const safe = Math.max(1.8, cameraClearance(map.colliders, tx, ty, tz, dirx, diry, dirz, want));
    cam.curDist = safe < cam.curDist ? safe : cam.curDist + (safe - cam.curDist) * (1 - Math.exp(-dt * 4));   // aproxima logo, afasta devagar
    dist = cam.curDist;
  }
  camera.position.set(tx + dirx * dist, Math.max(0.6, ty + diry * dist), tz + dirz * dist);
  camera.lookAt(tx, ty, tz);
  if (!aerial && cam.pitch < LOW_PITCH) camera.rotateX(LOW_PITCH - cam.pitch);   // olhar para cima
  const fovWant = aerial ? 60 : 60 + 9 * clamp01((gspeed - MOTION.walk) / (MOTION.run - MOTION.walk));
  cam.fov += (fovWant - cam.fov) * (1 - Math.exp(-dt * 6));
  if (Math.abs(camera.fov - cam.fov) > 0.05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
}

// Contador de FPS e redução automática de qualidade quando o jogo não aguenta
function trackPerformance(dt) {
  state.fpsFrames++; state.fpsTime += dt;
  if (state.grace > 0) state.grace -= dt;
  if (state.fpsTime < 0.5) return;
  const fps = state.fpsFrames / state.fpsTime;
  if (!state.paused) $("hudFps").textContent = `${Math.round(fps)} fps · ${renderer.info.render.calls} chamadas · ${QUALITY[state.quality].label}`;
  state.lowFpsTime = fps < 40 && state.grace <= 0 && !state.paused ? state.lowFpsTime + state.fpsTime : 0;
  state.fpsFrames = 0; state.fpsTime = 0;
  const i = QUALITY_IDS.indexOf(state.quality);
  if (state.lowFpsTime >= 3 && i < QUALITY_IDS.length - 1) {          // 3 s seguidos abaixo de 40 fps
    applyQuality(QUALITY_IDS[i + 1]);
    showToast(`FPS baixos: qualidade ${QUALITY[state.quality].label}`, "#ff8a1f");
    state.lowFpsTime = 0; state.grace = 4;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  if (state.screen !== "viewer" || !state.map) return;
  // limita a 60 fps (ecrãs de 120/144 Hz gastavam o dobro) e, em pausa, só redesenha 10 vezes por segundo: menos calor e ruído da ventoinha
  if (now - lastDraw < (state.paused ? 100 : 1000 / 60 - 1.5)) return;
  lastDraw = now;
  const dt = Math.max(0, Math.min(0.05, (now - lastTime) / 1000));   // nunca negativo (o 1.º frame pode vir antes de lastTime)
  lastTime = now;
  if (!state.paused) update(dt, now / 1000);
  trackPerformance(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// Modo de testes: abrir index.html?debug expõe o estado do jogo na consola (window.__ca)
if (new URLSearchParams(location.search).has("debug")) window.__ca = { setPaused, endRound, pickUpgrade, state, camera, scene, tryOpenChest, nearestChest, setCharacter, reportKill, tryFire, paintBot };
