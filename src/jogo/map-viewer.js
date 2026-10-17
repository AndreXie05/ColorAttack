import * as THREE from "three";
import { aimY, eyeY, muzzleY, CONFIG, TEAM, ARENA, BOT_PRESETS, DIFFICULTIES, setDifficulty, MATCH_TO_WIN, ROUND_MINUTES, setMatchOptions, MODES, setGameMode } from "../base/game-config.js";
import { MAPS } from "../mapas/map-definitions.js";
import { resolveCollisions } from "../movimento/collisions.js";
import { floorAt, topAt, ceilingAt, ladderState, ladderAt, hugLadder, surfaceEffects, inWater, near } from "../movimento/surfaces.js";
import { openChest, updateChests, resetChests, makeGolden, instanceChests } from "./chests-and-loot.js";
import { createDummy, setDummyGhost, setDummyColor } from "./test-dummy.js";
import { ColorSelector } from "../ecras/color-selector.js";
import { loadCharacter, cloneCharacter, setCharacterPaint, addHeldItems, setHeld, setCharacterLod, disposeCharacter } from "../personagens/character-model.js";
import { Bot } from "./bots.js";
import { CombatWorld } from "./combat.js";
import { symbolMaterial } from "../visual/symbol-sprites.js";
import { MOTION, createMotionState, stepMotion, collisionFeedback } from "../movimento/player-motion.js";
import { animateCharacter, visualY } from "../personagens/character-animator.js";
import { CHARACTERS, buildRosters, charById } from "../personagens/characters.js";
import { buildPortraits, portraitUrl } from "../personagens/portraits.js";
import { PickupManager } from "./pickups.js";
import { createInstructions } from "../ecras/instructions-screen.js";
import { WeatherSystem, WEATHERS, WEATHER_IDS } from "../visual/weather.js";
import { PaintLayer } from "../visual/paint-layer.js";
import { patchPaintMaterial } from "../visual/map-look.js";
import { setupMapFeatures } from "../mapas/map-features.js";
import { UPGRADES, offerUpgrades, fx } from "./upgrades.js";
import * as Stats from "../progresso/stats.js";
import { Tutorial, STEPS as TUT_STEPS } from "./tutorial.js";
import { COLORS, PRIMARIES, SECONDARIES, chipHTML, ingredients, COLOR_RULES, paletteColors, hitDamage, shuffleMixes, resetMixes, getMixes } from "../base/colors.js";
import * as Progress from "../progresso/progress.js";
import * as Ach from "../progresso/achievements.js";
import * as Missions from "../progresso/missions.js";
import { applyCosmetics, ITEMS } from "../loja/cosmetics.js";
import { createTrails } from "../loja/trails.js";
import { createLobby, LOBBY_THEMES } from "../ecras/lobby.js";
import * as Emotes from "../personagens/emotes.js";
import { Replay } from "./replay.js";
import { Puppet } from "../online/net-game.js";
import { Sfx } from "../som/sfx.js";
import { DamageNumbers } from "../visual/damage-numbers.js";
import { createSettings, mouseSens } from "../ecras/settings.js";
import { createDailyScreen } from "../ecras/daily-screen.js";
import { createWheelScreen } from "../ecras/wheel-screen.js";
import { checkLevelUp } from "../ecras/level-banner.js";
import { randomTip } from "../ecras/tips.js";
import { playerName } from "../progresso/player-name.js";
import { createPodium } from "../ecras/victory-podium.js";
import { prizeText } from "../progresso/daily-login.js";
import { state, keys, $, renderer, scene, camera, hex6, personName, hexOf, nameOf } from "./game-state.js";
import { QUALITY, QUALITY_IDS, QUALITY_TIPS, applyQuality, resize, buildQualityChips } from "../visual/quality.js";
import { showToast, fmtTime, ITEM_KEYS, buildLootPanel, updateAmmoUi, buildTeamPips, labelPips, refreshPips, reportFall, reportKill, setPlayerOut, resetPips, updateCrosshair, updateTimerStyle, updateScoreUi, isIntense, showCountdown, tickCountdown, updateLastSeconds, updateMixHint, renderMixTable, updateZoneTable } from "./hud.js";
import { setupNetMatch } from "../online/net-match.js";
import { roundStatsHTML, heatmapURL, heatHTML, addRoundToGameStats, showSummary, summaryHTML, xpBarHTML } from "../ecras/round-summary.js";
import { bakeMinimap, updateMinimap } from "../visual/minimap.js";
// import { PointerLockControls } from "three/addons/controls/PointerLockControls.js"; // fase da câmara em 1.ª pessoa

/* ============================================================
   10. ESTADO DO VISUALIZADOR
   ============================================================ */
let lobby = null;                                                                   // ecrã principal (lobby.js); criado no fim deste ficheiro
let daily = null;                                                                   // prémio diário (daily-screen.js); idem

/* ============================================================
   11. RENDERIZAÇÃO
   ============================================================ */
let dummy = createDummy();
const podium = createPodium(renderer);                                              // pódio da equipa vencedora no fim do jogo
const trails = createTrails(scene);                                                 // rasto do jogador ao correr (loja)                           // boneco simples; é trocado pelo do Blender quando o carregamento termina

state.characterId = (Progress.wallet.equip.boneco || "boneco_iniciante").slice(7);       // a skin equipada (loja/inventário)
const _modelCache = new Map();                        // id -> Promise do modelo (carregado uma só vez)
async function setCharacter(id) {
  const def = charById(id);
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
  addHeldItems(dummy);
  applyCosmetics(dummy, Progress.wallet.equip);                                     // arma escolhida no inventário
  setDummyGhost(dummy, state.invisible > 0);
  if (state.me) paintPlayer(state.playerColor);
}

renderer.shadowMap.autoUpdate = false;                                              // as sombras só se recalculam quando pedimos (ver frame)
window.addEventListener("resize", resize);
resize();

/* ============================================================
   12. MENUS E HUD
   ============================================================ */
function showScreen(name) {
  state.screen = name;
  if (name !== "viewer") Sfx.ambient();                                                // fora da partida (lobby, menus): sem chuva nem vento
  $("lobby").style.display = name === "lobby" ? "flex" : "none";
  if (name === "lobby") { refreshLevelBadge(); lobby?.renderTop(); checkLevelUp(); daily?.auto(); $("lbTip").innerHTML = `<b>DICA</b>${randomTip()}`; }   // faixa "NÍVEL X!" se subiste; o prémio diário abre sozinho uma vez por dia
  $("titleScreen").style.display = name === "title" ? "flex" : "none";
  $("charSelect").style.display = name === "chars" ? "flex" : "none";
  $("mapSelect").style.display = name === "select" ? "flex" : "none";
  $("setupScreen").style.display = name === "setup" ? "flex" : "none";
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
    if (m.id === "random") el.innerHTML = `<div class="icon">${m.icon}</div><div class="name">${m.name}</div><div class="desc">${m.desc}</div>`;
    else {                                             // cartão com a imagem do mapa (assets/previews), que se aproxima ao passar o rato
      el.classList.add("pic");
      el.innerHTML = `<div class="shot" style="background-image:url(assets/previews/${m.id}.jpg)"></div>
        <div class="info"><div class="name"><span class="icon">${m.icon}</span> ${m.name}</div><div class="desc">${m.desc}</div></div><div class="go">Escolher ▶</div>`;
      el.addEventListener("pointermove", (e) => {      // inclina para o lado do rato
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--rx", `${-y * 10}deg`); el.style.setProperty("--ry", `${x * 12}deg`);
      });
      el.addEventListener("pointerleave", () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
    }
    el.addEventListener("click", () => showSetup(m));                             // escolher o mapa leva às configurações da partida
    grid.appendChild(el);
  }
}


// Página das configurações: o mapa escolhido em cima (com a imagem) e as opções da partida por baixo
let chosenMap = null;
function showSetup(m) {
  chosenMap = m;
  const box = $("setupMap");
  box.style.setProperty("--c1", m.c1); box.style.setProperty("--c2", m.c2);
  box.innerHTML = (m.id === "random" ? `<div class="big">${m.icon}</div>` : `<div class="shot" style="background-image:url(assets/previews/${m.id}.jpg)"></div>`) +
    `<div class="info"><div class="name">${m.icon} ${m.name}</div><div class="desc">${m.desc}</div></div>`;
  box.style.animation = "none"; void box.offsetWidth; box.style.animation = "";
  showScreen("setup");
}
$("setupBack").addEventListener("click", () => showScreen("select"));
$("setupPlay").addEventListener("click", () => {
  if (!chosenMap) return;
  startMap(chosenMap.id === "random" ? MAPS[Math.floor(Math.random() * MAPS.length)] : chosenMap);
});

function addLoot(key, amount = 1) {
  state.loot[key] += amount;
  const row = $("loot-" + key.replace(":", "-"));
  row.querySelector(".qty").textContent = state.loot[key];
  row.classList.remove("flash"); void row.offsetWidth; row.classList.add("flash");
}
// Munição = tanques reais (um por cor primária). Cada caixa apanhada enche o tanque dessa cor.
// balas de uma caixa: normal = 15 (Pinta e Conquista = 40); na morte súbita é à sorte de 1 a 5
const boxShots = () => { if (!state.round?.sudden) return MODES[state.mode]?.ammoBox || CONFIG.ammoBox.shots; const [lo, hi] = CONFIG.suddenDeath.shots; return lo + Math.floor(Math.random() * (hi - lo + 1)); };
function addAmmo(colorId, shots) {
  state.ammo[colorId] = Math.min(CONFIG.ammo.max, state.ammo[colorId] + shots);
  const row = $("loot-ammo-" + colorId);
  if (row) { row.classList.remove("flash"); void row.offsetWidth; row.classList.add("flash"); }
}






// F: gasta uma Invisibilidade guardada e fica invisível durante `duration` segundos
function useInvisibility() {
  if (state.dead || state.invisible > 0 || !state.loot.invisible) return;
  addLoot("invisible", -1); Stats.current.used.invisible++;
  state.invisible = CONFIG.rewards.find((x) => x.id === "invisible").duration;
  Sfx.play("invis");
  showToast(`👻 Invisível durante ${state.invisible} s!`, "#9be7ff");
}

// Invisibilidade: durante a duração o boneco é um fantasma; fica um contador por baixo da lista de itens.
// `state.invisible` (> 0) é o que os bots vão consultar mais tarde para não verem o jogador.
function updateInvisibility(dt) {
  const fx = $("effects");
  if (state.invisible > 0) {
    state.invisible = Math.max(0, state.invisible - dt);
    setDummyGhost(dummy, state.invisible > 0);
  } else setDummyGhost(dummy, false);
  if (state.radarT > 0) state.radarT = Math.max(0, state.radarT - dt);
  const me = state.me, pl = me && me.puddleMul !== 1 && state.world ? Math.max(0, me.puddleUntil - state.world.t) : 0;   // efeito da poça
  const txt = [state.invisible > 0 ? `👻 ${state.invisible.toFixed(1)} s` : "", state.radarT > 0 ? `📡 ${state.radarT.toFixed(1)} s` : "",
               state.cannon ? `💥 ${state.cannon.left().toFixed(1)} s` : "", me && state.features?.carrying(me) ? "🥫 Leva a lata para a tua base!" : "",
               pl > 0 ? `${me.puddleMul > 1 ? "⚡" : "🐌"} ${pl.toFixed(1)} s` : "", me?.streak >= 2 ? `🔥 ×${me.streak}` : ""].filter(Boolean).join("   ");
  if (fx.textContent !== txt) fx.textContent = txt;
}

// Efeito do clima no jogo (ver `play` em weather.js): duração da tinta e das poças, alcance dos tiros e visão dos bots
function applyWeatherPlay(announce) {
  const w = WEATHERS[state.weatherId], P = w.play;
  const life = state.features?.paintLife ? state.features.paintLife / CONFIG.paint.lifeSeconds : P.paintLife;   // mapa com território: a tinta seca sempre em 10 s (o clima não muda)
  if (state.world) Object.assign(state.world, { rangeMul: P.range, sightMul: P.sight, paintLifeMul: life });
  if (state.paint) state.paint.lifeMul = life;
  if (announce) showToast(`${w.icon} ${w.name}${P.desc ? ": " + P.desc : ""}`, "#9be7ff");
  Sfx.ambient({ rain: w.rain, wind: w.wind });                                         // chuva e vento em fundo
}

// tique-taque nos últimos 10 s do round e alarme quando começa a morte súbita
function roundSounds(st) {
  const r = st.round;
  if (!r || st.tutorial) return;
  if (r.sudden !== !!st.suddenSnd) { st.suddenSnd = r.sudden; if (r.sudden) Sfx.play("alarm"); }
  const s = Math.ceil(st.roundTime);
  if (s > 10) st.tickSnd = 0;
  if (!r.sudden && st.countdown <= 0 && s > 0 && s <= 10 && s !== st.tickSnd) { st.tickSnd = s; Sfx.play(s <= 3 ? "tick2" : "tick"); }
  updateLastSeconds();                                                               // 5, 4, 3, 2, 1 em grande
}

/* ============================================================
   13. CARREGAR / DESCARREGAR MAPAS
   ============================================================ */
function unloadMap() {
  const m = state.map;
  if (!m) return;
  if (state.replaying) { replay.onDone = null; replay.skip(); state.replaying = false; $("replayBox").style.display = "none"; }
  clearGoldenBeams();
  trails.clear();
  if (state.features) { state.features.dispose(); state.features = null; }
  state.cannon = null;
  showCountdown(""); state.countdown = 0; state.goT = 0;
  if (state.pickups) { state.pickups.dispose(); state.pickups = null; }
  if (state.weather) { state.weather.dispose(); state.weather = null; }
  if (state.paint) { state.paint.dispose(); state.paint = null; }
  scene.remove(m.group);
  for (const l of m.lights) if (l.dispose) l.dispose();
  for (const d of m.disposables) d.dispose();
  scene.remove(dummy);
  clearBots();
  net.stop();
  if (state.world) { state.world.dispose(); state.world = null; }
  if (state.aimRing) { scene.remove(state.aimRing); state.aimRing.geometry.dispose(); state.aimRing.material.dispose(); state.aimRing = null; }
  state.map = null;
}

