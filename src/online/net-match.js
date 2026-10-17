import { CONFIG, BOT_PRESETS, MATCH_TO_WIN, ROUND_MINUTES, MODES } from "../base/game-config.js";
import { MAPS } from "../mapas/map-definitions.js";
import { disposeCharacter } from "../personagens/character-model.js";
import { COLORS, setMixes } from "../base/colors.js";
import * as Progress from "../progresso/progress.js";
import * as Ach from "../progresso/achievements.js";
import { createOnline } from "./online.js";
import { createNetGame } from "./net-game.js";
import { state, $, nameOf } from "../jogo/game-state.js";
import { playerName, setPlayerName } from "../progresso/player-name.js";

/* ============================================================
   JOGAR COM AMIGOS: a ligação entre as salas (online.js), o jogo em rede (net-game.js) e a partida (map-viewer.js)
   - Lugares e nomes de cada jogador como o anfitrião os mandou; o teu boneco para os outros PCs.
   - Mensagens que não são do combate: começar a partida/round, fim, baús, canhão, misturas, "Começar round"...
   - Um amigo que sai: o boneco dele sai do jogo.
   G = funções da partida que isto precisa de chamar (vêm do map-viewer.js): showToast, startMap, endRound, ...
   ============================================================ */

export function setupNetMatch(G) {
  const { showToast, setPlayerOut, startMap, leaveViewer, updateScoreUi, pickUpgrade, endRound, startNextRound, mixesChanged,
    openChestFor, chestResult, paintPlayer, paintBot, showCountdown, gotItem, getLobby } = G;
  // Lugar na base de cada número da equipa (como o anfitrião a vê): na equipa A o 1.º fica no do meio (A[2])
  function spawnIndex(team, i) {
    const canon = state.netFlip ? (team === "A" ? "B" : "A") : team;
    return canon === "A" ? [2, 0, 1, 3, 4][i] : i;
  }
  // Nomes e skins de todos os lugares, como o anfitrião os mandou (trocados se fores da equipa B dele); o teu nome passa a "Tu"
  function netRosters(r) {
    const f = state.netFlip, out = { A: [...(f ? r.B : r.A)], B: [...(f ? r.A : r.B)], names: { A: [...(f ? r.names.B : r.names.A)], B: [...(f ? r.names.A : r.names.B)] },
      extra: r.extra ? { A: f ? r.extra.B : r.extra.A, B: f ? r.extra.A : r.extra.B } : null };
    out.names.A[state.myIndex] = "Tu";
    return out;
  }
  // O teu boneco, para os outros PCs: [x, y, z, para onde olha, velocidade, no chão, vy, escada, agachado, mão, escondido]
  function localNet() {
    const p = state.player, st = state, m = p.motion;
    return [p.pos.x, p.pos.y, p.pos.z, p.facing, Math.hypot(m.vx, m.vz), m.onGround ? 1 : 0, m.vy, m.climbing ? 1 : 0, st.me?.crouching ? 1 : 0,
      st.healingT > 0 ? 2 : st.aimingGrenade && !st.dead ? 1 : 0, st.dead || st.invisible > 0 ? 1 : 0];
  }
  function sendUpgrades(full) {
    const me = state.me;
    if (me) online.send({ t: "upg", maxHp: me.maxHp, pierce: me.pierce || 0, damageMul: me.damageMul || 1, grenadeMul: me.grenadeMul || 1, full });
  }
  // anfitrião: todos os convidados já têm o mapa carregado? Então começa a contagem em todos ao mesmo tempo
  function netCheckReady() {
    if (state.net !== "host" || !state.netWait) return;
    const guests = state.netPlayers.filter((p) => p.peer !== online.myId && online.room.conns.has(p.peer));
    if (guests.every((p) => state.netReady.has(p.peer))) netGo();
  }
  function netGo() {
    if (!state.netWait) return;
    state.netWait = false; showCountdown("");
    if (state.net === "host") online.broadcast({ t: "go" });
  }
  // anfitrião: um amigo saiu da partida (ou da sala): o boneco dele sai do jogo
  function dropFriend(peer) {
    const p = state.bots.find((b) => b.peer === peer);
    state.netPlayers = state.netPlayers.filter((x) => x.peer !== peer);
    if (state.netWait) netCheckReady();
    if (p && state.world) removeCombatant(p);
  }
  function removeCombatant(p) {
    p.alive = false;
    p.model?.parent?.remove(p.model);
    if (p.model) disposeCharacter(p.model);
    state.bots = state.bots.filter((b) => b !== p);
    if (state.world) state.world.combatants = state.world.combatants.filter((c) => c !== p);
    setPlayerOut(p.team, p.index, true);
    showToast(`🚪 ${nameOf(p)} saiu da partida`, "#ffd21f");
  }
  // mensagens do jogo que não são do combate (início, fim, rounds, baús...)
  function onNetOther(m, from, who) {
    if (state.net === "host" || (online.isHost && !state.net)) {                         // ---- no anfitrião (de um convidado)
      if (m.t === "ready") { state.netReady?.add(from); netCheckReady(); }
      else if (m.t === "next" && state.intermission > 0 && !state.over) startNextRound();   // um amigo carregou em "Começar round"
      else if (m.t === "away") dropFriend(from);
      else if (m.t === "cn" && who && state.features) {                                // um amigo no canhão
        const cn = state.features.cannons[m.i];
        if (!cn) return;
        if (m.a === "mount" && who.alive && Math.hypot(who.pos.x - cn.x, who.pos.z - cn.z) < 3.5) cn.mount(who);
        else if (m.a === "leave" && cn.user === who) cn.leave();
        else if (m.a === "fire" && cn.user === who && COLORS[m.c]) { cn.fireCd = 0; cn.fire(m.x, m.z, m.c); }   // (o ritmo dos tiros já é contado no PC do amigo)
      }
      else if (m.t === "chest" && who?.alive && state.map && !state.netWait) {
        const c = state.map.chests[m.i];
        if (!c || Math.hypot(c.x - who.pos.x, c.z - who.pos.z) > CONFIG.chest.interactDist + 1.5) return;
        const out = openChestFor(c);
        if (!out) return;
        online.sendTo(from, { t: "chr", ...out });
        if (out.golden) showToast(`🌟 ${nameOf(who)} (${who.team === "A" ? "colega" : "adversário"}) abriu o baú dourado`, who.team === "A" ? "#4da8ff" : "#ff4455");
      }
      return;
    }
    // ---- no convidado (do anfitrião)
    if (m.t === "start") {
      if (!m.players?.some((p) => p.peer === online.myId)) return;                      // entraste a meio: jogas na próxima partida
      const def = MAPS.find((x) => x.id === m.map);
      if (!def) return;
      if (m.kept) {                                                                      // round seguinte
        if (state.screen !== "viewer" || !state.round) return;                           // (já tinhas saído da partida)
        if (state.upgradeChoices) pickUpgrade(Math.floor(Math.random() * state.upgradeChoices.length));   // não escolheste a tempo: melhoria à sorte
        $("roundBox").style.display = "none";
        state.round.n = m.n; state.round.kills = { A: 0, B: 0 }; state.round.sudden = false;
      } else {                                                                           // partida nova: as regras do anfitrião (sem gravar: as tuas ficam para quando jogares sozinho)
        state.soloOpts ||= { mode: CONFIG.mode, secs: CONFIG.roundSeconds, toWin: CONFIG.match.toWin, diff: CONFIG.botDifficulty };
        if (MODES[m.mode]) CONFIG.mode = m.mode;
        if (BOT_PRESETS[m.diff]) CONFIG.botDifficulty = m.diff;                          // (as moedas da vitória dependem da dificuldade dos bots do anfitrião)
        if (ROUND_MINUTES.includes(m.minutes)) CONFIG.roundSeconds = m.minutes * 60;
        if (MATCH_TO_WIN.includes(m.toWin)) { CONFIG.match.toWin = m.toWin; CONFIG.match.maxRounds = 2 * m.toWin - 1; CONFIG.match.intenseAt = Math.max(2, m.toWin - 1); }
        $("gameOver").style.display = "none"; $("roundBox").style.display = "none";
      }
      online.close();
      state.forceWeather = m.weather; state.netStart = m;
      startMap(def, !!m.kept);
    } else if (state.net !== "guest") return;
    else if (m.t === "go") netGo();
    else if (m.t === "pre") MAPS.find((x) => x.id === m.map)?.load?.preload?.();          // o anfitrião já escolheu o mapa seguinte: começa a carregá-lo
    else if (m.t === "end" && "w" in m) endRound(state.netFlip ? (m.w === "A" ? "B" : "A") : m.w, true);
    else if (m.t === "end") { showToast("🚪 O anfitrião terminou a partida", "#ffd21f"); leaveViewer(); }
    else if (m.t === "hot") showToast("🔥 As cores mudaram!", "#ff8a1f");
    else if (m.t === "ft") state.features?.onEvent(m.ev);
    else if (m.t === "mix") { setMixes(m.p); mixesChanged(); }
    else if (m.t === "got") gotItem(m);
    else if (m.t === "chr") chestResult(m);
  }
  const online = createOnline({
    getProfile: () => ({ name: playerName(), skin: state.characterId, equip: { arma: Progress.wallet.equip.arma, autocolante: Progress.wallet.equip.autocolante }, title: Ach.titleName() }),
    setName: (n) => setPlayerName(n),
    onGame: (m, from) => net.onMessage(m, from),
    onLeft: (peer) => dropFriend(peer),
    onClosed: (wasGuest) => { if (wasGuest && state.net === "guest") { showToast("🚪 A sala fechou", "#ffd21f"); leaveViewer(); } else if (state.net === "host") { state.online = false; state.net = null; net.stop(); } },
    flash: (t) => { if (state.screen === "viewer") showToast(t, "#9be7ff"); else getLobby()?.flash(t); },
  });
  const net = createNetGame({
    online, state, localNet, paintPlayer, paintBot, nameOf, removeCombatant, onOther: onNetOther,
    toast: showToast, scoreUi: () => updateScoreUi(),
  });
  return { online, net, spawnIndex, netRosters, sendUpgrades, netCheckReady, netGo };
}
