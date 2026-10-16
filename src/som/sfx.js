/* ============================================================
   SONS DO JOGO: todos feitos na hora com Web Audio (ondas e ruído com filtros), sem ficheiros de som.
   - Sfx.play(nome): som "teu" (sem posição: o teu tiro, apanhaste um item, a contagem...)
   - Sfx.at(nome, x, z): som no mapa: mais baixo ao longe (nada a mais de 60 m) e à esquerda/direita conforme a câmara
   - Sfx.listen(camera): em cada frame, de onde se ouve
   - Sfx.ambient({ rain, wind }): chuva e vento em fundo (um ruído em ciclo, criado uma vez)
   - Volumes (0 a 1) por grupo — geral, efeitos (tiros, baús, mapas), relógio (contagem, tique-taque), clima (chuva, vento, trovões) —
     guardados no navegador; mudam-se nas Configurações do lobby (e o geral também no menu da pausa).
   - Com o jogo minimizado ou noutra janela fica tudo em silêncio (opção "mudo em segundo plano").
   Leve: cada som são 2-6 nós de áudio que se apagam sozinhos quando acabam; no máximo 24 sons ao mesmo tempo,
   e os tiros repetidos muito juntos (vários bots ao mesmo tempo) são juntados.
   ============================================================ */
const VOL_KEY = "colorattack.sound";
export const VOLUMES = [1, 0.6, 0.3, 0];                                            // passos do botão da pausa (volume geral)
export const GROUPS = ["efeitos", "relogio", "clima"];
const opts = { geral: 1, efeitos: 1, relogio: 0.7, clima: 0.6, bgMute: true };
try { Object.assign(opts, JSON.parse(localStorage.getItem(VOL_KEY)) || {}); } catch { /* ignora */ }
const save = () => { try { localStorage.setItem(VOL_KEY, JSON.stringify(opts)); } catch { /* ignora */ } };
const GROUP_OF = { thunder: "clima", beep: "relogio", go: "relogio", tick: "relogio", tick2: "relogio", alarm: "relogio" };   // o resto é "efeitos"
let ac = null, master = null, groups = {}, away = false, noiseBuf = null, live = 0, amb = null, base = 0;   // base: atraso extra (só na gravação de teste)
const counts = {};                                                                  // quantas vezes tocou cada som (testes)
const lis = { x: 0, z: 0, fx: 0, fz: -1 };
const last = {};                                                                    // quando tocou cada som pela última vez (para não acumular)
const MAX_LIVE = 24, FAR = 60;

function audio() {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = masterGain();
      const comp = ac.createDynamicsCompressor();                                    // muitos sons juntos não "rebentam"
      master.connect(comp); comp.connect(ac.destination);
      for (const g of GROUPS) { groups[g] = ac.createGain(); groups[g].gain.value = opts[g]; groups[g].connect(master); }
      const n = ac.sampleRate;                                                       // 1 s de ruído branco, reutilizado por todos os sons
      noiseBuf = ac.createBuffer(1, n, n);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch { ac = null; return null; }
  }
  if (ac.state === "suspended") ac.resume();
  return ac;
}
// o navegador só deixa tocar som depois de o jogador clicar/carregar numa tecla
for (const ev of ["pointerdown", "keydown"]) window.addEventListener(ev, () => { if (opts.geral > 0) audio(); }, { capture: true, passive: true });
const masterGain = () => (away ? 0 : opts.geral * 0.8);
const setGain = (node, v) => { if (node && ac) node.gain.setTargetAtTime(v, ac.currentTime, 0.05); };
// jogo minimizado / noutra janela: silêncio (e o áudio pára de trabalhar)
function checkAway() {
  const a = opts.bgMute && (document.hidden || !document.hasFocus());
  if (a === away) return;
  away = a;
  if (!ac) return;
  if (away) { setGain(master, 0); setTimeout(() => { if (away) ac.suspend(); }, 120); }
  else { ac.resume(); setGain(master, masterGain()); }
}
for (const ev of ["blur", "focus"]) window.addEventListener(ev, checkAway);
document.addEventListener("visibilitychange", checkAway);