async function startMap(def, keepMatch = false) {
  if (state.starting) return;
  state.starting = true;
  hideBanner(); hidePodium();
  state.tutorialMode = state.startTutorial; state.startTutorial = false;
  state.tutorial = null; document.body.classList.toggle("tut", state.tutorialMode);
  $("pauseMapsBtn").innerHTML = state.tutorialMode ? "<i>&#10005;</i>Sair do tutorial" : "<i>&#10005;</i>Sair da partida";
  const kept = keepMatch ? { loot: { ...state.loot } } : null;         // próximo round: o jogo continua (rounds, melhorias e itens ficam)
  if (!kept) state.mode = state.tutorialMode ? "normal" : CONFIG.mode;  // o modo fica igual até ao fim do jogo (o tutorial é sempre normal)
  // partida com amigos: o anfitrião decide quem joga em que lugar; o convidado recebe-o na mensagem de início (state.netStart)
  const ns = state.netStart; state.netStart = null;
  state.online = online.inRoom && !state.tutorialMode && (online.isHost || !!ns);
  state.net = state.online ? (online.isHost ? "host" : "guest") : null;
  if (state.net === "host" && !kept) state.netPlayers = online.players.map((p) => ({ peer: p.id, team: p.team, slot: p.slot, name: p.name, skin: charById(p.skin).id, equip: p.equip, title: String(p.title || "").slice(0, 24) }));
  if (state.net === "guest") state.netPlayers = ns.players;
  const mine = state.net === "guest" ? state.netPlayers.find((p) => p.peer === online.myId) : null;
  state.myIndex = mine ? mine.slot : 0; state.netFlip = mine?.team === "B";             // na equipa B do anfitrião: vê tudo trocado (a equipa dele é sempre a "A")
  if (!kept) {                                                                          // partida nova: skins e nomes dos bots sorteados de novo
    if (state.net === "guest") state.rosters = netRosters(ns.rosters);
    else {
      state.rosters = buildRosters(state.characterId); state.rosters.extra = botExtras();
      if (state.net === "host") for (const p of state.netPlayers) if (p.peer !== online.myId) { state.rosters[p.team][p.slot] = p.skin; state.rosters.names[p.team][p.slot] = p.name; }
    }
    labelPips(); refreshPips();
  }
  state.heat = [];                                                                     // eliminações deste round (mapa de calor)
  COLOR_RULES.triple = state.mode === "paleta"; state.secret = state.mode === "secreto"; state.clues = {};
  resetMixes(); state.mixT = MODES[state.mode]?.shuffleEvery || 0; state.mixWarned = false; renderMixTable();   // Mistura Relâmpago: cada round começa com as misturas de sempre
  lockMouse();                                            // tem de ser já, dentro do clique do utilizador
  unloadMap();
  let map;
  if (def.load) {                                          // mapa feito no Blender (carregamento assíncrono)
    // ecrã de carregamento: capa do mapa, nome e uma dica (só aparece se demorar mais de 150 ms: o mapa seguinte já vem carregado)
    $("loading").innerHTML = `<div class="ldCard"><div class="ldShot" style="background-image:url(assets/previews/${def.id}.jpg)"></div>
      <b class="ldName">${def.icon} ${def.name}</b><i class="ldBar"><u></u></i><small class="ldTip">💡 ${randomTip()}</small></div>`;
    const ldTimer = setTimeout(() => { $("loading").style.display = "flex"; }, 150);
    try { map = await def.load(); }
    catch (err) { console.warn("Mapa do Blender indisponível; a usar a versão em código.", err); map = def.build(); }
    clearTimeout(ldTimer); $("loading").style.display = "none";
  } else map = def.build();
  state.starting = false;
  state.map = map; state.def = def;
  instanceChests(map.chests, map.group, map.disposables);                              // todos os baús desenhados de uma vez (5 chamadas em vez de ~36)
  scene.background = new THREE.Color(map.background);
  scene.fog = new THREE.Fog(map.background, 150, 420);
  scene.add(map.group);
  scene.add(dummy);
  state.pickups = new PickupManager(map.group);
  state.colors = new ColorSelector({ mixSeconds: CONFIG.mixSeconds });
  state.invisible = 0; state.radarT = 0; setDummyGhost(dummy, false);
  $("crosshair").style.display = CONFIG.ui.crosshair ? "" : "none";            // (a mira é escondida pelo atributo data-mode, não por aqui)
  state.paint = new PaintLayer(map.group, map.colliders);
  state.paint.uploadMs = QUALITY[state.quality].paintMs;
  patchPaintMaterial(state.paint.material, map.look);                           // a tinta do chão também apanha a sombra cozida
  $("feed").innerHTML = ""; $("killfeed").innerHTML = "";
  // o mapa começa sem tinta; a tinta desaparece 15 s depois de cair (ver paint-layer.js)
  state.weather = new WeatherSystem(map, scene);
  state.weatherId = state.forceWeather || (state.weatherChoice === "random" ? WEATHER_IDS[Math.floor(Math.random() * WEATHER_IDS.length)] : state.weatherChoice);   // (online: o anfitrião decide)
  state.forceWeather = null;
  state.weather.setMode(state.weatherId, true);
  applyQuality(state.quality);
  bakeMinimap(map, [dummy]);
  state.grace = 4; state.lowFpsTime = 0;
  buildLootPanel();
  if (kept) for (const [k, v] of Object.entries(kept.loot)) if (v > 0 && k in state.loot) addLoot(k, v);

  if (state.netFlip) map.spawns = { A: map.spawns.B, B: map.spawns.A };                // a tua base é a "A" (as posições no mapa são as mesmas)
  const sp = map.spawns.A[spawnIndex("A", state.myIndex)];
  state.player.pos.set(sp.x, 0, sp.z);
  state.player.motion = createMotionState(); state.player.facing = sp.ry;
  await spawnBots(map);
  setupCombat(map);
  if (state.net === "host") {                                                          // avisa os amigos: entram no mesmo mapa, com as mesmas regras
    net.setupHost(state.world);
    const names = { A: [...state.rosters.names.A], B: [...state.rosters.names.B] };
    names.A[0] = online.me?.name || "Anfitrião";
    online.broadcast({ t: "start", map: def.id, kept: !!kept, n: state.round?.n || 1, mode: state.mode, weather: state.weatherId, minutes: Math.round(CONFIG.roundSeconds / 60), toWin: CONFIG.match.toWin, diff: CONFIG.botDifficulty,
      rosters: { A: state.rosters.A, B: state.rosters.B, names, extra: state.rosters.extra }, players: state.netPlayers });
    online.setPlaying(true);
  } else if (state.net === "guest") net.setupGuest(state.world, state.netFlip);
  state.netWait = !!state.net; state.netWaitT = 0; state.netReady = new Set();            // a contagem só começa quando todos tiverem o mapa carregado
  const flipT = (t) => (state.netFlip ? (t === "A" ? "B" : "A") : t);
  state.features = state.tutorialMode ? null : setupMapFeatures(def.id, state.mode, {   // fontes de tinta, pontes... (alguns mapas) e a lata / as zonas (modos Rouba-Latas e Pinta e Conquista)
    scene, world: state.world, map, colliders: map.colliders, playerPos: () => state.player.pos, toast: showToast, paint: () => state.paint,
    sfx: (k, x, z) => (x === undefined ? Sfx.play(k) : Sfx.at(k, x, z)),                // sons (sfx.js): sem posição = só para ti
    mine: (what) => achieve(what),                                                      // mine("can"): entregaste uma lata (conquistas)
    online: state.online, mirror: state.net === "guest", flip: state.netFlip, T: flipT,     // com amigos: o anfitrião decide, os convidados mostram (ver map-features.js)
    byId: (id) => (id ? state.world?.combatants.find((c) => c.id === flipT(id[0]) + id.slice(1)) : null),
    emit: state.net === "host" ? (ev) => online.broadcast({ t: "ft", ev }) : null,
    request: (msg) => online.send({ t: "cn", ...msg }),                                  // convidado → anfitrião (canhão: subir, disparar, sair)
    onScore: (team, n, msg) => {                                                        // pontos do mapa (lata, território): somam às eliminações do round
      if (state.over || state.tutorial || state.intermission > 0) return;
      state.round.kills[team] += n; updateScoreUi();
      showToast(msg, team === "A" ? "#4da8ff" : "#ff4455");
      if (state.round.sudden) endRound(team);
    },
    onColor: (c, col) => state.world.cb.onColorChange?.(c, col, "fountain"),
    onCannon: (cn, c, on) => {
      if (c.isPlayer) {
        state.cannon = on ? cn : null;
        if (on) Sfx.play("cannonUp");
        if (on) showToast(`💥 Canhão de tinta: ${CONFIG.cannon.use} s! Clica para lançar bolas gigantes da cor da mão (E para sair)`, "#ff8a1f");
        else showToast(`💥 Saíste do canhão (recarrega ${CONFIG.cannon.cooldown} s)`, "#ffd21f");
      } else if (on && c.team === "B" && Math.hypot(cn.x - state.player.pos.x, cn.z - state.player.pos.z) < CONFIG.cannon.range + 5) showToast(`💥 ${nameOf(c)} subiu para o canhão de tinta! Cuidado!`, "#ff4455");
    },
  });
  applyWeatherPlay(false);                                                             // (depois das surpresas do mapa: na Escola a tinta seca mais depressa)
  state.goldenDone = false;
  state.countdown = state.tutorialMode ? 0 : CONFIG.countdown; state.goT = 0;
  state.cam.ready = false;
  state.cam.yaw = state.online ? sp.ry + Math.PI : -Math.PI / 2; state.cam.pitch = 0.2; state.cam.dist = 8; state.cam.aerial = false;   // a câmara começa atrás do boneco
  state.roundTime = CONFIG.roundSeconds; state.opened = 0; state.empty = 0;
  if (kept) {
    state.intermission = 0; state.upgradeChoices = null; state.intenseT = CONFIG.match.intenseEvery;
    applyUpgrades(); resetPips();
    const s0 = CONFIG.ammo.start; state.ammo = { vermelho: s0, azul: s0, amarelo: s0 };
    if (state.upg.grenade) addLoot("grenade", FX().grenadePerRound);
    updateScoreUi();
    showToast(`🏁 Round ${state.round.n} — ${def.name}`, "#ffd21f");
    flushUpgradeFeed();
  } else {
    newMatch();
    if (state.mode !== "normal") showToast(`${MODES[state.mode].icon} ${MODES[state.mode].name}: ${MODES[state.mode].desc}`, "#ffd21f");
  }
  const wp = WEATHERS[state.weatherId].play;
  if (wp.desc && !state.tutorialMode) showToast(`${WEATHERS[state.weatherId].icon} ${WEATHERS[state.weatherId].name}: ${wp.desc}`, "#9be7ff");
  if (state.tutorialMode) startTutorialWorld();
  $("prompt").style.display = "none";
  keys.clear();
  lastTime = performance.now();
  showScreen("viewer");
  setPaused(document.pointerLockElement !== canvas);       // se o rato não ficou preso, mostra a pausa com "Continuar"
  if (state.net === "guest") online.send({ t: "ready" });
  if (state.net) { showCountdown("⏳", "#ffffff"); showToast("⏳ À espera que todos carreguem o mapa…", "#9be7ff"); netCheckReady(); }
}

function leaveViewer() {
  resetMixes(); renderMixTable(); hideBanner(); hidePodium(); Sfx.ambient(); dmgNums.clear();
  state.tutorial = null; state.tutorialMode = false; document.body.classList.remove("tut");
  if (document.pointerLockElement) document.exitPointerLock();
  if (state.net === "host") { online.broadcast({ t: "end" }); online.setPlaying(false); }   // o anfitrião saiu: os amigos voltam ao lobby
  const guest = state.net === "guest";
  if (guest) online.send({ t: "away" });
  unloadMap();
  state.online = false; state.net = null; state.netWait = false;
  if (state.soloOpts) { CONFIG.mode = state.soloOpts.mode; CONFIG.roundSeconds = state.soloOpts.secs; CONFIG.botDifficulty = state.soloOpts.diff; setMatchOptions({ toWin: state.soloOpts.toWin }); state.soloOpts = null; }
  $("pause").style.display = "none"; document.body.classList.remove("overlay");
  showScreen(guest ? "lobby" : "select");
}

// ---------- ROUNDS E PLACAR ----------
// Cada round dura 3 min; vence o round a equipa com mais eliminações. Empate = morte súbita (a próxima eliminação decide).
// Vence o jogo a primeira equipa a ganhar 5 rounds (máx. 9 rounds).
function newMatch() {
  state.xpDone = false;
  state.upg = {}; state.botUpg = {}; state.upgradeChoices = null; state.tracked = []; state.gameStats = {}; applyUpgrades(); Stats.startMatch(CONFIG.botDifficulty);
  state.round = { n: 1, kills: { A: 0, B: 0 }, wins: { A: 0, B: 0 }, sudden: false };
  state.intermission = 0; state.over = false;
  $("roundBox").style.display = "none"; $("gameOver").style.display = "none";
  updateScoreUi();
}
const FX = () => fx(state.upg);
// bónus da cor certa: devolve balas da cor usada (primária +3; secundária +2 de cada ingrediente)
function refundAmmo(colorId) {
  const R = CONFIG.killRefund, ing = ingredients(colorId), n = ing.length === 1 ? R.primary : R.secondaryEach;
  for (const id of ing) addAmmo(id, n);
  showToast(`🎯 Cor certa! +${n} ${n === 1 ? "bala" : "balas"} ${ing.length === 1 ? COLORS[ing[0]].name : "de cada cor"}`, "#2fd15a");
}

