/* ============================================================
   JOGAR COM AMIGOS: salas com código (só as ligações e a janela "Jogar com amigos").
   Um jogador cria a sala (é o "anfitrião") e os outros entram com o código de 4 letras.
   As ligações são diretas entre os PCs (WebRTC, pela biblioteca PeerJS); o servidor grátis do PeerJS só serve
   para os PCs se encontrarem. Os convidados só falam com o anfitrião; o PC do anfitrião é que manda no jogo
   (bots, tiros que acertam, eliminações, pontos, rounds, baús) — ver net-game.js.
   Mensagens da sala (o resto vai para hooks.onGame):
     hi    convidado → anfitrião   { name, skin, equip }                 quem sou
     room  anfitrião → todos       { players: [{ id, name, skin, equip, team, slot }], playing }
     full  anfitrião → convidado   a sala está cheia
   A biblioteca (vendor/peerjs.min.js) só é carregada quando se carrega em "Criar sala" ou "Entrar": quem joga sozinho não gasta nada.
   ============================================================ */
const PEERJS = "vendor/peerjs.min.js";                                                // PeerJS 1.5.4 guardado no jogo (cria window.peerjs)
const PREFIX = "colorattack-sala-";
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";                                         // sem I nem O (confundem-se com 1 e 0)
const MAX_PLAYERS = 10;                                                               // 5 contra 5
const newCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("");

let _Peer = null;
function loadPeer() {
  if (window.peerjs) _Peer = window.peerjs.Peer;
  if (_Peer) return Promise.resolve(_Peer);
  return new Promise((res, rej) => {
    const sc = document.createElement("script");
    sc.src = PEERJS;
    sc.onload = () => { _Peer = window.peerjs?.Peer; if (_Peer) res(_Peer); else rej(new Error("PeerJS")); };
    sc.onerror = rej;
    document.head.appendChild(sc);
  });
}