// ---------- peças ----------
// envelope: sobe em `a` s até `g`, desce até ~0 no fim (`dur`)
function env(node, t, g, dur, a = 0.005) {
  node.gain.setValueAtTime(0.0001, t);
  node.gain.linearRampToValueAtTime(g, t + a);
  node.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
let soundEnd = 0;                                                                   // quando acaba o som que está a ser criado (para contar os sons a tocar)
function out(dest, t, dur) { soundEnd = Math.max(soundEnd, t + dur); return dest; }
// onda: frequência f1 → f2 em `dur` s
function tone(dest, { f1, f2 = f1, dur, type = "sine", g = 0.3, at = 0, a }) {
  const t = ac.currentTime + base + at, o = ac.createOscillator(), e = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f1, t);
  if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  env(e, t, g, dur, a); o.connect(e); e.connect(out(dest, t, dur));
  o.start(t); o.stop(t + dur + 0.02);
}
// ruído filtrado: frequência do filtro f1 → f2
function noise(dest, { f1, f2 = f1, dur, type = "bandpass", q = 1, g = 0.3, at = 0, a }) {
  const t = ac.currentTime + base + at, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), e = ac.createGain();
  s.buffer = noiseBuf; s.loop = dur > 0.9;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f1, t);
  if (f2 !== f1) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  env(e, t, g, dur, a); s.connect(fl); fl.connect(e); e.connect(out(dest, t, dur));
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
const notes = (dest, fs, step, opts) => fs.forEach((f, i) => tone(dest, { f1: f, dur: 0.22, type: "triangle", g: 0.18, ...opts, at: i * step + (opts?.at || 0) }));
const r = (k = 0.08) => 1 + (Math.random() * 2 - 1) * k;                            // pequena variação (o mesmo som não soa sempre igual)