// Melhoria "Rastreador": adversários seguidos no minimapa (índices da equipa B); mudam à sorte sempre que o jogador morre
function pickTracked(n) {
  const idx = [0, 1, 2, 3, 4];
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, Math.min(5, n));
}
function rerollTracked() {
  const n = FX().tracked;
  if (!n) return;
  state.tracked = pickTracked(n);
  showToast(`📍 Rastreador: a seguir ${state.tracked.map((i) => personName("B", i)).join(", ")}`, "#9be7ff");
}
function applyUpgrades() {
  const f = FX();
  if (state.tracked.length !== Math.min(5, f.tracked)) state.tracked = pickTracked(f.tracked);
  if (state.me) { state.me.maxHp = f.maxHp; state.me.pierce = f.pierce; state.me.damageMul = f.damageMul; state.me.grenadeMul = f.grenadeMul; state.me.hp = Math.min(state.me.hp, f.maxHp); }
  if (state.net === "guest") sendUpgrades(false);
  if (state.aimRing) state.aimRing.scale.setScalar(f.grenadeMul);
}
// No fim de cada round todos os bots (aliados e adversários) ganham também uma melhoria à sorte
const BOT_UPGRADES = ["rate", "speed", "hp", "pierce", "damage"];
function grantBotUpgrades(teams = ["A", "B"]) {
  if (state.net === "guest") return;                                                 // (os bots são do anfitrião)
  for (const team of teams) {
    const preset = BOT_PRESETS[CONFIG.botDifficulty];                               // colegas e adversários: o mesmo nível
    if (state.round.n % preset.upgradeEvery !== 0) continue;               // no fácil só recebem de 2 em 2 rounds
    for (let i = 0; i < 5; i++) {
      if (team === "A" && i === 0) continue;
      if (state.bots.find((b) => b.id === team + i)?.puppet) continue;                // um amigo escolhe a melhoria dele
      const lv = state.botUpg[team + i] ||= {};
      let pool = BOT_UPGRADES.filter((id) => !(id === "damage" && lv.damage));
      if (preset.smart >= 3) {                                             // impossível: escolhe sempre a melhor
        const best = ["damage", "rate", "pierce", "hp", "speed"].find((id) => pool.includes(id) && (id !== "rate" || (lv.rate || 0) < 3) && (id !== "pierce" || (lv.pierce || 0) < 1));
        if (best) pool = [best];
      } else if (preset.smart >= 2) pool = pool.filter((id) => id !== "speed");
      const id = pool[Math.floor(Math.random() * pool.length)];
      lv[id] = (lv[id] || 0) + 1;
      state.feedQueue.push({ team, index: i, id });
    }
  }
  showToast(teams.length === 1 && teams[0] === "A" ? "🤖 Os teus colegas também ganharam melhorias!" : "🤖 Os adversários ganharam melhorias!", "#ffd21f");
}
// Mensagens das melhorias escolhidas: aparecem no lado direito, por baixo das eliminações, quando o round seguinte começa
function flushUpgradeFeed() {
  const feed = $("killfeed");
  for (const q of state.feedQueue.splice(0)) {
    const u = UPGRADES.find((x) => x.id === q.id);
    const color = hex6(TEAM[q.team].color), url = portraitUrl(state.rosters[q.team][q.index], TEAM[q.team].color);
    const row = document.createElement("div");
    row.className = "killRow ok upRow";
    row.innerHTML = `<div class="kfIcons"><span class="kfFace" style="--c:${color}">${url ? `<img src="${url}" alt="">` : ""}</span><span class="upIconSm">${u.icon}</span></div>
      <div class="kfText"><b>${q.index === state.myIndex && q.team === "A" ? "Tu" : personName(q.team, q.index)}</b> ganhou<small>${u.name}</small></div>`;
    feed.appendChild(row);
    setTimeout(() => row.classList.add("out"), 6500);
    setTimeout(() => row.remove(), 7000);
  }
}
function showUpgradeChoices() {
  state.upgradeChoices = offerUpgrades(state.upg);
  $("upgradeCards").innerHTML = state.upgradeChoices.map((u, i) => `<div class="upCard" data-i="${i}"><kbd>${i + 1}</kbd><span class="upIcon">${u.icon}</span><b>${u.name}</b><small>${u.desc}${state.upg[u.id] ? ` (nível ${state.upg[u.id] + 1})` : ""}</small></div>`).join("");
  $("upgradeHint").style.display = "block";
  $("crosshair").dataset.mode = "none";                                              // sem mira por cima do menu
  if (document.pointerLockElement) document.exitPointerLock();                       // aparece o rato para escolheres com o clique (ou com as teclas 1, 2, 3)
}
$("upgradeCards").addEventListener("click", (e) => { const c = e.target.closest(".upCard"); if (c) chooseUpgrade(Number(c.dataset.i)); });
// ganhaste o round: escolher a melhoria (clique ou 1/2/3) já começa o round seguinte (não há botão "Começar round")
function chooseUpgrade(i) {
  if (!state.upgradeChoices?.[i]) return;
  pickUpgrade(i);
  requestNextRound();
}
function pickUpgrade(i) {
  const u = state.upgradeChoices && state.upgradeChoices[i];
  if (!u) return;
  state.upg[u.id] = (state.upg[u.id] || 0) + 1;
  state.feedQueue.push({ team: "A", index: state.myIndex, id: u.id });
  state.upgradeChoices = null;
  $("upgradeCards").innerHTML = ""; $("upgradeHint").style.display = "none";
  applyUpgrades();
  if (u.id === "hp" && state.me) state.me.hp = state.me.maxHp;
  if (state.net === "guest") sendUpgrades(u.id === "hp");
  if (u.id === "grenade") addLoot("grenade", 2);
  showToast(`${u.icon} Melhoria: ${u.name}`, "#ffd21f");
  updateNextBtn();
}
function endRound(winner, fromHost = false) {
  if (state.net === "guest" && !fromHost) return;                                   // com amigos, quem acaba o round é o anfitrião
  setAds(false);
  const r = state.round;
  if (state.intermission > 0 || state.over) return;
  if (state.net === "host") online.broadcast({ t: "end", w: winner });
  r.wins[winner]++;
  Stats.recordRound(winner === "A", r.n, state.def?.id);
  if (winner === "A") achieve("roundWon", { map: state.def?.id, weather: state.weatherId, diff: Stats.current.diff });   // (mapas e climas das conquistas)
  addRoundToGameStats();
  r.sudden = false;
  updateScoreUi();
  const decided = r.wins[winner] >= CONFIG.match.toWin || r.n >= CONFIG.match.maxRounds;
  state.firing = false; cancelGrenadeAim();
  state.intermission = decided ? 0 : Infinity;                                        // (antes de soltar o rato: assim não abre a pausa)
  if (document.pointerLockElement) document.exitPointerLock();                       // o round acabou: o rato fica solto (repetição, estatísticas, botões)
  if (decided) {
    state.over = true;
    const fin = r.wins.A === r.wins.B ? null : r.wins.A > r.wins.B ? "A" : "B";
    Stats.recordGame(fin, state.characterId, { score: [r.wins.A, r.wins.B], mode: state.mode, online: !!state.online });
    roundEndShow(winner, true, () => showGameOver(fin));
    return;
  }
  state.intermission = Infinity;                                                      // entre rounds: tudo parado até alguém carregar em "Começar round"
  roundEndShow(winner, false, () => showRoundBox(winner));
}
// Fim do round: letreiro "REPLAY" → repetição da melhor jogada → "FIM DO ROUND" (1,5 s) → estatísticas e botão "Começar round" (ou o ecrã final do jogo)
const END_BANNER_SECS = 1.5;
let bannerTimer = 0;
function roundEndShow(winner, decided, next) {
  const r = state.round;
  withReplay(() => (Sfx.play(winner === "A" ? "win" : "lose"), showBanner("end", decided ? "FIM DO JOGO" : `FIM DO ROUND ${r.n}`, `${TEAM[winner].name} venceu o round · ${r.wins.A} – ${r.wins.B}`, hex6(TEAM[winner].color), END_BANNER_SECS, next)));
}
// faixa na diagonal que entra, fica `secs` segundos e sai; depois chama next()
function showBanner(kind, title, sub, color, secs, next) {
  const el = $("endBanner");
  clearTimeout(bannerTimer);
  el.style.display = "none"; void el.offsetWidth;                                     // (recomeça a animação de entrada)
  el.className = kind; el.style.setProperty("--c", color);
  $("ebTitle").textContent = title; $("ebSub").textContent = sub;
  el.style.display = "block";
  Sfx.play("whoosh");
  bannerTimer = setTimeout(() => { el.classList.add("out"); bannerTimer = setTimeout(() => { el.style.display = "none"; next?.(); }, 350); }, secs * 1000);
}
function hideBanner() { clearTimeout(bannerTimer); $("endBanner").style.display = "none"; }
function showRoundBox(winner) {
  const r = state.round, box = $("roundBox");
  if (document.pointerLockElement) document.exitPointerLock();                       // aparece o rato para clicar em "Começar round" (e na melhoria)
  box.style.setProperty("--c", hex6(TEAM[winner].color));
  $("roundTitle").textContent = `${TEAM[winner].name} venceu o round ${r.n}!`;
  $("roundScore").textContent = `Eliminações: ${r.kills.A} – ${r.kills.B}   ·   Rounds: ${r.wins.A} – ${r.wins.B}`;
  state.lastHeat = heatmapURL();
  $("roundStats").innerHTML = roundStatsHTML() + heatHTML(state.lastHeat, true);
  box.style.display = "flex";
  // só a equipa que ganhou o round recebe melhoria: tu escolhes (1 de 3) se ganhaste; senão só os bots vencedores a recebem
  preloadNextMap();
  grantBotUpgrades([winner]);
  if (winner === "A") showUpgradeChoices();
  else { $("upgradeCards").innerHTML = ""; $("upgradeHint").style.display = "none"; showToast("🤖 Só a equipa vencedora ganha melhorias", "#ffd21f"); }
  updateNextBtn();
}
// ---------- REPETIÇÃO DA MELHOR JOGADA (ver replay.js): passa antes do ecrã do round / do fim do jogo ----------
const replay = new Replay({ camera });                                               // grava também a tua câmara: a repetição vê-se como a viste
function withReplay(next) {
  if (state.tutorial || state.online || !replay.has(state.gameTime)) { next(); return; }   // (com amigos não há repetição: todos seguem ao mesmo tempo)
  const n = replay.kills;
  $("replayTitle").textContent = n > 1 ? `🎬 Melhor jogada · ${n} eliminações seguidas!` : "🎬 Melhor jogada";
  const dmg = replay.damage;
  if (n === 0 && dmg) $("replayTitle").textContent = `🎬 Melhor jogada · ${dmg} de dano`;
  showBanner("replay", "REPLAY", "A melhor jogada do round", "#ffd21f", 1.3, () => {
    state.replaying = true; $("replayBox").style.display = "block";
    replay.play(camera, () => { state.replaying = false; $("replayBox").style.display = "none"; next(); });
  });
}
window.addEventListener("keydown", (e) => {                                          // Espaço, Enter ou Esc saltam a repetição
  if (!state.replaying || !["Space", "Enter", "Escape"].includes(e.code)) return;
  e.preventDefault(); e.stopImmediatePropagation(); replay.skip();
}, true);
$("replayBox").addEventListener("click", () => replay.skip());
// Próximo round: quando alguém escolhe a melhoria (ganhou) ou carrega no botão "Começar round" (perdeu)
// botão "Começar round": só para quem perdeu o round (quem ganhou começa-o ao escolher a melhoria)
function updateNextBtn() {
  const win = !!state.upgradeChoices;
  $("roundNext").style.display = win ? "none" : "";
  $("roundNextHint").textContent = win ? "" : state.online ? "Começa o round para todos" : "";
}
function requestNextRound() {
  if (!(state.intermission > 0) || state.over || $("roundBox").style.display !== "flex") return;
  if (state.upgradeChoices) { showToast("⬆️ Escolhe primeiro uma melhoria (1, 2 ou 3)", "#ffd21f"); return; }
  if (state.net === "guest") online.send({ t: "next" });                              // com amigos quem começa o round é o anfitrião
  else startNextRound();
}
$("roundNext").addEventListener("click", requestNextRound);
// o mapa do round seguinte é escolhido já e carrega enquanto vês as estatísticas (o clique em "Começar round" fica instantâneo)
function preloadNextMap() {
  if (state.net === "guest") return;                                                  // (com amigos quem escolhe é o anfitrião: avisa os convidados)
  const others = MAPS.filter((m) => m.id !== state.def.id);
  state.nextMap = others[Math.floor(Math.random() * others.length)];
  state.nextMap.load?.preload?.();
  if (state.net === "host") online.broadcast({ t: "pre", map: state.nextMap.id });
}
function startNextRound() {
  if (state.upgradeChoices) pickUpgrade(Math.floor(Math.random() * state.upgradeChoices.length));   // (com amigos: alguém começou antes de escolheres)
  $("roundBox").style.display = "none";
  state.round.n++; state.round.kills = { A: 0, B: 0 }; state.round.sudden = false;
  // a cada round o mapa muda (à sorte, diferente do anterior; já carregado por preloadNextMap); só o primeiro é escolhido
  const others = MAPS.filter((m) => m.id !== state.def.id), next = state.nextMap || others[Math.floor(Math.random() * others.length)];
  state.nextMap = null;
  startMap(next, true);
}



// XP da partida (uma vez por jogo; o tutorial não conta): soma ao total guardado e devolve o resumo para o ecrã final
function grantMatchXP(final) {
  if (state.xpDone || state.tutorialMode) return state.lastXP || null;
  state.xpDone = true;
  const c = Stats.current, m = Progress.matchXP({ kills: c.kills, killsSame: c.killsSame, roundsWon: c.rows.filter((x) => x.won).length, won: final === "A", diff: c.diff });
  const won = final === "A", coins = Progress.matchCoins({ kills: c.kills, killsSame: c.killsSame, won, diff: c.diff, streak: Stats.winStreak() });   // (a série já conta com esta vitória)
  state.lastXP = { ...m, ...Progress.addXP(m.total), match: coins };
  state.lastXP.mis = Missions.endMatch({ won, deaths: c.deaths, kills: c.kills, diff: c.diff, mode: state.mode, online: state.online });
  state.lastXP.ach = Ach.endMatch({ won, deaths: c.deaths, kills: c.kills, roundsLost: c.rows.filter((x) => !x.won).length, diff: c.diff, mode: state.mode, online: state.online });   // (depois do XP: as de nível também contam)
  refreshLevelBadge();
  return state.lastXP;
}
// Nível no ecrã inicial
function refreshLevelBadge() {
  const el = $("levelBadge");
  if (el) el.innerHTML = xpBarHTML(Progress.levelInfo(), "mini");
  lobby?.renderTop();
}
refreshLevelBadge();

function showGameOver(final) {
  setAds(false);
  const xp = grantMatchXP(final);
  const r = state.round, won = final === "A";
  // VITÓRIA com uma cor de tinta em cada letra (as 6 cores) e DERROTA toda a vermelho
  const word = final === null ? "EMPATE!" : won ? "VITÓRIA!" : "DERROTA", rainbow = ["#ff3b4a", "#ffd21f", "#47e06a", "#2f7bff", "#a447ff", "#ff8a1f"];
  $("goTitle").className = won ? "win" : "lose";
  $("goTitle").innerHTML = [...word].map((ch, i) => `<span style="--c:${won ? rainbow[i % 6] : "#ff3b4a"};--d:${i * 0.08}s">${ch}</span>`).join("");
  const ws = state.tutorialMode ? 0 : Stats.winStreak(), streakTxt = state.tutorialMode ? "" : won ? `   ·   🔥 ${ws} ${ws === 1 ? "vitória seguida" : "vitórias seguidas"}!` : "   ·   série de vitórias perdida";
  $("goSub").textContent = `${TEAM.A.name} ${r.wins.A} – ${r.wins.B} ${TEAM.B.name}` + streakTxt + (xp ? `   ·   ⭐ +${xp.total} XP · 🪙 +${xp.coins}${xp.gems ? ` · 💎 +${xp.gems}` : ""}${xp.after.level > xp.before.level ? ` · Nível ${xp.after.level}!` : ""}` : "");
  $("crosshair").dataset.mode = "none";
  $("summaryBody").innerHTML = summaryHTML(final);
  $("goStage1").style.display = "flex"; $("goStage2").style.display = "none";
  $("goAgain").style.display = state.net === "guest" ? "none" : "";                     // com amigos, só o anfitrião começa outra partida                // 1.º a faixa VITÓRIA/DERROTA; Esc ou o botão abrem o resumo
  $("gameOver").style.display = "flex";
  if (document.pointerLockElement) document.exitPointerLock();
  if (!state.tutorialMode && final) showPodium(final);                                // (empate: sem pódio)
}
// ---------- PÓDIO (victory-podium.js): quem ganhou (a tua equipa ou a adversária) sobe ao pódio por ordem de eliminações ----------
async function showPodium(final) {
  const team = final || "A", over = state.round;
  const list = (state.world?.combatants || []).filter((c) => c.team === team).map((c) => {
    const canon = state.netFlip ? (team === "A" ? "B" : "A") : team;
    const human = !c.isPlayer && state.net ? state.netPlayers?.find((p) => p.team === canon && p.slot === c.index) : null;
    const equip = c.isPlayer ? Progress.wallet.equip : human ? human.equip || {} : { arma: state.rosters?.extra?.[team]?.[c.index]?.arma || "arma_pistola" };
    return { c, kills: state.gameStats[c.id]?.kills || 0, equip, isPlayer: !!c.isPlayer, name: c.isPlayer ? playerName() : human?.name || personName(c.team, c.index),
             emote: c.isPlayer ? Progress.wallet.equip.emote || "emote_aceno" : human?.equip?.emote || null,
             charId: c.isPlayer ? state.characterId : c.characterId };
  }).sort((a, b) => b.kills - a.kills || b.isPlayer - a.isPlayer).slice(0, 5);
  const tpls = await Promise.all(list.map((e) => botTemplate(e.charId).catch(() => null)));
  if (state.round !== over || $("gameOver").style.display !== "flex") return;          // entretanto já começou outra partida
  const entries = list.map((e, i) => ({ ...e, tpl: tpls[i], paint: TEAM[team].color })).filter((e) => e.tpl);
  podium.show(entries, { teamColor: TEAM[team].color });
  $("gameOver").classList.toggle("podium", podium.active);
  document.body.classList.toggle("podium", podium.active);                          // esconde o placar de cima (o resultado já está por baixo do título)
}
function hidePodium() { podium.hide(); $("gameOver").classList.remove("podium"); document.body.classList.remove("podium"); }
function tickRound(dt) {
  if (state.tutorial) return;                                                     // no tutorial não há tempo nem rounds
  if (state.net === "guest") { state.roundTime = Math.max(0, state.roundTime - dt); return; }   // convidado: o relógio certo vem do anfitrião (é ele que acaba o round)
  const r = state.round;
  if (r.sudden) return;
  state.roundTime -= dt;
  if (state.roundTime > 0) return;
  state.roundTime = 0;
  if (r.kills.A !== r.kills.B) endRound(r.kills.A > r.kills.B ? "A" : "B");
  else { r.sudden = true; resetChests(state.map.chests); updateScoreUi(); showToast("⚡ MORTE SÚBITA: a próxima eliminação decide! Baús reabastecidos", "#ff3b4a"); }
}

function tickIntense(dt) {
  if (state.tutorial) return;
  if (!isIntense()) { if (state.intenseT !== CONFIG.match.intenseEvery) { state.intenseT = CONFIG.match.intenseEvery; updateScoreUi(); } return; }
  if (state.net === "guest") return;                                                 // (as cores novas chegam do anfitrião)
  state.intenseT -= dt;
  if (state.intenseT <= 0) {
    state.intenseT = CONFIG.match.intenseEvery;
    const all = paletteColors();
    for (const c of state.world.combatants) {
      if (!c.alive) continue;
      const opts = all.filter((x) => x !== c.colorId);
      c.colorId = opts[Math.floor(Math.random() * opts.length)];
      if (c.isPlayer) paintPlayer(c.colorId); else paintBot(c);
    }
    showToast("🔥 As cores mudaram!", "#ff8a1f");
    if (state.net === "host") online.broadcast({ t: "hot" });
  }
  updateScoreUi();
}