// hooks: getProfile() → { name, skin, equip }, setName(n), onGame(msg, deQuem), onLeft(id) (anfitrião: um convidado saiu),
//        onClosed(eraConvidado) (a sala fechou), flash(texto)
export function createOnline(hooks) {
  const $ = (id) => document.getElementById(id);
  const room = { peer: null, code: "", host: false, conns: new Map(), players: [], myId: "", hostConn: null, playing: false };
  let status = "";

  const inRoom = () => !!room.code && (room.host || !!room.hostConn);
  function sendConn(conn, msg) { if (conn?.open) conn.send(msg); }
  const send = (msg) => sendConn(room.hostConn, msg);                                // convidado → anfitrião
  const sendTo = (id, msg) => sendConn(room.conns.get(id), msg);                     // anfitrião → um convidado
  function broadcast(msg, except = null) { for (const [id, c] of room.conns) if (id !== except) sendConn(c, msg); }   // anfitrião → todos (menos `except`)

  function assignTeams() {                                                            // ordem de entrada: A, B, A, B... (o anfitrião é o 1.º da equipa A)
    room.players.forEach((p, i) => { p.team = i % 2 ? "B" : "A"; p.slot = Math.floor(i / 2); });
    broadcast({ t: "room", players: room.players, playing: room.playing });
    render();
  }

  async function createRoom() {
    setStatus("A criar a sala…");
    let Peer;
    try { Peer = await loadPeer(); } catch { setStatus("Não foi possível carregar as salas."); return; }
    for (let tries = 0; tries < 5; tries++) {                                         // o código pode já estar ocupado: tenta outro
      const code = newCode();
      const ok = await new Promise((res) => {
        const peer = new Peer(PREFIX + code);
        peer.on("open", () => { room.peer = peer; room.code = code; room.host = true; room.myId = peer.id; res(true); });
        peer.on("error", (e) => { if (!room.peer) { peer.destroy(); res(false); } else onPeerError(e); });
      });
      if (!ok) continue;
      room.players = [{ id: room.myId, ...hooks.getProfile() }];
      room.peer.on("connection", onGuest);
      room.peer.on("disconnected", () => room.peer?.reconnect());                      // perdeu o servidor de encontro (as ligações já feitas continuam)
      assignTeams();
      setStatus("");
      return;
    }
    setStatus("Não foi possível criar a sala. Tenta outra vez.");
  }

  function onGuest(conn) {
    conn.on("open", () => {
      if (room.players.length >= MAX_PLAYERS) { sendConn(conn, { t: "full" }); setTimeout(() => conn.close(), 300); return; }
      room.conns.set(conn.peer, conn);
    });
    conn.on("data", (m) => {
      if (!m || typeof m !== "object" || !room.conns.has(conn.peer)) return;
      if (m.t === "hi") {
        room.players = room.players.filter((p) => p.id !== conn.peer);
        room.players.push({ id: conn.peer, name: String(m.name || "Amigo").slice(0, 14), skin: String(m.skin || ""), equip: m.equip || {} });
        assignTeams();
        hooks.flash?.(`👋 ${m.name || "Um amigo"} entrou na sala${room.playing ? " (joga na próxima partida)" : ""}`);
      } else hooks.onGame(m, conn.peer);
    });
    conn.on("close", () => dropGuest(conn.peer));
    conn.on("error", () => dropGuest(conn.peer));
  }
  function dropGuest(id) {
    if (!room.conns.has(id)) return;
    room.conns.delete(id);
    const p = room.players.find((x) => x.id === id);
    room.players = room.players.filter((x) => x.id !== id);
    hooks.onLeft?.(id);
    assignTeams();
    if (p) hooks.flash?.(`🚪 ${p.name} saiu da sala`);
  }

  async function joinRoom(code) {
    code = code.toUpperCase().replace(/[^A-Z]/g, "");
    if (code.length !== 4) { setStatus("O código tem 4 letras."); return; }
    setStatus("A entrar…");
    let Peer;
    try { Peer = await loadPeer(); } catch { setStatus("Não foi possível carregar as salas."); return; }
    const peer = new Peer();
    room.peer = peer;
    peer.on("error", onPeerError);
    peer.on("open", (id) => {
      room.myId = id;
      const conn = peer.connect(PREFIX + code, { serialization: "json", reliable: true });
      conn.on("open", () => {
        room.code = code; room.host = false; room.hostConn = conn;
        sendConn(conn, { t: "hi", ...hooks.getProfile() });
        setStatus("");
        render();
      });
      conn.on("data", (m) => {
        if (!m || typeof m !== "object") return;
        if (m.t === "room") { room.players = m.players; room.playing = !!m.playing; render(); }
        else if (m.t === "full") { leaveRoom(true); setStatus("A sala está cheia (10 jogadores)."); }
        else hooks.onGame(m, "host");
      });
      conn.on("close", () => { if (room.hostConn === conn) { leaveRoom(true); hooks.flash?.("🚪 O anfitrião fechou a sala"); } });
    });
  }
  function onPeerError(e) {
    if (e?.type === "peer-unavailable") { leaveRoom(true); setStatus("Sala não encontrada. Confirma o código."); }
    else if (e?.type === "network" || e?.type === "server-error") setStatus("Sem ligação ao servidor das salas: confirma a internet.");
    else console.warn("PeerJS:", e);
  }

  function leaveRoom(quiet = false) {
    const wasIn = inRoom(), wasGuest = wasIn && !room.host;
    const conns = [...room.conns.values()], hostConn = room.hostConn, peer = room.peer;
    Object.assign(room, { peer: null, code: "", host: false, conns: new Map(), players: [], myId: "", hostConn: null, playing: false });
    for (const c of conns) c.close();
    hostConn?.close();
    peer?.destroy();
    if (wasIn && !quiet) setStatus("");
    if (wasIn) hooks.onClosed?.(wasGuest);
    render();
  }
  // anfitrião: há uma partida a decorrer? (quem entra a meio fica à espera da próxima)
  function setPlaying(on) {
    if (!room.host || room.playing === on) return;
    room.playing = on;
    broadcast({ t: "room", players: room.players, playing: on });
  }

  // ---------- janela "Jogar com amigos" ----------
  const box = document.createElement("div");
  box.id = "friendsBox";
  box.innerHTML = `<div class="fbCard">
    <div class="fbHead"><h3>👥 Jogar com amigos</h3><button class="fbX" title="Fechar">&#10005;</button></div>
    <div class="fbBody"></div><div class="fbStatus"></div></div>`;
  document.body.appendChild(box);
  box.querySelector(".fbX").addEventListener("click", () => close());
  box.addEventListener("click", (e) => { if (e.target === box) close(); });
  const body = box.querySelector(".fbBody");
  function setStatus(s) { status = s; box.querySelector(".fbStatus").textContent = s; }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const me = () => room.players.find((p) => p.id === room.myId);

  function render() {
    const btn = $("lbFriendsBtn");
    if (btn) { btn.innerHTML = inRoom() ? `👥 <b>${room.code}</b>` : "👥 Amigos"; btn.title = inRoom() ? "A tua sala de amigos" : "Jogar com amigos"; }
    $("playBtn")?.classList.toggle("waiting", inRoom() && !room.host);
    if (!inRoom()) {
      body.innerHTML = `
        <label class="fbName">O teu nome <input id="fbName" maxlength="14" value="${esc(hooks.getProfile().name)}"></label>
        <button id="fbCreate" class="fbBig">➕ Criar sala</button>
        <div class="fbOr">ou entra na sala de um amigo</div>
        <div class="fbJoin"><input id="fbCode" maxlength="4" placeholder="CÓDIGO" autocomplete="off" spellcheck="false"><button id="fbJoinBtn" class="fbBig">Entrar</button></div>
        <small class="fbHint">Não é preciso conta. Quem cria a sala escolhe o mapa; os outros entram com o código.</small>`;
      const nm = body.querySelector("#fbName");
      const name = () => { hooks.setName(nm.value.trim() || "Jogador"); };
      nm.addEventListener("change", name);
      body.querySelector("#fbCreate").addEventListener("click", () => { name(); createRoom(); });
      const code = body.querySelector("#fbCode");
      code.addEventListener("input", () => { code.value = code.value.toUpperCase().replace(/[^A-Z]/g, ""); });
      code.addEventListener("keydown", (e) => { if (e.key === "Enter") body.querySelector("#fbJoinBtn").click(); });
      body.querySelector("#fbJoinBtn").addEventListener("click", () => { name(); joinRoom(code.value); });
      return;
    }
    const mine = me()?.team || "A", other = mine === "A" ? "B" : "A";
    const col = (t) => (t === mine ? "#4da8ff" : "#ff4455");
    const list = (t) => room.players.filter((p) => p.team === t).map((p) => `<li style="--c:${col(t)}">${esc(p.name)}${p.id === room.myId ? " <i>(tu)</i>" : ""}${p.id === room.players[0]?.id ? " 👑" : ""}</li>`).join("") || "<li class='fbNone'>—</li>";
    const bots = (t) => { const n = 5 - room.players.filter((p) => p.team === t).length; return n ? `<small class="fbBots">+ ${n} ${n === 1 ? "bot" : "bots"}</small>` : ""; };
    body.innerHTML = `
      <div class="fbCode"><small>Código da sala</small><b>${room.code}</b><button id="fbCopy" class="fbSmall">📋 Copiar</button></div>
      <div class="fbTeams"><div><h4 style="color:${col(mine)}">A tua equipa</h4><ul>${list(mine)}</ul>${bots(mine)}</div><div><h4 style="color:${col(other)}">Equipa adversária</h4><ul>${list(other)}</ul>${bots(other)}</div></div>
      <small class="fbHint">${room.host ? "Manda o código aos teus amigos. Quando estiverem todos, carrega em <b>JOGAR</b> e escolhe o mapa: eles entram contigo. Os lugares vazios ficam com bots." : room.playing ? "Há uma partida a decorrer: entras na próxima, quando o anfitrião (👑) começar outra." : "Estás na sala! Espera que o anfitrião (👑) escolha o mapa: a partida começa sozinha."}</small>
      <button id="fbLeave" class="fbSmall danger">Sair da sala</button>`;
    body.querySelector("#fbCopy").addEventListener("click", () => { navigator.clipboard?.writeText(room.code); setStatus("Código copiado!"); });
    body.querySelector("#fbLeave").addEventListener("click", () => leaveRoom());
  }
  function open() { render(); setStatus(status); box.classList.add("open"); }
  function close() { box.classList.remove("open"); }
  render();

  return {
    open, close, send, sendTo, broadcast, leaveRoom, setPlaying,
    get inRoom() { return inRoom(); },
    get isHost() { return room.host; },
    get isGuest() { return inRoom() && !room.host; },
    get me() { return me(); },
    get myId() { return room.myId; },
    get players() { return room.players; },
    get room() { return room; },                                                      // (testes)
  };
}