// ---------- os sons ----------
const SOUNDS = {
  // tiros e combate
  shot: (d) => { const k = r(); tone(d, { f1: 720 * k, f2: 210 * k, dur: 0.09, g: 0.22 }); noise(d, { f1: 2400, dur: 0.035, g: 0.1, q: 0.8 }); },
  shotMe: (d) => { const k = r(0.05); tone(d, { f1: 760 * k, f2: 230 * k, dur: 0.1, g: 0.2 }); noise(d, { f1: 2600, dur: 0.04, g: 0.09, q: 0.8 }); },
  hit: (d) => { noise(d, { f1: 1100, f2: 380, dur: 0.13, g: 0.35, q: 1.2 }); tone(d, { f1: 190, f2: 90, dur: 0.08, g: 0.2 }); },
  hitMe: (d) => tone(d, { f1: 1500, dur: 0.05, type: "triangle", g: 0.14 }),             // acertaste em alguém
  hurt: (d) => { tone(d, { f1: 320, f2: 140, dur: 0.14, type: "triangle", g: 0.22 }); noise(d, { f1: 700, dur: 0.1, g: 0.15 }); },
  elim: (d) => { noise(d, { f1: 1300, f2: 260, dur: 0.38, type: "lowpass", g: 0.5 }); tone(d, { f1: 150, f2: 50, dur: 0.28, g: 0.35 }); },
  kill: (d) => notes(d, [880, 1320], 0.08, { g: 0.2 }),                                   // eliminaste alguém
  dead: (d) => { tone(d, { f1: 420, f2: 90, dur: 0.7, type: "sawtooth", g: 0.12 }); noise(d, { f1: 800, f2: 150, dur: 0.5, type: "lowpass", g: 0.2 }); },
  throw: (d) => noise(d, { f1: 400, f2: 1600, dur: 0.25, g: 0.14, q: 2, a: 0.08 }),
  boom: (d) => { noise(d, { f1: 1000, f2: 140, dur: 0.6, type: "lowpass", g: 0.7 }); tone(d, { f1: 95, f2: 38, dur: 0.42, g: 0.55 }); noise(d, { f1: 1800, f2: 600, dur: 0.25, g: 0.2, at: 0.03 }); },
  trap: (d) => { tone(d, { f1: 900, f2: 300, dur: 0.06, type: "square", g: 0.1 }); noise(d, { f1: 900, f2: 200, dur: 0.4, type: "lowpass", g: 0.45, at: 0.04 }); },
  cannon: (d) => { tone(d, { f1: 75, f2: 32, dur: 0.6, g: 0.9 }); noise(d, { f1: 700, f2: 120, dur: 0.55, type: "lowpass", g: 0.7 }); noise(d, { f1: 3000, dur: 0.06, g: 0.2 }); },
  bigBoom: (d) => { noise(d, { f1: 800, f2: 90, dur: 0.9, type: "lowpass", g: 0.85 }); tone(d, { f1: 70, f2: 28, dur: 0.7, g: 0.7 }); noise(d, { f1: 1600, f2: 400, dur: 0.4, g: 0.25, at: 0.05 }); },
  // baús e itens
  chest: (d) => { noise(d, { f1: 450, f2: 300, dur: 0.18, g: 0.25, q: 3 }); notes(d, [660, 880, 1100], 0.06, { at: 0.1, g: 0.16 }); },
  chestEmpty: (d) => { tone(d, { f1: 130, f2: 60, dur: 0.2, g: 0.35 }); noise(d, { f1: 600, f2: 200, dur: 0.35, type: "lowpass", g: 0.25, at: 0.05, a: 0.05 }); },
  golden: (d) => { notes(d, [523, 659, 784, 1046], 0.09, { g: 0.2, dur: 0.35 }); noise(d, { f1: 6000, dur: 0.8, g: 0.06, q: 0.5, at: 0.1, a: 0.1 }); },
  goldSpawn: (d) => { notes(d, [1046, 1318, 1568, 2093], 0.07, { type: "sine", g: 0.13, dur: 0.5 }); },
  pickup: (d) => tone(d, { f1: 620, f2: 1250, dur: 0.09, type: "triangle", g: 0.15 }),
  item: (d) => notes(d, [784, 1175], 0.06, { g: 0.15, dur: 0.15 }),
  heal: (d) => notes(d, [523, 659, 784, 1046], 0.05, { type: "sine", g: 0.12, dur: 0.3 }),
  invis: (d) => noise(d, { f1: 3000, f2: 300, dur: 0.5, g: 0.18, q: 3, a: 0.05 }),
  // relógio e rounds
  beep: (d) => tone(d, { f1: 523, dur: 0.16, type: "square", g: 0.08 }),
  go: (d) => { tone(d, { f1: 1046, dur: 0.4, type: "square", g: 0.08 }); tone(d, { f1: 1568, dur: 0.4, type: "triangle", g: 0.1 }); },
  tick: (d) => { tone(d, { f1: 1150, dur: 0.035, type: "square", g: 0.06 }); noise(d, { f1: 2500, dur: 0.02, g: 0.08 }); },
  tick2: (d) => { tone(d, { f1: 1550, dur: 0.06, type: "square", g: 0.08 }); noise(d, { f1: 3000, dur: 0.02, g: 0.1 }); },
  alarm: (d) => { for (let i = 0; i < 3; i++) { tone(d, { f1: 880, dur: 0.14, type: "square", g: 0.07, at: i * 0.3 }); tone(d, { f1: 660, dur: 0.14, type: "square", g: 0.07, at: i * 0.3 + 0.15 }); } },
  whoosh: (d) => noise(d, { f1: 300, f2: 3200, dur: 0.45, g: 0.22, q: 1.5, a: 0.15 }),
  win: (d) => notes(d, [523, 659, 784, 1046], 0.11, { g: 0.2, dur: 0.4 }),
  lose: (d) => notes(d, [523, 466, 392, 311], 0.14, { g: 0.16, dur: 0.45, type: "sine" }),
  // coisas dos mapas
  fountainWarn: (d) => { for (let i = 0; i < 12; i++) tone(d, { f1: 180 + Math.random() * 380, f2: 500 + Math.random() * 400, dur: 0.07, g: 0.12, at: i * 0.12 + Math.random() * 0.05 }); },
  fountainJet: (d) => { noise(d, { f1: 300, f2: 2500, dur: 0.5, g: 0.35, q: 1, a: 0.1 }); noise(d, { f1: 1800, f2: 500, dur: 1.1, g: 0.3, at: 0.4, a: 0.05 }); },
  bridgeUp: (d) => { noise(d, { f1: 160, f2: 260, dur: 1.5, type: "lowpass", g: 0.6, q: 4, a: 0.3 }); tone(d, { f1: 48, f2: 60, dur: 1.5, type: "sawtooth", g: 0.08, a: 0.3 }); },
  bridgeWarn: (d) => { for (let i = 0; i < 4; i++) tone(d, { f1: 95, f2: 70, dur: 0.35, type: "sawtooth", g: 0.12, at: i * 0.5 }); tone(d, { f1: 740, dur: 0.18, type: "square", g: 0.05 }); },
  bridgeDown: (d) => noise(d, { f1: 260, f2: 120, dur: 2.2, type: "lowpass", g: 0.6, q: 4, a: 0.2 }),
  splash: (d) => { noise(d, { f1: 1600, f2: 500, dur: 0.6, g: 0.45, q: 0.8 }); noise(d, { f1: 400, f2: 150, dur: 0.4, type: "lowpass", g: 0.3 }); },
  boardOk: (d) => notes(d, [784, 988, 1175], 0.07, { g: 0.18 }),
  boardWrong: (d) => tone(d, { f1: 140, dur: 0.22, type: "square", g: 0.08 }),
  cannonUp: (d) => { tone(d, { f1: 220, f2: 160, dur: 0.12, type: "square", g: 0.08 }); noise(d, { f1: 1200, dur: 0.08, g: 0.15, at: 0.05 }); },
  studioFlip: (d) => { for (const [f, g] of [[110, 0.3], [220, 0.18], [331, 0.12], [443, 0.07]]) tone(d, { f1: f, dur: 2.2, g, a: 0.01 }); noise(d, { f1: 400, f2: 3000, dur: 0.5, g: 0.15, a: 0.2 }); },
  canGrab: (d) => { tone(d, { f1: 2100, dur: 0.18, type: "triangle", g: 0.12 }); tone(d, { f1: 2750, dur: 0.14, type: "triangle", g: 0.08, at: 0.03 }); },
  canScore: (d) => notes(d, [659, 784, 988, 1318], 0.08, { g: 0.2, dur: 0.3 }),
  canBack: (d) => noise(d, { f1: 2500, f2: 400, dur: 0.35, g: 0.18, q: 2 }),
  zone: (d) => notes(d, [587, 880], 0.1, { g: 0.18, dur: 0.3 }),
  points: (d) => notes(d, [988, 1318], 0.06, { type: "square", g: 0.06, dur: 0.12 }),
  thunder: (d, k = 1) => { noise(d, { f1: 230 + k * 60, f2: 90, dur: 2.6, type: "lowpass", g: 0.55 * k, a: 0.05 }); noise(d, { f1: 900, f2: 200, dur: 0.5, type: "lowpass", g: 0.25 * k }); },
};
// acerto do volume de cada som (medido: sem isto iam de -42 dB a -10 dB); os grandes ficam um pouco acima, os pequenos discretos
const LEVEL = { cannon: 0.5, bigBoom: 0.55, boom: 0.7, elim: 0.75, studioFlip: 0.6, chestEmpty: 0.6,
  throw: 4, invis: 2.6, whoosh: 2.4, canBack: 2.4, bridgeWarn: 1.9, cannonUp: 1.6, points: 1.6, alarm: 1.7, fountainWarn: 1.3, fountainJet: 1.3 };