function tickMixShuffle(dt) {
  if (state.mode !== "relampago" || state.tutorial || !(state.mixT > 0)) return;
  state.mixT -= dt;
  const left = Math.max(0, Math.ceil(state.mixT)), txt = `${left} s`;
  if (txt !== state.mixTimerTxt && $("mixTimer")) { state.mixTimerTxt = txt; $("mixTimer").textContent = txt; $("mixTable").classList.toggle("soon", state.mixT <= 5); }
  if (!state.mixWarned && state.mixT <= 5) { state.mixWarned = true; showToast("⚡ Daqui a 5 s as misturas vão trocar!", "#ffd21f"); }
  if (state.mixT > 0) return;
  if (state.net === "guest") { state.mixT = 0.01; return; }                           // as receitas novas chegam do anfitrião
  shuffleMixes();
  if (state.net === "host") online.broadcast({ t: "mix", p: getMixes() });
  mixesChanged();
}
function mixesChanged() {
  state.mixT = MODES.relampago.shuffleEvery; state.mixWarned = false;
  state.shownColor = ""; state.targetKey = ""; state.mixHintKey = "";            // o HUD volta a desenhar as receitas novas
  renderMixTable();
  const box = $("mixTable"); box.classList.remove("flash"); void box.offsetWidth; box.classList.add("flash");
  showCountdown("TROCA!"); state.goT = 1.1;
  showToast("⚡ As misturas trocaram! " + SECONDARIES.map((id) => `${COLORS[COLORS[id].parts[0]].name} + ${COLORS[COLORS[id].parts[1]].name} = ${COLORS[id].name}`).join(" · "), "#ffd21f");
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
  if (!c || state.dead) return;                                                    // eliminado: não abre baús
  if (state.countdown > 0 || state.netWait) return;
  if (state.net === "guest") { online.send({ t: "chest", i: state.map.chests.indexOf(c) }); return; }   // com amigos, quem abre os baús é o PC do anfitrião
  chestResult(openChestFor(c));
}
// Abre o baú: os prémios saltam para o chão. Devolve o que saiu ({ golden, grenades } | { empty } | { id, n }) ou null se não abriu
function openChestFor(c) {
  const res = openChest(c, !!state.round?.sudden, state.mode);
  if (!res.ok) return null;
  if (res.reward?.id === "golden") return { golden: true, grenades: Math.random() < 0.5 };
  if (state.tutorial) res.reward = { ...CONFIG.rewards[0], drops: [2, 2] };                // no tutorial o baú dá sempre munição
  if (!res.reward) return { empty: true };
  const r = res.reward, [lo, hi] = r.drops;
  const n = lo + Math.floor(Math.random() * (hi - lo + 1));
  if (r.id === "ammo") {                                          // cada caixa tem uma cor à sorte (pode repetir ou ser tudo diferente)
    const colors = Array.from({ length: n }, () => PRIMARIES[Math.floor(Math.random() * PRIMARIES.length)]);
    state.pickups.spawn("ammo", n, c.x, c.z, colors, colors.map(boxShots));
  } else state.pickups.spawn(r.id, n, c.x, c.z);
  return { id: r.id, n };
}
// Mensagens para quem abriu o baú (no PC dele)
function chestResult(out) {
  if (!out) return;
  if (!state.tutorial) { Stats.current.chests++; achieve("chest"); }
  if (out.golden) { achieve("golden"); Sfx.play("golden"); goldenReward(state.me, out.grenades); return; }
  state.tutorial?.event("chest");
  Sfx.play(out.empty ? "chestEmpty" : "chest");
  if (out.empty) { state.empty++; showToast("💨 O baú estava vazio!", "#ff3b4a"); return; }
  const r = CONFIG.rewards.find((x) => x.id === out.id);
  state.opened++;
  if (r.id === "ammo") showToast(`${r.icon} ${out.n} ${out.n === 1 ? "caixa" : "caixas"} de munição — apanha!`, "#2fd15a");
  else showToast(`${r.icon} ${r.label} — apanha!`, "#2fd15a");
}

// Tab (mapa grande): tratado à parte e sempre com preventDefault, para o navegador nunca mudar o foco para os botões do menu
window.addEventListener("keydown", (e) => {
  if (e.code !== "Tab" || state.screen !== "viewer") return;
  e.preventDefault();
  if (state.paused || state.upgradeChoices) return;                            // dentro do menu não abre o mapa
  $("mmBox").classList.add("big");
}, true);
window.addEventListener("keyup", (e) => { if (e.code === "Tab") { e.preventDefault?.(); $("mmBox").classList.remove("big"); } }, true);
window.addEventListener("keydown", (e) => {
  if (state.screen !== "viewer") return;
  keys.add(e.code);
  if ((e.code === "ControlLeft" || e.code === "ControlRight") && !e.repeat && !state.dead && !state.paused && !state.cam.aerial) state.crouch = !state.crouch;   // Ctrl: carrega uma vez para agachar, outra para levantar
  if (e.code === "Space" || e.code.startsWith("Arrow") || e.ctrlKey) e.preventDefault();   // Ctrl = agachar: sem os atalhos do navegador (Ctrl+1/2/3, Ctrl+S...)
  if (e.repeat) return;
  if (state.upgradeChoices) { const k = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code]; if (k !== undefined && !state.paused) chooseUpgrade(k); return; }   // (na pausa não escolhe)
  if (state.tutorial && e.code === "KeyN") { state.tutorial.skip(); return; }               // N salta o passo do tutorial
  if (/^Digit[1-3]$/.test(e.code)) state.tutorial?.event("digit", e.code);
  if (e.code === "KeyX" && state.aimingGrenade && state.grenadeColor2) { state.grenadeSlot ^= 1; return; }
  if (e.code === "KeyE") {
    if (state.cannon) state.cannon.leave();                                      // E dentro do canhão: sai
    else { const cn = !state.dead && state.countdown <= 0 && state.features?.nearCannon?.(state.player.pos); if (cn) { if (!cn.mount(state.me)) showToast(`💥 O canhão está a recarregar (${Math.ceil(cn.readyAt - state.world.t)} s)`, "#ffd21f"); } else tryOpenChest(); }
  }
  else if (e.code === "KeyV") state.cam.aerial = !state.cam.aerial;
  else if (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3") state.colors.press(PRIMARIES[Number(e.code.slice(5)) - 1]);
  else if (e.code === "KeyF") useInvisibility();
  else if (e.code === "KeyT") useCure();
  else if (e.code === "KeyG") startGrenadeAim();
  else if (e.code === "KeyC") placeTrap();
  else if (e.code === "KeyZ") celebrate();
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);

  if (e.code === "KeyG") releaseGrenade();
  if (state.colors && (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3")) state.colors.release(PRIMARIES[Number(e.code.slice(5)) - 1]);
});
window.addEventListener("blur", () => {
  $("mmBox").classList.remove("big"); state.firing = false; keys.clear(); if (state.colors) state.colors.held = []; state.colors?.release(); });

// Rato: com o ponteiro preso (pointer lock) basta mexer o rato para rodar a câmara, sem clicar.
// Esc liberta o rato e abre a pausa; clicar em "Continuar" prende-o de novo.
const canvas = renderer.domElement;
const MOUSE_SENS = 0.0025;
const DEBUG = new URLSearchParams(location.search).has("debug");                 // modo de testes (window.__ca)
const MIN_PITCH = -1.25;               // abaixo de 0.08 a câmara fica baixa e inclina-se para cima (ver o céu e o clima)
const LOW_PITCH = 0.08;
const ADS_FOV = 48;
const CANNON_VIEW = { back: 5, up: 9 };   // mirar no canhão: a câmara fica 5 m atrás e 9 m acima do canhão                   // campo de visão em 1.ª pessoa (botão direito): ligeiro zoom
// Continuar: entre rounds (quadro das estatísticas / escolha da melhoria) o rato fica livre para clicar; no jogo volta a ficar preso
function resumeGame() { if (state.intermission > 0 || state.upgradeChoices || state.over) setPaused(false); else lockMouse(); }
function lockMouse() { document.activeElement?.blur?.(); canvas.requestPointerLock?.(); }       // tira o foco dos botões (senão o Espaço voltava a "clicar" neles)
function setPaused(p) {
  state.paused = p;
  document.body.classList.toggle("paused", p && state.screen === "viewer");
  if (p) setAds(false);
  if (p) { $("mmBox").classList.remove("big"); $("crosshair").dataset.mode = "none"; }       // na pausa não há mira
  $("deathBox").style.display = !p && state.dead && state.deathInfo ? "flex" : "none";       // "Foste eliminado!" some na pausa e volta ao continuar
  if (p) state.tutorial?.event("paused");
  if (p) { state.firing = false; cancelGrenadeAim(); keys.clear(); if (state.colors) { state.colors.held = []; state.colors.mix = null; } }
  $("pause").style.display = p && state.screen === "viewer" ? "flex" : "none";
  $("hudFps").style.display = p && state.screen === "viewer" ? "block" : "none";          // fps e chamadas só aparecem na pausa
  if (p && state.round && state.me && state.world) renderPausePanel();          // (a carregar o mapa seguinte ainda não há equipas para mostrar)
}
function renderPausePanel() {
  const r = state.round, w = state.world;
  $("ppMap").textContent = `${state.def?.name || ""} · Round ${r.n}`;
  $("ppMode").textContent = `${state.mode !== "normal" ? MODES[state.mode].name.toUpperCase() + " · " : ""}${Math.round(CONFIG.roundSeconds / 60)} MINUTOS · PRIMEIRO A ${CONFIG.match.toWin} ROUNDS · ${r.wins.A} – ${r.wins.B}`;
  const tt = Math.max(0, Math.ceil(state.roundTime)); $("ppTime").textContent = r.sudden ? "⚡" : `${Math.floor(tt / 60)}:${String(tt % 60).padStart(2, "0")}`;
  $("ppMine").innerHTML = `<div><b>${Stats.current.kills}</b><small>eliminações</small></div><div><b>${Stats.current.deaths}</b><small>mortes</small></div><div><b>${state.loot.grenade || 0}</b><small>granadas</small></div><div><b>${state.loot.health || 0}</b><small>curas</small></div>`;
  for (const team of ["A", "B"]) {
    const rows = w.combatants.filter((c) => c.team === team).sort((a, b) => a.index - b.index).map((c) =>
      `<div class="ppRow${c.isPlayer ? " me" : ""}${c.alive ? "" : " dead"}"><span class="dot"></span>${c.isPlayer ? "Tu" : nameOf(c)}<span class="kd">${c.kills}/${c.deaths}</span></div>`).join("");
    $("ppTeam" + team).innerHTML = `<div class="tName" style="background:${hex6(TEAM[team].color)}">${TEAM[team].name}</div>${rows}`;
  }
  const ups = Object.entries(state.upg).map(([id, n]) => `${UPGRADES.find((u) => u.id === id).icon}${n > 1 ? "×" + n : ""}`).join(" ");
  $("ppUpg").textContent = ups || "nenhuma ainda";
  $("pqVal").textContent = QUALITY[state.quality].label;
  $("psVal").textContent = Sfx.volume ? Math.round(Sfx.volume * 100) + "%" : "desligado";
  $("pwVal").textContent = WEATHERS[state.weatherId].name + (state.online ? " (decide o anfitrião)" : "");
  $("pauseWeather").disabled = !!state.online;
}
document.addEventListener("pointerlockchange", () => {
  if (state.screen !== "viewer") return;
  if (document.pointerLockElement === canvas) { if (state.paused) setPaused(false); }
  else if (!state.over && !state.upgradeChoices && !(state.intermission > 0)) setPaused(true);   // (a escolha da melhoria não abre a pausa)
});
document.addEventListener("pointerlockerror", () => { if (state.screen === "viewer") setPaused(true); });
document.addEventListener("mousemove", (e) => {
  if (state.screen !== "viewer" || document.pointerLockElement !== canvas) return;
  const sens = (state.ads ? MOUSE_SENS * 0.6 : MOUSE_SENS) * mouseSens();          // a mirar o rato é mais lento; × a sensibilidade das Configurações
  state.cam.yaw -= e.movementX * sens;
  state.cam.pitch = Math.max(MIN_PITCH, Math.min(1.45, state.cam.pitch + e.movementY * sens));
});
// Rato: clique esquerdo dispara (segura para disparar continuamente)
canvas.addEventListener("mousedown", (e) => {
  if (state.screen !== "viewer" || state.paused) return;
  if (e.button === 0) state.firing = true;
  else if (e.button === 2 && !state.dead && !state.cam.aerial && !(state.healingT > 0)) setAds(true);          // botão direito: mirar
});
window.addEventListener("mouseup", (e) => { if (e.button === 0) state.firing = false; else if (e.button === 2) setAds(false); });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
function setAds(on) {
  if (state.ads === on) return;
  state.ads = on;
  $("hud").classList.toggle("ads", on);
}
$("resumeBtn").addEventListener("click", resumeGame);
$("pauseMapsBtn").addEventListener("click", leaveViewer);
let statsTab = null;
function openStats(tab) {
  statsTab = typeof tab === "string" ? tab : statsTab || CONFIG.botDifficulty;
  $("statsBody").innerHTML = Stats.statsHTML(statsTab);
  $("statsScreen").style.display = "flex";
}
$("statsBody").addEventListener("click", (e) => { const b = e.target.closest(".stTab"); if (b) openStats(b.dataset.tab); });
function closeStats() { $("statsScreen").style.display = "none"; }
$("statsBtn").addEventListener("click", () => openStats(CONFIG.botDifficulty));
$("pauseStatsBtn").addEventListener("click", () => openStats(CONFIG.botDifficulty));
$("statsClose").addEventListener("click", closeStats);
function closeConfirm() { $("confirmBox").style.display = "none"; }
$("statsReset").addEventListener("click", () => {
  $("cfInput").value = ""; $("cfInput").classList.remove("ok"); $("cfYes").disabled = true;
  $("confirmBox").style.display = "flex"; $("cfInput").focus();
});
$("cfInput").addEventListener("input", () => {
  const ok = $("cfInput").value.trim().toUpperCase() === "CONFIRMAR";              // com ou sem Caps Lock
  $("cfYes").disabled = !ok; $("cfInput").classList.toggle("ok", ok);
});
$("cfInput").addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" && !$("cfYes").disabled) $("cfYes").click(); if (e.key === "Escape") closeConfirm(); });
$("cfNo").addEventListener("click", closeConfirm);
$("cfYes").addEventListener("click", () => { Stats.resetStats(); closeConfirm(); openStats(); });
window.addEventListener("keydown", (e) => { if (e.code === "Escape" && $("statsScreen").style.display === "flex") closeStats(); });
// Em ecrã inteiro o Esc é do jogo ("keyboard lock" do Chrome/Edge e da app): um toque abre/fecha a pausa (na partida) ou fecha o que
// estiver aberto (nos menus); só DOIS toques seguidos (em menos de meio segundo) saem do ecrã inteiro
document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) navigator.keyboard?.lock?.(["Escape"]).catch(() => {});
  else navigator.keyboard?.unlock?.();
});
const ESC_DOUBLE_MS = 500;
let lastEsc = -1e9;
window.addEventListener("keydown", (e) => {                                          // 2.º toque seguido: sai do ecrã inteiro (e o Esc não faz mais nada)
  if (e.code !== "Escape" || e.repeat || !document.fullscreenElement) return;
  const t = performance.now(), double = t - lastEsc < ESC_DOUBLE_MS;
  lastEsc = double ? -1e9 : t;
  if (!double) return;
  e.stopImmediatePropagation(); e.preventDefault();
  document.exitFullscreen?.();
  if (state.screen === "viewer" && !state.over && !state.paused) setPaused(true);   // (o 1.º toque já tinha posto em pausa; fica em pausa)
}, true);
window.addEventListener("keydown", (e) => {
  if (e.code !== "Escape" || e.repeat || state.screen !== "viewer") return;
  if (state.over) { if ($("goStage1").style.display !== "none") showSummary(); return; }          // fim de jogo: Esc abre o resumo
  if ($("statsScreen").style.display === "flex" || $("confirmBox").style.display === "flex") return;
  if (state.paused) resumeGame();                                 // Esc outra vez: continua
  else { if (document.pointerLockElement) document.exitPointerLock(); setPaused(true); }
});
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
$("pauseFs").addEventListener("click", toggleFullscreen);
$("fsBtn")?.addEventListener("click", toggleFullscreen);
$("pauseQuality").addEventListener("click", () => { applyQuality(QUALITY_IDS[(QUALITY_IDS.indexOf(state.quality) + 1) % QUALITY_IDS.length]); renderPausePanel(); });
$("pauseSound").addEventListener("click", () => { Sfx.nextVolume(); renderPausePanel(); });
$("pauseWeather").addEventListener("click", () => {
  if (state.online) return;                                                          // com amigos o clima é o do anfitrião (igual para todos)
  state.weatherId = WEATHER_IDS[(WEATHER_IDS.indexOf(state.weatherId) + 1) % WEATHER_IDS.length];
  state.weather.setMode(state.weatherId); applyWeatherPlay(false); renderPausePanel();
});
renderer.domElement.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (state.aimingGrenade) {                                                       // a apontar a granada: a roda muda a cor (um passo por "toque", mesmo em rato de precisão)
    const now = performance.now();
    if (now - (state.lastWheel || 0) > 110 && Math.abs(e.deltaY) > 0) { state.lastWheel = now; cycleGrenadeColor(e.deltaY > 0 ? 1 : -1); }
    return;
  }
  state.cam.dist = Math.max(4, Math.min(110, state.cam.dist * (e.deltaY > 0 ? 1.1 : 0.9)));
}, { passive: false });