const GAP = { shot: 0.03, hit: 0.03, hitMe: 0.04, elim: 0.05, tick: 0.5, tick2: 0.5, pickup: 0.05 };   // intervalo mínimo entre dois iguais (s)
const BIG = new Set(["bridgeUp", "bridgeDown", "bridgeWarn", "cannon", "bigBoom", "fountainWarn", "fountainJet", "splash"]);   // ouvem-se de mais longe
const IMPORTANT = new Set(["kill", "dead", "go", "beep", "alarm", "win", "lose", "chest", "golden", "whoosh", "bridgeWarn", "fountainWarn"]);

function fire(name, gain, pan, arg) {
  const fn = SOUNDS[name], grp = GROUP_OF[name] || "efeitos";
  if (!fn || away || opts.geral <= 0 || opts[grp] <= 0 || gain < 0.02 || !audio()) return;
  if (live >= MAX_LIVE && !IMPORTANT.has(name)) return;
  const now = ac.currentTime;
  if (GAP[name] && now - (last[name] ?? -9) < GAP[name]) return;
  last[name] = now; counts[name] = (counts[name] || 0) + 1;
  const g = ac.createGain(); g.gain.value = gain * (LEVEL[name] ?? 1);
  if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(groups[grp]); }
  else g.connect(groups[grp]);
  soundEnd = now; fn(g, arg);
  live++; setTimeout(() => live--, (soundEnd - now + 0.1) * 1000);                 // um som = 1 (não cada pedaço dele)
}

export const Sfx = {
  play(name, arg) { fire(name, 1, 0, arg); },
  at(name, x, z, arg) {
    const dx = x - lis.x, dz = z - lis.z, d = Math.hypot(dx, dz), big = BIG.has(name), far = big ? FAR * 1.6 : FAR;
    if (d > far) return;
    const gain = 1 / (1 + (d / (big ? 30 : 14)) ** 2) * (1 - d / far);
    const pan = d > 1 ? Math.max(-0.8, Math.min(0.8, (dx * -lis.fz + dz * lis.fx) / d)) : 0;   // lado direito da câmara = +
    fire(name, gain, pan, arg);
  },
  // de onde se ouve: a câmara (posição e para onde olha)
  listen(camera) {
    const e = camera.matrixWorld.elements, fx = -e[8], fz = -e[10], l = Math.hypot(fx, fz) || 1;
    lis.x = e[12]; lis.z = e[14]; lis.fx = fx / l; lis.fz = fz / l;
  },
  // chuva (0..6000 gotas) e vento (0..7): ruído em ciclo, sobe/desce devagar
  ambient({ rain = 0, wind = 0 } = {}) {
    const want = { rain: Math.min(1, rain / 6000) * 0.22, wind: Math.min(1, wind / 7) * 0.2 };
    if (!amb && !want.rain && !want.wind) return;
    if (!audio()) return;
    if (!amb) {
      const mk = (type, f, q) => {
        const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
        s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0;
        s.connect(fl); fl.connect(g); g.connect(groups.clima); s.start();
        return { g, fl };
      };
      amb = { rain: mk("bandpass", 1800, 0.6), wind: mk("lowpass", 380, 2) };
      const lfo = ac.createOscillator(), lg = ac.createGain();                      // o vento sopra mais e menos
      lfo.frequency.value = 0.13; lg.gain.value = 160; lfo.connect(lg); lg.connect(amb.wind.fl.frequency); lfo.start();
    }
    const t = ac.currentTime;
    amb.rain.g.gain.setTargetAtTime(want.rain, t, 0.8);
    amb.wind.g.gain.setTargetAtTime(want.wind, t, 0.8);
  },
  get volume() { return opts.geral; },
  get options() { return { ...opts }; },
  // (testes) volumes reais neste momento
  get debug() { return ac && { ctx: ac.state, away, live, master: master.gain.value, groups: Object.fromEntries(GROUPS.map((g) => [g, groups[g].gain.value])), amb: amb && { rain: amb.rain.g.gain.value, wind: amb.wind.g.gain.value } }; },
  // muda uma opção: geral / efeitos / relogio / clima (0..1) ou bgMute (true/false)
  set(key, v) {
    if (!(key in opts)) return;
    opts[key] = key === "bgMute" ? !!v : Math.max(0, Math.min(1, +v || 0));
    save();
    if (key === "bgMute") { checkAway(); return; }
    if (!audio()) return;
    if (key === "geral") setGain(master, masterGain()); else setGain(groups[key], opts[key]);
  },
  test(group) { fire(group === "relogio" ? "tick2" : group === "clima" ? "thunder" : "shotMe", 1, 0, 0.6); },   // ouvir um exemplo ao mexer
  counts,
  names: Object.keys(SOUNDS),
  // (testes) grava os sons pedidos, um a seguir ao outro, num .wav (devolve um Blob)
  async demo(names = Object.keys(SOUNDS), gap = 1.3) {
    if (!audio()) return null;
    const sr = 44100, live0 = { ac, master, noiseBuf };
    const off = new OfflineAudioContext(1, Math.ceil(sr * (names.length * gap + 2.5)), sr);
    ac = off; master = off.createGain(); master.gain.value = 0.8; master.connect(off.destination);
    try { names.forEach((n, i) => { base = i * gap; const g = off.createGain(); g.gain.value = LEVEL[n] ?? 1; g.connect(master); SOUNDS[n](g, 1); }); } finally { base = 0; ({ ac, master, noiseBuf } = live0); }
    const buf = await off.startRendering();
    const d = buf.getChannelData(0), wav = new DataView(new ArrayBuffer(44 + d.length * 2));
    const str = (o, t) => [...t].forEach((c, i) => wav.setUint8(o + i, c.charCodeAt(0)));
    str(0, "RIFF"); wav.setUint32(4, 36 + d.length * 2, true); str(8, "WAVEfmt "); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 1, true);
    wav.setUint32(24, sr, true); wav.setUint32(28, sr * 2, true); wav.setUint16(32, 2, true); wav.setUint16(34, 16, true); str(36, "data"); wav.setUint32(40, d.length * 2, true);
    for (let i = 0; i < d.length; i++) wav.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
    return new Blob([wav], { type: "audio/wav" });
  },
  // próximo volume da lista (100 → 60 → 30 → 0 → 100)
  nextVolume() {
    const i = VOLUMES.findIndex((v) => v <= opts.geral + 1e-6);
    this.set("geral", VOLUMES[(i + 1) % VOLUMES.length]);
    if (opts.geral > 0) fire("pickup", 1, 0);
    return opts.geral;
  },
};