$("playBtn").addEventListener("click", () => {                                     // o personagem escolhe-se no lobby
  if (online.isGuest) { lobby.flash("⏳ Espera que o anfitrião escolha o mapa"); return; }   // numa sala, só o anfitrião escolhe o mapa
  showScreen("select");
});
$("tutorialBtn").addEventListener("click", startTutorial);
$("goSummaryBtn").addEventListener("click", showSummary);
$("goAgain").addEventListener("click", () => { if (state.net === "guest") return; $("gameOver").style.display = "none"; startMap(state.def); });
$("goMenu").addEventListener("click", () => { $("gameOver").style.display = "none"; leaveViewer(); });
$("charBack").addEventListener("click", () => showScreen("lobby"));
$("enterBtn").addEventListener("click", () => showScreen("lobby"));                 // ecrã inicial → lobby
$("charNext").addEventListener("click", () => showScreen("select"));
$("backBtn").addEventListener("click", () => showScreen("lobby"));
const instructions = createInstructions({
  content: $("howContent"), prev: $("howPrev"), next: $("howNext"), dots: $("howDots"), nav: $("howNav"), back: $("howBack"),
  onClose: () => showScreen("lobby"),
});
$("howBtn").addEventListener("click", () => { instructions.reset(); showScreen("howto"); });
$("howBack").addEventListener("click", () => instructions.back());            // dentro de um tema volta aos temas; no menu sai
window.addEventListener("keydown", (e) => {
  if (state.screen !== "howto") return;
  if (e.code === "ArrowRight") instructions.go(1);
  else if (e.code === "ArrowLeft") instructions.go(-1);
  else if (e.code === "Escape") instructions.back();
});
$("menuBtn").addEventListener("click", leaveViewer);
function buildDifficultyChips() {                                                   // dificuldade dos bots adversários
  const box = $("diffPick"), icons = { facil: "🙂", media: "😐", dificil: "😠", impossivel: "💀" };
  for (const id of DIFFICULTIES) {
    const b = document.createElement("button");
    b.className = `chip d-${id}` + (id === CONFIG.botDifficulty ? " on" : "");
    b.textContent = `${icons[id]} ${BOT_PRESETS[id].name}`;
    b.addEventListener("click", () => {
      setDifficulty(id);
      box.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === b));
    });
    box.appendChild(b);
  }
}
function buildMatchChips() {                                                         // rounds para ganhar (3/5/7) e duração do round (2/3/5 min)
  const mk = (box, values, current, label, apply) => {
    for (const v of values) {
      const b = document.createElement("button");
      b.className = "chip" + (v === current() ? " on" : ""); b.textContent = label(v);
      b.addEventListener("click", () => { apply(v); box.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === b)); });
      box.appendChild(b);
    }
  };
  mk($("mpWins"), MATCH_TO_WIN, () => CONFIG.match.toWin, (v) => `${v} rounds`, (v) => setMatchOptions({ toWin: v }));
  mk($("mpMin"), ROUND_MINUTES, () => Math.round(CONFIG.roundSeconds / 60), (v) => `${v} min`, (v) => setMatchOptions({ minutes: v }));
}
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
function buildModeChips() {                                                         // modo de jogo: Normal, Cores Secretas ou Paleta Completa
  const box = $("modePick");
  for (const m of Object.values(MODES)) {
    const b = document.createElement("button");
    b.className = "chip" + (m.id === CONFIG.mode ? " on" : ""); b.textContent = `${m.icon} ${m.name}`; b.title = m.desc;
    b.addEventListener("click", () => { setGameMode(m.id); box.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === b)); });
    box.appendChild(b);
  }
}
buildModeChips();
buildWeatherChips();
buildDifficultyChips();
buildMatchChips();
buildQualityChips();
const settings = createSettings({                                                   // ⚙️ Configurações do lobby (ecras/settings.js)
  qualities: QUALITY_IDS.map((id) => ({ id, label: QUALITY[id].label, icon: QUALITY[id].icon, tip: QUALITY_TIPS[id] })),
  getQuality: () => state.quality, setQuality: (id) => applyQuality(id), toggleFullscreen,
  lobbyThemes: Object.entries(LOBBY_THEMES).map(([id, t]) => ({ id, name: t.name, icon: t.icon })),
  getLobbyTheme: () => lobby?.theme, setLobbyTheme: (id) => lobby?.setTheme(id),
});
$("setBtn").addEventListener("click", () => settings.open());
applyQuality(state.quality);

// ---------- bots: 4 aliados + 5 inimigos, cada um com o seu personagem (todos diferentes dentro da equipa) ----------
const _botTemplates = new Map();
function botTemplate(id) {
  if (!_botTemplates.has(id)) _botTemplates.set(id, loadCharacter(charById(id).url));
  return _botTemplates.get(id);
}
function clearBots() {
  for (const b of state.bots) if (b.model) { b.model.parent?.remove(b.model); disposeCharacter(b.model); }   // liberta as peças de cada boneco (placa gráfica)
  state.bots = [];
}
// Nome por cima da cabeça: azul para aliados, vermelho para adversários
// ---------- TUTORIAL ----------
function startTutorial() {
  state.startTutorial = true;
  startMap(MAPS.find((m) => m.id === "parque") || MAPS[0]);
}
function startTutorialWorld() {                                                    // chamado quando o mapa do tutorial está pronto
  const sp = { x: -47, z: 0 };
  state.player.pos.set(sp.x, 0, sp.z); state.player.facing = -Math.PI / 2; state.cam.yaw = -Math.PI / 2;
  const dots = $("tutDots");
  dots.innerHTML = TUT_STEPS.map(() => "<i></i>").join("");
  state.tutorial = new Tutorial({
    state, keys,
    render: (o) => {
      $("tutHint").textContent = "N: saltar este passo";
      if (o.done) { $("tutStep").textContent = "🎉 Tutorial concluído!"; $("tutText").innerHTML = "Já sabes jogar! No menu de pausa escolhe <b>Sair do tutorial</b> e depois <b>JOGAR</b>, ou continua a treinar à vontade."; $("tutHint").textContent = ""; }
      else { $("tutStep").textContent = `Passo ${o.i + 1} de ${o.total}  ${o.icon}`; $("tutText").innerHTML = o.text; }
      dots.querySelectorAll("i").forEach((el, k) => { el.className = o.done || k < o.i ? "on" : k === o.i ? "cur" : ""; });
    },
    hint: (txt) => { $("tutHint").textContent = `${txt}   ·   N: saltar este passo`; },
    celebrate: () => showToast("🎉 Tutorial concluído!", "#47e06a"),
    targets: (cols) => state.bots.forEach((b, i) => { b.colorId = cols[i % cols.length]; paintBot(b); }),
    give: (k, n) => addLoot(k, n),
    setHp: (hp) => { state.me.hp = hp; },
    nearestChestDist: () => { const p = state.player.pos; return Math.round(Math.min(...state.map.chests.map((c) => Math.hypot(c.x - p.x, c.z - p.z)))); },
  });
}

// sub: 2.ª linha mais pequena, a dourado (o título de um amigo ou a personalidade de um bot)
function nameTag(text, color, sub = "") {
  const cv = document.createElement("canvas"); cv.width = 256; cv.height = sub ? 100 : 64;
  const g = cv.getContext("2d");
  g.font = "44px 'Titan One', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineJoin = "round"; g.lineWidth = 9; g.strokeStyle = "#0d0b1f"; g.strokeText(text, 128, 34);
  g.fillStyle = color; g.fillText(text, 128, 34);
  if (sub) { g.font = "26px 'Titan One', sans-serif"; g.lineWidth = 7; g.strokeText(sub, 128, 78); g.fillStyle = "#ffd21f"; g.fillText(sub, 128, 78); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sp.scale.set(3.4, sub ? 1.33 : 0.85, 1); sp.position.set(0, sub ? 3.68 : 3.9, 0); sp.renderOrder = 6;
  sp.name = "nameTag";
  return sp;
}
async function spawnBots(map) {
  clearBots();
  const made = [];
  if (state.tutorialMode) {                                                       // tutorial: 3 alvos parados que não disparam
    for (let i = 0; i < 3; i++) {
      const id = state.rosters.B[i], tpl = await botTemplate(id);
      if (!tpl) continue;
      const home = { x: -37, z: [-6, 0, 6][i], ry: -Math.PI / 2 }, model = cloneCharacter(tpl), colorId = PRIMARIES[i];
      setCharacterPaint(model, COLORS[colorId].hex);
      model.add(nameTag("Alvo", "#ff4455"));
      model.position.set(home.x, 0, home.z); model.rotation.y = home.ry;
      scene.add(model);
      const bot = new Bot({ team: "B", index: i, characterId: id, model, pos: home, facing: home.ry, role: "defend", colorId, difficulty: "facil", passive: true });
      bot.applyUpgrades({}); made.push(bot);
    }
    state.bots = made;
    return;
  }
  for (const team of ["A", "B"]) {
    for (let i = 0; i < 5; i++) {
      if (team === "A" && i === state.myIndex) continue;                       // o teu lugar (sozinho: o 1.º da equipa A)
      const id = state.rosters[team][i], tpl = await botTemplate(id);
      if (!tpl) continue;
      const spawn = map.spawns[team][spawnIndex(team, i)];                        // o jogador nasce em A[2]
      const model = cloneCharacter(tpl);
      const colorId = PRIMARIES[Math.floor(Math.random() * PRIMARIES.length)];
      setCharacterPaint(model, COLORS[colorId].hex);
      const canon = state.netFlip ? (team === "A" ? "B" : "A") : team, human = state.net ? state.netPlayers.find((p) => p.team === canon && p.slot === i) : null;
      const ex = state.rosters.extra?.[team]?.[i] || {};
      const sub = human ? human.title || "" : "";                                   // 2.ª linha: o título de um amigo (os bots só têm o nome)
      if (team === "A") model.add(nameTag(personName(team, i), "#4da8ff", sub));          // nome só nos colegas (os adversários sem nome: ecrã mais limpo)
      applyCosmetics(model, human ? human.equip || {} : { arma: ex.arma || "arma_pistola" });   // arma da loja (a do amigo, ou uma à sorte para o bot)
      model.position.set(spawn.x, 0, spawn.z); model.rotation.y = spawn.ry;
      scene.add(model);
      if (state.net === "guest" || human) {                                     // com amigos: um amigo (ou, no PC de um convidado, toda a gente) é uma marioneta mexida pela rede
        made.push(new Puppet({ team, index: i, characterId: id, model, pos: spawn, facing: spawn.ry, colorId, peer: state.net === "host" ? human.peer : null }));
        continue;
      }
      const bot = new Bot({ difficulty: CONFIG.botDifficulty, personality: ex.pers,  // os 9 bots têm o nível escolhido (colegas incluídos); a personalidade muda só o feitio
                             team, index: i, characterId: id, model, pos: spawn, facing: spawn.ry, role: i <= (team === "A" ? 2 : 1) ? "defend" : "attack", colorId });
      bot.applyUpgrades(state.botUpg[bot.id] ||= {});                         // as melhorias dos bots ficam entre rounds
      made.push(bot);
    }
  }
  state.bots = made;
}

// Arma da loja e personalidade de cada lugar das equipas (sorteadas em cada partida; os amigos usam as deles)
const BOT_WEAPONS = ITEMS.filter((it) => it.cat === "arma" && it.id !== "arma_pistola").map((it) => it.id);
const BOT_PERS = ["equilibrado", "equilibrado", "agressivo", "cauteloso", "cacador"];             // (equilibrado sai mais vezes)
function botExtras() {
  const one = () => ({ arma: Math.random() < 0.6 ? BOT_WEAPONS[Math.floor(Math.random() * BOT_WEAPONS.length)] : "arma_pistola", pers: BOT_PERS[Math.floor(Math.random() * BOT_PERS.length)] });
  return { A: Array.from({ length: 5 }, one), B: Array.from({ length: 5 }, one) };
}

// ---------- COMBATE: disparo, munição, vida, cura, morte e reaparecimento ----------

// Cor do boneco do jogador (a que os adversários têm de acertar) — separada da cor da munição
// Enquanto está protegido (acabou de reaparecer) o boneco fica branco: os adversários não sabem a cor
const NEUTRAL_HEX = 0xf4f4f4;
function paintPlayer(colorId) {
  state.playerColor = colorId;
  const neutral = !!state.me?.neutral;
  if (dummy.userData.paintMat) { setCharacterPaint(dummy, neutral ? NEUTRAL_HEX : hexOf(colorId)); setSymbol(dummy, colorId, neutral); } else setDummyColor(dummy, colorId);
  $("myColor").innerHTML = chipHTML(colorId, 24);
}
function setSymbol(model, colorId, hidden = false) {                          // símbolo da cor por cima da cabeça
  const sym = model.userData.sym, sm = symbolMaterial(colorId);
  if (sym && sm) { sym.material = sm; sym.visible = CONFIG.ui.symbolAboveHead && !hidden; }
}
// Cores Secretas: os adversários ficam cinzentos (a cor verdadeira continua a contar, só não se vê)
const SECRET_HEX = 0x8a8f9c;
function paintBot(bot) {
  if (!bot.model) return;
  const secret = state.secret && bot.team === "B";
  setCharacterPaint(bot.model, bot.neutral ? NEUTRAL_HEX : secret ? SECRET_HEX : hexOf(bot.colorId));
  setSymbol(bot.model, bot.colorId, bot.neutral || secret);
}

// Um bot abre um baú: as caixas caem no chão (cores à sorte) e qualquer um pode apanhá-las
function botOpenChest(bot, c) {
  const res = openChest(c, !!state.round?.sudden, state.mode);
  if (!res.ok || !res.reward) return;
  if (res.reward.id === "golden") { goldenReward(bot); return; }
  const r = res.reward, [lo, hi] = r.drops;
  const n = lo + Math.floor(Math.random() * (hi - lo + 1));
  if (r.id === "ammo") { const cols = Array.from({ length: n }, () => PRIMARIES[Math.floor(Math.random() * PRIMARIES.length)]); state.pickups.spawn("ammo", n, c.x, c.z, cols, cols.map(boxShots)); }
  else state.pickups.spawn(r.id, n, c.x, c.z);
}

// Prémio do baú dourado: 3 granadas ou invisibilidade longa (já ativa)
function goldenReward(c, grenades = Math.random() < 0.5) {
  const G = CONFIG.golden;
  if (c.isPlayer) {
    if (grenades) { addLoot("grenade", G.grenades); Stats.current.got.grenade += G.grenades; showToast(`🌟 Baú dourado: +${G.grenades} granadas!`, "#ffd21f"); }
    else { state.invisible = G.invisibleSeconds; showToast(`🌟 Baú dourado: invisível durante ${G.invisibleSeconds} s!`, "#ffd21f"); }
  } else {
    if (grenades) c.items.grenade += G.grenades; else c.invisibleT = G.invisibleSeconds;
    showToast(`🌟 ${nameOf(c)} (${c.team === "A" ? "colega" : "adversário"}) abriu o baú dourado`, c.team === "A" ? "#4da8ff" : "#ff4455");
  }
}

function setupCombat(map) {
  if (state.world) state.world.dispose();
  state.ammo = { vermelho: CONFIG.ammo.start, azul: CONFIG.ammo.start, amarelo: CONFIG.ammo.start };
  Object.assign(state, { dead: false, deathInfo: null, gameTime: 0, firing: false, fireCd: 0, hurtT: 0, hpShown: -1, crouch: false });
  const world = new CombatWorld({
    scene, map, paint: state.paint,
    callbacks: {
      onSound: (k, x, z, who, target) => {                                              // sons do combate (ver sfx.js)
        if (k === "shot") { if (who?.isPlayer) Sfx.play("shotMe"); else Sfx.at("shot", x, z); }
        else if (k === "hit") { if (target?.isPlayer) Sfx.play("hurt"); else { Sfx.at("hit", x, z); if (who?.isPlayer) Sfx.play("hitMe"); } }
        else if (k === "elim") { Sfx.at("elim", x, z); if (target?.isPlayer) Sfx.play("dead"); else if (who?.isPlayer && who.team !== target?.team) Sfx.play("kill"); }
        else Sfx.at(k, x, z);
      },
      onDamage: (v, dmg, owner, shot) => {
        if (v.isPlayer) state.hurtT = 0.5; else if (owner && owner.isPlayer && !state.tutorial) { Stats.current.damage += Math.max(0, Math.min(dmg, v.hp + dmg)); if (owner.team !== v.team) replay.hit(dmg, state.gameTime); }
        if (owner?.isPlayer && owner.team !== v.team) dmgNums.show(v, dmg);   // −4 / −8 por cima de quem levou o tiro
        if (state.secret && owner?.isPlayer && v.team === "B")                        // pista: −8 = a cor dele leva esta; −4 = não leva
          state.clues[v.id] = { shot, part: hitDamage(shot, v.colorId) === CONFIG.health.partialHit, changed: false, t: state.gameTime };
      },
      onColorChange: (v, c, why) => {
        const cl = state.clues[v.id];
        if (cl) { if (!why && cl.t === state.gameTime) cl.changed = true; else delete state.clues[v.id]; }   // mudou com o teu tiro / mudou por outra razão (a pista já não vale)
        state.tutorial?.event("recolor", { isPlayer: v.isPlayer, why });
        if (v.isPlayer) { paintPlayer(c); showToast(`🎨 A tua cor mudou para ${COLORS[c].name}!`, "#" + hex6(hexOf(c)).slice(1)); }
        else paintBot(v);
      },
      onPuddleFx: (c, colorId, mul) => {
        if (c.isPlayer) showToast(mul > 1 ? `⚡ Poça ${COLORS[colorId].name}: mais rápido!` : `🐌 Poça ${COLORS[colorId].name}: mais lento!`, hex6(hexOf(colorId)));
      },
      onTrapTriggered: (tr, v) => {
        if (v.isPlayer) showToast("⚠️ Armadilha! Foge!", "#ff3b4a");
        else if (tr.owner.isPlayer) showToast(`🪤 ${nameOf(v)} acionou a tua armadilha!`, hex6(hexOf(tr.colorId)));
      },
      onAssist: (a, v, k) => {                                                         // ajudaste um colega a eliminar alguém
        if (!a.isPlayer || state.tutorial) return;
        Stats.recordAssist();
        showToast(`🤝 Assistência! Ajudaste ${nameOf(k)} a eliminar ${nameOf(v)}`, "#4da8ff");
      },
      onReveal: (c) => { if (c.isPlayer) paintPlayer(c.colorId); else paintBot(c); },
      onGrenade: (k, x, z, colorId, hit, via) => {
        if (via === "cannon") {
          if (k.isPlayer && hit.length) showToast(`💥 A bola do canhão apanhou ${hit.map(nameOf).join(", ")}!`, hex6(hexOf(colorId)));
          else if (hit.includes(state.me)) showToast("💥 Uma bola do canhão mudou a tua cor!", "#ff8a1f");
          return;
        }
        if (via === "trap") {
          if (k.isPlayer) showToast(`🪤 A tua armadilha ${COLORS[colorId].name} apanhou ${hit.map(nameOf).join(", ") || "alguém"}!`, hex6(hexOf(colorId)));
          else if (hit.includes(state.me)) showToast("🪤 Pisaste uma armadilha!", "#ff8a1f");
          return;
        }
        if (k.isPlayer) showToast(hit.length ? `💣 ${hit.length} ${hit.length === 1 ? "jogador ficou" : "jogadores ficaram"} ${COLORS[colorId].name}` : "💣 A granada não apanhou ninguém", hit.length ? hex6(hexOf(colorId)) : "#ffd21f");
        else if (hit.includes(state.me)) showToast("💣 Uma granada mudou a tua cor!", "#ff8a1f");
      },
      onKill: (k, v, shot, byColor, via) => {
        Emotes.stop(v);
        if (k?.isPlayer && k.team !== v.team && v.hp > 0) dmgNums.show(v, v.hp);           // eliminaste (cor certa, canhão, granada, armadilha): a vida que lhe tiraste
        replay.kill(k, v, state.gameTime, byColor, via);                                  // para a repetição da melhor jogada
        state.heat.push({ x: v.pos.x, z: v.pos.z, mine: !!k?.isPlayer && k.team !== v.team, me: !!v.isPlayer });   // para o mapa de calor do fim do round
        if (k && !k.isPlayer && k.team !== v.team && k.alive && Math.random() < 0.35) Emotes.play(k, BOT_EMOTES[Math.floor(Math.random() * BOT_EMOTES.length)], now());   // os bots às vezes celebram
        if (!k) {                                                                         // caiu de muito alto ou ao rio: o ponto vai para a outra equipa
          if (via === "water") state.world.burst(v.pos.x, 0.3, v.pos.z, "azul", 18);        // salpico na água
          reportFall(v, via);
          if (v.isPlayer) { setAds(false); if (!state.tutorial) { Stats.recordDeath(); rerollTracked(); } state.dead = true; state.firing = false; state.deathInfo = { by: via === "water" ? "O rio" : "A queda", byColor: false }; }
          const other = v.team === "A" ? "B" : "A";
          if (!state.over && !state.tutorial) { state.round.kills[other]++; updateScoreUi(); if (state.round.sudden) endRound(other); }
          return;
        }
        reportKill({ team: k.team, index: k.index }, { team: v.team, index: v.index }, shot, byColor);
        if (k.isPlayer && k.team !== v.team) {
          if (!state.tutorial) { Stats.recordKill(!!byColor); if (byColor) Stats.current.damage += Math.max(0, v.hp); achieve("kill", !!byColor, via); }       // eliminação com a cor certa conta a vida que o adversário ainda tinha
          if (byColor && via !== "grenade") refundAmmo(shot);
          if (byColor) { state.radarT = Math.max(state.radarT, CONFIG.radarSeconds); showToast(`📡 Radar: vês os adversários no minimapa durante ${CONFIG.radarSeconds} s`, "#9be7ff"); }   // bónus da cor certa
          const S = CONFIG.streak;
          if (!state.tutorial && k.streak > 0 && k.streak % S.kills === 0) {             // série: a cada 3 eliminações seguidas sem morrer
            state.radarT = Math.max(state.radarT, S.radarSeconds); addLoot("grenade", S.grenades); Stats.current.got.grenade += S.grenades;
            showToast(`🔥 Série de ${k.streak}! Radar ${S.radarSeconds} s + ${S.grenades} granada`, "#ff8a1f");
          }
        }
        if (v.isPlayer) setAds(false);
        if (v.isPlayer && !state.tutorial) { Stats.recordDeath(); rerollTracked(); }
        if (k.isPlayer && byColor) state.tutorial?.event("killExact");
        if (k.team !== v.team && !state.over && !state.tutorial) { state.round.kills[k.team]++; updateScoreUi(); if (state.round.sudden) endRound(k.team); }
        if (v.isPlayer) { state.dead = true; state.firing = false; state.deathInfo = { by: nameOf(k), byColor }; }
        else if (k.isPlayer) showToast(byColor ? `🎯 Eliminaste ${nameOf(v)} com a cor certa!` : `💥 Eliminaste ${nameOf(v)}`, byColor ? "#2fd15a" : "#ff8a1f");
      },
      onRespawn: (c, s) => {
        setPlayerOut(c.team, c.index, false);
        delete state.clues[c.id];
        if (c.isPlayer) {
          state.dead = false; state.player.motion = createMotionState(); state.player.facing = s.ry; state.cam.ready = false;
          paintPlayer(c.colorId);
        } else { c.onRespawn(); paintBot(c); }
      },
    },
  });
  const me = { id: "A" + state.myIndex, team: "A", index: state.myIndex, isPlayer: true, pos: state.player.pos, colorId: PRIMARIES[Math.floor(Math.random() * PRIMARIES.length)],
               spawn: map.spawns.A[spawnIndex("A", state.myIndex)], get hidden() { return state.invisible > 0; } };
  world.add(me);
  for (const b of state.bots) { world.add(b); paintBot(b); }
  world.services = { pickups: state.pickups, openChest: botOpenChest };
  world.secret = state.secret;
  state.world = world; state.me = me;
  replay.reset(world, world.combatants.map((c) => c.isPlayer ? { c, get model() { return dummy; } } : { c, model: c.model }));
  applyUpgrades();
  paintPlayer(me.colorId);
  // círculo que mostra onde a granada vai cair (tamanho = área do efeito)
  const R = CONFIG.grenade.radius;
  state.aimRing = new THREE.Mesh(new THREE.RingGeometry(R - 0.3, R, 56), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  state.aimRing.rotation.x = -Math.PI / 2; state.aimRing.position.y = 0.07; state.aimRing.visible = false;
  state.aimRing.material.depthTest = false; state.aimRing.renderOrder = 8;              // vê-se sempre (mesmo atrás do boneco, de muros ou do canhão)
  state.aimRing2 = new THREE.Mesh(new THREE.RingGeometry(R * 0.5, R * 0.62, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  state.aimRing2.material.depthTest = false; state.aimRing2.renderOrder = 8;
  state.aimRing2.visible = false; state.aimRing.add(state.aimRing2);                // 2.ª cor (melhoria): anel interior
  scene.add(state.aimRing); state.aimingGrenade = false;
}

const _aimDir = new THREE.Vector3();
const dmgNums = new DamageNumbers($("hud"));                                          // −4 / −8 por cima de quem acertas (visual/damage-numbers.js)
// Ajuda de pontaria: se um inimigo visível estiver quase no centro do ecrã (cone de ~3,5°), o tiro vai para o peito dele
function aimAssist(c, dir, maxAng = 0.06) {
  let best = null, bestAng = maxAng;
  const p = state.player.pos;
  for (const q of state.world.enemiesOf(state.me)) {
    if (q.hidden) continue;
    const vx = q.pos.x - c.x, vy = aimY(q) - c.y, vz = q.pos.z - c.z, d = Math.hypot(vx, vy, vz);
    const cos = (vx * dir.x + vy * dir.y + vz * dir.z) / d;
    if (cos <= 0 || d > CONFIG.weapon.range) continue;
    const ang = Math.acos(Math.min(1, cos));
    if (ang < bestAng && state.world.los(p.x, p.z, q.pos.x, q.pos.z, eyeY(state.me) - p.y, p.y, q.pos.y, aimY(q) - q.pos.y)) { best = q; bestAng = ang; }
  }
  return best;
}
function tryFire() {
  if (state.healingT > 0) return;                                                 // com o kit na mão não disparas
  const col = state.colors.current, comps = ingredients(col);
  const cheap = FX().cheapMix && comps.length > 1;                                // melhoria: secundária gasta só 1 bala
  if (cheap ? !comps.some((c) => state.ammo[c] >= 1) : !comps.every((c) => state.ammo[c] >= 1)) {                                  // sem tinta nos tanques desta cor
    if (state.gameTime - state.noAmmoMsg > 1.4) { state.noAmmoMsg = state.gameTime; showToast(`Sem munição ${COLORS[col].name}!`, "#ff8a1f"); }
    state.fireCd = 0.2; return;
  }
  if (cheap) state.ammo[comps.reduce((a, b) => (state.ammo[a] >= state.ammo[b] ? a : b))] -= 1;
  else for (const c of comps) state.ammo[c] -= 1;                                  // secundária gasta dos dois tanques
  camera.getWorldDirection(_aimDir);
  const cp = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
  let hit = state.world.raycast(cp, _aimDir, CONFIG.weapon.range, "A");
  const assist = aimAssist(cp, _aimDir);
  if (assist) hit = { x: assist.pos.x, y: aimY(assist), z: assist.pos.z };
  const p = state.player.pos, yaw = Math.atan2(hit.x - p.x, hit.z - p.z);
  state.player.facing = yaw; state.player.aimLock = 0.35;                          // o boneco vira-se para onde apontas
  const m = { x: p.x + Math.sin(yaw) * 0.75, y: muzzleY(state.me), z: p.z + Math.cos(yaw) * 0.75 };
  Stats.current.shots++; Stats.current.colors[col] = (Stats.current.colors[col] || 0) + 1;   // (cor preferida no perfil)
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
  if (state.healingT > 0) return;
  if (state.dead || state.cam.aerial || state.countdown > 0 || state.cannon) return;
  if (!state.loot.grenade) { showToast("💣 Não tens granadas", "#ffd21f"); return; }
  state.grenadeColor = state.colors.current; state.aimLastCol = state.colors.current;   // começa com a cor da mão; a roda do rato ou as teclas 1, 2, 3 mudam
  state.grenadeColor2 = FX().dualGrenade ? state.grenadeColor : null; state.grenadeSlot = 0;
  state.aimingGrenade = true; state.aimRing.visible = true;
}
function cycleGrenadeColor(dir) {
  const key = state.grenadeSlot === 1 && state.grenadeColor2 ? "grenadeColor2" : "grenadeColor", all = paletteColors();   // (com o castanho na Paleta Completa)
  const i = all.indexOf(state[key]);
  state[key] = all[(i + dir + all.length) % all.length];
}
function cancelGrenadeAim() { state.aimingGrenade = false; if (state.aimRing) state.aimRing.visible = false; }
function releaseGrenade() {
  if (!state.aimingGrenade) return;
  cancelGrenadeAim();
  if (state.dead || !state.loot.grenade) return;
  const t = grenadeTarget(), p = state.player.pos, yaw = Math.atan2(t.x - p.x, t.z - p.z), col = state.grenadeColor;
  state.player.facing = yaw; state.player.aimLock = 0.4;
  const o = { x: p.x + Math.sin(yaw) * 0.7, y: eyeY(state.me), z: p.z + Math.cos(yaw) * 0.7 };
  const col2 = state.grenadeColor2;
  state.world.throwGrenade(state.me, o, t, col, col2);
  addLoot("grenade", -1); Stats.current.used.grenade++;
  state.tutorial?.event("grenade");
  showToast(`💣 Granada ${COLORS[col].name}${col2 && col2 !== col ? " + " + COLORS[col2].name : ""} lançada!`, hex6(hexOf(col)));
  if (state.invisible > 0) state.invisible = 0;
}

// ---------- armadilha de tinta (C): fica no chão com a cor da mão e explode quando um adversário passa por cima ----------
function placeTrap() {
  if (state.dead || state.cam.aerial || state.countdown > 0 || !state.world) return;
  if (!("trap" in state.loot)) return;                                             // neste modo não há armadilhas
  if (!state.loot.trap) { showToast("🪤 Não tens armadilhas", "#ffd21f"); return; }
  if (!state.player.motion.onGround) { showToast("🪤 Só podes pousar a armadilha no chão", "#ffd21f"); return; }
  const p = state.player.pos, col = state.colors.current;
  state.world.placeTrap(state.me, p.x, p.y, p.z, col);
  addLoot("trap", -1); Stats.current.used.trap++;
  showToast(`🪤 Armadilha ${COLORS[col].name} pousada (ativa daqui a ${CONFIG.trap.arm} s)`, hex6(hexOf(col)));
}

// ---------- canhão de tinta: E para subir/sair; clique dispara bolas gigantes da cor da mão ----------
// onde cai a bola: para onde a câmara aponta, até ao alcance do canhão (como faz o lançamento em combat.js)
function cannonTarget() {
  camera.getWorldDirection(_aimDir);
  const hit = state.world.raycast({ x: camera.position.x, y: camera.position.y, z: camera.position.z }, _aimDir, CONFIG.cannon.range + 10, "A");
  const p = state.player.pos, dx = hit.x - p.x, dz = hit.z - p.z, d = Math.hypot(dx, dz), R = CONFIG.cannon.range;
  return d > R ? { x: p.x + (dx / d) * R, z: p.z + (dz / d) * R } : { x: hit.x, z: hit.z };
}
function cannonFire() {
  const cn = state.cannon, t = cannonTarget();
  if (cn.fire(t.x, t.z, state.colors.current)) { state.player.facing = cn.yaw; if (state.invisible > 0) state.invisible = 0; }
}

// ---------- celebração (Z): a que tens equipada no inventário ----------
const now = () => performance.now();
const BOT_EMOTES = Object.keys(Emotes.EMOTES);
function celebrate() {
  if (state.dead || !state.me || state.countdown > 0 || state.cannon || state.paused) return;
  Emotes.play(state.me, Progress.wallet.equip.emote || "emote_aceno", now());
}

// Chão onde os pés pousam: o topo de qualquer objeto ao alcance (degraus sobem-se a andar, o resto a saltar; ver surfaces.js)
const platformFloor = (x, z, y) => floorAt(state.map.colliders, x, z, y);
const platformCeil = (x, z, y) => ceilingAt(state.map.colliders, x, z, y);
const _speedCfg = { ...MOTION };
function speedCfg() {                                                                // melhoria: mais velocidade; agachado anda devagar
  const k = FX().speedMul * (state.me?.puddleMul || 1) * (state.me?.carryMul || 1), crouch = state.me && state.me.crouching;   // poça pisada: mais rápido ou mais lento; com a lata às costas: mais lento
  if (k === 1 && !crouch) return MOTION;
  _speedCfg.walk = crouch ? CONFIG.player.crouchWalk * k : MOTION.walk * k; _speedCfg.run = crouch ? CONFIG.player.crouchWalk * k : MOTION.run * k;
  return _speedCfg;
}

function useCure() {                                                               // tecla T: tira o kit e cura ao fim de ~1 s
  if (state.dead || !state.loot.health || state.healingT > 0) return;
  if (state.me.hp >= state.me.maxHp) { showToast("❤️ Já tens a vida cheia", "#ffd21f"); return; }
  cancelGrenadeAim(); state.firing = false;
  state.healingT = 1.0;
  showToast("💊 A curar…", "#2fd15a");
}
function completeCure() {
  if (state.dead || !state.loot.health) return;
  const gained = state.world.heal(state.me, CONFIG.health.cure);
  if (gained <= 0) return;
  addLoot("health", -1); Stats.current.used.health++;
  state.tutorial?.event("cure");
  Sfx.play("heal");
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
  } else if (state.cannon && state.aimRing) {                                        // no canhão: o círculo mostra onde a bola cai e o tamanho da mancha
    const t = cannonTarget();
    state.aimRing.position.set(t.x, floorAt(state.map.colliders, t.x, t.z, 50) + 0.07, t.z);
    state.aimRing.scale.setScalar(CONFIG.cannon.radius / CONFIG.grenade.radius);
    state.aimRing.material.color.setHex(hexOf(state.colors.current));
    state.aimRing2.visible = false;
    state.aimRing.visible = !state.dead;
    state.cannonRing = true;
  } else if (state.cannonRing) {                                                     // saiu do canhão: o círculo volta a ser o da granada
    state.cannonRing = false;
    state.aimRing.visible = false; state.aimRing.scale.setScalar(FX().grenadeMul);
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
  if (tgt && tgt.neutral) {                                                         // acabou de reaparecer: cor escondida
    state.targetT = 0.4;
    const key = tgt.id + "neutral";
    if (key !== state.targetKey) {
      state.targetKey = key;
      info.innerHTML = `<span class="colorChip" style="width:32px;height:32px;background:#f4f4f4"></span><div><b>${nameOf(tgt)}: protegido</b><small>A cor aparece quando acabar a proteção</small></div>`;
      info.className = "show nomatch";
    }
  } else if (tgt && state.secret) {                                                 // Cores Secretas: só a pista do teu último tiro
    state.targetT = 0.4;
    const cl = state.clues[tgt.id], key = tgt.id + "secret" + (cl ? cl.shot + cl.part + cl.changed : "");
    if (key !== state.targetKey) {
      state.targetKey = key;
      const clue = !cl ? "Dispara para descobrires: −8 = a cor dele leva essa tinta; −4 = não leva"
        : `Último tiro ${COLORS[cl.shot].name}: ${cl.part ? "−8, a cor dele leva " + COLORS[cl.shot].name : "−4, não é nem leva " + COLORS[cl.shot].name}${cl.changed ? " · e mudou de cor!" : ""}`;
      info.innerHTML = `<span class="colorChip" style="width:32px;height:32px;background:#8a8f9c;font-size:20px">❓</span><div><b>${nameOf(tgt)}: cor secreta</b><small>${clue}</small></div>`;
      info.className = "show nomatch";
    }
  } else if (tgt) {
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
    const txt = `${state.deathInfo.by} eliminou-te${state.deathInfo.byColor ? " com a cor certa" : ""}. Voltas em ${left} s`;
    if (txt !== state.deathTxt) { state.deathTxt = txt; $("deathText").textContent = txt; }
    if (box.style.display !== "flex") box.style.display = "flex";
  } else if (box.style.display !== "none") { box.style.display = "none"; state.deathTxt = ""; }
  // piscar durante a proteção após reaparecer; escondido enquanto está eliminado
  const blink = Math.floor(t * 10) % 2 === 0, vis = (c) => !c.alive || state.world.t >= c.protectUntil || blink;
  dummy.visible = vis(me) && (!state.ads || !!state.cannon);                       // em 1.ª pessoa o boneco não se vê (a mirar no canhão vê-se de cima)
  for (const b of state.bots) if (b.model) {
    const unseen = b.hidden && b.team === "B" && Math.hypot(b.pos.x - me.pos.x, b.pos.z - me.pos.z) > 5;   // adversário invisível: só o vês de perto
    b.model.visible = vis(b) && !unseen;
  }
  for (const c of state.world.combatants) deathFx(c, c.isPlayer ? dummy : c.model, dt);
}

// Quando é eliminado o boneco cai para trás; ao fim de 2 s vai ficando branco até reaparecer na base
const nameTagOf = (model) => ("tag" in model.userData ? model.userData.tag : (model.userData.tag = model.getObjectByName("nameTag") || null));   // procurado uma vez só
const LOD_FAR = 30, LOD_NEAR = 26;                                                   // metros: a partir daqui os bots usam a versão leve
function deathFx(c, model, dt) {
  if (!model) return;
  const ud = model.userData, tag = nameTagOf(model);
  if (!c.alive) {
    c.deadT = (c.deadT || 0) + dt;
    const f = Math.min(1, c.deadT / 0.5), e = 1 - (1 - f) * (1 - f);
    model.rotation.order = "YXZ";
    model.rotation.x = -Math.PI / 2 * e; model.position.y = c.pos.y + 0.4 * e;
    const fade = Math.round(Math.max(0, Math.min(1, (c.deadT - 2) / Math.max(0.1, CONFIG.respawn.delay - 2))) * 20) / 20;
    if (fade !== ud.fadeK) { ud.fadeK = fade; if (ud.hex !== undefined) setCharacterPaint(model, ud.hex, fade); }
    ud.dead = true; if (tag) tag.visible = false;
  } else if (ud.dead) {
    ud.dead = false; ud.fadeK = 0;
    model.rotation.x = 0; model.position.y = c.pos.y;
    if (ud.hex !== undefined) setCharacterPaint(model, ud.hex, 0);
    if (tag) tag.visible = true;
  }
}

function buildCharCards() {
  const grid = $("charGrid");
  for (const c of CHARACTERS) {
    const id = c.id;
    const el = document.createElement("button");
    el.className = "charCard" + (id === state.characterId ? " on" : "");
    el.dataset.id = id;
    el.innerHTML = `<span class="charFace"><img alt=""><i>${c.icon}</i></span><span class="cname">${c.name}</span><span class="cdesc">${c.desc}</span>`;
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
      const c = { name: personName(team, i), icon: charById(id).icon }, url = portraitUrl(id, TEAM[team].color);
      return `<span class="pvFace${team === "A" && i === 0 ? " you" : ""}" style="--c:${hex6(TEAM[team].color)}" title="${c.name}">${url ? `<img src="${url}" alt="">` : c.icon}<small>${team === "A" && i === 0 ? "tu" : c.name}</small></span>`;
    }).join("");
  }
}
buildCharCards();
setCharacter(state.characterId);
(function buildBokeh() {                                                        // bolinhas de tinta que sobem no ecrã inicial
  const cols = ["#ff3b4a", "#ffd21f", "#2f7bff", "#47e06a", "#a447ff", "#ff8a1f", "#ff8fc0"], box = $("titleBokeh");
  for (let i = 0; i < 26; i++) {
    const el = document.createElement("i"), s = 8 + Math.random() * 26;
    el.style.cssText = `left:${Math.random() * 100}%;width:${s}px;height:${s}px;background:${cols[i % cols.length]};animation-duration:${9 + Math.random() * 12}s;animation-delay:${-Math.random() * 20}s`;
    box.appendChild(el);
  }
})();
buildPortraits({ A: TEAM.A.color, B: TEAM.B.color }).then(() => {
  refreshPips(); refreshCharScreen();
  $("titleHeroes").innerHTML = CHARACTERS.slice(0, 5).map((c) => c.id).map((id) => `<img alt="" src="${portraitUrl(id, TEAM.A.color)}">`).join("");      // os heróis no ecrã inicial
});
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
    for (const c of near(colliders, x, z)) {                                      // (grelha: só os obstáculos perto deste ponto)
      if (y > topAt(c, x, z) + 0.25 || y < (c.bottom || 0) - 0.25) continue;
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


// Baú dourado: aparece uma vez por round, a meio do tempo (não no tutorial nem na morte súbita); tem um feixe de luz por cima
function tickGolden() {
  const st = state;
  if (!st.goldenDone && !st.tutorial && st.net !== "guest" && st.round && !st.round.sudden && st.roundTime <= CONFIG.roundSeconds * CONFIG.golden.at) {
    st.goldenDone = true;
    if (makeGolden(st.map.chests)) { showToast("🌟 Apareceu um baú dourado! Procura a estrela no minimapa", "#ffd21f"); Sfx.play("goldSpawn"); }
  }
  for (const c of st.map.chests) {
    if (c.golden && !c.beam) {
      c.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 60, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
      c.beam.position.set(c.x, 30, c.z); scene.add(c.beam);
    } else if (!c.golden && c.beam) { scene.remove(c.beam); c.beam.geometry.dispose(); c.beam.material.dispose(); c.beam = null; }
  }
}
function clearGoldenBeams() {
  for (const c of state.map?.chests || []) if (c.beam) { scene.remove(c.beam); c.beam.geometry.dispose(); c.beam.material.dispose(); c.beam = null; }
}

// Armadilhas: as da tua equipa veem-se; as dos adversários são invisíveis até serem acionadas (aí piscam e crescem até explodir)
function updateTraps() {
  const now = performance.now(), T = CONFIG.trap;
  for (const tr of state.world.traps) {
    if (!tr.mesh) continue;
    if (tr.fuseAt) {
      const k = 1 - Math.max(0, tr.fuseAt - state.world.t) / T.fuse;
      tr.mesh.visible = Math.floor(now / 70) % 2 === 0;
      tr.mesh.scale.set(1 + k * 2.5, 1, 1 + k * 2.5);
      continue;
    }
    tr.mesh.visible = tr.owner.team === "A";
    const armed = state.world.t - tr.t >= T.arm;
    tr.mesh.scale.setScalar(armed ? 1 + 0.08 * Math.sin(now / 150) : 0.6);
  }
}


function update(dt, t) {
  const st = state, p = st.player, map = st.map, cam = st.cam;
  if (st.over) return;                                                   // jogo terminado: tudo parado atrás do ecrã final
  if (st.intermission > 0) return;                                        // entre rounds: parado até alguém carregar em "Começar round" (requestNextRound)

  const frozen = st.countdown > 0 || st.netWait;                          // contagem "3, 2, 1, PINTA!" (ou, com amigos, à espera que todos carreguem o mapa): ninguém se mexe nem dispara
  if (st.netWait) { if (st.net === "host" && (st.netWaitT += dt) > 20) netGo(); }       // (ao fim de 20 s começa na mesma)
  else tickCountdown(dt);

  // movimento relativo à câmara, com inércia, controlo no ar e salto variável (ver player-motion.js)
  const ix = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  const iz = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
  const run = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  let mx = fx * iz + rx * ix, mz = fz * iz + rz * ix;
  const len = Math.hypot(mx, mz);
  if (len > 0) { mx /= len; mz /= len; }
  if (st.dead || frozen || st.cannon) { mx = 0; mz = 0; }           // eliminado (ou à espera da contagem, ou no canhão): não se mexe
  const jumpHeld = keys.has("Space") && !st.dead && !frozen && !st.cannon, jumpPressed = jumpHeld && !p.jumpWasHeld;
  p.jumpWasHeld = jumpHeld;
  const before = { x: p.pos.x, z: p.pos.z };
  if (st.dead || jumpPressed || p.motion.climbing || st.cam.aerial) st.crouch = false;   // saltar, escada de mão, morrer: levanta-se
  if (st.me) st.me.crouching = st.crouch && p.motion.onGround;
  const ladder = st.dead ? 0 : ladderState(map.ladders, p.pos, { x: mx, z: mz }, p.motion.onGround);
  const ev = stepMotion(p.motion, p.pos, { x: mx, z: mz }, { run, jumpPressed, jumpHeld, floor: platformFloor, ceil: platformCeil, ladder }, dt, speedCfg());
  resolveCollisions(p.pos, CONFIG.player.radius, map.colliders);
  collisionFeedback(p.motion, before, p.pos, dt);
  if (!st.dead && surfaceEffects(map.colliders, p.pos, p.motion, dt) === "bounce") showToast("🤸 Boing!", "#ffd21f");   // tapetes, carrosséis e trampolins
  if (st.cannon) { p.pos.x = st.cannon.x; p.pos.z = st.cannon.z; p.motion.vx = 0; p.motion.vz = 0; st.cannon.aim(cam.yaw + Math.PI, cam.pitch); }   // no canhão: fica no estrado e o canhão roda com a câmara
  if (!st.dead && ev.fall >= CONFIG.fallDeath && st.me && st.me.alive) st.world.eliminate(st.me, null, st.me.colorId, false, "fall");   // queda de muito alto
  if (!st.dead && st.me && st.me.alive && inWater(map.waters, p.pos, p.motion.onGround)) st.world.eliminate(st.me, null, st.me.colorId, false, "water");   // caiu ao rio
  if (!st.dead && !st.tutorial) Stats.current.distance += Math.hypot(p.pos.x - before.x, p.pos.z - before.z);

  // o boneco olha para onde se move
  const gspeed = Math.hypot(p.motion.vx, p.motion.vz);
  if (st.aimingGrenade && st.colors.current !== st.aimLastCol) {                     // a apontar a granada, as teclas 1/2/3 (e misturas) também mudam a cor dela
    st.aimLastCol = st.colors.current;
    st[st.grenadeSlot === 1 && st.grenadeColor2 ? "grenadeColor2" : "grenadeColor"] = st.colors.current;
  }
  if (st.healingT > 0) { st.healingT -= dt; if (st.dead) st.healingT = 0; else if (st.healingT <= 0) completeCure(); }
  setHeld(dummy, st.healingT > 0 ? "medkit" : st.aimingGrenade && !st.dead ? "grenade" : "gun", hexOf(st.grenadeColor), st.grenadeColor2 ? hexOf(st.grenadeColor2) : null);
  const fxk = Math.max(0, Math.min(1, (gspeed - MOTION.walk * 1.2) / (MOTION.run - MOTION.walk * 1.2))) * (st.dead ? 0 : 1);   // linhas de velocidade quando corres
  if (Math.abs(fxk - (st.speedFxK || 0)) > 0.04) { st.speedFxK = fxk; $("speedFx").style.opacity = String(fxk * 0.9); }
  if (p.aimLock > 0) p.aimLock -= dt;                               // a disparar, o boneco olha para onde apontas
  else if (gspeed > 0.6 && !p.motion.climbing) p.facing = lerpAngle(p.facing, Math.atan2(p.motion.vx, p.motion.vz), Math.min(1, dt * 14));
  const lad = p.motion.climbing ? ladderAt(map.ladders, p.pos) : null;
  if (lad) { hugLadder(lad, p.pos, p.motion, dt); p.facing = lerpAngle(p.facing, Math.atan2(-lad.nx, -lad.nz), Math.min(1, dt * 25)); }   // na escada: centrado e virado para ela
  dummy.position.set(p.pos.x, visualY(dummy, p.pos.y, p.motion.onGround, dt), p.pos.z);
  dummy.rotation.y = p.facing;
  animateCharacter(dummy, { speed: lad ? 0 : gspeed, maxSpeed: MOTION.run, onGround: p.motion.onGround, vy: p.motion.vy, landed: ev.landed, impact: ev.impact, climbing: !!lad, crouching: !!(st.me && st.me.crouching) }, dt, t);
  if (st.me) {                                                                       // celebração (Z): para se te mexeres, disparares ou fores eliminado
    if (Emotes.playing(st.me, now()) && (gspeed > 1.5 || st.firing || st.dead || st.aimingGrenade)) Emotes.stop(st.me);
    Emotes.apply(dummy, st.me, now());
  }
  trails.update(dt, p.pos, gspeed, Progress.wallet.equip.rasto, !st.dead && st.invisible <= 0 && !frozen && !st.ads);   // (invisível: sem rasto, senão denunciava-te)

  // bots
  const agents = [{ pos: p.pos }, ...st.bots];
  for (const b of st.bots) {
    if (frozen) {                                                          // contagem: parados, mas animados (é a animação que lhes dá o tamanho certo)
      if (b.model) b.model.position.set(b.pos.x, b.pos.y, b.pos.z), b.model.rotation.y = b.facing;   // repõe a posição em cada frame (a animação ajusta a altura a partir dela; sem isto iam subindo)
      if (b.model) animateCharacter(b.model, { speed: 0, maxSpeed: MOTION.run, onGround: true, vy: 0, landed: false, impact: 0, climbing: false, crouching: false }, dt, t);
      continue;
    }
    b.update(dt, t, map, agents, st.world);
    if (b.model) Emotes.apply(b.model, b, now());                                    // celebração depois de eliminar alguém
    if (b.model) {                                                                   // longe da câmara: versão leve (sem pormenores nem sombra); a margem evita piscar na fronteira
      const d = Math.hypot(b.pos.x - camera.position.x, b.pos.z - camera.position.z), far = b.model.userData.lod?.far;
      if (far ? d < LOD_NEAR : d > LOD_FAR) setCharacterLod(b.model, !far); else if (!b.model.userData.lod) setCharacterLod(b.model, false);
    }
    if (b.alive && !(b.puppet && st.net !== "host")) for (const g of st.pickups.collectNear(b.pos)) {
      if (b.puppet) net.give(b, g);                                           // um amigo apanhou: o prémio vai para o PC dele
      else if (g.type === "ammo") b.ammo[g.color] = Math.min(CONFIG.ammo.max, b.ammo[g.color] + (g.shots ?? CONFIG.ammoBox.shots));
      else if (g.type in b.items) b.items[g.type]++;                       // cura, granada e invisibilidade: ficam com o bot (se o colega apanhar, tu não podes usar)
    }
  }

  // tiros, munição, combate e vida
  for (const c of PRIMARIES) st.ammo[c] = Math.min(CONFIG.ammo.max, st.ammo[c] + CONFIG.ammo.regen * dt);   // os tanques recarregam devagar
  st.fireCd -= dt;
  if (st.cannon && st.firing && !st.dead) cannonFire();                    // no canhão o clique lança bolas (não gasta munição)
  else if (st.firing && !st.dead && !cam.aerial && st.fireCd <= 0 && !frozen) tryFire();
  if (!frozen) { st.gameTime += dt; st.world.update(dt, st.gameTime); st.features?.update(dt, performance.now()); if (!st.tutorial) replay.record(dt, st.gameTime); }
  updateTraps();
  updateAmmoUi();
  updateCombatUi(dt, t);
  updateMinimap(performance.now());

  // animações do mapa e baús
  for (const u of map.updaters) u(dt, t);
  updateChests(map.chests, dt, t);
  tickGolden();
  st.colors.update(dt);
  updateMixHint(dt);
  updateZoneTable(dt);
  updateInvisibility(dt);
  updateCrosshair(dummy);
  st.paint.update(dt);
  st.paint.flush();
  st.weather.cloudsVisible = !cam.aerial;
  st.weather.update(dt, t);
  for (const it of st.pickups.update(dt, t, p.pos, map.colliders)) gotItem(it);

  // round
  if (!frozen) { tickRound(dt); tickIntense(dt); tickMixShuffle(dt); }
  if (st.tutorial) {                                                              // tutorial: munição de sobra e passos
    for (const c of PRIMARIES) st.ammo[c] = Math.max(st.ammo[c], 40);
    st.tutorial.update(dt);
  }
  updateTimerStyle();
  roundSounds(st);
  const tl = fmtTime(st.roundTime);
  if (tl !== st.lastUiTimer) { $("hudTimer").textContent = tl; st.lastUiTimer = tl; }

  // indicação do baú mais próximo
  const pr = $("prompt"), c = nearestChest(), cn = !st.dead && !st.cannon ? st.features?.nearCannon?.(p.pos) : null;
  if (cn) {
    pr.textContent = cn.ready() ? `[E] Usar o canhão de tinta (${CONFIG.cannon.use} s)` : cn.user ? "Canhão ocupado" : `Canhão a recarregar… ${Math.ceil(cn.readyAt - st.world.t)} s`;
    pr.style.display = "block";
  } else if (st.cannon) { pr.textContent = `💥 Clica para disparar · E para sair · ${Math.ceil(st.cannon.left())} s`; pr.style.display = "block"; }
  else if (c && !st.dead && Math.hypot(c.x - p.pos.x, c.z - p.pos.z) <= CONFIG.chest.interactDist) {
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
  const focusH = st.me ? eyeY(st.me) - p.pos.y : 1.4 * CONFIG.player.scale;           // a câmara aponta para a cabeça (desce ao agachar)
  if (!cam.ready) { cam.focus.set(p.pos.x, p.pos.y + focusH, p.pos.z); cam.curDist = want; cam.ready = true; }
  const kxz = 1 - Math.exp(-dt * 16), ky = 1 - Math.exp(-dt * 9);
  cam.focus.x += (p.pos.x - cam.focus.x) * kxz; cam.focus.z += (p.pos.z - cam.focus.z) * kxz;
  cam.focus.y += (p.pos.y + focusH - cam.focus.y) * ky;
  const tx = aerial ? 0 : cam.focus.x, ty = aerial ? 0 : cam.focus.y, tz = aerial ? 0 : cam.focus.z;
  let dist = want;
  if (!aerial) {
    const safe = Math.max(1.8, cameraClearance(map.colliders, tx, ty, tz, dirx, diry, dirz, want));
    cam.curDist = safe < cam.curDist ? safe : cam.curDist + (safe - cam.curDist) * (1 - Math.exp(-dt * 4));   // aproxima logo, afasta devagar
    dist = cam.curDist;
  }
  camera.position.set(tx + dirx * dist, Math.max(0.6, ty + diry * dist), tz + dirz * dist);
  if (!aerial) {                                                                   // nunca sai da arena: junto ao muro de trás (ex.: na base) ficava por cima dele e o topo do muro tapava o ecrã
    camera.position.x = Math.max(-ARENA.halfX + 0.4, Math.min(ARENA.halfX - 0.4, camera.position.x));
    camera.position.z = Math.max(-ARENA.halfZ + 0.4, Math.min(ARENA.halfZ - 0.4, camera.position.z));
  }
  camera.lookAt(tx, ty, tz);
  if (st.ads && st.cannon) {                                                       // mirar no canhão: a câmara sobe por trás do canhão e olha para baixo, para a zona onde a bola cai
    const pt = Math.max(0.25, cam.pitch), cpt = Math.cos(pt), sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
    const cx = st.cannon.x + sy * CANNON_VIEW.back, cz = st.cannon.z + cy * CANNON_VIEW.back, ch = st.cannon.top + CANNON_VIEW.up;
    camera.position.set(cx, ch, cz);
    camera.lookAt(cx - sy * cpt, ch - Math.sin(pt), cz - cy * cpt);
  } else if (st.ads) {                                                             // mirar (botão direito): vista em 1.ª pessoa, a partir dos olhos do boneco
    const cpt = Math.cos(cam.pitch);
    const ey = st.me ? eyeY(st.me) : p.pos.y + 1.75 * CONFIG.player.scale;
    camera.position.set(p.pos.x, ey, p.pos.z);
    camera.lookAt(p.pos.x - Math.sin(cam.yaw) * cpt, ey - Math.sin(cam.pitch), p.pos.z - Math.cos(cam.yaw) * cpt);
  }
  if (!aerial && !st.ads && cam.pitch < LOW_PITCH) camera.rotateX(LOW_PITCH - cam.pitch);   // olhar para cima
  const fovWant = st.ads ? ADS_FOV : aerial ? 60 : 60 + 9 * clamp01((gspeed - MOTION.walk) / (MOTION.run - MOTION.walk));
  cam.fov += (fovWant - cam.fov) * (1 - Math.exp(-dt * 6));
  if (Math.abs(camera.fov - cam.fov) > 0.05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
}

// Apanhaste uma caixa (no teu PC, ou o anfitrião avisou que foste tu)
function gotItem(it) {
  Sfx.play(it.type === "ammo" ? "pickup" : "item");
  if (it.type === "ammo") {
    const sh = it.shots ?? CONFIG.ammoBox.shots;
    state.tutorial?.event("collected");
    Stats.current.got.ammo++; Stats.current.got.bullets += sh;
    addAmmo(it.color, sh);
    showToast(`+${sh} ${sh === 1 ? "bala" : "balas"} ${COLORS[it.color].name}`, "#" + COLORS[it.color].hex.toString(16).padStart(6, "0"));
  } else if (it.type === "invisible") {                               // guardada na lista; F para usar
    addLoot("invisible"); Stats.current.got.invisible++;
    showToast("👻 Invisibilidade — carrega em F para usar", "#9be7ff");
  } else {
    const r = CONFIG.rewards.find((x) => x.id === it.type);
    if (!r || !(it.type in state.loot)) return;
    addLoot(it.type); Stats.current.got[it.type]++;
    showToast(`+1 ${r.icon} ${r.label}${ITEM_KEYS[it.type] ? ` — carrega em ${ITEM_KEYS[it.type]} para usar` : ""}`, "#ffd21f");
  }
}

// Contador de FPS e redução automática de qualidade quando o jogo não aguenta
function trackPerformance(dt) {
  state.fpsFrames++; state.fpsTime += dt;
  if (state.grace > 0) state.grace -= dt;
  if (state.fpsTime < 0.5) return;
  const fps = state.fpsFrames / state.fpsTime;
  if (!state.paused) $("hudFps").textContent = `${Math.round(fps)} fps · ${renderer.info.render.calls} chamadas · ${QUALITY[state.quality].label}`;
  state.lowFpsTime = fps < QUALITY[state.quality].fps * 0.66 && state.grace <= 0 && !state.paused ? state.lowFpsTime + state.fpsTime : 0;
  state.fpsFrames = 0; state.fpsTime = 0;
  const i = QUALITY_IDS.indexOf(state.quality);
  if (state.lowFpsTime >= 3 && i < QUALITY_IDS.length - 1) {          // 3 s seguidos abaixo de 40 fps
    applyQuality(QUALITY_IDS[i + 1]);
    showToast(`FPS baixos: qualidade ${QUALITY[state.quality].label}`, "#ff8a1f");
    state.lowFpsTime = 0; state.grace = 4;
  }
}

// Há um ecrã por cima do jogo (pausa, estatísticas do round, melhorias, fim do jogo)? Então esconde tudo o que é do jogo a decorrer (ver index.html)
function syncOverlay() {
  const on = state.screen === "viewer" && (state.paused || state.intermission > 0 || state.over || !!state.upgradeChoices);
  if (on !== document.body.classList.contains("overlay")) document.body.classList.toggle("overlay", on);
}
function frame(now) {
  requestAnimationFrame(frame);
  syncOverlay();
  if (state.screen === "lobby") { renderer.shadowMap.needsUpdate = true; lobby?.render(now); return; }   // lobby: o boneco no palco 3D (30 fps)
  if (state.screen !== "viewer" || !state.map) return;
  // limita os fps (60 nas qualidades Alta/Média, 45 na Baixa, 30 na Silenciosa) e, em pausa, só redesenha 10 vezes por segundo: menos calor e ruído da ventoinha
  const Q = QUALITY[state.quality];
  if (now - lastDraw < (state.paused && !state.online ? 100 : 1000 / Q.fps - 1.5)) return;   // (com amigos o jogo continua na pausa)
  if (Q.shadows && (state.frameN = (state.frameN || 0) + 1) % Q.shadowEvery === 0) renderer.shadowMap.needsUpdate = true;
  lastDraw = now;
  const dt = Math.max(0, Math.min(0.05, (now - lastTime) / 1000));   // nunca negativo (o 1.º frame pode vir antes de lastTime)
  lastTime = now;
  if (state.replaying) replay.update(dt, now / 1000);   // repetição da melhor jogada: o resto do jogo fica parado
  else if ((!state.paused || state.online) && !(podium.active && !state.online)) update(dt, now / 1000);   // (no pódio, sozinho, o jogo por trás não precisa de andar: menos CPU)   // com amigos o jogo não para na pausa (os outros continuam a jogar)
  if (state.online) net.tick(dt);                                    // amigos: envia o teu boneco (ou, no anfitrião, o estado de todos)
  trackPerformance(dt);
  dmgNums.update(dt, camera, window.innerWidth, window.innerHeight);
  Sfx.listen(camera);                                                // os sons do mapa ouvem-se a partir da câmara
  if (podium.active) podium.render(now);                             // fim do jogo: o pódio fica no lugar do mapa
  else renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// ---------- CONQUISTAS (achievements.js): conta o que fazes e avisa logo quando fazes uma ----------
function achieve(what, a, b) {
  if (state.tutorial) return;
  Ach.track(what, a, b);
  for (const x of Ach.check()) { showToast(`🏅 Conquista: ${x.name}! ${Ach.prize(x).replace(" ", " +")}`, "#ffd21f"); lobby?.renderTop(); }
  for (const m of Missions.track(what, a, b)) { showToast(`📅 Missão feita: ${m.desc}! ${Missions.prize(m).replace(" ", " +")}`, "#47e06a"); lobby?.renderTop(); }
}

// ---------- JOGAR COM AMIGOS (salas: online.js; o jogo em rede: net-game.js; a ligação à partida: net-match.js) ----------
const { online, net, spawnIndex, netRosters, sendUpgrades, netCheckReady, netGo } = setupNetMatch({
  showToast, setPlayerOut, startMap, leaveViewer, updateScoreUi, pickUpgrade, endRound, startNextRound, mixesChanged,
  openChestFor, chestResult, paintPlayer, paintBot, showCountdown, gotItem, getLobby: () => lobby,
});
$("lbFriendsBtn").addEventListener("click", () => online.open());

// ---------- LOBBY: escolher o personagem (setas), loja e inventário ----------
lobby = createLobby({ renderer, template: null, getTemplate: (id) => botTemplate(id),
  onEquip: () => {
    const skin = (Progress.wallet.equip.boneco || "boneco_iniciante").slice(7);
    if (skin !== state.characterId) { lobbyCharacter(skin); return; }                // equipaste outra skin: muda o boneco
    applyCosmetics(dummy, Progress.wallet.equip); if (state.me) paintPlayer(state.playerColor);
  },
  onPanel: (t) => { for (const [id, on] of [["lbHomeBtn", !t], ["lbShopBtn", t === "shop"], ["lbInvBtn", t === "inv"], ["lbProfBtn", t === "profile"]]) $(id).classList.toggle("on", on); } });   // separador ativo
$("lbHomeBtn").addEventListener("click", () => lobby.closePanel());
$("misBtn").addEventListener("click", () => lobby.openPanel("missions"));
daily = createDailyScreen({ onClaim: (r) => { Sfx.play("golden"); lobby.renderTop(); lobby.flash(`🎁 Prémio do dia ${r.day}: ${prizeText(r)}`); } });
$("dailyBtn").addEventListener("click", () => daily.open());
const wheel = createWheelScreen({ onPrize: (r) => { lobby.renderTop(); refreshLevelBadge(); checkLevelUp(); lobby.flash(`🎡 Roda da sorte: ${r.text}`); } });
$("wheelBtn").addEventListener("click", () => wheel.open());
wheel.refresh();
if (state.screen === "lobby") daily.auto();
async function lobbyCharacter(id) {
  const c = charById(id);
  $("lbName").textContent = c.name; $("lbBlurb").textContent = c.desc;
  if (Progress.owns("boneco_" + id) && Progress.wallet.equip.boneco !== "boneco_" + id) Progress.equip("boneco_" + id);   // a skin mostrada fica equipada
  setCharacter(id);
  lobby.setModel(await botTemplate(id));
}
// setas do lobby: passam pelas skins que já tens (as outras compram-se na loja)
const stepChar = (d) => {
  const mine = CHARACTERS.filter((c) => Progress.owns("boneco_" + c.id)).map((c) => c.id), i = Math.max(0, mine.indexOf(state.characterId));
  lobbyCharacter(mine[(i + d + mine.length) % mine.length]);
};
$("lbPrev").addEventListener("click", () => stepChar(-1));
$("lbNext").addEventListener("click", () => stepChar(1));
$("lbShopBtn").addEventListener("click", () => lobby.openPanel("shop"));
$("lbInvBtn").addEventListener("click", () => lobby.openPanel("inv"));
$("lbProfBtn").addEventListener("click", () => lobby.openPanel("profile"));
window.addEventListener("keydown", (e) => {
  if (state.screen !== "lobby") return;
  if (settings.isOpen || document.activeElement?.tagName === "INPUT") return;        // (a escrever o nome no Perfil: as setas não mudam o boneco)                                                        // (as setas mexem nas barras das Configurações)
  if (daily.isOpen) { if (e.code === "Escape") daily.close(); return; }
  if (wheel.isOpen) { if (e.code === "Escape") wheel.close(); return; }
  if ($("mysteryBox").style.display === "flex") { if (e.code === "Escape") $("mysteryBox").style.display = "none"; return; }
  if (e.code === "Escape" && lobby.panelOpen) lobby.closePanel();
  else if (e.code === "ArrowLeft" && !lobby.panelOpen) stepChar(-1);
  else if (e.code === "ArrowRight" && !lobby.panelOpen) stepChar(1);
});
lobbyCharacter(state.characterId);
showScreen("title");                                                                // começa no ecrã inicial (logótipo); ENTRAR leva ao lobby
if (Progress.refundedItems) $("enterBtn").addEventListener("click", () => setTimeout(() => lobby.flash?.(`💰 Roupa, Cabeça e Costas saíram da loja: devolvemos-te ${Progress.refundedItems} ${Progress.refundedItems === 1 ? "item" : "itens"} em moedas e joias`), 600), { once: true });

// Modo de testes: abrir index.html?debug expõe o estado do jogo na consola (window.__ca)
if (DEBUG) window.__ca = { Sfx, showScreen, openStats, settings, online, net, startMap, setGameMode, CONFIG, MAPS, replay, lobby, Progress, renderer, setAds, showGameOver, tryFire, flushUpgradeFeed, startTutorial, FX, addLoot, applyUpgrades, speedCfg, setPaused, endRound, pickUpgrade, state, camera, scene, tryOpenChest, nearestChest, setCharacter, reportKill, tryFire, paintBot };
